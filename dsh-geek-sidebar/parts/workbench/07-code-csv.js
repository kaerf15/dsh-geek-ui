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
function fileIconEl(t, e) {
  const s = (t.split(".").pop() || "").toLowerCase(),
    o = e || 13;
  return s === "md" || s === "markdown" || s === "txt"
    ? FileTextIcon(o)
    : ["png", "jpg", "jpeg", "gif", "webp", "svg"].indexOf(s) >= 0
      ? ImageIcon(o)
      : [
            "js",
            "ts",
            "jsx",
            "tsx",
            "mjs",
            "cjs",
            "py",
            "sh",
            "go",
            "rs",
            "java",
            "rb",
          ].indexOf(s) >= 0
        ? CodeIcon(o)
        : s === "json" || s === "yml" || s === "yaml" || s === "toml"
          ? BracesIcon(o)
          : ["html", "css", "vue"].indexOf(s) >= 0
            ? GlobeIcon(o)
            : FileIcon(o);
}