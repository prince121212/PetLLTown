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
  const text = typeof value === 'string' ? value.trim() : ''
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

function extractJson(text) {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')

  if (first === -1 || last === -1 || last <= first) {
    throw new Error('AI response is not JSON')
  }

  return JSON.parse(candidate.slice(first, last + 1))
}

function normalizeAiPayload(payload, text) {
  const fallback = fallbackReply(text)
  const reply = clampText(payload && payload.reply, 48) || fallback.reply
  const emotion = clampText(payload && payload.emotion, 24) || fallback.emotion
  const validActions = ['idle', 'sleep-enter', 'listening']
  const nextAction = validActions.includes(payload && payload.nextAction) ? payload.nextAction : fallback.nextAction

  let memory = null
  if (payload && payload.memory && typeof payload.memory === 'object') {
    const content = clampText(payload.memory.content, 30)
    const entity = clampText(payload.memory.entity, 10)
    if (content) memory = { content, entity: entity || '' }
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
const MAX_MEMORIES = 15

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

  const existing = await loadMemories(openId)

  if (memory.entity) {
    const match = existing.find((m) => m.entity && m.entity === memory.entity)
    if (match) {
      await db.collection(MEMORIES_COLLECTION).doc(match._id).update({
        data: { content: memory.content, createdAt: now(), importance: Math.max(match.importance || 0.4, computeImportance(memory.content)) },
      })
      return
    }
  }

  if (existing.length >= MAX_MEMORIES) {
    const lowest = existing[existing.length - 1]
    if (lowest && lowest._id) {
      await db.collection(MEMORIES_COLLECTION).doc(lowest._id).remove()
    }
  }

  await db.collection(MEMORIES_COLLECTION).add({
    data: {
      _openId: openId,
      content: memory.content,
      entity: memory.entity || '',
      importance: computeImportance(memory.content),
      createdAt: now(),
    },
  })

  await checkPortraitUpdate(openId)
}

function computeImportance(content) {
  let score = 0.4
  if (/喜欢|讨厌|最爱|不喜欢|爱吃/.test(content)) score += 0.2
  if (/难过|生气|想哭|幸福|开心|焦虑/.test(content)) score += 0.2
  if (/叫|名|岁|工作|家|养了|住在/.test(content)) score += 0.15
  return Math.min(score, 1.0)
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
    if (count >= 5) {
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

async function callCloudBaseAi(text, petId, env, petStateInfo, memoryContext) {
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
            'memory 字段规则：如果用户这句话包含值得长期记住的个人信息（偏好、事实、情绪、计划），输出 memory 对象：{"content":"不超过20字的概括","entity":"相关实体名"}。如果没有值得记住的（闲聊、打招呼），不要输出 memory 字段。',
            stateContext,
            memoryContext,
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            petId,
            userText: text,
          }),
        },
      ],
      temperature: 0.8,
      max_tokens: 180,
    },
    {
      timeout: 12000,
    },
  )

  const payload = extractJson(result.text)
  const data = normalizeAiPayload(payload, text)

  return {
    ...data,
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

    const aiResult = await callCloudBaseAi(text, petId, env, event.petState || null, memoryContext)
    const data = {
      reply: aiResult.reply,
      emotion: aiResult.emotion,
      nextAction: aiResult.nextAction,
      source: aiResult.source,
    }

    if (aiResult.memory && openId) {
      writeMemory(openId, aiResult.memory).catch(() => undefined)
    }

    await writeAiLog({
      ...baseLog,
      status: 'success',
      emotion: data.emotion,
      nextAction: data.nextAction,
      replyLength: data.reply.length,
      usage: aiResult.usage,
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: true,
      data,
      meta: {
        model: MODEL,
        provider: PROVIDER,
        memories: memories.map((m) => m.content),
        portrait: portraitText,
        newMemory: aiResult.memory || null,
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
