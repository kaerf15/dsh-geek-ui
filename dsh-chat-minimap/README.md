# dsh-chat-minimap

DSH Web 插件：pi-web 风格的长对话导航地图。

会话右缘一排小方块，每个方块是一条你的发言。悬停展开整段对话大纲（你的发言摘要 + AI 回答的 h1–h3 标题），点击方块/标题平滑滚动定位，轨道支持按压拖动快速浏览。流式生成中的回答在大纲里点按即回到底部。

- 纯 client 实现（host 为空壳），副作用全部随 React effect 回收
- details 栏呼出时自动隐藏，平台弹层让位
- 私有面钩子均有注释登记（`Platform-private surface`）

## 安装

```bash
dsh plugin --profile web add <本包路径或 git 地址>
```

## 兼容

`verifiedWith`: dsh `0.1.0-rc.8`（见 package.json 的 `dsh` 域）。

许可：MIT（设计参考自 [pi-web](https://github.com/agegr/pi-web)，同 MIT）
