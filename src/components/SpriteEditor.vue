<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

// 整图切图模式：画师把多张表情放在一张大图上交付，
// 这里用固定大小的方形截取框 + 可拖动/缩放的底图来逐张截取。
// 框的大小和位置固定（居中），用户只拖动图片来对齐。
const emit = defineEmits(['capture'])

const wrapRef = ref(null)
const fileInputRef = ref(null)
const sheet = reactive({ file: null, url: '', w: 0, h: 0, base: '' })
const view = reactive({ scale: 1, ox: 0, oy: 0 })
const frame = reactive({ size: 240, x: 0, y: 0 })
const dragging = ref(false)
const dragStart = { x: 0, y: 0, ox: 0, oy: 0 }

const hasSheet = computed(() => !!sheet.file)
const captureRectPx = computed(() => Math.round(frame.size / view.scale))
const scalePct = computed(() => Math.round(view.scale * 100))

const clamp = (v, a, b) => Math.min(Math.max(v, a), b)

// 最小缩放：保证截取框完整落在图片内（且不小于视野的一半）
const minScale = computed(() => {
  if (!sheet.w) return 0.05
  const r = wrapRef.value?.getBoundingClientRect()
  const fit = r ? Math.min(r.width / sheet.w, r.height / sheet.h) : 0.05
  return Math.max(fit * 0.5, frame.size / Math.min(sheet.w, sheet.h))
})

// 钳制底图位移：截取框必须始终完整覆盖在图片内部
function clampOffset() {
  if (!sheet.w) return
  const minX = frame.x - sheet.w * view.scale + frame.size
  const maxX = frame.x
  const minY = frame.y - sheet.h * view.scale + frame.size
  const maxY = frame.y
  if (minX <= maxX) view.ox = clamp(view.ox, minX, maxX)
  if (minY <= maxY) view.oy = clamp(view.oy, minY, maxY)
}

// 缩放时保持框中心对准的图片内容不动
function setScale(next) {
  if (!sheet.w) return
  const s = clamp(next, minScale.value, 16)
  const cx = frame.x + frame.size / 2
  const cy = frame.y + frame.size / 2
  const px = (cx - view.ox) / view.scale
  const py = (cy - view.oy) / view.scale
  view.scale = s
  view.ox = cx - px * s
  view.oy = cy - py * s
  clampOffset()
}

function layoutFrame() {
  const r = wrapRef.value.getBoundingClientRect()
  frame.size = Math.max(150, Math.min(280, Math.floor(Math.min(r.width, r.height) * 0.62)))
  frame.x = Math.floor((r.width - frame.size) / 2)
  frame.y = Math.floor((r.height - frame.size) / 2)
}

// 默认视野：截取区域约为图片短边的 1/4（4×4 拼图正好一格），居中
function resetView() {
  if (!sheet.w) return
  const minDim = Math.min(sheet.w, sheet.h)
  const s = clamp(frame.size / (minDim / 4), minScale.value, 16)
  view.scale = s
  view.ox = frame.x + frame.size / 2 - (sheet.w * s) / 2
  view.oy = frame.y + frame.size / 2 - (sheet.h * s) / 2
  clampOffset()
}

async function loadFile(file) {
  const ok = file && (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))
  if (!ok) return false
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('bad image'))
      img.src = url
    })
    if (sheet.url) URL.revokeObjectURL(sheet.url)
    sheet.file = file
    sheet.url = url
    sheet.w = img.naturalWidth
    sheet.h = img.naturalHeight
    sheet.base = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_')
    await nextTick()
    layoutFrame()
    resetView()
    return true
  } catch {
    URL.revokeObjectURL(url)
    return false
  }
}

function onPointerDown(e) {
  if (!hasSheet.value) return
  dragging.value = true
  wrapRef.value.setPointerCapture(e.pointerId)
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.ox = view.ox
  dragStart.oy = view.oy
}
function onPointerMove(e) {
  if (!dragging.value) return
  view.ox = dragStart.ox + (e.clientX - dragStart.x)
  view.oy = dragStart.oy + (e.clientY - dragStart.y)
  clampOffset()
}
function onPointerUp() {
  dragging.value = false
}

function onWheel(e) {
  if (!hasSheet.value) return
  setScale(view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
}

function onKey(e) {
  if (!hasSheet.value) return
  const step = e.shiftKey ? 10 : 1
  const map = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const d = map[e.key]
  if (!d) return
  e.preventDefault()
  view.ox += d[0]
  view.oy += d[1]
  clampOffset()
}

function onDrop(e) {
  const f = Array.from(e.dataTransfer?.files || []).find(x => x.type.startsWith('image/'))
  if (f) loadFile(f)
}
function chooseFile() {
  fileInputRef.value?.click()
}
function onFileChange(e) {
  const f = e.target.files?.[0]
  if (f) loadFile(f)
  e.target.value = ''
}

function capture() {
  if (!hasSheet.value) return
  const s = view.scale
  const size = Math.round(frame.size / s)
  emit('capture', {
    file: sheet.file,
    base: sheet.base,
    rect: {
      x: clamp(Math.round((frame.x - view.ox) / s), 0, sheet.w - size),
      y: clamp(Math.round((frame.y - view.oy) / s), 0, sheet.h - size),
      w: size,
      h: size,
    },
  })
}

let ro = null
onMounted(() => {
  ro = new ResizeObserver(() => {
    if (!wrapRef.value || !sheet.w) return
    layoutFrame()
    clampOffset()
  })
  if (wrapRef.value) ro.observe(wrapRef.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (sheet.url) URL.revokeObjectURL(sheet.url)
})

defineExpose({ loadFile })
</script>

<template>
  <div class="panel sprite-panel">
    <div class="sprite-head">
      <h2 class="sprite-title">✂ 多图合一</h2>
      <p class="sprite-sub">画师把多张表情放在一张大图上交付？放入整图，拖动底图用固定方框逐张截取</p>
    </div>

    <div
      v-if="!hasSheet"
      class="sprite-empty"
      @click="chooseFile"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input ref="fileInputRef" type="file" accept="image/*" hidden @change="onFileChange" />
      <div class="dz-icon">🖼️</div>
      <p class="dz-main">点击选择或拖拽 / 粘贴多合一整图</p>
      <p class="dz-sub">支持 PNG / JPG / WebP / GIF / BMP；动图取第一帧</p>
    </div>

    <template v-else>
      <div
        ref="wrapRef"
        class="sprite-wrap checker"
        :class="{ dragging }"
        tabindex="0"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
        @keydown="onKey"
      >
        <img
          class="sprite-img"
          :src="sheet.url"
          :style="{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.scale})` }"
          draggable="false"
          alt="表情底图"
        />
        <div class="frame" :style="{ left: frame.x + 'px', top: frame.y + 'px', width: frame.size + 'px', height: frame.size + 'px' }">
          <span class="frame-tag">截取 {{ captureRectPx }}×{{ captureRectPx }} px</span>
        </div>
        <span class="sheet-meta">{{ sheet.base }} · {{ sheet.w }}×{{ sheet.h }}</span>
      </div>

      <div class="sprite-bar">
        <div class="zoom">
          <button type="button" class="btn small ghost" title="缩小" @click="setScale(view.scale / 1.25)">−</button>
          <span class="zoom-pct">{{ scalePct }}%</span>
          <button type="button" class="btn small ghost" title="放大" @click="setScale(view.scale * 1.25)">＋</button>
        </div>
        <button type="button" class="btn small ghost" @click="resetView">复位</button>
        <button type="button" class="btn small ghost" @click="chooseFile">换一张图</button>
        <button type="button" class="btn primary" @click="capture">✂ 截取这张表情</button>
        <p class="sprite-hint">拖动底图对齐方框 · 滚轮缩放 · 方向键微调（Shift 大步）</p>
        <input ref="fileInputRef" type="file" accept="image/*" hidden @change="onFileChange" />
      </div>
    </template>
  </div>
</template>
