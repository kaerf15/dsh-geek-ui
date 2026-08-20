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
    req.on('data', (c) => { d += c; if (d.length > 3 * 1024 * 1024) req.destroy() })
    req.on('end', () => resolveB(d))
    req.on('error', rejectB)
  })
}

async function parseJson(req) {
  const raw = await readBody(req)
  if (!raw.trim()) return {}
  return JSON.parse(raw)
}

export function mountApi(ctx, prefix, routes) {
  ctx.webServer.register({
    kind: 'prefix',
    path: prefix,
    handler: async (req, res) => {
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
  })
}
