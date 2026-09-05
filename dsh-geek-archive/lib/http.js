/**
 * dsh-geek-sidebar 共享 HTTP 层：一次 webServer.register，内部按 "METHOD /sub" 路由表分发。
 *
 * 约定：
 *  - handler({ query, body, req, res }) 返回对象 → 200 JSON；
 *  - 抛 httpError(status, msg) → 对应状态码 JSON { error }；其它异常 → 500；
 *  - handler 自己写 res（如 CSS/文件流）→ 返回 undefined，http 层检测到
 *    res.writableEnded 就不再补响应；
 *  - GET 不解析 body；POST 一律按 JSON 解析（空 body → {}）。
 */

export function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(obj))
}

export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function readBody(req) {
  return new Promise((resolveB, rejectB) => {
    let d = ''
    /* 上限必须 > 最大合法业务体：writeFile 允许 writeMaxMB(1MB) 文本 + JSON 包装余量，
     * 旧值 1e6 < 1MB 会把合规 writeFile 掐成连接错误（评审 P3） */
    req.on('data', (c) => {
      d += c
      /* 超限必须 reject（评审修复：原先只 destroy，'end'/'error' 都不保证触发，
       * promise 永不 settle，handler 悬挂占连接） */
      if (d.length > 3 * 1024 * 1024) { rejectB(httpError(413, 'body too large')); req.destroy() }
    })
    req.on('end', () => resolveB(d))
    req.on('error', rejectB)
  })
}

/* 同源护栏（评审修复：端点原先零校验，DNS rebinding/跨站表单可打本地写接口）。
 * 浏览器跨站请求必带 Origin；Origin.host 与请求 Host 不一致 → 拒绝。
 * 无 Origin（curl / 同机脚本）放行——部署假设仍是 loopback。 */
export function checkOrigin(req) {
  const origin = req.headers && req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === String(req.headers.host || '')
  } catch {
    return false
  }
}

async function parseJson(req) {
  const raw = await readBody(req)
  if (!raw.trim()) return {}
  /* 评审修复：JSON 语法错误是客户端错误，报 400——原先一律 500，干扰前端排障 */
  try {
    return JSON.parse(raw)
  } catch (e) {
    if (e instanceof SyntaxError) throw httpError(400, 'invalid JSON body')
    throw e
  }
}

export function mountApi(ctx, prefix, routes) {
  /* register 返回的 disposer 必须挂 Fiber（评审修复：原先丢弃——Fiber 卸载后路由泄漏，
   * 插件重载时 duplicate 报错直接 apply 失败；宿主 dsh-host-webserver 由调用方负责回收） */
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: prefix,
    handler: async (req, res) => {
      if (!checkOrigin(req)) return send(res, 403, { error: 'forbidden origin' })
      const url = new URL(req.url || '/', 'http://localhost')
      const sub = url.pathname.slice(prefix.length) || '/'
      const key = req.method + ' ' + sub
      const fn = routes[key]
      if (!fn) return send(res, 404, { error: 'not found: ' + key })
      try {
        const body = req.method === 'GET' ? {} : await parseJson(req)
        const out = await fn({ query: url.searchParams, body, req, res })
        if (!res.writableEnded) send(res, 200, out === undefined ? { ok: true } : out)
      } catch (err) {
        if (res.writableEnded) return
        const status = Number(err && err.status) || 500
        send(res, status, { error: String(err && err.message ? err.message : err) })
      }
    },
  }))
}
