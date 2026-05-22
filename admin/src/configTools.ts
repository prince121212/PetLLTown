import { AiMemoryConfig, BootstrapConfig, PetOption, RoomOption, ValidationIssue, VoiceRecognitionConfig } from './types'

export function cloneConfig(config: BootstrapConfig): BootstrapConfig {
  return JSON.parse(JSON.stringify(config)) as BootstrapConfig
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : fallback
}

export function normalizeBootstrapConfig(value: BootstrapConfig): BootstrapConfig {
  const fallbackHomeMedia = {
    backgroundVideoUrl: '',
    petVideoUrl: '',
    listenOrbVideoUrl: '',
  }
  const fallbackSettings = {
    items: [],
    miniAd: {
      enabled: false,
      title: '',
      copy: '',
    },
    logoutButton: {
      enabled: true,
    },
  }
  const fallbackAiMemory: AiMemoryConfig = {
    shortTermMemoryMaxCount: 8,
    portraitTriggerCount: 3,
    portraitSourceMemoryLimit: 15,
    portraitMaxLength: 200,
  }
  const fallbackVoiceRecognition: VoiceRecognitionConfig = {
    provider: 'wechat-si',
  }

  return {
    ...value,
    homeMedia: {
      ...fallbackHomeMedia,
      ...(value.homeMedia || {}),
    },
    aiMemory: {
      shortTermMemoryMaxCount: toPositiveInt(value.aiMemory?.shortTermMemoryMaxCount, fallbackAiMemory.shortTermMemoryMaxCount),
      portraitTriggerCount: toPositiveInt(value.aiMemory?.portraitTriggerCount, fallbackAiMemory.portraitTriggerCount),
      portraitSourceMemoryLimit: toPositiveInt(value.aiMemory?.portraitSourceMemoryLimit, fallbackAiMemory.portraitSourceMemoryLimit),
      portraitMaxLength: toPositiveInt(value.aiMemory?.portraitMaxLength, fallbackAiMemory.portraitMaxLength),
    },
    voiceRecognition: {
      provider: value.voiceRecognition?.provider === 'cloud-asr' ? 'cloud-asr' : fallbackVoiceRecognition.provider,
    },
    settings: {
      ...fallbackSettings,
      ...(value.settings || {}),
      miniAd: {
        ...fallbackSettings.miniAd,
        ...(value.settings?.miniAd || {}),
      },
      logoutButton: {
        ...fallbackSettings.logoutButton,
        ...(value.settings?.logoutButton || {}),
      },
      items: Array.isArray(value.settings?.items) ? value.settings.items : [],
    },
    rooms: Array.isArray(value.rooms) ? value.rooms : [],
    pets: Array.isArray(value.pets) ? value.pets : [],
  }
}

export interface ValidateOptions {
  strict?: boolean
}

export function validateConfig(config: BootstrapConfig, options: ValidateOptions = {}): ValidationIssue[] {
  const strict = options.strict !== false
  const issues: ValidationIssue[] = []
  const enabledPets = config.pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = config.rooms.filter((room) => room.enabled !== false)
  const petIds = new Set<string>()
  const roomIds = new Set<string>()

  if (!config.appName.trim()) {
    issues.push({ field: 'appName', message: '应用名称不能为空' })
  }

  const aiMemory =
    config.aiMemory ||
    ({
      shortTermMemoryMaxCount: 8,
      portraitTriggerCount: 3,
      portraitSourceMemoryLimit: 15,
      portraitMaxLength: 200,
    } as AiMemoryConfig)
  for (const [field, value] of [
    ['shortTermMemoryMaxCount', aiMemory.shortTermMemoryMaxCount],
    ['portraitTriggerCount', aiMemory.portraitTriggerCount],
    ['portraitSourceMemoryLimit', aiMemory.portraitSourceMemoryLimit],
    ['portraitMaxLength', aiMemory.portraitMaxLength],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      issues.push({ field: `aiMemory.${field}`, message: `AI 记忆参数「${field}」必须是大于 0 的整数` })
    }
  }

  for (const pet of config.pets) {
    const petId = (pet.id || '').trim()

    if (!petId) {
      issues.push({ field: 'pets.id', message: '宠物 ID 不能为空' })
      continue
    }

    if (petIds.has(petId)) {
      issues.push({ field: `pets.${petId}`, message: `宠物 ID 重复：${petId}` })
    }
    petIds.add(petId)

    if (!(pet.name || '').trim()) {
      issues.push({ field: `pets.${petId}.name`, message: `宠物 ${petId} 缺少展示名` })
    }

    if (pet.enabled !== false && !pet.videoUrl) {
      issues.push({ field: `pets.${pet.id}.videoUrl`, message: `${pet.name} 缺少透明视频` })
    }

    if (pet.enabled !== false && !pet.thumbUrl) {
      issues.push({ field: `pets.${pet.id}.thumbUrl`, message: `${pet.name} 缺少预览图` })
    }

    for (const [field, value] of [
      ['videoUrl', pet.videoUrl],
      ['thumbUrl', pet.thumbUrl],
      ['listenFrameUrl', pet.listenFrameUrl],
    ] as const) {
      if (value && !isAllowedAssetUrl(value)) {
        issues.push({ field: `pets.${pet.id}.${field}`, message: `${pet.name || pet.id} 的 ${field} 地址不在允许范围内` })
      }
    }
  }

  for (const room of config.rooms) {
    const roomId = (room.id || '').trim()

    if (!roomId) {
      issues.push({ field: 'rooms.id', message: '背景 ID 不能为空' })
      continue
    }

    if (roomIds.has(roomId)) {
      issues.push({ field: `rooms.${roomId}`, message: `背景 ID 重复：${roomId}` })
    }
    roomIds.add(roomId)

    if (!(room.name || '').trim()) {
      issues.push({ field: `rooms.${roomId}.name`, message: `背景 ${roomId} 缺少展示名` })
    }

    if (room.enabled !== false && !room.mediaUrl) {
      issues.push({ field: `rooms.${room.id}.mediaUrl`, message: `${room.name} 缺少媒体地址` })
    }

    for (const [field, value] of [
      ['mediaUrl', room.mediaUrl],
      ['thumbUrl', room.thumbUrl],
    ] as const) {
      if (value && !isAllowedAssetUrl(value)) {
        issues.push({ field: `rooms.${room.id}.${field}`, message: `${room.name || room.id} 的 ${field} 地址不在允许范围内` })
      }
    }
  }

  if (strict && !enabledPets.length) {
    issues.push({ field: 'pets', message: '至少需要一个启用宠物' })
  }

  if (strict && !enabledRooms.length) {
    issues.push({ field: 'rooms', message: '至少需要一个启用背景' })
  }

  if (strict && !enabledPets.some((pet) => pet.id === config.defaultPetId)) {
    issues.push({ field: 'defaultPetId', message: '默认宠物必须存在且启用' })
  }

  if (strict && !enabledRooms.some((room) => room.id === config.defaultRoomId)) {
    issues.push({ field: 'defaultRoomId', message: '默认背景必须存在且启用' })
  }

  return issues
}

export function upsertPet(config: BootstrapConfig, pet: PetOption): BootstrapConfig {
  const next = cloneConfig(config)
  const index = next.pets.findIndex((item) => item.id === pet.id)

  if (index === -1) {
    next.pets.push(pet)
  } else {
    next.pets[index] = pet
  }

  if (!next.defaultPetId || !next.pets.some((item) => item.id === next.defaultPetId && item.enabled !== false)) {
    next.defaultPetId = pet.id
    next.defaultPetName = pet.name
  }

  return next
}

export function setDefaultPet(config: BootstrapConfig, petId: string): BootstrapConfig {
  const next = cloneConfig(config)
  const pet = next.pets.find((item) => item.id === petId)

  if (pet) {
    next.defaultPetId = pet.id
    next.defaultPetName = pet.name
    next.homeMedia.petVideoUrl = pet.videoUrl || next.homeMedia.petVideoUrl
  }

  return next
}

export function setDefaultRoom(config: BootstrapConfig, roomId: string): BootstrapConfig {
  const next = cloneConfig(config)
  const room = next.rooms.find((item) => item.id === roomId)

  if (room) {
    next.defaultRoomId = room.id
    next.homeMedia.backgroundVideoUrl = room.mediaUrl || next.homeMedia.backgroundVideoUrl
  }

  return next
}

export function upsertRoom(config: BootstrapConfig, room: RoomOption): BootstrapConfig {
  const next = cloneConfig(config)
  const index = next.rooms.findIndex((item) => item.id === room.id)

  if (index === -1) {
    next.rooms.push(room)
  } else {
    next.rooms[index] = room
  }

  if (!next.defaultRoomId || !next.rooms.some((item) => item.id === next.defaultRoomId && item.enabled !== false)) {
    next.defaultRoomId = room.id
  }

  return next
}

export function togglePetEnabled(config: BootstrapConfig, petId: string): BootstrapConfig {
  const next = cloneConfig(config)
  next.pets = next.pets.map((item) => (item.id === petId ? { ...item, enabled: item.enabled === false } : item))
  const defaultPet = next.pets.find((item) => item.id === next.defaultPetId)

  if (!defaultPet || defaultPet.enabled === false) {
    const fallback = next.pets.find((item) => item.enabled !== false)

    if (fallback) {
      next.defaultPetId = fallback.id
      next.defaultPetName = fallback.name
      next.homeMedia.petVideoUrl = fallback.videoUrl || next.homeMedia.petVideoUrl
    }
  }

  return next
}

export function toggleRoomEnabled(config: BootstrapConfig, roomId: string): BootstrapConfig {
  const next = cloneConfig(config)
  next.rooms = next.rooms.map((item) => (item.id === roomId ? { ...item, enabled: item.enabled === false } : item))
  const defaultRoom = next.rooms.find((item) => item.id === next.defaultRoomId)

  if (!defaultRoom || defaultRoom.enabled === false) {
    const fallback = next.rooms.find((item) => item.enabled !== false)

    if (fallback) {
      next.defaultRoomId = fallback.id
      next.homeMedia.backgroundVideoUrl = fallback.mediaUrl || next.homeMedia.backgroundVideoUrl
    }
  }

  return next
}

export function removePet(config: BootstrapConfig, petId: string): BootstrapConfig {
  const next = cloneConfig(config)
  next.pets = next.pets.filter((item) => item.id !== petId)

  if (next.defaultPetId === petId) {
    const fallback = next.pets.find((item) => item.enabled !== false) || next.pets[0]
    if (fallback) {
      next.defaultPetId = fallback.id
      next.defaultPetName = fallback.name
      next.homeMedia.petVideoUrl = fallback.videoUrl || next.homeMedia.petVideoUrl
    } else {
      next.defaultPetId = ''
      next.defaultPetName = ''
    }
  }

  return next
}

export function removeRoom(config: BootstrapConfig, roomId: string): BootstrapConfig {
  const next = cloneConfig(config)
  next.rooms = next.rooms.filter((item) => item.id !== roomId)

  if (next.defaultRoomId === roomId) {
    const fallback = next.rooms.find((item) => item.enabled !== false) || next.rooms[0]
    if (fallback) {
      next.defaultRoomId = fallback.id
      next.homeMedia.backgroundVideoUrl = fallback.mediaUrl || next.homeMedia.backgroundVideoUrl
    } else {
      next.defaultRoomId = ''
    }
  }

  return next
}

export interface ConfigDiffEntry {
  path: string
  before: unknown
  after: unknown
}

export function diffConfigs(before: BootstrapConfig | null, after: BootstrapConfig | null): ConfigDiffEntry[] {
  if (!before && !after) return []
  const entries: ConfigDiffEntry[] = []
  walkDiff('', before as unknown, after as unknown, entries)
  return entries
}

function walkDiff(path: string, before: unknown, after: unknown, entries: ConfigDiffEntry[]) {
  if (Object.is(before, after)) return

  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    entries.push({ path: path || '(root)', before, after })
    return
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      walkDiff(`${path}[${index}]`, before[index], after[index], entries)
    }
    return
  }

  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
  for (const key of keys) {
    const childPath = path ? `${path}.${key}` : key
    walkDiff(childPath, beforeRecord[key], afterRecord[key], entries)
  }
}

function isAllowedAssetUrl(value: string): boolean {
  return (
    value.startsWith('cloud://') ||
    value.startsWith('/pages/') ||
    value.startsWith('https://') ||
    value.startsWith('http://localhost') ||
    value.startsWith('http://127.0.0.1')
  )
}

export function nextSortOrder(config: BootstrapConfig): number {
  const max = config.pets.reduce((acc, pet) => Math.max(acc, pet.frameOffset || 0), 0)
  return max + 1
}

export function generateDiffSummary(
  before: BootstrapConfig | null,
  after: BootstrapConfig | null,
): string {
  if (!before || !after) return '初始化配置'

  const lines: string[] = []

  const beforePetIds = new Set((before.pets || []).map((p) => p.id))
  const afterPetIds = new Set((after.pets || []).map((p) => p.id))
  const addedPets = (after.pets || []).filter((p) => !beforePetIds.has(p.id))
  const removedPets = (before.pets || []).filter((p) => !afterPetIds.has(p.id))

  for (const pet of addedPets) {
    lines.push(`新增宠物「${pet.name || pet.id}」`)
  }
  for (const pet of removedPets) {
    lines.push(`移除宠物「${pet.name || pet.id}」`)
  }

  for (const afterPet of after.pets || []) {
    const beforePet = (before.pets || []).find((p) => p.id === afterPet.id)
    if (!beforePet) continue

    if (beforePet.enabled !== false && afterPet.enabled === false) {
      lines.push(`隐藏宠物「${afterPet.name}」`)
    } else if (beforePet.enabled === false && afterPet.enabled !== false) {
      lines.push(`启用宠物「${afterPet.name}」`)
    }

    if (beforePet.name !== afterPet.name) {
      lines.push(`宠物「${beforePet.name}」改名为「${afterPet.name}」`)
    }
    if (beforePet.videoUrl !== afterPet.videoUrl && afterPet.videoUrl) {
      lines.push(`更新「${afterPet.name}」的视频素材`)
    }
    if (beforePet.audioUrl !== afterPet.audioUrl && afterPet.audioUrl) {
      lines.push(`更新「${afterPet.name}」的音频`)
    }
    if (beforePet.thumbUrl !== afterPet.thumbUrl && afterPet.thumbUrl) {
      lines.push(`更新「${afterPet.name}」的预览图`)
    }
  }

  const beforeRoomIds = new Set((before.rooms || []).map((r) => r.id))
  const afterRoomIds = new Set((after.rooms || []).map((r) => r.id))
  const addedRooms = (after.rooms || []).filter((r) => !beforeRoomIds.has(r.id))
  const removedRooms = (before.rooms || []).filter((r) => !afterRoomIds.has(r.id))

  for (const room of addedRooms) {
    lines.push(`新增背景「${room.name || room.id}」`)
  }
  for (const room of removedRooms) {
    lines.push(`移除背景「${room.name || room.id}」`)
  }

  for (const afterRoom of after.rooms || []) {
    const beforeRoom = (before.rooms || []).find((r) => r.id === afterRoom.id)
    if (!beforeRoom) continue

    if (beforeRoom.enabled !== false && afterRoom.enabled === false) {
      lines.push(`隐藏背景「${afterRoom.name}」`)
    } else if (beforeRoom.enabled === false && afterRoom.enabled !== false) {
      lines.push(`启用背景「${afterRoom.name}」`)
    }

    if (beforeRoom.name !== afterRoom.name) {
      lines.push(`背景「${beforeRoom.name}」改名为「${afterRoom.name}」`)
    }
  }

  if (before.defaultPetId !== after.defaultPetId) {
    const pet = (after.pets || []).find((p) => p.id === after.defaultPetId)
    lines.push(`默认宠物改为「${pet?.name || after.defaultPetId}」`)
  }

  if (before.defaultRoomId !== after.defaultRoomId) {
    const room = (after.rooms || []).find((r) => r.id === after.defaultRoomId)
    lines.push(`默认背景改为「${room?.name || after.defaultRoomId}」`)
  }

  if (before.homeHint !== after.homeHint) {
    lines.push(`首页提示改为「${after.homeHint}」`)
  }

  if (before.appName !== after.appName) {
    lines.push(`应用名称改为「${after.appName}」`)
  }

  const beforeAiMemory = before.aiMemory || {}
  const afterAiMemory = after.aiMemory || {}
  if (beforeAiMemory.shortTermMemoryMaxCount !== afterAiMemory.shortTermMemoryMaxCount) {
    lines.push(`短期记忆上限改为 ${afterAiMemory.shortTermMemoryMaxCount} 条`)
  }
  if (beforeAiMemory.portraitTriggerCount !== afterAiMemory.portraitTriggerCount) {
    lines.push(`画像更新阈值改为 ${afterAiMemory.portraitTriggerCount} 条`)
  }
  if (beforeAiMemory.portraitSourceMemoryLimit !== afterAiMemory.portraitSourceMemoryLimit) {
    lines.push(`画像聚合记忆条数改为 ${afterAiMemory.portraitSourceMemoryLimit} 条`)
  }
  if (beforeAiMemory.portraitMaxLength !== afterAiMemory.portraitMaxLength) {
    lines.push(`画像最大字数改为 ${afterAiMemory.portraitMaxLength} 字`)
  }

  const beforeVoice = before.voiceRecognition || {}
  const afterVoice = after.voiceRecognition || {}
  if (beforeVoice.provider !== afterVoice.provider) {
    lines.push(`语音识别方案改为 ${afterVoice.provider === 'wechat-si' ? '微信同声传译' : '现有云端方案'}`)
  }

  if (!lines.length) {
    return '配置微调'
  }

  return lines.join('；')
}
