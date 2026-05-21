export type PageName = 'home' | 'settings' | 'petPicker' | 'roomPicker'

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
  settings: {
    items: SettingItem[]
    miniAd: {
      enabled: boolean
      title: string
      copy: string
    }
  }
  rooms: RoomOption[]
  pets: PetOption[]
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
