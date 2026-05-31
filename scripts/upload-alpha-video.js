#!/usr/bin/env node

/**
 * 上传双通道MP4视频到云存储
 * 用法: node scripts/upload-alpha-video.js <source-file> [--apply]
 */

const fs = require('fs')
const path = require('path')
const COS = require('cos-nodejs-sdk-v5')

// 加载环境变量
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local 文件不存在')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env = {}

  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').trim()

    if (key && value) {
      env[key] = value
    }
  })

  return env
}

async function uploadVideo(sourceFile, shouldApply = false) {
  const env = loadEnv()

  const secretId = env.TENCENTCLOUD_SECRET_ID
  const secretKey = env.TENCENTCLOUD_SECRET_KEY
  const bucket = env.COS_BUCKET
  const region = env.COS_REGION
  const envId = env.CLOUDBASE_ENV_ID || 'pet-dev-d6gpc4gw88ca1aa43'

  if (!secretId || !secretKey || !bucket || !region) {
    console.error('❌ 缺少必要的环境变量')
    console.error('需要: TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY, COS_BUCKET, COS_REGION')
    process.exit(1)
  }

  // 验证源文件
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ 源文件不存在: ${sourceFile}`)
    process.exit(1)
  }

  const stats = fs.statSync(sourceFile)
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2)

  console.log('📹 双通道MP4视频上传工具')
  console.log('═'.repeat(50))
  console.log(`📂 源文件: ${sourceFile}`)
  console.log(`📊 文件大小: ${fileSizeMB} MB`)
  console.log(`🪣 存储桶: ${bucket}`)
  console.log(`🌍 区域: ${region}`)
  console.log('═'.repeat(50))

  const petId = readArgValue('--pet') || 'xiaotuanzi'
  const actionId = readArgValue('--action') || 'idle'

  // 目标路径
  const fileName = path.basename(sourceFile)
  const targetPath = `pets/${petId}/actions/${actionId}/videos/${fileName}`
  const cloudUrl = `cloud://${envId}.${bucket}/${targetPath}`

  console.log(`\n📍 目标路径: ${targetPath}`)
  console.log(`☁️  云存储URL: ${cloudUrl}`)

  if (!shouldApply) {
    console.log('\n⚠️  这是干运行模式，未实际上传')
    console.log('💡 使用 --apply 参数来实际上传文件')
    return
  }

  console.log('\n⏳ 正在上传...')

  const cos = new COS({
    SecretId: secretId,
    SecretKey: secretKey,
  })

  try {
    const fileContent = fs.readFileSync(sourceFile)

    await new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: targetPath,
          Body: fileContent,
          ContentType: 'video/mp4',
          onProgress: (progressData) => {
            const percent = Math.round(progressData.percent * 100)
            process.stdout.write(`\r⏳ 上传进度: ${percent}%`)
          },
        },
        (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        },
      )
    })

    console.log('\n✅ 上传成功！')
    console.log('\n📋 更新配置信息:')
    console.log('═'.repeat(50))
    console.log('在 miniprogram/config/bootstrap.ts 中更新:')
    console.log(`\nholidayMedia: {`)
    console.log(`  petVideoUrl: '${cloudUrl}',`)
    console.log(`  listenOrbVideoUrl: '...',`)
    console.log(`}`)
    console.log('\n或在 pets 配置中更新对应宠物的 videoUrl:')
    console.log(`\nvideoUrl: '${cloudUrl}',`)
    console.log('═'.repeat(50))
  } catch (error) {
    console.error('\n❌ 上传失败:')
    console.error(error.message)
    process.exit(1)
  }
}

function readArgValue(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`))
  return arg ? arg.slice(name.length + 1) : ''
}

// 主程序
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('用法: node scripts/upload-alpha-video.js <source-file> [--apply]')
  console.log('\n示例:')
  console.log('  node scripts/upload-alpha-video.js "/path/to/video.mp4"')
  console.log('  node scripts/upload-alpha-video.js "/path/to/video.mp4" --apply')
  process.exit(1)
}

const sourceFile = args[0]
const shouldApply = args.includes('--apply')

uploadVideo(sourceFile, shouldApply).catch((error) => {
  console.error('❌ 错误:', error)
  process.exit(1)
})
