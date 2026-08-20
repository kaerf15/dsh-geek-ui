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
    he = React.useState(null),
    Ae = he[0],
    le = he[1],
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
    currentRootPath = p;
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
              (n.branch || shortPath(n.path))
                .toLowerCase()
                .indexOf(i.trim().toLowerCase()) >= 0,
          )
        : ne;
  let We = null;
  E &&
    (We = e(
      "div",
      { className: "pw-drop" },
      Ee
        ? e(
            "div",
            { className: "pw-drop-filter" },
            e("input", {
              className: "pw-input",
              value: j,
              placeholder: "过滤项目…",
              onChange: (n) => z(n.target.value),
            }),
          )
        : null,
      e(
        "div",
        { className: "pw-drop-list" },
        je.map((n) =>
          e(
            "button",
            {
              key: n.root,
              className:
                "pw-drop-row" +
                (canonPath(n.root) === canonPath(M) ? " cur" : ""),
              title: n.root,
              onClick: () => $e(n.root),
            },
            e(
              "span",
              { className: "pw-check" },
              canonPath(n.root) === canonPath(M) ? "✓" : "",
            ),
            e("span", { className: "pw-mono" }, shortPath(n.root)),
            n.running > 0
              ? e("span", { className: "pw-act run" }, "● " + n.running)
              : null,
            n.pending > 0
              ? e("span", { className: "pw-act warn" }, "● " + n.pending)
              : null,
          ),
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
              e(
                "button",
                {
                  className: "pw-drop-row" + (W ? " cur" : ""),
                  title: d.path,
                  onClick: () => Ge(d.path),
                },
                e("span", { className: "pw-check" }, W ? "✓" : ""),
                e(
                  "span",
                  { className: "pw-mono" },
                  d.branch || shortPath(d.path),
                ),
                d.isMain
                  ? e("span", { className: "pw-main-badge" }, "主分支")
                  : null,
              ),
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
      Me
        ? e(
            "div",
            { className: "pw-drop-filter" },
            e("input", {
              className: "pw-input",
              value: i,
              placeholder: "过滤 worktree…",
              onChange: (d) => N(d.target.value),
            }),
          )
        : null,
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
            title: p ? "在 " + shortPath(p) + " 新建会话" : "先选择项目",
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
            M ? "\u200e" + shortPath(M) : "选择项目…",
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
        E
          ? e("div", { className: "pw-drop-overlay", onClick: () => D(!1) })
          : null,
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
                G ? G.branch || shortPath(G.path) : "…",
              ),
              G && G.isMain
                ? e("span", { className: "pw-main-badge" }, "主分支")
                : null,
              ne.length > 1
                ? e("span", { className: "pw-main-badge" }, String(ne.length))
                : null,
              e("span", { className: "pw-chev" }, "▾"),
            ),
            B
              ? e("div", { className: "pw-drop-overlay", onClick: () => _(!1) })
              : null,
            Oe,
          )
        : null,
      ie,
      re,
    )
  );
}