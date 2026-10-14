// 核心处理管线：File -> 1:1 适配画布 -> 缩放到目标尺寸 -> PNG 调色板量化，
// 用二分搜索颜色数把体积压到目标上限以内（尽可能保留颜色）。
import UPNG from 'upng-js'

export async function loadImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('图片解析失败，请确认文件未损坏'))
      img.src = url
    })
    // 注意：GIF / 动图 WebP / APNG 仅绘制第一帧
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 把图片绘制成 size×size 的正方形 ImageData
// fit: contain 留白 | cover 居中裁剪 | stretch 拉伸
export function drawSquare(img, size, fit, bgTransparent, bgColor) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height

  if (fit === 'stretch') {
    ctx.drawImage(img, 0, 0, size, size)
  } else if (fit === 'cover') {
    const scale = Math.max(size / iw, size / ih)
    const w = iw * scale
    const h = ih * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  } else {
    if (!bgTransparent) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, size, size)
    }
    const scale = Math.min(size / iw, size / ih)
    const w = iw * scale
    const h = ih * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  }
  return ctx.getImageData(0, 0, size, size)
}

// 把整图中的某个正方形区域绘制成 size×size 的 ImageData（切图模式用）
export function drawRegion(img, rect, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

function encodePng(imageData, cnum) {
  // cnum = 0 表示真彩色（不量化），>0 表示调色板颜色数
  const buf = UPNG.encode([imageData.data.buffer], imageData.width, imageData.height, cnum)
  return new Blob([buf], { type: 'image/png' })
}

// 体积控制：先真彩色，超限则二分搜索颜色数量化；返回达标结果或极限压缩的未达标结果
function compressImageData(imageData, maxBytes) {
  let blob = encodePng(imageData, 0)
  if (blob.size <= maxBytes) {
    return { blob, cnum: 0, ok: true }
  }

  let lo = 2
  let hi = 256
  let best = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const b = encodePng(imageData, mid)
    if (b.size <= maxBytes) {
      best = { blob: b, cnum: mid }
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best) {
    return { blob: best.blob, cnum: best.cnum, ok: true }
  }

  // 2 色仍超限（极小体积上限 + 复杂噪点图才会发生）：返回极限压缩结果并标记未达标
  blob = encodePng(imageData, 2)
  return { blob, cnum: 2, ok: false }
}

// 非透明内容（alpha > 16）的包围盒
function contentBBox(data, w, h) {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { minX, minY, maxX, maxY }
}

// 判断内容是否在画布正中：返回与画布中心的像素偏移。
// 内容铺满画布（无透明边缘）时返回 null，此时没有"居中"可言（如纯色背景图）。
function analyzeCenter(imageData) {
  const { width: w, height: h, data } = imageData
  const bbox = contentBBox(data, w, h)
  if (!bbox) return null
  const hasMargin =
    bbox.minX > 0 || bbox.minY > 0 || bbox.maxX < w - 1 || bbox.maxY < h - 1
  if (!hasMargin) return null
  const dx = Math.round((bbox.minX + bbox.maxX) / 2 - (w - 1) / 2)
  const dy = Math.round((bbox.minY + bbox.maxY) / 2 - (h - 1) / 2)
  return { dx, dy, centered: Math.abs(dx) <= 2 && Math.abs(dy) <= 2 }
}

// 把透明画布上的内容裁边后放到正中
function centerImageData(imageData) {
  const { width: w, height: h, data } = imageData
  const bbox = contentBBox(data, w, h)
  if (!bbox) return imageData
  const bw = bbox.maxX - bbox.minX + 1
  const bh = bbox.maxY - bbox.minY + 1
  const dstX = Math.floor((w - bw) / 2)
  const dstY = Math.floor((h - bh) / 2)
  if (dstX === bbox.minX && dstY === bbox.minY) return imageData
  const out = new Uint8ClampedArray(w * h * 4) // 全透明
  for (let y = 0; y < bh; y++) {
    const srcStart = ((bbox.minY + y) * w + bbox.minX) * 4
    const dstStart = ((dstY + y) * w + dstX) * 4
    out.set(data.subarray(srcStart, srcStart + bw * 4), dstStart)
  }
  return new ImageData(out, w, h)
}

// 收尾：可选自动居中 -> 居中检测 -> 体积压缩
function finishPipeline(imageData, opts) {
  if (opts.autoCenter) imageData = centerImageData(imageData)
  const center = analyzeCenter(imageData)
  const r = compressImageData(imageData, opts.maxKB * 1024)
  return { ...r, center }
}

// 主入口 A：处理整张图片文件
export async function processImage(file, opts) {
  const img = await loadImage(file)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const imageData = drawSquare(img, opts.size, opts.fit, opts.bgTransparent, opts.bgColor)
  return { ...finishPipeline(imageData, opts), origW: iw, origH: ih }
}

// 主入口 B：处理整图中的正方形区域（画师多合一底图切图）
// rawBytes 为截取区域的真彩色 PNG 体积，用于界面上展示"截取前"大小
export async function processRect(file, rect, opts) {
  const img = await loadImage(file)
  const imageData = drawRegion(img, rect, opts.size)
  const r = finishPipeline(imageData, opts)
  const rawBytes = r.cnum === 0 ? r.blob.size : encodePng(imageData, 0).size
  return { ...r, rawBytes, origW: rect.w, origH: rect.h }
}

// 生成截取区域的原始预览 URL（不压缩，仅供结果卡片展示）
export async function cropPreviewUrl(file, rect) {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = rect.w
  canvas.height = rect.h
  canvas.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  return URL.createObjectURL(blob)
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' kb'
  return bytes + ' B'
}

export function outputName(fileName, size) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_')
  return `${base}_${size}.png`
}
