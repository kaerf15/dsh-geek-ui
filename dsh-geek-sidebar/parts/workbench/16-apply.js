return {
  apply(t) {
    const e = t.get("slots");
    if (e === void 0) return;
    const s = t.get("layout"),
      o = t.get("sessions"),
      a = t.get("workspaces");
    (mountStyle(API + "/wb/style.css"),
      host
        .call("workbench.notesGet", {})
        .then((u) => {
          u && notesStore.set(u);
        })
        .catch(() => {}));
    const l = fileMentionBridge;
    /* details 面板仲裁服务：第三方经 ctx.inject(['dshDetailsPanels'], cb) 接入；
       register() 返回的注销函数须挂到消费方自己的 ctx.effect。 */
    t.provide("dshDetailsPanels");
    t.dshDetailsPanels = {
      register: (def) => panelStore.register(def),
      open: (id) => panelStore.open(id),
      close: (id) => panelStore.close(id),
      isOpen: (id) => panelStore.isOpen(id),
    };
    /* 底部区域仲裁服务：第三方经 ctx.inject(['dshBottomPanels'], cb) 接入。
       acquire(id) 独占占位（排他，被占即 false），占位期间我们的底部面板让位
       （渲染 null + 撤挤压，open 状态保留）；release(id) 归还后自动归位。
       对齐右栏 details 单槽 priority 的让位语义——shell.overlay 是多槽，无平台仲裁，故自建。 */
    t.provide("dshBottomPanels");
    t.dshBottomPanels = {
      acquire: (id) => bottomArea.acquire(id),
      release: (id) => bottomArea.release(id),
      owner: () => bottomArea.owner,
      isYielded: () => bottomArea.isYielded(),
    };
    /* @文件引用走 rc.8 原生 ui-reference 源（reference 组），插件不再注册
       * 自有 workbenchFile 组（v1.16.0 起移除，能力重叠）。
       * 侧栏"提及"仍走 dshFileMention 桥（insert-text 纯文本路径，原生无对应物）。 */
    (e.inject("sidebar.workspaces", () =>
        e.register({ name: "sidebar.workspaces", priority: -5 }, (u) =>
          React.createElement(Sidebar, {
            wide: u.wide,
            useSessions: u.useSessions,
            useWorkspaces: u.useWorkspaces,
            layout: s,
            sessionsSvc: o,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("sidebar.footer.action", () =>
        e.register(
          {
            name: "sidebar.footer.action",
            id: "workbench-footbar",
            order: 100,
          },
          (u) =>
            React.createElement(FootBar, {
              wide: u.wide,
              onSkills: () => skillsUI.open(currentRootPath || ""),
            }),
        ),
      ),
      e.inject("details", () =>
        /* single 槽 priority 最小者渲染：-0.5 压过官方默认（0），同时输给 dsh-gtm 抽屉（-1，
           打开才注册）——它开我们让位、它关我们归位。-1 与 0 之间只有小数可用。 */
        e.register({ name: "details", priority: -0.5 }, (u) =>
          React.createElement(PanelHost, {
            sessionId: u.sessionId,
            layout: s,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-bottom-panel" }, () => React.createElement(BottomPanel, { workspacesSvc: a })),
      ),
      e.inject("shell.overlay", () =>
        e.register(
          { name: "shell.overlay", id: "workbench-preview-drawer" },
          (u) =>
            React.createElement(PreviewDrawer, {
              layout: s,
              workspacesSvc: a,
              mentionBridge: l,
              /* 框架全局份额：drawer 用它判断官方 details 栏是否被会话门钳 0 */
              useSessions: u.useSessions,
            }),
        ),
      ));
  },
};
