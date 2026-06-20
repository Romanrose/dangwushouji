const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function countByStatus(status) {
  const result = await db.collection('materials').where({ status }).count()
  return result.total
}

exports.main = async () => {
  const [total, pendingReceive, received, returned, recentResult, unreturnedResult, recordsResult] = await Promise.all([
    db.collection('materials').count(),
    countByStatus('pending_receive'),
    countByStatus('received'),
    countByStatus('returned'),
    db.collection('materials').orderBy('created_at', 'desc').limit(100).get(),
    db.collection('materials').where({ status: 'received' }).orderBy('updated_at', 'desc').limit(100).get(),
    db.collection('circulation_records').orderBy('action_time', 'desc').limit(20).get()
  ])

  // 部门汇总：遍历全部材料（云数据库 count 上限 1000，需分批读取）
  const branchMap = {}
  const BATCH_SIZE = 100
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const batch = await db.collection('materials')
      .field({ branch: true, received_branch: true, status: true })
      .skip(offset)
      .limit(BATCH_SIZE)
      .get()
    batch.data.forEach((item) => {
      const branch = item.branch || item.received_branch || '未填写支部'
      if (!branchMap[branch]) {
        branchMap[branch] = {
          branch,
          total: 0,
          pending_receive: 0,
          received: 0,
          returned: 0
        }
      }
      branchMap[branch].total += 1
      branchMap[branch][item.status] = (branchMap[branch][item.status] || 0) + 1
    })
    offset += batch.data.length
    hasMore = batch.data.length === BATCH_SIZE
  }

  return {
    stats: {
      total: total.total,
      pending_receive: pendingReceive,
      received,
      returned
    },
    recentMaterials: recentResult.data,
    unreturned: unreturnedResult.data,
    branchSummary: Object.values(branchMap).sort((a, b) => b.total - a.total),
    recentRecords: recordsResult.data
  }
}
