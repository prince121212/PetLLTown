import {
  ActionVideoResult,
  AdminState,
  BootstrapConfig,
  DataCollectionCatalogItem,
  DataCollectionResult,
  DataPetDetailResult,
  DataUserIndexResult,
  DataUserDetailResult,
  EnvironmentState,
  ListenOrbUploadResult,
  MediaCreateResult,
  MediaInspectResult,
  PetManifestSummary,
  RoomMediaCreateResult,
} from './types'

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

export function listEnvironments(): Promise<EnvironmentState> {
  return requestJson<EnvironmentState>('/api/environments')
}

export function switchEnvironment(key: string): Promise<EnvironmentState> {
  return requestJson<EnvironmentState>('/api/environment', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
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

export function uploadListenOrbVideo(formData: FormData): Promise<ListenOrbUploadResult> {
  return requestForm<ListenOrbUploadResult>('/api/media/home/listen-orb', formData)
}

export function addActionVideo(formData: FormData): Promise<ActionVideoResult> {
  return requestForm<ActionVideoResult>('/api/media/pets/add-action-video', formData)
}

export function resolveCloudUrl(fileID: string): Promise<{ url: string }> {
  return requestJson<{ url: string }>('/api/resolve-url', {
    method: 'POST',
    body: JSON.stringify({ fileID }),
  })
}

export function getPetManifest(petId: string): Promise<PetManifestSummary> {
  return requestJson<PetManifestSummary>(`/api/media/pets/${encodeURIComponent(petId)}/manifest`)
}

export function deleteActionVideo(petId: string, actionId: string, videoUrl: string): Promise<{ petId: string; actionId: string; videoUrls: string[] }> {
  return requestJson(`/api/media/pets/${encodeURIComponent(petId)}/actions/${encodeURIComponent(actionId)}/videos`, {
    method: 'DELETE',
    body: JSON.stringify({ videoUrl }),
  })
}

export function getDataCatalog(): Promise<DataCollectionCatalogItem[]> {
  return requestJson<DataCollectionCatalogItem[]>('/api/data/catalog')
}

export function getDataCollection(collection: string, params: { limit?: number; skip?: number; openId?: string; petId?: string } = {}): Promise<DataCollectionResult> {
  const search = new URLSearchParams()
  if (typeof params.limit === 'number') search.set('limit', String(params.limit))
  if (typeof params.skip === 'number') search.set('skip', String(params.skip))
  if (params.openId) search.set('openId', params.openId)
  if (params.petId) search.set('petId', params.petId)
  return requestJson<DataCollectionResult>(`/api/data/collection/${encodeURIComponent(collection)}?${search.toString()}`)
}

export function getDataUserDetail(openId: string): Promise<DataUserDetailResult> {
  return requestJson<DataUserDetailResult>(`/api/data/user/${encodeURIComponent(openId)}`)
}

export function getDataPetDetail(petId: string): Promise<DataPetDetailResult> {
  return requestJson<DataPetDetailResult>(`/api/data/pet/${encodeURIComponent(petId)}`)
}

export function getDataUsers(params: { limit?: number; skip?: number; q?: string; petId?: string; status?: string; sort?: string } = {}): Promise<DataUserIndexResult> {
  const search = new URLSearchParams()
  if (typeof params.limit === 'number') search.set('limit', String(params.limit))
  if (typeof params.skip === 'number') search.set('skip', String(params.skip))
  if (params.q) search.set('q', params.q)
  if (params.petId) search.set('petId', params.petId)
  if (params.status) search.set('status', params.status)
  if (params.sort) search.set('sort', params.sort)
  return requestJson<DataUserIndexResult>(`/api/data/users?${search.toString()}`)
}
