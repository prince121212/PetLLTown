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
  const code = {
    functionRootPath: path.join(root, 'cloudfunctions'),
    functionPath: path.join(root, 'cloudfunctions', 'aiRespond'),
    deployMode: 'zip',
  }
  const config = {
    runtime: 'Nodejs16.13',
    installDependency: true,
      timeout: 20,
      envVariables: {
        AI_PROVIDER: process.env.AI_PROVIDER || 'hunyuan-v3',
        AI_MODEL: process.env.AI_MODEL || 'hy3-preview',
      },
  }

  try {
    const result = await manager.functions.updateFunctionWithProgress({
      name: 'aiRespond',
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

  console.log('aiRespond does not exist, creating it')
  const result = await manager.functions.createFunction({
    func: {
      name: 'aiRespond',
      ...config,
    },
    ...code,
  })

  console.log(`created aiRespond in ${envId}`)
  if (result && result.RequestId) {
    console.log(`requestId: ${result.RequestId}`)
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
