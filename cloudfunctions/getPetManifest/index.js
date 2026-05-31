const cloud = require('wx-server-sdk')
const danjuanManifest = require('./manifests/danjuan.manifest.json')
const maoliziManifest = require('./manifests/maolizi.manifest.json')
const xiaotuanziManifest = require('./manifests/xiaotuanzi.manifest.json')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const PETS_COLLECTION = 'pets'
const DEFAULT_PET_ID = 'xiaotuanzi'
const bundledManifests = {
  danjuan: danjuanManifest,
  maolizi: maoliziManifest,
  xiaotuanzi: xiaotuanziManifest,
}

function hasUsableManifest(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.petId === 'string' &&
      Array.isArray(value.actions) &&
      value.actions.length,
  )
}

function normalizeManifestActions(actions) {
  if (!Array.isArray(actions)) return []

  return actions
    .map((action) => {
      if (!action || typeof action !== 'object') return null
      const id = typeof action.id === 'string' ? action.id.trim() : ''
      if (!id) return null

      const next = Array.isArray(action.next) ? action.next.filter((item) => typeof item === 'string') : []
      const videoUrls = Array.isArray(action.videoUrls) ? action.videoUrls.filter((item) => typeof item === 'string') : []
      const tags = Array.isArray(action.tags) ? action.tags.filter((item) => typeof item === 'string') : []
      const anchorStart = typeof action.anchorStart === 'string' ? action.anchorStart : (id.startsWith('sleep-') ? 'sleep' : 'awake')
      const anchorEnd = typeof action.anchorEnd === 'string'
        ? action.anchorEnd
        : (id === 'transition-awake-to-sleep' ? 'sleep' : id === 'transition-sleep-to-awake' ? 'awake' : (anchorStart === 'sleep' ? 'sleep' : 'awake'))

      return {
        ...action,
        id,
        type: action.type === 'loop' || action.type === 'transition' || action.type === 'anchor' ? action.type : (anchorStart === anchorEnd ? 'anchor' : 'transition'),
        next,
        videoUrls,
        tags,
        anchorStart,
        anchorEnd,
      }
    })
    .filter(Boolean)
}

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return manifest
  return {
    ...manifest,
    defaultState: typeof manifest.defaultState === 'string' && manifest.defaultState ? manifest.defaultState : 'awake-idle-normal',
    actions: normalizeManifestActions(manifest.actions),
  }
}

function normalizePetId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_PET_ID
  }

  return value.trim().toLowerCase()
}

async function readDatabaseManifest(petId) {
  try {
    const result = await db.collection(PETS_COLLECTION).doc(petId).get()
    const record = result && result.data

    if (!record || record.enabled === false) {
      return null
    }

    return hasUsableManifest(record.manifest) ? record.manifest : null
  } catch (error) {
    console.warn('[getPetManifest] using bundled manifest:', error && error.message ? error.message : error)
    return null
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const requestedPetId = normalizePetId(event.petId)
  const databaseManifest = await readDatabaseManifest(requestedPetId)
  const bundledManifest = bundledManifests[requestedPetId] || bundledManifests[DEFAULT_PET_ID]
  const manifest = normalizeManifest(databaseManifest || bundledManifest)

  return {
    ok: true,
    data: manifest,
    meta: {
      source: databaseManifest ? 'database' : 'bundled',
      requestedPetId,
      resolvedPetId: manifest.petId || DEFAULT_PET_ID,
      env: wxContext.ENV || '',
      appId: wxContext.APPID || '',
      openIdReady: Boolean(wxContext.OPENID),
      serverTime: new Date().toISOString(),
    },
  }
}
