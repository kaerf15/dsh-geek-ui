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
/* 评审修复：两击确认状态机——原 03 树删除 / 08 归档 / 09 worktree / 15-acp 历史
 * 四处各抄一份 useState。返回 [armedId, ask(id), cancel()]；布尔场景用常量 id（如 1）。
 * 各调用点以适配器保持原签名（is(id) === (armed === id)），行为逐点不变 */
function useTwoClick() {
  const t = React.useState(null);
  return [t[0], t[1], () => t[1](null)];
}
/* 评审修复：下拉骨架三件套（遮罩 / 过滤框 / 选项行）——原 03 笔记目录、09 项目、
 * 09 worktree 三处复制同一套 pw-drop-* 结构。行尾徽标等额外子节点经 extra 注入 */
const dropOverlayEl = (t) =>
    React.createElement("div", {
      className: "pw-drop-overlay",
      onClick: t,
    }),
  dropFilterEl = (t, e, s) =>
    React.createElement(
      "div",
      { className: "pw-drop-filter" },
      React.createElement("input", {
        className: "pw-input",
        value: t,
        placeholder: e,
        onChange: (o) => s(o.target.value),
      }),
    ),
  dropRowEl = (t) =>
    React.createElement(
      "button",
      {
        key: t.k,
        className: "pw-drop-row" + (t.cur ? " cur" : ""),
        title: t.title,
        onClick: t.onClick,
      },
      React.createElement(
        "span",
        { className: "pw-check" },
        t.cur ? "✓" : "",
      ),
      React.createElement("span", { className: "pw-mono" }, t.label),
      t.extra || null,
    );