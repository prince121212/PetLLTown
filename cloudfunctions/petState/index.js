const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const STATES_COLLECTION = 'pet_states'
const PREFS_COLLECTION = 'user_prefs'

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (error) {
    if (!error.message || !error.message.includes('already exist')) {
      // collection already exists, ignore
    }
  }
}

async function getDoc(collection, docId) {
  try {
    const result = await db.collection(collection).doc(docId).get()
    return result.data || null
  } catch (error) {
    if (error.errCode === -1 || (error.message && error.message.includes('not exist'))) {
      return null
    }
    throw error
  }
}

async function setDoc(collection, docId, data) {
  try {
    await db.collection(collection).doc(docId).set({ data })
  } catch (error) {
    if (error.message && error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      await ensureCollection(collection)
      await db.collection(collection).doc(docId).set({ data })
    } else {
      throw error
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  if (!openId) {
    return { ok: false, error: { message: '无法获取用户身份' } }
  }

  const action = event.action || 'get'

  // 读取宠物状态
  if (action === 'get') {
    const petId = event.petId
    if (!petId) {
      return { ok: false, error: { message: 'petId 不能为空' } }
    }
    const docId = `${openId}_${petId}`
    const data = await getDoc(STATES_COLLECTION, docId)
    return { ok: true, data }
  }

  // 保存宠物状态
  if (action === 'save') {
    const petId = event.petId
    const state = event.state
    if (!petId || !state || typeof state !== 'object') {
      return { ok: false, error: { message: 'petId 和 state 不能为空' } }
    }
    const docId = `${openId}_${petId}`
    await setDoc(STATES_COLLECTION, docId, {
      ...state,
      _openId: openId,
      _petId: petId,
      _savedAt: new Date().toISOString(),
    })
    return { ok: true }
  }

  // 读取用户偏好
  if (action === 'getPrefs') {
    const data = await getDoc(PREFS_COLLECTION, openId)
    return { ok: true, data }
  }

  // 保存用户偏好
  if (action === 'savePrefs') {
    const prefs = event.prefs
    if (!prefs || typeof prefs !== 'object') {
      return { ok: false, error: { message: 'prefs 不能为空' } }
    }
    await setDoc(PREFS_COLLECTION, openId, {
      ...prefs,
      _openId: openId,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }

  return { ok: false, error: { message: `未知操作: ${action}` } }
}
