/* 图片点击放大：全屏遮罩 + 大图，点任意处 / Esc 关闭 */
function ImgZoomView() {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const src = imgZoomStore.src;
  React.useEffect(() => {
    if (!src) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape") imgZoomStore.set(null);
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

function Details(t) {
  const e = React.createElement,
    s = t.layout,
    a = React.useState(0)[1];
  React.useEffect(() => sessionProbe.sub(() => a((i) => i + 1)), []);
  const sidRef = React.useRef(sessionProbe.sid);
  React.useEffect(() => {
    sidRef.current !== sessionProbe.sid &&
      ((sidRef.current = sessionProbe.sid), a((i) => i + 1));
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
    if (!c) return;
    const rf = () => {
      if (edRef.current || document.visibilityState !== "visible") return;
      host
        .call("workbench.readFile", { path: c.path })
        .then((i2) => {
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
        host
          .call("workbench.download", { path: c.path })
          .then((i) => {
            (R(!1), i && i.ok ? b(!0) : p("✗ " + ((i && i.error) || "失败")));
          })
          .catch((i) => {
            (R(!1), p("✗ " + String(i)));
          }));
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
    q = () => (
      (D.current = []),
      c
        ? r
          ? r.error
            ? e(
                "div",
                { className: "pw-hint", style: { padding: "20px" } },
                "无法预览：" + r.error,
              )
            : r.kind === "image"
              ? e(
                  "div",
                  { className: "pw-img-wrap" },
                  e("img", {
                    src: r.url,
                    alt: c.name,
                    onClick: (g) => {
                      (g.stopPropagation(), imgZoomStore.set(r.url));
                    },
                  }),
                )
              : r.kind === "pdf"
                ? e("iframe", {
                    className: "pw-frame",
                    src: r.url,
                    title: c.name,
                  })
                : r.kind === "html"
                  ? e("iframe", {
                      className: "pw-frame",
                      srcDoc: r.html || "",
                      sandbox: "",
                      title: c.name,
                    })
                  : r.kind === "text" && isHtmlExt(c.name)
                    ? e("iframe", {
                        className: "pw-frame",
                        srcDoc: r.text || "",
                        sandbox: "",
                        title: c.name,
                      })
                    : j === "preview"
                      ? e(
                          "div",
                          { className: "pw-md" },
                          renderMarkdown(
                            r.text || "",
                            D.current,
                            c && c.path ? c.path.replace(/\/[^/]*$/, "") : "",
                          ),
                        )
                      : isCsvExt(c.name)
                        ? e(CsvView, { text: r.text || "" })
                        : isCodeExt(c.name)
                          ? e(
                              "div",
                              { className: "pw-codeview" },
                              highlightCode(
                                r.text || "",
                                c.name.split(".").pop().toLowerCase(),
                              ),
                            )
                          : e("pre", { className: "pw-src" }, r.text || "")
          : e(
              "div",
              { className: "pw-hint", style: { padding: "20px" } },
              "加载中…",
            )
        : e(
            "div",
            { className: "pw-empty" },
            e("div", { className: "pw-empty-logo" }, FileTextIcon(40)),
            e("div", null, "在左侧「项目」或「笔记」中点击文件进行预览"),
            e(
              "div",
              { className: "pw-hint" },
              "支持多标签 · Markdown / 图片 / 文本",
            ),
          )
    );
  return e(
    "div",
    { className: "pw-details" },
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
      e(
        "button",
        {
          className: "pw-col-btn",
          title: "收起右栏",
          onClick: () => s && s.closeDetails(),
        },
        "»",
      ),
    ),
    c
      ? e(
          "div",
          { className: "pw-toolbar" },
          e("span", { className: "pw-crumbs" }, K.join(" / ")),
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
            e(
              "button",
              {
                className: "pw-tg" + (j === "preview" ? " on" : ""),
                onClick: () => g("preview"),
              },
              "Preview",
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
                          mentionPath(c.path),
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
                  c &&
                    host
                      .call("workbench.readFile", { path: c.path })
                      .then((i2) => {
                        i2 && m(i2);
                      })
                      .catch((i2) => {
                        m({ error: String(i2) });
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
                  (setSaving(!0),
                    host
                      .call("workbench.writeFile", {
                        path: c.path,
                        text: draft,
                      })
                      .then((i2) => {
                        (setSaving(!1),
                          i2 && i2.ok
                            ? (m(OA({}, r, { text: draft })), setEd(!1))
                            : p("✗ " + ((i2 && i2.error) || "保存失败")));
                      })
                      .catch((i2) => {
                        (setSaving(!1), p("✗ " + String(i2)));
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
  );
}