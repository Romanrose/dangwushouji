const { neon } = require('@neondatabase/serverless')

const WX_APP_ID = 'wx3a498496ce7588e6'
const WX_APP_SECRET = process.env.WX_APP_SECRET || ''
const ALLOW_DEMO_AUTH = process.env.ALLOW_DEMO_AUTH === 'true'
const BRANCH_OPTIONS = [
  '博士生党支部',
  '教工第一党支部',
  '教工第二党支部',
  '硕士生第一党支部',
  '硕士生第二党支部',
  '本科生党支部'
]

let schemaReady = false

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }
  return neon(process.env.DATABASE_URL)
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

function getShanghaiDatePart() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}${parts.month}${parts.day}`
}

async function makeMaterialNo(sql) {
  const datePart = getShanghaiDatePart()
  const rows = await sql`
    INSERT INTO material_sequences (date_part, last_no, updated_at)
    VALUES (${datePart}, 1, NOW())
    ON CONFLICT (date_part) DO UPDATE
    SET last_no = material_sequences.last_no + 1,
        updated_at = NOW()
    RETURNING last_no
  `
  return `${datePart}-${String(rows[0].last_no).padStart(3, '0')}`
}

function mapMaterial(row) {
  if (!row) return null
  return {
    _id: row.id,
    material_id: row.material_id,
    material_no: row.material_no,
    name: row.name,
    material_type: row.material_type || '',
    material_category: row.material_category || '',
    person_file_name: row.person_file_name || '',
    meeting_year: row.meeting_year || '',
    meeting_book_type: row.meeting_book_type || '',
    specific_material_name: row.specific_material_name || '',
    batch_name: row.batch_name || '',
    branch: row.branch || '',
    assigned_user: row.assigned_user || '',
    signer_name: row.signer_name || '',
    receive_deadline: row.receive_deadline || '',
    return_deadline: row.return_deadline || '',
    remark: row.remark || '',
    status: row.status,
    received_person: row.received_person || '',
    received_branch: row.received_branch || '',
    received_operator: row.received_operator || '',
    received_at: row.received_at,
    returned_operator: row.returned_operator || '',
    returned_at: row.returned_at,
    completeness: row.completeness || '',
    created_by: row.created_by || '',
    deleted_by: row.deleted_by || '',
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function mapRecord(row) {
  if (!row) return null
  return {
    _id: row.id,
    material_id: row.material_id,
    material_no: row.material_no,
    action_type: row.action_type,
    person: row.person || '',
    branch: row.branch || '',
    operator: row.operator || '',
    completeness: row.completeness || '',
    remark: row.remark || '',
    action_openid: row.action_openid || '',
    action_time: row.action_time
  }
}

function mapTeacherApplication(row) {
  if (!row) return null
  return {
    id: row.id,
    openid: row.openid,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function isTeacherRequest(data) {
  return ALLOW_DEMO_AUTH && cleanText(data && data.__role) === 'teacher'
}

async function ensureTeacherRequest(sql, data) {
  const openid = cleanText(data.openid || '')
  if (openid) {
    const rows = await sql`SELECT * FROM teachers WHERE openid = ${openid} LIMIT 1`
    if (rows.length > 0) return
    throw new Error('无老师端权限')
  }
  if (!isTeacherRequest(data)) {
    throw new Error('无老师端权限')
  }
}

async function getTeacherStatus(sql, data) {
  const openid = cleanText(data.openid || '')
  if (openid) {
    const rows = await sql`SELECT * FROM teachers WHERE openid = ${openid} LIMIT 1`
    return rows.length > 0
  }
  return isTeacherRequest(data)
}

async function ensureSchema(sql) {
  if (schemaReady) return

  await sql`
    CREATE TABLE IF NOT EXISTS materials (
      id BIGSERIAL PRIMARY KEY,
      material_id TEXT NOT NULL UNIQUE,
      material_no TEXT NOT NULL,
      name TEXT NOT NULL,
      material_type TEXT,
      material_category TEXT,
      person_file_name TEXT,
      meeting_year TEXT,
      meeting_book_type TEXT,
      specific_material_name TEXT,
      batch_name TEXT,
      branch TEXT,
      assigned_user TEXT,
      signer_name TEXT,
      receive_deadline TEXT,
      return_deadline TEXT,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'pending_receive',
      received_person TEXT,
      received_branch TEXT,
      received_operator TEXT,
      received_at TIMESTAMPTZ,
      returned_operator TEXT,
      returned_at TIMESTAMPTZ,
      completeness TEXT,
      created_by TEXT,
      deleted_by TEXT,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS circulation_records (
      id BIGSERIAL PRIMARY KEY,
      material_id TEXT NOT NULL,
      material_no TEXT,
      action_type TEXT NOT NULL,
      person TEXT,
      branch TEXT,
      operator TEXT,
      completeness TEXT,
      remark TEXT,
      action_openid TEXT,
      action_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_records_material_id ON circulation_records(material_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS teachers (
      id BIGSERIAL PRIMARY KEY,
      openid TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS material_sequences (
      date_part TEXT PRIMARY KEY,
      last_no INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS teacher_applications (
      id BIGSERIAL PRIMARY KEY,
      openid TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS signer_name TEXT`
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS deleted_by TEXT`
  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`CREATE INDEX IF NOT EXISTS idx_teacher_applications_status ON teacher_applications(status)`
  schemaReady = true
}

function validateMaterialInput(data) {
  const name = cleanText(data.name)
  const branch = cleanText(data.branch)
  const assignedUser = cleanText(data.assigned_user)
  const signerName = cleanText(data.signer_name)
  if (!name) throw new Error('材料名称不能为空')
  if (!branch) throw new Error('领用人所在支部不能为空')
  if (!BRANCH_OPTIONS.includes(branch)) throw new Error('领用人所在支部不在可选范围内')
  if (!assignedUser) throw new Error('领用人姓名不能为空')
  if (!signerName) throw new Error('签领人不能为空')
  return { name, branch, assignedUser, signerName }
}

async function insertMaterial(sql, data, createdBy) {
  const { name, branch, assignedUser, signerName } = validateMaterialInput(data)

  const materialNo = await makeMaterialNo(sql)
  const materialId = materialNo

  const rows = await sql`
    INSERT INTO materials (
      material_id, material_no, name, material_type, material_category,
      person_file_name, meeting_year, meeting_book_type, specific_material_name,
      batch_name, branch, assigned_user, signer_name, receive_deadline, return_deadline,
      remark, status, created_by, created_at, updated_at
    )
    VALUES (
      ${materialId}, ${materialNo}, ${name}, ${cleanText(data.material_type)}, ${cleanText(data.material_category)},
      ${cleanText(data.person_file_name)}, ${cleanText(data.meeting_year)}, ${cleanText(data.meeting_book_type)}, ${cleanText(data.specific_material_name)},
      ${cleanText(data.batch_name)}, ${branch}, ${assignedUser}, ${signerName}, ${cleanText(data.receive_deadline)}, ${cleanText(data.return_deadline)},
      ${cleanText(data.remark)}, 'pending_receive', ${createdBy}, NOW(), NOW()
    )
    RETURNING *
  `

  return { material: mapMaterial(rows[0]) }
}

async function materialCreate(sql, data) {
  await ensureTeacherRequest(sql, data)
  const createdBy = cleanText(data.openid) || 'teacher'
  return insertMaterial(sql, data, createdBy)
}

async function studentSubmitMaterial(sql, data) {
  const createdBy = cleanText(data.openid) || 'student'
  return insertMaterial(sql, data, createdBy)
}

async function materialBatchCreate(sql, data) {
  await ensureTeacherRequest(sql, data)
  const items = Array.isArray(data.items) ? data.items : []
  if (items.length === 0) throw new Error('缺少批量新增明细')
  if (items.length > 200) throw new Error('单次最多批量新增 200 条')

  const createdBy = cleanText(data.openid) || 'teacher'
  const datePart = getShanghaiDatePart()
  const payload = items.map((item) => {
    const { name, branch, assignedUser, signerName } = validateMaterialInput(item)
    return {
      name,
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
      remark: cleanText(item.remark)
    }
  })

  const rows = await sql`
    WITH input AS (
      SELECT value, ord
      FROM jsonb_array_elements(${JSON.stringify(payload)}::jsonb) WITH ORDINALITY AS item(value, ord)
    ),
    seq AS (
      INSERT INTO material_sequences (date_part, last_no, updated_at)
      VALUES (${datePart}, ${items.length}, NOW())
      ON CONFLICT (date_part) DO UPDATE
      SET last_no = material_sequences.last_no + ${items.length},
          updated_at = NOW()
      RETURNING last_no
    ),
    prepared AS (
      SELECT
        (${datePart} || '-' || LPAD((seq.last_no - ${items.length} + input.ord)::TEXT, 3, '0')) AS material_no,
        input.value
      FROM input
      CROSS JOIN seq
      ORDER BY input.ord
    )
    INSERT INTO materials (
      material_id, material_no, name, material_type, material_category,
      person_file_name, meeting_year, meeting_book_type, specific_material_name,
      batch_name, branch, assigned_user, signer_name, receive_deadline, return_deadline,
      remark, status, created_by, created_at, updated_at
    )
    SELECT
      material_no,
      material_no,
      value->>'name',
      value->>'material_type',
      value->>'material_category',
      value->>'person_file_name',
      value->>'meeting_year',
      value->>'meeting_book_type',
      value->>'specific_material_name',
      value->>'batch_name',
      value->>'branch',
      value->>'assigned_user',
      value->>'signer_name',
      value->>'receive_deadline',
      value->>'return_deadline',
      value->>'remark',
      'pending_receive',
      ${createdBy},
      NOW(),
      NOW()
    FROM prepared
    RETURNING *
  `
  return { ok: true, count: rows.length, materials: rows.map(mapMaterial) }
}

async function materialGet(sql, data) {
  const materialId = cleanText(data.material_id)
  if (!materialId) throw new Error('缺少 material_id')

  const materialRows = await sql`SELECT * FROM materials WHERE material_id = ${materialId} AND deleted_at IS NULL LIMIT 1`
  const material = mapMaterial(materialRows[0])
  if (!material) throw new Error('材料不存在')

  const isTeacher = await getTeacherStatus(sql, data)
  const recordRows = isTeacher
    ? await sql`
      SELECT * FROM circulation_records
      WHERE material_id = ${materialId}
      ORDER BY action_time DESC
      LIMIT 50
    `
    : []

  return {
    material,
    records: recordRows.map(mapRecord)
  }
}

async function materialReceive(sql, data) {
  const materialId = cleanText(data.material_id)
  const person = cleanText(data.person)
  const branch = cleanText(data.branch)
  const operator = cleanText(data.operator)
  const remark = cleanText(data.remark)
  const actionOpenid = cleanText(data.openid) || 'vercel-api'

  if (!materialId) throw new Error('缺少 material_id')
  if (!person) throw new Error('领用人不能为空')
  if (!branch) throw new Error('领用人所在支部不能为空')
  if (!BRANCH_OPTIONS.includes(branch)) throw new Error('领用人所在支部不在可选范围内')
  if (!operator) throw new Error('签领人不能为空')

  const materialRows = await sql`SELECT * FROM materials WHERE material_id = ${materialId} AND deleted_at IS NULL LIMIT 1`
  const material = materialRows[0]
  if (!material) throw new Error('材料不存在')
  if (material.status !== 'pending_receive') throw new Error('当前状态不能领取')

  await sql`
    UPDATE materials
    SET status = 'received',
        received_person = ${person},
        received_branch = ${branch},
        received_operator = ${operator},
        received_at = NOW(),
        updated_at = NOW()
    WHERE material_id = ${materialId}
  `

  await sql`
    INSERT INTO circulation_records (
      material_id, material_no, action_type, person, branch, operator, remark, action_openid, action_time
    )
    VALUES (
      ${materialId}, ${material.material_no}, 'receive', ${person}, ${branch}, ${operator}, ${remark}, ${actionOpenid}, NOW()
    )
  `

  return { ok: true, status: 'received' }
}

async function materialReturn(sql, data) {
  const materialId = cleanText(data.material_id)
  const operator = cleanText(data.operator)
  const completeness = cleanText(data.completeness) || '完整'
  const remark = cleanText(data.remark)
  const actionOpenid = cleanText(data.openid) || 'vercel-api'

  if (!materialId) throw new Error('缺少 material_id')
  if (!operator) throw new Error('签领人不能为空')

  const materialRows = await sql`SELECT * FROM materials WHERE material_id = ${materialId} AND deleted_at IS NULL LIMIT 1`
  const material = materialRows[0]
  if (!material) throw new Error('材料不存在')
  if (material.status !== 'received') throw new Error('当前状态不能回收')

  await sql`
    UPDATE materials
    SET status = 'returned',
        returned_operator = ${operator},
        returned_at = NOW(),
        completeness = ${completeness},
        updated_at = NOW()
    WHERE material_id = ${materialId}
  `

  await sql`
    INSERT INTO circulation_records (
      material_id, material_no, action_type, person, branch, operator,
      completeness, remark, action_openid, action_time
    )
    VALUES (
      ${materialId}, ${material.material_no}, 'return',
      ${material.received_person || material.assigned_user || ''},
      ${material.received_branch || material.branch || ''},
      ${operator}, ${completeness}, ${remark}, ${actionOpenid}, NOW()
    )
  `

  return { ok: true, status: 'returned' }
}

async function dashboardStats(sql) {
  const [statsRows, recentRows, unreturnedRows, branchRows, recordRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE status = 'pending_receive')::INT AS pending_receive,
        COUNT(*) FILTER (WHERE status = 'received')::INT AS received,
        COUNT(*) FILTER (WHERE status = 'returned')::INT AS returned
      FROM materials
      WHERE deleted_at IS NULL
    `,
    sql`SELECT * FROM materials WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM materials WHERE status = 'received' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
    sql`
      SELECT
        COALESCE(NULLIF(branch, ''), '未填写支部') AS branch,
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE status = 'pending_receive')::INT AS pending_receive,
        COUNT(*) FILTER (WHERE status = 'received')::INT AS received,
        COUNT(*) FILTER (WHERE status = 'returned')::INT AS returned
      FROM materials
      WHERE deleted_at IS NULL
      GROUP BY COALESCE(NULLIF(branch, ''), '未填写支部')
      ORDER BY total DESC
    `,
    sql`SELECT * FROM circulation_records ORDER BY action_time DESC LIMIT 20`
  ])

  return {
    stats: statsRows[0] || { total: 0, pending_receive: 0, received: 0, returned: 0 },
    recentMaterials: recentRows.map(mapMaterial),
    unreturned: unreturnedRows.map(mapMaterial),
    branchSummary: branchRows,
    recentRecords: recordRows.map(mapRecord)
  }
}

async function materialDelete(sql, data) {
  await ensureTeacherRequest(sql, data)
  const materialId = cleanText(data.material_id)
  const deletedBy = cleanText(data.openid) || 'teacher'
  const reason = cleanText(data.reason) || '老师端删除'
  if (!materialId) throw new Error('缺少 material_id')

  const rows = await sql`
    UPDATE materials
    SET deleted_at = NOW(),
        deleted_by = ${deletedBy},
        updated_at = NOW()
    WHERE material_id = ${materialId}
      AND deleted_at IS NULL
    RETURNING *
  `
  const material = rows[0]
  if (!material) throw new Error('材料不存在或已删除')

  await sql`
    INSERT INTO circulation_records (
      material_id, material_no, action_type, operator, remark, action_openid, action_time
    )
    VALUES (
      ${materialId}, ${material.material_no}, 'delete', ${deletedBy}, ${reason}, ${deletedBy}, NOW()
    )
  `

  return { ok: true, material: mapMaterial(material) }
}

async function materialBatchDelete(sql, data) {
  await ensureTeacherRequest(sql, data)
  const materialIds = cleanList(data.material_ids || data.materialIds)
  const deletedBy = cleanText(data.openid) || 'teacher'
  const reason = cleanText(data.reason) || '老师端批量删除'
  if (materialIds.length === 0) throw new Error('请填写要删除的材料编号')
  if (materialIds.length > 200) throw new Error('单次最多批量删除 200 条')

  const rows = await sql`
    WITH input AS (
      SELECT value #>> '{}' AS material_id
      FROM jsonb_array_elements(${JSON.stringify(materialIds)}::jsonb) AS item(value)
    ),
    updated AS (
      UPDATE materials
      SET deleted_at = NOW(),
          deleted_by = ${deletedBy},
          updated_at = NOW()
      WHERE material_id IN (SELECT material_id FROM input)
        AND deleted_at IS NULL
      RETURNING *
    ),
    inserted AS (
      INSERT INTO circulation_records (
        material_id, material_no, action_type, operator, remark, action_openid, action_time
      )
      SELECT material_id, material_no, 'delete', ${deletedBy}, ${reason}, ${deletedBy}, NOW()
      FROM updated
      RETURNING 1
    )
    SELECT * FROM updated
  `
  const deletedIds = new Set(rows.map((item) => item.material_id))
  return {
    ok: true,
    count: rows.length,
    deletedMaterials: rows.map(mapMaterial),
    notFoundIds: materialIds.filter((id) => !deletedIds.has(id))
  }
}

async function applyTeacher(sql, data) {
  const openid = cleanText(data.openid)
  if (!openid || openid === 'vercel-api' || openid === 'demo-openid') {
    throw new Error('未获取到真实微信身份，请先配置 WX_APP_SECRET 后重新登录')
  }

  const teacherRows = await sql`SELECT * FROM teachers WHERE openid = ${openid} LIMIT 1`
  if (teacherRows.length > 0) {
    return { status: 'approved', alreadyTeacher: true }
  }

  const rows = await sql`
    INSERT INTO teacher_applications (openid, status, created_at, updated_at)
    VALUES (${openid}, 'pending', NOW(), NOW())
    ON CONFLICT (openid) DO UPDATE
    SET status = CASE
          WHEN teacher_applications.status = 'approved' THEN 'approved'
          ELSE 'pending'
        END,
        updated_at = NOW()
    RETURNING *
  `

  return { application: mapTeacherApplication(rows[0]) }
}

async function listTeacherApplications(sql, data) {
  await ensureTeacherRequest(sql, data)
  const rows = await sql`
    SELECT * FROM teacher_applications
    ORDER BY
      CASE status
        WHEN 'pending' THEN 0
        WHEN 'approved' THEN 1
        ELSE 2
      END,
      updated_at DESC
  `
  return { applications: rows.map(mapTeacherApplication) }
}

async function approveTeacher(sql, data) {
  await ensureTeacherRequest(sql, data)
  const targetOpenid = cleanText(data.target_openid)
  if (!targetOpenid) throw new Error('缺少 target_openid')

  await sql`
    INSERT INTO teachers (openid, name)
    VALUES (${targetOpenid}, '')
    ON CONFLICT (openid) DO NOTHING
  `
  const rows = await sql`
    UPDATE teacher_applications
    SET status = 'approved', updated_at = NOW()
    WHERE openid = ${targetOpenid}
    RETURNING *
  `
  return { ok: true, application: mapTeacherApplication(rows[0]) }
}

async function rejectTeacher(sql, data) {
  await ensureTeacherRequest(sql, data)
  const targetOpenid = cleanText(data.target_openid)
  if (!targetOpenid) throw new Error('缺少 target_openid')

  const rows = await sql`
    UPDATE teacher_applications
    SET status = 'rejected', updated_at = NOW()
    WHERE openid = ${targetOpenid}
    RETURNING *
  `
  return { ok: true, application: mapTeacherApplication(rows[0]) }
}

async function dispatch(sql, name, data) {
  if (name === 'login') {
    const wxCode = cleanText(data.wx_code)
    if (wxCode && WX_APP_SECRET) {
      try {
        const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APP_ID}&secret=${WX_APP_SECRET}&js_code=${wxCode}&grant_type=authorization_code`
        const wxRes = await fetch(wxUrl)
        const wxData = await wxRes.json()
        const openid = cleanText(wxData.openid)
        if (openid) {
          const teacherRows = await sql`SELECT * FROM teachers WHERE openid = ${openid} LIMIT 1`
          let isTeacher = teacherRows.length > 0
          if (!isTeacher) {
            const countRows = await sql`SELECT COUNT(*)::INT AS count FROM teachers`
            if (countRows[0].count === 0) {
              await sql`INSERT INTO teachers (openid, name) VALUES (${openid}, '')`
              isTeacher = true
            }
          }
          return { openid, role: isTeacher ? 'teacher' : 'student', is_admin: isTeacher }
        }
      } catch (_) {
        // WeChat API 失败，降级到演示模式
      }
    }
    const role = ALLOW_DEMO_AUTH && cleanText(data.role) === 'teacher' ? 'teacher' : 'student'
    return { openid: 'vercel-api', role, is_admin: role === 'teacher' }
  }
  if (name === 'addTeacher') {
    const opOpenid = cleanText(data.openid || '')
    if (opOpenid) {
      const opRows = await sql`SELECT * FROM teachers WHERE openid = ${opOpenid} LIMIT 1`
      if (opRows.length === 0) throw new Error('无老师端权限')
    } else if (!isTeacherRequest(data)) {
      throw new Error('无老师端权限')
    }
    const targetOpenid = cleanText(data.target_openid)
    const targetName = cleanText(data.target_name) || ''
    if (!targetOpenid) throw new Error('缺少 target_openid')
    await sql`
      INSERT INTO teachers (openid, name) VALUES (${targetOpenid}, ${targetName})
      ON CONFLICT (openid) DO UPDATE SET name = ${targetName}
    `
    return { ok: true }
  }
  if (name === 'removeTeacher') {
    const opOpenid = cleanText(data.openid || '')
    if (opOpenid) {
      const opRows = await sql`SELECT * FROM teachers WHERE openid = ${opOpenid} LIMIT 1`
      if (opRows.length === 0) throw new Error('无老师端权限')
    } else if (!isTeacherRequest(data)) {
      throw new Error('无老师端权限')
    }
    const targetOpenid = cleanText(data.target_openid)
    if (!targetOpenid) throw new Error('缺少 target_openid')
    await sql`DELETE FROM teachers WHERE openid = ${targetOpenid}`
    return { ok: true }
  }
  if (name === 'listTeachers') {
    const opOpenid = cleanText(data.openid || '')
    if (opOpenid) {
      const opRows = await sql`SELECT * FROM teachers WHERE openid = ${opOpenid} LIMIT 1`
      if (opRows.length === 0) throw new Error('无老师端权限')
    } else if (!isTeacherRequest(data)) {
      throw new Error('无老师端权限')
    }
    const rows = await sql`SELECT openid, name, created_at FROM teachers ORDER BY created_at ASC`
    return { teachers: rows }
  }
  if (name === 'materialCreate') return materialCreate(sql, data)
  if (name === 'materialBatchCreate') return materialBatchCreate(sql, data)
  if (name === 'studentSubmitMaterial') return studentSubmitMaterial(sql, data)
  if (name === 'applyTeacher') return applyTeacher(sql, data)
  if (name === 'listTeacherApplications') return listTeacherApplications(sql, data)
  if (name === 'approveTeacher') return approveTeacher(sql, data)
  if (name === 'rejectTeacher') return rejectTeacher(sql, data)
  if (name === 'materialGet') return materialGet(sql, data)
  if (name === 'materialReceive') return materialReceive(sql, data)
  if (name === 'materialReturn') return materialReturn(sql, data)
  if (name === 'materialDelete') return materialDelete(sql, data)
  if (name === 'materialBatchDelete') return materialBatchDelete(sql, data)
  if (name === 'dashboardStats') {
    await ensureTeacherRequest(sql, data)
    return dashboardStats(sql)
  }
  throw new Error(`Vercel API 不支持 ${name}`)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    const sql = getSql()
    await ensureSchema(sql)

    if (req.query.health) {
      res.status(200).json({ ok: true, service: 'dangwushouji-api' })
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const result = await dispatch(sql, cleanText(body.name), body.data || {})
    res.status(200).json({ ok: true, result })
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || 'Request failed'
    })
  }
}
