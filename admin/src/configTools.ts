import { BootstrapConfig, PetOption, RoomOption, ValidationIssue } from './types'

export function cloneConfig(config: BootstrapConfig): BootstrapConfig {
  return JSON.parse(JSON.stringify(config)) as BootstrapConfig
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
  }

  return {
    ...value,
    homeMedia: {
      ...fallbackHomeMedia,
      ...(value.homeMedia || {}),
    },
    settings: {
      ...fallbackSettings,
      ...(value.settings || {}),
      miniAd: {
        ...fallbackSettings.miniAd,
        ...(value.settings?.miniAd || {}),
      },
      items: Array.isArray(value.settings?.items) ? value.settings.items : [],
    },
    rooms: Array.isArray(value.rooms) ? value.rooms : [],
    pets: Array.isArray(value.pets) ? value.pets : [],
  }
}

export function validateConfig(config: BootstrapConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const enabledPets = config.pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = config.rooms.filter((room) => room.enabled !== false)
  const petIds = new Set<string>()
  const roomIds = new Set<string>()

  if (!config.appName.trim()) {
    issues.push({ field: 'appName', message: '应用名称不能为空' })
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

  if (!enabledPets.some((pet) => pet.id === config.defaultPetId)) {
    issues.push({ field: 'defaultPetId', message: '默认宠物必须存在且启用' })
  }

  if (!enabledRooms.some((room) => room.id === config.defaultRoomId)) {
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

function isAllowedAssetUrl(value: string): boolean {
  return (
    value.startsWith('cloud://') ||
    value.startsWith('/pages/') ||
    value.startsWith('https://') ||
    value.startsWith('http://localhost') ||
    value.startsWith('http://127.0.0.1')
  )
}
