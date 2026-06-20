const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function ensureAdmin(openid) {
  const admins = db.collection('admins')
  const total = await admins.count()
  if (total.total === 0) {
    try {
      await admins.add({
        data: {
          openid,
          name: '初始化管理员',
          role: 'owner',
          created_at: new Date()
        }
      })
      return true
    } catch (e) {
      // 并发竞态：另一个用户抢先成为了管理员，降级为普通查询
    }
  }

  const result = await admins.where({ openid }).limit(1).get()
  return result.data.length > 0
}

function cleanText(value) {
  return String(value || '').trim()
}

function makeMaterialId() {
  const now = new Date()
  const pad = (num) => String(num).padStart(2, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `DW-${datePart}-${randomPart}`
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const isAdmin = await ensureAdmin(openid)
  if (!isAdmin) {
    throw new Error('无管理员权限')
  }

  const name = cleanText(event.name)
  if (!name) {
    throw new Error('材料名称不能为空')
  }

  const materialId = makeMaterialId()
  const now = new Date()
  const materialNo = cleanText(event.material_no) || materialId
  const batchName = cleanText(event.batch_name)

  if (batchName) {
    // 去重：仅在该批次名不存在时才新建
    const existingBatch = await db.collection('batches')
      .where({ batch_name: batchName })
      .limit(1)
      .get()
    if (existingBatch.data.length === 0) {
      await db.collection('batches').add({
        data: {
          batch_name: batchName,
          created_by: openid,
          created_at: now
        }
      })
    }
  }

  const material = {
    material_id: materialId,
    material_no: materialNo,
    name,
    material_type: cleanText(event.material_type),
    material_category: cleanText(event.material_category),
    person_file_name: cleanText(event.person_file_name),
    meeting_year: cleanText(event.meeting_year),
    meeting_book_type: cleanText(event.meeting_book_type),
    specific_material_name: cleanText(event.specific_material_name),
    batch_name: batchName,
    branch: cleanText(event.branch),
    assigned_user: cleanText(event.assigned_user),
    receive_deadline: cleanText(event.receive_deadline),
    return_deadline: cleanText(event.return_deadline),
    remark: cleanText(event.remark),
    status: 'pending_receive',
    created_by: openid,
    created_at: now,
    updated_at: now
  }

  const result = await db.collection('materials').add({ data: material })

  return {
    material: {
      ...material,
      _id: result._id
    }
  }
}
