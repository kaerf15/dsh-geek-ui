/* 图片点击放大：全屏遮罩 + 大图，点任意处 / Esc 关闭 */
function ImgZoomView() {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const src = imgZoomStore.src;
  React.useEffect(() => {
    if (!src) return undefined;
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      /* 吃掉 Esc，避免外层（预览缩放 / 便签下栏）同一键一起关 */
      ev.stopPropagation();
      imgZoomStore.set(null);
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

/* 异步回调落地前的活守卫（评审修复）：响应回来时用户可能已切文件，
 * 比对发起时的 path 是否仍是该会话桶的 active——否则旧文件的响应写进新文件的视图态。
 * 0.1.5 修订：去掉「sid 必须是当前会话」的联合条件——分栏下两个右栏并存，
 * 非焦点会话的预览实例是合法存续的；每桶独立 active 已足够防串写。 */
function detailsAlive(sid, path) {
  return store.bucket(sid).active === path;
}

function parseGitDiff(diffText) {
  if (!diffText) return [];
  const rawLines = diffText.split("\n");
  const parsed = [];
  let oldLine = 0;
  let newLine = 0;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx];
    if (
      raw.startsWith("diff --git") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw.startsWith("\\")
    ) {
      continue;
    }
    const hunkMatch = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      continue;
    }
    if (raw.startsWith("+")) {
      parsed.push({
        type: "add",
        lineNo: newLine++,
        prefix: "+",
        text: raw.slice(1),
      });
    } else if (raw.startsWith("-")) {
      parsed.push({
        type: "del",
        lineNo: oldLine++,
        prefix: "-",
        text: raw.slice(1),
      });
    } else {
      parsed.push({
        type: "ctx",
        lineNo: newLine++,
        prefix: " ",
        text: raw.startsWith(" ") ? raw.slice(1) : raw,
      });
      oldLine++;
    }
  }
  return parsed;
}

function Details(t) {
  const e = React.createElement,
    s = t.layout,
    a = React.useState(0)[1];
  React.useEffect(() => sessionProbe.sub(() => a((i) => i + 1)), []);
  /* 0.1.5：预览入驻官方右栏后，槽会把所属会话 sessionId 传进来——绑定它，
   * 分栏并存的两个右栏各看各的桶，不再同读 sessionProbe 镜像成同一份；
   * 缺 prop（旧宿主/smoke）回落 sessionProbe.sid，行为同旧版。 */
  const sid = t.sessionId || sessionProbe.sid;
  /* 分栏实例桶键：右栏槽传入 okey（会话::tab实例），同会话多栏各读各的；
   * 缺失（旧宿主/smoke）回落会话桶 */
  const pkey = t.okey || sid;
  const sidRef = React.useRef(sid);
  React.useEffect(() => {
    if (sidRef.current !== sid) {
      /* 切会话平台会关 details 列（AppFrame 私有面），缩放态跟着退，别让 fixed 面板悬空 */
      ((sidRef.current = sid), setZoomed(!1), a((i) => i + 1));
    }
  });
  const l = usePreviewState(pkey),
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
  const zm = React.useState(!1),
    zoomed = zm[0],
    setZoomed = zm[1],
    rootRef = React.useRef(null),
    diffSt = React.useState(""),
    diffText = diffSt[0],
    setDiffText = diffSt[1],
    diffLdSt = React.useState(!1),
    diffLoading = diffLdSt[0],
    setDiffLoading = diffLdSt[1],
    diffParsed = React.useMemo(() => parseGitDiff(diffText), [diffText]),
    loadDiff = (targetPath) => {
      if (!targetPath) return;
      setDiffLoading(!0);
      host
        .call("workbench.gitDiff", { path: targetPath })
        .then((res) => {
          setDiffLoading(!1);
          setDiffText((res && res.diff) || "");
        })
        .catch(() => {
          setDiffLoading(!1);
          setDiffText("");
        });
    };
  /* 预览缩放（⤢）：不碰平台右栏宽度（300–520 是 ui-layout columns.ts 的契约钳制），
   * 纯 CSS 把自家 .pw-details 切成 fixed 居中大面板——DOM 不动、组件不卸载，
   * 滚动位置 / 编辑 buffer / 已加载内容零损失；Esc / 点遮罩 / 再点按钮收回。
   * Platform-private surface：fixed 定位依赖 details 槽祖先链无 transform/filter
   * 捕获（ui-layout AppFrame.module.css 当前满足；被捕获时 fixed 退化为相对该祖先，
   * 视觉上卡死在栏内）——toggleZoom 一次性自检，平台升级先核它。 */
  const fixedCaptured = (el) => {
    for (let n = el && el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (
        cs.transform !== "none" ||
        cs.filter !== "none" ||
        cs.backdropFilter !== "none" ||
        cs.perspective !== "none" ||
        /* paint/strict/content 含 paint  containment → 也捕获 fixed */
        /paint|strict|content/.test(cs.contain) ||
        cs.contentVisibility !== "visible" ||
        (cs.willChange !== "auto" && cs.willChange !== "none")
      )
        return true;
    }
    return false;
  };
  const toggleZoom = () => {
    if (zoomed) return setZoomed(!1);
    if (fixedCaptured(rootRef.current))
      return console.warn("[dsh-geek-sidebar] 预览缩放取消：details 祖先链出现 transform/filter/contain 捕获，fixed 会退化（平台布局变了，先核 AppFrame.module.css）");
    setZoomed(!0);
  };
  React.useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (ev) => {
      /* 图片放大开着时 Esc 归 ImgZoomView，一层一层退；编辑中 Esc 不收面板（edRef 实时读，免 deps 抖动） */
      if (ev.key !== "Escape" || imgZoomStore.src || edRef.current) return;
      ev.stopPropagation();
      setZoomed(!1);
    };
    document.addEventListener("keydown", onKey);
    /* 窄屏（≤1219px，对齐 13-drawer 断点）让步链派生关栏 + drawer 出场——退缩放让位，防 fixed 面板悬空撞层 */
    const mq = window.matchMedia("(max-width:1219px)");
    const onNarrow = () => {
      mq.matches && setZoomed(!1);
    };
    mq.addEventListener("change", onNarrow);
    onNarrow();
    return () => {
      (document.removeEventListener("keydown", onKey), mq.removeEventListener("change", onNarrow));
    };
  }, [zoomed]);
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
    if (c && c.modeHint === "diff") {
      g("diff");
    } else if (c && !c.modeHint && h === "diff") {
      g("auto");
    }
  }, [c && c.path, c && c.modeHint]);
  React.useEffect(() => {
    if (h === "diff" && c) loadDiff(c.path);
  }, [c && c.path, h]);
  React.useEffect(() => {
    if (!c) return;
    const rf = () => {
      if (edRef.current || document.visibilityState !== "visible") return;
      if (h === "diff") {
        c && loadDiff(c.path);
        return;
      }
      const sid0 = pkey, path0 = c.path;
      host
        .call("workbench.readFile", { path: c.path })
        .then((i2) => {
          if (!detailsAlive(sid0, path0)) return;
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
        (() => {
          const sid0 = pkey, path0 = c.path;
          host
            .call("workbench.download", { path: c.path })
            .then((i) => {
              (R(!1), detailsAlive(sid0, path0) && (i && i.ok ? b(!0) : p("✗ " + ((i && i.error) || "失败"))));
            })
            .catch((i) => {
              (R(!1), detailsAlive(sid0, path0) && p("✗ " + String(i)));
            });
        })());
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
    q = () => {
      (D.current = []);
      if (!c) {
        return e(
          "div",
          { className: "pw-empty" },
          e("div", { className: "pw-empty-logo" }, FileTextIcon(40)),
          e("div", null, "在左侧「项目」或「知识库」中点击文件进行预览"),
          e(
            "div",
            { className: "pw-hint" },
            "支持多标签 · Markdown / 图片 / 文本",
          ),
        );
      }
      if (j === "diff") {
        if (diffLoading) {
          return e(
            "div",
            { className: "pw-hint", style: { padding: "20px" } },
            "加载 Diff 中…",
          );
        }
        if (!diffText || !diffText.trim()) {
          return e(
            "div",
            { className: "pw-empty" },
            e("div", { style: { fontWeight: 600, fontSize: "14px" } }, "无未提交变更"),
            e(
              "div",
              { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
              "当前文件与 Git HEAD 保持一致",
            ),
          );
        }
        if (diffText.includes("Binary files") || diffText.includes("GIT binary patch")) {
          return e(
            "div",
            { className: "pw-empty" },
            e("div", { style: { fontWeight: 600, fontSize: "14px" } }, "二进制文件变更"),
            e(
              "div",
              { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
              "二进制文件不提供内联差异文本比对",
            ),
          );
        }
        return e(
          "div",
          { className: "pw-diff-view" },
          e(
            "pre",
            { className: "pw-diff-pre" },
            diffParsed.map((l, idx) => {
              const cls =
                l.type === "add"
                  ? "pw-diff-add"
                  : l.type === "del"
                    ? "pw-diff-del"
                    : "pw-diff-ctx";
              return e(
                "div",
                { key: idx, className: "pw-diff-line " + cls },
                e("span", { className: "pw-diff-num" }, l.lineNo),
                e("span", { className: "pw-diff-prefix" }, l.prefix),
                e("span", { className: "pw-diff-code" }, l.text || "\u00a0"),
              );
            }),
          ),
        );
      }
      if (!r) {
        return e(
          "div",
          { className: "pw-hint", style: { padding: "20px" } },
          "加载中…",
        );
      }
      if (r.error) {
        return e(
          "div",
          { className: "pw-hint", style: { padding: "20px" } },
          "无法预览：" + r.error,
        );
      }
      if (r.kind === "image") {
        return e(
          "div",
          { className: "pw-img-wrap" },
          e("img", {
            src: r.url,
            alt: c.name,
            onClick: (g) => {
              (g.stopPropagation(), imgZoomStore.set(r.url));
            },
          }),
        );
      }
      if (r.kind === "pdf") {
        return e("iframe", {
          className: "pw-frame",
          src: r.url,
          title: c.name,
        });
      }
      if (r.kind === "html" || (r.kind === "text" && isHtmlExt(c.name))) {
        return e("iframe", {
          className: "pw-frame",
          srcDoc: r.html || r.text || "",
          sandbox: "",
          title: c.name,
        });
      }
      if (j === "preview") {
        return e(
          "div",
          { className: "pw-md" },
          renderMarkdown(
            r.text || "",
            D.current,
            c && c.path ? pathDir(c.path) : "",
          ),
        );
      }
      if (isCsvExt(c.name)) {
        return e(CsvView, { text: r.text || "" });
      }
      if (isCodeExt(c.name)) {
        return e(
          "div",
          { className: "pw-codeview" },
          highlightCode(
            r.text || "",
            c.name.split(".").pop().toLowerCase(),
          ),
        );
      }
      return e("pre", { className: "pw-src" }, r.text || "");
    };
  return e(
    React.Fragment,
    null,
    zoomed
      ? e("div", {
          className: "pw-zoomview-mask",
          onClick: () => setZoomed(!1),
        })
      : null,
    e(
      "div",
      { className: "pw-details" + (zoomed ? " zoomed" : ""), ref: rootRef },
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
                onClick: () => store.setActive(pkey, i.path),
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
                      store.close(pkey, i.path));
                  },
                },
                "×",
              ),
            ),
          ),
      e("span", { className: "pw-tabs-flex" }),
      t.inDrawer
        ? null
        : e(
            "button",
            {
              className: "pw-col-btn",
              title: zoomed ? "收回预览 (Esc)" : "放大预览",
              onClick: toggleZoom,
            },
            zoomed ? "⤡" : "⤢",
          ),
      /* 0.1.5：closeDetails 随 details 栏一并移除，预览改为右栏页面 tab（15d）——
       * 「收起右栏」钮不再有可作用的栏（栏的开关归平台 tab 铬），inDrawer 下不出场。
       * 注意：inDrawer 恒为 true 后，上方缩放钮与本品在生产均不可达，代码暂留供
       * smoke 覆盖非 drawer 分支；若确认不再需要可连 zoom 机械整体拆除。 */
      t.inDrawer
        ? null
        : e(
            "button",
            {
              className: "pw-col-btn",
              title: "收起右栏",
              /* 缩放态下收栏先退缩放：面板是 fixed，栏收了它还悬着 */
              onClick: () => {
                (setZoomed(!1), s && typeof s.closeDetails === "function" && s.closeDetails());
              },
            },
            "»",
          ),
    ),
    c
      ? e(
          "div",
          { className: "pw-toolbar" },
          e(
            "span",
            { className: "pw-crumbs" },
            r && r.text
              ? (() => {
                  const ext = (c.name.split(".").pop() || "").toLowerCase();
                  const langMap = {
                    md: "markdown", markdown: "markdown", ts: "typescript", tsx: "tsx",
                    js: "javascript", jsx: "jsx", py: "python", json: "json",
                    yml: "yaml", yaml: "yaml", toml: "toml", css: "css", html: "html",
                    sh: "bash", bash: "bash", rs: "rust", go: "go", sql: "sql",
                  };
                  const lang = langMap[ext] || ext || "text";
                  const lines = r.text.split("\n").length;
                  const bLen = new TextEncoder().encode(r.text).length;
                  const sz = bLen < 1024 ? bLen + " B" : (bLen / 1024).toFixed(1) + " KB";
                  return lang + " · " + lines + " 行 · " + sz + (r.truncated ? " (截断)" : "");
                })()
              : r && r.kind === "image"
                ? "图片" + (r.size ? " · " + (r.size < 1024 ? r.size + " B" : (r.size / 1024).toFixed(1) + " KB") : "")
                : r && r.kind === "pdf"
                  ? "PDF" + (r.size ? " · " + (r.size < 1024 ? r.size + " B" : (r.size / 1024).toFixed(1) + " KB") : "")
                  : "",
          ),
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
            c && isMd(c.name)
              ? e(
                  "button",
                  {
                    className: "pw-tg" + (j === "preview" ? " on" : ""),
                    onClick: () => g("preview"),
                  },
                  "Preview",
                )
              : null,
            e(
              "button",
              {
                className: "pw-tg" + (j === "diff" ? " on" : ""),
                onClick: () => {
                  g("diff");
                  c && loadDiff(c.path);
                },
              },
              "Diff",
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
                          mentionRef(c.path, false),
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
                  if (!c) return;
                  const sid0 = pkey, path0 = c.path;
                  host
                    .call("workbench.readFile", { path: c.path })
                    .then((i2) => {
                      detailsAlive(sid0, path0) && i2 && m(i2);
                    })
                    .catch((i2) => {
                      detailsAlive(sid0, path0) && m({ error: String(i2) });
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
                  const sid0 = pkey, path0 = c.path;
                  (setSaving(!0),
                    host
                      .call("workbench.writeFile", {
                        path: c.path,
                        text: draft,
                      })
                      .then((i2) => {
                        (setSaving(!1),
                          detailsAlive(sid0, path0) &&
                            (i2 && i2.ok
                              ? (m(OA({}, r, { text: draft })), setEd(!1))
                              : p("✗ " + ((i2 && i2.error) || "保存失败"))));
                      })
                      .catch((i2) => {
                        (setSaving(!1), detailsAlive(sid0, path0) && p("✗ " + String(i2)));
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
    ),
  );
}