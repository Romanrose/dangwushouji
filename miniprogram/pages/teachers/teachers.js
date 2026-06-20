const api = require('../../utils/api')
const { formatTime } = require('../../utils/status')

Page({
  data: {
    loading: true,
    saving: false,
    currentUser: {},
    teachers: [],
    applications: []
  },

  async onLoad() {
    const isTeacher = await api.ensureTeacher()
    if (!isTeacher) {
      wx.showModal({
        title: '无老师端权限',
        content: '只有老师端可以管理老师名单。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
      return
    }
    this.setData({ currentUser: api.getCurrentUser() || {} })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [teacherRes, applicationRes] = await Promise.all([
        api.callFunction({ name: 'listTeachers' }),
        api.callFunction({ name: 'listTeacherApplications' })
      ])
      const teachers = (teacherRes.result.teachers || []).map((item) => ({
        ...item,
        created_at_text: formatTime(item.created_at)
      }))
      const applications = (applicationRes.result.applications || []).map((item) => ({
        ...item,
        created_at_text: formatTime(item.created_at),
        updated_at_text: formatTime(item.updated_at),
        status_text: this.getApplicationStatusText(item.status)
      }))
      this.setData({ teachers, applications, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showModal({
        title: '加载失败',
        content: err.message || '无法获取老师名单',
        showCancel: false
      })
      console.error(err)
    }
  },

  getApplicationStatusText(status) {
    if (status === 'approved') return '已通过'
    if (status === 'rejected') return '已拒绝'
    return '待审核'
  },

  async addTeacher(event) {
    if (this.data.saving) return
    const form = event.detail.value
    const targetOpenid = String(form.target_openid || '').trim()
    const targetName = String(form.target_name || '').trim()
    if (!targetOpenid) {
      wx.showToast({ title: '请输入 openid', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await api.callFunction({
        name: 'addTeacher',
        data: {
          target_openid: targetOpenid,
          target_name: targetName
        }
      })
      wx.showToast({ title: '已添加', icon: 'success' })
      this.loadData()
    } catch (err) {
      wx.showModal({
        title: '添加失败',
        content: err.message || '无法添加老师',
        showCancel: false
      })
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  removeTeacher(event) {
    const targetOpenid = event.currentTarget.dataset.openid
    wx.showModal({
      title: '移除老师',
      content: '移除后，该用户将不能进入老师端。确定继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.callFunction({
            name: 'removeTeacher',
            data: {
              target_openid: targetOpenid
            }
          })
          wx.showToast({ title: '已移除', icon: 'success' })
          this.loadData()
        } catch (err) {
          wx.showModal({
            title: '移除失败',
            content: err.message || '无法移除老师',
            showCancel: false
          })
          console.error(err)
        }
      }
    })
  },

  approveApplication(event) {
    const targetOpenid = event.currentTarget.dataset.openid
    wx.showModal({
      title: '通过申请',
      content: '通过后，该微信用户将可以进入老师端。确定继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.callFunction({
            name: 'approveTeacher',
            data: {
              target_openid: targetOpenid
            }
          })
          wx.showToast({ title: '已通过', icon: 'success' })
          this.loadData()
        } catch (err) {
          wx.showModal({
            title: '操作失败',
            content: err.message || '无法通过申请',
            showCancel: false
          })
          console.error(err)
        }
      }
    })
  },

  rejectApplication(event) {
    const targetOpenid = event.currentTarget.dataset.openid
    wx.showModal({
      title: '拒绝申请',
      content: '拒绝后，对方可重新提交申请。确定继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.callFunction({
            name: 'rejectTeacher',
            data: {
              target_openid: targetOpenid
            }
          })
          wx.showToast({ title: '已拒绝', icon: 'success' })
          this.loadData()
        } catch (err) {
          wx.showModal({
            title: '操作失败',
            content: err.message || '无法拒绝申请',
            showCancel: false
          })
          console.error(err)
        }
      }
    })
  },

  copyCurrentOpenid() {
    const openid = this.data.currentUser.openid
    if (!openid) return
    wx.setClipboardData({ data: openid })
  }
})
