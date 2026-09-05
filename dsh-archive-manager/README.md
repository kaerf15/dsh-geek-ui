# dsh-archive-manager

DSH Web 会话归档管理：侧栏底栏独立入口（归档盒图标，非齿轮），打开面板列出全部已归档会话，每条可「放回对话」或「删除」。

## 功能

- **放回对话**：解除归档，会话回到对话列表。
- **删除**：解除归档 + 删除会话落盘目录 + 通知客户端从会话列表移除（两次点击确认）。

## 平台私有面（0.1.2-rc.1，升级前先核对）

dsh 0.1.2-rc.1 的归档是**单向**的（官方 README：no unarchive action exists yet），也无公开的会话删除。本插件在 host 端经过 workspace registry 的 JS 层私有方法读写归档集合：

- 服务名 `workspaceRegistry`，方法 `requireState` / `setState` / `enqueueOperation`，状态字段 `archivedSessionIds`（TS `private` 仅编译期，构建产物 `dsh-workspace/lib/index.js` 已确认方法名未混淆）。
- `setState` → storageDomain `global.set` 发 `domain/changed` → `WorkspaceFeed` 自动推 `archived` 帧回客户端，前端无需手动刷新。
- Remote 事件 `api-session/removed`（删除后通知客户端从会话列表剔除，防其在对话列表里复活）。
- 会话落盘目录 `sessions/<projectKey(cwd)>/<encodeSegment(id)>/`（对齐 `dsh-session-persistence-jsonl/format`）。

## 已知边界

若删除时会话仍在运行，下一次 checkpoint 可能把落盘目录重新写回（归档中被删除的会话通常已结束）。