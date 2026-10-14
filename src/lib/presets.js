// 预设定义：数值以查证到的公开资料为默认值，均可在界面上修改并本地记住。
// 充电专属表情包规格来源：B站官方专栏 cv23736558
// 直播间表情：社区教程普遍按 162x162 / 300KB 制作，官方数字未公开确证，以上传页面提示为准。

export const PRESETS = [
  {
    id: 'live',
    name: '直播间表情',
    entry: '直播中心 → 我的直播间 → 直播表情',
    desc: '粉丝在直播间弹幕中发送的房间专属表情',
    defaults: { size: 162, maxKB: 16, fit: 'contain', bgTransparent: true, bgColor: '#ffffff', autoCenter: false },
    note: '官方数字未公开确证；社区经验按 162×162、16kb 以下制作最稳妥，以直播中心上传页面提示为准，可在下方修改并自动记住。',
  },
  {
    id: 'charge',
    name: '充电专属表情',
    entry: '创作中心 → 充电计划 → 专属表情包',
    desc: '粉丝订阅充电计划后，在视频 / 动态评论区使用的表情',
    defaults: { size: 162, maxKB: 300, fit: 'contain', bgTransparent: true, bgColor: '#ffffff', autoCenter: false },
    note: '官方要求：PNG 格式，162×162px，300KB 以内，每套上限 10 张。',
  },
  {
    id: 'cover',
    name: '充电表情包封面',
    entry: '创作中心 → 充电计划 → 专属表情包',
    desc: '表情包套装的封面图',
    defaults: { size: 360, maxKB: 300, fit: 'contain', bgTransparent: true, bgColor: '#ffffff', autoCenter: false },
    note: '官方要求：PNG 格式，360×360px，300KB 以内。',
  },
]

// v2：默认上限改为 16kb 后升级存储版本，旧版本地设置（如 live 300KB）直接作废，
// 确保升级后所有用户都回到最新默认规格。
const KEY = 'bilibili-emoji:settings:v2'

export function loadSettings() {
  const out = {}
  for (const p of PRESETS) out[p.id] = { ...p.defaults }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    for (const p of PRESETS) {
      if (saved[p.id]) out[p.id] = { ...p.defaults, ...saved[p.id] }
    }
  } catch { /* 忽略损坏的本地配置 */ }
  return out
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch { /* 隐私模式下可能失败，忽略 */ }
}

export function loadPresetChoice() {
  return localStorage.getItem('bilibili-emoji:preset') || 'live'
}

export function savePresetChoice(id) {
  try {
    localStorage.setItem('bilibili-emoji:preset', id)
  } catch { /* ignore */ }
}
