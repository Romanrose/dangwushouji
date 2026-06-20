App({
  globalData: {
    user: null,
    role: 'student',
    isTeacher: false,
    cloudReady: false
  },

  onLaunch() {
    const account = wx.getAccountInfoSync ? wx.getAccountInfoSync() : {}
    const appId = account.miniProgram && account.miniProgram.appId

    if (!wx.cloud || !appId || appId === 'touristappid') {
      this.globalData.cloudReady = false
      return
    }

    wx.cloud.init({
      // TODO: 替换为你的云开发环境 ID（在微信开发者工具 → 云开发 → 设置 中查看）
      // env: 'your-env-id',
      traceUser: true
    })
    this.globalData.cloudReady = true
  }
})
