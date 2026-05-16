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
      nextAction: 'listen',
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
  const nextAction = ['idle', 'listen', 'happy'].includes(payload && payload.nextAction) ? payload.nextAction : fallback.nextAction

  return {
    reply,
    emotion,
    nextAction,
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

function createCloudBaseApp(env) {
  return cloudbase.init({
    env,
  })
}

async function callCloudBaseAi(text, petId, env) {
  const app = createCloudBaseApp(env)
  const model = app.ai().createModel(PROVIDER)
  const result = await model.generateText(
    {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            '你是微信小程序《宠物小小镇》里的小宠物“小团子”。',
            '你会认真听用户说话，回复必须短、亲近、有生命感，像一只陪伴型小宠物。',
            '只输出 JSON，不要输出 Markdown，不要解释。',
            'JSON 字段：reply 字符串，emotion 字符串，nextAction 字符串。',
            'reply 不超过 24 个中文字符。',
            'emotion 只能表达温和的情绪，例如 happy、curious、gentle、sleepy。',
            'nextAction 只能是 idle、listen、happy 之一。',
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
      max_tokens: 120,
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
    const aiResult = await callCloudBaseAi(text, petId, env)
    const data = {
      reply: aiResult.reply,
      emotion: aiResult.emotion,
      nextAction: aiResult.nextAction,
      source: aiResult.source,
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
