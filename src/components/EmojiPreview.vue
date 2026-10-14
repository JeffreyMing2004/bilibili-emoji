<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

// 直播间聊天区效果预览：模拟 B 站直播弹幕聊天栏，展示表情实际发送后的样子
const props = defineProps({
  item: { type: Object, required: true },
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pv-overlay" @click.self="emit('close')">
    <div class="pv-modal" role="dialog" aria-label="直播间效果预览">
      <header class="pv-head">
        <span class="pv-title">📺 直播间效果预览</span>
        <button type="button" class="icon-btn" title="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="pv-chat">
        <div class="pv-msg">
          <span class="pv-user u-blue">干物妹小埋</span>：<span class="pv-text">主播主播，今天打排位吗？</span>
        </div>
        <div class="pv-msg">
          <span class="pv-medal">粉丝勋章 <b>12</b></span>
          <span class="pv-user u-pink">今天也要加油鸭</span>：<span class="pv-text">来了来了，前排！</span>
        </div>
        <div class="pv-msg">
          <span class="pv-medal">萌新 <b>3</b></span>
          <span class="pv-user u-blue">路过的旅行者</span>：
          <img class="pv-emoji" :src="item.outUrl" :alt="item.name" />
        </div>
        <div class="pv-msg">
          <span class="pv-user u-grey">萌新 <b>1</b></span>：<span class="pv-text">哈哈哈哈这个表情在哪领</span>
        </div>
        <div class="pv-msg">
          <span class="pv-medal">粉丝勋章 <b>7</b></span>
          <span class="pv-user u-pink">wifi信号满格</span>：<span class="pv-text">主播的专属表情包，充电/做任务就能用啦</span>
        </div>
      </div>

      <footer class="pv-foot">
        <figure class="preview checker pv-large">
          <img :src="item.outUrl" :alt="item.name" />
        </figure>
        <div class="pv-meta">
          <p><b>{{ item.name.replace(/\.png$/i, '') }}</b></p>
          <p class="pv-note">{{ item.outW }}×{{ item.outH }} · 输出原始尺寸展示</p>
          <p class="pv-note">聊天区大表情的最终显示大小以 B 站客户端 / 网页实际渲染为准，此预览仅供排版参考。</p>
        </div>
      </footer>
    </div>
  </div>
</template>
