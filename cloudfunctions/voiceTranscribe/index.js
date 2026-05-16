const cloud = require('wx-server-sdk')
const asr = require('tencentcloud-sdk-nodejs-asr')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const AsrClient = asr.asr.v20190614.Client
const MAX_DURATION_MS = 15000
const MAX_FILE_SIZE = 3 * 1024 * 1024

function now() {
  return new Date().toISOString()
}

function safeError(error) {
  const rawCode = error && (error.code || error.name) ? String(error.code || error.name) : 'UNKNOWN_ERROR'
  const rawMessage = error && error.message ? String(error.message) : '语音识别暂时不可用'
  const lowerMessage = rawMessage.toLowerCase()

  if (lowerMessage.includes('audio data empty')) {
    return {
      code: 'ASR_AUDIO_EMPTY',
      message: '没有听到有效声音，开发者工具里请确认麦克风输入，最好用真机再试一次',
      requestId: error && error.requestId ? String(error.requestId) : '',
      rawCode,
    }
  }

  if (lowerMessage.includes('user is unopened') || lowerMessage.includes('asr_onesentence')) {
    return {
      code: 'ASR_SERVICE_UNOPENED',
      message: '语音识别服务还没开通，先去腾讯云开通一句话识别',
      requestId: error && error.requestId ? String(error.requestId) : '',
      rawCode,
    }
  }

  return {
    code: rawCode,
    message: rawMessage,
    requestId: error && error.requestId ? String(error.requestId) : '',
  }
}

function createAsrClient() {
  const secretId = process.env.ASR_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID
  const secretKey = process.env.ASR_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY

  if (!secretId || !secretKey) {
    const error = new Error('ASR credentials are not configured')
    error.code = 'ASR_CONFIG_MISSING'
    throw error
  }

  return new AsrClient({
    credential: {
      secretId,
      secretKey,
    },
    region: process.env.ASR_REGION || process.env.TENCENTCLOUD_REGION || 'ap-shanghai',
    profile: {
      httpProfile: {
        endpoint: 'asr.tencentcloudapi.com',
      },
    },
  })
}

async function writeVoiceLog(log) {
  try {
    await db.collection('voice_logs').add({
      data: {
        ...log,
        createdAt: now(),
      },
    })
  } catch (error) {
    console.warn('[voiceTranscribe] write voice log failed:', error && error.message ? error.message : error)
  }
}

async function cleanupFile(fileID) {
  try {
    await cloud.deleteFile({
      fileList: [fileID],
    })
  } catch (error) {
    console.warn('[voiceTranscribe] delete temp voice failed:', error && error.message ? error.message : error)
  }
}

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const wxContext = cloud.getWXContext()
  const fileID = typeof event.fileID === 'string' ? event.fileID : ''
  const duration = Number(event.duration || 0)
  const format = typeof event.format === 'string' ? event.format.toLowerCase() : 'mp3'
  const baseLog = {
    _openid: wxContext.OPENID,
    fileID,
    duration,
    format,
    status: 'started',
  }

  if (event.__checkOnly === true) {
    const configured = Boolean(
      (process.env.ASR_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID) &&
        (process.env.ASR_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY),
    )

    return {
      ok: true,
      data: {
        ready: configured,
        maxDurationMs: MAX_DURATION_MS,
        maxFileSize: MAX_FILE_SIZE,
      },
      meta: {
        env: wxContext.ENV || '',
        openIdReady: Boolean(wxContext.OPENID),
      },
    }
  }

  if (!fileID) {
    const error = { code: 'INVALID_FILE_ID', message: '没有收到录音文件', requestId: '' }
    await writeVoiceLog({ ...baseLog, status: 'failed', errorCode: error.code, errorMessage: error.message, elapsedMs: Date.now() - startedAt })
    return { ok: false, error }
  }

  if (duration <= 0 || duration > MAX_DURATION_MS) {
    const error = { code: 'INVALID_DURATION', message: '请说 15 秒以内的话', requestId: '' }
    await writeVoiceLog({ ...baseLog, status: 'failed', errorCode: error.code, errorMessage: error.message, elapsedMs: Date.now() - startedAt })
    await cleanupFile(fileID)
    return { ok: false, error }
  }

  if (format !== 'mp3') {
    const error = { code: 'INVALID_FORMAT', message: '录音格式暂时只支持 mp3', requestId: '' }
    await writeVoiceLog({ ...baseLog, status: 'failed', errorCode: error.code, errorMessage: error.message, elapsedMs: Date.now() - startedAt })
    await cleanupFile(fileID)
    return { ok: false, error }
  }

  try {
    const downloadResult = await cloud.downloadFile({ fileID })
    const audioBuffer = downloadResult.fileContent
    const fileSize = audioBuffer.length
    baseLog.fileSize = fileSize

    if (!fileSize || fileSize > MAX_FILE_SIZE) {
      const error = { code: 'INVALID_FILE_SIZE', message: '录音太长了，换一句短一点的吧', requestId: '' }
      await writeVoiceLog({ ...baseLog, status: 'failed', fileSize, errorCode: error.code, errorMessage: error.message, elapsedMs: Date.now() - startedAt })
      return { ok: false, error }
    }

    const client = createAsrClient()
    const response = await client.SentenceRecognition({
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: 'mp3',
      Data: audioBuffer.toString('base64'),
      DataLen: fileSize,
      FilterDirty: 0,
      FilterModal: 0,
      FilterPunc: 0,
      ConvertNumMode: 1,
    })
    const text = typeof response.Result === 'string' ? response.Result.trim() : ''

    await writeVoiceLog({
      ...baseLog,
      status: 'success',
      fileSize,
      requestId: response.RequestId || '',
      textLength: text.length,
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: true,
      data: {
        text,
        duration,
        fileSize,
        requestId: response.RequestId || '',
      },
    }
  } catch (error) {
    const normalized = safeError(error)
    await writeVoiceLog({
      ...baseLog,
      status: 'failed',
      errorCode: normalized.code,
      errorMessage: normalized.message,
      requestId: normalized.requestId,
      elapsedMs: Date.now() - startedAt,
    })

    return {
      ok: false,
      error: normalized,
    }
  } finally {
    if (fileID) {
      await cleanupFile(fileID)
    }
  }
}
