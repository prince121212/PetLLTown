const cloud = require('wx-server-sdk')
const bundledConfig = require('./bootstrap.default.json')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const CONFIG_COLLECTION = 'app_configs'
const CONFIG_DOC_ID = 'bootstrap'

function mergeBootstrapConfig(base, override) {
  if (!override || typeof override !== 'object') {
    return base
  }

  const settings = override.settings || {}

  return {
    ...base,
    ...override,
    assets: {
      ...base.assets,
      ...(override.assets || {}),
    },
    home: {
      ...base.home,
      ...(override.home || {}),
    },
    homeMedia: {
      ...base.homeMedia,
      ...(override.homeMedia || {}),
    },
    aiMemory: {
      ...base.aiMemory,
      ...(override.aiMemory || {}),
    },
    voiceRecognition: {
      ...base.voiceRecognition,
      ...(override.voiceRecognition || {}),
    },
    settings: {
      ...base.settings,
      ...settings,
      items: Array.isArray(settings.items) && settings.items.length ? settings.items : base.settings.items,
      miniAd: {
        ...base.settings.miniAd,
        ...(settings.miniAd || {}),
      },
      logoutButton: {
        ...base.settings.logoutButton,
        ...(settings.logoutButton || {}),
      },
    },
    rooms: Array.isArray(override.rooms) && override.rooms.length ? override.rooms : base.rooms,
    pets: Array.isArray(override.pets) && override.pets.length ? override.pets : base.pets,
    debugWhitelist: Array.isArray(override.debugWhitelist) ? override.debugWhitelist : (base.debugWhitelist || []),
    membership: {
      ...base.membership,
      ...(override.membership || {}),
    },
    ads: {
      ...base.ads,
      ...(override.ads || {}),
    },
    featureFlags: {
      ...base.featureFlags,
      ...(override.featureFlags || {}),
    },
  }
}

async function readDatabaseConfig() {
  try {
    const result = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get()
    const record = result && result.data

    if (!record || record.enabled === false) {
      return null
    }

    return record.config || record
  } catch (error) {
    console.warn('[bootstrap] using bundled config:', error && error.message ? error.message : error)
    return null
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const databaseConfig = await readDatabaseConfig()
  const config = mergeBootstrapConfig(bundledConfig, databaseConfig)

  const openId = wxContext.OPENID || ''
  const whitelist = Array.isArray(config.debugWhitelist) ? config.debugWhitelist : []
  const debugEnabled = Boolean(openId) && whitelist.includes(openId)

  // 不把白名单名单下发给小程序，只返回当前用户是否有调试权限。
  const { debugWhitelist, ...publicConfig } = config

  return {
    ok: true,
    data: {
      ...publicConfig,
      serverTime: new Date().toISOString(),
    },
    meta: {
      source: databaseConfig ? 'database' : 'bundled',
      env: wxContext.ENV || '',
      appId: wxContext.APPID || '',
      openIdReady: Boolean(wxContext.OPENID),
      debugEnabled,
      clientVersion: typeof event.clientVersion === 'string' ? event.clientVersion : '',
    },
  }
}
