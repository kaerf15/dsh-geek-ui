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