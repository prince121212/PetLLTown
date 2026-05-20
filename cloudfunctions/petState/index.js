const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const COLLECTION = 'pet_states'

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  if (!openId) {
    return { ok: false, error: { message: '无法获取用户身份' } }
  }

  const action = event.action || 'get'

  if (action === 'get') {
    try {
      const result = await db.collection(COLLECTION).doc(openId).get()
      return { ok: true, data: result.data || null }
    } catch (error) {
      if (error.errCode === -1 || (error.message && error.message.includes('not exist'))) {
        return { ok: true, data: null }
      }
      return { ok: false, error: { message: error.message || '读取失败' } }
    }
  }

  if (action === 'save') {
    const state = event.state

    if (!state || typeof state !== 'object') {
      return { ok: false, error: { message: '状态数据不能为空' } }
    }

    try {
      await db.collection(COLLECTION).doc(openId).set({
        data: {
          ...state,
          _openId: openId,
          _savedAt: new Date().toISOString(),
        },
      })
      return { ok: true }
    } catch (error) {
      if (error.message && error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
        await db.createCollection(COLLECTION)
        await db.collection(COLLECTION).doc(openId).set({
          data: {
            ...state,
            _openId: openId,
            _savedAt: new Date().toISOString(),
          },
        })
        return { ok: true }
      }
      return { ok: false, error: { message: error.message || '保存失败' } }
    }
  }

  return { ok: false, error: { message: `未知操作: ${action}` } }
}
