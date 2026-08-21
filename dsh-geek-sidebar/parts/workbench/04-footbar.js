function FootBar(t) {
  const e = React.createElement;
  /* 评审修复：删掉 useView()/useFilesTab() 两个"只为订阅、返回值从未使用"的废调用——
   * 重渲染由下面这条 bus 订阅一肩挑（acp 徽标 / bottomPanel 开态全走 bus） */
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  return t.wide === !1
    ? null
    : e(
        "div",
        { className: "pw-footbar" },
        e(
          "button",
          {
            className: "pw-foot-btn",
            onClick: () => t.onSkills && t.onSkills(),
          },
          e("span", { className: "pw-foot-ic" }, LayersIcon(12)),
          "技能",
        ),
        (() => {
          /* 智能体聚合徽标：运行中（绿）/ 待交互（黄）数量，面板关着也能看见 */
          const ac = acpTabs.counts();
          return e(
            "button",
            {
              className: "pw-foot-btn" + (bottomPanel.open ? " on" : ""),
              title:
                "助手：终端 / Kimi 智能体" +
                (ac.total ? "（运行中 " + ac.run + " · 待交互 " + ac.wait + " · 共 " + ac.total + " 个）" : ""),
              onClick: () => bottomPanel.set({ open: !bottomPanel.open }),
            },
            e("span", { className: "pw-foot-ic" }, BotIcon(12)),
            "助手",
            ac.run > 0 ? e("span", { className: "pw-foot-badge run", title: "运行中 " + ac.run }, String(ac.run)) : null,
            ac.wait > 0 ? e("span", { className: "pw-foot-badge wait", title: "待交互 " + ac.wait }, String(ac.wait)) : null,
          );
        })(),
      );
}
