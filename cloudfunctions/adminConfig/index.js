const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const CONFIG_COLLECTION = 'app_configs'
const DRAFT_COLLECTION = 'admin_config_drafts'
const VERSION_COLLECTION = 'admin_config_versions'
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
  await db.collection(collection).doc(id).set(data)
}

async function readPublishedConfig() {
  const record = await getDocument(CONFIG_COLLECTION, CONFIG_DOC_ID)
  return record && record.config ? record.config : record
}

async function readDraftConfig() {
  const record = await getDocument(DRAFT_COLLECTION, CONFIG_DOC_ID)
  return record && record.config ? record.config : null
}

async function listVersions() {
  const result = await db.collection(VERSION_COLLECTION).orderBy('publishedAt', 'desc').limit(20).get().catch(() => ({ data: [] }))

  return (result.data || []).map((record) => ({
    id: record._id || record.version,
    version: record.version || record._id,
    summary: record.summary || '',
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
  }))
}

function validateConfig(config) {
  const issues = []
  const pets = Array.isArray(config && config.pets) ? config.pets : []
  const rooms = Array.isArray(config && config.rooms) ? config.rooms : []
  const enabledPets = pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = rooms.filter((room) => room.enabled !== false)

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

function versionId() {
  return `admin-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')}`
}

exports.main = async (event = {}) => {
  const wxContext = assertAdmin()
  const action = typeof event.action === 'string' ? event.action : 'getState'

  if (action === 'getState') {
    const published = await readPublishedConfig()
    const draft = await readDraftConfig()
    const versions = await listVersions()

    return {
      ok: true,
      data: {
        published,
        draft: draft || published,
        hasDraft: Boolean(draft),
        versions,
      },
      meta: {
        openIdReady: Boolean(wxContext.OPENID),
      },
    }
  }

  if (action === 'saveDraft') {
    if (!event.config || typeof event.config !== 'object') {
      return {
        ok: false,
        error: {
          code: 'INVALID_CONFIG',
          message: '配置格式不正确',
        },
      }
    }

    await setDocument(DRAFT_COLLECTION, CONFIG_DOC_ID, {
      config: event.config,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      updatedBy: wxContext.OPENID || 'admin',
    })

    return {
      ok: true,
    }
  }

  if (action === 'publish') {
    const draft = await readDraftConfig()
    const published = await readPublishedConfig()
    const config = draft || published
    const issues = validateConfig(config)

    if (issues.length) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: issues.map((issue) => issue.message).join('；'),
          issues,
        },
      }
    }

    const version = versionId()
    const nextConfig = {
      ...config,
      configVersion: version,
    }
    const summary = typeof event.summary === 'string' && event.summary.trim() ? event.summary.trim() : '后台发布'

    await setDocument(CONFIG_COLLECTION, CONFIG_DOC_ID, {
      enabled: true,
      config: nextConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: wxContext.OPENID || 'admin',
    })
    await setDocument(VERSION_COLLECTION, version, {
      version,
      summary,
      config: nextConfig,
      publishedAt: new Date().toISOString(),
      publishedBy: wxContext.OPENID || 'admin',
    })
    await setDocument(DRAFT_COLLECTION, CONFIG_DOC_ID, {
      config: null,
      status: 'published',
      updatedAt: new Date().toISOString(),
      updatedBy: wxContext.OPENID || 'admin',
    })

    return {
      ok: true,
      data: {
        version,
      },
    }
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN_ACTION',
      message: `未知操作：${action}`,
    },
  }
}
