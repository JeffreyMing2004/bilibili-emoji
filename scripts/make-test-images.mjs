// 生成浏览器实测用的测试图片（纯 Node 手写 PNG，无第三方依赖）
// 用法：node scripts/make-test-images.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(w, h, rgba) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.resolve('test-images')
fs.mkdirSync(outDir, { recursive: true })

// 1. 带透明的"贴纸"：粉色圆角方块 + 白色 B 形状，516x516
{
  const w = 516, h = 516
  const px = Buffer.alloc(w * h * 4)
  const r = 90 // 圆角半径
  const put = (x, y, [R, G, B, A]) => {
    const i = (y * w + x) * 4
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = A
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 圆角方块 SDF
      const dx = Math.max(r - x, x - (w - 1 - r), 0)
      const dy = Math.max(r - y, y - (h - 1 - r), 0)
      const outside = Math.hypot(dx, dy) > r
      if (outside) { put(x, y, [0, 0, 0, 0]); continue }
      // 简易 "B"：两根竖条 + 上下两个圆
      const inBar = x > w * 0.36 && x < w * 0.44 && y > h * 0.2 && y < h * 0.8
      const c1 = Math.hypot(x - w * 0.58, y - h * 0.31)
      const c2 = Math.hypot(x - w * 0.58, y - h * 0.67)
      const inC = (c1 > w * 0.07 && c1 < w * 0.16 && x > w * 0.44 && x < w * 0.74) ||
                  (c2 > w * 0.10 && c2 < w * 0.20 && x > w * 0.44 && x < w * 0.74)
      if (inBar || inC) put(x, y, [255, 255, 255, 255])
      else put(x, y, [251, 114, 153, 255])
    }
  }
  fs.writeFileSync(path.join(outDir, 'sticker.png'), encodePNG(w, h, px))
}

// 2. 随机噪点图 640x640（难以压缩，用于测试量化 + 体积二分）
{
  const w = 640, h = 640
  const px = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = Math.random() * 256 | 0
    px[i * 4 + 1] = Math.random() * 256 | 0
    px[i * 4 + 2] = Math.random() * 256 | 0
    px[i * 4 + 3] = 255
  }
  fs.writeFileSync(path.join(outDir, 'noise.png'), encodePNG(w, h, px))
}

// 3. 长方形渐变 900x400（测试 contain 留白）
{
  const w = 900, h = 400
  const px = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      px[i] = 40 + (x / w) * 200 | 0
      px[i + 1] = 120 + (y / h) * 100 | 0
      px[i + 2] = 230 - (x / w) * 100 | 0
      px[i + 3] = 255
    }
  }
  fs.writeFileSync(path.join(outDir, 'wide-gradient.png'), encodePNG(w, h, px))
}

// 4. 小尺寸扁平图 80x80（测试放大）
{
  const w = 80, h = 80
  const px = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const d = Math.hypot(x - 40, y - 40)
      if (d < 20) { px[i] = 255; px[i + 1] = 200; px[i + 2] = 40; }
      else if (d < 36) { px[i] = 30; px[i + 1] = 160; px[i + 2] = 240; }
      else { px[i] = 240; px[i + 1] = 240; px[i + 2] = 240; }
      px[i + 3] = 255
    }
  }
  fs.writeFileSync(path.join(outDir, 'small.png'), encodePNG(w, h, px))
}

// 5. 画师多合一整图 1152x1152：4x4 网格，每格 288px，颜色各异 + 圆点标记（切图模式测试）
{
  const w = 1152, h = 1152, cell = 288
  const px = Buffer.alloc(w * h * 4)
  const put = (x, y, [R, G, B]) => {
    const i = (y * w + x) * 4
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255
  }
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const x0 = gx * cell, y0 = gy * cell
      const idx = gy * 4 + gx
      // 每格不同底色（HSL 转近似 RGB 的简易取色）
      const bg = [
        (idx * 47) % 255, (idx * 89 + 60) % 255, (idx * 131 + 120) % 255,
      ]
      for (let y = y0; y < y0 + cell; y++) {
        for (let x = x0; x < x0 + cell; x++) {
          // 网格线
          if (x === x0 || y === y0) { put(x, y, [60, 60, 70]); continue }
          // 中心圆点（半径随格子序号变化，便于肉眼区分）
          const d = Math.hypot(x - (x0 + cell / 2), y - (y0 + cell / 2))
          if (d < 40 + idx * 8) put(x, y, [255, 255, 255])
          else put(x, y, bg)
        }
      }
      // 左上角小方块序号刻痕
      for (let y = y0 + 12; y < y0 + 36; y++) {
        for (let x = x0 + 12; x < x0 + 12 + 10 * ((idx % 4) + 1); x++) put(x, y, [20, 20, 20])
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'sheet.png'), encodePNG(w, h, px))
}

// 6. 偏心透明图 400x400：内容（实心圆）明显偏左上，其余全透明（居中检测测试）
{
  const w = 400, h = 400
  const px = Buffer.alloc(w * h * 4) // 全透明
  for (let y = 60; y < 200; y++) {
    for (let x = 60; x < 200; x++) {
      if (Math.hypot(x - 130, y - 130) <= 65) {
        const i = (y * w + x) * 4
        px[i] = 251; px[i + 1] = 114; px[i + 2] = 153; px[i + 3] = 255
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'offcenter.png'), encodePNG(w, h, px))
}

console.log('测试图片已生成到 test-images/：')
for (const f of fs.readdirSync(outDir)) {
  console.log(`  ${f}  ${(fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1)} KB`)
}
