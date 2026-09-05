/**
 * dsh-geek-archive client 半（单文件：平台以 /plugins/dsh-geek-archive/client.js 直发浏览器）。
 *
 * 注册为设置面板里单独一节（settings.section 列表槽，id=archive-manager），列出全部已归档会话，
 * 每条可「放回对话」或「删除」（两次点击确认）。数据走框架站立座（renderer PropsRuntime 全局份）：
 * useWorkspaces(archivedSessionIds) 取归档 id 集、useSessions(byId) 取会话元数据（标题/目录/时间）。
 * host 侧解除归档/删除后，平台 WorkspaceFeed 会经 domain/changed 自动推 archived 帧，无需手动刷新。
 */
window.__ModuleLoader__.load({
  id: 'dsh-geek-archive',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const { useState } = React
    const h = React.createElement
    const API = '/__dsh-geek-archive__'

    /* ---------- host 调用 ---------- */
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
    const host = { call: (name, args) => api('POST', '/wb/' + String(name), args || {}) }

    /* ---------- 样式（自带 <style>，不依赖任何第三方插件样式） ---------- */
    /* 平台 settings 导航对未知 section 兜底画齿轮（ui-settings-general 的 navIcon 写死，
     * 「通用」那节也是它）。这里把归档节（order 最高 → 导航末位）的齿轮换成归档盒图标：
     * 掩模 + currentColor，随导航文字/激活态变色，与平台 Outline 系列图标视觉一致。
     * 脆弱点登记（0.1.2-rc.1）：依赖 settings 面板 DOM 结构 [role=dialog]>nav>div:last-child
     * >button:last-child 且归档节 order 最高；平台改导航结构或出现更高 order 的 section 时先核这里。 */
    const ARCHIVE_MASK = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>')
    const ARCHIVE_MASK_URL = 'url("data:image/svg+xml,' + ARCHIVE_MASK + '") center/contain no-repeat'
    const CSS = [
      '[role="dialog"][aria-modal="true"] nav > div:last-child > button:last-child svg { display:none }',
      '[role="dialog"][aria-modal="true"] nav > div:last-child > button:last-child::before { content:"";display:inline-block;width:16px;height:16px;background:currentColor;-webkit-mask:' + ARCHIVE_MASK_URL + ';mask:' + ARCHIVE_MASK_URL + ';flex:none }',
      '.am-arch { display:flex;flex-direction:column;gap:6px;padding:4px 0 }',
      '.am-row { display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px }',
      '.am-row:hover { border-color:var(--dsw-alias-border-l2) }',
      '.am-main { flex:1;min-width:0 }',
      '.am-ttl { font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }',
      '.am-meta { display:flex;align-items:center;gap:8px;margin-top:2px;font-size:11px;color:var(--dsw-alias-label-tertiary) }',
      '.am-meta .p { white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px }',
      '.am-acts { display:flex;gap:6px;flex:none }',
      '.am-btn { padding:4px 10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap }',
      '.am-btn:hover { border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary) }',
      '.am-btn.danger { color:var(--dsw-alias-state-error-primary) }',
      '.am-btn.danger:hover { border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary) }',
      '.am-hint { color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center;padding:24px 8px }',
    ].join('\n')
    function mountStyle() {
      if (document.getElementById('dsh-geek-archive-style')) return
      const el = document.createElement('style')
      el.id = 'dsh-geek-archive-style'
      el.textContent = CSS
      document.head.appendChild(el)
    }

    /* ---------- 时间展示 ---------- */
    function relTime(t) {
      if (!t) return ''
      const d = Date.now() - t
      const m = Math.floor(d / 60000)
      if (m < 1) return '刚刚'
      if (m < 60) return m + ' 分钟前'
      const hh = Math.floor(m / 60)
      if (hh < 24) return hh + ' 小时前'
      const dd = Math.floor(hh / 24)
      return dd < 30 ? dd + ' 天前' : new Date(t).toLocaleDateString()
    }

    /* ---------- 归档管理节（settings.section 组件） ---------- */
    function ArchiveManager(t) {
      const byId = t.useSessions((n) => n.byId)
      const ids = t.useWorkspaces((n) => n.archivedSessionIds)
      const [confirming, setConfirming] = useState(null)

      const rows = (ids || [])
        .map((id) => ({ id, sm: byId ? byId[id] : undefined }))
        .filter((r) => r.sm)
        .sort((a, b) => (b.sm.updatedAt || 0) - (a.sm.updatedAt || 0))

      if (rows.length === 0)
        return h('div', { className: 'am-hint' }, '没有已归档的会话')

      const restore = (id) => { host.call('unarchiveSession', { id }).catch(() => {}) }
      const del = (id) => {
        if (confirming !== id) { setConfirming(id); return }
        setConfirming(null)
        host.call('deleteSession', { id, cwd: (byId[id] || {}).cwd }).catch(() => {})
      }
      const cancel = () => setConfirming(null)

      return h('div', { className: 'am-arch' },
        rows.map((r) => {
          const o = r.id, s = r.sm
          const T = s.displayTitle || s.title || o
          const busy = confirming === o
          return h('div', { key: o, className: 'am-row' },
            h('div', { className: 'am-main' },
              h('div', { className: 'am-ttl', title: T }, T),
              h('div', { className: 'am-meta' },
                s.cwd ? h('span', { className: 'p', title: s.cwd }, s.cwd) : null,
                h('span', null, relTime(s.updatedAt)),
              ),
            ),
            h('div', { className: 'am-acts' },
              h('button', { className: 'am-btn', title: '把该会话放回对话列表', onClick: () => restore(o) }, '放回对话'),
              busy
                ? h('span', { style: { display: 'flex', gap: 4 } },
                    h('button', { className: 'am-btn danger', title: '再次点击确认永久删除', onClick: () => del(o) }, '确认删除'),
                    h('button', { className: 'am-btn', title: '取消', onClick: cancel }, '取消'),
                  )
                : h('button', { className: 'am-btn danger', title: '永久删除该会话及其历史', onClick: () => del(o) }, '删除'),
            ),
          )
        }),
      )
    }

    /* ---------- 模块出口 ---------- */
    exports.name = 'dsh-geek-archive'
    /* 仅 slots：把归档节注册进平台设置面板；useSessions/useWorkspaces 由 renderer 经 props 供，
     * 不需要注入 sessions/workspaces 服务。 */
    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      mountStyle()
      /* label 为注册时固化的中文文案（本插件单语言，不走 locale 重注册）。id 驱动面板导航定位。 */
      try {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'archive-manager', order: 40, label: '归档管理' },
            (u) => h(ArchiveManager, { close: u.close, useSessions: u.useSessions, useWorkspaces: u.useWorkspaces }),
          ),
        )
      } catch (e) { console.error('[dsh-geek-archive] 归档节注册失败', e) }
    }

    return module.exports
  },
})