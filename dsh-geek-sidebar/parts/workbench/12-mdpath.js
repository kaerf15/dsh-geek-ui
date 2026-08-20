var mdBaseDir = "";
function isExternalHref(s) {
  return /^(https?:|mailto:|#|data:)/i.test(String(s || ""));
}
function resolveLocalPath(s) {
  s = String(s || "").trim();
  if (!s || isExternalHref(s)) return null;
  s = s.replace(/^\.\//, "");
  if (s.slice(0, 2) === "~/") return s;
  if (s.charAt(0) !== "/") {
    if (!mdBaseDir) return null;
    s = mdBaseDir + "/" + s;
  }
  return s;
}
function mediaUrl(s) {
  const p = resolveLocalPath(s);
  return p ? API + "/wb/raw?path=" + encodeURIComponent(p) : s;
}
function openLocalPath(p) {
  try {
    store.open(sessionProbe.sid, { path: p, name: p.split("/").pop() || p });
  } catch (e) {}
}
