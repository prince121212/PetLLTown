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

export interface SettingItem {
  id: string
  icon: string
  title: string
  subtitle: string
  kind: 'link' | 'switch'
  target?: PageName
  enabled?: boolean
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

export interface AdminConfigState {
  config: BootstrapConfig
  auditLogs: AdminAuditLog[]
  meta?: {
    envId?: string
    serverTime?: string
  }
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

export interface ValidationIssue {
  field: string
  message: string
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
    frameCount: number
  }
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
}
