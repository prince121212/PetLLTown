import {
  BootstrapFunctionResult,
  FALLBACK_BOOTSTRAP_CONFIG,
  HomeMediaConfig,
  PageName,
  PetOption,
  SettingItem,
  normalizeBootstrapConfig,
} from '../../config/bootstrap'

type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'thinking' | 'success' | 'error'

interface PageData {
  pageName: PageName
  appName: string
  petName: string
  homeHint: string
  pageShellStyle: string
  homeTopStyle: string
  homeStageStyle: string
  listenOrbVideoUrl: string
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

interface TextureRect {
  x: number
  y: number
  width: number
  height: number
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
  backgroundTexture: WebGLHandle
  positionLocation: number
  texCoordLocation: number
  samplerLocation: WebGLHandle
  backgroundSamplerLocation: WebGLHandle
  rgbRectLocation: WebGLHandle
  alphaRectLocation: WebGLHandle
  backgroundRectLocation: WebGLHandle
  hasBackgroundLocation: WebGLHandle
}

let petVideoCanvas: PetVideoCanvasNode | null = null
let petVideoGl: PetWebGLRenderingContext | null = null
let petVideoProgram: AlphaVideoProgram | null = null
let petVideoDecoder: PetVideoDecoder | null = null
let petVideoFrameRequest = 0
let petVideoStartTimer = 0
let petVideoFrameData: Uint8Array | null = null
let petVideoSourceCache: Record<string, string> = {}
let petVideoStartingUrl = ''
let petVideoActiveUrl = ''
let petVideoFirstFrameLogged = false
let petVideoFrameShapeWarned = false
let petVideoFramePending = false
let petVideoAlphaSamplesLogged = false
let petVideoBackgroundReady = false
let petVideoBackgroundRect: TextureRect = { x: 0, y: 0, width: 1, height: 1 }
let activePetVideoUrl = ''
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
const MAX_RECORD_MS = 15000
const RECORD_FORMAT: 'mp3' = 'mp3'
const RECORDER_STOP_FALLBACK_MS = 1800
const REALTIME_FRAME_SIZE_KB = 4
const ALPHA_VIDEO_START_TIMEOUT_MS = 5000
const RGBA_BYTES_PER_PIXEL = 4
const HOME_WALLPAPER_SRC = '/pages/index/wallpaper.jpg'
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
uniform sampler2D u_backgroundTexture;
uniform vec4 u_rgbRect;
uniform vec4 u_alphaRect;
uniform vec4 u_backgroundRect;
uniform float u_hasBackground;
varying vec2 v_texCoord;

vec2 mapRect(vec4 rect, vec2 uv) {
  return rect.xy + uv * rect.zw;
}

void main() {
  vec4 color = texture2D(u_texture, mapRect(u_rgbRect, v_texCoord));
  vec4 mask = texture2D(u_texture, mapRect(u_alphaRect, v_texCoord));
  vec4 background = texture2D(u_backgroundTexture, mapRect(u_backgroundRect, v_texCoord));
  float alpha = mask.r;
  vec4 transparentPet = vec4(color.rgb * alpha, alpha);
  vec4 compositedPet = vec4(mix(background.rgb, color.rgb, alpha), 1.0);
  gl_FragColor = mix(transparentPet, compositedPet, u_hasBackground);
}
`

function buildPickerPets(pets: PetOption[]): Array<PetOption & { frame: string }> {
  return pets.map((pet) => ({
    ...pet,
    frame: pet.thumbUrl || '',
  }))
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === 'function'
}

function buildPageData(config = bootstrapConfig): Partial<PageData> {
  const pets = config.pets.filter((pet) => pet.enabled !== false)
  const activePet = pets.find((pet) => pet.id === config.defaultPetId) || pets[0]
  const petName = activePet ? activePet.name : config.defaultPetName
  activePetVideoUrl = (activePet && activePet.videoUrl) || config.homeMedia.petVideoUrl

  return {
    appName: config.appName,
    petName,
    homeHint: config.homeHint,
    listenOrbVideoUrl: config.homeMedia.listenOrbVideoUrl,
    listenFrame: (activePet && activePet.listenFrameUrl) || '',
    settingsThumb: (activePet && activePet.thumbUrl) || '',
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
    listenOrbVideoUrl: FALLBACK_BOOTSTRAP_CONFIG.homeMedia.listenOrbVideoUrl,
    listenFrame: FALLBACK_BOOTSTRAP_CONFIG.pets[0] && FALLBACK_BOOTSTRAP_CONFIG.pets[0].listenFrameUrl ? FALLBACK_BOOTSTRAP_CONFIG.pets[0].listenFrameUrl : '',
    settingsThumb: FALLBACK_BOOTSTRAP_CONFIG.pets[0] && FALLBACK_BOOTSTRAP_CONFIG.pets[0].thumbUrl ? FALLBACK_BOOTSTRAP_CONFIG.pets[0].thumbUrl : '',
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
      this.initPetVideoCanvas()
    },
    detached() {
      this.stopAlphaVideo()
    },
  },

  pageLifetimes: {
    show() {
      this.startPetRenderer()
    },
    hide() {
      this.stopAlphaVideo()
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
      wx.nextTick(() => {
        const query = wx.createSelectorQuery().in(this)

        query
          .select('#petVideoCanvas')
          .fields({ node: true, size: true, rect: true })
          .exec((result) => {
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
            this.loadPetCanvasBackground(canvas, gl, petVideoProgram, {
              width: target.width,
              height: target.height,
              left: typeof target.left === 'number' ? target.left : null,
              top: typeof target.top === 'number' ? target.top : null,
            })
            this.startPetRenderer()
          })
      })
    },

    loadPetCanvasBackground(
      canvas: PetVideoCanvasNode,
      gl: PetWebGLRenderingContext,
      resources: AlphaVideoProgram,
      canvasRect: { width: number; height: number; left: number | null; top: number | null },
    ) {
      const image = canvas.createImage()
      petVideoBackgroundReady = false
      petVideoBackgroundRect = { x: 0, y: 0, width: 1, height: 1 }

      image.onload = () => {
        petVideoBackgroundRect = this.computeStageBackgroundRect(canvasRect, image.width, image.height)
        gl.activeTexture(gl.TEXTURE0 + 1)
        gl.bindTexture(gl.TEXTURE_2D, resources.backgroundTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        petVideoBackgroundReady = true
        console.info('[index] alpha video background texture ready:', {
          imageWidth: image.width,
          imageHeight: image.height,
          backgroundRect: petVideoBackgroundRect,
        })
      }

      image.onerror = (error) => {
        petVideoBackgroundReady = false
        console.warn('[index] alpha video background texture failed:', error)
      }

      image.src = HOME_WALLPAPER_SRC
    },

    startPetRenderer() {
      if (petVideoGl && petVideoProgram && activePetVideoUrl) {
        this.startAlphaVideo(activePetVideoUrl)
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
          console.info('[index] alpha video decoder started:', {
            url,
            source,
            detail: args[0] || null,
          })
          this.renderAlphaVideoFrame()
        })
        decoder.on('seek', (...args) => {
          console.info('[index] alpha video decoder seek:', args[0] || null)
        })
        decoder.on('stop', () => {
          console.info('[index] alpha video decoder stopped:', { url })
        })
        decoder.on('ended', () => {
          console.info('[index] alpha video decoder ended, seeking to start')
          try {
            decoder.seek(0)
          } catch (error) {
            console.warn('[index] alpha video seek failed:', error)
          }
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

    stopAlphaVideo() {
      petVideoStartingUrl = ''
      petVideoActiveUrl = ''
      petVideoFirstFrameLogged = false
      petVideoFrameShapeWarned = false
      petVideoFramePending = false
      petVideoAlphaSamplesLogged = false

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

      if (!petVideoFramePending) {
        const frameResult = petVideoDecoder.getFrameData()

        if (isPromiseLike(frameResult)) {
          petVideoFramePending = true
          frameResult
            .then((frame) => {
              petVideoFramePending = false
              if (frame && frame.data && frame.width && frame.height) {
                this.drawAlphaVideoFrame(frame)
              }
            })
            .catch((error) => {
              petVideoFramePending = false
              console.warn('[index] alpha video getFrameData failed:', error)
            })
        } else if (frameResult && frameResult.data && frameResult.width && frameResult.height) {
          this.drawAlphaVideoFrame(frameResult)
        }
      }

      petVideoFrameRequest = petVideoCanvas.requestAnimationFrame(() => {
        this.renderAlphaVideoFrame()
      })
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
      gl.uniform1i(resources.backgroundSamplerLocation, 1)

      gl.uniform4f(resources.rgbRectLocation, split.rgbX, split.rgbY, split.rgbWidth, split.rgbHeight)
      gl.uniform4f(resources.alphaRectLocation, split.alphaX, split.alphaY, split.alphaWidth, split.alphaHeight)
      gl.uniform4f(
        resources.backgroundRectLocation,
        petVideoBackgroundRect.x,
        petVideoBackgroundRect.y,
        petVideoBackgroundRect.width,
        petVideoBackgroundRect.height,
      )
      gl.uniform1f(resources.hasBackgroundLocation, petVideoBackgroundReady ? 1 : 0)

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

    computeStageBackgroundRect(
      canvasRect: { width: number; height: number; left: number | null; top: number | null },
      imageWidth: number,
      imageHeight: number,
    ): TextureRect {
      const systemInfo = wx.getSystemInfoSync()
      const viewportWidth = systemInfo.windowWidth || canvasRect.width
      const viewportHeight = systemInfo.windowHeight || canvasRect.height
      const canvasLeft = canvasRect.left === null ? (viewportWidth - canvasRect.width) / 2 : canvasRect.left
      const canvasTop = canvasRect.top === null ? Math.max(0, (systemInfo.statusBarHeight || 0) + 77) : canvasRect.top
      const wallpaperScale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight)
      const fittedWidth = imageWidth * wallpaperScale
      const fittedHeight = imageHeight * wallpaperScale
      const wallpaperLeft = (viewportWidth - fittedWidth) / 2
      const wallpaperTop = (viewportHeight - fittedHeight) / 2

      return {
        x: (canvasLeft - wallpaperLeft) / fittedWidth,
        y: (canvasTop - wallpaperTop) / fittedHeight,
        width: canvasRect.width / fittedWidth,
        height: canvasRect.height / fittedHeight,
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
      const backgroundTexture = gl.createTexture()
      const samplerLocation = gl.getUniformLocation(program, 'u_texture')
      const backgroundSamplerLocation = gl.getUniformLocation(program, 'u_backgroundTexture')
      const rgbRectLocation = gl.getUniformLocation(program, 'u_rgbRect')
      const alphaRectLocation = gl.getUniformLocation(program, 'u_alphaRect')
      const backgroundRectLocation = gl.getUniformLocation(program, 'u_backgroundRect')
      const hasBackgroundLocation = gl.getUniformLocation(program, 'u_hasBackground')

      if (
        !positionBuffer ||
        !texCoordBuffer ||
        !texture ||
        !backgroundTexture ||
        !samplerLocation ||
        !backgroundSamplerLocation ||
        !rgbRectLocation ||
        !alphaRectLocation ||
        !backgroundRectLocation ||
        !hasBackgroundLocation
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
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))

      gl.useProgram(program)
      gl.uniform1i(samplerLocation, 0)
      gl.uniform1i(backgroundSamplerLocation, 1)
      gl.uniform4f(backgroundRectLocation, 0, 0, 1, 1)
      gl.uniform1f(hasBackgroundLocation, 0)
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
        backgroundTexture,
        positionLocation,
        texCoordLocation,
        samplerLocation,
        backgroundSamplerLocation,
        rgbRectLocation,
        alphaRectLocation,
        backgroundRectLocation,
        hasBackgroundLocation,
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
      this.setData(buildPageData(config))
      this.resolveHomeMedia(config.homeMedia)
      this.startPetRenderer()
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

    async resolveHomeMedia(media: HomeMediaConfig) {
      if (!wx.cloud) return

      const cloudUrls = [media.listenOrbVideoUrl].filter((url) => url.startsWith('cloud://'))

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
      activePetVideoUrl = (selected && selected.videoUrl) || bootstrapConfig.homeMedia.petVideoUrl
      this.setData({
        petName: selected.name,
        settingsThumb: (selected && selected.thumbUrl) || '',
        pageName: 'home',
      })
      this.startPetRenderer()
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
