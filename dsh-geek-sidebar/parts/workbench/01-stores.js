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
/* ===== 分栏支持：预览桶按「会话::tab 实例」分键 =====
 * 0.1.5 右栏可分栏，同一会话可并存多个预览实例；共用会话桶会镜像成同一份。
 * occurList 登记存活实例与最近交互时刻；写入路径（树/聊天打开）落在该会话
 * 最近交互的实例上（同刻取后挂载者）。无存活实例时落会话裸桶（sid 本身），
 * 首个挂载的空实例收养它——收养即移空，双栏同时挂载不互抢。 */
const occurList = [];
function occurAdd(key, sid) {
  occurRemove(key);
  occurList.push({ key, sid, touch: 0 });
}
function occurRemove(key) {
  const i = occurList.findIndex((o) => o.key === key);
  i >= 0 && occurList.splice(i, 1);
}
function occurTouch(key) {
  const o = occurList.find((x) => x.key === key);
  o && (o.touch = Date.now());
}
function occurTarget(sid) {
  let best = null;
  for (const o of occurList)
    if (o.sid === sid && (!best || o.touch >= best.touch)) best = o;
  return best ? best.key : null;
}
/* 预览桶键解析：有存活实例 → 最近交互实例；无 → 会话裸桶（兼容无实例期的写入） */
function previewKeyFor(sid) {
  return (sid && occurTarget(sid)) || sid;
}
function occurAdopt(key, sid) {
  occurAdd(key, sid);
  const mine = store.bucket(key),
    legacy = sid && store.buckets[sid];
  if (mine.files.length === 0 && legacy && legacy.files.length > 0) {
    ((mine.files = legacy.files), (mine.active = legacy.active));
    ((legacy.files = []), (legacy.active = null));
    bus.fire();
  }
}
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