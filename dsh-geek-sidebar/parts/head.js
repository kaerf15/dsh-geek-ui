/**
 * dsh-geek-sidebar client 半（单文件：平台以 /plugins/dsh-geek-sidebar/client.js 直发浏览器，无打包器）。
 * 三个 feature 共用一个模块，apply 内逐个 try/catch 隔离，一个挂不影响其余：
 *   1. filemention — dshFileMention 服务 + conversation.input.left Tracker
 *   2. workbench   — 侧栏/文件预览/底栏（host.call("workbench.x") 由下方 shim 走 POST /__dsh-geek-sidebar__/wb/x）
 *   3. skills      — 技能管理弹窗 + dshSkillsUI 服务（路由 /__dsh-geek-sidebar__/skills/*）
 */
window.__ModuleLoader__.load({
  id: 'dsh-geek-sidebar',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    /* ============================ 共享层 ============================ */
    const API = '/__dsh-geek-sidebar__'

    async function api(method, path, body) {
      const res = await fetch(API + path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status))
      return data
    }

    /* workbench 的 host 调用约定：host.call("workbench.x", args) → POST /wb/x */
    const host = { call: (name, args) => api('POST', '/wb/' + String(name).replace(/^workbench\./, ''), args || {}) }

    /* workbench 样式：<link> 直挂 host 路由（每请求读盘，改 style.css 刷新页面即生效）。
     * 注：此挂载在 Fiber 回收体系之外——但静态插件 Fiber 生命周期 = 应用生命周期，
     * 不会泄漏；这是有意为之的体系外单例（以 data- 属性幂等防重）。 */
    function mountStyle(href) {
      if (document.querySelector('link[data-dsh-geek-sidebar-style]')) return
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.href = href
      el.setAttribute('data-dsh-geek-sidebar-style', '1')
      document.head.appendChild(el)
    }

    /* 技能弹窗实例句柄：SkillsModal 挂载后填充；workbench 底栏经 skillsUI 直接调用 */
    let skillsModalApi = null
    const skillsUI = {
      open(cwd) { if (skillsModalApi) skillsModalApi.open(cwd) },
      close() { if (skillsModalApi) skillsModalApi.close() },
    }

    /* dshFileMention 的模块内桥：cordis 的 ctx.get 要求提供方 fiber 处于 ACTIVE 态，
     * 同模块内 provide 后立刻 get 会拿到 undefined（fiber 尚在启动态），导致 workbench
     * 的 @ 按钮永不渲染。模块内消费一律走这个惰性代理；ctx.provide 保留给外部插件。 */
    let fileMentionImpl = null
    const fileMentionBridge = {
      mention(sessionId, text) { return fileMentionImpl ? fileMentionImpl.mention(sessionId, text) : false },
    }

    /* ============================ feature 1: filemention ============================
     * dshFileMention：把 "@文件路径" 插入指定会话的输入框草稿。
     * Tracker 挂在 conversation.input.left 槽（不渲染），持续缓存每个会话最新发布
     * 的输入状态（draft / draftRev），mention() 用其构造 span 走平台输入机的受管
     * 写入口 slash/input-insert-text（span 携带 draftRev 做 CAS，防并发写冲突）。
     */
    function applyFilemention(ctx) {
      /* sessionId -> 最新发布的输入状态 */
      const latest = new Map()

      function Tracker(props) {
        const session = props.session
        const sid = session && (session.sessionId || session.id)
        useEffect(() => {
          if (sid && props.input) latest.set(sid, props.input)
        })
        useEffect(() => () => { if (sid) latest.delete(sid) }, [sid])
        return null
      }

      ctx.provide('dshFileMention')
      fileMentionImpl = {
        /* 把 text（如 "@docs/a.md "）追加到 sessionId 会话的草稿末尾。
         * 返回 true = 插入被输入机接受；false = 无会话/无缓存/CAS 失败。 */
        mention(sessionId, text) {
          const st = latest.get(sessionId)
          if (!st) return false
          const actx = ctx.sessions.scope(sessionId)
          if (!actx) return false
          const draft = String(st.draft || '')
          const span = { start: draft.length, end: draft.length, draftRev: st.draftRev }
          return actx.bail(actx, 'slash/input-insert-text', { text: String(text), span }) === true
        },
      }
      ctx.dshFileMention = fileMentionImpl

      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-geek-sidebar-filemention' }, (props) => h(Tracker, props))
      )
    }

    /* ============================ feature 2: workbench ============================ */
