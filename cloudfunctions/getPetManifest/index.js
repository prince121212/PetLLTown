const cloud = require('wx-server-sdk')
const xiaotuanziManifest = require('./manifests/xiaotuanzi.manifest.json')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const PETS_COLLECTION = 'pets'
const DEFAULT_PET_ID = 'xiaotuanzi'
const bundledManifests = {
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

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const requestedPetId = normalizePetId(event.petId)
  const databaseManifest = await readDatabaseManifest(requestedPetId)
  const bundledManifest = bundledManifests[requestedPetId] || bundledManifests[DEFAULT_PET_ID]
  const manifest = databaseManifest || bundledManifest

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
