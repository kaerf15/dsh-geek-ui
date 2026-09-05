# DSH Geek UI

> DeepSeek Harness Web 工作台的极客增强组件：**页头重排 + 极客侧栏**，一个让 dsh web 好用到离不开的静态 bundle 组合。

![npm](https://img.shields.io/npm/v/dsh-geek-header?label=dsh-geek-header&logo=npm) ![npm](https://img.shields.io/npm/v/dsh-geek-sidebar?label=dsh-geek-sidebar&logo=npm) ![dsh](https://img.shields.io/badge/verifiedWith-0.1.2--rc.1-8A2BE2) ![license](https://img.shields.io/badge/license-MIT-green)

## 安装

```bash
dsh plugin --profile web add dsh-geek-header
dsh plugin --profile web add dsh-geek-sidebar
```

两条命令，装完即用，随 profile 重启常驻。（自定义了 profile 名就把 `web` 换成你的）

## dsh-geek-header（v0.4.5 · verifiedWith 0.1.2-rc.1）

DSH Web 页头重排 + 会话标题一键生成：第一行第三方插件区（geekUiHeader 服务），第二行收纳页签/谱系/动作平铺，面包屑文字与 Session log 隐藏，拥挤时动作折叠进 ⋯ 菜单；「生成标题」读整段对话、用你当前选中的模型生成会话标题，生成中/成功/失败都有即时反馈。布局与设计细节见 [dsh-geek-header/README.md](dsh-geek-header/README.md)。

## dsh-geek-sidebar（v2.0.0 · verifiedWith 0.1.2-rc.1）

DSH Web 极客侧栏：工作台侧栏 + 文件管理器/预览 + 便签与划选引用 + 技能管理 + @文件提及桥 + chat 文件点击接管，一个静态 bundle。

### 五大亮点（实拍）

**1. 项目与会话管理**——左栏就是你的项目指挥部：一键切换工作区（还能自定义任意目录）、每个项目的会话一目了然。正在跑的会话有个小圆点提醒你，别的工作区有几条会话在跑，工作区按钮上的数字徽标直接告诉你，不用挨个点开看。git worktree 也能直接查看和新建。

![项目与会话管理](screenshots/session-management.png)

**2. @功能**——把文件带进对话有两条路，随你顺手：在输入框敲一个 `@`，当前项目的文件立刻列出来等你挑，路径随打随筛；或者干脆在文件管理器里找到它，行上那个 @ 按钮点一下，它就进了输入框。选中哪个，哪个文件就进入对话上下文——从此不用手动复制粘贴路径。

![@功能](screenshots/at-mention.png)

**3. 知识库目录**——侧栏底部的"笔记"页签是你所有长效知识库目录的入口：多个目录随时切换，隐藏文件也照常显示。点开一篇，右边就是排版好的预览；随手就能改，改完点"确定保存"才落盘，不点头也不担心误存。

![笔记功能](screenshots/notes.png)

![笔记预览与编辑](screenshots/file-preview.png)

**4. skill 管理**——底栏"技能"一键打开技能中心：你装过的所有技能都在这儿，能看来源、版本和说明，开关随点随切，还能直接搜索安装新技能、检查更新。

![skill 管理](screenshots/skills-modal.png)

**5. 便签与划选引用**——底栏一键打开全局便签抽屉，轻量随手记，不绑会话；在聊天记录中划选任意文本自动弹出气泡，可一键"存入便签"或生成智能紧凑小胶囊"引用到对话"（选中正文，长文本自动提取首尾词，输入框不刷屏，发送时完整展开交付模型）；每条便签与目录行上也有 @ 按钮：便签 @ 按该 `.md` 文件路径提成 @ 提及（与第 2 点的文件 @ 同机制），目录 @ 则把目录下全部便签各自按路径提成 @；支持随时一键将成熟便签转存至知识库，存储目录随心自定义。

---

许可：[MIT](LICENSE)（dsh-geek-sidebar 部分设计参考自 [pi-web](https://github.com/agegr/pi-web)，同 MIT）
