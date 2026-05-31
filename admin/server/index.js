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

const defaultRegion = process.env.CLOUDBASE_REGION || process.env.COS_REGION || process.env.TENCENTCLOUD_REGION || 'ap-shanghai'

// 预置可切换的数据源环境。test 与 prod 分属两个腾讯云账号，各自携带密钥。
// 切换时连账号密钥一起切，因此 cloudbase/manager/cos 客户端都会按目标环境重建。
const ENVIRONMENTS = [
  {
    key: 'test',
    label: '测试环境',
    envId: 'cloud1-d0gz0y40r67b3198e',
    cosBucket: '636c-cloud1-d0gz0y40r67b3198e-1396635429',
    region: 'ap-shanghai',
    secretId: process.env.TENCENTCLOUD_SECRET_ID_TEST || '',
    secretKey: process.env.TENCENTCLOUD_SECRET_KEY_TEST || '',
    danger: false,
  },
  {
    key: 'prod',
    label: '正式环境',
    envId: 'pet-dev-d6gpc4gw88ca1aa43',
    cosBucket: '7065-pet-dev-d6gpc4gw88ca1aa43-1438790868',
    region: 'ap-shanghai',
    secretId: process.env.TENCENTCLOUD_SECRET_ID_PROD || process.env.TENCENTCLOUD_SECRET_ID || '',
    secretKey: process.env.TENCENTCLOUD_SECRET_KEY_PROD || process.env.TENCENTCLOUD_SECRET_KEY || '',
    danger: true,
  },
]

// 默认环境：优先匹配 .env.local 里 CLOUDBASE_ENV_ID 指向的环境，否则用第一个。
const envFromFile = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV_ID || ''
const defaultEnvironment = ENVIRONMENTS.find((item) => item.envId === envFromFile) || ENVIRONMENTS[0]

// 当前激活环境派生的运行时状态，切换时由 activateEnvironment 重建（用 let 以便重新赋值）。
let activeEnvKey = defaultEnvironment.key
let envId = defaultEnvironment.envId
let cosBucket = defaultEnvironment.cosBucket
let region = defaultEnvironment.region || defaultRegion
let cosRegion = defaultEnvironment.region || defaultRegion
let app = null
let manager = null
let cos = null

function getActiveEnvironment() {
  return ENVIRONMENTS.find((item) => item.key === activeEnvKey) || defaultEnvironment
}

function activateEnvironment(target) {
  const sid = target.secretId
  const skey = target.secretKey
  if (!sid || !skey) {
    throw new Error(`环境「${target.label}」缺少密钥，请在 .env.local 配置 TENCENTCLOUD_SECRET_ID_${String(target.key).toUpperCase()} / _SECRET_KEY_${String(target.key).toUpperCase()}`)
  }
  activeEnvKey = target.key
  envId = target.envId
  cosBucket = target.cosBucket
  region = target.region || defaultRegion
  cosRegion = target.region || defaultRegion
  app = cloudbase.init({ env: envId, secretId: sid, secretKey: skey, region })
  manager = CloudBaseManager.init({ envId, secretId: sid, secretKey: skey, region })
  cos = new COS({ SecretId: sid, SecretKey: skey })
  return getActiveEnvironment()
}
const CONFIG_COLLECTION = 'app_configs'
const DRAFT_COLLECTION = 'admin_config_drafts'
const VERSION_COLLECTION = 'admin_config_versions'
const AUDIT_COLLECTION = 'admin_audit_logs'
const CONFIG_DOC_ID = 'bootstrap'
const REQUIRED_COLLECTIONS = [CONFIG_COLLECTION, DRAFT_COLLECTION, VERSION_COLLECTION, AUDIT_COLLECTION, 'pets', 'users']
const USER_INDEX_SOURCES = [
  'users',
  'pet_states',
  'user_prefs',
  'user_memories',
  'user_profiles',
  'voice_logs',
  'ai_logs',
]
const DATA_VIEW_DEFS = [
  {
    key: 'app_configs',
    collection: 'app_configs',
    label: '线上配置',
    description: '当前生效的启动配置',
    category: 'config',
    sortField: 'updatedAt',
    singleDoc: true,
  },
  {
    key: 'admin_config_drafts',
    collection: 'admin_config_drafts',
    label: '配置草稿',
    description: '后台未发布的配置草稿',
    category: 'config',
    sortField: 'updatedAt',
    singleDoc: true,
  },
  {
    key: 'admin_config_versions',
    collection: 'admin_config_versions',
    label: '配置版本',
    description: '历史发布记录',
    category: 'config',
    sortField: 'publishedAt',
  },
  {
    key: 'admin_audit_logs',
    collection: 'admin_audit_logs',
    label: '操作日志',
    description: '后台操作审计记录',
    category: 'log',
    sortField: 'createdAt',
  },
  {
    key: 'pets',
    collection: 'pets',
    label: '宠物资料',
    description: '宠物 manifest 与素材地址',
    category: 'content',
    sortField: 'updatedAt',
  },
  {
    key: 'users',
    collection: 'users',
    label: '用户账号',
    description: '小程序登录用户与活跃状态',
    category: 'user',
    sortField: 'lastActiveAt',
    openIdField: '_openId',
  },
  {
    key: 'pet_states',
    collection: 'pet_states',
    label: '宠物状态',
    description: '按用户与宠物保存的状态数据',
    category: 'user',
    sortField: '_savedAt',
    openIdField: '_openId',
    petIdField: '_petId',
  },
  {
    key: 'user_prefs',
    collection: 'user_prefs',
    label: '用户偏好',
    description: '用户当前偏好设置',
    category: 'user',
    sortField: 'updatedAt',
    openIdField: '_openId',
  },
  {
    key: 'user_memories',
    collection: 'user_memories',
    label: '短期记忆',
    description: 'AI 记住的用户信息',
    category: 'user',
    sortField: 'createdAt',
    openIdField: '_openId',
  },
  {
    key: 'user_profiles',
    collection: 'user_profiles',
    label: '用户画像',
    description: '画像与更新状态',
    category: 'user',
    sortField: 'lastUpdatedAt',
    openIdField: '_openId',
  },
  {
    key: 'voice_logs',
    collection: 'voice_logs',
    label: '语音日志',
    description: '语音识别调用记录',
    category: 'log',
    sortField: 'createdAt',
    openIdField: '_openid',
  },
  {
    key: 'ai_logs',
    collection: 'ai_logs',
    label: 'AI 日志',
    description: 'AI 回复与记忆提取日志',
    category: 'log',
    sortField: 'createdAt',
    openIdField: '_openid',
    petIdField: 'petId',
  },
]
const DATA_VIEW_MAP = new Map(DATA_VIEW_DEFS.map((item) => [item.collection, item]))
activateEnvironment(defaultEnvironment)
const server = express()

await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true })
await ensureRequiredCollections()

server.use(express.json({ limit: '10mb' }))

server.get('/api/health', (_request, response) => {
  response.json({ ok: true, data: { envId, serverTime: new Date().toISOString() } })
})

server.get('/api/environments', (_request, response) => {
  const active = getActiveEnvironment()
  response.json({
    ok: true,
    data: {
      activeKey: active.key,
      environments: ENVIRONMENTS.map((item) => ({
        key: item.key,
        label: item.label,
        envId: item.envId,
        danger: Boolean(item.danger),
        active: item.key === active.key,
      })),
    },
  })
})

server.post('/api/environment', async (request, response) => {
  await handle(response, async () => {
    const key = request.body && request.body.key
    const target = ENVIRONMENTS.find((item) => item.key === key)
    if (!target) {
      const error = new Error(`未知环境：${key}`)
      error.statusCode = 400
      throw error
    }

    if (target.key !== activeEnvKey) {
      activateEnvironment(target)
      await ensureRequiredCollections()
    }

    const active = getActiveEnvironment()
    return {
      activeKey: active.key,
      environments: ENVIRONMENTS.map((item) => ({
        key: item.key,
        label: item.label,
        envId: item.envId,
        danger: Boolean(item.danger),
        active: item.key === active.key,
      })),
    }
  })
})

server.get('/api/data/catalog', async (_request, response) => {
  await handle(response, async () => DATA_VIEW_DEFS.map((item) => ({
    collection: item.collection,
    label: item.label,
    description: item.description,
    category: item.category,
    sortField: item.sortField,
    singleDoc: Boolean(item.singleDoc),
    openIdField: item.openIdField || '',
    petIdField: item.petIdField || '',
  })))
})

server.get('/api/data/collection/:collection', async (request, response) => {
  await handle(response, async () => {
    const collection = normalizeCollectionName(request.params.collection)
    const meta = DATA_VIEW_MAP.get(collection)

    if (!meta) {
      const error = new Error(`不支持的数据集合：${collection}`)
      error.statusCode = 404
      throw error
    }

    const limit = clampInt(request.query.limit, 20, 1, 100)
    const skip = clampInt(request.query.skip, 0, 0, 10000)
    const openId = String(request.query.openId || '').trim()
    const petId = String(request.query.petId || '').trim()

    return queryCollectionDocs({
      collection,
      meta,
      limit,
      skip,
      openId,
      petId,
    })
  })
})

server.get('/api/data/user/:openId', async (request, response) => {
  await handle(response, async () => {
    const openId = String(request.params.openId || '').trim()

    if (!openId) {
      const error = new Error('openId 不能为空')
      error.statusCode = 400
      throw error
    }

    return {
      openId,
      user: await getSingleDoc('users', openId),
      petStates: await queryCollectionDocs({
        collection: 'pet_states',
        meta: DATA_VIEW_MAP.get('pet_states'),
        limit: 50,
        skip: 0,
        openId,
      }),
      userPrefs: await getSingleDoc('user_prefs', openId),
      userMemories: await queryCollectionDocs({
        collection: 'user_memories',
        meta: DATA_VIEW_MAP.get('user_memories'),
        limit: 50,
        skip: 0,
        openId,
      }),
      userProfiles: await getSingleDoc('user_profiles', openId),
      voiceLogs: await queryCollectionDocs({
        collection: 'voice_logs',
        meta: DATA_VIEW_MAP.get('voice_logs'),
        limit: 30,
        skip: 0,
        openId,
      }),
      aiLogs: await queryCollectionDocs({
        collection: 'ai_logs',
        meta: DATA_VIEW_MAP.get('ai_logs'),
        limit: 30,
        skip: 0,
        openId,
      }),
    }
  })
})

server.get('/api/data/pet/:petId', async (request, response) => {
  await handle(response, async () => {
    const petId = normalizeId(request.params.petId)

    if (!petId) {
      const error = new Error('petId 不能为空')
      error.statusCode = 400
      throw error
    }

    return {
      petId,
      pet: await getSingleDoc('pets', petId),
      petStates: await queryCollectionDocs({
        collection: 'pet_states',
        meta: DATA_VIEW_MAP.get('pet_states'),
        limit: 50,
        skip: 0,
        petId,
      }),
      aiLogs: await queryCollectionDocs({
        collection: 'ai_logs',
        meta: DATA_VIEW_MAP.get('ai_logs'),
        limit: 30,
        skip: 0,
        petId,
      }),
      manifest: await getPetManifestSummary(petId),
    }
  })
})

server.get('/api/data/users', async (request, response) => {
  await handle(response, async () => {
    const limit = clampInt(request.query.limit, 20, 1, 100)
    const skip = clampInt(request.query.skip, 0, 0, 100000)
    const queryText = String(request.query.q || '').trim().toLowerCase()
    const petFilter = String(request.query.petId || '').trim().toLowerCase()
    const statusFilter = normalizeUserStatusFilter(request.query.status)
    const sort = normalizeUserSort(request.query.sort)

    const rows = sortUserIndexRows(await buildUserIndexRows(), sort)
    const filtered = rows.filter((row) => {
      if (
        queryText
        && !String(row.openId || '').toLowerCase().includes(queryText)
        && !String(row.nickName || '').toLowerCase().includes(queryText)
      ) return false
      if (petFilter && !String(row.activePetId || '').toLowerCase().includes(petFilter) && !row.petIds.some((petId) => String(petId || '').toLowerCase().includes(petFilter))) return false
      if (statusFilter && row.status !== statusFilter) return false
      return true
    })
    const items = filtered.slice(skip, skip + limit)

    return {
      total: filtered.length,
      limit,
      skip,
      q: queryText,
      petId: petFilter,
      status: statusFilter,
      sort,
      stats: {
        totalUsers: rows.length,
        activeToday: rows.filter((row) => row.status === 'active_today').length,
        active7d: rows.filter((row) => row.status === 'active_today' || row.status === 'active_7d').length,
        usersWithProfile: rows.filter((row) => row.hasProfile).length,
        usersWithMemory: rows.filter((row) => row.memoryCount > 0).length,
        usersMissingWechatProfile: rows.filter((row) => row.status === 'needs_profile').length,
        inactiveUsers: rows.filter((row) => row.status === 'inactive').length,
      },
      items,
    }
  })
})

server.patch('/api/media/pets/:petId/actions/:actionId/videos', async (request, response) => {
  await handle(response, async () => {
    const petId = normalizeId(request.params.petId)
    const actionId = normalizeId(request.params.actionId)
    const videoUrl = String(request.body && request.body.videoUrl ? request.body.videoUrl : '').trim()

    if (!petId || !actionId || !videoUrl) {
      const error = new Error('petId, actionId, videoUrl 不能为空')
      error.statusCode = 400
      throw error
    }

    const petDoc = await getDocument('pets', petId)
    if (!petDoc || !petDoc.manifest) {
      const error = new Error(`未找到宠物 ${petId} 的 manifest`)
      error.statusCode = 404
      throw error
    }

    const manifest = petDoc.manifest
    const actionIndex = Array.isArray(manifest.actions)
      ? manifest.actions.findIndex((a) => a.id === actionId)
      : -1

    const ACTION_LABELS = { idle: '待机', listening: '倾听', reply: '回应', 'sleep-enter': '入睡过渡', 'sleep-loop': '睡眠循环', 'sleep-exit': '唤醒过渡' }

    if (actionIndex < 0) {
      manifest.actions = manifest.actions || []
      manifest.actions.push({
        id: actionId,
        type: 'loop',
        label: ACTION_LABELS[actionId] || actionId,
        fps: 24,
        next: ['idle'],
        videoUrls: [videoUrl],
      })
    } else {
      const action = manifest.actions[actionIndex]
      const urls = Array.isArray(action.videoUrls) ? action.videoUrls : []
      if (!urls.includes(videoUrl)) urls.push(videoUrl)
      action.videoUrls = urls
    }

    const { _id, ...petDocRest } = petDoc
    await setDocument('pets', petId, {
      ...petDocRest,
      manifest,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-patch',
    })

    await writeAuditLog({
      action: 'patchActionVideo',
      target: `${petId}/${actionId}`,
      summary: `手动补录视频到 ${petId}/${actionId}`,
      source: 'admin-server',
    })

    const updatedAction = manifest.actions.find((a) => a.id === actionId)
    return {
      petId,
      actionId,
      videoUrls: updatedAction ? updatedAction.videoUrls : [videoUrl],
    }
  })
})

server.delete('/api/media/pets/:petId/actions/:actionId/videos', async (request, response) => {
  await handle(response, async () => {
    const petId = normalizeId(request.params.petId)
    const actionId = normalizeId(request.params.actionId)
    const videoUrl = String(request.body && request.body.videoUrl ? request.body.videoUrl : '').trim()

    if (!petId || !actionId || !videoUrl) {
      const error = new Error('petId, actionId, videoUrl 不能为空')
      error.statusCode = 400
      throw error
    }

    const petDoc = await getDocument('pets', petId)
    if (!petDoc || !petDoc.manifest) {
      const error = new Error(`未找到宠物 ${petId} 的 manifest`)
      error.statusCode = 404
      throw error
    }

    const manifest = petDoc.manifest
    const action = Array.isArray(manifest.actions)
      ? manifest.actions.find((a) => a.id === actionId)
      : null

    if (!action || !Array.isArray(action.videoUrls)) {
      const error = new Error(`未找到场景 ${actionId}`)
      error.statusCode = 404
      throw error
    }

    if (action.videoUrls.length <= 1) {
      const error = new Error('该场景只剩一个视频，不能删除')
      error.statusCode = 400
      throw error
    }

    const videoIndex = action.videoUrls.indexOf(videoUrl)
    if (videoIndex < 0) {
      const error = new Error('该视频不在场景列表中')
      error.statusCode = 404
      throw error
    }

    action.videoUrls.splice(videoIndex, 1)

    if (action.audioUrl) {
      action.audioUrl = ''
    }

    const { _id, ...petDocRest } = petDoc
    await setDocument('pets', petId, {
      ...petDocRest,
      manifest,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-media',
    })

    const videoKey = videoUrl.replace(/^cloud:\/\/[^/]+\//, '')
    await cos.deleteObject({ Bucket: cosBucket, Region: cosRegion, Key: videoKey }, () => undefined)

    await writeAuditLog({
      action: 'deleteActionVideo',
      target: `${petId}/${actionId}`,
      summary: `删除 ${petId}/${actionId} 的视频 ${videoUrl.split('/').pop()}`,
      source: request.ip || 'admin-server',
    })

    return {
      petId,
      actionId,
      videoUrls: action.videoUrls,
    }
  })
})

server.get('/api/state', async (_request, response) => {
  await handle(response, async () => getAdminState())
})

server.put('/api/draft', async (request, response) => {
  await handle(response, async () => {
    const config = normalizeForPersist(normalizeConfig(request.body && request.body.config))
    const issues = validateConfig(config, { strict: false })

    if (issues.length) {
      const error = new Error(issues.map((issue) => issue.message).join('；'))
      error.statusCode = 400
      throw error
    }

    await writeDraftConfig(config)
    await writeAuditLog({
      action: 'saveDraft',
      target: CONFIG_DOC_ID,
      summary: `保存草稿：${summarizeConfig(config)}`,
      source: request.ip || 'admin-server',
    })
    return getAdminState()
  })
})

server.delete('/api/draft', async (request, response) => {
  await handle(response, async () => {
    await deleteDraftConfig()
    await writeAuditLog({
      action: 'discardDraft',
      target: CONFIG_DOC_ID,
      summary: '丢弃草稿，恢复到当前线上',
      source: request.ip || 'admin-server',
    })
    return getAdminState()
  })
})

server.post('/api/publish', async (request, response) => {
  await handle(response, async () => {
    const summary = String(request.body && request.body.summary ? request.body.summary : '').trim()
    const draft = await readDraftConfig()

    if (!draft) {
      const error = new Error('当前没有可发布的草稿')
      error.statusCode = 400
      throw error
    }

    const issues = validateConfig(draft, { strict: true })

    if (issues.length) {
      const error = new Error(issues.map((issue) => issue.message).join('；'))
      error.statusCode = 400
      throw error
    }

    const version = buildVersionId()
    const finalConfig = stampConfigVersion(normalizeForPersist(draft), version)

    await writePublishedConfig(finalConfig)
    await writeVersionRecord({ version, config: finalConfig, summary })
    await deleteDraftConfig()
    await writeAuditLog({
      action: 'publishConfig',
      target: version,
      summary: summary || `发布配置 ${version}`,
      source: request.ip || 'admin-server',
    })

    return getAdminState()
  })
})

server.post('/api/rollback', async (request, response) => {
  await handle(response, async () => {
    const versionId = String(request.body && request.body.versionId ? request.body.versionId : '').trim()

    if (!versionId) {
      const error = new Error('缺少 versionId')
      error.statusCode = 400
      throw error
    }

    const record = await getDocument(VERSION_COLLECTION, versionId)

    if (!record || !record.config) {
      const error = new Error(`版本 ${versionId} 不存在`)
      error.statusCode = 404
      throw error
    }

    const newVersion = buildVersionId()
    const finalConfig = stampConfigVersion(record.config, newVersion)

    await writePublishedConfig(finalConfig)
    await writeVersionRecord({
      version: newVersion,
      config: finalConfig,
      summary: `回滚到 ${versionId}`,
      rollbackOf: versionId,
    })
    await deleteDraftConfig()
    await writeAuditLog({
      action: 'rollbackConfig',
      target: newVersion,
      summary: `回滚到 ${versionId}`,
      source: request.ip || 'admin-server',
    })

    return getAdminState()
  })
})

server.post('/api/resolve-url', async (request, response) => {
  await handle(response, async () => {
    const fileID = String(request.body && request.body.fileID ? request.body.fileID : '').trim()

    if (!fileID || !fileID.startsWith('cloud://')) {
      const error = new Error('请提供 cloud:// 开头的文件 ID')
      error.statusCode = 400
      throw error
    }

    const result = await new Promise((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: cosBucket,
          Region: cosRegion,
          Key: fileID.replace(/^cloud:\/\/[^/]+\//, ''),
          Sign: true,
          Expires: 7200,
        },
        (error, data) => {
          if (error) reject(error)
          else resolve(data)
        },
      )
    })

    return { url: result.Url }
  })
})

server.get('/api/media/pets/:petId/manifest', async (request, response) => {
  await handle(response, async () => {
    const petId = normalizeId(request.params.petId)

    if (!petId) {
      const error = new Error('宠物 ID 不能为空')
      error.statusCode = 400
      throw error
    }

    const petDoc = await getDocument('pets', petId)

    if (!petDoc || !petDoc.manifest) {
      const error = new Error(`未找到宠物 ${petId} 的 manifest`)
      error.statusCode = 404
      throw error
    }

    const manifest = petDoc.manifest
    const draftConfig = await getDraftBase()
    const petInConfig = draftConfig.pets.find((p) => p.id === petId)
    const legacyVideoUrl = petInConfig && petInConfig.videoUrl ? petInConfig.videoUrl : ''

    const STANDARD_ACTIONS = [
      { id: 'idle', label: '待机' },
      { id: 'listening', label: '倾听' },
      { id: 'reply', label: '回应' },
      { id: 'sleep-enter', label: '入睡过渡' },
      { id: 'sleep-loop', label: '睡眠循环' },
      { id: 'sleep-exit', label: '唤醒过渡' },
    ]

    const dbActions = Array.isArray(manifest.actions) ? manifest.actions : []

    const actions = STANDARD_ACTIONS.map((std) => {
      const found = dbActions.find((a) => a.id === std.id)
      let videoUrls = found && Array.isArray(found.videoUrls) ? found.videoUrls : []
      if (!videoUrls.length && std.id === 'idle' && legacyVideoUrl) {
        videoUrls = [legacyVideoUrl]
      }
      return {
        id: std.id,
        label: std.label,
        videoUrls,
        audioUrl: found && found.audioUrl ? found.audioUrl : '',
      }
    })

    return {
      petId,
      name: manifest.name || petDoc.name || petId,
      actions,
    }
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

      const draftConfig = await getDraftBase()
      const nextDraft = upsertPetIntoConfig(draftConfig, result.pet)
      const draftIssues = validateConfig(nextDraft, { strict: false })

      if (!draftIssues.length) {
        await writeDraftConfig(nextDraft)
      }

      await writeAuditLog({
        action: 'createPetFromWebm',
        target: petId,
        summary: `处理并写入草稿：${name} 的 idle WebM`,
        source: request.ip || 'admin-server',
      })

      return {
        ...result,
        draftIssues,
        state: await getAdminState(),
      }
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

server.post('/api/media/pets/add-action-video', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传 WebM 源素材')
      error.statusCode = 400
      throw error
    }

    const petId = normalizeId(request.body.petId)
    const actionId = normalizeId(request.body.actionId)

    if (!petId || !actionId) {
      const error = new Error('宠物 ID 和场景 ID 不能为空')
      error.statusCode = 400
      throw error
    }

    try {
      const result = await addActionVideoToPet({ sourcePath: sourceFile.path, originalName: sourceFile.originalname, petId, actionId })

      await writeAuditLog({
        action: 'addActionVideo',
        target: `${petId}/${actionId}`,
        summary: `为 ${petId} 添加 ${actionId} 场景视频 #${result.sequence}`,
        source: request.ip || 'admin-server',
      })

      return {
        ...result,
        state: await getAdminState(),
      }
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

      const draftConfig = await getDraftBase()
      const nextDraft = upsertRoomIntoConfig(draftConfig, result.room)
      const draftIssues = validateConfig(nextDraft, { strict: false })

      if (!draftIssues.length) {
        await writeDraftConfig(nextDraft)
      }

      await writeAuditLog({
        action: 'createRoomFromMedia',
        target: result.room.id,
        summary: `上传背景素材并写入草稿：${name}`,
        source: request.ip || 'admin-server',
      })

      return {
        ...result,
        draftIssues,
        state: await getAdminState(),
      }
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

server.post('/api/media/home/listen-orb', upload.single('source'), async (request, response) => {
  await handle(response, async () => {
    const sourceFile = request.file

    if (!sourceFile) {
      const error = new Error('请上传光球视频素材')
      error.statusCode = 400
      throw error
    }

    try {
      const extension = path.extname(sourceFile.originalname || '').toLowerCase()
      if (!['.mp4', '.webm', '.mov'].includes(extension)) {
        const error = new Error('光球视频只支持 mp4、webm、mov')
        error.statusCode = 400
        throw error
      }

      const warnings = []
      const probe = await ffprobe(sourceFile.path)
      const video = probe.streams.find((stream) => stream.codec_type === 'video')

      if (!video) {
        const error = new Error('没有检测到可用的视频轨道')
        error.statusCode = 400
        throw error
      }

      if (!['h264', 'vp8', 'vp9'].includes(String(video.codec_name || ''))) {
        warnings.push(`视频编码为 ${video.codec_name || 'unknown'}，小程序端可能需要转码后再使用`)
      }

      const fileExt = extension || '.mp4'
      const key = `ui/listen-orb/${formatTimestamp(new Date())}${fileExt}`
      const contentType = normalizeContentType({ kind: 'video', extension, mimeType: sourceFile.mimetype })

      await uploadToCos(sourceFile.path, key, contentType)
      const mediaUrl = cloudUrl(key)

      await writeAuditLog({
        action: 'uploadListenOrbVideo',
        target: key,
        summary: '上传倾听光球视频到云存储',
        source: request.ip || 'admin-server',
      })

      return {
        mediaUrl,
        key,
        contentType,
        size: sourceFile.size,
        inspect: {
          fileName: sourceFile.originalname,
          width: Number(video.width || 0),
          height: Number(video.height || 0),
          duration: Number(probe.format?.duration || 0),
          codec: String(video.codec_name || ''),
          warnings,
        },
      }
    } finally {
      await fsp.rm(sourceFile.path, { force: true }).catch(() => undefined)
    }
  })
})

const port = Number(process.env.ADMIN_SERVER_PORT || 8787)
server.listen(port, () => {
  console.log(`admin server listening on http://127.0.0.1:${port}`)
})

async function getAdminState() {
  const published = await readPublishedConfig()
  const draft = await readDraftConfig()
  const versions = await listVersions()
  const auditLogs = await listAuditLogs()
  const draftIssues = draft ? validateConfig(draft, { strict: false }) : []

  return {
    published,
    draft,
    hasDraft: Boolean(draft),
    hasDraftChanges: draft ? hasConfigChanges(published, draft) : false,
    draftIssues,
    versions,
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

    const audioFile = path.join(workDir, `${petId}-idle.aac`)
    const hasAudio = await extractAudio(sourcePath, audioFile)

    const videoKey = `pets/${petId}/actions/idle/videos/${petId}-idle-alpha-pack-h.mp4`
    const listenKey = `pets/${petId}/actions/idle/frames/frame_0030.png`
    const thumbKey = `pets/${petId}/actions/idle/frames/frame_0090.png`
    const audioKey = hasAudio ? `pets/${petId}/actions/idle/audio/${petId}-idle.aac` : ''

    await uploadToCos(outputVideo, videoKey, 'video/mp4')
    await uploadToCos(listenFrame, listenKey, 'image/png')
    await uploadToCos(thumbFrame, thumbKey, 'image/png')
    if (hasAudio) {
      await uploadToCos(audioFile, audioKey, 'audio/aac')
    }

    const videoUrl = cloudUrl(videoKey)
    const listenFrameUrl = cloudUrl(listenKey)
    const thumbUrl = cloudUrl(thumbKey)
    const audioUrl = hasAudio ? cloudUrl(audioKey) : ''
    const manifest = buildPetManifest({ petId, name, audioUrl })
    const pet = {
      id: petId,
      name,
      subtitle,
      frameOffset: 0,
      manifestKey: `${petId}/manifest.json`,
      videoUrl,
      thumbUrl,
      listenFrameUrl,
      audioUrl,
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
      },
    }
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function addActionVideoToPet({ sourcePath, originalName, petId, actionId }) {
  await fsp.mkdir(tmpRoot, { recursive: true })

  const workDir = path.join(tmpRoot, `${petId}-${actionId}-${Date.now()}`)
  await fsp.mkdir(workDir, { recursive: true })

  try {
    const petDoc = await getDocument('pets', petId)
    const manifest = petDoc && petDoc.manifest ? petDoc.manifest : null
    const existingAction = manifest && Array.isArray(manifest.actions)
      ? manifest.actions.find((a) => a.id === actionId)
      : null
    const existingVideos = existingAction && Array.isArray(existingAction.videoUrls)
      ? existingAction.videoUrls
      : []
    const sequence = existingVideos.length + 1
    const seqStr = String(sequence).padStart(3, '0')

    const probe = await ffprobe(sourcePath)
    const alphaCheck = path.join(workDir, 'source-alpha-check.png')
    const inspect = await inspectWebm({ sourcePath, originalName, probe, alphaCheck })

    if (!inspect.ok) {
      const error = new Error('素材没有通过 alpha 验收')
      error.statusCode = 400
      throw error
    }

    const outputVideo = path.join(workDir, `${petId}-${actionId}-alpha-pack-h-${seqStr}.mp4`)
    await transcodeAlphaPack(sourcePath, outputVideo)

    const packedAlphaCheck = path.join(workDir, 'packed-alpha-half-check.png')
    const packedAlphaStats = await inspectPackedAlpha(outputVideo, packedAlphaCheck)

    if (packedAlphaStats.yMin > 5 || packedAlphaStats.yMax < 250) {
      const error = new Error('双通道 MP4 的右半 alpha mask 不合格')
      error.statusCode = 400
      throw error
    }

    const videoKey = `pets/${petId}/actions/${actionId}/videos/${petId}-${actionId}-alpha-pack-h-${seqStr}.mp4`
    await uploadToCos(outputVideo, videoKey, 'video/mp4')
    const videoUrl = cloudUrl(videoKey)

    const audioFile = path.join(workDir, `${petId}-${actionId}-${seqStr}.aac`)
    const hasAudio = await extractAudio(sourcePath, audioFile)
    let audioUrl = ''
    if (hasAudio) {
      const audioKey = `pets/${petId}/actions/${actionId}/audio/${petId}-${actionId}-${seqStr}.aac`
      await uploadToCos(audioFile, audioKey, 'audio/aac')
      audioUrl = cloudUrl(audioKey)
    }

    const isFirstVideo = existingVideos.length === 0
    if (isFirstVideo) {
      const frameDir = path.join(workDir, 'frames')
      await fsp.mkdir(frameDir, { recursive: true })

      const outputProbe = await ffprobe(outputVideo)
      const outputVideoStream = outputProbe.streams.find((s) => s.codec_type === 'video') || {}
      const frameCount = Number(outputVideoStream.nb_frames || 0)
      const safeFrameCount = Math.max(1, frameCount || Math.round(inspect.source.duration * 24) || 1)
      const listenFrameIndex = Math.min(30, safeFrameCount - 1)
      const thumbFrameIndex = Math.min(90, safeFrameCount - 1)

      const listenFrame = path.join(frameDir, 'frame_0030.png')
      const thumbFrame = path.join(frameDir, 'frame_0090.png')
      await extractFrame(sourcePath, listenFrameIndex, listenFrame)
      await extractFrame(sourcePath, thumbFrameIndex, thumbFrame)

      const listenKey = `pets/${petId}/actions/${actionId}/frames/frame_0030.png`
      const thumbKey = `pets/${petId}/actions/${actionId}/frames/frame_0090.png`
      await uploadToCos(listenFrame, listenKey, 'image/png')
      await uploadToCos(thumbFrame, thumbKey, 'image/png')

      if (actionId === 'idle') {
        const draftConfig = await getDraftBase()
        const petInConfig = draftConfig.pets.find((p) => p.id === petId)
        if (petInConfig) {
          petInConfig.videoUrl = videoUrl
          petInConfig.thumbUrl = cloudUrl(thumbKey)
          petInConfig.listenFrameUrl = cloudUrl(listenKey)
          await writeDraftConfig(draftConfig)
        }
      }
    }

    const updatedVideoUrls = [...existingVideos, videoUrl]
    if (manifest && Array.isArray(manifest.actions)) {
      const actionIndex = manifest.actions.findIndex((a) => a.id === actionId)
      if (actionIndex >= 0) {
        manifest.actions[actionIndex].videoUrls = updatedVideoUrls
        if (audioUrl && !manifest.actions[actionIndex].audioUrl) {
          manifest.actions[actionIndex].audioUrl = audioUrl
        }
      } else {
        const actionLabels = { idle: '待机', listening: '倾听', reply: '回应', 'sleep-enter': '入睡过渡', 'sleep-loop': '睡眠循环', 'sleep-exit': '唤醒过渡' }
        manifest.actions.push({
          id: actionId,
          type: actionId === 'respond' ? 'transition' : 'loop',
          label: actionLabels[actionId] || actionId,
          fps: 24,
          next: ['idle'],
          videoUrls: updatedVideoUrls,
          audioUrl: audioUrl || '',
        })
      }
      const { _id, ...petDocRest } = petDoc
      await setDocument('pets', petId, {
        ...petDocRest,
        manifest,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin-media',
      })
    }

    return {
      petId,
      actionId,
      videoUrl,
      sequence,
      totalVideos: updatedVideoUrls.length,
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
  if (audio) warnings.push('源素材包含音频，将单独抽取为 AAC 文件')

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

async function extractAudio(sourcePath, outputAudio) {
  try {
    await execFfmpeg([
      '-y',
      '-i',
      sourcePath,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outputAudio,
    ])
    const stats = await fsp.stat(outputAudio).catch(() => null)
    return stats && stats.size > 0
  } catch (error) {
    return false
  }
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

function buildPetManifest({ petId, name, audioUrl }) {
  return {
    schemaVersion: 1,
    manifestVersion: `${formatDate(new Date())}-${petId}-001`,
    petId,
    name,
    defaultState: 'awake-idle-normal',
    actions: [
      {
        id: 'transition-awake-to-sleep',
        type: 'transition',
        label: '入睡过渡',
        fps: 24,
        next: ['sleep-loop'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'sleep',
        tags: ['transition', 'awake', 'sleep'],
        weight: 1,
      },
      {
        id: 'transition-sleep-to-awake',
        type: 'transition',
        label: '唤醒过渡',
        fps: 24,
        next: ['awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'sleep',
        anchorEnd: 'awake',
        tags: ['transition', 'sleep', 'awake'],
        weight: 1,
      },
      {
        id: 'sleep-loop',
        type: 'anchor',
        label: '睡眠循环',
        fps: 24,
        next: ['sleep-loop', 'sleep-ear-twitch', 'sleep-tail-twitch', 'transition-sleep-to-awake'],
        videoUrls: [],
        anchorStart: 'sleep',
        anchorEnd: 'sleep',
        tags: ['sleep', 'loop'],
        weight: 1,
      },
      {
        id: 'sleep-ear-twitch',
        type: 'anchor',
        label: '睡眠耳动',
        fps: 24,
        next: ['sleep-loop', 'sleep-tail-twitch'],
        videoUrls: [],
        anchorStart: 'sleep',
        anchorEnd: 'sleep',
        tags: ['sleep', 'micro'],
        weight: 1,
      },
      {
        id: 'sleep-tail-twitch',
        type: 'anchor',
        label: '睡眠尾动',
        fps: 24,
        next: ['sleep-loop', 'sleep-ear-twitch'],
        videoUrls: [],
        anchorStart: 'sleep',
        anchorEnd: 'sleep',
        tags: ['sleep', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-idle-normal',
        type: 'anchor',
        label: '清醒待机',
        fps: 24,
        next: ['awake-idle-energetic', 'awake-idle-tired', 'awake-idle-sad', 'awake-look-around', 'awake-listening', 'awake-touch-petting', 'transition-awake-to-sleep'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'idle'],
        weight: 1,
      },
      {
        id: 'awake-idle-energetic',
        type: 'anchor',
        label: '清醒活跃待机',
        fps: 24,
        next: ['awake-idle-normal', 'awake-tail', 'awake-look-around'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'idle'],
        weight: 1,
      },
      {
        id: 'awake-idle-tired',
        type: 'anchor',
        label: '清醒疲惫待机',
        fps: 24,
        next: ['awake-idle-normal', 'awake-yawn', 'transition-awake-to-sleep'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'idle'],
        weight: 1,
      },
      {
        id: 'awake-idle-sad',
        type: 'anchor',
        label: '清醒低落待机',
        fps: 24,
        next: ['awake-idle-normal', 'awake-look-around', 'awake-reply-sad'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'idle'],
        weight: 1,
      },
      {
        id: 'awake-scratch',
        type: 'anchor',
        label: '挠痒',
        fps: 24,
        next: ['awake-idle-normal', 'awake-look-around'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-lick',
        type: 'anchor',
        label: '舔爪',
        fps: 24,
        next: ['awake-idle-normal', 'awake-look-around'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-yawn',
        type: 'anchor',
        label: '哈欠',
        fps: 24,
        next: ['awake-idle-tired', 'awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-tilt',
        type: 'anchor',
        label: '歪头',
        fps: 24,
        next: ['awake-idle-normal', 'awake-listening', 'awake-reply-confused'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-tail',
        type: 'anchor',
        label: '摇尾',
        fps: 24,
        next: ['awake-idle-normal', 'awake-reply-happy'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-look-around',
        type: 'anchor',
        label: '环顾',
        fps: 24,
        next: ['awake-idle-normal', 'awake-listening', 'awake-tilt'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'micro'],
        weight: 1,
      },
      {
        id: 'awake-listening',
        type: 'anchor',
        label: '倾听',
        fps: 24,
        next: ['awake-reply-normal', 'awake-idle-normal', 'awake-tilt'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'listen'],
        weight: 1,
      },
      {
        id: 'awake-reply-normal',
        type: 'anchor',
        label: '回应',
        fps: 24,
        next: ['awake-idle-normal', 'awake-listening'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'reply'],
        weight: 1,
      },
      {
        id: 'awake-reply-happy',
        type: 'anchor',
        label: '开心回应',
        fps: 24,
        next: ['awake-idle-energetic', 'awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'reply'],
        weight: 1,
      },
      {
        id: 'awake-reply-shy',
        type: 'anchor',
        label: '害羞回应',
        fps: 24,
        next: ['awake-idle-normal', 'awake-idle-sad'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'reply'],
        weight: 1,
      },
      {
        id: 'awake-reply-confused',
        type: 'anchor',
        label: '疑惑回应',
        fps: 24,
        next: ['awake-tilt', 'awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'reply'],
        weight: 1,
      },
      {
        id: 'awake-reply-sad',
        type: 'anchor',
        label: '低落回应',
        fps: 24,
        next: ['awake-idle-sad', 'awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'reply'],
        weight: 1,
      },
      {
        id: 'awake-touch-petting',
        type: 'anchor',
        label: '抚摸反馈',
        fps: 24,
        next: ['awake-tail', 'awake-reply-happy', 'awake-idle-normal'],
        videoUrls: [],
        anchorStart: 'awake',
        anchorEnd: 'awake',
        tags: ['awake', 'touch'],
        weight: 1,
      },
    ],
    sounds: audioUrl ? [{ id: 'awake-idle-normal-loop', url: audioUrl, loop: true }] : [],
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
    // 云端 app_configs 还没数据（如全新环境）：保留配置骨架，但清空宠物与背景，
    // 让后台显示干净白板，上传素材时从零累加，而不是误显示本地预置的示例数据。
    return {
      ...localConfig,
      pets: [],
      rooms: [],
      defaultPetId: '',
      defaultRoomId: '',
    }
  }

  return normalizeConfig(record.config || record)
}

async function readDraftConfig() {
  const record = await getDocument(DRAFT_COLLECTION, CONFIG_DOC_ID).catch(() => null)

  if (!record || !record.config) return null
  return normalizeConfig(record.config)
}

async function writeDraftConfig(config) {
  await setDocument(DRAFT_COLLECTION, CONFIG_DOC_ID, {
    enabled: true,
    config,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    updatedBy: process.env.ADMIN_ACTOR || 'admin',
  })
}

async function deleteDraftConfig() {
  const db = app.database()
  try {
    await db.collection(DRAFT_COLLECTION).doc(CONFIG_DOC_ID).remove()
  } catch (error) {
    if (!isMissingDocumentError(error) && !isMissingCollectionError(error)) {
      throw error
    }
  }
}

async function writeVersionRecord({ version, config, summary, rollbackOf }) {
  await setDocument(VERSION_COLLECTION, version, {
    version,
    config,
    summary: summary || '',
    rollbackOf: rollbackOf || '',
    publishedAt: new Date().toISOString(),
    publishedBy: process.env.ADMIN_ACTOR || 'admin',
  })
}

async function listVersions() {
  const db = app.database()
  const result = await db.collection(VERSION_COLLECTION).orderBy('publishedAt', 'desc').limit(20).get().catch(() => ({ data: [] }))
  const records = Array.isArray(result.data) ? result.data : []

  return records.map((record) => ({
    version: record.version || record._id || '',
    summary: record.summary || '',
    rollbackOf: record.rollbackOf || '',
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
  }))
}

function isMissingDocumentError(error) {
  const message = error && error.message ? error.message : String(error)
  return message.includes('DOCUMENT_NOT_FOUND') || message.includes('NotFound') || message.includes('not exist')
}

function hasConfigChanges(published, draft) {
  if (!draft) return false
  if (!published) return true

  const cleanedPublished = stripVolatileFields(published)
  const cleanedDraft = stripVolatileFields(draft)

  return JSON.stringify(cleanedPublished) !== JSON.stringify(cleanedDraft)
}

async function getDraftBase() {
  const draft = await readDraftConfig()
  if (draft) return draft

  const published = await readPublishedConfig()
  return JSON.parse(JSON.stringify(published))
}

function upsertPetIntoConfig(config, pet) {
  const next = JSON.parse(JSON.stringify(config))
  const pets = Array.isArray(next.pets) ? next.pets : []
  const index = pets.findIndex((item) => item.id === pet.id)

  if (index === -1) {
    pets.push(pet)
  } else {
    pets[index] = { ...pets[index], ...pet }
  }

  next.pets = pets

  if (!next.defaultPetId || !pets.some((item) => item.id === next.defaultPetId && item.enabled !== false)) {
    next.defaultPetId = pet.id
    next.defaultPetName = pet.name
    next.homeMedia = {
      ...(next.homeMedia || {}),
      petVideoUrl: pet.videoUrl || (next.homeMedia && next.homeMedia.petVideoUrl) || '',
    }
  }

  return normalizeForPersist(next)
}

function upsertRoomIntoConfig(config, room) {
  const next = JSON.parse(JSON.stringify(config))
  const rooms = Array.isArray(next.rooms) ? next.rooms : []
  const index = rooms.findIndex((item) => item.id === room.id)

  if (index === -1) {
    rooms.push(room)
  } else {
    rooms[index] = { ...rooms[index], ...room }
  }

  next.rooms = rooms

  if (!next.defaultRoomId || !rooms.some((item) => item.id === next.defaultRoomId && item.enabled !== false)) {
    next.defaultRoomId = room.id
    next.homeMedia = {
      ...(next.homeMedia || {}),
      backgroundVideoUrl: room.mediaUrl || (next.homeMedia && next.homeMedia.backgroundVideoUrl) || '',
    }
  }

  return normalizeForPersist(next)
}

function stripVolatileFields(config) {
  if (!config || typeof config !== 'object') return config

  const clone = JSON.parse(JSON.stringify(config))
  delete clone.configVersion
  delete clone.serverTime
  return clone
}

function buildVersionId() {
  return `v-${formatTimestamp(new Date())}`
}

function stampConfigVersion(config, version) {
  const next = JSON.parse(JSON.stringify(config))
  next.configVersion = version
  return next
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

async function getSingleDoc(collection, id) {
  const doc = await getDocument(collection, id)
  return doc ? sanitizeDoc(doc) : null
}

async function queryCollectionDocs({ collection, meta, limit, skip, openId, petId }) {
  if (meta && meta.singleDoc) {
    const doc = await getDocument(collection, CONFIG_DOC_ID)
    return {
      collection,
      meta: meta
        ? {
            label: meta.label,
            description: meta.description,
            category: meta.category,
            sortField: meta.sortField,
            singleDoc: Boolean(meta.singleDoc),
          }
        : null,
      total: doc ? 1 : 0,
      limit: 1,
      skip: 0,
      items: doc ? [sanitizeDoc(doc)] : [],
    }
  }

  const db = app.database()
  let query = db.collection(collection)

  if (meta && meta.openIdField && openId) {
    query = query.where({ [meta.openIdField]: openId })
  }

  if (meta && meta.petIdField && petId) {
    query = query.where({ [meta.petIdField]: petId })
  }

  if (meta && meta.sortField) {
    query = query.orderBy(meta.sortField, 'desc')
  }

  const result = await query.skip(skip).limit(limit).get().catch((error) => {
    if (isMissingCollectionError(error)) return { data: [] }
    throw error
  })

  const records = Array.isArray(result.data) ? result.data : []
  return {
    collection,
    meta: meta
      ? {
          label: meta.label,
          description: meta.description,
          category: meta.category,
          sortField: meta.sortField,
          singleDoc: Boolean(meta.singleDoc),
        }
      : null,
    total: records.length,
    limit,
    skip,
    items: records.map((record) => sanitizeDoc(record)),
  }
}

async function getPetManifestSummary(petId) {
  const petDoc = await getDocument('pets', petId)

  if (!petDoc || !petDoc.manifest) {
    return null
  }

  const manifest = petDoc.manifest
  return {
    petId,
    name: manifest.name || petDoc.name || petId,
    actions: Array.isArray(manifest.actions)
      ? manifest.actions.map((action) => ({
          id: action.id || '',
          label: action.label || '',
          type: action.type || '',
          next: Array.isArray(action.next) ? action.next : [],
          fps: action.fps || 0,
          videoUrls: Array.isArray(action.videoUrls) ? action.videoUrls : [],
          audioUrl: action.audioUrl || '',
        }))
      : [],
  }
}

async function buildUserIndexRows() {
  const sources = await Promise.all(USER_INDEX_SOURCES.map(async (collection) => {
    const meta = DATA_VIEW_MAP.get(collection)
    const docs = await queryAllDocs(collection)
    return { collection, meta, docs }
  }))

  const map = new Map()

  for (const source of sources) {
    const meta = source.meta
    const openIdField = meta && meta.openIdField ? meta.openIdField : '_openId'
    const petIdField = meta && meta.petIdField ? meta.petIdField : ''

    for (const doc of source.docs) {
      const openId = String(doc[openIdField] || doc._openid || doc._openId || '').trim()
      if (!openId) continue

      const current = map.get(openId) || {
        openId,
        nickName: '',
        status: 'normal',
        statusLabel: '普通用户',
        profileCompleteness: 0,
        petIds: [],
        sources: [],
        lastSeenAt: '',
        lastMemoryAt: '',
        lastProfileAt: '',
        lastVoiceAt: '',
        lastAiAt: '',
        memoryCount: 0,
        profileCount: 0,
        petStateCount: 0,
        voiceLogCount: 0,
        aiLogCount: 0,
        loginCount: 0,
        firstLoginAt: '',
        lastLoginAt: '',
        lastActiveAt: '',
        hasProfile: false,
        activePetId: '',
        sampleMemory: '',
        samplePortrait: '',
      }

      current.sources.push(source.collection)

      if (petIdField) {
        const petId = String(doc[petIdField] || '').trim()
        if (petId && !current.petIds.includes(petId)) current.petIds.push(petId)
        if (!current.activePetId && petId) current.activePetId = petId
      }

      if (source.collection === 'users') {
        current.nickName = current.nickName || String(doc.nickName || doc.nickname || doc.wechatNickName || '')
        current.loginCount = typeof doc.loginCount === 'number' ? doc.loginCount : current.loginCount
        current.firstLoginAt = pickLater(current.firstLoginAt, doc.firstLoginAt || doc.createdAt || '')
        current.lastLoginAt = pickLater(current.lastLoginAt, doc.lastLoginAt || '')
        current.lastActiveAt = pickLater(current.lastActiveAt, doc.lastActiveAt || '')
        current.lastSeenAt = pickLater(current.lastSeenAt, doc.lastActiveAt || doc.lastLoginAt || doc.updatedAt || '')
        if (!current.activePetId && doc.activePetId) current.activePetId = String(doc.activePetId)
        if (!current.activePetId && doc.lastPetId) current.activePetId = String(doc.lastPetId)
      }

      if (source.collection === 'pet_states') {
        current.petStateCount += 1
        current.lastSeenAt = pickLater(current.lastSeenAt, doc._savedAt || doc.updatedAt || '')
        if (!current.activePetId && doc._petId) current.activePetId = String(doc._petId)
      }

      if (source.collection === 'user_prefs') {
        current.lastSeenAt = pickLater(current.lastSeenAt, doc.updatedAt || '')
      }

      if (source.collection === 'user_memories') {
        current.memoryCount += 1
        current.lastMemoryAt = pickLater(current.lastMemoryAt, doc.createdAt || '')
        current.sampleMemory = current.sampleMemory || String(doc.content || '')
      }

      if (source.collection === 'user_profiles') {
        current.profileCount += 1
        current.hasProfile = true
        current.lastProfileAt = pickLater(current.lastProfileAt, doc.lastUpdatedAt || '')
        current.samplePortrait = current.samplePortrait || String(doc.portrait || '')
      }

      if (source.collection === 'voice_logs') {
        current.voiceLogCount += 1
        current.lastVoiceAt = pickLater(current.lastVoiceAt, doc.createdAt || '')
      }

      if (source.collection === 'ai_logs') {
        current.aiLogCount += 1
        current.lastAiAt = pickLater(current.lastAiAt, doc.createdAt || '')
      }

      map.set(openId, current)
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      sources: Array.from(new Set(row.sources)).sort(),
      petIds: Array.from(new Set(row.petIds)).sort(),
      lastSeenAt: row.lastSeenAt || row.lastActiveAt || row.lastLoginAt || row.lastMemoryAt || row.lastProfileAt || row.lastVoiceAt || row.lastAiAt || '',
    }))
    .map((row) => ({
      ...row,
      ...buildUserDisplayState(row),
    }))
    .sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')))
}

function buildUserDisplayState(row) {
  const hasWechatProfile = Boolean(row.nickName)
  const profileCompleteness = Math.min(100, [
    row.nickName,
    row.activePetId,
    row.memoryCount > 0,
    row.hasProfile,
  ].filter(Boolean).length * 20)

  if (!row.nickName) {
    return {
      status: 'needs_profile',
      statusLabel: '待完善资料',
      profileCompleteness,
    }
  }

  if (isWithinDays(row.lastSeenAt, 1)) {
    return {
      status: 'active_today',
      statusLabel: '今日活跃',
      profileCompleteness,
    }
  }

  if (isWithinDays(row.lastSeenAt, 7)) {
    return {
      status: 'active_7d',
      statusLabel: '7日活跃',
      profileCompleteness,
    }
  }

  if (!row.memoryCount && !row.hasProfile) {
    return {
      status: 'needs_memory',
      statusLabel: '缺少记忆',
      profileCompleteness,
    }
  }

  if (!isWithinDays(row.lastSeenAt, 30)) {
    return {
      status: 'inactive',
      statusLabel: '沉默用户',
      profileCompleteness,
    }
  }

  return {
    status: 'normal',
    statusLabel: '普通用户',
    profileCompleteness,
  }
}

function isWithinDays(value, days) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return false
  return Date.now() - time <= days * 24 * 60 * 60 * 1000
}

function normalizeUserStatusFilter(value) {
  const text = String(value || '').trim()
  const allowed = new Set(['active_today', 'active_7d', 'needs_profile', 'needs_memory', 'inactive', 'normal'])
  return allowed.has(text) ? text : ''
}

function normalizeUserSort(value) {
  const text = String(value || '').trim()
  const allowed = new Set(['lastSeenAt', 'loginCount', 'memoryCount', 'aiLogCount', 'profileCompleteness'])
  return allowed.has(text) ? text : 'lastSeenAt'
}

function sortUserIndexRows(rows, sort) {
  return rows.slice().sort((a, b) => {
    if (sort === 'lastSeenAt') {
      return String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''))
    }
    const left = Number(a[sort] || 0)
    const right = Number(b[sort] || 0)
    return right - left
  })
}

async function queryAllDocs(collection) {
  const db = app.database()
  const batchSize = 100
  const result = []
  let skip = 0

  while (true) {
    const page = await db.collection(collection).skip(skip).limit(batchSize).get().catch((error) => {
      if (isMissingCollectionError(error)) return { data: [] }
      throw error
    })
    const items = Array.isArray(page.data) ? page.data : []
    if (!items.length) break
    result.push(...items.map((item) => sanitizeDoc(item)))
    if (items.length < batchSize) break
    skip += batchSize
  }

  return result
}

function pickLater(a, b) {
  if (!a) return b || ''
  if (!b) return a || ''
  return String(a) > String(b) ? a : b
}

function sanitizeDoc(value) {
  if (!value || typeof value !== 'object') return value
  const clone = JSON.parse(JSON.stringify(value))
  if (clone.config && typeof clone.config === 'object') {
    clone.config = sanitizeDoc(clone.config)
  }
  return clone
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

function toPositiveInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : fallback
}

function normalizeForPersist(config) {
  const homeHint = config.homeHint || (config.home && config.home.hint) || ''
  const pets = Array.isArray(config.pets) ? config.pets : []
  const defaultPet = pets.find((pet) => pet.id === config.defaultPetId)
  const fallbackAiMemory = {
    shortTermMemoryMaxCount: 8,
    portraitTriggerCount: 3,
    portraitSourceMemoryLimit: 15,
    portraitMaxLength: 200,
  }

  return {
    ...config,
    defaultPetName: defaultPet?.name || config.defaultPetName || '',
    homeHint,
    home: {
      ...(config.home || {}),
      hint: homeHint,
    },
    aiMemory: {
      shortTermMemoryMaxCount: toPositiveInt(config.aiMemory && config.aiMemory.shortTermMemoryMaxCount, fallbackAiMemory.shortTermMemoryMaxCount),
      portraitTriggerCount: toPositiveInt(config.aiMemory && config.aiMemory.portraitTriggerCount, fallbackAiMemory.portraitTriggerCount),
      portraitSourceMemoryLimit: toPositiveInt(config.aiMemory && config.aiMemory.portraitSourceMemoryLimit, fallbackAiMemory.portraitSourceMemoryLimit),
      portraitMaxLength: toPositiveInt(config.aiMemory && config.aiMemory.portraitMaxLength, fallbackAiMemory.portraitMaxLength),
    },
    voiceRecognition: {
      provider: config.voiceRecognition && config.voiceRecognition.provider === 'cloud-asr' ? 'cloud-asr' : 'wechat-si',
    },
  }
}

function validateConfig(config, options = {}) {
  const strict = options.strict !== false
  const issues = []
  const pets = Array.isArray(config.pets) ? config.pets : []
  const rooms = Array.isArray(config.rooms) ? config.rooms : []
  const enabledPets = pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = rooms.filter((room) => room.enabled !== false)
  const petIds = new Set()
  const roomIds = new Set()
  const aiMemory = config.aiMemory || {}

  for (const field of ['shortTermMemoryMaxCount', 'portraitTriggerCount', 'portraitSourceMemoryLimit', 'portraitMaxLength']) {
    const value = aiMemory[field]
    if (!Number.isInteger(value) || value <= 0) {
      issues.push({ field: `aiMemory.${field}`, message: `AI 记忆参数 ${field} 必须是大于 0 的整数` })
    }
  }

  if (config.voiceRecognition && !['wechat-si', 'cloud-asr'].includes(config.voiceRecognition.provider)) {
    issues.push({ field: 'voiceRecognition.provider', message: '语音识别方案必须是微信同声传译或现有云端方案' })
  }

  if (strict && !enabledPets.length) {
    issues.push({ field: 'pets', message: '至少需要一个启用宠物' })
  }

  if (strict && !enabledRooms.length) {
    issues.push({ field: 'rooms', message: '至少需要一个启用背景' })
  }

  if (strict && !enabledPets.some((pet) => pet.id === config.defaultPetId)) {
    issues.push({ field: 'defaultPetId', message: '默认宠物必须存在且启用' })
  }

  if (strict && !enabledRooms.some((room) => room.id === config.defaultRoomId)) {
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

    if (strict && (!pet.videoUrl || !pet.thumbUrl)) {
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

    if (strict && !room.mediaUrl) {
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
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr}`
        reject(error)
        return
      }

      try {
        resolve(JSON.parse(stdout))
      } catch (parseError) {
        parseError.message = `${parseError.message}\nstdout=${String(stdout).slice(0, 500)}\nstderr=${String(stderr).slice(0, 500)}`
        reject(parseError)
      }
    })
  })
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

function normalizeCollectionName(value) {
  return String(value || '').trim()
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  if (Number.isInteger(min) && normalized < min) return min
  if (Number.isInteger(max) && normalized > max) return max
  return normalized
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
