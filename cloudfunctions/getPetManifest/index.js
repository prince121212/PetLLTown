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

async function readBootstrapPetVideoUrl(petId) {
  try {
    const result = await db.collection('app_configs').doc('bootstrap').get()
    const config = result && result.data && result.data.config ? result.data.config : result && result.data
    if (!config || !Array.isArray(config.pets)) return ''
    const pet = config.pets.find((p) => p.id === petId)
    return pet && pet.videoUrl ? pet.videoUrl : ''
  } catch {
    return ''
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const requestedPetId = normalizePetId(event.petId)
  const databaseManifest = await readDatabaseManifest(requestedPetId)
  const bundledManifest = bundledManifests[requestedPetId] || bundledManifests[DEFAULT_PET_ID]
  const manifest = databaseManifest || bundledManifest

  if (manifest && Array.isArray(manifest.actions)) {
    const idleAction = manifest.actions.find((a) => a.id === 'idle')
    if (idleAction && (!Array.isArray(idleAction.videoUrls) || idleAction.videoUrls.length === 0)) {
      const legacyUrl = await readBootstrapPetVideoUrl(requestedPetId)
      if (legacyUrl) {
        idleAction.videoUrls = [legacyUrl]
      }
    }
  }

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
