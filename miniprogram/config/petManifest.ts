export type PetActionType = 'loop' | 'transition' | 'anchor'
export type PetActionAnchor = 'awake' | 'sleep'

export interface PetAction {
  id: string
  type: PetActionType
  label: string
  fps: number
  next?: string[]
  videoUrls?: string[]
  audioUrl?: string
  enabled?: boolean
  anchorStart?: PetActionAnchor
  anchorEnd?: PetActionAnchor
  tags?: string[]
  weight?: number
}

export interface PetManifest {
  schemaVersion: number
  manifestVersion: string
  petId: string
  name: string
  defaultState: string
  actions: PetAction[]
}

export interface PetManifestFunctionResult {
  ok?: boolean
  data?: Partial<PetManifest>
  meta?: Record<string, unknown>
}

export const FALLBACK_PET_MANIFEST: PetManifest = {
  schemaVersion: 1,
  manifestVersion: 'local-fallback-2026-05-19',
  petId: 'xiaotuanzi',
  name: '小团子',
  defaultState: 'awake-idle-normal',
  actions: [
    { id: 'transition-awake-to-sleep', type: 'transition', label: '入睡过渡', fps: 15, next: ['sleep-loop'], anchorStart: 'awake', anchorEnd: 'sleep', tags: ['transition', 'awake', 'sleep'], weight: 1 },
    { id: 'transition-sleep-to-awake', type: 'transition', label: '唤醒过渡', fps: 15, next: ['awake-idle-normal'], anchorStart: 'sleep', anchorEnd: 'awake', tags: ['transition', 'sleep', 'awake'], weight: 1 },
    { id: 'sleep-loop', type: 'anchor', label: '睡眠循环', fps: 15, next: ['sleep-loop', 'sleep-ear-twitch', 'sleep-tail-twitch', 'transition-sleep-to-awake'], anchorStart: 'sleep', anchorEnd: 'sleep', tags: ['sleep', 'loop'], weight: 1 },
    { id: 'sleep-ear-twitch', type: 'anchor', label: '睡眠耳动', fps: 15, next: ['sleep-loop', 'sleep-tail-twitch'], anchorStart: 'sleep', anchorEnd: 'sleep', tags: ['sleep', 'micro'], weight: 1 },
    { id: 'sleep-tail-twitch', type: 'anchor', label: '睡眠尾动', fps: 15, next: ['sleep-loop', 'sleep-ear-twitch'], anchorStart: 'sleep', anchorEnd: 'sleep', tags: ['sleep', 'micro'], weight: 1 },
    { id: 'awake-idle-normal', type: 'anchor', label: '清醒待机', fps: 15, next: ['awake-idle-energetic', 'awake-idle-tired', 'awake-idle-sad', 'awake-look-around', 'awake-listening', 'awake-touch-petting', 'transition-awake-to-sleep'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'idle'], weight: 1 },
    { id: 'awake-idle-energetic', type: 'anchor', label: '清醒活跃待机', fps: 15, next: ['awake-idle-normal', 'awake-tail', 'awake-look-around'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'idle'], weight: 1 },
    { id: 'awake-idle-tired', type: 'anchor', label: '清醒疲惫待机', fps: 15, next: ['awake-idle-normal', 'awake-yawn', 'transition-awake-to-sleep'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'idle'], weight: 1 },
    { id: 'awake-idle-sad', type: 'anchor', label: '清醒低落待机', fps: 15, next: ['awake-idle-normal', 'awake-look-around', 'awake-reply-sad'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'idle'], weight: 1 },
    { id: 'awake-scratch', type: 'anchor', label: '挠痒', fps: 15, next: ['awake-idle-normal', 'awake-look-around'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-lick', type: 'anchor', label: '舔爪', fps: 15, next: ['awake-idle-normal', 'awake-look-around'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-yawn', type: 'anchor', label: '哈欠', fps: 15, next: ['awake-idle-tired', 'awake-idle-normal'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-tilt', type: 'anchor', label: '歪头', fps: 15, next: ['awake-idle-normal', 'awake-listening', 'awake-reply-confused'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-tail', type: 'anchor', label: '摇尾', fps: 15, next: ['awake-idle-normal', 'awake-reply-happy'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-look-around', type: 'anchor', label: '环顾', fps: 15, next: ['awake-idle-normal', 'awake-listening', 'awake-tilt'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'micro'], weight: 1 },
    { id: 'awake-listening', type: 'anchor', label: '倾听', fps: 15, next: ['awake-reply-normal', 'awake-idle-normal', 'awake-tilt'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'listen'], weight: 1 },
    { id: 'awake-reply-normal', type: 'anchor', label: '回应', fps: 15, next: ['awake-idle-normal', 'awake-listening'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'reply'], weight: 1 },
    { id: 'awake-reply-happy', type: 'anchor', label: '开心回应', fps: 15, next: ['awake-idle-energetic', 'awake-idle-normal'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'reply'], weight: 1 },
    { id: 'awake-reply-shy', type: 'anchor', label: '害羞回应', fps: 15, next: ['awake-idle-normal', 'awake-idle-sad'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'reply'], weight: 1 },
    { id: 'awake-reply-confused', type: 'anchor', label: '疑惑回应', fps: 15, next: ['awake-tilt', 'awake-idle-normal'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'reply'], weight: 1 },
    { id: 'awake-reply-sad', type: 'anchor', label: '低落回应', fps: 15, next: ['awake-idle-sad', 'awake-idle-normal'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'reply'], weight: 1 },
    { id: 'awake-touch-petting', type: 'anchor', label: '抚摸反馈', fps: 15, next: ['awake-tail', 'awake-reply-happy', 'awake-idle-normal'], anchorStart: 'awake', anchorEnd: 'awake', tags: ['awake', 'touch'], weight: 1 },
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isAnchor(value: unknown): value is PetActionAnchor {
  return value === 'awake' || value === 'sleep'
}

export function inferActionAnchors(actionId: string): { anchorStart: PetActionAnchor; anchorEnd: PetActionAnchor } {
  const id = String(actionId || '').toLowerCase()

  if (!id) {
    return { anchorStart: 'awake', anchorEnd: 'awake' }
  }

  if (id === 'sleep-enter' || id === 'transition-awake-to-sleep') {
    return { anchorStart: 'awake', anchorEnd: 'sleep' }
  }

  if (id === 'sleep-exit' || id === 'transition-sleep-to-awake') {
    return { anchorStart: 'sleep', anchorEnd: 'awake' }
  }

  if (id.startsWith('sleep-')) {
    return { anchorStart: 'sleep', anchorEnd: 'sleep' }
  }

  if (id.startsWith('transition-')) {
    if (id.includes('sleep')) {
      return id.includes('awake-to-sleep')
        ? { anchorStart: 'awake', anchorEnd: 'sleep' }
        : { anchorStart: 'sleep', anchorEnd: 'awake' }
    }
  }

  return { anchorStart: 'awake', anchorEnd: 'awake' }
}

export function normalizePetAction(action: unknown): PetAction | null {
  if (!isRecord(action)) return null
  if (typeof action.id !== 'string' || !action.id.trim()) return null
  if (typeof action.label !== 'string' || !action.label.trim()) return null
  if (typeof action.fps !== 'number' || !Number.isFinite(action.fps)) return null

  const anchors = inferActionAnchors(action.id)
  const anchorStart = isAnchor(action.anchorStart) ? action.anchorStart : anchors.anchorStart
  const anchorEnd = isAnchor(action.anchorEnd) ? action.anchorEnd : anchors.anchorEnd

  return {
    id: action.id,
    type: action.type === 'loop' || action.type === 'transition' || action.type === 'anchor' ? action.type : (anchorStart === anchorEnd ? 'anchor' : 'transition'),
    label: action.label,
    fps: action.fps,
    next: Array.isArray(action.next) ? action.next.filter((item) => typeof item === 'string') : undefined,
    videoUrls: Array.isArray(action.videoUrls) ? action.videoUrls.filter((item) => typeof item === 'string') : undefined,
    audioUrl: typeof action.audioUrl === 'string' ? action.audioUrl : undefined,
    enabled: typeof action.enabled === 'boolean' ? action.enabled : undefined,
    anchorStart,
    anchorEnd,
    tags: Array.isArray(action.tags) ? action.tags.filter((item) => typeof item === 'string') : undefined,
    weight: typeof action.weight === 'number' && Number.isFinite(action.weight) ? action.weight : undefined,
  }
}

export function normalizePetManifest(value: unknown): PetManifest {
  if (!isRecord(value)) return FALLBACK_PET_MANIFEST

  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizePetAction).filter(Boolean) as PetAction[]
    : FALLBACK_PET_MANIFEST.actions

  return {
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : FALLBACK_PET_MANIFEST.schemaVersion,
    manifestVersion: typeof value.manifestVersion === 'string' ? value.manifestVersion : FALLBACK_PET_MANIFEST.manifestVersion,
    petId: typeof value.petId === 'string' ? value.petId : FALLBACK_PET_MANIFEST.petId,
    name: typeof value.name === 'string' ? value.name : FALLBACK_PET_MANIFEST.name,
    defaultState: typeof value.defaultState === 'string' ? value.defaultState : FALLBACK_PET_MANIFEST.defaultState,
    actions: actions.length ? actions : FALLBACK_PET_MANIFEST.actions,
  }
}

export function findManifestAction(manifest: PetManifest, actionId: string): PetAction {
  return manifest.actions.find((action) => action.id === actionId) || manifest.actions[0] || FALLBACK_PET_MANIFEST.actions[0]
}
