#!/usr/bin/env node
/* dsh-geek-header 冒烟：文件齐备 + client.js 包装形状 + 语法可解析。 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

let failed = false
const check = (label, ok) => {
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label)
  if (!ok) failed = true
}

const pkg = JSON.parse(read('package.json'))
check('package.json dsh.bundle.patch', pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml')
check('package.json dsh.client.platform=web', pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web')
check('exports["./client"] → lib/client.js', pkg.exports && pkg.exports['./client'] === './lib/client.js')

const patch = read('cordis.patch.yml')
check('patch 注册 dsh-geek-header', patch.includes('name: dsh-geek-header'))

const client = read('lib/client.js')
check('client.js ModuleLoader 包装', client.startsWith('window.__ModuleLoader__.load({') || client.includes('\nwindow.__ModuleLoader__.load({'))
check('client.js id 一致', client.includes("id: 'dsh-geek-header'"))
check('client.js exports.inject 声明 sessions', client.includes("exports.inject = ['sessions']"))
check('client.js 提供 geekUiHeader 服务', client.includes("ctx.provide('geekUiHeader')"))
check('client.js 生成标题锚点（钉在页签后）', client.includes("className = 'dgu-seg-anchor dgu-title-anchor'") && client.includes('previousElementSibling !== tabs'))
check('client.js 系统提示词锚点（紧随生成标题）', client.includes("className = 'dgu-seg-anchor dgu-prompt-anchor'") && client.includes('rec.promptAnchor'))
check('client.js 分段条按钮共享样式', client.includes('.dgu-seg-btn') && client.includes('fetchGeekHeader'))
check('client.js 系统提示词 host 拉取', client.includes('/system-prompt?sessionId='))
check('client.js 读取当前选中模型', client.includes('modelDirectories'))

/* 回归守护：本轮修过的坑不许回来 */
check('回归：下拉菜单测量后保持展开（wasOpen 恢复）', client.includes('wasOpen') && client.includes("if (wasOpen) header.setAttribute('data-dgu-actions-open', '')"))
check('回归：页头左 padding 已归零', client.includes('padding: 0 20px 0 0'))
check('回归：无 cluster > * + * 双重塌陷规则', !client.includes('[data-dgu="cluster"] > * + *'))
check('回归：格子骨架共享块存在（不重复四份）', client.includes('分段条单元共享骨架'))
check('回归：MO 收窄触发面（HEADER_SLOT_SEL）', client.includes('HEADER_SLOT_SEL'))
check('回归：会话视图快照 memo 化', client.includes('lastSessionView'))
check('v0.4：actions/lineage 全形状套格子（> *）', client.includes('header.actions\"] > *,') && client.includes('header.lineage\"] > *,'))
check('v0.4.1：⋯ 钉最右（margin-left:auto）', client.includes('margin-left: auto'))
check('v0.4.1：utilities 整段隐藏（含包装层）', client.includes('div:has(> [data-slot="conversation.session.header.utilities"])'))
check('v0.4.1：无 has-more/面板拼接残留', !client.includes('data-dgu-has-more') && !client.includes('--dgu-cluster-h') && !client.includes('--dgu-panel-left'))
check('v0.4.4：cluster/actions 压 gap + nav-actions 接缝', client.includes('[data-dgu="actions"]') && client.includes('[data-dgu="crumbs"]:has([data-slot="${SLOT_LINEAGE}"] > :not(:empty)) + [data-dgu="actions"]'))
check('v0.4.4：谱系槽内双 dropdown 接缝', client.includes('header.lineage"] > * + *'))

const host = read('index.js')
check('index.js 挂载 title/refresh 路由', host.includes("POST /title/refresh"))
check('index.js 挂载 system-prompt 路由', host.includes("GET /system-prompt"))
check('index.js 在线会话解析复用', host.includes('resolveOnlineSession'))
check('index.js pi-web 原版指令', host.includes('Create a concise title for this session based on the conversation above.'))
check('index.js 整段对话采集', host.includes("ev.type === 'assistant/message'"))
check('v0.4.5：事件读取走 snapshotEvents（alpha.4 移除 Session.events getter）', host.includes('session.snapshotEvents()') && !host.includes('session.events'))
check('v0.5.0：system 改读 system/message 事件（0.1.5 EpochHeader 无 system 字段）', host.includes("system/message"))

/* 行为级：readSystemPrompt 对假会话的读取语义（0.1.5 存储模型） */
const rspSrc = host.match(/function readSystemPrompt\(session\) \{[\s\S]*?\n\}/)
check('readSystemPrompt 可提取', !!rspSrc)
if (rspSrc) {
  const readSystemPrompt = new Function(rspSrc[0] + '; return readSystemPrompt')()
  const fake = (events) => ({ snapshotEvents: () => events })
  const sysEv = (text) => ({ type: 'system/message', data: { message: { content: [{ type: 'text', text }] } } })
  check('行为：空文本节点 → 空串', readSystemPrompt(fake([sysEv('')])) === '')
  check('行为：空节点跳过、取第一个非空', readSystemPrompt(fake([sysEv(''), sysEv('PROMPT-B')])) === 'PROMPT-B')
  check('行为：无 system/message → 空串', readSystemPrompt(fake([{ type: 'user/message', data: {} }])) === '')
  check('行为：多块文本拼接', readSystemPrompt(fake([{ type: 'system/message', data: { message: { content: [{ type: 'text', text: 'A' }, { type: 'image' }, { type: 'text', text: 'B' }] } } }])) === 'AB')
  check('行为：snapshotEvents 抛错静默回落', readSystemPrompt({ snapshotEvents: () => { throw new Error('x') } }) === '')
}

/* 语法可解析（client.js 是浏览器代码，--check 只解析不执行） */
try {
  execFileSync(process.execPath, ['--check', join(ROOT, 'lib', 'client.js')], { stdio: 'pipe' })
  check('lib/client.js 语法', true)
} catch (e) {
  check('lib/client.js 语法: ' + e.stderr, false)
}
try {
  execFileSync(process.execPath, ['--check', join(ROOT, 'index.js')], { stdio: 'pipe' })
  check('index.js 语法', true)
} catch (e) {
  check('index.js 语法: ' + e.stderr, false)
}

process.exit(failed ? 1 : 0)
