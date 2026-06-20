const { statusText, statusClass } = require('../../utils/status')
const api = require('../../utils/api')

const BRANCH_OPTIONS = [
  '博士生党支部',
  '教职工党支部',
  '硕士生第一党支部',
  '硕士生第二党支部',
  '本科生党支部'
]

Page({
  data: {
    loading: true,
    saving: false,
    materialId: '',
    material: null,
    isTeacher: false,
    statusText: '',
    statusClass: '',
    branchOptions: BRANCH_OPTIONS,
    selectedBranchIndex: -1,
    receiveBranch: '',
    completenessOptions: ['完整', '部分缺失', '异常'],
    completeness: '完整'
  },

  async onLoad(options) {
    await api.login()
    this.setData({
      materialId: options.material_id || '',
      isTeacher: api.isTeacher()
    })
    this.loadMaterial()
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
      const selectedBranchIndex = BRANCH_OPTIONS.indexOf(material.branch)
      this.setData({
        material,
        statusText: statusText(material.status),
        statusClass: statusClass(material.status),
        selectedBranchIndex,
        receiveBranch: selectedBranchIndex >= 0 ? material.branch : '',
        loading: false
      })
    } catch (err) {
      this.setData({ material: null, loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error(err)
    }
  },

  setCompleteness(event) {
    this.setData({
      completeness: this.data.completenessOptions[event.detail.value]
    })
  },

  setReceiveBranch(event) {
    const selectedBranchIndex = Number(event.detail.value)
    this.setData({
      selectedBranchIndex,
      receiveBranch: BRANCH_OPTIONS[selectedBranchIndex]
    })
  },

  async receive(event) {
    if (this.data.saving) return
    const form = event.detail.value
    if (!String(form.person || '').trim() || !String(form.operator || '').trim()) {
      wx.showToast({ title: '请填写领用人和签领人', icon: 'none' })
      return
    }
    if (!String(this.data.receiveBranch || '').trim()) {
      wx.showToast({ title: '请选择领用人所在支部', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await api.callFunction({
        name: 'materialReceive',
        data: {
          material_id: this.data.materialId,
          person: form.person,
          branch: this.data.receiveBranch,
          operator: form.operator,
          remark: form.remark
        }
      })
      wx.showToast({ title: '领取成功', icon: 'success' })
      await this.loadMaterial()
    } catch (err) {
      wx.showToast({ title: err.message || '领取失败', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  async returnMaterial(event) {
    if (this.data.saving) return
    const form = event.detail.value
    if (!String(form.operator || '').trim()) {
      wx.showToast({ title: '请填写签领人', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await api.callFunction({
        name: 'materialReturn',
        data: {
          material_id: this.data.materialId,
          operator: form.operator,
          completeness: this.data.completeness,
          remark: form.remark
        }
      })
      wx.showToast({ title: '回收成功', icon: 'success' })
      await this.loadMaterial()
    } catch (err) {
      wx.showToast({ title: err.message || '回收失败', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  goDetail() {
    if (!this.data.isTeacher) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: `/pages/detail/detail?material_id=${this.data.materialId}` })
  }
})
