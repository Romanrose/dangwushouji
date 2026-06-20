const { statusText, statusClass, formatTime } = require('../../utils/status')
const api = require('../../utils/api')
const { drawQRCode } = require('../../utils/qrcode')

Page({
  data: {
    loading: true,
    materialId: '',
    material: null,
    records: [],
    statusText: '',
    statusClass: '',
    scanPath: ''
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
        actionText: record.action_type === 'receive' ? '领取' : '回收',
        action_time_text: formatTime(record.action_time)
      }))
      this.setData({
        material,
        records,
        statusText: statusText(material.status),
        statusClass: statusClass(material.status),
        scanPath: `/pages/scan/scan?material_id=${material.material_id}`,
        loading: false
      })

      // 绘制二维码
      this.drawQR()
    } catch (err) {
      this.setData({ loading: false, material: null })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    }
  },

  copyPath() {
    wx.setClipboardData({ data: this.data.scanPath })
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
  }
})
