const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const DEFAULT_ENGINE = '16k_zh'
const DEFAULT_VOICE_FORMAT = 8
const MAX_EXPIRE_SECONDS = 60

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function createNonce() {
  return Math.floor(Math.random() * 100000000)
}

function createVoiceId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${nowSeconds()}-${createNonce()}`
}

function createCredentialError() {
  const error = new Error('ASR realtime credentials are not configured')
  error.code = 'ASR_REALTIME_CONFIG_MISSING'
  return error
}

function getCredentials() {
  const secretId = process.env.ASR_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID
  const secretKey = process.env.ASR_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY
  const appId = process.env.TENCENTCLOUD_APP_ID || process.env.TENCENTCLOUD_APPID || process.env.ASR_APP_ID || process.env.ASR_APPID

  if (!secretId || !secretKey || !appId) {
    throw createCredentialError()
  }

  return {
    secretId,
    secretKey,
    appId: Number(appId),
  }
}

function encodeParams(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`)
    .join('&')
}

function stringifyParams(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&')
}

function createSignature(secretKey, signPath) {
  return crypto.createHmac('sha1', secretKey).update(signPath).digest('base64')
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()

  if (event.__checkOnly === true) {
    const ready = Boolean(
      (process.env.ASR_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID) &&
        (process.env.ASR_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY) &&
        (process.env.TENCENTCLOUD_APP_ID || process.env.TENCENTCLOUD_APPID || process.env.ASR_APP_ID || process.env.ASR_APPID),
    )

    return {
      ok: true,
      data: {
        ready,
        engineModelType: DEFAULT_ENGINE,
        voiceFormat: DEFAULT_VOICE_FORMAT,
        maxExpireSeconds: MAX_EXPIRE_SECONDS,
      },
      meta: {
        env: wxContext.ENV || '',
        openIdReady: Boolean(wxContext.OPENID),
      },
    }
  }

  try {
    const credential = getCredentials()
    const timestamp = nowSeconds()
    const expired = timestamp + MAX_EXPIRE_SECONDS
    const voiceId = createVoiceId()
    const params = {
      secretid: credential.secretId,
      timestamp,
      expired,
      nonce: createNonce(),
      engine_model_type: DEFAULT_ENGINE,
      voice_format: DEFAULT_VOICE_FORMAT,
      voice_id: voiceId,
      needvad: 1,
      filter_dirty: 0,
      filter_modal: 0,
      filter_punc: 0,
      convert_num_mode: 1,
      word_info: 0,
    }
    const signedQuery = stringifyParams(params)
    const requestQuery = encodeParams(params)
    const signPath = `asr.cloud.tencent.com/asr/v2/${credential.appId}?${signedQuery}`
    const signature = createSignature(credential.secretKey, signPath)
    const url = `wss://asr.cloud.tencent.com/asr/v2/${credential.appId}?${requestQuery}&signature=${encodeURIComponent(signature)}`

    return {
      ok: true,
      data: {
        url,
        voiceId,
        expired,
        engineModelType: DEFAULT_ENGINE,
        voiceFormat: DEFAULT_VOICE_FORMAT,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error && error.code ? String(error.code) : 'ASR_REALTIME_SIGN_FAILED',
        message: error && error.message ? String(error.message) : '实时语音识别暂时不可用',
      },
    }
  }
}
