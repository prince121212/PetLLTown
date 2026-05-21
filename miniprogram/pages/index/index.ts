import {
  BootstrapFunctionResult,
  FALLBACK_BOOTSTRAP_CONFIG,
  PageName,
  PetOption,
  RoomOption,
  SettingItem,
  normalizeBootstrapConfig,
} from '../../config/bootstrap'
import { PetAction, normalizePetManifest } from '../../config/petManifest'
import {
  PetState,
  advanceQueue,
  applyEvent as soulApplyEvent,
  buildQueue,
  computeRelationship,
  createDefaultState,
  getTimeOfDay,
  handleEvent as soulHandleEvent,
  moodToIcon,
  setMood,
  tick as soulTick,
  updateConsecutiveDays,
} from '../../utils/soulEngine'

type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'thinking' | 'success' | 'error'

interface PageData {
  pageName: PageName
  configReady: boolean
  appName: string
  petName: string
  homeHint: string
  pageShellStyle: string
  homeTopStyle: string
  homeStageStyle: string
  backgroundMediaKind: RoomOption['kind']
  backgroundMediaUrl: string
  listenOrbVideoUrl: string
  listenFrame: string
  settingsThumb: string
  pets: PetOption[]
  pickerPets: Array<PetOption & { frame: string }>
  rooms: RoomOption[]
  pickerRooms: Array<RoomOption & { previewUrl: string; resolvedMediaUrl: string }>
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
  orbPressed: boolean
  drawerOpen: boolean
  statEnergy: number
  statAffection: number
  relationshipIcon: string
  relationshipText: string
  moodIcon: string
  moodText: string
  debugMemories: string[]
  debugPortrait: string
  debugPortraitUpdated: boolean
  debugPortraitMemoryCount: number
  debugMemorySource: string
  debugMemoryParseMode: string
  debugQueue: string[]
  debugOpen: boolean
  activePetIndex: number
  activeRoomIndex: number
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
    memories?: string[]
    portrait?: string
    portraitUpdated?: boolean
    portraitMemoryCount?: number
    memorySource?: string
    memoryParseMode?: string
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

type WebGLResource = Record<string, unknown>
type WebGLHandle = WebGLResource

interface PetWebGLRenderingContext {
  ARRAY_BUFFER: number
  BLEND: number
  CLAMP_TO_EDGE: number
  COLOR_BUFFER_BIT: number
  COMPILE_STATUS: number
  FLOAT: number
  FRAGMENT_SHADER: number
  LINEAR: number
  LINK_STATUS: number
  ONE_MINUS_SRC_ALPHA: number
  RGBA: number
  SRC_ALPHA: number
  STATIC_DRAW: number
  TEXTURE0: number
  TEXTURE_2D: number
  TEXTURE_MAG_FILTER: number
  TEXTURE_MIN_FILTER: number
  TEXTURE_WRAP_S: number
  TEXTURE_WRAP_T: number
  TRIANGLE_STRIP: number
  UNSIGNED_BYTE: number
  VERTEX_SHADER: number
  activeTexture(texture: number): void
  attachShader(program: WebGLHandle, shader: WebGLHandle): void
  bindBuffer(target: number, buffer: WebGLHandle | null): void
  bindTexture(target: number, texture: WebGLHandle | null): void
  blendFunc(sfactor: number, dfactor: number): void
  bufferData(target: number, data: Float32Array, usage: number): void
  clear(mask: number): void
  clearColor(red: number, green: number, blue: number, alpha: number): void
  compileShader(shader: WebGLHandle): void
  createBuffer(): WebGLHandle | null
  createProgram(): WebGLHandle | null
  createShader(type: number): WebGLHandle | null
  createTexture(): WebGLHandle | null
  deleteShader(shader: WebGLHandle): void
  disable(cap: number): void
  drawArrays(mode: number, first: number, count: number): void
  enable(cap: number): void
  enableVertexAttribArray(index: number): void
  getAttribLocation(program: WebGLHandle, name: string): number
  getContextAttributes?(): {
    alpha?: boolean
    premultipliedAlpha?: boolean
    preserveDrawingBuffer?: boolean
  } | null
  getProgramInfoLog(program: WebGLHandle): string | null
  getProgramParameter(program: WebGLHandle, pname: number): boolean
  getShaderInfoLog(shader: WebGLHandle): string | null
  getShaderParameter(shader: WebGLHandle, pname: number): boolean
  getUniformLocation(program: WebGLHandle, name: string): WebGLHandle | null
  linkProgram(program: WebGLHandle): void
  shaderSource(shader: WebGLHandle, source: string): void
  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels: Uint8Array | null): void
  texImage2D(target: number, level: number, internalformat: number, format: number, type: number, source: PetCanvasImage): void
  texParameteri(target: number, pname: number, param: number): void
  uniform1i(location: WebGLHandle, x: number): void
  uniform1f(location: WebGLHandle, x: number): void
  uniform4f(location: WebGLHandle, x: number, y: number, z: number, w: number): void
  useProgram(program: WebGLHandle | null): void
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void
  viewport(x: number, y: number, width: number, height: number): void
}

interface PetCanvasImage {
  width: number
  height: number
  src: string
  onload: (() => void) | null
  onerror: ((error: unknown) => void) | null
}

interface PetVideoCanvasNode {
  width: number
  height: number
  createImage(): PetCanvasImage
  getContext(type: 'webgl', options?: PetWebGLContextOptions): PetWebGLRenderingContext | null
  requestAnimationFrame(callback: () => void): number
  cancelAnimationFrame(requestId: number): void
}

interface PetWebGLContextOptions {
  alpha?: boolean
  premultipliedAlpha?: boolean
  preserveDrawingBuffer?: boolean
}

interface PetVideoFrameData {
  data: ArrayBuffer
  width: number
  height: number
  pkPts?: number
  pkDts?: number
}

interface AlphaVideoSplit {
  rgbX: number
  rgbY: number
  rgbWidth: number
  rgbHeight: number
  alphaX: number
  alphaY: number
  alphaWidth: number
  alphaHeight: number
}

interface PetVideoDecoder {
  getFrameData(): PetVideoFrameData | null | Promise<PetVideoFrameData | null>
  on(eventName: 'start' | 'stop' | 'seek' | 'bufferchange' | 'ended', callback: (...args: unknown[]) => void): void
  remove(): void | Promise<void>
  seek(position: number): void | Promise<void>
  start(option: { source: string; mode?: number }): void | Promise<void>
  stop(): void | Promise<void>
}

interface AlphaVideoProgram {
  program: WebGLHandle
  positionBuffer: WebGLHandle
  texCoordBuffer: WebGLHandle
  texture: WebGLHandle
  positionLocation: number
  texCoordLocation: number
  samplerLocation: WebGLHandle
  rgbRectLocation: WebGLHandle
  alphaRectLocation: WebGLHandle
}

let petVideoCanvas: PetVideoCanvasNode | null = null
let petVideoGl: PetWebGLRenderingContext | null = null
let petVideoProgram: AlphaVideoProgram | null = null
let petVideoDecoder: PetVideoDecoder | null = null
let petVideoCanvasInitializing = false
let petVideoFrameRequest = 0
let petVideoStartTimer = 0
let petVideoFrameData: Uint8Array | null = null
let petVideoSourceCache: Record<string, string> = {}
let petVideoStartingUrl = ''
let petVideoActiveUrl = ''
let petVideoNextDecoder: PetVideoDecoder | null = null
let petVideoNextReady = false
let petVideoFrameIndex = 0
const PET_VIDEO_TRIM_FRAMES = 5
let petVideoFirstFrameLogged = false
let petVideoFrameShapeWarned = false
let petVideoFramePending = false
let petVideoAlphaSamplesLogged = false
let petVideoRenderPaused = false
let activePetVideoUrl = ''
let activePetAudioUrl = ''
let petState: PetState = createDefaultState()
let petSceneQueue: string[] = []
let petManifestActions: PetAction[] = []
let activePetId = ''
let soulTickTimer = 0
let stateSavePending = false
let stateSaveTimer = 0
let drawerAutoCloseTimer = 0
let chatHistory: Array<{ user: string; pet: string }> = []
const MAX_CHAT_HISTORY = 5
const CHAT_TIMEOUT_MS = 300000
let petAudioContext: WechatMiniprogram.InnerAudioContext | null = null
let activeRoomId = FALLBACK_BOOTSTRAP_CONFIG.defaultRoomId
let bootstrapConfig = FALLBACK_BOOTSTRAP_CONFIG
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
const MAX_RECORD_MS = 60000
const RECORD_FORMAT: 'mp3' = 'mp3'
const RECORDER_STOP_FALLBACK_MS = 1800
const REALTIME_FRAME_SIZE_KB = 4
const ALPHA_VIDEO_START_TIMEOUT_MS = 5000
const RGBA_BYTES_PER_PIXEL = 4
const ALPHA_VIDEO_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`
const ALPHA_VIDEO_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_rgbRect;
uniform vec4 u_alphaRect;
varying vec2 v_texCoord;

vec2 mapRect(vec4 rect, vec2 uv) {
  return rect.xy + uv * rect.zw;
}

void main() {
  vec4 color = texture2D(u_texture, mapRect(u_rgbRect, v_texCoord));
  vec4 mask = texture2D(u_texture, mapRect(u_alphaRect, v_texCoord));
  float alpha = mask.r;
  gl_FragColor = vec4(color.rgb * alpha, alpha);
}
`

function buildPickerPets(pets: PetOption[]): Array<PetOption & { frame: string }> {
  return pets.map((pet) => ({
    ...pet,
    frame: pet.thumbUrl || '',
  }))
}

function buildPickerRooms(
  rooms: RoomOption[],
  urlMap: Record<string, string> = {},
): Array<RoomOption & { previewUrl: string; resolvedMediaUrl: string }> {
  return rooms.map((room) => {
    const resolvedMediaUrl = urlMap[room.mediaUrl] || room.mediaUrl
    const previewSource = room.thumbUrl || room.mediaUrl

    return {
      ...room,
      previewUrl: urlMap[previewSource] || previewSource,
      resolvedMediaUrl,
    }
  })
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === 'function'
}

function buildPageData(config = bootstrapConfig): Partial<PageData> {
  const pets = config.pets.filter((pet) => pet.enabled !== false)
  const rooms = config.rooms.filter((room) => room.enabled !== false)
  const activePet = pets.find((pet) => pet.id === config.defaultPetId) || pets[0]
  const activeRoom = rooms.find((room) => room.id === config.defaultRoomId) || rooms[0]
  const petName = activePet ? activePet.name : config.defaultPetName
  activePetVideoUrl = (activePet && activePet.videoUrl) || config.homeMedia.petVideoUrl
  activePetAudioUrl = (activePet && activePet.audioUrl) || ''
  activeRoomId = activeRoom ? activeRoom.id : ''

  return {
    appName: config.appName,
    petName,
    homeHint: config.homeHint,
    backgroundMediaKind: activeRoom ? activeRoom.kind : 'video',
    backgroundMediaUrl: activeRoom ? activeRoom.mediaUrl : config.homeMedia.backgroundVideoUrl,
    listenOrbVideoUrl: config.homeMedia.listenOrbVideoUrl,
    listenFrame: (activePet && activePet.listenFrameUrl) || '',
    settingsThumb: (activePet && activePet.thumbUrl) || '',
    pets,
    pickerPets: buildPickerPets(pets),
    rooms,
    pickerRooms: buildPickerRooms(rooms),
    settings: config.settings.items.filter((item) => item.visible !== false),
    miniAd: config.settings.miniAd,
    activePetIndex: Math.max(
      0,
      pets.findIndex((pet) => pet.id === config.defaultPetId),
    ),
    activeRoomIndex: Math.max(
      0,
      rooms.findIndex((room) => room.id === config.defaultRoomId),
    ),
  }
}

function isBootstrapFunctionResult(value: unknown): value is BootstrapFunctionResult {
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
    configReady: false,
    appName: FALLBACK_BOOTSTRAP_CONFIG.appName,
    petName: FALLBACK_BOOTSTRAP_CONFIG.defaultPetName,
    homeHint: FALLBACK_BOOTSTRAP_CONFIG.homeHint,
    pageShellStyle: '',
    homeTopStyle: '',
    homeStageStyle: '',
    backgroundMediaKind: (FALLBACK_BOOTSTRAP_CONFIG.rooms.find((r) => r.id === FALLBACK_BOOTSTRAP_CONFIG.defaultRoomId) || FALLBACK_BOOTSTRAP_CONFIG.rooms[0] || { kind: 'image' }).kind || 'image',
    backgroundMediaUrl: (FALLBACK_BOOTSTRAP_CONFIG.rooms.find((r) => r.id === FALLBACK_BOOTSTRAP_CONFIG.defaultRoomId) || FALLBACK_BOOTSTRAP_CONFIG.rooms[0] || { mediaUrl: '' }).mediaUrl || '',
    listenOrbVideoUrl: FALLBACK_BOOTSTRAP_CONFIG.homeMedia.listenOrbVideoUrl,
    listenFrame: FALLBACK_BOOTSTRAP_CONFIG.pets[0] && FALLBACK_BOOTSTRAP_CONFIG.pets[0].listenFrameUrl ? FALLBACK_BOOTSTRAP_CONFIG.pets[0].listenFrameUrl : '',
    settingsThumb: FALLBACK_BOOTSTRAP_CONFIG.pets[0] && FALLBACK_BOOTSTRAP_CONFIG.pets[0].thumbUrl ? FALLBACK_BOOTSTRAP_CONFIG.pets[0].thumbUrl : '',
    pets: FALLBACK_BOOTSTRAP_CONFIG.pets,
    pickerPets: buildPickerPets(FALLBACK_BOOTSTRAP_CONFIG.pets),
    rooms: FALLBACK_BOOTSTRAP_CONFIG.rooms,
    pickerRooms: buildPickerRooms(FALLBACK_BOOTSTRAP_CONFIG.rooms),
    settings: FALLBACK_BOOTSTRAP_CONFIG.settings.items,
    miniAd: FALLBACK_BOOTSTRAP_CONFIG.settings.miniAd,
    voiceStatus: 'idle',
    voiceHint: '按住和小团子说话',
    transcribedText: '',
    petReply: '',
    orbPressed: false,
    drawerOpen: false,
    statEnergy: 80,
    statAffection: 50,
    relationshipIcon: '🔥',
    relationshipText: '连续1天',
    moodIcon: '😊',
    moodText: '开心',
    debugMemories: [] as string[],
    debugPortrait: '',
    debugPortraitUpdated: false,
    debugPortraitMemoryCount: 0,
    debugMemorySource: '',
    debugMemoryParseMode: '',
    debugQueue: [] as string[],
    debugOpen: false,
    activePetIndex: 0,
    activeRoomIndex: Math.max(0, FALLBACK_BOOTSTRAP_CONFIG.rooms.findIndex((r) => r.id === FALLBACK_BOOTSTRAP_CONFIG.defaultRoomId)),
  } as PageData,

  lifetimes: {
    attached() {
      this.syncSystemLayout()
      this.initRecorder()
      this.fetchBootstrapConfig()
      this.initPetVideoCanvas()
    },
    detached() {
      this.stopAlphaVideo()
      this.releasePetVideoCanvas()
      this.stopSoulTick()
    },
  },

  pageLifetimes: {
    show() {
      petState = soulApplyEvent(petState, 'user_returned')
      this.startPetRenderer()
      this.startSoulTick()
      this.syncPanelUI()
    },
    hide() {
      this.stopAlphaVideo()
      this.stopSoulTick()
      this.savePetStateNow()
      chatHistory = []
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

    initPetVideoCanvas() {
      if (petVideoCanvas && petVideoGl && petVideoProgram) {
        this.startPetRenderer()
        return
      }

      if (petVideoCanvasInitializing) return

      petVideoCanvasInitializing = true
      wx.nextTick(() => {
        const query = wx.createSelectorQuery().in(this)

        query
          .select('#petVideoCanvas')
          .fields({ node: true, size: true, rect: true })
          .exec((result) => {
            petVideoCanvasInitializing = false

            const target = result && result[0]
            const canvas = target && target.node as PetVideoCanvasNode | undefined

            if (!canvas || !target.width || !target.height) {
              console.warn('[index] alpha video canvas unavailable')
              return
            }

            const systemInfo = wx.getSystemInfoSync()
            const dpr = systemInfo.pixelRatio || 1
            const gl = canvas.getContext('webgl', {
              alpha: true,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
            })

            if (!gl) {
              console.warn('[index] webgl unavailable for alpha video')
              return
            }

            canvas.width = Math.floor(target.width * dpr)
            canvas.height = Math.floor(target.height * dpr)
            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.clearColor(0, 0, 0, 0)
            gl.disable(gl.BLEND)

            petVideoCanvas = canvas
            petVideoGl = gl
            petVideoProgram = this.createAlphaVideoProgram(gl)

            if (!petVideoProgram) {
              console.warn('[index] alpha video WebGL program unavailable')
              return
            }

            console.info('[index] alpha video canvas ready:', {
              cssWidth: target.width,
              cssHeight: target.height,
              width: canvas.width,
              height: canvas.height,
              dpr,
              contextAttributes: typeof gl.getContextAttributes === 'function' ? gl.getContextAttributes() : null,
            })
            this.startPetRenderer()
          })
      })
    },

    startPetRenderer() {
      if (!this.data.configReady) return

      if (!petVideoCanvas || !petVideoGl || !petVideoProgram) {
        this.initPetVideoCanvas()
        return
      }

      if (this.data.pageName !== 'home') {
        petVideoRenderPaused = true
        return
      }

      if (petVideoGl && petVideoProgram) {
        petVideoRenderPaused = false
        if (petManifestActions.length > 0) {
          petSceneQueue = buildQueue(petState, null)
          const result = advanceQueue(petState, petSceneQueue)
          petState = result.state
          petSceneQueue = result.queue
          this.playScene(result.next)
        } else if (activePetVideoUrl) {
          this.startAlphaVideo(activePetVideoUrl)
          this.startPetAudio()
        }
        this.syncPanelUI()
      }
    },

    async startAlphaVideo(url: string) {
      if (!petVideoCanvas || !petVideoGl || !petVideoProgram || !url) {
        return
      }

      if (petVideoStartingUrl === url || (petVideoDecoder && petVideoActiveUrl === url)) return

      this.stopAlphaVideo()
      petVideoStartingUrl = url
      petVideoActiveUrl = url
      petVideoFirstFrameLogged = false
      petVideoFrameShapeWarned = false
      petVideoFramePending = false
      petVideoAlphaSamplesLogged = false

      try {
        console.info('[index] alpha video start requested:', { url })
        const source = await this.resolveVideoSource(url)

        if (petVideoStartingUrl !== url) return

        const decoder = this.createVideoDecoder()

        if (!decoder) {
          petVideoStartingUrl = ''
          return
        }

        petVideoDecoder = decoder
        decoder.on('start', (...args) => {
          if (petVideoStartTimer) {
            clearTimeout(petVideoStartTimer)
            petVideoStartTimer = 0
          }
          petVideoStartingUrl = ''
          petVideoFrameIndex = 0
          console.info('[index] alpha video decoder started:', {
            url,
            source,
            detail: (args[0] as Record<string, unknown> | undefined) || null,
          })
          this.renderAlphaVideoFrame()
          this.prepareNextDecoder()
        })
        decoder.on('ended', () => {
          if (petVideoDecoder !== decoder) return
          this.onSceneEnded()
        })
        const startResult = decoder.start({ source, mode: 0 })
        petVideoStartTimer = Number(
          setTimeout(() => {
            if (!petVideoDecoder || petVideoStartingUrl !== url) return

            console.warn('[index] alpha video start timeout')
          }, ALPHA_VIDEO_START_TIMEOUT_MS),
        )

        if (isPromiseLike(startResult)) {
          startResult.catch((error) => {
            if (petVideoActiveUrl !== url && petVideoStartingUrl !== url) return
            this.stopAlphaVideo()
            console.warn('[index] alpha video decoder rejected:', error)
          })
        }
      } catch (error) {
        this.stopAlphaVideo()
        if (petVideoStartTimer) {
          clearTimeout(petVideoStartTimer)
          petVideoStartTimer = 0
        }
        petVideoStartingUrl = ''
        petVideoActiveUrl = ''
        console.warn('[index] alpha video start failed:', error)
      }
    },

    async playNextInPlaylist(item: { videoUrl: string; audioUrl: string }) {
      if (!item.videoUrl) return

      try {
        if (petVideoNextDecoder && petVideoNextReady) {
          if (petVideoDecoder) {
            try { petVideoDecoder.stop(); petVideoDecoder.remove() } catch {}
          }
          petVideoDecoder = petVideoNextDecoder
          petVideoActiveUrl = item.videoUrl
          petVideoFrameIndex = 0
          petVideoNextDecoder = null
          petVideoNextReady = false
          this.renderAlphaVideoFrame()
        } else {
          const source = await this.resolveVideoSource(item.videoUrl)
          if (petVideoDecoder) {
            try { petVideoDecoder.stop(); petVideoDecoder.remove() } catch {}
          }
          const decoder = this.createVideoDecoder()
          if (!decoder) return
          petVideoDecoder = decoder
          petVideoActiveUrl = item.videoUrl
          petVideoFrameIndex = 0
          petVideoNextDecoder = null
          petVideoNextReady = false
          this.setupDecoderEvents(decoder, item.videoUrl)
          decoder.start({ source, mode: 0 })
        }

        activePetAudioUrl = item.audioUrl || ''
        this.startPetAudio()
        this.prepareNextDecoder()
      } catch (error) {
        console.warn('[index] playNextInPlaylist failed:', error)
      }
    },

    onSceneEnded() {
      const result = advanceQueue(petState, petSceneQueue)
      petState = result.state
      petSceneQueue = result.queue
      this.playScene(result.next)
      this.syncPanelUI()
    },

    playScene(sceneId: string) {
      const action = petManifestActions.find((a) => a.id === sceneId)
      if (action && action.videoUrls && action.videoUrls.length) {
        const videoUrl = action.videoUrls[Math.floor(Math.random() * action.videoUrls.length)]
        const audioUrl = action.audioUrl || ''
        this.playNextInPlaylist({ videoUrl, audioUrl })
        return
      }
      if (petVideoDecoder) {
        try { petVideoDecoder.seek(0) } catch {}
      } else if (activePetVideoUrl) {
        this.startAlphaVideo(activePetVideoUrl)
      }
    },

    async prepareNextDecoder() {
      const nextScene = petSceneQueue.length > 0 ? petSceneQueue[0] : 'idle'
      const action = petManifestActions.find((a) => a.id === nextScene)
      if (!action || !action.videoUrls || !action.videoUrls.length) return

      const videoUrl = action.videoUrls[Math.floor(Math.random() * action.videoUrls.length)]
      if (!videoUrl) return

      try {
        const source = await this.resolveVideoSource(videoUrl)
        if (petVideoNextDecoder) {
          try { petVideoNextDecoder.stop(); petVideoNextDecoder.remove() } catch {}
        }
        petVideoNextReady = false
        const decoder = this.createVideoDecoder()
        if (!decoder) return

        decoder.on('start', () => {
          petVideoNextReady = true
        })
        this.setupDecoderEvents(decoder, videoUrl)
        decoder.start({ source, mode: 0 })
        petVideoNextDecoder = decoder
      } catch (error) {
        petVideoNextDecoder = null
        petVideoNextReady = false
      }
    },

    setupDecoderEvents(decoder: PetVideoDecoder, _url: string) {
      decoder.on('start', () => {
        if (petVideoDecoder === decoder) {
          petVideoFrameIndex = 0
          this.renderAlphaVideoFrame()
        }
      })
      decoder.on('ended', () => {
        if (petVideoDecoder !== decoder) return
        this.onSceneEnded()
      })
    },

    stopAlphaVideo() {
      petVideoRenderPaused = false
      petVideoStartingUrl = ''
      petVideoActiveUrl = ''
      petVideoFirstFrameLogged = false
      petVideoFrameShapeWarned = false
      petVideoFramePending = false
      petVideoAlphaSamplesLogged = false
      this.stopPetAudio()

      if (petVideoStartTimer) {
        clearTimeout(petVideoStartTimer)
        petVideoStartTimer = 0
      }

      if (petVideoFrameRequest && petVideoCanvas) {
        petVideoCanvas.cancelAnimationFrame(petVideoFrameRequest)
        petVideoFrameRequest = 0
      }

      if (petVideoDecoder) {
        try {
          petVideoDecoder.stop()
          petVideoDecoder.remove()
        } catch (error) {
          console.warn('[index] alpha video stop failed:', error)
        }
        petVideoDecoder = null
      }

      if (petVideoNextDecoder) {
        try {
          petVideoNextDecoder.stop()
          petVideoNextDecoder.remove()
        } catch {}
        petVideoNextDecoder = null
        petVideoNextReady = false
      }
    },

    releasePetVideoCanvas() {
      petVideoCanvasInitializing = false
      petVideoCanvas = null
      petVideoGl = null
      petVideoProgram = null
      petVideoFrameData = null
    },

    pausePetRenderer() {
      petVideoRenderPaused = true
      this.pausePetAudio()

      if (petVideoFrameRequest && petVideoCanvas) {
        petVideoCanvas.cancelAnimationFrame(petVideoFrameRequest)
        petVideoFrameRequest = 0
      }
    },

    resumePetRenderer() {
      petVideoRenderPaused = false

      if (!petVideoCanvas || !petVideoGl || !petVideoProgram) {
        this.initPetVideoCanvas()
        return
      }

      if (petVideoDecoder && petVideoActiveUrl === activePetVideoUrl) {
        if (!petVideoFrameRequest) {
          this.renderAlphaVideoFrame()
        }
        this.resumePetAudio()
        return
      }

      this.startPetRenderer()
    },

    enterHomePage(updateData: Record<string, unknown> = {}) {
      this.setData({
        ...updateData,
        pageName: 'home',
      }, () => {
        this.resumePetRenderer()
      })
    },

    leaveHomePage(pageName: PageName) {
      this.pausePetRenderer()
      this.setData({ pageName })
    },

    createVideoDecoder(): PetVideoDecoder | null {
      if (typeof wx.createVideoDecoder !== 'function') {
        console.warn('[index] wx.createVideoDecoder unavailable')
        return null
      }

      return wx.createVideoDecoder() as unknown as PetVideoDecoder
    },

    async resolveVideoSource(url: string): Promise<string> {
      if (!url.startsWith('cloud://')) return url

      const cached = petVideoSourceCache[url]

      if (cached) return cached

      if (!wx.cloud) {
        throw new Error('wx.cloud is not ready')
      }

      const result = await wx.cloud.downloadFile({
        fileID: url,
      })

      if (!result.tempFilePath) {
        throw new Error('empty video tempFilePath')
      }

      petVideoSourceCache[url] = result.tempFilePath
      console.info('[index] alpha video cloud source resolved:', {
        url,
        source: result.tempFilePath,
      })
      return result.tempFilePath
    },

    renderAlphaVideoFrame() {
      if (!petVideoCanvas || !petVideoGl || !petVideoProgram || !petVideoDecoder) return

      if (petVideoRenderPaused) {
        petVideoFrameRequest = 0
        return
      }

      if (!petVideoFramePending) {
        const frameResult = petVideoDecoder.getFrameData()

        if (isPromiseLike(frameResult)) {
          petVideoFramePending = true
          frameResult
            .then((frame) => {
              petVideoFramePending = false
              if (frame && frame.data && frame.width && frame.height) {
                this.handleVideoFrame(frame)
              }
            })
            .catch((error) => {
              petVideoFramePending = false
              console.warn('[index] alpha video getFrameData failed:', error)
            })
        } else if (frameResult && frameResult.data && frameResult.width && frameResult.height) {
          this.handleVideoFrame(frameResult)
        }
      }

      petVideoFrameRequest = petVideoCanvas.requestAnimationFrame(() => {
        this.renderAlphaVideoFrame()
      })
    },

    handleVideoFrame(frame: PetVideoFrameData) {
      petVideoFrameIndex++

      if (petVideoFrameIndex <= PET_VIDEO_TRIM_FRAMES) return

      this.drawAlphaVideoFrame(frame)
    },

    drawAlphaVideoFrame(frame: PetVideoFrameData) {
      const gl = petVideoGl
      const resources = petVideoProgram

      if (!gl || !resources) return

      const pixelLength = frame.width * frame.height * RGBA_BYTES_PER_PIXEL
      const rawFrame = new Uint8Array(frame.data)
      const split = this.detectAlphaVideoSplit(frame.width, frame.height)

      if (!petVideoFirstFrameLogged) {
        petVideoFirstFrameLogged = true
        console.info('[index] alpha video first frame:', {
          width: frame.width,
          height: frame.height,
          byteLength: rawFrame.byteLength,
          expectedRgbaByteLength: pixelLength,
          split,
        })
      }

      if (rawFrame.byteLength < pixelLength) {
        if (!petVideoFrameShapeWarned) {
          petVideoFrameShapeWarned = true
          console.warn('[index] alpha video frame is not RGBA sized:', {
            width: frame.width,
            height: frame.height,
            byteLength: rawFrame.byteLength,
            expectedRgbaByteLength: pixelLength,
          })
        }
        return
      }

      if (!petVideoFrameData || petVideoFrameData.byteLength !== pixelLength) {
        petVideoFrameData = new Uint8Array(pixelLength)
      }

      petVideoFrameData.set(rawFrame.subarray(0, pixelLength))

      if (!petVideoAlphaSamplesLogged) {
        petVideoAlphaSamplesLogged = true
        console.info('[index] alpha video mask samples:', this.sampleAlphaVideoMask(rawFrame, frame.width, frame.height, split))
      }

      gl.useProgram(resources.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, resources.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frame.width, frame.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, petVideoFrameData)
      gl.uniform1i(resources.samplerLocation, 0)

      gl.uniform4f(resources.rgbRectLocation, split.rgbX, split.rgbY, split.rgbWidth, split.rgbHeight)
      gl.uniform4f(resources.alphaRectLocation, split.alphaX, split.alphaY, split.alphaWidth, split.alphaHeight)

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },

    detectAlphaVideoSplit(width: number, height: number): AlphaVideoSplit {
      if (width >= height) {
        return {
          rgbX: 0,
          rgbY: 0,
          rgbWidth: 0.5,
          rgbHeight: 1,
          alphaX: 0.5,
          alphaY: 0,
          alphaWidth: 0.5,
          alphaHeight: 1,
        }
      }

      return {
        rgbX: 0,
        rgbY: 0,
        rgbWidth: 1,
        rgbHeight: 0.5,
        alphaX: 0,
        alphaY: 0.5,
        alphaWidth: 1,
        alphaHeight: 0.5,
      }
    },

    sampleAlphaVideoMask(frame: Uint8Array, width: number, height: number, split: AlphaVideoSplit) {
      const readMask = (u: number, v: number) => {
        const x = Math.min(width - 1, Math.max(0, Math.floor((split.alphaX + split.alphaWidth * u) * width)))
        const y = Math.min(height - 1, Math.max(0, Math.floor((split.alphaY + split.alphaHeight * v) * height)))
        const offset = (y * width + x) * RGBA_BYTES_PER_PIXEL

        return {
          x,
          y,
          r: frame[offset],
          g: frame[offset + 1],
          b: frame[offset + 2],
          a: frame[offset + 3],
        }
      }

      return {
        topLeft: readMask(0.08, 0.08),
        center: readMask(0.5, 0.5),
        lowerCenter: readMask(0.5, 0.82),
        lowerLeft: readMask(0.2, 0.9),
      }
    },

    createAlphaVideoProgram(gl: PetWebGLRenderingContext): AlphaVideoProgram | null {
      const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, ALPHA_VIDEO_VERTEX_SHADER)
      const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, ALPHA_VIDEO_FRAGMENT_SHADER)

      if (!vertexShader || !fragmentShader) return null

      const program = gl.createProgram()

      if (!program) return null

      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[index] alpha video shader link failed:', gl.getProgramInfoLog(program))
        return null
      }

      const positionBuffer = gl.createBuffer()
      const texCoordBuffer = gl.createBuffer()
      const texture = gl.createTexture()
      const samplerLocation = gl.getUniformLocation(program, 'u_texture')
      const rgbRectLocation = gl.getUniformLocation(program, 'u_rgbRect')
      const alphaRectLocation = gl.getUniformLocation(program, 'u_alphaRect')

      if (
        !positionBuffer ||
        !texCoordBuffer ||
        !texture ||
        !samplerLocation ||
        !rgbRectLocation ||
        !alphaRectLocation
      ) {
        return null
      }

      const positionLocation = gl.getAttribLocation(program, 'a_position')
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW)

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      gl.useProgram(program)
      gl.uniform1i(samplerLocation, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
      gl.enableVertexAttribArray(texCoordLocation)
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

      return {
        program,
        positionBuffer,
        texCoordBuffer,
        texture,
        positionLocation,
        texCoordLocation,
        samplerLocation,
        rgbRectLocation,
        alphaRectLocation,
      }
    },

    createShader(gl: PetWebGLRenderingContext, type: number, source: string): WebGLHandle | null {
      const shader = gl.createShader(type)

      if (!shader) return null

      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[index] alpha video shader compile failed:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }

      return shader
    },

    applyBootstrapConfig(config: typeof FALLBACK_BOOTSTRAP_CONFIG) {
      bootstrapConfig = config
      this.setData({ ...buildPageData(config), configReady: true })
      this.resolveHomeMedia(config)
      this.initSoul(config)
    },

    async initSoul(config: typeof FALLBACK_BOOTSTRAP_CONFIG) {
      const prefs = await this.loadUserPrefs()
      activePetId = prefs.activePetId || config.defaultPetId
      await this.fetchPetManifest(activePetId)
      await this.loadPetState(activePetId)
      this.startPetRenderer()
      this.startSoulTick()
    },

    async fetchBootstrapConfig() {
      if (!wx.cloud) {
        this.applyBootstrapConfig(FALLBACK_BOOTSTRAP_CONFIG)
        return
      }

      try {
        const response = await wx.cloud.callFunction({
          name: 'bootstrap',
          data: {
            clientVersion: FALLBACK_BOOTSTRAP_CONFIG.configVersion,
          },
        })

        if (!isBootstrapFunctionResult(response.result) || response.result.ok === false) {
          this.applyBootstrapConfig(FALLBACK_BOOTSTRAP_CONFIG)
          return
        }

        this.applyBootstrapConfig(normalizeBootstrapConfig(response.result.data))
      } catch (error) {
        console.warn('[index] bootstrap fallback:', error)
        this.applyBootstrapConfig(FALLBACK_BOOTSTRAP_CONFIG)
      }
    },

    async fetchPetManifest(petId: string) {
      if (!wx.cloud) return

      try {
        const response = await wx.cloud.callFunction({
          name: 'getPetManifest',
          data: { petId },
        })

        if (!response.result || (response.result as Record<string, unknown>).ok === false) return

        const manifest = normalizePetManifest((response.result as Record<string, unknown>).data)
        petManifestActions = manifest.actions
        console.info('[index] pet manifest loaded:', { petId, actions: manifest.actions.map((a) => a.id) })
      } catch (error) {
        console.warn('[index] fetchPetManifest failed:', error)
      }
    },

    async loadUserPrefs(): Promise<{ activePetId: string }> {
      if (!wx.cloud) return { activePetId: '' }

      try {
        const response = await wx.cloud.callFunction({ name: 'petState', data: { action: 'getPrefs' } })
        const result = response.result as Record<string, unknown> | undefined
        if (result && result.ok && result.data) {
          const prefs = result.data as Record<string, unknown>
          return { activePetId: typeof prefs.activePetId === 'string' ? prefs.activePetId : '' }
        }
      } catch (error) {
        console.warn('[index] loadUserPrefs failed:', error)
      }
      return { activePetId: '' }
    },

    saveUserPrefs() {
      if (!wx.cloud || !activePetId) return
      wx.cloud.callFunction({
        name: 'petState',
        data: { action: 'savePrefs', prefs: { activePetId } },
      }).catch(() => undefined)
    },

    async loadPetState(petId: string) {
      if (!wx.cloud) return

      try {
        const response = await wx.cloud.callFunction({ name: 'petState', data: { action: 'get', petId } })
        const result = response.result as Record<string, unknown> | undefined
        if (result && result.ok && result.data) {
          const saved = result.data as Partial<PetState>
          petState = { ...createDefaultState(), ...saved }
          const elapsed = Math.min((Date.now() - (petState.updatedAt || Date.now())) / 1000, 86400)
          if (elapsed > 0) petState = soulTick(petState, elapsed)
          petState = updateConsecutiveDays(petState)
          console.info('[index] pet state loaded:', { petId, energy: petState.energy, mood: petState.mood, days: petState.consecutiveDays })
        }
      } catch (error) {
        console.warn('[index] loadPetState failed:', error)
      }
      this.syncPanelUI()
    },

    savePetState() {
      if (stateSavePending || !activePetId) return
      stateSavePending = true
      if (stateSaveTimer) clearTimeout(stateSaveTimer)
      stateSaveTimer = Number(setTimeout(() => {
        stateSavePending = false
        stateSaveTimer = 0
        if (!wx.cloud || !activePetId) return
        wx.cloud.callFunction({ name: 'petState', data: { action: 'save', petId: activePetId, state: petState } }).catch(() => undefined)
      }, 10000))
    },

    startSoulTick() {
      if (soulTickTimer) clearInterval(soulTickTimer)
      soulTickTimer = Number(setInterval(() => {
        const prevMood = petState.mood
        petState = soulTick(petState, 30)

        if (petState.mood === '疲倦' && prevMood !== '疲倦' && petState.currentScene !== 'sleep-loop' && petState.currentScene !== 'sleep-enter') {
          const result = soulHandleEvent('energy_low', petState, petSceneQueue)
          petState = result.state
          petSceneQueue = result.queue
          this.prepareNextDecoder()
        }

        if (petState.energy >= 80 && petState.currentScene === 'sleep-loop') {
          const result = soulHandleEvent('energy_full', petState, petSceneQueue)
          petState = result.state
          petSceneQueue = result.queue
          this.prepareNextDecoder()
        }

        this.syncPanelUI()
        this.savePetState()
      }, 30000))
    },

    stopSoulTick() {
      if (soulTickTimer) {
        clearInterval(soulTickTimer)
        soulTickTimer = 0
      }
    },

    syncPanelUI() {
      const rel = computeRelationship(petState.consecutiveDays)
      this.setData({
        statEnergy: Math.round(petState.energy),
        statAffection: Math.round(petState.affection),
        moodIcon: moodToIcon(petState.mood),
        moodText: petState.mood,
        relationshipIcon: rel.icon,
        relationshipText: rel.text,
        debugQueue: petSceneQueue.slice(0, 5),
      })
    },

    async resolveHomeMedia(config: typeof FALLBACK_BOOTSTRAP_CONFIG) {
      if (!wx.cloud) return

      const rooms = config.rooms.filter((room) => room.enabled !== false)
      const roomUrls = rooms.reduce<string[]>((acc, room) => {
        acc.push(room.mediaUrl)
        if (room.thumbUrl) acc.push(room.thumbUrl)
        return acc
      }, [])
      const cloudUrls = [config.homeMedia.listenOrbVideoUrl, ...roomUrls]
        .filter((url) => url.startsWith('cloud://'))
        .filter((url, index, list) => list.indexOf(url) === index)

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

        const pickerRooms = buildPickerRooms(rooms, urlMap)
        const selectedRoom = pickerRooms.find((room) => room.id === activeRoomId) || pickerRooms[0]

        this.setData({
          backgroundMediaUrl: selectedRoom ? selectedRoom.resolvedMediaUrl : this.data.backgroundMediaUrl,
          listenOrbVideoUrl: urlMap[config.homeMedia.listenOrbVideoUrl] || config.homeMedia.listenOrbVideoUrl,
          pickerRooms,
        })
      } catch (error) {
        console.warn('[index] resolve home media fallback:', error)
      }
    },

    openSettings() {
      this.leaveHomePage('settings')
    },

    toggleDrawer() {
      const opening = !this.data.drawerOpen
      this.setData({ drawerOpen: opening })
      if (drawerAutoCloseTimer) { clearTimeout(drawerAutoCloseTimer); drawerAutoCloseTimer = 0 }
      if (opening) {
        drawerAutoCloseTimer = Number(setTimeout(() => {
          drawerAutoCloseTimer = 0
          this.setData({ drawerOpen: false })
        }, 3000))
      }
    },

    toggleDebug() {
      this.setData({ debugOpen: !this.data.debugOpen })
      console.info('[debug-dump]', JSON.stringify({
        petState: {
          energy: Math.round(petState.energy),
          affection: Math.round(petState.affection),
          mood: petState.mood,
          currentScene: petState.currentScene,
          consecutiveDays: petState.consecutiveDays,
        },
        activePetId,
        queue: petSceneQueue.slice(0, 5),
        voiceStatus: this.data.voiceStatus,
        chatHistoryLength: chatHistory.length,
        chatHistory: chatHistory.slice(-3),
        manifestActions: petManifestActions.map((a) => `${a.id}(${a.videoUrls ? a.videoUrls.length : 0})`),
        debugMemories: this.data.debugMemories,
        debugPortrait: this.data.debugPortrait,
        debugPortraitUpdated: this.data.debugPortraitUpdated,
        debugPortraitMemoryCount: this.data.debugPortraitMemoryCount,
        debugMemorySource: this.data.debugMemorySource,
        debugMemoryParseMode: this.data.debugMemoryParseMode,
      }, null, 2))
    },

    backHome() {
      this.enterHomePage()
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

    handleRoomChange(event: WechatMiniprogram.SwiperChange) {
      this.setData({ activeRoomIndex: event.detail.current })
    },

    async selectPet() {
      const selected = this.data.pets[this.data.activePetIndex] || this.data.pets[0]
      if (!selected) return

      this.savePetStateNow()

      activePetId = selected.id
      activePetVideoUrl = (selected && selected.videoUrl) || bootstrapConfig.homeMedia.petVideoUrl
      activePetAudioUrl = (selected && selected.audioUrl) || ''
      petManifestActions = []
      petSceneQueue = []
      petState = createDefaultState()

      this.saveUserPrefs()
      await this.fetchPetManifest(selected.id)
      await this.loadPetState(selected.id)

      this.enterHomePage({
        petName: selected.name,
        settingsThumb: (selected && selected.thumbUrl) || '',
      })
    },

    savePetStateNow() {
      if (!wx.cloud || !activePetId) return
      wx.cloud.callFunction({ name: 'petState', data: { action: 'save', petId: activePetId, state: petState } }).catch(() => undefined)
    },

    selectRoom() {
      const selected = this.data.pickerRooms[this.data.activeRoomIndex] || this.data.pickerRooms[0]

      if (!selected) return

      activeRoomId = selected.id

      this.enterHomePage({
        backgroundMediaKind: selected.kind,
        backgroundMediaUrl: selected.resolvedMediaUrl || selected.mediaUrl,
      })
    },

    async handleListenTouchStart() {
      if (this.data.pageName !== 'home') return
      if (this.data.voiceStatus === 'uploading' || this.data.voiceStatus === 'transcribing' || this.data.voiceStatus === 'thinking') return

      this.setData({ orbPressed: true })
      const result = soulHandleEvent('user_speak', petState, petSceneQueue)
      petState = result.state
      petSceneQueue = result.queue
      this.syncPanelUI()
      this.prepareNextDecoder()

      if (!recorder) {
        this.initRecorder()
      }

      try {
        recordingStopping = false
        asrFallbackToUpload = true
        recorder!.start({
          duration: MAX_RECORD_MS,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: RECORD_FORMAT,
          frameSize: REALTIME_FRAME_SIZE_KB,
        })

        const realtimeReady = await this.prepareRealtimeAsr()
        asrFallbackToUpload = !realtimeReady
      } catch (error) {
        console.warn('[index] start recorder failed:', error)
        this.closeRealtimeAsr()
        this.setVoiceError('需要麦克风权限才能听你说话')
      }
    },

    handleListenTouchEnd() {
      this.setData({ orbPressed: false })
      if (!recorder || recordingStopping) return
      if (this.data.voiceStatus !== 'recording') {
        this.closeRealtimeAsr()
        recorder.stop()
        return
      }

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
      this.setData({ orbPressed: false })
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

        if (petState.lastInteractionAt && (Date.now() - petState.lastInteractionAt) > CHAT_TIMEOUT_MS) {
          chatHistory = []
        }

        const response = await wx.cloud.callFunction({
          name: 'aiRespond',
          data: {
            text,
            petId: selected.id,
            chatHistory: chatHistory.slice(-MAX_CHAT_HISTORY),
            petState: {
              energy: Math.round(petState.energy),
              affection: Math.round(petState.affection),
              mood: petState.mood,
              relationship: this.data.relationshipText,
              timeOfDay: getTimeOfDay(),
            },
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
        const nextAction = response.result.data && response.result.data.nextAction ? response.result.data.nextAction : 'idle'
        const emotion = response.result.data && response.result.data.emotion ? response.result.data.emotion : ''
        const meta = response.result.meta as Record<string, unknown> | undefined

        if (meta) {
          if (Array.isArray(meta.memories)) this.setData({ debugMemories: meta.memories as string[] })
          if (typeof meta.portrait === 'string') this.setData({ debugPortrait: meta.portrait as string })
          if (typeof meta.portraitUpdated === 'boolean') this.setData({ debugPortraitUpdated: meta.portraitUpdated })
          if (typeof meta.portraitMemoryCount === 'number') this.setData({ debugPortraitMemoryCount: meta.portraitMemoryCount })
          if (typeof meta.memorySource === 'string') this.setData({ debugMemorySource: meta.memorySource })
          if (typeof meta.memoryParseMode === 'string') this.setData({ debugMemoryParseMode: meta.memoryParseMode })
          if (meta.fallback) {
            console.warn('[index] AI fallback triggered:', meta.error || 'unknown reason')
          }
        }

        this.setData({
          voiceStatus: 'success',
          voiceHint: (meta && meta.fallback) ? '小团子先轻轻回应你' : '小团子回应你',
          petReply: reply,
        })
        petState = soulApplyEvent(petState, 'ai_replied')
        if (emotion) {
          const moodMap: Record<string, string> = { happy: '开心', curious: '好奇', gentle: '温柔', sleepy: '困了', excited: '兴奋' }
          petState = setMood(petState, moodMap[emotion] || '开心')
        }
        this.applyAiNextAction(nextAction)
        chatHistory.push({ user: text, pet: reply })
        if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift()
        this.syncPanelUI()
      } catch (error) {
        console.warn('[index] ai response failed:', error)
        this.setData({
          voiceStatus: 'success',
          voiceHint: '小团子听到了',
          petReply: '我听到啦，先陪你待一会儿。',
        })
        petState = soulApplyEvent(petState, 'ai_replied')
        this.syncPanelUI()
      }
    },

    applyAiNextAction(nextAction: string) {
      if (!nextAction || nextAction === 'idle') return

      if (nextAction === 'sleep-enter') {
        const result = soulHandleEvent('energy_low', petState, petSceneQueue)
        petState = result.state
        petSceneQueue = result.queue
        this.prepareNextDecoder()
      } else if (nextAction === 'listening') {
        const result = soulHandleEvent('user_speak', petState, petSceneQueue)
        petState = result.state
        petSceneQueue = result.queue
        this.prepareNextDecoder()
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

    startPetAudio() {
      this.stopPetAudio()

      if (!activePetAudioUrl) return

      wx.setInnerAudioOption({
        mixWithOther: true,
        obeyMuteSwitch: false,
      })

      const ctx = (wx.createInnerAudioContext as (options?: Record<string, unknown>) => WechatMiniprogram.InnerAudioContext)({
        useWebAudioImplement: true,
      })
      ctx.loop = true
      ctx.volume = 1.0

      if (activePetAudioUrl.startsWith('cloud://')) {
        wx.cloud.downloadFile({
          fileID: activePetAudioUrl,
        }).then((result) => {
          if (!petAudioContext || petAudioContext !== ctx) return
          ctx.src = result.tempFilePath
          ctx.play()
          console.info('[index] pet audio playing:', { src: result.tempFilePath })
        }).catch((error) => {
          console.warn('[index] pet audio download failed:', error)
        })
      } else {
        ctx.src = activePetAudioUrl
        ctx.play()
        console.info('[index] pet audio playing:', { src: activePetAudioUrl })
      }

      ctx.onPlay(() => {
        console.info('[index] pet audio onPlay fired')
      })

      ctx.onError((error) => {
        console.warn('[index] pet audio error:', error)
      })

      petAudioContext = ctx
    },

    stopPetAudio() {
      if (!petAudioContext) return

      try {
        petAudioContext.stop()
        petAudioContext.destroy()
      } catch (error) {
        console.warn('[index] pet audio stop failed:', error)
      }

      petAudioContext = null
    },

    pausePetAudio() {
      if (!petAudioContext) return

      try {
        petAudioContext.pause()
      } catch (error) {
        console.warn('[index] pet audio pause failed:', error)
      }
    },

    resumePetAudio() {
      if (!petAudioContext) return

      try {
        petAudioContext.play()
      } catch (error) {
        console.warn('[index] pet audio resume failed:', error)
      }
    },
  },
})
