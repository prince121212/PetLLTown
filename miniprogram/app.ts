import { CLOUD_OPTIONS } from './config/cloud'

App<IAppOption>({
  globalData: {
    cloudReady: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.warn('[app] wx.cloud is unavailable')
      return
    }

    wx.cloud.init(CLOUD_OPTIONS)
    this.globalData.cloudReady = true
  },
})
