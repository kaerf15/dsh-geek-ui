const recentRoots = [];
function rememberRoot(t) {
  if (!t) return;
  const e = recentRoots.indexOf(t);
  (e >= 0 && recentRoots.splice(e, 1),
    recentRoots.unshift(t),
    recentRoots.length > 8 && (recentRoots.length = 8));
}
const sessionProbe = {
  sid: null,
  set(t) {
    sessionProbe.sid !== t && ((sessionProbe.sid = t), bus.fire());
  },
  sub(t) {
    return bus.sub(t);
  },
};
function mentionPath(t, e) {
  const s = currentRootPath;
  return (
    "@" +
    (s && t.indexOf(s + "/") === 0 ? t.slice(s.length + 1) : t) +
    (e ? "/ " : " ")
  );
}