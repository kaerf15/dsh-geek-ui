function FootBar(t) {
  const e = React.createElement;
  /* 重渲染由这条 bus 订阅一肩挑（面板开态走 bus） */
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
        e(
          "button",
          {
            className: "pw-foot-btn" + (qnStore.open ? " on" : ""),
            title: "便签：全局随手记，划选可一键存档/引用到对话",
            onClick: () => qnStore.set({ open: !qnStore.open }),
          },
          e("span", { className: "pw-foot-ic" }, NotebookIcon(12)),
          "便签",
        ),
      );
}
