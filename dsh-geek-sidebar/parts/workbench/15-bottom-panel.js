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
