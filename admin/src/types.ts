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
  published: BootstrapConfig
  draft: BootstrapConfig
  hasDraft: boolean
  versions: AdminConfigVersion[]
}

export interface AdminConfigVersion {
  id: string
  version: string
  summary: string
  publishedAt: string
  publishedBy: string
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
