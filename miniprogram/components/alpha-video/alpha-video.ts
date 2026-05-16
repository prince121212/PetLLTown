/**
 * 双通道MP4透明视频播放组件
 * 支持HEVC with Alpha格式（左右分割）
 * 左边：RGB彩色，右边：Alpha蒙版
 */

interface AlphaVideoData {
  canvasId: string
}

interface AlphaVideoProperties {
  src: string
  autoplay: boolean
  loop: boolean
  width: number
  height: number
}

let canvasIdCounter = 0

Component({
  properties: {
    src: {
      type: String,
      value: '',
    },
    autoplay: {
      type: Boolean,
      value: true,
    },
    loop: {
      type: Boolean,
      value: true,
    },
    width: {
      type: Number,
      value: 630,
    },
    height: {
      type: Number,
      value: 880,
    },
  } as Record<keyof AlphaVideoProperties, WechatMiniprogram.PropertyOption>,

  data: {
    canvasId: `alpha-video-${canvasIdCounter++}`,
  } as AlphaVideoData,

  lifetimes: {
    attached() {
      console.info('[alpha-video] component attached, src:', this.properties.src)
      wx.nextTick(() => {
        this.initVideo()
      })
    },
    detached() {
      console.info('[alpha-video] component detached')
      this.stopRender()
    },
  },

  pageLifetimes: {
    show() {
      console.info('[alpha-video] page show')
      this.startRender()
    },
    hide() {
      console.info('[alpha-video] page hide')
      this.stopRender()
    },
  },

  methods: {
    initVideo() {
      const { src, autoplay } = this.properties
      if (!src) {
        console.warn('[alpha-video] no src provided')
        return
      }

      // 创建video context并播放
      const videoContext = wx.createVideoContext('sourceVideo', this)
      if (autoplay) {
        videoContext.play()
        console.info('[alpha-video] video started playing')
      }

      // 延迟开始Canvas渲染，确保video已加载
      setTimeout(() => {
        this.startRender()
      }, 500)
    },

    startRender() {
      if (this.renderTimerId) {
        clearInterval(this.renderTimerId)
      }
      console.info('[alpha-video] start canvas render')
      // 16ms ≈ 60fps
      this.renderTimerId = setInterval(() => {
        this.renderFrame()
      }, 16)
    },

    stopRender() {
      if (this.renderTimerId) {
        clearInterval(this.renderTimerId)
        this.renderTimerId = null
      }
    },

    renderFrame() {
      const { canvasId } = this.data
      const { width, height } = this.properties

      const query = wx.createSelectorQuery().in(this)
      query.select(`#${canvasId}`).fields({ node: true, size: true }).exec((canvasRes) => {
        if (!canvasRes || !canvasRes[0] || !canvasRes[0].node) {
          return
        }

        const canvas = canvasRes[0].node
        const canvasSize = canvasRes[0]

        // 设置Canvas的实际尺寸
        if (canvasSize.width && canvasSize.height) {
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
        }

        // 获取video节点
        const videoQuery = wx.createSelectorQuery().in(this)
        videoQuery.select('#sourceVideo').fields({ node: true }).exec((videoRes) => {
          if (!videoRes || !videoRes[0]) {
            return
          }

          const videoNode = videoRes[0].node || videoRes[0]

          if (!videoNode) {
            return
          }

          // 尝试多种方式获取视频尺寸
          const videoWidth = videoNode.videoWidth || videoNode.width || 0
          const videoHeight = videoNode.videoHeight || videoNode.height || 0

          if (!videoWidth || !videoHeight) {
            return
          }

          this.compositeFrame(canvas, videoNode, width, height)
        })
      })
    },

    compositeFrame(canvas: any, video: any, width: number, height: number) {
      try {
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn('[alpha-video] cannot get 2d context')
          return
        }

        // 尝试多种方式获取视频尺寸
        const videoWidth = video.videoWidth || video.width || 0
        const videoHeight = video.videoHeight || video.height || 0

        if (!videoWidth || !videoHeight) {
          return
        }

        const halfWidth = videoWidth / 2

        // 清空Canvas
        ctx.clearRect(0, 0, width, height)

        // 第一步：绘制RGB通道（视频的左半部分）到Canvas
        ctx.drawImage(video, 0, 0, halfWidth, videoHeight, 0, 0, width, height)

        // 第二步：使用Alpha通道（视频的右半部分）进行透明度合成
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(video, halfWidth, 0, halfWidth, videoHeight, 0, 0, width, height)

        // 恢复默认合成模式
        ctx.globalCompositeOperation = 'source-over'
      } catch (error) {
        console.warn('[alpha-video] composite frame error:', error)
      }
    },
  },
})

declare global {
  interface Component {
    renderTimerId: number | null
  }
}
