const fs = require('fs')
const path = require('path')
const CloudBase = require('@cloudbase/manager-node')
const { loadLocalEnv } = require('./lib/load-env')

const root = path.resolve(__dirname, '..')
const defaultSourceDir = path.resolve(root, '..', 'Toy', 'pet-toy', 'demo', 'turnaround_frames')
const args = new Set(process.argv.slice(2))
const shouldApply = args.has('--apply')
const petId = readArgValue('--pet') || 'xiaotuanzi'
const sourceDir = path.resolve(readArgValue('--source') || defaultSourceDir)
const remotePrefix = trimSlashes(readArgValue('--prefix') || `pets/${petId}/actions/idle/frames`)

const frameFiles = fs
  .readdirSync(sourceDir)
  .filter((fileName) => /^frame_\d{4}\.png$/.test(fileName))
  .sort()

if (!frameFiles.length) {
  throw new Error(`No frame_0000.png files found in ${sourceDir}`)
}

loadLocalEnv(root)

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID')
const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY')
const app = CloudBase.init({
  envId,
  secretId,
  secretKey,
  region: process.env.CLOUDBASE_REGION || 'ap-shanghai',
})

function readArgValue(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`))
  return arg ? arg.slice(name.length + 1) : ''
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '')
}

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required in .env.local`)
  }

  return value
}

async function getStorageInfo() {
  const response = await app.env.describeEnvInfo({ EnvId: envId })
  const envBaseInfo = response && response.EnvInfo && response.EnvInfo.EnvBaseInfo
  const storage = envBaseInfo && Array.isArray(envBaseInfo.Storages) ? envBaseInfo.Storages[0] : null

  if (!storage || !storage.Bucket || !storage.Region) {
    throw new Error(`No CloudBase storage found for ${envId}`)
  }

  return {
    bucket: storage.Bucket,
    region: storage.Region,
    domain: storage.CdnDomain || process.env.COS_DEFAULT_DOMAIN || '',
  }
}

async function main() {
  const storage = await getStorageInfo()
  const domain = storage.domain.replace(/^https?:\/\//, '')

  console.log(`${shouldApply ? 'uploading' : 'dry run'} ${frameFiles.length} frames`)
  console.log(`source: ${sourceDir}`)
  console.log(`target: cloud://${envId}.${storage.bucket}/${remotePrefix}/`)
  console.log(`region: ${storage.region}`)

  if (!shouldApply) {
    console.log('add --apply to upload')
    console.log(`baseUrl: https://${domain}/${remotePrefix}/`)
    return
  }

  let uploaded = 0

  for (const fileName of frameFiles) {
    const filePath = path.join(sourceDir, fileName)
    const key = `${remotePrefix}/${fileName}`

    await app.storage.uploadFileCustom({
      localPath: filePath,
      cloudPath: key,
      bucket: storage.bucket,
      region: storage.region,
    })

    uploaded += 1

    if (uploaded % 25 === 0 || uploaded === frameFiles.length) {
      console.log(`uploaded ${uploaded}/${frameFiles.length}`)
    }
  }

  console.log('done')
  console.log(`baseUrl: https://${domain}/${remotePrefix}/`)
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
