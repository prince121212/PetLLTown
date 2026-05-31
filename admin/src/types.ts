export type PageName = 'home' | 'settings' | 'petPicker' | 'roomPicker'

export interface EnvironmentItem {
  key: string
  label: string
  envId: string
  danger: boolean
  active: boolean
}

export interface EnvironmentState {
  activeKey: string
  environments: EnvironmentItem[]
}

export interface PetOption {
  id: string
  name: string
  subtitle: string
  frameOffset: number
  manifestKey?: string
  videoUrl?: string
  thumbUrl?: string
  listenFrameUrl?: string
  audioUrl?: string
  enabled?: boolean
}

export interface RoomOption {
  id: string
  name: string
  subtitle: string
  kind: 'image' | 'video'
  mediaUrl: string
  thumbUrl?: string
  enabled?: boolean
}

export interface AiMemoryConfig {
  shortTermMemoryMaxCount: number
  portraitTriggerCount: number
  portraitSourceMemoryLimit: number
  portraitMaxLength: number
}

export interface VoiceRecognitionConfig {
  provider: 'wechat-si' | 'cloud-asr'
}

export interface SettingItem {
  id: string
  icon: string
  title: string
  subtitle: string
  kind: 'link' | 'switch'
  target?: PageName
  enabled?: boolean
  visible?: boolean
}

export interface BootstrapConfig {
  schemaVersion: number
  configVersion: string
  appName: string
  defaultPetId: string
  defaultRoomId: string
  defaultPetName: string
  homeHint: string
  homeMedia: {
    backgroundVideoUrl: string
    petVideoUrl: string
    listenOrbVideoUrl: string
  }
  aiMemory: AiMemoryConfig
  voiceRecognition: VoiceRecognitionConfig
  settings: {
    items: SettingItem[]
    miniAd: {
      enabled: boolean
      title: string
      copy: string
    }
    logoutButton: {
      enabled: boolean
    }
  }
  rooms: RoomOption[]
  pets: PetOption[]
  debugWhitelist?: string[]
}

export interface ValidationIssue {
  field: string
  message: string
}

export interface VersionRecord {
  version: string
  summary: string
  rollbackOf: string
  publishedAt: string
  publishedBy: string
}

export interface AdminAuditLog {
  id: string
  action: string
  target: string
  summary: string
  actor: string
  source: string
  createdAt: string
}

export interface AdminState {
  published: BootstrapConfig
  draft: BootstrapConfig | null
  hasDraft: boolean
  hasDraftChanges: boolean
  draftIssues: ValidationIssue[]
  versions: VersionRecord[]
  auditLogs: AdminAuditLog[]
  meta?: {
    envId?: string
    serverTime?: string
  }
}

export interface MediaInspectResult {
  ok: boolean
  warnings: string[]
  source: {
    fileName: string
    width: number
    height: number
    fps: number
    duration: number
    codec: string
    hasAlphaMode: boolean
    hasAudio: boolean
    alphaYMin?: number
    alphaYMax?: number
  }
}

export interface MediaCreateResult {
  pet: PetOption
  manifest: {
    petId: string
    name: string
    manifestVersion: string
  }
  inspect: MediaInspectResult
  output: {
    videoUrl: string
    thumbUrl: string
    listenFrameUrl: string
  }
  draftIssues: ValidationIssue[]
  state: AdminState
}

export interface RoomMediaCreateResult {
  room: RoomOption
  upload: {
    mediaUrl: string
    thumbUrl: string
    key: string
    contentType: string
    size: number
  }
  inspect: {
    kind: RoomOption['kind']
    fileName: string
    width?: number
    height?: number
    duration?: number
    codec?: string
    warnings: string[]
  }
  draftIssues: ValidationIssue[]
  state: AdminState
}

export interface ListenOrbUploadResult {
  mediaUrl: string
  key: string
  contentType: string
  size: number
  inspect: {
    fileName: string
    width?: number
    height?: number
    duration?: number
    codec?: string
    warnings: string[]
  }
}

export interface ActionVideoResult {
  petId: string
  actionId: string
  videoUrl: string
  sequence: number
  totalVideos: number
  state: AdminState
}

export interface PetActionSummary {
  id: string
  label: string
  videoUrls: string[]
  audioUrl: string
}

export interface PetManifestSummary {
  petId: string
  name: string
  actions: PetActionSummary[]
}

export interface DataCollectionCatalogItem {
  collection: string
  label: string
  description: string
  category: 'config' | 'content' | 'user' | 'log'
  sortField: string
  singleDoc: boolean
  openIdField: string
  petIdField: string
}

export interface DataCollectionResult {
  collection: string
  meta: {
    label: string
    description: string
    category: 'config' | 'content' | 'user' | 'log'
    sortField: string
    singleDoc: boolean
  } | null
  total: number
  limit: number
  skip: number
  items: Array<Record<string, unknown>>
}

export interface DataUserDetailResult {
  openId: string
  user: Record<string, unknown> | null
  petStates: DataCollectionResult
  userPrefs: Record<string, unknown> | null
  userMemories: DataCollectionResult
  userProfiles: Record<string, unknown> | null
  voiceLogs: DataCollectionResult
  aiLogs: DataCollectionResult
}

export interface DataPetDetailResult {
  petId: string
  pet: Record<string, unknown> | null
  petStates: DataCollectionResult
  aiLogs: DataCollectionResult
  manifest: PetManifestSummary | null
}

export interface DataUserIndexRow {
  openId: string
  nickName: string
  status: 'active_today' | 'active_7d' | 'needs_profile' | 'needs_memory' | 'inactive' | 'normal'
  statusLabel: string
  profileCompleteness: number
  petIds: string[]
  sources: string[]
  lastSeenAt: string
  lastActiveAt: string
  lastLoginAt: string
  firstLoginAt: string
  lastMemoryAt: string
  lastProfileAt: string
  lastVoiceAt: string
  lastAiAt: string
  memoryCount: number
  profileCount: number
  petStateCount: number
  voiceLogCount: number
  aiLogCount: number
  loginCount: number
  hasProfile: boolean
  activePetId: string
  sampleMemory: string
  samplePortrait: string
}

export interface DataUserIndexResult {
  total: number
  limit: number
  skip: number
  q: string
  petId: string
  status: string
  sort: string
  stats: {
    totalUsers: number
    activeToday: number
    active7d: number
    usersWithProfile: number
    usersWithMemory: number
    usersMissingWechatProfile: number
    inactiveUsers: number
  }
  items: DataUserIndexRow[]
}
