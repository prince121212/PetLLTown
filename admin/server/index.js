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
const CloudBaseManager = require('@cloudbase/manager-node')
const COS = require('cos-nodejs-sdk-v5')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const adminRoot = path.resolve(__dirname, '..')
const root = path.resolve(adminRoot, '..')
const tmpRoot = path.join(root, '.tmp', 'admin-media')
const upload = multer({ dest: path.join(tmpRoot, 'uploads') })

loadEnvFile(path.join(root, '.env.local'))

const envId = requiredEnv('CLOUDBASE_ENV_ID', 'TCB_ENV_ID')
const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID')
const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY')
const region = process.env.CLOUDBASE_REGION || process.env.COS_REGION || process.env.TENCENTCLOUD_REGION || 'ap-shanghai'
const cosBucket = requiredEnv('COS_BUCKET', 'TCB_STORAGE_BUCKET')
const cosRegion = process.env.COS_REGION || process.env.TENCENTCLOUD_REGION || region
const CONFIG_COLLECTION = 'app_configs'
const AUDIT_COLLECTION = 'admin_audit_logs'
const CONFIG_DOC_ID = 'bootstrap'
const REQUIRED_COLLECTIONS = [CONFIG_COLLECTION, AUDIT_COLLECTION, 'pets']
const app = cloudbase.init({ env: envId, secretId, secretKey, region })
const manager = CloudBaseManager.init({ envId, secretId, secretKey, region })
const cos = new COS({ SecretId: secretId, SecretKey: secretKey })
const server = express()

await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true })
await ensureRequiredCollections()

server.use(express.json({ limit: '10mb' }))

server.get('/api/health', (_request, response) => {
  response.json({ ok: true, data: { envId, serverTime: new Date().toISOString() } })
})

server.get('/api/config/state', async (_request, response) => {
  await handle(response, async () => getConfigState())
})

server.put('/api/config', async (request, response) => {
  await handle(response, async () => {
    const config = prepareConfigForSave(normalizeConfig(request.body && request.body.config))
    const issues = validateConfig(config)

    if (issues.length) {
      const error = new Error(issues.map((issue) => issue.message).join('；'))
      error.statusCode = 400
      throw error
    }

    await writePublishedConfig(config)
    await writeAuditLog({
      action: 'saveConfig',
      target: CONFIG_DOC_ID,
      summary: summarizeConfig(config),
      source: request.ip || 'admin-server',
    })
    return getConfigState()
  })
})

server.post('/api/media/pets/inspect', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传 WebM 源素材')
      error.statusCode = 400
      throw error
    }

    const workDir = path.join(tmpRoot, `inspect-${Date.now()}`)
    const alphaCheck = path.join(workDir, 'source-alpha-check.png')

    await fsp.mkdir(workDir, { recursive: true })

    try {
      const probe = await ffprobe(sourceFile.path)
      return await inspectWebm({
        sourcePath: sourceFile.path,
        originalName: sourceFile.originalname,
        probe,
        alphaCheck,
      })
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  })
})

server.post('/api/media/pets/transcode', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传 WebM 源素材')
      error.statusCode = 400
      throw error
    }

    const petId = normalizeId(request.body.petId) || 'pet'
    const workDir = path.join(tmpRoot, `transcode-${petId}-${Date.now()}`)
    const outputVideo = path.join(workDir, `${petId}-idle-alpha-pack-h.mp4`)
    const alphaCheck = path.join(workDir, 'source-alpha-check.png')
    const packedAlphaCheck = path.join(workDir, 'packed-alpha-half-check.png')

    await fsp.mkdir(workDir, { recursive: true })

    try {
      const probe = await ffprobe(sourceFile.path)
      const inspect = await inspectWebm({
        sourcePath: sourceFile.path,
        originalName: sourceFile.originalname,
        probe,
        alphaCheck,
      })

      if (!inspect.ok) {
        const error = new Error('素材没有通过 alpha 验收')
        error.statusCode = 400
        throw error
      }

      await transcodeAlphaPack(sourceFile.path, outputVideo)
      const packedAlphaStats = await inspectPackedAlpha(outputVideo, packedAlphaCheck)
      const stats = await fsp.stat(outputVideo)

      return {
        inspect,
        output: {
          localPath: outputVideo,
          fileName: path.basename(outputVideo),
          size: stats.size,
          alphaYMin: packedAlphaStats.yMin,
          alphaYMax: packedAlphaStats.yMax,
        },
      }
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

server.post('/api/media/pets/upload', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file
    const key = String(request.body.key || '').trim().replace(/^\/+/, '')
    const contentType = String(request.body.contentType || sourceFile?.mimetype || 'application/octet-stream')

    if (!sourceFile || !key) {
      const error = new Error('请上传文件并提供云存储 key')
      error.statusCode = 400
      throw error
    }

    try {
      await uploadToCos(sourceFile.path, key, contentType)
      await writeAuditLog({
        action: 'uploadMedia',
        target: key,
        summary: `上传素材 ${key}`,
        source: request.ip || 'admin-server',
      })

      return {
        key,
        url: cloudUrl(key),
      }
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
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
      const result = await createPetFromWebm({
        sourcePath: sourceFile.path,
        originalName: sourceFile.originalname,
        petId,
        name,
        subtitle,
      })
      await writeAuditLog({
        action: 'createPetFromWebm',
        target: petId,
        summary: `处理并上传 ${name} 的 idle WebM`,
        source: request.ip || 'admin-server',
      })
      return result
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

server.post('/api/media/rooms/create-from-media', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传背景图片或视频素材')
      error.statusCode = 400
      throw error
    }

    const name = String(request.body.name || '').trim()
    const subtitle = String(request.body.subtitle || '').trim()
    const requestedId = normalizeId(request.body.roomId)

    if (!name) {
      const error = new Error('背景名称不能为空')
      error.statusCode = 400
      throw error
    }

    try {
      const result = await createRoomFromMedia({
        sourcePath: sourceFile.path,
        originalName: sourceFile.originalname,
        mimeType: sourceFile.mimetype,
        size: sourceFile.size,
        requestedId,
        name,
        subtitle,
      })

      await writeAuditLog({
        action: 'createRoomFromMedia',
        target: result.room.id,
        summary: `上传背景素材 ${name}`,
        source: request.ip || 'admin-server',
      })

      return result
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
  const config = await readPublishedConfig()
  const auditLogs = await listAuditLogs()

  return {
    config,
    auditLogs,
    meta: {
      envId,
      serverTime: new Date().toISOString(),
    },
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

    await transcodeAlphaPack(sourcePath, outputVideo)

    const outputProbe = await ffprobe(outputVideo)
    const outputVideoStream = outputProbe.streams.find((stream) => stream.codec_type === 'video') || {}
    const frameCount = Number(outputVideoStream.nb_frames || 0)

    const packedAlphaStats = await inspectPackedAlpha(outputVideo, packedAlphaCheck)

    if (packedAlphaStats.yMin > 5 || packedAlphaStats.yMax < 250) {
      const error = new Error('双通道 MP4 的右半 alpha mask 不合格')
      error.statusCode = 400
      throw error
    }

    const safeFrameCount = Math.max(1, frameCount || Math.round(inspect.source.duration * 24) || 1)
    const listenFrameIndex = Math.min(30, safeFrameCount - 1)
    const thumbFrameIndex = Math.min(90, safeFrameCount - 1)

    await extractFrame(sourcePath, listenFrameIndex, listenFrame)
    await extractFrame(sourcePath, thumbFrameIndex, thumbFrame)

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

async function createRoomFromMedia({ sourcePath, originalName, mimeType, size, requestedId, name, subtitle }) {
  const extension = path.extname(originalName || '').toLowerCase()
  const kind = detectRoomMediaKind({ extension, mimeType })

  if (!kind) {
    const error = new Error('背景素材只支持 jpg、png、webp 图片或 mp4、webm 视频')
    error.statusCode = 400
    throw error
  }

  const roomId = requestedId || normalizeId(name) || `room-${formatTimestamp(new Date()).toLowerCase()}`
  const now = new Date()
  const fileExt = extension || (kind === 'image' ? '.jpg' : '.mp4')
  const key = `rooms/${roomId}/${formatTimestamp(now)}${fileExt}`
  const contentType = normalizeContentType({ kind, extension, mimeType })
  const warnings = []
  let inspect = {
    kind,
    fileName: originalName,
    warnings,
  }

  if (kind === 'video') {
    const probe = await ffprobe(sourcePath)
    const video = probe.streams.find((stream) => stream.codec_type === 'video')

    if (!video) {
      const error = new Error('没有检测到可用的视频轨道')
      error.statusCode = 400
      throw error
    }

    if (!['h264', 'vp8', 'vp9'].includes(String(video.codec_name || ''))) {
      warnings.push(`视频编码为 ${video.codec_name || 'unknown'}，小程序端可能需要转码后再使用`)
    }

    inspect = {
      ...inspect,
      width: Number(video.width || 0),
      height: Number(video.height || 0),
      duration: Number(probe.format?.duration || 0),
      codec: String(video.codec_name || ''),
    }
  }

  await uploadToCos(sourcePath, key, contentType)

  const mediaUrl = cloudUrl(key)
  const room = {
    id: roomId,
    name,
    subtitle: subtitle || (kind === 'image' ? '静态背景' : '视频背景'),
    kind,
    mediaUrl,
    thumbUrl: kind === 'image' ? mediaUrl : '',
    enabled: true,
  }

  return {
    room,
    upload: {
      mediaUrl,
      thumbUrl: room.thumbUrl,
      key,
      contentType,
      size,
    },
    inspect,
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

  let alpha = { yMin: 255, yMax: 0 }

  try {
    await execFfmpeg(['-y', '-c:v', 'libvpx-vp9', '-i', sourcePath, '-frames:v', '1', '-vf', 'alphaextract', alphaCheck])
    alpha = await signalStats(alphaCheck)
  } catch (error) {
    warnings.push('无法抽取 alpha mask，请确认源素材是真正带透明通道的 VP9 WebM')
  }

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

async function transcodeAlphaPack(sourcePath, outputVideo) {
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
}

async function inspectPackedAlpha(outputVideo, targetPath) {
  await execFfmpeg(['-y', '-i', outputVideo, '-frames:v', '1', '-vf', 'crop=720:960:720:0,format=gray', targetPath])
  return signalStats(targetPath)
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
  const record = await getDocument(CONFIG_COLLECTION, CONFIG_DOC_ID).catch(() => null)

  if (!record || record.enabled === false) {
    return localConfig
  }

  return normalizeConfig(record.config || record)
}

async function writePublishedConfig(config) {
  await setDocument(CONFIG_COLLECTION, CONFIG_DOC_ID, {
    enabled: true,
    config,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  })
}

async function listAuditLogs() {
  const db = app.database()
  const result = await db.collection(AUDIT_COLLECTION).orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ data: [] }))
  const records = Array.isArray(result.data) ? result.data : []

  return records.map((record) => ({
    id: record._id || record.id || `${record.action}-${record.createdAt}`,
    action: record.action || '',
    target: record.target || '',
    summary: record.summary || '',
    actor: record.actor || '',
    source: record.source || '',
    createdAt: record.createdAt || '',
  }))
}

async function ensureRequiredCollections() {
  for (const collection of REQUIRED_COLLECTIONS) {
    await ensureCollection(collection)
  }
}

async function ensureCollection(collection) {
  try {
    await manager.database.createCollectionIfNotExists(collection)
  } catch (error) {
    console.warn(`[admin server] ensure collection ${collection} failed:`, error && error.message ? error.message : error)
  }
}

async function writeAuditLog({ action, target, summary, source }) {
  const id = `${formatTimestamp(new Date())}-${action}-${Math.random().toString(36).slice(2, 8)}`

  await setDocument(AUDIT_COLLECTION, id, {
    action,
    target,
    summary,
    actor: process.env.ADMIN_ACTOR || 'admin',
    source,
    createdAt: new Date().toISOString(),
  }).catch((error) => {
    console.warn('[admin audit] write failed:', error && error.message ? error.message : error)
  })
}

async function getDocument(collection, id) {
  const db = app.database()
  const result = await db.collection(collection).doc(id).get().catch((error) => {
    if (isMissingCollectionError(error)) return { data: null }
    throw error
  })

  if (Array.isArray(result.data)) {
    return result.data[0] || null
  }

  return result.data || null
}

function isMissingCollectionError(error) {
  const message = error && error.message ? error.message : String(error)
  return message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Db or Table not exist')
}

async function setDocument(collection, id, data) {
  const db = app.database()

  try {
    await db.collection(collection).doc(id).set(data)
  } catch (error) {
    if (!isMissingCollectionError(error)) {
      throw error
    }

    await ensureCollection(collection)
    await db.collection(collection).doc(id).set(data)
  }
}

function normalizeConfig(value) {
  if (!value || typeof value !== 'object') {
    const error = new Error('配置格式不正确')
    error.statusCode = 400
    throw error
  }

  return value
}

function prepareConfigForSave(config) {
  const now = new Date()
  const homeHint = config.homeHint || (config.home && config.home.hint) || ''
  const pets = Array.isArray(config.pets) ? config.pets : []
  const defaultPet = pets.find((pet) => pet.id === config.defaultPetId)

  return {
    ...config,
    configVersion: `admin-save-${formatTimestamp(now)}`,
    defaultPetName: defaultPet?.name || config.defaultPetName || '',
    homeHint,
    home: {
      ...(config.home || {}),
      hint: homeHint,
    },
  }
}

function validateConfig(config) {
  const issues = []
  const pets = Array.isArray(config.pets) ? config.pets : []
  const rooms = Array.isArray(config.rooms) ? config.rooms : []
  const enabledPets = pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = rooms.filter((room) => room.enabled !== false)
  const petIds = new Set()
  const roomIds = new Set()

  if (!enabledPets.some((pet) => pet.id === config.defaultPetId)) {
    issues.push({ field: 'defaultPetId', message: '默认宠物必须存在且启用' })
  }

  if (!enabledRooms.some((room) => room.id === config.defaultRoomId)) {
    issues.push({ field: 'defaultRoomId', message: '默认背景必须存在且启用' })
  }

  for (const pet of pets) {
    const petId = String(pet.id || '').trim()

    if (!petId) {
      issues.push({ field: 'pets.id', message: '宠物 ID 不能为空' })
      continue
    }

    if (petIds.has(petId)) {
      issues.push({ field: `pets.${petId}`, message: `宠物 ID 重复：${petId}` })
    }
    petIds.add(petId)

    if (pet.enabled === false) continue

    if (!pet.videoUrl || !pet.thumbUrl) {
      issues.push({ field: `pets.${pet.id}`, message: `${pet.name || pet.id} 缺少视频或预览图` })
    }

    for (const value of [pet.videoUrl, pet.thumbUrl, pet.listenFrameUrl].filter(Boolean)) {
      if (!isAllowedAssetUrl(value)) {
        issues.push({ field: `pets.${pet.id}`, message: `${pet.name || pet.id} 存在不允许的素材地址` })
      }
    }
  }

  for (const room of rooms) {
    const roomId = String(room.id || '').trim()

    if (!roomId) {
      issues.push({ field: 'rooms.id', message: '背景 ID 不能为空' })
      continue
    }

    if (roomIds.has(roomId)) {
      issues.push({ field: `rooms.${roomId}`, message: `背景 ID 重复：${roomId}` })
    }
    roomIds.add(roomId)

    if (room.enabled === false) continue

    if (!room.mediaUrl) {
      issues.push({ field: `rooms.${room.id}`, message: `${room.name || room.id} 缺少背景媒体` })
    }

    for (const value of [room.mediaUrl, room.thumbUrl].filter(Boolean)) {
      if (!isAllowedAssetUrl(value)) {
        issues.push({ field: `rooms.${room.id}`, message: `${room.name || room.id} 存在不允许的素材地址` })
      }
    }
  }

  return issues
}

function summarizeConfig(config) {
  const enabledPets = Array.isArray(config.pets) ? config.pets.filter((pet) => pet.enabled !== false).length : 0
  const enabledRooms = Array.isArray(config.rooms) ? config.rooms.filter((room) => room.enabled !== false).length : 0
  return `保存配置：${enabledPets} 个启用宠物，${enabledRooms} 个启用背景`
}

function isAllowedAssetUrl(value) {
  return (
    typeof value === 'string' &&
    (value.startsWith('cloud://') ||
      value.startsWith('/pages/') ||
      value.startsWith('https://') ||
      value.startsWith('http://localhost') ||
      value.startsWith('http://127.0.0.1'))
  )
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

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]

    if (value) {
      return value
    }
  }

  throw new Error(`${names.join(' or ')} is required`)
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

function detectRoomMediaKind({ extension, mimeType }) {
  if (String(mimeType || '').startsWith('image/')) return 'image'
  if (String(mimeType || '').startsWith('video/')) return 'video'
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) return 'image'
  if (['.mp4', '.webm', '.mov'].includes(extension)) return 'video'
  return null
}

function normalizeContentType({ kind, extension, mimeType }) {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType

  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  }

  return contentTypes[extension] || (kind === 'image' ? 'image/jpeg' : 'video/mp4')
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
