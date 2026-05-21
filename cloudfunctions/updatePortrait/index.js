const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const PROVIDER = process.env.AI_PROVIDER || 'hunyuan-v3'
const MODEL = process.env.AI_MODEL || 'hy3-preview'
const MEMORIES_COLLECTION = 'user_memories'
const PROFILES_COLLECTION = 'user_profiles'

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  if (!openId) return { ok: false, error: { message: '无法获取用户身份' } }

  const env = wxContext.ENV || process.env.TCB_ENV || ''

  try {
    const profile = await db.collection(PROFILES_COLLECTION).doc(openId).get().then((r) => r.data).catch(() => null)
    if (!profile || !profile._needsPortraitUpdate) {
      return { ok: true, data: { skipped: true } }
    }

    const memoriesResult = await db.collection(MEMORIES_COLLECTION)
      .where({ _openId: openId })
      .orderBy('importance', 'desc')
      .limit(15)
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
            content: '你是一个用户画像生成器。根据用户的记忆列表，生成一段简洁的用户画像（100-150字）。要求：合并同一实体的信息，去除过时信息，保留最新状态，语言简洁像人物档案。只输出画像文本，不要解释。',
          },
          {
            role: 'user',
            content: `当前画像：${oldPortrait || '（空）'}\n\n近期记忆：\n${memoryList}\n\n输出新画像：`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      },
      { timeout: 15000 },
    )

    const newPortrait = (result.text || '').trim().slice(0, 200)

    await db.collection(PROFILES_COLLECTION).doc(openId).update({
      data: {
        portrait: newPortrait,
        memoryCountSinceUpdate: 0,
        _needsPortraitUpdate: false,
        lastUpdatedAt: new Date().toISOString(),
      },
    })

    return { ok: true, data: { portrait: newPortrait } }
  } catch (error) {
    console.warn('[updatePortrait] failed:', error && error.message ? error.message : error)
    return { ok: false, error: { message: error.message || '画像更新失败' } }
  }
}
