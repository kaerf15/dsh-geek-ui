/**
 * dsh-geek-sidebar /skills/*：技能管理 host 业务。
 * 用真实 node:fs / child_process 做技能目录扫描、frontmatter 开关、npx 安装/更新、
 * skills.sh 搜索与 globalDir 偏好读写；global 目录默认 ~/.agents/skills
 * （可用 prefs 改写，持久化于 ~/.dsh/dsh-skills.json）。
 *
 * 实现要点：
 *  - setDisabled 移除开关时兼容"frontmatter 最后一行无换行"的 SKILL.md；
 *  - /skills/check 版本比对：GitHub trees API + git fetch 兜底 + skills.sh download hash，
 *    可自动检查的技能带 install.canCheckForUpdates 字段。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { httpError } from './http.js'

const execFileAsync = promisify(execFile)

const HOME = homedir()
const PREFS_PATH = join(HOME, '.dsh', 'dsh-skills.json')
const DEFAULT_GLOBAL_DIR = join(HOME, '.agents', 'skills')
const GLOBAL_LOCK_PATH = join(HOME, '.agents', '.skill-lock.json')
const SEARCH_API = 'https://skills.sh'
const ANSI_RE = /\x1B\[[0-9;]*m/g

/* ---------- 偏好（可编辑 global 目录） ---------- */
function readPrefs() {
  try {
    const j = JSON.parse(readFileSync(PREFS_PATH, 'utf8'))
    return { globalDir: typeof j.globalDir === 'string' && j.globalDir.trim() ? j.globalDir.trim() : DEFAULT_GLOBAL_DIR }
  } catch {
    return { globalDir: DEFAULT_GLOBAL_DIR }
  }
}
function writePrefs(prefs) {
  mkdirSync(join(HOME, '.dsh'), { recursive: true })
  writeFileSync(PREFS_PATH, JSON.stringify(prefs), 'utf8')
}

/* ---------- SKILL.md frontmatter（行级解析，保留原格式） ---------- */
function parseFrontmatter(text) {
  const out = {}
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return out
  const lines = m[1].split('\n')
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^([\w-]+)\s*:\s*(.*)$/)
    if (!km) continue
    let val = km[2].trim()
    /* YAML 块标量：description: | / > / |- / >- 等，值在后续更深层缩进的行里。
       | 保留换行（literal），> 折叠为空格（folded），-/+ 为 chomping（这里统一去尾换行）。 */
    if (/^[|>][+-]?$/.test(val)) {
      const folded = val[0] === '>'
      const keyIndent = lines[i].match(/^\s*/)[0].length
      const block = []
      let baseIndent = -1
      let j = i + 1
      for (; j < lines.length; j++) {
        const ln = lines[j]
        if (ln.trim() === '') { block.push(''); continue }
        const ind = ln.match(/^\s*/)[0].length
        if (ind <= keyIndent) break
        if (baseIndent < 0) baseIndent = ind
        block.push(ln.slice(baseIndent))
      }
      while (block.length && block[block.length - 1] === '') block.pop()
      if (folded) {
        /* folded：非空行并空格，空行成段落换行 */
        let text2 = ''
        for (const b of block) text2 += b === '' ? '\n' : (text2 && !text2.endsWith('\n') ? ' ' : '') + b
        val = text2
      } else {
        val = block.join('\n')
      }
      i = j - 1
    }
    out[km[1]] = val.replace(/^["']|["']$/g, '')
  }
  return out
}

function scanDir(root, scope) {
  const rows = []
  if (!root || !existsSync(root)) return rows
  let names
  try { names = readdirSync(root) } catch { return rows }
  for (const name of names) {
    const dir = join(root, name)
    let st
    try { st = statSync(dir) } catch { continue }
    if (!st.isDirectory()) continue
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) continue
    let fm = {}
    try { fm = parseFrontmatter(readFileSync(file, 'utf8')) } catch { /* keep defaults */ }
    rows.push({
      name: fm.name || name,
      description: fm.description || '',
      filePath: file,
      scope,
      disableModelInvocation: fm['disable-model-invocation'] === 'true',
    })
  }
  rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return rows
}

/* ---------- skills.sh 锁文件（版本/来源） ---------- */
function readLock(path) {
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'))
    return j.skills && typeof j.skills === 'object' ? j.skills : {}
  } catch {
    return {}
  }
}
function findLockEntry(entries, name) {
  if (entries[name]) return entries[name]
  const lower = String(name).toLowerCase()
  const key = Object.keys(entries).find((k) => k.toLowerCase() === lower)
  return key ? entries[key] : undefined
}
function normalizeSource(source, sourceType) {
  if (sourceType !== 'github') return source.replace(/\/$/, '')
  return source
    .replace(/^git\+/, '')
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}
function buildSkillsShUrl(source, skillName) {
  if (!source || source.includes('://') || source.startsWith('git@')) return undefined
  const p = source.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return p ? `${SEARCH_API}/${p}/${encodeURIComponent(skillName)}` : undefined
}
function installInfo(entries, skillName, scope) {
  const entry = findLockEntry(entries, skillName)
  if (!entry || typeof entry.source !== 'string' || !entry.source.trim()) return undefined
  const sourceType = typeof entry.sourceType === 'string' ? entry.sourceType : undefined
  const source = normalizeSource(entry.source.trim(), sourceType)
  if (!source) return undefined
  const skillPath = typeof entry.skillPath === 'string' ? entry.skillPath : undefined
  const ref = typeof entry.ref === 'string' ? entry.ref : undefined
  const rawHash = scope === 'global' ? entry.skillFolderHash : entry.computedHash
  const versionHash = typeof rawHash === 'string' && rawHash ? rawHash : undefined
  /* 仅 GitHub 来源 + 有 skillPath + 有可比版本才可自动检查 */
  const isGitHub = sourceType === 'github' && /^[\w.-]+\/[\w.-]+$/.test(source)
  const hasComparable = scope === 'global' || !ref
  return {
    package: `${source}@${skillName}`,
    scope,
    source,
    sourceType,
    skillsShUrl: sourceType === 'local' ? undefined : buildSkillsShUrl(source, skillName),
    skillPath,
    ref,
    versionHash,
    canCheckForUpdates: Boolean(isGitHub && skillPath && versionHash && hasComparable),
  }
}

function listSkills(cwd) {
  const prefs = readPrefs()
  const globalDir = prefs.globalDir
  const projectDir = cwd ? join(cwd, '.agents', 'skills') : ''
  const skills = scanDir(globalDir, 'global').concat(scanDir(projectDir, 'project'))
  const gLock = readLock(GLOBAL_LOCK_PATH)
  const pLock = cwd ? readLock(join(cwd, 'skills-lock.json')) : {}
  for (const s of skills) {
    const info = installInfo(s.scope === 'global' ? gLock : pLock, s.name, s.scope)
    if (info) s.install = info
  }
  return { skills, globalDir, defaultGlobalDir: DEFAULT_GLOBAL_DIR }
}

/* ---------- 开关：仅改 disable-model-invocation 一行（保留原 YAML 格式） ---------- */
function setDisabled(filePath, disable) {
  const content = readFileSync(filePath, 'utf8')
  const key = 'disable-model-invocation'
  const alreadySet = parseFrontmatter(content)[key] === 'true'
  let updated = content
  if (disable && !alreadySet) {
    updated = content.replace(/^---\r?\n/, `---\n${key}: true\n`)
    if (updated === content) updated = `---\n${key}: true\n---\n${content}`
  } else if (!disable && alreadySet) {
    /* 兼容该行为 frontmatter 最后一行、文件无尾随换行的情况 */
    updated = content.replace(new RegExp(`^${key}\\s*:.*(\\r?\\n|$)`, 'm'), '')
  }
  writeFileSync(filePath, updated, 'utf8')
}

/* ---------- npx 安装 / 更新 ---------- */
function runNpx(args, cwd) {
  return new Promise((resolveP) => {
    /* Windows 下 npx 是 npx.cmd，需要 shell 解析；POSIX 下 detached 使 npx 成为
     * 进程组长（评审修复：供超时整组击杀，见下） */
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: cwd || undefined, shell: process.platform === 'win32', detached: process.platform !== 'win32', env: { ...process.env, FORCE_COLOR: '0' } })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    /* 评审修复：超时杀整个进程组——原先只杀 npx 本体，它拉起的安装子进程会继续跑；
     * 组已不在则退杀直接子进程；Windows 维持杀直接子进程 */
    const timer = setTimeout(() => {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL')
        else process.kill(-child.pid, 'SIGKILL')
      } catch {
        try { child.kill('SIGKILL') } catch { /* gone */ }
      }
    }, 90000)
    child.on('close', (code) => { clearTimeout(timer); resolveP({ code, output: out.replace(ANSI_RE, '') }) })
    child.on('error', (err) => { clearTimeout(timer); resolveP({ code: -1, output: String(err) }) })
  })
}
function installArgs(pkg, isGlobal) {
  const args = ['skills', 'add', pkg, '-y', '--agent', 'pi']
  if (isGlobal) args.push('-g')
  return args
}
function skillFolder(skillPath) {
  let folder = String(skillPath || '').replace(/\\/g, '/')
  if (folder.toLowerCase().endsWith('/skill.md')) folder = folder.slice(0, -9)
  else if (folder.toLowerCase().endsWith('skill.md')) folder = folder.slice(0, -8)
  return folder.replace(/\/$/, '')
}
function updateArgs(install) {
  const folder = skillFolder(install.skillPath || '')
  const source = folder ? `${install.source}/${folder}` : install.source
  const ref = install.ref ? `#${encodeURIComponent(install.ref)}` : ''
  const name = install.package.slice(install.package.lastIndexOf('@') + 1)
  const args = ['skills', 'add', `${source}${ref}`, '--skill', name, '-y', '--agent', 'pi']
  if (install.scope === 'global') args.push('-g')
  return args
}

/* ---------- skills.sh 搜索 ---------- */
function formatInstalls(count) {
  if (!count || count <= 0) return ''
  if (count >= 1e6) return `${(count / 1e6).toFixed(1).replace(/\.0$/, '')}M installs`
  if (count >= 1e3) return `${(count / 1e3).toFixed(1).replace(/\.0$/, '')}K installs`
  return `${count} install${count === 1 ? '' : 's'}`
}
function parseSearchOutput(raw) {
  const results = []
  const lines = String(raw).replace(ANSI_RE, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^([\w.\-]+\/[\w.\-@:]+)\s+([\d.,]+[KMB]?\s+installs)$/)
    if (m) {
      const urlLine = (lines[i + 1] || '').trim().replace(/^└\s*/, '')
      results.push({ package: m[1], installs: m[2], url: urlLine.startsWith('https://') ? urlLine : '' })
    }
  }
  return results
}
async function searchSkills(query, limit) {
  try {
    const res = await fetch(`${SEARCH_API}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const out = []
    for (const skill of data.skills || []) {
      const name = skill.name && skill.name.trim()
      const source = skill.source && skill.source.trim()
      const slug = skill.id && skill.id.trim()
      if (!name || (!source && !slug)) continue
      out.push({
        package: `${source || slug}@${name}`,
        installs: formatInstalls(skill.installs),
        url: slug ? `${SEARCH_API}/${slug}` : '',
      })
    }
    if (out.length) return out
  } catch { /* fall through to npx */ }
  const r = await runNpx(['skills', 'find', query], undefined)
  return parseSearchOutput(r.output).slice(0, limit)
}

/* ---------- 版本比对 ---------- */
const CHECK_TIMEOUT_MS = 15000
const GIT_CHECK_TIMEOUT_MS = 30000

function skillSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
function skillNameFromPackage(pkg) {
  const at = String(pkg).lastIndexOf('@')
  return at >= 0 ? String(pkg).slice(at + 1) : String(pkg)
}

async function fetchJson(url, headers, fetcher) {
  const res = await (fetcher || fetch)(url, {
    cache: 'no-store',
    headers,
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  })
  if (!res.ok) throw httpError(res.status, 'HTTP ' + res.status)
  return res.json()
}

/* GitHub API 限流时的兜底：浅 fetch 后 rev-parse 出目标目录的 tree hash */
async function resolveGitTreeHash(install) {
  const repository = `https://github.com/${install.source}.git`
  const ref = install.ref || 'HEAD'
  const folder = skillFolder(install.skillPath || '')
  const gitDir = await mkdtemp(join(tmpdir(), 'dsh-geek-sidebar-skill-check-'))
  try {
    await execFileAsync('git', ['init', '--bare', gitDir], { timeout: GIT_CHECK_TIMEOUT_MS })
    await execFileAsync('git', [
      `--git-dir=${gitDir}`, 'fetch', '--depth=1', '--filter=blob:none', '--no-tags', repository, ref,
    ], { timeout: GIT_CHECK_TIMEOUT_MS })
    const revision = folder ? `FETCH_HEAD:${folder}` : 'FETCH_HEAD^{tree}'
    const { stdout } = await execFileAsync('git', [`--git-dir=${gitDir}`, 'rev-parse', revision], { timeout: GIT_CHECK_TIMEOUT_MS })
    const hash = stdout.trim()
    if (!/^[0-9a-f]{40}$/i.test(hash)) throw new Error('Invalid Git tree hash')
    return hash
  } finally {
    await rm(gitDir, { recursive: true, force: true }).catch(() => {})
  }
}

function updateResult(install, state, latestVersion, message) {
  return {
    package: install.package,
    scope: install.scope,
    state,
    currentVersion: install.versionHash,
    latestVersion,
    message,
  }
}

async function checkGlobalSkill(install, fetcher) {
  const ref = install.ref || 'HEAD'
  const url = `https://api.github.com/repos/${install.source}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'dsh-geek-sidebar' }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  const folder = skillFolder(install.skillPath || '')
  let latestVersion
  try {
    const raw = await fetchJson(url, headers, fetcher)
    latestVersion = typeof raw.sha === 'string' && !folder ? raw.sha : undefined
    if (folder && Array.isArray(raw.tree)) {
      const entry = raw.tree.find((item) => item && item.type === 'tree' && item.path === folder)
      if (entry && typeof entry.sha === 'string') latestVersion = entry.sha
    }
  } catch (err) {
    /* 401/403/429 = GitHub 限流/未授权，转 git fetch 兜底；其余错误直接上报 */
    const status = Number(err && err.status)
    if (![401, 403, 429].includes(status)) throw err
    latestVersion = await resolveGitTreeHash(install)
  }
  if (!latestVersion) return updateResult(install, 'error', undefined, 'Remote skill path was not found.')
  return updateResult(install, latestVersion === install.versionHash ? 'up-to-date' : 'update-available', latestVersion)
}

async function checkProjectSkill(install, fetcher) {
  const [owner, repo] = String(install.source).split('/')
  const name = skillSlug(skillNameFromPackage(install.package))
  const url = `${SEARCH_API}/api/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(name)}`
  const raw = await fetchJson(url, undefined, fetcher)
  const latestVersion = typeof raw.hash === 'string' ? raw.hash : undefined
  if (!latestVersion) return updateResult(install, 'error', undefined, 'skills.sh did not return a version hash.')
  return updateResult(install, latestVersion === install.versionHash ? 'up-to-date' : 'update-available', latestVersion)
}

async function checkOneSkillUpdate(install, fetcher) {
  if (!install.canCheckForUpdates || !install.versionHash || !install.skillPath) {
    return updateResult(install, 'unsupported', undefined, 'This lock entry cannot be checked automatically.')
  }
  try {
    return install.scope === 'global' ? await checkGlobalSkill(install, fetcher) : await checkProjectSkill(install, fetcher)
  } catch (err) {
    return updateResult(install, 'error', undefined, String(err && err.message ? err.message : err))
  }
}

/* ---------- 路由表 ---------- */
export function skillsApi() {
  return {
    'GET /skills/list': ({ query }) => listSkills(query.get('cwd') || ''),

    'POST /skills/check': async ({ body }) => {
      const cwd = String(body.cwd || '')
      const pkg = typeof body.package === 'string' ? body.package : undefined
      const scope = body.scope === 'global' || body.scope === 'project' ? body.scope : undefined
      if ((pkg && !scope) || (!pkg && scope)) throw httpError(400, 'package and scope must be provided together')
      const { skills } = listSkills(cwd)
      const installs = skills
        .map((s) => s.install)
        .filter(Boolean)
        .filter((i) => !pkg || (i.package === pkg && i.scope === scope))
      if (pkg && installs.length === 0) throw httpError(404, 'Installed skill not found')
      /* 并发检查；同仓库的技能共享一次 trees 请求（cachedFetcher 按 URL 去重）。
         缓存的是原始 fetch promise，每个调用方各自 .clone()——若共享同一个 clone，
         第二个消费者会报 "Body is unusable: Body has already been read"。 */
      const inflight = new Map()
      const cachedFetcher = async (input, init) => {
        let p = inflight.get(input)
        if (!p) {
          p = fetch(input, init)
          inflight.set(input, p)
        }
        return (await p).clone()
      }
      const updates = await Promise.all(installs.map((i) => checkOneSkillUpdate(i, cachedFetcher)))
      return { updates }
    },

    'POST /skills/toggle': async ({ body }) => {
      const filePath = String(body.filePath || '')
      if (!filePath || !existsSync(filePath)) throw httpError(404, 'file not found')
      /* 白名单（评审修复：原先任意已存在文件都能被写入 frontmatter——任意文件改写原语）。
       * 只接受扫描根（prefs.globalDir 或任意 <cwd>/.agents/skills）下的 <name>/SKILL.md */
      const skillDir = resolve(dirname(filePath))
      const root = dirname(skillDir)
      const inGlobal = root === resolve(readPrefs().globalDir)
      const inProject = /(?:^|[\\/])\.agents[\\/]skills$/.test(root)
      if (basename(filePath) !== 'SKILL.md' || (!inGlobal && !inProject)) throw httpError(403, 'not a togglable skill file')
      setDisabled(filePath, Boolean(body.disable))
      return { success: true }
    },

    'POST /skills/install': async ({ body }) => {
      const pkg = String(body.package || '').trim()
      if (!pkg) throw httpError(400, 'package required')
      const isGlobal = body.scope !== 'project'
      const cwd = isGlobal ? undefined : String(body.cwd || '')
      const r = await runNpx(installArgs(pkg, isGlobal), cwd || undefined)
      const ok = r.code === 0 && /Installation complete|Installed \d+ skill|already installed/i.test(r.output)
      if (!ok) throw httpError(500, r.output.slice(-400) || `install failed (${r.code})`)
      return { success: true, output: r.output.slice(-400) }
    },

    'POST /skills/update': async ({ body }) => {
      const pkg = String(body.package || '')
      const cwd = String(body.cwd || '')
      const { skills } = listSkills(cwd)
      const skill = skills.find((s) => s.install && s.install.package === pkg && s.install.scope === body.scope)
      if (!skill || !skill.install) throw httpError(404, 'Installed skill not found')
      const r = await runNpx(updateArgs(skill.install), skill.install.scope === 'project' ? cwd : undefined)
      if (r.code !== 0) throw httpError(500, r.output.slice(-400) || `update failed (${r.code})`)
      const fresh = listSkills(cwd).skills.find((s) => s.install && s.install.package === pkg && s.install.scope === body.scope)
      return { success: true, versionHash: fresh && fresh.install ? fresh.install.versionHash : undefined }
    },

    'POST /skills/search': async ({ body }) => {
      const query = String(body.query || '').trim()
      if (!query) throw httpError(400, 'query required')
      return { results: await searchSkills(query, 50) }
    },

    'GET /skills/prefs': () => {
      const prefs = readPrefs()
      return { globalDir: prefs.globalDir, defaultGlobalDir: DEFAULT_GLOBAL_DIR }
    },

    'POST /skills/prefs': ({ body }) => {
      const dir = String(body.globalDir || '').trim()
      if (!dir) throw httpError(400, 'globalDir required')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writePrefs({ globalDir: dir })
      return { success: true, globalDir: dir }
    },
  }
}
