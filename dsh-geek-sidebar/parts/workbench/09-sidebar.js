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