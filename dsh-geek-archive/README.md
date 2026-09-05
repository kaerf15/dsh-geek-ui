# dsh-geek-archive

DSH Web 的归档会话管理插件：在**设置面板**加一节「归档管理」，列出全部已归档会话，每条可**放回对话**或**永久删除**——补上原生 DSH 缺失的归档反向操作。

## 它能做什么

DSH 官方的"归档"是单向的：归档了就再也看不到、回不来。这个插件在 `设置 → 归档管理`（导航末位，归档盒图标）把已归档的会话全部列出来：

- **放回对话**：解除归档，会话回到对话列表。
- **删除**：解除归档 + 删除会话落盘目录 + 通知客户端从会话列表移除（两次点击确认，防误删）。

每条显示会话标题、所在目录、归档时间；改动由平台 WorkspaceFeed 自动推帧，前端零刷新。

## 安装

```bash
dsh plugin --profile web add dsh-geek-archive
```

## 平台私有面（0.1.2-rc.1，升级前先核对）

DSH 0.1.2-rc.1 无公开的"解除归档"或"删除会话" API，本插件在 host 端经 workspace registry 的 JS 层私有方法读写归档集合：

- 服务名 `workspaceRegistry`，方法 `requireState` / `setState` / `enqueueOperation`，状态字段 `archivedSessionIds`（TS `private` 仅编译期，构建产物 `dsh-workspace/lib/index.js` 已确认方法名未混淆）。
- `setState` → storageDomain `global.set` 发 `domain/changed` → `WorkspaceFeed` 自动推 `archived` 帧回客户端，前端无需手动刷新。
- Remote 事件 `api-session/removed`（删除后通知客户端从会话列表剔除，防其在对话列表里复活）。
- 会话落盘目录 `sessions/<projectKey(cwd)>/<encodeSegment(id)>/`（对齐 `dsh-session-persistence-jsonl/format`）。

## 已知边界

若删除时会话仍在运行，下一次 checkpoint 可能把落盘目录重新写回（归档中被删除的会话通常已结束）。

## License

MIT
