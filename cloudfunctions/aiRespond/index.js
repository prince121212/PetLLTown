const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const PROVIDER = process.env.AI_PROVIDER || 'hunyuan-v3'
const MODEL = process.env.AI_MODEL || 'hy3-preview'
const MAX_TEXT_LENGTH = 160
const DEFAULT_PET_ID = 'xiaotuanzi'

function now() {
  return new Date().toISOString()
}

function clampText(value, maxLength) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function safeError(error) {
  const message = error && error.message ? String(error.message) : 'AI 暂时不可用'
  const code = error && (error.code || error.name) ? String(error.code || error.name) : 'AI_REQUEST_FAILED'

  return {
    code,
    message,
  }
}

function fallbackReply(text) {
  const lower = text.toLowerCase()

  if (!text) {
    return {
      reply: '我在呢，刚才那句有点轻，再靠近一点说给我听。',
      emotion: 'curious',
      nextAction: 'listening',
      source: 'fallback',
    }
  }

  if (text.includes('晚安') || text.includes('睡吧') || text.includes('休息')) {
    return {
      reply: '晚安~ 我也困了，陪你一起睡。',
      emotion: 'sleepy',
      nextAction: 'sleep-enter',
      source: 'fallback',
    }
  }

  if (text.includes('你好') || lower.includes('hello') || lower.includes('hi')) {
    return {
      reply: '你好呀，我刚刚认真听见你了。',
      emotion: 'happy',
      nextAction: 'idle',
      source: 'fallback',
    }
  }

  if (text.includes('喜欢') || text.includes('开心') || text.includes('棒')) {
    return {
      reply: '听起来亮晶晶的，我也跟着开心起来了。',
      emotion: 'happy',
      nextAction: 'idle',
      source: 'fallback',
    }
  }

  if (text.includes('难过') || text.includes('累') || text.includes('烦')) {
    return {
      reply: '我陪你慢慢待一会儿，不急着把心情变好。',
      emotion: 'gentle',
      nextAction: 'idle',
      source: 'fallback',
    }
  }

  return {
    reply: '我听懂啦，先把这句话悄悄放进小镇里。',
    emotion: 'curious',
    nextAction: 'idle',
    source: 'fallback',
  }
}

function normalizeMemory(memory, source) {
  if (!memory || typeof memory !== 'object') return null

  const content = clampText(memory.content, 30)
  if (!content) return null

  return {
    ...memory,
    content,
    importance: typeof memory.importance === 'number' ? Math.min(1, Math.max(0, memory.importance)) : 0.5,
    source: source || memory.source || 'ai',
  }
}

function parseMemoryCandidate(payload) {
  if (!payload || typeof payload !== 'object') return null

  const candidate = payload.memory
  if (candidate === null || candidate === undefined) return null

  if (typeof candidate === 'string') {
    return {
      content: candidate,
      importance: 0.5,
    }
  }

  if (typeof candidate === 'object') {
    return candidate
  }

  return null
}

function unwrapCodeFence(text) {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

function parseJsonCandidate(text) {
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')

  if (first === -1 || last === -1 || last <= first) {
    return null
  }

  const candidate = text.slice(first, last + 1).replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function extractLooseFields(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return null
  }

  const payload = {}

  for (const line of lines) {
    const match = line.match(/^(reply|回复|answer|emotion|nextAction|memory)\s*[:：]\s*(.+)$/i)
    if (!match) continue

    const key = match[1]
    const value = match[2].trim()

    if (key === 'memory') {
      payload.memory = value
    } else if (key.toLowerCase() === 'nextaction') {
      payload.nextAction = value
    } else if (key.toLowerCase() === 'emotion') {
      payload.emotion = value
    } else {
      payload.reply = value
    }
  }

  return payload.reply || payload.emotion || payload.nextAction || payload.memory ? payload : null
}

function cleanupPlainReply(text) {
  const normalized = unwrapCodeFence(text)

  if (!normalized) {
    return ''
  }

  const loose = extractLooseFields(normalized)
  if (loose && typeof loose.reply === 'string' && loose.reply.trim()) {
    return clampText(loose.reply, 48)
  }

  const lines = normalized
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const firstLine = lines[0] || ''
  return clampText(
    firstLine
      .replace(/^(reply|回复|回答|answer|assistant)\s*[:：]\s*/i, '')
      .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, ''),
    48,
  )
}

function parseAiOutput(text) {
  const normalized = unwrapCodeFence(text)

  if (!normalized) {
    return {
      payload: null,
      parseMode: 'empty',
    }
  }

  const jsonPayload = parseJsonCandidate(normalized)
  if (jsonPayload) {
    return {
      payload: jsonPayload,
      parseMode: 'json',
    }
  }

  const loosePayload = extractLooseFields(normalized)
  if (loosePayload) {
    return {
      payload: loosePayload,
      parseMode: 'loose',
    }
  }

  return {
    payload: {
      reply: cleanupPlainReply(normalized),
    },
    parseMode: 'raw-text',
  }
}

function normalizeAiPayload(payload, text) {
  const fallback = fallbackReply(text)
  const reply = clampText(payload && payload.reply, 48) || fallback.reply
  const emotion = clampText(payload && payload.emotion, 24) || fallback.emotion
  const validActions = ['idle', 'sleep-enter', 'listening']
  const nextAction = validActions.includes(payload && payload.nextAction) ? payload.nextAction : fallback.nextAction

  let memory = null
  if (payload && payload.memory) {
    if (typeof payload.memory === 'string') {
      memory = { content: payload.memory, importance: 0.5 }
    } else if (typeof payload.memory === 'object') {
      const content = clampText(payload.memory.content, 30)
      const importance = typeof payload.memory.importance === 'number' ? payload.memory.importance : 0.5
      if (content) memory = { content, importance }
    }
  }

  return {
    reply,
    emotion,
    nextAction,
    memory,
    source: 'ai',
  }
}

async function writeAiLog(log) {
  try {
    await db.collection('ai_logs').add({
      data: {
        ...log,
        createdAt: now(),
      },
    })
  } catch (error) {
    console.warn('[aiRespond] write ai log failed:', error && error.message ? error.message : error)
  }
}

const MEMORIES_COLLECTION = 'user_memories'
const PROFILES_COLLECTION = 'user_profiles'
const MAX_MEMORIES = 8
const PORTRAIT_TRIGGER_COUNT = 3

async function loadMemories(openId) {
  try {
    const result = await db.collection(MEMORIES_COLLECTION)
      .where({ _openId: openId })
      .orderBy('importance', 'desc')
      .limit(MAX_MEMORIES)
      .get()
    return result.data || []
  } catch {
    return []
  }
}

async function loadPortrait(openId) {
  try {
    const result = await db.collection(PROFILES_COLLECTION).doc(openId).get()
    return result.data || null
  } catch {
    return null
  }
}

async function writeMemory(openId, memory) {
  if (!memory || !memory.content) return

  try {
    const existing = await loadMemories(openId)

    if (existing.length >= MAX_MEMORIES) {
      const scored = existing.map((m) => ({
        ...m,
        score: (m.importance || 0.4) + Math.max(0, 1 - (Date.now() - new Date(m.createdAt).getTime()) / (72 * 3600 * 1000)),
      }))
      scored.sort((a, b) => a.score - b.score)
      const toRemove = scored[0]
      if (toRemove && toRemove._id) {
        await db.collection(MEMORIES_COLLECTION).doc(toRemove._id).remove()
      }
    }

    await db.collection(MEMORIES_COLLECTION).add({
      data: {
        _openId: openId,
        content: memory.content,
        importance: typeof memory.importance === 'number' ? Math.min(1, Math.max(0, memory.importance)) : 0.5,
        source: memory.source || 'ai',
        createdAt: now(),
      },
    })

    await checkPortraitUpdate(openId)
  } catch (error) {
    if (error && error.message && error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      try {
        await db.createCollection(MEMORIES_COLLECTION)
        await db.collection(MEMORIES_COLLECTION).add({
          data: {
            _openId: openId,
            content: memory.content,
            importance: typeof memory.importance === 'number' ? Math.min(1, Math.max(0, memory.importance)) : 0.5,
            source: memory.source || 'ai',
            createdAt: now(),
          },
        })
      } catch {}
    }
    console.warn('[aiRespond] writeMemory failed:', error && error.message ? error.message : error)
  }
}

async function checkPortraitUpdate(openId) {
  try {
    let profile = await loadPortrait(openId)
    if (!profile) {
      try {
        await db.collection(PROFILES_COLLECTION).doc(openId).set({
          data: { _openId: openId, portrait: '', memoryCountSinceUpdate: 1, lastUpdatedAt: now() },
        })
      } catch {
        await db.collection(PROFILES_COLLECTION).add({
          data: { _id: openId, _openId: openId, portrait: '', memoryCountSinceUpdate: 1, lastUpdatedAt: now() },
        })
      }
      return
    }

    const count = (profile.memoryCountSinceUpdate || 0) + 1
    if (count >= PORTRAIT_TRIGGER_COUNT) {
      await db.collection(PROFILES_COLLECTION).doc(openId).update({
        data: { memoryCountSinceUpdate: 0, _needsPortraitUpdate: true },
      })
      cloud.callFunction({ name: 'updatePortrait', data: {} }).catch(() => undefined)
    } else {
      await db.collection(PROFILES_COLLECTION).doc(openId).update({
        data: { memoryCountSinceUpdate: count },
      })
    }
  } catch {
    // ignore
  }
}

function createCloudBaseApp(env) {
  return cloudbase.init({
    env,
  })
}

async function callCloudBaseAi(text, petId, env, petStateInfo, memoryContext, chatHistory) {
  const app = createCloudBaseApp(env)
  const model = app.ai().createModel(PROVIDER)

  const stateContext = petStateInfo
    ? `\n当前状态：精力${petStateInfo.energy}/100，亲密度${petStateInfo.affection}/100，心情「${petStateInfo.mood}」，关系「${petStateInfo.relationship}」，时段「${petStateInfo.timeOfDay}」。根据这些状态调整你的语气和回复。精力低时表现困意，亲密度高时更撒娇。`
    : ''

  const result = await model.generateText(
    {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            '你是微信小程序《宠物小小镇》里的小宠物。',
            '你会认真听用户说话，回复必须短、亲近、有生命感，像一只陪伴型小宠物。',
            '只输出 JSON，不要输出 Markdown，不要解释。',
            'JSON 字段：reply 字符串，emotion 字符串，nextAction 字符串，memory 对象（可选）。',
            'reply 不超过 24 个中文字符。',
            'emotion 表达你的情绪：happy、curious、gentle、sleepy、excited。',
            'nextAction 决定你回复后的动作，只能是以下之一：',
            '  idle — 回到日常待机（默认，大部分情况用这个）',
            '  sleep-enter — 去睡觉（用户说晚安、说累了、说让你休息时）',
            '  listening — 继续倾听（用户话没说完、你想让用户继续说时）',
            '根据用户说的内容智能选择 nextAction，不要总是 idle。',
            '如果用户说晚安/睡吧/休息，nextAction 必须是 sleep-enter。',
            '如果用户的话像是没说完或者你想追问，nextAction 用 listening。',
            '',
            'memory 字段规则：如果用户这句话包含值得长期记住的个人信息（偏好、事实、情绪、计划），输出 memory 对象：{"content":"不超过20字的概括","importance":0到1的重要性}。长期偏好和核心事实给0.7-0.9，临时情绪和近期计划给0.3-0.5。如果没有值得记住的（闲聊、打招呼），不要输出 memory 字段。',
            stateContext,
            memoryContext,
          ].join('\n'),
        },
        ...(Array.isArray(chatHistory) ? chatHistory.slice(-5).flatMap((turn) => [
          { role: 'user', content: turn.user || '' },
          { role: 'assistant', content: turn.pet || '' },
        ]) : []),
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.8,
      max_tokens: 180,
    },
    {
      timeout: 12000,
    },
  )

  const parsed = parseAiOutput(result.text)
  const data = normalizeAiPayload(parsed.payload, text)

  return {
    ...data,
    parseMode: parsed.parseMode,
    usage: result.usage || {},
    rawText: result.text || '',
  }
}

async function extractMemoryWithAi(text, env, petStateInfo, chatHistory) {
  const app = createCloudBaseApp(env)
  const model = app.ai().createModel(PROVIDER)

  const stateContext = petStateInfo
    ? `\n当前状态：精力${petStateInfo.energy}/100，亲密度${petStateInfo.affection}/100，心情「${petStateInfo.mood}」，关系「${petStateInfo.relationship}」，时段「${petStateInfo.timeOfDay}」。`
    : ''

  const historyContext = Array.isArray(chatHistory) && chatHistory.length
    ? `\n最近对话：\n${chatHistory.slice(-4).map((turn) => `用户：${turn.user || ''}\n宠物：${turn.pet || ''}`).join('\n')}`
    : ''

  const result = await model.generateText(
    {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            '你是《宠物小小镇》的记忆提取器。',
            '你的任务只有一个：判断用户刚刚说的话里，是否有值得长期记住的信息。',
            '不要写回复，不要解释，不要分析过程。',
            '只输出 JSON，字段只有 memory。',
            'memory 为 null，或者为对象 {"content":"不超过20字的概括","importance":0到1之间的数字}。',
            '值得记住的内容包括：稳定偏好、身份、习惯、长期关系、明确计划、持续性的情绪状态。',
            '不值得记住的内容包括：打招呼、客套话、临时闲聊、单次感叹、没有信息量的重复。',
            '如果用户说“我最喜欢打篮球”，应该记为喜欢打篮球这一类稳定偏好。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `用户刚刚说：${text}`,
            stateContext,
            historyContext,
            '请只返回 JSON。',
          ].join('\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 120,
    },
    {
      timeout: 10000,
    },
  )

  const parsed = parseAiOutput(result.text)
  const memory = normalizeMemory(parseMemoryCandidate(parsed.payload), 'ai-memory')

  return {
    memory,
    parseMode: parsed.parseMode,
    usage: result.usage || {},
    rawText: result.text || '',
  }
}

exports.main = async (event = {}, context = {}) => {
  const startedAt = Date.now()
  const wxContext = cloud.getWXContext()
  const env = wxContext.ENV || process.env.TCB_ENV || process.env.SCF_NAMESPACE || ''
  const text = clampText(event.text, MAX_TEXT_LENGTH)
  const petId = clampText(event.petId, 64) || DEFAULT_PET_ID
  const baseLog = {
    _openid: wxContext.OPENID,
    petId,
    textLength: text.length,
    provider: PROVIDER,
    model: MODEL,
  }

  if (event.__checkOnly === true) {
    return {
      ok: true,
      data: {
        ready: true,
        provider: PROVIDER,
        model: MODEL,
        maxTextLength: MAX_TEXT_LENGTH,
      },
      meta: {
        env,
        openIdReady: Boolean(wxContext.OPENID),
      },
    }
  }

  if (!text) {
    const data = fallbackReply(text)
    await writeAiLog({
      ...baseLog,
      status: 'fallback',
      reason: 'EMPTY_TEXT',
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: true,
      data,
      meta: {
        fallback: true,
      },
    }
  }

  try {
    const openId = wxContext.OPENID || ''
    const memories = openId ? await loadMemories(openId) : []
    const profile = openId ? await loadPortrait(openId) : null
    const portraitText = profile && profile.portrait ? profile.portrait : ''

    let memoryContext = ''
    if (portraitText || memories.length) {
      const parts = []
      if (portraitText) parts.push(`用户画像：${portraitText}`)
      if (memories.length) parts.push(`近期记忆：\n${memories.map((m) => `- ${m.content}`).join('\n')}`)
      parts.push('回复时自然地体现你了解这个用户，但不要刻意复述。')
      memoryContext = '\n' + parts.join('\n')
    }

    const aiResult = await callCloudBaseAi(text, petId, env, event.petState || null, memoryContext, event.chatHistory || [])
    let memory = normalizeMemory(aiResult.memory, 'ai')
    let memoryMeta = {
      memorySource: memory ? memory.source : 'none',
      memoryParseMode: aiResult.parseMode,
    }

    if (!memory) {
      const memoryResult = await extractMemoryWithAi(text, env, event.petState || null, event.chatHistory || [])
      memory = memoryResult.memory
      memoryMeta = {
        memorySource: memory ? memory.source : 'none',
        memoryParseMode: memoryResult.parseMode,
      }
    }

    const data = {
      reply: aiResult.reply,
      emotion: aiResult.emotion,
      nextAction: aiResult.nextAction,
      source: aiResult.source,
    }

    if (memory && openId) {
      await writeMemory(openId, memory)
    }

    const updatedMemories = openId ? await loadMemories(openId) : []

    await writeAiLog({
      ...baseLog,
      status: 'success',
      emotion: data.emotion,
      nextAction: data.nextAction,
      replyLength: data.reply.length,
      parseMode: aiResult.parseMode,
      memorySource: memoryMeta.memorySource,
      memoryParseMode: memoryMeta.memoryParseMode,
      memoryImportance: memory ? memory.importance : undefined,
      usage: aiResult.usage,
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: true,
      data,
      meta: {
        model: MODEL,
        provider: PROVIDER,
        memories: updatedMemories.map((m) => m.content),
        portrait: portraitText,
        newMemory: memory || null,
        parseMode: aiResult.parseMode,
        memorySource: memoryMeta.memorySource,
        memoryParseMode: memoryMeta.memoryParseMode,
      },
    }
  } catch (error) {
    const normalized = safeError(error)
    const data = fallbackReply(text)

    await writeAiLog({
      ...baseLog,
      status: 'fallback',
      errorCode: normalized.code,
      errorMessage: normalized.message,
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: true,
      data,
      meta: {
        fallback: true,
        model: MODEL,
        provider: PROVIDER,
        error: normalized,
      },
    }
  }
}
