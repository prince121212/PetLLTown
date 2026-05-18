const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const CONFIG_COLLECTION = 'app_configs'
const DRAFT_COLLECTION = 'admin_config_drafts'
const VERSION_COLLECTION = 'admin_config_versions'
const AUDIT_COLLECTION = 'admin_audit_logs'
const CONFIG_DOC_ID = 'bootstrap'

function adminOpenIds() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function assertAdmin() {
  const wxContext = cloud.getWXContext()
  const allowed = adminOpenIds()

  if (!allowed.length) {
    return wxContext
  }

  if (!allowed.includes(wxContext.OPENID)) {
    const error = new Error('没有后台管理权限')
    error.code = 'ADMIN_FORBIDDEN'
    throw error
  }

  return wxContext
}

async function getDocument(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get()
    return result && result.data ? result.data : null
  } catch (error) {
    return null
  }
}

async function setDocument(collection, id, data) {
  try {
    await db.collection(collection).doc(id).set({
      data,
    })
  } catch (error) {
    if (!isMissingCollectionError(error)) {
      throw error
    }

    await db.createCollection(collection).catch(() => undefined)
    await db.collection(collection).doc(id).set({
      data,
    })
  }
}

async function removeDocument(collection, id) {
  try {
    await db.collection(collection).doc(id).remove()
  } catch (error) {
    if (isMissingCollectionError(error) || isMissingDocumentError(error)) {
      return
    }
    throw error
  }
}

function isMissingCollectionError(error) {
  const message = error && error.message ? error.message : String(error)
  return message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Db or Table not exist')
}

function isMissingDocumentError(error) {
  const message = error && error.message ? error.message : String(error)
  return message.includes('DOCUMENT_NOT_FOUND') || message.includes('NotFound') || message.includes('not exist')
}

async function readPublishedConfig() {
  const record = await getDocument(CONFIG_COLLECTION, CONFIG_DOC_ID)
  if (!record || record.enabled === false) return null
  return record.config || record
}

async function readDraftConfig() {
  const record = await getDocument(DRAFT_COLLECTION, CONFIG_DOC_ID)
  if (!record || !record.config) return null
  return record.config
}

async function writeDraftConfig(config, wxContext) {
  await setDocument(DRAFT_COLLECTION, CONFIG_DOC_ID, {
    enabled: true,
    config,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    updatedBy: wxContext.OPENID || 'admin',
  })
}

async function deleteDraftConfig() {
  await removeDocument(DRAFT_COLLECTION, CONFIG_DOC_ID)
}

async function writePublishedConfig(config, wxContext) {
  await setDocument(CONFIG_COLLECTION, CONFIG_DOC_ID, {
    enabled: true,
    config,
    updatedAt: new Date().toISOString(),
    updatedBy: wxContext.OPENID || 'admin',
  })
}

async function writeVersionRecord({ version, config, summary, rollbackOf, wxContext }) {
  await setDocument(VERSION_COLLECTION, version, {
    version,
    config,
    summary: summary || '',
    rollbackOf: rollbackOf || '',
    publishedAt: new Date().toISOString(),
    publishedBy: wxContext.OPENID || 'admin',
  })
}

async function listVersions() {
  const result = await db
    .collection(VERSION_COLLECTION)
    .orderBy('publishedAt', 'desc')
    .limit(20)
    .get()
    .catch(() => ({ data: [] }))
  const records = Array.isArray(result.data) ? result.data : []

  return records.map((record) => ({
    version: record.version || record._id || '',
    summary: record.summary || '',
    rollbackOf: record.rollbackOf || '',
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
  }))
}

async function listAuditLogs() {
  const result = await db
    .collection(AUDIT_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get()
    .catch(() => ({ data: [] }))

  return (result.data || []).map((record) => ({
    id: record._id || record.id || `${record.action}-${record.createdAt}`,
    action: record.action || '',
    target: record.target || '',
    summary: record.summary || '',
    actor: record.actor || '',
    source: record.source || '',
    createdAt: record.createdAt || '',
  }))
}

async function writeAuditLog({ wxContext, action, target, summary }) {
  const createdAt = new Date().toISOString()
  const id = `${formatTimestamp(new Date())}-${action}-${Math.random().toString(36).slice(2, 8)}`

  await setDocument(AUDIT_COLLECTION, id, {
    action,
    target,
    summary,
    actor: wxContext.OPENID || 'admin',
    source: wxContext.SOURCE || 'cloudfunction',
    createdAt,
  }).catch((error) => {
    console.warn('[adminConfig] audit log failed:', error && error.message ? error.message : error)
  })
}

function validateConfig(config, options) {
  const strict = options && options.strict !== false
  const issues = []
  const pets = Array.isArray(config && config.pets) ? config.pets : []
  const rooms = Array.isArray(config && config.rooms) ? config.rooms : []
  const enabledPets = pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = rooms.filter((room) => room.enabled !== false)
  const petIds = new Set()
  const roomIds = new Set()

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

function buildVersionId() {
  return `v-${formatTimestamp(new Date())}`
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')
}

function stampConfigVersion(config, version) {
  const next = JSON.parse(JSON.stringify(config))
  next.configVersion = version
  return next
}

function normalizeForPersist(config) {
  if (!config || typeof config !== 'object') return config
  const homeHint = config.homeHint || (config.home && config.home.hint) || ''
  const pets = Array.isArray(config.pets) ? config.pets : []
  const defaultPet = pets.find((pet) => pet.id === config.defaultPetId)

  return {
    ...config,
    defaultPetName: (defaultPet && defaultPet.name) || config.defaultPetName || '',
    homeHint,
    home: {
      ...(config.home || {}),
      hint: homeHint,
    },
  }
}

function hasConfigChanges(published, draft) {
  if (!draft) return false
  if (!published) return true
  return JSON.stringify(stripVolatile(published)) !== JSON.stringify(stripVolatile(draft))
}

function stripVolatile(config) {
  if (!config || typeof config !== 'object') return config
  const clone = JSON.parse(JSON.stringify(config))
  delete clone.configVersion
  delete clone.serverTime
  return clone
}

function summarizeConfig(config) {
  const pets = Array.isArray(config && config.pets) ? config.pets : []
  const rooms = Array.isArray(config && config.rooms) ? config.rooms : []
  const enabledPets = pets.filter((pet) => pet.enabled !== false).length
  const enabledRooms = rooms.filter((room) => room.enabled !== false).length
  return `${enabledPets} 个启用宠物，${enabledRooms} 个启用背景`
}

function normalizeConfigInput(config) {
  if (!config || typeof config !== 'object') {
    const error = new Error('配置格式不正确')
    error.code = 'INVALID_CONFIG'
    throw error
  }
  return config
}

async function getState() {
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
  }
}

async function handleSaveDraft({ config, wxContext }) {
  const normalized = normalizeForPersist(normalizeConfigInput(config))
  const issues = validateConfig(normalized, { strict: false })

  if (issues.length) {
    const error = new Error(issues.map((issue) => issue.message).join('；'))
    error.code = 'VALIDATION_FAILED'
    error.issues = issues
    throw error
  }

  await writeDraftConfig(normalized, wxContext)
  await writeAuditLog({
    wxContext,
    action: 'saveDraft',
    target: CONFIG_DOC_ID,
    summary: `保存草稿：${summarizeConfig(normalized)}`,
  })
}

async function handleDiscardDraft({ wxContext }) {
  await deleteDraftConfig()
  await writeAuditLog({
    wxContext,
    action: 'discardDraft',
    target: CONFIG_DOC_ID,
    summary: '丢弃草稿，恢复到当前线上',
  })
}

async function handlePublish({ summary, wxContext }) {
  const draft = await readDraftConfig()

  if (!draft) {
    const error = new Error('当前没有可发布的草稿')
    error.code = 'NO_DRAFT'
    throw error
  }

  const issues = validateConfig(draft, { strict: true })
  if (issues.length) {
    const error = new Error(issues.map((issue) => issue.message).join('；'))
    error.code = 'VALIDATION_FAILED'
    error.issues = issues
    throw error
  }

  const version = buildVersionId()
  const finalConfig = stampConfigVersion(normalizeForPersist(draft), version)

  await writePublishedConfig(finalConfig, wxContext)
  await writeVersionRecord({ version, config: finalConfig, summary, wxContext })
  await deleteDraftConfig()
  await writeAuditLog({
    wxContext,
    action: 'publishConfig',
    target: version,
    summary: summary || `发布配置 ${version}`,
  })
}

async function handleRollback({ versionId, wxContext }) {
  if (!versionId) {
    const error = new Error('缺少 versionId')
    error.code = 'INVALID_VERSION'
    throw error
  }

  const record = await getDocument(VERSION_COLLECTION, versionId)
  if (!record || !record.config) {
    const error = new Error(`版本 ${versionId} 不存在`)
    error.code = 'VERSION_NOT_FOUND'
    throw error
  }

  const newVersion = buildVersionId()
  const finalConfig = stampConfigVersion(record.config, newVersion)

  await writePublishedConfig(finalConfig, wxContext)
  await writeVersionRecord({
    version: newVersion,
    config: finalConfig,
    summary: `回滚到 ${versionId}`,
    rollbackOf: versionId,
    wxContext,
  })
  await deleteDraftConfig()
  await writeAuditLog({
    wxContext,
    action: 'rollbackConfig',
    target: newVersion,
    summary: `回滚到 ${versionId}`,
  })
}

exports.main = async (event = {}) => {
  try {
    const wxContext = assertAdmin()
    const action = typeof event.action === 'string' ? event.action : 'getState'

    if (action === 'getState') {
      return { ok: true, data: await getState() }
    }

    if (action === 'saveDraft') {
      await handleSaveDraft({ config: event.config, wxContext })
      return { ok: true, data: await getState() }
    }

    if (action === 'discardDraft') {
      await handleDiscardDraft({ wxContext })
      return { ok: true, data: await getState() }
    }

    if (action === 'publish') {
      await handlePublish({ summary: typeof event.summary === 'string' ? event.summary : '', wxContext })
      return { ok: true, data: await getState() }
    }

    if (action === 'rollback') {
      await handleRollback({ versionId: typeof event.versionId === 'string' ? event.versionId : '', wxContext })
      return { ok: true, data: await getState() }
    }

    if (action === 'listVersions') {
      return { ok: true, data: await listVersions() }
    }

    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ACTION',
        message: `未知操作：${action}`,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error && error.code ? error.code : 'INTERNAL_ERROR',
        message: error && error.message ? error.message : String(error),
        issues: error && error.issues ? error.issues : undefined,
      },
    }
  }
}
