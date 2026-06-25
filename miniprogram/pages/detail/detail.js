const { statusText, statusClass, formatTime } = require('../../utils/status')
const api = require('../../utils/api')
const { drawQRCode } = require('../../utils/qrcode')

Page({
  data: {
    loading: true,
    deleting: false,
    materialId: '',
    material: null,
    records: [],
    statusText: '',
    statusClass: '',
    scanPath: '',
    officialQrUrl: '',
    useFallbackQr: false
  },

  async onLoad(options) {
    const isTeacher = await api.ensureTeacher()
    if (!isTeacher) {
      wx.showModal({
        title: '无老师端权限',
        content: '学生端不能查看材料详情和完整流转记录。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
      return
    }
    this.setData({ materialId: options.material_id || '' })
    this.loadMaterial()
  },

  onPullDownRefresh() {
    this.loadMaterial().finally(() => wx.stopPullDownRefresh())
  },

  async loadMaterial() {
    const materialId = this.data.materialId
    if (!materialId) {
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.callFunction({
        name: 'materialGet',
        data: { material_id: materialId }
      })
      const material = res.result.material
      const records = (res.result.records || []).map((record) => ({
        ...record,
        actionText: this.getActionText(record.action_type),
        action_time_text: formatTime(record.action_time)
      }))
      this.setData({
        material,
        records,
        statusText: statusText(material.status),
        statusClass: statusClass(material.status),
        scanPath: `/pages/scan/scan?material_id=${material.material_id}`,
        officialQrUrl: this.getOfficialQrUrl(material.material_id),
        useFallbackQr: false,
        loading: false
      })

      if (!this.data.officialQrUrl) {
        this.setData({ useFallbackQr: true })
        this.drawQR()
      }
    } catch (err) {
      this.setData({ loading: false, material: null })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    }
  },

  getActionText(actionType) {
    if (actionType === 'receive') return '领取'
    if (actionType === 'return') return '回收'
    if (actionType === 'delete') return '删除'
    return '操作'
  },

  copyPath() {
    wx.setClipboardData({ data: this.data.scanPath })
  },

  getOfficialQrUrl(materialId) {
    const baseUrl = api.getVercelApiBaseUrl()
    if (!baseUrl || !materialId) return ''
    return `${baseUrl}/api/wxacode?material_id=${encodeURIComponent(materialId)}`
  },

  onOfficialQrLoad() {
    this.setData({ useFallbackQr: false })
  },

  onOfficialQrError(err) {
    console.warn('official wxacode load failed, fallback to path qr', err)
    this.setData({ useFallbackQr: true })
    this.drawQR()
  },

  openScan() {
    wx.navigateTo({ url: this.data.scanPath })
  },

  drawQR() {
    const query = wx.createSelectorQuery()
    query.select('#qrCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        drawQRCode(canvas, this.data.scanPath, {
          moduleSize: 4,
          margin: 4
        })
      })
  },

  saveQR() {
    if (this.data.officialQrUrl && !this.data.useFallbackQr) {
      wx.downloadFile({
        url: this.data.officialQrUrl,
        success: (result) => {
          if (result.statusCode !== 200) {
            wx.showToast({ title: '保存失败，请重试', icon: 'none' })
            return
          }
          wx.saveImageToPhotosAlbum({
            filePath: result.tempFilePath,
            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' })
          })
        },
        fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
      })
      return
    }

    const query = wx.createSelectorQuery()
    query.select('#qrCanvas')
      .fields({ node: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        wx.canvasToTempFilePath({
          canvas,
          success: (result) => {
            wx.saveImageToPhotosAlbum({
              filePath: result.tempFilePath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: () => wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' })
            })
          }
        })
      })
  },

  deleteMaterial() {
    if (this.data.deleting || !this.data.materialId) return
    wx.showModal({
      title: '删除材料',
      content: '删除后这份材料会从台账、统计和扫码登记中隐藏。确定删除吗？',
      confirmText: '删除',
      confirmColor: '#b91c1c',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ deleting: true })
        try {
          await api.callFunction({
            name: 'materialDelete',
            data: {
              material_id: this.data.materialId,
              reason: '老师端删除'
            }
          })
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack({
              fail: () => wx.switchTab({ url: '/pages/index/index' })
            })
          }, 500)
        } catch (err) {
          wx.showModal({
            title: '删除失败',
            content: err.message || '无法删除材料',
            showCancel: false
          })
          console.error(err)
        } finally {
          this.setData({ deleting: false })
        }
      }
    })
  }
})
