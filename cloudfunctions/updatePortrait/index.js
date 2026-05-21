const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const PROVIDER = process.env.AI_PROVIDER || 'hunyuan-v3'
const MODEL = process.env.AI_MODEL || 'hy3-preview'
const MEMORIES_COLLECTION = 'user_memories'
const PROFILES_COLLECTION = 'user_profiles'
const CONFIG_COLLECTION = 'app_configs'
const CONFIG_DOC_ID = 'bootstrap'
const DEFAULT_AI_MEMORY_CONFIG = {
  shortTermMemoryMaxCount: 8,
  portraitTriggerCount: 3,
  portraitSourceMemoryLimit: 15,
  portraitMaxLength: 200,
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : fallback
}

function normalizeAiMemoryConfig(value) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    shortTermMemoryMaxCount: toPositiveInt(source.shortTermMemoryMaxCount, DEFAULT_AI_MEMORY_CONFIG.shortTermMemoryMaxCount),
    portraitTriggerCount: toPositiveInt(source.portraitTriggerCount, DEFAULT_AI_MEMORY_CONFIG.portraitTriggerCount),
    portraitSourceMemoryLimit: toPositiveInt(source.portraitSourceMemoryLimit, DEFAULT_AI_MEMORY_CONFIG.portraitSourceMemoryLimit),
    portraitMaxLength: toPositiveInt(source.portraitMaxLength, DEFAULT_AI_MEMORY_CONFIG.portraitMaxLength),
  }
}

async function loadAiMemoryConfig(eventConfig) {
  if (eventConfig && typeof eventConfig === 'object') {
    return normalizeAiMemoryConfig(eventConfig)
  }

  try {
    const result = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get()
    const record = result && result.data
    const config = record && record.config ? record.config : record
    return normalizeAiMemoryConfig(config && config.aiMemory)
  } catch (error) {
    console.warn('[updatePortrait] load ai memory config fallback:', error && error.message ? error.message : error)
    return normalizeAiMemoryConfig(null)
  }
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (error) {
    const message = error && error.message ? String(error.message) : ''
    if (message && !message.includes('already exist')) {
      console.warn('[updatePortrait] ensureCollection failed:', name, message)
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openId = (
    (typeof event.openId === 'string' && event.openId.trim()) ||
    (event.userInfo && typeof event.userInfo.openId === 'string' && event.userInfo.openId.trim()) ||
    wxContext.OPENID ||
    ''
  )
  if (!openId) return { ok: false, error: { message: '无法获取用户身份' } }

  const env = wxContext.ENV || process.env.TCB_ENV || ''

  try {
    const aiMemoryConfig = await loadAiMemoryConfig(event.aiMemory)
    await ensureCollection(PROFILES_COLLECTION)
    const profile = await db.collection(PROFILES_COLLECTION).doc(openId).get().then((r) => r.data).catch(() => null)
    if (!profile || !profile._needsPortraitUpdate) {
      return { ok: true, data: { skipped: true } }
    }

    await ensureCollection(MEMORIES_COLLECTION)
    const memoriesResult = await db.collection(MEMORIES_COLLECTION)
      .where({ _openId: openId })
      .orderBy('importance', 'desc')
      .limit(aiMemoryConfig.portraitSourceMemoryLimit)
      .get()
    const memories = memoriesResult.data || []

    if (!memories.length) {
      return { ok: true, data: { skipped: true, reason: 'no_memories' } }
    }

    const oldPortrait = profile.portrait || ''
    const memoryList = memories.map((m) => `- ${m.content}`).join('\n')

    const app = cloudbase.init({ env })
    const model = app.ai().createModel(PROVIDER)
    const result = await model.generateText(
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个主人画像生成器。根据主人的记忆列表，生成一段简洁的主人画像，不超过 ${aiMemoryConfig.portraitMaxLength} 字。要求：合并同一实体的信息，去除过时信息，保留最新状态，语言简洁像人物档案。只输出画像文本，不要解释。所有描述都要使用“主人”视角。`,
          },
          {
            role: 'user',
            content: `当前画像：${oldPortrait || '（空）'}\n\n近期记忆：\n${memoryList}\n\n输出新的主人画像：`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      },
      { timeout: 15000 },
    )

    const newPortrait = (result.text || '').trim().slice(0, aiMemoryConfig.portraitMaxLength)

    await db.collection(PROFILES_COLLECTION).doc(openId).update({
      data: {
        portrait: newPortrait,
        memoryCountSinceUpdate: 0,
        _needsPortraitUpdate: false,
        lastUpdatedAt: new Date().toISOString(),
      },
    })

    return { ok: true, data: { portrait: newPortrait, aiMemoryConfig } }
  } catch (error) {
    console.warn('[updatePortrait] failed:', error && error.message ? error.message : error)
    return { ok: false, error: { message: error.message || '画像更新失败' } }
  }
}
