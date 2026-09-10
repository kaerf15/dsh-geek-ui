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
const workbenchMod = (function (React, host) {
/* workbench feature 维护源码（可读版）：侧栏（工作区/会话/git worktree）、文件管理器（项目/笔记）、
 * 文件预览（大纲/编辑/聚焦重读/手动刷新）、底栏（技能/终端入口）、目录选择模态（DirPicker，
 * 15-dirpicker.js：项目/笔记/终端 三处路径选择共用，复刻 pi-web DirectoryPicker 交互）。
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
      const exIdx = s.files.findIndex((o) => o.path === e.path);
      if (exIdx >= 0) {
        const next = s.files.slice();
        next[exIdx] = Object.assign({}, next[exIdx], { modeHint: e.modeHint });
        s.files = next;
      } else {
        s.files = s.files.concat([e]);
      }
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
    /* 频道语义（评审修复：热路径扇出拆分——热路径事件走专属频道，
     * 避免把侧栏树/详情 markdown 等无关订阅者拖着重渲染）：
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
  /* 便签（quick notes）全局池 store：
   * open: 面板开闭；height: 吸底抽屉高度；selected: 当前选中的便签 name；
   * dir/custom: 当前目录与自定义标记；capture: 划选气泡总开关；
   * notes: 便签列表（null=未加载）；q: 搜索词；editing: 编辑中的便签（null/对象）；
   * confirm: 待确认删除的 name；kbPick: 待转存知识库的 name；toast: 提示消息。 */
  qnStore = createValueStore(
    {
      open: false,
      height: (() => {
        try {
          const w = typeof window !== "undefined" ? window : null;
          const v = w && w.localStorage ? Number(w.localStorage.getItem("pw-qn-height")) : 0;
          if (v >= 160 && v <= 2400) return v;
          if (w && w.innerHeight) return Math.max(200, Math.min(480, Math.round(w.innerHeight * 0.36)));
        } catch {}
        return 300;
      })(),
      selected: null,
      dir: '',
      custom: false,
      capture: true,
      notes: null,
      loading: false,
      q: '',
      folders: [],
      noteFolders: {},
      selectedFolder: null,
      showFolders: true,
      folderWidth: 160,
      toast: null,
    },
    (s, v) => {
      Object.assign(s, v);
    },
  );
function useNotes() {
  const t = React.useState(0);
  return (
    React.useEffect(() => bus.sub(() => t[1]((e) => e + 1)), []),
    { dirs: notesStore.dirs, current: notesStore.current }
  );
}
/* 路径字符串工具（分隔符兼容）：host 在 Windows 上回传反斜杠路径（C:\foo\bar），
 * client 只按字符串处理——两种分隔符都认，且保持路径自身的分隔符风格。 */
const baseName = (t) =>
  String(t || "")
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() || "";
/* 取父目录（字符串级）：'/a/b' → '/a'；'C:\a\b' → 'C:\a'；'/a' → '/'；'C:\a' → 'C:'。 */
function pathDir(t) {
  const s = String(t || "").replace(/[\\/]+$/, "");
  const m = s.match(/^(.*)[\\/][^\\/]+$/);
  if (!m) return "";
  return m[1] || (s.startsWith("/") ? "/" : m[1]);
}
/* t 是否等于 prefix 或是其子孙（两种分隔符都认）。 */
function pathHasPrefix(t, prefix) {
  return t === prefix || t.startsWith(prefix + "/") || t.startsWith(prefix + "\\");
}
/* 按基准路径自身的分隔符风格拼接（展示/相对解析用）。 */
function pathJoinFor(base, leaf) {
  const s = String(base || "");
  const sep = s.includes("\\") ? "\\" : "/";
  return s.replace(/[\\/]+$/, "") + sep + leaf;
}
function useFilesTab() {
  const t = React.useState(filesTabStore.tab);
  return (
    React.useEffect(() => bus.sub(() => t[1](filesTabStore.tab)), []),
    t[0]
  );
}
const pickNotesDir = () => {
    /* 1.19.11 起换应用内 DirPicker（复刻 pi-web，见 15-dirpicker.js），不再调 host 的
     * notesPick（osascript 原生对话框）；1.19.12 起落点走默认目录（桌面，星钮可自定）。
     * 选出路径后复用 notesSelect 落库，语义不变 */
    pickDir({ title: "选择知识库目录" })
      .then((t) => {
        t &&
          (selectNotesDir(t),
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
    .replace(/[\\/]+$/, "")
    .replace(/\\/g, "/")
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
/* 图片渲染走组件：失败态收进 React state（评审修复 N2）——原先 onError 直接
 * parentNode.insertBefore 往 React 托管容器塞外来节点，markdown 重建时占位 span
 * 无人回收、永久残留（图片修好了「加载失败」还在）。 */
function MdImg(props) {
  const [broken, setBroken] = React.useState(false);
  if (broken)
    return React.createElement(
      "span",
      { className: "pw-img-broken" },
      "图片加载失败：" + (props.alt || props.raw),
    );
  return React.createElement("img", {
    src: props.src,
    alt: props.alt,
    style: { maxWidth: "100%" },
    onClick: (g) => {
      (g.stopPropagation(), imgZoomStore.set(props.src));
    },
    onError: () => setBroken(true),
  });
}
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
        React.createElement(MdImg, {
          key: l++,
          src: mediaUrl(u[2], bd),
          alt: u[1],
          raw: u[2],
        }),
      );
    } else if (c.startsWith("[")) {
      const u = c.match(/\[([^\]]*)\]\(([^)]*)\)/);
      /* javascript:/vbscript: 协议拦截（评审修复 N3）：点击经 resolveLocalPath 已拦，
       * 但 href 会原样落 DOM——中键/新标签打开场景收一道口。 */
      const href = /^\s*(javascript|vbscript)\s*:/i.test(u[2]) ? "#" : u[2];
      e.push(
        React.createElement(
          "a",
          {
            key: l++,
            href: href,
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
    gitStatus = !l && t.gitFiles ? t.gitFiles[e.path] : null,
    containsGitChanges = l && t.gitDirs ? t.gitDirs.has(e.path) : false,
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
          className:
            "pw-tree-row" +
            (m ? " active" : "") +
            (t.dropTarget === e.path ? " drop-target" : "") +
            (t.dragSrc && t.dragSrc.path === e.path ? " dragging" : ""),
          style: { paddingLeft: 8 + s * 14 + "px" },
          draggable: true,
          onClick: () => t.onOpen(e),
          onDragStart: (g) => t.onDragStart && t.onDragStart(e, g),
          onDragEnd: (g) => t.onDragEnd && t.onDragEnd(g),
          onDragOver: (g) => t.onDragOver && t.onDragOver(e, g),
          onDragLeave: (g) => t.onDragLeave && t.onDragLeave(e, g),
          onDrop: (g) => t.onDrop && t.onDrop(e, g),
        },
        l
          ? a(
              "span",
              {
                className: "pw-tree-arrow" + (c ? " open" : ""),
              },
              a(
                "svg",
                {
                  width: 10,
                  height: 10,
                  viewBox: "0 0 10 10",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.8,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  style: {
                    transform: c ? "rotate(90deg)" : "none",
                    transition: "transform 0.12s ease",
                  },
                },
                a("polyline", { points: "3 2 7 5 3 8" }),
              ),
            )
          : a("span", { className: "pw-tree-spacer" }),
        a(
          "span",
          { className: "pw-tree-icon" },
          l ? FolderIcon(14, c) : fileIconEl(e.name, 14),
        ),
        a("span", { className: "pw-tree-name" }, e.name),
        r ? a("span", { className: "pw-tree-loading" }, "…") : null,
        gitStatus
          ? a(
              "span",
              {
                className: "pw-tree-git-badge",
                style: {
                  color:
                    gitStatus === "M"
                      ? "#d6a84b"
                      : gitStatus === "D"
                        ? "#f87171"
                        : "#4ade80",
                },
              },
              gitStatus,
            )
          : containsGitChanges
            ? a("span", { className: "pw-tree-git-dot", title: "包含变更文件" })
            : null,
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
    for (const g of u) {
      if (g.name === ".DS_Store") continue;
      if (t.onlyChanges) {
        const isD = g.type === "directory";
        const hasChange = isD
          ? t.gitDirs && t.gitDirs.has(g.path)
          : t.gitFiles && t.gitFiles[g.path];
        if (!hasChange) continue;
      }
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
          gitFiles: t.gitFiles,
          gitDirs: t.gitDirs,
          onlyChanges: t.onlyChanges,
          dragSrc: t.dragSrc,
          dropTarget: t.dropTarget,
          onDragStart: t.onDragStart,
          onDragEnd: t.onDragEnd,
          onDragOver: t.onDragOver,
          onDragLeave: t.onDragLeave,
          onDrop: t.onDrop,
        }),
      );
    }
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
/* 从 treeState 摘除 path 及其子孙（children + expanded 两张图同步清空）；onDel / doMoveEntry 共用消除重复。 */
function dropTreeSubtree(S, path) {
  const v = OA({}, S.children);
  delete v[path];
  for (const F of Object.keys(v)) pathHasPrefix(F, path) && F !== path && delete v[F];
  const X = OA({}, S.expanded);
  delete X[path];
  for (const F of Object.keys(X)) pathHasPrefix(F, path) && F !== path && delete X[F];
  return OA({}, S, { children: v, expanded: X });
}
function treeEntriesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path || a[i].type !== b[i].type || a[i].name !== b[i].name)
      return false;
  }
  return true;
}
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
function decodeGitPath(p) {
  if (!p) return "";
  let s = p;
  if (s.endsWith("/GENTS.md")) {
    s = s.slice(0, -9) + "/AGENTS.md";
  } else if (s === "GENTS.md") {
    s = "AGENTS.md";
  }
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  if (!s.includes("\\")) return s;
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 3 < s.length && /[0-7]{3}/.test(s.slice(i + 1, i + 4))) {
      bytes.push(parseInt(s.slice(i + 1, i + 4), 8));
      i += 3;
    } else if (s[i] === "\\" && i + 1 < s.length) {
      i++;
      const c = s[i];
      if (c === "n") bytes.push(10);
      else if (c === "t") bytes.push(9);
      else if (c === "r") bytes.push(13);
      else if (c === "\\") bytes.push(92);
      else if (c === '"') bytes.push(34);
      else bytes.push(c.charCodeAt(0));
    } else {
      const code = s.charCodeAt(i);
      if (code < 128) bytes.push(code);
      else {
        const enc = new TextEncoder().encode(s[i]);
        for (const b of enc) bytes.push(b);
      }
    }
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch (e) {
    return s;
  }
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
    fltOpenState = React.useState(!1),
    filterOpen = fltOpenState[0],
    setFilterOpen = fltOpenState[1],
    fltTextState = React.useState(""),
    filterText = fltTextState[0],
    setFilterText = fltTextState[1],
    gitSt = React.useState({ files: {}, changedDirs: new Set(), filesList: [], stats: { count: 0, additions: 0, deletions: 0 } }),
    gitInfo = gitSt[0],
    setGitInfo = gitSt[1],
    onlyChSt = React.useState(!1),
    onlyChanges = onlyChSt[0],
    setOnlyChanges = onlyChSt[1],
    dragSt = React.useState(null),
    dragSrc = dragSt[0],
    setDragSrc = dragSt[1],
    dropSt = React.useState(null),
    dropPath = dropSt[0],
    setDropPath = dropSt[1],
    fetchGit = (targetPath) => {
      if (!targetPath) return;
      host
        .call("workbench.gitStatus", { cwd: targetPath })
        .then((res) => {
          if (res && res.files) {
            const rawFiles = res.files || {};
            const healedFiles = {};
            for (const k of Object.keys(rawFiles)) {
              healedFiles[decodeGitPath(k)] = rawFiles[k];
            }
            const normRoot = (res.root || targetPath || "").replace(/\/+$/, "");
            const list = (res.filesList && res.filesList.length > 0)
              ? res.filesList.map((f) => ({
                  path: decodeGitPath(f.path),
                  rel: decodeGitPath(f.rel),
                  name: decodeGitPath(f.name),
                  status: f.status,
                }))
              : Object.keys(healedFiles).map((abs) => {
                  const rel = abs.startsWith(normRoot + "/") ? abs.slice(normRoot.length + 1) : abs;
                  const name = abs.slice(abs.lastIndexOf("/") + 1);
                  return {
                    path: abs,
                    rel: rel,
                    name: name,
                    status: healedFiles[abs],
                  };
                });
            setGitInfo({
              files: healedFiles,
              changedDirs: new Set((res.changedDirs || []).map(decodeGitPath)),
              filesList: list,
              stats: res.stats || { count: list.length, additions: 0, deletions: 0 },
            });
            /* 宿主进程未重启时的客户端自愈：异步累加未跟踪文本文件的行数对齐 pi-web */
            if (res.stats && !res.stats.untrackedIncluded) {
              const untracked = list.filter(
                (f) =>
                  f.status === "U" &&
                  !f.name.endsWith(".png") &&
                  !f.name.endsWith(".jpg") &&
                  !f.name.endsWith(".svg") &&
                  !f.name.endsWith(".zip") &&
                  !f.name.endsWith(".tar") &&
                  !f.name.endsWith(".gz"),
              );
              if (untracked.length > 0) {
                Promise.all(
                  untracked
                    .slice(0, 100)
                    .map((f) =>
                      host
                        .call("workbench.readFile", { path: f.path })
                        .catch(() => null),
                    ),
                ).then((results) => {
                  let extra = 0;
                  for (const r of results) {
                    if (r && r.kind === "text" && r.text) {
                      const lines = r.text.endsWith("\n")
                        ? r.text.slice(0, -1).split("\n").length
                        : r.text.split("\n").length;
                      extra += lines;
                    }
                  }
                  if (extra > 0) {
                    setGitInfo((prev) => ({
                      files: prev.files,
                      changedDirs: prev.changedDirs,
                      filesList: prev.filesList,
                      stats: OA({}, prev.stats, {
                        additions: (prev.stats ? prev.stats.additions : 0) + extra,
                        untrackedIncluded: !0,
                      }),
                    }));
                  }
                });
              }
            }
          }
        })
        .catch(() => {});
    },
    w = (i, N, silent) => {
      if (!silent) {
        k((S) => {
          if (!N && S.children[i]) return S;
          const v = OA({}, S.loading);
          return ((v[i] = !0), OA({}, S, { loading: v }));
        });
      }
      return host
        .call("workbench.listDir", { path: i })
        .then((S) => {
          k((v) => {
            const next = (S && S.entries) || [];
            if (silent && treeEntriesEqual(v.children[i], next) && !v.loading[i])
              return v;
            const F = OA({}, v.children),
              X = OA({}, v.loading);
            return (
              delete X[i],
              (F[i] = next),
              OA({}, v, { children: F, loading: X })
            );
          });
        })
        .catch(() => {
          /* 静默重拉失败保持原树：瞬时网络错误不能把已展开目录拆掉 */
          if (silent) return;
          k((S) => {
            const v = OA({}, S.loading);
            return (delete v[i], OA({}, S, { loading: v }));
          });
        });
    };
  React.useEffect(() => {
    l && (w(l), fetchGit(l));
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
        /* 0.1.5: 平台 details 栏与 layout.openDetails 已移除——store.open 更新预览态后
         * 由常驻 drawer（13-drawer）接管渲染，无需再通知布局层。 */
        (yieldToPreview(),
          store.open(t.sessionId, { path: i.path, name: i.name }));
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
  const listedDirs = () => {
    if (!l) return [];
    const dirs = [l];
    for (const v of Object.keys(m.expanded)) {
      if (m.expanded[v] && pathHasPrefix(v, l) && v !== l) dirs.push(v);
    }
    return dirs;
  };
  const B = () => {
      if (g) return;
      (C(!1), y(!0));
      k((v) => ({
        expanded: v.expanded,
        children: {},
        loading: {},
        rev: v.rev + 1,
      }));
      const N = listedDirs().map((v) => w(v, !0));
      const S = () => {
        (y(!1), flashDone(C), l && fetchGit(l));
      };
      /* Promise.all([]) 也会正常 resolve，无需对空数组再补一次（旧版 S 会跑两遍，评审 P3） */
      Promise.all(N).then(S, S);
    },
    /* 监视/焦点共用：原地重拉已列出目录，不拆空 children。busy 期间再来的事件记 pending，
     * 本轮结束后补一次，避免 stamp 被吃掉。手动刷新按钮仍走 B()（转圈+对勾）。 */
    treeSilent = () => {
      const i = treeAutoRef.current;
      if (i.busy) {
        i.pending = !0;
        return;
      }
      if (g || !c || !l || document.visibilityState !== "visible") return;
      ((i.busy = !0), (i.pending = !1));
      const F = listedDirs().map((v) => w(v, !0, !0));
      const X = () => {
        (i.busy = !1, l && fetchGit(l));
        if (i.pending && treeAutoRef.current.silent)
          treeAutoRef.current.silent();
      };
      Promise.all(F).then(X, X);
    },
    /* 切回窗口的兜底（FSEvents 偶发漏事件）。10s 节流；真正重拉交给 treeSilent。 */
    treeAuto = () => {
      const i = treeAutoRef.current;
      if (g || !c || !l || document.visibilityState !== "visible") return;
      const N = Date.now();
      if (N - i.at < 1e4) return;
      ((i.at = N), treeSilent());
    },
    onDel = (i) => {
      host
        .call("workbench.delete", { path: i.path })
        .then(() => {
          const dir = pathDir(i.path) || "/";
          (k((S) => dropTreeSubtree(S, i.path)),
            dir && w(dir, !0),
            l && fetchGit(l));
          const ab = store.bucket(t.sessionId);
          ab.active &&
            pathHasPrefix(ab.active, i.path) &&
            store.close(t.sessionId, ab.active);
        })
        .catch((N) => {
          console.error("[dsh-geek-sidebar] delete failed", N);
        });
    },
    /* 拖拽移动：文件/文件夹可拖入另一目录。目标仅限目录，且排除自身/自身子孙/当前父目录。 */
    canMoveEntry = (i, target) =>
      !!i &&
      !!target &&
      target.type === "directory" &&
      i.path !== target.path &&
      pathDir(i.path) !== target.path &&
      !(i.type === "directory" && pathHasPrefix(target.path, i.path)),
    moveStart = (i, ev) => {
      (setDragSrc(i), setDropPath(null));
      if (ev && ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = "move";
        try { ev.dataTransfer.setData("text/plain", i.path); } catch {}
      }
      if (ev) ev.stopPropagation();
    },
    moveEnd = () => {
      (setDragSrc(null), setDropPath(null));
    },
    moveOver = (i, ev) => {
      if (!canMoveEntry(dragSrc, i)) return;
      (ev.preventDefault(), ev.stopPropagation());
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      if (dropPath !== i.path) setDropPath(i.path);
    },
    moveLeave = (i, ev) => {
      const node = ev.currentTarget;
      const rel = ev.relatedTarget;
      if (rel && node && node.contains && node.contains(rel)) return;
      if (dropPath === i.path) setDropPath(null);
    },
    doMoveEntry = (src, target) => {
      host
        .call("workbench.move", { src: src.path, destDir: target.path })
        .then(() => {
          const srcDir = pathDir(src.path) || "/";
          k((S) => dropTreeSubtree(S, src.path));
          srcDir && w(srcDir, true);
          if (m.children[target.path]) w(target.path, true);
          l && fetchGit(l);
          const ab = store.bucket(t.sessionId);
          ab.active &&
            pathHasPrefix(ab.active, src.path) &&
            store.close(t.sessionId, ab.active);
        })
        .catch((err) => {
          console.error("[dsh-geek-sidebar] move failed", err);
        });
    },
    moveDrop = (i, ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const src = dragSrc;
      setDropPath(null);
      if (!canMoveEntry(src, i)) return;
      doMoveEntry(src, i);
    },
    _ = l ? m.children[l] : null,
    q = o
      ? e(
          "div",
          { className: "pw-nsel" },
          e(
            "button",
            { className: "pw-sel-btn", title: l || "选择知识库目录", onClick: () => D(!E) },
            e(
              "span",
              { className: "pw-mono" + (l ? " pw-tail" : " dim") },
              l ? "\u200e" + shortenPath(l) : "选择知识库目录…",
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
  /* treeAutoRef.fn/silent 每 render 重指最新闭包，focus 监听只注册一次 */
  const treeAutoRef = React.useRef({
    at: 0,
    busy: !1,
    pending: !1,
    fn: null,
    silent: null,
  });
  ((treeAutoRef.current.fn = treeAuto),
    (treeAutoRef.current.silent = treeSilent),
    React.useEffect(() => {
      const i = () => treeAutoRef.current.fn && treeAutoRef.current.fn();
      (window.addEventListener("focus", i),
        document.addEventListener("visibilitychange", i));
      return () => {
        (window.removeEventListener("focus", i),
          document.removeEventListener("visibilitychange", i));
      };
    }, []));
  const expandedKey = Object.keys(m.expanded)
    .filter((v) => m.expanded[v] && l && pathHasPrefix(v, l))
    .sort()
    .join("\n");
  /* 把当前根 + 已展开目录交给 host 监视。同步走 body（换目录不先卸再订，避免空窗）。
   * 卸监视只在收起/无根，以及组件卸载（空 deps effect）。 */
  React.useEffect(() => {
    if (!l || !c) {
      host.call("workbench.treeWatch", { dirs: [] }).catch(() => {});
      return;
    }
    host.call("workbench.treeWatch", { dirs: listedDirs() }).catch(() => {});
  }, [l, c, expandedKey]);
  React.useEffect(
    () => () => {
      host.call("workbench.treeWatch", { dirs: [] }).catch(() => {});
    },
    [],
  );
  /* stamp long-poll：目录内增删改后原地重拉。切走页面时不消耗 stamp（回来立即补）。 */
  React.useEffect(() => {
    if (!l || !c) return undefined;
    let cancelled = false;
    const stamp = { n: 0 };
    const tick = async () => {
      while (!cancelled) {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        try {
          const r = await host.call("workbench.treeWait", { since: stamp.n });
          if (cancelled) return;
          if (r && r.watching === false) return;
          if (r && typeof r.stamp === "number" && r.stamp > stamp.n) {
            if (typeof document !== "undefined" && document.visibilityState !== "visible")
              continue;
            stamp.n = r.stamp;
            treeAutoRef.current.silent && treeAutoRef.current.silent();
          }
        } catch (e) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [l, c]);
  const fileKeys = Object.keys(gitInfo.files || {});
  const normRoot = (l || "").replace(/\/+$/, "");
  const activeChangesList = (gitInfo.filesList && gitInfo.filesList.length > 0)
    ? gitInfo.filesList
    : fileKeys.map((abs) => {
        const cleanAbs = decodeGitPath(abs);
        const rel = cleanAbs.startsWith(normRoot + "/") ? cleanAbs.slice(normRoot.length + 1) : cleanAbs;
        const name = cleanAbs.slice(cleanAbs.lastIndexOf("/") + 1);
        return {
          path: cleanAbs,
          rel: rel,
          name: name,
          status: gitInfo.files[abs],
        };
      });
  const filteredChanges = filterText
    ? activeChangesList.filter((f) => f.rel.toLowerCase().includes(filterText.toLowerCase()))
    : activeChangesList;
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
          "知识库",
        ),
      ),
      e(
        "span",
        { className: "pw-files-actions" },
        l && Object.keys(gitInfo.files || {}).length > 0
          ? e(
              "button",
              {
                className: "pw-icon-btn" + (onlyChanges ? " on" : ""),
                title: onlyChanges ? "显示全部文件" : `仅显示变更文件 (${Object.keys(gitInfo.files).length})`,
                onClick: () => setOnlyChanges(!onlyChanges),
              },
              GitChangesIcon(13),
            )
          : null,
        l
          ? e(
              "button",
              {
                className: "pw-icon-btn" + (filterOpen ? " on" : ""),
                title: "过滤文件",
                onClick: () => {
                  setFilterOpen(!filterOpen);
                  if (filterOpen) setFilterText("");
                },
              },
              SearchIcon(13),
            )
          : null,
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
    c && filterOpen
      ? e(
          "div",
          { className: "pw-tree-search-wrap" },
          e("input", {
            className: "pw-tree-search-input",
            placeholder: "过滤当前目录文件…",
            value: filterText,
            autoFocus: true,
            onChange: (ev) => setFilterText(ev.target.value),
            onKeyDown: (ev) => {
              if (ev.key === "Escape") {
                setFilterOpen(false);
                setFilterText("");
              }
            },
          }),
          filterText
            ? e(
                "button",
                {
                  className: "pw-tree-search-clear",
                  onClick: () => setFilterText(""),
                },
                "×",
              )
            : null,
        )
      : null,
    c ? q : null,
    c
      ? e(
          "div",
          { className: "pw-files-body" },
          o && !l
            ? e("div", { className: "pw-hint" }, "从上方下拉选择或添加知识库目录")
            : l
              ? onlyChanges
                ? (activeChangesList && activeChangesList.length > 0)
                  ? e(
                      "div",
                      { className: "pw-git-changes-wrap" },
                      e(
                        "div",
                        { className: "pw-git-stats-bar" },
                        e(
                          "span",
                          { className: "pw-git-stats-count" },
                          filterText
                            ? `${filteredChanges.length} / ${activeChangesList.length} 个文件`
                            : `${activeChangesList.length} 个文件`,
                        ),
                        gitInfo.stats && gitInfo.stats.additions > 0
                          ? e(
                              "span",
                              { className: "pw-git-stats-add" },
                              `+${gitInfo.stats.additions}`,
                            )
                          : null,
                        gitInfo.stats && gitInfo.stats.deletions > 0
                          ? e(
                              "span",
                              { className: "pw-git-stats-del" },
                              `-${gitInfo.stats.deletions}`,
                            )
                          : null,
                      ),
                      filteredChanges.length > 0
                        ? filteredChanges.map((f) =>
                            e(
                              "div",
                              {
                                key: f.path,
                                className:
                                  "pw-change-row" +
                                  (store.bucket(t.sessionId).active === f.path
                                    ? " active"
                                    : ""),
                                title: f.path,
                                onClick: () => {
                                  yieldToPreview();
                                  store.open(t.sessionId, {
                                    path: f.path,
                                    name: f.name,
                                    modeHint: "diff",
                                  });
                                },
                              },
                              e(
                                "span",
                                {
                                  className: "pw-change-badge",
                                  style: {
                                    color:
                                      f.status === "M"
                                        ? "#d6a84b"
                                        : f.status === "D"
                                          ? "#f87171"
                                          : "#4ade80",
                                  },
                                },
                                f.status === "A" ? "+" : f.status,
                              ),
                              e(
                                "span",
                                { className: "pw-tree-icon" },
                                fileIconEl(f.name, 14),
                              ),
                              e("span", { className: "pw-change-rel" }, f.rel),
                            ),
                          )
                        : e(
                            "div",
                            { className: "pw-hint", style: { padding: "8px 12px" } },
                            "无匹配文件",
                          ),
                    )
                  : e(
                      "div",
                      { className: "pw-hint", style: { padding: "12px 16px" } },
                      "无变更文件",
                    )
              : _
                  ? _.filter((i) => {
                      if (i.name === ".DS_Store") return false;
                      if (!filterText) return true;
                      return i.name.toLowerCase().includes(filterText.toLowerCase());
                    }).map((i) =>
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
                        gitFiles: gitInfo.files,
                        gitDirs: gitInfo.changedDirs,
                        onlyChanges: false,
                        dragSrc: dragSrc,
                        dropTarget: dropPath,
                        onDragStart: moveStart,
                        onDragEnd: moveEnd,
                        onDragOver: moveOver,
                        onDragLeave: moveLeave,
                        onDrop: moveDrop,
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
  /* 重渲染由这条 bus 订阅一肩挑（面板开态走 bus） */
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
        e(
          "button",
          {
            className: "pw-foot-btn" + (qnStore.open ? " on" : ""),
            title: "便签：全局随手记，划选可一键存档/引用到对话",
            onClick: () => qnStore.set({ open: !qnStore.open }),
          },
          e("span", { className: "pw-foot-ic" }, NotebookIcon(12)),
          "便签",
        ),
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
function FolderIcon(t, open) {
  const e = t || 14;
  return React.createElement(
    "svg",
    {
      width: e,
      height: e,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.25,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { verticalAlign: "middle", flexShrink: 0 },
    },
    React.createElement("path", {
      d: open
        ? "m1.87 8 .7-2.74a1 1 0 01.96-.76h10.94a1 1 0 01.97 1.24l-1.75 7a1 1 0 01-.97.76H2A1.5 1.5 0 01.5 12V3.5a1 1 0 011-1h5a1 1 0 011 1v1"
        : "M4.5 4.5H12c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H2A1.5 1.5 0 01.5 12V3.5a1 1 0 011-1h5a1 1 0 011 1v1",
    }),
  );
}
function SearchIcon(t) {
  return ic(
    [
      ["c", 11, 11, 7],
      ["l", 21, 21, 16.65, 16.65],
    ],
    t,
  );
}
function PlusIcon(t) {
  return ic(
    [
      ["l", 12, 5, 12, 19],
      ["l", 5, 12, 19, 12],
    ],
    t,
  );
}
function GitChangesIcon(t) {
  const e = t || 13;
  return React.createElement(
    "svg",
    {
      width: e,
      height: e,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { verticalAlign: "middle", flexShrink: 0 },
    },
    React.createElement("circle", { cx: 12, cy: 12, r: 3 }),
    React.createElement("path", { d: "M3 12h6" }),
    React.createElement("path", { d: "M15 12h6" }),
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
/* 当前会话 cwd（chat 文件点击接管反解相对路径用）；09-sidebar 的会话订阅效应同步写 */
const sessionCwd = { sid: null, cwd: null };
/* @提及引用块（ReferenceInsert，原生 chip 路径）：与输入框原生 @ 菜单一致——把选中文件
 * 插成整体 chip，退格一次整块删除。ref/clipboardText 用原生 formatFileMention 同款引号规则
 *（含空格路径 `@"..."`；目录保持开引号以续补）。相对路径逻辑与旧 mentionPath 一致：
 * 位于当前项目根下时取相对路径，否则取绝对路径；opts.abs 强制绝对路径（知识库分栏用）。 */
function mentionRef(t, e, opts) {
  const abs = !!(opts && opts.abs);
  let shown = t;
  if (!abs) {
    const s = currentRootPath;
    if (s && t !== s && pathHasPrefix(t, s)) shown = t.slice(s.length + 1);
  }
  const dir = e === true;
  const at = dir ? shown + "/" : shown;
  const q = /\s/u.test(at);
  const mention = q ? (dir ? '@"' + at : '@"' + at + '"') : "@" + at;
  return {
    source: "reference",
    ref: mention,
    label: baseName(t) + (dir ? "/" : ""),
    appearance: dir ? "folder" : "file",
    clipboardText: mention,
  };
}
/* 评审修复：两击确认状态机——原 03 树删除 / 08 归档 / 09 worktree 等
 * 多处各抄一份 useState。返回 [armedId, ask(id), cancel()]；布尔场景用常量 id（如 1）。
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
function fileIconEl(name, size) {
  const sz = size || 14;
  const n = String(name || "").toLowerCase();
  const ext = n.split(".").pop() || "";
  const el = React.createElement;
  const svgWrap = (paths, strokeWidth) =>
    el(
      "svg",
      {
        width: sz,
        height: sz,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: strokeWidth || 1.25,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { verticalAlign: "middle", flexShrink: 0 },
      },
      paths,
    );

  if (n === "dockerfile" || n.startsWith("dockerfile.")) {
    return svgWrap([
      el("path", { key: 1, d: "M.5 8.5H11l.75-.5a5.35 5.35 0 010-3.5c1 .6 1 1.88 1.74 2 .77-.09 1.23.01 2 .52 0 0-.97 1.77-2.5 1.98-1.93 3.65-4.5 5.5-6.98 5.5C0 14.5.5 8.5.5 8.5m1 0v-2m0 0h8m-6 2v-4m0 0h4m-2-2h2m-2 6v-6m2 6v-6m2 6v-2" }),
    ]);
  }
  if (n === ".gitignore" || n === ".gitmodules" || n === ".gitattributes") {
    return svgWrap([
      el("path", { key: 1, d: "M8.5 10.5a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m0-6a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m3 3a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m-4-2v4m-1-6-1-1m4 4-1-1" }),
      el("path", { key: 2, d: "m9.06 1.06 5.88 5.88a1.5 1.5 0 010 2.12l-5.88 5.88a1.5 1.5 0 01-2.12 0L1.06 9.06a1.5 1.5 0 010-2.12l5.88-5.88a1.5 1.5 0 012.12 0" }),
    ]);
  }
  if (n === "package-lock.json") {
    return svgWrap([
      el("path", { key: 1, d: "M15 11.5c.27 0 .5.22.5.5v3a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-3c0-.28.22-.5.5-.5zm-4 0V10a1.5 1.5 0 013 0v1.5" }),
      el("path", { key: 2, d: "M9.5 9V5.5h-2v6h-4v-8h8v3" }),
      el("path", { key: 3, d: "M7.54 13.5H3A1.5 1.5 0 011.5 12V3c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5v3.5" }),
    ]);
  }
  if (n === "bun.lock" || n === "yarn.lock" || n === "pnpm-lock.yaml" || n === "cargo.lock" || ext === "lock") {
    return svgWrap([
      el("path", { key: 1, d: "m12.36 7.104c0.4817 0 0.8722 0.3903 0.8722 0.8717v5.23c0 0.4814-0.3905 0.8717-0.8722 0.8717h-8.721c-0.4817 0-0.8722-0.3903-0.8722-0.8717v-5.23c0-0.4814 0.3905-0.8717 0.8722-0.8717zm-6.977 0v-2.616c0-1.445 1.172-2.616 2.617-2.616 1.445 0 2.617 1.171 2.617 2.616v2.616" }),
    ]);
  }
  if (n.endsWith(".config.ts") || n.endsWith(".config.js") || n.endsWith(".config.mjs") || n.endsWith(".config.cjs")) {
    return svgWrap([
      el("path", { key: 1, d: "m7.997 9.694a1.726 1.695 0 1 0 0-3.39 1.726 1.695 0 0 0 0 3.39m3.021-6.78 3.021 5.085-3.021 5.085h-6.042l-3.021-5.085 3.021-5.085z" }),
    ]);
  }
  if (n === ".env" || n.startsWith(".env.")) {
    return svgWrap([
      el("path", { key: 1, d: "M5.5 8.5V12m0-6.5V4m0 4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3m5 3.5v-1.5m0-3V4m0 6.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3M4 1.5h8A2.5 2.5 0 0114.5 4v8a2.5 2.5 0 01-2.5 2.5H4A2.5 2.5 0 011.5 12V4A2.5 2.5 0 014 1.5" }),
    ]);
  }
  if (ext === "ts" || ext === "tsx") {
    return svgWrap([
      el("path", { key: 1, d: "M4 1.5h8A2.5 2.5 0 0114.5 4v8a2.5 2.5 0 01-2.5 2.5H4A2.5 2.5 0 011.5 12V4A2.5 2.5 0 014 1.5" }),
      el("path", { key: 2, d: "M12.5 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25S10.04 10 10.7 10h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25m-3-3.75v5M5 7.5h3" }),
    ]);
  }
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") {
    return svgWrap([
      el("path", { key: 1, d: "m 4,1.5 h 8 c 1.385,0 2.5,1.115 2.5,2.5 v 8 c 0,1.385 -1.115,2.5 -2.5,2.5 H 4 C 2.615,14.5 1.5,13.385 1.5,12 V 4 C 1.5,2.615 2.615,1.5 4,1.5 Z" }),
      el("path", { key: 2, d: "M4.5 11c0 .828.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V7.5M12.5 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25s.54 1.25 1.2 1.25h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25" }),
    ]);
  }
  if (ext === "md" || ext === "mdx" || ext === "markdown") {
    return svgWrap([
      el("path", { key: 1, d: "m9.25 8.25 2.25 2.25 2.25-2.25M3.5 11V5.5l2.04 3 1.96-3V11m4-.5V5M1.65 2.5h12.7c.59 0 1.15.49 1.15 1v9c0 .51-.56 1-1.15 1H1.65c-.59 0-1.15-.49-1.15-1V3.58c0-.5.56-1.08 1.15-1.08" }),
    ]);
  }
  if (ext === "py") {
    return svgWrap([
      el("path", { key: 1, d: "M8.5 5.5h-3m6 0V3c0-.8-.7-1.5-1.5-1.5H7c-.8 0-1.5.7-1.5 1.5v2.5H3c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.48 1.5" }),
      el("path", { key: 2, d: "M10.5 10.5h-3m-3 0V13c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5v-2.5H13c.8 0 1.5-.7 1.5-1.5V7c0-.8-.7-1.5-1.48-1.5H11.5c0 1.5 0 2-1 2h-2" }),
    ]);
  }
  if (ext === "json" || ext === "jsonl") {
    return svgWrap([
      el("path", { key: 1, d: "M4.5 2.5H4c-.75 0-1.5.75-1.5 1.5v2c0 1.1-1 2-1.83 2 .83 0 1.83.9 1.83 2v2c0 .75.75 1.5 1.5 1.5h.5m7-11h.5c.75 0 1.5.75 1.5 1.5v2c0 1.1 1 2 1.83 2-.83 0-1.83.9-1.83 2v2c0 .74-.75 1.5-1.5 1.5h-.5m-6.5-3a.5.5 0 100-1 .5.5 0 000 1m3 0a.5.5 0 100-1 .5.5 0 000 1m3 0a.5.5 0 100-1 .5.5 0 000 1" }),
    ]);
  }
  if (ext === "yaml" || ext === "yml") {
    return svgWrap([
      el("path", { key: 1, d: "M2.5 1.5h3l3 4 3-4h3l-9 13h-3L7 8z" }),
    ]);
  }
  if (ext === "toml") {
    return svgWrap([
      el("path", { key: 1, d: "M3.5 1.5h-2v13h2m9-13h2v13h-2m-8-11h7v3h-2v6h-3v-6h-2z" }),
    ]);
  }
  if (ext === "css" || ext === "less") {
    return svgWrap([
      el("path", { key: 1, d: "m4 1.5h8c1.38 0 2.5 1.12 2.5 2.5v8c0 1.38-1.12 2.5-2.5 2.5h-8c-1.38 0-2.5-1.12-2.5-2.5v-8c0-1.38 1.12-2.5 2.5-2.5z" }),
      el("path", { key: 2, d: "M5 5.5h6M5 8h5.5l-.5 3-2 1-2-1-.2-1.5" }),
    ]);
  }
  if (ext === "scss" || ext === "sass") {
    return svgWrap([
      el("path", { key: 1, d: "M14.5 9c-.5 3-3.5 4.5-6.5 4.5S2 12 2 9.5c0-3 3-4 6-4.5s4-.5 4-2c0-1-1-1.5-2-1.5S7.5 2 7.5 3" }),
    ]);
  }
  if (ext === "html" || ext === "htm" || ext === "vue") {
    return svgWrap([
      el("path", { key: 1, d: "M1.5 1.5h13L13 13l-5 2-5-2z" }),
      el("path", { key: 2, d: "M11 4.5H5l.25 3h5.5l-.25 3-2.5 1-2.5-1-.08-1" }),
    ]);
  }
  if (ext === "rs") {
    return svgWrap([
      el("path", { key: 1, d: "M15.5 9.5Q8 13.505.5 9.5l1-1-1-2 2-.5V4.5h2l.5-2 1.5 1 1.5-2 1.5 2 1.5-1 .5 2h2V6l2 .5-1 2z" }),
      el("path", { key: 2, d: "M6.5 7.5a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m5 0a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1M4 11.02c-.67.37-1.5.98-1.5 2.23s1.22 1.22 2 1.25v-2M12 11c.67.37 1.5 1 1.5 2.25s-1.22 1.22-2 1.25v-2" }),
    ]);
  }
  if (ext === "go") {
    return svgWrap([
      el("path", { key: 1, d: "m15.48 8.06-4.85.48m4.85-.48a4.98 4.98 0 01-4.54 5.42 5 5 0 112.95-8.66l-1.7 1.84a2.5 2.5 0 00-4.18 2.06c.05.57.3 1.1.69 1.51.25.27 1 .83 1.78.82.8-.02 1.58-.25 2.07-.81 0 0 .8-.96.68-1.88M2.5 8.5l-2 .01m1.5 2h1.5m-2-3.99 2-.02" }),
    ]);
  }
  if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "fish") {
    return svgWrap([
      el("path", { key: 1, d: "M2 15.5c-.7 0-1.5-.8-1.5-1.5V5c0-.7.8-1.5 1.5-1.5h9c.7 0 1.5.8 1.5 1.5v9c0 .7-.8 1.5-1.5 1.5z" }),
      el("path", { key: 2, d: "m1.2 3.8 3.04-2.5S5.17.5 5.7.5h8.4c.66 0 1.4.73 1.4 1.4v7.73a2.7 2.7 0 01-.7 1.75l-2.68 3.51" }),
      el("path", { key: 3, d: "M6 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25S3.54 10 4.2 10h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25M4.5 6.5v1m0 5v1" }),
    ]);
  }
  if (ext === "sql" || ext === "db" || ext === "sqlite") {
    return svgWrap([
      el("path", { key: 1, d: "M8 6.5c3.59 0 6.5-1.4 6.5-2.68S11.59 1.5 8 1.5 1.5 2.54 1.5 3.82 4.41 6.5 8 6.5M14.5 8c0 .83-1.24 1.79-3.25 2.2s-4.49.41-6.5 0S1.5 8.83 1.5 8m13 4.18c0 .83-1.24 1.6-3.25 2-2.01.42-4.49.42-6.5 0-2.01-.4-3.25-1.17-3.25-2m0-8.3v8.3m13-8.3v8.3" }),
    ]);
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].indexOf(ext) >= 0) {
    return svgWrap([
      el("rect", { key: 1, x: 2, y: 2, width: 12, height: 12, rx: 2 }),
      el("circle", { key: 2, cx: 5.5, cy: 5.5, r: 1.5 }),
      el("path", { key: 3, d: "M14 10l-3.5-3.5L3 14" }),
    ]);
  }
  if (ext === "pdf") {
    return svgWrap([
      el("path", { key: 1, d: "M3.5 1.5h6l4 4v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z" }),
      el("path", { key: 2, d: "M9.5 1.5v4h4M5 11h2a1 1 0 0 0 0-2H5v4" }),
    ]);
  }
  /* Default / LICENSE / plain text: Catppuccin folded corner _file */
  return svgWrap([
    el("path", { key: 1, d: "M13.5 6.5v6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h4.01m-.01 0 5 5h-4a1 1 0 0 1-1-1z" }),
  ]);
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
    cpSt = React.useState(!1),
    cp = cpSt[0],
    setCp = cpSt[1],
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
    },
    /* 复制会话所在文件夹的绝对路径（host 按 dsh 会话持久化布局计算
     * <DSH_HOME>/sessions/<projectKey>/<session-id>/）；升 transient “已复制”态。 */
    z = (w) => {
      w.stopPropagation();
      if (cp) return;
      host
        .call("workbench.sessionPath", { id: o, cwd: s.cwd })
        .then((res) => {
          const text = res && res.ok && res.path ? res.path : null;
          if (!text) return;
          const done = () => {
            setCp(!0), setTimeout(() => setCp(!1), 1200);
          };
          navigator.clipboard
            ? navigator.clipboard.writeText(text).then(done, done)
            : done();
        })
        .catch(() => {});
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
              s.completed && !s.pendingInteraction
                ? e("span", { className: "pw-dot-done" }, "●")
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
                className: "pw-act-btn",
                title: cp ? "已复制" : "复制会话绝对路径",
                onClick: z,
              },
              cp ? CheckIcon(13) : CopyIcon(13),
            ),
            e(
              "button",
              { className: "pw-act-btn", title: "归档会话", onClick: E },
              ArchiveIcon(13),
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
          ),
        );
}
function Sidebar(t) {
  const e = React.createElement,
    s = t.layout,
    o = t.sessionsSvc,
    a = t.workspacesSvc,
    nav = t.workspaceNav,
    l = useView(),
    c = useNotes(),
    u = useFilesTab(),
    r = t.useSessions((n) => n.ids),
    m = t.useSessions((n) => n.byId),
    k = t.useSessions((n) => n.current),
    h = t.useWorkspaces((n) => n.items),
    g = t.useWorkspaces((n) => n.recentWorkspaceId),
    y = t.useWorkspaces((n) => n.archivedSessionIds),
    x = React.useState(() => {
      const cur = k && m && m[k] && m[k].cwd;
      if (cur) return cur;
      const n = (h || []).find((f) => f.workspaceId === g) || (h || [])[0];
      return (n && n.path) || null;
    }),
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
  /* 焦点自动刷 git 元数据（分支徽标/worktree 列表，平时走 host gitCache，外部 checkout /
   * worktree add 后会过期）：切回页面静默强刷，节流 10s；fn 每 render 重指避免旧闭包。
   * 原顶部手动刷新按钮随此删除（会话列表本就走 useSessions 响应式订阅，无需手刷）。 */
  const gitAuto = React.useRef({ at: 0, busy: !1, fn: null }),
    ye = {};
  for (const n of y || []) ye[n] = !0;
  const Y = (r || []).filter((n) => {
      const f = m[n];
      return f && !ye[n] && f.origin !== "subagent";
    }),
    Z = k ? m[k] : void 0,
    Se = React.useRef(null),
    lastSynced = React.useRef({ sid: null, cwd: null });
  React.useEffect(() => {
    /* 会话工作目录同步保护：
     * 1. 当处于有效会话且该会话有 cwd 时：若会话变更 (k 变化) 或该会话 cwd 异步到齐，严格同步为当前会话所在目录；
     *    利用 lastSynced 记录已同步状态，避免用户手动在下拉菜单切目录时被微任务中的旧 cwd 抢占回弹；
     * 2. 只有在平台确实没有任何活跃会话且 p 尚未初始化时，才安全回退到最近或首个工作区，绝不产生竞态覆盖。 */
    const curCwd = Z && Z.cwd;
    if (curCwd) {
      if (lastSynced.current.sid !== k || lastSynced.current.cwd !== curCwd) {
        lastSynced.current = { sid: k, cwd: curCwd };
        C(curCwd);
      }
    } else if (!p) {
      const n = (h || []).find((f) => f.workspaceId === g) || (h || [])[0];
      if (n && n.path) C(n.path);
    }
    const n = Se.current;
    if (((Se.current = k || null), n && n !== k && a)) {
      const f = m[n];
      f && f.blank === !0 && a.archiveSession(n).catch(() => {});
    }
  }, [k, Z && Z.cwd, h, g]);
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
      /* chat 文件点击接管的 cwd 跟踪（15-deliv）：sid/cwd 同源同拍，消费方比对 sid；
       * m 入 deps——byId 行补齐（cwd 字段晚到）也重同步 */
      const row = k ? m[k] : null;
      sessionCwd.sid = k || null;
      sessionCwd.cwd = (row && row.cwd) || null;
    }, [k, m]));
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
  ((gitAuto.current.fn = () => {
      const n = gitAuto.current;
      if (n.busy || document.visibilityState !== "visible") return;
      const f = Date.now();
      if (f - n.at < 1e4) return;
      ((n.at = f), (n.busy = !0));
      const d = () => {
        n.busy = !1;
      };
      Promise.all([oe(!0), ce(p, !0)]).then(d, d);
    }),
    React.useEffect(() => {
      const n = () => gitAuto.current.fn && gitAuto.current.fn();
      (window.addEventListener("focus", n),
        document.addEventListener("visibilitychange", n));
      return () => {
        (window.removeEventListener("focus", n),
          document.removeEventListener("visibilitychange", n));
      };
    }, []));
  const $ = {};
  for (const n of Y) {
    const f = m[n],
      d = ee(f.cwd);
    if (!d) continue;
    $[d] || ($[d] = { root: d, latest: 0, running: 0, pending: 0, done: 0 });
    const W = $[d];
    ((f.updatedAt || 0) > W.latest && (W.latest = f.updatedAt || 0),
      f.running && W.running++,
      f.pendingInteraction && W.pending++,
      f.completed && W.done++);
  }
  (rememberRoot(M),
    M && !$[M] && ($[M] = { root: M, latest: 0, running: 0, pending: 0, done: 0 }));
  for (const n of recentRoots)
    $[n] || ($[n] = { root: n, latest: 0, running: 0, pending: 0, done: 0 });
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
    oDone = oWs.reduce((n, f) => n + f.done, 0),
    aDone = te.reduce((n, f) => n + f.done, 0),
    cDone = aDone - oDone,
    Re = Y.filter((n) => !m[n].blank && (!M || ee(m[n].cwd) === M)).sort(
      (n, f) => (m[f].updatedAt || 0) - (m[n].updatedAt || 0),
    ),
    J = !!(b && b.isGit && b.isTopLevel && b.forPath === p),
    G =
      (J &&
        (b.worktrees.find((n) => n.path === b.currentWorktreePath) ||
          b.worktrees.find((n) => n.isMain))) ||
      null,
    we = (n) => {
      if (!n) return null;
      const f = ee(n) || n,
        d = canonPath(f);
      /* 1.20.2：两遍匹配——ee() 会把 worktree 路径解析回主仓库根，单轮循环里
       * 主根查询可能先命中排在前面的 worktree 工作区，会话被开进 worktree 目录。
       * 精确/规范化路径必须优先，根级模糊匹配只作兜底。 */
      for (const W of h || [])
        if (W && W.path && (W.path === n || W.path === f || canonPath(W.path) === d))
          return W;
      for (const W of h || [])
        if (W && W.path && canonPath(ee(W.path)) === d) return W;
      return null;
    },
    _e = (n) => {
      if (!n || !nav) return;
      const f = we(n);
      if (f) {
        nav.startSession(f.workspaceId);
        return;
      }
      if (!a) return;
      const d = ee(n) || n;
      a.create({ path: d })
        .then((W) => nav.startSession(W.workspaceId))
        .catch(() => {});
    },
    Ve = () => {
      /* 1.19.11 起换应用内 DirPicker（见 15-dirpicker.js），不再依赖 native capability
       * 的 svc.pickDirectory()；先收项目下拉再开模态。落点走默认目录（1.19.12：桌面，
       * 星钮可自定），不再以当前项目为初始路径。
       * 评审修复（保留语义）：新目录经 _e 连接并打开其会话——直接 connect 会丢弃返回 id，
       * 用户切到无会话的新目录后对话区仍停留在旧目录的会话 */
      (D(!1),
        pickDir({ title: "选择项目目录" })
          .then((n) => {
            if (!n) return;
            (C(n), _e(n));
          })
          .catch(() => {}));
    },
    xe = (n) => {
      /* 1.20.2：跳过 blank 会话——「＋ 新建」留下的空会话 updatedAt 必然最新，
       * 不跳过则每次切项目都落进空会话，表现为「路径切了、会话没切过去」；
       * 真想要空会话时 _e 兜底的 connectWorkspace 会复用项目里的 blank，不会重复建。 */
      const f = Y.filter((d) => !m[d].blank && n(d)).sort(
        (d, W) => (m[W].updatedAt || 0) - (m[d].updatedAt || 0),
      )[0];
      /* 评审修复：返回是否命中，无匹配会话时调用方落到 _e 连接目标工作区 */
      if (!f || !o) return false;
      o.open(f);
      return true;
    },
    $e = (n) => {
      (C(n), D(!1), z(""));
      /* 评审修复：切到无会话的项目兜底连接其工作区（对齐“新建”），否则对话区停留旧会话 */
      xe((f) => ee(m[f].cwd) === n) || _e(n);
    },
    Ge = (n) => {
      (C(n), _(!1), V(""), N(""), F(!1));
      /* 评审修复：见 $e——worktree 无会话同样兜底连接 */
      xe((f) => m[f].cwd === n) || _e(n);
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
        je.map((n) => {
          const isCur = canonPath(n.root) === canonPath(M);
          return dropRowEl({
            k: n.root,
            cur: isCur,
            title: n.root,
            onClick: () => $e(n.root),
            label: shortenPath(n.root),
            /* 活动徽标经 extra 注入；当前项目不重复显示（其会话已平铺在下方列表） */
            extra: isCur
              ? null
              : [
                  n.running > 0
                    ? e("span", { key: "r", className: "pw-act run" }, "● " + n.running)
                    : null,
                  n.pending > 0
                    ? e("span", { key: "w", className: "pw-act warn" }, "● " + n.pending)
                    : null,
                  n.done > 0
                    ? e("span", { key: "d", className: "pw-act done" }, "● " + n.done)
                    : null,
                ],
          });
        }),
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
        open: pe,
        onToggle: ke,
        sessionId: k,
        onMention:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  mentionRef(n.path, n.type === "directory"),
                )
            : void 0,
        onMentionAbs:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  mentionRef(n.path, n.type === "directory", { abs: true }),
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
          oRun + oPend + oDone > 0
            ? e(
                "span",
                {
                  className: "pw-act-badge",
                  title:
                    "其他项目：进行中 " +
                    oRun +
                    " · 待交互 " +
                    oPend +
                    " · 已完成未看 " +
                    oDone +
                    "（当前项目：进行中 " +
                    cRun +
                    " · 待交互 " +
                    cPend +
                    " · 已完成未看 " +
                    cDone +
                    "）",
                },
                oRun > 0
                  ? e("span", { className: "pw-act run" }, "● " + oRun)
                  : null,
                oPend > 0
                  ? e("span", { className: "pw-act warn" }, "● " + oPend)
                  : null,
                oDone > 0
                  ? e("span", { className: "pw-act done" }, "● " + oDone)
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
 * details 槽的仲裁层：文件预览是默认驱动，其余面板（第三方）经
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
      if (ev.key !== "Escape") return;
      /* 吃掉 Esc，避免外层（预览缩放 / 便签下栏）同一键一起关 */
      ev.stopPropagation();
      imgZoomStore.set(null);
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

function parseGitDiff(diffText) {
  if (!diffText) return [];
  const rawLines = diffText.split("\n");
  const parsed = [];
  let oldLine = 0;
  let newLine = 0;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx];
    if (
      raw.startsWith("diff --git") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw.startsWith("\\")
    ) {
      continue;
    }
    const hunkMatch = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      continue;
    }
    if (raw.startsWith("+")) {
      parsed.push({
        type: "add",
        lineNo: newLine++,
        prefix: "+",
        text: raw.slice(1),
      });
    } else if (raw.startsWith("-")) {
      parsed.push({
        type: "del",
        lineNo: oldLine++,
        prefix: "-",
        text: raw.slice(1),
      });
    } else {
      parsed.push({
        type: "ctx",
        lineNo: newLine++,
        prefix: " ",
        text: raw.startsWith(" ") ? raw.slice(1) : raw,
      });
      oldLine++;
    }
  }
  return parsed;
}

function Details(t) {
  const e = React.createElement,
    s = t.layout,
    a = React.useState(0)[1];
  React.useEffect(() => sessionProbe.sub(() => a((i) => i + 1)), []);
  const sidRef = React.useRef(sessionProbe.sid);
  React.useEffect(() => {
    if (sidRef.current !== sessionProbe.sid) {
      /* 切会话平台会关 details 列（AppFrame 私有面），缩放态跟着退，别让 fixed 面板悬空 */
      ((sidRef.current = sessionProbe.sid), setZoomed(!1), a((i) => i + 1));
    }
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
  const zm = React.useState(!1),
    zoomed = zm[0],
    setZoomed = zm[1],
    rootRef = React.useRef(null),
    diffSt = React.useState(""),
    diffText = diffSt[0],
    setDiffText = diffSt[1],
    diffLdSt = React.useState(!1),
    diffLoading = diffLdSt[0],
    setDiffLoading = diffLdSt[1],
    diffParsed = React.useMemo(() => parseGitDiff(diffText), [diffText]),
    loadDiff = (targetPath) => {
      if (!targetPath) return;
      setDiffLoading(!0);
      host
        .call("workbench.gitDiff", { path: targetPath })
        .then((res) => {
          setDiffLoading(!1);
          setDiffText((res && res.diff) || "");
        })
        .catch(() => {
          setDiffLoading(!1);
          setDiffText("");
        });
    };
  /* 预览缩放（⤢）：不碰平台右栏宽度（300–520 是 ui-layout columns.ts 的契约钳制），
   * 纯 CSS 把自家 .pw-details 切成 fixed 居中大面板——DOM 不动、组件不卸载，
   * 滚动位置 / 编辑 buffer / 已加载内容零损失；Esc / 点遮罩 / 再点按钮收回。
   * Platform-private surface：fixed 定位依赖 details 槽祖先链无 transform/filter
   * 捕获（ui-layout AppFrame.module.css 当前满足；被捕获时 fixed 退化为相对该祖先，
   * 视觉上卡死在栏内）——toggleZoom 一次性自检，平台升级先核它。 */
  const fixedCaptured = (el) => {
    for (let n = el && el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (
        cs.transform !== "none" ||
        cs.filter !== "none" ||
        cs.backdropFilter !== "none" ||
        cs.perspective !== "none" ||
        /* paint/strict/content 含 paint  containment → 也捕获 fixed */
        /paint|strict|content/.test(cs.contain) ||
        cs.contentVisibility !== "visible" ||
        (cs.willChange !== "auto" && cs.willChange !== "none")
      )
        return true;
    }
    return false;
  };
  const toggleZoom = () => {
    if (zoomed) return setZoomed(!1);
    if (fixedCaptured(rootRef.current))
      return console.warn("[dsh-geek-sidebar] 预览缩放取消：details 祖先链出现 transform/filter/contain 捕获，fixed 会退化（平台布局变了，先核 AppFrame.module.css）");
    setZoomed(!0);
  };
  React.useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (ev) => {
      /* 图片放大开着时 Esc 归 ImgZoomView，一层一层退；编辑中 Esc 不收面板（edRef 实时读，免 deps 抖动） */
      if (ev.key !== "Escape" || imgZoomStore.src || edRef.current) return;
      ev.stopPropagation();
      setZoomed(!1);
    };
    document.addEventListener("keydown", onKey);
    /* 窄屏（≤1219px，对齐 13-drawer 断点）让步链派生关栏 + drawer 出场——退缩放让位，防 fixed 面板悬空撞层 */
    const mq = window.matchMedia("(max-width:1219px)");
    const onNarrow = () => {
      mq.matches && setZoomed(!1);
    };
    mq.addEventListener("change", onNarrow);
    onNarrow();
    return () => {
      (document.removeEventListener("keydown", onKey), mq.removeEventListener("change", onNarrow));
    };
  }, [zoomed]);
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
    if (c && c.modeHint === "diff") {
      g("diff");
    } else if (c && !c.modeHint && h === "diff") {
      g("auto");
    }
  }, [c && c.path, c && c.modeHint]);
  React.useEffect(() => {
    if (h === "diff" && c) loadDiff(c.path);
  }, [c && c.path, h]);
  React.useEffect(() => {
    if (!c) return;
    const rf = () => {
      if (edRef.current || document.visibilityState !== "visible") return;
      if (h === "diff") {
        c && loadDiff(c.path);
        return;
      }
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
    q = () => {
      (D.current = []);
      if (!c) {
        return e(
          "div",
          { className: "pw-empty" },
          e("div", { className: "pw-empty-logo" }, FileTextIcon(40)),
          e("div", null, "在左侧「项目」或「知识库」中点击文件进行预览"),
          e(
            "div",
            { className: "pw-hint" },
            "支持多标签 · Markdown / 图片 / 文本",
          ),
        );
      }
      if (j === "diff") {
        if (diffLoading) {
          return e(
            "div",
            { className: "pw-hint", style: { padding: "20px" } },
            "加载 Diff 中…",
          );
        }
        if (!diffText || !diffText.trim()) {
          return e(
            "div",
            { className: "pw-empty" },
            e("div", { style: { fontWeight: 600, fontSize: "14px" } }, "无未提交变更"),
            e(
              "div",
              { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
              "当前文件与 Git HEAD 保持一致",
            ),
          );
        }
        if (diffText.includes("Binary files") || diffText.includes("GIT binary patch")) {
          return e(
            "div",
            { className: "pw-empty" },
            e("div", { style: { fontWeight: 600, fontSize: "14px" } }, "二进制文件变更"),
            e(
              "div",
              { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
              "二进制文件不提供内联差异文本比对",
            ),
          );
        }
        return e(
          "div",
          { className: "pw-diff-view" },
          e(
            "pre",
            { className: "pw-diff-pre" },
            diffParsed.map((l, idx) => {
              const cls =
                l.type === "add"
                  ? "pw-diff-add"
                  : l.type === "del"
                    ? "pw-diff-del"
                    : "pw-diff-ctx";
              return e(
                "div",
                { key: idx, className: "pw-diff-line " + cls },
                e("span", { className: "pw-diff-num" }, l.lineNo),
                e("span", { className: "pw-diff-prefix" }, l.prefix),
                e("span", { className: "pw-diff-code" }, l.text || "\u00a0"),
              );
            }),
          ),
        );
      }
      if (!r) {
        return e(
          "div",
          { className: "pw-hint", style: { padding: "20px" } },
          "加载中…",
        );
      }
      if (r.error) {
        return e(
          "div",
          { className: "pw-hint", style: { padding: "20px" } },
          "无法预览：" + r.error,
        );
      }
      if (r.kind === "image") {
        return e(
          "div",
          { className: "pw-img-wrap" },
          e("img", {
            src: r.url,
            alt: c.name,
            onClick: (g) => {
              (g.stopPropagation(), imgZoomStore.set(r.url));
            },
          }),
        );
      }
      if (r.kind === "pdf") {
        return e("iframe", {
          className: "pw-frame",
          src: r.url,
          title: c.name,
        });
      }
      if (r.kind === "html" || (r.kind === "text" && isHtmlExt(c.name))) {
        return e("iframe", {
          className: "pw-frame",
          srcDoc: r.html || r.text || "",
          sandbox: "",
          title: c.name,
        });
      }
      if (j === "preview") {
        return e(
          "div",
          { className: "pw-md" },
          renderMarkdown(
            r.text || "",
            D.current,
            c && c.path ? pathDir(c.path) : "",
          ),
        );
      }
      if (isCsvExt(c.name)) {
        return e(CsvView, { text: r.text || "" });
      }
      if (isCodeExt(c.name)) {
        return e(
          "div",
          { className: "pw-codeview" },
          highlightCode(
            r.text || "",
            c.name.split(".").pop().toLowerCase(),
          ),
        );
      }
      return e("pre", { className: "pw-src" }, r.text || "");
    };
  return e(
    React.Fragment,
    null,
    zoomed
      ? e("div", {
          className: "pw-zoomview-mask",
          onClick: () => setZoomed(!1),
        })
      : null,
    e(
      "div",
      { className: "pw-details" + (zoomed ? " zoomed" : ""), ref: rootRef },
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
      t.inDrawer
        ? null
        : e(
            "button",
            {
              className: "pw-col-btn",
              title: zoomed ? "收回预览 (Esc)" : "放大预览",
              onClick: toggleZoom,
            },
            zoomed ? "⤡" : "⤢",
          ),
      /* 0.1.5：closeDetails 随 details 栏一并移除，且预览只剩 drawer 形态——
       * 「收起右栏」钮不再有可作用的栏，inDrawer 下不出场。 */
      t.inDrawer
        ? null
        : e(
            "button",
            {
              className: "pw-col-btn",
              title: "收起右栏",
              /* 缩放态下收栏先退缩放：面板是 fixed，栏收了它还悬着 */
              onClick: () => {
                (setZoomed(!1), s && typeof s.closeDetails === "function" && s.closeDetails());
              },
            },
            "»",
          ),
    ),
    c
      ? e(
          "div",
          { className: "pw-toolbar" },
          e(
            "span",
            { className: "pw-crumbs" },
            r && r.text
              ? (() => {
                  const ext = (c.name.split(".").pop() || "").toLowerCase();
                  const langMap = {
                    md: "markdown", markdown: "markdown", ts: "typescript", tsx: "tsx",
                    js: "javascript", jsx: "jsx", py: "python", json: "json",
                    yml: "yaml", yaml: "yaml", toml: "toml", css: "css", html: "html",
                    sh: "bash", bash: "bash", rs: "rust", go: "go", sql: "sql",
                  };
                  const lang = langMap[ext] || ext || "text";
                  const lines = r.text.split("\n").length;
                  const bLen = new TextEncoder().encode(r.text).length;
                  const sz = bLen < 1024 ? bLen + " B" : (bLen / 1024).toFixed(1) + " KB";
                  return lang + " · " + lines + " 行 · " + sz + (r.truncated ? " (截断)" : "");
                })()
              : r && r.kind === "image"
                ? "图片" + (r.size ? " · " + (r.size < 1024 ? r.size + " B" : (r.size / 1024).toFixed(1) + " KB") : "")
                : r && r.kind === "pdf"
                  ? "PDF" + (r.size ? " · " + (r.size < 1024 ? r.size + " B" : (r.size / 1024).toFixed(1) + " KB") : "")
                  : "",
          ),
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
            c && isMd(c.name)
              ? e(
                  "button",
                  {
                    className: "pw-tg" + (j === "preview" ? " on" : ""),
                    onClick: () => g("preview"),
                  },
                  "Preview",
                )
              : null,
            e(
              "button",
              {
                className: "pw-tg" + (j === "diff" ? " on" : ""),
                onClick: () => {
                  g("diff");
                  c && loadDiff(c.path);
                },
              },
              "Diff",
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
                          mentionRef(c.path, false),
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
    ),
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
  s = s.replace(/^\.[\\/]/, "");
  if (s.slice(0, 2) === "~/" || s.slice(0, 2) === "~\\") return s;
  /* 绝对路径两种形态都认：POSIX /... 与 Windows 盘符（C:\... / C:/...），
   * 否则 markdown 里写的 Windows 绝对路径会被误当相对路径拼到基目录后 */
  if (s.charAt(0) !== "/" && !/^[A-Za-z]:[\\/]/.test(s)) {
    if (!bd) return null;
    s = pathJoinFor(bd, s);
  }
  return s;
}
function mediaUrl(s, bd) {
  const p = resolveLocalPath(s, bd);
  return p ? API + "/wb/raw?path=" + encodeURIComponent(p) : s;
}
function openLocalPath(p) {
  try {
    store.open(sessionProbe.sid, { path: p, name: baseName(p) || p });
  } catch (e) {}
}

function PreviewDrawer(t) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const st = usePreviewState(sessionProbe.sid);
  const [hiddenFor, setHiddenFor] = React.useState(null);
  /* 评审修复：遮罩 dismiss 只压"这一次打开"——文件关掉（activeFile 空）即复位 hiddenFor，
   * 重开同一文件抽屉能再出场（原版永不重置，同路径关闭再开也被永久压制，无挽回路径） */
  React.useEffect(() => {
    !st.activeFile && hiddenFor && setHiddenFor(null);
  }, [st.activeFile, hiddenFor]);
  /* 0.1.5：平台 details 栏整个移除（layout.openDetails/closeDetails、'details' 槽均消失），
   * 本 drawer 从「窄屏顶替」改为「唯一预览宿主」，宽窄屏都出场。
   * 宿主内容用 PanelHost（dshDetailsPanels 三方驱动面）而非裸 Details，保住该服务面。 */
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
      e(PanelHost, {
        layout: t.layout,
        /* drawer 本来就是宽面板，缩放钮只在栏内模式出场 */
        inDrawer: !0,
        workspacesSvc: t.workspacesSvc,
        mentionBridge: t.mentionBridge,
      }),
    ),
  );
}

/* 底栏图标：技能（Layers）——FootBar 入口的专属图形 */
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
/* ==================== chat 文件点击接管（deliv-hook） ====================
 * 对话里两类文件点击面默认走平台 openFile → remote.session.openWorkspacePath →
 * 宿主原生 open（系统默认应用，即"外部打开"）。这里在 document capture 阶段拦
 * 普通左键改道应用内预览（delivOpenFile → openLocalPath）；修饰键点击保留系统
 * 打开。（v1.22.0 起：产物/链接弹出面板与事件窗口订阅整体移除，仅保留本接管。）
 *   ① 产出文件 chip（ui-deliverables ProducedFiles.tsx）：行容器自带
 *      data-produced-files-row，chip 为 button[title=完整路径]；
 *      「在文件夹中显示」钮 openFile('.') 无 title 属性，自然放行。
 *   ② 工具卡文件链接（ui-tool ToolRow.tsx，read/write/edit 行）：摘要按钮产物类名
 *      形如 "o3BgMG_fileLink"（vite CSS Modules <hash>_<local>，fileLink 子段健在），
 *      行根带 data-variant/data-tool；按钮文本 = 原路径 relativizeToCwd（剥 cwd 前缀）
 *      + abbreviateHomePath（home→~）后的摘要——相对/绝对反解进预览，~ 摘要
 *      （客户端无宿主 home）放行外部打开。
 * React 17+ 事件委托挂根容器——document capture 先于根委托触发，stopPropagation
 * 即断其 onClick（平台 fileLink 自身也 stopPropagation，行展开不受影响）。
 *
 * 钉住的平台私有面（0.1.2-alpha.4，平台升级先核对）：
 *   - chat openFile→openWorkspacePath 外部打开语义（ui-chat apply.ts）
 *   - ProducedFiles 行容器属性 data-produced-files-row + chip button[title=完整路径]
 *   - ToolRow 行根 data-variant + 摘要按钮产物类名含 fileLink 子段 + 摘要文本 =
 *     relativizeToCwd + abbreviateHomePath 语义
 *   - React 17+ 根容器事件委托（document capture 先于根委托）
 * cwd 来源：当前会话 byId.cwd（sessionCwd，09-sidebar 会话订阅效应同步写）。
 */

/* 相对路径按会话 cwd 解析成绝对路径（预览打开用）；绝对路径原样 */
function delivAbsPath(cwd, p) {
  const s = String(p || "");
  if (!s) return "";
  if (s.charAt(0) === "/" || s.charAt(0) === "~" || /^[A-Za-z]:[\\/]/.test(s)) return s;
  return cwd ? pathJoinFor(cwd, s) : s;
}

/* chat 点文件：先让当前右栏占用者退场（对齐 03-tree 的 yieldToPreview 纪律）再进预览 */
function delivOpenFile(cwd, p) {
  yieldToPreview();
  openLocalPath(delivAbsPath(cwd, p));
}

const DELIV_CHIP_SEL = "div[data-produced-files-row] button[title]";
const DELIV_TOOL_LINK_SEL = 'div[data-variant] [class*="fileLink"]';
function delivChipHook(ev) {
  if (ev.defaultPrevented || ev.button !== 0) return;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const tgt = ev.target;
  if (!tgt || !tgt.closest) return;
  const sid = sessionProbe.sid;
  if (!sid) return;
  const cwd = sessionCwd.sid === sid ? sessionCwd.cwd : null;
  /* ① 产出文件 chip：title 即完整路径（~ 开头无法反解，放行外部，与 ② 同规） */
  const chip = tgt.closest(DELIV_CHIP_SEL);
  if (chip) {
    const p = chip.getAttribute("title");
    if (!p || p === "." || p.charAt(0) === "~") return;
    ev.preventDefault();
    ev.stopPropagation();
    delivOpenFile(cwd, p);
    return;
  }
  /* ② 工具卡文件链接：摘要文本反解（相对路径按 cwd；~ 摘要无法反解，放行外部） */
  const link = tgt.closest(DELIV_TOOL_LINK_SEL);
  if (!link) return;
  const raw = (link.textContent || "").trim();
  if (!raw || raw.charAt(0) === "~") return;
  ev.preventDefault();
  ev.stopPropagation();
  delivOpenFile(cwd, raw);
}
function installDelivChipHook() {
  /* HMR 幂等：模块重载重跑 apply 时先摘旧闭包（旧实例 store/probe 已冻结） */
  const flag = "__dshDelivChipHook";
  if (document[flag]) document.removeEventListener("click", document[flag], true);
  document[flag] = delivChipHook;
  document.addEventListener("click", delivChipHook, true);
}

/* DirPicker：应用内目录选择模态（交互复刻 pi-web 的 DirectoryPicker），统一三处路径选择
 * ——09 项目"自定义路径" / 15 终端 ＋ / 01 笔记"选择目录…"，替换原生 OS 对话框
 *（svc.pickDirectory、/wb/notesPick 的 osascript；原生路由仍在 host 保留给外部调用）。
 *
 * 架构（对齐既有模式）：
 *  - dirPicker 是纯状态机 store（不挂 React 钩子，可无头驱动；代际 seq 防迟到回包写态）；
 *  - pickDir(opts) → Promise<path|null>，签名对齐平台 workspaces.pickDirectory，
 *    调用点把 svc.pickDirectory() 换成 pickDir() 即完成迁移；
 *  - DirPickerHost 单实例挂 shell.overlay（16-apply），req 空即卸载；
 *  - 导航走自家 workbench.listDir（响应带 path/parent）；起点语义收口在 nav：
 *    null = 默认目录（workbench.prefsGet，未自定义回落桌面；footer 星钮经 prefsSet 自定），
 *    无 native capability 依赖——纯浏览器远程访问场景同样可用（原生对话框的盲区）；
 *  - 专属 bus 频道 'dirPicker'（对齐 01-stores 的热路径扇出纪律）：击键/导航重渲染
 *    只触达本模态，不扰动侧栏树等全局订阅者。
 * 只列目录（listDir 同时返回文件，此处过滤）；隐藏目录保留（~/.dsh 这类目标可达）。 */
const DIRPICKER_CHAN = "dirPicker",
  dirPicker = {
  req: null /* { title, resolve }——非空即"打开中" */,
  path: "",
  parent: null,
  input: "",
  entries: [],
  loading: false,
  error: null,
  seq: 0 /* 导航代际：每次 nav/settle 递增，迟到的响应不得写态 */,
  /* 默认打开目录（1.19.12）：defDir null = 未加载；未自定义/已失效时 host 回落桌面。
   * 首开由 nav(null) 先拉偏好再导航，之后常驻内存（footer 星钮可改） */
  defDir: null,
  defCustom: false,
  open(t) {
    dirPicker.req && dirPicker.settle(false) /* 重开先结算旧请求，不留悬空 Promise */;
    const e = ++dirPicker.seq;
    return new Promise((s) => {
      ((dirPicker.req = { title: (t && t.title) || "选择目录", resolve: s }),
        (dirPicker.path = ""),
        (dirPicker.parent = null),
        (dirPicker.input = (t && t.initialPath) || ""),
        (dirPicker.entries = []));
      /* 起点解析单点收口在 nav：null = 默认目录 */
      dirPicker.nav(t && t.initialPath ? String(t.initialPath) : null, e);
    });
  },
  /* footer 星钮：把当前目录设为默认；当前即自定义默认时再点为清除（恢复桌面回落） */
  toggleDefault() {
    const t = dirPicker.path;
    if (!t) return;
    const e = t === dirPicker.defDir && dirPicker.defCustom;
    host.call("workbench.prefsSet", { pickerDir: e ? "" : t }).then(
      (s) => {
        if (!s || s.ok === false) return;
        /* host prefsSet 经 prefsOut 自愈回包（pickerDir 为空时回 desktopDir），
         * s.pickerDir 恒非空——直接赋值（原先的 || dirPicker.defDir 是死分支） */
        ((dirPicker.defDir = s.pickerDir),
          (dirPicker.defCustom = !!s.custom),
          bus.fire(DIRPICKER_CHAN));
      },
      () => {},
    );
  },
  nav(t, e) {
    const s = e || ++dirPicker.seq;
    if (t === null && dirPicker.defDir === null) {
      /* 首开且偏好未载：先拉默认目录再导航；拉取失败不挡路，空串由 host 回落 home */
      ((dirPicker.loading = !0), (dirPicker.error = null), bus.fire(DIRPICKER_CHAN));
      host.call("workbench.prefsGet", {}).then(
        (o) => {
          if (s !== dirPicker.seq || !dirPicker.req) return;
          ((dirPicker.defDir = (o && o.pickerDir) || ""),
            (dirPicker.defCustom = !!(o && o.custom)),
            dirPicker.nav(dirPicker.defDir, s));
        },
        () => {
          if (s !== dirPicker.seq || !dirPicker.req) return;
          ((dirPicker.defDir = ""), dirPicker.nav("", s));
        },
      );
      return;
    }
    const p = t === null ? dirPicker.defDir : t;
    ((dirPicker.loading = !0), (dirPicker.error = null), bus.fire(DIRPICKER_CHAN));
    host.call("workbench.listDir", { path: p }).then(
      (o) => {
        if (s !== dirPicker.seq || !dirPicker.req) return;
        if (o && o.error) {
          /* 目录不可读：留在原位，错误内联展示（对齐 pi-web），输入框保持用户所敲 */
          ((dirPicker.loading = !1), (dirPicker.error = String(o.error)), bus.fire(DIRPICKER_CHAN));
          return;
        }
        ((dirPicker.path = (o && o.path) || p),
          (dirPicker.parent = (o && o.parent) || null),
          (dirPicker.input = dirPicker.path),
          (dirPicker.entries = ((o && o.entries) || []).filter(
            (a) => a.type === "directory",
          )),
          (dirPicker.loading = !1),
          bus.fire(DIRPICKER_CHAN));
      },
      (o) => {
        if (s !== dirPicker.seq || !dirPicker.req) return;
        ((dirPicker.loading = !1),
          (dirPicker.error = String((o && o.message) || o)),
          bus.fire(DIRPICKER_CHAN));
      },
    );
  },
  /* 关闭并结算：commit 取当前 path，否则 null。bump 代际使在途导航回包失效 */
  settle(t) {
    const e = dirPicker.req;
    if (!e) return;
    (++dirPicker.seq, (dirPicker.req = null), bus.fire(DIRPICKER_CHAN), e.resolve(t ? dirPicker.path : null));
  },
};
const pickDir = (t) => dirPicker.open(t);
function DirPickerHost() {
  const t = React.createElement,
    [, e] = React.useState(0);
  React.useEffect(() => bus.sub(() => e((s) => s + 1), DIRPICKER_CHAN), []);
  const s = dirPicker.req;
  if (!s) return null;
  /* 输入框有未提交改动时禁用"选择"（对齐 pi-web：先打开再选，防误选旧目录） */
  const o = dirPicker.input.trim() !== dirPicker.path,
    a = !!dirPicker.path && !o && !dirPicker.loading,
    /* 星钮三态：非默认（可设为默认）/ 自定义默认（再点恢复桌面）/ 桌面回落默认（禁用展示） */
    i = !!dirPicker.path && dirPicker.path === dirPicker.defDir,
    l = i && !dirPicker.defCustom;
  return t(
    "div",
    {
      className: "pw-dpk-mask",
      onClick: (i) => {
        i.target === i.currentTarget && dirPicker.settle(false);
      },
      /* Esc 经冒泡捕获（输入框 autoFocus，按键事件沿虚拟 DOM 上溯） */
      onKeyDown: (i) => {
        i.key === "Escape" && dirPicker.settle(false);
      },
    },
    t(
      "div",
      { className: "pw-dpk-panel" },
      t(
        "div",
        { className: "pw-dpk-head" },
        t("span", { className: "pw-dpk-title" }, s.title),
        t(
          "button",
          {
            className: "pw-dpk-x",
            title: "关闭",
            onClick: () => dirPicker.settle(false),
          },
          "×",
        ),
      ),
      t(
        "div",
        { className: "pw-dpk-bar" },
        t(
          "button",
          {
            className: "pw-dpk-up",
            disabled: dirPicker.loading || !dirPicker.parent,
            title: "上级目录",
            onClick: () =>
              dirPicker.parent && dirPicker.nav(dirPicker.parent),
          },
          ic([["p", "m18 15-6-6-6 6"]], 15),
        ),
        t("input", {
          className: "pw-dpk-path",
          value: dirPicker.input,
          autoFocus: !0,
          autoComplete: "off",
          spellCheck: !1,
          placeholder: "/path/to/project 或 ~/project",
          onChange: (i) => {
            ((dirPicker.input = i.target.value),
              (dirPicker.error = null),
              bus.fire(DIRPICKER_CHAN));
          },
          onKeyDown: (i) => {
            if (i.key === "Enter") {
              const l = dirPicker.input.trim();
              l && dirPicker.nav(l);
            }
          },
        }),
        t(
          "button",
          {
            className: "pw-dpk-go",
            disabled: dirPicker.loading || !dirPicker.input.trim(),
            onClick: () => {
              const i = dirPicker.input.trim();
              i && dirPicker.nav(i);
            },
          },
          "前往",
        ),
      ),
      t(
        "div",
        { className: "pw-dpk-list" },
        dirPicker.loading
          ? t("div", { className: "pw-dpk-hint" }, "加载目录…")
          : dirPicker.entries.length
            ? dirPicker.entries.map((i) =>
                t(
                  "button",
                  {
                    key: i.path,
                    className: "pw-dpk-row",
                    title: i.path,
                    onClick: () => dirPicker.nav(i.path),
                  },
                  FolderIcon(12),
                  t("span", { className: "pw-dpk-name" }, i.name),
                ),
              )
            : t("div", { className: "pw-dpk-hint" }, "没有子目录"),
        dirPicker.error
          ? t("div", { className: "pw-dpk-err" }, dirPicker.error)
          : null,
      ),
      t(
        "div",
        { className: "pw-dpk-foot" },
        t(
          "button",
          {
            className: "pw-dpk-star" + (i ? " on" : ""),
            disabled: l,
            title: i
              ? dirPicker.defCustom
                ? "当前即默认打开目录，点击恢复默认（桌面）"
                : "默认打开目录（桌面）；进入其他目录可设为默认"
              : "把当前目录设为默认打开目录",
            onClick: () => dirPicker.toggleDefault(),
          },
          ic(
            [
              [
                "p",
                "M12 2l2.9 6.3 6.6 1-5 4.8 1.4 6.9L12 17.8 6.1 21l1.4-6.9-5-4.8 6.6-1z",
              ],
            ],
            12,
          ),
          i ? "默认目录" : "设为默认",
        ),
        t(
          "div",
          { className: "pw-dpk-foot-r" },
          t(
            "button",
            {
              className: "pw-dpk-cancel",
              onClick: () => dirPicker.settle(false),
            },
            "取消",
          ),
          t(
            "button",
            {
              className: "pw-dpk-ok",
              disabled: !a,
              title: o ? "先回车或点「前往」打开输入的路径" : "选择当前目录",
              onClick: () => a && dirPicker.settle(true),
            },
            "选择此文件夹",
          ),
        ),
      ),
    ),
  );
}

/* ============================ 便签（Typora 风格编辑即预览） ============================
 * 纯粹的 Markdown 实时编辑预览区：所见即所得，粘图片即是图片，无多余编辑/完成按钮，无底部冗余状态行；
 * 顶栏极简（左侧 + 图标、紧凑搜索框、AI 生成标题；右侧与侧边栏同款 ChevronDown SVG 图标）；
 * 整体配色与 dsh-geek-sidebar 100% 统一（基于 --dsw-alias-bg-base 与标准 1px 分割线，无杂乱色块）；
 * 便签项悬停展现与侧栏统一尺寸位置的标准按钮（@、改名、删除）；纵向分割线与顶边拖拽线采用标准 1px 细线风格。 */

function NotebookIcon(t) {
  return ic(
    [
      ["r", 4, 3, 16, 18, 2, 2],
      ["l", 8, 3, 8, 21],
      ["l", 12, 8, 16, 8],
      ["l", 12, 12, 16, 12],
    ],
    t,
  );
}

function SparkleIcon(t) {
  return ic(
    [
      ["p", "M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z"],
    ],
    t || 12,
  );
}

/* 同步到项目：纯左向分支箭头（绝对镜像对称） */
function ForkProjectIcon(t) {
  return ic(
    [
      ["p", "M16 19v-6a4 4 0 0 0-4-4H5"],
      ["pl", "9 5 5 9 9 13"],
    ],
    t || 15,
  );
}

/* 同步到知识库：纯右向分支箭头（绝对镜像对称） */
function ForkKbIcon(t) {
  return ic(
    [
      ["p", "M8 19v-6a4 4 0 0 1 4-4h7"],
      ["pl", "15 5 19 9 15 13"],
    ],
    t || 15,
  );
}

/* 抽屉最大化/还原：复用原 "»" 双叉角风格，仅改变上下方向组合（unfold more/less）。
 * 一上一下（上∧ + 下∨）= 向上扩大；一下一上（上∨ + 下∧）= 收缩。尺寸 13 与原一致。 */
function ExpandIcon(t) {
  return ic(
    [
      ["pl", "17 11 12 6 7 11"],
      ["pl", "7 13 12 18 17 13"],
    ],
    t || 13,
  );
}
function CollapseIcon(t) {
  return ic(
    [
      ["pl", "7 6 12 11 17 6"],
      ["pl", "7 18 12 13 17 18"],
    ],
    t || 13,
  );
}

/* 目录栏展开/收起缩放图标（Apple 风格，居中紧凑） */
function SidebarToggleIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 16, 2],
      ["l", 9, 4, 9, 20],
    ],
    t || 13,
  );
}

/* 新增目录图标 */
function FolderPlusIcon(t) {
  return ic(
    [
      ["p", "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
      ["l", 12, 11, 12, 17],
      ["l", 9, 14, 15, 14],
    ],
    t || 13,
  );
}

/* 跨目录查看全部便签图标 */
function AllNotesIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 16, 2],
      ["l", 7, 8, 17, 8],
      ["l", 7, 12, 17, 12],
      ["l", 7, 16, 13, 16],
    ],
    t || 13,
  );
}

/* 纯目录图标 */
function FolderSimpleIcon(t) {
  return ic(
    [
      ["p", "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
    ],
    t || 13,
  );
}

function qnExtractFirstImage(text) {
  if (!text) return null;
  const m = String(text).match(/!\[[^\]]*\]\(([^)]+)\)/);
  return m ? m[1] : null;
}

/* 零宽字符统一剔除：空便签占位符 U+200B（E2 80 8B）及零宽连字/BOM */
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF]/g;

/* 便签内容规范化：空/纯空白 → 零宽占位符（host 拒绝空内容） */
function qnContentOrBlank(content) {
  return typeof content === "string" && content.trim() ? content : "\u200B";
}

function qnStripMarkdown(text) {
  return String(text || "")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*`_~>-]/g, "")
    .trim();
}

function qnDeriveTitle(content, fallbackTitle) {
  if (!content) return fallbackTitle || "新便签";
  const clean = String(content).replace(ZERO_WIDTH_RE, "").trim();
  if (!clean) return fallbackTitle || "新便签";
  const lines = clean.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split("\n");
  const first = lines.map((s) => s.replace(/^[#*\-`_~>\s]+/, "").trim()).find((s) => s.length > 0);
  return first ? first.slice(0, 30) : (fallbackTitle || "新便签");
}

function qnFormatAppleDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  if (d.toDateString() === now.toDateString()) {
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  if (d.getFullYear() === now.getFullYear()) {
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
}

function qnSplitWords(text) {
  const fallback = text.match(/\S+/g) || [];
  if (typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined") {
    return text.match(/[\p{Script=Han}]+|\S+/gu) || fallback;
  }
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    const words = [];
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike && segment.segment.trim() !== "") {
        words.push(segment.segment);
      }
    }
    return words.length > 0 ? words : fallback;
  } catch {
    return fallback;
  }
}

function qnSummarize(text, excerptWords, thresholdChars) {
  const clean = qnStripMarkdown(text);
  if (!clean) return "";
  const maxChars = thresholdChars || 80;
  if (clean.length <= maxChars) return clean;
  const hasHan = /[\p{Script=Han}]/u.test(clean);
  const keepWords = excerptWords || 3;
  const keep = hasHan ? keepWords * 2 : keepWords;
  const words = qnSplitWords(clean);
  if (words.length <= keep * 2) return clean;
  const head = words.slice(0, keep);
  const tail = words.slice(-keep);
  const joiner = hasHan ? "" : " ";
  return head.join(joiner) + " … " + tail.join(joiner);
}

/* ============================ Typora Markdown <-> HTML 序列化 ============================ */
function qnEscapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function qnInlineMd(text) {
  return qnEscapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function qnMdToHtml(md) {
  if (!md || !md.replace(ZERO_WIDTH_RE, "").trim()) return "<p><br></p>";
  const lines = md.split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCode) {
        html += "<pre><code>" + qnEscapeHtml(codeBuf.join("\n")) + "</code></pre>";
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (/^#{6}\s+/.test(line)) {
      html += "<h6>" + qnInlineMd(line.replace(/^#{6}\s+/, "")) + "</h6>";
    } else if (/^#{5}\s+/.test(line)) {
      html += "<h5>" + qnInlineMd(line.replace(/^#{5}\s+/, "")) + "</h5>";
    } else if (/^#{4}\s+/.test(line)) {
      html += "<h4>" + qnInlineMd(line.replace(/^#{4}\s+/, "")) + "</h4>";
    } else if (/^#{3}\s+/.test(line)) {
      html += "<h3>" + qnInlineMd(line.replace(/^#{3}\s+/, "")) + "</h3>";
    } else if (/^#{2}\s+/.test(line)) {
      html += "<h2>" + qnInlineMd(line.replace(/^#{2}\s+/, "")) + "</h2>";
    } else if (/^#{1}\s+/.test(line)) {
      html += "<h1>" + qnInlineMd(line.replace(/^#{1}\s+/, "")) + "</h1>";
    } else if (/^>\s*/.test(line)) {
      html += "<blockquote>" + qnInlineMd(line.replace(/^>\s*/, "")) + "</blockquote>";
    } else if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) {
      html += "<hr />";
    } else if (/^[-*]\s+\[([ xX])\]\s+(.*)/.test(line)) {
      const m = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
      const isChecked = m[1].toLowerCase() === "x";
      html += `<ul class="pw-qn-task-list"><li class="pw-qn-task${isChecked ? " checked" : ""}"><input type="checkbox"${isChecked ? " checked" : ""} /><span>` + qnInlineMd(m[2]) + "</span></li></ul>";
    } else if (/^\d+\.\s+/.test(line)) {
      html += "<ol><li>" + qnInlineMd(line.replace(/^\d+\.\s+/, "")) + "</li></ol>";
    } else if (/^[-*]\s+/.test(line)) {
      html += "<ul><li>" + qnInlineMd(line.replace(/^[-*]\s+/, "")) + "</li></ul>";
    } else if (/^!\[([^\]]*)\]\(([^)]+)\)/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      html += '<p><img src="' + m[2] + '" alt="' + (m[1] || "") + '" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" /></p>';
    } else if (line.trim() === "") {
      html += "<p><br></p>";
    } else {
      html += "<p>" + qnInlineMd(line) + "</p>";
    }
  }
  if (inCode) {
    html += "<pre><code>" + qnEscapeHtml(codeBuf.join("\n")) + "</code></pre>";
  }
  return html;
}

function qnHtmlToMd(node) {
  if (!node) return "";
  let md = "";
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3) {
      md += child.textContent;
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === "h1") {
        md += "# " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h2") {
        md += "## " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h3") {
        md += "### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h4") {
        md += "#### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h5") {
        md += "##### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h6") {
        md += "###### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "blockquote") {
        const text = qnHtmlToMd(child).trim();
        if (text) md += "> " + text + "\n\n";
      } else if (tag === "hr") {
        md += "---\n\n";
      } else if (tag === "p" || tag === "div") {
        const text = qnHtmlToMd(child).trim();
        if (text) md += text + "\n\n";
        else md += "\n";
      } else if (tag === "li") {
        const chk = child.querySelector && child.querySelector('input[type="checkbox"]');
        if (chk) {
          const isChecked = chk.checked;
          const clone = child.cloneNode(true);
          const cInput = clone.querySelector('input[type="checkbox"]');
          if (cInput) cInput.remove();
          const t = qnHtmlToMd(clone).trim();
          md += (isChecked ? "- [x] " : "- [ ] ") + t + "\n";
        } else if (child.parentElement && child.parentElement.tagName.toLowerCase() === "ol") {
          md += "1. " + qnHtmlToMd(child).trim() + "\n";
        } else {
          md += "- " + qnHtmlToMd(child).trim() + "\n";
        }
      } else if (tag === "ul" || tag === "ol") {
        md += qnHtmlToMd(child) + "\n";
      } else if (tag === "a") {
        const href = child.getAttribute("href") || "";
        const text = qnHtmlToMd(child).trim();
        md += "[" + (text || href) + "](" + href + ")";
      } else if (tag === "img") {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "图片";
        md += "![" + alt + "](" + src + ")\n\n";
      } else if (tag === "strong" || tag === "b") {
        md += "**" + qnHtmlToMd(child) + "**";
      } else if (tag === "em" || tag === "i") {
        md += "*" + qnHtmlToMd(child) + "*";
      } else if (tag === "del" || tag === "s" || tag === "strike") {
        md += "~~" + qnHtmlToMd(child) + "~~";
      } else if (tag === "code") {
        md += "`" + child.textContent + "`";
      } else if (tag === "pre") {
        md += "```\n" + child.textContent.trim() + "\n```\n\n";
      } else if (tag === "br") {
        md += "\n";
      } else {
        md += qnHtmlToMd(child);
      }
    }
  }
  return md;
}

const qnPending = new Map();
let qnQuoteSeq = 0;
let qnQuoteApi = null;
let qnAppCtx = null;

/* 活跃会话 id：sessionProbe 在 06-misc，本文件被 smoke 单独 eval 时可能不在，故用 typeof 守卫 */
function qnActiveSid() {
  return typeof sessionProbe !== "undefined" && sessionProbe ? sessionProbe.sid : null;
}

/* 把单个便签按绝对文件路径提为 @ 提及（与侧边栏文件 @ 同机制）。返回是否插入成功 */
function qnMentionNote(sid, name) {
  const dir = qnStore.dir ? String(qnStore.dir).replace(/[\\/]+$/, "") : "";
  if (!dir) return false; // 无便签目录信息，无法构造绝对路径（避免误提相对文件名）
  const ref = mentionRef(dir + "/" + name, false, { abs: true });
  return fileMentionBridge ? fileMentionBridge.mention(sid, ref) : false;
}

function installQnQuote(ctx) {
  qnAppCtx = ctx;
  const it = ctx.get("inputTriggers");
  if (it && typeof it.registerSource === "function") {
    ctx.effect(() => {
      return it.registerSource({
        trigger: "@",
        name: "geek-notes-quote",
        order: 200,
        showGroupTitle: false,
        candidates: async () => [],
        onPick: () => undefined,
        codec: {
          clipboardText(ref) {
            const t = qnPending.get(ref);
            return t ? qnSummarize(t) : ref;
          },
          async serialize(ref) {
            const t = qnPending.get(ref);
            return t !== undefined ? t : ref;
          },
        },
      });
    });
  }
  qnQuoteApi = {
    insert(text) {
      const clean = String(text || "").replace(ZERO_WIDTH_RE, "").trim();
      if (!clean) {
        qnToast("无内容可引用");
        return false;
      }
      const sid = qnActiveSid();
      const actx = sid && ctx.sessions ? ctx.sessions.scope(sid) : null;
      const conv = ctx.get("conversation");
      const resolver = conv && conv.input;
      if (!actx || !resolver) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(clean).catch(() => {});
        }
        qnToast("无活跃会话，已复制全文到剪贴板");
        return false;
      }
      let input;
      try { input = resolver.for(actx); } catch { return false; }
      if (!input) return false;
      const snapshot = input.state.getSnapshot();
      const draft = String(snapshot.draft || "");
      const draftRev = snapshot.draftRev;
      const refId = "qn-" + (++qnQuoteSeq) + "-" + Date.now();
      qnPending.set(refId, clean);
      if (qnPending.size > 50) {
        const oldest = qnPending.keys().next().value;
        qnPending.delete(oldest);
      }
      const span = { start: draft.length, end: draft.length, draftRev };
      const label = qnSummarize(clean);
      const ok = input.insertReference(
        {
          source: "geek-notes-quote",
          ref: refId,
          label,
          appearance: "file",
          clipboardText: label,
        },
        span,
      );
      if (ok) {
        qnToast("已引用到输入框");
      } else {
        qnToast("引用失败，请稍后重试");
      }
      return ok;
    },
  };
}

let qnToastTimer = null;
function qnToast(msg) {
  if (qnToastTimer) clearTimeout(qnToastTimer);
  qnStore.set({ toast: msg });
  qnToastTimer = setTimeout(() => {
    qnStore.set({ toast: null });
    qnToastTimer = null;
  }, 2500);
}

/* 便签目录（分类）元数据读写 */
async function qnLoadFoldersMeta() {
  try {
    const res = await host.call("workbench.qnFoldersGet").catch(() => null);
    if (res && res.ok && Array.isArray(res.folders)) {
      qnStore.set({ folders: res.folders, noteFolders: res.noteFolders || {} });
      return { folders: res.folders, noteFolders: res.noteFolders || {} };
    }
  } catch {}
  try {
    const raw = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("pw-qn-folders-meta") : null;
    if (raw) {
      const j = JSON.parse(raw);
      if (j && Array.isArray(j.folders)) {
        qnStore.set({ folders: j.folders, noteFolders: j.noteFolders || {} });
        return j;
      }
    }
  } catch {}
  return { folders: [], noteFolders: {} };
}

async function qnSaveFoldersMeta(meta) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("pw-qn-folders-meta", JSON.stringify(meta));
    }
  } catch {}
  qnStore.set({ folders: meta.folders, noteFolders: meta.noteFolders });
  try {
    await host.call("workbench.qnFoldersSet", meta).catch(() => {});
  } catch {}
}

async function qnCreateFolder(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    qnToast("目录名称不能为空");
    return false;
  }
  const cur = qnStore.folders || [];
  if (cur.includes(trimmed)) {
    qnToast("已存在同名目录");
    return false;
  }
  const next = [...cur, trimmed];
  await qnSaveFoldersMeta({ folders: next, noteFolders: qnStore.noteFolders || {} });
  qnStore.set({ selectedFolder: trimmed });
  qnToast("已创建目录: " + trimmed);
  return true;
}

async function qnRenameFolder(oldName, newName) {
  const trimmed = String(newName || "").trim();
  if (!trimmed || trimmed === oldName) return false;
  const cur = qnStore.folders || [];
  if (cur.includes(trimmed)) {
    qnToast("已存在同名目录");
    return false;
  }
  const nextFolders = cur.map((f) => (f === oldName ? trimmed : f));
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  for (const k of Object.keys(nextNoteFolders)) {
    if (nextNoteFolders[k] === oldName) nextNoteFolders[k] = trimmed;
  }
  await qnSaveFoldersMeta({ folders: nextFolders, noteFolders: nextNoteFolders });
  if (qnStore.selectedFolder === oldName) {
    qnStore.set({ selectedFolder: trimmed });
  }
  await qnLoadNotes(qnStore.q);
  qnToast("目录已改名");
  return true;
}

async function qnDeleteFolder(folderName) {
  const cur = qnStore.folders || [];
  const nextFolders = cur.filter((f) => f !== folderName);
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  for (const k of Object.keys(nextNoteFolders)) {
    if (nextNoteFolders[k] === folderName) delete nextNoteFolders[k];
  }
  await qnSaveFoldersMeta({ folders: nextFolders, noteFolders: nextNoteFolders });
  if (qnStore.selectedFolder === folderName) {
    qnStore.set({ selectedFolder: null });
  }
  await qnLoadNotes(qnStore.q);
  qnToast("目录已删除");
}

async function qnMoveNoteToFolder(noteName, targetFolder) {
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  if (targetFolder) {
    nextNoteFolders[noteName] = targetFolder;
    qnToast("已移至目录: " + targetFolder);
  } else {
    delete nextNoteFolders[noteName];
    qnToast("已移出目录");
  }
  await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nextNoteFolders });
  await qnLoadNotes(qnStore.q);
}

async function qnLoadNotes(q) {
  qnStore.set({ loading: true });
  try {
    const [res, meta] = await Promise.all([
      host.call("workbench.qnList", { q: q || "" }),
      qnLoadFoldersMeta(),
    ]);
    if (res && res.ok) {
      const nf = (meta && meta.noteFolders) || qnStore.noteFolders || {};
      const rawNotes = res.notes || [];
      const notes = rawNotes.map((n) => ({
        ...n,
        folder: nf[n.name] || "",
      }));
      const selected = qnStore.selected && notes.some((n) => n.name === qnStore.selected)
        ? qnStore.selected
        : notes.length > 0 ? notes[0].name : null;
      qnStore.set({ notes, selected, loading: false, dir: res.dir || qnStore.dir });
    } else {
      qnStore.set({ loading: false });
    }
  } catch {
    qnStore.set({ loading: false });
  }
}

async function qnCreateNote(title, content) {
  try {
    const text = qnContentOrBlank(content);
    const res = await host.call("workbench.qnCreate", { title: title || "新便签", content: text });
    if (res && res.ok) {
      if (qnStore.selectedFolder) {
        const nf = { ...(qnStore.noteFolders || {}) };
        nf[res.name] = qnStore.selectedFolder;
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      qnStore.set({ selected: res.name });
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("创建失败: " + (e.message || e));
  }
  return null;
}

async function qnUpdateNote(name, content, title) {
  try {
    const text = qnContentOrBlank(content);
    const res = await host.call("workbench.qnUpdate", { name, content: text, title });
    if (res && res.ok) {
      if (res.name && res.name !== name && qnStore.noteFolders && qnStore.noteFolders[name]) {
        const nf = { ...(qnStore.noteFolders || {}) };
        nf[res.name] = nf[name];
        delete nf[name];
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      if (res.name && res.name !== name) {
        qnStore.set({ selected: res.name });
      }
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("更新失败: " + (e.message || e));
  }
  return null;
}

async function qnDeleteNote(name) {
  try {
    const res = await host.call("workbench.qnDelete", { name });
    if (res && res.ok) {
      if (qnStore.noteFolders && qnStore.noteFolders[name]) {
        const nf = { ...(qnStore.noteFolders || {}) };
        delete nf[name];
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      qnToast("便签已删除");
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("删除失败: " + (e.message || e));
  }
  return null;
}

/* 划选浮动气泡 */
function QnSelectionBubble() {
  const [bubble, setBubble] = React.useState(null);
  const bubbleRef = React.useRef(null);

  React.useEffect(() => {
    function checkSelection() {
      if (qnStore.capture === false) {
        setBubble(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setBubble(null);
        return;
      }
      const text = sel.toString().trim();
      const anchorNode = sel.anchorNode;
      const el = anchorNode && anchorNode.nodeType === 1 ? anchorNode : (anchorNode && anchorNode.parentElement);
      if (!el) {
        setBubble(null);
        return;
      }
      if (el.closest("input, textarea")) {
        setBubble(null);
        return;
      }
      // 便签编辑区（contenteditable）内的选中内容也允许划选引用
      const inEditor = el.closest(".pw-qn-typora-canvas");
      if (inEditor) {
        if (text.length < 1) {
          setBubble(null);
          return;
        }
      } else {
        if (el.closest("[data-pw-qn]")) {
          setBubble(null);
          return;
        }
        if (text.length < 4) {
          setBubble(null);
          return;
        }
        const validContainer = el.closest("[data-conversation-scroll], .pw-details, .pw-drawer-wrap, main, [data-panel]");
        if (!validContainer) {
          setBubble(null);
          return;
        }
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          setBubble(null);
          return;
        }
        const top = Math.max(10, rect.top - 40);
        const left = Math.max(10, Math.min(window.innerWidth - 180, rect.left + rect.width / 2 - 80));
        setBubble({ text, top, left, mode: inEditor ? "note" : "global" });
      } catch {
        setBubble(null);
      }
    }

    function onPointerUp() {
      setTimeout(checkSelection, 20);
    }

    function onMouseDown(e) {
      if (bubbleRef.current && bubbleRef.current.contains(e.target)) return;
      setBubble(null);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setBubble(null);
    }

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!bubble) return null;

  const isNote = bubble.mode === "note";

  return React.createElement(
    "div",
    {
      ref: bubbleRef,
      "data-pw-qn": "bubble",
      className: "pw-qn-bubble",
      style: { top: bubble.top + "px", left: bubble.left + "px" },
    },
    !isNote &&
      React.createElement(
        "button",
        {
          className: "pw-qn-bubble-btn",
          onClick: (e) => {
            e.stopPropagation();
            qnCreateNote("", bubble.text);
            setBubble(null);
          },
        },
        "存入便签",
      ),
    !isNote && React.createElement("span", { className: "pw-qn-bubble-sep" }),
    React.createElement(
      "button",
      {
        className: "pw-qn-bubble-btn accent",
        onClick: (e) => {
          e.stopPropagation();
          if (qnQuoteApi) qnQuoteApi.insert(bubble.text);
          setBubble(null);
        },
      },
      "引用到对话",
    ),
  );
}

/* 中间列定位：抽屉挂在 shell.overlay（盖住整框），必须用中间列的盒子，绝不能回退成视口全宽。
 * 列节点取 AppFrame 里 overlay / data-side 之外的第二个 grid 子项（sidebar | center | details），
 * 不碰构建哈希类。读不到中间列就保持上次宽度，避免上拉盖住左右栏。
 * 坐标相对 overlay（抽屉 position:absolute），不用 viewport fixed。 */
function qnOverlayEl() {
  return typeof document === "undefined" ? null : document.querySelector("[data-shell-overlay]");
}

function qnFrameColumns() {
  const overlay = qnOverlayEl();
  const frame = overlay && overlay.parentElement;
  if (!frame) return [];
  const cols = [];
  for (let i = 0; i < frame.children.length; i++) {
    const el = frame.children[i];
    if (el === overlay) continue;
    if (el.getAttribute("data-side")) continue;
    cols.push(el);
  }
  return cols;
}

function qnFindCenterCol() {
  const cols = qnFrameColumns();
  if (cols[1]) return cols[1];
  return typeof document === "undefined" ? null : document.querySelector("[data-conversation-scroll]");
}

function qnReadCenterBand() {
  const overlay = qnOverlayEl();
  const col = qnFindCenterCol();
  if (!overlay || !col) return null;
  const origin = overlay.getBoundingClientRect();
  const r = col.getBoundingClientRect();
  const width = Math.round(r.width);
  if (width <= 0) return null;
  return { left: Math.max(0, Math.round(r.left - origin.left)), width };
}

/* 下边栏吸底抽屉：Typora 风格编辑即预览工作台 */
function QuickNotesPanel() {
  const e = React.createElement;
  const [colRect, setColRect] = React.useState({ left: 0, width: 0 });
  const [activeNoteText, setActiveNoteText] = React.useState("");
  const [genState, setGenState] = React.useState({ kind: "idle" });
  const [renamingName, setRenamingName] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [isExporting, setIsExporting] = React.useState(false);
  const [tipInfo, setTipInfo] = React.useState(null);
  const kbDir = notesStore.current || (notesStore.dirs && notesStore.dirs[0]) || null;
  const canvasRef = React.useRef(null);
  const autoSaveTimerRef = React.useRef(null);
  const currentLoadingNoteRef = React.useRef(null);
  const [prevHeight, setPrevHeight] = React.useState(null);
  const maxDrawerHeight = typeof window !== "undefined" ? Math.max(400, window.innerHeight - 48) : 800;
  const isMaximized = qnStore.height >= maxDrawerHeight - 20;

  const handleToggleMaximize = () => {
    if (isMaximized) {
      const restored = prevHeight && prevHeight >= 200 ? prevHeight : 320;
      qnStore.set({ height: restored });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(restored));
        }
      } catch {}
    } else {
      setPrevHeight(qnStore.height);
      qnStore.set({ height: maxDrawerHeight });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(maxDrawerHeight));
        }
      } catch {}
    }
  };

  /* 左栏宽度与可拖拽 resizer */
  const [listWidth, setListWidth] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? Number(window.localStorage.getItem("pw-qn-list-width")) : 0;
      if (v >= 140 && v <= 480) return v;
    } catch {}
    return 240;
  });

  /* 目录栏展开态与宽度（Apple Notes 风格 3 栏支持） */
  const [showFolders, setShowFolders] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("pw-qn-show-folders") : null;
      if (v !== null) return v === "true";
    } catch {}
    return true;
  });

  const [folderWidth, setFolderWidth] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? Number(window.localStorage.getItem("pw-qn-folder-width")) : 0;
      if (v >= 120 && v <= 320) return v;
    } catch {}
    return 150;
  });

  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderVal, setNewFolderVal] = React.useState("");
  const [renamingFolder, setRenamingFolder] = React.useState(null);
  const [renameFolderVal, setRenameFolderVal] = React.useState("");
  const [draggingNote, setDraggingNote] = React.useState(null);
  const [dragOverFolder, setDragOverFolder] = React.useState(null);
  /* 两击确认删除：复用 06-misc 共享状态机 useTwoClick（armed id 用便签 name），
   * 与 03 树删除 / 08 会话归档 / 09 worktree 同源，不再手抄 useState。 */
  const cnf = useTwoClick();

  const onFolderResizerStart = (ev) => {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = folderWidth;
    let latestW = startW;
    const onMove = (moveEv) => {
      const delta = moveEv.clientX - startX;
      latestW = Math.max(120, Math.min(320, startW + delta));
      setFolderWidth(latestW);
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-folder-width", String(latestW));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const onResizerStart = (ev) => {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = listWidth;
    let latestW = startW;
    const onMove = (moveEv) => {
      const delta = moveEv.clientX - startX;
      latestW = Math.max(140, Math.min(480, startW + delta));
      setListWidth(latestW);
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-list-width", String(latestW));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  /* 跟踪中间列位置：观察三列本身（拖左右栏时 frame 宽度不变，只观察 frame 会漏） */
  React.useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    const update = () => {
      const r = qnReadCenterBand();
      if (!r) return;
      setColRect((prev) => (prev.left !== r.left || prev.width !== r.width ? r : prev));
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) {
      const cols = qnFrameColumns();
      for (let i = 0; i < cols.length; i++) ro.observe(cols[i]);
      const scroll = document.querySelector("[data-conversation-scroll]");
      if (scroll) ro.observe(scroll);
    }
    window.addEventListener("resize", update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [qnStore.open]);

  /* 会话列挤压 padding-bottom（只垫滚动口，不碰哈希类） */
  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const col = document.querySelector("[data-conversation-scroll]");
    if (!col) return undefined;
    if (!col.style.transition) col.style.transition = "padding-bottom var(--ds-transition-duration-slow) var(--ds-ease-in-out)";
    col.style.paddingBottom = qnStore.open ? qnStore.height + "px" : "0px";
    return () => {
      col.style.paddingBottom = "0px";
    };
  }, [qnStore.open, qnStore.height]);

  /* 打开时加载便签 */
  React.useEffect(() => {
    if (qnStore.open && qnStore.notes === null) {
      qnLoadNotes();
    }
  }, [qnStore.open]);

  /* 切换便签时，加载 Markdown 并渲染为 Typora 可视化内容 */
  React.useEffect(() => {
    if (qnStore.selected) {
      currentLoadingNoteRef.current = qnStore.selected;
      host.call("workbench.qnRead", { name: qnStore.selected }).then((res) => {
        if (res && res.ok && currentLoadingNoteRef.current === qnStore.selected) {
          const text = res.text || "";
          setActiveNoteText(text);
          if (canvasRef.current) {
            canvasRef.current.innerHTML = qnMdToHtml(text);
          }
        }
      }).catch(() => {
        setActiveNoteText("");
        if (canvasRef.current) canvasRef.current.innerHTML = "<p><br></p>";
      });
    } else {
      setActiveNoteText("");
      if (canvasRef.current) canvasRef.current.innerHTML = "";
    }
  }, [qnStore.selected]);

  const pendingSaveRef = React.useRef(null);
  const flushSave = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { name, md, title } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      await qnUpdateNote(name, md, title);
    }
  };

  /* 组件卸载时安全刷盘 */
  React.useEffect(() => {
    return () => {
      flushSave();
    };
  }, []);

  /* 切换目录或便签列表变更时，自动保持选中项与当前目录视图一致 */
  React.useEffect(() => {
    if (!qnStore.open) return;
    const curList = qnStore.selectedFolder === null
      ? (qnStore.notes || [])
      : (qnStore.notes || []).filter((n) => n.folder === qnStore.selectedFolder);
    if (qnStore.selected && !curList.some((n) => n.name === qnStore.selected)) {
      qnStore.set({ selected: curList.length > 0 ? curList[0].name : null });
    }
  }, [qnStore.selectedFolder, qnStore.notes, qnStore.open, qnStore.selected]);

  if (!qnStore.open) return null;
  if (colRect.width <= 0) return null;

  /* 顶部高度拖拽手柄 */
  const onDragStart = (ev) => {
    ev.preventDefault();
    const startY = ev.clientY;
    const startH = qnStore.height;
    let latestH = startH;
    const onMove = (moveEv) => {
      const delta = startY - moveEv.clientY;
      latestH = Math.max(180, Math.min(maxDrawerHeight, startH + delta));
      qnStore.set({ height: latestH });
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(latestH));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const notes = qnStore.notes || [];
  const visibleNotes = qnStore.selectedFolder === null
    ? notes
    : notes.filter((n) => n.folder === qnStore.selectedFolder);
  const selectedNote = visibleNotes.find((n) => n.name === qnStore.selected) || null;

  /* 编辑即预览：内容输入变更（序列化为 Markdown 并自动保存） */
  const onEditorInput = () => {
    if (!canvasRef.current || !selectedNote) return;
    const newMd = qnHtmlToMd(canvasRef.current);
    setActiveNoteText(newMd);
    const derived = qnDeriveTitle(newMd, selectedNote.title);
    pendingSaveRef.current = { name: selectedNote.name, md: newMd, title: derived };

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 350);
  };

  /* 待办清单点击切换：点击 Checkbox 实时切换勾选态并同步 Markdown */
  const onCanvasClick = (ev) => {
    if (ev.target && ev.target.type === "checkbox") {
      const li = ev.target.closest("li.pw-qn-task");
      if (li) {
        if (ev.target.checked) li.classList.add("checked");
        else li.classList.remove("checked");
      }
      onEditorInput();
    }
  };

  /* 剪贴板图片直接粘贴：Typora 体验——直接插入可见图片，并更新序列化 Markdown */
  const handlePaste = (ev) => {
    const items = ev.clipboardData && ev.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        ev.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (uploadEv) => {
          const dataUrl = uploadEv.target.result;
          const img = document.createElement("img");
          img.src = dataUrl;
          img.alt = "图片";
          img.style.maxWidth = "100%";
          img.style.borderRadius = "6px";
          img.style.margin = "8px 0";
          img.style.display = "block";
          img.onclick = (e) => {
            e.stopPropagation();
            if (typeof imgZoomStore !== "undefined" && imgZoomStore.set) {
              imgZoomStore.set(dataUrl);
            }
          };

          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            if (img.parentNode) {
              img.parentNode.insertBefore(p, img.nextSibling);
            }
            range.setStartAfter(img);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else if (canvasRef.current) {
            canvasRef.current.appendChild(img);
          }
          onEditorInput();
          qnToast("图片已粘贴");
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  /* AI 智能生成标题并改名（逻辑完全对齐 dsh-geek-header） */
  /* 使用 AI 模型根据内容提炼标题并同步重命名当前便签（保持所在目录不变） */
  const handleGenerateTitle = async () => {
    if (genState.kind === "busy") return;
    const content = activeNoteText || (canvasRef.current ? qnHtmlToMd(canvasRef.current) : "");
    if (!selectedNote || !content.trim()) {
      qnToast("便签内容为空，无法生成标题");
      return;
    }
    await flushSave();
    const origName = selectedNote.name;
    const origFolder = selectedNote.folder || (qnStore.noteFolders && qnStore.noteFolders[origName]);

    setGenState({ kind: "busy" });
    try {
      const sid = qnActiveSid();
      let route = null;
      try {
        const dirs = qnAppCtx ? qnAppCtx.get("modelDirectories") : null;
        if (dirs && sid) {
          const directory = dirs.directoryFor(sid);
          const models = await directory.load();
          const current = models && models.current;
          if (current && current.provider && current.model) {
            route = { provider: current.provider, model: current.model };
          }
        }
      } catch {}

      if (!route) {
        try {
          const sessions = qnAppCtx ? qnAppCtx.get("sessions") : null;
          if (sessions && sessions.list) {
            const snap = sessions.list.getSnapshot();
            const curId = sid || snap.current;
            const curSess = curId && snap.byId ? snap.byId[curId] : null;
            if (curSess && curSess.projectionValues && curSess.projectionValues.modelSelection) {
              const ms = curSess.projectionValues.modelSelection;
              const cur = ms.next || ms.lastUsed;
              if (cur && cur.provider && cur.model) {
                route = { provider: cur.provider, model: cur.model };
              }
            }
          }
        } catch {}
      }

      if (!route) {
        route = { provider: "turing", model: "turing/gemini-3.8-flash" };
      }

      const res = await host.call("workbench.qnGenTitle", {
        name: origName,
        content,
        sessionId: sid,
        ...route,
      });

      if (res && res.ok && res.title) {
        /* 关键修复：便签改名后必须同步更新目录归属，避免便签脱离原文件夹 */
        if (res.name && res.name !== origName && origFolder) {
          const nf = { ...(qnStore.noteFolders || {}) };
          nf[res.name] = origFolder;
          delete nf[origName];
          await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
        }
        setGenState({ kind: "done" });
        qnToast("AI 标题已生成: " + res.title);
        await qnLoadNotes(qnStore.q);
        if (res.name) qnStore.set({ selected: res.name });
        setTimeout(() => setGenState({ kind: "idle" }), 2000);
      } else {
        setGenState({ kind: "error" });
        qnToast("生成标题失败: " + ((res && res.error) || "未知原因"));
        setTimeout(() => setGenState({ kind: "idle" }), 3000);
      }
    } catch (err) {
      setGenState({ kind: "error" });
      qnToast("生成失败: " + (err.message || err));
      setTimeout(() => setGenState({ kind: "idle" }), 3000);
    }
  };

  /* 新建便签（内容空白，标题为新便签） */
  const handleCreateNew = async () => {
    const res = await qnCreateNote("新便签");
    if (res && res.ok) {
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
      }, 50);
    }
  };

  /* 顶栏即时悬停气泡调度（0ms 响应，浮动置顶） */
  const showTip = (ev, text) => {
    if (!text) return;
    const r = ev.currentTarget.getBoundingClientRect();
    setTipInfo({
      text,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top - 7),
    });
  };

  const hideTip = () => {
    setTipInfo(null);
  };

  /* 同步到当前项目（纯复制写盘，不删除源便签） */
  const handleSyncToProject = async () => {
    if (isExporting) return;
    if (!selectedNote) {
      qnToast("请先选择或新建便签");
      return;
    }
    if (!currentRootPath) {
      qnToast("当前未打开任何项目");
      return;
    }
    setIsExporting(true);
    try {
      await flushSave();
      let res = await host
        .call("workbench.qnSyncTo", {
          name: selectedNote.name,
          targetDir: currentRootPath,
        })
        .catch(() => null);

      if (!res || !res.ok) {
        /* 热插拔自愈兜底：若后台尚未重启生效新路由，经 qnMoveToKb 并在源端保留副本实现同步 */
        const text = activeNoteText;
        const prevKb = notesStore.current || (notesStore.dirs && notesStore.dirs[0]);
        await host.call("workbench.notesSelect", { dir: currentRootPath }).catch(() => {});
        res = await host
          .call("workbench.qnMoveToKb", {
            name: selectedNote.name,
            targetDir: currentRootPath,
          })
          .catch(() => null);
        if (prevKb && prevKb !== currentRootPath) {
          await host.call("workbench.notesSelect", { dir: prevKb }).catch(() => {});
        }
        /* 关键：同步语义绝不删除源便签，立刻将源便签恢复写回便签池 */
        await host.call("workbench.qnCreate", { title: selectedNote.title, content: text }).catch(() => {});
        qnStore.set({ selected: selectedNote.name });
      }

      if (res && res.ok) {
        qnToast("已同步到项目: " + baseName(res.path));
        await qnLoadNotes(qnStore.q);
      } else {
        qnToast("同步失败: " + ((res && res.error) || "未知错误"));
      }
    } catch (e) {
      qnToast("同步异常: " + (e.message || e));
    } finally {
      setIsExporting(false);
    }
  };

  /* 同步到当前知识库（纯复制写盘，不删除源便签） */
  const handleSyncToKb = async () => {
    if (isExporting) return;
    if (!selectedNote) {
      qnToast("请先选择或新建便签");
      return;
    }
    setIsExporting(true);
    try {
      await flushSave();
      let target = kbDir;
      if (!target) {
        const base = pathDir(currentRootPath || "") || "~";
        const defDir = pathJoinFor(base, "知识库");
        const resDef = await host.call("workbench.notesSelect", { dir: defDir });
        if (resDef && resDef.current) target = resDef.current;
      }
      if (!target) {
        qnToast("请先在左侧选择知识库目录");
        return;
      }
      let res = await host
        .call("workbench.qnSyncTo", {
          name: selectedNote.name,
          targetDir: target,
        })
        .catch(() => null);

      if (!res || !res.ok) {
        /* 热插拔自愈兜底：若后台尚未重启生效新路由，经 qnMoveToKb 并在源端保留副本实现同步 */
        const text = activeNoteText;
        res = await host
          .call("workbench.qnMoveToKb", {
            name: selectedNote.name,
            targetDir: target,
          })
          .catch(() => null);
        /* 关键：同步语义绝不删除源便签，立刻将源便签恢复写回便签池 */
        await host.call("workbench.qnCreate", { title: selectedNote.title, content: text }).catch(() => {});
        qnStore.set({ selected: selectedNote.name });
      }

      if (res && res.ok) {
        qnToast("已同步到知识库: " + baseName(res.path));
        await qnLoadNotes(qnStore.q);
      } else {
        qnToast("同步失败: " + ((res && res.error) || "未知错误"));
      }
    } catch (e) {
      qnToast("同步异常: " + (e.message || e));
    } finally {
      setIsExporting(false);
    }
  };

  /* 目录 @ 引用功能：目录下每个便签按各自文件路径插成 @ 提及（与侧边栏文件 @ 同机制） */
  const handleQuoteFolder = (folderName) => {
    const allNotes = qnStore.notes || [];
    const folderNotes = folderName === null
      ? allNotes
      : allNotes.filter((n) => n.folder === folderName);

    if (folderNotes.length === 0) {
      qnToast("该目录下暂无便签可引用");
      return;
    }
    const sid = qnActiveSid();
    if (!sid) {
      qnToast("无活跃会话，无法引用");
      return;
    }
    let okCount = 0;
    for (const n of folderNotes) {
      if (qnMentionNote(sid, n.name)) okCount++;
    }
    if (okCount > 0) {
      qnToast("已引用 " + okCount + " 个便签");
    } else {
      qnToast("引用失败，请稍后重试");
    }
  };

  return e(
    "div",
    {
      "data-pw-qn": "geek-notes",
      className: "pw-qn-drawer",
      style: {
        left: colRect.left + "px",
        width: colRect.width + "px",
        height: qnStore.height + "px",
      },
    },
    /* 顶部拖拽手柄（标准细线风格，悬停微弱高亮，无原生提示框） */
    e("div", {
      className: "pw-qn-drag",
      onPointerDown: onDragStart,
    }),

    /* 极简顶栏（与侧栏通体同色背景，标准 1px 分割线） */
    e(
      "div",
      { className: "pw-qn-header" },
      /* 左侧操作组：+ 图标、紧凑搜索框、AI 生成标题 */
      e(
        "div",
        { className: "pw-qn-header-left" },
        /* 目录栏展开/收起缩放按钮（加号左边） */
        e(
          "button",
          {
            className: "pw-icon-btn" + (showFolders ? " active" : ""),
            onMouseEnter: (ev) => showTip(ev, showFolders ? "收起目录栏" : "展开目录栏"),
            onMouseLeave: hideTip,
            onClick: () => {
              const next = !showFolders;
              setShowFolders(next);
              qnStore.set({ showFolders: next });
              try { window.localStorage.setItem("pw-qn-show-folders", String(next)); } catch {}
            },
          },
          SidebarToggleIcon(14),
        ),
        /* 新建便签 +：标准 pw-icon-btn 风格与 PlusIcon(13) */
        e(
          "button",
          {
            className: "pw-icon-btn",
            onMouseEnter: (ev) => showTip(ev, "新建便签"),
            onMouseLeave: hideTip,
            onClick: handleCreateNew,
          },
          PlusIcon(13),
        ),
        /* 新增目录按钮（加号右边） */
        e(
          "button",
          {
            className: "pw-icon-btn",
            onMouseEnter: (ev) => showTip(ev, "新建目录"),
            onMouseLeave: hideTip,
            onClick: () => {
              if (!showFolders) {
                setShowFolders(true);
                qnStore.set({ showFolders: true });
                try { window.localStorage.setItem("pw-qn-show-folders", "true"); } catch {}
              }
              setIsCreatingFolder(true);
              setNewFolderVal("");
            },
          },
          FolderPlusIcon(14),
        ),
        /* 紧凑搜索框（与侧栏统一规范） */
        e(
          "div",
          { className: "pw-qn-search-wrap" },
          e("span", { className: "pw-qn-search-ico" }, SearchIcon(12)),
          e("input", {
            className: "pw-qn-search-input",
            placeholder: "搜索便签...",
            value: qnStore.q || "",
            onChange: (ev) => {
              const q = ev.target.value;
              qnStore.set({ q });
              qnLoadNotes(q);
            },
          }),
        ),
        /* 生成标题按钮（纯文字，与搜索框高度严格一致） */
        e(
          "button",
          {
            className: "pw-qn-gen-btn" + (genState.kind === "busy" ? " busy" : ""),
            disabled: genState.kind === "busy" || !selectedNote,
            title: "使用 AI 模型根据便签内容生成标题并改名",
            onClick: handleGenerateTitle,
          },
          genState.kind === "busy"
            ? "生成中…"
            : genState.kind === "done"
            ? "标题已更新"
            : "生成标题",
        ),
        /* 对称同步按键组：透明排布，间距仅 2px，颜色淡雅 */
        e(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "2px" } },
          /* 同步到当前项目（左箭头）：独立图标按钮，淡雅色调 */
          e(
            "button",
            {
              className: "pw-icon-btn pw-qn-sync-btn" + (!selectedNote ? " is-disabled" : ""),
              disabled: isExporting,
              onMouseEnter: (ev) =>
                showTip(
                  ev,
                  currentRootPath
                    ? `同步到项目：将当前便签同步保存到项目 (${shortenPath(currentRootPath)})`
                    : "同步到项目：将当前便签同步保存到当前项目根目录"
                ),
              onMouseLeave: hideTip,
              onClick: handleSyncToProject,
            },
            ForkProjectIcon(15),
          ),
          /* 同步到当前知识库（右箭头）：独立图标按钮，淡雅色调 */
          e(
            "button",
            {
              className: "pw-icon-btn pw-qn-sync-btn" + (!selectedNote ? " is-disabled" : ""),
              disabled: isExporting,
              onMouseEnter: (ev) =>
                showTip(
                  ev,
                  kbDir
                    ? `同步到知识库：将当前便签同步保存到知识库 (${shortenPath(kbDir)})`
                    : "同步到知识库：将当前便签同步保存到知识库目录"
                ),
              onMouseLeave: hideTip,
              onClick: handleSyncToKb,
            },
            ForkKbIcon(15),
          ),
        ),
      ),

      /* 右侧：与侧栏「«」/右栏「»」风格完全一致的双向下尖角折叠符 */
      /* 右侧功能组：向上最大化/还原 + 向下收起折叠符（风格完全一致，方向相反） */
      e(
        "div",
        { className: "pw-qn-header-right" },
        /* 向上扩大便签抽屉到最大 / 还原高度 */
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: isMaximized ? "还原高度" : "向上扩到最大",
            onClick: handleToggleMaximize,
          },
          isMaximized ? CollapseIcon(13) : ExpandIcon(13),
        ),
        /* 收起下栏 (Esc) */
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: "收起下栏 (Esc)",
            onClick: () => qnStore.set({ open: false }),
          },
          e("span", { className: "pw-qn-collapse-icon" }, "»"),
        ),
      ),
    ),

    /* 主体三栏：目录列 + 便签列表列 + Typora 编辑区（参考 Apple 备忘录架构） */
    e(
      "div",
      { className: "pw-qn-body" },
      /* 第一栏：目录栏（可展开/收起，含「全部便签」与自定义目录） */
      showFolders &&
        e(
          "div",
          {
            className: "pw-qn-col-folders",
            style: { width: folderWidth + "px" },
          },
          /* 全部便签（跨目录查看全部，支持拖入移出目录） */
          e(
            "div",
            {
              className: "pw-qn-folder-item" + (qnStore.selectedFolder === null ? " active" : "") + (dragOverFolder === "__all__" ? " drag-over" : ""),
              onClick: () => qnStore.set({ selectedFolder: null }),
              onDragOver: (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
              },
              onDragEnter: (ev) => {
                ev.preventDefault();
                setDragOverFolder("__all__");
              },
              onDragLeave: (ev) => {
                if (dragOverFolder === "__all__") setDragOverFolder(null);
              },
              onDrop: async (ev) => {
                ev.preventDefault();
                setDragOverFolder(null);
                const n = ev.dataTransfer.getData("text/plain") || draggingNote;
                if (n) await qnMoveNoteToFolder(n, "");
              },
            },
            e("span", { className: "pw-qn-folder-ico" }, AllNotesIcon(13)),
            e("span", { className: "pw-qn-folder-name" }, "全部便签"),
            e("span", { className: "pw-qn-folder-count" }, notes.length),
            /* 悬停快捷按钮：引用全部便签到输入框 @ */
            e(
              "div",
              {
                className: "pw-qn-folder-acts",
                onClick: (ev) => ev.stopPropagation(),
              },
              e(
                "button",
                {
                  className: "pw-qn-folder-act-btn",
                  title: "引用全部便签到输入框 (@)",
                  onClick: () => handleQuoteFolder(null),
                },
                AtIcon(11),
              ),
            ),
          ),
          /* 用户自定义目录项（无冗余「我的目录」行，支持拖拽放置） */
          (qnStore.folders || []).map((f) => {
            const count = notes.filter((n) => n.folder === f).length;
            if (renamingFolder === f) {
              return e(
                "div",
                { key: f, className: "pw-qn-folder-item active" },
                e("input", {
                  className: "pw-qn-folder-input",
                  value: renameFolderVal,
                  autoFocus: true,
                  onFocus: (ev) => ev.target.select(),
                  onChange: (ev) => setRenameFolderVal(ev.target.value),
                  onKeyDown: (ev) => {
                    if (ev.key === "Enter") {
                      qnRenameFolder(f, renameFolderVal);
                      setRenamingFolder(null);
                    } else if (ev.key === "Escape") {
                      setRenamingFolder(null);
                    }
                  },
                  onBlur: () => {
                    if (renameFolderVal.trim() && renameFolderVal.trim() !== f) {
                      qnRenameFolder(f, renameFolderVal);
                    }
                    setRenamingFolder(null);
                  },
                }),
              );
            }
            return e(
              "div",
              {
                key: f,
                className: "pw-qn-folder-item" + (qnStore.selectedFolder === f ? " active" : "") + (dragOverFolder === f ? " drag-over" : ""),
                onClick: () => qnStore.set({ selectedFolder: f }),
                onDragOver: (ev) => {
                  ev.preventDefault();
                  ev.dataTransfer.dropEffect = "move";
                },
                onDragEnter: (ev) => {
                  ev.preventDefault();
                  setDragOverFolder(f);
                },
                onDragLeave: (ev) => {
                  if (dragOverFolder === f) setDragOverFolder(null);
                },
                onDrop: async (ev) => {
                  ev.preventDefault();
                  setDragOverFolder(null);
                  const n = ev.dataTransfer.getData("text/plain") || draggingNote;
                  if (n) await qnMoveNoteToFolder(n, f);
                },
              },
              e("span", { className: "pw-qn-folder-ico" }, FolderSimpleIcon(13)),
              e("span", { className: "pw-qn-folder-name", title: f }, f),
              e("span", { className: "pw-qn-folder-count" }, count),
              /* 鼠标悬停出现引用、重命名、删除按钮 */
              e(
                "div",
                {
                  className: "pw-qn-folder-acts",
                  onClick: (ev) => ev.stopPropagation(),
                },
                /* 引用该目录到输入框 @ */
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: `引用目录「${f}」全部便签到输入框 (@)`,
                    onClick: () => handleQuoteFolder(f),
                  },
                  AtIcon(11),
                ),
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: "重命名目录",
                    onClick: () => {
                      setRenamingFolder(f);
                      setRenameFolderVal(f);
                    },
                  },
                  PencilIcon(10),
                ),
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: "删除目录",
                    onClick: () => qnDeleteFolder(f),
                  },
                  TrashIcon(10),
                ),
              ),
            );
          }),
          /* 新增目录输入框 */
          isCreatingFolder &&
            e(
              "div",
              { className: "pw-qn-folder-item active" },
              e("input", {
                className: "pw-qn-folder-input",
                placeholder: "新目录名称...",
                value: newFolderVal,
                autoFocus: true,
                onChange: (ev) => setNewFolderVal(ev.target.value),
                onKeyDown: (ev) => {
                  if (ev.key === "Enter") {
                    if (newFolderVal.trim()) {
                      qnCreateFolder(newFolderVal.trim());
                    }
                    setIsCreatingFolder(false);
                  } else if (ev.key === "Escape") {
                    setIsCreatingFolder(false);
                  }
                },
                onBlur: () => {
                  if (newFolderVal.trim()) {
                    qnCreateFolder(newFolderVal.trim());
                  }
                  setIsCreatingFolder(false);
                },
              }),
            ),
        ),

      /* 目录栏与列表栏之间的调整线 */
      showFolders &&
        e("div", {
          className: "pw-qn-col-resizer",
          onPointerDown: onFolderResizerStart,
        }),

      /* 第二栏：便签列表（根据选中目录筛选展示） */
      e(
        "div",
        {
          className: "pw-qn-col-list",
          style: { width: listWidth + "px" },
        },
        qnStore.loading && visibleNotes.length === 0
          ? e("div", { className: "pw-qn-empty-hint" }, "载入中…")
          : visibleNotes.length === 0
          ? e(
              "div",
              { className: "pw-qn-empty-hint" },
              qnStore.selectedFolder
                ? `目录「${qnStore.selectedFolder}」暂无便签\n点击上方「+」新建`
                : "无便签\n点击上方「+」新建",
            )
          : visibleNotes.map((item) => {
              const thumb = qnExtractFirstImage(item.preview || "");
              const isCur = qnStore.selected === item.name;
              const isRenaming = renamingName === item.name;

              return e(
                "div",
                {
                  key: item.name,
                  className: "pw-qn-side-item" + (isCur ? " active" : "") + (draggingNote === item.name ? " is-dragging" : ""),
                  draggable: !isRenaming,
                  onDragStart: (ev) => {
                    ev.dataTransfer.setData("text/plain", item.name);
                    ev.dataTransfer.effectAllowed = "move";
                    setDraggingNote(item.name);
                  },
                  onDragEnd: () => {
                    setDraggingNote(null);
                    setDragOverFolder(null);
                  },
                  onClick: async () => {
                    if (isRenaming) return;
                    await flushSave();
                    qnStore.set({ selected: item.name });
                  },
                },
                e(
                  "div",
                  { className: "pw-qn-side-main" },
                  isRenaming
                    ? e("input", {
                        className: "pw-qn-rename-input",
                        autoFocus: true,
                        value: renameVal,
                        onFocus: (ev) => ev.target.select(),
                        onClick: (ev) => ev.stopPropagation(),
                        onChange: (ev) => setRenameVal(ev.target.value),
                        onKeyDown: async (ev) => {
                          if (ev.key === "Enter") {
                            ev.stopPropagation();
                            const newT = renameVal.trim();
                            setRenamingName(null);
                            if (newT && newT !== item.title) {
                              await qnUpdateNote(item.name, item.preview || " ", newT);
                            }
                          } else if (ev.key === "Escape") {
                            ev.stopPropagation();
                            setRenamingName(null);
                          }
                        },
                        onBlur: async () => {
                          const newT = renameVal.trim();
                          setRenamingName(null);
                          if (newT && newT !== item.title) {
                            await qnUpdateNote(item.name, item.preview || " ", newT);
                          }
                        },
                      })
                    : e("div", { className: "pw-qn-side-title", title: item.title }, item.title || "无标题"),
                  e(
                    "div",
                    { className: "pw-qn-side-row" },
                    e("span", { className: "pw-qn-side-time" }, qnFormatAppleDate(item.mtime)),
                    /* 显示目录归属标签（参考苹果备忘录） */
                    item.folder
                      ? e(
                          "span",
                          {
                            className: "pw-qn-side-folder-tag",
                            title: "所属目录：" + item.folder,
                            onClick: (ev) => {
                              ev.stopPropagation();
                              qnStore.set({ selectedFolder: item.folder });
                            },
                          },
                          FolderSimpleIcon(9),
                          item.folder,
                        )
                      : null,
                    e("span", { className: "pw-qn-side-snippet" }, qnStripMarkdown(item.preview || "无内容")),
                  ),
                ),
                thumb && e("img", { src: thumb, className: "pw-qn-side-thumb", alt: "" }),
                /* 鼠标悬停在卡片上展现的标准尺寸按钮组（与侧边栏 session-row 完全同款：pw-row-acts + pw-act-btn） */
                !isRenaming &&
                  (cnf[0] === item.name
                    ? e(
                        "div",
                        { className: "pw-row-acts" },
                        /* 确认删除（二次点击才真正删除） */
                        e(
                          "button",
                          {
                            className: "pw-act-btn danger",
                            title: "确认删除该便签",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[2]();
                              qnDeleteNote(item.name);
                            },
                          },
                          "✓",
                        ),
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "取消删除",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[2]();
                            },
                          },
                          "×",
                        ),
                      )
                    : e(
                        "div",
                        { className: "pw-row-acts" },
                        /* 引用到对话 @ */
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "引用到输入框",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              const sid = qnActiveSid();
                              if (!sid) {
                                qnToast("无活跃会话，无法引用");
                                return;
                              }
                              if (qnMentionNote(sid, item.name)) {
                                qnToast("已引用到输入框");
                              } else {
                                qnToast("引用失败，请稍后重试");
                              }
                            },
                          },
                          AtIcon(13),
                        ),
                        /* 改名 */
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "重命名",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              setRenamingName(item.name);
                              setRenameVal(item.title || "");
                            },
                          },
                          PencilIcon(13),
                        ),
                        /* 删除 */
                        e(
                          "button",
                          {
                            className: "pw-act-btn danger",
                            title: "删除便签（需确认）",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[1](item.name);
                            },
                          },
                          TrashIcon(13),
                        ),
                      )
                  ),
              );
            }),
      ),

      /* 纵向拖拽调整线（标准细线风格，悬停微弱高亮，与全局边框粗细完全一致） */
      e("div", {
        className: "pw-qn-col-resizer",
        onPointerDown: onResizerStart,
      }),

      /* 第三栏：Typora 风格纯粹编辑即预览（全高度沉浸画布） */
      e(
        "div",
        { className: "pw-qn-col-paper" },
        selectedNote
          ? e("div", {
              ref: canvasRef,
              className: "pw-qn-typora-canvas",
              contentEditable: true,
              suppressContentEditableWarning: true,
              onInput: onEditorInput,
              onPaste: handlePaste,
              onClick: onCanvasClick,
            })
          : null,
      ),
    ),

    /* 悬浮 Toast 提示 */
    qnStore.toast && e("div", { className: "pw-qn-toast" }, qnStore.toast),

    /* 顶栏即时浮动气泡（0ms 响应，置顶防 overflow 裁剪） */
    tipInfo
      ? e(
          "div",
          {
            className: "pw-qn-tip",
            style: { left: tipInfo.x + "px", top: tipInfo.y + "px" },
          },
          tipInfo.text,
        )
      : null,
  );
}

function QuickNotesHost() {
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);

  React.useEffect(() => {
    function onKeyDown(ev) {
      if (ev.key === "Escape" && qnStore.open) {
        qnStore.set({ open: false });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(QnSelectionBubble, null),
    React.createElement(QuickNotesPanel, null),
  );
}

return {
  apply(t) {
    const e = t.get("slots");
    if (e === void 0) return;
    const s = t.get("layout"),
      o = t.get("sessions"),
      a = t.get("workspaces");
    (mountStyle(API + "/wb/style.css?v=2.0.5&t=" + Date.now()),
      host
        .call("workbench.notesGet", {})
        .then((u) => {
          u && notesStore.set(u);
        })
        .catch(() => {}),
      host
        .call("workbench.qnState", {})
        .then((u) => {
          u && u.ok && qnStore.set({ dir: u.dir, custom: u.custom, capture: u.capture });
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
    /* @文件引用走 rc.8 原生 ui-reference 源（reference 组），插件不再注册
       * 自有 workbenchFile 组（v1.16.0 起移除，能力重叠）。
       * 侧栏/详情"提及"仍走 dshFileMention 桥，但改投 slash/input-insert-reference
       * 插成本地 chip（复用 reference 源 codec），与输入框原生 @ 一致。 */
    (e.inject("sidebar.workspaces", () =>
        e.register({ name: "sidebar.workspaces", priority: -5 }, (u) =>
          React.createElement(Sidebar, {
            wide: u.wide,
            useSessions: u.useSessions,
            useWorkspaces: u.useWorkspaces,
            layout: s,
            sessionsSvc: o,
            workspacesSvc: a,
            workspaceNav: t.get("uiWorkspace"),
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
      /* 0.1.5：'details' 槽已从平台移除（ui-layout 不再声明），此处不再注册 PanelHost；
       * 预览唯一宿主改为常驻 drawer（13-drawer），dshDetailsPanels 服务面保留不变。 */
      /* chat 产出文件 chip / 工具卡文件链接点击接管（15-deliv）：平台 openFile 走
       * 系统默认应用（外部打开），capture 拦普通左键改道应用内预览（drawer）；修饰键点击
       * 保留系统打开。cwd 跟踪在 09-sidebar 的会话订阅效应（sessionCwd）。 */
      installDelivChipHook(),
      /* 便签小胶囊引用源通道注册（15-quicknotes）：通过 inputTriggers 注册 @geek-notes-quote 源 */
      installQnQuote(t),
      /* DirPicker 单实例宿主：多处路径选择（项目/笔记/便签）共用的应用内目录选择模态 */
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-dir-picker" }, () => React.createElement(DirPickerHost, null)),
      ),
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-quick-notes" }, () => React.createElement(QuickNotesHost, null)),
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

    function shortenPath(p) { return String(p || '').replace(/^\/(?:Users|home)\/[^/]+/, '~').replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+/, '~') }
    /* 展示用拼接：按基准路径自身的分隔符风格（Windows 反斜杠路径不混入正斜杠） */
    function joinDisplay(base, leaf) {
      const s = String(base || '')
      const sep = s.includes('\\') ? '\\' : '/'
      return s.replace(/[\\/]+$/, '') + sep + leaf
    }
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
      const installPath = scope === 'global' ? joinDisplay(shortenPath(props.globalDir), '') : joinDisplay(shortenPath(props.cwd), '.agents/skills/')

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
                    h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: 'global 技能目录' }, joinDisplay(shortenPath(globalDir), '')),
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
    /* uiWorkspace / workspaces / layout：workbench 硬依赖；未声明时 fiber 可在服务就绪前
     * apply，ctx.get("uiWorkspace") 得 undefined 且闭包固化——「＋ 新建」静默无反应。 */
    exports.inject = ['sessions', 'slots', 'uiWorkspace', 'workspaces', 'layout']
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
