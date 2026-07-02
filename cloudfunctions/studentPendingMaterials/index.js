const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async () => {
  const result = await db.collection('materials')
    .where({ status: 'pending_receive' })
    .orderBy('created_at', 'desc')
    .limit(200)
    .get()

  return {
    materials: result.data.filter((item) => !item.deleted_at)
  }
}
