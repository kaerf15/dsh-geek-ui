#!/usr/bin/env node
// dsh-geek-sidebar host 路由 smoke 测试：直接调路由表（不起 HTTP 服务）。
// 注入真实 shell 垫片（child_process）与最小 fs 垫片（node:fs），只打临时目录下的夹具，
// 不碰真实用户数据。联网路由（skills 搜索/检查/npx 安装更新）与 notesPick（GUI）不测。
// 从项目根目录运行：node dsh-plugins/dsh-geek-sidebar/parts/smoke.mjs
import { exec } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'

const { skillsApi } = await import(new URL('../lib/host/skills.js', import.meta.url))
const { workbenchApi } = await import(new URL('../lib/host/workbench.js', import.meta.url))

/* ---------- 垫片 ---------- */
const shellShim = {
  resolve({ command, timeoutMs, env }) { return { command, timeoutMs, env } },
  run(r) {
    return new Promise((resolveRun) => {
      exec(r.command, { timeout: r.timeoutMs || 1e4, env: { ...process.env, ...(r.env || {}) }, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        resolveRun({ exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: { text: stdout }, stderr: { text: stderr } })
      })
    })
  },
}
const fsShim = {
  async resolve(p) { return p },
  async stat(p) { const st = statSync(p); return { type: st.isDirectory() ? 'directory' : st.isFile() ? 'file' : 'other', size: st.size } },
  async readText(p) { return readFileSync(p, 'utf8') },
  fileUrl(p) { return 'file://' + p },
  async listDir(p) {
    return readdirSync(p, { withFileTypes: true }).map((d) => ({ name: d.name, type: d.isDirectory() ? 'directory' : 'file', size: null, target: join(p, d.name) }))
  },
  processPath(p) { return p },
}
const brokenFs = { ...fsShim, resolve: async () => { throw new Error('forced fallback') } }

const routes = Object.assign({}, skillsApi(), workbenchApi({ get: (n) => (n === 'shell' ? shellShim : n === 'fs' ? fsShim : undefined) }))
const shellRoutes = workbenchApi({ get: (n) => (n === 'shell' ? shellShim : n === 'fs' ? brokenFs : undefined) })

const mockRes = () => {
  const r = { code: 0, headers: null, body: null, writableEnded: false, writeHead(c, h) { r.code = c; r.headers = h }, end(d) { r.body = d; r.writableEnded = true } }
  return r
}
/* raw 路由是流式 pipe(res)：用真 Writable 收集字节并等待结束 */
const mockStreamRes = () => {
  const chunks = []
  const r = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb() } })
  r.code = 0
  r.headers = null
  r.writeHead = (c, h) => { r.code = c; r.headers = h; return r }
  r.bodyBuffer = () => Buffer.concat(chunks)
  return r
}

/* ---------- client 纯组件无头测试：fakeReact 把 createElement 收成结构对象，
 * 直接 eval parts/workbench 里的纯声明段（无 import 的 client 源码因此可测） ---------- */
/* hooks 为无状态实现；UI 无头驱动经 uiStateQueue 预设 useState 返回序列（如 BottomPanel 的 rect 注入）。
 * useEffect 记录进 uiEffects 供按需手动执行（Details 焦点刷新闭包用例需要真跑 effect 注册监听）。
 * useRef 按位置池化 + __resetRefs 按渲染复位——真 React 同一组件跨渲染返回同一 ref 对象，
 * 否则 edRef 类"跨渲染持引用"模式无法被忠实模拟（修复验证会假失败）。 */
let uiStateQueue = null
let uiEffects = []
const uiRefPool = []
let uiRefPos = 0
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  Fragment: 'Fragment',
  useState: (init) => (uiStateQueue && uiStateQueue.length ? [uiStateQueue.shift(), () => {}] : [init, () => {}]),
  useEffect: (fn) => { uiEffects.push(fn) },
  useRef: (v) => { const i = uiRefPos++; return uiRefPool[i] || (uiRefPool[i] = { current: v || null }) },
  __resetRefs: () => { uiRefPos = 0 },
}
const loadPart = (files, names) => {
  const src = files.map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8')).join('\n')
  return new Function('React', 'API', src + '\nreturn { ' + names.join(', ') + ' }')(fakeReact, '/__dsh-geek-sidebar__')
}
const findAll = (node, pred, out = []) => {
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, pred, out)
    return out
  }
  if (node && typeof node === 'object') {
    if (pred(node)) out.push(node)
    for (const c of node.children || []) findAll(c, pred, out)
  }
  return out
}

/* ---------- 夹具 ---------- */
const dir = mkdtempSync(join(tmpdir(), 'dsh-geek-smoke-'))
writeFileSync(join(dir, 'smoke-a.txt'), 'hello smoke', 'utf8')
writeFileSync(join(dir, 'smoke-b.bin'), Buffer.from([0, 1, 2, 255]))
writeFileSync(join(dir, '.secret'), 'hidden', 'utf8')
mkdirSync(join(dir, 'sub'))
const skillDir = join(dir, 'skill-fix')
mkdirSync(skillDir)

let pass = 0, fail = 0
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok', name) } else { fail++; console.error('  FAIL', name, extra === undefined ? '' : extra) } }
const thrownStatus = async (fn) => { try { await fn(); return 0 } catch (e) { return Number(e && e.status) || 0 } }

try {
  /* ---------- workbench ---------- */
  const resCss = mockRes()
  await routes['GET /wb/style.css']({ res: resCss })
  ok('style.css 直出', resCss.code === 200 && String(resCss.body).includes('.pw-sidebar'))

  /* xterm vendor 直出（1.19.8 起从 bundle 剥离，首开终端按需注入） */
  const resVx = mockRes()
  await routes['GET /wb/vendor-xterm.js']({ res: resVx })
  ok('vendor-xterm.js 直出', resVx.code === 200 && String(resVx.body).includes('__pwXterm'))

  const l1 = await routes['POST /wb/listDir']({ body: { path: dir } })
  ok('listDir(fs 主路)', Array.isArray(l1.entries)
    && l1.entries.some((e) => e.name === 'smoke-a.txt' && e.type === 'file')
    && l1.entries.some((e) => e.name === 'sub' && e.type === 'directory')
    && l1.entries.some((e) => e.name === '.secret' && e.hidden === true)
    && l1.entries[0].type === 'directory')
  const l2 = await shellRoutes['POST /wb/listDir']({ body: { path: dir } })
  ok('listDir(shell 兜底)', Array.isArray(l2.entries) && l2.entries.some((e) => e.name === 'smoke-a.txt'))

  const rf = await routes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-a.txt') } })
  ok('readFile 文本', rf.kind === 'text' && rf.text === 'hello smoke')

  /* image 类型的 url 必须走自家 /wb/raw（fss.fileUrl 的 file:// 在 http:// 页面不可加载） */
  writeFileSync(join(dir, 'smoke-c.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const rimg = await routes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-c.png') } })
  ok('readFile 图片走 /wb/raw', rimg.kind === 'image' && typeof rimg.url === 'string' && rimg.url.indexOf('/__dsh-geek-sidebar__/wb/raw?path=') === 0 && rimg.url.indexOf('[object') < 0)

  /* node 兜底路径（brokenFs 强制）：与主路同 textMaxKB 上限、truncated 按真实 size 判定（评审 P3 回归防线） */
  writeFileSync(join(dir, 'smoke-big.txt'), 'x'.repeat(600 * 1024), 'utf8')
  const rbig = await shellRoutes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-big.txt') } })
  ok('readFile 兜底超限截断', rbig.kind === 'text' && rbig.truncated === true && rbig.text.length === 512 * 1024)
  const rsmall = await shellRoutes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-a.txt') } })
  ok('readFile 兜底小文件不截断', rsmall.kind === 'text' && rsmall.truncated === false)

  /* 图片/pdf 兜底（评审修复回归防线）：小图出 data URL；超限先 stat 预检拒绝，
   * 上限对齐主路 /wb/raw 的 rawMaxMB（默认 20MB），不再整文件读入后才查 */
  const rfb = await shellRoutes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-c.png') } })
  ok('readFile 兜底图片出 data URL', rfb.kind === 'image' && typeof rfb.url === 'string' && rfb.url.indexOf('data:image/png;base64,') === 0)
  writeFileSync(join(dir, 'smoke-huge.png'), Buffer.alloc(21 * 1024 * 1024, 7))
  const rfh = await shellRoutes['POST /wb/readFile']({ body: { path: join(dir, 'smoke-huge.png') } })
  ok('readFile 兜底超限预检拒绝（rawMaxMB）', typeof rfh.error === 'string' && rfh.error.indexOf('20MB') >= 0)

  const wf = await routes['POST /wb/writeFile']({ body: { path: join(dir, 'smoke-a.txt'), text: 'rewritten' } })
  ok('writeFile 写盘', wf.ok === true && readFileSync(join(dir, 'smoke-a.txt'), 'utf8') === 'rewritten')
  ok('writeFile 拒目录', (await thrownStatus(() => routes['POST /wb/writeFile']({ body: { path: dir, text: 'x' } }))) === 400)
  ok('delete 拒浅路径', (await thrownStatus(() => routes['POST /wb/delete']({ body: { path: '/' } }))) === 400)

  const resRaw = mockStreamRes()
  await routes['GET /wb/raw']({ query: new URLSearchParams('path=' + join(dir, 'smoke-b.bin')), res: resRaw })
  await new Promise((resolveDone, rejectDone) => { resRaw.on('finish', resolveDone); resRaw.on('error', rejectDone) })
  ok('raw 文件流', resRaw.code === 200 && Buffer.from([0, 1, 2, 255]).equals(resRaw.bodyBuffer()))

  const ng = await routes['POST /wb/notesGet']({ body: {} })
  ok('notesGet 只读', ng && Array.isArray(ng.dirs))

  /* 删除：文件进 ~/.Trash，断言后清理测试残留 */
  const delTarget = join(dir, 'smoke-a.txt')
  const trashDir = join(homedir(), '.Trash')
  const before = readdirSync(trashDir).filter((n) => n.startsWith('smoke-a'))
  const dl = await routes['POST /wb/delete']({ body: { path: delTarget } })
  const gone = !existsSync(delTarget)
  const landed = readdirSync(trashDir).filter((n) => n.startsWith('smoke-a')).find((n) => !before.includes(n))
  ok('delete 移废纸篓', dl.ok === true && gone && !!landed)
  if (landed) rmSync(join(trashDir, landed), { recursive: true, force: true })

  /* ---------- skills ---------- */
  const sl = await routes['GET /skills/list']({ query: new URLSearchParams('cwd=') })
  ok('skills/list', sl && Array.isArray(sl.skills) && typeof sl.globalDir === 'string')

  const sp = await routes['GET /skills/prefs']({ query: new URLSearchParams() })
  ok('skills/prefs 只读', sp && typeof sp.defaultGlobalDir === 'string')

  /* toggle 白名单（1.19.6 起）：只接受扫描根下的 <name>/SKILL.md。
   * 正向夹具放 <tmp>/.agents/skills/ 下模拟项目根；根外文件必须 403 */
  const skillRoot = join(dir, '.agents', 'skills', 'skill-fix')
  mkdirSync(skillRoot, { recursive: true })
  const skillMd = join(skillRoot, 'SKILL.md')
  writeFileSync(skillMd, '---\nname: smoke-fix\ndescription: t\n---\nbody\n', 'utf8')
  const t1 = await routes['POST /skills/toggle']({ body: { filePath: skillMd, disable: true } })
  const off = readFileSync(skillMd, 'utf8').includes('disable-model-invocation: true')
  const t2 = await routes['POST /skills/toggle']({ body: { filePath: skillMd, disable: false } })
  const on = !readFileSync(skillMd, 'utf8').includes('disable-model-invocation')
  ok('skills/toggle 往返（白名单内）', t1.success && off && t2.success && on)
  const outsideMd = join(skillDir, 'SKILL.md')
  writeFileSync(outsideMd, '---\nname: x\n---\n', 'utf8')
  let denied = false
  try { await routes['POST /skills/toggle']({ body: { filePath: outsideMd, disable: true } }) } catch (e) { denied = e && e.status === 403 }
  ok('skills/toggle 白名单外拒绝（403）', denied && !readFileSync(outsideMd, 'utf8').includes('disable-model-invocation'))

  /* ---------- terminal pty 端到端：spawn → 写入标记 → transcript 命中 → 回收 ---------- */
  try {
    const { createTerminalManager } = await import(new URL('../lib/host/terminal.js', import.meta.url))
    const mgr = createTerminalManager(2)
    const h = mgr.open('smoke-sess', 't1', dir, 80, 24)
    h.pty.write('echo smoke-pty-$?\n')
    let hit = false
    for (let i = 0; i < 80 && !hit; i++) {
      if (h.transcript.includes('smoke-pty-0')) hit = true
      else await new Promise((r) => setTimeout(r, 100))
    }
    mgr.disposeAll()
    ok('terminal pty 往返', hit)
  } catch (e) {
    ok('terminal pty 往返', false, String(e && e.message ? e.message : e))
  }

  /* 全局 PTY 总上限（评审修复回归防线）：per-session 配额按客户端自报 sessionId
   * 计数可被随机 sessionId 绕过；maxTotal=3 时第 4 个不同会话必须被拒 */
  try {
    const { createTerminalManager } = await import(new URL('../lib/host/terminal.js', import.meta.url))
    const mgr2 = createTerminalManager(2, 3)
    mgr2.open('gs1', 't1', dir, 80, 24)
    mgr2.open('gs2', 't1', dir, 80, 24)
    mgr2.open('gs3', 't1', dir, 80, 24)
    let rejected = false
    try {
      mgr2.open('gs4', 't1', dir, 80, 24)
    } catch (e) {
      rejected = /global limit/.test(String((e && e.message) || e))
    }
    mgr2.disposeAll()
    ok('terminal 全局总上限拒绝超额', rejected)
  } catch (e) {
    ok('terminal 全局总上限拒绝超额', false, String(e && e.message ? e.message : e))
  }

  /* 共享宿主解析模块（评审修复：terminal/acp 的 makeRequire 收敛到 host-require.js） */
  try {
    const { makeRequire } = await import(new URL('../lib/host/host-require.js', import.meta.url))
    const wsmod = makeRequire()('ws')
    ok('host-require 解析 ws', !!(wsmod && wsmod.WebSocketServer))
  } catch (e) {
    ok('host-require 解析 ws', false, String(e && e.message ? e.message : e))
  }

  /* ---------- ACP 握手 + 会话管理 RPC：spawn kimi acp → initialize → session/new → list/mode/config → 回收 ---------- */
  try {
    const { createAcpManager } = await import(new URL('../lib/host/acp.js', import.meta.url))
    const mgr = createAcpManager(2)
    const key = 'smoke-acp:kimi'
    const fakeWs = { send() {}, on() {}, close() {} }
    const h = await mgr.attach('kimi', key, dir, fakeWs)
    ok('acp 握手（kimi initialize+session/new）', typeof h.sessionId === 'string' && h.sessionId.length > 0)
    ok('acp hello 带 modes/configOptions', !!(h.modes && h.modes.availableModes && h.modes.availableModes.length) && Array.isArray(h.configOptions))
    /* 未知 agent→client 请求回 method-not-found（评审修复回归防线）：
     * 暂换 send 捕获出口帧，不打扰真实 kimi 进程；通知（无 id）必须维持静默 */
    const origSend = h.send.bind(h)
    const captured = []
    h.send = (o) => captured.push(o)
    h.onLine(JSON.stringify({ jsonrpc: '2.0', id: 999001, method: 'workspace/unknown_thing', params: {} }))
    h.onLine(JSON.stringify({ jsonrpc: '2.0', method: 'session/unknown_notice', params: {} }))
    h.send = origSend
    ok('acp 未知 agent 请求回 method-not-found', captured.length === 1 && captured[0].id === 999001 && captured[0].error && captured[0].error.code === -32601)
    const lst = await h.rpc('session/list', {})
    ok('acp session/list 返回数组', lst && Array.isArray(lst.sessions))
    await h.rpc('session/set_mode', { sessionId: h.sessionId, modeId: 'plan' })
    const cfg = await h.rpc('session/set_config_option', { sessionId: h.sessionId, configId: 'thinking', value: 'high' })
    ok('acp set_mode/set_config_option', cfg && Array.isArray(cfg.configOptions))
    await h.rpc('session/set_mode', { sessionId: h.sessionId, modeId: 'default' }).catch(() => {})
    /* 会话管理三件套（kimi 0.36 实测 fork 需带 cwd；delete 参数为 sessionId） */
    const forked = await h.rpc('session/fork', { sessionId: h.sessionId, cwd: dir, mcpServers: [] })
    ok('acp fork 返回新 sessionId', !!(forked && forked.sessionId && forked.sessionId !== h.sessionId))
    await h.rpc('session/delete', { sessionId: forked.sessionId })
    ok('acp session/delete 无异常', true)
    const sn2 = await h.rpc('session/new', { cwd: dir, mcpServers: [] })
    ok('acp 同进程 session/new 新会话', !!(sn2 && sn2.sessionId && sn2.sessionId !== h.sessionId))
    mgr.disposeAll()
  } catch (e) {
    ok('acp 握手（kimi initialize+session/new）', false, String(e && e.message ? e.message : e))
  }

  /* ---------- client 纯组件（无头渲染） ---------- */
  const M = loadPart(['02-markdown.js', '12-mdpath.js'], ['renderMarkdown'])
  const md = M.renderMarkdown('# 标题\n\n**粗** 和 `code`\n\n```js\nconst a = 1\n```\n\n[外链](https://example.com)\n\n![图](pic.png)', [], '/notes')
  ok('md 标题/加粗/代码块', findAll(md, (n) => n.type === 'h1').length === 1 && findAll(md, (n) => n.type === 'strong').length >= 1 && findAll(md, (n) => n.type === 'pre').length === 1)
  ok('md 外链新标签', findAll(md, (n) => n.type === 'a' && n.props.target === '_blank').length >= 1)
  ok('md 本地图片经 mediaUrl', findAll(md, (n) => n.type === 'img' && String(n.props.src).indexOf('/wb/raw') >= 0).length === 1)
  ok('md 图片可点击放大', findAll(md, (n) => n.type === 'img' && typeof n.props.onClick === 'function').length === 1)
  /* 评审修复 #2 回归：基目录只经 bd 参数生效——空 bd 时本地图片不走 /wb/raw、原样直出 */
  const mdNoBase = M.renderMarkdown('![图](pic.png)', [], '')
  ok('md 空基目录图片原样直出（显式 bd，无隐式全局）', findAll(mdNoBase, (n) => n.type === 'img' && n.props.src === 'pic.png').length === 1)

  const C7 = loadPart(['07-code-csv.js'], ['highlightCode', 'parseCsv'])
  ok('highlightCode 关键词标记', findAll(C7.highlightCode('const x = 1', 'js'), (n) => n.type === 'span' && n.props.className === 'pw-tok-k').length >= 1)
  const csv = C7.parseCsv('a,b\n1,2')
  ok('parseCsv 行列', csv.length === 2 && csv[0][0] === 'a' && csv[1][1] === '2')

  /* CSS 守卫：.pw-tab-x 被预览栏与底部面板共用，任何"裸类名 + opacity:0"规则都会把预览 tab 的 × 永久藏掉（实战踩过） */
  const cssText = readFileSync(new URL('../lib/style.css', import.meta.url), 'utf8')
  ok('css 无裸 .pw-tab-x 隐藏规则', !/^\.pw-tab-x\s*\{[^}]*opacity\s*:\s*0/m.test(cssText))
  ok('css 内容列与主对话同宽（748 居中变量）', /--acp-col-pad:max\(12px, calc\(\(100% - 748px\) \/ 2\)\)/.test(cssText) && cssText.indexOf('padding:8px var(--acp-col-pad)') >= 0)

  /* store 工厂行为等价（③ 重构的唯一直接证明）：fire 语义与"不变不刷"规则 */
  const S = new Function('React', readFileSync(new URL('./workbench/01-stores.js', import.meta.url), 'utf8') + '\nreturn { bus, viewStore, notesStore, filesTabStore, store }')(fakeReact)
  let fires = 0
  S.bus.sub(() => fires++)
  S.viewStore.set('main')
  ok('viewStore.set 触发 fire', fires === 1 && S.viewStore.view === 'main')
  S.notesStore.set({})
  ok('notesStore.set(nullish) 仍触发 fire', fires === 2 && S.notesStore.dirs.length === 0 && S.notesStore.current === null)
  S.filesTabStore.set('project')
  ok('filesTabStore.set(同值) 不触发', fires === 2)
  S.filesTabStore.set('notes')
  ok('filesTabStore.set(异值) 触发', fires === 3 && S.filesTabStore.tab === 'notes')
  /* 桶 LRU（评审修复 #3）：上限 50，最旧空桶先淘；有文件的桶豁免一轮；触及提新 */
  S.store.bucket('cap0').files = [{ path: '/x.md', name: 'x.md' }]
  for (let i = 1; i <= 50; i++) S.store.bucket('cap' + i)
  ok('store 桶上限 50 且空桶先淘', Object.keys(S.store.buckets).length === 50 && !!S.store.buckets.cap0 && !S.store.buckets.cap1)
  S.store.bucket('cap2') /* 触及提新 */
  S.store.bucket('cap51')
  ok('store 桶 LRU 触及提新', Object.keys(S.store.buckets).length === 50 && !!S.store.buckets.cap2 && !S.store.buckets.cap3)

  const I5 = loadPart(['05-icons.js', '14-boticons.js'], ['LayersIcon', 'BotIcon'])
  ok('BotIcon/LayersIcon 结构', findAll(I5.BotIcon(12), (n) => n.type === 'path').length === 6 && findAll(I5.LayersIcon(12), (n) => n.type === 'path').length === 3)

  /* 共享 helper（评审修复 #6 收敛物）：下拉三件套结构 + 两击确认状态机 */
  const H6 = loadPart(['06-misc.js'], ['useTwoClick', 'dropOverlayEl', 'dropFilterEl', 'dropRowEl'])
  const dr = H6.dropRowEl({ k: 'r1', cur: true, title: '/t', onClick() {}, label: 'lab' })
  ok('ui 共享下拉行结构（cur/✓/label）', dr.type === 'button' && dr.props.className === 'pw-drop-row cur' && dr.props.title === '/t' && findAll(dr, (n) => n.props.className === 'pw-check' && n.children[0] === '✓').length === 1 && findAll(dr, (n) => n.props.className === 'pw-mono' && n.children[0] === 'lab').length === 1)
  ok('ui 共享下拉遮罩/过滤框', H6.dropOverlayEl(() => {}).props.className === 'pw-drop-overlay' && findAll(H6.dropFilterEl('v', 'ph', () => {}), (n) => n.type === 'input' && n.props.value === 'v' && n.props.placeholder === 'ph').length === 1)
  uiStateQueue = ['armed-id']
  const tc = H6.useTwoClick()
  ok('ui 两击确认状态机（armed/ask/cancel）', tc[0] === 'armed-id' && typeof tc[1] === 'function' && typeof tc[2] === 'function')
  uiStateQueue = null
  /* 去重依赖守卫（评审修复 #7）：03/09 的 shortenPath 经作用域链取 skills.js 的提升
   * 声明——skills.js 侧改名/删除时 03/09 运行期才炸，此处静态兜底。
   *（PencilIcon 刻意未收敛：skills 版 11px 固定 vs workbench 13px，见 05-icons 注释） */
  const skillsSrc = readFileSync(new URL('./skills.js', import.meta.url), 'utf8')
  ok('ui skills.js 仍提供共享 shortenPath', /function shortenPath\(/.test(skillsSrc))

  /* ---------- ACP 智能体 UI 无头驱动：FootBar/acpTabs/AgentTabView/BottomPanel 渲染期回归防线 ----------
   * 教训来源：slashOff state 漏声明导致 AgentTabView ReferenceError、面板整体呼不出；
   * node --check 只查语法，必须用 fakeReact 真渲染一遍。 */
  {
    const wsLog = []
    class FakeWS {
      constructor(url) { this.url = url; this.readyState = 1; this.sent = []; wsLog.push(this) }
      send(d) { this.sent.push(JSON.parse(String(d))) }
      close() {}
    }
    /* 02-markdown（agent 正文渲染）依赖 12-mdpath 的 mediaUrl（评审修复后基目录改显式 bd 传参）
     * 与 00-header 的 API；06-misc 供 useTwoClick/sessionProbe——与真实 bundle 的全件拼接对齐，
     * 缺件会让渲染期 ReferenceError */
    const uiSrc = ['00-header.js', '01-stores.js', '06-misc.js', '12-mdpath.js', '02-markdown.js', '07-code-csv.js', '05-icons.js', '14-boticons.js', '04-footbar.js', '15-acp.js', '15-bottom-panel.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    /* window 桩：tab 持久化（pw-acp-tabs）可断言；eval 时存储为空 → 自动恢复零副作用 */
    const lsStore = {
      _m: {},
      getItem(k) { return k in this._m ? this._m[k] : null },
      setItem(k, v) { this._m[k] = String(v) },
      removeItem(k) { delete this._m[k] },
    }
    const UI = new Function('React', 'location', 'WebSocket', 'window', uiSrc + '\nreturn { FootBar, BottomPanel, AgentTabView, acpTabs, acpRestore, bottomPanel, bottomArea, store }')(
      fakeReact,
      { origin: 'http://127.0.0.1:3080', protocol: 'http:' },
      FakeWS,
      { localStorage: lsStore },
    )
    let uiErr = ''
    try {
      const fb = UI.FootBar({ wide: true, onSkills() {} })
      ok('ui FootBar 渲染（助手聚合徽标）', findAll(fb, (n) => n.type === 'button').length >= 2)
      /* store.open：重复打开同一文件也必须激活对应 tab（评审 P2 回归防线） */
      UI.store.open('s1', { path: '/a.md', name: 'a.md' })
      UI.store.open('s1', { path: '/b.md', name: 'b.md' })
      UI.store.open('s1', { path: '/a.md', name: 'a.md' })
      const bk = UI.store.bucket('s1')
      ok('ui store.open 重复打开激活既有 tab', bk.files.length === 2 && bk.active === '/a.md')
      const tabId = UI.acpTabs.add('/tmp/repro-dir')
      ok('ui ＋选目录建 tab 并自动展开面板', UI.acpTabs.tabs.length === 1 && UI.bottomPanel.open === true && UI.bottomPanel.tab === tabId)
      ok('ui AcpClient 建连且带 cwd', wsLog.length === 1 && wsLog[0].url.indexOf('cwd=' + encodeURIComponent('/tmp/repro-dir')) >= 0)
      ok('ui tab 列表持久化（pw-acp-tabs）', (lsStore._m['pw-acp-tabs'] || '').indexOf('/tmp/repro-dir') >= 0)
      const c = UI.acpTabs.clients[tabId]
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'hello', sessionId: 's1', cwd: '/tmp/repro-dir', modes: { currentModeId: 'default', availableModes: [{ id: 'default', name: 'Default' }, { id: 'plan', name: 'Plan' }] }, configOptions: [{ type: 'select', id: 'model', currentValue: 'k3', options: [{ value: 'k3', name: 'K3' }] }], capabilities: { promptCapabilities: { image: true } } }) })
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'compact' }, { name: 'skill:lark-im' }] } }) })
      ok('ui hello/commands 落库', c.status === 'idle' && c.commands.length === 2 && c.configOptions.length === 1)
      const view = UI.AgentTabView({ client: c })
      ok('ui AgentTabView 渲染（模式/模型选择器）', findAll(view, (n) => n.type === 'select').length === 2)
      /* 布局重构（用户决策 2026-08）：头部控制条移除；三件套进输入区，选择器进下沿控制行 */
      ok('ui 无头部控制条（pw-acp-head 不存在）', findAll(view, (n) => String(n.props && n.props.className) === 'pw-acp-head').length === 0)
      /* 1.19.0 起输入区会话操作按钮为四件：新对话/历史/分叉/压缩（原先断言 3 件是压缩按钮漏更的漂移） */
      ok('ui 输入区会话操作按钮（新对话/历史/分叉/压缩）', findAll(view, (n) => typeof n.props.className === 'string' && n.props.className.indexOf('pw-acp-hbtn') === 0).length === 4 && findAll(view, (n) => n.children && n.children[0] === '新对话').length === 1 && findAll(view, (n) => String(n.props && n.props.className).indexOf('pw-acp-compact') >= 0).length === 1)
      ok('ui 输入框独立成框 + 控制行分离', findAll(view, (n) => String(n.props && n.props.className) === 'pw-acp-composer').length === 1 && findAll(view, (n) => String(n.props && n.props.className) === 'pw-acp-controls').length === 1)
      /* 上下文紧凑指示器：usage_update 落库 → 控制行渲染 迷你条+百分比 */
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'usage_update', used: 131072, size: 262144 } }) })
      const vu = UI.AgentTabView({ client: c })
      ok('ui 上下文指示器（50% 迷你条）', findAll(vu, (n) => String(n.props && n.props.className) === 'pw-acp-usage').length === 1 && findAll(vu, (n) => String(n.props && n.props.className) === 'pw-acp-usage-text' && n.children[0] === '50%').length === 1)
      /* 运行中交互（用户决策 2026-08）：引导/后续消息/红色停止；排队→turn_end 自动补发；引导=cancel→结束后回发 */
      c.status = 'running'
      const vr = UI.AgentTabView({ client: c })
      ok('ui 运行中 引导/后续消息/停止 按钮', findAll(vr, (n) => n.children && n.children[0] === '引导').length === 1 && findAll(vr, (n) => n.children && n.children[0] === '后续消息').length === 1 && findAll(vr, (n) => String(n.props && n.props.className) === 'pw-acp-stop').length === 1)
      c.enqueue('排队第一条', [])
      const vq = UI.AgentTabView({ client: c })
      ok('ui 排队面板渲染（已排队 · 1）', findAll(vq, (n) => String(n.props && n.props.className) === 'pw-acp-queue').length === 1)
      wsLog[0].sent.length = 0
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'turn_end' }) })
      ok('ui 轮次结束自动补发排队消息', wsLog[0].sent.some((f) => f.type === 'prompt' && f.text === '排队第一条') && c.queue.length === 0)
      c.status = 'running'
      wsLog[0].sent.length = 0
      c.steerNow('立即改做这个', [])
      ok('ui 引导先 cancel（不直接 prompt）', wsLog[0].sent.some((f) => f.type === 'cancel') && !wsLog[0].sent.some((f) => f.type === 'prompt'))
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'turn_end' }) })
      ok('ui 引导轮次结束后回发', wsLog[0].sent.some((f) => f.type === 'prompt' && f.text === '立即改做这个'))
      c.items = [] /* 复位：保后续"空白 tab 连删"判据 */
      c.status = 'idle'
      /* note / session_deleted 帧：渲染与列表维护 */
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'note', message: '已分叉为新会话' }) })
      const v2 = UI.AgentTabView({ client: c })
      ok('ui note 帧渲染', findAll(v2, (n) => String(n.props && n.props.className) === 'pw-acp-note').length === 1)
      /* 历史清扫：同 cwd 空白（非存活）→ silent 删除；有标题、存活空白（s1）、
       * 跨 cwd 空白（kimi 跨 cwd 删除必 Internal error，实测）→ 全保留 */
      wsLog[0].sent.length = 0
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'sessions', sessions: [
        { sessionId: 'blank-1', cwd: '/tmp/repro-dir', title: null },
        { sessionId: 'real-1', cwd: '/tmp/repro-dir', title: '真对话' },
        { sessionId: 's1', cwd: '/tmp/repro-dir', title: null },
        { sessionId: 'blank-foreign', cwd: '/elsewhere', title: null },
      ] }) })
      ok('ui 历史清扫：仅 silent 删同 cwd 非存活空白', wsLog[0].sent.filter((f) => f.type === 'delete_session').length === 1 && wsLog[0].sent[0].sessionId === 'blank-1' && wsLog[0].sent[0].silent === true)
      ok('ui 历史保留有标题/存活/跨 cwd 会话', c.sessions.length === 3 && c.sessions.some((s) => s.sessionId === 'real-1') && c.sessions.some((s) => s.sessionId === 's1') && c.sessions.some((s) => s.sessionId === 'blank-foreign'))
      c.sessions = [{ sessionId: 'a', cwd: '/tmp/repro-dir' }, { sessionId: 'b', cwd: '/tmp/repro-dir' }]
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'session_deleted', sessionId: 'a' }) })
      ok('ui session_deleted 移除列表项', c.sessions.length === 1 && c.sessions[0].sessionId === 'b')
      /* 工具调用卡片：tool_call → in_progress（content 是 input JSON 完整前缀快照，剥双层包装提参）
       * → completed（locations/rawOutput 才是输出）——全字段形状来自 kimi 0.36 实测 */
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read', kind: 'read', status: 'pending', content: [] } }) })
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'in_progress', content: [{ type: 'content', content: { type: 'text', text: '{"path": "/tmp/x/hello.txt"}' } }] } }) })
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', rawOutput: 'line1\nline2', locations: [{ path: '/tmp/x/hello.txt' }] } }) })
      const vt = UI.AgentTabView({ client: c })
      ok('ui 工具调用卡片渲染（完成态）', findAll(vt, (n) => /pw-acp-tool st-completed/.test(String(n.props && n.props.className))).length === 1)
      ok('ui 工具卡片中文状态与参数提取', findAll(vt, (n) => String(n.props && n.props.className) === 'pw-acp-tool-status' && n.children[0] === '完成').length === 1 && findAll(vt, (n) => String(n.props && n.props.className) === 'pw-acp-tool-arg' && n.children[0] === '…/x/hello.txt').length === 1)
      ok('ui 工具输出可展开（rawOutput 进 details）', findAll(vt, (n) => String(n.props && n.props.className) === 'pw-acp-tool-out').length === 1 && findAll(vt, (n) => n.type === 'pre' && String(n.children[0]).indexOf('line1') === 0).length >= 1)
      /* 标题已含 arg（kimi Bash 类 "Running: <命令>"）→ arg 不重复显示 */
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call', toolCallId: 't2', title: 'Running: ls', kind: 'execute', status: 'pending', content: [] } }) })
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'in_progress', content: [{ type: 'content', content: { type: 'text', text: '{"command": "ls"}' } }] } }) })
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'completed', rawOutput: 'a.txt' } }) })
      const vb = UI.AgentTabView({ client: c })
      ok('ui 工具参数与标题重复时不重复显示', findAll(vb, (n) => String(n.props && n.props.className) === 'pw-acp-tool-arg').length === 1 && findAll(vb, (n) => /pw-acp-tool st-/.test(String(n.props && n.props.className))).length === 2)
      /* agent 正文 markdown：粗体/删除线/代码块进气泡；js 围栏接 highlightCode，mermaid 保持原文 */
      wsLog[0].onmessage({ data: JSON.stringify({ type: 'update', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '**粗体** 与 ~~删除线~~\n\n```js\nlet a = 1\n```\n\n```mermaid\ngraph TD\n```' } } }) })
      const vm = UI.AgentTabView({ client: c })
      ok('ui agent 消息按 markdown 渲染（strong/code）', findAll(vm, (n) => n.type === 'strong' && n.children[0] === '粗体').length === 1 && findAll(vm, (n) => String(n.props && n.props.className) === 'pw-code').length === 2)
      ok('ui 删除线 inline 渲染（del）', findAll(vm, (n) => n.type === 'del' && n.children[0] === '删除线').length === 1)
      ok('ui 已知语言围栏语法高亮（js 着色）', findAll(vm, (n) => String(n.props && n.props.className) === 'pw-tok-k' && n.children[0] === 'let').length === 1)
      ok('ui 未知语言围栏保持原文（mermaid 不着色）', findAll(vm, (n) => n.type === 'code' && String(n.children[0]).indexOf('graph TD') >= 0).length === 1)
      /* 粘贴图片：非图片剪贴板不拦截（走默认文本粘贴），图片剪贴板拦截并经 FileReader 入队 */
      const FR = globalThis.FileReader
      globalThis.FileReader = class {
        readAsDataURL() {
          this.result = 'data:image/png;base64,QUJD'
          if (this.onload) this.onload()
        }
      }
      try {
        const textInput = findAll(v2, (n) => n.type === 'input' && typeof n.props.onPaste === 'function')[0]
        ok('ui 输入框挂 onPaste（imageCap 时）', !!textInput)
        let prevented = 0
        const pd = () => prevented++
        textInput.props.onPaste({ clipboardData: { items: [{ kind: 'string', type: 'text/plain' }] }, preventDefault: pd })
        ok('ui 纯文本粘贴不拦截', prevented === 0)
        textInput.props.onPaste({ clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({ type: 'image/png' }) }] }, preventDefault: pd })
        ok('ui 图片粘贴拦截并读图入队', prevented === 1)
      } finally {
        if (FR === undefined) delete globalThis.FileReader
        else globalThis.FileReader = FR
      }
      /* BottomPanel 四个 useState 依序：force/rect/mounted/entered——队列后两位
       * 置 true 模拟「已打开并完成滑入」的稳态（effect 驱动的首帧过渡不在此测） */
      UI.bottomPanel.open = true
      uiStateQueue = [0, { left: 0, width: 900 }, true, true]
      const bp = UI.BottomPanel({ workspacesSvc: { pickDirectory: async () => null } })
      const bpTabs = findAll(bp, (n) => /(^| )pw-bpanel-tab( |$)/.test(String(n.props && n.props.className)))
      ok('ui BottomPanel tab 栏（终端+智能体 tab）', bpTabs.length === 2)
      /* tab 序（v1.17.0 布局对齐）：智能体 tabs 居左，「终端」挪右端挨着关闭钮 */
      ok('ui tab 序：智能体居左、终端居右', String(bpTabs[1].children[0]) === '终端')
      ok('ui 智能体 tab 状态点', findAll(bp, (n) => /pw-tab-dot (idle|connecting|running)/.test(String(n.props && n.props.className))).length === 1)
      ok('ui 关闭钮为 » 旋转箭头', findAll(bp, (n) => String(n.props && n.props.className).includes('pw-bpanel-col-arrow')).length === 1)
      UI.bottomPanel.open = false
      uiStateQueue = [0, { left: 0, width: 900 }, true, true]
      /* 关栏语义（v1.17.0）：常驻挂载 + off 类滑出，不再 render null（终端保活） */
      const bpOff = UI.BottomPanel({ workspacesSvc: {} })
      ok('ui 面板关闭渲染 off 态', bpOff !== null && /pw-bpanel off/.test(String(bpOff.props.className)))
      /* 底部区域仲裁（dshBottomPanels 兼容机制）：占位让位 / 排他 / 释放归位且 open 态保留 */
      UI.bottomPanel.open = true
      ok('ui 底部区域被占位后面板让位', (UI.bottomArea.acquire('gtm-test'), uiStateQueue = [0, { left: 0, width: 900 }, true, true], UI.BottomPanel({ workspacesSvc: {} }) === null) && UI.bottomPanel.open === true)
      ok('ui 占位排他（他方 acquire/release 均拒）', UI.bottomArea.acquire('other') === false && UI.bottomArea.release('other') === false && UI.bottomArea.owner === 'gtm-test')
      ok('ui 释放后归位（open 状态保留）', (UI.bottomArea.release('gtm-test'), uiStateQueue = [0, { left: 0, width: 900 }, true, true], UI.BottomPanel({ workspacesSvc: {} }) !== null))
      UI.bottomPanel.open = false
      /* 关 tab 连删：s1 全程无 user 条目（空白）→ close 应先发 delete_session 再断连 */
      wsLog[0].sent.length = 0
      UI.acpTabs.close(tabId)
      ok('ui 关闭 tab 回收', UI.acpTabs.tabs.length === 0 && UI.bottomPanel.tab === 'terminal')
      ok('ui 关闭空白 tab 连带删会话（silent）', wsLog[0].sent.some((f) => f.type === 'delete_session' && f.sessionId === 's1' && f.silent === true))
      ok('ui 关闭后持久化清空', lsStore._m['pw-acp-tabs'] === '[]')
      /* 刷新恢复：种子 → acpRestore 重建 tab → hello 拉列表 → 回捞最近有标题会话（跳过空白） */
      lsStore._m['pw-acp-tabs'] = JSON.stringify([{ id: 'krest1', cwd: '/tmp/repro-dir' }])
      UI.acpRestore()
      ok('ui 刷新恢复重建 tab 并重连', UI.acpTabs.tabs.length === 1 && UI.acpTabs.tabs[0].id === 'krest1' && wsLog.length === 2)
      wsLog[1].onmessage({ data: JSON.stringify({ type: 'hello', sessionId: 'snew', cwd: '/tmp/repro-dir' }) })
      ok('ui 恢复 tab hello 后拉会话列表', wsLog[1].sent.some((f) => f.type === 'list_sessions'))
      wsLog[1].sent.length = 0
      wsLog[1].onmessage({ data: JSON.stringify({ type: 'sessions', sessions: [
        { sessionId: 'recent-1', cwd: '/tmp/repro-dir', title: '昨天的对话', updatedAt: '2026-08-18T10:00:00Z' },
        { sessionId: 'blank-x', cwd: '/tmp/repro-dir', title: null, updatedAt: '2026-08-19T01:00:00Z' },
        { sessionId: 'other-cwd', cwd: '/elsewhere', title: '别处的', updatedAt: '2026-08-19T02:00:00Z' },
      ] }) })
      ok('ui 回捞最近有标题同目录会话', wsLog[1].sent.some((f) => f.type === 'load_session' && f.sessionId === 'recent-1') && !wsLog[1].sent.some((f) => f.type === 'load_session' && f.sessionId !== 'recent-1'))
      UI.acpTabs.close('krest1')
      /* 断线自动重连（B+D，2026-08 决策）：异常断线→dead+退避排程；同会话 hello 不回捞；
       * dead 期入队的消息在 hello 后自动补发 */
      const tab2 = UI.acpTabs.add('/tmp/repro-dir')
      const c2 = UI.acpTabs.clients[tab2]
      wsLog[2].onmessage({ data: JSON.stringify({ type: 'hello', sessionId: 's2', cwd: '/tmp/repro-dir' }) })
      c2.enqueue('断线期间的消息', [])
      wsLog[2].onclose({ code: 1006 })
      ok('ui 异常断线转 dead 并排程自动重连', c2.status === 'dead' && c2.reconnecting === 1 && !!c2._rcTimer)
      clearTimeout(c2._rcTimer)
      c2._rcTimer = 0
      c2.reconnect()
      ok('ui 重连建立新 WS', wsLog.length === 4)
      wsLog[3].onmessage({ data: JSON.stringify({ type: 'hello', sessionId: 's2', cwd: '/tmp/repro-dir' }) })
      ok('ui 同会话重挂不回捞且补发排队消息', c2.status === 'running' && !wsLog[3].sent.some((f) => f.type === 'list_sessions') && wsLog[3].sent.some((f) => f.type === 'prompt' && f.text === '断线期间的消息') && c2.queue.length === 0)
      /* socket 代际守卫（评审修复 #1）：重连后旧 socket 的迟到事件不得写新态 */
      const itemsBefore = c2.items.length
      wsLog[2].onmessage({ data: JSON.stringify({ type: 'note', message: '旧 socket 的迟到帧' }) })
      ok('ui 旧 socket 迟到帧被代际守卫丢弃', c2.items.length === itemsBefore && c2.status === 'running')
      wsLog[2].onclose({ code: 1006 })
      ok('ui 旧 socket 迟到 close 不置 dead 不排退避', c2.status === 'running' && !c2._rcTimer)
      UI.acpTabs.close(tab2)
    } catch (e) {
      uiErr = String((e && e.stack) || e)
      ok('ui 无头驱动', false, uiErr)
    }
  }

  /* ---------- Details 焦点刷新编辑态守卫（评审 P3 #2 回归防线） ----------
   * rf 回调注册于 deps=[path] 的 effect，必须经 edRef 读实时编辑态；
   * 旧版闭包捕获注册时的 ed（恒 false），编辑中焦点回归仍触发刷新。 */
  {
    const hostLog = []
    const hostStub = { call: (m2) => { hostLog.push(m2); return Promise.resolve(null) } }
    const listeners = {}
    const onL = (t2, f) => { (listeners[t2] = listeners[t2] || []).push(f) }
    const fakeWin = { addEventListener: onL, removeEventListener() {} }
    const fakeDoc = { addEventListener: onL, removeEventListener() {}, visibilityState: 'visible' }
    const dSrc = ['00-header.js', '01-stores.js', '02-markdown.js', '05-icons.js', '06-misc.js', '07-code-csv.js', '11-details.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    const D2 = new Function('React', 'API', 'host', 'window', 'document', dSrc + '\nreturn { Details, store, sessionProbe }')(
      fakeReact, '/__dsh-geek-sidebar__', hostStub, fakeWin, fakeDoc,
    )
    try {
      D2.sessionProbe.set('dt1')
      D2.store.open('dt1', { path: '/d/f.md', name: 'f.md' })
      /* 渲染1（默认 ed=false）：跑 effect 注册监听后清掉加载期 readFile，焦点回归 → 应刷新一次。
       * 注意始终调 listeners.focus[0]：真实 React 里该 effect deps=[path] 不变不会重注册，
       * 存活的就是首次注册的监听器（harness 每次渲染重跑 effect 属噪音，[0] 才是忠实模拟） */
      let mark = uiEffects.length
      fakeReact.__resetRefs()
      D2.Details({ layout: null })
      for (let i = mark; i < uiEffects.length; i++) uiEffects[i]()
      hostLog.length = 0
      listeners.focus[0]()
      ok('ui Details 非编辑态焦点回归触发刷新', hostLog.filter((m2) => m2 === 'workbench.readFile').length === 1)
      /* 渲染2（uiStateQueue 第 9 个 useState = ed 位置，置 true 模拟编辑中）：
       * 跑新 effect 同步 edRef 后清台，仍调首个监听器 → 不应刷新
       *（旧闭包 bug：首个监听器捕获 ed=false，此处会 +1 被当场抓获） */
      mark = uiEffects.length
      fakeReact.__resetRefs()
      uiStateQueue = [0, 0, null, 'auto', '', false, false, false, true, '', false]
      D2.Details({ layout: null })
      uiStateQueue = null
      for (let i = mark; i < uiEffects.length; i++) uiEffects[i]()
      hostLog.length = 0
      listeners.focus[0]()
      ok('ui Details 编辑态焦点回归不刷新（edRef 实时读）', hostLog.filter((m2) => m2 === 'workbench.readFile').length === 0)
    } catch (e) {
      ok('ui Details 焦点刷新守卫', false, String((e && e.stack) || e))
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
