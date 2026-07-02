const STATUS_TEXT = {
  pending_receive: '待领取',
  received: '待回收',
  returned: '已回收'
}

const STATUS_CLASS = {
  pending_receive: 'warn',
  received: '',
  returned: 'done'
}

function statusText(status) {
  return STATUS_TEXT[status] || '未知'
}

function statusClass(status) {
  return STATUS_CLASS[status] || ''
}

function formatTime(value) {
  if (!value) return '-'
  let date
  if (value instanceof Date) {
    date = value
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // 纯日期字符串（如 "2026-06-10"）按本地时间解析，避免 UTC 午夜导致时区偏移
    const parts = value.split('-')
    date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  } else {
    date = new Date(value)
  }
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

module.exports = {
  statusText,
  statusClass,
  formatTime
}
