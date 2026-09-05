/* workbench feature 维护源码（可读版）：侧栏（工作区/会话/git worktree）、文件管理器（项目/笔记）、
 * 文件预览（大纲/编辑/聚焦重读/手动刷新）、底栏（技能/终端入口）、目录选择模态（DirPicker，
 * 15-dirpicker.js：项目/笔记/终端 三处路径选择共用，复刻 pi-web DirectoryPicker 交互）。
 * 由 parts/build.mjs 与 head.js / skills.js / tail.js 拼接成 lib/client.js；改这里，别改产物。 */