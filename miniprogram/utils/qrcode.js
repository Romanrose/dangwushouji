/**
 * 轻量级 QR Code 生成器（支持数字/字母/中文混合模式，版本 1-10）
 * 仅依赖微信小程序 Canvas API，无外部依赖
 */

// --- QR Code 编码核心 ---

// 数据模式指示符
const MODE_NUMERIC = 1
const MODE_ALPHANUMERIC = 2
const MODE_BYTE = 4

// 纠错等级
const EC_LEVEL_M = 0

// 版本容量表（版本 1-10，EC Level M，混合模式近似值）
const CAPACITIES = [
  0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213
]

// 各版本的 EC 纠错码数量（简化）
const EC_CODEWORDS = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26
]

// 各版本的分组信息 [numBlocks, ecPerBlock, dataPerBlock]
const BLOCK_INFO = [
  null,
  [1, 10, 16],
  [1, 16, 28],
  [1, 26, 44],
  [2, 18, 32],
  [2, 24, 43],
  [4, 16, 27],
  [4, 18, 31],
  [2, 22, 38],
  [3, 22, 36],
  [4, 26, 43]
]

// 字符集映射
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

function getMode(text) {
  if (/^\d+$/.test(text)) return MODE_NUMERIC
  if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) return MODE_ALPHANUMERIC
  return MODE_BYTE
}

function getMinVersion(dataLength, mode) {
  for (let v = 1; v <= 10; v++) {
    const cap = CAPACITIES[v]
    if (!cap) continue
    let bitsNeeded
    if (mode === MODE_NUMERIC) {
      bitsNeeded = 4 + Math.floor(dataLength / 3) * 10 + (dataLength % 3 === 2 ? 7 : dataLength % 3 === 1 ? 4 : 0)
    } else if (mode === MODE_ALPHANUMERIC) {
      bitsNeeded = 4 + Math.floor(dataLength / 2) * 11 + (dataLength % 2 === 1 ? 6 : 0)
    } else {
      bitsNeeded = 4 + 8 + dataLength * 8
    }
    if (bitsNeeded <= cap * 8) return v
  }
  return 10
}

// GF(256) 运算
const GF_EXP = new Array(512)
const GF_LOG = new Array(256)
;(function initGF() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function generatorPoly(nsym) {
  let g = [1]
  for (let i = 0; i < nsym; i++) {
    const ng = new Array(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j]
      ng[j + 1] ^= gfMul(g[j], GF_EXP[i])
    }
    g = ng
  }
  return g
}

function encodeData(text, version) {
  const mode = getMode(text)
  const dataCapacity = CAPACITIES[version]
  const bits = []

  function pushBits(value, length) {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }

  // 模式指示符
  pushBits(mode, 4)

  // 字符计数
  const charCountBits = version <= 9 ? (mode === MODE_BYTE ? 8 : mode === MODE_ALPHANUMERIC ? 9 : 10) : (mode === MODE_BYTE ? 16 : mode === MODE_ALPHANUMERIC ? 11 : 12)
  pushBits(text.length, charCountBits)

  // 数据编码
  if (mode === MODE_NUMERIC) {
    for (let i = 0; i < text.length; i += 3) {
      const group = text.substring(i, i + 3)
      pushBits(parseInt(group, 10), group.length === 3 ? 10 : group.length === 2 ? 7 : 4)
    }
  } else if (mode === MODE_ALPHANUMERIC) {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        pushBits(ALPHANUMERIC_CHARS.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARS.indexOf(text[i + 1]), 11)
      } else {
        pushBits(ALPHANUMERIC_CHARS.indexOf(text[i]), 6)
      }
    }
  } else {
    // UTF-8 编码
    const encoder = new TextEncoder()
    const bytes = encoder.encode(text)
    pushBits(bytes.length, 8)
    for (const b of bytes) pushBits(b, 8)
  }

  // 终止符
  const totalBits = dataCapacity * 8
  const terminatorLength = Math.min(4, totalBits - bits.length)
  pushBits(0, terminatorLength)

  // 字节对齐
  while (bits.length % 8 !== 0) bits.push(0)

  // 填充字节
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bits.length < totalBits) {
    pushBits(padBytes[padIdx], 8)
    padIdx = (padIdx + 1) % 2
  }

  return bits
}

function addErrorCorrection(dataBits, version) {
  const nsym = EC_CODEWORDS[version]
  const [numBlocks, ecPerBlock, dataPerBlock] = BLOCK_INFO[version]

  // 将数据位转为字节
  const dataBytes = []
  for (let i = 0; i < dataBits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (dataBits[i + j] || 0)
    dataBytes.push(byte)
  }

  const g = generatorPoly(ecPerBlock)
  const dataBlocks = []
  const ecBlocks = []

  // 分割数据块
  let offset = 0
  for (let i = 0; i < numBlocks; i++) {
    const block = dataBytes.slice(offset, offset + dataPerBlock)
    offset += dataPerBlock
    dataBlocks.push(block)

    // 计算 EC
    const remainder = new Array(ecPerBlock).fill(0)
    for (const byte of block) {
      const lead = byte ^ remainder.shift()
      remainder.push(0)
      for (let j = 0; j < ecPerBlock; j++) {
        remainder[j] ^= gfMul(g[j + 1], lead)
      }
    }
    ecBlocks.push(remainder)
  }

  // 交织
  const result = []
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length))
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i])
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i])
    }
  }

  return result
}

// --- QR Code 矩阵绘制 ---

function createMatrix(version) {
  const size = version * 4 + 17
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0))
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))
  return { matrix, reserved, size }
}

function placeFinderPattern(mat, row, col) {
  const pattern = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1]
  ]
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const mr = row + r, mc = col + c
      if (mr >= 0 && mr < mat.size && mc >= 0 && mc < mat.size) {
        mat.matrix[mr][mc] = pattern[r][c]
        mat.reserved[mr][mc] = true
      }
    }
  }
  // 分隔符
  for (let i = 0; i < 8; i++) {
    const positions = [
      [row - 1, col + i], [row + 7, col + i],
      [row + i, col - 1], [row + i, col + 7]
    ]
    for (const [r, c] of positions) {
      if (r >= 0 && r < mat.size && c >= 0 && c < mat.size) {
        mat.matrix[r][c] = 0
        mat.reserved[r][c] = true
      }
    }
  }
}

function placeTimingPatterns(mat) {
  for (let i = 8; i < mat.size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0
    if (!mat.reserved[6][i]) {
      mat.matrix[6][i] = val
      mat.reserved[6][i] = true
    }
    if (!mat.reserved[i][6]) {
      mat.matrix[i][6] = val
      mat.reserved[i][6] = true
    }
  }
}

function placeDarkModule(mat) {
  mat.matrix[mat.size - 8][8] = 1
  mat.reserved[mat.size - 8][8] = true
}

function reserveFormatArea(mat) {
  // 掩盖格式信息区域
  for (let i = 0; i < 15; i++) {
    // 左上角
    if (i < 6) { mat.reserved[8][i] = true }
    else if (i < 8) { mat.reserved[8][i + 1] = true }
    else if (i < 9) { mat.reserved[8 - (i - 8)][8] = true }
    else { mat.reserved[14 - i][8] = true }
    // 右上和左下
    if (i < 8) { mat.reserved[i][mat.size - 1 - (i < 6 ? 0 : i - 5)] = true }
    else { mat.reserved[mat.size - 1 - (14 - i)][8] = true }
  }
  for (let i = 0; i < 8; i++) {
    mat.reserved[mat.size - 1 - i][8] = true
    mat.reserved[8][mat.size - 8 + i] = true
  }
}

function placeData(mat, dataBytes) {
  let bitIdx = 0
  const totalBits = dataBytes.length * 8
  let col = mat.size - 1

  while (col >= 0) {
    if (col === 6) col-- // 跳过定时图案列
    const upward = ((mat.size - 1 - col) / 2) % 2 === 0

    for (let i = 0; i < mat.size; i++) {
      const row = upward ? mat.size - 1 - i : i
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc
        if (c < 0 || mat.reserved[row][c]) continue
        if (bitIdx < totalBits) {
          const byteIdx = Math.floor(bitIdx / 8)
          const bitPos = 7 - (bitIdx % 8)
          mat.matrix[row][c] = (dataBytes[byteIdx] >> bitPos) & 1
          bitIdx++
        }
      }
    }
    col -= 2
  }
}

function applyMask(mat, maskNum) {
  const masks = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0
  ]
  const fn = masks[maskNum]
  for (let r = 0; r < mat.size; r++) {
    for (let c = 0; c < mat.size; c++) {
      if (!mat.reserved[r][c] && fn(r, c)) {
        mat.matrix[r][c] ^= 1
      }
    }
  }
}

function generateQR(text) {
  const mode = getMode(text)
  const version = getMinVersion(text.length, mode)
  const dataBits = encodeData(text, version)
  const dataBytes = addErrorCorrection(dataBits, version)

  const mat = createMatrix(version)

  // 放置功能图案
  placeFinderPattern(mat, 0, 0)
  placeFinderPattern(mat, 0, mat.size - 7)
  placeFinderPattern(mat, mat.size - 7, 0)
  placeTimingPatterns(mat)
  placeDarkModule(mat)
  reserveFormatArea(mat)

  // 放置数据
  placeData(mat, dataBytes)

  // 应用掩码（选择 0 号掩码，简化版）
  applyMask(mat, 0)

  return { matrix: mat.matrix, size: mat.size }
}

// --- Canvas 绘制 ---

function drawQRCode(canvas, text, options = {}) {
  const {
    moduleSize = 4,
    margin = 4,
    darkColor = '#000000',
    lightColor = '#ffffff'
  } = options

  const qr = generateQR(text)
  const canvasSize = qr.size * moduleSize + margin * 2

  canvas.width = canvasSize
  canvas.height = canvasSize

  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = lightColor
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  // 绘制模块
  ctx.fillStyle = darkColor
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.matrix[r][c]) {
        ctx.fillRect(
          margin + c * moduleSize,
          margin + r * moduleSize,
          moduleSize,
          moduleSize
        )
      }
    }
  }

  return canvasSize
}

module.exports = { generateQR, drawQRCode }
