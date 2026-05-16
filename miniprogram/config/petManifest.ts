export type PetActionType = 'loop' | 'transition'

export interface PetAction {
  id: string
  type: PetActionType
  label: string
  fps: number
  frameCount: number
  framePattern: string
  startIndex: number
  endIndex: number
  connectAt: number[]
  next: string[]
}

export interface PetManifest {
  schemaVersion: number
  manifestVersion: string
  petId: string
  name: string
  defaultState: string
  assets: {
    baseUrl: string
    audioBaseUrl: string
  }
  actions: PetAction[]
}

export interface PetManifestFunctionResult {
  ok?: boolean
  data?: Partial<PetManifest>
  meta?: Record<string, unknown>
}

export const FALLBACK_PET_MANIFEST: PetManifest = {
  schemaVersion: 1,
  manifestVersion: 'local-fallback-2026-05-15',
  petId: 'xiaotuanzi',
  name: '小团子',
  defaultState: 'idle',
  assets: {
    baseUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/',
    audioBaseUrl: '',
  },
  actions: [
    {
      id: 'idle',
      type: 'loop',
      label: '待机',
      fps: 15,
      frameCount: 150,
      framePattern: 'frame_{index:0000}.png',
      startIndex: 1,
      endIndex: 150,
      connectAt: [1, 30, 60, 90, 120, 150],
      next: ['idle', 'listen'],
    },
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
    typeof value.fps === 'number' &&
    typeof value.frameCount === 'number' &&
    typeof value.framePattern === 'string' &&
    typeof value.startIndex === 'number' &&
    typeof value.endIndex === 'number'
  )
}

export function normalizePetManifest(value: unknown): PetManifest {
  if (!isRecord(value)) return FALLBACK_PET_MANIFEST

  const assets = isRecord(value.assets) ? value.assets : {}
  const actions = Array.isArray(value.actions) ? value.actions.filter(isAction) : FALLBACK_PET_MANIFEST.actions

  return {
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : FALLBACK_PET_MANIFEST.schemaVersion,
    manifestVersion: typeof value.manifestVersion === 'string' ? value.manifestVersion : FALLBACK_PET_MANIFEST.manifestVersion,
    petId: typeof value.petId === 'string' ? value.petId : FALLBACK_PET_MANIFEST.petId,
    name: typeof value.name === 'string' ? value.name : FALLBACK_PET_MANIFEST.name,
    defaultState: typeof value.defaultState === 'string' ? value.defaultState : FALLBACK_PET_MANIFEST.defaultState,
    assets: {
      baseUrl: typeof assets.baseUrl === 'string' ? assets.baseUrl : FALLBACK_PET_MANIFEST.assets.baseUrl,
      audioBaseUrl: typeof assets.audioBaseUrl === 'string' ? assets.audioBaseUrl : FALLBACK_PET_MANIFEST.assets.audioBaseUrl,
    },
    actions: actions.length ? actions : FALLBACK_PET_MANIFEST.actions,
  }
}

export function findManifestAction(manifest: PetManifest, actionId: string): PetAction {
  return manifest.actions.find((action) => action.id === actionId) || manifest.actions[0] || FALLBACK_PET_MANIFEST.actions[0]
}
