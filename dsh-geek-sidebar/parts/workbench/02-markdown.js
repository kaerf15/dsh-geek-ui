const isMd = (t) => /\.(md|markdown)$/i.test(t);
/* 评审修复：bd（链接/图片解析基目录）显式传参——原经 12-mdpath 的模块级
 * var mdBaseDir 隐式传递，渲染期写共享态（并发/顺序敏感）。行为逐点保持 */
/* 图片渲染走组件：失败态收进 React state（评审修复 N2）——原先 onError 直接
 * parentNode.insertBefore 往 React 托管容器塞外来节点，markdown 重建时占位 span
 * 无人回收、永久残留（图片修好了「加载失败」还在）。 */
function MdImg(props) {
  const [broken, setBroken] = React.useState(false);
  if (broken)
    return React.createElement(
      "span",
      { className: "pw-img-broken" },
      "图片加载失败：" + (props.alt || props.raw),
    );
  return React.createElement("img", {
    src: props.src,
    alt: props.alt,
    style: { maxWidth: "100%" },
    onClick: (g) => {
      (g.stopPropagation(), imgZoomStore.set(props.src));
    },
    onError: () => setBroken(true),
  });
}
function mdInline(t, bd) {
  const e = [],
    s =
      /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\))/g;
  let o = 0,
    a,
    l = 0;
  for (; (a = s.exec(t)) !== null;) {
    a.index > o && e.push(t.slice(o, a.index));
    const c = a[0];
    if (c.startsWith("**") || c.startsWith("__"))
      e.push(React.createElement("strong", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("~~"))
      e.push(React.createElement("del", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("`"))
      e.push(
        React.createElement(
          "code",
          { key: l++, className: "pw-inline-code" },
          c.slice(1, -1),
        ),
      );
    else if (c.startsWith("![")) {
      const u = c.match(/!\[([^\]]*)\]\(([^)]*)\)/);
      e.push(
        React.createElement(MdImg, {
          key: l++,
          src: mediaUrl(u[2], bd),
          alt: u[1],
          raw: u[2],
        }),
      );
    } else if (c.startsWith("[")) {
      const u = c.match(/\[([^\]]*)\]\(([^)]*)\)/);
      /* javascript:/vbscript: 协议拦截（评审修复 N3）：点击经 resolveLocalPath 已拦，
       * 但 href 会原样落 DOM——中键/新标签打开场景收一道口。 */
      const href = /^\s*(javascript|vbscript)\s*:/i.test(u[2]) ? "#" : u[2];
      e.push(
        React.createElement(
          "a",
          {
            key: l++,
            href: href,
            target: "_blank",
            rel: "noreferrer",
            onClick: (g) => {
              const p = resolveLocalPath(u[2], bd);
              p && (g.preventDefault(), openLocalPath(p));
            },
          },
          u[1],
        ),
      );
    } else e.push(React.createElement("em", { key: l++ }, c.slice(1, -1)));
    o = a.index + c.length;
  }
  return (o < t.length && e.push(t.slice(o)), e);
}
function renderMarkdown(t, e, bd) {
  bd = typeof bd == "string" ? bd : "";
  const s = String(t).replace(
      /\r\n/g,
      `
`,
    ).split(`
`),
    o = [];
  let a = 0,
    l = 0;
  const c = React.createElement;
  for (; a < s.length;) {
    const r = s[a].trim();
    if (r === "") {
      a++;
      continue;
    }
    if (r.startsWith("```")) {
      /* 围栏语言：CODE_LANGS 认识（js/ts/py/sh/json 系）才接 highlightCode 着色——
       * 未知语言（含 mermaid）保持原文，highlightCode 对未知语言会错染 js 关键词。
       * mermaid 不图形渲染（用户决策 2026-08：使用频率低，不值得 +1MB vendor 依赖；
       * 与主对话行为一致——主应用同样按源码块展示），回看点此注释再议 */
      const lang = r.slice(3).trim().toLowerCase(),
        h = [];
      for (a++; a < s.length && !s[a].trim().startsWith("```");)
        (h.push(s[a]), a++);
      const body = h.join(`
`);
      (a++,
        o.push(
          c(
            "pre",
            { key: l++, className: "pw-code" },
            c(
              "code",
              null,
              lang && typeof CODE_LANGS !== "undefined" && CODE_LANGS[lang] ? highlightCode(body, lang) : body,
            ),
          ),
        ));
      continue;
    }
    const m = r.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const h = { key: l++, className: "pw-h" };
      if (e) {
        const g = e.length;
        (e.push(null),
          (h.ref = (y) => {
            e[g] = y;
          }));
      }
      (o.push(c("h" + m[1].length, h, mdInline(m[2], bd))), a++);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(r)) {
      (o.push(c("hr", { key: l++ })), a++);
      continue;
    }
    if (/^>\s?/.test(r)) {
      const h = [];
      for (; a < s.length && /^>\s?/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^>\s?/, "")), a++);
      o.push(
        c(
          "blockquote",
          { key: l++, className: "pw-quote" },
          mdInline(h.join(" "), bd),
        ),
      );
      continue;
    }
    if (
      /^\|(.+)\|\s*$/.test(r) &&
      a + 1 < s.length &&
      /^\|[\s:|-]+\|\s*$/.test(s[a + 1].trim())
    ) {
      const h = (x) =>
          x
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((p) => p.trim()),
        g = h(s[a]);
      a += 2;
      const y = [];
      for (; a < s.length && /^\|(.+)\|\s*$/.test(s[a].trim());)
        (y.push(h(s[a])), a++);
      o.push(
        c(
          "table",
          { key: l++, className: "pw-table" },
          c(
            "thead",
            null,
            c(
              "tr",
              null,
              g.map((x, p) => c("th", { key: p }, mdInline(x, bd))),
            ),
          ),
          c(
            "tbody",
            null,
            y.map((x, p) =>
              c(
                "tr",
                { key: p },
                x.map((C, I) => c("td", { key: I }, mdInline(C, bd))),
              ),
            ),
          ),
        ),
      );
      continue;
    }
    if (/^[-*+]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^[-*+]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^[-*+]\s+/, "")), a++);
      o.push(
        c(
          "ul",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g, bd))),
        ),
      );
      continue;
    }
    if (/^\d+[.)]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^\d+[.)]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^\d+[.)]\s+/, "")), a++);
      o.push(
        c(
          "ol",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g, bd))),
        ),
      );
      continue;
    }
    const k = [r];
    for (a++; a < s.length;) {
      const h = s[a].trim();
      if (
        h === "" ||
        h.startsWith("```") ||
        /^(#{1,6})\s/.test(h) ||
        /^>/.test(h) ||
        /^[-*+]\s/.test(h) ||
        /^\d+[.)]\s/.test(h) ||
        /^\|/.test(h)
      )
        break;
      (k.push(h), a++);
    }
    o.push(c("p", { key: l++, className: "pw-p" }, mdInline(k.join(" "), bd)));
  }
  return o;
}