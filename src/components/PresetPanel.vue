<script setup>
import { PRESETS } from '../lib/presets'

const props = defineProps({
  presetId: { type: String, required: true },
  settings: { type: Object, required: true }, // { [id]: { size, maxKB, fit, bgTransparent, bgColor } }
})
const emit = defineEmits(['update:presetId', 'update:settings'])

function pick(id) {
  emit('update:presetId', id)
}

const SIZE_PRESETS = [162, 240, 288, 360]

function setSize(v) {
  const size = Math.max(16, Math.min(1024, Number(v) || 0))
  patch({ size })
}
function setMaxKB(v) {
  const maxKB = Math.max(1, Math.min(20480, Number(v) || 0))
  patch({ maxKB })
}
function patch(partial) {
  emit('update:settings', {
    ...props.settings,
    [props.presetId]: { ...props.settings[props.presetId], ...partial },
  })
}
const cur = () => props.settings[props.presetId]
</script>

<template>
  <section class="panel">
    <div class="preset-cards">
      <button
        v-for="p in PRESETS"
        :key="p.id"
        class="preset-card"
        :class="{ active: presetId === p.id }"
        type="button"
        @click="pick(p.id)"
      >
        <span class="preset-name">{{ p.name }}</span>
        <span class="preset-size">{{ settings[p.id].size }}×{{ settings[p.id].size }} · ≤{{ settings[p.id].maxKB }}kb</span>
        <span class="preset-entry">{{ p.entry }}</span>
      </button>
    </div>

    <div class="preset-editor">
      <div class="field">
        <label>目标尺寸（正方形边长 px）</label>
        <div class="size-row">
          <input
            type="number"
            min="16"
            max="1024"
            :value="cur().size"
            @change="setSize($event.target.value)"
          />
          <button
            v-for="s in SIZE_PRESETS"
            :key="s"
            type="button"
            class="chip"
            :class="{ on: cur().size === s }"
            @click="patch({ size: s })"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <div class="field">
        <label>体积上限（kb，单张严格不超过）</label>
        <input
          type="number"
          min="1"
          max="20480"
          :value="cur().maxKB"
          @change="setMaxKB($event.target.value)"
        />
      </div>

      <div class="field">
        <label>非正方形图片的处理方式</label>
        <div class="fit-row">
          <label class="radio">
            <input type="radio" value="contain" :checked="cur().fit === 'contain'" @change="patch({ fit: 'contain' })" />
            留白（保完整）
          </label>
          <label class="radio">
            <input type="radio" value="cover" :checked="cur().fit === 'cover'" @change="patch({ fit: 'cover' })" />
            居中裁剪（填满）
          </label>
          <label class="radio">
            <input type="radio" value="stretch" :checked="cur().fit === 'stretch'" @change="patch({ fit: 'stretch' })" />
            拉伸（会变形）
          </label>
        </div>
      </div>

      <div v-if="cur().fit === 'contain'" class="field">
        <label>留白区域</label>
        <div class="fit-row">
          <label class="radio">
            <input
              type="checkbox"
              :checked="cur().bgTransparent"
              @change="patch({ bgTransparent: $event.target.checked })"
            />
            透明
          </label>
          <label v-if="!cur().bgTransparent" class="radio color-pick">
            <input
              type="color"
              :value="cur().bgColor"
              @input="patch({ bgColor: $event.target.value })"
            />
          </label>
        </div>
      </div>

      <div class="field">
        <label>内容居中</label>
        <div class="fit-row">
          <label class="radio">
            <input
              type="checkbox"
              :checked="cur().autoCenter"
              @change="patch({ autoCenter: $event.target.checked })"
            />
            自动居中（裁掉透明边缘后把表情内容放到画布正中）
          </label>
        </div>
      </div>

      <p class="preset-note">{{ PRESETS.find(p => p.id === presetId).note }}改动设置后，已添加的图片会自动重新处理。</p>
    </div>
  </section>
</template>
