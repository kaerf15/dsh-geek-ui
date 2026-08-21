function PreviewDrawer(t) {
  const e = React.createElement;
  const narrow0 = () => window.matchMedia("(max-width:1219px)").matches;
  const [narrow, setNarrow] = React.useState(narrow0);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width:1219px)");
    const f = () => setNarrow(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const st = usePreviewState(sessionProbe.sid);
  const [hiddenFor, setHiddenFor] = React.useState(null);
  /* 评审修复：遮罩 dismiss 只压"这一次打开"——文件关掉（activeFile 空）即复位 hiddenFor，
   * 重开同一文件抽屉能再出场（原版永不重置，同路径关闭再开也被永久压制，无挽回路径） */
  React.useEffect(() => {
    !st.activeFile && hiddenFor && setHiddenFor(null);
  }, [st.activeFile, hiddenFor]);
  /* 宽屏下官方 details 栏是否可用：镜像 ui-layout AppFrame 的 detailsSession 门
   * ——有当前会话且 blank===false 才给列宽，否则钳 0（新建空白会话/无会话时
   * openDetails 只恢复宽度偏好，拗不过该钳制，预览被压进 0 宽列不可见）。
   * 平台私有面脆弱点登记：规则跟随 packages/client/ui-layout/src/client/
   * AppFrame.tsx 的 detailsSession，平台升级先核它。useSessions 缺失（框架
   * 全局份额未给到 shell.overlay）时退化为旧行为：仅窄屏出场。
   * 门不可用 → 本 drawer 顶替出场；可用 → 让位回右栏，两者互斥无双重预览。 */
  const detailsAvailable = t.useSessions
    ? t.useSessions((s) => {
        const cur = s.current;
        return cur !== undefined && s.byId[cur] !== undefined && s.byId[cur].blank === false;
      })
    : true;
  if (!narrow && detailsAvailable) return null;
  if (!st.activeFile) return null;
  if (hiddenFor === st.activeFile.path) return null;
  return e(
    React.Fragment,
    null,
    e("div", {
      className: "pw-drawer-mask",
      onClick: () => setHiddenFor(st.activeFile.path),
    }),
    e(
      "div",
      { className: "pw-drawer-wrap" },
      e(Details, {
        /* 评审修复：删掉 sessionId 死 prop——Details 只读 sessionProbe.sid，从不消费该 prop。
         *（16-apply 的 PanelHost 仍保留 sessionId：那是 dshDetailsPanels 三方驱动的服务面，非 Details 私有） */
        layout: t.layout,
        workspacesSvc: t.workspacesSvc,
        mentionBridge: t.mentionBridge,
      }),
    ),
  );
}
