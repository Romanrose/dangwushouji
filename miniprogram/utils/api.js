const STORAGE_KEY = 'dangwu_demo_store'
const ROLE_KEY = 'dangwu_demo_role'
const config = require('../config')
const BRANCH_OPTIONS = [
  '博士生党支部',
  '教工第一党支部',
  '教工第二党支部',
  '硕士生第一党支部',
  '硕士生第二党支部',
  '本科生党支部'
]

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function getVercelApiBaseUrl() {
  const storageUrl = normalizeBaseUrl(wx.getStorageSync('dangwu_vercel_api_base_url'))
  const configUrl = normalizeBaseUrl(config.vercelApiBaseUrl)
  return storageUrl || configUrl
}

function canUseCloud() {
  const app = getApp()
  return Boolean(wx.cloud && app.globalData && app.globalData.cloudReady)
}

function nowIso() {
  return new Date().toISOString()
}

function getStore() {
  const store = wx.getStorageSync(STORAGE_KEY) || {
    materials: [],
    records: [],
    admins: [],
    teachers: [],
    teacherApplications: []
  }
  return {
    materials: Array.isArray(store.materials) ? store.materials : [],
    records: Array.isArray(store.records) ? store.records : [],
    admins: Array.isArray(store.admins) ? store.admins : [],
    teachers: Array.isArray(store.teachers) ? store.teachers : [],
    teacherApplications: Array.isArray(store.teacherApplications) ? store.teacherApplications : []
  }
}

function setStore(store) {
  wx.setStorageSync(STORAGE_KEY, store)
}

function clearDemoStore() {
  wx.removeStorageSync(STORAGE_KEY)
}

function getDemoRole() {
  return wx.getStorageSync(ROLE_KEY) || 'student'
}

function isTeacherDebugRole() {
  return getDemoRole() === 'teacher'
}

function setDemoRole(role) {
  const normalizedRole = role === 'teacher' ? 'teacher' : 'student'
  wx.setStorageSync(ROLE_KEY, normalizedRole)
  const app = getApp()
  if (app.globalData) {
    app.globalData.role = normalizedRole
    app.globalData.isTeacher = normalizedRole === 'teacher'
    app.globalData.user = {
      openid: 'demo-openid',
      role: normalizedRole,
      is_admin: normalizedRole === 'teacher',
      demo: true
    }
  }
}

function applyUser(result) {
  const role = result.is_admin || result.role === 'owner' || result.role === 'admin'
    ? 'teacher'
    : 'student'
  const user = {
    ...result,
    role,
    is_admin: role === 'teacher'
  }
  const app = getApp()
  if (app.globalData) {
    app.globalData.user = user
    app.globalData.role = role
    app.globalData.isTeacher = role === 'teacher'
  }
  return user
}

async function login() {
  const vercelApiBaseUrl = getVercelApiBaseUrl()
  if (vercelApiBaseUrl) {
    try {
      const loginRes = await wx.login()
      const code = loginRes && loginRes.code
      if (code) {
        const res = await callFunction({
          name: 'login',
          data: { wx_code: code, role: getDemoRole() }
        })
        return applyUser(res.result || {})
      }
    } catch (e) {
      console.warn('wx.login/微信API失败，降级到Vercel演示模式', e)
    }
    try {
      const res = await callFunction({
        name: 'login',
        data: { role: getDemoRole() }
      })
      return applyUser(res.result || {})
    } catch (e2) {
      console.warn('Vercel 演示登录也失败，使用本地缓存', e2)
    }
  }
  return applyUser(localCallFunction('login', { role: getDemoRole() }).result)
}

function getCurrentUser() {
  const app = getApp()
  return (app.globalData && app.globalData.user) || null
}

function isTeacher() {
  const app = getApp()
  return Boolean(app.globalData && app.globalData.isTeacher)
}

async function ensureTeacher() {
  if (!getCurrentUser()) {
    await login()
  }
  return isTeacher()
}

function cleanText(value) {
  return String(value || '').trim()
}

function cleanList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\s,，;；]+/)
  return Array.from(new Set(source.map(cleanText).filter(Boolean)))
}

function getDatePart() {
  const date = new Date()
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function makeMaterialId(materials = []) {
  const datePart = getDatePart()
  const maxNo = materials.reduce((max, item) => {
    const text = cleanText(item.material_no || item.material_id)
    const match = text.match(new RegExp(`^${datePart}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${datePart}-${String(maxNo + 1).padStart(3, '0')}`
}

function getStats(materials) {
  return materials.reduce((stats, item) => {
    stats.total += 1
    stats[item.status] = (stats[item.status] || 0) + 1
    return stats
  }, {
    total: 0,
    pending_receive: 0,
    received: 0,
    returned: 0
  })
}

function getBranchSummary(materials) {
  const map = {}
  materials.forEach((item) => {
    const branch = item.branch || item.received_branch || '未填写支部'
    if (!map[branch]) {
      map[branch] = {
        branch,
        total: 0,
        pending_receive: 0,
        received: 0,
        returned: 0
      }
    }
    map[branch].total += 1
    map[branch][item.status] = (map[branch][item.status] || 0) + 1
  })
  return Object.values(map).sort((a, b) => b.total - a.total)
}

function localCallFunction(name, data = {}) {
  const store = getStore()

  if (name === 'login') {
    const role = getDemoRole()
    return {
      result: {
        openid: 'demo-openid',
        role,
        is_admin: role === 'teacher',
        demo: true
      }
    }
  }

  if (name === 'applyTeacher') {
    const openid = cleanText(data.openid) || 'demo-openid'
    const existingTeacher = store.teachers.find((item) => item.openid === openid)
    if (existingTeacher || getDemoRole() === 'teacher') {
      return { result: { status: 'approved', alreadyTeacher: true } }
    }
    const existing = store.teacherApplications.find((item) => item.openid === openid)
    if (existing) {
      existing.status = existing.status === 'approved' ? 'approved' : 'pending'
      existing.updated_at = nowIso()
      setStore(store)
      return { result: { application: existing } }
    }
    const application = {
      id: `app-${Date.now()}`,
      openid,
      status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso()
    }
    store.teacherApplications.unshift(application)
    setStore(store)
    return { result: { application } }
  }

  if (name === 'listTeacherApplications') {
    return {
      result: {
        applications: store.teacherApplications
          .slice()
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      }
    }
  }

  if (name === 'approveTeacher') {
    const targetOpenid = cleanText(data.target_openid)
    if (!targetOpenid) throw new Error('缺少 target_openid')
    if (!store.teachers.find((item) => item.openid === targetOpenid)) {
      store.teachers.push({
        openid: targetOpenid,
        name: '',
        created_at: nowIso()
      })
    }
    const application = store.teacherApplications.find((item) => item.openid === targetOpenid)
    if (application) {
      application.status = 'approved'
      application.updated_at = nowIso()
    }
    setStore(store)
    return { result: { ok: true, application } }
  }

  if (name === 'rejectTeacher') {
    const targetOpenid = cleanText(data.target_openid)
    if (!targetOpenid) throw new Error('缺少 target_openid')
    const application = store.teacherApplications.find((item) => item.openid === targetOpenid)
    if (application) {
      application.status = 'rejected'
      application.updated_at = nowIso()
    }
    setStore(store)
    return { result: { ok: true, application } }
  }

  if (name === 'listTeachers') {
    return {
      result: {
        teachers: [
          {
            openid: 'demo-openid',
            name: '演示老师',
            created_at: nowIso()
          },
          ...store.teachers
        ]
      }
    }
  }

  if (name === 'addTeacher') {
    const targetOpenid = cleanText(data.target_openid)
    if (!targetOpenid) throw new Error('缺少 target_openid')
    const targetName = cleanText(data.target_name)
    const existing = store.teachers.find((item) => item.openid === targetOpenid)
    if (existing) {
      existing.name = targetName
    } else {
      store.teachers.push({
        openid: targetOpenid,
        name: targetName,
        created_at: nowIso()
      })
    }
    setStore(store)
    return { result: { ok: true } }
  }

  if (name === 'removeTeacher') {
    const targetOpenid = cleanText(data.target_openid)
    store.teachers = store.teachers.filter((item) => item.openid !== targetOpenid)
    setStore(store)
    return { result: { ok: true } }
  }

  if (name === 'materialCreate' || name === 'studentSubmitMaterial') {
    const branch = cleanText(data.branch)
    const assignedUser = cleanText(data.assigned_user)
    const signerName = cleanText(data.signer_name)
    const materialId = makeMaterialId(store.materials)
    const material = {
      _id: materialId,
      material_id: materialId,
      material_no: materialId,
      name: cleanText(data.name),
      material_type: cleanText(data.material_type),
      material_category: cleanText(data.material_category),
      person_file_name: cleanText(data.person_file_name),
      meeting_year: cleanText(data.meeting_year),
      meeting_book_type: cleanText(data.meeting_book_type),
      specific_material_name: cleanText(data.specific_material_name),
      batch_name: cleanText(data.batch_name),
      branch,
      assigned_user: assignedUser,
      signer_name: signerName,
      receive_deadline: cleanText(data.receive_deadline),
      return_deadline: cleanText(data.return_deadline),
      remark: cleanText(data.remark),
      status: 'pending_receive',
      created_by: name === 'studentSubmitMaterial' ? 'student-demo-openid' : 'demo-openid',
      created_at: nowIso(),
      updated_at: nowIso()
    }
    if (!material.name) throw new Error('材料名称不能为空')
    if (!branch) throw new Error('领用人所在支部不能为空')
    if (!BRANCH_OPTIONS.includes(branch)) throw new Error('领用人所在支部不在可选范围内')
    if (!assignedUser) throw new Error('领用人姓名不能为空')
    if (!signerName) throw new Error('签领人不能为空')
    store.materials.unshift(material)
    setStore(store)
    return { result: { material } }
  }

  if (name === 'materialBatchCreate') {
    const items = Array.isArray(data.items) ? data.items : []
    if (items.length === 0) throw new Error('缺少批量新增明细')
    if (items.length > 200) throw new Error('单次最多批量新增 200 条')

    items.forEach((item) => {
      const branch = cleanText(item.branch)
      const assignedUser = cleanText(item.assigned_user)
      const signerName = cleanText(item.signer_name)
      if (!cleanText(item.name)) throw new Error('材料名称不能为空')
      if (!branch) throw new Error('领用人所在支部不能为空')
      if (!BRANCH_OPTIONS.includes(branch)) throw new Error('领用人所在支部不在可选范围内')
      if (!assignedUser) throw new Error('领用人姓名不能为空')
      if (!signerName) throw new Error('签领人不能为空')
    })

    const materials = items.map((item) => {
      const branch = cleanText(item.branch)
      const assignedUser = cleanText(item.assigned_user)
      const signerName = cleanText(item.signer_name)
      const materialId = makeMaterialId(store.materials)
      const material = {
        _id: materialId,
        material_id: materialId,
        material_no: materialId,
        name: cleanText(item.name),
        material_type: cleanText(item.material_type),
        material_category: cleanText(item.material_category),
        person_file_name: cleanText(item.person_file_name),
        meeting_year: cleanText(item.meeting_year),
        meeting_book_type: cleanText(item.meeting_book_type),
        specific_material_name: cleanText(item.specific_material_name),
        batch_name: cleanText(item.batch_name),
        branch,
        assigned_user: assignedUser,
        signer_name: signerName,
        receive_deadline: cleanText(item.receive_deadline),
        return_deadline: cleanText(item.return_deadline),
        remark: cleanText(item.remark),
        status: 'pending_receive',
        created_by: 'demo-openid',
        created_at: nowIso(),
        updated_at: nowIso()
      }
      store.materials.push(material)
      return material
    })
    store.materials = [
      ...materials,
      ...store.materials.filter((item) => !materials.find((created) => created.material_id === item.material_id))
    ]
    setStore(store)
    return { result: { ok: true, count: materials.length, materials } }
  }

  if (name === 'demoSeed') {
    if (store.materials.length > 0) {
      return { result: { ok: true, material: store.materials[0] } }
    }
    const materialId = makeMaterialId(store.materials)
    const material = {
      _id: materialId,
      material_id: materialId,
      material_no: materialId,
      name: '主题教育学习材料',
      material_type: '学习材料',
      material_category: '学习材料',
      person_file_name: '',
      meeting_year: '',
      meeting_book_type: '',
      specific_material_name: '主题教育学习材料',
      batch_name: '本地演示批次',
      branch: '本科生党支部',
      assigned_user: '张三',
      signer_name: '李四',
      receive_deadline: '',
      return_deadline: '',
      remark: '用于本地调试扫码领取和回收闭环',
      status: 'pending_receive',
      created_by: 'demo-openid',
      created_at: nowIso(),
      updated_at: nowIso()
    }
    store.materials.unshift(material)
    setStore(store)
    return { result: { ok: true, material } }
  }

  if (name === 'materialGet') {
    const materialId = cleanText(data.material_id)
    const material = store.materials.find((item) => item.material_id === materialId && !item.deleted_at)
    if (!material) throw new Error('材料不存在')
    const records = store.records
      .filter((item) => item.material_id === materialId)
      .sort((a, b) => new Date(b.action_time) - new Date(a.action_time))
    return { result: { material, records } }
  }

  if (name === 'studentPendingMaterials') {
    const materials = store.materials
      .filter((item) => item.status === 'pending_receive' && !item.deleted_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 200)
    return { result: { materials } }
  }

  if (name === 'materialReceive') {
    const materialId = cleanText(data.material_id)
    const material = store.materials.find((item) => item.material_id === materialId && !item.deleted_at)
    if (!material) throw new Error('材料不存在')
    if (material.status !== 'pending_receive') throw new Error('当前状态不能领取')
    if (!cleanText(data.person)) throw new Error('领用人不能为空')
    if (!cleanText(data.branch)) throw new Error('领用人所在支部不能为空')
    if (!BRANCH_OPTIONS.includes(cleanText(data.branch))) throw new Error('领用人所在支部不在可选范围内')
    if (!cleanText(data.operator)) throw new Error('签领人不能为空')

    material.status = 'received'
    material.received_person = cleanText(data.person)
    material.received_branch = cleanText(data.branch)
    material.received_operator = cleanText(data.operator)
    material.received_at = nowIso()
    material.return_requirement = cleanText(data.return_requirement) === 'no_return' ? 'no_return' : 'need_return'
    if (material.return_requirement === 'no_return') {
      material.status = 'returned'
      material.returned_operator = material.received_operator
      material.returned_at = nowIso()
      material.completeness = '无需回收'
    }
    material.updated_at = nowIso()
    store.records.unshift({
      _id: `record-${Date.now()}`,
      material_id: materialId,
      material_no: material.material_no,
      action_type: 'receive',
      person: material.received_person,
      branch: material.received_branch,
      operator: material.received_operator,
      remark: cleanText(data.remark),
      action_openid: 'demo-openid',
      action_time: nowIso()
    })
    if (material.return_requirement === 'no_return') {
      store.records.unshift({
        _id: `record-${Date.now()}-no-return`,
        material_id: materialId,
        material_no: material.material_no,
        action_type: 'return',
        person: material.received_person,
        branch: material.received_branch,
        operator: material.received_operator,
        completeness: '无需回收',
        remark: cleanText(data.remark) || '领取时登记为无需回收',
        action_openid: 'demo-openid',
        action_time: nowIso()
      })
    }
    setStore(store)
    return { result: { ok: true, status: material.status, return_requirement: material.return_requirement } }
  }

  if (name === 'materialReturn') {
    const materialId = cleanText(data.material_id)
    const material = store.materials.find((item) => item.material_id === materialId && !item.deleted_at)
    if (!material) throw new Error('材料不存在')
    if (material.status !== 'received') throw new Error('当前状态不能回收')
    if (!cleanText(data.operator)) throw new Error('签领人不能为空')

    material.status = 'returned'
    material.returned_operator = cleanText(data.operator)
    material.returned_at = nowIso()
    material.completeness = cleanText(data.completeness) || '完整'
    material.updated_at = nowIso()
    store.records.unshift({
      _id: `record-${Date.now()}`,
      material_id: materialId,
      material_no: material.material_no,
      action_type: 'return',
      person: material.received_person || material.assigned_user || '',
      branch: material.received_branch || material.branch || '',
      operator: material.returned_operator,
      completeness: material.completeness,
      remark: cleanText(data.remark),
      action_openid: 'demo-openid',
      action_time: nowIso()
    })
    setStore(store)
    return { result: { ok: true, status: 'returned' } }
  }

  if (name === 'materialDelete') {
    const materialId = cleanText(data.material_id)
    const material = store.materials.find((item) => item.material_id === materialId && !item.deleted_at)
    if (!material) throw new Error('材料不存在或已删除')
    material.deleted_at = nowIso()
    material.deleted_by = 'demo-openid'
    material.updated_at = nowIso()
    store.records.unshift({
      _id: `record-${Date.now()}`,
      material_id: materialId,
      material_no: material.material_no,
      action_type: 'delete',
      operator: 'demo-openid',
      remark: cleanText(data.reason) || '老师端删除',
      action_openid: 'demo-openid',
      action_time: nowIso()
    })
    setStore(store)
    return { result: { ok: true, material } }
  }

  if (name === 'materialBatchDelete') {
    const materialIds = cleanList(data.material_ids || data.materialIds)
    if (materialIds.length === 0) throw new Error('请填写要删除的材料编号')
    if (materialIds.length > 200) throw new Error('单次最多批量删除 200 条')
    const deletedMaterials = []
    materialIds.forEach((materialId) => {
      const material = store.materials.find((item) => item.material_id === materialId && !item.deleted_at)
      if (!material) return
      material.deleted_at = nowIso()
      material.deleted_by = 'demo-openid'
      material.updated_at = nowIso()
      deletedMaterials.push(material)
      store.records.unshift({
        _id: `record-${Date.now()}-${materialId}`,
        material_id: materialId,
        material_no: material.material_no,
        action_type: 'delete',
        operator: 'demo-openid',
        remark: cleanText(data.reason) || '老师端批量删除',
        action_openid: 'demo-openid',
        action_time: nowIso()
      })
    })
    setStore(store)
    const deletedIds = deletedMaterials.map((item) => item.material_id)
    return {
      result: {
        ok: true,
        count: deletedMaterials.length,
        deletedMaterials,
        notFoundIds: materialIds.filter((id) => !deletedIds.includes(id))
      }
    }
  }

  if (name === 'dashboardStats') {
    const visibleMaterials = store.materials.filter((item) => !item.deleted_at)
    const recentRecords = store.records
      .slice()
      .sort((a, b) => new Date(b.action_time) - new Date(a.action_time))
      .slice(0, 20)
    return {
      result: {
        stats: getStats(visibleMaterials),
        recentMaterials: visibleMaterials.slice(0, 100),
        unreturned: visibleMaterials.filter((item) => item.status === 'received').slice(0, 100),
        branchSummary: getBranchSummary(visibleMaterials),
        recentRecords
      }
    }
  }

  throw new Error(`本地演示模式不支持 ${name}`)
}

function requestVercelFunction(baseUrl, options) {
  const app = getApp()
  const user = app.globalData && app.globalData.user
  const hasRealOpenid = user && user.openid && user.openid !== 'vercel-api' && user.openid !== 'demo-openid'
  const authData = options.name === 'login'
    ? {}
    : hasRealOpenid
      ? { openid: user.openid }
      : { __role: getDemoRole() }
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}/api/rpc`,
      method: 'POST',
      data: {
        name: options.name,
        data: {
          ...(options.data || {}),
          ...authData
        }
      },
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok) {
          resolve({ result: body.result })
          return
        }
        reject(new Error(body.error || `Vercel API 请求失败：${res.statusCode}`))
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Vercel API 网络请求失败'))
      }
    })
  })
}

async function callFunction(options) {
  const vercelApiBaseUrl = getVercelApiBaseUrl()
  if (vercelApiBaseUrl) {
    return requestVercelFunction(vercelApiBaseUrl, options)
  }

  if (!canUseCloud()) {
    return localCallFunction(options.name, options.data)
  }

  try {
    return await wx.cloud.callFunction(options)
  } catch (err) {
    const message = `${err.errCode || ''} ${err.errMsg || err.message || ''}`
    const noCloudPermission = message.includes('-601034') ||
      message.includes('没有权限') ||
      message.includes('请先开通云开发')

    if (noCloudPermission) {
      const app = getApp()
      if (app.globalData) {
        app.globalData.cloudReady = false
      }
      return localCallFunction(options.name, options.data)
    }

    throw err
  }
}

module.exports = {
  callFunction,
  login,
  getCurrentUser,
  isTeacher,
  ensureTeacher,
  setDemoRole,
  isTeacherDebugRole,
  canUseCloud,
  getVercelApiBaseUrl,
  clearDemoStore
}
