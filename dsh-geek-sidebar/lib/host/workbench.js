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
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { httpError } from './http.js'

const CSS_URL = new URL('../style.css', import.meta.url)
const VENDOR_XTERM_URL = new URL('../vendor-xterm.js', import.meta.url)
let vendorXtermCache = null /* 静态内容读一次缓存（284KB，与 style.css 的每请求读盘不同——vendor 不随开发变动） */

/* ---------- 跨平台（macOS / Windows / Linux） ---------- */
const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
const q = (e) => "'" + String(e).replace(/'/g, "'\\''") + "'"
const dq = (s) => '"' + String(s).replace(/"/g, '\\"') + '"'
const isAbs = (p) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)
const expandHome = (p) => (p.startsWith('~/') || p.startsWith('~\\') ? homedir() + p.slice(1) : p)
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
  gitCacheTtlSec: 60,   // git 信息缓存
}

export function workbenchApi(ctx, cfg) {
  const C = Object.assign({}, WORKBENCH_DEFAULTS, cfg)
  const fss = ctx.get('fs')
  const shell = ctx.get('shell')


  const stdoutOf = (e) => (e.stdout && e.stdout.text) || ''
  const errOf = (e) => ((e.stderr && e.stderr.text) || (e.stdout && e.stdout.text) || '').trim()
  const msgOf = (e) => String(e && e.message ? e.message : e)
  const parentDir = (e) => {
    const t = String(e).replace(/\/+$/, '')
    const r = t.lastIndexOf('/')
    return r <= 0 ? '/' : t.slice(0, r)
  }
  const samePath = (a, b) => a === b || String(a).toLowerCase() === String(b).toLowerCase()

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
    return stdoutOf(r).trim()
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
          root: isTop ? (isWt ? parentDir(commonDir) : topLevel) : p,
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
        const root = parentDir(commonDir)
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
      const p = String(body.path || '')
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
          return { entries: rows }
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
        return { entries: rows }
      } catch (e) {
        return { entries: [], error: msgOf(e) }
      }
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
      /* 同名冲突时在扩展名前加时间戳后缀；rename 跨盘失败则复制后删 */
      const tdir = trashDir()
      mkdirSync(tdir, { recursive: true })
      const base = baseName(p) || 'unnamed'
      let destName = base
      if (existsSync(join(tdir, destName))) {
        const dot = base.lastIndexOf('.')
        destName = dot > 0 ? base.slice(0, dot) + '-' + Date.now() + base.slice(dot) : base + '-' + Date.now()
      }
      try {
        renameSync(p, join(tdir, destName))
      } catch {
        cpSync(p, join(tdir, destName), { recursive: true })
        rmSync(p, { recursive: true, force: true })
      }
      return { ok: true, trash: destName }
    },

    'POST /wb/writeFile': async ({ body }) => {
      const p = expandHome(String(body.path || ''))
      if (!p || !isAbs(p)) throw httpError(400, 'absolute path required')
      const text = typeof body.text === 'string' ? body.text : ''
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
        const dest = join(destDir0, name)
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
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' })
      res.end(css)
    },

    /* ---------- xterm vendor（评审修复：从 client bundle 剥离，首开终端按需注入） ---------- */
    'GET /wb/vendor-xterm.js': ({ res }) => {
      if (!vendorXtermCache) {
        try {
          vendorXtermCache = readFileSync(VENDOR_XTERM_URL)
        } catch (e) {
          throw httpError(500, 'vendor-xterm.js unreadable: ' + msgOf(e))
        }
      }
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(vendorXtermCache)
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
      res.writeHead(200, { 'content-type': mime, 'content-length': st.size, 'cache-control': 'private, max-age=60' })
      /* 不用 createReadStream().pipe(res)：新版平台的 res 包装层不接受流式 pipe（连接空回复），
         raw 有 20MB 上限，缓冲读入一次性 end 即可（与 style.css 的 res.end 同路，已验证可用）。 */
      res.end(readFileSync(p))
    },
  }
}
