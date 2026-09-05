/**
 * dsh-geek-sidebar client 半（单文件：平台以 /plugins/dsh-geek-sidebar/client.js 直发浏览器，无打包器）。
 * 五个 feature 共用一个模块，apply 内逐个 try/catch 隔离，一个挂不影响其余：
 *   1. filemention — dshFileMention 服务（经 conversation.input 直读草稿态）
 *   2. workbench   — 侧栏/文件预览（host.call("workbench.x") 由下方 shim 走 POST /__dsh-geek-sidebar__/wb/x）
 *   3. skills      — 技能管理弹窗 + dshSkillsUI 服务（路由 /__dsh-geek-sidebar__/skills/*）
 *   4. deliv-hook  — chat 产出 chip/工具卡文件链接点击接管进应用内预览（见 15-deliv）
 *   5. quicknotes  — 便签与划选引用（划选气泡/小胶囊/侧滑抽屉，路由 /__dsh-geek-sidebar__/wb/qn*）
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
     * 若已存在 link 则检查 href，版本变动时更新 href 触发浏览器重拉样式，防止 HMR 漏样式变裸标签。 */
    function mountStyle(href) {
      const el = document.querySelector('link[data-dsh-geek-sidebar-style]')
      if (el) {
        if (el.getAttribute('href') !== href) {
          el.setAttribute('href', href)
        }
        return
      }
      const newEl = document.createElement('link')
      newEl.rel = 'stylesheet'
      newEl.href = href
      newEl.setAttribute('data-dsh-geek-sidebar-style', '1')
      document.head.appendChild(newEl)
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
     * dshFileMention：把 ReferenceInsert（mentionRef 构造）作为整体 chip 插入指定会话草稿末尾，
     * 复用平台 slash/input-insert-reference 与 ui-reference 的 reference 源 codec（ref 即模型文本），
     * 与输入框原生 @ 菜单一致：整块渲染、退格一次整块删除。
     * 输入状态（draft / draftRev / occurrences）在点击时经 conversation.input（SessionInputResolver）
     * 直读该会话的 InputState 快照；span 由 clipboard 草稿反推检测坐标（chip 展开收回 1 字符），
     * 携带 draftRev 走受管写入口（CAS，防并发写冲突）。
     * 0.1.2-alpha.4 起原「conversation.input.left 槽 Tracker 缓存」失效：InputBar 对该槽
     * 只传空 props（渲染位点自 ConversationRoot 挪进 InputBar），槽组件拿不到 input。
     * 钉住的平台私有面（平台升级先核对）：`conversation` 服务的 `input.for(actx)` 面、
     * InputState 的 draft/draftRev/occurrences 字段、`slash/input-insert-reference` 请求形状
     *（reference+span）。
     */
    function applyFilemention(ctx) {
      ctx.provide('dshFileMention')
      fileMentionImpl = {
        /* 把 reference（ReferenceInsert）追加到 sessionId 会话的草稿末尾。
         * 返回 true = 插入被输入机接受；false = 无会话/输入面缺席/CAS 失败/span 不可映射。 */
        mention(sessionId, reference) {
          const actx = ctx.sessions.scope(sessionId)
          if (!actx) return false
          const conversation = ctx.get('conversation')
          const resolver = conversation && conversation.input
          if (!resolver) {
            /* 服务在而输入面缺席 = 平台契约变动，与「会话不在线」的正常静默 false 不同，留痕 */
            console.warn('[dsh-geek-sidebar] conversation.input 不可读，@提及不可用（平台契约变动？）')
            return false
          }
          /* for() 只在会话 binding 未物化时 throw（该会话无可用输入机），吞掉等同不可提及 */
          let st
          try { st = resolver.for(actx).state.getSnapshot() } catch { return false }
          if (!st) return false
          /* span 是检测坐标（chip = 一个 ￼）：clipboard 草稿里每个已插入 chip 展开成其
           * clipboardText，逐块收回 (length-1) 即得文档末的检测偏移——退格整块删除依赖精确落点。 */
          const draft = String(st.draft || '')
          let detectEnd = draft.length
          const occs = st.occurrences
          if (Array.isArray(occs)) {
            for (const occ of occs) detectEnd -= Math.max(0, (occ.length || 0) - 1)
          }
          const span = { start: detectEnd, end: detectEnd, draftRev: st.draftRev }
          return actx.bail(actx, 'slash/input-insert-reference', { reference, span }) === true
        },
      }
      ctx.dshFileMention = fileMentionImpl
    }

    /* ============================ feature 2: workbench ============================ */
