import {
  BootstrapFunctionResult,
  FALLBACK_BOOTSTRAP_CONFIG,
  HomeMediaConfig,
  PageName,
  PetOption,
  SettingItem,
  normalizeBootstrapConfig,
} from '../../config/bootstrap'
import {
  FALLBACK_PET_MANIFEST,
  PetManifest,
  PetManifestFunctionResult,
  findManifestAction,
  normalizePetManifest,
} from '../../config/petManifest'

type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'thinking' | 'success' | 'error'

interface PageData {
  pageName: PageName
  appName: string
  petName: string
  homeHint: string
  pageShellStyle: string
  homeTopStyle: string
  homeStageStyle: string
  petVideoUrl: string
  listenOrbVideoUrl: string
  petCanvasReady: boolean
  currentFrame: string
  listenFrame: string
  settingsThumb: string
  pets: PetOption[]
  pickerPets: Array<PetOption & { frame: string }>
  settings: SettingItem[]
  miniAd: {
    enabled: boolean
    title: string
    copy: string
  }
  voiceStatus: VoiceStatus
  voiceHint: string
  transcribedText: string
  petReply: string
  activePetIndex: number
}

interface VoiceTranscribeResult {
  ok?: boolean
  data?: {
    text?: string
    duration?: number
    fileSize?: number
    requestId?: string
  }
  error?: {
    code?: string
    message?: string
    requestId?: string
  }
}

interface AiRespondResult {
  ok?: boolean
  data?: {
    reply?: string
    emotion?: string
    nextAction?: string
    source?: string
  }
  error?: {
    code?: string
    message?: string
  }
  meta?: {
    fallback?: boolean
  }
}

interface AsrRealtimeSignResult {
  ok?: boolean
  data?: {
    url?: string
    voiceId?: string
    expired?: number
    engineModelType?: string
    voiceFormat?: number
  }
  error?: {
    code?: string
    message?: string
  }
}

interface RealtimeAsrMessage {
  code?: number
  message?: string
  voice_id?: string
  message_id?: string
  result?: {
    slice_type?: number
    index?: number
    voice_text_str?: string
    start_time?: number
    end_time?: number
  }
  final?: number
}

interface PetCanvasContext {
  scale(x: number, y: number): void
  clearRect(x: number, y: number, width: number, height: number): void
  drawImage(image: PetCanvasImage, x: number, y: number, width: number, height: number): void
}

interface PetCanvasImage {
  width: number
  height: number
  src: string
  onload: (() => void) | null
  onerror: ((error: unknown) => void) | null
}

interface PetCanvasNode {
  width: number
  height: number
  getContext(type: '2d'): PetCanvasContext
  createImage(): PetCanvasImage
}

let frameTimer = 0
let frameIndex = 1
let petCanvas: PetCanvasNode | null = null
let petCanvasContext: PetCanvasContext | null = null
let petCanvasWidth = 0
let petCanvasHeight = 0
let petCanvasDpr = 1
let petFrameCache: Record<string, PetCanvasImage> = {}
let petFrameFileCache: Record<string, string> = {}
let petFrameLoading: Record<string, boolean> = {}
let petFrameFailed: Record<string, boolean> = {}
let petLastRequestedFrameUrl = ''
let bootstrapConfig = FALLBACK_BOOTSTRAP_CONFIG
let activeManifest: PetManifest = FALLBACK_PET_MANIFEST
let activeActionId = FALLBACK_PET_MANIFEST.defaultState
let activeManifestSource: 'fallback' | 'remote' = 'fallback'
let recorder: WechatMiniprogram.RecorderManager | null = null
let recorderReady = false
let recordingStartedAt = 0
let recordingStopping = false
let stopFallbackTimer = 0
let asrSocket: WechatMiniprogram.SocketTask | null = null
let asrSocketOpen = false
let asrSocketReady = false
let asrSocketClosedByUser = false
let asrFrameQueue: ArrayBuffer[] = []
let asrFinalText = ''
let asrRealtimeError = ''
let asrFallbackToUpload = false

const MIN_RECORD_MS = 600
const MAX_RECORD_MS = 15000
const RECORD_FORMAT: 'mp3' = 'mp3'
const RECORDER_STOP_FALLBACK_MS = 1800
const REALTIME_FRAME_SIZE_KB = 4

function frameMs(): number {
  return 1000 / findManifestAction(activeManifest, activeActionId).fps
}

function frameUrl(index: number): string {
  return manifestFrameUrl(index)
}

function manifestFrameUrl(index: number, actionId = activeActionId): string {
  const action = findManifestAction(activeManifest, actionId)
  const range = action.endIndex - action.startIndex + 1
  const normalized = ((index - action.startIndex) % range + range) % range + action.startIndex
  const fileName = action.framePattern.replace(/\{index:0+}/, (token) => {
    const digits = token.length - '{index:'.length - '}'.length
    return String(normalized).padStart(digits, '0')
  })

  return `${activeManifest.assets.baseUrl}${fileName}`
}

function buildPickerPets(pets: PetOption[]): Array<PetOption & { frame: string }> {
  return pets.map((pet, index) => ({
    ...pet,
    frame: frameUrl(frameIndex + pet.frameOffset + index),
  }))
}

function buildPageData(config = bootstrapConfig): Partial<PageData> {
  const pets = config.pets.filter((pet) => pet.enabled !== false)
  const activePet = pets.find((pet) => pet.id === config.defaultPetId) || pets[0]
  const petName = activePet ? activePet.name : config.defaultPetName

  return {
    appName: config.appName,
    petName,
    homeHint: config.homeHint,
    petVideoUrl: config.homeMedia.petVideoUrl,
    listenOrbVideoUrl: config.homeMedia.listenOrbVideoUrl,
    currentFrame: frameUrl(frameIndex),
    listenFrame: frameUrl(config.frameSequence.listenFrameIndex),
    settingsThumb: frameUrl(config.frameSequence.settingsThumbFrame),
    pets,
    pickerPets: buildPickerPets(pets),
    settings: config.settings.items,
    miniAd: config.settings.miniAd,
    activePetIndex: Math.max(
      0,
      pets.findIndex((pet) => pet.id === config.defaultPetId),
    ),
  }
}

function isBootstrapFunctionResult(value: unknown): value is BootstrapFunctionResult {
  return Boolean(value) && typeof value === 'object'
}

function isPetManifestFunctionResult(value: unknown): value is PetManifestFunctionResult {
  return Boolean(value) && typeof value === 'object'
}

function isVoiceTranscribeResult(value: unknown): value is VoiceTranscribeResult {
  return Boolean(value) && typeof value === 'object'
}

function isAiRespondResult(value: unknown): value is AiRespondResult {
  return Boolean(value) && typeof value === 'object'
}

function isAsrRealtimeSignResult(value: unknown): value is AsrRealtimeSignResult {
  return Boolean(value) && typeof value === 'object'
}

function isRealtimeAsrMessage(value: unknown): value is RealtimeAsrMessage {
  return Boolean(value) && typeof value === 'object'
}

function voiceErrorMessage(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('audio data empty') || lower.includes('没有听到有效声音')) {
    return '开发者工具没录到声音，换真机试一下'
  }

  if (lower.includes('user is unopened') || lower.includes('asr_onesentence')) {
    return '语音识别服务还没开通'
  }

  if (lower.includes('timeout')) {
    return '识别有点慢，再试一次'
  }

  return message
}

Component({
  data: {
    pageName: 'home',
    appName: FALLBACK_BOOTSTRAP_CONFIG.appName,
    petName: FALLBACK_BOOTSTRAP_CONFIG.defaultPetName,
    homeHint: FALLBACK_BOOTSTRAP_CONFIG.homeHint,
    pageShellStyle: '',
    homeTopStyle: '',
    homeStageStyle: '',
    petVideoUrl: FALLBACK_BOOTSTRAP_CONFIG.homeMedia.petVideoUrl,
    listenOrbVideoUrl: FALLBACK_BOOTSTRAP_CONFIG.homeMedia.listenOrbVideoUrl,
    petCanvasReady: false,
    currentFrame: frameUrl(1),
    listenFrame: frameUrl(FALLBACK_BOOTSTRAP_CONFIG.frameSequence.listenFrameIndex),
    settingsThumb: frameUrl(FALLBACK_BOOTSTRAP_CONFIG.frameSequence.settingsThumbFrame),
    pets: FALLBACK_BOOTSTRAP_CONFIG.pets,
    pickerPets: buildPickerPets(FALLBACK_BOOTSTRAP_CONFIG.pets),
    settings: FALLBACK_BOOTSTRAP_CONFIG.settings.items,
    miniAd: FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd,
    voiceStatus: 'idle',
    voiceHint: '按住和小团子说话',
    transcribedText: '',
    petReply: '',
    activePetIndex: 0,
  } as PageData,

  lifetimes: {
    attached() {
      this.syncSystemLayout()
      this.initRecorder()
      this.applyBootstrapConfig(FALLBACK_BOOTSTRAP_CONFIG)
      this.fetchBootstrapConfig()
      this.initPetCanvas()
    },
    detached() {
      this.stopFrameLoop()
      this.releasePetCanvas()
    },
  },

  pageLifetimes: {
    show() {
      this.startFrameLoop()
    },
    hide() {
      this.stopFrameLoop()
    },
  },

  methods: {
    syncSystemLayout() {
      const fallbackTop = 48
      const fallbackRight = 14

      try {
        const systemInfo = wx.getSystemInfoSync()
        const menu = wx.getMenuButtonBoundingClientRect()
        const statusBarHeight = systemInfo.statusBarHeight || 0
        const navTop = menu && menu.top ? menu.top : statusBarHeight + 4
        const navHeight = menu && menu.height ? menu.height : 30
        const safeTop = Math.max(fallbackTop, navTop + navHeight + 14)
        const homeTop = Math.max(fallbackTop, navTop + 2)
        const homeStageTop = safeTop + 43
        const navContentGap = navHeight + 14
        const capsuleRight = menu && menu.left
          ? Math.max(fallbackRight, systemInfo.windowWidth - menu.left + 14)
          : fallbackRight

        this.setData({
          pageShellStyle: `--safe-top:${safeTop}px; --nav-top:${navTop}px; --nav-height:${navHeight}px; --nav-content-gap:${navContentGap}px; --capsule-right:${capsuleRight}px;`,
          homeTopStyle: `top:${homeTop}px; right:${capsuleRight}px;`,
          homeStageStyle: `top:${homeStageTop}px;`,
        })
      } catch (error) {
        console.warn('[index] system layout fallback:', error)
        this.setData({
          pageShellStyle: `--safe-top:${fallbackTop}px; --nav-top:${fallbackTop}px; --nav-height:30px; --nav-content-gap:44px; --capsule-right:${fallbackRight}px;`,
          homeTopStyle: `top:${fallbackTop}px; right:${fallbackRight}px;`,
          homeStageStyle: `top:${fallbackTop + 43}px;`,
        })
      }
    },

    initRecorder() {
      if (recorderReady) return

      recorder = wx.getRecorderManager()
      recorder.onStart(() => {
        recordingStartedAt = Date.now()
        console.info('[index] recorder start')
        this.setData({
          voiceStatus: 'recording',
          voiceHint: '松开就发给小团子',
          transcribedText: '',
          petReply: '',
        })
      })
      recorder.onStop((result) => {
        if (stopFallbackTimer) {
          clearTimeout(stopFallbackTimer)
          stopFallbackTimer = 0
        }
        console.info('[index] recorder stop:', {
          duration: result.duration,
          fileSize: result.fileSize,
          tempFilePath: result.tempFilePath,
        })
        this.handleRecordStop(result)
      })
      recorder.onFrameRecorded((result) => {
        this.handleRecordFrame(result)
      })
      recorder.onError((error) => {
        if (stopFallbackTimer) {
          clearTimeout(stopFallbackTimer)
          stopFallbackTimer = 0
        }
        recordingStopping = false
        console.warn('[index] recorder error:', error)
        this.setVoiceError(this.formatRecorderError(error))
      })
      recorderReady = true
    },

    initPetCanvas() {
      wx.nextTick(() => {
        const query = wx.createSelectorQuery().in(this)

        query
          .select('#petCanvas')
          .fields({ node: true, size: true })
          .exec((result) => {
            const target = result && result[0]
            const canvas = target && target.node as PetCanvasNode | undefined

            if (!canvas || !target.width || !target.height) {
              console.warn('[index] pet canvas unavailable')
              this.startFrameLoop()
              return
            }

            const systemInfo = wx.getSystemInfoSync()
            const context = canvas.getContext('2d')

            petCanvas = canvas
            petCanvasContext = context
            petCanvasWidth = target.width
            petCanvasHeight = target.height
            petCanvasDpr = systemInfo.pixelRatio || 1
            canvas.width = Math.floor(petCanvasWidth * petCanvasDpr)
            canvas.height = Math.floor(petCanvasHeight * petCanvasDpr)
            context.scale(petCanvasDpr, petCanvasDpr)

            petLastRequestedFrameUrl = frameUrl(frameIndex)
            this.drawPetFrame(petLastRequestedFrameUrl)
            this.startFrameLoop()
          })
      })
    },

    releasePetCanvas() {
      petCanvas = null
      petCanvasContext = null
      petCanvasWidth = 0
      petCanvasHeight = 0
      petFrameCache = {}
      petFrameFileCache = {}
      petFrameLoading = {}
      petFrameFailed = {}
      petLastRequestedFrameUrl = ''
    },

    applyBootstrapConfig(config: typeof FALLBACK_BOOTSTRAP_CONFIG) {
      bootstrapConfig = config
      this.setData(buildPageData(config))
      this.resolveHomeMedia(config.homeMedia)
      this.fetchPetManifest(config.defaultPetId)
    },

    async fetchBootstrapConfig() {
      if (!wx.cloud) return

      try {
        const response = await wx.cloud.callFunction({
          name: 'bootstrap',
          data: {
            clientVersion: FALLBACK_BOOTSTRAP_CONFIG.configVersion,
          },
        })

        if (!isBootstrapFunctionResult(response.result) || response.result.ok === false) {
          return
        }

        this.applyBootstrapConfig(normalizeBootstrapConfig(response.result.data))
      } catch (error) {
        console.warn('[index] bootstrap fallback:', error)
      }
    },

    applyPetManifest(manifest: PetManifest, source: 'fallback' | 'remote' = 'remote') {
      activeManifest = manifest
      activeActionId = manifest.defaultState
      activeManifestSource = source
      frameIndex = findManifestAction(manifest, activeActionId).startIndex
      petFrameCache = {}
      petFrameFileCache = {}
      petFrameLoading = {}
      petFrameFailed = {}
      petLastRequestedFrameUrl = ''

      this.setData({
        currentFrame: frameUrl(frameIndex),
        listenFrame: manifestFrameUrl(frameIndex, 'listen'),
        settingsThumb: manifestFrameUrl(frameIndex, 'idle'),
        petCanvasReady: false,
      })

      this.stopFrameLoop()
      petLastRequestedFrameUrl = frameUrl(frameIndex)
      this.drawPetFrame(petLastRequestedFrameUrl)
      this.startFrameLoop()
    },

    async fetchPetManifest(petId: string) {
      if (activeManifest.petId === petId && activeManifestSource === 'remote') return

      if (!wx.cloud) {
        this.applyPetManifest(FALLBACK_PET_MANIFEST, 'fallback')
        return
      }

      try {
        const response = await wx.cloud.callFunction({
          name: 'getPetManifest',
          data: {
            petId,
          },
        })

        if (!isPetManifestFunctionResult(response.result) || response.result.ok === false) {
          this.applyPetManifest(FALLBACK_PET_MANIFEST, 'fallback')
          return
        }

        this.applyPetManifest(normalizePetManifest(response.result.data))
      } catch (error) {
        console.warn('[index] pet manifest fallback:', error)
        this.applyPetManifest(FALLBACK_PET_MANIFEST, 'fallback')
      }
    },

    drawPetFrame(url: string) {
      const context = petCanvasContext

      if (!petCanvas || !context || !petCanvasWidth || !petCanvasHeight) {
        this.setData({ currentFrame: url })
        return
      }

      const cached = petFrameCache[url]

      if (cached) {
        const imageWidth = Number(cached.width) || petCanvasWidth
        const imageHeight = Number(cached.height) || petCanvasHeight
        const scale = Math.min(petCanvasWidth / imageWidth, petCanvasHeight / imageHeight)
        const drawWidth = imageWidth * scale
        const drawHeight = imageHeight * scale
        const x = (petCanvasWidth - drawWidth) / 2
        const y = (petCanvasHeight - drawHeight) / 2

        context.clearRect(0, 0, petCanvasWidth, petCanvasHeight)
        context.drawImage(cached, x, y, drawWidth, drawHeight)
        if (!this.data.petCanvasReady) {
          this.setData({ petCanvasReady: true })
        }
        return
      }

      this.preloadPetFrame(url)
    },

    preloadPetFrame(url: string) {
      if (!petCanvas || petFrameCache[url] || petFrameLoading[url] || petFrameFailed[url]) return

      petFrameLoading[url] = true

      this.resolvePetFrameSource(url)
        .then((source) => {
          if (!petCanvas) return

          const image = petCanvas.createImage()

          image.onload = () => {
            petFrameCache[url] = image
            petFrameLoading[url] = false

            if (!this.data.petCanvasReady || petLastRequestedFrameUrl === url) {
              this.drawPetFrame(url)
            }
          }
          image.onerror = (error) => {
            petFrameLoading[url] = false
            petFrameFailed[url] = true
            console.warn('[index] pet frame image decode failed:', url, error)
          }
          image.src = source
        })
        .catch((error) => {
          petFrameLoading[url] = false
          petFrameFailed[url] = true
          console.warn('[index] pet frame source resolve failed:', url, error)
        })
    },

    async resolvePetFrameSource(url: string): Promise<string> {
      if (!url.startsWith('cloud://')) return url

      const cached = petFrameFileCache[url]

      if (cached) return cached

      if (!wx.cloud) {
        throw new Error('wx.cloud is not ready')
      }

      const result = await wx.cloud.downloadFile({
        fileID: url,
      })

      if (!result.tempFilePath) {
        throw new Error('empty tempFilePath')
      }

      petFrameFileCache[url] = result.tempFilePath
      return result.tempFilePath
    },

    startFrameLoop() {
      if (frameTimer) return

      frameTimer = Number(
        setInterval(() => {
          const action = findManifestAction(activeManifest, activeActionId)

          frameIndex = frameIndex >= action.endIndex ? action.startIndex : frameIndex + 1
          petLastRequestedFrameUrl = frameUrl(frameIndex)
          this.drawPetFrame(petLastRequestedFrameUrl)
        }, frameMs()),
      )
    },

    stopFrameLoop() {
      if (!frameTimer) return
      clearInterval(frameTimer)
      frameTimer = 0
    },

    async resolveHomeMedia(media: HomeMediaConfig) {
      if (!wx.cloud) return

      const cloudUrls = [media.petVideoUrl, media.listenOrbVideoUrl].filter((url) => url.startsWith('cloud://'))

      if (!cloudUrls.length) return

      try {
        const response = await wx.cloud.getTempFileURL({
          fileList: cloudUrls,
        })
        const fileList = response.fileList || []
        const urlMap = fileList.reduce<Record<string, string>>((acc, item) => {
          const fileID = item.fileID || ''
          const tempFileURL = item.tempFileURL || ''

          if (fileID && tempFileURL) {
            acc[fileID] = tempFileURL
          }

          return acc
        }, {})

        this.setData({
          petVideoUrl: urlMap[media.petVideoUrl] || media.petVideoUrl,
          listenOrbVideoUrl: urlMap[media.listenOrbVideoUrl] || media.listenOrbVideoUrl,
        })
      } catch (error) {
        console.warn('[index] resolve home media fallback:', error)
      }
    },

    openSettings() {
      this.setData({ pageName: 'settings' })
    },

    backHome() {
      this.setData({ pageName: 'home' })
    },

    backSettings() {
      this.setData({ pageName: 'settings' })
    },

    handleSettingTap(event: WechatMiniprogram.TouchEvent) {
      const target = event.currentTarget.dataset.target as PageName | undefined
      if (!target) return
      this.setData({ pageName: target })
    },

    handlePetChange(event: WechatMiniprogram.SwiperChange) {
      this.setData({ activePetIndex: event.detail.current })
    },

    selectPet() {
      const selected = this.data.pets[this.data.activePetIndex] || this.data.pets[0]
      this.setData({
        petName: selected.name,
        settingsThumb: frameUrl(frameIndex + selected.frameOffset),
        pageName: 'home',
      })
      this.fetchPetManifest(selected.id)
    },

    async handleListenTouchStart() {
      if (this.data.pageName !== 'home') return
      if (this.data.voiceStatus === 'uploading' || this.data.voiceStatus === 'transcribing' || this.data.voiceStatus === 'thinking') return

      if (!recorder) {
        this.initRecorder()
      }

      try {
        const realtimeReady = await this.prepareRealtimeAsr()
        recordingStopping = false
        asrFallbackToUpload = !realtimeReady
        recorder!.start({
          duration: MAX_RECORD_MS,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: RECORD_FORMAT,
          frameSize: realtimeReady ? REALTIME_FRAME_SIZE_KB : undefined,
        })
      } catch (error) {
        console.warn('[index] start recorder failed:', error)
        this.closeRealtimeAsr()
        this.setVoiceError('需要麦克风权限才能听你说话')
      }
    },

    handleListenTouchEnd() {
      if (!recorder || this.data.voiceStatus !== 'recording' || recordingStopping) return

      recordingStopping = true
      this.finishRealtimeAsr()
      recorder.stop()

      if (stopFallbackTimer) {
        clearTimeout(stopFallbackTimer)
      }
      stopFallbackTimer = Number(
        setTimeout(() => {
          if (!recordingStopping) return
          recordingStopping = false
          stopFallbackTimer = 0
          console.warn('[index] recorder stop timeout')
          this.setVoiceError('录音结束有点慢，再试一次')
        }, RECORDER_STOP_FALLBACK_MS),
      )
    },

    async handleRecordStop(result: WechatMiniprogram.OnStopCallbackResult) {
      recordingStopping = false
      const duration = result.duration || Date.now() - recordingStartedAt

      if (!asrFallbackToUpload) {
        const text = asrFinalText.trim()
        const realtimeError = asrRealtimeError

        this.closeRealtimeAsr()

        if (duration < MIN_RECORD_MS) {
          this.setVoiceError('再说一遍给我听')
          return
        }

        if (realtimeError) {
          this.setVoiceError(voiceErrorMessage(realtimeError))
          return
        }

        if (!text) {
          this.setVoiceError('刚才这句有点轻')
          return
        }

        this.setData({
          voiceStatus: 'thinking',
          voiceHint: '小团子在想怎么回答',
          transcribedText: text,
          petReply: '',
        })
        await this.requestPetReply(text)
        return
      }

      if (result.fileSize !== undefined && result.fileSize < 1024) {
        this.setVoiceError('开发者工具没录到声音，换真机试一下')
        return
      }

      if (!result.tempFilePath || duration < MIN_RECORD_MS || !result.fileSize) {
        this.setVoiceError('再说一遍给我听')
        return
      }

      if (!wx.cloud) {
        this.setVoiceError('云开发还没准备好')
        return
      }

      try {
        console.info('[index] upload voice file:', {
          duration,
          fileSize: result.fileSize,
          tempFilePath: result.tempFilePath,
        })
        this.setData({
          voiceStatus: 'uploading',
          voiceHint: '小团子在接收你的声音',
          transcribedText: '',
          petReply: '',
        })

        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `voice-temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${RECORD_FORMAT}`,
          filePath: result.tempFilePath,
        })

        this.setData({
          voiceStatus: 'transcribing',
          voiceHint: '小团子在认真听',
        })

        const response = await wx.cloud.callFunction({
          name: 'voiceTranscribe',
          data: {
            fileID: uploadResult.fileID,
            duration,
            format: RECORD_FORMAT,
          },
        })

        if (!isVoiceTranscribeResult(response.result) || response.result.ok !== true) {
          const message = isVoiceTranscribeResult(response.result) && response.result.error && response.result.error.message

          this.setVoiceError(message ? voiceErrorMessage(message) : '暂时没听清，再试一次')
          return
        }

        const text = response.result.data && response.result.data.text ? response.result.data.text : ''

        this.setData({
          voiceStatus: text ? 'thinking' : 'success',
          voiceHint: text ? '小团子在想怎么回答' : '小团子听见了声音',
          transcribedText: text || '刚才这句有点轻',
        })

        if (text) {
          await this.requestPetReply(text)
        }
      } catch (error) {
        console.warn('[index] transcribe failed:', error)
        this.setVoiceError(this.formatCloudError(error))
      }
    },

    async prepareRealtimeAsr(): Promise<boolean> {
      this.closeRealtimeAsr()

      if (!wx.cloud) return false

      try {
        const response = await wx.cloud.callFunction({
          name: 'asrRealtimeSign',
          data: {},
        })

        if (!isAsrRealtimeSignResult(response.result) || response.result.ok !== true || !response.result.data || !response.result.data.url) {
          console.warn('[index] realtime asr sign unavailable:', response.result)
          return false
        }

        asrSocketOpen = false
        asrSocketReady = true
        asrSocketClosedByUser = false
        asrFrameQueue = []
        asrFinalText = ''
        asrRealtimeError = ''

        asrSocket = wx.connectSocket({
          url: response.result.data.url,
        })
        asrSocket.onOpen(() => {
          asrSocketOpen = true
          this.flushRealtimeAsrFrames()
        })
        asrSocket.onMessage((message) => {
          this.handleRealtimeAsrMessage(message)
        })
        asrSocket.onError((error) => {
          console.warn('[index] realtime asr socket error:', error)
          if (!asrSocketClosedByUser && this.data.voiceStatus === 'recording') {
            this.setData({
              voiceHint: '实时字幕连接断开，松手后再试',
            })
          }
        })
        asrSocket.onClose(() => {
          asrSocketOpen = false
        })

        return true
      } catch (error) {
        console.warn('[index] prepare realtime asr failed:', error)
        return false
      }
    },

    handleRecordFrame(result: WechatMiniprogram.OnFrameRecordedCallbackResult) {
      if (asrFallbackToUpload || !result.frameBuffer) return

      this.sendRealtimeAsrFrame(result.frameBuffer)

      if (result.isLastFrame) {
        this.finishRealtimeAsr()
      }
    },

    sendRealtimeAsrFrame(frameBuffer: ArrayBuffer) {
      if (!asrSocket) return

      if (!asrSocketOpen || !asrSocketReady) {
        asrFrameQueue.push(frameBuffer)
        return
      }

      asrSocket.send({
        data: frameBuffer,
        fail: (error) => {
          console.warn('[index] send realtime asr frame failed:', error)
        },
      })
    },

    flushRealtimeAsrFrames() {
      if (!asrSocket || !asrSocketOpen || !asrSocketReady) return

      const frames = asrFrameQueue.slice()
      asrFrameQueue = []
      frames.forEach((frame) => this.sendRealtimeAsrFrame(frame))
    },

    finishRealtimeAsr() {
      if (!asrSocket || asrFallbackToUpload) return

      try {
        asrSocket.send({
          data: JSON.stringify({ type: 'end' }),
        })
      } catch (error) {
        console.warn('[index] finish realtime asr failed:', error)
      }
    },

    closeRealtimeAsr() {
      asrSocketClosedByUser = true
      asrSocketReady = false
      asrSocketOpen = false
      asrFrameQueue = []

      if (!asrSocket) return

      try {
        asrSocket.close({})
      } catch (error) {
        console.warn('[index] close realtime asr failed:', error)
      } finally {
        asrSocket = null
      }
    },

    handleRealtimeAsrMessage(message: WechatMiniprogram.SocketTaskOnMessageCallbackResult) {
      if (typeof message.data !== 'string') return

      try {
        const payload = JSON.parse(message.data)

        if (!isRealtimeAsrMessage(payload)) return

        if (payload.code !== undefined && payload.code !== 0) {
          console.warn('[index] realtime asr response error:', payload)
          asrRealtimeError = payload.message || '实时字幕暂时不可用'
          if (this.data.voiceStatus === 'recording') {
            this.setData({
              voiceHint: voiceErrorMessage(asrRealtimeError),
            })
          }
          return
        }

        const result = payload.result
        const text = result && typeof result.voice_text_str === 'string' ? result.voice_text_str.trim() : ''

        if (!text) return

        const sliceType = result && typeof result.slice_type === 'number' ? result.slice_type : 0

        if (sliceType === 2 || payload.final === 1) {
          asrFinalText = `${asrFinalText}${text}`.trim()
        }

        this.setData({
          voiceHint: '小团子正在听',
          transcribedText: asrFinalText || text,
        })
      } catch (error) {
        console.warn('[index] parse realtime asr message failed:', error)
      }
    },

    async requestPetReply(text: string) {
      try {
        const selected = this.data.pets[this.data.activePetIndex] || this.data.pets[0]
        const response = await wx.cloud.callFunction({
          name: 'aiRespond',
          data: {
            text,
            petId: selected.id,
          },
        })

        if (!isAiRespondResult(response.result) || response.result.ok !== true) {
          const message = isAiRespondResult(response.result) && response.result.error && response.result.error.message

          this.setData({
            voiceStatus: 'success',
            voiceHint: '小团子听到了',
            petReply: message || '我听到啦，先陪你待一会儿。',
          })
          return
        }

        const reply = response.result.data && response.result.data.reply ? response.result.data.reply : '我听到啦。'

        this.setData({
          voiceStatus: 'success',
          voiceHint: response.result.meta && response.result.meta.fallback ? '小团子先轻轻回应你' : '小团子回应你',
          petReply: reply,
        })
      } catch (error) {
        console.warn('[index] ai response failed:', error)
        this.setData({
          voiceStatus: 'success',
          voiceHint: '小团子听到了',
          petReply: '我听到啦，先陪你待一会儿。',
        })
      }
    },

    setVoiceError(message: string) {
      this.setData({
        voiceStatus: 'error',
        voiceHint: message,
        transcribedText: '',
        petReply: '',
      })
    },

    formatRecorderError(error: unknown): string {
      const message = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg) : String(error || '')

      if (message.toLowerCase().includes('auth')) {
        return '需要麦克风权限才能听你说话'
      }

      if (message.toLowerCase().includes('timeout')) {
        return '录音启动超时，换真机试一下'
      }

      return '没有听清，再试一次'
    },

    formatCloudError(error: unknown): string {
      const message = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg) : String(error || '')

      if (message.toLowerCase().includes('timeout')) {
        return '网络有点慢，再试一次'
      }

      return '小团子刚刚走神了，再试一次'
    },
  },
})
