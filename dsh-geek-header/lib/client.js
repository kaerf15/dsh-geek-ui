/**
 * dsh-geek-header client 半（单文件：平台以 /plugins/dsh-geek-header/client.js 直发浏览器，无打包器）。
 *
 * 布局重排（官方 ConversationSessionHeader 的两栏页头 → 本插件的两行）：
 *   第一行  dgu-row1：第三方插件区。内容来自 cordis 服务 geekUiHeader.register()，
 *           官方不放任何东西；无注册时整行塌陷（:empty display:none）。
 *   第二行  页签（pi-web 式平面工具条）→ 「生成标题」→ 「系统提示词」按钮（钉在页签后，不参与折叠）
 *           → 右侧谱系控件 / preset 徽标 / 后台任务平铺；
 *           拥挤（动作区被挤换行）时动作区折叠进 ⋯ 下拉菜单。
 *   隐藏    面包屑标题文字 / “/” 分隔符、utilities 区（Session log 按钮）。
 *
 * 不做 slot 替换的原因：页签切换状态存在 ui-conversation 闭包的 chatStore 里
 *（store 实例按 handle 身份缓存，跨插件拿不到），替换 conversation.session.header
 * 会让“对话/轨迹”页签失能。故走 CSS + DOM 注入，官方 React 组件原样运行。
 *
 * ── 私有面脆弱点登记（平台升级先查这里，再查公共 API）──
 *  1. header 结构标记依赖官方 skeleton/ConversationSession.tsx 的 DOM 形状：
 *     nav(面包屑) 的父链 = titleCluster → titleRow → header；页签行 = [role="tablist"]。
 *  2. 动作区/工具区定位依赖 [data-slot="conversation.session.header.actions" /
 *     "conversation.session.header.utilities"] 锚点——这是平台公开的稳定缝
 *    （scoped-slots.tsx 注释：“the addressable seam dynamic styles target”），非哈希类名。
 *  3. 谱系控件保留依赖 [data-slot="conversation.session.header.lineage"] 锚点 + :has()。
 *  3b. 槽锚点带内联 display:contents（scoped-slots 锚点契约，scoped-slots.tsx 的 ANCHOR_STYLE）——
 *     覆写锚点自身 display 必须 !important（utilities 槽的隐藏/面板化就依赖这个）。
 *  4. 页签样式覆写依赖 button[aria-selected]；配色依赖 --dsw-alias-* 主题 token。
 *  5. 注入节点（.dgu-row1/.dgu-seg-anchor/.dgu-toggle）插在 React 管理的 header 内：
 *     React 卸载时按节点引用移除自己的子节点，不认得的注入节点不会被误删；
 *     header 整体重挂载时 MutationObserver 重新注入。
 *  6. 「生成标题」读取 ctx.modelDirectories（ui-model-selection 的服务）拿当前选中模型；
 *     服务缺席时降级为不带路由（host 回落 requestHeader）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-geek-header',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const ReactDOM = require('react-dom')
    const { createRoot } = require('react-dom/client')
    const h = React.createElement
    const { useSyncExternalStore, useState, useEffect, useRef } = React

    const SLOT_HEADER = 'conversation.session.header'
    const SLOT_ACTIONS = 'conversation.session.header.actions'
    const SLOT_LINEAGE = 'conversation.session.header.lineage'

    /* ============================ 样式 ============================ */
    const CSS = `
/* ===== dsh-geek-header：会话页头重排 ===== */

/* 容器：flex 换行，第一行插件区 / 第二行分段条。上下 padding 归零、左 padding 归零
 * （分段条顶到列左缘），右侧留 20px 呼吸。官方 border-bottom 是透明占位，宽度清零，
 * 否则 header 盒子比格子多 0.56px，底线 ::after 会悬在格子底边上方 1px（竖线出头）。 */
header[data-dgu-root] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0;
  padding: 0 20px 0 0;
  border-bottom-width: 0;
}
/* 底部通栏分隔线：贴合格子底边（bottom:0 → 占据格子最后 1px，竖线恰好止于线的下缘） */
header[data-dgu-root]::after { bottom: 0; }

/* 官方中间层透明化，titleCluster 提升为 header 的直接 flex 项 */
header[data-dgu-root] > [data-dgu="titlerow"] { display: contents; }

/* utilities 槽（Session log 等）整段隐藏，不进条带也不进 ⋯ 菜单（导出走 /export 命令）。
 * 两层都要杀：① 槽锚点带内联 display:contents（scoped-slots 锚点契约），选择器赢不了内联，
 * 必须 !important；② 锚点外的官方包装层 .headerUtilities 带 margin-left:20px，
 * 不压掉会在条带最左留下 20px 空位。 */
header[data-dgu-root] [data-slot="conversation.session.header.utilities"] { display: none !important; }
header[data-dgu-root] div:has(> [data-slot="conversation.session.header.utilities"]) { display: none !important; }

/* 右栏开关图标矫正：官方图标库只有 IconPanelLeftOutline16（隔断在左），用在
 * 右侧栏开关上语义反了（也不象用户旧版右栏开关的样子）。水平翻转使隔断居右。
 * 两处同构：页头 corner 槽的展开钮 + 右栏内部的收起钮。 */
header[data-dgu-root] [data-sidebar-right-expand] svg,
[data-sidebar-right-toggle] svg { transform: scaleX(-1); }

/* 官方预设选择器（agent-preset 座位：图标+预设名+下拉箭头）整颗隐藏。
 * 定位双条件：actions 槽领头位（order -10 最低者排最前）+ 自身或子级是
 * 带 aria-haspopup="menu" 的菜单钮——两个特征都中才杀，官方位次调整时宁漏勿误。
 * 位次契约：ui-agent-preset register order:-10（领头负序带，注释见官方 index.ts）。 */
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > :first-child:is(button[aria-haspopup="menu"], :has(button[aria-haspopup="menu"])) { display: none !important; }

/* 右栏展开钮（0.1.5 新增的 corner 槽，官方页头末项）：geek 布局下 titlerow
 * display:contents 把它提为 header 直接 flex 项，无 order 会按 0 沉到行首——
 * 钉到条带右端（order 最大 + margin-left:auto 推到视口右缘），并套格子骨架。
 * 空时官方 .headerCorner:empty 已隐藏（右栏展开中 ExpandButton 返回 null）。 */
header[data-dgu-root] [data-conversation-header-corner] {
  order: 6;
  margin-left: auto;
  margin-right: -20px; /* 抵消 header 右侧 20px 呼吸，贴齐视口右缘（与官方 -16px 同理） */
  align-items: stretch;
  height: 36px;
}
header[data-dgu-root]:has(> .dgu-row1:not(:empty)) [data-conversation-header-corner] { margin-top: -1px; }
header[data-dgu-root] [data-conversation-header-corner] button {
  height: 100%;
  min-height: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-bottom: none;
  border-radius: 0;
  background: transparent;
  margin: 0;
}
header[data-dgu-root] [data-conversation-header-corner] button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* 面包屑：标题按钮与 “/” 分隔符隐藏，只留谱系控件所在的段。
 * 谱系判定的是非空内容（> :not(:empty)）——空壳不算数，否则会留下幽灵格。 */
header[data-dgu-root] [data-dgu="crumbs"] > span > button,
header[data-dgu-root] [data-dgu="crumbs"] > span > span { display: none; }
header[data-dgu-root] [data-dgu="crumbs"] > span:not(:has([data-slot="${SLOT_LINEAGE}"] > :not(:empty))) { display: none; }
/* 谱系为空时整个 nav 隐藏（否则 cluster 的 gap 会留下 10px 幽灵间距） */
header[data-dgu-root] [data-dgu="crumbs"]:not(:has([data-slot="${SLOT_LINEAGE}"] > :not(:empty))) { display: none; }

/* 第一行：第三方插件区（空时整行塌陷，不占高度）。非空时自带底边，
 * 与第二行格子的顶边经 margin-top:-1px 重叠成单线。 */
header[data-dgu-root] > .dgu-row1 {
  order: 1;
  flex: 0 0 100%;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
header[data-dgu-root] > .dgu-row1:empty { display: none; }
header[data-dgu-root] > .dgu-row1:not(:empty) {
  display: flex;
  padding: 6px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
header[data-dgu-root]:has(> .dgu-row1:not(:empty)) > [data-dgu="tabs"],
header[data-dgu-root]:has(> .dgu-row1:not(:empty)) > .dgu-seg-anchor,
header[data-dgu-root]:has(> .dgu-row1:not(:empty)) [data-dgu="cluster"],
header[data-dgu-root]:has(> .dgu-row1:not(:empty)) > .dgu-toggle { margin-top: -1px; }

/* 第二行：pi-web 式分段条——每段一个通高大按钮，段间 1px 竖线，统一 36px 行高；
 * 无胶囊无底，hover 整段浅灰底，选中段文字加深加粗。 */
header[data-dgu-root] > [data-dgu="tabs"] {
  order: 2;
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 36px;
  margin-top: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
}
/* ===== 分段条单元共享骨架 =====
 * 页签 / 生成标题 / 动作区与谱系槽的直接子元素 / ⋯ 开关共用：通高格子、hairline 边框
 *（底边让位给 header::after 通栏线）、直角、透明底。各类型只补化妆属性。
 * actions/lineage 用 > *：第三方注册进来的任何形状都自动套格子，不只认 span / div>button。 */
header[data-dgu-root] > [data-dgu="tabs"] > button,
header[data-dgu-root] .dgu-seg-btn,
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > *,
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > *,
header[data-dgu-root] > .dgu-toggle {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-bottom: none;
  border-radius: 0;
  background: transparent;
  font-size: 13px;
  margin: 0;
  min-height: 0;
}
/* 相邻段边线重叠：margin-left:-1px 让接缝仍是 1px（pi-web 的格子条观感） */
header[data-dgu-root] > [data-dgu="tabs"] > button { font-weight: 400; line-height: 18px; }
header[data-dgu-root] > [data-dgu="tabs"] > button + button { margin-left: -1px; }
header[data-dgu-root] > [data-dgu="tabs"] > button::after { display: none; }
header[data-dgu-root] > [data-dgu="tabs"] > button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
header[data-dgu-root] > [data-dgu="tabs"] > button[aria-selected="true"] {
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: none;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

/* 分段条后段锚点：生成标题 / 系统提示词等，order 与页签相同、DOM 紧随 tabs */
header[data-dgu-root] > .dgu-seg-anchor {
  order: 2;
  display: flex;
  align-items: stretch;
  height: 36px;
  margin-left: -1px;
}
header[data-dgu-root] > .dgu-seg-anchor.dgu-prompt-anchor { position: relative; }

.dgu-seg-btn {
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  white-space: nowrap;
}
.dgu-seg-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dgu-seg-btn:disabled { cursor: default; opacity: .5; }
.dgu-title-btn.dgu-title-done { color: var(--dsw-alias-state-business-primary); opacity: 1; }
.dgu-title-btn.dgu-title-error { color: #dc2626; opacity: 1; }
.dgu-prompt-btn[aria-expanded="true"] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dgu-prompt-panel {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  box-sizing: border-box;
  width: min(640px, calc(100vw - 40px));
  min-width: 280px;
  max-height: min(60vh, 480px);
  overflow: auto;
  padding: 10px 12px 12px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-shadow-lv3);
  z-index: 60;
}
.dgu-prompt-anchor:has(.dgu-prompt-btn[aria-expanded="true"]) .dgu-prompt-panel { display: block; }
.dgu-prompt-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-tertiary);
  font: 400 11px/16px var(--ds-font-family-code);
}
.dgu-prompt-empty,
.dgu-prompt-status {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 18px;
}
.dgu-prompt-status.dgu-prompt-error { color: #dc2626; }

/* 动作区/谱系格子里的原生控件：撑满格子、去自身边框底色（点击区域=整格） */
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > * button,
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > * button {
  min-height: 0;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
  gap: 4px;
}
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > *:hover,
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > *:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
/* 谱系格子：文字 tertiary（与页签同调） */
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > * {
  color: var(--dsw-alias-label-tertiary);
}
/* 槽内相邻段接缝；谱系 Fragment 双 dropdown 同理 */
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > * + *,
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > * + * { margin-left: -1px; }

/* ui-subagent 面包屑 "/" 分隔符在分段条里多余 */
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > * > span:first-child:not(:has(*)) { display: none; }

/* 第二行 cluster：nav（谱系）与 actions（后台任务等）压成一条。
 * 官方 titleCluster gap:10px / headerActions gap:8px / crumbs gap:4px 会把格子撑散；
 * 旧 slot 兄弟接缝选择器在 DOM 上够不着（lineage 在 nav 内、actions 在另一 div）。 */
header[data-dgu-root] [data-dgu="cluster"] {
  order: 3;
  flex: none;
  align-items: stretch;
  gap: 0;
  height: 36px;
  margin-left: -1px;
}
header[data-dgu-root] [data-dgu="crumbs"] {
  align-items: stretch;
  gap: 0;
  min-width: 0;
  overflow: visible;
}
header[data-dgu-root] [data-dgu="crumbs"] > span {
  display: flex;
  align-items: stretch;
  gap: 0;
  min-width: 0;
}
header[data-dgu-root] [data-dgu="actions"] {
  display: flex;
  align-items: stretch;
  gap: 0;
  flex: none;
}
/* 谱系可见（非空内容）时 actions 才需要与谱系末格接缝；谱系隐藏时 nav 仍占 DOM（:empty 不成立），
 * 若误用 :not(:empty) 会在 cluster 自身 margin-left:-1px 之上再叠 -1px，格子左线与前一格右线
 * 由重叠退化成并排——接缝变 2px 双线（视觉上的「缝」）。故条件必须与 nav 的 display:none 判定一致。 */
header[data-dgu-root] [data-dgu="crumbs"]:has([data-slot="${SLOT_LINEAGE}"] > :not(:empty)) + [data-dgu="actions"] { margin-left: -1px; }

/* 空段治理：条件返回 null 的槽条目不留空格子 */
header[data-dgu-root] [data-slot="conversation.session.header.actions"] > *:empty,
header[data-dgu-root] [data-slot="conversation.session.header.lineage"] > *:empty { display: none; }

/* 拥挤折叠：⋯ 开关。仅拥挤时出现，钉在条带最右 */
header[data-dgu-root] > .dgu-toggle {
  order: 4;
  display: none;
  width: 40px;
  height: 36px;
  margin-left: auto;
  padding: 0;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
header[data-dgu-root] > .dgu-toggle:hover { background: var(--dsw-alias-interactive-bg-hover); }
header[data-dgu-root][data-dgu-crowded] > .dgu-toggle { display: inline-flex; }
header[data-dgu-root][data-dgu-crowded] [data-dgu="cluster"] { display: none; }
header[data-dgu-root][data-dgu-crowded][data-dgu-actions-open] [data-dgu="cluster"] {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-height: 0;
  height: auto;
  position: absolute;
  top: calc(100% + 4px);
  right: 20px;
  min-width: 160px;
  padding: 8px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-shadow-lv3);
  z-index: 60;
}
header[data-dgu-root][data-dgu-actions-open] [data-slot="conversation.session.header.actions"] > * {
  width: 100%;
  height: 32px;
  border: none;
  margin-left: 0;
  padding: 0 10px;
  border-radius: 8px;
}

/* ===== 会话流「System prompt」折叠块隐藏 =====
 * 0.1.2 平台会话流新增（ui-chat SystemPromptRow，0.1.1 没有）：每个已完成回答前折叠
 * 展示系统提示词。已迁至页头「系统提示词」按钮 → 会话流整节点隐藏。
 * 该 data 属性 0.1.1 也有，规则对旧版是无害 no-op。
 * 归口说明：此规则属「会话区内容呈现」，由本插件（页头/会话区）统一管理，勿放侧栏插件。 */
[data-chat-flow-kind="system-prompt"] { display: none !important; }
`

    /* ============================ 第一行注册表 ============================
     * geekUiHeader 服务：第三方插件 ctx.geekUiHeader.register({ id, order?, component })
     * 往第一行塞内容；component 收到 { sessionId }（无当前会话时为 undefined）。
     * register 返回注销函数；快照数组缓存保证 useSyncExternalStore 不抖动。 */
    function createRegistry() {
      const entries = new Map()
      const listeners = new Set()
      let snapshot = []
      function rebuild() {
        snapshot = Array.from(entries.values()).sort((a, b) => (a.order || 0) - (b.order || 0))
        listeners.forEach((fn) => fn())
      }
      return {
        register(entry) {
          if (!entry || typeof entry.id !== 'string' || typeof entry.component !== 'function') {
            throw new Error('geekUiHeader.register: entry 需要 { id: string, order?: number, component: Component }')
          }
          entries.set(entry.id, entry)
          rebuild()
          return () => { if (entries.delete(entry.id)) rebuild() }
        },
        getSnapshot() { return snapshot },
        subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn) } },
      }
    }

    function Row1(props) {
      const items = useSyncExternalStore(props.registry.subscribe, props.registry.getSnapshot)
      const sessionId = useSyncExternalStore(
        (fn) => props.sessions.list.subscribe(fn),
        () => props.sessions.list.getSnapshot().current,
      )
      if (items.length === 0) return null
      return items.map((entry) => h(entry.component, { key: entry.id, sessionId }))
    }

    /* ============================ 生成标题按钮 ============================
     * pi-web 同款：host POST /__dsh-geek-header__/title/refresh（整段对话 + 原版指令）。
     * 模型路由：点击时读 ctx.modelDirectories 报告的当前选中（host 内存态，
     * “换了模型还没发消息”也准确），随请求体上送；读不到则 host 回落 requestHeader。
     * 状态机照 pi-web：idle → busy（正在生成…）→ done（2s 回落）/ error（红 4s 回落，
     * tooltip 带原因）；空会话禁用。纯文字按钮，无图标。 */
    async function fetchGeekHeader(path, init) {
      const res = await fetch('/__dsh-geek-header__' + path, init)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status))
      return data
    }

    async function requestTitleRefresh(sessionId, route) {
      const data = await fetchGeekHeader('/title/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, ...route }),
      })
      return data.title
    }

    async function fetchSystemPrompt(sessionId) {
      const data = await fetchGeekHeader('/system-prompt?sessionId=' + encodeURIComponent(sessionId))
      return typeof data.system === 'string' ? data.system : ''
    }

    /* 会话列表快照 → { id, blank }，memo 化引用（多实例共享同一 memo 无碍：值由同一 store 决定） */
    let lastSessionView = { id: undefined, blank: true }
    function readSessionView(sessions) {
      const state = sessions.list.getSnapshot()
      const id = state.current
      const blank = id === undefined || !!(state.byId[id] && state.byId[id].blank)
      if (lastSessionView.id !== id || lastSessionView.blank !== blank) lastSessionView = { id, blank }
      return lastSessionView
    }

    function useSessionView(sessions) {
      return useSyncExternalStore(
        (fn) => sessions.list.subscribe(fn),
        () => readSessionView(sessions),
      )
    }

    function TitleButton(props) {
      const view = useSessionView(props.sessions)
      const sessionId = view.id
      const blank = view.blank
      const [state, setState] = useState({ kind: 'idle' })
      const timer = useRef(0)
      useEffect(() => () => { clearTimeout(timer.current) }, [])
      /* 换会话时回到 idle：旧会话的 done/error 不能串到新会话上 */
      useEffect(() => { setState({ kind: 'idle' }) }, [sessionId])

      const busy = state.kind === 'busy'
      const disabled = blank || busy
      const label = busy ? '正在生成…'
        : state.kind === 'done' ? '标题已更新'
        : state.kind === 'error' ? '生成失败'
        : '生成标题'
      const tip = blank ? '请先发送消息，再为会话命名'
        : state.kind === 'error' ? state.message
        : '生成会话标题'

      const scheduleReset = (ms) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => { setState({ kind: 'idle' }) }, ms)
      }
      const onClick = () => {
        if (disabled || sessionId === undefined) return
        setState({ kind: 'busy' })
        void (async () => {
          /* 当前选中模型（host 报告的内存态）；目录缺席/不可读 → 不带路由，host 回落 */
          let route = {}
          try {
            const dirs = props.modelDirectories
            if (dirs) {
              const directory = dirs.directoryFor(sessionId)
              const models = await directory.load()
              const current = models && models.current
              if (current && current.provider && current.model) {
                route = { provider: current.provider, model: current.model }
              }
            }
          } catch { /* 目录不可读不影响主流程 */ }
          return requestTitleRefresh(String(sessionId), route)
        })().then(() => {
          setState({ kind: 'done' })
          scheduleReset(2000)
        }, (err) => {
          setState({ kind: 'error', message: String((err && err.message) || err) })
          scheduleReset(4000)
        })
      }

      return h('button', {
        type: 'button',
        className: 'dgu-seg-btn dgu-title-btn dgu-title-' + state.kind,
        disabled,
        title: tip,
        'aria-label': label,
        onClick,
      }, label)
    }

    function SystemPromptButton(props) {
      const anchor = props.promptAnchor
      const view = useSessionView(props.sessions)
      const sessionId = view.id
      const blank = view.blank
      const [open, setOpen] = useState(false)
      const [state, setState] = useState({ kind: 'idle' })

      useEffect(() => { setOpen(false); setState({ kind: 'idle' }) }, [sessionId])

      useEffect(() => {
        if (!open || sessionId === undefined) return
        let cancelled = false
        setState({ kind: 'loading' })
        void fetchSystemPrompt(String(sessionId)).then((system) => {
          if (cancelled) return
          setState(system ? { kind: 'ready', system } : { kind: 'empty' })
        }, (err) => {
          if (cancelled) return
          setState({ kind: 'error', message: String((err && err.message) || err) })
        })
        return () => { cancelled = true }
      }, [open, sessionId])

      useEffect(() => {
        if (!open || !anchor) return
        const onDocDown = (e) => {
          if (!anchor.contains(e.target)) {
            setOpen(false)
            setState({ kind: 'idle' })
          }
        }
        document.addEventListener('pointerdown', onDocDown)
        return () => { document.removeEventListener('pointerdown', onDocDown) }
      }, [open, anchor])

      const disabled = blank || sessionId === undefined
      const label = '系统提示词'
      const tip = blank ? '请先发送消息，再查看系统提示词'
        : '查看当前生效的完整 system 提示词（不含上下文注入与工具 schema；破甲等变更需等下一次模型请求后刷新）'

      const panelBody = state.kind === 'loading'
        ? h('p', { className: 'dgu-prompt-status' }, '加载中…')
        : state.kind === 'error'
          ? h('p', { className: 'dgu-prompt-status dgu-prompt-error' }, state.message)
          : state.kind === 'empty'
            ? h('p', { className: 'dgu-prompt-empty' }, '当前请求没有系统提示词')
            : state.kind === 'ready'
              ? h('pre', null, state.system)
              : null

      const onClick = () => {
        if (disabled) return
        if (open) {
          setOpen(false)
          setState({ kind: 'idle' })
          return
        }
        setState({ kind: 'loading' })
        setOpen(true)
      }

      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'dgu-seg-btn dgu-prompt-btn',
          disabled,
          title: tip,
          'aria-label': label,
          'aria-expanded': open,
          onClick,
        }, label),
        h('div', { className: 'dgu-prompt-panel', role: 'region', 'aria-label': label }, panelBody))
    }

    /* 每个 header 的注入内容：row1 渲染位 + portal 到标题/系统提示词锚点 */
    function HeaderExtras(props) {
      return h(React.Fragment, null,
        h(Row1, { registry: props.registry, sessions: props.sessions }),
        ReactDOM.createPortal(
          h(TitleButton, { sessions: props.sessions, modelDirectories: props.modelDirectories }),
          props.titleAnchor,
        ),
        ReactDOM.createPortal(
          h(SystemPromptButton, { sessions: props.sessions, promptAnchor: props.promptAnchor }),
          props.promptAnchor,
        ))
    }

    /* ============================ header 装饰 ============================ */
    const records = new Map() /* header element -> { root, row1, titleAnchor, promptAnchor, toggle, ro, onDocDown, onToggle } */

    /* 页签行打标：官方只在视图数 > 1 时渲染 tabs div，且 React 会随时增删它，
     * 所以不在 decorate 一次性打标，而是每次测量/扫描时幂等补标。 */
    function markTabs(header) {
      const tabs = header.querySelector('[role="tablist"]')
      if (tabs && !tabs.hasAttribute('data-dgu')) tabs.setAttribute('data-dgu', 'tabs')
      return tabs
    }

    /* 拥挤测量：动作区被挤到页签下一行（或无页签时横向溢出）即折叠。
     * 测量前先摘掉 crowded/open 标记还原布局；测量完若仍拥挤则恢复 open——
     * 否则菜单展开期间动作区任何 DOM 变动（后台任务计数跳动等）都会把菜单强制收起。 */
    function measure(header) {
      const rec = records.get(header)
      const tabs = markTabs(header)
      /* 「生成标题」锚点：初始挂在 header 末尾，measure() 负责钉到 tabs 后面 */
      if (rec && tabs && rec.titleAnchor.previousElementSibling !== tabs) {
        header.insertBefore(rec.titleAnchor, tabs.nextSibling)
      }
      /* 「系统提示词」锚点：紧随「生成标题」 */
      if (rec && rec.titleAnchor && rec.promptAnchor.previousElementSibling !== rec.titleAnchor) {
        header.insertBefore(rec.promptAnchor, rec.titleAnchor.nextSibling)
      }
      const wasOpen = header.hasAttribute('data-dgu-actions-open')
      header.removeAttribute('data-dgu-actions-open')
      header.removeAttribute('data-dgu-crowded')
      const cluster = header.querySelector('[data-dgu="cluster"]')
      if (!cluster) return
      const actionsAnchor = cluster.querySelector('[data-slot="' + SLOT_ACTIONS + '"]')
      const hasContent = (actionsAnchor && actionsAnchor.childElementCount > 0)
        || !!navLineageContent(cluster)
      let crowded = false
      if (hasContent) {
        if (tabs) {
          /* 换行判定：header 是 align-items:center，同排但高度不同的两项 offsetTop 本就
           * 不同（垂直居中），不能用不等比较——cluster 顶边越过 tabs 底边才是真的
           * 被挤到了下一行。1px 容差吸收亚像素取整。 */
          crowded = cluster.offsetTop >= tabs.offsetTop + tabs.offsetHeight - 1
        } else {
          crowded = header.scrollWidth > header.clientWidth + 1
        }
      }
      if (crowded) {
        header.setAttribute('data-dgu-crowded', '')
        if (wasOpen) header.setAttribute('data-dgu-actions-open', '')
      }
    }

    function navLineageContent(cluster) {
      const anchor = cluster.querySelector('[data-slot="' + SLOT_LINEAGE + '"]')
      return anchor && anchor.childElementCount > 0 ? anchor : null
    }

    function decorate(header, services) {
      if (records.has(header)) return
      /* 结构校验：不合官方形状就跳过，下个 mutation 再试（宁可不装饰也不乱装饰） */
      const nav = header.querySelector('nav')
      if (!nav) return
      const cluster = nav.parentElement
      if (!cluster) return
      const titleRow = cluster.parentElement
      if (!titleRow || titleRow.parentElement !== header) return

      header.setAttribute('data-dgu-root', '')
      cluster.setAttribute('data-dgu', 'cluster')
      titleRow.setAttribute('data-dgu', 'titlerow')
      nav.setAttribute('data-dgu', 'crumbs')
      const actionsWrap = cluster.querySelector('[data-slot="' + SLOT_ACTIONS + '"]')?.parentElement
      if (actionsWrap && actionsWrap !== cluster) actionsWrap.setAttribute('data-dgu', 'actions')
      markTabs(header)

      /* 第一行容器（最前） */
      const row1 = document.createElement('div')
      row1.className = 'dgu-row1'
      header.prepend(row1)

      /* 「生成标题」锚点：初始挂在 header 末尾，measure() 负责钉到 tabs 后面 */
      const titleAnchor = document.createElement('div')
      titleAnchor.className = 'dgu-seg-anchor dgu-title-anchor'
      header.appendChild(titleAnchor)

      /* 「系统提示词」锚点：紧随 titleAnchor */
      const promptAnchor = document.createElement('div')
      promptAnchor.className = 'dgu-seg-anchor dgu-prompt-anchor'
      header.appendChild(promptAnchor)

      /* ⋯ 折叠开关（仅拥挤时由 CSS 放出） */
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'dgu-toggle'
      toggle.setAttribute('aria-label', '更多操作')
      toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
        + '<circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>'
      const onToggle = (e) => {
        e.stopPropagation()
        if (header.hasAttribute('data-dgu-actions-open')) {
          header.removeAttribute('data-dgu-actions-open')
        } else {
          header.setAttribute('data-dgu-actions-open', '')
        }
      }
      toggle.addEventListener('click', onToggle)
      header.appendChild(toggle)

      const onDocDown = (e) => {
        if (!header.contains(e.target)) header.removeAttribute('data-dgu-actions-open')
      }
      document.addEventListener('pointerdown', onDocDown)

      /* 单个 React root：row1 渲染位 + portal 到标题锚点 */
      const root = createRoot(row1)
      root.render(h(HeaderExtras, {
        registry: services.registry,
        sessions: services.sessions,
        modelDirectories: services.modelDirectories,
        titleAnchor,
        promptAnchor,
      }))

      const ro = new ResizeObserver(() => measure(header))
      ro.observe(header)

      records.set(header, { root, row1, titleAnchor, promptAnchor, toggle, ro, onDocDown, onToggle })
      measure(header)
    }

    function undecorate(header) {
      const rec = records.get(header)
      if (!rec) return
      records.delete(header)
      rec.ro.disconnect()
      document.removeEventListener('pointerdown', rec.onDocDown)
      rec.toggle.removeEventListener('click', rec.onToggle)
      rec.root.unmount()
      rec.row1.remove()
      rec.titleAnchor.remove()
      rec.promptAnchor.remove()
      rec.toggle.remove()
    }

    function syncAll(services) {
      const found = document.querySelectorAll('[data-slot="' + SLOT_HEADER + '"] > header')
      found.forEach((header) => decorate(header, services))
      /* header 整体被 React 重挂载/移除时回收旧记录 */
      records.forEach((_, header) => { if (!header.isConnected) undecorate(header) })
    }

    /* ============================ 模块出口 ============================ */
    exports.name = 'dsh-geek-header'
    exports.inject = ['sessions']
    exports.apply = function apply(ctx) {
      const registry = createRegistry()

      /* 第三方插件区服务（cordis 服务协作，不走 slot 体系：row1 在官方树外） */
      ctx.provide('geekUiHeader')
      ctx.geekUiHeader = {
        register: (entry) => registry.register(entry),
      }

      const services = {
        registry,
        sessions: ctx.sessions,
        /* 可选依赖：读当前选中模型；缺席时按钮不带路由，host 回落 requestHeader */
        modelDirectories: ctx.get('modelDirectories'),
      }

      /* 样式 + DOM 观察，随 Fiber 回收（HMR 重载不残留） */
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-geek-header'
        style.textContent = CSS
        document.head.appendChild(style)

        const HEADER_SLOT_SEL = '[data-slot="' + SLOT_HEADER + '"]'
        const mo = new MutationObserver((mutations) => {
          /* 收窄触发面：只有 header 槽锚点出现/消失才全量 syncAll（聊天流式的 DOM 变动不波及）；
           * header 内部的变动只 measure；记录回收每批做（records 极小，isConnected 检查 O(1)）。 */
          let rescan = false
          const toMeasure = new Set()
          for (const m of mutations) {
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue
              if (!rescan && (n.matches(HEADER_SLOT_SEL) || (n.querySelector && n.querySelector(HEADER_SLOT_SEL)))) rescan = true
            }
            /* 向槽锚点内部插入节点（React 分批挂载：先有锚点、后有 header）也要触发重扫 */
            const t = m.target
            if (t && t.nodeType === 1 && typeof t.closest === 'function') {
              if (!rescan && t.closest(HEADER_SLOT_SEL)) rescan = true
              const header = t.closest('header[data-dgu-root]')
              if (header) toMeasure.add(header)
            }
          }
          records.forEach((_, header) => { if (!header.isConnected) undecorate(header) })
          if (rescan) syncAll(services)
          toMeasure.forEach(measure)
        })
        mo.observe(document.body, { childList: true, subtree: true })
        syncAll(services)

        return () => {
          mo.disconnect()
          records.forEach((_, header) => undecorate(header))
          style.remove()
        }
      }, 'dsh-geek-header: header decorator')

      console.log('[dsh-geek-header] mounted (row1 = geekUiHeader registry, row2 = tabs + 生成标题 + 系统提示词 + actions, crumbs/utilities hidden)')
    }

    return module.exports
  },
})
