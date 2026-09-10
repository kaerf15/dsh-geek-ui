function PreviewDrawer(t) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const st = usePreviewState(sessionProbe.sid);
  const [hiddenFor, setHiddenFor] = React.useState(null);
  /* 评审修复：遮罩 dismiss 只压"这一次打开"——文件关掉（activeFile 空）即复位 hiddenFor，
   * 重开同一文件抽屉能再出场（原版永不重置，同路径关闭再开也被永久压制，无挽回路径） */
  React.useEffect(() => {
    !st.activeFile && hiddenFor && setHiddenFor(null);
  }, [st.activeFile, hiddenFor]);
  /* 0.1.5：平台 details 栏整个移除（layout.openDetails/closeDetails、'details' 槽均消失），
   * 本 drawer 从「窄屏顶替」改为「唯一预览宿主」，宽窄屏都出场。
   * 宿主内容用 PanelHost（dshDetailsPanels 三方驱动面）而非裸 Details，保住该服务面。 */
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
      e(PanelHost, {
        layout: t.layout,
        /* drawer 本来就是宽面板，缩放钮只在栏内模式出场 */
        inDrawer: !0,
        workspacesSvc: t.workspacesSvc,
        mentionBridge: t.mentionBridge,
      }),
    ),
  );
}
