const CloudBaseManager = require('@cloudbase/manager-node')
const { loadLocalEnv } = require('./lib/load-env')

loadLocalEnv(process.cwd())

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID')
const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY')
const region = process.env.CLOUDBASE_REGION || 'ap-shanghai'
const manager = CloudBaseManager.init({
  envId,
  secretId,
  secretKey,
  region,
})

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required in .env.local`)
  }

  return value
}

async function main() {
  await manager.functions.updateFunctionConfig({
    name: 'voiceTranscribe',
    timeout: 20,
    runtime: 'Nodejs16.13',
    envVariables: {
      ASR_SECRET_ID: secretId,
      ASR_SECRET_KEY: secretKey,
      ASR_REGION: process.env.CLOUDBASE_REGION || 'ap-shanghai',
    },
  })

  console.log(`updated voiceTranscribe environment variables in ${envId}`)
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
