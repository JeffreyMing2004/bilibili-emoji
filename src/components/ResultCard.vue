<script setup>
import { computed, ref, nextTick } from 'vue'
import { formatSize } from '../lib/process'

const props = defineProps({
  item: { type: Object, required: true },
})
const emit = defineEmits(['remove', 'download', 'rename', 'preview'])

const editing = ref(false)
const editRef = ref(null)
const draft = ref('')

const statusText = computed(() => {
  if (props.item.status === 'pending') return '排队中…'
  if (props.item.status === 'processing') return '处理中…'
  if (props.item.status === 'error') return props.item.error || '处理失败'
  return ''
})

// 显示用基础名（去掉 .png 后缀）
const baseName = computed(() => props.item.name.replace(/\.png$/i, ''))

const centerText = computed(() => {
  const c = props.item.center
  if (!c) return ''
  if (c.centered) return { ok: true, text: '内容已居中 ✓' }
  const h = c.dx === 0 ? '' : c.dx > 0 ? `→${c.dx}px` : `←${-c.dx}px`
  const v = c.dy === 0 ? '' : c.dy > 0 ? `↓${c.dy}px` : `↑${-c.dy}px`
  return { ok: false, text: `内容偏移 ${[h, v].filter(Boolean).join(' ') || '0'}` }
})

function startEdit() {
  draft.value = baseName.value
  editing.value = true
  nextTick(() => editRef.value?.focus())
}
function commitEdit() {
  editing.value = false
  const cleaned = draft.value.replace(/[\\/:*?"<>|]/g, '_').trim()
  if (cleaned && cleaned !== baseName.value) {
    emit('rename', props.item, cleaned)
  }
}
function cancelEdit() {
  editing.value = false
}
</script>

<template>
  <div class="card" :class="{ bad: item.status === 'done' && !item.ok }">
    <div class="card-previews">
      <figure class="preview checker">
        <img v-if="item.origUrl" :src="item.origUrl" :alt="item.name" />
        <div v-else class="placeholder">…</div>
        <figcaption>原图</figcaption>
      </figure>
      <span class="arrow">→</span>
      <figure class="preview checker">
        <img v-if="item.outUrl" :src="item.outUrl" :alt="item.name + ' 处理结果'" />
        <div v-else class="placeholder">{{ statusText }}</div>
        <figcaption>处理后</figcaption>
      </figure>
    </div>

    <div class="card-name-row">
      <input
        v-if="editing"
        ref="editRef"
        v-model="draft"
        class="card-name-input"
        type="text"
        maxlength="60"
        @keyup.enter="commitEdit"
        @keyup.esc="cancelEdit"
        @blur="commitEdit"
      />
      <template v-else>
        <p class="card-name" :title="item.name">{{ baseName }}</p>
        <button
          v-if="item.status === 'done'"
          type="button"
          class="icon-btn"
          title="修改文件名"
          @click="startEdit"
        >
          ✏️
        </button>
      </template>
    </div>

    <div v-if="item.status === 'done'" class="card-info">
      <p class="info-orig">{{ item.rect ? '截取' : '原图' }} {{ item.origW }}×{{ item.origH }} · {{ formatSize(item.origBytes) }}</p>
      <p class="info-out">
        输出 <b>{{ item.outW }}×{{ item.outH }}</b> · <b>{{ formatSize(item.outBytes) }}</b>
        <span v-if="item.cnum > 0" class="cnum">{{ item.cnum }} 色</span>
      </p>
    </div>
    <p v-else-if="item.status === 'error'" class="card-error">{{ statusText }}</p>
    <p v-else class="card-info info-orig">{{ statusText }}</p>

    <p v-if="centerText" class="card-center" :class="centerText.ok ? 'ok' : 'warn'">
      {{ centerText.text }}
      <span v-if="!centerText.ok" class="center-tip">（可在设置里开启"自动居中"）</span>
    </p>

    <span v-if="item.status === 'done'" class="badge" :class="item.ok ? 'ok' : 'bad'">
      {{ item.ok ? '✓ 输出符合要求' : '✗ 输出仍未达标' }}
    </span>

    <div class="card-actions">
      <button type="button" class="btn small" :disabled="item.status !== 'done'" @click="emit('download', item)">
        下载
      </button>
      <button type="button" class="btn small" :disabled="item.status !== 'done'" @click="emit('preview', item)">
        直播间预览
      </button>
      <button type="button" class="btn small ghost" @click="emit('remove', item)">移除</button>
    </div>
  </div>
</template>
