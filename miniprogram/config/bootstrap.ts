export type PageName = 'home' | 'settings' | 'petPicker'

export interface PetOption {
  id: string
  name: string
  subtitle: string
  frameOffset: number
  manifestKey?: string
  videoUrl?: string
  thumbUrl?: string
  listenFrameUrl?: string
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

export interface MiniAdConfig {
  enabled: boolean
  title: string
  copy: string
}

export interface FrameSequenceConfig {
  frameTotal: number
  fps: number
  frameBase: string
  filePrefix: string
  digits: number
  extension: string
  listenFrameIndex: number
  settingsThumbFrame: number
}

export interface HomeMediaConfig {
  petVideoUrl: string
  listenOrbVideoUrl: string
}

export interface BootstrapConfig {
  schemaVersion: number
  configVersion: string
  appName: string
  defaultPetId: string
  defaultPetName: string
  homeHint: string
  homeMedia: HomeMediaConfig
  frameSequence: FrameSequenceConfig
  settings: {
    items: SettingItem[]
    miniAd: MiniAdConfig
  }
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
  defaultPetName: '小团子',
  homeHint: '它在听你说话',
  homeMedia: {
    petVideoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/HEVC（Alpha）版本.mp4',
    listenOrbVideoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/ui/listen-orb/listen-orb.mp4',
  },
  frameSequence: {
    frameTotal: 150,
    fps: 15,
    frameBase: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/',
    filePrefix: 'frame_',
    digits: 4,
    extension: 'png',
    listenFrameIndex: 30,
    settingsThumbFrame: 90,
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
  pets: [
    {
      id: 'xiaotuanzi',
      name: '小团子',
      subtitle: '安静黏人',
      frameOffset: 1,
      manifestKey: 'xiaotuanzi/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/HEVC（Alpha）版本.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/frame_0030.png',
      enabled: true
    },
    {
      id: 'buding',
      name: '布丁',
      subtitle: '活泼好奇',
      frameOffset: 25,
      manifestKey: 'buding/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/HEVC（Alpha）版本.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/buding/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/buding/actions/idle/frames/frame_0030.png',
      enabled: true
    },
    {
      id: 'naigai',
      name: '奶盖',
      subtitle: '爱撒娇',
      frameOffset: 50,
      manifestKey: 'naigai/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/HEVC（Alpha）版本.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/naigai/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/naigai/actions/idle/frames/frame_0030.png',
      enabled: true
    },
    {
      id: 'doudou',
      name: '豆豆',
      subtitle: '喜欢陪你发呆',
      frameOffset: 75,
      manifestKey: 'doudou/manifest.json',
      videoUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/HEVC（Alpha）版本.mp4',
      thumbUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/doudou/actions/idle/frames/frame_0090.png',
      listenFrameUrl: 'cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/doudou/actions/idle/frames/frame_0030.png',
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

function mergeFrameSequence(value: unknown): FrameSequenceConfig {
  if (!isRecord(value)) return FALLBACK_BOOTSTRAP_CONFIG.frameSequence

  const fallback = FALLBACK_BOOTSTRAP_CONFIG.frameSequence

  return {
    frameTotal: typeof value.frameTotal === 'number' ? value.frameTotal : fallback.frameTotal,
    fps: typeof value.fps === 'number' ? value.fps : fallback.fps,
    frameBase: typeof value.frameBase === 'string' ? value.frameBase : fallback.frameBase,
    filePrefix: typeof value.filePrefix === 'string' ? value.filePrefix : fallback.filePrefix,
    digits: typeof value.digits === 'number' ? value.digits : fallback.digits,
    extension: typeof value.extension === 'string' ? value.extension : fallback.extension,
    listenFrameIndex: typeof value.listenFrameIndex === 'number' ? value.listenFrameIndex : fallback.listenFrameIndex,
    settingsThumbFrame: typeof value.settingsThumbFrame === 'number' ? value.settingsThumbFrame : fallback.settingsThumbFrame,
  }
}

function mergeHomeMedia(value: unknown): HomeMediaConfig {
  if (!isRecord(value)) return FALLBACK_BOOTSTRAP_CONFIG.homeMedia

  return {
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
  const items = Array.isArray(settings.items)
    ? settings.items.filter(isSettingItem)
    : FALLBACK_BOOTSTRAP_CONFIG.settings.items

  return {
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : FALLBACK_BOOTSTRAP_CONFIG.schemaVersion,
    configVersion: typeof value.configVersion === 'string' ? value.configVersion : FALLBACK_BOOTSTRAP_CONFIG.configVersion,
    appName: typeof value.appName === 'string' ? value.appName : FALLBACK_BOOTSTRAP_CONFIG.appName,
    defaultPetId: typeof value.defaultPetId === 'string' ? value.defaultPetId : FALLBACK_BOOTSTRAP_CONFIG.defaultPetId,
    defaultPetName: typeof value.defaultPetName === 'string' ? value.defaultPetName : FALLBACK_BOOTSTRAP_CONFIG.defaultPetName,
    homeHint: typeof value.homeHint === 'string' ? value.homeHint : FALLBACK_BOOTSTRAP_CONFIG.homeHint,
    homeMedia: mergeHomeMedia(value.homeMedia),
    frameSequence: mergeFrameSequence(value.frameSequence),
    settings: {
      items: items.length ? items : FALLBACK_BOOTSTRAP_CONFIG.settings.items,
      miniAd: mergeMiniAd(settings.miniAd),
    },
    pets: pets.length ? pets : FALLBACK_BOOTSTRAP_CONFIG.pets,
  }
}
