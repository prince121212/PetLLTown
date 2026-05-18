const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const CONFIG_COLLECTION = 'app_configs'
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

function isMissingCollectionError(error) {
  const message = error && error.message ? error.message : String(error)
  return message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Db or Table not exist')
}

async function readPublishedConfig() {
  const record = await getDocument(CONFIG_COLLECTION, CONFIG_DOC_ID)
  return record && record.enabled !== false ? record.config || record : null
}

async function listAuditLogs() {
  const result = await db.collection(AUDIT_COLLECTION).orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ data: [] }))

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
  const id = `${versionId()}-${action}-${Math.random().toString(36).slice(2, 8)}`

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

function validateConfig(config) {
  const issues = []
  const pets = Array.isArray(config && config.pets) ? config.pets : []
  const rooms = Array.isArray(config && config.rooms) ? config.rooms : []
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

function versionId() {
  return `admin-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')}`
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    const error = new Error('配置格式不正确')
    error.code = 'INVALID_CONFIG'
    throw error
  }

  return config
}

async function getEditableConfig() {
  const config = await readPublishedConfig()

  if (!config || typeof config !== 'object') {
    const error = new Error('没有可编辑的启动配置')
    error.code = 'CONFIG_NOT_FOUND'
    throw error
  }

  return config
}

function prepareConfigForSave(config) {
  const homeHint = config.homeHint || (config.home && config.home.hint) || ''
  const pets = Array.isArray(config.pets) ? config.pets : []
  const defaultPet = pets.find((pet) => pet.id === config.defaultPetId)

  return {
    ...config,
    configVersion: versionId(),
    defaultPetName: defaultPet && defaultPet.name ? defaultPet.name : config.defaultPetName || '',
    homeHint,
    home: {
      ...(config.home || {}),
      hint: homeHint,
    },
  }
}

async function saveConfig(config, wxContext, summary) {
  const nextConfig = prepareConfigForSave(config)
  const issues = validateConfig(nextConfig)

  if (issues.length) {
    const error = new Error(issues.map((issue) => issue.message).join('；'))
    error.code = 'VALIDATION_FAILED'
    error.issues = issues
    throw error
  }

  await setDocument(CONFIG_COLLECTION, CONFIG_DOC_ID, {
    enabled: true,
    config: nextConfig,
    updatedAt: new Date().toISOString(),
    updatedBy: wxContext.OPENID || 'admin',
  })
  await writeAuditLog({
    wxContext,
    action: 'saveConfig',
    target: CONFIG_DOC_ID,
    summary,
  })

  return nextConfig
}

function upsertById(items, item) {
  const index = items.findIndex((value) => value.id === item.id)

  if (index === -1) {
    return [...items, item]
  }

  return items.map((value, valueIndex) => (valueIndex === index ? item : value))
}

async function getState(wxContext) {
  const config = await readPublishedConfig()
  const auditLogs = await listAuditLogs()

  return {
    ok: true,
    data: {
      config,
      auditLogs,
      meta: {
        openIdReady: Boolean(wxContext.OPENID),
      },
    },
  }
}

exports.main = async (event = {}) => {
  const wxContext = assertAdmin()
  const action = typeof event.action === 'string' ? event.action : 'getState'

  if (action === 'getState') {
    return getState(wxContext)
  }

  if (action === 'getConfig') {
    return {
      ok: true,
      data: await readPublishedConfig(),
    }
  }

  if (action === 'saveConfig') {
    const config = normalizeConfig(event.config)

    await saveConfig(config, wxContext, '保存启动配置')

    return {
      ok: true,
      data: await getState(wxContext).then((result) => result.data),
    }
  }

  if (action === 'listPets') {
    const config = await getEditableConfig()

    return {
      ok: true,
      data: config.pets || [],
    }
  }

  if (action === 'upsertPet') {
    if (!event.pet || typeof event.pet !== 'object' || !event.pet.id) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PET',
          message: '宠物数据格式不正确',
        },
      }
    }

    const config = normalizeConfig(await getEditableConfig())
    config.pets = upsertById(Array.isArray(config.pets) ? config.pets : [], event.pet)

    if (!config.defaultPetId || !config.pets.some((pet) => pet.id === config.defaultPetId && pet.enabled !== false)) {
      config.defaultPetId = event.pet.id
      config.defaultPetName = event.pet.name || config.defaultPetName
    }

    await saveConfig(config, wxContext, `保存宠物 ${event.pet.id}`)

    return getState(wxContext)
  }

  if (action === 'disablePet') {
    const petId = String(event.petId || '')
    const config = normalizeConfig(await getEditableConfig())
    config.pets = (config.pets || []).map((pet) => (pet.id === petId ? { ...pet, enabled: false } : pet))

    if (config.defaultPetId === petId) {
      const fallback = config.pets.find((pet) => pet.enabled !== false)

      if (fallback) {
        config.defaultPetId = fallback.id
        config.defaultPetName = fallback.name || config.defaultPetName
        config.homeMedia = {
          ...(config.homeMedia || {}),
          petVideoUrl: fallback.videoUrl || (config.homeMedia && config.homeMedia.petVideoUrl) || '',
        }
      }
    }

    await saveConfig(config, wxContext, `隐藏宠物 ${petId}`)

    return getState(wxContext)
  }

  if (action === 'listRooms') {
    const config = await getEditableConfig()

    return {
      ok: true,
      data: config.rooms || [],
    }
  }

  if (action === 'upsertRoom') {
    if (!event.room || typeof event.room !== 'object' || !event.room.id) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ROOM',
          message: '背景数据格式不正确',
        },
      }
    }

    const config = normalizeConfig(await getEditableConfig())
    config.rooms = upsertById(Array.isArray(config.rooms) ? config.rooms : [], event.room)

    if (!config.defaultRoomId || !config.rooms.some((room) => room.id === config.defaultRoomId && room.enabled !== false)) {
      config.defaultRoomId = event.room.id
    }

    await saveConfig(config, wxContext, `保存背景 ${event.room.id}`)

    return getState(wxContext)
  }

  if (action === 'disableRoom') {
    const roomId = String(event.roomId || '')
    const config = normalizeConfig(await getEditableConfig())
    config.rooms = (config.rooms || []).map((room) => (room.id === roomId ? { ...room, enabled: false } : room))

    if (config.defaultRoomId === roomId) {
      const fallback = config.rooms.find((room) => room.enabled !== false)

      if (fallback) {
        config.defaultRoomId = fallback.id
        config.homeMedia = {
          ...(config.homeMedia || {}),
          backgroundVideoUrl: fallback.mediaUrl || (config.homeMedia && config.homeMedia.backgroundVideoUrl) || '',
        }
      }
    }

    await saveConfig(config, wxContext, `隐藏背景 ${roomId}`)

    return getState(wxContext)
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN_ACTION',
      message: `未知操作：${action}`,
    },
  }
}
