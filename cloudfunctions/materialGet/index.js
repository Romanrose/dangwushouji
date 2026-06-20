const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event) => {
  const materialId = String(event.material_id || '').trim()
  if (!materialId) {
    throw new Error('缺少 material_id')
  }

  const materialResult = await db.collection('materials')
    .where({ material_id: materialId })
    .limit(1)
    .get()

  const material = materialResult.data[0]
  if (!material) {
    throw new Error('材料不存在')
  }

  const recordsResult = await db.collection('circulation_records')
    .where({ material_id: materialId })
    .orderBy('action_time', 'desc')
    .limit(50)
    .get()

  return {
    material,
    records: recordsResult.data
  }
}
