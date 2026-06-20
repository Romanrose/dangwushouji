const { statusText, statusClass } = require('../../utils/status')
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    materials: [],
    filteredMaterials: [],
    demoMode: false,
    activeFilter: 'all',
    keyword: '',
    filters: [
      { value: 'all', label: '全部' },
      { value: 'pending_receive', label: '待领取' },
      { value: 'received', label: '未回收' },
      { value: 'returned', label: '已回收' }
    ]
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    try {
      const user = await api.login()
      if (!user.is_admin) {
        wx.showModal({
          title: '当前为学生端',
          content: '学生端只用于扫码登记，不显示台账和统计。',
          showCancel: false,
          success: () => wx.navigateTo({ url: '/pages/student/home/home' })
        })
        return
      }
      this.setData({
        demoMode: !api.canUseCloud() && !api.getVercelApiBaseUrl()
      })
      this.loadDashboard()
    } catch (err) {
      console.error(err)
      if (api.getVercelApiBaseUrl()) {
        this.setData({ loading: false })
        wx.showModal({
          title: '连接失败',
          content: '当前连接线上数据库，无法加载老师端数据。请检查网络后重试。',
          showCancel: false
        })
        return
      }
      api.setDemoRole('teacher')
      this.setData({
        demoMode: true
      })
      wx.showToast({ title: '已切到本地演示', icon: 'none' })
      this.loadDashboard()
    }
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh())
  },

  async loadDashboard() {
    this.setData({ loading: true })
    try {
      const res = await api.callFunction({
        name: 'dashboardStats'
      })
      const data = res.result || {}
      const materials = (data.recentMaterials || []).map((item) => ({
        ...item,
        statusText: statusText(item.status),
        statusClass: statusClass(item.status)
      }))
      this.setData({
        materials,
        loading: false
      })
      this.applyFilter()
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    }
  },

  setFilter(event) {
    this.setData({ activeFilter: event.currentTarget.dataset.value })
    this.applyFilter()
  },

  setKeyword(event) {
    this.setData({ keyword: event.detail.value })
    this.applyFilter()
  },

  applyFilter() {
    const { materials, activeFilter, keyword } = this.data
    const normalizedKeyword = String(keyword || '').trim().toLowerCase()
    const statusFiltered = activeFilter === 'all'
      ? materials
      : materials.filter((item) => item.status === activeFilter)
    const filteredMaterials = !normalizedKeyword
      ? statusFiltered
      : statusFiltered.filter((item) => {
        const text = [
          item.name,
          item.material_no,
          item.material_id,
          item.branch,
          item.assigned_user,
          item.signer_name,
          item.received_person
        ].join(' ').toLowerCase()
        return text.includes(normalizedKeyword)
      })
    this.setData({ filteredMaterials })
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/create/create',
      fail: (err) => {
        console.error('navigate to create failed', err)
        wx.showToast({ title: '无法打开新增页', icon: 'none' })
      }
    })
  },

  goBatch() {
    wx.navigateTo({
      url: '/pages/batch/batch',
      fail: (err) => {
        console.error('navigate to batch failed', err)
        wx.showToast({ title: '无法打开批量页', icon: 'none' })
      }
    })
  },

  async seedDemo() {
    try {
      await api.callFunction({ name: 'demoSeed' })
      wx.showToast({ title: '已生成示例', icon: 'success' })
      this.loadDashboard()
    } catch (err) {
      wx.showToast({ title: '生成失败', icon: 'none' })
      console.error(err)
    }
  },

  clearDemo() {
    wx.showModal({
      title: '清空演示数据',
      content: '这会删除本地缓存中的材料和流转记录。',
      success: (res) => {
        if (!res.confirm) return
        api.clearDemoStore()
        wx.showToast({ title: '已清空', icon: 'success' })
        this.loadDashboard()
      }
    })
  },

  switchStudent() {
    api.setDemoRole('student')
    wx.navigateTo({ url: '/pages/student/home/home' })
  },

  goTeachers() {
    wx.navigateTo({ url: '/pages/teachers/teachers' })
  },

  goDetail(event) {
    const materialId = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?material_id=${materialId}` })
  }
})
