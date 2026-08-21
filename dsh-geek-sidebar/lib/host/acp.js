/**
 * dsh-geek-sidebar ACP（Agent Client Protocol）host：agent 子进程注册表 + WS 转发。
 * 与 terminal.js 同构：每个 ACP 会话 = 一个 agent 子进程（pipe stdio，ndjson JSON-RPC 2.0），
 * 生命周期/配额/断线宽限语义照搬 PtyManager；传输必须是干净管道（pty 会污染协议流）。
 *
 * 线协议（与前端约定，JSON 文本帧）：
 *   client→host：{type:'prompt',text,images?} / {type:'cancel'}
 *                / {type:'permission',requestId,optionId}
 *                / {type:'list_sessions'} / {type:'load_session',sessionId}
 *                / {type:'set_mode',modeId} / {type:'set_config',configId,value}
 *                / {type:'new_session'} / {type:'fork_session'} / {type:'delete_session',sessionId}
 *   host→client：{type:'hello',agent,sessionId,cwd,modes,configOptions,capabilities,agentInfo}
 *                / {type:'replay',events} / {type:'update',update}
 *                / {type:'turn_end',stopReason} / {type:'permission',requestId,title,options}
 *                / {type:'sessions',sessions} / {type:'loaded',sessionId}
 *                / {type:'config',modes,configOptions,sessionId}
 *                / {type:'note',message} / {type:'session_deleted',sessionId}
 *                / {type:'error',message} / {type:'exit',code}
 *
 * 进程按 session:agent:cwd 三维复用——前端每个智能体 tab 一个 key（tab id 作 session），
 * 换目录即换进程；旧进程由断线宽限定时器回收（detach 后 30s 无挂载即杀）。
 * 注意：upgrade handler 必须全同步返回——平台包装对"慢 handler"会掐连接（空回复）。
 * 所以 attach 走后台 promise，握手先完成，hello/replay 就绪后再推。
 */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { checkOrigin } from './http.js'
import { makeRequire } from './host-require.js'

/* 评审修复：makeRequire 收敛到共享的 host-require.js（原 acp 版少 import.meta.url
 * 保底候选，与 terminal.js 行为不一致；解析链注释见 host-require.js） */
const { WebSocketServer } = makeRequire()('ws')

/* 智能体注册表：目前只接 Kimi Code（其余 ACP agent 需要时再入册）。
 * candidates 为可执行体候选（裸名走 PATH，绝对路径兜底——dsh 进程的 PATH 不一定含用户 CLI 目录） */
export const AGENTS = [
  { id: 'kimi', name: 'Kimi Code', candidates: ['kimi', join(homedir(), '.kimi-code', 'bin', 'kimi')], args: ['acp'] },
]

/* 解析可执行体：裸名交给 PATH；绝对路径取第一个存在的；都不存在退回首候选让 spawn 报直观错误 */
function resolveCmd(agent) {
  for (const c of agent.candidates) {
    if (c.indexOf('/') < 0) return c
    if (existsSync(c)) return c
  }
  return agent.candidates[0]
}

const EVENT_LIMIT = 500
const RPC_TIMEOUT_MS = 30000
const IMAGE_MAX_BYTES = 8 * 1024 * 1024

class AcpProcess {
  constructor(agent, key, cwd) {
    this.agent = agent
    this.key = key
    this.cwd = cwd
    this.sessionId = null
    this.init = null /* initialize 响应（agentCapabilities/authMethods/agentInfo） */
    this.modes = null /* session/new 响应的 modes（default/plan/auto/yolo） */
    this.configOptions = null /* session/new 响应的 configOptions（model/thinking/mode） */
    this.ready = false
    this.exited = false
    this.events = []
    this.pendingRpc = new Map()
    this.rpcId = 0
    this.turnActive = false /* session/prompt 在途：分级宽限——运行中进程不被 30s 断线定时器杀 */
    this.pendingClose = false /* 运行中收到过关闭请求：轮次结束后由 turnSettled 补数 30s */
    /* 评审修复：POSIX 下 detached 使子进程成为进程组长，kill() 时整组击杀，
     * agent 拉起的孙进程（MCP server 等）能一并回收；Windows 无此语义保持默认 */
    this.child = spawn(resolveCmd(agent), agent.args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: { ...process.env },
    })
    const onDead = (err) => {
      const wasExited = this.exited
      this.exited = true
      if (err) this.lastError = String(err && err.message ? err.message : err)
      /* 进程一死，挂起的 RPC 立刻全部失败（不等 30s 超时） */
      const why = this.lastError ? new Error(this.lastError) : new Error('agent process exited')
      for (const p of this.pendingRpc.values()) {
        try {
          p.reject(why)
        } catch { /* 已结算 */ }
      }
      this.pendingRpc.clear()
      if (!wasExited && this.onExit) {
        try {
          this.onExit(this.exitCode)
        } catch { /* 广播失败不致命 */ }
      }
    }
    this.child.on('error', onDead)
    this.child.on('exit', (code) => {
      this.exitCode = code
      onDead()
    })
    this.lines = createInterface({ input: this.child.stdout })
    this.lines.on('line', (line) => this.onLine(line))
    this.stderrBuf = ''
    this.child.stderr.on('data', (d) => {
      this.stderrBuf = (this.stderrBuf + d).slice(-4000)
    })
    /* stdin 写失败（ENOENT/EPIPE）不外溢为未捕获异常 */
    this.child.stdin.on('error', () => {})
  }
  onLine(line) {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return /* 非 JSON 行（启动噪声）忽略 */
    }
    if (msg.method === 'session/update' && msg.params) {
      const update = msg.params.update
      if (this.onUpdate) this.onUpdate(update)
      return
    }
    if (msg.method === 'session/request_permission' && msg.id !== undefined) {
      if (this.onPermission) this.onPermission(msg)
      return
    }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRpc.get(msg.id)
      if (pending) {
        this.pendingRpc.delete(msg.id)
        if (msg.error) pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else pending.resolve(msg.result)
      }
      return
    }
    /* 评审修复：agent 侧发起的未知请求（带 id 带 method）回 JSON-RPC method-not-found——
     * 原先静默丢弃且永不回响应，agent 端该请求永久挂起（协议演进即死锁）；
     * 通知（无 id）维持静默 */
    if (msg.method && msg.id !== undefined) {
      try {
        this.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found: ' + String(msg.method) } })
      } catch { /* stdin 已走 */ }
    }
  }
  send(obj) {
    this.child.stdin.write(JSON.stringify(obj) + '\n')
  }
  rpc(method, params, timeoutMs) {
    const id = ++this.rpcId
    return new Promise((resolve, reject) => {
      /* 第三个参数可关超时（传 0）：session/prompt 的响应要等整轮回答结束才返回，
       * 通用 30s 超时会把正常长生成误判为失败——红字报错而 turn 实际仍在跑（实测）。
       * 长任务的生命周期由 update/turn_end/session/cancel/onExit 管理，不需要 RPC 级看门狗。 */
      const t0 = typeof timeoutMs === 'number' ? timeoutMs : RPC_TIMEOUT_MS
      const timer =
        t0 > 0
          ? setTimeout(() => {
              this.pendingRpc.delete(id)
              reject(new Error(method + ' timeout'))
            }, t0)
          : null
      this.pendingRpc.set(id, {
        resolve: (v) => {
          if (timer) clearTimeout(timer)
          resolve(v)
        },
        reject: (e) => {
          if (timer) clearTimeout(timer)
          reject(e)
        },
      })
      this.send({ jsonrpc: '2.0', id, method, params })
    })
  }
  async start() {
    this.init = await this.rpc('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      clientInfo: { name: 'dsh-geek-sidebar', version: '1.3.0' },
    })
    const r = await this.rpc('session/new', { cwd: this.cwd, mcpServers: [] })
    this.sessionId = r && r.sessionId
    this.modes = (r && r.modes) || null
    this.configOptions = (r && r.configOptions) || null
    this.ready = true
    return this
  }
  async prompt(blocks) {
    /* 关 RPC 超时（0）：响应 = 整轮回答结束，长生成/多工具可跑数分钟（实测 30s 必误报） */
    const r = await this.rpc('session/prompt', { sessionId: this.sessionId, prompt: blocks }, 0)
    return r
  }
  cancel() {
    this.send({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.sessionId } })
  }
  answerPermission(requestId, optionId) {
    this.send({ jsonrpc: '2.0', id: requestId, result: { outcome: { outcome: 'selected', optionId } } })
  }
  kill() {
    /* 评审修复：杀整个进程组（spawn detached 使子进程成为组长），agent 拉起的
     * 孙进程（MCP server 等）一并回收；组已不在则退杀直接子进程。
     * Windows 无 POSIX 进程组语义，维持杀直接子进程 */
    try {
      if (process.platform === 'win32') this.child.kill('SIGKILL')
      else process.kill(-this.child.pid, 'SIGKILL')
    } catch {
      try {
        this.child.kill('SIGKILL')
      } catch { /* 已退出 */ }
    }
  }
}

class AcpManager {
  constructor(maxPerKey) {
    this.max = maxPerKey || 8
    this.map = new Map()
    this.closes = new Map()
    this.sockets = new Map() /* key -> Set<ws>（广播事件给全部挂载者） */
    this.starting = new Map() /* key -> 启动 promise（并发 attach 防双进程，评审修复） */
  }
  agentOf(id) {
    return AGENTS.find((a) => a.id === id) || null
  }
  cancelClose(key) {
    const t = this.closes.get(key)
    if (t) {
      clearTimeout(t)
      this.closes.delete(key)
    }
  }
  get(key) {
    return this.map.get(key)
  }
  async attach(agentId, key, cwd, ws) {
    this.cancelClose(key)
    let h = this.map.get(key)
    if (h && (h.exited || h.agent.id !== agentId)) {
      this.close(key)
      h = undefined
    }
    /* 同 key 并发 attach 等同一个启动 promise（评审修复：原先 await start() 之后才
     * map.set——双 attach 双 spawn，先完成者丢引用永久泄漏，配额也被绕过） */
    if (!h && this.starting.has(key)) {
      await this.starting.get(key)
      h = this.map.get(key)
    }
    if (!h) {
      const agent = this.agentOf(agentId)
      if (!agent) {
        const e = new Error('unknown agent: ' + agentId)
        e.code = 400
        throw e
      }
      if (this.map.size >= this.max) {
        const e = new Error(`agent process limit reached (${this.max})`)
        e.code = 400
        throw e
      }
      h = new AcpProcess(agent, key, cwd)
      h.onUpdate = (update) => this.broadcast(key, { type: 'update', update })
      h.onExit = (code) => this.broadcast(key, { type: 'exit', code })
      h.onPermission = (msg) => {
        const p = (msg.params && (msg.params.toolCall || msg.params)) || {}
        this.broadcast(key, {
          type: 'permission',
          requestId: msg.id,
          title: p.title || '权限请求',
          options: (msg.params && msg.params.options) || [],
        })
      }
      /* 先登记占位再启动：配额立即计数，并发 attach 走上面 starting 等待 */
      this.map.set(key, h)
      const p = h.start().catch((err) => {
        if (this.map.get(key) === h) this.map.delete(key)
        throw err
      })
      this.starting.set(key, p)
      try {
        await p
      } finally {
        if (this.starting.get(key) === p) this.starting.delete(key)
      }
    }
    if (!this.sockets.has(key)) this.sockets.set(key, new Set())
    this.sockets.get(key).add(ws)
    return h
  }
  detach(key, ws) {
    const set = this.sockets.get(key)
    if (set) {
      set.delete(ws)
      if (set.size === 0) {
        this.sockets.delete(key)
        this.scheduleClose(key, 30000)
      }
    }
  }
  broadcast(key, obj) {
    const set = this.sockets.get(key)
    if (!set) return
    const h = this.map.get(key)
    if (h && obj.type === 'update') {
      h.events.push(obj.update)
      if (h.events.length > EVENT_LIMIT) h.events.splice(0, h.events.length - EVENT_LIMIT)
    }
    const text = JSON.stringify(obj)
    for (const ws of set) {
      try {
        ws.send(text)
      } catch { /* socket 已走 */ }
    }
  }
  scheduleClose(key, ms) {
    if (!this.map.has(key)) return
    this.cancelClose(key)
    const h = this.map.get(key)
    /* 分级宽限（用户决策 2026-08）：prompt 在途的进程不杀——挂起关闭，等轮次结束再数 30s。
     * 空闲进程维持原宽限；运行中刷新超 30s 任务白跑是最亏路径。 */
    if (h && h.turnActive) {
      h.pendingClose = true
      return
    }
    this.closes.set(key, setTimeout(() => this.close(key), ms))
  }
  /* 轮次结束（prompt RPC 落地，含 cancel/失败）：补做被挂起的关闭 */
  turnSettled(key) {
    const h = this.map.get(key)
    if (!h || !h.pendingClose) return
    h.pendingClose = false
    const set = this.sockets.get(key)
    if (!set || !set.size) this.scheduleClose(key, 30000)
  }
  close(key) {
    this.cancelClose(key)
    const h = this.map.get(key)
    if (h) {
      this.map.delete(key)
      h.kill()
    }
    this.sockets.delete(key)
  }
  disposeAll() {
    for (const t of this.closes.values()) clearTimeout(t)
    this.closes.clear()
    this.starting.clear()
    for (const k of [...this.map.keys()]) this.close(k)
  }
}

export function createAcpManager(max) {
  return new AcpManager(max)
}

/* WS 端点：/wb/acp-ws?agent=kimi&session=<tabId>&cwd=<dir>
 * handler 同步返回，attach 走后台 promise（见文件头说明）。 */
export function mountAcp(ctx, mgr) {
  const wss = new WebSocketServer({ noServer: true })
  /* 评审修复：跟踪存活连接——Fiber 卸载（dispose）时除撤路由/杀进程外还要断开
   * 连接，否则客户端挂着连死进程的 socket 直到 TCP 超时 */
  const live = new Set()
  const disposeRoute = ctx.webServer.registerUpgrade({
    path: '/__dsh-geek-sidebar__/wb/acp-ws',
    handler: (req, socket, head) => {
      /* 同源护栏（评审修复：WS 是 agent 子进程直通，跨站页面可直发 prompt） */
      if (!checkOrigin(req)) { socket.destroy(); return }
      wss.handleUpgrade(req, socket, head, (ws) => {
        live.add(ws)
        const url = new URL(req.url || '/', 'http://localhost')
        const q = url.searchParams
        const agentId = String(q.get('agent') || 'kimi')
        const cwd = String(q.get('cwd') || '') || homedir()
        const key = String(q.get('session') || '_') + ':' + agentId + ':' + cwd
        let alive = true
        const safeClose = (code, reason) => {
          try {
            ws.close(code, String(reason).slice(0, 120))
          } catch { /* socket 已走 */ }
        }
        mgr
          .attach(agentId, key, cwd, ws)
          .then((h) => {
            if (!alive) return
            try {
              ws.send(
                JSON.stringify({
                  type: 'hello',
                  agent: h.agent.id,
                  sessionId: h.sessionId,
                  cwd: h.cwd,
                  modes: h.modes,
                  configOptions: h.configOptions,
                  capabilities: (h.init && h.init.agentCapabilities) || null,
                  agentInfo: (h.init && h.init.agentInfo) || null,
                }),
              )
              if (h.events.length) ws.send(JSON.stringify({ type: 'replay', events: h.events.slice() }))
            } catch { /* socket 已走 */ }
          })
          .catch((e) => {
            let why = String((e && e.message) || e)
            /* kimi 未安装/不在 PATH：ENOENT 翻译成人话，引导而非抛错 */
            if (/ENOENT/.test(why)) why = '未找到 kimi 命令：请先安装 Kimi Code CLI（或确认其在 PATH 中），再点"立即重连"。[' + why + ']'
            safeClose(1011, why)
          })
        const fail = (what) => (e) => mgr.broadcast(key, { type: 'error', message: what + ': ' + String((e && e.message) || e) })
        ws.on('message', (data) => {
          let msg
          try {
            msg = JSON.parse(String(data))
          } catch {
            return
          }
          const cur = mgr.get(key)
          if (!cur || cur.exited) return
          try {
            if (msg.type === 'prompt' && (typeof msg.text === 'string' || Array.isArray(msg.images))) {
              /* prompt 内容块：图片块在前（kimi image capability 已探明为 true），文本块在后 */
              const blocks = []
              if (Array.isArray(msg.images)) {
                for (const im of msg.images.slice(0, 4)) {
                  if (im && typeof im.data === 'string' && im.data.length > 0 && im.data.length < IMAGE_MAX_BYTES) {
                    blocks.push({ type: 'image', data: im.data, mimeType: String(im.mimeType || 'image/png') })
                  }
                }
              }
              if (typeof msg.text === 'string' && msg.text.trim()) blocks.push({ type: 'text', text: msg.text })
              if (!blocks.length) return
              cur.turnActive = true
              cur
                .prompt(blocks)
                .then((r) => mgr.broadcast(key, { type: 'turn_end', stopReason: (r && r.stopReason) || 'end_turn' }))
                .catch(fail('prompt'))
                .finally(() => {
                  cur.turnActive = false
                  mgr.turnSettled(key)
                })
            } else if (msg.type === 'cancel') {
              cur.cancel()
            } else if (msg.type === 'permission' && msg.requestId !== undefined) {
              cur.answerPermission(msg.requestId, String(msg.optionId || ''))
            } else if (msg.type === 'list_sessions') {
              /* kimi 的 session/list 不按 cwd 过滤（已实测），过滤交给前端 */
              cur
                .rpc('session/list', {})
                .then((r) => mgr.broadcast(key, { type: 'sessions', sessions: (r && r.sessions) || [] }))
                .catch(fail('session/list'))
            } else if (msg.type === 'load_session' && typeof msg.sessionId === 'string' && msg.sessionId) {
              /* 换会话：先清事件缓冲（kimi 会以 session/update 回放历史），load 成功后续 prompt 走新 sessionId */
              cur.events = []
              mgr.broadcast(key, { type: 'loaded', sessionId: msg.sessionId })
              cur
                .rpc('session/load', { sessionId: msg.sessionId, cwd: cur.cwd, mcpServers: [] })
                .then((r) => {
                  cur.sessionId = msg.sessionId
                  if (r && r.modes) cur.modes = r.modes
                  if (r && r.configOptions) cur.configOptions = r.configOptions
                  mgr.broadcast(key, { type: 'config', sessionId: cur.sessionId, modes: cur.modes, configOptions: cur.configOptions })
                })
                .catch(fail('session/load'))
            } else if (msg.type === 'set_mode' && typeof msg.modeId === 'string' && msg.modeId) {
              /* 成功后 kimi 会发 current_mode_update / config_option_update 通知，经 update 帧自然回流 */
              cur.rpc('session/set_mode', { sessionId: cur.sessionId, modeId: msg.modeId }).catch(fail('set_mode'))
            } else if (msg.type === 'set_config' && typeof msg.configId === 'string' && msg.configId) {
              cur
                .rpc('session/set_config_option', { sessionId: cur.sessionId, configId: msg.configId, value: msg.value })
                .then((r) => {
                  if (r && r.configOptions) {
                    cur.configOptions = r.configOptions
                    mgr.broadcast(key, { type: 'config', sessionId: cur.sessionId, modes: cur.modes, configOptions: cur.configOptions })
                  }
                })
                .catch(fail('set_config_option'))
            } else if (msg.type === 'new_session') {
              /* 同目录新会话：先 rpc 成功再清缓冲/视图（失败不丢当前会话） */
              cur
                .rpc('session/new', { cwd: cur.cwd, mcpServers: [] })
                .then((r) => {
                  cur.sessionId = r && r.sessionId
                  if (r && r.modes) cur.modes = r.modes
                  if (r && r.configOptions) cur.configOptions = r.configOptions
                  cur.events = []
                  mgr.broadcast(key, { type: 'loaded', sessionId: cur.sessionId })
                  mgr.broadcast(key, { type: 'config', sessionId: cur.sessionId, modes: cur.modes, configOptions: cur.configOptions })
                  mgr.broadcast(key, { type: 'note', message: '已开启新会话' })
                })
                .catch(fail('session/new'))
            } else if (msg.type === 'fork_session') {
              /* 分叉：副本带完整上下文（已实测），切 sessionId 即可，无需回放——当前视图内容一致 */
              cur
                .rpc('session/fork', { sessionId: cur.sessionId, cwd: cur.cwd, mcpServers: [] })
                .then((r) => {
                  if (!r || !r.sessionId) throw new Error('fork 未返回 sessionId')
                  cur.sessionId = r.sessionId
                  if (r.modes) cur.modes = r.modes
                  if (r.configOptions) cur.configOptions = r.configOptions
                  mgr.broadcast(key, { type: 'config', sessionId: cur.sessionId, modes: cur.modes, configOptions: cur.configOptions })
                  mgr.broadcast(key, { type: 'note', message: '已分叉为新会话（原会话保留在历史列表）' })
                })
                .catch(fail('session/fork'))
            } else if (msg.type === 'delete_session' && typeof msg.sessionId === 'string' && msg.sessionId) {
              /* silent（空白清扫/关 tab 连删）= 家务删除：失败吞掉不广播——
               * 对话流里的 error 只留给用户显式两击删除（实测 kimi 跨 cwd 删除必 Internal error） */
              cur
                .rpc('session/delete', { sessionId: msg.sessionId })
                .then(() => mgr.broadcast(key, { type: 'session_deleted', sessionId: msg.sessionId }))
                .catch(msg.silent ? () => {} : fail('session/delete'))
            }
          } catch { /* 单帧失败不致命 */ }
        })
        ws.on('close', () => {
          alive = false
          live.delete(ws)
          mgr.detach(key, ws)
        })
        ws.on('error', () => {
          alive = false
          live.delete(ws)
          mgr.detach(key, ws)
        })
      })
    },
  })
  return () => {
    disposeRoute()
    for (const ws of live) {
      try {
        ws.close(1001, 'dsh-geek-sidebar unloading')
      } catch { /* 已走 */ }
    }
    live.clear()
  }
}
