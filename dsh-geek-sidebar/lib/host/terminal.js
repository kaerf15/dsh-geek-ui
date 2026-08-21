/**
 * dsh-geek-sidebar 终端：node-pty 进程表 + WebSocket 升级挂载。
 * 每个 `${sessionId}:${tabId}` 一键一进程；断开宽限 30s 重连（刷新/切 tab 进程不死）；
 * transcript 1MB 环形回放（参考 DSH-better-sidebar 的 PtyManager 语义，精简移植）。
 * node-pty / ws 经 createRequire(process.execPath) 从 dsh 安装解析，插件自身零依赖。
 */
import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { userInfo } from 'node:os'
import { checkOrigin } from './http.js'
import { makeRequire } from './host-require.js'

/* node-pty / ws 经共享的 host-require 从宿主环境解析（评审修复：原本地 makeRequire
 * 与 acp.js 各抄一份且行为不一致，收敛到 host-require.js，解析链注释见该文件） */
const req = makeRequire()
const nodePty = req('node-pty')
const { WebSocketServer } = req('ws')

const TRANSCRIPT_LIMIT = 1 << 20

/* pnpm 会剥掉 node-pty 预编译 spawn-helper 的可执行位（macOS），补回（幂等） */
function ensureSpawnHelper() {
  if (process.platform === 'win32') return
  try {
    const entry = req.resolve('node-pty')
    const root = dirname(dirname(entry))
    for (const h of [
      join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
      join(root, 'build', 'Release', 'spawn-helper'),
    ]) {
      if (existsSync(h)) chmodSync(h, 0o755)
    }
  } catch { /* 终端会把 spawn 错误抛给前端 */ }
}

/* 解析登录 shell：$SHELL → passwd 登录 shell → /bin/bash；Windows 直接 powershell */
function defaultShell() {
  if (process.platform === 'win32') return 'powershell.exe'
  const s = process.env.SHELL
  if (s && s.trim()) return s
  try {
    const ls = userInfo().shell
    if (ls && ls.trim()) return ls
  } catch { /* 无 passwd 条目 */ }
  return '/bin/bash'
}

class PtyManager {
  constructor(shell, maxPerSession, maxTotal) {
    this.shell = shell
    this.max = maxPerSession
    /* 评审修复：全局总上限——per-session 配额按客户端自报 sessionId 计数，
     * 换随机 sessionId 即可绕过；总量兜底防 PTY 耗尽 */
    this.maxTotal = maxTotal || 16
    this.map = new Map()
    this.closes = new Map()
  }
  cancelClose(key) {
    const t = this.closes.get(key)
    if (t) {
      clearTimeout(t)
      this.closes.delete(key)
    }
  }
  open(sessionId, tabId, cwd, cols, rows) {
    const key = `${sessionId}:${tabId}`
    this.cancelClose(key)
    const ex = this.map.get(key)
    if (ex && !ex.exited && ex.cwd === cwd) return ex
    if (ex) this.close(key)
    /* 清掉本会话已退出的进程，别让它们吃配额 */
    for (const [k, h] of [...this.map]) if (h.sessionId === sessionId && h.exited) this.close(k)
    const count = [...this.map.values()].filter((h) => h.sessionId === sessionId).length
    if (count >= this.max) {
      const e = new Error(`terminal limit reached (${this.max}) for this session`)
      e.code = 400
      throw e
    }
    /* 评审修复：全局总量判定前先收割所有已退出进程（别只吃本会话的），再查总上限 */
    for (const [k, h] of [...this.map]) if (h.exited) this.close(k)
    if (this.map.size >= this.maxTotal) {
      const e = new Error(`terminal global limit reached (${this.maxTotal})`)
      e.code = 400
      throw e
    }
    const h = {
      key,
      sessionId,
      tabId,
      cwd,
      exited: false,
      exitCode: undefined,
      transcript: '',
      pty: nodePty.spawn(this.shell, process.platform === 'win32' ? [] : ['-l'], {
        name: 'xterm-256color',
        cols: Math.max(2, cols | 0),
        rows: Math.max(2, rows | 0),
        cwd,
        env: { ...process.env },
      }),
    }
    h.pty.onData((d) => {
      h.transcript += d
      if (h.transcript.length > TRANSCRIPT_LIMIT) h.transcript = h.transcript.slice(-TRANSCRIPT_LIMIT)
    })
    h.pty.onExit(({ exitCode }) => {
      h.exited = true
      h.exitCode = exitCode
    })
    this.map.set(key, h)
    return h
  }
  scheduleClose(key, ms) {
    if (!this.map.has(key)) return
    this.cancelClose(key)
    this.closes.set(key, setTimeout(() => this.close(key), ms))
  }
  close(key) {
    this.cancelClose(key)
    const h = this.map.get(key)
    if (!h) return
    this.map.delete(key)
    try {
      h.pty.kill()
    } catch { /* 已退出 */ }
  }
  disposeAll() {
    for (const t of this.closes.values()) clearTimeout(t)
    this.closes.clear()
    for (const k of [...this.map.keys()]) this.close(k)
  }
}

export function createTerminalManager(maxPerSession, maxTotal) {
  ensureSpawnHelper()
  /* 评审修复：maxTotal（全局总上限）默认 16，与 maxPerSession 同风格构造参数 */
  return new PtyManager(defaultShell(), maxPerSession || 4, maxTotal)
}

/* WS 升级端点：GET /__dsh-geek-sidebar__/wb/terminal-ws?sessionId=&tab=&cwd=&cols=&rows=
 * 协议（与参考实现同构）：连接即回放 transcript，然后转发实时输出；
 * client→host：文本帧 = 输入；{"type":"resize","cols","rows"} = 改尺寸；
 * 启动失败以 1011 + reason 关闭（前端据此前展示错误横幅）。 */
export function mountTerminal(ctx, mgr) {
  const wss = new WebSocketServer({ noServer: true })
  /* 评审修复：跟踪存活连接——Fiber 卸载（dispose）时除撤路由/杀进程外还要断开
   * 连接，否则客户端挂着连死 PTY 的 socket 直到 TCP 超时 */
  const live = new Set()
  const disposeRoute = ctx.webServer.registerUpgrade({
    path: '/__dsh-geek-sidebar__/wb/terminal-ws',
    handler: (req, socket, head) => {
      /* 同源护栏（评审修复：WS 是 PTY 直通，跨站页面一条连接即登录 shell） */
      if (!checkOrigin(req)) { socket.destroy(); return }
      wss.handleUpgrade(req, socket, head, (ws) => {
        try {
          live.add(ws)
          const url = new URL(req.url || '/', 'http://localhost')
          const q = url.searchParams
          const sessionId = String(q.get('sessionId') || '_')
          const tabId = String(q.get('tab') || 'main')
          const cwd = String(q.get('cwd') || '') || process.env.HOME || '/'
          const cols = Math.max(2, Number(q.get('cols')) || 80)
          const rows = Math.max(2, Number(q.get('rows')) || 24)
          let h
          try {
            h = mgr.open(sessionId, tabId, cwd, cols, rows)
          } catch (e) {
            ws.close(1011, String((e && e.message) || e).slice(0, 120))
            return
          }
          /* 评审修复：先订阅实时输出再回放 transcript——原顺序（先回放后订阅）在
           * 两行之间到达的数据既不在快照里也不会被推送；onData 回调走事件循环，
           * 本同步块内不会触发，故先订阅无重复、无间隙 */
          const offData = h.pty.onData((d) => {
            try {
              ws.send(d)
            } catch { /* socket 已走 */ }
          })
          if (h.transcript) ws.send(h.transcript)
          ws.on('message', (data, isBinary) => {
            if (h.exited) return
            const text = isBinary ? data.toString('utf8') : String(data)
            if (text.charAt(0) === '{') {
              try {
                const j = JSON.parse(text)
                if (j && j.type === 'resize') {
                  h.pty.resize(Math.max(2, j.cols | 0), Math.max(2, j.rows | 0))
                  return
                }
              } catch { /* 非 JSON，按输入处理 */ }
            }
            try {
              h.pty.write(text)
            } catch { /* pty 已走 */ }
          })
          const cleanup = () => {
            live.delete(ws)
            try {
              offData.dispose()
            } catch { /* 已释放 */ }
          }
          ws.on('close', () => {
            cleanup()
            mgr.scheduleClose(h.key, 30000)
          })
          ws.on('error', cleanup)
        } catch (e) {
          live.delete(ws)
          try {
            ws.close(1011, String((e && e.message) || e).slice(0, 120))
          } catch { /* socket 已走 */ }
        }
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
