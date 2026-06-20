const { formatTime } = require('../../utils/status')
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    stats: {},
    completionRate: 0,
    pendingPercent: 0,
    receivedPercent: 0,
    returnedPercent: 0,
    unreturned: [],
    branchSummary: [],
    recentRecords: []
  },

  async onShow() {
    const isTeacher = await api.ensureTeacher()
    if (!isTeacher) {
      wx.showModal({
        title: '无老师端权限',
        content: '学生端不能查看统计看板。',
        showCancel: false
      })
      return
    }
    this.loadStats()
  },

  onPullDownRefresh() {
    this.loadStats().finally(() => wx.stopPullDownRefresh())
  },

  async loadStats() {
    this.setData({ loading: true })
    try {
      const res = await api.callFunction({
        name: 'dashboardStats'
      })
      const data = res.result || {}
      const stats = data.stats || {}
      const total = stats.total || 0
      const percent = (value) => total ? Math.round((value || 0) / total * 100) : 0
      const branchSummary = (data.branchSummary || []).map((item) => ({
        ...item,
        pendingPercent: item.total ? Math.round((item.pending_receive || 0) / item.total * 100) : 0,
        receivedPercent: item.total ? Math.round((item.received || 0) / item.total * 100) : 0,
        returnedPercent: item.total ? Math.round((item.returned || 0) / item.total * 100) : 0
      }))
      const recentRecords = (data.recentRecords || []).map((item) => ({
        ...item,
        actionText: item.action_type === 'return' ? '回收' : '领取',
        action_time_text: formatTime(item.action_time)
      }))
      this.setData({
        stats,
        completionRate: percent(stats.returned),
        pendingPercent: percent(stats.pending_receive),
        receivedPercent: percent(stats.received),
        returnedPercent: percent(stats.returned),
        unreturned: data.unreturned || [],
        branchSummary,
        recentRecords,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    }
  },

  goDetail(event) {
    const materialId = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?material_id=${materialId}` })
  }
})
