/* ==================== 预览入驻官方右栏（sidebarRight 页面 tab） ====================
 * 0.1.5 起平台有了完整的右栏 tab 体系（ui-sidebar-right）：右栏展开钮（页头 corner
 * 槽的 ③）、停靠/拖宽/全屏、每会话独立 surface 全由平台管。本插件的预览从
 * 「自绘浮层抽屉」改为「右栏页面 tab」：
 *   - 注册页面类型 geekPreview（无地址认领，openTab(kind) 开）；
 *   - body 复用现有 PanelHost（读自家 preview store，dshDetailsPanels 三方驱动面不变）；
 *   - openLocalPath（12-mdpath）打开文件后调 revealPreviewTab() 揭示右栏；
 *   - 官方右栏展开钮 ③ 天然成为预览的入口/出口。
 * 钉住的平台私有面（0.1.5-rc.1，升级先核对）：
 *   - ctx.sidebarRightTabs.register(definition)：{id, kind, title, 无 patterns 即页面型}
 *   - ctx.sidebarRight.openTab(kind)：揭示栏并把该页 tab 置前（页面型 pane 内去重）
 *   - body 注册槽 sidebar.right.pane.tab，key = 定义的 id
 */

const GEEK_PREVIEW_TAB_ID = "dsh-geek-sidebar-preview";
const GEEK_PREVIEW_TAB_KIND = "geekPreview";

/* apply 时注入的 sidebarRight 服务引用（openLocalPath 揭示用）；缺席 = 平台契约变动 */
let rightbarSvc = null;

/* 打开文件后揭示右栏预览 tab；服务缺席静默（预览内容仍在 store，栏出现即显示） */
function revealPreviewTab() {
  try {
    if (rightbarSvc) rightbarSvc.openTab(GEEK_PREVIEW_TAB_KIND);
  } catch (e) {}
}

/* body 组件：以 useTabInfo 拿到本 tab 实例 id，预览桶按「会话::实例」分键（分栏不镜像）；
 * 挂载登记 + 收养会话裸桶，卸载注销；栏内按下指针即标记为本会话的写入目标。
 * useTabInfo 由槽的 hookContext 保证在场（同官方 TextPreview），缺失时回落会话桶。 */
function GeekPreviewBody(u) {
  const info = u.useTabInfo ? u.useTabInfo() : null;
  const sid = u.sessionId || sessionProbe.sid;
  const okey = info ? sid + "::" + info.tab.id : sid;
  React.useEffect(() => {
    occurAdopt(okey, sid);
    return () => occurRemove(okey);
  }, [okey, sid]);
  return React.createElement(
    "div",
    { style: { display: "contents" }, onPointerDownCapture: () => occurTouch(okey) },
    React.createElement(PanelHost, {
      /* sessionId 透传：slot standardProps 自带，是 dshDetailsPanels 三方面板的
       * 既有服务面（旧 details 槽经 owner props 传入），不能丢 */
      sessionId: u.sessionId,
      okey,
      layout: GEEK_PREVIEW_DEPS.layout,
      inDrawer: true,
      workspacesSvc: GEEK_PREVIEW_DEPS.workspacesSvc,
      mentionBridge: GEEK_PREVIEW_DEPS.mentionBridge,
    }),
  );
}

/* 注册预览 tab：类型定义 + body。deps 取自 apply 闭包（layout/workspacesSvc/mentionBridge）。
 * body 传 inDrawer=true：栏内模式下 geek 自绘的缩放/收栏钮隐藏，开关交给平台 tab 铬。
 * guide 入口：平台的默认页规则是「全应用只有一个 guide 入口时它成为默认页」——
 * 官方 files 已被本插件禁用（入口为 0），本入口补位后右栏首开即预览而非「开始」。 */
const GEEK_PREVIEW_DEPS = {};
function installRightbarPreview(t, deps) {
  const tabs = t.get("sidebarRightTabs");
  const sbr = t.get("sidebarRight");
  const slots = t.get("slots");
  if (!tabs || !sbr || !slots) {
    console.warn("[dsh-geek-sidebar] sidebarRight/sidebarRightTabs 不可读，预览无法入驻右栏（平台契约变动？）");
    return;
  }
  rightbarSvc = sbr;
  Object.assign(GEEK_PREVIEW_DEPS, deps);
  t.effect(
    () =>
      tabs.register({
        id: GEEK_PREVIEW_TAB_ID,
        kind: GEEK_PREVIEW_TAB_KIND,
        title: () => "预览",
        guide: [{ order: 10, title: () => "预览", description: () => "工作区文件预览与三方详情面板" }],
      }),
    "geek-sidebar: preview tab type",
  );
  t.effect(
    () =>
      slots.inject("sidebar.right.pane.tab", () =>
        slots.register({ name: "sidebar.right.pane.tab", key: GEEK_PREVIEW_TAB_ID }, (u) =>
          React.createElement(GeekPreviewBody, u),
        ),
      ),
    "geek-sidebar: preview tab body",
  );
  t.effect(
    () => () => {
      rightbarSvc = null;
    },
    "geek-sidebar: preview tab cleanup",
  );
}
