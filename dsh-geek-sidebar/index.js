/**
 * dsh-geek-sidebar host 根：工作台侧栏 + 技能管理 + @文件提及桥。
 *
 * 本文件只做装配：各 feature 的 HTTP 路由表由 lib/host/*.js 提供，
 * 统一挂到 webServer 的 /__dsh-geek-sidebar__/ 前缀下（共享 http.js 的分发/JSON/错误约定）。
 *
 * 路由命名空间：
 *   /__dsh-geek-sidebar__/skills/*      技能管理（扫描、开关、npx 安装/更新、skills.sh 搜索、prefs）
 *   /__dsh-geek-sidebar__/wb/*          workbench RPC（目录/文件/git worktree/笔记目录/便签/上传下载）
 *   /__dsh-geek-sidebar__/wb/style.css  workbench 样式（每请求读盘，改 CSS 刷新浏览器即生效）
 */
import Schema from '@deepseek-ai/schemastery'
import { mountApi } from './lib/host/http.js'
import { skillsApi } from './lib/host/skills.js'
import { workbenchApi, WORKBENCH_DEFAULTS } from './lib/host/workbench.js'

export const name = 'dsh-geek-sidebar'

/* webServer 是硬依赖；llm 为可选能力（便签智能生成标题），运行时经 ctx.get('llm') 判空降级。
 * 脆弱点登记：本平台 cordis 的 inject 数组不支持 'llm?' 可选后缀——'llm?' 会按字面服务名
 * 建 key 永远等待，entry 停在 pending，dsh boot 终审判 "entry did not activate" 使整个
 * profile 启动失败（0.1.2-rc.1 实测）。可选服务一律 ctx.get() 判空，别写进 inject。 */
export const inject = ['webServer']

/* 可调参数（默认值与 WORKBENCH_DEFAULTS 同源）：部署时可在 profile 的 cordis.patch.yml 按行覆盖。 */
export const Config = Schema.object({
  textMaxKB: Schema.number().default(WORKBENCH_DEFAULTS.textMaxKB),
  rawMaxMB: Schema.number().default(WORKBENCH_DEFAULTS.rawMaxMB),
  writeMaxMB: Schema.number().default(WORKBENCH_DEFAULTS.writeMaxMB),
  notesMaxDirs: Schema.number().default(WORKBENCH_DEFAULTS.notesMaxDirs),
  gitCacheTtlSec: Schema.number().default(WORKBENCH_DEFAULTS.gitCacheTtlSec),
  treeWatch: Schema.boolean().default(WORKBENCH_DEFAULTS.treeWatch),
  treeWatchDebounceMs: Schema.number().default(WORKBENCH_DEFAULTS.treeWatchDebounceMs),
  treeWaitMs: Schema.number().default(WORKBENCH_DEFAULTS.treeWaitMs),
  treeWatchMaxDirs: Schema.number().default(WORKBENCH_DEFAULTS.treeWatchMaxDirs),
  quickNotesDir: Schema.string().default(WORKBENCH_DEFAULTS.quickNotesDir),
  quickNotesCapture: Schema.boolean().default(WORKBENCH_DEFAULTS.quickNotesCapture),
  quickNotesMax: Schema.number().default(WORKBENCH_DEFAULTS.quickNotesMax),
})

export function apply(ctx, config) {
  const routes = Object.assign({}, skillsApi(), workbenchApi(ctx, config))
  mountApi(ctx, '/__dsh-geek-sidebar__', routes)
  console.log('[dsh-geek-sidebar] api mounted at /__dsh-geek-sidebar__ (' + Object.keys(routes).length + ' routes)')
}
