import lottie from '../../libs/lottie-miniprogram/index'
import animationData from '../../assets/lottie/live-chatbot-animation'

type LottieAnimationInstance = {
  destroy?: () => void
  stop?: () => void
}

const lottieRuntime = (lottie as unknown as { default?: typeof lottie }).default || lottie
const ANIMATION_WIDTH = 952
const ANIMATION_HEIGHT = 784

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    mounted: false,
  },

  observers: {
    visible(value: boolean) {
      if (value) {
        this.ensureAnimation()
      } else {
        this.stopAnimation()
      }
    },
  },

  lifetimes: {
    attached() {
      this.ensureAnimation()
    },
    detached() {
      this.stopAnimation()
    },
  },

  methods: {
    ensureAnimation() {
      if (!this.properties.visible) return
      if ((this as { animation?: LottieAnimationInstance }).animation) return

      wx.nextTick(() => {
        const query = wx.createSelectorQuery().in(this)
        query.select('#lottieCanvas').node((res) => {
          const canvas = res && res.node
          if (!canvas) return

          const dpr = wx.getSystemInfoSync().pixelRatio || 1

          canvas.width = Math.max(1, Math.floor(384 * dpr))
          canvas.height = Math.max(1, Math.floor(384 * ANIMATION_HEIGHT / ANIMATION_WIDTH * dpr))

          lottieRuntime.setup(canvas)
          const context = canvas.getContext('2d')

          this.setData({ mounted: true })
          ;(this as { animation?: LottieAnimationInstance }).animation = lottieRuntime.loadAnimation({
            loop: true,
            autoplay: true,
            animationData,
            renderer: 'canvas',
            rendererSettings: {
              context,
              clearCanvas: true,
              preserveAspectRatio: 'xMidYMid meet',
            },
          }) as LottieAnimationInstance
        }).exec()
      })
    },

    stopAnimation() {
      const instance = (this as { animation?: LottieAnimationInstance }).animation
      if (instance) {
        try {
          instance.stop && instance.stop()
          instance.destroy && instance.destroy()
        } catch {
          // ignore
        }
        delete (this as { animation?: LottieAnimationInstance }).animation
      }
      this.setData({ mounted: false })
    },
  },
})
