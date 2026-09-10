return {
  apply(t) {
    const e = t.get("slots");
    if (e === void 0) return;
    const s = t.get("layout"),
      o = t.get("sessions"),
      a = t.get("workspaces");
    (mountStyle(API + "/wb/style.css?v=2.0.5&t=" + Date.now()),
      host
        .call("workbench.notesGet", {})
        .then((u) => {
          u && notesStore.set(u);
        })
        .catch(() => {}),
      host
        .call("workbench.qnState", {})
        .then((u) => {
          u && u.ok && qnStore.set({ dir: u.dir, custom: u.custom, capture: u.capture });
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
    /* @文件引用走 rc.8 原生 ui-reference 源（reference 组），插件不再注册
       * 自有 workbenchFile 组（v1.16.0 起移除，能力重叠）。
       * 侧栏/详情"提及"仍走 dshFileMention 桥，但改投 slash/input-insert-reference
       * 插成本地 chip（复用 reference 源 codec），与输入框原生 @ 一致。 */
    (e.inject("sidebar.workspaces", () =>
        e.register({ name: "sidebar.workspaces", priority: -5 }, (u) =>
          React.createElement(Sidebar, {
            wide: u.wide,
            useSessions: u.useSessions,
            useWorkspaces: u.useWorkspaces,
            layout: s,
            sessionsSvc: o,
            workspacesSvc: a,
            workspaceNav: t.get("uiWorkspace"),
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
      /* 0.1.5：'details' 槽已从平台移除（ui-layout 不再声明），此处不再注册 PanelHost；
       * 预览唯一宿主改为常驻 drawer（13-drawer），dshDetailsPanels 服务面保留不变。 */
      /* chat 产出文件 chip / 工具卡文件链接点击接管（15-deliv）：平台 openFile 走
       * 系统默认应用（外部打开），capture 拦普通左键改道应用内预览（drawer）；修饰键点击
       * 保留系统打开。cwd 跟踪在 09-sidebar 的会话订阅效应（sessionCwd）。 */
      installDelivChipHook(),
      /* 漏网文件打开接管（15c-open-resource）：包 sidebarRight.openResource，
       * capture 点击拦不住的键盘/程序化路径也改道自家预览 */
      installOpenResourceHook(t),
      /* 便签小胶囊引用源通道注册（15-quicknotes）：通过 inputTriggers 注册 @geek-notes-quote 源 */
      installQnQuote(t),
      /* DirPicker 单实例宿主：多处路径选择（项目/笔记/便签）共用的应用内目录选择模态 */
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-dir-picker" }, () => React.createElement(DirPickerHost, null)),
      ),
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-quick-notes" }, () => React.createElement(QuickNotesHost, null)),
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
