import { execFile } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import express from 'express'
import multer from 'multer'

const require = createRequire(import.meta.url)
const cloudbase = require('@cloudbase/node-sdk')
const COS = require('cos-nodejs-sdk-v5')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const adminRoot = path.resolve(__dirname, '..')
const root = path.resolve(adminRoot, '..')
const tmpRoot = path.join(root, '.tmp', 'admin-media')
const upload = multer({ dest: path.join(tmpRoot, 'uploads') })

loadEnvFile(path.join(root, '.env.local'))

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID')
const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY')
const region = process.env.CLOUDBASE_REGION || process.env.COS_REGION || 'ap-shanghai'
const cosBucket = requiredEnv('COS_BUCKET')
const cosRegion = process.env.COS_REGION || region
const app = cloudbase.init({ env: envId, secretId, secretKey, region })
const cos = new COS({ SecretId: secretId, SecretKey: secretKey })
const server = express()

server.use(express.json({ limit: '10mb' }))

server.get('/api/health', (_request, response) => {
  response.json({ ok: true, data: { envId, serverTime: new Date().toISOString() } })
})

server.get('/api/config/state', async (_request, response) => {
  await handle(response, async () => getConfigState())
})

server.put('/api/config/draft', async (request, response) => {
  await handle(response, async () => {
    const config = normalizeConfig(request.body && request.body.config)
    await saveDraft(config)
    return getConfigState()
  })
})

server.post('/api/config/publish', async (request, response) => {
  await handle(response, async () => {
    const summary = typeof request.body.summary === 'string' ? request.body.summary : '后台发布'
    const draft = await readDraftConfig()
    const config = draft || await readPublishedConfig()
    const issues = validateConfig(config)

    if (issues.length) {
      const error = new Error(issues.map((issue) => issue.message).join('；'))
      error.statusCode = 400
      throw error
    }

    const version = `admin-${formatTimestamp(new Date())}`
    const publishedConfig = {
      ...config,
      configVersion: version,
      defaultPetName: config.pets.find((pet) => pet.id === config.defaultPetId)?.name || config.defaultPetName,
    }

    await writePublishedConfig(publishedConfig)
    await writeVersion(version, summary, publishedConfig)
    await clearDraft()
    return getConfigState()
  })
})

server.post('/api/config/rollback', async (request, response) => {
  await handle(response, async () => {
    const versionId = String(request.body.versionId || '')
    const record = await getDocument('admin_config_versions', versionId)

    if (!record || !record.config) {
      const error = new Error('没有找到可回滚的版本')
      error.statusCode = 404
      throw error
    }

    const version = `rollback-${formatTimestamp(new Date())}`
    const config = { ...record.config, configVersion: version }
    await writePublishedConfig(config)
    await writeVersion(version, `回滚到 ${record.version || versionId}`, config)
    await clearDraft()
    return getConfigState()
  })
})

server.post('/api/media/pets/create-from-webm', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传 WebM 源素材')
      error.statusCode = 400
      throw error
    }

    const petId = normalizeId(request.body.petId)
    const name = String(request.body.name || '').trim()
    const subtitle = String(request.body.subtitle || '').trim() || '新宠物'

    if (!petId || !name) {
      const error = new Error('宠物 ID 和名称不能为空')
      error.statusCode = 400
      throw error
    }

    try {
      return await createPetFromWebm({
        sourcePath: sourceFile.path,
        originalName: sourceFile.originalname,
        petId,
        name,
        subtitle,
      })
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

const port = Number(process.env.ADMIN_SERVER_PORT || 8787)
server.listen(port, () => {
  console.log(`admin server listening on http://127.0.0.1:${port}`)
})

async function getConfigState() {
  const published = await readPublishedConfig()
  const draft = await readDraftConfig()
  const versions = await listVersions()

  return {
    published,
    draft: draft || published,
    hasDraft: Boolean(draft),
    versions,
  }
}

async function createPetFromWebm({ sourcePath, originalName, petId, name, subtitle }) {
  await fsp.mkdir(tmpRoot, { recursive: true })

  const workDir = path.join(tmpRoot, `${petId}-${Date.now()}`)
  const outputVideo = path.join(workDir, `${petId}-idle-alpha-pack-h.mp4`)
  const frameDir = path.join(workDir, 'frames')
  const listenFrame = path.join(frameDir, 'frame_0030.png')
  const thumbFrame = path.join(frameDir, 'frame_0090.png')
  const alphaCheck = path.join(workDir, 'source-alpha-check.png')
  const packedAlphaCheck = path.join(workDir, 'packed-alpha-half-check.png')

  await fsp.mkdir(frameDir, { recursive: true })

  try {
    const probe = await ffprobe(sourcePath)
    const inspect = await inspectWebm({ sourcePath, originalName, probe, alphaCheck })

    if (!inspect.ok) {
      const error = new Error('素材没有通过 alpha 验收')
      error.statusCode = 400
      throw error
    }

    await execFfmpeg([
      '-y',
      '-c:v',
      'libvpx-vp9',
      '-i',
      sourcePath,
      '-filter_complex',
      '[0:v]fps=24,scale=720:960:flags=lanczos,setsar=1,format=rgba,split=2[rgbsrc][alphasrc];[rgbsrc]format=rgb24[rgb];[alphasrc]alphaextract,format=gray,format=rgb24[alpha];[rgb][alpha]hstack=inputs=2,setsar=1,format=yuv420p[v]',
      '-map',
      '[v]',
      '-an',
      '-r',
      '24',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-movflags',
      '+faststart',
      outputVideo,
    ])

    const outputProbe = await ffprobe(outputVideo)
    const outputVideoStream = outputProbe.streams.find((stream) => stream.codec_type === 'video') || {}
    const frameCount = Number(outputVideoStream.nb_frames || 0)

    await execFfmpeg(['-y', '-i', outputVideo, '-frames:v', '1', '-vf', 'crop=720:960:720:0,format=gray', packedAlphaCheck])
    const packedAlphaStats = await signalStats(packedAlphaCheck)

    if (packedAlphaStats.yMin > 5 || packedAlphaStats.yMax < 250) {
      const error = new Error('双通道 MP4 的右半 alpha mask 不合格')
      error.statusCode = 400
      throw error
    }

    await extractFrame(sourcePath, 30, listenFrame)
    await extractFrame(sourcePath, 90, thumbFrame)

    const videoKey = `pets/${petId}/actions/idle/videos/${petId}-idle-alpha-pack-h.mp4`
    const listenKey = `pets/${petId}/actions/idle/frames/frame_0030.png`
    const thumbKey = `pets/${petId}/actions/idle/frames/frame_0090.png`

    await uploadToCos(outputVideo, videoKey, 'video/mp4')
    await uploadToCos(listenFrame, listenKey, 'image/png')
    await uploadToCos(thumbFrame, thumbKey, 'image/png')

    const videoUrl = cloudUrl(videoKey)
    const listenFrameUrl = cloudUrl(listenKey)
    const thumbUrl = cloudUrl(thumbKey)
    const manifest = buildPetManifest({ petId, name, frameCount: frameCount || Math.round(inspect.source.duration * 24) })
    const pet = {
      id: petId,
      name,
      subtitle,
      frameOffset: 0,
      manifestKey: `${petId}/manifest.json`,
      videoUrl,
      thumbUrl,
      listenFrameUrl,
      enabled: true,
    }

    await setDocument('pets', petId, {
      enabled: true,
      name,
      manifest,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-media',
    })

    return {
      pet,
      manifest: {
        petId,
        name,
        manifestVersion: manifest.manifestVersion,
      },
      inspect,
      output: {
        videoUrl,
        thumbUrl,
        listenFrameUrl,
        frameCount: manifest.actions[0].frameCount,
      },
    }
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function inspectWebm({ sourcePath, originalName, probe, alphaCheck }) {
  const warnings = []
  const video = probe.streams.find((stream) => stream.codec_type === 'video') || {}
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio')
  const duration = Number(probe.format && probe.format.duration ? probe.format.duration : 0)
  const fps = parseRate(video.avg_frame_rate || video.r_frame_rate)
  const width = Number(video.width || 0)
  const height = Number(video.height || 0)
  const codec = String(video.codec_name || '')
  const hasAlphaMode = Object.entries(video.tags || {}).some(([key, value]) => key.toLowerCase() === 'alpha_mode' && String(value) === '1')

  if (codec !== 'vp9') warnings.push('源素材不是 VP9 编码')
  if (!hasAlphaMode) warnings.push('源素材缺少 ALPHA_MODE=1')
  if (width !== 720 || height !== 960) warnings.push(`源尺寸为 ${width}x${height}，会规范化为 720x960`)
  if (Math.round(fps) !== 24) warnings.push(`源帧率为 ${fps || 0}fps，会规范化为 24fps`)
  if (audio) warnings.push('源素材包含音频，运行时素材会去除音频')

  await execFfmpeg(['-y', '-c:v', 'libvpx-vp9', '-i', sourcePath, '-frames:v', '1', '-vf', 'alphaextract', alphaCheck])
  const alpha = await signalStats(alphaCheck)
  const ok = codec === 'vp9' && hasAlphaMode && alpha.yMin <= 5 && alpha.yMax >= 250

  return {
    ok,
    warnings,
    source: {
      fileName: originalName,
      width,
      height,
      fps,
      duration,
      codec,
      hasAlphaMode,
      hasAudio: Boolean(audio),
      alphaYMin: alpha.yMin,
      alphaYMax: alpha.yMax,
    },
  }
}

async function extractFrame(sourcePath, index, targetPath) {
  await execFfmpeg([
    '-y',
    '-c:v',
    'libvpx-vp9',
    '-i',
    sourcePath,
    '-vf',
    `fps=24,scale=720:960:flags=lanczos,setsar=1,select='eq(n,${index})'`,
    '-frames:v',
    '1',
    targetPath,
  ])
}

function buildPetManifest({ petId, name, frameCount }) {
  const safeFrameCount = Math.max(1, Number(frameCount || 1))

  return {
    schemaVersion: 1,
    manifestVersion: `${formatDate(new Date())}-${petId}-001`,
    petId,
    name,
    defaultState: 'idle',
    canvas: {
      width: 720,
      height: 960,
      anchorX: 0.5,
      anchorY: 0.94,
      safeArea: {
        x: 36,
        y: 48,
        width: 648,
        height: 864,
      },
    },
    assets: {
      baseUrl: `${cloudUrl(`pets/${petId}/actions/idle/frames`)}/`,
      audioBaseUrl: '',
    },
    actions: [
      {
        id: 'idle',
        type: 'loop',
        label: '待机',
        fps: 24,
        frameCount: safeFrameCount,
        framePattern: 'frame_{index:0000}.png',
        startIndex: 1,
        endIndex: safeFrameCount,
        connectAt: [1, Math.min(30, safeFrameCount), Math.min(60, safeFrameCount), safeFrameCount],
        next: ['idle', 'listen'],
      },
      {
        id: 'listen',
        type: 'loop',
        label: '倾听',
        fps: 24,
        frameCount: Math.min(40, safeFrameCount),
        framePattern: 'frame_{index:0000}.png',
        startIndex: Math.min(30, safeFrameCount),
        endIndex: Math.min(69, safeFrameCount),
        connectAt: [Math.min(30, safeFrameCount), Math.min(50, safeFrameCount), Math.min(69, safeFrameCount)],
        next: ['idle'],
      },
    ],
    sounds: [],
    personality: {
      tone: 'warm',
      replyStyle: '短句、亲近、像一只认真陪伴你的小宠物',
      traits: ['亲人', '安静', '会认真看着你'],
    },
  }
}

async function readPublishedConfig() {
  const localConfig = readJson(path.join(root, 'cloudbase/configs/bootstrap.default.json'))
  const record = await getDocument('app_configs', 'bootstrap').catch(() => null)

  if (!record || record.enabled === false) {
    return localConfig
  }

  return normalizeConfig(record.config || record)
}

async function readDraftConfig() {
  const record = await getDocument('admin_config_drafts', 'bootstrap').catch(() => null)
  return record && record.config ? normalizeConfig(record.config) : null
}

async function saveDraft(config) {
  await setDocument('admin_config_drafts', 'bootstrap', {
    config,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  })
}

async function clearDraft() {
  await setDocument('admin_config_drafts', 'bootstrap', {
    config: null,
    status: 'published',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  })
}

async function writePublishedConfig(config) {
  await setDocument('app_configs', 'bootstrap', {
    enabled: true,
    config,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  })
}

async function writeVersion(version, summary, config) {
  await setDocument('admin_config_versions', version, {
    version,
    summary,
    config,
    publishedAt: new Date().toISOString(),
    publishedBy: 'admin',
  })
}

async function listVersions() {
  const db = app.database()
  const result = await db.collection('admin_config_versions').orderBy('publishedAt', 'desc').limit(20).get().catch(() => ({ data: [] }))
  const records = Array.isArray(result.data) ? result.data : []

  return records.map((record) => ({
    id: record._id || record.version,
    version: record.version || record._id,
    summary: record.summary || '',
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
  }))
}

async function getDocument(collection, id) {
  const db = app.database()
  const result = await db.collection(collection).doc(id).get()

  if (Array.isArray(result.data)) {
    return result.data[0] || null
  }

  return result.data || null
}

async function setDocument(collection, id, data) {
  const db = app.database()
  await db.collection(collection).doc(id).set(data)
}

function normalizeConfig(value) {
  if (!value || typeof value !== 'object') {
    const error = new Error('配置格式不正确')
    error.statusCode = 400
    throw error
  }

  return value
}

function validateConfig(config) {
  const issues = []
  const enabledPets = Array.isArray(config.pets) ? config.pets.filter((pet) => pet.enabled !== false) : []
  const enabledRooms = Array.isArray(config.rooms) ? config.rooms.filter((room) => room.enabled !== false) : []

  if (!enabledPets.some((pet) => pet.id === config.defaultPetId)) {
    issues.push({ field: 'defaultPetId', message: '默认宠物必须存在且启用' })
  }

  if (!enabledRooms.some((room) => room.id === config.defaultRoomId)) {
    issues.push({ field: 'defaultRoomId', message: '默认背景必须存在且启用' })
  }

  for (const pet of enabledPets) {
    if (!pet.videoUrl || !pet.thumbUrl) {
      issues.push({ field: `pets.${pet.id}`, message: `${pet.name || pet.id} 缺少视频或预览图` })
    }
  }

  for (const room of enabledRooms) {
    if (!room.mediaUrl) {
      issues.push({ field: `rooms.${room.id}`, message: `${room.name || room.id} 缺少背景媒体` })
    }
  }

  return issues
}

async function uploadToCos(localPath, key, contentType) {
  const body = await fsp.readFile(localPath)

  await new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: cosBucket,
        Region: cosRegion,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
      (error, data) => {
        if (error) reject(error)
        else resolve(data)
      },
    )
  })
}

function ffprobe(filePath) {
  return execJson('ffprobe', ['-hide_banner', '-show_streams', '-show_format', '-print_format', 'json', filePath])
}

async function signalStats(filePath) {
  const output = await execText('ffmpeg', ['-hide_banner', '-i', filePath, '-vf', 'signalstats,metadata=print:file=-', '-frames:v', '1', '-f', 'null', '-'])
  const yMin = Number((output.match(/lavfi\.signalstats\.YMIN=([0-9.]+)/) || [])[1] || 255)
  const yMax = Number((output.match(/lavfi\.signalstats\.YMAX=([0-9.]+)/) || [])[1] || 0)

  return { yMin, yMax }
}

function execFfmpeg(args) {
  return execText('ffmpeg', ['-hide_banner', ...args])
}

function execJson(command, args) {
  return execText(command, args).then((output) => JSON.parse(output))
}

function execText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr}`
        reject(error)
        return
      }

      resolve(`${stdout}${stderr}`)
    })
  })
}

async function handle(response, action) {
  try {
    const data = await action()
    response.json({ ok: true, data })
  } catch (error) {
    const status = error.statusCode || 500
    response.status(status).json({
      ok: false,
      error: {
        message: error && error.message ? error.message : String(error),
      },
    })
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const index = trimmed.indexOf('=')
    if (index === -1) continue

    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function cloudUrl(key) {
  return `cloud://${envId}.${cosBucket}/${key.replace(/^\/+/, '')}`
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
}

function parseRate(value) {
  if (!value || value === '0/0') return 0
  const [numerator, denominator] = String(value).split('/').map(Number)
  return denominator ? numerator / denominator : Number(value)
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}
