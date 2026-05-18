export type PageName = 'home' | 'settings' | 'petPicker' | 'roomPicker'

export interface PetOption {
  id: string
  name: string
  subtitle: string
  frameOffset: number
  manifestKey?: string
  videoUrl?: string
  thumbUrl?: string
  listenFrameUrl?: string
  audioUrl?: string
  enabled?: boolean
}

export interface SettingItem {
  id: string
  icon: string
  title: string
  subtitle: string
  kind: 'link' | 'switch'
  target?: PageName
  enabled?: boolean
}

export interface RoomOption {
  id: string
  name: string
  subtitle: string
  kind: 'image' | 'video'
  mediaUrl: string
  thumbUrl?: string
  enabled?: boolean
}

export interface MiniAdConfig {
  enabled: boolean
  title: string
  copy: string
}

export interface HomeMediaConfig {
  backgroundVideoUrl: string
  petVideoUrl: string
  listenOrbVideoUrl: string
}

export interface BootstrapConfig {
  schemaVersion: number
  configVersion: string
  appName: string
  defaultPetId: string
  defaultRoomId: string
  defaultPetName: string
  homeHint: string
  homeMedia: HomeMediaConfig
  settings: {
    items: SettingItem[]
    miniAd: MiniAdConfig
  }
  rooms: RoomOption[]
  pets: PetOption[]
}

export interface BootstrapFunctionResult {
  ok?: boolean
  data?: Partial<BootstrapConfig>
  meta?: Record<string, unknown>
}

export const FALLBACK_BOOTSTRAP_CONFIG: BootstrapConfig = {
  schemaVersion: 1,
  configVersion: 'local-fallback-2026-05-15',
  appName: '宠物小小镇',
  defaultPetId: 'xiaotuanzi',
  defaultRoomId: 'pure-black',
  defaultPetName: '小团子',
  homeHint: '它在听你说话',
  homeMedia: {
    backgroundVideoUrl: '',
    petVideoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/xiaotuanzi-idle-alpha-pack-h.mp4',
    listenOrbVideoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/ui/listen-orb/listen-orb.mp4',
  },
  settings: {
    items: [
      {
        id: 'pet',
        icon: '◌',
        title: '更换宠物',
        subtitle: '猫、狗、鸟、IP 形象包',
        kind: 'link',
        target: 'petPicker',
      },
      {
        id: 'room',
        icon: '⌂',
        title: '更换房间',
        subtitle: '土星奇旅、初夏之风',
        kind: 'link',
        target: 'roomPicker',
      },
      {
        id: 'sound',
        icon: '♪',
        title: '声音反馈',
        subtitle: '叫声、呼吸、扑扇、玩具音',
        kind: 'switch',
        enabled: true,
      },
      {
        id: 'voice',
        icon: '⌁',
        title: '语音监听',
        subtitle: '只在前台打开时工作',
        kind: 'switch',
        enabled: true,
      },
      {
        id: 'privacy',
        icon: '◎',
        title: '隐私与权限',
        subtitle: '麦克风、通知、数据说明',
        kind: 'link',
      },
    ],
    miniAd: {
      enabled: true,
      title: '宠物小小镇会员',
      copy: '让小团子一直记得你',
    },
  },
  rooms: [
    {
      id: 'pure-black',
      name: '纯黑',
      subtitle: '默认背景',
      kind: 'image',
      mediaUrl: '',
      enabled: true,
    },
    {
      id: 'saturn-journey',
      name: '土星奇旅',
      subtitle: '静态星球小屋',
      kind: 'image',
      mediaUrl: '/pages/index/wallpaper.jpg',
      enabled: true,
    },
    {
      id: 'early-summer-breeze',
      name: '初夏之风',
      subtitle: '林中小屋视频',
      kind: 'video',
      mediaUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/ui/home-background/home-forest-cabin-bg.mp4',
      enabled: true,
    },
  ],
  pets: [
    {
      id: 'xiaotuanzi',
      name: '小团子',
      subtitle: '安静黏人',
      frameOffset: 1,
      manifestKey: 'xiaotuanzi/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/xiaotuanzi-idle-alpha-pack-h.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/frame_0030.png',
      enabled: true
    },
    {
      id: 'danjuan',
      name: '蛋卷',
      subtitle: '眨眼撒娇',
      frameOffset: 15,
      manifestKey: 'danjuan/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/danjuan/actions/idle/videos/danjuan-idle-alpha-pack-h.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/danjuan/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/danjuan/actions/idle/frames/frame_0030.png',
      enabled: true
    },
    {
      id: 'maolizi',
      name: '毛栗子',
      subtitle: '圆脸热情',
      frameOffset: 20,
      manifestKey: 'maolizi/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/maolizi/actions/idle/videos/maolizi-idle-alpha-pack-h.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/maolizi/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/maolizi/actions/idle/frames/frame_0030.png',
      enabled: true
    },
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isPetOption(value: unknown): value is PetOption {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.subtitle === 'string' &&
    typeof value.frameOffset === 'number'
  )
}

function isRoomOption(value: unknown): value is RoomOption {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.subtitle === 'string' &&
    (value.kind === 'image' || value.kind === 'video') &&
    typeof value.mediaUrl === 'string'
  )
}

function isSettingItem(value: unknown): value is SettingItem {
  if (!isRecord(value)) return false

  const kind = value.kind

  return (
    typeof value.id === 'string' &&
    typeof value.icon === 'string' &&
    typeof value.title === 'string' &&
    typeof value.subtitle === 'string' &&
    (kind === 'link' || kind === 'switch')
  )
}

function mergeHomeMedia(value: unknown): HomeMediaConfig {
  if (!isRecord(value)) return FALLBACK_BOOTSTRAP_CONFIG.homeMedia

  return {
    backgroundVideoUrl: typeof value.backgroundVideoUrl === 'string' ? value.backgroundVideoUrl : FALLBACK_BOOTSTRAP_CONFIG.homeMedia.backgroundVideoUrl,
    petVideoUrl: typeof value.petVideoUrl === 'string' ? value.petVideoUrl : FALLBACK_BOOTSTRAP_CONFIG.homeMedia.petVideoUrl,
    listenOrbVideoUrl: typeof value.listenOrbVideoUrl === 'string' ? value.listenOrbVideoUrl : FALLBACK_BOOTSTRAP_CONFIG.homeMedia.listenOrbVideoUrl,
  }
}

function mergeMiniAd(value: unknown): MiniAdConfig {
  if (!isRecord(value)) return FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd.enabled,
    title: typeof value.title === 'string' ? value.title : FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd.title,
    copy: typeof value.copy === 'string' ? value.copy : FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd.copy,
  }
}

export function normalizeBootstrapConfig(value: unknown): BootstrapConfig {
  if (!isRecord(value)) return FALLBACK_BOOTSTRAP_CONFIG

  const settings = isRecord(value.settings) ? value.settings : {}
  const pets = Array.isArray(value.pets) ? value.pets.filter(isPetOption) : FALLBACK_BOOTSTRAP_CONFIG.pets
  const rooms = Array.isArray(value.rooms) ? value.rooms.filter(isRoomOption) : FALLBACK_BOOTSTRAP_CONFIG.rooms
  const items = Array.isArray(settings.items)
    ? settings.items.filter(isSettingItem)
    : FALLBACK_BOOTSTRAP_CONFIG.settings.items

  return {
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : FALLBACK_BOOTSTRAP_CONFIG.schemaVersion,
    configVersion: typeof value.configVersion === 'string' ? value.configVersion : FALLBACK_BOOTSTRAP_CONFIG.configVersion,
    appName: typeof value.appName === 'string' ? value.appName : FALLBACK_BOOTSTRAP_CONFIG.appName,
    defaultPetId: typeof value.defaultPetId === 'string' ? value.defaultPetId : FALLBACK_BOOTSTRAP_CONFIG.defaultPetId,
    defaultRoomId: typeof value.defaultRoomId === 'string' ? value.defaultRoomId : FALLBACK_BOOTSTRAP_CONFIG.defaultRoomId,
    defaultPetName: typeof value.defaultPetName === 'string' ? value.defaultPetName : FALLBACK_BOOTSTRAP_CONFIG.defaultPetName,
    homeHint: typeof value.homeHint === 'string' ? value.homeHint : FALLBACK_BOOTSTRAP_CONFIG.homeHint,
    homeMedia: mergeHomeMedia(value.homeMedia),
    settings: {
      items: items.length ? items : FALLBACK_BOOTSTRAP_CONFIG.settings.items,
      miniAd: mergeMiniAd(settings.miniAd),
    },
    rooms: rooms.length ? rooms : FALLBACK_BOOTSTRAP_CONFIG.rooms,
    pets: pets.length ? pets : FALLBACK_BOOTSTRAP_CONFIG.pets,
  }
}
