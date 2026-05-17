import { AdminConfigState, BootstrapConfig, MediaCreateResult } from './types'

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

export function saveDraft(config: BootstrapConfig): Promise<AdminConfigState> {
  return requestJson<AdminConfigState>('/api/config/draft', {
    method: 'PUT',
    body: JSON.stringify({ config }),
  })
}

export function publishDraft(summary: string): Promise<AdminConfigState> {
  return requestJson<AdminConfigState>('/api/config/publish', {
    method: 'POST',
    body: JSON.stringify({ summary }),
  })
}

export function rollbackVersion(versionId: string): Promise<AdminConfigState> {
  return requestJson<AdminConfigState>('/api/config/rollback', {
    method: 'POST',
    body: JSON.stringify({ versionId }),
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
