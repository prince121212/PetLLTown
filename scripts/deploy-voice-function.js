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

async function main() {
  const result = await manager.functions.updateFunctionWithProgress({
    name: 'voiceTranscribe',
    code: {
      functionRootPath: path.join(root, 'cloudfunctions'),
      functionPath: path.join(root, 'cloudfunctions', 'voiceTranscribe'),
      deployMode: 'zip',
    },
    config: {
      runtime: 'Nodejs16.13',
      installDependency: true,
      timeout: 20,
      envVariables: {
        ASR_SECRET_ID: requiredEnv('TENCENTCLOUD_SECRET_ID'),
        ASR_SECRET_KEY: requiredEnv('TENCENTCLOUD_SECRET_KEY'),
        ASR_REGION: process.env.CLOUDBASE_REGION || 'ap-shanghai',
      },
    },
  })

  console.log(result.message)
  for (const detail of result.details || []) {
    console.log(`- ${detail}`)
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
