const cloudbase = require('@cloudbase/node-sdk')
const { loadLocalEnv } = require('./lib/load-env')

loadLocalEnv(process.cwd())

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const app = cloudbase.init({
  env: envId,
  secretId: requiredEnv('TENCENTCLOUD_SECRET_ID'),
  secretKey: requiredEnv('TENCENTCLOUD_SECRET_KEY'),
  region: process.env.CLOUDBASE_REGION || 'ap-shanghai',
})

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required in .env.local`)
  }

  return value
}

async function callFunction(name, data) {
  const response = await app.callFunction({ name, data })
  return response.result || {}
}

async function main() {
  const bootstrap = await callFunction('bootstrap', {
    clientVersion: 'cloudbase-check',
  })
  const manifest = await callFunction('getPetManifest', {
    petId: 'xiaotuanzi',
  })
  let voiceTranscribe
  let asrRealtimeSign
  let aiRespond

  try {
    voiceTranscribe = await callFunction('voiceTranscribe', {
      __checkOnly: true,
    })
  } catch (error) {
    voiceTranscribe = {
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error),
      },
    }
  }

  try {
    asrRealtimeSign = await callFunction('asrRealtimeSign', {
      __checkOnly: true,
    })
  } catch (error) {
    asrRealtimeSign = {
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error),
      },
    }
  }

  try {
    aiRespond = await callFunction('aiRespond', {
      __checkOnly: true,
    })
  } catch (error) {
    aiRespond = {
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error),
      },
    }
  }

  console.log(
    JSON.stringify(
      {
        envId,
        bootstrap: {
          ok: bootstrap.ok === true,
          source: bootstrap.meta && bootstrap.meta.source,
          appName: bootstrap.data && bootstrap.data.appName,
          frameBase: bootstrap.data && bootstrap.data.frameSequence && bootstrap.data.frameSequence.frameBase,
        },
        getPetManifest: {
          ok: manifest.ok === true,
          source: manifest.meta && manifest.meta.source,
          petId: manifest.data && manifest.data.petId,
          actionCount: manifest.data && manifest.data.actions && manifest.data.actions.length,
          baseUrl: manifest.data && manifest.data.assets && manifest.data.assets.baseUrl,
        },
        voiceTranscribe: {
          ok: voiceTranscribe.ok === true,
          ready: voiceTranscribe.data && voiceTranscribe.data.ready,
          maxDurationMs: voiceTranscribe.data && voiceTranscribe.data.maxDurationMs,
          error: voiceTranscribe.error && voiceTranscribe.error.message,
        },
        asrRealtimeSign: {
          ok: asrRealtimeSign.ok === true,
          ready: asrRealtimeSign.data && asrRealtimeSign.data.ready,
          engineModelType: asrRealtimeSign.data && asrRealtimeSign.data.engineModelType,
          voiceFormat: asrRealtimeSign.data && asrRealtimeSign.data.voiceFormat,
          error: asrRealtimeSign.error && asrRealtimeSign.error.message,
        },
        aiRespond: {
          ok: aiRespond.ok === true,
          ready: aiRespond.data && aiRespond.data.ready,
          provider: aiRespond.data && aiRespond.data.provider,
          model: aiRespond.data && aiRespond.data.model,
          maxTextLength: aiRespond.data && aiRespond.data.maxTextLength,
          error: aiRespond.error && aiRespond.error.message,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
