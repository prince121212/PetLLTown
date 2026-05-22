const cloud = require('wx-server-sdk')
const https = require('node:https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const USERS_COLLECTION = 'users'
const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session'

function now() {
  return new Date().toISOString()
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return ''
}

function sanitizeScene(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w-]/g, '')
    .slice(0, 40) || 'unknown'
}

function sanitizeNickName(value) {
  return String(value || '')
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 40)
}

function sanitizeAvatarUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(https?:\/\/|wxfile:\/\/|cloud:\/\/|tmp\/|\/)/i.test(text)) {
    return text.slice(0, 500)
  }
  return ''
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (error) {
    const message = error && error.message ? String(error.message) : ''
    if (message && !message.includes('already exist')) {
      console.warn('[authLogin] ensureCollection failed:', name, message)
    }
  }
}

async function requestJson(url) {
  return await new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        try {
          resolve(JSON.parse(text || '{}'))
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('error', reject)
  })
}

function normalizeStr(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function code2Session(code, appid, secret) {
  const params = new URLSearchParams({
    appid,
    secret,
    js_code: code,
    grant_type: 'authorization_code',
  })
  const payload = await requestJson(`${WECHAT_CODE2SESSION_URL}?${params.toString()}`)

  if (payload.errcode) {
    throw new Error(payload.errmsg || `code2Session 失败：${payload.errcode}`)
  }

  return payload
}

function buildContextSession(wxContext) {
  const openId = normalizeStr(wxContext.OPENID)
  if (!openId) return null

  return {
    openid: openId,
    unionid: normalizeStr(wxContext.UNIONID),
    appid: normalizeStr(wxContext.APPID),
    session_key: '',
    identitySource: 'wx-context',
  }
}

async function getUser(openId) {
  try {
    const result = await db.collection(USERS_COLLECTION).doc(openId).get()
    return result.data || null
  } catch {
    return null
  }
}

async function setUser(openId, data) {
  await ensureCollection(USERS_COLLECTION)
  await db.collection(USERS_COLLECTION).doc(openId).set({ data })
}

async function updateUser(openId, data) {
  try {
    await db.collection(USERS_COLLECTION).doc(openId).update({ data })
  } catch (error) {
    const message = error && error.message ? String(error.message) : ''
    if (message.includes('not exist') || message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      await setUser(openId, {
        _openId: openId,
        createdAt: data.lastLoginAt || now(),
        ...data,
      })
      return
    }
    throw error
  }
}

async function handleProfileUpdate(event, wxContext) {
  const openId = normalizeStr(wxContext.OPENID)
  if (!openId) {
    return {
      ok: false,
      error: {
        code: 'OPENID_NOT_READY',
        message: '无法获取微信用户身份',
      },
    }
  }

  const profile = event && typeof event.profile === 'object' && event.profile ? event.profile : {}
  const nickName = sanitizeNickName(profile.nickName || profile.nickname || profile.wechatNickName)

  if (!nickName) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_PROFILE',
        message: '请先填写昵称',
      },
    }
  }

  const updatedAt = now()
  const existing = await getUser(openId)
  const patch = {
    _openId: openId,
    openId,
    nickName: nickName || (existing && existing.nickName ? String(existing.nickName) : ''),
    avatarUrl: existing && existing.avatarUrl ? String(existing.avatarUrl) : '',
    profileUpdatedAt: updatedAt,
    lastActiveAt: updatedAt,
    clientProfileUpdatedAt: typeof event.clientUpdatedAt === 'string' ? event.clientUpdatedAt : '',
    updatedAt,
  }

  if (existing) {
    await updateUser(openId, patch)
  } else {
    await setUser(openId, {
      ...patch,
      unionId: normalizeStr(wxContext.UNIONID),
      appId: normalizeStr(wxContext.APPID),
      loginProvider: 'wechat-miniprogram',
      loginScene: 'profile',
      loginCount: 0,
      firstLoginAt: updatedAt,
      lastLoginAt: '',
      createdAt: updatedAt,
    })
  }

  return {
    ok: true,
    data: {
      openId,
      nickName: patch.nickName,
      avatarUrl: '',
      profileUpdatedAt: updatedAt,
    },
  }
}

function pickProfileNickName(event) {
  const profile = event && typeof event.profile === 'object' && event.profile ? event.profile : {}
  return sanitizeNickName(profile.nickName || profile.nickname || profile.wechatNickName)
}

function pickProfileAvatarUrl(event) {
  const profile = event && typeof event.profile === 'object' && event.profile ? event.profile : {}
  return sanitizeAvatarUrl(profile.avatarUrl || profile.avatar || profile.wechatAvatarUrl)
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  if (event.action === 'updateProfile') {
    try {
      return await handleProfileUpdate(event, wxContext)
    } catch (error) {
      console.warn('[authLogin] updateProfile failed:', error && error.message ? error.message : error)
      return {
        ok: false,
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          message: error && error.message ? error.message : '保存用户资料失败',
        },
      }
    }
  }

  const code = typeof event.code === 'string' ? event.code.trim() : ''
  if (!code) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_CODE',
        message: '缺少登录 code',
      },
    }
  }

  try {
    const appid = firstEnv('WECHAT_APP_ID', 'WECHAT_MINIPROGRAM_APPID') || normalizeStr(wxContext.APPID)
    const secret = firstEnv('WECHAT_APP_SECRET', 'WECHAT_MINIPROGRAM_APP_SECRET')
    const session = appid && secret
      ? { ...(await code2Session(code, appid, secret)), identitySource: 'code2Session' }
      : buildContextSession(wxContext)

    if (!session) {
      return {
        ok: false,
        error: {
          code: 'OPENID_NOT_READY',
          message: '无法获取微信用户身份',
        },
      }
    }

    const openId = normalizeStr(session.openid)
    const unionId = normalizeStr(session.unionid)
    const resolvedAppId = appid || normalizeStr(session.appid)
    const sessionKey = normalizeStr(session.session_key)

    if (!openId) {
      return {
        ok: false,
        error: {
          code: 'OPENID_NOT_READY',
          message: '无法获取微信用户身份',
        },
      }
    }

    const loginAt = now()
    const scene = sanitizeScene(event.scene)
    const existing = await getUser(openId)
    const loginCount = existing && typeof existing.loginCount === 'number'
      ? existing.loginCount + 1
      : 1
    const profileNickName = pickProfileNickName(event)
    const profileAvatarUrl = pickProfileAvatarUrl(event)
    const existingNickName = sanitizeNickName(
      profileNickName || (existing && (existing.nickName || existing.nickname || existing.wechatNickName))
    )

    const userRecord = {
      _openId: openId,
      openId,
      unionId,
      appId: resolvedAppId,
      nickName: existingNickName,
      nickname: existingNickName,
      wechatNickName: existingNickName,
      avatarUrl: profileAvatarUrl || (existing && existing.avatarUrl ? String(existing.avatarUrl) : ''),
      loginProvider: 'wechat-miniprogram',
      loginScene: scene,
      identitySource: session.identitySource || 'unknown',
      loginCount,
      firstLoginAt: existing && existing.firstLoginAt ? existing.firstLoginAt : loginAt,
      lastLoginAt: loginAt,
      lastActiveAt: loginAt,
      clientLoggedAt: typeof event.clientLoggedAt === 'string' ? event.clientLoggedAt : '',
      sessionKeyIssued: Boolean(sessionKey),
      updatedAt: loginAt,
    }

    if (existing) {
      await updateUser(openId, userRecord)
    } else {
      await setUser(openId, {
        ...userRecord,
        createdAt: loginAt,
      })
    }

    return {
      ok: true,
      data: {
        openId,
        unionId,
        appId: resolvedAppId,
        nickName: existingNickName,
        nickname: existingNickName,
        wechatNickName: existingNickName,
        avatarUrl: profileAvatarUrl || (existing && existing.avatarUrl ? String(existing.avatarUrl) : ''),
        loginAt,
        identitySource: session.identitySource || 'unknown',
        isNewUser: !existing,
      },
    }
  } catch (error) {
    console.warn('[authLogin] failed:', error && error.message ? error.message : error)
    return {
      ok: false,
      error: {
        code: 'AUTH_LOGIN_FAILED',
        message: error && error.message ? error.message : '登录失败',
      },
    }
  }
}
