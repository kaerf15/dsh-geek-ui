/**
 * dsh-geek-sidebar /wb/*：工作台 host 业务。
 * client 的 host.call("workbench.x") 经 POST /__dsh-geek-sidebar__/wb/x 路由分发，
 * 覆盖目录/文件/git worktree/笔记目录/上传下载；CSS 由 GET /wb/style.css 直出
 * （每请求读包内 lib/style.css，改样式刷新浏览器即生效）。
 *
 * 实现要点：
 *  - 样式不落绝对路径，一律读包内 lib/style.css；
 *  - 跨平台：文件操作走 node:fs；仅 git / 系统选择器 / zip / reveal 经 shell，且按平台分支；
 *  - docx 预览仅 macOS（textutil），其它平台优雅报错。
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, openSync, readSync, closeSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { httpError } from './http.js'

const CSS_URL = new URL('../style.css', import.meta.url)

/* ---------- 跨平台（macOS / Windows / Linux） ---------- */
const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
/* q() 的单引号转义按执行 shell 分平台：POSIX sh 用 '\''（关引-转义-重开）；
 * Windows 上 dsh 的 shell 服务走 pwsh -Command，PowerShell 单引号串里 apostrophe 用 doubling（''）。
 * 混用会在含撇号路径（如 C:\Users\O'Brien\proj）上直接解析失败。 */
const q = (e) => IS_WIN
  ? "'" + String(e).replace(/'/g, "''") + "'"
  : "'" + String(e).replace(/'/g, "'\\''") + "'"
const dq = (s) => '"' + String(s).replace(/"/g, '\\"') + '"'
const isAbs = (p) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)
const expandHome = (p) => (p === '~' ? homedir() : p.startsWith('~/') || p.startsWith('~\\') ? homedir() + p.slice(1) : p)
const baseName = (p) => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ''

/* 只读文件前 max 字节（替代 head -c） */
function readHeadSync(p, max) {
  const fd = openSync(p, 'r')
  try {
    const buf = Buffer.alloc(max)
    const n = readSync(fd, buf, 0, max, 0)
    return buf.subarray(0, n).toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/* 回收站目录：macOS ~/.Trash；Linux XDG；Windows 无跨盘统一回收 API，用应用级 ~/.dsh/Trash */
function trashDir() {
  if (IS_WIN) return join(homedir(), '.dsh', 'Trash')
  if (IS_MAC) return join(homedir(), '.Trash')
  return join(homedir(), '.local', 'share', 'Trash', 'files')
}

/* 统一移动：把 src 迁入 destDir（调用方保证 destDir 已存在且为目录）。
 * 目标同名自动加时间戳后缀；rename 跨盘失败则 cpSync + rmSync 兜底。
 * /wb/delete、/wb/move、/wb/qnDelete、/wb/qnMoveToKb、/wb/qnMoveToProject 共用，消除重复。 */
function moveEntrySync(src, destDir) {
  const name = baseName(src) || 'unnamed'
  let dest = join(destDir, name)
  if (existsSync(dest)) {
    const dot = name.lastIndexOf('.')
    dest = join(destDir, dot > 0 ? name.slice(0, dot) + '-' + Date.now() + name.slice(dot) : name + '-' + Date.now())
  }
  try {
    renameSync(src, dest)
  } catch {
    cpSync(src, dest, { recursive: true })
    rmSync(src, { recursive: true, force: true })
  }
  return dest
}

/* ---------- 会话持久化路径（对齐 @deepseek-ai/dsh-session-persistence-jsonl/format） ----------
 * JSONL 会话后端把会话落在 <DSH_HOME>/sessions/<projectKey(cwd)>/<encodeSegment(id)>/；此处
 * 逐字复刻该 format.ts 的 encodeSegment / projectKey（dsh 0.1.2-rc.1 锁定），供 /wb/sessionPath
 * 计算“会话所在文件夹”的绝对路径（客户端复制后跳转/引用）。 */
function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    out += ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch) ? ch : '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}
function projectKey(cwd) {
  if (cwd.length === 0) throw new Error('cannot encode an empty project path')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return '--' + slug.slice(0, 251) + '--'
}
/* 对齐 util/home-paths 的 resolveDshHome：$DSH_HOME（非空）优先，否则 ~/.dsh。 */
function resolveDshHome() {
  const env = process.env.DSH_HOME
  const selected = env !== undefined && env.trim().length > 0 ? env : join(homedir(), '.dsh')
  return resolve(expandHome(selected))
}
/* 会话所在文件夹的绝对路径；cwd 缺失时归入 _no-cwd 桶（与 projectDir 一致）。 */
function sessionDirPath(cwd, id) {
  const root = join(resolveDshHome(), 'sessions')
  const proj = cwd == null || cwd === '' ? join(root, '_no-cwd') : join(root, projectKey(cwd))
  return join(proj, encodeSegment(String(id)))
}

/* 文件夹选择器：macOS osascript / Windows PowerShell FolderBrowserDialog / Linux zenity */
function pickFolderCmd(prompt) {
  if (IS_MAC) return 'osascript -e ' + q('POSIX path of (choose folder with prompt "' + prompt + '")')
  if (IS_WIN)
    return (
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; ' +
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '" + prompt + "'; " +
      "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }\""
    )
  return 'zenity --file-selection --directory --title=' + q(prompt)
}

/* 多选文件选择器：macOS osascript / Windows OpenFileDialog / Linux zenity */
function pickFilesCmd(prompt) {
  if (IS_MAC)
    return (
      'osascript -e ' + q('set fs to choose file with prompt "' + prompt + '" with multiple selections allowed') +
      ' -e ' + q('set out to ""') +
      ' -e ' + q('repeat with f in fs') +
      ' -e ' + q('set out to out & POSIX path of f & linefeed') +
      ' -e ' + q('end repeat') +
      ' -e ' + q('return out')
    )
  if (IS_WIN)
    return (
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; ' +
      "$d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = '" + prompt + "'; $d.Multiselect = $true; " +
      "if ($d.ShowDialog() -eq 'OK') { $d.FileNames -join [Environment]::NewLine }\""
    )
  return 'zenity --file-selection --multiple --separator=' + q('\n') + ' --title=' + q(prompt)
}

/* 打包目录为 zip：macOS ditto / Windows Compress-Archive / Linux zip */
function zipDirCmd(src, dest) {
  if (IS_WIN) return 'powershell -NoProfile -Command "Compress-Archive -LiteralPath ' + dq(src).replace(/"/g, '""') + ' -DestinationPath ' + dq(dest).replace(/"/g, '""') + ' -Force"'
  if (IS_MAC) return 'ditto -c -k --sequesterRsrc ' + q(src) + ' ' + q(dest)
  return 'cd ' + q(src) + ' && zip -q -r ' + q(dest) + ' .'
}

/* 在系统文件管理器中显示：macOS open / Windows explorer / Linux xdg-open */
function revealCmd(p) {
  if (IS_WIN) return 'explorer ' + dq(p)
  if (IS_MAC) return 'open ' + q(p)
  return 'xdg-open ' + q(p)
}

/* 可调参数默认值（index.js 的 Config schema 与 smoke 共用同一来源） */
export const WORKBENCH_DEFAULTS = {
  textMaxKB: 512,       // readFile 文本上限
  rawMaxMB: 20,         // /wb/raw 文件流上限
  writeMaxMB: 1,        // writeFile 写入上限
  notesMaxDirs: 8,      // 笔记目录历史上限
  gitCacheTtlSec: 60,  // git 项目映射缓存 TTL
  treeWatch: true,     // 文件树目录监视（项目/知识库增删改后抬 stamp）
  treeWatchDebounceMs: 200, // 监视事件合并窗口
  treeWaitMs: 25000,   // treeWait 最长挂起
  treeWatchMaxDirs: 64, // 同时监视的目录上限（根 + 已展开）
  quickNotesDir: '',    // 便签目录固定覆盖（空 = 用户偏好或 ~/.dsh/quick-notes）
  quickNotesCapture: true, // 划选采集气泡总开关（经 qnState 下发给 client）
  quickNotesMax: 500,   // 便签目录扫描条数上限
  qnPrefsFile: null,    // 便签目录偏好文件（默认 ~/.dsh/workbench-quicknotes.json；smoke 注入临时路径）
  prefsFile: null,      // DirPicker 偏好文件（默认 ~/.dsh/workbench-prefs.json；smoke 注入临时路径）
}

export function workbenchApi(ctx, cfg) {
  const C = Object.assign({}, WORKBENCH_DEFAULTS, cfg)
  const fss = ctx.get('fs')
  const shell = ctx.get('shell')


  const stdoutOf = (e) => (e.stdout && e.stdout.text) || ''
  const errOf = (e) => ((e.stderr && e.stderr.text) || (e.stdout && e.stdout.text) || '').trim()
  const msgOf = (e) => String(e && e.message ? e.message : e)
  const samePath = (a, b) => a === b || String(a).toLowerCase() === String(b).toLowerCase()
  /* 跨平台父目录（唯一实现）：POSIX 根 / Windows 盘符根（C:\）的父为 null；尾分隔符先剥。
   * git 路径与 /wb/listDir 的 DirPicker 面包屑共用——git 即使在 Windows 也输出正斜杠
   * 绝对路径，两种分隔符全认是其超集；git 侧入参恒为非根绝对路径，与原 POSIX 版等价。 */
  const parentOf = (p) => {
    const t = String(p).replace(/[\\/]+$/, '')
    if (!t || t === '/' || /^[A-Za-z]:$/.test(t)) return null
    const i = Math.max(t.lastIndexOf('/'), t.lastIndexOf('\\'))
    if (i < 0) return null
    if (i === 0) return '/'
    if (i === 2 && /^[A-Za-z]:/.test(t)) return t.slice(0, 3)
    return t.slice(0, i)
  }

  async function run(command, timeoutMs) {
    if (!shell) throw new Error('shell unavailable')
    return shell.run(shell.resolve({ command, timeoutMs: timeoutMs || 1e4, env: { LC_ALL: 'C' } }))
  }
  async function git(cwd, args) {
    const r = await run('git -C ' + q(cwd) + ' ' + args.map(q).join(' '), 1e4)
    if (r.exitCode !== 0) {
      const o = errOf(r)
      throw new Error(o || 'git failed')
    }
    return stdoutOf(r).trimEnd()
  }
  async function exists(p) {
    if (!fss) return true
    try {
      return !!(await fss.stat(await fss.resolve(p)))
    } catch {
      return false
    }
  }
  async function realpathOf(p) {
    try {
      return realpathSync(p)
    } catch {
      return p
    }
  }

  /* ---------- git 信息（缓存 TTL 可配，默认 60s） ---------- */
  const gitCache = new Map()
  const TTL = C.gitCacheTtlSec * 1000
  /* 评审修复：缓存加 LRU 上限——key 是客户端任意 cwd 字符串，原先 TTL 只挡命中
   * 不淘汰条目，Map 无界增长（客户端可控的慢速内存泄漏） */
  const GIT_CACHE_MAX = 200
  const gitCacheSet = (k, v) => {
    gitCache.delete(k)
    gitCache.set(k, v)
    while (gitCache.size > GIT_CACHE_MAX) gitCache.delete(gitCache.keys().next().value)
  }
  async function gitInfo(p) {
    const hit = gitCache.get(p)
    if (hit && hit.expiresAt > Date.now()) {
      /* LRU：命中刷新到新近位置 */
      gitCache.delete(p)
      gitCache.set(p, hit)
      return hit.info
    }
    let info
    try {
      if (!(await exists(p))) {
        info = { root: p, branch: null, isWorktree: false, isTopLevel: false, isGit: false }
      } else {
        const s = (await git(p, ['rev-parse', '--path-format=absolute', '--git-common-dir', '--git-dir', '--show-toplevel', '--abbrev-ref', 'HEAD']))
          .split('\n')
          .map((x) => x.trim())
        const commonDir = s[0]
        const gitDir = s[1]
        const topLevel = s[2]
        const branch = s[3]
        const real = await realpathOf(p)
        const isTop = samePath(topLevel, real)
        const isWt = !samePath(gitDir, commonDir) && isTop
        info = {
          root: isTop ? (isWt ? parentOf(commonDir) : topLevel) : p,
          branch: branch && branch !== 'HEAD' ? branch : null,
          isWorktree: isWt,
          isTopLevel: isTop,
          isGit: true,
        }
      }
    } catch {
      info = { root: p, branch: null, isWorktree: false, isTopLevel: false, isGit: false }
    }
    gitCacheSet(p, { info, expiresAt: Date.now() + TTL })
    return info
  }

  async function worktreeList(cwd) {
    const out = await git(cwd, ['worktree', 'list', '--porcelain'])
    const rows = []
    let cur = null
    const flush = () => {
      if (cur && cur.path) rows.push(cur)
      cur = null
    }
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) {
        flush()
        cur = { path: line.slice(9).trim(), branch: null, prunable: false }
      } else if (line.startsWith('branch ') && cur) {
        cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '')
      } else if (line.startsWith('prunable') && cur) {
        cur.prunable = true
      } else if (line.trim() === '') {
        flush()
      }
    }
    flush()
    const alive = []
    for (const wt of rows) {
      if (wt.prunable || !(await exists(wt.path))) continue
      alive.push({ path: wt.path, branch: wt.branch, isMain: alive.length === 0 })
    }
    return alive
  }

  /* ---------- 文件树目录监视（项目根 / 知识库当前目录 + 已展开子目录）
   * 不递归整仓：客户端声明当前列出的目录，host 对各目录 fs.watch（非 recursive）。
   * 目录内增删改/重命名抬 stamp；客户端 treeWait long-poll 后再原地 listDir。
   * 跳过 node_modules/.git 等噪声目录；.DS_Store 事件忽略（macOS 浏览即写）。 */
  const TREE_WATCH_SKIP = new Set(['node_modules', '.git', '.svn', '.hg'])
  const TREE_WATCH_SKIP_FILE = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
  const treeWatchers = new Map()
  const treeWaiters = new Set()
  let treeStamp = 0
  let treeDebounce = null
  const treeWatchEnabled = C.treeWatch !== false
  const treeDebounceMs = Math.max(50, Number(C.treeWatchDebounceMs) || 200)
  const treeWaitDefaultMs = Math.max(0, Number(C.treeWaitMs) || 25000)
  const treeWatchMax = Math.max(1, Number(C.treeWatchMaxDirs) || 64)
  const closeTreeWatcher = (p) => {
    const w = treeWatchers.get(p)
    if (!w) return
    try { w.close() } catch { /* ignore */ }
    treeWatchers.delete(p)
  }
  const closeAllTreeWatches = () => {
    for (const p of [...treeWatchers.keys()]) closeTreeWatcher(p)
  }
  const flushTreeWaiters = () => {
    for (const w of [...treeWaiters]) w.done()
  }
  const bumpTree = () => {
    treeStamp += 1
    flushTreeWaiters()
  }
  const scheduleTreeBump = () => {
    if (treeDebounce) clearTimeout(treeDebounce)
    treeDebounce = setTimeout(() => {
      treeDebounce = null
      bumpTree()
    }, treeDebounceMs)
  }
  const normWatchPath = (p) => {
    const raw = expandHome(String(p || ''))
    if (!raw || !isAbs(raw)) return ''
    const t = raw.replace(/[\\/]+$/, '')
    if (!t) return '/'
    if (/^[A-Za-z]:$/.test(t)) return t + '\\'
    return t
  }
  const skipWatchDir = (p) => TREE_WATCH_SKIP.has(baseName(p))
  const watchOneDir = (p) => {
    if (!treeWatchEnabled || !p || treeWatchers.has(p) || skipWatchDir(p)) return
    if (treeWatchers.size >= treeWatchMax) return
    try {
      if (!existsSync(p) || !statSync(p).isDirectory()) return
      const w = watch(p, { persistent: true }, (_event, filename) => {
        const name = filename == null ? '' : String(filename)
        if (name && (TREE_WATCH_SKIP_FILE.has(name) || TREE_WATCH_SKIP.has(name))) return
        scheduleTreeBump()
      })
      w.on('error', () => closeTreeWatcher(p))
      treeWatchers.set(p, w)
    } catch { /* 目录已删/无权限：跳过 */ }
  }
  const syncTreeWatches = (dirs) => {
    const want = []
    const seen = new Set()
    for (const raw of dirs) {
      const p = normWatchPath(raw)
      if (!p || seen.has(p) || skipWatchDir(p)) continue
      seen.add(p)
      want.push(p)
      if (want.length >= treeWatchMax) break
    }
    const wantSet = new Set(want)
    for (const p of [...treeWatchers.keys()]) {
      if (!wantSet.has(p)) closeTreeWatcher(p)
    }
    for (const p of want) watchOneDir(p)
    return { stamp: treeStamp, watching: treeWatchEnabled, dirs: [...treeWatchers.keys()] }
  }
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      if (treeDebounce) clearTimeout(treeDebounce)
      closeAllTreeWatches()
      flushTreeWaiters()
    })
  }

  /* ---------- 笔记目录偏好（~/.dsh/workbench-notes.json，node:fs 直读写） ---------- */
  const NOTES_PATH = join(homedir(), '.dsh', 'workbench-notes.json')
  async function notesRead() {
    try {
      const j = JSON.parse(readFileSync(NOTES_PATH, 'utf8'))
      let dirs = j && j.dirs && Array.isArray(j.dirs) ? j.dirs.map(String).filter(Boolean) : []
      let current = j && j.current ? String(j.current) : null
      if (dirs.length === 0 && j && j.dir) {
        dirs = [String(j.dir)]
        current = String(j.dir)
      }
      if (current && dirs.indexOf(current) < 0) dirs.unshift(current)
      return { dirs, current }
    } catch {
      return { dirs: [], current: null }
    }
  }
  async function notesWrite(dirs, current) {
    mkdirSync(join(homedir(), '.dsh'), { recursive: true })
    writeFileSync(NOTES_PATH, JSON.stringify({ dirs, current }), 'utf8')
  }
  async function notesTouch(dir) {
    const cur = await notesRead()
    const lower = dir.toLowerCase()
    cur.dirs = cur.dirs.filter((d) => d.toLowerCase() !== lower)
    cur.dirs.unshift(dir)
    if (cur.dirs.length > C.notesMaxDirs) cur.dirs.length = C.notesMaxDirs
    cur.current = dir
    await notesWrite(cur.dirs, cur.current)
    return cur
  }

  /* ---------- 便签（quick notes）：平铺 .md 目录，全局池不绑会话 ----------
   * 每条便签一个 .md 文件：标题即文件名，mtime 即更新时间，零元数据——agent 用
   * 文件工具可直接读写（闭环红利），「转存知识库」就是跨目录 move。
   * 目录三级来源：Config.quickNotesDir（部署固定） > 用户 UI 选择（qnPrefsFile 持久化） > 默认 ~/.dsh/quick-notes。
   * 便签一律以 name（basename + .md 白名单）定位，host 不接受任何便签绝对路径。 */
  const qnPrefsPath = () => C.qnPrefsFile || join(homedir(), '.dsh', 'workbench-quicknotes.json')
  const qnDefaultDir = () => (C.quickNotesDir ? expandHome(C.quickNotesDir).replace(/[\\/]+$/, '') : join(homedir(), '.dsh', 'quick-notes'))
  async function qnPrefsRead() {
    try {
      const j = JSON.parse(readFileSync(qnPrefsPath(), 'utf8'))
      return { dir: j && j.dir ? String(j.dir) : null }
    } catch {
      return { dir: null }
    }
  }
  /* 有效便签目录（纯计算，不建目录；建目录发生在 list/create 写路径） */
  async function qnDir() {
    const p = await qnPrefsRead()
    return p.dir || qnDefaultDir()
  }
  /* name 白名单：纯 basename + .md 后缀，拒一切分隔符/父级跳跃 */
  function qnSafeName(raw) {
    const n = String(raw || '').trim()
    if (!n || n !== baseName(n) || n === '.' || n === '..') return null
    if (!/\.md$/i.test(n)) return null
    return n
  }
  /* 标题 → 文件名主干：剥路径分隔符 / Windows 禁字 / 控制字符，截 48 字符；空回落「未命名便签」 */
  function qnSlug(title) {
    const s = String(title || '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '').trim().slice(0, 48)
    return s || '未命名便签'
  }
  /* 目录内不重名的可用文件名：slug.md 被占则 slug-2.md、slug-3.md… */
  function qnFreeName(dir, title) {
    const base = qnSlug(title)
    let name = base + '.md'
    for (let i = 2; existsSync(join(dir, name)); i++) name = base + '-' + i + '.md'
    return name
  }
  /* 首个非空行做列表预览（剥 markdown 标题记号，截 80 字符） */
  function qnPreviewOf(text) {
    const line = String(text).split('\n').find((l) => l.trim() !== '') || ''
    const t = line.trim().replace(/^#+\s*/, '')
    return t.length > 80 ? t.slice(0, 80) + '…' : t
  }
  async function qnListNotes(qRaw) {
    const dir = await qnDir()
    mkdirSync(dir, { recursive: true })
    const query = String(qRaw || '').trim().toLowerCase()
    const files = readdirSync(dir, { withFileTypes: true })
      .filter((ent) => ent.isFile() && /\.md$/i.test(ent.name))
      .slice(0, C.quickNotesMax)
    const notes = []
    for (const ent of files) {
      const p = join(dir, ent.name)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.size > C.textMaxKB * 1024) continue
      const text = readHeadSync(p, Math.min(st.size, 64 * 1024))
      const title = ent.name.replace(/\.md$/i, '')
      if (query && !(title.toLowerCase().includes(query) || text.toLowerCase().includes(query))) continue
      notes.push({ name: ent.name, title, preview: qnPreviewOf(text), mtime: Math.round(st.mtimeMs), size: st.size })
    }
    notes.sort((a, b) => b.mtime - a.mtime)
    return notes
  }

  /* ---------- DirPicker 默认打开目录偏好（1.19.12）：未自定义时回落桌面（无桌面再回落 home）。
   * 与笔记偏好分文件：notes 是历史列表语义，prefs 是单向键值，混写会互相覆盖 ---------- */
  const prefsPath = () => C.prefsFile || join(homedir(), '.dsh', 'workbench-prefs.json')
  const desktopDir = () => {
    const d = join(homedir(), 'Desktop')
    try {
      return statSync(d).isDirectory() ? d : homedir()
    } catch {
      return homedir()
    }
  }
  async function prefsRead() {
    try {
      const j = JSON.parse(readFileSync(prefsPath(), 'utf8'))
      return { pickerDir: j && j.pickerDir ? String(j.pickerDir) : null }
    } catch {
      return { pickerDir: null }
    }
  }
  const prefsOut = async () => {
    const j = await prefsRead()
    /* 自愈合：自定义目录已被删/不可读时静默回落桌面，custom 跟随"生效值是否来自自定义" */
    if (j.pickerDir) {
      try {
        if (statSync(j.pickerDir).isDirectory()) return { pickerDir: j.pickerDir, custom: true }
      } catch { /* fall through */ }
    }
    return { pickerDir: desktopDir(), custom: false }
  }

  return {
    /* ---------- git 项目映射 / worktree ---------- */
    'POST /wb/projectMap': async ({ body }) => {
      const cwds = (body && body.cwds) || []
      if (body && body.force) gitCache.clear()
      const map = {}
      const seen = {}
      const uniq = []
      for (const c of cwds) {
        const a = String(c || '')
        if (a && !seen[a]) {
          seen[a] = true
          uniq.push(a)
        }
      }
      for (const a of uniq.slice(0, 60)) map[a] = await gitInfo(a)
      return { map }
    },

    'POST /wb/worktrees': async ({ body }) => {
      const p = String((body && body.path) || '')
      if (!p) return { forPath: p, isGit: false, isTopLevel: false, projectRoot: '', currentWorktreePath: null, worktrees: [] }
      if (body && body.force) gitCache.clear()
      const info = await gitInfo(p)
      let wts = []
      let current = null
      if (info.isGit) {
        try {
          wts = await worktreeList((await exists(p)) ? p : info.root)
          const real = await realpathOf(p)
          const hit = wts.find((w) => samePath(w.path, real))
          current = hit ? hit.path : null
        } catch {
          return { forPath: p, isGit: false, isTopLevel: false, projectRoot: info.root, currentWorktreePath: null, worktrees: [] }
        }
      }
      return { forPath: p, isGit: info.isGit, isTopLevel: info.isTopLevel, projectRoot: info.root, currentWorktreePath: current, worktrees: wts }
    },

    'POST /wb/worktreeAdd': async ({ body }) => {
      try {
        const raw = String(body.branch || '').trim()
        if (!raw) return { ok: false, error: '分支名不能为空' }
        const slug = raw.replace(/[\/\\:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
        if (!slug) return { ok: false, error: '无效分支名：' + raw }
        const commonDir = await git(String(body.cwd || ''), ['rev-parse', '--path-format=absolute', '--git-common-dir'])
        const root = parentOf(commonDir)
        const base = root + '-worktrees'
        const dest = base + '/' + slug
        if (await exists(dest)) return { ok: false, error: '目录已存在：' + dest }
        mkdirSync(base, { recursive: true })
        let hasBranch = false
        try {
          hasBranch = (await run('git -C ' + q(root) + ' rev-parse --verify --quiet ' + q('refs/heads/' + raw), 5e3)).exitCode === 0
        } catch {
          hasBranch = false
        }
        if (hasBranch) await git(root, ['worktree', 'add', '--', dest, raw])
        else await git(root, ['worktree', 'add', '-b', raw, '--', dest])
        gitCache.clear()
        return { ok: true, path: dest, branch: raw }
      } catch (e) {
        return { ok: false, error: msgOf(e) }
      }
    },

    'POST /wb/worktreeRemove': async ({ body }) => {
      try {
        const target = String(body.path || '')
        const force = !!body.force
        const wts = await worktreeList(String(body.cwd || ''))
        const real = await realpathOf(target)
        const hit = wts.find((w) => samePath(w.path, real) || samePath(w.path, target))
        if (!hit) return { ok: false, error: '不是该仓库的 worktree：' + target }
        if (hit.isMain) return { ok: false, error: '不能删除主 worktree' }
        await git(String(body.cwd || ''), ['worktree', 'remove'].concat(force ? ['--force'] : []).concat([hit.path]))
        gitCache.clear()
        return { ok: true }
      } catch (e) {
        return { ok: false, error: msgOf(e) }
      }
    },

    /* ---------- 上传 / 目录列举 / 文件读取 ---------- */
    'POST /wb/uploadPick': async ({ body }) => {
      if (!shell) return { ok: false, error: 'shell unavailable' }
      const destDir = String((body && body.destDir) || '')
      if (!destDir) return { ok: false, error: 'no destDir' }
      const r = await run(pickFilesCmd('选择要上传的文件'), 12e4)
      if (r.exitCode !== 0) {
        const o = errOf(r)
        return /canceled/i.test(o) ? { ok: false, canceled: true } : { ok: false, error: o || 'picker failed' }
      }
      const picked = stdoutOf(r).split('\n').map((x) => x.trim()).filter(Boolean)
      const done = []
      for (const src of picked) {
        const name = baseName(src)
        if (!name) continue
        try {
          copyFileSync(src, join(destDir, name))
          done.push(name)
        } catch { /* 单个失败不拖垮整批 */ }
      }
      return { ok: true, files: done }
    },

    'POST /wb/listDir': async ({ body }) => {
      /* 空 path 默认 home（DirPicker 无初始路径时的落点）；响应带 path/parent——客户端
       * 目录选择器不再自行拼父目录（Windows 盘符根等边界由 host 一处收口）。纯增字段，
       * 旧调用方（03 文件树）只读 entries，行为不变。 */
      const p0 = String((body && body.path) || '')
      const p = p0 ? expandHome(p0) : homedir()
      if (fss) {
        try {
          const resolved = await fss.resolve(p)
          const entries = await fss.listDir(resolved)
          const rows = []
          for (const it of entries) {
            rows.push({
              name: it.name,
              type: it.type,
              size: it.size === undefined ? null : it.size,
              path: fss.processPath(it.target),
              hidden: it.name.charAt(0) === '.',
            })
          }
          rows.sort((a, b) => (a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          const abs = String(fss.processPath(resolved) || p)
          return { path: abs, parent: parentOf(abs), entries: rows }
        } catch { /* fall through to shell */ }
      }
      /* node 兜底（fs 服务失败时；与主路同语义：目录优先、名称排序、hidden 标记） */
      try {
        const rows = readdirSync(p, { withFileTypes: true }).map((ent) => ({
          name: ent.name,
          type: ent.isDirectory() ? 'directory' : 'file',
          size: null,
          path: join(p, ent.name),
          hidden: ent.name.charAt(0) === '.',
        }))
        rows.sort((a, b) => (a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        return { path: p, parent: parentOf(p), entries: rows }
      } catch (e) {
        return { entries: [], error: msgOf(e) }
      }
    },

    /* 订阅当前文件树列出的目录；dirs=[] 卸掉全部监视。返回当前 stamp。 */
    'POST /wb/treeWatch': async ({ body }) => {
      const dirs = (body && Array.isArray(body.dirs)) ? body.dirs.map(String) : []
      return syncTreeWatches(dirs)
    },

    /* long-poll：stamp 已超 since 立即返回；否则等到监视事件或 timeoutMs。 */
    'POST /wb/treeWait': async ({ body, req }) => {
      const since = Number(body && body.since)
      const sinceN = Number.isFinite(since) ? since : 0
      const timeoutMs = body && body.timeoutMs != null
        ? Math.min(60000, Math.max(0, Number(body.timeoutMs) || 0))
        : treeWaitDefaultMs
      if (!treeWatchEnabled) return { stamp: treeStamp, watching: false }
      if (treeStamp > sinceN) return { stamp: treeStamp, watching: true }
      if (timeoutMs <= 0) return { stamp: treeStamp, watching: true }
      return new Promise((resolve) => {
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          treeWaiters.delete(entry)
          clearTimeout(t)
          resolve({ stamp: treeStamp, watching: true })
        }
        const entry = { done }
        const t = setTimeout(done, timeoutMs)
        treeWaiters.add(entry)
        if (req && typeof req.on === 'function') {
          req.on('close', done)
          req.on('aborted', done)
        }
      })
    },

    'POST /wb/readFile': async ({ body }) => {
      const p = String(body.path || '')
      const lower = p.toLowerCase()
      const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(p)
      const isPdf = lower.endsWith('.pdf')
      const isDocx = lower.endsWith('.docx')
      const mimeOf = (x) =>
        x.endsWith('.svg') ? 'image/svg+xml' : x.endsWith('.png') ? 'image/png' : x.endsWith('.gif') ? 'image/gif' : x.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
      if (isDocx) {
        /* docx → html 只有 macOS textutil；其它平台优雅降级 */
        if (!IS_MAC) return { error: 'docx 预览暂不支持当前平台（仅 macOS）' }
        if (!shell) return { error: 'shell unavailable' }
        try {
          const r = await run('textutil -convert html -stdout ' + q(p), 3e4)
          return r.exitCode !== 0 ? { error: errOf(r) || 'textutil failed' } : { kind: 'html', html: stdoutOf(r) }
        } catch (e) {
          return { error: msgOf(e) }
        }
      }
      try {
        if (!fss) throw new Error('fs unavailable')
        const resolved = await fss.resolve(p)
        const st = await fss.stat(resolved)
        if (!st || st.type !== 'file') return { error: 'not a regular file' }
        /* image/pdf 一律走自家 /wb/raw（fss.fileUrl 在 http:// 页面不可加载，raw 有 20MB 上限）。
           注意 rawUrl 用请求路径 p：fss.resolve 返回的是对象句柄，直接插值会得到 [object Object]。 */
        const rawUrl = (p2) => '/__dsh-geek-sidebar__/wb/raw?path=' + encodeURIComponent(p2)
        if (isImg) return { kind: 'image', url: rawUrl(p), size: st.size === undefined ? null : st.size }
        if (isPdf) return { kind: 'pdf', url: rawUrl(p), size: st.size === undefined ? null : st.size }
        const MAX = C.textMaxKB * 1024
        if (st.size !== undefined && st.size > MAX) return { error: 'file too large (>' + C.textMaxKB + 'KB)' }
        let text = await fss.readText(resolved)
        let truncated = false
        if (text.length > MAX) {
          text = text.slice(0, MAX)
          truncated = true
        }
        return { kind: 'text', text, truncated }
      } catch (e1) {
        /* node 兜底（fs 服务失败时）：不再依赖 base64/head 等 unix 命令 */
        try {
          if (isImg || isPdf) {
            /* 评审修复：先 stat 预检再读盘——原先整文件读入内存才查 base64 长度
             * （大文件先撑内存才拒绝）；上限对齐主路 /wb/raw 的 rawMaxMB（主路
             * 给的 rawUrl 也是这个天花板），统一两条路的上限语义 */
            const st3 = statSync(p)
            if (st3.size > C.rawMaxMB * 1024 * 1024) return { error: 'file too large (>' + C.rawMaxMB + 'MB)' }
            const b64 = readFileSync(p).toString('base64')
            const mime = isPdf ? 'application/pdf' : mimeOf(lower)
            return { kind: isPdf ? 'pdf' : 'image', url: 'data:' + mime + ';base64,' + b64 }
          }
          /* 与主路同上限、同 truncated 语义（旧版硬编码 512KB 且恒 false，评审 P3） */
          const MAX2 = C.textMaxKB * 1024
          const st2 = statSync(p)
          return { kind: 'text', text: readHeadSync(p, MAX2), truncated: st2.size > MAX2 }
        } catch (e2) {
          return { error: msgOf(e2) }
        }
      }
    },

    /* ---------- 删除（移回收站，可恢复）与写文件（预览编辑保存） ---------- */
    'POST /wb/delete': async ({ body }) => {
      const p = expandHome(String(body.path || ''))
      if (!p || !isAbs(p)) throw httpError(400, 'absolute path required')
      if (p === '/' || p === homedir() || p.split(/[\\/]/).filter(Boolean).length < 2) throw httpError(400, 'path too shallow, refused')
      try {
        statSync(p)
      } catch {
        throw httpError(404, 'not found')
      }
      /* 移入回收站；同名冲突增加时间戳、跨盘 rename 兜底均由 moveEntrySync 处理 */
      const tdir = trashDir()
      mkdirSync(tdir, { recursive: true })
      return { ok: true, trash: baseName(moveEntrySync(p, tdir)) }
    },

    /* ---------- 移动（拖拽：把文件/文件夹挪到另一目录） ---------- */
    'POST /wb/move': async ({ body }) => {
      const src = expandHome(String((body && body.src) || '')).replace(/[\\/]+$/, '')
      const destDir = expandHome(String((body && body.destDir) || '')).replace(/[\\/]+$/, '')
      if (!src || !isAbs(src)) throw httpError(400, 'absolute src required')
      if (!destDir || !isAbs(destDir)) throw httpError(400, 'absolute destDir required')
      if (src === '/' || /^[A-Za-z]:\\?$/.test(src)) throw httpError(400, 'refusing to move filesystem root')
      try { statSync(src) } catch { throw httpError(404, 'source not found') }
      let dt
      try { dt = statSync(destDir) } catch { return { ok: false, error: 'target not found' } }
      if (!dt.isDirectory()) return { ok: false, error: 'target not a directory' }
      /* 文件夹不可移进自身或其子孙（大小写不敏感跨平台校验） */
      const isSameOrDescendant = (parent, child) => {
        const P = String(parent).replace(/[\\/]+$/, '')
        const C = String(child).replace(/[\\/]+$/, '')
        return samePath(P, C) || C.toLowerCase().startsWith(P.toLowerCase() + '/') || C.toLowerCase().startsWith(P.toLowerCase() + '\\')
      }
      if (isSameOrDescendant(src, destDir)) return { ok: false, error: 'cannot move a folder into itself or its subfolder' }
      /* 同父目录拖放判 no-op（避免误加时间戳复制）；随后冲突/兜底统一交给 moveEntrySync */
      const name = baseName(src)
      if (samePath(join(destDir, name), src)) return { ok: false, error: 'already in this folder' }
      const dest = moveEntrySync(src, destDir)
      return { ok: true, path: dest, name: baseName(dest) }
    },

    /* ---------- 会话所在文件夹的绝对路径（复制给用户跳转/跨会话引用） ---------- */
    'POST /wb/sessionPath': async ({ body }) => {
      const id = String((body && body.id) || '')
      if (!id) throw httpError(400, 'session id required')
      const cwd = body && body.cwd ? String(body.cwd) : null
      return { ok: true, path: sessionDirPath(cwd, id) }
    },

    'POST /wb/writeFile': async ({ body }) => {
      const p = expandHome(String(body.path || ''))
      if (!p || !isAbs(p)) throw httpError(400, 'absolute path required')
      /* text 缺字段必须拒绝——静默给 '' 会把目标文件清空（评审修复 B2） */
      if (typeof body.text !== 'string') throw httpError(400, 'text (string) required')
      const text = body.text
      const size = Buffer.byteLength(text, 'utf8')
      const writeMax = C.writeMaxMB * 1024 * 1024
      if (size > writeMax) throw httpError(413, 'text too large (>' + C.writeMaxMB + 'MB)')
      let st
      try {
        st = statSync(p)
      } catch {
        throw httpError(404, 'not found')
      }
      if (!st.isFile()) throw httpError(400, 'not a file')
      writeFileSync(p, text, 'utf8')
      return { ok: true, size }
    },

    /* ---------- 下载 ---------- */
    'POST /wb/download': async ({ body }) => {
      try {
        const src = expandHome(String(body.path || ''))
        const name = baseName(src) || 'download'
        const destDir0 = String(body.destDir || '') || join(homedir(), 'Downloads')
        mkdirSync(destDir0, { recursive: true })
        /* 同名冲突加时间戳后缀（对齐 /wb/delete 的废纸篓冲突处理）——
         * 原先 copyFileSync 直接覆盖 Downloads 里的同名文件（评审修复 B5） */
        let dest = join(destDir0, name)
        if (existsSync(dest)) {
          const dot = name.lastIndexOf('.')
          const stamped = dot > 0 ? name.slice(0, dot) + '-' + Date.now() + name.slice(dot) : name + '-' + Date.now()
          dest = join(destDir0, stamped)
        }
        copyFileSync(src, dest)
        return { ok: true, path: dest }
      } catch (e) {
        return { ok: false, error: msgOf(e) }
      }
    },

    'POST /wb/downloadDir': async ({ body }) => {
      if (!shell) return { ok: false, error: 'shell unavailable' }
      try {
        const src = expandHome(String(body.path || '')).replace(/[\\/]+$/, '')
        const name = (baseName(src) || 'folder') + '.zip'
        const destDir0 = join(homedir(), 'Downloads')
        mkdirSync(destDir0, { recursive: true })
        const dest = join(destDir0, name)
        const r = await run(zipDirCmd(src, dest), 12e4)
        return r.exitCode !== 0 ? { ok: false, error: errOf(r) || 'zip failed' } : { ok: true, path: dest }
      } catch (e) {
        return { ok: false, error: msgOf(e) }
      }
    },

    /* ---------- 笔记目录 ---------- */
    'POST /wb/notesGet': async () => notesRead(),

    /* 1.19.11 起客户端改走 /wb/listDir 驱动的应用内 DirPicker，不再调本路由；
     * 保留给动态插件/外部调用（系统原生 GUI 选择器入口），非客户端兜底 */
    'POST /wb/notesPick': async () => {
      if (!shell) return { ok: false, error: 'shell unavailable' }
      const r = await run(pickFolderCmd('选择笔记目录'), 12e4)
      if (r.exitCode !== 0) {
        const o = errOf(r)
        return /canceled/i.test(o) ? { ok: false, canceled: true } : { ok: false, error: o || 'picker failed' }
      }
      const dir = stdoutOf(r).trim().replace(/[\\/]+$/, '')
      if (!dir) return { ok: false, error: 'empty selection' }
      const cur = await notesTouch(dir)
      return { ok: true, dirs: cur.dirs, current: cur.current }
    },

    'POST /wb/notesSelect': async ({ body }) => {
      const dir = String((body && body.dir) || '').replace(/[\\/]+$/, '')
      if (!dir) return { ok: false, error: 'no dir' }
      const cur = await notesTouch(dir)
      return { ok: true, dirs: cur.dirs, current: cur.current }
    },

    /* ---------- 便签（quick notes）路由组：全局 .md 平铺池 ----------
     * 定位一律走 name 白名单（qnSafeName），不接受绝对路径；写上限复用 writeMaxMB。 */
    'POST /wb/qnState': async () => {
      const p = await qnPrefsRead()
      return { ok: true, dir: await qnDir(), custom: !!p.dir, capture: C.quickNotesCapture !== false }
    },

    'POST /wb/qnList': async ({ body }) => {
      const notes = await qnListNotes(body && body.q)
      return { ok: true, dir: await qnDir(), notes }
    },

    'POST /wb/qnRead': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      const p = join(await qnDir(), name)
      let st
      try { st = statSync(p) } catch { throw httpError(404, 'not found') }
      if (!st.isFile()) throw httpError(400, 'not a file')
      const MAX = C.textMaxKB * 1024
      return { ok: true, name, text: readHeadSync(p, MAX), truncated: st.size > MAX }
    },

    'POST /wb/qnCreate': async ({ body }) => {
      const content = String((body && body.content) || '')
      if (content.trim() === '') throw httpError(400, 'content required')
      if (Buffer.byteLength(content, 'utf8') > C.writeMaxMB * 1024 * 1024) throw httpError(413, 'content too large (>' + C.writeMaxMB + 'MB)')
      const dir = await qnDir()
      mkdirSync(dir, { recursive: true })
      const title = String((body && body.title) || '').trim() || qnPreviewOf(content).replace(/…$/, '')
      const name = qnFreeName(dir, title)
      writeFileSync(join(dir, name), content, 'utf8')
      return { ok: true, name, title: name.replace(/\.md$/i, ''), dir }
    },

    'POST /wb/qnUpdate': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      /* content 缺字段必须拒绝——静默给 '' 会把便签清空（同 writeFile 的 B2 教训） */
      if (typeof (body && body.content) !== 'string') throw httpError(400, 'content (string) required')
      const content = body.content
      if (content.trim() === '') throw httpError(400, 'content required')
      if (Buffer.byteLength(content, 'utf8') > C.writeMaxMB * 1024 * 1024) throw httpError(413, 'content too large (>' + C.writeMaxMB + 'MB)')
      const dir = await qnDir()
      const p = join(dir, name)
      try { if (!statSync(p).isFile()) throw new Error('not a file') } catch { throw httpError(404, 'not found') }
      writeFileSync(p, content, 'utf8')
      /* 可选改名：title 非空且与现文件名不同才动；冲突沿用 qnFreeName 序号后缀 */
      const title = String((body && body.title) || '').trim()
      if (title && title !== name.replace(/\.md$/i, '')) {
        const next = qnFreeName(dir, title)
        renameSync(p, join(dir, next))
        return { ok: true, name: next, renamed: next !== name }
      }
      return { ok: true, name, renamed: false }
    },

    'POST /wb/qnGenTitle': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      let content = typeof (body && body.content) === 'string' ? body.content.trim() : ''
      const dir = await qnDir()
      if (!content && name) {
        const p = join(dir, name)
        try { content = readFileSync(p, 'utf8').trim() } catch {}
      }
      if (!content) throw httpError(400, '便签内容为空，无法生成标题')

      let title = ''
      /* llm 可选：ctx.get('llm') 判空（不声明 inject；ctx.llm 属性访问在未注入时会抛 cannot get property）。 */
      const llm = ctx && typeof ctx.get === 'function' ? ctx.get('llm') : null
      const sessions = ctx && typeof ctx.get === 'function' ? ctx.get('sessions') : null
      let session = null
      const sid = String((body && body.sessionId) || '').trim()
      if (sessions) {
        session = sid ? sessions.get(sid) : (sessions.active || null)
        if (!session && typeof sessions.list === 'function') {
          const all = sessions.list()
          if (all && all.length > 0) session = all[0]
        }
      }

      let route = (body && body.provider && body.model)
        ? { provider: body.provider, model: body.model }
        : null

      if (!route && session && typeof session.requestHeader === 'function') {
        const header = session.requestHeader()
        if (header && header.config && header.config.provider && header.config.model) {
          route = { provider: header.config.provider, model: header.config.model }
        }
      }

      if (!route && session && session.projectionValues && session.projectionValues.modelSelection) {
        const sel = session.projectionValues.modelSelection
        const cur = sel.next || sel.lastUsed
        if (cur && cur.provider && cur.model) {
          route = { provider: cur.provider, model: cur.model }
        }
      }

      if (!route) {
        throw httpError(409, '会话还没有可用的模型路由（请在对话中选择模型）')
      }

      if (llm && typeof llm.stream === 'function') {
        const ask = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `为以下便签内容生成一个简明扼要的标题。\n\n要求：\n- 语言与正文一致；\n- 提炼核心主题，不要带“便签”、“备忘”等冗余词；\n- 长度在 4 到 15 个字以内；\n- 不要调用工具；\n- 只返回标题纯文本，不要引号、符号、Markdown 或解释。\n\n便签内容：\n${content.slice(0, 3000)}`,
            },
          ],
        }
        let text = ''
        let failure = null
        try {
          for await (const chunk of llm.stream({
            provider: route.provider,
            model: route.model,
            messages: [ask],
            maxTokens: 2048,
            sessionId: session ? session.id : undefined,
            purpose: 'note-title',
            signal: AbortSignal.timeout(30000),
          })) {
            if (chunk.type === 'text-delta') text += chunk.text
            else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind !== 'stop') failure = chunk.reason
          }
        } catch (e) {
          throw httpError(502, 'AI 模型调用失败: ' + (e.message || e))
        }

        if (failure) {
          const detail = failure.kind === 'length'
            ? 'length（模型思考占满输出上限，未产出标题）'
            : failure.failure && failure.failure.message ? failure.failure.message : failure.kind
          throw httpError(502, 'AI 标题生成中断: ' + String(detail))
        }

        title = text.split('\n').map(s => s.trim()).find(s => s.length > 0) || ''
        title = title.replace(/^[\s"'“”「」『』`*#]+|[\s"'“”「」『』`*#.!。！?？:：;；]+$/g, '').slice(0, 40)
      } else {
        throw httpError(500, '宿主未加载 LLM 服务')
      }

      if (!title) {
        throw httpError(502, 'AI 模型未能产出有效标题')
      }

      let newName = name
      if (name && title) {
        const p = join(dir, name)
        if (existsSync(p)) {
          newName = qnFreeName(dir, title)
          if (newName !== name) {
            renameSync(p, join(dir, newName))
          }
        }
      }
      return { ok: true, title, name: newName }
    },

    'POST /wb/qnDelete': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      const p = join(await qnDir(), name)
      try { statSync(p) } catch { throw httpError(404, 'not found') }
      /* 与 /wb/delete 同语义：进回收站（可恢复），冲突/兜底交给 moveEntrySync */
      const tdir = trashDir()
      mkdirSync(tdir, { recursive: true })
      return { ok: true, trash: baseName(moveEntrySync(p, tdir)) }
    },

    'POST /wb/qnSetDir': async ({ body }) => {
      const raw = String((body && body.dir) || '').trim()
      let dir = null /* null = 清除自定义，回落 Config/默认 */
      if (raw) {
        dir = expandHome(raw).replace(/[\\/]+$/, '')
        if (!isAbs(dir)) return { ok: false, error: 'absolute path required' }
        try {
          if (!statSync(dir).isDirectory()) return { ok: false, error: 'not a directory' }
        } catch {
          return { ok: false, error: 'not found' }
        }
      }
      mkdirSync(dirname(qnPrefsPath()), { recursive: true })
      writeFileSync(qnPrefsPath(), JSON.stringify({ dir }), 'utf8')
      return { ok: true, dir: await qnDir(), custom: !!dir }
    },

    /* 转存知识库：目标目录必须登记在笔记目录偏好里——防止把文件挪进任意目录 */
    'POST /wb/qnMoveToKb': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      const target = expandHome(String((body && body.targetDir) || '')).replace(/[\\/]+$/, '')
      if (!target || !isAbs(target)) throw httpError(400, 'absolute targetDir required')
      const kb = await notesRead()
      if (!kb.dirs.some((d) => samePath(String(d).replace(/[\\/]+$/, ''), target))) return { ok: false, error: 'target not a registered knowledge-base dir' }
      let tst
      try { tst = statSync(target) } catch { return { ok: false, error: 'target not found' } }
      if (!tst.isDirectory()) return { ok: false, error: 'target not a directory' }
      const src = join(await qnDir(), name)
      try { statSync(src) } catch { throw httpError(404, 'not found') }
      const dest = moveEntrySync(src, target)
      return { ok: true, path: dest }
    },

    /* 分流至当前项目：将便签转存至指定项目根目录 */
    'POST /wb/qnMoveToProject': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      const target = expandHome(String((body && body.targetDir) || '')).replace(/[\\/]+$/, '')
      if (!target || !isAbs(target)) throw httpError(400, 'absolute targetDir required')
      let tst
      try { tst = statSync(target) } catch { return { ok: false, error: 'target project dir not found' } }
      if (!tst.isDirectory()) return { ok: false, error: 'target not a directory' }
      const src = join(await qnDir(), name)
      try { statSync(src) } catch { throw httpError(404, 'not found') }
      const dest = moveEntrySync(src, target)
      return { ok: true, path: dest }
    },

    /* 同步至指定目录（项目或知识库）：纯复制同步，绝不删除源便签 */
    'POST /wb/qnSyncTo': async ({ body }) => {
      const name = qnSafeName(body && body.name)
      if (!name) throw httpError(400, 'invalid note name')
      const target = expandHome(String((body && body.targetDir) || '')).replace(/[\\/]+$/, '')
      if (!target || !isAbs(target)) throw httpError(400, 'absolute targetDir required')
      let tst
      try { tst = statSync(target) } catch { return { ok: false, error: 'target dir not found' } }
      if (!tst.isDirectory()) return { ok: false, error: 'target not a directory' }
      const src = join(await qnDir(), name)
      try { statSync(src) } catch { throw httpError(404, 'not found') }
      let dest = join(target, name)
      copyFileSync(src, dest)
      return { ok: true, path: dest }
    },

    /* ---------- 便签目录（分类）元数据读写 ---------- */
    'POST /wb/qnFoldersGet': async () => {
      const p = join(await qnDir(), '.folders.json')
      try {
        const j = JSON.parse(readFileSync(p, 'utf8'))
        return {
          ok: true,
          folders: Array.isArray(j.folders) ? j.folders : [],
          noteFolders: j.noteFolders && typeof j.noteFolders === 'object' ? j.noteFolders : {},
        }
      } catch {
        return { ok: true, folders: [], noteFolders: {} }
      }
    },

    'POST /wb/qnFoldersSet': async ({ body }) => {
      const p = join(await qnDir(), '.folders.json')
      const folders = Array.isArray(body && body.folders) ? body.folders.map(String).filter(Boolean) : []
      const noteFolders = (body && body.noteFolders && typeof body.noteFolders === 'object') ? body.noteFolders : {}
      try {
        writeFileSync(p, JSON.stringify({ folders, noteFolders }, null, 2), 'utf8')
        return { ok: true, folders, noteFolders }
      } catch (e) {
        return { ok: false, error: e.message || String(e) }
      }
    },

    /* ---------- DirPicker 默认打开目录 ---------- */
    'POST /wb/prefsGet': async () => prefsOut(),

    'POST /wb/prefsSet': async ({ body }) => {
      const raw = String((body && body.pickerDir) || '').trim()
      let dir = null /* null = 清除自定义，回落桌面 */
      if (raw) {
        dir = expandHome(raw).replace(/[\\/]+$/, '')
        if (!isAbs(dir)) return { ok: false, error: 'absolute path required' }
        try {
          if (!statSync(dir).isDirectory()) return { ok: false, error: 'not a directory' }
        } catch {
          return { ok: false, error: 'not found' }
        }
      }
      mkdirSync(dirname(prefsPath()), { recursive: true })
      writeFileSync(prefsPath(), JSON.stringify({ pickerDir: dir }), 'utf8')
      const out = await prefsOut()
      return { ok: true, pickerDir: out.pickerDir, custom: out.custom }
    },

    'POST /wb/gitStatus': async ({ body }) => {
      const p = String((body && body.cwd) || '')
      if (!p || !shell) return { root: null, files: {}, changedDirs: [], filesList: [], stats: { count: 0, additions: 0, deletions: 0 } }
      try {
        const root = (await git(p, ['rev-parse', '--show-toplevel'])).trim()
        if (!root) return { root: null, files: {}, changedDirs: [], filesList: [], stats: { count: 0, additions: 0, deletions: 0 } }
        const normRoot = root.endsWith('/') ? root.slice(0, -1) : root
        const out = await git(root, ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'])
        const files = {}
        const filesList = []
        const dirSet = new Set()
        for (const line of out.split('\n')) {
          if (!line || line.length < 2) continue
          let code = ''
          let rel = ''
          if (line.charAt(2) === ' ') {
            code = line.slice(0, 2).trim()
            rel = line.slice(3).trim()
          } else if (line.charAt(1) === ' ') {
            code = line.charAt(0)
            rel = line.slice(2).trim()
          } else {
            code = line.slice(0, 2).trim()
            rel = line.slice(3).trim()
          }
          if (rel.startsWith('"') && rel.endsWith('"')) {
            try { rel = JSON.parse(rel) } catch (e) {}
          }
          const abs = normRoot + '/' + rel
          const statusKind = code === '??' ? 'U' : code.includes('M') ? 'M' : code.includes('D') ? 'D' : code.includes('A') ? 'A' : 'M'
          files[abs] = statusKind
          filesList.push({
            path: abs,
            rel,
            name: rel.slice(rel.lastIndexOf('/') + 1),
            status: statusKind,
          })
          let cur = abs.slice(0, abs.lastIndexOf('/'))
          while (cur && cur.length >= normRoot.length) {
            dirSet.add(cur)
            const idx = cur.lastIndexOf('/')
            cur = idx > 0 ? cur.slice(0, idx) : ''
          }
        }
        let additions = 0, deletions = 0
        try {
          const numstat = await git(root, ['-c', 'core.quotepath=false', 'diff', '--no-color', '--numstat', 'HEAD', '--', '.'])
          for (const line of numstat.split('\n')) {
            if (!line) continue
            const parts = line.split('\t')
            const a = parseInt(parts[0], 10), d = parseInt(parts[1], 10)
            if (!isNaN(a)) additions += a
            if (!isNaN(d)) deletions += d
          }
        } catch (e) {}
        /* 对齐 pi-web：将未跟踪文本文件（??）的行数累加进 additions 中（字节级快检，零临时字符串与数组分配） */
        let untrackedScanned = 0
        for (const item of filesList) {
          if (item.status === 'U') {
            if (++untrackedScanned > 200) break /* 极端海量未跟踪文件时上限防御 */
            try {
              const st = statSync(item.path)
              if (st.isFile() && st.size > 0 && st.size <= 512 * 1024) {
                const buf = readFileSync(item.path)
                let lines = 0, hasNull = false, lastByte = 0
                for (let i = 0; i < buf.length; i++) {
                  const b = buf[i]
                  if (b === 0) { hasNull = true; break; }
                  if (b === 10) lines++
                  lastByte = b
                }
                if (!hasNull) {
                  if (lastByte !== 10) lines++
                  additions += lines
                }
              }
            } catch (e) {}
          }
        }
        return {
          root,
          files,
          changedDirs: Array.from(dirSet),
          filesList,
          stats: { count: filesList.length, additions, deletions, untrackedIncluded: true },
        }
      } catch (err) {
        return { root: null, files: {}, changedDirs: [], filesList: [], stats: { count: 0, additions: 0, deletions: 0 } }
      }
    },

    'POST /wb/gitDiff': async ({ body }) => {
      const p = String((body && body.path) || '')
      if (!p || !shell) return { diff: '' }
      try {
        const dir = p.slice(0, p.lastIndexOf('/')) || p
        const root = (await git(dir, ['rev-parse', '--show-toplevel'])).trim()
        if (!root) return { diff: '' }
        let diff = ''
        try {
          diff = await git(root, ['-c', 'core.quotepath=false', 'diff', '--no-color', 'HEAD', '--', p])
        } catch (e) {}
        if (!diff) {
          try {
            diff = await git(root, ['-c', 'core.quotepath=false', 'diff', '--no-color', '--', p])
          } catch (e) {}
        }
        if (!diff && existsSync(p)) {
          try {
            const st = statSync(p)
            if (st.isFile()) {
              const normP = p.replace(/\\/g, '/')
              const normRoot = root.replace(/\\/g, '/')
              const rel = normP.startsWith(normRoot + '/') ? normP.slice(normRoot.length + 1) : normP
              if (st.size > 512 * 1024) {
                diff = 'Binary files /dev/null and b/' + rel + ' differ (file too large)'
              } else {
                const buf = readFileSync(p)
                if (buf.includes(0)) {
                  diff = 'Binary files /dev/null and b/' + rel + ' differ'
                } else {
                  const text = buf.toString('utf8')
                  const lines = text.length === 0 ? [] : (text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n'))
                  diff = '--- /dev/null\n+++ b/' + rel + '\n@@ -0,0 +1,' + lines.length + ' @@\n' + (lines.length ? lines.map(l => '+' + l).join('\n') : '')
                }
              }
            }
          } catch (e) {}
        }
        return { diff }
      } catch (err) {
        return { diff: '' }
      }
    },

    'POST /wb/reveal': async ({ body }) => {
      if (!shell) return { ok: false, error: 'shell unavailable' }
      const p = String((body && body.path) || '')
      if (!p) return { ok: false, error: 'no path' }
      const r = await run(revealCmd(p), 1e4)
      return r.exitCode !== 0 ? { ok: false, error: errOf(r) || 'open failed' } : { ok: true }
    },

    /* ---------- 样式（每请求读盘，改 CSS 刷新即生效） ---------- */
    'GET /wb/style.css': ({ res }) => {
      let css
      try {
        css = readFileSync(CSS_URL, 'utf8')
      } catch (e) {
        throw httpError(500, 'style.css unreadable: ' + msgOf(e))
      }
      /* no-transform：0.1.2 平台 webserver 新增的 gzip 中间件在具名前缀路由的大响应上
       * 会把连接压崩（空回复）。静态资源本就不该被中间件转换，按 compression 包
       * 自带的 no-transform 旁路契约跳过压缩。 */
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store, no-transform' })
      res.end(css)
    },

    /* ---------- 原始文件流（md 预览的本地图片等资源） ---------- */
    'GET /wb/raw': ({ query, res }) => {
      const p = expandHome(String(query.get('path') || ''))
      if (!p || !isAbs(p)) throw httpError(400, 'absolute path required')
      let st
      try {
        st = statSync(p)
      } catch {
        throw httpError(404, 'not found')
      }
      if (!st.isFile()) throw httpError(404, 'not a file')
      if (st.size > C.rawMaxMB * 1024 * 1024) throw httpError(413, 'file too large (>' + C.rawMaxMB + 'MB)')
      const ext = p.toLowerCase().split('.').pop() || ''
      const mime = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
      }[ext] || 'application/octet-stream'
      res.writeHead(200, { 'content-type': mime, 'content-length': st.size, 'cache-control': 'private, max-age=60, no-transform' })
      /* 不用 createReadStream().pipe(res)：新版平台的 res 包装层不接受流式 pipe（连接空回复），
         raw 有 20MB 上限，缓冲读入一次性 end 即可（与 style.css 的 res.end 同路，已验证可用）。 */
      res.end(readFileSync(p))
    },
  }
}
