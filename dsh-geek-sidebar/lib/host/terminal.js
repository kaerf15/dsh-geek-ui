/**
 * dsh-geek-sidebar 终端：node-pty 进程表 + WebSocket 升级挂载。
 * 每个 `${sessionId}:${tabId}` 一键一进程；断开宽限 30s 重连（刷新/切 tab 进程不死）；
 * transcript 1MB 环形回放（参考 DSH-better-sidebar 的 PtyManager 语义，精简移植）。
 * node-pty / ws 经 createRequire(process.execPath) 从 dsh 安装解析，插件自身零依赖。
 */
import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { userInfo, homedir } from 'node:os'
import { checkOrigin } from './http.js'

/* node-pty / ws 的解析链：dsh CLI 入口 → web profile 的 hoisted node_modules →
 * dsh 安装目录 → 插件自身。插件零依赖声明，运行时从宿主环境解析。 */
function makeRequire() {
  const candidates = []
  try { candidates.push(createRequire(process.argv[1] || import.meta.url)) } catch { /* 无 argv[1] */ }
  try { candidates.push(createRequire(join(homedir(), '.dsh', 'profiles', 'web', 'package.json'))) } catch { /* 无该 profile */ }
  try { candidates.push(createRequire('/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/package.json')) } catch { /* 非 homebrew 安装 */ }
  try { candidates.push(createRequire(import.meta.url)) } catch { /* 保底 */ }
  return (id) => {
    let lastErr
    for (const r of candidates) {
      try {
        return r(id)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr || new Error(id + ' unavailable')
  }
}
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
  constructor(shell, maxPerSession) {
    this.shell = shell
    this.max = maxPerSession
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

export function createTerminalManager(maxPerSession) {
  ensureSpawnHelper()
  return new PtyManager(defaultShell(), maxPerSession || 4)
}

/* WS 升级端点：GET /__dsh-geek-sidebar__/wb/terminal-ws?sessionId=&tab=&cwd=&cols=&rows=
 * 协议（与参考实现同构）：连接即回放 transcript，然后转发实时输出；
 * client→host：文本帧 = 输入；{"type":"resize","cols","rows"} = 改尺寸；
 * 启动失败以 1011 + reason 关闭（前端据此前展示错误横幅）。 */
export function mountTerminal(ctx, mgr) {
  const wss = new WebSocketServer({ noServer: true })
  return ctx.webServer.registerUpgrade({
    path: '/__dsh-geek-sidebar__/wb/terminal-ws',
    handler: (req, socket, head) => {
      /* 同源护栏（评审修复：WS 是 PTY 直通，跨站页面一条连接即登录 shell） */
      if (!checkOrigin(req)) { socket.destroy(); return }
      wss.handleUpgrade(req, socket, head, (ws) => {
        try {
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
          if (h.transcript) ws.send(h.transcript)
          const offData = h.pty.onData((d) => {
            try {
              ws.send(d)
            } catch { /* socket 已走 */ }
          })
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
          try {
            ws.close(1011, String((e && e.message) || e).slice(0, 120))
          } catch { /* socket 已走 */ }
        }
      })
    },
  })
}
