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
  '教工第一党支部',
  '教工第二党支部',
  '硕士生第一党支部',
  '硕士生第二党支部',
  '本科生党支部'
]

function getYearOptions() {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, index) => String(currentYear - index))
}

Page({
  data: {
    saving: false,
    saveMessage: '',
    receive_deadline: '',
    return_deadline: '',
    materialOptions: MATERIAL_OPTIONS,
    selectedMaterialIndex: -1,
    selectedMaterial: null,
    selectedMaterialLabel: '',
    showPersonNameField: false,
    showMeetingBookFields: false,
    showSpecificNameField: false,
    person_file_name: '',
    yearOptions: getYearOptions(),
    selectedYearIndex: -1,
    meeting_year: '',
    meetingBookTypes: MEETING_BOOK_TYPES,
    selectedMeetingTypeIndex: -1,
    meeting_book_type: '',
    specific_material_name: '',
    branchOptions: BRANCH_OPTIONS,
    selectedBranchIndex: -1,
    branch: '',
    custom_branch: ''
  },

  async onLoad() {
    const isTeacher = await api.ensureTeacher()
    if (!isTeacher) {
      wx.showModal({
        title: '无老师端权限',
        content: '学生端不能新增材料，请返回扫码登记。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
    }
  },

  setMaterialType(event) {
    const selectedMaterialIndex = Number(event.detail.value)
    const selectedMaterial = MATERIAL_OPTIONS[selectedMaterialIndex]
    this.setData({
      selectedMaterialIndex,
      selectedMaterial,
      selectedMaterialLabel: selectedMaterial.label,
      showPersonNameField: Boolean(selectedMaterial.needPersonName),
      showMeetingBookFields: Boolean(selectedMaterial.needMeetingBook),
      showSpecificNameField: Boolean(selectedMaterial.needSpecificName),
      person_file_name: '',
      selectedYearIndex: -1,
      meeting_year: '',
      selectedMeetingTypeIndex: -1,
      meeting_book_type: '',
      specific_material_name: ''
    })
  },

  setPersonFileName(event) {
    this.setData({ person_file_name: event.detail.value })
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
    const selectedBranch = BRANCH_OPTIONS[selectedBranchIndex]
    this.setData({
      selectedBranchIndex,
      branch: selectedBranch,
      custom_branch: ''
    })
  },

  setReceiveDeadline(event) {
    this.setData({ receive_deadline: event.detail.value })
  },

  setReturnDeadline(event) {
    this.setData({ return_deadline: event.detail.value })
  },

  async submit(event) {
    if (this.data.saving) return
    this.setData({ saveMessage: '' })
    const form = event.detail.value
    const selectedMaterial = this.data.selectedMaterial
    if (!selectedMaterial) {
      wx.showToast({ title: '请选择材料名称', icon: 'none' })
      return
    }
    const personFileName = String(this.data.person_file_name || '').trim()
    const meetingYear = String(this.data.meeting_year || '').trim()
    const meetingBookType = String(this.data.meeting_book_type || '').trim()
    const specificMaterialName = String(this.data.specific_material_name || '').trim()
    const branch = String(this.data.branch || '').trim()
    const assignedUser = String(form.assigned_user || '').trim()
    const signerName = String(form.signer_name || '').trim()

    if (selectedMaterial.needPersonName && !personFileName) {
      wx.showToast({ title: '请填写资料袋人员姓名', icon: 'none' })
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
    if (!assignedUser) {
      wx.showToast({ title: '请填写领用人姓名', icon: 'none' })
      return
    }
    if (!signerName) {
      wx.showToast({ title: '请填写签领人', icon: 'none' })
      return
    }

    const materialName = this.buildMaterialName(selectedMaterial, {
      personFileName,
      meetingYear,
      meetingBookType,
      specificMaterialName
    })

    this.setData({ saving: true, saveMessage: '正在保存材料...' })
    try {
      const res = await api.callFunction({
        name: 'materialCreate',
        data: {
          ...form,
          name: materialName,
          branch,
          assigned_user: assignedUser,
          signer_name: signerName,
          material_type: selectedMaterial.label,
          material_category: selectedMaterial.category,
          person_file_name: personFileName,
          meeting_year: meetingYear,
          meeting_book_type: meetingBookType,
          specific_material_name: specificMaterialName,
          receive_deadline: this.data.receive_deadline,
          return_deadline: this.data.return_deadline
        }
      })
      const materialId = res.result.material.material_id
      this.setData({ saveMessage: `已保存：${materialName}` })
      wx.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/detail/detail?material_id=${materialId}`,
          fail: (err) => {
            console.error('redirect to detail failed', err)
            wx.showModal({
              title: '已保存，但未能打开详情',
              content: `材料已保存。请返回台账查看。\n${err.errMsg || ''}`,
              showCancel: false
            })
          }
        })
      }, 500)
    } catch (err) {
      const message = err.message || err.errMsg || '创建失败'
      this.setData({ saveMessage: message })
      wx.showModal({
        title: '保存失败',
        content: message,
        showCancel: false
      })
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  buildMaterialName(material, detail) {
    if (material.needPersonName) {
      return `${material.label}（${detail.personFileName}）`
    }
    if (material.needMeetingBook) {
      return `${detail.meetingYear}年${detail.meetingBookType}`
    }
    if (material.needSpecificName) {
      return `学习材料：${detail.specificMaterialName}`
    }
    return material.label
  }
})
