const { statusText, statusClass } = require('../../utils/status')
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    materials: [],
    filteredMaterials: [],
    demoMode: false,
    deleting: false,
    selectionMode: false,
    selectedIds: [],
    selectedCount: 0,
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
      const visibleIds = new Set(materials.map((item) => item.material_id))
      const selectedIds = this.data.selectedIds.filter((id) => visibleIds.has(id))
      this.setData({
        materials,
        selectedIds,
        selectedCount: selectedIds.length,
        selectionMode: this.data.selectionMode && selectedIds.length > 0,
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
    const { materials, activeFilter, keyword, selectedIds } = this.data
    const selectedSet = new Set(selectedIds)
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
    this.setData({
      filteredMaterials: filteredMaterials.map((item) => ({
        ...item,
        selected: selectedSet.has(item.material_id)
      }))
    })
  },

  toggleSelectionMode() {
    const nextSelectionMode = !this.data.selectionMode
    this.setData({
      selectionMode: nextSelectionMode,
      selectedIds: nextSelectionMode ? this.data.selectedIds : [],
      selectedCount: nextSelectionMode ? this.data.selectedIds.length : 0
    })
    this.applyFilter()
  },

  clearSelection() {
    this.setData({
      selectedIds: [],
      selectedCount: 0
    })
    this.applyFilter()
  },

  selectAllFiltered() {
    const ids = this.data.filteredMaterials.map((item) => item.material_id)
    this.setData({
      selectedIds: ids,
      selectedCount: ids.length
    })
    this.applyFilter()
  },

  toggleMaterialSelection(event) {
    const materialId = event.currentTarget.dataset.id
    this.toggleMaterialSelectionById(materialId)
  },

  toggleMaterialSelectionById(materialId) {
    if (!materialId) return
    const selectedSet = new Set(this.data.selectedIds)
    if (selectedSet.has(materialId)) {
      selectedSet.delete(materialId)
    } else {
      selectedSet.add(materialId)
    }
    const selectedIds = Array.from(selectedSet)
    this.setData({
      selectedIds,
      selectedCount: selectedIds.length
    })
    this.applyFilter()
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

  handleItemTap(event) {
    const materialId = event.currentTarget.dataset.id
    if (this.data.selectionMode) {
      this.toggleMaterialSelectionById(materialId)
      return
    }
    wx.navigateTo({ url: `/pages/detail/detail?material_id=${materialId}` })
  },

  showItemMenu(event) {
    const materialId = event.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['删除'],
      itemColor: '#b91c1c',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.confirmDeleteMaterial(materialId)
        }
      }
    })
  },

  confirmDeleteMaterial(materialId) {
    if (!materialId || this.data.deleting) return
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
              material_id: materialId,
              reason: '台账三点菜单删除'
            }
          })
          wx.showToast({ title: '已删除', icon: 'success' })
          await this.loadDashboard()
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
  },

  deleteSelectedMaterials() {
    const materialIds = this.data.selectedIds
    if (this.data.deleting) return
    if (materialIds.length === 0) {
      wx.showToast({ title: '请先选择材料', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除选中材料',
      content: `将删除 ${materialIds.length} 条材料。删除后会从台账、统计和扫码登记中隐藏。`,
      confirmText: '删除',
      confirmColor: '#b91c1c',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ deleting: true })
        try {
          const deleteRes = await api.callFunction({
            name: 'materialBatchDelete',
            data: {
              material_ids: materialIds,
              reason: '台账批量选中删除'
            }
          })
          const result = deleteRes.result || {}
          const missing = result.notFoundIds || []
          this.setData({
            selectedIds: [],
            selectedCount: 0,
            selectionMode: false
          })
          wx.showToast({ title: `已删除 ${result.count || 0} 条`, icon: 'success' })
          await this.loadDashboard()
          if (missing.length > 0) {
            wx.showModal({
              title: '部分未删除',
              content: `${missing.length} 条材料不存在或已删除。`,
              showCancel: false
            })
          }
        } catch (err) {
          wx.showModal({
            title: '批量删除失败',
            content: err.message || '无法删除选中材料',
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
