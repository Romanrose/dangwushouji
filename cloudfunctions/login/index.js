const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const admins = db.collection('admins')

  const total = await admins.count()
  if (total.total === 0) {
    try {
      // 尝试将当前用户设为初始化管理员
      await admins.add({
        data: {
          openid,
          name: '初始化管理员',
          role: 'owner',
          created_at: new Date()
        }
      })
      return { openid, role: 'owner', is_admin: true, bootstrapped: true }
    } catch (e) {
      // 并发竞态：另一个用户抢先成为了管理员，降级为普通查询
    }
  }

  const adminResult = await admins.where({ openid }).limit(1).get()
  const admin = adminResult.data[0]

  return {
    openid,
    role: admin ? admin.role : 'visitor',
    is_admin: Boolean(admin)
  }
}
