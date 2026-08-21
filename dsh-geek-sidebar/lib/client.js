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
const workbenchMod = (function (React, host) {
/* workbench feature 维护源码（可读版）：侧栏（工作区/会话/git worktree）、文件管理器（项目/笔记）、
 * 文件预览（大纲/编辑/聚焦重读/手动刷新）、底栏（技能/助手入口）。
 * 由 parts/build.mjs 与 head.js / skills.js / tail.js 拼接成 lib/client.js；改这里，别改产物。 */
/* 评审修复：会话桶 LRU 上限——原先 buckets 只增不减，随会话数无界增长 */
const STORE_MAX_BUCKETS = 50,
  store = {
    buckets: {},
    bucket(t) {
      const e = t || "_",
        bs = store.buckets;
      let b = bs[e];
      /* 命中即提为最新（删了重挂，对象键序即新旧序） */
      if (b) return (delete bs[e]), (bs[e] = b), b;
      b = bs[e] = { files: [], active: null };
      /* 评审修复：超额淘汰最旧的非当前会话桶（空桶优先，都不空才连文件态忍痛淘）。
       * sessionProbe 在 06-misc，本文件被 smoke 单独 eval 时它不在——typeof 守卫同 02 的 CODE_LANGS 例 */
      const ks = Object.keys(bs);
      if (ks.length > STORE_MAX_BUCKETS) {
        const act = typeof sessionProbe !== "undefined" ? sessionProbe.sid : null;
        let v = null;
        for (const k of ks)
          if (k !== e && !(act && k === act) && bs[k].files.length === 0) {
            v = k;
            break;
          }
        if (!v)
          for (const k of ks)
            if (k !== e && !(act && k === act)) {
              v = k;
              break;
            }
        v && delete bs[v];
      }
      return b;
    },
    open(t, e) {
      const s = store.bucket(t);
      /* 已打开也要激活 + fire——旧版 || 短路导致"重复点击已打开文件不切换"（评审 P2） */
      if (!s.files.some((o) => o.path === e.path)) s.files = s.files.concat([e]);
      s.active = e.path;
      bus.fire();
    },
    close(t, e) {
      const s = store.bucket(t);
      ((s.files = s.files.filter((o) => o.path !== e)),
        s.active === e &&
          (s.active = s.files.length ? s.files[s.files.length - 1].path : null),
        bus.fire());
    },
    setActive(t, e) {
      ((store.bucket(t).active = e), bus.fire());
    },
    sub(t) {
      return bus.sub(t);
    },
  },
  bus = {
    fns: [],
    chans: {},
    /* 频道语义（评审修复：热路径扇出拆分——原先单 bus，ACP 20fps 流式 chunk 把
     * 侧栏树/详情 markdown 一起拖着重渲染）：
     *   fire()    全局 + 全部频道（稀有事件，兼容旧订阅，人人听得到）；
     *   fire(ch)  仅该频道（热路径专用：只有订阅该频道的视图重渲染） */
    fire(t) {
      if (t) {
        for (const e of (bus.chans[t] || []).slice()) e();
        return;
      }
      for (const e of bus.fns.slice()) e();
      for (const s in bus.chans) for (const e of bus.chans[s].slice()) e();
    },
    sub(t, e) {
      if (!e)
        return (
          bus.fns.push(t),
          () => {
            const s = bus.fns.indexOf(t);
            s >= 0 && bus.fns.splice(s, 1);
          }
        );
      const s = bus.chans[e] || (bus.chans[e] = []);
      return (
        s.push(t),
        () => {
          const i = s.indexOf(t);
          i >= 0 && s.splice(i, 1);
        }
      );
    },
  },
  /* createValueStore：value-store 工厂（字段访问 + set + bus.fire 三件套）。
   * setFn 返回 false 时不触发 fire（用于"值不变不刷新"）。取代手抄的同名模式。 */
  createValueStore = (fields, setFn) => {
    const s = Object.assign({}, fields);
    s.set = (v) => {
      if (setFn(s, v) !== false) bus.fire();
    };
    return s;
  },
  viewStore = createValueStore({ view: "main" }, (s, v) => {
    s.view = v;
  }),
  notesStore = createValueStore({ dirs: [], current: null }, (s, v) => {
    ((s.dirs = (v && v.dirs) || []), (s.current = (v && v.current) || null));
  }),
  filesTabStore = createValueStore({ tab: "project" }, (s, v) => s.tab !== v && (s.tab = v)),
  /* 图片点击放大：当前放大的图片 src，null = 关闭 */
  imgZoomStore = createValueStore({ src: null }, (s, v) => {
    s.src = v || null;
  }),
  /* 下侧边栏（助手面板）开态：open/tab/height。组件在 15-bottom-panel.js，
   * store 必须放最前——渲染若早于后续文件求值会踩跨文件 TDZ（实战踩过）。 */
  bottomPanel = {
    open: false,
    tab: "terminal",
    height: (() => {
      /* 非浏览器环境（smoke eval）无 window，兜底 360 */
      try {
        const w = typeof window !== "undefined" ? window : null;
        const v = w && w.localStorage ? Number(w.localStorage.getItem("pw-bpanel-h")) : 0;
        if (v >= 140 && v <= 900) return v;
        if (w && w.innerHeight) return Math.max(180, Math.round(w.innerHeight * 0.42));
      } catch (e) {}
      return 360;
    })(),
    set(patch) {
      Object.assign(bottomPanel, patch);
      bus.fire();
    },
  },
  /* 底部区域仲裁：第三方经 dshBottomPanels.acquire(id) 独占占位，占位期间我们的面板
   * 让位（open 状态保留，release 后自动归位）——对齐右栏 details 的"它开我们让位、
   * 它关我们归位"。右栏靠 single 槽 priority 天然仲裁；shell.overlay 是多槽无此语义，
   * 故自建排他锁。面板组件在 15-bottom-panel.js，消费方 BottomPanel 渲染与挤压都读它。 */
  bottomArea = {
    owner: null,
    acquire(t) {
      if (!t || (bottomArea.owner && bottomArea.owner !== t)) return false;
      if (bottomArea.owner === t) return true;
      ((bottomArea.owner = t), bus.fire());
      return true;
    },
    release(t) {
      if (!bottomArea.owner) return false;
      if (t !== undefined && bottomArea.owner !== t) return false;
      ((bottomArea.owner = null), bus.fire());
      return true;
    },
    isYielded() {
      return !!bottomArea.owner;
    },
  };
function useNotes() {
  const t = React.useState(0);
  return (
    React.useEffect(() => bus.sub(() => t[1]((e) => e + 1)), []),
    { dirs: notesStore.dirs, current: notesStore.current }
  );
}
const baseName = (t) =>
  String(t || "")
    .replace(/\/+$/, "")
    .split("/")
    .pop() || "";
function useFilesTab() {
  const t = React.useState(filesTabStore.tab);
  return (
    React.useEffect(() => bus.sub(() => t[1](filesTabStore.tab)), []),
    t[0]
  );
}
const pickNotesDir = () => {
    host
      .call("workbench.notesPick", {})
      .then((t) => {
        t &&
          t.ok &&
          (notesStore.set(t),
          viewStore.set("main"),
          filesTabStore.set("notes"));
      })
      .catch(() => {});
  },
  selectNotesDir = (t) => {
    host
      .call("workbench.notesSelect", { dir: t })
      .then((e) => {
        e && e.ok && notesStore.set(e);
      })
      .catch(() => {});
  };
function usePreviewState(t) {
  const s = React.useState(0)[1];
  React.useEffect(() => store.sub(() => s((l) => l + 1)), []);
  const o = store.bucket(t),
    a = o.files.find((l) => l.path === o.active) || null;
  return { files: o.files, active: o.active, activeFile: a };
}
function useView() {
  const t = React.useState(viewStore.view);
  return (React.useEffect(() => bus.sub(() => t[1](viewStore.view)), []), t[0]);
}
function relTime(t) {
  if (!t) return "";
  const e = Date.now() - t,
    s = Math.floor(e / 6e4);
  if (s < 1) return "just now";
  if (s < 60) return s + "m ago";
  const o = Math.floor(s / 60);
  if (o < 24) return o + "h ago";
  const a = Math.floor(o / 24);
  return a < 30 ? a + "d ago" : new Date(t).toLocaleDateString();
}
/* 评审修复（去重 #7）：shortPath 本体已删——唯一定义在 skills.js 的 shortenPath
 *（/Users 与 /home 双前缀，是原 shortPath 的超集，行为逐点保持；已用真实 bundle
 * 结构探针验证作用域链解析）。skills.js 与 workbench IIFE 同属 factory 作用域且
 * function 声明整体提升，IIFE 内经作用域链取用，与拼接先后无关。
 * smoke 静态断言守着这个依赖（skills.js 改名/删除即红）。
 * 注：PencilIcon 未一并收敛（skills 版 11px 固定 vs 本侧 13px 参数化），见 05-icons */
function canonPath(t) {
  return String(t || "")
    .replace(/\/+$/, "")
    .toLowerCase();
}
/* 跨文件共享的工作区态：当前项目根（@提及/终端 cwd/技能弹窗用）与文件管理器展开偏好。
 * 全部在渲染/回调期读写（无求值期依赖），声明放 stores 文件合乎归属（原寄居 05-icons 末尾）。 */
let explorerOpenPref = !0,
  currentRootPath = null;
/* 评审修复：root 变更一律走 setter 发 bus 节拍——裸赋值时订阅方（终端换绑等）
 * 感知不到切换；读取侧不变，仍直接读 currentRootPath */
const setCurrentRootPath = (t) => {
  currentRootPath !== t && ((currentRootPath = t), bus.fire());
};
const isMd = (t) => /\.(md|markdown)$/i.test(t);
/* 评审修复：bd（链接/图片解析基目录）显式传参——原经 12-mdpath 的模块级
 * var mdBaseDir 隐式传递，渲染期写共享态（并发/顺序敏感）。行为逐点保持 */
function mdInline(t, bd) {
  const e = [],
    s =
      /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\))/g;
  let o = 0,
    a,
    l = 0;
  for (; (a = s.exec(t)) !== null;) {
    a.index > o && e.push(t.slice(o, a.index));
    const c = a[0];
    if (c.startsWith("**") || c.startsWith("__"))
      e.push(React.createElement("strong", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("~~"))
      e.push(React.createElement("del", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("`"))
      e.push(
        React.createElement(
          "code",
          { key: l++, className: "pw-inline-code" },
          c.slice(1, -1),
        ),
      );
    else if (c.startsWith("![")) {
      const u = c.match(/!\[([^\]]*)\]\(([^)]*)\)/);
      e.push(
        React.createElement("img", {
          key: l++,
          src: mediaUrl(u[2], bd),
          alt: u[1],
          style: { maxWidth: "100%" },
          onClick: (g) => {
            (g.stopPropagation(), imgZoomStore.set(mediaUrl(u[2], bd)));
          },
          onError: (g) => {
            const t = g.currentTarget;
            t.style.display = "none";
            const ph = document.createElement("span");
            ph.className = "pw-img-broken";
            ph.textContent = "图片加载失败：" + (u[1] || u[2]);
            t.parentNode && t.parentNode.insertBefore(ph, t);
          },
        }),
      );
    } else if (c.startsWith("[")) {
      const u = c.match(/\[([^\]]*)\]\(([^)]*)\)/);
      e.push(
        React.createElement(
          "a",
          {
            key: l++,
            href: u[2],
            target: "_blank",
            rel: "noreferrer",
            onClick: (g) => {
              const p = resolveLocalPath(u[2], bd);
              p && (g.preventDefault(), openLocalPath(p));
            },
          },
          u[1],
        ),
      );
    } else e.push(React.createElement("em", { key: l++ }, c.slice(1, -1)));
    o = a.index + c.length;
  }
  return (o < t.length && e.push(t.slice(o)), e);
}
function renderMarkdown(t, e, bd) {
  bd = typeof bd == "string" ? bd : "";
  const s = String(t).replace(
      /\r\n/g,
      `
`,
    ).split(`
`),
    o = [];
  let a = 0,
    l = 0;
  const c = React.createElement;
  for (; a < s.length;) {
    const r = s[a].trim();
    if (r === "") {
      a++;
      continue;
    }
    if (r.startsWith("```")) {
      /* 围栏语言：CODE_LANGS 认识（js/ts/py/sh/json 系）才接 highlightCode 着色——
       * 未知语言（含 mermaid）保持原文，highlightCode 对未知语言会错染 js 关键词。
       * mermaid 不图形渲染（用户决策 2026-08：使用频率低，不值得 +1MB vendor 依赖；
       * 与主对话行为一致——主应用同样按源码块展示），回看点此注释再议 */
      const lang = r.slice(3).trim().toLowerCase(),
        h = [];
      for (a++; a < s.length && !s[a].trim().startsWith("```");)
        (h.push(s[a]), a++);
      const body = h.join(`
`);
      (a++,
        o.push(
          c(
            "pre",
            { key: l++, className: "pw-code" },
            c(
              "code",
              null,
              lang && typeof CODE_LANGS !== "undefined" && CODE_LANGS[lang] ? highlightCode(body, lang) : body,
            ),
          ),
        ));
      continue;
    }
    const m = r.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const h = { key: l++, className: "pw-h" };
      if (e) {
        const g = e.length;
        (e.push(null),
          (h.ref = (y) => {
            e[g] = y;
          }));
      }
      (o.push(c("h" + m[1].length, h, mdInline(m[2], bd))), a++);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(r)) {
      (o.push(c("hr", { key: l++ })), a++);
      continue;
    }
    if (/^>\s?/.test(r)) {
      const h = [];
      for (; a < s.length && /^>\s?/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^>\s?/, "")), a++);
      o.push(
        c(
          "blockquote",
          { key: l++, className: "pw-quote" },
          mdInline(h.join(" "), bd),
        ),
      );
      continue;
    }
    if (
      /^\|(.+)\|\s*$/.test(r) &&
      a + 1 < s.length &&
      /^\|[\s:|-]+\|\s*$/.test(s[a + 1].trim())
    ) {
      const h = (x) =>
          x
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((p) => p.trim()),
        g = h(s[a]);
      a += 2;
      const y = [];
      for (; a < s.length && /^\|(.+)\|\s*$/.test(s[a].trim());)
        (y.push(h(s[a])), a++);
      o.push(
        c(
          "table",
          { key: l++, className: "pw-table" },
          c(
            "thead",
            null,
            c(
              "tr",
              null,
              g.map((x, p) => c("th", { key: p }, mdInline(x, bd))),
            ),
          ),
          c(
            "tbody",
            null,
            y.map((x, p) =>
              c(
                "tr",
                { key: p },
                x.map((C, I) => c("td", { key: I }, mdInline(C, bd))),
              ),
            ),
          ),
        ),
      );
      continue;
    }
    if (/^[-*+]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^[-*+]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^[-*+]\s+/, "")), a++);
      o.push(
        c(
          "ul",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g, bd))),
        ),
      );
      continue;
    }
    if (/^\d+[.)]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^\d+[.)]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^\d+[.)]\s+/, "")), a++);
      o.push(
        c(
          "ol",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g, bd))),
        ),
      );
      continue;
    }
    const k = [r];
    for (a++; a < s.length;) {
      const h = s[a].trim();
      if (
        h === "" ||
        h.startsWith("```") ||
        /^(#{1,6})\s/.test(h) ||
        /^>/.test(h) ||
        /^[-*+]\s/.test(h) ||
        /^\d+[.)]\s/.test(h) ||
        /^\|/.test(h)
      )
        break;
      (k.push(h), a++);
    }
    o.push(c("p", { key: l++, className: "pw-p" }, mdInline(k.join(" "), bd)));
  }
  return o;
}
function TreeNode(t) {
  const e = t.entry,
    s = t.depth,
    o = t.treeState,
    a = React.createElement,
    l = e.type === "directory",
    c = !!o.expanded[e.path],
    u = o.children[e.path],
    r = !!o.loading[e.path],
    m = t.activePath === e.path,
    h2 = useTwoClick(), /* 评审修复：两击确认收敛 06-misc 共享状态机（原手抄 useState；id 用常量 1） */
    g2 = h2[0] === 1,
    C2 = (v) => (v ? h2[1](1) : h2[2]()),
    doDel = () => {
      (C2(!1), t.onDelete && t.onDelete(e));
    },
    h = [
      a(
        "div",
        {
          className: "pw-tree-row" + (m ? " active" : ""),
          style: { paddingLeft: 8 + s * 14 + "px" },
          onClick: () => t.onOpen(e),
        },
        a(
          "span",
          { className: "pw-tree-arrow" },
          l ? (c ? ChevronDown(11) : ChevronRight(11)) : "",
        ),
        a(
          "span",
          { className: "pw-tree-icon" },
          l ? FolderIcon(13) : fileIconEl(e.name, 13),
        ),
        a("span", { className: "pw-tree-name" }, e.name),
        r ? a("span", { className: "pw-tree-loading" }, "…") : null,
        t.onMention
          ? a(
              "button",
              {
                className: "pw-tree-dl",
                title: "@ 提及到输入框",
                onClick: (g) => {
                  (g.stopPropagation(), t.onMention(e));
                },
              },
              AtIcon(12),
            )
          : null,
        a(
          "button",
          {
            className:
              "pw-tree-dl" +
              (t.dlBusy === e.path ? " spin" : "") +
              (t.dlDone === e.path ? " flash" : ""),
            title: l ? "打包下载到 ~/Downloads" : "下载到 ~/Downloads",
            onClick: (g) => {
              (g.stopPropagation(), t.onDownload && t.onDownload(e));
            },
          },
          DownloadIcon(12),
          t.dlDone === e.path ? flashEl(11) : null,
        ),
        t.onDelete
          ? g2
            ? a(
                React.Fragment,
                null,
                a(
                  "button",
                  {
                    className: "pw-tree-dl danger",
                    title: "确认删除（移到废纸篓）",
                    onClick: (g) => {
                      (g.stopPropagation(), doDel());
                    },
                  },
                  "✓",
                ),
                a(
                  "button",
                  {
                    className: "pw-tree-dl",
                    title: "取消",
                    onClick: (g) => {
                      (g.stopPropagation(), C2(!1));
                    },
                  },
                  "×",
                ),
              )
            : a(
                "button",
                {
                  className: "pw-tree-dl",
                  title: "删除（移到废纸篓，Shift 跳过确认）",
                  onClick: (g) => {
                    (g.stopPropagation(), g.shiftKey ? doDel() : C2(!0));
                  },
                },
                TrashIcon(12),
              )
          : null,
      ),
    ];
  if (l && c && u) {
    for (const g of u)
      g.name === ".DS_Store" ||
        h.push(
          a(TreeNode, {
            key: g.path,
            entry: g,
            depth: s + 1,
            treeState: o,
            onOpen: t.onOpen,
            onDownload: t.onDownload,
            dlBusy: t.dlBusy,
            dlDone: t.dlDone,
            onMention: t.onMention,
            activePath: t.activePath,
            onDelete: t.onDelete,
          }),
        );
    u.length === 0 &&
      h.push(
        a(
          "div",
          {
            key: "empty",
            className: "pw-tree-empty",
            style: { paddingLeft: 22 + s * 14 + "px" },
          },
          "empty",
        ),
      );
  }
  return a(React.Fragment, null, h);
}
const OA = Object.assign;
/* 打开文件预览前请右栏当前占用者退场：自家驱动经 panelStore.close() 正常归位；
 * 外来面板（如 GTM 抽屉，打开即注册 details、无外部关闭 API）则点它自带的 × 按钮，
 * 走它自己的清理路径（注销注册 + 关栏 + 复位开态），状态一致。选择器失效时静默退化为不轮换。 */
function yieldToPreview() {
  try {
    panelStore.close();
  } catch (e) {}
  try {
    const b = document.querySelector('.dsh-gtm-drawer .dsh-gtm-head button[title="关闭"]');
    if (b) b.click();
  } catch (e) {}
}
function FileBrowser(t) {
  const e = React.createElement,
    o = (t.tab || "project") === "notes",
    a = t.notesDir || null,
    l = o ? a : t.root,
    c = t.open !== !1,
    u = t.onToggle,
    r = React.useState({ expanded: {}, children: {}, loading: {}, rev: 0 }),
    m = r[0],
    k = r[1],
    h = React.useState(!1),
    g = h[0],
    y = h[1],
    x = React.useState(!1),
    p = x[0],
    C = x[1],
    I = React.useState(null),
    R = I[0],
    T = I[1],
    H = React.useState(null),
    b = H[0],
    L = H[1],
    A = React.useState(!1),
    E = A[0],
    D = A[1],
    w = (i, N) => (
      k((S) => {
        if (!N && S.children[i]) return S;
        const v = OA({}, S.loading);
        return ((v[i] = !0), OA({}, S, { loading: v }));
      }),
      host
        .call("workbench.listDir", { path: i })
        .then((S) => {
          k((v) => {
            const F = OA({}, v.children),
              X = OA({}, v.loading);
            return (
              delete X[i],
              (F[i] = (S && S.entries) || []),
              OA({}, v, { children: F, loading: X })
            );
          });
        })
        .catch(() => {
          k((S) => {
            const v = OA({}, S.loading);
            return (delete v[i], OA({}, S, { loading: v }));
          });
        })
    );
  React.useEffect(() => {
    l && w(l);
  }, [l]);
  const j = (i) => {
      if (i.type === "directory") {
        const N = !m.expanded[i.path];
        (k((S) => {
          const v = OA({}, S.expanded);
          return ((v[i.path] = N), OA({}, S, { expanded: v }));
        }),
          N && !m.children[i.path] && w(i.path));
      } else
        (yieldToPreview(),
          store.open(t.sessionId, { path: i.path, name: i.name }),
          t.layout && t.layout.openDetails());
    },
    z = (i) => {
      R ||
        (L(null),
        T(i.path),
        host
          .call(
            i.type === "directory"
              ? "workbench.downloadDir"
              : "workbench.download",
            { path: i.path },
          )
          .then((N) => {
            (T(null), N && N.ok && L(i.path));
          })
          .catch(() => T(null)));
    },
    K = () => {
      l &&
        host
          .call("workbench.uploadPick", { destDir: l })
          .then((i) => {
            i && i.ok && B();
          })
          .catch(() => {});
    };
  React.useEffect(() => store.sub(() => k((i) => OA({}, i))), []);
  const B = () => {
      if (g) return;
      (C(!1), y(!0));
      const i = Object.keys(m.expanded).filter(
        (v) => m.expanded[v] && l && (v === l || v.indexOf(l + "/") === 0),
      );
      k((v) => ({
        expanded: v.expanded,
        children: {},
        loading: {},
        rev: v.rev + 1,
      }));
      const N = [];
      l && N.push(w(l, !0));
      for (const v of i) v !== l && N.push(w(v, !0));
      const S = () => {
        (y(!1), flashDone(C));
      };
      /* Promise.all([]) 也会正常 resolve，无需对空数组再补一次（旧版 S 会跑两遍，评审 P3） */
      Promise.all(N).then(S, S);
    },
    onDel = (i) => {
      host
        .call("workbench.delete", { path: i.path })
        .then((N) => {
          if (!N || !N.ok) return;
          const dir = i.path.replace(/\/[^/]*$/, "") || "/";
          (k((S) => {
            const v = OA({}, S.children);
            delete v[i.path];
            for (const F of Object.keys(v))
              F.indexOf(i.path + "/") === 0 && delete v[F];
            const X = OA({}, S.expanded);
            return (delete X[i.path], OA({}, S, { children: v, expanded: X }));
          }),
            dir && w(dir, !0));
          const ab = store.bucket(t.sessionId);
          ab.active &&
            (ab.active === i.path || ab.active.indexOf(i.path + "/") === 0) &&
            store.close(t.sessionId, ab.active);
        })
        .catch((N) => {
          console.error("[dsh-geek-sidebar] delete failed", N);
        });
    },
    _ = l ? m.children[l] : null,
    q = o
      ? e(
          "div",
          { className: "pw-nsel" },
          e(
            "button",
            { className: "pw-sel-btn", title: l || "选择笔记目录", onClick: () => D(!E) },
            e(
              "span",
              { className: "pw-mono" + (l ? " pw-tail" : " dim") },
              l ? "\u200e" + shortenPath(l) : "选择笔记目录…",
            ),
          ),
          E ? dropOverlayEl(() => D(!1)) : null,
          E
            ? e(
                "div",
                { className: "pw-drop" },
                e(
                  "div",
                  { className: "pw-drop-list" },
                  (t.notesDirs || []).map((i) =>
                    dropRowEl({
                      k: i,
                      cur: l === i,
                      onClick: () => {
                        (D(!1), selectNotesDir(i));
                      },
                      label: baseName(i),
                    }),
                  ),
                ),
                e(
                  "button",
                  {
                    className: "pw-drop-foot",
                    onClick: () => {
                      (D(!1), t.onPickNotes && t.onPickNotes());
                    },
                  },
                  e("span", { className: "pw-check" }, "＋"),
                  "选择目录…",
                ),
              )
            : null,
        )
      : null;
  return e(
    "div",
    { className: "pw-files" + (c ? "" : " closed") },
    e(
      "div",
      { className: "pw-files-head" },
      e(
        "button",
        {
          className: "pw-files-toggle",
          title: c ? "收起" : "展开",
          onClick: () => u && u(!c),
        },
        e("span", { className: "pw-files-chev" }, ChevronRight(9)),
      ),
      e(
        "div",
        { className: "pw-ftabs" },
        e(
          "button",
          {
            className: "pw-ftab" + (o ? "" : " on"),
            onClick: () => {
              (!c && u && u(!0), t.onTab && t.onTab("project"));
            },
          },
          "项目",
        ),
        e(
          "button",
          {
            className: "pw-ftab" + (o ? " on" : ""),
            onClick: () => {
              (!c && u && u(!0), t.onTab && t.onTab("notes"));
            },
          },
          "笔记",
        ),
      ),
      e(
        "span",
        { className: "pw-files-actions" },
        l
          ? e(
              "button",
              {
                className: "pw-icon-btn",
                title: "上传文件到此目录",
                onClick: K,
              },
              UploadIcon(13),
            )
          : null,
        l && (o || t.workspaces)
          ? e(
              "button",
              {
                className: "pw-icon-btn",
                title: "在系统中打开",
                onClick: () => {
                  o
                    ? host.call("workbench.reveal", { path: l }).catch(() => {})
                    : t.workspaces.openPath(l);
                },
              },
              ExternalIcon(13),
            )
          : null,
        e(
          "button",
          {
            className: "pw-icon-btn" + (g ? " spin" : "") + (p ? " flash" : ""),
            title: "刷新",
            onClick: B,
          },
          RefreshIcon(13),
          p ? flashEl(13) : null,
        ),
      ),
    ),
    c ? q : null,
    c
      ? e(
          "div",
          { className: "pw-files-body" },
          o && !l
            ? e("div", { className: "pw-hint" }, "从上方下拉选择或添加笔记目录")
            : l
              ? _
                ? _.filter((i) => i.name !== ".DS_Store").map((i) =>
                    e(TreeNode, {
                      key: i.path,
                      entry: i,
                      depth: 0,
                      treeState: m,
                      onOpen: j,
                      onDownload: z,
                      dlBusy: R,
                      dlDone: b,
                      onMention: o ? t.onMentionAbs : t.onMention,
                      activePath: store.bucket(t.sessionId).active,
                      onDelete: onDel,
                    }),
                  )
                : e("div", { className: "pw-hint" }, "加载中…")
              : e("div", { className: "pw-hint" }, "无工作区"),
        )
      : null,
  );
}
function FootBar(t) {
  const e = React.createElement;
  /* 评审修复：删掉 useView()/useFilesTab() 两个"只为订阅、返回值从未使用"的废调用——
   * 重渲染由下面这条 bus 订阅一肩挑（acp 徽标 / bottomPanel 开态全走 bus） */
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  return t.wide === !1
    ? null
    : e(
        "div",
        { className: "pw-footbar" },
        e(
          "button",
          {
            className: "pw-foot-btn",
            onClick: () => t.onSkills && t.onSkills(),
          },
          e("span", { className: "pw-foot-ic" }, LayersIcon(12)),
          "技能",
        ),
        (() => {
          /* 智能体聚合徽标：运行中（绿）/ 待交互（黄）数量，面板关着也能看见 */
          const ac = acpTabs.counts();
          return e(
            "button",
            {
              className: "pw-foot-btn" + (bottomPanel.open ? " on" : ""),
              title:
                "助手：终端 / Kimi 智能体" +
                (ac.total ? "（运行中 " + ac.run + " · 待交互 " + ac.wait + " · 共 " + ac.total + " 个）" : ""),
              onClick: () => bottomPanel.set({ open: !bottomPanel.open }),
            },
            e("span", { className: "pw-foot-ic" }, BotIcon(12)),
            "助手",
            ac.run > 0 ? e("span", { className: "pw-foot-badge run", title: "运行中 " + ac.run }, String(ac.run)) : null,
            ac.wait > 0 ? e("span", { className: "pw-foot-badge wait", title: "待交互 " + ac.wait }, String(ac.wait)) : null,
          );
        })(),
      );
}

function iconSvg(t, e) {
  return React.createElement(
    "svg",
    {
      width: e || 13,
      height: e || 13,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    t,
  );
}
const elIcon = React.createElement;
function ic(t, e) {
  return iconSvg(
    t.map((s, o) => {
      const a = s[0];
      return a === "p"
        ? elIcon("path", { key: o, d: s[1] })
        : a === "l"
          ? elIcon("line", { key: o, x1: s[1], y1: s[2], x2: s[3], y2: s[4] })
          : a === "pl"
            ? elIcon("polyline", { key: o, points: s[1] })
            : a === "r"
              ? elIcon("rect", {
                  key: o,
                  x: s[1],
                  y: s[2],
                  width: s[3],
                  height: s[4],
                  rx: s[5],
                })
              : elIcon("circle", { key: o, cx: s[1], cy: s[2], r: s[3] });
    }),
    e,
  );
}
/* PencilIcon 与 skills.js 的同名图标不算可去重的重复：skills.js 版是 11px 固定尺寸
 *（技能弹窗专用），本版参数化且两个调用点（08/11）都是 13px——统一需动 skills.js 或
 * head.js 共享层（评审修复轮均划为禁区），保持各自本体（评审修复 #7 只收敛了 shortPath） */
function PencilIcon(t) {
  return ic(
    [["p", "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"]],
    t,
  );
}
function TrashIcon(t) {
  return ic(
    [
      ["pl", "3 6 5 6 21 6"],
      ["p", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
      ["p", "M10 11v6M14 11v6"],
      ["p", "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"],
    ],
    t,
  );
}
function ArchiveIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 4, 1],
      ["p", "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"],
      ["p", "M10 12h4"],
    ],
    t,
  );
}
function FolderIcon(t) {
  return ic(
    [
      [
        "p",
        "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
      ],
    ],
    t,
  );
}
function FileIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
    ],
    t,
  );
}
function FileTextIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
      ["l", 16, 13, 8, 13],
      ["l", 16, 17, 8, 17],
    ],
    t,
  );
}
function ImageIcon(t) {
  return ic(
    [
      ["r", 3, 3, 18, 18, 2],
      ["c", 8.5, 8.5, 1.5],
      ["pl", "21 15 16 10 5 21"],
    ],
    t,
  );
}
function CodeIcon(t) {
  return ic(
    [
      ["pl", "16 18 22 12 16 6"],
      ["pl", "8 6 2 12 8 18"],
    ],
    t,
  );
}
function BracesIcon(t) {
  return ic(
    [
      [
        "p",
        "M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1",
      ],
      [
        "p",
        "M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1",
      ],
    ],
    t,
  );
}
function GlobeIcon(t) {
  return ic(
    [
      ["c", 12, 12, 10],
      ["l", 2, 12, 22, 12],
      [
        "p",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
      ],
    ],
    t,
  );
}
function RefreshIcon(t) {
  return ic(
    [
      ["p", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"],
      ["p", "M3 3v5h5"],
    ],
    t,
  );
}
function ExternalIcon(t) {
  return ic(
    [
      ["p", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
      ["pl", "15 3 21 3 21 9"],
      ["l", 10, 14, 21, 3],
    ],
    t,
  );
}
function DownloadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "7 10 12 15 17 10"],
      ["l", 12, 15, 12, 3],
    ],
    t,
  );
}
function UploadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "17 8 12 3 7 8"],
      ["l", 12, 3, 12, 15],
    ],
    t,
  );
}
function ListIcon(t) {
  return ic(
    [
      ["l", 8, 6, 21, 6],
      ["l", 8, 12, 21, 12],
      ["l", 8, 18, 21, 18],
      ["l", 3, 6, 3.01, 6],
      ["l", 3, 12, 3.01, 12],
      ["l", 3, 18, 3.01, 18],
    ],
    t,
  );
}
function ChevronRight(t) {
  return ic([["pl", "9 18 15 12 9 6"]], t);
}
function ChevronDown(t) {
  return ic([["pl", "6 9 12 15 18 9"]], t);
}
function CheckIcon(t) {
  return ic([["pl", "20 6 9 17 4 12"]], t);
}
function AtIcon(t) {
  return ic(
    [
      ["c", 12, 12, 4],
      ["p", "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
    ],
    t,
  );
}
function GitBranchIcon(t) {
  return ic(
    [
      ["l", 6, 3, 6, 15],
      ["c", 18, 6, 3],
      ["c", 6, 18, 3],
      ["p", "M18 9a9 9 0 0 1-9 9"],
    ],
    t,
  );
}
function CopyIcon(t) {
  return ic(
    [
      ["r", 9, 9, 13, 13, 2],
      ["p", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
    ],
    t,
  );
}
function MinimizeIcon(t) {
  return ic(
    [
      ["pl", "4 14 10 14 10 20"],
      ["pl", "20 10 14 10 14 4"],
      ["l", 10, 14, 3, 21],
      ["l", 21, 3, 14, 10],
    ],
    t,
  );
}
/* 实心停止块（压缩中等中止态用，pi-web 同款）：ic() 是描边体系，这里子节点显式填充 */
function StopIcon(t) {
  return iconSvg([elIcon("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2, fill: "currentColor", stroke: "none" })], t);
}
/* 对勾闪现：置位 1.2s 后自动复位（评审修复：原先只置位不复位，刷新/下载对勾永久残留；
 * 两处调用方 03-tree.js/09-sidebar.js 均传布尔 setter，宿主组件常驻，超时后 setState 安全） */
function flashDone(t) {
  t(!0);
  setTimeout(() => t(!1), 1200);
}
const flashEl = (t) =>
  React.createElement("span", { className: "pw-flash-check" }, CheckIcon(t));
const recentRoots = [];
function rememberRoot(t) {
  if (!t) return;
  const e = recentRoots.indexOf(t);
  (e >= 0 && recentRoots.splice(e, 1),
    recentRoots.unshift(t),
    recentRoots.length > 8 && (recentRoots.length = 8));
}
const sessionProbe = {
  sid: null,
  set(t) {
    sessionProbe.sid !== t && ((sessionProbe.sid = t), bus.fire());
  },
  sub(t) {
    return bus.sub(t);
  },
};
function mentionPath(t, e) {
  const s = currentRootPath;
  return (
    "@" +
    (s && t.indexOf(s + "/") === 0 ? t.slice(s.length + 1) : t) +
    (e ? "/ " : " ")
  );
}
/* 评审修复：两击确认状态机——原 03 树删除 / 08 归档 / 09 worktree / 15-acp 历史
 * 四处各抄一份 useState。返回 [armedId, ask(id), cancel()]；布尔场景用常量 id（如 1）。
 * 各调用点以适配器保持原签名（is(id) === (armed === id)），行为逐点不变 */
function useTwoClick() {
  const t = React.useState(null);
  return [t[0], t[1], () => t[1](null)];
}
/* 评审修复：下拉骨架三件套（遮罩 / 过滤框 / 选项行）——原 03 笔记目录、09 项目、
 * 09 worktree 三处复制同一套 pw-drop-* 结构。行尾徽标等额外子节点经 extra 注入 */
const dropOverlayEl = (t) =>
    React.createElement("div", {
      className: "pw-drop-overlay",
      onClick: t,
    }),
  dropFilterEl = (t, e, s) =>
    React.createElement(
      "div",
      { className: "pw-drop-filter" },
      React.createElement("input", {
        className: "pw-input",
        value: t,
        placeholder: e,
        onChange: (o) => s(o.target.value),
      }),
    ),
  dropRowEl = (t) =>
    React.createElement(
      "button",
      {
        key: t.k,
        className: "pw-drop-row" + (t.cur ? " cur" : ""),
        title: t.title,
        onClick: t.onClick,
      },
      React.createElement(
        "span",
        { className: "pw-check" },
        t.cur ? "✓" : "",
      ),
      React.createElement("span", { className: "pw-mono" }, t.label),
      t.extra || null,
    );
const CODE_KW = {
    js: "const let var function return if else for while class extends import export from default new try catch finally throw async await yield typeof instanceof in of switch case break continue this null undefined true false interface type enum implements readonly public private static",
    py: "def return if elif else for while class import from as with try except finally raise lambda yield async await pass break continue global nonlocal is in not and or True False None self print",
    sh: "if then else elif fi for while do done case esac function return local export echo cd exit source",
    json: "true false null",
  },
  CODE_LANGS = {
    js: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    ts: "js",
    tsx: "js",
    py: "py",
    sh: "sh",
    bash: "sh",
    zsh: "sh",
    json: "json",
  },
  isCodeExt = (t) =>
    Object.prototype.hasOwnProperty.call(
      CODE_LANGS,
      (t.split(".").pop() || "").toLowerCase(),
    ),
  isCsvExt = (t) => /\.csv$/i.test(t),
  isHtmlExt = (t) => /\.(html?|xhtml)$/i.test(t);
function codeTokens(t, e) {
  const s = [],
    o =
      /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b)/g;
  let a = 0,
    l,
    c = 0;
  for (; (l = o.exec(t)) !== null;) {
    (l.index > a && s.push(...kwWrap(t.slice(a, l.index), e, c)),
      (c = s.length));
    const u = l[0],
      r =
        u.charAt(0) === "/" || u.charAt(0) === "#"
          ? "c"
          : u.charAt(0) === '"' || u.charAt(0) === "'" || u.charAt(0) === "`"
            ? "s"
            : "n";
    (s.push(
      React.createElement(
        "span",
        { key: "t" + c++, className: "pw-tok-" + r },
        u,
      ),
    ),
      (a = l.index + u.length));
  }
  return (
    a < t.length && s.push(...kwWrap(t.slice(a), e, c)),
    s.length ? s : [t]
  );
}
function kwWrap(t, e, s) {
  if (!e) return [t];
  const o = [];
  let a = 0,
    l;
  const c = new RegExp(e.source, "g");
  for (; (l = c.exec(t)) !== null;)
    (l.index > a && o.push(t.slice(a, l.index)),
      o.push(
        React.createElement(
          "span",
          { key: "k" + s + "-" + l.index, className: "pw-tok-k" },
          l[0],
        ),
      ),
      (a = l.index + l[0].length));
  return (a < t.length && o.push(t.slice(a)), o);
}
function highlightCode(t, e) {
  const s = CODE_LANGS[e] || "js",
    o = CODE_KW[s],
    a = o ? new RegExp("\\b(" + o.split(" ").join("|") + ")\\b", "g") : null;
  return String(t)
    .split(
      `
`,
    )
    .map((l, c) =>
      React.createElement(
        "div",
        { key: c, className: "pw-codeline" },
        React.createElement("span", { className: "pw-lineno" }, String(c + 1)),
        React.createElement("span", null, codeTokens(l, a)),
      ),
    );
}
function parseCsv(t) {
  const e = [];
  let s = [],
    o = "",
    a = !1;
  for (let l = 0; l < t.length; l++) {
    const c = t[l];
    a
      ? c === '"'
        ? t[l + 1] === '"'
          ? ((o += '"'), l++)
          : (a = !1)
        : (o += c)
      : c === '"'
        ? (a = !0)
        : c === ","
          ? (s.push(o), (o = ""))
          : c ===
              `
`
            ? (s.push(o), e.push(s), (s = []), (o = ""))
            : c !== "\r" && (o += c);
  }
  return (
    (o !== "" || s.length) && (s.push(o), e.push(s)),
    e.filter((l) => l.length > 1 || l[0] !== "")
  );
}
function CsvView(t) {
  const e = React.createElement,
    s = parseCsv(t.text || "");
  if (s.length === 0) return e("pre", { className: "pw-src" }, t.text || "");
  const o = s[0],
    a = s.slice(1, 501);
  return e(
    "div",
    { className: "pw-csv-wrap" },
    e(
      "table",
      { className: "pw-csv" },
      e(
        "thead",
        null,
        e(
          "tr",
          null,
          o.map((l, c) => e("th", { key: c }, l)),
        ),
      ),
      e(
        "tbody",
        null,
        a.map((l, c) =>
          e(
            "tr",
            { key: c },
            l.map((u, r) => e("td", { key: r }, u)),
          ),
        ),
      ),
      s.length > 501
        ? e("div", { className: "pw-hint" }, "仅显示前 500 行")
        : null,
    ),
  );
}
function fileIconEl(t, e) {
  const s = (t.split(".").pop() || "").toLowerCase(),
    o = e || 13;
  return s === "md" || s === "markdown" || s === "txt"
    ? FileTextIcon(o)
    : ["png", "jpg", "jpeg", "gif", "webp", "svg"].indexOf(s) >= 0
      ? ImageIcon(o)
      : [
            "js",
            "ts",
            "jsx",
            "tsx",
            "mjs",
            "cjs",
            "py",
            "sh",
            "go",
            "rs",
            "java",
            "rb",
          ].indexOf(s) >= 0
        ? CodeIcon(o)
        : s === "json" || s === "yml" || s === "yaml" || s === "toml"
          ? BracesIcon(o)
          : ["html", "css", "vue"].indexOf(s) >= 0
            ? GlobeIcon(o)
            : FileIcon(o);
}
function SessionRow(t) {
  const e = React.createElement,
    s = t.sm,
    o = t.id,
    a = t.sessionsSvc,
    l = t.workspacesSvc,
    c = React.useState(!1),
    u = c[0],
    r = c[1],
    m = React.useState(""),
    k = m[0],
    h = m[1],
    g = useTwoClick(), /* 评审修复：两击确认收敛 06-misc 共享状态机（原手抄 useState；id 用常量 1） */
    y = g[0] === 1,
    x = (v) => (v ? g[1](1) : g[2]()),
    p = React.useState(!1),
    C = p[0],
    I = p[1],
    R = s.displayTitle || s.title || o,
    T = t.branch,
    H = (w) => {
      (w.stopPropagation(), h(R), r(!0));
    },
    b = () => {
      r(!1);
      const w = k.trim();
      if (!w || w === R) return;
      const j = a && a.binding ? a.binding(o) : void 0;
      j && typeof j.rename == "function" && j.rename(w).catch(() => {});
    },
    L = () => {
      (x(!1), I(!0), l && l.archiveSession(o).catch(() => I(!1)));
    },
    A = (w) => {
      if ((w.stopPropagation(), w.shiftKey)) {
        L();
        return;
      }
      x(!0);
    },
    E = (w) => {
      (w.stopPropagation(), l && l.archiveSession(o).catch(() => {}));
    },
    D = () => {
      u || y || (a && a.open(o));
    };
  return y
    ? e(
        "div",
        { className: "pw-sess-row confirming" },
        e(
          "span",
          { className: "pw-confirm-text" },
          "删除「" + (R.length > 22 ? R.slice(0, 22) + "…" : R) + "」？",
        ),
        e(
          "button",
          {
            className: "pw-btn-danger",
            onClick: (w) => {
              (w.stopPropagation(), L());
            },
          },
          TrashIcon(11),
          "删除",
        ),
        e(
          "button",
          {
            className: "pw-btn-plain",
            onClick: (w) => {
              (w.stopPropagation(), x(!1));
            },
          },
          "取消",
        ),
      )
    : u
      ? e(
          "div",
          { className: "pw-sess-row" },
          e("input", {
            className: "pw-sess-rename",
            value: k,
            autoFocus: !0,
            onFocus: (w) => w.currentTarget.select(),
            onChange: (w) => h(w.target.value),
            onBlur: b,
            onKeyDown: (w) => {
              (w.key === "Enter" && b(), w.key === "Escape" && r(!1));
            },
            onClick: (w) => w.stopPropagation(),
          }),
        )
      : e(
          "div",
          {
            className: "pw-sess-row" + (t.active ? " active" : ""),
            style: C ? { opacity: 0.5 } : null,
            onClick: D,
          },
          e(
            "div",
            { className: "pw-sess-main" },
            e("div", { className: "pw-sess-title", title: R }, R),
            e(
              "div",
              { className: "pw-sess-meta" },
              s.running ? e("span", { className: "pw-dot-run" }, "●") : null,
              s.pendingInteraction
                ? e("span", { className: "pw-dot-warn" }, "●")
                : null,
              T
                ? e(
                    "span",
                    { className: "pw-sess-wt", title: s.cwd },
                    GitBranchIcon(10),
                    " " + T,
                  )
                : null,
              e("span", null, relTime(s.updatedAt)),
            ),
          ),
          e(
            "div",
            { className: "pw-row-acts" },
            e(
              "button",
              { className: "pw-act-btn", title: "重命名", onClick: H },
              PencilIcon(13),
            ),
            e(
              "button",
              {
                className: "pw-act-btn danger",
                title: "删除（Shift 跳过确认）",
                onClick: A,
              },
              TrashIcon(13),
            ),
            e(
              "button",
              { className: "pw-act-btn", title: "归档会话", onClick: E },
              ArchiveIcon(13),
            ),
          ),
        );
}
function Sidebar(t) {
  const e = React.createElement,
    s = t.layout,
    o = t.sessionsSvc,
    a = t.workspacesSvc,
    l = useView(),
    c = useNotes(),
    u = useFilesTab(),
    r = t.useSessions((n) => n.ids),
    m = t.useSessions((n) => n.byId),
    k = t.useSessions((n) => n.current),
    h = t.useWorkspaces((n) => n.items),
    g = t.useWorkspaces((n) => n.recentWorkspaceId),
    y = t.useWorkspaces((n) => n.archivedSessionIds),
    x = React.useState(null),
    p = x[0],
    C = x[1],
    I = React.useState({}),
    R = I[0],
    T = I[1],
    H = React.useState(null),
    b = H[0],
    L = H[1],
    A = React.useState(!1),
    E = A[0],
    D = A[1],
    w = React.useState(""),
    j = w[0],
    z = w[1],
    K = React.useState(!1),
    B = K[0],
    _ = K[1],
    q = React.useState(""),
    i = q[0],
    N = q[1],
    S = React.useState(!1),
    v = S[0],
    F = S[1],
    X = React.useState(""),
    se = X[0],
    ae = X[1],
    ue = React.useState(!1),
    U = ue[0],
    Q = ue[1],
    fe = React.useState(""),
    de = fe[0],
    V = fe[1],
    he = useTwoClick(), /* 评审修复：两击确认收敛 06-misc 共享状态机（原手抄 useState；id=worktree 路径） */
    Ae = he[0],
    le = (id) => (id == null ? he[2]() : he[1](id)),
    me = React.useState(explorerOpenPref),
    pe = me[0],
    Be = me[1],
    ke = (n) => {
      ((explorerOpenPref = n), Be(n));
    };
  React.useEffect(() => {
    u === "notes" && ke(!0);
  }, [u]);
  const be = React.useState(!1),
    Pe = be[0],
    we = be[1],
    ge = React.useState(!1),
    Ne = ge[0],
    ve = ge[1],
    ye = {};
  for (const n of y || []) ye[n] = !0;
  const Y = (r || []).filter((n) => {
      const f = m[n];
      return f && !ye[n] && f.origin !== "subagent";
    }),
    Z = k ? m[k] : void 0,
    Se = React.useRef(null);
  (React.useEffect(() => {
    Z && Z.cwd && C(Z.cwd);
    const n = Se.current;
    if (((Se.current = k || null), n && n !== k && a)) {
      const f = m[n];
      f && f.blank === !0 && a.archiveSession(n).catch(() => {});
    }
  }, [k, Z && Z.cwd]),
    React.useEffect(() => {
      if (p) return;
      const n = (h || []).find((f) => f.workspaceId === g) || (h || [])[0];
      n && n.path && C(n.path);
    }, [h, g]));
  const oe = (n) => {
      const f = [],
        d = {},
        W = (O) => {
          O && !d[O] && (n || !R[O]) && ((d[O] = !0), f.push(O));
        };
      for (const O of Y) W(m[O].cwd);
      W(p);
      for (const O of h || []) W(O.path);
      return f.length === 0
        ? Promise.resolve()
        : host
            .call("workbench.projectMap", { cwds: f, force: !!n })
            .then((O) => {
              !O || !O.map || T((ze) => OA({}, ze, O.map));
            })
            .catch(() => {});
    },
    Fe = Y.map((n) => m[n].cwd || "").join("|");
  React.useEffect(() => {
    oe(!1);
  }, [Fe, p]);
  const ee = (n) => {
      if (!n) return "";
      const f = R[n];
      return (f && f.root) || n;
    },
    M = ee(p);
  (React.useEffect(() => {
    setCurrentRootPath(p); /* 评审修复：原裸赋值 currentRootPath=p 无 bus 节拍，订阅方感知不到 */
  }, [p]),
    React.useEffect(() => {
      sessionProbe.set(k || null);
    }, [k]));
  const ce = (n, f) =>
    n
      ? host
          .call("workbench.worktrees", { path: n, force: !!f })
          .then((d) => {
            d && d.forPath === n && L(d);
          })
          .catch(() => {})
      : (L(null), Promise.resolve());
  React.useEffect(() => {
    ce(p, !1);
  }, [p]);
  const Te = () => {
      if (Pe) return;
      (ve(!1), we(!0));
      const n = () => {
        (we(!1), flashDone(ve));
      };
      Promise.all([oe(!0), ce(p, !0)]).then(n, n);
    },
    $ = {};
  for (const n of Y) {
    const f = m[n],
      d = ee(f.cwd);
    if (!d) continue;
    $[d] || ($[d] = { root: d, latest: 0, running: 0, pending: 0 });
    const W = $[d];
    ((f.updatedAt || 0) > W.latest && (W.latest = f.updatedAt || 0),
      f.running && W.running++,
      f.pendingInteraction && W.pending++);
  }
  (rememberRoot(M),
    M && !$[M] && ($[M] = { root: M, latest: 0, running: 0, pending: 0 }));
  for (const n of recentRoots)
    $[n] || ($[n] = { root: n, latest: 0, running: 0, pending: 0 });
  const Le = Object.keys($)
      .map((n) => $[n])
      .sort((n, f) => f.latest - n.latest),
    te = [];
  {
    const n = {};
    for (const f of Le) {
      const d = canonPath(f.root);
      n[d] || ((n[d] = !0), te.push(f));
    }
  }
  const He = te.some(
      (n) =>
        canonPath(n.root) !== canonPath(M) && (n.running > 0 || n.pending > 0),
    ),
    oWs = te.filter((n) => canonPath(n.root) !== canonPath(M)),
    oRun = oWs.reduce((n, f) => n + f.running, 0),
    oPend = oWs.reduce((n, f) => n + f.pending, 0),
    aRun = te.reduce((n, f) => n + f.running, 0),
    aPend = te.reduce((n, f) => n + f.pending, 0),
    cRun = aRun - oRun,
    cPend = aPend - oPend,
    Re = Y.filter((n) => !m[n].blank && (!M || ee(m[n].cwd) === M)).sort(
      (n, f) => (m[f].updatedAt || 0) - (m[n].updatedAt || 0),
    ),
    J = !!(b && b.isGit && b.isTopLevel && b.forPath === p),
    G =
      (J &&
        (b.worktrees.find((n) => n.path === b.currentWorktreePath) ||
          b.worktrees.find((n) => n.isMain))) ||
      null,
    _e = (n) => {
      if (!a || !n) return;
      const f = (h || []).find((d) => d.path === n);
      if (f) {
        a.startSession(f.workspaceId);
        return;
      }
      a.create({ path: n })
        .then((d) => a.startSession(d.workspaceId))
        .catch(() => {});
    },
    Ve = () => {
      a &&
        a
          .pickDirectory()
          .then((n) => {
            if (!n) return;
            (C(n), D(!1));
            const f = (h || []).find((d) => d.path === n);
            if (f) {
              a.connectWorkspace(f.workspaceId);
              return;
            }
            return a
              .create({ path: n })
              .then((d) => a.connectWorkspace(d.workspaceId));
          })
          .catch(() => {});
    },
    xe = (n) => {
      const f = Y.filter(n).sort(
        (d, W) => (m[W].updatedAt || 0) - (m[d].updatedAt || 0),
      )[0];
      f && o && o.open(f);
    },
    $e = (n) => {
      (C(n), D(!1), z(""), xe((f) => ee(m[f].cwd) === n));
    },
    Ge = (n) => {
      (C(n), _(!1), V(""), N(""), F(!1), xe((f) => m[f].cwd === n));
    },
    Ce = () => {
      !se.trim() ||
        U ||
        !b ||
        (Q(!0),
        V(""),
        host
          .call("workbench.worktreeAdd", {
            cwd: b.projectRoot,
            branch: se.trim(),
          })
          .then((n) => {
            if ((Q(!1), !n || !n.ok)) {
              V((n && n.error) || "创建失败");
              return;
            }
            (F(!1), ae(""), C(n.path), ce(n.path, !0), oe(!0));
          })
          .catch((n) => {
            (Q(!1), V(String(n)));
          }));
    },
    De = (n, f) => {
      U ||
        !b ||
        (Q(!0),
        host
          .call("workbench.worktreeRemove", { cwd: p, path: n, force: f })
          .then((d) => {
            if ((Q(!1), !d || !d.ok)) {
              f ? V((d && d.error) || "删除失败") : le(n);
              return;
            }
            (le(null),
              b.currentWorktreePath === n && C(b.projectRoot),
              ce(b.currentWorktreePath === n ? b.projectRoot : p, !0),
              oe(!0));
          })
          .catch(() => {
            Q(!1);
          }));
    };
  if (t.wide === !1) return null;
  const Ee = te.length > 8,
    je =
      Ee && j.trim()
        ? te.filter(
            (n) => n.root.toLowerCase().indexOf(j.trim().toLowerCase()) >= 0,
          )
        : te,
    ne = J ? b.worktrees : [],
    Me = ne.length >= 8,
    Ie =
      Me && i.trim()
        ? ne.filter(
            (n) =>
              (n.branch || shortenPath(n.path))
                .toLowerCase()
                .indexOf(i.trim().toLowerCase()) >= 0,
          )
        : ne;
  let We = null;
  E &&
    (We = e(
      "div",
      { className: "pw-drop" },
      Ee ? dropFilterEl(j, "过滤项目…", z) : null,
      e(
        "div",
        { className: "pw-drop-list" },
        je.map((n) =>
          dropRowEl({
            k: n.root,
            cur: canonPath(n.root) === canonPath(M),
            title: n.root,
            onClick: () => $e(n.root),
            label: shortenPath(n.root),
            /* 活动徽标经 extra 注入（数组子节点补 key，原为静态子参数无需 key） */
            extra: [
              n.running > 0
                ? e("span", { key: "r", className: "pw-act run" }, "● " + n.running)
                : null,
              n.pending > 0
                ? e("span", { key: "w", className: "pw-act warn" }, "● " + n.pending)
                : null,
            ],
          }),
        ),
        je.length === 0
          ? e("div", { className: "pw-hint" }, "没有匹配的项目")
          : null,
      ),
      e(
        "button",
        { className: "pw-drop-foot", onClick: Ve },
        e("span", { className: "pw-check" }, "＋"),
        "自定义路径",
      ),
    ));
  let Oe = null;
  if (J && B) {
    const n = Ie.map((d) => {
        const W = d.path === b.currentWorktreePath;
        return Ae === d.path
          ? e(
              "div",
              { key: d.path, className: "pw-confirm-row" },
              e("span", { className: "pw-confirm-text" }, "强制删除该检出？"),
              e(
                "button",
                {
                  className: "pw-btn-danger",
                  disabled: U,
                  onClick: () => De(d.path, !0),
                },
                "强制",
              ),
              e(
                "button",
                { className: "pw-btn-plain", onClick: () => le(null) },
                "取消",
              ),
            )
          : e(
              "div",
              { key: d.path, className: "pw-wt-row" },
              dropRowEl({
                k: d.path,
                cur: W,
                title: d.path,
                onClick: () => Ge(d.path),
                label: d.branch || shortenPath(d.path),
                extra: d.isMain
                  ? e("span", { className: "pw-main-badge" }, "主分支")
                  : null,
              }),
              d.isMain
                ? null
                : e(
                    "button",
                    {
                      className: "pw-wt-del",
                      title: "删除 worktree：" + d.path,
                      disabled: U,
                      onClick: () => De(d.path, !1),
                    },
                    TrashIcon(12),
                  ),
            );
      }),
      f = v
        ? e(
            "div",
            { className: "pw-wt-new" },
            e("input", {
              className: "pw-input",
              value: se,
              placeholder: "分支名",
              onChange: (d) => {
                (ae(d.target.value), V(""));
              },
              onKeyDown: (d) => {
                (d.key === "Enter" && (d.preventDefault(), Ce()),
                  d.key === "Escape" && (F(!1), ae(""), V("")));
              },
            }),
            e(
              "div",
              { className: "pw-wt-new-actions" },
              e(
                "button",
                {
                  className: "pw-btn-primary",
                  disabled: U || !se.trim(),
                  onClick: Ce,
                },
                U ? "创建中…" : "创建",
              ),
              e(
                "button",
                {
                  className: "pw-btn-plain",
                  onClick: () => {
                    (F(!1), ae(""), V(""));
                  },
                },
                "取消",
              ),
            ),
          )
        : e(
            "button",
            {
              className: "pw-drop-foot",
              title: "从分支创建新的 worktree 检出",
              onClick: () => {
                (F(!0), V(""));
              },
            },
            e("span", { className: "pw-check" }, "＋"),
            "新建 worktree",
          );
    Oe = e(
      "div",
      { className: "pw-drop" },
      Me ? dropFilterEl(i, "过滤 worktree…", N) : null,
      e(
        "div",
        { className: "pw-drop-list sm" },
        n,
        Ie.length === 0
          ? e("div", { className: "pw-hint" }, "没有匹配的 worktree")
          : null,
      ),
      de ? e("div", { className: "pw-wt-err" }, de) : null,
      f,
    );
  }
  let ie = null;
  !J && b && b.forPath === p && b.isGit && !b.isTopLevel
    ? (ie = e(
        "div",
        {
          className: "pw-wt-guide",
          title: "打开仓库根目录以管理 worktree。",
          onClick: () => C(b.projectRoot),
        },
        e("span", { className: "pw-wt-guide-icon" }, GitBranchIcon(11)),
        "打开仓库根目录",
      ))
    : !J &&
      b &&
      b.forPath === p &&
      !b.isGit &&
      (ie = e(
        "div",
        {
          className: "pw-wt-guide dim",
          title: "只能在 Git 仓库根目录使用 worktree。",
        },
        e("span", { className: "pw-wt-guide-icon" }, GitBranchIcon(11)),
        "仅 Git 仓库根目录",
      ));
  let re = null;
  return (
    (re = e(
      React.Fragment,
      null,
      e(
        "div",
        { className: "pw-sessions" + (pe ? "" : " solo") },
        Re.length === 0
          ? e("div", { className: "pw-hint" }, "未找到会话")
          : Re.map((n) => {
              const f = m[n];
              return e(SessionRow, {
                key: n,
                id: n,
                sm: f,
                active: n === k,
                sessionsSvc: o,
                workspacesSvc: a,
                branch:
                  (ee(f.cwd) !== f.cwd && R[f.cwd] && R[f.cwd].branch) || null,
              });
            }),
      ),
      e(FileBrowser, {
        root: p,
        notesDir: c.current,
        notesDirs: c.dirs,
        tab: u,
        onTab: (n) => filesTabStore.set(n),
        onPickNotes: pickNotesDir,
        layout: s,
        workspaces: a,
        open: pe,
        onToggle: ke,
        sessionId: k,
        onMention:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  mentionPath(n.path, n.type === "directory"),
                )
            : void 0,
        onMentionAbs:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  "@" + n.path + (n.type === "directory" ? "/ " : " "),
                )
            : void 0,
      }),
    )),
    e(
      "div",
      { className: "pw-sidebar" },
      e(
        "div",
        { className: "pw-head" },
        e("span", { className: "pw-logo" }, "DSH"),
        e(
          "button",
          {
            className: "pw-new-btn",
            disabled: !p,
            title: p ? "在 " + shortenPath(p) + " 新建会话" : "先选择项目",
            onClick: () => _e(p),
          },
          "＋ 新建",
        ),
        e(
          "button",
          {
            className:
              "pw-icon-btn" + (Pe ? " spin" : "") + (Ne ? " flash" : ""),
            title: "刷新",
            onClick: Te,
          },
          RefreshIcon(14),
          Ne ? flashEl(14) : null,
        ),
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: "折叠侧栏",
            onClick: () => s && s.toggleSidebar(),
          },
          "«",
        ),
      ),
      e(
        "div",
        { className: "pw-sel" },
        e(
          "button",
          {
            className: "pw-sel-btn",
            title: M || "",
            onClick: () => {
              (D(!E), _(!1));
            },
          },
          e(
            "span",
            { className: "pw-mono" + (M ? " pw-tail" : " dim") },
            /* LRM 前缀：RTL 截断下保住 ~/ 等前导中性字符的显示顺序 */
            M ? "\u200e" + shortenPath(M) : "选择项目…",
          ),
          aRun + aPend > 0
            ? e(
                "span",
                {
                  className: "pw-act-badge",
                  title:
                    "进行中 " +
                    aRun +
                    " · 待交互 " +
                    aPend +
                    "（其中当前工作区：进行中 " +
                    cRun +
                    " · 待交互 " +
                    cPend +
                    "）",
                },
                aRun > 0
                  ? e("span", { className: "pw-act run" }, "● " + aRun)
                  : null,
                aPend > 0
                  ? e("span", { className: "pw-act warn" }, "● " + aPend)
                  : null,
              )
            : null,
        ),
        E ? dropOverlayEl(() => D(!1)) : null,
        We,
      ),
      J
        ? e(
            "div",
            { className: "pw-sel sm" },
            e(
              "button",
              {
                className: "pw-sel-btn sm",
                title: G ? "切换 worktree：" + G.path : "切换 worktree",
                onClick: () => {
                  (_(!B), D(!1));
                },
              },
              e(
                "span",
                { className: "pw-wt-icon" + (G && !G.isMain ? " on" : "") },
                GitBranchIcon(11),
              ),
              e(
                "span",
                { className: "pw-mono" },
                G ? G.branch || shortenPath(G.path) : "…",
              ),
              G && G.isMain
                ? e("span", { className: "pw-main-badge" }, "主分支")
                : null,
              ne.length > 1
                ? e("span", { className: "pw-main-badge" }, String(ne.length))
                : null,
              e("span", { className: "pw-chev" }, "▾"),
            ),
            B ? dropOverlayEl(() => _(!1)) : null,
            Oe,
          )
        : null,
      ie,
      re,
    )
  );
}
/* ==================== details 面板驱动管理器 ====================
 * details 槽的仲裁层：文件预览是默认驱动，其余面板（助手、第三方）经
 * dshDetailsPanels 服务注册为驱动，open/close 排他（替换式弹出：激活即
 * 整体替换右栏内容，关闭即回预览）。驱动不再裸抢 details 槽的 priority；
 * 外来裸注册插件仍按槽语义（最小者渲染）轮值。 */
const panelStore = {
  panels: [],
  activeId: null,
  register(def) {
    if (!def || !def.id || typeof def.render !== "function") return () => {};
    panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id).concat([def]);
    bus.fire();
    return () => {
      panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id);
      if (panelStore.activeId === def.id) panelStore.activeId = null;
      bus.fire();
    };
  },
  open(id) {
    if (!panelStore.panels.some((p) => p.id === id)) return false;
    panelStore.activeId = id;
    bus.fire();
    return true;
  },
  close(id) {
    if (!panelStore.activeId) return false;
    if (id !== undefined && panelStore.activeId !== id) return false;
    panelStore.activeId = null;
    bus.fire();
    return true;
  },
  isOpen(id) {
    return panelStore.activeId === id;
  },
};
function usePanels() {
  const t = React.useState(0);
  React.useEffect(() => bus.sub(() => t[1]((x) => x + 1)), []);
  return { panels: panelStore.panels, activeId: panelStore.activeId };
}
/* 单个驱动渲染失败不拖垮整个 details 列 */
class PanelErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error("[dsh-geek-sidebar] 面板渲染失败", err);
  }
  render() {
    return this.state.err
      ? React.createElement("div", { className: "pw-hint", style: { padding: "20px" } }, "面板渲染失败：" + String((this.state.err && this.state.err.message) || this.state.err))
      : this.props.children;
  }
}
/* PanelHost：替换式弹出（无 tab）。有激活驱动 → 整体替换右栏内容；
 * 驱动 close()（面板自带关闭或入口再点）→ 回到默认预览。 */
function PanelHost(t) {
  const e = React.createElement;
  const { panels, activeId } = usePanels();
  const active = panels.find((p) => p.id === activeId) || null;
  return active ? e(PanelErrorBoundary, { key: active.id }, active.render(t)) : e(Details, t);
}

/* 图片点击放大：全屏遮罩 + 大图，点任意处 / Esc 关闭 */
function ImgZoomView() {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const src = imgZoomStore.src;
  React.useEffect(() => {
    if (!src) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape") imgZoomStore.set(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src]);
  if (!src) return null;
  return e(
    "div",
    { className: "pw-zoom-mask", onClick: () => imgZoomStore.set(null) },
    e("img", { className: "pw-zoom-img", src, alt: "" }),
  );
}

/* 异步回调落地前的活守卫（评审修复）：响应回来时用户可能已切文件/切会话，
 * 比对发起时的 sid+path，不一致就丢弃——否则旧文件的响应写进新文件的视图态 */
function detailsAlive(sid, path) {
  return sessionProbe.sid === sid && store.bucket(sid).active === path;
}

function Details(t) {
  const e = React.createElement,
    s = t.layout,
    a = React.useState(0)[1];
  React.useEffect(() => sessionProbe.sub(() => a((i) => i + 1)), []);
  const sidRef = React.useRef(sessionProbe.sid);
  React.useEffect(() => {
    sidRef.current !== sessionProbe.sid &&
      ((sidRef.current = sessionProbe.sid), a((i) => i + 1));
  });
  const l = usePreviewState(sessionProbe.sid),
    c = l.activeFile,
    u = React.useState(null),
    r = u[0],
    m = u[1],
    k = React.useState("auto"),
    h = k[0],
    g = k[1],
    y = React.useState(""),
    x = y[0],
    p = y[1],
    C = React.useState(!1),
    I = C[0],
    R = C[1],
    T = React.useState(!1),
    H = T[0],
    b = T[1],
    L = React.useState(!1),
    A = L[0],
    E = L[1],
    D = React.useRef([]),
    ed2 = React.useState(!1),
    ed = ed2[0],
    setEd = ed2[1],
    dr2 = React.useState(""),
    draft = dr2[0],
    setDraft = dr2[1],
    sv2 = React.useState(!1),
    saving = sv2[0],
    setSaving = sv2[1],
    edRef = React.useRef(!1);
  /* ed 经 ref 同步给焦点刷新回调：该 effect deps 仅 path，进编辑不会重注册，
   * 旧版回调闭包捕获注册时的 ed（恒 false），编辑中焦点回归仍会触发刷新（评审 P3 #2） */
  React.useEffect(() => {
    edRef.current = ed;
  });
  React.useEffect(() => {
    if ((m(null), p(""), R(!1), b(!1), E(!1), setEd(!1), (D.current = []), !c))
      return;
    let i = !1;
    return (
      host
        .call("workbench.readFile", { path: c.path })
        .then((N) => {
          i || m(N || { error: "empty response" });
        })
        .catch((N) => {
          i || m({ error: String(N) });
        }),
      () => {
        i = !0;
      }
    );
  }, [c && c.path]);
  React.useEffect(() => {
    if (!c) return;
    const rf = () => {
      if (edRef.current || document.visibilityState !== "visible") return;
      const sid0 = sessionProbe.sid, path0 = c.path;
      host
        .call("workbench.readFile", { path: c.path })
        .then((i2) => {
          if (!detailsAlive(sid0, path0)) return;
          i2 &&
            m((S) =>
              S && S.kind === "text" && i2.kind === "text" && S.text === i2.text
                ? S
                : i2,
            );
        })
        .catch(() => {});
    };
    (window.addEventListener("focus", rf),
      document.addEventListener("visibilitychange", rf));
    return () => {
      (window.removeEventListener("focus", rf),
        document.removeEventListener("visibilitychange", rf));
    };
  }, [c && c.path]);
  const w = () => {
      !c ||
        I ||
        (p(""),
        b(!1),
        R(!0),
        (() => {
          const sid0 = sessionProbe.sid, path0 = c.path;
          host
            .call("workbench.download", { path: c.path })
            .then((i) => {
              (R(!1), detailsAlive(sid0, path0) && (i && i.ok ? b(!0) : p("✗ " + ((i && i.error) || "失败"))));
            })
            .catch((i) => {
              (R(!1), detailsAlive(sid0, path0) && p("✗ " + String(i)));
            });
        })());
    },
    j = h === "auto" ? (c && isMd(c.name) ? "preview" : "source") : h,
    z = c ? c.path.split("/").filter(Boolean) : [],
    K = z.length > 3 ? ["…"].concat(z.slice(-3)) : z,
    B = [];
  if (r && r.kind === "text" && j === "preview") {
    const i = String(r.text || "").split(`
`);
    let N = !1;
    for (const S of i) {
      const v = S.trim();
      if (v.startsWith("```")) {
        N = !N;
        continue;
      }
      if (N) continue;
      const F = v.match(/^(#{1,6})\s+(.*)$/);
      F && B.push({ level: F[1].length, text: F[2], index: B.length });
    }
  }
  const _ = (i) => {
      const N = D.current[i];
      (N &&
        typeof N.scrollIntoView == "function" &&
        N.scrollIntoView({ behavior: "smooth", block: "start" }),
        E(!1));
    },
    q = () => (
      (D.current = []),
      c
        ? r
          ? r.error
            ? e(
                "div",
                { className: "pw-hint", style: { padding: "20px" } },
                "无法预览：" + r.error,
              )
            : r.kind === "image"
              ? e(
                  "div",
                  { className: "pw-img-wrap" },
                  e("img", {
                    src: r.url,
                    alt: c.name,
                    onClick: (g) => {
                      (g.stopPropagation(), imgZoomStore.set(r.url));
                    },
                  }),
                )
              : r.kind === "pdf"
                ? e("iframe", {
                    className: "pw-frame",
                    src: r.url,
                    title: c.name,
                  })
                : r.kind === "html"
                  ? e("iframe", {
                      className: "pw-frame",
                      srcDoc: r.html || "",
                      sandbox: "",
                      title: c.name,
                    })
                  : r.kind === "text" && isHtmlExt(c.name)
                    ? e("iframe", {
                        className: "pw-frame",
                        srcDoc: r.text || "",
                        sandbox: "",
                        title: c.name,
                      })
                    : j === "preview"
                      ? e(
                          "div",
                          { className: "pw-md" },
                          renderMarkdown(
                            r.text || "",
                            D.current,
                            c && c.path ? c.path.replace(/\/[^/]*$/, "") : "",
                          ),
                        )
                      : isCsvExt(c.name)
                        ? e(CsvView, { text: r.text || "" })
                        : isCodeExt(c.name)
                          ? e(
                              "div",
                              { className: "pw-codeview" },
                              highlightCode(
                                r.text || "",
                                c.name.split(".").pop().toLowerCase(),
                              ),
                            )
                          : e("pre", { className: "pw-src" }, r.text || "")
          : e(
              "div",
              { className: "pw-hint", style: { padding: "20px" } },
              "加载中…",
            )
        : e(
            "div",
            { className: "pw-empty" },
            e("div", { className: "pw-empty-logo" }, FileTextIcon(40)),
            e("div", null, "在左侧「项目」或「笔记」中点击文件进行预览"),
            e(
              "div",
              { className: "pw-hint" },
              "支持多标签 · Markdown / 图片 / 文本",
            ),
          )
    );
  return e(
    "div",
    { className: "pw-details" },
    e(
      "div",
      { className: "pw-tabs" },
      l.files.length === 0
        ? e("div", { className: "pw-tab dim" }, "文档预览")
        : l.files.map((i) =>
            e(
              "div",
              {
                key: i.path,
                className: "pw-tab" + (i.path === l.active ? " on" : ""),
                title: i.path,
                onClick: () => store.setActive(sessionProbe.sid, i.path),
              },
              e("span", { className: "pw-tab-icon" }, fileIconEl(i.name, 13)),
              e("span", { className: "pw-tab-name" }, i.name),
              e(
                "button",
                {
                  className: "pw-tab-x",
                  title: "关闭",
                  onClick: (N) => {
                    (N.stopPropagation(),
                      store.close(sessionProbe.sid, i.path));
                  },
                },
                "×",
              ),
            ),
          ),
      e("span", { className: "pw-tabs-flex" }),
      e(
        "button",
        {
          className: "pw-col-btn",
          title: "收起右栏",
          onClick: () => s && s.closeDetails(),
        },
        "»",
      ),
    ),
    c
      ? e(
          "div",
          { className: "pw-toolbar" },
          e("span", { className: "pw-crumbs" }, K.join(" / ")),
          e(
            "span",
            { className: "pw-toolbar-right" },
            B.length > 0
              ? e(
                  "button",
                  {
                    className: "pw-tg-sq" + (A ? " on" : ""),
                    title: "大纲",
                    onClick: () => E(!A),
                  },
                  ListIcon(13),
                )
              : null,
            e(
              "button",
              {
                className: "pw-tg" + (j === "source" ? " on" : ""),
                onClick: () => g("source"),
              },
              "Source",
            ),
            e(
              "button",
              {
                className: "pw-tg" + (j === "preview" ? " on" : ""),
                onClick: () => g("preview"),
              },
              "Preview",
            ),
            t.mentionBridge
              ? e(
                  "button",
                  {
                    className: "pw-icon-btn",
                    title: "@ 提及到输入框",
                    onClick: () => {
                      c &&
                        sessionProbe.sid &&
                        t.mentionBridge.mention(
                          sessionProbe.sid,
                          mentionPath(c.path),
                        );
                    },
                  },
                  AtIcon(13),
                )
              : null,
            e(
              "button",
              {
                className: "pw-icon-btn",
                title: "重新加载文件内容",
                onClick: () => {
                  if (!c) return;
                  const sid0 = sessionProbe.sid, path0 = c.path;
                  host
                    .call("workbench.readFile", { path: c.path })
                    .then((i2) => {
                      detailsAlive(sid0, path0) && i2 && m(i2);
                    })
                    .catch((i2) => {
                      detailsAlive(sid0, path0) && m({ error: String(i2) });
                    });
                },
              },
              RefreshIcon(13),
            ),
            r && r.kind === "text" && !ed
              ? e(
                  "button",
                  {
                    className: "pw-icon-btn",
                    title: "编辑文件内容",
                    onClick: () => {
                      (setDraft(r.text || ""), setEd(!0));
                    },
                  },
                  PencilIcon(13),
                )
              : null,
            e(
              "button",
              {
                className:
                  "pw-icon-btn" + (I ? " spin" : "") + (H ? " flash" : ""),
                title: "下载到 ~/Downloads",
                onClick: w,
              },
              DownloadIcon(13),
              H ? flashEl(13) : null,
            ),
            x ? e("span", { className: "pw-dl-msg" }, x) : null,
          ),
        )
      : null,
    A && B.length > 0
      ? e(
          "div",
          { className: "pw-outline" },
          B.map((i) =>
            e(
              "button",
              {
                key: i.index,
                className: "pw-outline-row",
                style: { paddingLeft: 10 + (i.level - 1) * 12 + "px" },
                onClick: () => _(i.index),
              },
              i.text,
            ),
          ),
        )
      : null,
    ed
      ? e(
          "div",
          { className: "pw-edit-wrap" },
          e("textarea", {
            className: "pw-edit-area",
            value: draft,
            disabled: saving,
            spellCheck: !1,
            onChange: (i2) => setDraft(i2.target.value),
          }),
          e(
            "div",
            { className: "pw-edit-bar" },
            e(
              "span",
              { className: "pw-edit-hint" },
              draft !== ((r && r.text) || "") ? "有未保存的修改" : "",
            ),
            e(
              "button",
              {
                className: "pw-btn-plain",
                disabled: saving,
                onClick: () => setEd(!1),
              },
              "取消",
            ),
            e(
              "button",
              {
                className: "pw-btn-primary",
                disabled: saving || draft === ((r && r.text) || ""),
                onClick: () => {
                  if (saving) return;
                  const sid0 = sessionProbe.sid, path0 = c.path;
                  (setSaving(!0),
                    host
                      .call("workbench.writeFile", {
                        path: c.path,
                        text: draft,
                      })
                      .then((i2) => {
                        (setSaving(!1),
                          detailsAlive(sid0, path0) &&
                            (i2 && i2.ok
                              ? (m(OA({}, r, { text: draft })), setEd(!1))
                              : p("✗ " + ((i2 && i2.error) || "保存失败"))));
                      })
                      .catch((i2) => {
                        (setSaving(!1), detailsAlive(sid0, path0) && p("✗ " + String(i2)));
                      }));
                },
              },
              saving ? "保存中…" : "确定保存",
            ),
          ),
        )
      : e(
          "div",
          {
            className: "pw-doc",
            onClick: () => {
              A && E(!1);
            },
          },
          q(),
        ),
      e(ImgZoomView, null),
  );
}
/* 评审修复：模块级 var mdBaseDir 已删——基目录改由 renderMarkdown 经 bd 显式传入
 *（原渲染期写共享态；resolveLocalPath/mediaUrl 第二参即 bd，缺省 "" 与原空值同义） */
function isExternalHref(s) {
  return /^(https?:|mailto:|#|data:)/i.test(String(s || ""));
}
function resolveLocalPath(s, bd) {
  s = String(s || "").trim();
  if (!s || isExternalHref(s)) return null;
  s = s.replace(/^\.\//, "");
  if (s.slice(0, 2) === "~/") return s;
  if (s.charAt(0) !== "/") {
    if (!bd) return null;
    s = bd + "/" + s;
  }
  return s;
}
function mediaUrl(s, bd) {
  const p = resolveLocalPath(s, bd);
  return p ? API + "/wb/raw?path=" + encodeURIComponent(p) : s;
}
function openLocalPath(p) {
  try {
    store.open(sessionProbe.sid, { path: p, name: p.split("/").pop() || p });
  } catch (e) {}
}

function PreviewDrawer(t) {
  const e = React.createElement;
  const narrow0 = () => window.matchMedia("(max-width:1219px)").matches;
  const [narrow, setNarrow] = React.useState(narrow0);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width:1219px)");
    const f = () => setNarrow(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const st = usePreviewState(sessionProbe.sid);
  const [hiddenFor, setHiddenFor] = React.useState(null);
  /* 评审修复：遮罩 dismiss 只压"这一次打开"——文件关掉（activeFile 空）即复位 hiddenFor，
   * 重开同一文件抽屉能再出场（原版永不重置，同路径关闭再开也被永久压制，无挽回路径） */
  React.useEffect(() => {
    !st.activeFile && hiddenFor && setHiddenFor(null);
  }, [st.activeFile, hiddenFor]);
  /* 宽屏下官方 details 栏是否可用：镜像 ui-layout AppFrame 的 detailsSession 门
   * ——有当前会话且 blank===false 才给列宽，否则钳 0（新建空白会话/无会话时
   * openDetails 只恢复宽度偏好，拗不过该钳制，预览被压进 0 宽列不可见）。
   * 平台私有面脆弱点登记：规则跟随 packages/client/ui-layout/src/client/
   * AppFrame.tsx 的 detailsSession，平台升级先核它。useSessions 缺失（框架
   * 全局份额未给到 shell.overlay）时退化为旧行为：仅窄屏出场。
   * 门不可用 → 本 drawer 顶替出场；可用 → 让位回右栏，两者互斥无双重预览。 */
  const detailsAvailable = t.useSessions
    ? t.useSessions((s) => {
        const cur = s.current;
        return cur !== undefined && s.byId[cur] !== undefined && s.byId[cur].blank === false;
      })
    : true;
  if (!narrow && detailsAvailable) return null;
  if (!st.activeFile) return null;
  if (hiddenFor === st.activeFile.path) return null;
  return e(
    React.Fragment,
    null,
    e("div", {
      className: "pw-drawer-mask",
      onClick: () => setHiddenFor(st.activeFile.path),
    }),
    e(
      "div",
      { className: "pw-drawer-wrap" },
      e(Details, {
        /* 评审修复：删掉 sessionId 死 prop——Details 只读 sessionProbe.sid，从不消费该 prop。
         *（16-apply 的 PanelHost 仍保留 sessionId：那是 dshDetailsPanels 三方驱动的服务面，非 Details 私有） */
        layout: t.layout,
        workspacesSvc: t.workspacesSvc,
        mentionBridge: t.mentionBridge,
      }),
    ),
  );
}

function LayersIcon(t) {
  return ic(
    [
      ["p", "M12 2L2 7l10 5 10-5-10-5z"],
      ["p", "M2 17l10 5 10-5"],
      ["p", "M2 12l10 5 10-5"],
    ],
    t,
  );
}

function BotIcon(t) {
  return ic(
    [
      ["p", "M12 8V4H8"],
      [
        "p",
        "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
      ],
      ["p", "M2 14h2"],
      ["p", "M20 14h2"],
      ["p", "M9 13v2"],
      ["p", "M15 13v2"],
    ],
    t,
  );
}

/* ==================== ACP 智能体 tabs（Kimi Code）：连接存储层 + 视图 ====================
 * 架构：WS 连接与全部会话状态放在纯 JS 的 AcpClient（不挂 React 生命周期）——
 * 面板关闭/切 tab 组件卸载，连接和 agent 进程照样活着，tab 状态点与侧栏"助手"
 * 徽标因此是实时值。只有 tab 上的 × 会断 WS（host 30s 宽限后回收进程）。
 * 状态机：connecting → idle ⇄ running ⇄ waiting（权限卡）→ idle；dead（退出/失败）可重连。
 * bus.fire 做 50ms 节流：流式 chunk 高频到达，避免每个 token 都全量重渲染。 */

/* content → 纯文本（模块级：acpApplyUpdate 与 AcpClient.applyUpdate 的压缩吸收共用）。
 * 工具调用的 content 是双层包装 {type:'content', content:{type:'text',text}}（实测），须先剥内层 */
const acpTextOf = (c) => {
  if (!c) return "";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(acpTextOf).join("");
  const inner = c.content && typeof c.content === "object" ? acpTextOf(c.content) : "";
  return inner || String(c.text || "");
};

/* update 事件 → 流式列表项（append/merge 规则集中在这一处；副作用类 update 走 applyUpdate） */
function acpApplyUpdate(items, update) {
  const kind = update && update.sessionUpdate;
  const content = update && update.content;
  const textOf = acpTextOf;
  /* 工具关键参数提取（实测形状）：locations[0].path 最可靠（completed 时才有）；
   * 其次 in_progress 阶段 content 文本是 input JSON 的完整前缀快照（覆盖语义，非 delta）；
   * 再其次 diff 类条目把 path 放在条目级。 */
  const argOf = (u) => {
    const loc = u && u.locations && u.locations[0] && u.locations[0].path;
    if (loc) return String(loc);
    const cl = u && u.content;
    if (Array.isArray(cl)) {
      for (const it of cl) if (it && typeof it.path === "string" && it.path) return it.path;
    }
    const t = textOf(cl);
    if (!t) return "";
    try {
      const j = JSON.parse(t);
      return String(j.path || j.command || j.file_path || j.filePath || j.query || j.pattern || j.url || j.cmd || "");
    } catch (e) {
      return "";
    }
  };
  const next = items.slice();
  const appendText = (k, t) => {
    if (next.length && next[next.length - 1].kind === k) {
      next[next.length - 1] = Object.assign({}, next[next.length - 1], { text: next[next.length - 1].text + t });
    } else {
      next.push({ key: next.length, kind: k, text: t });
    }
  };
  if (kind === "user_message_chunk") appendText("user", textOf(content));
  else if (kind === "agent_message_chunk") appendText("agent", textOf(content));
  else if (kind === "agent_thought_chunk") appendText("thought", textOf(content));
  else if (kind === "tool_call") {
    next.push({
      key: next.length,
      kind: "tool",
      id: update.toolCallId,
      title: update.title || "工具调用",
      status: update.status || "pending",
      arg: argOf(update),
      output: "",
    });
  } else if (kind === "tool_call_update") {
    const i = next.findIndex((x) => x.kind === "tool" && x.id === update.toolCallId);
    if (i >= 0) {
      const cur = next[i];
      const done = update.status === "completed" || update.status === "failed";
      next[i] = Object.assign({}, cur, {
        status: update.status || cur.status,
        title: update.title || cur.title,
        arg: argOf(update) || cur.arg,
        /* 完成帧的 content/rawOutput 才是工具输出；进行中的 content 只是 input 快照，不入 output */
        output: done ? (typeof update.rawOutput === "string" && update.rawOutput ? update.rawOutput : textOf(update.content)) || cur.output : cur.output,
      });
    }
  } else if (kind === "plan") {
    const entries = (update.entries || []).map((en) => (en.status === "completed" ? "☑ " : en.status === "in_progress" ? "▶ " : "☐ ") + (en.content || ""));
    next.push({ key: next.length, kind: "plan", text: entries.join("\n") });
  }
  return next;
}

/* 压缩通知剥离（kimi 0.37 实测三种形态）：
 * - 回放/auto-compaction：通知 chunk 并入上一条回复的 agent 条目尾部，无法按条目剔除；
 * - 完整形态 "Context compaction started … Tokens after: N"，或裸 "Compaction completed/cancelled."（轮后片段）；
 * - 故渲染层取两类起点中较早者截到通知尾（有 Tokens after 则保其后的文本），前缀真实回复保留。
 *   实时手动压缩走 compacting 缓冲，不进流、无需此兜底 */
const stripCompactNotice = (t) => {
  const s = String(t || "");
  let i = s.indexOf("Context compaction started");
  const j = s.search(/Compaction (?:completed|cancelled)\./);
  if (j >= 0 && (i < 0 || j < i)) i = j;
  if (i < 0) return t;
  const rest = s.slice(i);
  const m = /Tokens after:\s*[\d,]+/.exec(rest);
  return s.slice(0, i) + (m ? rest.slice(m.index + m[0].length) : "");
};

const ACP_STATUS = {
  connecting: { label: "连接中" },
  idle: { label: "空闲" },
  running: { label: "运行中" },
  waiting: { label: "待交互" },
  dead: { label: "已退出" },
};

/* 工具调用状态中文化（kimi 原值 pending/in_progress/completed/failed） */
const TOOL_STATUS = { pending: "等待", in_progress: "运行中", completed: "完成", failed: "失败" };
/* 工具参数显示缩短：路径留末两段，非路径（如命令行）原样交给 CSS 省略 */
const shortArg = (p) => {
  const s = String(p || "");
  if (s.indexOf("/") < 0) return s;
  const seg = s.split("/").filter(Boolean);
  return seg.length > 2 ? "…/" + seg.slice(-2).join("/") : s;
};

class AcpClient {
  constructor(tabId, cwd) {
    this.tabId = tabId;
    this.cwd = cwd;
    this.status = "connecting";
    this.items = [];
    this.sessionId = null;
    this.compacting = false; /* 压缩轮：通知文本属元信息，缓冲到 compactText 不入流 */
    this.compactText = null;
    this._compactTimer = 0; /* 压缩态兜底定时器（120s 自复位） */
    this.modes = null; /* session/new 的 modes（default/plan/auto/yolo） */
    this.configOptions = null; /* configOptions（model/thinking/mode 选择器数据源） */
    this.capabilities = null; /* agentCapabilities（image 等） */
    this.usage = null; /* usage_update：{used,size} */
    this.commands = []; /* available_commands_update：斜杠命令 */
    this.title = ""; /* session_info_update */
    this.perm = null;
    this.fatal = null;
    this.sessions = null; /* session/list 结果（不过滤，渲染时按 cwd 过滤） */
    this.historyBusy = false;
    this.queue = []; /* 后续消息队列 {text,images}：运行中入队，回 idle 自动补发 */
    this.steer = null; /* 待引导消息：cancel 当前轮后回发 */
    this.intentionalClose = false;
    this._fireT = 0;
    this.connect();
  }
  /* 50ms 节流 fire：流式更新合并成约 20fps 的重渲染。
   * hot=true 走 "acp" 频道（评审修复：chunk 不再扇出到侧栏/详情）；同一节流窗口内
   * 出现非热事件即升级为全局 fire——FootBar 徽标等全局订阅者不会错过状态跳变 */
  fire(hot) {
    if (!hot) this._fireGlobal = true;
    if (this._fireT) return;
    this._fireT = setTimeout(() => {
      this._fireT = 0;
      const g = this._fireGlobal;
      this._fireGlobal = false;
      g ? bus.fire() : bus.fire("acp");
    }, 50);
  }
  connect() {
    this.intentionalClose = false;
    this.status = "connecting";
    this.fatal = null;
    const u = new URL("/__dsh-geek-sidebar__/wb/acp-ws", location.origin);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.search = new URLSearchParams({ agent: "kimi", session: this.tabId, cwd: this.cwd }).toString();
    /* 评审修复：socket 代际号——重连/手动 reconnect 后，旧 socket 晚到的 onmessage/onclose
     * 不得写新连接的状态（旧版无守卫：旧 close 会把新态误置 dead 并多排一次退避，双连接
     * 并存时 replay/update 还会交错进同一份 items） */
    const gen = (this._gen = (this._gen || 0) + 1);
    const ws = new WebSocket(u.toString());
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (gen !== this._gen) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "hello") {
        const sameSession = !!(this.sessionId && msg.sessionId === this.sessionId);
        this.sessionId = msg.sessionId;
        this.modes = msg.modes || null;
        this.configOptions = msg.configOptions || null;
        this.capabilities = msg.capabilities || null;
        if (this.status === "connecting") this.status = "idle";
        /* 重连成功：复位退避计数 */
        this._rcAttempt = 0;
        this.reconnecting = 0;
        if (this._rcTimer) {
          clearTimeout(this._rcTimer);
          this._rcTimer = 0;
        }
        /* 刷新恢复/断线回捞（resumeRecent）：拉会话列表，sessions 帧里回捞该目录最近一条有标题会话。
         * 同进程重挂（sessionId 未变）除外——replay 会补齐，不许 load 走当前会话 */
        if (this.resumeRecent) {
          this.resumeRecent = false;
          if (!sameSession) {
            this.resumePick = true;
            this.ws.send(JSON.stringify({ type: "list_sessions" }));
          }
        }
        this._flushQueue(); /* dead 期排队的消息：连回即补发 */
      } else if (msg.type === "replay") {
        for (const u2 of msg.events || []) this.applyUpdate(u2);
      } else if (msg.type === "update") {
        this.applyUpdate(msg.update);
      } else if (msg.type === "turn_end") {
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        /* 注意：不在此清压缩态——实测 kimi 的 /compact 轮次 ~50ms 即 turn_end（仅应答），
         * 压缩本体在后台跑，完成/取消文本轮后才到（大上下文可达 ~10s）。收场由
         * applyUpdate 见到 completed/cancelled 文本触发，120s 定时兜底 */
        this._flushQueue();
      } else if (msg.type === "permission") {
        this.perm = { requestId: msg.requestId, title: msg.title, options: msg.options || [] };
        this.status = "waiting";
      } else if (msg.type === "sessions") {
        /* 空白对话（title 空 = 从未提问）直接删除、不进历史。两道边界（均实测）：
         * 1) kimi 的 session/delete 只能删本进程 cwd 的会话，跨 cwd 必回 Internal error → 只扫同 cwd，
         *    异 cwd 空白保留在列表数据里（渲染层本来也按 cwd 过滤），等那个目录的 tab 开历史时自清理；
         * 2) 豁免所有存活 tab 的当前会话——它可能正空白等输入，删了下条 prompt 会失效。
         * 清扫删除带 silent：家务操作，失败（理论上不该再有）也不许污染对话流。 */
        const liveIds = Object.keys(acpTabs.clients)
          .map((k) => acpTabs.clients[k] && acpTabs.clients[k].sessionId)
          .filter(Boolean);
        const keep = [];
        for (const s of msg.sessions || []) {
          const blank = s && s.sessionId && !(s.title && String(s.title).trim());
          if (blank && s.cwd === this.cwd && liveIds.indexOf(s.sessionId) < 0) {
            this.ws.send(JSON.stringify({ type: "delete_session", sessionId: s.sessionId, silent: true }));
          } else keep.push(s);
        }
        this.sessions = keep;
        this.historyBusy = false;
        /* 刷新恢复的回捞：最近一条有标题、非当前、未被其他恢复 tab 认领的同 cwd 会话 */
        if (this.resumePick) {
          this.resumePick = false;
          const cand = keep
            .filter((s) => s && s.sessionId && s.cwd === this.cwd && s.title && String(s.title).trim() && s.sessionId !== this.sessionId && acpResumedIds.indexOf(s.sessionId) < 0)
            .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
          if (cand) {
            acpResumedIds.push(cand.sessionId);
            this.loadSession(cand.sessionId, true); /* keepQueue：断线期排队的消息在 loaded 后补发 */
          }
        }
      } else if (msg.type === "loaded") {
        /* 换会话：清空流，kimi 随后以 update 帧回放历史 */
        this.items = [];
        this.sessionId = msg.sessionId;
        this.perm = null;
        this.usage = null;
        this._clearCompacting();
        if (this.status !== "dead") this.status = "idle";
        this._flushQueue(); /* 回捞完成后补发断线期排队消息（用户主动换会话时队列已清空，空转） */
      } else if (msg.type === "config") {
        if (msg.sessionId) this.sessionId = msg.sessionId;
        if (msg.modes) this.modes = msg.modes;
        if (msg.configOptions) this.configOptions = msg.configOptions;
      } else if (msg.type === "session_deleted") {
        if (this.sessions) this.sessions = this.sessions.filter((s) => s && s.sessionId !== msg.sessionId);
      } else if (msg.type === "note") {
        this.items = this.items.concat({ key: this.items.length, kind: "note", text: msg.message });
      } else if (msg.type === "error") {
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: msg.message });
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        this._clearCompacting();
        this._flushQueue();
      } else if (msg.type === "exit") {
        this.status = "dead";
        this._clearCompacting();
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: "进程已退出（code " + msg.code + "）" });
      }
      /* 纯流式增量标 hot 走 "acp" 频道（评审修复）：chunk/usage 是 20fps 源，
       * 侧栏/详情无需随之重渲染；其余（hello/turn_end/permission/sessions/exit…）
       * 保持全局 fire——FootBar 徽标与 tab 列表靠状态跳变 */
      const su = msg.type === "update" && msg.update && msg.update.sessionUpdate;
      this.fire(su === "agent_message_chunk" || su === "agent_thought_chunk" || su === "usage_update");
    };
    ws.onclose = (ev) => {
      if (gen !== this._gen) return;
      if (ev.code === 1011 && ev.reason) this.fatal = ev.reason;
      this._clearCompacting();
      if (!this.intentionalClose) {
        this.status = "dead";
        this._scheduleReconnect(); /* 异常断线：指数退避自动重连（dsh 重启/网络抖动无感恢复） */
      }
      this.fire();
    };
    ws.onerror = () => {};
    this.fire();
  }
  /* session/update：副作用类本地吸收，流式类交给 acpApplyUpdate */
  applyUpdate(u) {
    const kind = u && u.sessionUpdate;
    if (kind === "usage_update") this.usage = { used: u.used || 0, size: u.size || 0 };
    else if (kind === "available_commands_update") this.commands = u.availableCommands || [];
    else if (kind === "session_info_update") this.title = u.title || "";
    else if (kind === "current_mode_update" && u.currentModeId) {
      if (this.modes) this.modes = Object.assign({}, this.modes, { currentModeId: u.currentModeId });
      else this.modes = { currentModeId: u.currentModeId, availableModes: [] };
    } else if (kind === "config_option_update" && Array.isArray(u.configOptions)) {
      this.configOptions = u.configOptions;
    } else if (this.compacting && (kind === "agent_message_chunk" || kind === "agent_thought_chunk")) {
      /* 压缩通知吸收（kimi 0.37 实测：started 应答在轮内，completed/cancelled 在轮后到达，
       * 均属元信息不是对话内容，用户决策不展示）：入缓冲不入流，
       * 见到完成/取消文本立即收场——此后若有真实回复 chunk（压缩期间又发了新消息）正常入流 */
      this.compactText = (this.compactText || "") + acpTextOf(u.content);
      if (/Compaction (?:completed|cancelled)\./.test(this.compactText)) this._clearCompacting();
    } else if (kind === "user_message_chunk" && acpTextOf(u.content).trim() === "/compact") {
      /* kimi 侧 /compact 回声（实时或回放）同样吞掉——压缩命令本身也不进对话 */
    } else {
      this.items = acpApplyUpdate(this.items, u);
    }
  }
  open() {
    return this.ws && this.ws.readyState === 1;
  }
  /* 压缩态跨轮持有：/compact 轮次仅应答（实测 ~50ms 即 turn_end），压缩本体后台运行，
   * 完成/取消文本轮后才到。收场三途：见到 Compaction completed/cancelled 文本、
   * error/loaded/断线清场、120s 定时兜底（kimi 异常静默时不至于卡红钮） */
  _markCompacting() {
    this.compacting = true;
    this.compactText = "";
    if (this._compactTimer) clearTimeout(this._compactTimer);
    this._compactTimer = setTimeout(() => {
      this._compactTimer = 0;
      this._clearCompacting();
      this.fire();
    }, 120000);
  }
  _clearCompacting() {
    this.compacting = false;
    this.compactText = null;
    if (this._compactTimer) {
      clearTimeout(this._compactTimer);
      this._compactTimer = 0;
    }
  }
  sendPrompt(text, images) {
    if (!this.open() || this.status === "running" || this.status === "waiting" || this.status === "dead") return;
    const imgs = (images || []).filter((im) => im && im.data).map((im) => ({ data: im.data, mimeType: im.mimeType }));
    if (!String(text || "").trim() && !imgs.length) return;
    this.ws.send(JSON.stringify({ type: "prompt", text: text || "", images: imgs.length ? imgs : undefined }));
    /* /compact：标记压缩态（通知不回流），本地用户回声也不插——命令本身不污染对话 */
    if (String(text || "").trim() === "/compact") {
      this._markCompacting();
    } else {
      this.items = this.items.concat({
        key: this.items.length,
        kind: "user",
        text: text || "",
        images: (images || []).map((im) => ({ url: im.url })),
      });
    }
    this.status = "running";
    this.perm = null;
    this.fire();
  }
  cancel() {
    if (this.open()) this.ws.send(JSON.stringify({ type: "cancel" }));
  }
  /* 后续消息排队 / 立即引导（参考 Cursor 交互，用户决策 2026-08）。纯客户端编排，
   * 不赌 ACP 中途 prompt 行为：排队=入队后等 turn_end/error 回 idle 自动补发；
   * 引导=cancel 当前轮，轮次结束回发引导文本（等效"打断并转向"）。 */
  enqueue(text, images) {
    this.queue = this.queue.concat({ text: String(text || ""), images: images || [] });
    this.fire();
  }
  popQueue() {
    const m = this.queue[this.queue.length - 1];
    this.queue = this.queue.slice(0, -1);
    this.fire();
    return m || null;
  }
  steerNow(text, images) {
    if (this.status === "running" || this.status === "waiting") {
      this.steer = { text: String(text || ""), images: images || [] };
      this.cancel();
    } else this.sendPrompt(text, images);
  }
  _flushQueue() {
    if (this.status !== "idle" || !this.open()) return;
    let m = this.steer;
    this.steer = null;
    if (!m && this.queue.length) m = this.queue[0];
    if (!m) return;
    if (this.queue[0] === m) this.queue = this.queue.slice(1);
    this.sendPrompt(m.text, m.images);
  }
  answerPermission(requestId, optionId) {
    if (this.open()) this.ws.send(JSON.stringify({ type: "permission", requestId, optionId }));
    this.perm = null;
    if (this.status === "waiting") this.status = "running";
    this.fire();
  }
  setMode(modeId) {
    if (this.open() && modeId) this.ws.send(JSON.stringify({ type: "set_mode", modeId }));
  }
  setConfig(configId, value) {
    if (this.open() && configId) this.ws.send(JSON.stringify({ type: "set_config", configId, value }));
  }
  listSessions() {
    if (!this.open()) return;
    this.historyBusy = true;
    this.ws.send(JSON.stringify({ type: "list_sessions" }));
    this.fire();
  }
  loadSession(sessionId, keepQueue) {
    if (!this.open() || !sessionId || sessionId === this.sessionId || this.status === "running") return;
    if (!keepQueue) {
      this.queue = []; /* 用户主动换会话：队列属于旧会话上下文，即清空 */
      this.steer = null;
    }
    this.ws.send(JSON.stringify({ type: "load_session", sessionId }));
    this.status = "connecting";
    this.perm = null;
    this.fire();
  }
  /* 会话操作三件套：运行/等待中禁止（new/fork 会换 sessionId，中途换会出乱） */
  busy() {
    return this.status === "running" || this.status === "waiting" || this.status === "connecting" || this.status === "dead";
  }
  newSession() {
    if (!this.open() || this.busy()) return;
    this.queue = []; /* 同上：新会话不继承旧队列 */
    this.steer = null;
    this.ws.send(JSON.stringify({ type: "new_session" }));
  }
  forkSession() {
    if (!this.open() || this.busy()) return;
    this.ws.send(JSON.stringify({ type: "fork_session" }));
  }
  deleteSession(sessionId) {
    if (!this.open() || !sessionId || sessionId === this.sessionId) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId }));
  }
  /* 关 tab 前调用：本会话从未提问（无 user 条目——本地发送/回放/重连三路径都会留下 user
   * 条目，判据可靠）则直接删除，不留历史空白。注意 deleteSession() 拒删当前会话，这里须绕开。 */
  discardIfBlank() {
    if (!this.sessionId || !this.open()) return;
    if (this.items.some((it) => it && it.kind === "user")) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId: this.sessionId, silent: true }));
  }
  /* 自动重连（用户决策 2026-08）：1s→2s→4s→8s 封顶，最多 12 次（约 93s 窗口，覆盖 dsh 重启）。
   * 成功由 hello 复位计数；放弃后保留 dead 横幅，手动按钮仍可立即重连。 */
  _scheduleReconnect() {
    if (this._rcTimer) return;
    const attempt = (this._rcAttempt || 0) + 1;
    if (attempt > 12) {
      this.reconnecting = 0;
      return;
    }
    this._rcAttempt = attempt;
    this.reconnecting = attempt;
    this._rcTimer = setTimeout(
      () => {
        this._rcTimer = 0;
        this.reconnect();
      },
      Math.min(1000 * Math.pow(2, attempt - 1), 8000),
    );
  }
  reconnect() {
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    this._rcAttempt = 0;
    this.reconnecting = 0;
    /* 同进程重挂：hello 同 sessionId 自动取消回捞；新进程：回捞最近历史会话 */
    this.resumeRecent = true;
    this.connect();
  }
  close() {
    this.intentionalClose = true;
    this._gen = (this._gen || 0) + 1; /* 评审修复：close 后晚到帧一并作废（同代际守卫） */
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    try {
      this.ws && this.ws.close();
    } catch (e) {}
  }
}

/* tab 列表 localStorage 持久化（用户要求 2026-08：刷新不丢已选目录）。
 * 仅存 {id,cwd}；无 window 环境（无头冒烟）安全降级为空操作。 */
const ACP_LS_KEY = "pw-acp-tabs";
const acpLs = {
  read() {
    try {
      if (typeof window === "undefined") return [];
      const v = JSON.parse(window.localStorage.getItem(ACP_LS_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  },
  write(tabs) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(ACP_LS_KEY, JSON.stringify(tabs.map((t) => ({ id: t.id, cwd: t.cwd }))));
    } catch (e) {}
  },
};
/* 恢复回捞的会话认领表：多个恢复 tab 同目录时不许抢同一条历史会话 */
const acpResumedIds = [];

/* 智能体 tab 注册表：tab 元信息 + 各 tab 的 AcpClient。 */
const acpTabs = {
  seq: 0,
  tabs: [] /* {id,cwd,name} */,
  clients: {} /* id -> AcpClient */,
  add(cwd) {
    const id = "k" + Date.now().toString(36) + ++acpTabs.seq;
    acpTabs.clients[id] = new AcpClient(id, cwd);
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd, name: baseName(cwd) || cwd });
    acpLs.write(acpTabs.tabs);
    bottomPanel.set({ open: true, tab: id });
    bus.fire();
    return id;
  },
  close(id) {
    const c = acpTabs.clients[id];
    if (c) {
      try {
        c.discardIfBlank();
        c.close();
      } catch (e) {}
    }
    delete acpTabs.clients[id];
    acpTabs.tabs = acpTabs.tabs.filter((t) => t.id !== id);
    acpLs.write(acpTabs.tabs);
    if (bottomPanel.tab === id) bottomPanel.set({ tab: "terminal" });
    bus.fire();
  },
  counts() {
    let run = 0,
      wait = 0;
    for (const t of acpTabs.tabs) {
      const c = acpTabs.clients[t.id];
      if (!c) continue;
      if (c.status === "running") run++;
      else if (c.status === "waiting") wait++;
    }
    return { run, wait, total: acpTabs.tabs.length };
  },
};

/* 刷新恢复：重建上次的 tab（上限 6 个防爆量），AcpClient 重连后回捞该目录最近一条
 * 有标题会话（session/load 回放完整历史，对话不丢）。纯客户端方案，无需 host 改动；
 * 重建时新建的空白会话交给历史面板的空白清扫兜底。 */
function acpRestore() {
  if (typeof window === "undefined") return;
  const saved = acpLs.read();
  for (const t of saved.slice(0, 6)) {
    if (!t || typeof t.cwd !== "string" || !t.cwd) continue;
    const id = typeof t.id === "string" && t.id && !acpTabs.clients[t.id] ? t.id : "k" + Date.now().toString(36) + ++acpTabs.seq;
    const c = new AcpClient(id, t.cwd);
    c.resumeRecent = true;
    acpTabs.clients[id] = c;
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd: t.cwd, name: baseName(t.cwd) || t.cwd });
  }
  if (acpTabs.tabs.length) bus.fire();
}
acpRestore();

/* 单个智能体 tab 的视图：头部（状态/模式/模型/thinking/历史）+ 用量条 + 流 + 权限卡 + 输入行 */
function AgentTabView({ client }) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  /* "acp" 频道订阅（评审修复：bus 拆分后唯一需要随流式 chunk 重渲染的视图；
   * 全局 fire 按语义仍会送达本频道——store/bottomPanel 等稀有事件不丢） */
  React.useEffect(() => bus.sub(() => force((x) => x + 1), "acp"), []);
  const [draft, setDraft] = React.useState("");
  const [images, setImages] = React.useState([]); /* {url,data,mimeType}，最多 4 张 */
  const [histOpen, setHistOpen] = React.useState(false);
  /* 评审修复：两击确认收敛 06-misc 共享状态机（原手抄 useState；id=sessionId，适配器保持原签名） */
  const cf = useTwoClick();
  const delId = cf[0], setDelId = (id) => (id == null ? cf[2]() : cf[1](id));
  const [slashIdx, setSlashIdx] = React.useState(0);
  const [slashOff, setSlashOff] = React.useState(false); /* Esc 关闭补全弹窗，继续输入自动复位 */
  const [usageOpen, setUsageOpen] = React.useState(false); /* 上下文用量浮层 */
  const [copiedKey, setCopiedKey] = React.useState(null); /* 消息操作条「已复制」反馈（按 item.key） */
  const scrollRef = React.useRef(null);
  const fileRef = React.useRef(null);
  /* 自动滚动信号 = 条数 + 末条文本长度：流式 chunk 并入末条（appendText 合并）时
   * items.length 不变，只盯条数会长回复流式期间不滚动（评审修复） */
  const lastIt = client.items[client.items.length - 1];
  const scrollSig = client.items.length + ":" + (lastIt && lastIt.text ? lastIt.text.length : 0);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollSig]);
  /* usage/历史两浮层的外点与 Esc 收回：pointerdown 早于按钮 click，命中自身
   * 控件（closest 命中）时忽略——开关按钮自身的切换逻辑不受影响；点控制行
   * 其他按钮（新对话/分叉/下拉）同样收回浮层。 */
  React.useEffect(() => {
    if (!usageOpen && !histOpen) return undefined;
    const onDown = (ev) => {
      const t = ev.target;
      if (t && typeof t.closest === "function"
        && (t.closest(".pw-acp-usage") || t.closest(".pw-acp-pop")
          || t.closest(".pw-acp-hist-btn") || t.closest(".pw-acp-hist"))) return;
      setUsageOpen(false);
      setHistOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") { setUsageOpen(false); setHistOpen(false); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [usageOpen, histOpen]);
  /* configOptions 里的三个 select 数据源（kimi 0.36 实测：model/thinking/mode） */
  const coOf = (id) => (client.configOptions || []).find((o) => o && o.id === id) || null;
  const modeCo = coOf("mode"),
    modelCo = coOf("model"),
    thinkCo = coOf("thinking");
  const modeValue = (client.modes && client.modes.currentModeId) || (modeCo && modeCo.currentValue) || "";
  const modeOptions =
    client.modes && client.modes.availableModes && client.modes.availableModes.length
      ? client.modes.availableModes.map((m) => ({ value: m.id, name: m.name || m.id }))
      : (modeCo && modeCo.options) || [];
  const sel = (title, value, options, onChange) =>
    options && options.length
      ? e(
          "select",
          { className: "pw-acp-sel", title, value, onChange: (ev) => onChange(ev.target.value) },
          options.map((o) => e("option", { key: o.value, value: o.value }, o.name || o.value)),
        )
      : null;
  /* 上下文用量条（usage_update） */
  const pct = client.usage && client.usage.size ? Math.min(100, Math.round((client.usage.used / client.usage.size) * 100)) : 0;
  const kfmt = (n) => (n >= 1000 ? (n / 1024).toFixed(n >= 10240 ? 0 : 1) + "k" : String(n));
  /* 历史会话：kimi 的 session/list 不按 cwd 过滤（实测），前端过滤 */
  const histList = (client.sessions || [])
    .filter((s) => s && s.sessionId && s.cwd === client.cwd)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  /* 斜杠命令补全：draft 以 / 开头且不含空白时弹出；kimi 会把全部技能暴露成 /skill:*（实测 72 条），
   * 用子串模糊匹配（不区分大小写），弹窗可滚动、键盘全量导航 */
  const slashQ = draft.slice(1).toLowerCase();
  const slashAll =
    !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
      ? client.commands.filter((c) => c && c.name && (slashQ === "" || c.name.toLowerCase().indexOf(slashQ) >= 0))
      : [];
  const sIdx = Math.min(slashIdx, Math.max(0, slashAll.length - 1));
  /* 发送语义按状态分派（参考 Cursor 排队/引导交互，用户决策 2026-08）：
   * 空闲=直接发；运行中 Enter/后续消息=入队（轮次结束自动补发）；引导=cancel 后回发；
   * 断线=入队并立即触发重连，连回（hello/loaded）后自动补发 */
  const send = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    if (client.status === "dead") {
      client.enqueue(text, images);
      client.reconnect();
    } else if (client.status === "running" || client.status === "waiting") client.enqueue(text, images);
    else client.sendPrompt(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const steer = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    client.steerNow(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const pickSlash = (c) => {
    setDraft("/" + c.name + " ");
    setSlashIdx(0);
  };
  /* 读图入队（文件选择 / 剪贴板粘贴共用）：超 4 张静默丢弃，host 侧另有 8MB/张守卫 */
  const addImageFile = (f) => {
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result || "");
      const comma = url.indexOf(",");
      if (comma < 0) return;
      setImages((cur) => (cur.length >= 4 ? cur : cur.concat([{ url, data: url.slice(comma + 1), mimeType: f.type }]).slice(0, 4)));
    };
    rd.readAsDataURL(f);
  };
  const onFiles = (ev) => {
    Array.prototype.slice.call(ev.target.files || []).forEach(addImageFile);
    ev.target.value = "";
  };
  /* Cmd/Ctrl+V 直接粘贴截图/图片文件；纯文本剪贴板不拦截，走默认粘贴 */
  const onPaste = (ev) => {
    const cd = ev.clipboardData;
    if (!cd) return;
    const items = Array.prototype.slice.call(cd.items || []).filter((it) => it.kind === "file" && /^image\//.test(it.type));
    if (!items.length) return;
    ev.preventDefault();
    items.forEach((it) => addImageFile(it.getAsFile()));
  };
  const imageCap = !!(client.capabilities && client.capabilities.promptCapabilities && client.capabilities.promptCapabilities.image);
  /* 消息悬停操作条：只有复制（用户与 AI 消息同款）。已复制反馈按 item.key 记 */
  const copyText = (t) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) { /* 忽略 */ }
    ta.remove();
    return Promise.resolve();
  };
  const copyMsg = (it) => {
    copyText(it.text || "");
    setCopiedKey(it.key);
    setTimeout(() => setCopiedKey((k) => (k === it.key ? null : k)), 1200);
  };
  const msgActs = (it) =>
    e(
      "div",
      { className: "pw-acp-acts" },
      e(
        "button",
        { className: "pw-acp-act" + (copiedKey === it.key ? " ok" : ""), title: "复制内容", onClick: () => copyMsg(it) },
        copiedKey === it.key ? CheckIcon(11) : CopyIcon(11),
        copiedKey === it.key ? "已复制" : "复制",
      ),
    );
  /* 顶部控制条已按用户决策移除（2026-08）：头条干扰阅读输出，名字/状态与 tab 重复。
   * 布局：会话操作（＋新增/历史/分叉）在输入区图片钮左方；模式（左）与模型/思考/上下文（右）
   * 在输入区下沿控制行；上下文为紧凑指示器，点击展开明细浮层（主对话同款交互）。 */
  return e(
    "div",
    { className: "pw-acp" },
    client.status === "dead"
      ? e(
          "div",
          { className: "pw-acp-dead" },
          e(
            "span",
            { className: "pw-acp-dead-text" },
            client.reconnecting ? "连接已断开，正在自动重连（第 " + client.reconnecting + " 次）…" : client.fatal || "agent 进程已退出 / 连接已断开",
          ),
          e("button", { className: "pw-btn-plain", onClick: () => client.reconnect() }, "立即重连"),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-stream", ref: scrollRef },
      client.items.map((it) =>
        it.kind === "tool"
          ? e(
              "div",
              { key: it.key, className: "pw-acp-tool st-" + it.status, title: it.arg || it.title },
              e("span", { className: "pw-acp-tool-status" }, TOOL_STATUS[it.status] || it.status),
              e("span", { className: "pw-acp-tool-title" }, it.title),
              /* kimi 的 Bash 类标题是 "Running: <命令>"，与提取的 arg 重复——标题已含 arg 就不再重复显示 */
              it.arg && it.title.indexOf(it.arg) < 0 ? e("span", { className: "pw-acp-tool-arg" }, shortArg(it.arg)) : null,
              it.output
                ? e(
                    "details",
                    { className: "pw-acp-tool-out" },
                    e("summary", null, "输出"),
                    e("pre", null, it.output.length > 2000 ? it.output.slice(0, 2000) + "\n…（截断）" : it.output),
                  )
                : null,
            )
          : it.kind === "plan"
            ? e("pre", { key: it.key, className: "pw-acp-plan" }, it.text)
            : it.kind === "note"
              ? e("div", { key: it.key, className: "pw-acp-note" }, it.text)
              : it.kind === "error"
                ? e("div", { key: it.key, className: "pw-acp-error" }, it.text)
                : it.kind === "agent"
                  ? /* agent 正文按 markdown 渲染（复用预览栏渲染器；user 回声/think 保持纯文本）。
                     * 流式中途的未闭合围栏/半行语法由渲染器自然降级为原文，下一 chunk 到来即自愈 */
                  e(
                    "div",
                    { key: it.key, className: "pw-acp-msgw agent" },
                    e("div", { className: "pw-acp-msg agent pw-acp-md" }, renderMarkdown(stripCompactNotice(it.text), null, client.cwd)),
                    msgActs(it),
                  )
                  : it.kind === "user"
                    ? e(
                        "div",
                        { key: it.key, className: "pw-acp-msgw user" },
                        e(
                          "div",
                          { className: "pw-acp-msg user" },
                          it.images && it.images.length
                            ? e(
                                "span",
                                { className: "pw-acp-imgs" },
                                it.images.map((im, i) => e("img", { key: i, className: "pw-acp-thumb", src: im.url })),
                              )
                            : null,
                          it.text,
                        ),
                        msgActs(it),
                      )
                    : /* thought 等其余条目保持裸气泡（无操作条） */
                      e("div", { key: it.key, className: "pw-acp-msg " + it.kind }, it.text),
      ),
      client.perm
        ? e(
            "div",
            { className: "pw-acp-perm" },
            e("div", { className: "pw-acp-perm-title" }, client.perm.title),
            e(
              "div",
              { className: "pw-acp-perm-opts" },
              (client.perm.options || []).map((o) =>
                e(
                  "button",
                  {
                    key: o.optionId || o.id || o.name,
                    className: "pw-btn-plain",
                    onClick: () => client.answerPermission(client.perm.requestId, o.optionId || o.id || o.name),
                  },
                  o.name || o.optionId || o.id,
                ),
              ),
            ),
          )
        : null,
    ),
    images.length
      ? e(
          "div",
          { className: "pw-acp-chips" },
          images.map((im, i) =>
            e(
              "span",
              { key: i, className: "pw-acp-chip" },
              e("img", { src: im.url }),
              e(
                "span",
                { className: "pw-acp-chip-x", title: "移除", onClick: () => setImages((cur) => cur.filter((_, j) => j !== i)) },
                "×",
              ),
            ),
          ),
        )
      : null,
    histOpen
      ? e(
          "div",
          { className: "pw-acp-hist" },
          client.historyBusy
            ? e("div", { className: "pw-hint" }, "加载中…")
            : histList.length
              ? histList.map((s) =>
                  e(
                    "button",
                    {
                      key: s.sessionId,
                      className: "pw-acp-hist-row" + (s.sessionId === client.sessionId ? " cur" : ""),
                      title: s.sessionId,
                      onClick: () => {
                        setHistOpen(false);
                        client.loadSession(s.sessionId);
                      },
                    },
                    e("span", { className: "pw-acp-hist-title" }, s.title || "(无标题)"),
                    e("span", { className: "pw-acp-hist-time" }, relTime(Date.parse(s.updatedAt || "") || 0)),
                    /* 删除：两击确认；当前会话不显示（成功帧 session_deleted 会把行移除） */
                    s.sessionId !== client.sessionId
                      ? e(
                          "span",
                          {
                            className: "pw-acp-hist-del" + (delId === s.sessionId ? " confirm" : ""),
                            title: delId === s.sessionId ? "再次点击确认删除" : "删除该会话",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              if (delId === s.sessionId) {
                                setDelId(null);
                                client.deleteSession(s.sessionId);
                              } else {
                                setDelId(s.sessionId);
                              }
                            },
                          },
                          delId === s.sessionId ? "删?" : "×",
                        )
                      : null,
                  ),
                )
              : e("div", { className: "pw-hint" }, "该目录下没有历史会话"),
        )
      : null,
    /* 已排队面板（参考截图交互）：左侧计数，右侧"移回输入框"（取回最近一条到草稿） */
    client.queue.length
      ? e(
          "div",
          { className: "pw-acp-queue" },
          e(
            "div",
            { className: "pw-acp-queue-head" },
            e("span", { className: "pw-acp-queue-n" }, "已排队 · " + client.queue.length),
            e(
              "button",
              {
                className: "pw-acp-hbtn",
                title: "把最近一条排队消息移回输入框",
                onClick: () => {
                  const m = client.popQueue();
                  if (m) {
                    setDraft(m.text);
                    setImages(m.images || []);
                  }
                },
              },
              "移回输入框",
            ),
          ),
          client.queue.map((m, i) =>
            e("div", { key: i, className: "pw-acp-queue-item", title: m.text }, (m.images && m.images.length ? "[图×" + m.images.length + "] " : "") + (m.text || "(空)")),
          ),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-composer" },
      slashAll.length
        ? e(
            "div",
            { className: "pw-acp-slash" },
            slashAll.map((c, i) =>
              e(
                "button",
                {
                  key: c.name,
                  className: "pw-acp-slash-row" + (i === sIdx ? " cur" : ""),
                  /* 键盘导航时让选中行滚进可视区 */
                  ref: i === sIdx ? (el) => el && el.scrollIntoView({ block: "nearest" }) : null,
                  onMouseDown: (ev) => {
                    ev.preventDefault();
                    pickSlash(c);
                  },
                },
                e("span", { className: "pw-acp-slash-name" }, "/" + c.name),
                e("span", { className: "pw-acp-slash-desc", title: c.description || "" }, String(c.description || "").split("\n")[0]),
              ),
            ),
          )
        : !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
          ? e(
              "div",
              { className: "pw-acp-slash" },
              e("div", { className: "pw-acp-slash-empty" }, client.commands.length ? "无匹配命令" : "命令加载中…"),
            )
          : null,
      /* 输入框独立成框（用户决策）：运行中也可输入——占位提示 引导/排队 双出口 */
      e("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: onFiles }),
      e("input", {
        value: draft,
        placeholder:
          client.status === "running" || client.status === "waiting"
            ? "立即引导 / 排队后续消息…"
            : client.status === "dead"
              ? "连接已断开——输入后回车将自动重连并发送"
              : imageCap
                ? "向 Kimi Code 发送指令…（/ 命令，可粘贴图片）"
                : "向 Kimi Code 发送指令…（/ 命令）",
        onChange: (ev) => {
          setDraft(ev.target.value);
          setSlashIdx(0);
          setSlashOff(false);
        },
        onPaste: imageCap ? onPaste : undefined,
        onKeyDown: (ev) => {
          if (ev.isComposing) return;
          if (slashAll.length && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
            ev.preventDefault();
            setSlashIdx((i) => (i + (ev.key === "ArrowDown" ? 1 : -1) + slashAll.length) % slashAll.length);
          } else if (slashAll.length && (ev.key === "Tab" || ev.key === "Enter")) {
            ev.preventDefault();
            pickSlash(slashAll[sIdx]);
          } else if (ev.key === "Escape") {
            setSlashOff(true);
          } else if (ev.key === "Enter") {
            send();
          }
        },
        }),
      client.status === "running" || client.status === "waiting"
        ? [
            e(
              "button",
              { key: "steer", className: "pw-acp-mini", title: "引导：打断当前任务，立即处理这条消息", disabled: !draft.trim() && !images.length, onClick: steer },
              "引导",
            ),
            e(
              "button",
              { key: "queue", className: "pw-acp-mini", title: "后续消息：加入队列，当前任务结束后自动发送", disabled: !draft.trim() && !images.length, onClick: send },
              "后续消息",
            ),
          ]
        : e("button", { className: "pw-btn-primary", disabled: !draft.trim() && !images.length, onClick: send }, "发送"),
    ),
    /* 控制行（框外下方）：会话操作（新对话/历史/分叉/图片）+ 模式（左）；模型/思考/上下文/停止（右）。
     * 浮层数据只有 usage_update 的 {used,size}——ACP 不提供系统提示词/工具分项，明细从简 */
    e(
      "div",
      { className: "pw-acp-controls" },
      e(
        "button",
        { className: "pw-acp-hbtn", title: "新对话（同目录开一个空白 Kimi 会话）", disabled: client.busy(), onClick: () => client.newSession() },
        "新对话",
      ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-hist-btn" + (histOpen ? " on" : ""),
            title: "历史会话（该目录下的 Kimi 会话，可恢复）",
            onClick: () => {
              const v = !histOpen;
              setHistOpen(v);
              /* 替换式弹出：开历史收 usage（外点监听护住开关按钮，
               * 互斥只能放在按钮自己的 click 里） */
              if (v) { client.listSessions(); setUsageOpen(false); }
            },
          },
          "历史",
        ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn",
            title: "分叉当前会话（复制出带完整上下文的副本，原会话保留）",
            disabled: client.busy(),
            onClick: () => client.forkSession(),
          },
          GitBranchIcon(11),
        ),
        imageCap
          ? e(
              "button",
              { className: "pw-acp-attach", title: "附加图片（最多 4 张）", onClick: () => fileRef.current && fileRef.current.click() },
              ImageIcon(14),
            )
          : null,
        sel("模式（default/plan/auto/yolo）", modeValue, modeOptions, (v) => client.setMode(v)),
        e("span", { className: "pw-bpanel-flex" }),
        modelCo ? sel("模型", modelCo.currentValue, modelCo.options, (v) => client.setConfig("model", v)) : null,
        thinkCo ? sel("Thinking 档位", thinkCo.currentValue, thinkCo.options, (v) => client.setConfig("thinking", v)) : null,
        /* 压缩上下文：发送 kimi 内建 /compact（已实测暴露在 available_commands）。
         * 参照 pi-web ChatInput：压缩中图标换实心停止块、点击=中止（onCompact/onAbort 切换） */
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn pw-acp-compact" + (client.compacting ? " ing" : ""),
            title: client.compacting ? "中止压缩" : "压缩上下文（发送 /compact：总结历史、释放上下文窗口，原会话内容随之精简）",
            disabled: client.busy() && !client.compacting,
            onClick: () => (client.compacting ? client.cancel() : client.sendPrompt("/compact")),
          },
          client.compacting ? StopIcon(11) : MinimizeIcon(11),
          client.compacting ? "压缩中…" : "压缩",
        ),
        client.usage && client.usage.size
        ? e(
            "button",
            {
              className: "pw-acp-usage" + (pct >= 80 ? " hot" : "") + (usageOpen ? " on" : ""),
              title: "上下文占用，点击展开明细",
              onClick: () => {
                /* 替换式弹出：开 usage 收历史（外点监听护住开关按钮，
                 * 互斥只能放在按钮自己的 click 里） */
                const v = !usageOpen;
                setUsageOpen(v);
                if (v) setHistOpen(false);
              },
            },
            /* 圆环占用指示（对齐 Kimi 原生应用）：pathLength 归一到 100，
             * dasharray 第一段即百分比；≥80% 走 error 色（沿用原 hot 语义） */
            e(
              "svg",
              { className: "pw-acp-usage-ring", viewBox: "0 0 20 20", "aria-hidden": "true" },
              e("circle", { className: "pw-acp-usage-ring-track", cx: 10, cy: 10, r: 8 }),
              e("circle", {
                className: "pw-acp-usage-ring-arc" + (pct >= 80 ? " hot" : ""),
                cx: 10, cy: 10, r: 8,
                pathLength: 100,
                strokeDasharray: pct + " " + (100 - pct),
                transform: "rotate(-90 10 10)",
              }),
            ),
            e("span", { className: "pw-acp-usage-text" }, pct + "%"),
          )
        : null,
      /* 红色停止（用户决策：不叫取消；运行/等待中出现，位于控制行右端） */
      client.status === "running" || client.status === "waiting"
        ? e("button", { className: "pw-acp-stop", title: "停止当前任务", onClick: () => client.cancel() }, "■ 停止")
        : null,
      usageOpen && client.usage && client.usage.size
        ? e(
            "div",
            { className: "pw-acp-pop" },
            e("div", { className: "pw-acp-pop-title" }, "上下文已用 " + pct + "%"),
            e(
              "div",
              { className: "pw-acp-pop-bar" },
              e("div", { className: "pw-acp-usage-fill" + (pct >= 80 ? " hot" : ""), style: { width: pct + "%" } }),
            ),
            e("div", { className: "pw-acp-pop-num" }, kfmt(client.usage.used) + " / " + kfmt(client.usage.size) + " tokens"),
          )
        : null,
      ),
  );
}

/* ==================== 下侧边栏（助手面板）：终端 + 智能体 tabs ====================
 * 吸底面板，只占会话列（跟踪 .pI_x6G_centerCol 的矩形定位，打开时给会话列底部
 * padding 形成挤压，滑入滑出对齐侧栏节奏）。tab 栏：Kimi 智能体 tabs 居左（＋号选目录接入，
 * tab 上显示 agent 实时状态点，× 关闭并回收进程），「终端」与关闭钮居右。高度顶边拖拽并 localStorage 记忆。
 * 智能体连接/状态在 15-acp.js 的 AcpClient（纯 JS，面板关闭也不断连）。
 * bottomPanel / bottomArea store 在 01-stores.js（避免跨文件 TDZ）。
 * 兼容机制：bottomArea.owner 被第三方占位（dshBottomPanels.acquire）期间让位——
 * 渲染 null 且撤掉挤压 padding；释放后自动归位（open/tab/height/终端与 agent 连接全保留）。 */

/* xterm 配色：表面色走平台 token，16 色 ANSI 用 one-dark/one-light 调色板（同参考实现） */
const ANSI_DARK = {
  black: "#282c34", red: "#e06c75", green: "#98c379", yellow: "#e5c07f",
  blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
  brightBlack: "#5c6370", brightRed: "#e06c75", brightGreen: "#98c379",
  brightYellow: "#e5c07f", brightBlue: "#61afef", brightMagenta: "#c678dd",
  brightCyan: "#56b6c2", brightWhite: "#ffffff",
};
const ANSI_LIGHT = {
  black: "#383a42", red: "#e45649", green: "#50a14f", yellow: "#c18401",
  blue: "#0184bc", magenta: "#a626a4", cyan: "#0997b3", white: "#a0a1a7",
  brightBlack: "#4f525e", brightRed: "#e45649", brightGreen: "#50a14f",
  brightYellow: "#c18401", brightBlue: "#0184bc", brightMagenta: "#a626a4",
  brightCyan: "#0997b3", brightWhite: "#fafafa",
};
function termTheme() {
  const cs = getComputedStyle(document.body);
  const dark = document.body.hasAttribute("data-ds-dark-theme");
  const background = cs.getPropertyValue("--dsw-alias-bg-base").trim() || (dark ? "#111114" : "#ffffff");
  const foreground = cs.getPropertyValue("--dsw-alias-label-primary").trim() || (dark ? "#e6e6e6" : "#1a1a1a");
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.12)",
    ...(dark ? ANSI_DARK : ANSI_LIGHT),
  };
}

/* xterm 按需加载（评审修复：vendor 284KB 原先拼进 bundle 求值期全量解析，
 * 与终端惰性策略矛盾）。vendor 从拼接链剥离，host /wb/vendor-xterm.js 直出，
 * 首开终端才注入 <script>（classic script 顶层 var 挂 window.__pwXterm，同原拼接语义）。
 * 共享单例 promise：多 tab/重挂载只加载一次；失败可重试（清掉单例） */
let xtermLoading = null;
function ensureXterm() {
  if (window.__pwXterm) return Promise.resolve(true);
  if (!xtermLoading)
    xtermLoading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/__dsh-geek-sidebar__/wb/vendor-xterm.js";
      s.async = true;
      s.onload = () => resolve(!!window.__pwXterm);
      s.onerror = () => ((xtermLoading = null), resolve(false));
      document.head.appendChild(s);
    });
  return xtermLoading;
}

/* 终端视图：xterm + WS 连接 host pty；断线自动重连（1011+reason 显示错误横幅） */
function TerminalView() {
  const e = React.createElement;
  const hostRef = React.useRef(null);
  const [fatal, setFatal] = React.useState(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let dead = false,
      dispose = null;
    ensureXterm().then((ok) => {
      if (dead) return;
      const XT = window.__pwXterm;
      if (!ok || !XT) {
        setFatal("xterm 未加载");
        return;
      }
      dispose = initTerm(host, XT, setFatal);
    });
    return () => {
      ((dead = !0), dispose && dispose());
    };
  }, []);
  return e(
    "div",
    { className: "pw-term-wrap" },
    e("div", { ref: hostRef, className: "pw-term-host" }),
    fatal ? e("div", { className: "pw-term-fatal" }, fatal) : null,
  );
}

/* 终端初始化主体（xterm 就绪后调用）：建 term + WS + 各监听，返回 cleanup */
function initTerm(host, XT, setFatal) {
  {
    const term = new XT.Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      scrollback: 4000,
      allowTransparency: true,
      theme: termTheme(),
    });
    const fit = new XT.FitAddon();
    term.loadAddon(fit);
    term.open(host);
    const applyTheme = () => {
      term.options.theme = termTheme();
    };
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    let socket = null,
      closed = false,
      failures = 0,
      retryTimer = 0;
    const wsUrl = () => {
      const u = new URL("/__dsh-geek-sidebar__/wb/terminal-ws", location.origin);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      const p = new URLSearchParams({ sessionId: sessionProbe.sid || "_", tab: "assistant" });
      if (currentRootPath) p.set("cwd", currentRootPath);
      u.search = p.toString();
      return u.toString();
    };
    const sendResize = () => {
      if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    const connect = () => {
      if (closed) return;
      socket = new WebSocket(wsUrl());
      socket.onopen = () => {
        failures = 0;
        setFatal(null);
        try {
          fit.fit();
        } catch (e2) {}
        sendResize();
      };
      socket.onmessage = (ev) => {
        if (typeof ev.data === "string") term.write(ev.data);
      };
      socket.onclose = (ev) => {
        if (closed) return;
        if (ev.code === 1011 && ev.reason) {
          setFatal(ev.reason);
          return;
        }
        failures++;
        if (failures > 3) {
          setFatal("终端连接失败（code " + ev.code + "）");
          return;
        }
        retryTimer = setTimeout(connect, 1200);
      };
      socket.onerror = () => {};
    };
    const inputSub = term.onData((d) => {
      if (socket && socket.readyState === 1) socket.send(d);
    });
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        sendResize();
      } catch (e3) {}
    });
    ro.observe(host);
    connect();
    /* 评审修复：bus 节拍上比对连接参数键（sid|root），变化即平推重连——原版 wsUrl 的
     * sessionId/cwd 在建连时捕获，切换会话/项目后终端仍挂旧绑定。root 经 01 的
     * setCurrentRootPath 发节拍，sid 经 sessionProbe.set 发节拍，两处都能捕到。
     * 平推不算失败：置空 onclose 不走退避，xterm 保留 scrollback 仅换 pty 绑定 */
    let lastKey = (sessionProbe.sid || "_") + "|" + (currentRootPath || "");
    const paramSub = bus.sub(() => {
      if (closed) return;
      const k2 = (sessionProbe.sid || "_") + "|" + (currentRootPath || "");
      if (k2 === lastKey) return;
      lastKey = k2;
      failures = 0;
      clearTimeout(retryTimer);
      try {
        if (socket) {
          socket.onclose = null;
          socket.close();
        }
      } catch (e9) {}
      connect();
    });
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      try {
        paramSub();
      } catch (e9) {}
      try {
        ro.disconnect();
      } catch (e4) {}
      try {
        mo.disconnect();
      } catch (e5) {}
      try {
        inputSub.dispose();
      } catch (e6) {}
      try {
        if (socket) socket.close();
      } catch (e7) {}
      try {
        term.dispose();
      } catch (e8) {}
    };
  }
}

/* 面板骨架：tab 栏（智能体 tabs + ＋号接入 → 右端 终端 tab + 关闭钮）+ 内容区。
 * 开合对齐左右侧栏：首次打开后常驻挂载，transform 滑入滑出（不触发重排、xterm 不重建），
 * 挤压走 padding-bottom 过渡；时长/缓动复用平台 token，与 AppFrame 列宽过渡同节奏。
 * 常驻挂载的代价：终端 WS 与 xterm 关栏后保活（换来 scrollback 保留与无闪回）。 */
function BottomPanel(t) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const [rect, setRect] = React.useState(null);
  /* 首次打开才挂载（否则终端 PTY 会随页面加载白起）；双 rAF 让首帧以 off 态绘制再滑入 */
  const [mounted, setMounted] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    if (!bottomPanel.open || mounted) return undefined;
    setMounted(true);
    const t2 = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(t2);
  }, [bottomPanel.open, mounted]);
  /* 跟踪会话列矩形：面板只覆盖其底部区域（左右侧栏不动） */
  React.useEffect(() => {
    const col = document.querySelector(".pI_x6G_centerCol");
    if (!col) return undefined;
    const update = () => {
      const r = col.getBoundingClientRect();
      setRect({ left: Math.round(r.left), width: Math.round(r.width) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(col);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  /* 挤压：打开时给会话列底部 padding（过渡与面板滑移同节奏），关闭/让位归零 */
  const yielded = bottomArea.isYielded();
  React.useEffect(() => {
    const col = document.querySelector(".pI_x6G_centerCol");
    if (!col) return undefined;
    if (!col.style.transition) col.style.transition = "padding-bottom var(--ds-transition-duration-slow) var(--ds-ease-in-out)";
    col.style.paddingBottom = bottomPanel.open && !yielded ? bottomPanel.height + "px" : "0px";
    /* 评审修复：卸载（插件热更）/依赖轮换时归零，别让挤压 padding 残留在平台列上 */
    return () => {
      col.style.paddingBottom = "0px";
    };
  }, [bottomPanel.open, bottomPanel.height, yielded]);
  /* 评审修复：拖拽中的 document 监听登记到 ref，面板卸载（让位/热更）时兜底摘除——
   * 原只在 mouseup 才摘，拖拽中卸载会永久泄漏一对监听器。hooks 须在上方 early return 之前 */
  const dragOff = React.useRef(null);
  React.useEffect(
    () => () => {
      dragOff.current && dragOff.current();
    },
    [],
  );
  if (!mounted || !rect || yielded) return null;
  const startDrag = (ev) => {
    ev.preventDefault();
    const startY = ev.clientY,
      startH = bottomPanel.height;
    const mv = (e2) => {
      const h = Math.min(Math.max(140, startH + (startY - e2.clientY)), Math.round(window.innerHeight * 0.85));
      bottomPanel.set({ height: h });
    };
    const up = () => {
      dragOff.current && dragOff.current();
      try {
        window.localStorage.setItem("pw-bpanel-h", String(bottomPanel.height));
      } catch (e9) {}
    };
    dragOff.current = () => {
      (document.removeEventListener("mousemove", mv),
        document.removeEventListener("mouseup", up),
        (dragOff.current = null));
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  /* ＋ 接入 Kimi Code：选目录 → 建 tab（AcpClient 立即连 WS 起进程） */
  const addAgent = () => {
    const svc = t.workspacesSvc;
    if (!svc || typeof svc.pickDirectory !== "function") return;
    svc
      .pickDirectory()
      .then((n) => {
        if (n) acpTabs.add(n);
      })
      .catch(() => {});
  };
  const tab = bottomPanel.tab;
  const activeClient = tab !== "terminal" ? acpTabs.clients[tab] || null : null;
  return e(
    "div",
    { className: "pw-bpanel" + (bottomPanel.open && entered ? "" : " off"), style: { left: rect.left, width: rect.width, height: bottomPanel.height } },
    e("div", { className: "pw-bpanel-drag", title: "拖拽调整高度", onMouseDown: startDrag }),
    e(
      "div",
      { className: "pw-bpanel-tabs" },
      acpTabs.tabs.map((tb) => {
        const c = acpTabs.clients[tb.id];
        const st = c ? c.status : "connecting";
        return e(
          "span",
          {
            key: tb.id,
            className: "pw-bpanel-tab pw-bpanel-atab" + (tab === tb.id ? " on" : ""),
            title: tb.cwd + "\nKimi Code：" + (ACP_STATUS[st] || ACP_STATUS.connecting).label,
            onClick: () => bottomPanel.set({ tab: tb.id }),
          },
          e("span", { className: "pw-tab-dot " + st }),
          e("span", { className: "pw-tab-name" }, tb.name),
          e(
            "span",
            {
              className: "pw-tab-x",
              title: "关闭（断开并回收 agent 进程）",
              onClick: (ev) => {
                ev.stopPropagation();
                acpTabs.close(tb.id);
              },
            },
            "×",
          ),
        );
      }),
      e("button", { className: "pw-bpanel-add", title: "接入 Kimi Code：选择目录", onClick: addAgent }, "＋"),
      e("span", { className: "pw-bpanel-flex" }),
      /* 终端挪右端：智能体 tabs 是主角居左；关闭钮与左右侧栏同族（» 转 90° 向下） */
      e(
        "button",
        { className: "pw-bpanel-tab" + (tab === "terminal" ? " on" : ""), onClick: () => bottomPanel.set({ tab: "terminal" }) },
        "终端",
      ),
      e(
        "button",
        { className: "pw-bpanel-col", title: "收起下栏", onClick: () => bottomPanel.set({ open: false }) },
        e("span", { className: "pw-bpanel-col-arrow" }, "»"),
      ),
    ),
    e(
      "div",
      { className: "pw-bpanel-body" },
      tab === "terminal" || !activeClient ? e(TerminalView, null) : e(AgentTabView, { client: activeClient }),
    ),
  );
}

return {
  apply(t) {
    const e = t.get("slots");
    if (e === void 0) return;
    const s = t.get("layout"),
      o = t.get("sessions"),
      a = t.get("workspaces");
    (mountStyle(API + "/wb/style.css"),
      host
        .call("workbench.notesGet", {})
        .then((u) => {
          u && notesStore.set(u);
        })
        .catch(() => {}));
    const l = fileMentionBridge;
    /* details 面板仲裁服务：第三方经 ctx.inject(['dshDetailsPanels'], cb) 接入；
       register() 返回的注销函数须挂到消费方自己的 ctx.effect。 */
    t.provide("dshDetailsPanels");
    t.dshDetailsPanels = {
      register: (def) => panelStore.register(def),
      open: (id) => panelStore.open(id),
      close: (id) => panelStore.close(id),
      isOpen: (id) => panelStore.isOpen(id),
    };
    /* 底部区域仲裁服务：第三方经 ctx.inject(['dshBottomPanels'], cb) 接入。
       acquire(id) 独占占位（排他，被占即 false），占位期间我们的底部面板让位
       （渲染 null + 撤挤压，open 状态保留）；release(id) 归还后自动归位。
       对齐右栏 details 单槽 priority 的让位语义——shell.overlay 是多槽，无平台仲裁，故自建。 */
    t.provide("dshBottomPanels");
    t.dshBottomPanels = {
      acquire: (id) => bottomArea.acquire(id),
      release: (id) => bottomArea.release(id),
      owner: () => bottomArea.owner,
      isYielded: () => bottomArea.isYielded(),
    };
    /* @文件引用走 rc.8 原生 ui-reference 源（reference 组），插件不再注册
       * 自有 workbenchFile 组（v1.16.0 起移除，能力重叠）。
       * 侧栏"提及"仍走 dshFileMention 桥（insert-text 纯文本路径，原生无对应物）。 */
    (e.inject("sidebar.workspaces", () =>
        e.register({ name: "sidebar.workspaces", priority: -5 }, (u) =>
          React.createElement(Sidebar, {
            wide: u.wide,
            useSessions: u.useSessions,
            useWorkspaces: u.useWorkspaces,
            layout: s,
            sessionsSvc: o,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("sidebar.footer.action", () =>
        e.register(
          {
            name: "sidebar.footer.action",
            id: "workbench-footbar",
            order: 100,
          },
          (u) =>
            React.createElement(FootBar, {
              wide: u.wide,
              onSkills: () => skillsUI.open(currentRootPath || ""),
            }),
        ),
      ),
      e.inject("details", () =>
        /* single 槽 priority 最小者渲染：-0.5 压过官方默认（0），同时输给 dsh-gtm 抽屉（-1，
           打开才注册）——它开我们让位、它关我们归位。-1 与 0 之间只有小数可用。 */
        e.register({ name: "details", priority: -0.5 }, (u) =>
          React.createElement(PanelHost, {
            sessionId: u.sessionId,
            layout: s,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-bottom-panel" }, () => React.createElement(BottomPanel, { workspacesSvc: a })),
      ),
      e.inject("shell.overlay", () =>
        e.register(
          { name: "shell.overlay", id: "workbench-preview-drawer" },
          (u) =>
            React.createElement(PreviewDrawer, {
              layout: s,
              workspacesSvc: a,
              mentionBridge: l,
              /* 框架全局份额：drawer 用它判断官方 details 栏是否被会话门钳 0 */
              useSessions: u.useSessions,
            }),
        ),
      ));
  },
};

})(React, host)

    /* ============================ feature 3: skills ============================ */
    const V = {
      bg: 'var(--dsw-alias-bg-base)',
      panel: 'var(--dsw-alias-bg-layer-1)',
      selected: 'var(--dsw-alias-bg-layer-2)',
      border: 'var(--dsw-alias-border-l1)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      accent: 'var(--dsw-alias-button-info-fill, var(--dsw-alias-brand-primary))', /* brand-primary 在亮色主题近黑；button-info-fill 才是 DeepSeek 蓝 */
      error: 'var(--dsw-alias-state-error-primary)',
      warn: '#d97706',
      ok: '#16a34a',
    }
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

    function shortenPath(p) { return String(p || '').replace(/^\/(?:Users|home)\/[^/]+/, '~') }
    function shortVersion(v) { return v ? String(v).slice(0, 8) : 'unknown' }
    function updateKey(skill) { return skill.install ? skill.install.scope + '\0' + skill.install.package : null }
    function groupOf(skill) {
      const sh = Boolean(skill.install && skill.install.skillsShUrl)
      return skill.scope + (sh ? ' / skills.sh' : '')
    }

    const api2 = (method, path, body) => api(method, '/skills' + path, body)

    function PlusIcon() {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }), h('line', { x1: 5, y1: 12, x2: 19, y2: 12 }))
    }
    function PencilIcon() {
      return h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }))
    }
    function Toggle(props) {
      return h('button', {
        onClick: props.onToggle,
        disabled: props.loading,
        title: props.enabled ? '提示词中可见' : '提示词中隐藏（仍可手动调用）',
        style: {
          flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', padding: 0,
          cursor: props.loading ? 'wait' : 'pointer',
          background: props.enabled ? V.accent : V.border,
          position: 'relative', transition: 'background 0.18s', outline: 'none',
        },
      }, h('span', {
        style: {
          position: 'absolute', top: 3, left: props.enabled ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: V.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
        },
      }))
    }

    function Section(props) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
        h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, props.label),
        props.children)
    }

    function Detail(props) {
      const skill = props.skill
      const enabled = !skill.disableModelInvocation
      const st = props.updateStatus
      const displayPath = skill.scope === 'project' && props.cwd && skill.filePath.indexOf(props.cwd) === 0
        ? './' + skill.filePath.slice(props.cwd.length).replace(/^[/\\]/, '')
        : shortenPath(skill.filePath)
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
            h('span', {
              style: {
                fontSize: 10, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                background: skill.scope === 'project' ? 'rgba(99,102,241,0.12)' : 'rgba(120,120,120,0.12)',
                color: skill.scope === 'project' ? 'rgba(99,102,241,0.9)' : V.muted,
              },
            }, skill.scope),
            h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: skill.filePath }, displayPath),
            h(Toggle, { enabled, loading: props.toggling, onToggle: () => props.onToggle(skill) })),
          h('div', { style: { minHeight: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', textAlign: 'right' } },
            !enabled ? h('span', { style: { fontSize: 11, color: V.muted } }, '已在提示词中隐藏（仍可手动调用）') : null,
            props.saveError ? h('span', { style: { fontSize: 12, color: V.error, overflowWrap: 'anywhere' } }, props.saveError) : null)),
        skill.install && skill.install.skillsShUrl ? h(Section, { label: 'Source' },
          h('a', {
            href: skill.install.skillsShUrl, target: '_blank', rel: 'noreferrer',
            style: { display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', color: V.accent, textDecoration: 'none' },
          }, h('span', { style: { fontFamily: MONO, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.install.skillsShUrl.replace(/^https?:\/\//, '') + ' ↗'))) : null,
        skill.install ? h(Section, { label: 'Version' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.muted } }, shortVersion(st && st.currentVersion ? st.currentVersion : skill.install.versionHash)),
            skill.install.canCheckForUpdates ? h('button', {
              onClick: props.onCheckUpdate, disabled: props.checkingUpdate || props.updating,
              style: { padding: '4px 9px', border: '1px solid ' + V.border, borderRadius: 5, background: 'none', color: V.muted, cursor: props.checkingUpdate || props.updating ? 'not-allowed' : 'pointer', opacity: props.checkingUpdate || props.updating ? 0.5 : 1, fontSize: 11 },
            }, '检查') : null,
            st && st.state === 'update-available' ? h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.warn } }, shortVersion(st.latestVersion)) : null,
            props.checkingUpdate || (st && st.state !== 'update-available')
              ? h('span', { style: { fontSize: 12, color: props.checkingUpdate ? V.accent : st && st.state === 'up-to-date' ? V.ok : st && st.state === 'error' ? V.error : V.muted } },
                  props.checkingUpdate ? '检查中…' : st && st.state === 'up-to-date' ? '已是最新' : st && st.state === 'unsupported' ? '自动检查不可用' : (st && st.message) || '检查失败')
              : null,
            st && st.state === 'update-available' ? h('button', {
              onClick: props.onUpdate, disabled: props.updating || props.checkingUpdate,
              style: { padding: '4px 10px', border: 'none', borderRadius: 5, background: V.accent, color: '#fff', cursor: props.updating || props.checkingUpdate ? 'not-allowed' : 'pointer', opacity: props.updating || props.checkingUpdate ? 0.5 : 1, fontSize: 11, fontWeight: 600 },
            }, props.updating ? '更新中…' : '更新') : null),
          props.updateError ? h('span', { style: { fontSize: 12, color: V.error } }, props.updateError) : null) : null,
        h(Section, { label: 'Name' }, h('span', { style: { fontFamily: MONO, fontSize: 14, color: V.text } }, skill.name)),
        h(Section, { label: 'Description' }, h('span', { style: { fontSize: 14, color: V.muted, lineHeight: 1.6 } }, skill.description || '—')))
    }

    function AddPanel(props) {
      const [query, setQuery] = useState('')
      const [results, setResults] = useState([])
      const [searching, setSearching] = useState(false)
      const [searchError, setSearchError] = useState(null)
      const [installing, setInstalling] = useState(null)
      const [installError, setInstallError] = useState(null)
      const [installed, setInstalled] = useState(new Set())
      const [scope, setScope] = useState('global')
      const inputRef = useRef(null)
      useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [])

      const search = async () => {
        if (!query.trim()) return
        setSearching(true); setSearchError(null); setResults([])
        try {
          const d = await api2('POST', '/search', { query: query.trim() })
          setResults(d.results || [])
          if (!(d.results || []).length) setSearchError('没有找到匹配的技能')
        } catch (e) { setSearchError(String(e && e.message ? e.message : e)) } finally { setSearching(false) }
      }
      const install = async (pkg) => {
        setInstalling(pkg); setInstallError(null)
        try {
          await api2('POST', '/install', { package: pkg, scope, cwd: props.cwd })
          setInstalled((prev) => new Set(prev).add(scope + ':' + pkg))
          props.onInstalled()
        } catch (e) { setInstallError(String(e && e.message ? e.message : e)) } finally { setInstalling(null) }
      }
      const installPath = scope === 'global' ? shortenPath(props.globalDir) + '/' : shortenPath(props.cwd) + '/.agents/skills/'

      return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 } },
          h('div', { style: { fontSize: 14, fontWeight: 600, color: V.text } }, '添加技能'),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('input', {
              ref: inputRef, value: query, placeholder: '搜索 skills.sh…',
              onChange: (e) => setQuery(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') search() },
              style: { flex: 1, padding: '7px 10px', fontSize: 13, background: V.panel, border: '1px solid ' + V.border, borderRadius: 6, color: V.text, outline: 'none' },
            }),
            h('button', {
              onClick: search, disabled: searching || !query.trim(),
              style: { padding: '7px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: V.accent, color: '#fff', cursor: searching || !query.trim() ? 'not-allowed' : 'pointer', opacity: searching || !query.trim() ? 0.5 : 1, flexShrink: 0 },
            }, searching ? '搜索中…' : '搜索')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('div', { style: { display: 'flex', borderRadius: 5, border: '1px solid ' + V.border, overflow: 'hidden', fontSize: 12, flexShrink: 0 } },
              ['global', 'project'].map((s2) => h('button', {
                key: s2,
                onClick: () => setScope(s2),
                style: {
                  padding: '3px 10px', border: 'none', cursor: 'pointer',
                  background: scope === s2 ? V.selected : 'none',
                  color: scope === s2 ? V.text : V.muted,
                  fontWeight: scope === s2 ? 600 : 400,
                  borderRight: s2 === 'global' ? '1px solid ' + V.border : 'none',
                },
              }, s2))),
            h('span', { style: { fontSize: 12, color: V.muted, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '→ ' + installPath)),
          searchError ? h('div', { style: { fontSize: 12, color: V.error } }, searchError) : null,
          installError ? h('div', { style: { fontSize: 12, color: V.error, wordBreak: 'break-word' } }, installError) : null),
        results.length > 0
          ? h('div', { style: { flex: 1, overflowY: 'auto' } },
              results.map((r) => {
                const isInstalled = props.installedPackages[scope].has(r.package) || installed.has(scope + ':' + r.package)
                const isInstalling = installing === r.package
                const at = r.package.indexOf('@')
                const repo = at > -1 ? r.package.slice(0, at) : r.package
                const skillPart = at > -1 ? r.package.slice(at + 1) : null
                return h('div', { key: r.package, style: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid ' + V.border } },
                  h('div', { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 3 } }, skillPart || repo),
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                      h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted } }, repo),
                      h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, r.installs || ''),
                      r.url ? h('a', { href: r.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 12, color: V.accent, textDecoration: 'none' } }, 'skills.sh ↗') : null)),
                  h('button', {
                    onClick: () => { if (!isInstalled && !isInstalling) install(r.package) },
                    disabled: isInstalled || isInstalling || installing !== null,
                    style: {
                      flexShrink: 0, padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 5,
                      border: '1px solid ' + V.border,
                      cursor: isInstalled || isInstalling || installing !== null ? 'not-allowed' : 'pointer',
                      background: isInstalled ? 'rgba(34,197,94,0.1)' : 'none',
                      color: isInstalled ? V.ok : isInstalling ? V.accent : V.muted,
                    },
                  }, isInstalled ? '✓ 已安装' : isInstalling ? '安装中…' : '安装'))
              }))
          : (!searchError && !searching
              ? h('div', { style: { fontSize: 13, color: V.muted, lineHeight: 1.8 } },
                  '在 ', h('a', { href: 'https://skills.sh', target: '_blank', rel: 'noreferrer', style: { color: V.accent, textDecoration: 'none' } }, 'skills.sh'), ' 搜索并安装技能。')
              : null))
    }

    function SkillsModal() {
      const [open, setOpen] = useState(false)
      const [cwd, setCwd] = useState('')
      const [skills, setSkills] = useState([])
      const [globalDir, setGlobalDir] = useState('')
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [selected, setSelected] = useState(null)
      const [toggling, setToggling] = useState(new Set())
      const [saveError, setSaveError] = useState(null)
      const [addMode, setAddMode] = useState(false)
      const [statuses, setStatuses] = useState({})
      const [checking, setChecking] = useState(new Set())
      const [updatingKey, setUpdatingKey] = useState(null)
      const [updateError, setUpdateError] = useState(null)
      const [checkingAll, setCheckingAll] = useState(false)
      const [dormantOpen, setDormantOpen] = useState({})
      const [pathEditing, setPathEditing] = useState(false)
      const [pathDraft, setPathDraft] = useState('')

      const load = useCallback(async (forCwd) => {
        setLoading(true); setError(null)
        try {
          const d = await api2('GET', '/list?cwd=' + encodeURIComponent(forCwd || ''))
          const list = d.skills || []
          setSkills(list)
          setGlobalDir(d.globalDir || '')
          setSelected((prev) => {
            if (prev && list.some((s) => s.filePath === prev)) return prev
            const first = list.find((s) => !s.disableModelInvocation) || list[0]
            return first ? first.filePath : null
          })
        } catch (e) { setError(String(e && e.message ? e.message : e)) } finally { setLoading(false) }
      }, [])

      useEffect(() => {
        skillsModalApi = {
          open(forCwd) {
            setCwd(forCwd || '')
            setOpen(true)
            setAddMode(false)
            setStatuses({})
            setUpdateError(null)
            load(forCwd || '')
          },
          close() { setOpen(false) },
        }
        return () => { skillsModalApi = null }
      }, [load])

      const toggle = async (skill) => {
        const next = !skill.disableModelInvocation
        setToggling((s) => new Set(s).add(skill.filePath))
        setSaveError(null)
        try {
          await api2('POST', '/toggle', { filePath: skill.filePath, disable: next })
          setSkills((prev) => prev.map((s) => s.filePath === skill.filePath ? Object.assign({}, s, { disableModelInvocation: next }) : s))
          if (next) setDormantOpen((cur) => Object.assign({}, cur, { [groupOf(skill)]: true }))
        } catch (e) { setSaveError(String(e && e.message ? e.message : e)) } finally {
          setToggling((s) => { const n = new Set(s); n.delete(skill.filePath); return n })
        }
      }

      const updateOne = async (skill) => {
        if (!skill.install) return
        const key = updateKey(skill)
        setUpdatingKey(key); setUpdateError(null)
        try {
          const d = await api2('POST', '/update', { cwd, package: skill.install.package, scope: skill.install.scope })
          await load(cwd)
          setStatuses((cur) => Object.assign({}, cur, { [key]: { state: 'up-to-date', currentVersion: d.versionHash, latestVersion: d.versionHash } }))
        } catch (e) { setUpdateError(String(e && e.message ? e.message : e)) } finally { setUpdatingKey(null) }
      }
      /* 检查只做远端版本比对，不重装；传 skill 则只查单个 */
      const checkForUpdates = async (skill) => {
        const targets = skill ? [skill] : skills.filter((s) => Boolean(s.install))
        const keys = targets.map(updateKey).filter(Boolean)
        if (!keys.length) return
        setUpdateError(null)
        setChecking((cur) => new Set([...cur, ...keys]))
        if (!skill) setCheckingAll(true)
        try {
          const d = await api2('POST', '/check', {
            cwd,
            package: skill && skill.install ? skill.install.package : undefined,
            scope: skill && skill.install ? skill.install.scope : undefined,
          })
          setStatuses((cur) => {
            const next = Object.assign({}, cur)
            for (const u of d.updates || []) next[u.scope + '\0' + u.package] = u
            return next
          })
        } catch (e) {
          setUpdateError(String(e && e.message ? e.message : e))
        } finally {
          setChecking((cur) => { const n = new Set(cur); for (const k of keys) n.delete(k); return n })
          if (!skill) setCheckingAll(false)
        }
      }
      const saveGlobalDir = async () => {
        const dir = pathDraft.trim()
        setPathEditing(false)
        if (!dir || dir === globalDir) return
        try {
          await api2('POST', '/prefs', { globalDir: dir })
          await load(cwd)
        } catch (e) { setError(String(e && e.message ? e.message : e)) }
      }

      if (!open) return null
      const selectedSkill = skills.find((s) => s.filePath === selected) || null
      const groups = []
      const defs = ['project / skills.sh', 'project', 'global / skills.sh', 'global']
      for (const label of defs) {
        const rows = skills.filter((s) => groupOf(s) === label)
        if (rows.length) groups.push({ label, rows })
      }
      const renderRow = (skill) => {
        const isSelected = !addMode && selected === skill.filePath
        const disabled = skill.disableModelInvocation
        return h('div', {
          key: skill.filePath,
          onClick: () => { setSelected(skill.filePath); setAddMode(false) },
          style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 8px', borderRadius: 5, cursor: 'pointer', background: isSelected ? V.selected : 'none' },
          onMouseEnter: (e) => { if (!isSelected) e.currentTarget.style.background = V.panel },
          onMouseLeave: (e) => { if (!isSelected) e.currentTarget.style.background = 'none' },
        },
          h('span', { style: { flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: disabled ? V.border : V.accent, boxShadow: disabled ? 'none' : '0 0 4px ' + V.accent, transition: 'background 0.15s, box-shadow 0.15s' } }),
          h('span', { style: { fontSize: 12, fontWeight: isSelected ? 600 : 400, color: disabled ? V.muted : V.text, fontFamily: MONO, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.name),
          /* 可更新标记：行尾橙色 ↑ */
          (() => {
            const key = updateKey(skill)
            const st = key ? statuses[key] : undefined
            if (!st || st.state !== 'update-available') return null
            return h('span', { title: '有可用更新', style: { color: V.warn, fontSize: 13, lineHeight: 1, flexShrink: 0 } }, '↑')
          })())
      }

      return h('div', {
        style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' },
        onClick: (e) => { if (e.target === e.currentTarget) setOpen(false) },
      },
        h('div', {
          style: { width: 860, maxWidth: 'calc(100vw - 16px)', height: '78vh', maxHeight: 'calc(100dvh - 16px)', background: V.bg, border: '1px solid ' + V.border, borderRadius: 10, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' },
        },
          /* Header */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 } },
              h('span', { style: { fontSize: 15, fontWeight: 700, color: V.text } }, '技能'),
              h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, shortenPath(cwd) || '—'),
              pathEditing
                ? h('input', {
                    value: pathDraft, autoFocus: true,
                    onChange: (e) => setPathDraft(e.target.value),
                    onBlur: saveGlobalDir,
                    onKeyDown: (e) => { if (e.key === 'Enter') saveGlobalDir(); if (e.key === 'Escape') setPathEditing(false) },
                    style: { fontSize: 11, fontFamily: MONO, padding: '2px 6px', border: '1px solid ' + V.accent, borderRadius: 4, background: V.bg, color: V.text, outline: 'none', width: 220 },
                  })
                : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: 'global 技能目录' }, shortenPath(globalDir) + '/'),
                    h('button', {
                      onClick: () => { setPathDraft(globalDir); setPathEditing(true) },
                      title: '编辑 global 技能目录',
                      style: { border: 'none', background: 'none', color: V.muted, cursor: 'pointer', padding: 2, display: 'inline-flex' },
                    }, h(PencilIcon)))),
            h('button', { onClick: () => setOpen(false), style: { background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' } }, '×')),
          /* Body */
          h('div', { style: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' } },
            h('div', { style: { width: 210, borderRight: '1px solid ' + V.border, display: 'flex', flexDirection: 'column', flexShrink: 0, background: V.panel } },
              h('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 6px' } },
                loading ? h('div', { style: { padding: '10px 8px', fontSize: 12, color: V.muted } }, '加载中…')
                  : error ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.error } }, error)
                  : skills.length === 0 ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.muted } }, '没有技能')
                  : groups.map((g) => {
                      const active = g.rows.filter((s) => !s.disableModelInvocation)
                      const dormant = g.rows.filter((s) => s.disableModelInvocation)
                      const dOpen = dormantOpen[g.label] || false
                      return h('div', { key: g.label, style: { marginBottom: 6 } },
                        h('div', { style: { padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em' } }, g.label),
                        active.map(renderRow),
                        dormant.length > 0 ? h('div', {
                          onClick: () => setDormantOpen((cur) => Object.assign({}, cur, { [g.label]: !dOpen })),
                          style: { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none' },
                        }, h('span', { style: { fontSize: 8 } }, dOpen ? '▾' : '▸'), '已停用 (' + dormant.length + ')') : null,
                        dOpen ? dormant.map(renderRow) : null)
                    })),
              h('div', { style: { padding: '8px 6px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
                h('div', {
                  onClick: () => setAddMode(true),
                  style: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 5, cursor: 'pointer', background: addMode ? V.selected : 'none', color: addMode ? V.accent : V.muted, fontSize: 12 },
                  onMouseEnter: (e) => { if (!addMode) e.currentTarget.style.background = V.selected },
                  onMouseLeave: (e) => { if (!addMode) e.currentTarget.style.background = 'none' },
                }, h(PlusIcon), '添加技能'))),
            h('div', { style: { flex: 1, overflowY: 'auto', padding: 20 } },
              addMode
                ? h(AddPanel, {
                    cwd,
                    globalDir,
                    installedPackages: {
                      global: new Set(skills.filter((s) => s.install && s.install.scope === 'global').map((s) => s.install.package)),
                      project: new Set(skills.filter((s) => s.install && s.install.scope === 'project').map((s) => s.install.package)),
                    },
                    onInstalled: () => load(cwd),
                  })
                : selectedSkill
                  ? h(Detail, {
                      skill: selectedSkill,
                      cwd,
                      toggling: toggling.has(selectedSkill.filePath),
                      saveError,
                      updateStatus: updateKey(selectedSkill) ? statuses[updateKey(selectedSkill)] : undefined,
                      checkingUpdate: updateKey(selectedSkill) ? checking.has(updateKey(selectedSkill)) : false,
                      updating: updatingKey === updateKey(selectedSkill),
                      updateError,
                      onToggle: toggle,
                      onCheckUpdate: () => checkForUpdates(selectedSkill),
                      onUpdate: () => updateOne(selectedSkill),
                    })
                  : h('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V.muted, fontSize: 13 } }, loading ? '' : '选择一个技能'))),
          /* Footer */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              skills.some((s) => s.install) ? h('button', {
                onClick: () => checkForUpdates(),
                disabled: checkingAll || updatingKey !== null,
                style: { padding: '6px 12px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: checkingAll || updatingKey !== null ? 'not-allowed' : 'pointer', opacity: checkingAll || updatingKey !== null ? 0.5 : 1, fontSize: 12 },
              }, checkingAll ? '检查中…' : '检查更新') : null,
              Object.values(statuses).filter((st) => st.state === 'update-available').length > 0
                ? h('span', { style: { fontSize: 12, color: V.warn } }, Object.values(statuses).filter((st) => st.state === 'update-available').length + ' 项更新')
                : null),
            h('button', { onClick: () => setOpen(false), style: { padding: '6px 14px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: 'pointer', fontSize: 13 } }, '关闭'))))
    }


    function applySkillsUI(ctx) {
      ctx.provide('dshSkillsUI')
      ctx.dshSkillsUI = {
        open(cwd) { skillsUI.open(cwd) },
        close() { skillsUI.close() },
      }
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-geek-sidebar-skills' }, () => h(SkillsModal, null))
      )
    }


    /* ============================ 模块出口 ============================ */
    exports.name = 'dsh-geek-sidebar'
    exports.inject = ['sessions', 'slots']
    exports.apply = function apply(ctx) {
      /* filemention 必须先于 workbench：后者经 fileMentionBridge 惰性取用
       *（ctx.get 在 fiber 启动态拿不到，见 head.js 桥注释） */
      try { applyFilemention(ctx) } catch (e) { console.error('[dsh-geek-sidebar] filemention 挂载失败', e) }
      try { applySkillsUI(ctx) } catch (e) { console.error('[dsh-geek-sidebar] skills 挂载失败', e) }
      try { workbenchMod.apply(ctx) } catch (e) { console.error('[dsh-geek-sidebar] workbench 挂载失败', e) }
    }

    return module.exports
  },
})
