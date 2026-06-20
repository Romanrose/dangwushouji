const api = require('../../utils/api')

const MATERIAL_OPTIONS = [
  { label: '档案袋（新）', category: '发展党员表册' },
  { label: '入党积极分子考察表（新）', category: '发展党员表册' },
  { label: '入党志愿书空表（新）', category: '发展党员表册' },
  { label: '预备党员考察表空表（新）', category: '发展党员表册' },
  { label: '个人档案袋', category: '个人档案', needPersonName: true },
  { label: '支部会议记录本（新）', category: '支部工作记录' },
  { label: '支部会议记录本', category: '支部工作记录', needMeetingBook: true },
  { label: '党支部书记工作手册', category: '工作手册' },
  { label: '发展党员工作指导手册', category: '工作手册' },
  { label: '厦门大学党校结业证书', category: '培训证书' },
  { label: '红心向党结业证书', category: '培训证书' },
  { label: '学习材料', category: '学习材料', needSpecificName: true },
  { label: '党章', category: '学习材料' },
  { label: '入党教材', category: '学习材料' },
  { label: '党徽', category: '标识用品' },
  { label: '党旗', category: '标识用品' },
  { label: '支部旗', category: '标识用品' }
]

const MEETING_BOOK_TYPES = [
  '支委会记录本',
  '固定党日记录本',
  '党课记录本',
  '组织生活会记录本',
  '党员大会记录本'
]

const BRANCH_OPTIONS = [
  '博士生党支部',
  '教职工党支部',
  '硕士生第一党支部',
  '硕士生第二党支部',
  '本科生党支部'
]

function getYearOptions() {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, index) => String(currentYear - index))
}

function splitLines(value) {
  return String(value || '')
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

Page({
  data: {
    mode: 'create',
    saving: false,
    resultMessage: '',
    assignedUsersText: '',
    deleteIdsText: '',
    receive_deadline: '',
    return_deadline: '',
    materialOptions: MATERIAL_OPTIONS,
    selectedMaterialIndex: -1,
    selectedMaterial: null,
    selectedMaterialLabel: '',
    showPersonNameNotice: false,
    showMeetingBookFields: false,
    showSpecificNameField: false,
    yearOptions: getYearOptions(),
    selectedYearIndex: -1,
    meeting_year: '',
    meetingBookTypes: MEETING_BOOK_TYPES,
    selectedMeetingTypeIndex: -1,
    meeting_book_type: '',
    specific_material_name: '',
    branchOptions: BRANCH_OPTIONS,
    selectedBranchIndex: -1,
    branch: ''
  },

  async onLoad() {
    const isTeacher = await api.ensureTeacher()
    if (!isTeacher) {
      wx.showModal({
        title: '无老师端权限',
        content: '学生端不能批量处理材料。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
    }
  },

  setMode(event) {
    this.setData({
      mode: event.currentTarget.dataset.mode,
      resultMessage: ''
    })
  },

  setMaterialType(event) {
    const selectedMaterialIndex = Number(event.detail.value)
    const selectedMaterial = MATERIAL_OPTIONS[selectedMaterialIndex]
    this.setData({
      selectedMaterialIndex,
      selectedMaterial,
      selectedMaterialLabel: selectedMaterial.label,
      showPersonNameNotice: Boolean(selectedMaterial.needPersonName),
      showMeetingBookFields: Boolean(selectedMaterial.needMeetingBook),
      showSpecificNameField: Boolean(selectedMaterial.needSpecificName),
      selectedYearIndex: -1,
      meeting_year: '',
      selectedMeetingTypeIndex: -1,
      meeting_book_type: '',
      specific_material_name: ''
    })
  },

  setMeetingYear(event) {
    const selectedYearIndex = Number(event.detail.value)
    this.setData({
      selectedYearIndex,
      meeting_year: this.data.yearOptions[selectedYearIndex]
    })
  },

  setMeetingBookType(event) {
    const selectedMeetingTypeIndex = Number(event.detail.value)
    this.setData({
      selectedMeetingTypeIndex,
      meeting_book_type: this.data.meetingBookTypes[selectedMeetingTypeIndex]
    })
  },

  setSpecificMaterialName(event) {
    this.setData({ specific_material_name: event.detail.value })
  },

  setBranch(event) {
    const selectedBranchIndex = Number(event.detail.value)
    this.setData({
      selectedBranchIndex,
      branch: BRANCH_OPTIONS[selectedBranchIndex]
    })
  },

  setAssignedUsers(event) {
    this.setData({ assignedUsersText: event.detail.value })
  },

  setDeleteIds(event) {
    this.setData({ deleteIdsText: event.detail.value })
  },

  setReceiveDeadline(event) {
    this.setData({ receive_deadline: event.detail.value })
  },

  setReturnDeadline(event) {
    this.setData({ return_deadline: event.detail.value })
  },

  buildMaterialName(material, detail) {
    if (material.needPersonName) {
      return `${material.label}（${detail.assignedUser}）`
    }
    if (material.needMeetingBook) {
      return `${detail.meetingYear}年${detail.meetingBookType}`
    }
    if (material.needSpecificName) {
      return `学习材料：${detail.specificMaterialName}`
    }
    return material.label
  },

  async submitBatchCreate(event) {
    if (this.data.saving) return
    const form = event.detail.value
    const selectedMaterial = this.data.selectedMaterial
    const assignedUsers = splitLines(this.data.assignedUsersText)
    const branch = String(this.data.branch || '').trim()
    const signerName = String(form.signer_name || '').trim()
    const meetingYear = String(this.data.meeting_year || '').trim()
    const meetingBookType = String(this.data.meeting_book_type || '').trim()
    const specificMaterialName = String(this.data.specific_material_name || '').trim()

    if (!selectedMaterial) {
      wx.showToast({ title: '请选择材料名称', icon: 'none' })
      return
    }
    if (selectedMaterial.needMeetingBook && (!meetingYear || !meetingBookType)) {
      wx.showToast({ title: '请选择年份和记录本类型', icon: 'none' })
      return
    }
    if (selectedMaterial.needSpecificName && !specificMaterialName) {
      wx.showToast({ title: '请填写具体材料名称', icon: 'none' })
      return
    }
    if (!branch) {
      wx.showToast({ title: '请选择领用人所在支部', icon: 'none' })
      return
    }
    if (!signerName) {
      wx.showToast({ title: '请填写签领人', icon: 'none' })
      return
    }
    if (assignedUsers.length === 0) {
      wx.showToast({ title: '请填写领用人姓名', icon: 'none' })
      return
    }
    if (assignedUsers.length > 200) {
      wx.showToast({ title: '单次最多 200 条', icon: 'none' })
      return
    }

    const items = assignedUsers.map((assignedUser) => ({
      name: this.buildMaterialName(selectedMaterial, {
        assignedUser,
        meetingYear,
        meetingBookType,
        specificMaterialName
      }),
      material_type: selectedMaterial.label,
      material_category: selectedMaterial.category,
      person_file_name: selectedMaterial.needPersonName ? assignedUser : '',
      meeting_year: meetingYear,
      meeting_book_type: meetingBookType,
      specific_material_name: specificMaterialName,
      batch_name: form.batch_name,
      branch,
      assigned_user: assignedUser,
      signer_name: signerName,
      receive_deadline: this.data.receive_deadline,
      return_deadline: this.data.return_deadline,
      remark: form.remark
    }))

    this.setData({ saving: true, resultMessage: '正在批量新增...' })
    try {
      const res = await api.callFunction({
        name: 'materialBatchCreate',
        data: { items }
      })
      const result = res.result || {}
      const ids = (result.materials || []).map((item) => item.material_id).slice(0, 5).join('、')
      this.setData({ resultMessage: `已新增 ${result.count || items.length} 条。${ids ? `前几条编号：${ids}` : ''}` })
      wx.showModal({
        title: '批量新增完成',
        content: `已新增 ${result.count || items.length} 条材料。`,
        showCancel: false
      })
    } catch (err) {
      const message = err.message || '批量新增失败'
      this.setData({ resultMessage: message })
      wx.showModal({
        title: '批量新增失败',
        content: message,
        showCancel: false
      })
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  submitBatchDelete() {
    if (this.data.saving) return
    const materialIds = splitLines(this.data.deleteIdsText)
    if (materialIds.length === 0) {
      wx.showToast({ title: '请填写材料编号', icon: 'none' })
      return
    }
    if (materialIds.length > 200) {
      wx.showToast({ title: '单次最多 200 条', icon: 'none' })
      return
    }

    wx.showModal({
      title: '批量删除',
      content: `将删除 ${materialIds.length} 条材料。删除后会从台账、统计和扫码登记中隐藏。`,
      confirmText: '删除',
      confirmColor: '#b91c1c',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ saving: true, resultMessage: '正在批量删除...' })
        try {
          const deleteRes = await api.callFunction({
            name: 'materialBatchDelete',
            data: {
              material_ids: materialIds,
              reason: '老师端批量删除'
            }
          })
          const result = deleteRes.result || {}
          const missing = result.notFoundIds || []
          const suffix = missing.length ? `，未找到 ${missing.length} 条` : ''
          this.setData({ resultMessage: `已删除 ${result.count || 0} 条${suffix}` })
          wx.showModal({
            title: '批量删除完成',
            content: `已删除 ${result.count || 0} 条材料${suffix}。`,
            showCancel: false
          })
        } catch (err) {
          const message = err.message || '批量删除失败'
          this.setData({ resultMessage: message })
          wx.showModal({
            title: '批量删除失败',
            content: message,
            showCancel: false
          })
          console.error(err)
        } finally {
          this.setData({ saving: false })
        }
      }
    })
  }
})
