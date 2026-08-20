/* ==================== details 面板驱动管理器 ====================
 * details 槽的仲裁层：文件预览是默认驱动，其余面板（助手、第三方）经
 * dshDetailsPanels 服务注册为驱动，open/close 排他（替换式弹出：激活即
 * 整体替换右栏内容，关闭即回预览）。驱动不再裸抢 details 槽的 priority；
 * 外来裸注册插件仍按槽语义（最小者渲染）轮值。 */
const panelStore = {
  panels: [],
  activeId: null,
  register(def) {
    if (!def || !def.id || typeof def.render !== "function") return () => {};
    panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id).concat([def]);
    bus.fire();
    return () => {
      panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id);
      if (panelStore.activeId === def.id) panelStore.activeId = null;
      bus.fire();
    };
  },
  open(id) {
    if (!panelStore.panels.some((p) => p.id === id)) return false;
    panelStore.activeId = id;
    bus.fire();
    return true;
  },
  close(id) {
    if (!panelStore.activeId) return false;
    if (id !== undefined && panelStore.activeId !== id) return false;
    panelStore.activeId = null;
    bus.fire();
    return true;
  },
  isOpen(id) {
    return panelStore.activeId === id;
  },
};
function usePanels() {
  const t = React.useState(0);
  React.useEffect(() => bus.sub(() => t[1]((x) => x + 1)), []);
  return { panels: panelStore.panels, activeId: panelStore.activeId };
}
/* 单个驱动渲染失败不拖垮整个 details 列 */
class PanelErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error("[dsh-geek-sidebar] 面板渲染失败", err);
  }
  render() {
    return this.state.err
      ? React.createElement("div", { className: "pw-hint", style: { padding: "20px" } }, "面板渲染失败：" + String((this.state.err && this.state.err.message) || this.state.err))
      : this.props.children;
  }
}
/* PanelHost：替换式弹出（无 tab）。有激活驱动 → 整体替换右栏内容；
 * 驱动 close()（面板自带关闭或入口再点）→ 回到默认预览。 */
function PanelHost(t) {
  const e = React.createElement;
  const { panels, activeId } = usePanels();
  const active = panels.find((p) => p.id === activeId) || null;
  return active ? e(PanelErrorBoundary, { key: active.id }, active.render(t)) : e(Details, t);
}
