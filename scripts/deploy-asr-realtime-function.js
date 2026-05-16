const path = require('path')
const CloudBaseManager = require('@cloudbase/manager-node')
const { loadLocalEnv } = require('./lib/load-env')

const root = path.resolve(__dirname, '..')

loadLocalEnv(root)

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const manager = CloudBaseManager.init({
  envId,
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

function asrAppId() {
  const value = process.env.TENCENTCLOUD_APP_ID || process.env.TENCENTCLOUD_APPID || process.env.ASR_APP_ID || process.env.ASR_APPID

  if (value) return value

  const bucket = process.env.COS_BUCKET || ''
  const match = bucket.match(/-(\d+)$/)

  if (match) return match[1]

  throw new Error('TENCENTCLOUD_APP_ID is required in .env.local for realtime ASR')
}

async function main() {
  const code = {
    functionRootPath: path.join(root, 'cloudfunctions'),
    functionPath: path.join(root, 'cloudfunctions', 'asrRealtimeSign'),
    deployMode: 'zip',
  }
  const config = {
    runtime: 'Nodejs16.13',
    installDependency: true,
    timeout: 10,
    envVariables: {
      ASR_SECRET_ID: requiredEnv('TENCENTCLOUD_SECRET_ID'),
      ASR_SECRET_KEY: requiredEnv('TENCENTCLOUD_SECRET_KEY'),
      ASR_APP_ID: asrAppId(),
    },
  }

  try {
    const result = await manager.functions.updateFunctionWithProgress({
      name: 'asrRealtimeSign',
      code,
      config,
    })

    console.log(result.message)
    for (const detail of result.details || []) {
      console.log(`- ${detail}`)
    }
    return
  } catch (error) {
    const message = error && error.message ? error.message : String(error)

    if (!message.includes('未找到指定的Function') && !message.includes('FUNCTION_NOT_FOUND')) {
      throw error
    }
  }

  console.log('asrRealtimeSign does not exist, creating it')
  const result = await manager.functions.createFunction({
    func: {
      name: 'asrRealtimeSign',
      ...config,
    },
    ...code,
  })

  console.log(`created asrRealtimeSign in ${envId}`)
  if (result && result.RequestId) {
    console.log(`requestId: ${result.RequestId}`)
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
