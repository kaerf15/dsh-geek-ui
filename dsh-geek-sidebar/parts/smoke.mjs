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
/* hooks 为无状态实现；UI 无头驱动经 uiStateQueue 预设 useState 返回序列（下方各 UI 块按需注入）。
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
  /* 10-panels 的 PanelErrorBoundary extends React.Component——无头测试只声明不实例化，空类垫片即可 */
  Component: class {},
  useState: (init) => (uiStateQueue && uiStateQueue.length ? [uiStateQueue.shift(), () => {}] : [init, () => {}]),
  useEffect: (fn) => { uiEffects.push(fn) },
  useRef: (v) => { const i = uiRefPos++; return uiRefPool[i] || (uiRefPool[i] = { current: v || null }) },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn(),
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

  const l1 = await routes['POST /wb/listDir']({ body: { path: dir } })
  ok('listDir(fs 主路)', Array.isArray(l1.entries)
    && l1.entries.some((e) => e.name === 'smoke-a.txt' && e.type === 'file')
    && l1.entries.some((e) => e.name === 'sub' && e.type === 'directory')
    && l1.entries.some((e) => e.name === '.secret' && e.hidden === true)
    && l1.entries[0].type === 'directory')
  const l2 = await shellRoutes['POST /wb/listDir']({ body: { path: dir } })
  ok('listDir(shell 兜底)', Array.isArray(l2.entries) && l2.entries.some((e) => e.name === 'smoke-a.txt'))
  /* DirPicker 面包屑字段（1.19.11）：path=规范化绝对路径，parent=跨平台父目录（根为 null）；
   * 空 path 默认 home。两路（fss 主路 / node 兜底）语义一致 */
  ok('listDir 带 path/parent（fs 主路）', l1.path === dir && typeof l1.parent === 'string' && l1.parent.length < dir.length)
  ok('listDir 带 path/parent（node 兜底）', l2.path === dir && l2.parent === l1.parent)
  const l0 = await routes['POST /wb/listDir']({ body: {} })
  ok('listDir 空 path 默认 home', l0.path === homedir() && Array.isArray(l0.entries))
  const lr = await routes['POST /wb/listDir']({ body: { path: '/' } })
  ok('listDir 根目录 parent 为 null', lr.path === '/' && lr.parent === null)
  const lw = await shellRoutes['POST /wb/listDir']({ body: { path: dir + '/' } })
  ok('listDir 尾分隔符剥除后 parent 一致', lw.path === dir + '/' && lw.parent === l1.parent)

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

  /* DirPicker 默认目录偏好（1.19.12）：prefsFile 注入临时路径，不碰真实 ~/.dsh。
   * 未自定义回落桌面；set 校验绝对路径+目录存在；空串清除回落 */
  const prefRoutes = workbenchApi({ get: (n) => (n === 'shell' ? shellShim : n === 'fs' ? fsShim : undefined) }, { prefsFile: join(dir, 'wbprefs.json') })
  const pg0 = await prefRoutes['POST /wb/prefsGet']({ body: {} })
  ok('prefsGet 未自定义回落桌面', pg0.custom === false && (pg0.pickerDir === join(homedir(), 'Desktop') || pg0.pickerDir === homedir()))
  const ps1 = await prefRoutes['POST /wb/prefsSet']({ body: { pickerDir: dir } })
  ok('prefsSet 设自定义默认', ps1.ok === true && ps1.custom === true && ps1.pickerDir === dir)
  const pg1 = await prefRoutes['POST /wb/prefsGet']({ body: {} })
  ok('prefsGet 读回自定义默认', pg1.custom === true && pg1.pickerDir === dir)
  const psBad = await prefRoutes['POST /wb/prefsSet']({ body: { pickerDir: join(dir, 'not-exists') } })
  ok('prefsSet 拒不存在目录', psBad.ok === false)
  const psRel = await prefRoutes['POST /wb/prefsSet']({ body: { pickerDir: 'relative/path' } })
  ok('prefsSet 拒相对路径', psRel.ok === false)
  const ps0 = await prefRoutes['POST /wb/prefsSet']({ body: { pickerDir: '' } })
  ok('prefsSet 空串清除回落桌面', ps0.ok === true && ps0.custom === false)
  /* 自愈合：自定义目录被删后 prefsGet 静默回落桌面（custom 随生效值归零） */
  const goneDir = join(dir, 'gone')
  mkdirSync(goneDir)
  await prefRoutes['POST /wb/prefsSet']({ body: { pickerDir: goneDir } })
  rmSync(goneDir, { recursive: true, force: true })
  const pg2 = await prefRoutes['POST /wb/prefsGet']({ body: {} })
  ok('prefsGet 自定义目录失效自愈合回落桌面', pg2.custom === false && pg2.pickerDir !== goneDir)

  /* ---------- 便签（quick notes）：qn* 路由组回归防线 ----------
   * quickNotesDir 与 qnPrefsFile 均注入临时路径，零触碰真实用户数据。 */
  const qnDirTmp = join(dir, 'qntemp')
  const qnPrefsTmp = join(dir, 'qnprefs.json')
  const qnRoutes = workbenchApi({ get: (n) => (n === 'shell' ? shellShim : n === 'fs' ? fsShim : undefined) }, {
    quickNotesDir: qnDirTmp,
    qnPrefsFile: qnPrefsTmp,
  })

  /* qnState */
  const qs0 = await qnRoutes['POST /wb/qnState']({ body: {} })
  ok('qnState 初始态（临时目录 + 默认开启划选）', qs0.ok === true && qs0.dir === qnDirTmp && qs0.custom === false && qs0.capture === true)

  /* qnCreate */
  const qc1 = await qnRoutes['POST /wb/qnCreate']({ body: { title: '测试便签', content: '# 测试标题\n这是第一条便签正文。' } })
  ok('qnCreate 创建便签', qc1.ok === true && qc1.name === '测试便签.md' && qc1.title === '测试便签')
  ok('qnCreate 磁盘写入验证', readFileSync(join(qnDirTmp, '测试便签.md'), 'utf8').includes('这是第一条便签正文'))

  /* qnCreate 重名序号去重 */
  const qc2 = await qnRoutes['POST /wb/qnCreate']({ body: { title: '测试便签', content: '第二篇同名便签' } })
  ok('qnCreate 重名自增后缀', qc2.ok === true && qc2.name === '测试便签-2.md')

  /* qnCreate 拒绝空内容 */
  ok('qnCreate 拒空内容（400）', (await thrownStatus(() => qnRoutes['POST /wb/qnCreate']({ body: { title: 'x', content: '   ' } }))) === 400)

  /* qnList 与检索 */
  const qlAll = await qnRoutes['POST /wb/qnList']({ body: {} })
  ok('qnList 列表返回两条', qlAll.ok === true && Array.isArray(qlAll.notes) && qlAll.notes.length === 2)
  ok('qnList 预览提取非空首行', qlAll.notes.some((n) => n.name === '测试便签.md' && n.preview === '测试标题'))
  const qlFilter = await qnRoutes['POST /wb/qnList']({ body: { q: '第二篇' } })
  ok('qnList 全文检索过滤命中', qlFilter.notes.length === 1 && qlFilter.notes[0].name === '测试便签-2.md')

  /* qnRead */
  const qr = await qnRoutes['POST /wb/qnRead']({ body: { name: '测试便签.md' } })
  ok('qnRead 读回文本', qr.ok === true && qr.text.includes('这是第一条便签正文'))
  ok('qnRead 拒非法路径名（400）', (await thrownStatus(() => qnRoutes['POST /wb/qnRead']({ body: { name: '../wbprefs.json' } }))) === 400)
  ok('qnRead 查无此便签（404）', (await thrownStatus(() => qnRoutes['POST /wb/qnRead']({ body: { name: 'notfound.md' } }))) === 404)

  /* qnUpdate 内容与重命名 */
  const qu = await qnRoutes['POST /wb/qnUpdate']({ body: { name: '测试便签.md', content: '更新后的文本', title: '改名后的便签' } })
  ok('qnUpdate 改内容并改名', qu.ok === true && qu.name === '改名后的便签.md' && qu.renamed === true)
  ok('qnUpdate 磁盘改名落盘', existsSync(join(qnDirTmp, '改名后的便签.md')) && !existsSync(join(qnDirTmp, '测试便签.md')))
  ok('qnUpdate 拒空内容（400）', (await thrownStatus(() => qnRoutes['POST /wb/qnUpdate']({ body: { name: '改名后的便签.md', content: ' ' } }))) === 400)

  /* qnDelete */
  ok('qnDelete 拒非法文件名（400）', (await thrownStatus(() => qnRoutes['POST /wb/qnDelete']({ body: { name: 'bad/name.md' } }))) === 400)
  ok('qnDelete 查无此便签（404）', (await thrownStatus(() => qnRoutes['POST /wb/qnDelete']({ body: { name: 'ghost.md' } }))) === 404)

  /* qnSetDir */
  const qdCustom = join(dir, 'custom-qn')
  mkdirSync(qdCustom)
  const qdSet = await qnRoutes['POST /wb/qnSetDir']({ body: { dir: qdCustom } })
  ok('qnSetDir 切换自定义目录', qdSet.ok === true && qdSet.dir === qdCustom && qdSet.custom === true)
  const qdBad = await qnRoutes['POST /wb/qnSetDir']({ body: { dir: 'relative' } })
  ok('qnSetDir 拒相对路径', qdBad.ok === false)
  const qdClear = await qnRoutes['POST /wb/qnSetDir']({ body: { dir: '' } })
  ok('qnSetDir 空串恢复默认', qdClear.ok === true && qdClear.dir === qnDirTmp && qdClear.custom === false)

  /* qnMoveToKb 权限防御 */
  ok('qnMoveToKb 拒未登记知识库目录', (await qnRoutes['POST /wb/qnMoveToKb']({ body: { name: '改名后的便签.md', targetDir: '/tmp' } })).ok === false)

  /* qnMoveToProject 验证 */
  const moveProjRes = await qnRoutes['POST /wb/qnMoveToProject']({ body: { name: '改名后的便签.md', targetDir: dir } })
  ok('qnMoveToProject 分流至项目目录', moveProjRes.ok === true && existsSync(join(dir, '改名后的便签.md')))

  /* qnSyncTo 验证（纯复制，不删源便签） */
  const syncRes = await qnRoutes['POST /wb/qnSyncTo']({ body: { name: '测试便签-2.md', targetDir: dir } })
  ok('qnSyncTo 同步到指定目录且保留源便签', syncRes.ok === true && existsSync(join(dir, '测试便签-2.md')) && existsSync(join(qnDirTmp, '测试便签-2.md')))

  /* qnFoldersGet / qnFoldersSet 目录元数据 */
  const fSet = await qnRoutes['POST /wb/qnFoldersSet']({
    body: {
      folders: ['工作', '生活'],
      noteFolders: { '测试便签-2.md': '工作' },
    },
  })
  ok('qnFoldersSet 写入目录元数据', fSet.ok === true && fSet.folders.length === 2 && fSet.noteFolders['测试便签-2.md'] === '工作')
  const fGet = await qnRoutes['POST /wb/qnFoldersGet']({})
  ok('qnFoldersGet 读回目录元数据', fGet.ok === true && fGet.folders[0] === '工作' && fGet.noteFolders['测试便签-2.md'] === '工作')

  /* 删除：文件进 ~/.Trash，断言后清理测试残留。
   * macOS TCC 下终端可能无权读 ~/.Trash（EPERM）——环境权限问题不应砸掉整个
   * 冒烟套件：读不到废纸篓就只断言删除本身，跳过落点验证。 */
  const delTarget = join(dir, 'smoke-a.txt')
  const trashDir = join(homedir(), '.Trash')
  let trashReadable = true
  let before = []
  try {
    before = readdirSync(trashDir).filter((n) => n.startsWith('smoke-a'))
  } catch {
    trashReadable = false
  }
  const dl = await routes['POST /wb/delete']({ body: { path: delTarget } })
  const gone = !existsSync(delTarget)
  const landed = trashReadable
    ? readdirSync(trashDir).filter((n) => n.startsWith('smoke-a')).find((n) => !before.includes(n))
    : null
  ok('delete 移废纸篓' + (trashReadable ? '' : '（废纸篓不可读，仅断言删除）'), dl.ok === true && gone && (trashReadable ? !!landed : true))
  if (landed) rmSync(join(trashDir, landed), { recursive: true, force: true })

  /* ---------- 移动（拖拽把文件/文件夹挪进另一目录）---------- */
  mkdirSync(join(dir, 'sub2'))
  const mvFileSrc = join(dir, 'move-me.txt')
  writeFileSync(mvFileSrc, 'move me', 'utf8')
  const mvRes = await routes['POST /wb/move']({ body: { src: mvFileSrc, destDir: join(dir, 'sub') } })
  ok('move 文件入目录', mvRes.ok === true && !existsSync(mvFileSrc) && existsSync(join(dir, 'sub', 'move-me.txt')) && readFileSync(join(dir, 'sub', 'move-me.txt'), 'utf8') === 'move me')

  /* 文件夹整体移动（含子文件，cp/rm 兜底语义同 delete） */
  mkdirSync(join(dir, 'mv-dir'))
  writeFileSync(join(dir, 'mv-dir', 'inner.txt'), 'inner', 'utf8')
  const mvDirRes = await routes['POST /wb/move']({ body: { src: join(dir, 'mv-dir'), destDir: join(dir, 'sub2') } })
  ok('move 文件夹整体移动', mvDirRes.ok === true && !existsSync(join(dir, 'mv-dir')) && existsSync(join(dir, 'sub2', 'mv-dir', 'inner.txt')))

  /* 防御：拒绝移进自身子孙；同父目录 no-op；非法参数 400 */
  mkdirSync(join(dir, 'sub', 'subsub'))
  const mvSelf = await routes['POST /wb/move']({ body: { src: join(dir, 'sub'), destDir: join(dir, 'sub', 'subsub') } })
  ok('move 拒绝移入自身子孙', mvSelf.ok === false)
  const mvNoop = await routes['POST /wb/move']({ body: { src: join(dir, 'sub', 'move-me.txt'), destDir: join(dir, 'sub') } })
  ok('move 同父目录 no-op', mvNoop.ok === false)
  ok('move 拒相对 src（400）', (await thrownStatus(() => routes['POST /wb/move']({ body: { src: 'rel/x.txt', destDir: join(dir, 'sub') } }))) === 400)
  ok('move 拒相对 destDir（400）', (await thrownStatus(() => routes['POST /wb/move']({ body: { src: join(dir, 'sub', 'move-me.txt'), destDir: 'rel' } }))) === 400)

  /* ---------- 会话路径（对齐 dsh 会话持久化布局） ---------- */
  ok('sessionPath 拒空 id（400）', (await thrownStatus(() => routes['POST /wb/sessionPath']({ body: {} }))) === 400)
  const spPath = await routes['POST /wb/sessionPath']({ body: { id: 'session-smoke-xyz', cwd: dir } })
  const spPathParent = spPath.path.slice(0, spPath.path.lastIndexOf('/'))
  const spPathProj = spPathParent.slice(spPathParent.lastIndexOf('/') + 1)
  ok('sessionPath 绝对路径 + 项目桶 + 会话目录', spPath.ok === true && spPath.path.endsWith('/session-smoke-xyz') && spPathParent.includes('sessions') && spPathProj.startsWith('--') && spPathProj.endsWith('--'))
  const spPathNC = await routes['POST /wb/sessionPath']({ body: { id: 'session-smoke-nc' } })
  ok('sessionPath 无 cwd 归 _no-cwd 桶', spPathNC.ok === true && spPathNC.path.endsWith('/_no-cwd/session-smoke-nc'))

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


  /* ---------- client 纯组件（无头渲染） ---------- */
  /* 01-stores 提供 pathJoinFor/baseName 等路径工具（12-mdpath 依赖）；该文件本就按
   * 「可被 smoke 单独 eval」设计（typeof 守卫），拼在最前即可 */
  const M = loadPart(['01-stores.js', '02-markdown.js', '12-mdpath.js'], ['renderMarkdown', 'MdImg'])
  const md = M.renderMarkdown('# 标题\n\n**粗** 和 `code`\n\n```js\nconst a = 1\n```\n\n[外链](https://example.com)\n\n![图](pic.png)', [], '/notes')
  ok('md 标题/加粗/代码块', findAll(md, (n) => n.type === 'h1').length === 1 && findAll(md, (n) => n.type === 'strong').length >= 1 && findAll(md, (n) => n.type === 'pre').length === 1)
  ok('md 外链新标签', findAll(md, (n) => n.type === 'a' && n.props.target === '_blank').length >= 1)
  /* 评审修复 N2 后图片走 MdImg 组件（失败态收进 React state）——断言 type === MdImg 与 src */
  ok('md 本地图片经 mediaUrl', findAll(md, (n) => n.type === M.MdImg && String(n.props.src).indexOf('/wb/raw') >= 0).length === 1)
  /* 点击放大在 MdImg 内部：调组件本体取内层 img 断言 onClick */
  const imgInner = M.MdImg({ src: '/wb/raw?path=x', alt: 'a', raw: 'r' })
  ok('md 图片可点击放大', !!imgInner && imgInner.type === 'img' && typeof imgInner.props.onClick === 'function')
  /* 评审修复 #2 回归：基目录只经 bd 参数生效——空 bd 时本地图片不走 /wb/raw、原样直出 */
  const mdNoBase = M.renderMarkdown('![图](pic.png)', [], '')
  ok('md 空基目录图片原样直出（显式 bd，无隐式全局）', findAll(mdNoBase, (n) => n.type === M.MdImg && n.props.src === 'pic.png').length === 1)

  const C7 = loadPart(['07-code-csv.js'], ['highlightCode', 'parseCsv'])
  ok('highlightCode 关键词标记', findAll(C7.highlightCode('const x = 1', 'js'), (n) => n.type === 'span' && n.props.className === 'pw-tok-k').length >= 1)
  const csv = C7.parseCsv('a,b\n1,2')
  ok('parseCsv 行列', csv.length === 2 && csv[0][0] === 'a' && csv[1][1] === '2')

  /* CSS 守卫：.pw-tab-x 被预览栏与底部面板共用，任何"裸类名 + opacity:0"规则都会把预览 tab 的 × 永久藏掉（实战踩过） */
  const cssText = readFileSync(new URL('../lib/style.css', import.meta.url), 'utf8')
  ok('css 无裸 .pw-tab-x 隐藏规则', !/^\.pw-tab-x\s*\{[^}]*opacity\s*:\s*0/m.test(cssText))
  ok('css 无 ACP/终端残留', cssText.indexOf('pw-acp') < 0 && cssText.indexOf('pw-term') < 0 && cssText.indexOf('.pw-bpanel') < 0 && cssText.indexOf('.xterm') < 0)

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

  const I5 = loadPart(['05-icons.js', '14-footicons.js'], ['LayersIcon'])
  ok('LayersIcon 结构', findAll(I5.LayersIcon(12), (n) => n.type === 'path').length === 3)

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

  /* ---------- chat 文件点击接管（15-deliv，v1.21.1–）路径解析 ----------
   * v1.22.0 起产物面板与事件窗口订阅整体移除，只保留点击接管；此处单测路径反解。 */
  {
    const D9 = loadPart(['01-stores.js', '03-tree.js', '06-misc.js', '12-mdpath.js', '15-deliv.js'], ['delivAbsPath'])
    ok('deliv 相对路径按 cwd 解析', D9.delivAbsPath('/ws', 'r/a.md') === '/ws/r/a.md' && D9.delivAbsPath('/ws', '/abs/a.md') === '/abs/a.md' && D9.delivAbsPath(null, 'r/a.md') === 'r/a.md' && D9.delivAbsPath('/ws', '~/x.md') === '~/x.md')
  }

  /* ---------- chat 产出文件 chip / 工具卡文件链接 点击接管（v1.21.1–）----------
   * 平台 openFile 走 openWorkspacePath（系统默认应用外部打开）；document capture
   * 拦普通左键改道应用内预览。覆盖：产出 chip（title=完整路径）+ 工具卡 fileLink
   * 按钮（文本=摘要路径，反解按 sessionCwd；~ 摘要放行）；修饰键/「显示文件夹」/
   * 已处理事件放行，重装幂等。 */
  {
    const hookSrc = ['01-stores.js', '03-tree.js', '06-misc.js', '12-mdpath.js', '15-deliv.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    const docL = []
    const fakeWin3 = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
    const fakeDoc3 = {
      addEventListener: (t2, f, cap) => docL.push([t2, f, cap]),
      removeEventListener: (t2, f) => {
        const i = docL.findIndex((x) => x[1] === f)
        i >= 0 && docL.splice(i, 1)
      },
    }
    const HK = new Function('React', 'API', 'window', 'document', hookSrc + '\nreturn { sessionProbe, sessionCwd, store, installDelivChipHook }')(
      fakeReact, '/__dsh-geek-sidebar__', fakeWin3, fakeDoc3,
    )
    HK.installDelivChipHook()
    ok('chip 接管 capture 监听已装', docL.length === 1 && docL[0][0] === 'click' && docL[0][2] === true)
    HK.installDelivChipHook()
    ok('chip 接管重装幂等（HMR 摘旧闭包）', docL.length === 1)
    HK.sessionProbe.set('ck1')
    HK.sessionCwd.sid = 'ck1'
    HK.sessionCwd.cwd = '/ws'
    const CHIP_SEL = 'div[data-produced-files-row] button[title]'
    const LINK_SEL = 'div[data-variant] [class*="fileLink"]'
    /* hit: {chip: title路径} 或 {link: 摘要文本} 或 {}（不命中任何选择器） */
    const mkEv = (hit, mods) => ({
      button: 0, defaultPrevented: false,
      metaKey: !!(mods && mods.meta), ctrlKey: !!(mods && mods.ctrl), shiftKey: !!(mods && mods.shift), altKey: false,
      target: {
        closest: (s) => {
          if (s === CHIP_SEL) return hit.chip !== undefined ? { getAttribute: (k) => (k === 'title' ? hit.chip : null) } : null
          if (s === LINK_SEL) return hit.link !== undefined ? { textContent: hit.link } : null
          return null
        },
      },
      pd: false, sp: false,
      preventDefault() { this.pd = true },
      stopPropagation() { this.sp = true },
    })
    const h = docL[0][1]
    const e1 = mkEv({ chip: 'out/r.md' })
    h(e1)
    ok('chip 普通左键拦截改道应用内预览', e1.pd && e1.sp && HK.store.bucket('ck1').active === '/ws/out/r.md')
    const e2 = mkEv({ chip: 'out/r.md' }, { meta: true })
    h(e2)
    ok('chip 修饰键点击放行系统打开', !e2.pd && !e2.sp)
    const e3 = mkEv({ chip: '.' })
    h(e3)
    ok('chip 「显示文件夹」(title=.) 放行外部', !e3.pd && !e3.sp)
    const e3b = mkEv({ chip: '~/x/y.md' })
    h(e3b)
    ok('chip ~ 路径放行外部（与工具卡链接同规）', !e3b.pd && !e3b.sp)
    const e4 = mkEv({ chip: 'x.md' })
    e4.defaultPrevented = true
    h(e4)
    ok('chip 已被先行处理的事件放行', !e4.pd && !e4.sp)
    const e5 = mkEv({ chip: null })
    h(e5)
    ok('chip 无 title 路径不拦', !e5.pd && !e5.sp)
    const e6 = { button: 2, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => ({ getAttribute: () => 'y.md', textContent: 'y.md' }) }, pd: false, preventDefault() { this.pd = true }, stopPropagation() { this.sp = true } }
    h(e6)
    ok('chip 非左键不拦', !e6.pd && !e6.sp)
    /* 工具卡文件链接（read/write/edit 行摘要按钮，v1.21.2） */
    const e7 = mkEv({ link: ' parts/src/a.ts ' })
    h(e7)
    ok('工具卡文件链接拦截改道预览（摘要文本反解按 cwd）', e7.pd && e7.sp && HK.store.bucket('ck1').active === '/ws/parts/src/a.ts')
    const e8 = mkEv({ link: '~/notes/x.md' })
    h(e8)
    ok('工具卡 ~ 摘要放行外部（客户端无宿主 home 不反解）', !e8.pd && !e8.sp)
    const e9 = mkEv({})
    h(e9)
    ok('非文件点击不拦', !e9.pd && !e9.sp)
  }

  /* ---------- DirPicker 无头驱动（1.19.11：三处路径选择统一的应用内目录选择模态） ----------
   * 纯状态机 store + Promise 桥（签名对齐平台 pickDirectory）；组件随 bus 重渲染。
   * 01-stores 供 bus，05-icons 供 ic/FolderIcon，host 桩替 /wb/listDir。 */
  {
    const listDirLog = []
    const prefsStub = { pickerDir: null }
    const hostStub3 = {
      call: (m2, args) => {
        listDirLog.push([m2, args])
        /* 默认目录偏好桩（1.19.12）：桌面回落 '/desk' */
        if (m2 === 'workbench.prefsGet') return Promise.resolve({ pickerDir: prefsStub.pickerDir || '/desk', custom: !!prefsStub.pickerDir })
        if (m2 === 'workbench.prefsSet') {
          prefsStub.pickerDir = (args && args.pickerDir) || null
          return Promise.resolve({ ok: true, pickerDir: prefsStub.pickerDir || '/desk', custom: !!prefsStub.pickerDir })
        }
        if (m2 !== 'workbench.listDir') return Promise.resolve({})
        const p = String((args && args.path) || '/home')
        if (p === '/bad') return Promise.resolve({ entries: [], error: 'directory-unreadable' })
        return Promise.resolve({
          path: p,
          parent: p === '/' ? null : '/parent',
          entries: [
            { name: 'sub', type: 'directory', path: p + '/sub', hidden: false },
            { name: '.hid', type: 'directory', path: p + '/.hid', hidden: true },
            { name: 'f.txt', type: 'file', path: p + '/f.txt', hidden: false },
          ],
        })
      },
    }
    const dSrc = ['01-stores.js', '05-icons.js', '15-dirpicker.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    const DP = new Function('React', 'host', dSrc + '\nreturn { dirPicker, pickDir, DirPickerHost }')(fakeReact, hostStub3)
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
    try {
      ok('ui DirPicker 关闭态渲染 null', DP.DirPickerHost() === null)
      const pr1 = DP.pickDir({ title: '选目录测试', initialPath: '/init' })
      ok('ui pickDir 打开进入加载态', !!DP.dirPicker.req && DP.dirPicker.loading === true)
      await flush()
      ok('ui 导航落定（path/parent/仅目录含隐藏）', DP.dirPicker.path === '/init' && DP.dirPicker.parent === '/parent' && DP.dirPicker.loading === false
        && DP.dirPicker.entries.length === 2 && DP.dirPicker.entries.every((x) => x.type === 'directory'))
      const dv = DP.DirPickerHost()
      ok('ui DirPicker 渲染模态结构', findAll(dv, (n) => String(n.props && n.props.className) === 'pw-dpk-mask').length === 1
        && findAll(dv, (n) => n.type === 'input' && n.props.value === '/init').length === 1
        && findAll(dv, (n) => String(n.props && n.props.className) === 'pw-dpk-title' && n.children[0] === '选目录测试').length === 1
        && findAll(dv, (n) => String(n.props && n.props.className) === 'pw-dpk-row').length === 2)
      ok('ui 选择钮就绪（输入框未脏）', findAll(dv, (n) => String(n.props && n.props.className) === 'pw-dpk-ok' && !n.props.disabled).length === 1)
      /* 输入框脏 → 禁用选择（对齐 pi-web：先打开再选，防误选旧目录） */
      DP.dirPicker.input = '/elsewhere'
      const dvDirty = DP.DirPickerHost()
      ok('ui 输入框脏禁用选择钮', findAll(dvDirty, (n) => String(n.props && n.props.className) === 'pw-dpk-ok' && n.props.disabled === true).length === 1)
      DP.dirPicker.input = '/init'
      /* 行点击导航到子目录 */
      findAll(dv, (n) => String(n.props && n.props.className) === 'pw-dpk-row')[0].props.onClick()
      await flush()
      ok('ui 点行进子目录', DP.dirPicker.path === '/init/sub' && listDirLog.some((x) => x[1] && x[1].path === '/init/sub'))
      /* 上级按钮 */
      const dv2 = DP.DirPickerHost()
      findAll(dv2, (n) => String(n.props && n.props.className) === 'pw-dpk-up')[0].props.onClick()
      await flush()
      ok('ui 上级钮回 parent', DP.dirPicker.path === '/parent')
      /* 不可读目录：错误内联、停留原位 */
      DP.dirPicker.nav('/bad')
      await flush()
      ok('ui 不可读目录内联报错停留原位', DP.dirPicker.error === 'directory-unreadable' && DP.dirPicker.path === '/parent')
      const dvErr = DP.DirPickerHost()
      ok('ui 错误条渲染', findAll(dvErr, (n) => String(n.props && n.props.className) === 'pw-dpk-err' && n.children[0] === 'directory-unreadable').length === 1)
      DP.dirPicker.settle(true)
      ok('ui commit 结算当前路径', (await pr1) === '/parent' && DP.dirPicker.req === null)
      /* 取消 → null；在途回包被代际守卫丢弃（open 已重置 path，若回包生效会被写成 /slow） */
      const pr2 = DP.pickDir({ initialPath: '/slow' })
      DP.dirPicker.settle(false)
      await flush()
      ok('ui 取消结算 null 且在途回包不写态', (await pr2) === null && DP.dirPicker.req === null && DP.dirPicker.path !== '/slow')
      /* 默认目录（1.19.12）：无 initialPath 首开先拉偏好，落 host 回落的桌面 '/desk' */
      const pr3 = DP.pickDir({})
      await flush()
      ok('ui 无 initialPath 落默认目录（桌面回落）', DP.dirPicker.path === '/desk' && DP.dirPicker.defCustom === false)
      DP.dirPicker.settle(false)
      await pr3
      /* 二次打开偏好已常驻（不再调 prefsGet） */
      const prefCalls = listDirLog.filter((x) => x[0] === 'workbench.prefsGet').length
      const pr4 = DP.pickDir({})
      await flush()
      ok('ui 二次打开复用常驻偏好', DP.dirPicker.path === '/desk' && listDirLog.filter((x) => x[0] === 'workbench.prefsGet').length === prefCalls)
      /* 星钮三态：非默认「设为默认」→ 点击设自定义「默认目录 on」→ 再点清除回桌面回落（禁用展示） */
      DP.dirPicker.nav('/init')
      await flush()
      const dvS1 = DP.DirPickerHost()
      const star1 = findAll(dvS1, (n) => String(n.props && n.props.className) === 'pw-dpk-star')[0]
      ok('ui 星钮非默认态（设为默认）', !!star1 && !star1.props.disabled && star1.children[star1.children.length - 1] === '设为默认')
      star1.props.onClick()
      await flush()
      ok('ui 设为默认后自定义生效', DP.dirPicker.defCustom === true && DP.dirPicker.defDir === '/init')
      const dvS2 = DP.DirPickerHost()
      const star2 = findAll(dvS2, (n) => String(n.props && n.props.className) === 'pw-dpk-star on')[0]
      ok('ui 星钮自定义默认态（on）', !!star2 && !star2.props.disabled && star2.children[star2.children.length - 1] === '默认目录')
      star2.props.onClick()
      await flush()
      ok('ui 再点星钮清除回桌面回落', DP.dirPicker.defCustom === false && DP.dirPicker.defDir === '/desk')
      DP.dirPicker.nav('/desk')
      await flush()
      const dvS3 = DP.DirPickerHost()
      ok('ui 桌面回落态星钮 on 且禁用', findAll(dvS3, (n) => String(n.props && n.props.className) === 'pw-dpk-star on' && n.props.disabled === true).length === 1)
      DP.dirPicker.settle(false)
      await pr4
      DP.DirPickerHost() /* 关闭后再渲染不炸 */
    } catch (e) {
      ok('ui DirPicker 无头驱动', false, String((e && e.stack) || e))
    }
  }
  ok('css DirPicker 样式就位', cssText.indexOf('.pw-dpk-panel') >= 0 && cssText.indexOf('.pw-dpk-ok') >= 0 && cssText.indexOf('.pw-dpk-star') >= 0)
  ok('css 便签样式就位', cssText.indexOf('.pw-qn-bubble') >= 0 && cssText.indexOf('.pw-qn-drawer') >= 0 && cssText.indexOf('.pw-qn-side-item') >= 0)

  /* ---------- FootBar/store/便签 UI 无头驱动：渲染期回归防线 ----------
   * node --check 只查语法，必须用 fakeReact 真渲染一遍。 */
  {
    const uiSrc = ['00-header.js', '01-stores.js', '06-misc.js', '05-icons.js', '14-footicons.js', '15-quicknotes.js', '04-footbar.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    const UI = new Function('React', 'host', uiSrc + '\nreturn { FootBar, store, qnStore, qnSummarize }')(
      fakeReact,
      { call: () => Promise.resolve({ ok: true }) },
    )
    let uiErr = ''
    try {
      const fb = UI.FootBar({ wide: true, onSkills() {} })
      ok('ui FootBar 渲染（技能/便签两钮）', findAll(fb, (n) => n.type === 'button').length === 2)
      ok('ui FootBar 便签钮', findAll(fb, (n) => n.children && n.children[n.children.length - 1] === '便签').length === 1)
      /* store.open：重复打开同一文件也必须激活对应 tab（评审 P2 回归防线） */
      UI.store.open('s1', { path: '/a.md', name: 'a.md' })
      UI.store.open('s1', { path: '/b.md', name: 'b.md' })
      UI.store.open('s1', { path: '/a.md', name: 'a.md' })
      const bk = UI.store.bucket('s1')
      ok('ui store.open 重复打开激活既有 tab', bk.files.length === 2 && bk.active === '/a.md')

      /* 便签小胶囊智能摘要切词测试 */
      ok('qnSummarize 短文本直出', UI.qnSummarize('短文本') === '短文本')
      const longCjk = '这是一个非常长的中文段落，用来测试智能摘要提取首尾词并用省略号连接的胶囊紧凑显示能力，确保输入框不被长文本刷屏。'
      const sumCjk = UI.qnSummarize(longCjk, 3, 20)
      ok('qnSummarize 中文首尾摘要', sumCjk.includes(' … ') && sumCjk.length < longCjk.length)
      const longEn = 'The quick brown fox jumps over the lazy dog and runs across the wide open green meadow under the blue sky.'
      const sumEn = UI.qnSummarize(longEn, 3, 30)
      ok('qnSummarize 英文词切分首尾摘要', sumEn.includes(' … ') && sumEn.length < longEn.length)
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
    const fakeWin = { addEventListener: onL, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
    const fakeDoc = { addEventListener: onL, removeEventListener() {}, visibilityState: 'visible' }
    const dSrc = ['00-header.js', '01-stores.js', '02-markdown.js', '03-tree.js', '05-icons.js', '06-misc.js', '07-code-csv.js', '10-panels.js', '11-details.js', '12-mdpath.js']
      .map((f) => readFileSync(new URL('./workbench/' + f, import.meta.url), 'utf8'))
      .join('\n')
    const D2 = new Function('React', 'API', 'host', 'window', 'document', dSrc + '\nreturn { Details, store, sessionProbe, panelStore }')(
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

      /* ---------- Details 预览缩放（⤢）结构级回归防线 ----------
       * useState 位序：a / usePreviewState / u / k / y / C / T / L / ed2 / dr2 / sv2 / zm（idx11）。 */
      D2.sessionProbe.set('dz1')
      D2.store.open('dz1', { path: '/d/z.md', name: 'z.md' })
      /* 右栏默认态：缩放钮出场、无遮罩、root 无 zoomed class */
      fakeReact.__resetRefs()
      let tree = D2.Details({ layout: null })
      ok('ui Details 右栏模式渲染缩放钮', findAll(tree, (n) => n.props && n.props.title === '放大预览').length === 1)
      ok('ui Details 未缩放无遮罩', findAll(tree, (n) => n.props && n.props.className === 'pw-zoomview-mask').length === 0)
      /* drawer 模式（inDrawer）：缩放钮不出场 */
      fakeReact.__resetRefs()
      tree = D2.Details({ layout: null, inDrawer: true })
      ok('ui Details drawer 模式不渲染缩放钮',
        findAll(tree, (n) => n.props && (n.props.title === '放大预览' || n.props.title === '收回预览 (Esc)')).length === 0)
      /* zoomed=true（队列 idx11）：遮罩 + root zoomed class + Esc 监听注册 + » 连带 closeDetails */
      const closeLog = []
      const layoutStub = { closeDetails: () => closeLog.push('close') }
      fakeReact.__resetRefs()
      mark = uiEffects.length
      uiStateQueue = [0, 0, null, 'auto', '', false, false, false, false, '', false, true]
      tree = D2.Details({ layout: layoutStub })
      uiStateQueue = null
      ok('ui Details 缩放态遮罩出场', findAll(tree, (n) => n.props && n.props.className === 'pw-zoomview-mask').length === 1)
      ok('ui Details 缩放态 root 挂 zoomed class',
        findAll(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.split(' ').includes('zoomed')).length === 1)
      ok('ui Details 缩放态钮面翻转', findAll(tree, (n) => n.props && n.props.title === '收回预览 (Esc)').length === 1)
      const kdBefore = (listeners.keydown || []).length
      for (let i = mark; i < uiEffects.length; i++) uiEffects[i]()
      ok('ui Details 缩放态注册 Esc 监听', (listeners.keydown || []).length === kdBefore + 1)
      const colBtn = findAll(tree, (n) => n.props && n.props.title === '收起右栏')[0]
      colBtn.props.onClick()
      ok('ui Details 缩放态 » 连带 closeDetails', closeLog.length === 1)
      /* v1.22.0：产物面板移除后，Details 头部不再渲染「对话产物与链接」入口（任何模式） */
      fakeReact.__resetRefs()
      tree = D2.Details({ layout: null })
      ok('ui Details 无产物入口钮', findAll(tree, (n) => n.props && n.props.title === '对话产物与链接').length === 0)
    } catch (e) {
      ok('ui Details 预览缩放守卫', false, String((e && e.stack) || e))
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
