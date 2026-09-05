const CODE_KW = {
    js: "const let var function return if else for while class extends import export from default new try catch finally throw async await yield typeof instanceof in of switch case break continue this null undefined true false interface type enum implements readonly public private static",
    py: "def return if elif else for while class import from as with try except finally raise lambda yield async await pass break continue global nonlocal is in not and or True False None self print",
    sh: "if then else elif fi for while do done case esac function return local export echo cd exit source",
    json: "true false null",
  },
  CODE_LANGS = {
    js: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    ts: "js",
    tsx: "js",
    py: "py",
    sh: "sh",
    bash: "sh",
    zsh: "sh",
    json: "json",
  },
  isCodeExt = (t) =>
    Object.prototype.hasOwnProperty.call(
      CODE_LANGS,
      (t.split(".").pop() || "").toLowerCase(),
    ),
  isCsvExt = (t) => /\.csv$/i.test(t),
  isHtmlExt = (t) => /\.(html?|xhtml)$/i.test(t);
function codeTokens(t, e) {
  const s = [],
    o =
      /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b)/g;
  let a = 0,
    l,
    c = 0;
  for (; (l = o.exec(t)) !== null;) {
    (l.index > a && s.push(...kwWrap(t.slice(a, l.index), e, c)),
      (c = s.length));
    const u = l[0],
      r =
        u.charAt(0) === "/" || u.charAt(0) === "#"
          ? "c"
          : u.charAt(0) === '"' || u.charAt(0) === "'" || u.charAt(0) === "`"
            ? "s"
            : "n";
    (s.push(
      React.createElement(
        "span",
        { key: "t" + c++, className: "pw-tok-" + r },
        u,
      ),
    ),
      (a = l.index + u.length));
  }
  return (
    a < t.length && s.push(...kwWrap(t.slice(a), e, c)),
    s.length ? s : [t]
  );
}
function kwWrap(t, e, s) {
  if (!e) return [t];
  const o = [];
  let a = 0,
    l;
  const c = new RegExp(e.source, "g");
  for (; (l = c.exec(t)) !== null;)
    (l.index > a && o.push(t.slice(a, l.index)),
      o.push(
        React.createElement(
          "span",
          { key: "k" + s + "-" + l.index, className: "pw-tok-k" },
          l[0],
        ),
      ),
      (a = l.index + l[0].length));
  return (a < t.length && o.push(t.slice(a)), o);
}
function highlightCode(t, e) {
  const s = CODE_LANGS[e] || "js",
    o = CODE_KW[s],
    a = o ? new RegExp("\\b(" + o.split(" ").join("|") + ")\\b", "g") : null;
  return String(t)
    .split(
      `
`,
    )
    .map((l, c) =>
      React.createElement(
        "div",
        { key: c, className: "pw-codeline" },
        React.createElement("span", { className: "pw-lineno" }, String(c + 1)),
        React.createElement("span", null, codeTokens(l, a)),
      ),
    );
}
function parseCsv(t) {
  const e = [];
  let s = [],
    o = "",
    a = !1;
  for (let l = 0; l < t.length; l++) {
    const c = t[l];
    a
      ? c === '"'
        ? t[l + 1] === '"'
          ? ((o += '"'), l++)
          : (a = !1)
        : (o += c)
      : c === '"'
        ? (a = !0)
        : c === ","
          ? (s.push(o), (o = ""))
          : c ===
              `
`
            ? (s.push(o), e.push(s), (s = []), (o = ""))
            : c !== "\r" && (o += c);
  }
  return (
    (o !== "" || s.length) && (s.push(o), e.push(s)),
    e.filter((l) => l.length > 1 || l[0] !== "")
  );
}
function CsvView(t) {
  const e = React.createElement,
    s = parseCsv(t.text || "");
  if (s.length === 0) return e("pre", { className: "pw-src" }, t.text || "");
  const o = s[0],
    a = s.slice(1, 501);
  return e(
    "div",
    { className: "pw-csv-wrap" },
    e(
      "table",
      { className: "pw-csv" },
      e(
        "thead",
        null,
        e(
          "tr",
          null,
          o.map((l, c) => e("th", { key: c }, l)),
        ),
      ),
      e(
        "tbody",
        null,
        a.map((l, c) =>
          e(
            "tr",
            { key: c },
            l.map((u, r) => e("td", { key: r }, u)),
          ),
        ),
      ),
      s.length > 501
        ? e("div", { className: "pw-hint" }, "仅显示前 500 行")
        : null,
    ),
  );
}
function fileIconEl(name, size) {
  const sz = size || 14;
  const n = String(name || "").toLowerCase();
  const ext = n.split(".").pop() || "";
  const el = React.createElement;
  const svgWrap = (paths, strokeWidth) =>
    el(
      "svg",
      {
        width: sz,
        height: sz,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: strokeWidth || 1.25,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { verticalAlign: "middle", flexShrink: 0 },
      },
      paths,
    );

  if (n === "dockerfile" || n.startsWith("dockerfile.")) {
    return svgWrap([
      el("path", { key: 1, d: "M.5 8.5H11l.75-.5a5.35 5.35 0 010-3.5c1 .6 1 1.88 1.74 2 .77-.09 1.23.01 2 .52 0 0-.97 1.77-2.5 1.98-1.93 3.65-4.5 5.5-6.98 5.5C0 14.5.5 8.5.5 8.5m1 0v-2m0 0h8m-6 2v-4m0 0h4m-2-2h2m-2 6v-6m2 6v-6m2 6v-2" }),
    ]);
  }
  if (n === ".gitignore" || n === ".gitmodules" || n === ".gitattributes") {
    return svgWrap([
      el("path", { key: 1, d: "M8.5 10.5a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m0-6a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m3 3a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m-4-2v4m-1-6-1-1m4 4-1-1" }),
      el("path", { key: 2, d: "m9.06 1.06 5.88 5.88a1.5 1.5 0 010 2.12l-5.88 5.88a1.5 1.5 0 01-2.12 0L1.06 9.06a1.5 1.5 0 010-2.12l5.88-5.88a1.5 1.5 0 012.12 0" }),
    ]);
  }
  if (n === "package-lock.json") {
    return svgWrap([
      el("path", { key: 1, d: "M15 11.5c.27 0 .5.22.5.5v3a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-3c0-.28.22-.5.5-.5zm-4 0V10a1.5 1.5 0 013 0v1.5" }),
      el("path", { key: 2, d: "M9.5 9V5.5h-2v6h-4v-8h8v3" }),
      el("path", { key: 3, d: "M7.54 13.5H3A1.5 1.5 0 011.5 12V3c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5v3.5" }),
    ]);
  }
  if (n === "bun.lock" || n === "yarn.lock" || n === "pnpm-lock.yaml" || n === "cargo.lock" || ext === "lock") {
    return svgWrap([
      el("path", { key: 1, d: "m12.36 7.104c0.4817 0 0.8722 0.3903 0.8722 0.8717v5.23c0 0.4814-0.3905 0.8717-0.8722 0.8717h-8.721c-0.4817 0-0.8722-0.3903-0.8722-0.8717v-5.23c0-0.4814 0.3905-0.8717 0.8722-0.8717zm-6.977 0v-2.616c0-1.445 1.172-2.616 2.617-2.616 1.445 0 2.617 1.171 2.617 2.616v2.616" }),
    ]);
  }
  if (n.endsWith(".config.ts") || n.endsWith(".config.js") || n.endsWith(".config.mjs") || n.endsWith(".config.cjs")) {
    return svgWrap([
      el("path", { key: 1, d: "m7.997 9.694a1.726 1.695 0 1 0 0-3.39 1.726 1.695 0 0 0 0 3.39m3.021-6.78 3.021 5.085-3.021 5.085h-6.042l-3.021-5.085 3.021-5.085z" }),
    ]);
  }
  if (n === ".env" || n.startsWith(".env.")) {
    return svgWrap([
      el("path", { key: 1, d: "M5.5 8.5V12m0-6.5V4m0 4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3m5 3.5v-1.5m0-3V4m0 6.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3M4 1.5h8A2.5 2.5 0 0114.5 4v8a2.5 2.5 0 01-2.5 2.5H4A2.5 2.5 0 011.5 12V4A2.5 2.5 0 014 1.5" }),
    ]);
  }
  if (ext === "ts" || ext === "tsx") {
    return svgWrap([
      el("path", { key: 1, d: "M4 1.5h8A2.5 2.5 0 0114.5 4v8a2.5 2.5 0 01-2.5 2.5H4A2.5 2.5 0 011.5 12V4A2.5 2.5 0 014 1.5" }),
      el("path", { key: 2, d: "M12.5 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25S10.04 10 10.7 10h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25m-3-3.75v5M5 7.5h3" }),
    ]);
  }
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") {
    return svgWrap([
      el("path", { key: 1, d: "m 4,1.5 h 8 c 1.385,0 2.5,1.115 2.5,2.5 v 8 c 0,1.385 -1.115,2.5 -2.5,2.5 H 4 C 2.615,14.5 1.5,13.385 1.5,12 V 4 C 1.5,2.615 2.615,1.5 4,1.5 Z" }),
      el("path", { key: 2, d: "M4.5 11c0 .828.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V7.5M12.5 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25s.54 1.25 1.2 1.25h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25" }),
    ]);
  }
  if (ext === "md" || ext === "mdx" || ext === "markdown") {
    return svgWrap([
      el("path", { key: 1, d: "m9.25 8.25 2.25 2.25 2.25-2.25M3.5 11V5.5l2.04 3 1.96-3V11m4-.5V5M1.65 2.5h12.7c.59 0 1.15.49 1.15 1v9c0 .51-.56 1-1.15 1H1.65c-.59 0-1.15-.49-1.15-1V3.58c0-.5.56-1.08 1.15-1.08" }),
    ]);
  }
  if (ext === "py") {
    return svgWrap([
      el("path", { key: 1, d: "M8.5 5.5h-3m6 0V3c0-.8-.7-1.5-1.5-1.5H7c-.8 0-1.5.7-1.5 1.5v2.5H3c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.48 1.5" }),
      el("path", { key: 2, d: "M10.5 10.5h-3m-3 0V13c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5v-2.5H13c.8 0 1.5-.7 1.5-1.5V7c0-.8-.7-1.5-1.48-1.5H11.5c0 1.5 0 2-1 2h-2" }),
    ]);
  }
  if (ext === "json" || ext === "jsonl") {
    return svgWrap([
      el("path", { key: 1, d: "M4.5 2.5H4c-.75 0-1.5.75-1.5 1.5v2c0 1.1-1 2-1.83 2 .83 0 1.83.9 1.83 2v2c0 .75.75 1.5 1.5 1.5h.5m7-11h.5c.75 0 1.5.75 1.5 1.5v2c0 1.1 1 2 1.83 2-.83 0-1.83.9-1.83 2v2c0 .74-.75 1.5-1.5 1.5h-.5m-6.5-3a.5.5 0 100-1 .5.5 0 000 1m3 0a.5.5 0 100-1 .5.5 0 000 1m3 0a.5.5 0 100-1 .5.5 0 000 1" }),
    ]);
  }
  if (ext === "yaml" || ext === "yml") {
    return svgWrap([
      el("path", { key: 1, d: "M2.5 1.5h3l3 4 3-4h3l-9 13h-3L7 8z" }),
    ]);
  }
  if (ext === "toml") {
    return svgWrap([
      el("path", { key: 1, d: "M3.5 1.5h-2v13h2m9-13h2v13h-2m-8-11h7v3h-2v6h-3v-6h-2z" }),
    ]);
  }
  if (ext === "css" || ext === "less") {
    return svgWrap([
      el("path", { key: 1, d: "m4 1.5h8c1.38 0 2.5 1.12 2.5 2.5v8c0 1.38-1.12 2.5-2.5 2.5h-8c-1.38 0-2.5-1.12-2.5-2.5v-8c0-1.38 1.12-2.5 2.5-2.5z" }),
      el("path", { key: 2, d: "M5 5.5h6M5 8h5.5l-.5 3-2 1-2-1-.2-1.5" }),
    ]);
  }
  if (ext === "scss" || ext === "sass") {
    return svgWrap([
      el("path", { key: 1, d: "M14.5 9c-.5 3-3.5 4.5-6.5 4.5S2 12 2 9.5c0-3 3-4 6-4.5s4-.5 4-2c0-1-1-1.5-2-1.5S7.5 2 7.5 3" }),
    ]);
  }
  if (ext === "html" || ext === "htm" || ext === "vue") {
    return svgWrap([
      el("path", { key: 1, d: "M1.5 1.5h13L13 13l-5 2-5-2z" }),
      el("path", { key: 2, d: "M11 4.5H5l.25 3h5.5l-.25 3-2.5 1-2.5-1-.08-1" }),
    ]);
  }
  if (ext === "rs") {
    return svgWrap([
      el("path", { key: 1, d: "M15.5 9.5Q8 13.505.5 9.5l1-1-1-2 2-.5V4.5h2l.5-2 1.5 1 1.5-2 1.5 2 1.5-1 .5 2h2V6l2 .5-1 2z" }),
      el("path", { key: 2, d: "M6.5 7.5a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1m5 0a1 1 0 01-1 1 1 1 0 01-1-1 1 1 0 011-1 1 1 0 011 1M4 11.02c-.67.37-1.5.98-1.5 2.23s1.22 1.22 2 1.25v-2M12 11c.67.37 1.5 1 1.5 2.25s-1.22 1.22-2 1.25v-2" }),
    ]);
  }
  if (ext === "go") {
    return svgWrap([
      el("path", { key: 1, d: "m15.48 8.06-4.85.48m4.85-.48a4.98 4.98 0 01-4.54 5.42 5 5 0 112.95-8.66l-1.7 1.84a2.5 2.5 0 00-4.18 2.06c.05.57.3 1.1.69 1.51.25.27 1 .83 1.78.82.8-.02 1.58-.25 2.07-.81 0 0 .8-.96.68-1.88M2.5 8.5l-2 .01m1.5 2h1.5m-2-3.99 2-.02" }),
    ]);
  }
  if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "fish") {
    return svgWrap([
      el("path", { key: 1, d: "M2 15.5c-.7 0-1.5-.8-1.5-1.5V5c0-.7.8-1.5 1.5-1.5h9c.7 0 1.5.8 1.5 1.5v9c0 .7-.8 1.5-1.5 1.5z" }),
      el("path", { key: 2, d: "m1.2 3.8 3.04-2.5S5.17.5 5.7.5h8.4c.66 0 1.4.73 1.4 1.4v7.73a2.7 2.7 0 01-.7 1.75l-2.68 3.51" }),
      el("path", { key: 3, d: "M6 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25S3.54 10 4.2 10h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25M4.5 6.5v1m0 5v1" }),
    ]);
  }
  if (ext === "sql" || ext === "db" || ext === "sqlite") {
    return svgWrap([
      el("path", { key: 1, d: "M8 6.5c3.59 0 6.5-1.4 6.5-2.68S11.59 1.5 8 1.5 1.5 2.54 1.5 3.82 4.41 6.5 8 6.5M14.5 8c0 .83-1.24 1.79-3.25 2.2s-4.49.41-6.5 0S1.5 8.83 1.5 8m13 4.18c0 .83-1.24 1.6-3.25 2-2.01.42-4.49.42-6.5 0-2.01-.4-3.25-1.17-3.25-2m0-8.3v8.3m13-8.3v8.3" }),
    ]);
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].indexOf(ext) >= 0) {
    return svgWrap([
      el("rect", { key: 1, x: 2, y: 2, width: 12, height: 12, rx: 2 }),
      el("circle", { key: 2, cx: 5.5, cy: 5.5, r: 1.5 }),
      el("path", { key: 3, d: "M14 10l-3.5-3.5L3 14" }),
    ]);
  }
  if (ext === "pdf") {
    return svgWrap([
      el("path", { key: 1, d: "M3.5 1.5h6l4 4v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z" }),
      el("path", { key: 2, d: "M9.5 1.5v4h4M5 11h2a1 1 0 0 0 0-2H5v4" }),
    ]);
  }
  /* Default / LICENSE / plain text: Catppuccin folded corner _file */
  return svgWrap([
    el("path", { key: 1, d: "M13.5 6.5v6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h4.01m-.01 0 5 5h-4a1 1 0 0 1-1-1z" }),
  ]);
}