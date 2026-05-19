export type PetActionType = 'loop' | 'transition'

export interface PetAction {
  id: string
  type: PetActionType
  label: string
  fps: number
  next: string[]
  videoUrls?: string[]
  audioUrl?: string
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
  defaultState: 'idle',
  actions: [
    { id: 'idle', type: 'loop', label: '待机', fps: 15, next: ['idle', 'listening'] },
    { id: 'listening', type: 'loop', label: '倾听', fps: 15, next: ['reply', 'idle'] },
    { id: 'reply', type: 'transition', label: '回应', fps: 15, next: ['idle'] },
    { id: 'sleep-enter', type: 'transition', label: '入睡过渡', fps: 15, next: ['sleep-loop'] },
    { id: 'sleep-loop', type: 'loop', label: '睡眠循环', fps: 15, next: ['sleep-loop', 'sleep-exit'] },
    { id: 'sleep-exit', type: 'transition', label: '唤醒过渡', fps: 15, next: ['idle'] },
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isAction(value: unknown): value is PetAction {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    (value.type === 'loop' || value.type === 'transition') &&
    typeof value.label === 'string' &&
    typeof value.fps === 'number'
  )
}

export function normalizePetManifest(value: unknown): PetManifest {
  if (!isRecord(value)) return FALLBACK_PET_MANIFEST

  const actions = Array.isArray(value.actions) ? value.actions.filter(isAction) : FALLBACK_PET_MANIFEST.actions

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
