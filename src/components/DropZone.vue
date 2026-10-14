<script setup>
import { ref } from 'vue'

const emit = defineEmits(['files'])
const dragging = ref(false)
const inputRef = ref(null)

function onDrop(e) {
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) emit('files', files)
}
function onChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length) emit('files', files)
  e.target.value = ''
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ dragging }"
    @click="inputRef.click()"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input ref="inputRef" type="file" accept="image/*" multiple hidden @change="onChange" />
    <div class="dz-icon">🖼️</div>
    <p class="dz-main">点击选择图片，或拖拽 / 粘贴到此处</p>
    <p class="dz-sub">支持 PNG / JPG / WebP / GIF / BMP，可批量；动图仅取第一帧</p>
  </div>
</template>
