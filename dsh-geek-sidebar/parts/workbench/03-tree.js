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
    h2 = React.useState(!1),
    g2 = h2[0],
    C2 = h2[1],
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
              l ? "\u200e" + shortPath(l) : "选择笔记目录…",
            ),
          ),
          E
            ? e("div", { className: "pw-drop-overlay", onClick: () => D(!1) })
            : null,
          E
            ? e(
                "div",
                { className: "pw-drop" },
                e(
                  "div",
                  { className: "pw-drop-list" },
                  (t.notesDirs || []).map((i) =>
                    e(
                      "button",
                      {
                        key: i,
                        className: "pw-drop-row",
                        onClick: () => {
                          (D(!1), selectNotesDir(i));
                        },
                      },
                      e("span", { className: "pw-check" }, l === i ? "✓" : ""),
                      e("span", { className: "pw-mono" }, baseName(i)),
                    ),
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