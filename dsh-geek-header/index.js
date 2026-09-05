/**
 * dsh-geek-header host 半：页头配套 HTTP 接口。
 *
 * 路由（webServer 前缀挂载，随 Fiber 回收）：
 *   POST /__dsh-geek-header__/title/refresh  { sessionId, provider?, model? }
 *     → pi-web 同款标题生成：整段对话（用户+助手文本，超长保首条+尾部截断）
 *       + 末尾追加 pi-web 原版指令，走 ctx.llm.stream 辅助调用；
 *       模型路由 = 请求体显式 provider/model（客户端 modelDirectories 报告的
 *       当前选中，含“换了还没发消息”的内存态），缺省回落会话 requestHeader。
 *     → 成功后经 sessionTitle.rename 落日志（投影广播，侧栏实时更新）。
 *
 * 平台 wire 只暴露 session.rename（手动改名），没有生成式标题 RPC，这条路由是自架通道。
 *
 * ── 私有面脆弱点登记（平台升级先核对这些）──
 *  1. session 事件读取走 session.snapshotEvents()（alpha.4 移除了 events getter）：
 *     user/message 的 data.source.kind==='user'、
 *     assistant/message 的 data.message.content 为块数组（text 块有 text 字段）。
 *  2. session.requestHeader() 返回 { config: { provider, model } }（缺省路由回落）。
 *  3. ctx.llm.stream 的 chunk 契约：text-delta / finish.reason.kind==='stop'。
 *  4. ctx.sessionTitle.rename(session, title) 返回 { title }。
 *
 * 错误约定：{ error: string } + 语义化状态码（400 参数 / 403 跨源 / 404 未知路由 / 409 会话不在线 / 422 无消息 / 502 模型失败）。
 */

export const name = 'dsh-geek-header'

/* webServer 挂载点；sessions 取活会话；llm 辅助调用；sessionTitle 落标题。缺一不启动。 */
export const inject = ['webServer', 'sessions', 'llm', 'sessionTitle']

/** pi-web auto-name 的原版指令（app/api/sessions/[id]/auto-name/route.ts），逐字保留。 */
const TITLE_INSTRUCTION = `Create a concise title for this session based on the conversation above.

Requirements:
- Match the primary language used by the user.
- Describe the user's concrete goal or the outcome, not the act of chatting.
- Use 4-12 words for space-separated languages, or 8-24 characters for CJK text when practical.
- Do not call any tools.
- Return only the title as plain text, with no quotes, label, markdown, or explanation.`

/** 对话上下文预算：超长会话保“首条用户消息（主题锚点）+ 尽量多的尾部消息”。 */
const MAX_CONTEXT_BYTES = 64 * 1024

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(obj))
}

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

/* 同源护栏（同 dsh-geek-sidebar 约定）：跨站请求必带 Origin，host 不一致即拒；
 * 无 Origin 的 loopback 脚本放行。 */
function checkOrigin(req) {
  const origin = req.headers && req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === String(req.headers.host || '')
  } catch {
    return false
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', (c) => {
      d += c
      if (d.length > 64 * 1024) { reject(httpError(413, 'body too large')); req.destroy() }
    })
    req.on('end', () => {
      if (!d.trim()) return resolve({})
      try { resolve(JSON.parse(d)) } catch { reject(httpError(400, 'invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

function blocksText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/* 会话日志 → 模型消息列表：用户文本（source.kind==='user'）+ 助手文本，跳过工具噪声。 */
function collectConversation(events) {
  const out = []
  let n = 0
  for (const ev of events) {
    let role
    let text = ''
    if (ev.type === 'user/message' && ev.data && ev.data.source && ev.data.source.kind === 'user') {
      role = 'user'
      text = blocksText(ev.data.content)
    } else if (ev.type === 'assistant/message' && ev.data && ev.data.message) {
      role = 'assistant'
      text = blocksText(ev.data.message.content)
    }
    if (!role || !text) continue
    out.push({
      id: 'dgu-title-' + (++n),
      role,
      content: [{ type: 'text', text }],
      source: role === 'user' ? { kind: 'user' } : { kind: 'model', provider: 'history', model: 'history' },
    })
  }
  return out
}

function fitBudget(messages) {
  const size = (m) => Buffer.byteLength(JSON.stringify(m.content), 'utf8')
  const firstUser = messages.findIndex((m) => m.role === 'user')
  const head = firstUser >= 0 ? [messages[firstUser]] : []
  let budget = MAX_CONTEXT_BYTES - head.reduce((s, m) => s + size(m), 0)
  const tail = []
  for (let i = messages.length - 1; i >= 0; i--) {
    if (i === firstUser) continue
    const s = size(messages[i])
    if (s > budget) break
    tail.unshift(messages[i])
    budget -= s
  }
  return [...head, ...tail]
}

/* 标题归一：取第一非空行，去引号/标记符号/末尾标点，80 字符截断。 */
function normalizeTitle(text) {
  const line = String(text).split('\n').map((s) => s.trim()).find((s) => s.length > 0) || ''
  return line.replace(/^[\s"'“”「」『』`*#]+|[\s"'“”「」『』`*#.!。！?？:：;；]+$/g, '').slice(0, 80)
}

async function generateTitle(ctx, session, body) {
  /* alpha.4 移除了 Session.events getter（→ snapshotEvents），读旧字段恒为 undefined。 */
  const conversation = fitBudget(collectConversation(session.snapshotEvents()))
  if (!conversation.some((m) => m.role === 'user')) throw httpError(422, '没有可用于命名的消息')
  const header = typeof session.requestHeader === 'function' ? session.requestHeader() : undefined
  const route = (typeof body.provider === 'string' && body.provider
      && typeof body.model === 'string' && body.model)
    ? { provider: body.provider, model: body.model }
    : header && header.config
      ? { provider: header.config.provider, model: header.config.model }
      : undefined
  if (!route) throw httpError(409, '会话还没有可用的模型路由')
  const ask = {
    id: 'dgu-title-ask',
    role: 'user',
    content: [{ type: 'text', text: TITLE_INSTRUCTION }],
    source: { kind: 'plugin', plugin: 'dsh-geek-header' },
  }
  let text = ''
  let failure
  for await (const chunk of ctx.llm.stream({
    provider: route.provider,
    model: route.model,
    messages: [...conversation, ask],
    // Reasoning models (GLM/DeepSeek on Turing 等) burn tokens on
    // reasoning_content before emitting any title text: 128 会被思考耗尽,
    // 最终以 finish=length 空内容收场 → 用户看到「生成失败」。2048 留给
    // 思考 + 短标题足够;真的超长仍按失败处理。
    maxTokens: 2048,
    sessionId: session.id,
    purpose: 'session-title',
    signal: AbortSignal.timeout(60000),
  })) {
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind !== 'stop') failure = chunk.reason
  }
  if (failure) {
    const detail = failure.kind === 'length'
      ? 'length（模型思考占满输出上限，未产出标题）'
      : failure.failure && failure.failure.message ? failure.failure.message : failure.kind
    throw httpError(502, '标题生成中断: ' + String(detail))
  }
  const title = normalizeTitle(text)
  if (!title) throw httpError(502, '模型没有产出标题文本')
  return title
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/__dsh-geek-header__',
    handler: async (req, res) => {
      if (!checkOrigin(req)) return send(res, 403, { error: 'forbidden origin' })
      const url = new URL(req.url || '/', 'http://localhost')
      const key = req.method + ' ' + url.pathname.slice('/__dsh-geek-header__'.length)
      try {
        if (key === 'POST /title/refresh') {
          const body = await readJson(req)
          const sessionId = String(body.sessionId || '')
          if (!sessionId) throw httpError(400, 'sessionId is required')
          const session = ctx.sessions.get(sessionId)
          if (!session) throw httpError(409, '会话不在线（未打开或已关闭）')
          const title = await generateTitle(ctx, session, body)
          const accepted = ctx.sessionTitle.rename(session, title)
          return send(res, 200, { title: accepted.title })
        }
        return send(res, 404, { error: 'not found: ' + key })
      } catch (err) {
        const status = err && err.status
        return send(res, status || 500, { error: String((err && err.message) || err) })
      }
    },
  }), 'dsh-geek-header: http routes')

  console.log('[dsh-geek-header] api mounted at /__dsh-geek-header__ (title/refresh)')
}
