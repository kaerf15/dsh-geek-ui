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
        (v) => m.expanded[v] && l && pathHasPrefix(v, l),
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
        (y(!1), flashDone(C), l && fetchGit(l));
      };
      /* Promise.all([]) 也会正常 resolve，无需对空数组再补一次（旧版 S 会跑两遍，评审 P3） */
      Promise.all(N).then(S, S);
    },
    /* 焦点自动刷：外部（终端/Finder/agent）文件变动树感知不到，切回页面时静默重拉
     * 已展开目录。节流 10s 防来回切窗抖动；手动刷新中（g）或面板收起（!c）时跳过。
     * 手动刷新按钮保留，覆盖节流窗口内"立刻要看"的兜底需求。 */
    treeAuto = () => {
      const i = treeAutoRef.current;
      if (i.busy || g || !c || !l || document.visibilityState !== "visible")
        return;
      const N = Date.now();
      if (N - i.at < 1e4) return;
      ((i.at = N), (i.busy = !0));
      const S = Object.keys(m.expanded).filter(
        (v) => m.expanded[v] && pathHasPrefix(v, l),
      );
      k((v) => ({
        expanded: v.expanded,
        children: {},
        loading: {},
        rev: v.rev + 1,
      }));
      const F = [w(l, !0)];
      for (const v of S) v !== l && F.push(w(v, !0));
      const X = () => {
        (i.busy = !1, l && fetchGit(l));
      };
      Promise.all(F).then(X, X);
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
  /* treeAutoRef.fn 每 render 重指最新闭包，focus/visibilitychange 监听只注册一次 */
  const treeAutoRef = React.useRef({ at: 0, busy: !1, fn: null });
  ((treeAutoRef.current.fn = treeAuto),
    React.useEffect(() => {
      const i = () => treeAutoRef.current.fn && treeAutoRef.current.fn();
      (window.addEventListener("focus", i),
        document.addEventListener("visibilitychange", i));
      return () => {
        (window.removeEventListener("focus", i),
          document.removeEventListener("visibilitychange", i));
      };
    }, []));
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
                                  t.layout && t.layout.openDetails();
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