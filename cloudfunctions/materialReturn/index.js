const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function cleanText(value) {
  return String(value || '').trim()
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const materialId = cleanText(event.material_id)
  const operator = cleanText(event.operator)
  const completeness = cleanText(event.completeness) || '完整'
  const remark = cleanText(event.remark)

  if (!materialId) throw new Error('缺少 material_id')
  if (!operator) throw new Error('经办人不能为空')

  const materialResult = await db.collection('materials')
    .where({ material_id: materialId })
    .limit(1)
    .get()
  const material = materialResult.data[0]
  if (!material) throw new Error('材料不存在')

  const now = new Date()

  // 原子更新：将状态校验与更新合并在一条 where 语句中，防止并发竞态
  const updateResult = await db.collection('materials').where({
    material_id: materialId,
    status: 'received'
  }).update({
    data: {
      status: 'returned',
      returned_operator: operator,
      returned_at: now,
      completeness,
      updated_at: now
    }
  })

  if (updateResult.stats.updated === 0) {
    throw new Error('当前状态不能回收，材料可能已被其他操作处理')
  }

  await db.collection('circulation_records').add({
    data: {
      material_id: materialId,
      material_no: material.material_no,
      action_type: 'return',
      person: material.received_person || material.assigned_user || '',
      branch: material.received_branch || material.branch || '',
      operator,
      completeness,
      remark,
      action_openid: openid,
      action_time: now
    }
  })

  return { ok: true, status: 'returned' }
}
