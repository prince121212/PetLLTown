import { AdminState, BootstrapConfig, MediaCreateResult, MediaInspectResult, RoomMediaCreateResult } from './types'

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

async function requestForm<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `请求失败：${response.status}`)
  }

  return payload.data as T
}

export function getAdminState(): Promise<AdminState> {
  return requestJson<AdminState>('/api/state')
}

export function saveDraft(config: BootstrapConfig): Promise<AdminState> {
  return requestJson<AdminState>('/api/draft', {
    method: 'PUT',
    body: JSON.stringify({ config }),
  })
}

export function discardDraft(): Promise<AdminState> {
  return requestJson<AdminState>('/api/draft', {
    method: 'DELETE',
  })
}

export function publishConfig(summary: string): Promise<AdminState> {
  return requestJson<AdminState>('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ summary }),
  })
}

export function rollbackToVersion(versionId: string): Promise<AdminState> {
  return requestJson<AdminState>('/api/rollback', {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  })
}

export function inspectPetWebm(formData: FormData): Promise<MediaInspectResult> {
  return requestForm<MediaInspectResult>('/api/media/pets/inspect', formData)
}

export function createPetFromWebm(formData: FormData): Promise<MediaCreateResult> {
  return requestForm<MediaCreateResult>('/api/media/pets/create-from-webm', formData)
}

export function createRoomFromMedia(formData: FormData): Promise<RoomMediaCreateResult> {
  return requestForm<RoomMediaCreateResult>('/api/media/rooms/create-from-media', formData)
}

export function resolveCloudUrl(fileID: string): Promise<{ url: string }> {
  return requestJson<{ url: string }>('/api/resolve-url', {
    method: 'POST',
    body: JSON.stringify({ fileID }),
  })
}
