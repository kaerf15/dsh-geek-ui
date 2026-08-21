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