import { AdminConfigState, BootstrapConfig, MediaCreateResult, MediaInspectResult, RoomMediaCreateResult } from './types'

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `请求失败：${response.status}`)
  }

  return payload.data as T
}

export function getConfigState(): Promise<AdminConfigState> {
  return requestJson<AdminConfigState>('/api/config/state')
}

export function saveConfig(config: BootstrapConfig): Promise<AdminConfigState> {
  return requestJson<AdminConfigState>('/api/config', {
    method: 'PUT',
    body: JSON.stringify({ config }),
  })
}

export async function createPetFromWebm(formData: FormData): Promise<MediaCreateResult> {
  const response = await fetch('/api/media/pets/create-from-webm', {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `素材处理失败：${response.status}`)
  }

  return payload.data as MediaCreateResult
}

export async function inspectPetWebm(formData: FormData): Promise<MediaInspectResult> {
  const response = await fetch('/api/media/pets/inspect', {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `素材验收失败：${response.status}`)
  }

  return payload.data as MediaInspectResult
}

export async function createRoomFromMedia(formData: FormData): Promise<RoomMediaCreateResult> {
  const response = await fetch('/api/media/rooms/create-from-media', {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `背景素材处理失败：${response.status}`)
  }

  return payload.data as RoomMediaCreateResult
}
