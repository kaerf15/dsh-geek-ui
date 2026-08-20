const P = "pw-",
  store = {
    buckets: {},
    bucket(t) {
      const e = t || "_";
      return (
        store.buckets[e] || (store.buckets[e] = { files: [], active: null }),
        store.buckets[e]
      );
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
    fire() {
      for (const t of bus.fns.slice()) t();
    },
    sub(t) {
      return (
        bus.fns.push(t),
        () => {
          const e = bus.fns.indexOf(t);
          e >= 0 && bus.fns.splice(e, 1);
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
function shortPath(t) {
  return t ? t.replace(/^\/Users\/[^/]+/, "~") : "";
}
function canonPath(t) {
  return String(t || "")
    .replace(/\/+$/, "")
    .toLowerCase();
}
/* 跨文件共享的工作区态：当前项目根（@提及/终端 cwd/技能弹窗用）与文件管理器展开偏好。
 * 全部在渲染/回调期读写（无求值期依赖），声明放 stores 文件合乎归属（原寄居 05-icons 末尾）。 */
let explorerOpenPref = !0,
  currentRootPath = null;