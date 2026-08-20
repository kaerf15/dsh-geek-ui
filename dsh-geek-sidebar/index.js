/**
 * dsh-geek-sidebar host 根：工作台侧栏 + 技能管理 + @文件提及桥。
 *
 * 本文件只做装配：各 feature 的 HTTP 路由表由 lib/host/*.js 提供，
 * 统一挂到 webServer 的 /__dsh-geek-sidebar__/ 前缀下（共享 http.js 的分发/JSON/错误约定）。
 *
 * 路由命名空间：
 *   /__dsh-geek-sidebar__/skills/*      技能管理（扫描、开关、npx 安装/更新、skills.sh 搜索、prefs）
 *   /__dsh-geek-sidebar__/wb/*          workbench RPC（目录/文件/git worktree/笔记目录/上传下载）
 *   /__dsh-geek-sidebar__/wb/style.css  workbench 样式（每请求读盘，改 CSS 刷新浏览器即生效）
 */
import Schema from '@deepseek-ai/schemastery'
import { mountApi } from './lib/host/http.js'
import { skillsApi } from './lib/host/skills.js'
import { workbenchApi, WORKBENCH_DEFAULTS } from './lib/host/workbench.js'
import { createTerminalManager, mountTerminal } from './lib/host/terminal.js'
import { createAcpManager, mountAcp } from './lib/host/acp.js'

export const name = 'dsh-geek-sidebar'

/* webServer 是硬依赖：没有它整个插件的 host 能力都不存在，静默降级无意义。 */
export const inject = ['webServer']

/* 可调参数（默认值与 WORKBENCH_DEFAULTS 同源）：部署时可在 profile 的 cordis.patch.yml 按行覆盖。 */
export const Config = Schema.object({
  textMaxKB: Schema.number().default(WORKBENCH_DEFAULTS.textMaxKB),
  rawMaxMB: Schema.number().default(WORKBENCH_DEFAULTS.rawMaxMB),
  writeMaxMB: Schema.number().default(WORKBENCH_DEFAULTS.writeMaxMB),
  notesMaxDirs: Schema.number().default(WORKBENCH_DEFAULTS.notesMaxDirs),
  gitCacheTtlSec: Schema.number().default(WORKBENCH_DEFAULTS.gitCacheTtlSec),
  terminalMaxPerSession: Schema.number().default(4),
  acpMaxSessions: Schema.number().default(8),
})

export function apply(ctx, config) {
  const routes = Object.assign({}, skillsApi(), workbenchApi(ctx, config))
  mountApi(ctx, '/__dsh-geek-sidebar__', routes)
  /* 终端：PTY 进程表 + WS 升级端点，随 Fiber 回收 */
  const terminalMgr = createTerminalManager(config && config.terminalMaxPerSession)
  /* ACP 智能体：agent 子进程注册表 + WS 转发（每个智能体 tab 一进程） */
  const acpMgr = createAcpManager(config && config.acpMaxSessions)
  ctx.effect(() => {
    const disposeUpgrade = mountTerminal(ctx, terminalMgr)
    const disposeAcp = mountAcp(ctx, acpMgr)
    return () => {
      try {
        disposeUpgrade()
        disposeAcp()
      } finally {
        terminalMgr.disposeAll()
        acpMgr.disposeAll()
      }
    }
  })
  console.log('[dsh-geek-sidebar] api mounted at /__dsh-geek-sidebar__ (' + Object.keys(routes).length + ' routes) + terminal ws + acp ws')
}
