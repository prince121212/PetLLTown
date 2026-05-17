import { BootstrapConfig, PetOption, RoomOption, ValidationIssue } from './types'

export function cloneConfig(config: BootstrapConfig): BootstrapConfig {
  return JSON.parse(JSON.stringify(config)) as BootstrapConfig
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
    if (petIds.has(pet.id)) {
      issues.push({ field: `pets.${pet.id}`, message: `宠物 ID 重复：${pet.id}` })
    }
    petIds.add(pet.id)

    if (pet.enabled !== false && !pet.videoUrl) {
      issues.push({ field: `pets.${pet.id}.videoUrl`, message: `${pet.name} 缺少透明视频` })
    }

    if (pet.enabled !== false && !pet.thumbUrl) {
      issues.push({ field: `pets.${pet.id}.thumbUrl`, message: `${pet.name} 缺少预览图` })
    }
  }

  for (const room of config.rooms) {
    if (roomIds.has(room.id)) {
      issues.push({ field: `rooms.${room.id}`, message: `背景 ID 重复：${room.id}` })
    }
    roomIds.add(room.id)

    if (room.enabled !== false && !room.mediaUrl) {
      issues.push({ field: `rooms.${room.id}.mediaUrl`, message: `${room.name} 缺少媒体地址` })
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
