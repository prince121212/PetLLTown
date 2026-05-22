export interface AuthSession {
  openId: string
  unionId?: string
  appId?: string
  avatarUrl?: string
  nickName?: string
  loginAt: string
  lastCheckedAt: string
  isNewUser?: boolean
}

export interface WechatProfile {
  nickName?: string
  avatarUrl?: string
}

interface AuthLoginResult {
  ok?: boolean
  data?: {
    openId?: string
    unionId?: string
    appId?: string
    avatarUrl?: string
    nickName?: string
    loginAt?: string
    isNewUser?: boolean
  }
  error?: {
    code?: string
    message?: string
  }
}

interface AuthProfileUpdateResult {
  ok?: boolean
  data?: {
    openId?: string
    avatarUrl?: string
    nickName?: string
    profileUpdatedAt?: string
  }
  error?: {
    code?: string
    message?: string
  }
}

interface WxLoginResult {
  code?: string
  errMsg?: string
}

interface WxUserProfileResult {
  userInfo?: {
    nickName?: string
    avatarUrl?: string
  }
  errMsg?: string
}

const AUTH_STORAGE_KEY = 'petlltown.auth.session'
const AVATAR_STORAGE_KEY = 'petlltown.auth.avatarUrl'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function normalizeAuthSession(value: unknown): AuthSession | null {
  if (!isRecord(value)) return null

  const openId = typeof value.openId === 'string' ? value.openId.trim() : ''
  const loginAt = typeof value.loginAt === 'string' ? value.loginAt : ''
  const lastCheckedAt = typeof value.lastCheckedAt === 'string' ? value.lastCheckedAt : loginAt

  if (!openId || !loginAt) return null

  return {
    openId,
    unionId: typeof value.unionId === 'string' ? value.unionId : undefined,
    appId: typeof value.appId === 'string' ? value.appId : undefined,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    nickName: typeof value.nickName === 'string' ? value.nickName : undefined,
    loginAt,
    lastCheckedAt,
    isNewUser: typeof value.isNewUser === 'boolean' ? value.isNewUser : undefined,
  }
}

function normalizeProfile(profile: WechatProfile): WechatProfile {
  const avatarUrl = typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : ''
  const nickName = typeof profile.nickName === 'string' ? profile.nickName.trim() : ''

  return {
    avatarUrl: avatarUrl || undefined,
    nickName: nickName || undefined,
  }
}

function callWxLogin(): Promise<WxLoginResult> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    })
  })
}

function callWxGetUserProfile(desc: string): Promise<WxUserProfileResult> {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc,
      success: resolve,
      fail: reject,
    })
  })
}

function callCheckSession(): Promise<boolean> {
  return new Promise((resolve) => {
    wx.checkSession({
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

export function getCachedAuthSession(): AuthSession | null {
  try {
    return normalizeAuthSession(wx.getStorageSync(AUTH_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession) {
  wx.setStorageSync(AUTH_STORAGE_KEY, session)
}

export function clearAuthSession() {
  try {
    wx.removeStorageSync(AUTH_STORAGE_KEY)
  } catch {
    // ignore storage cleanup failures
  }
}

export function getCachedAvatarUrl(): string {
  try {
    const value = wx.getStorageSync(AVATAR_STORAGE_KEY)
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

export function saveCachedAvatarUrl(avatarUrl: string) {
  try {
    const text = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
    if (text) {
      wx.setStorageSync(AVATAR_STORAGE_KEY, text)
    } else {
      wx.removeStorageSync(AVATAR_STORAGE_KEY)
    }
  } catch {
    // ignore storage cleanup failures
  }
}

export function clearCachedAvatarUrl() {
  saveCachedAvatarUrl('')
}

export async function validateCachedAuthSession(): Promise<AuthSession | null> {
  const cached = getCachedAuthSession()
  if (!cached) return null

  const valid = await callCheckSession()
  if (!valid) {
    clearAuthSession()
    return null
  }

  const next = {
    ...cached,
    lastCheckedAt: new Date().toISOString(),
  }
  saveAuthSession(next)
  return next
}

export async function loginWithWechat(scene = 'settings'): Promise<AuthSession> {
  if (!wx.cloud) {
    throw new Error('云开发还没准备好')
  }

  let profile: WechatProfile = {}
  try {
    const profileResult = await callWxGetUserProfile('用于显示你的昵称')
    profile = {
      nickName: profileResult.userInfo && typeof profileResult.userInfo.nickName === 'string'
        ? profileResult.userInfo.nickName
        : undefined,
      avatarUrl: profileResult.userInfo && typeof profileResult.userInfo.avatarUrl === 'string'
        ? profileResult.userInfo.avatarUrl
        : undefined,
    }
  } catch {
    profile = {}
  }

  const loginResult = await callWxLogin()
  const code = typeof loginResult.code === 'string' ? loginResult.code.trim() : ''

  if (!code) {
    throw new Error('微信登录没有返回 code')
  }

  const response = await wx.cloud.callFunction({
    name: 'authLogin',
    data: {
      code,
      scene,
      clientLoggedAt: new Date().toISOString(),
      profile,
    },
  })

  const result = response.result as AuthLoginResult | undefined
  if (!result || result.ok !== true || !result.data || !result.data.openId) {
    throw new Error((result && result.error && result.error.message) || '登录失败，请稍后再试')
  }

  const now = new Date().toISOString()
  const session: AuthSession = {
    openId: result.data.openId,
    unionId: result.data.unionId,
    appId: result.data.appId,
    avatarUrl: result.data.avatarUrl,
    nickName: result.data.nickName,
    loginAt: result.data.loginAt || now,
    lastCheckedAt: now,
    isNewUser: result.data.isNewUser,
  }

  saveAuthSession(session)
  return session
}

export async function updateWechatProfile(profile: WechatProfile): Promise<AuthSession> {
  if (!wx.cloud) {
    throw new Error('云开发还没准备好')
  }

  const cached = getCachedAuthSession()
  if (!cached || !cached.openId) {
    throw new Error('请先登录')
  }

  const normalized = normalizeProfile(profile)
  const response = await wx.cloud.callFunction({
    name: 'authLogin',
    data: {
      action: 'updateProfile',
      profile: {
        nickName: normalized.nickName,
      },
      clientUpdatedAt: new Date().toISOString(),
    },
  })

  const result = response.result as AuthProfileUpdateResult | undefined
  if (!result || result.ok !== true || !result.data) {
    throw new Error((result && result.error && result.error.message) || '保存用户资料失败')
  }

  const session: AuthSession = {
    ...cached,
    nickName: result.data.nickName || normalized.nickName,
    lastCheckedAt: new Date().toISOString(),
  }

  saveAuthSession(session)
  return session
}

export function maskOpenId(openId: string): string {
  const text = typeof openId === 'string' ? openId.trim() : ''
  if (text.length <= 10) return text
  return `${text.slice(0, 6)}...${text.slice(-4)}`
}
