/**
 * dsh-archive-manager /wb/*：归档会话的「放回对话」与「永久删除」。
 *
 * 平台 0.1.2-rc.1 的归档是单向的（installed README：no unarchive action exists yet），
 * 也没有公开的会话删除；放回/删除都经 workspace registry 的 JS 层私有方法
 *（TS private 仅编译期，构建产物 lib/index.js 已确认方法名未混淆）在 enqueueOperation
 * 串行化下重写 archivedSessionIds；setState → storageDomain global.set 会发 domain/changed，
 * WorkspaceFeed 照常推 archived 帧回 client，前端无感刷新。
 *
 * 脆弱点登记（0.1.2-rc.1）——平台升级先核对：
 *  - 服务名 workspaceRegistry、方法 requireState/setState/enqueueOperation、状态字段 archivedSessionIds；
 *  - Remote 事件 api-session/removed（删除后通知 client 从会话列表剔除，防其在对话列表里复活）；
 *  - 会话落盘目录布局 sessions/<projectKey(cwd)>/<encodeSegment(id)>/（对齐 dsh-session-persistence-jsonl）。
 */
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { httpError } from './http.js'

/* ---------- 会话落盘目录（对齐 @deepseek-ai/dsh-session-persistence-jsonl/format） ---------- */
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
  const expandHome = (p) => (p === '~' ? homedir() : (p.startsWith('~/') ? homedir() + p.slice(1) : p))
  const selected = env !== undefined && env.trim().length > 0 ? env : join(homedir(), '.dsh')
  return resolve(expandHome(selected))
}

/* 会话所在文件夹的绝对路径；cwd 缺失时归入 _no-cwd 桶（与 projectDir 一致）。 */
function sessionDirPath(cwd, id) {
  const root = join(resolveDshHome(), 'sessions')
  const proj = cwd == null || cwd === '' ? join(root, '_no-cwd') : join(root, projectKey(cwd))
  return join(proj, encodeSegment(String(id)))
}

/* workspace registry 私有面统一取用（可选注入走 ctx.get，绝不能写进 inject——见 geek-sidebar 教训）。 */
function workspaceRegistryOf(ctx) {
  return ctx && typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : null
}

/* 抽公共：校验 registry 私有面可用，否则 503。两路由原先各拷一份四连 && 检查，收敛于此。 */
function workspaceOrThrow(ctx) {
  const ws = workspaceRegistryOf(ctx)
  if (!ws || typeof ws.requireState !== 'function' || typeof ws.setState !== 'function' || typeof ws.enqueueOperation !== 'function') {
    throw httpError(503, 'workspace registry unavailable')
  }
  return ws
}

/* 两路由一致的「解除该会话的归档」步骤。返回 { ids, removed }：
 * removed 表示该 id 原先确在归档集中（供 delete 路由 fail-closed 判断，避免误删未归档会话）。 */
async function removeFromArchive(ws, id) {
  return ws.enqueueOperation(async () => {
    const st = ws.requireState()
    const filtered = st.archivedSessionIds.filter((x) => String(x) !== id)
    const removed = filtered.length !== st.archivedSessionIds.length
    if (removed) await ws.setState({ ...st, archivedSessionIds: filtered })
    return { ids: filtered.map(String), removed }
  })
}

export function archiveApi(ctx) {
  return {
    /* ---------- 放回对话（解除归档） ---------- */
    'POST /wb/unarchiveSession': async ({ body }) => {
      const id = String((body && body.id) || '')
      if (!id) throw httpError(400, 'session id required')
      const ws = workspaceOrThrow(ctx)
      let result
      try {
        result = await removeFromArchive(ws, id)
      } catch (e) {
        throw httpError(500, 'unarchive failed: ' + (e && e.message ? e.message : String(e)))
      }
      return { ok: true, ids: result.ids }
    },

    /* ---------- 永久删除 ---------- */
    'POST /wb/deleteSession': async ({ body }) => {
      const id = String((body && body.id) || '')
      if (!id) throw httpError(400, 'session id required')
      const cwd = body && body.cwd ? String(body.cwd) : null
      const ws = workspaceOrThrow(ctx)
      let result
      try {
        result = await removeFromArchive(ws, id)
      } catch (e) {
        throw httpError(500, 'delete failed: ' + (e && e.message ? e.message : String(e)))
      }
      /* fail-closed：仅当该 id 原先确在归档集中才继续；否则 404，
       * 防止该路由被用来删掉仍在使用的未归档会话（也避免误删）。 */
      if (!result.removed) throw httpError(404, 'session not in archive')
      /* 通知 client 会话已移除（api-session/removed Remote 事件；emit 沿 ctx 冒泡到根、由网关转发）。
       * 不解除归档的话，删除后会话会因 byId 残留而在对话列表里复活，故必须同发。 */
      try { ctx.emit('api-session/removed', id) } catch (e) { console.warn('[dsh-archive-manager] api-session/removed emit failed:', String(e)) }
      /* 删除会话落盘目录（session.jsonl.zstd 等）。若会话仍在运行，下次 checkpoint 可能重写目录，
       * 属已知边界：归档中被删除的会话通常已结束。rmSync force 对不存在的目录是 no-op。 */
      rmSync(sessionDirPath(cwd, id), { recursive: true, force: true })
      return { ok: true, ids: result.ids }
    },
  }
}