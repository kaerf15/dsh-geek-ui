/* 评审修复：模块级 var mdBaseDir 已删——基目录改由 renderMarkdown 经 bd 显式传入
 *（原渲染期写共享态；resolveLocalPath/mediaUrl 第二参即 bd，缺省 "" 与原空值同义） */
function isExternalHref(s) {
  return /^(https?:|mailto:|#|data:)/i.test(String(s || ""));
}
function resolveLocalPath(s, bd) {
  s = String(s || "").trim();
  if (!s || isExternalHref(s)) return null;
  s = s.replace(/^\.\//, "");
  if (s.slice(0, 2) === "~/") return s;
  if (s.charAt(0) !== "/") {
    if (!bd) return null;
    s = bd + "/" + s;
  }
  return s;
}
function mediaUrl(s, bd) {
  const p = resolveLocalPath(s, bd);
  return p ? API + "/wb/raw?path=" + encodeURIComponent(p) : s;
}
function openLocalPath(p) {
  try {
    store.open(sessionProbe.sid, { path: p, name: p.split("/").pop() || p });
  } catch (e) {}
}
