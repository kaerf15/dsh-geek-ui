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
/* 当前会话 cwd（chat 文件点击接管反解相对路径用）；09-sidebar 的会话订阅效应同步写 */
const sessionCwd = { sid: null, cwd: null };
/* @提及引用块（ReferenceInsert，原生 chip 路径）：与输入框原生 @ 菜单一致——把选中文件
 * 插成整体 chip，退格一次整块删除。ref/clipboardText 用原生 formatFileMention 同款引号规则
 *（含空格路径 `@"..."`；目录保持开引号以续补）。相对路径逻辑与旧 mentionPath 一致：
 * 位于当前项目根下时取相对路径，否则取绝对路径；opts.abs 强制绝对路径（知识库分栏用）。 */
function mentionRef(t, e, opts) {
  const abs = !!(opts && opts.abs);
  let shown = t;
  if (!abs) {
    const s = currentRootPath;
    if (s && t !== s && pathHasPrefix(t, s)) shown = t.slice(s.length + 1);
  }
  const dir = e === true;
  const at = dir ? shown + "/" : shown;
  const q = /\s/u.test(at);
  const mention = q ? (dir ? '@"' + at : '@"' + at + '"') : "@" + at;
  return {
    source: "reference",
    ref: mention,
    label: baseName(t) + (dir ? "/" : ""),
    appearance: dir ? "folder" : "file",
    clipboardText: mention,
  };
}
/* 评审修复：两击确认状态机——原 03 树删除 / 08 归档 / 09 worktree 等
 * 多处各抄一份 useState。返回 [armedId, ask(id), cancel()]；布尔场景用常量 id（如 1）。
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