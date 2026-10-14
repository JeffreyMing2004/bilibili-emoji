<script setup>
import { PRESETS } from '../lib/presets'
</script>

<template>
  <details class="specnote">
    <summary>规格说明 & 上传入口（点击展开）</summary>
    <div class="spec-body">
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>格式</th>
            <th>尺寸</th>
            <th>体积</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>充电专属表情</td>
            <td>PNG</td>
            <td>162×162px</td>
            <td>≤ 300kb</td>
            <td>每套 ≤ 10 张</td>
          </tr>
          <tr>
            <td>充电表情包封面</td>
            <td>PNG</td>
            <td>360×360px</td>
            <td>≤ 300kb</td>
            <td>每套 1 张</td>
          </tr>
          <tr>
            <td>直播间表情</td>
            <td colspan="4">官方数字未公开确证；社区经验按 <b>162×162 / ≤16kb</b> 制作最稳妥过审，请以直播中心上传页面提示为准（本工具预设可随时修改）。</td>
          </tr>
        </tbody>
      </table>

      <ul>
        <li v-for="p in PRESETS" :key="p.id"><b>{{ p.name }}</b>：{{ p.entry }}</li>
        <li>充电专属表情包需先完成充电计划升级，粉丝订阅后可在视频 / 动态 / 直播间使用；字体建议单字不小于 54×54px 以保证可读性。</li>
      </ul>

      <p class="sources">
        规格来源：
        <a href="https://www.bilibili.com/read/cv23736558" target="_blank" rel="noopener">B站官方专栏《来和粉丝分享你的专属表情包吧》</a> ·
        <a href="https://link.bilibili.com/p/help/index" target="_blank" rel="noopener">哔哩哔哩直播帮助中心</a>
      </p>
      <p class="privacy">🔒 所有图片均在你的浏览器本地处理，不会上传到任何服务器。</p>
    </div>
  </details>
</template>
