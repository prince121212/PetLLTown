const path = require('path')
const CloudBase = require('@cloudbase/manager-node')
const { loadLocalEnv } = require('./lib/load-env')

const root = path.resolve(__dirname, '..')
const args = new Set(process.argv.slice(2))
const shouldApply = args.has('--apply')
const files = [
  {
    localPath: '/Users/huangchangwei/Downloads/生成布偶猫视频_transparent_subject.webm',
    cloudPath: 'pets/xiaotuanzi/actions/idle/videos/xiaotuanzi-idle.webm',
  },
  {
    localPath: '/tmp/petllt-media/listen-orb.mp4',
    cloudPath: 'ui/listen-orb/listen-orb.mp4',
  },
]

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
  }
}

async function main() {
  const storage = await getStorageInfo()

  console.log(`${shouldApply ? 'uploading' : 'dry run'} media assets`)
  for (const file of files) {
    console.log(`- cloud://${envId}.${storage.bucket}/${file.cloudPath}`)
  }

  if (!shouldApply) {
    console.log('add --apply to upload')
    return
  }

  for (const file of files) {
    await app.storage.uploadFileCustom({
      localPath: file.localPath,
      cloudPath: file.cloudPath,
      bucket: storage.bucket,
      region: storage.region,
    })
    console.log(`uploaded ${file.cloudPath}`)
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
