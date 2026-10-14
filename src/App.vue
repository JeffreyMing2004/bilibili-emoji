<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import JSZip from 'jszip'
import PresetPanel from './components/PresetPanel.vue'
import SpriteEditor from './components/SpriteEditor.vue'
import ResultCard from './components/ResultCard.vue'
import SpecNote from './components/SpecNote.vue'
import EmojiPreview from './components/EmojiPreview.vue'
import { processRect, outputName, formatSize, cropPreviewUrl } from './lib/process'
import {
  loadSettings, saveSettings, loadPresetChoice, savePresetChoice, PRESETS,
} from './lib/presets'

const settings = reactive(loadSettings())
const presetId = ref(loadPresetChoice())

const items = ref([])
let uid = 0
let cropCount = 0
let queue = []
let draining = false
let reprocessTimer = null

const spriteRef = ref(null)

const currentPreset = computed(() => PRESETS.find(p => p.id === presetId.value))
const doneCount = computed(() => items.value.filter(i => i.status === 'done').length)
const okCount = computed(() => items.value.filter(i => i.status === 'done' && i.ok).length)
const totalOutBytes = computed(() =>
  items.value.reduce((s, i) => s + (i.status === 'done' ? i.outBytes : 0), 0))

function updatePresetId(id) {
  presetId.value = id
  savePresetChoice(id)
}
function updateSettings(s) {
  Object.assign(settings, s)
}

function isImage(f) {
  return f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name)
}

function enqueue(item) {
  item.status = 'processing'
  item.error = ''
  queue.push(item)
  drain()
}

async function drain() {
  if (draining) return
  draining = true
  while (queue.length) {
    const item = queue.shift()
    if (!items.value.includes(item)) continue // 已被移除
    try {
      const opts = settings[presetId.value]
      const r = await processRect(item.file, item.rect, opts)
      if (item.outUrl) URL.revokeObjectURL(item.outUrl)
      item.origW = r.origW
      item.origH = r.origH
      item.outW = opts.size
      item.outH = opts.size
      if (item.rect) item.origBytes = r.rawBytes
      item.outBytes = r.blob.size
      item.outUrl = URL.createObjectURL(r.blob)
      item.blob = r.blob
      item.cnum = r.cnum
      item.ok = r.ok
      item.center = r.center || null
      item.status = 'done'
    } catch (e) {
      item.status = 'error'
      item.error = e?.message || '处理失败'
    }
    await nextTick()
  }
  draining = false
}

// 设置或预设变化 -> 防抖后全部重新处理（丢弃未开始的旧任务）
watch(() => [settings, presetId.value], () => {
  saveSettings(settings)
  clearTimeout(reprocessTimer)
  reprocessTimer = setTimeout(() => {
    queue = []
    for (const item of items.value) enqueue(item)
  }, 250)
}, { deep: true })

function removeItem(item) {
  const i = items.value.indexOf(item)
  if (i >= 0) {
    URL.revokeObjectURL(item.origUrl)
    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
    items.value.splice(i, 1)
    if (previewItem.value === item) previewItem.value = null
  }
}

// 修改文件名（基础名，输出时自动加 _尺寸.png 后缀）
function renameItem(item, base) {
  item.name = base + '.png'
}

const previewItem = ref(null)
function openPreview(item) {
  previewItem.value = item
}

function clearAll() {
  for (const item of items.value) {
    URL.revokeObjectURL(item.origUrl)
    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  }
  items.value = []
  queue = []
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function downloadOne(item) {
  downloadBlob(item.blob, outputName(item.name, item.outW))
}

async function downloadZip() {
  const done = items.value.filter(i => i.status === 'done')
  if (!done.length) return
  const zip = new JSZip()
  const used = new Map()
  for (const item of done) {
    let name = outputName(item.name, item.outW)
    const n = (used.get(name) || 0) + 1
    used.set(name, n)
    if (n > 1) name = name.replace(/\.png$/, `(${n}).png`)
    zip.file(name, item.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `bilibili-${currentPreset.value.id}-emoji.zip`)
}

function onPaste(e) {
  const files = Array.from(e.clipboardData?.files || [])
  const img = files.find(isImage)
  if (img) spriteRef.value?.loadFile(img)
}

// 切图模式：截取一个方形区域并加入结果列表
function onSpriteCapture({ file, base, rect }) {
  const item = reactive({
    id: ++uid,
    file,
    rect,
    name: `${base}_cut${String(++cropCount).padStart(2, '0')}.png`,
    origBytes: 0,
    origUrl: '',
    outUrl: null,
    outBytes: 0,
    outW: 0,
    outH: 0,
    origW: rect.w,
    origH: rect.h,
    cnum: 0,
    ok: false,
    status: 'pending',
    error: '',
  })
  items.value.push(item)
  enqueue(item)
  cropPreviewUrl(file, rect).then(url => {
    if (items.value.includes(item)) item.origUrl = url
    else URL.revokeObjectURL(url) // 已被移除
  })
}
onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1>B站表情包工坊</h1>
      <p class="subtitle">
        一键把任意图片转换成符合 <b>哔哩哔哩直播间表情包 / 充电专属表情包</b> 要求的尺寸与体积。
        全程本地处理，图片不上传。
      </p>
    </header>

    <PresetPanel
      :preset-id="presetId"
      :settings="settings"
      @update:preset-id="updatePresetId"
      @update:settings="updateSettings"
    />

    <SpriteEditor ref="spriteRef" @capture="onSpriteCapture" />

    <section v-if="items.length" class="results">
      <div class="results-bar">
        <p class="summary">
          共 {{ items.length }} 张 · 已处理 {{ doneCount }} 张 ·
          <span :class="okCount === doneCount && doneCount > 0 ? 'ok-text' : 'warn-text'">
            {{ okCount }} 张符合 {{ currentPreset.name }}（{{ settings[presetId].size }}×{{ settings[presetId].size }}，≤{{ settings[presetId].maxKB }}kb）
          </span>
          <span v-if="totalOutBytes">· 输出合计 {{ formatSize(totalOutBytes) }}</span>
        </p>
        <div class="bar-actions">
          <button type="button" class="btn primary" :disabled="!doneCount" @click="downloadZip">
            ⬇ 全部下载 ZIP
          </button>
          <button type="button" class="btn ghost" @click="clearAll">清空</button>
        </div>
      </div>

      <transition-group name="card" tag="div" class="cards">
        <ResultCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          @remove="removeItem"
          @download="downloadOne"
          @rename="renameItem"
          @preview="openPreview"
        />
      </transition-group>
    </section>

    <EmojiPreview
      v-if="previewItem && previewItem.outUrl"
      :item="previewItem"
      @close="previewItem = null"
    />

    <SpecNote />

    <footer class="foot">
      充电表情包上限 10 张，直播间表情以直播中心页面要求为准 · 遇到问题可截图反馈
    </footer>
  </div>
</template>
