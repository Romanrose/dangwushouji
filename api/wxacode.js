const WX_APP_ID = 'wx3a498496ce7588e6'
const WX_APP_SECRET = process.env.WX_APP_SECRET || ''
const WXACODE_ENV_VERSION = process.env.WXACODE_ENV_VERSION || 'release'

let cachedToken = ''
let cachedTokenExpiresAt = 0

function cleanText(value) {
  return String(value || '').trim()
}

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedTokenExpiresAt > now + 60000) {
    return cachedToken
  }
  if (!WX_APP_SECRET) {
    throw new Error('WX_APP_SECRET is not configured')
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APP_ID}&secret=${WX_APP_SECRET}`
  const response = await fetch(url)
  const data = await response.json()
  if (!data.access_token) {
    throw new Error(data.errmsg || 'Failed to get WeChat access token')
  }

  cachedToken = data.access_token
  cachedTokenExpiresAt = now + ((data.expires_in || 7200) * 1000)
  return cachedToken
}

module.exports = async function handler(req, res) {
  try {
    const materialId = cleanText(req.query.material_id)
    if (!materialId) {
      res.status(400).json({ ok: false, error: 'missing material_id' })
      return
    }

    const token = await getAccessToken()
    const response = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        scene: materialId,
        page: 'pages/scan/scan',
        check_path: false,
        env_version: WXACODE_ENV_VERSION,
        width: 430
      })
    })
    const contentType = response.headers.get('content-type') || ''
    const buffer = Buffer.from(await response.arrayBuffer())

    if (contentType.includes('application/json')) {
      let message = 'Failed to generate WeChat mini program code'
      try {
        const json = JSON.parse(buffer.toString('utf8'))
        message = json.errmsg || message
      } catch (_) {}
      res.status(400).json({ ok: false, error: message })
      return
    }

    res.setHeader('content-type', contentType || 'image/jpeg')
    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=86400')
    res.status(200).send(buffer)
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || 'Failed to generate WeChat mini program code'
    })
  }
}
