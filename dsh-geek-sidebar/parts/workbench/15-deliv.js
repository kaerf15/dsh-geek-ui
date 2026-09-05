/* ==================== chat 文件点击接管（deliv-hook） ====================
 * 对话里两类文件点击面默认走平台 openFile → remote.session.openWorkspacePath →
 * 宿主原生 open（系统默认应用，即"外部打开"）。这里在 document capture 阶段拦
 * 普通左键改道应用内预览（delivOpenFile → openLocalPath）；修饰键点击保留系统
 * 打开。（v1.22.0 起：产物/链接弹出面板与事件窗口订阅整体移除，仅保留本接管。）
 *   ① 产出文件 chip（ui-deliverables ProducedFiles.tsx）：行容器自带
 *      data-produced-files-row，chip 为 button[title=完整路径]；
 *      「在文件夹中显示」钮 openFile('.') 无 title 属性，自然放行。
 *   ② 工具卡文件链接（ui-tool ToolRow.tsx，read/write/edit 行）：摘要按钮产物类名
 *      形如 "o3BgMG_fileLink"（vite CSS Modules <hash>_<local>，fileLink 子段健在），
 *      行根带 data-variant/data-tool；按钮文本 = 原路径 relativizeToCwd（剥 cwd 前缀）
 *      + abbreviateHomePath（home→~）后的摘要——相对/绝对反解进预览，~ 摘要
 *      （客户端无宿主 home）放行外部打开。
 * React 17+ 事件委托挂根容器——document capture 先于根委托触发，stopPropagation
 * 即断其 onClick（平台 fileLink 自身也 stopPropagation，行展开不受影响）。
 *
 * 钉住的平台私有面（0.1.2-alpha.4，平台升级先核对）：
 *   - chat openFile→openWorkspacePath 外部打开语义（ui-chat apply.ts）
 *   - ProducedFiles 行容器属性 data-produced-files-row + chip button[title=完整路径]
 *   - ToolRow 行根 data-variant + 摘要按钮产物类名含 fileLink 子段 + 摘要文本 =
 *     relativizeToCwd + abbreviateHomePath 语义
 *   - React 17+ 根容器事件委托（document capture 先于根委托）
 * cwd 来源：当前会话 byId.cwd（sessionCwd，09-sidebar 会话订阅效应同步写）。
 */

/* 相对路径按会话 cwd 解析成绝对路径（预览打开用）；绝对路径原样 */
function delivAbsPath(cwd, p) {
  const s = String(p || "");
  if (!s) return "";
  if (s.charAt(0) === "/" || s.charAt(0) === "~" || /^[A-Za-z]:[\\/]/.test(s)) return s;
  return cwd ? pathJoinFor(cwd, s) : s;
}

/* chat 点文件：先让当前右栏占用者退场（对齐 03-tree 的 yieldToPreview 纪律）再进预览 */
function delivOpenFile(cwd, p) {
  yieldToPreview();
  openLocalPath(delivAbsPath(cwd, p));
}

const DELIV_CHIP_SEL = "div[data-produced-files-row] button[title]";
const DELIV_TOOL_LINK_SEL = 'div[data-variant] [class*="fileLink"]';
function delivChipHook(ev) {
  if (ev.defaultPrevented || ev.button !== 0) return;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const tgt = ev.target;
  if (!tgt || !tgt.closest) return;
  const sid = sessionProbe.sid;
  if (!sid) return;
  const cwd = sessionCwd.sid === sid ? sessionCwd.cwd : null;
  /* ① 产出文件 chip：title 即完整路径（~ 开头无法反解，放行外部，与 ② 同规） */
  const chip = tgt.closest(DELIV_CHIP_SEL);
  if (chip) {
    const p = chip.getAttribute("title");
    if (!p || p === "." || p.charAt(0) === "~") return;
    ev.preventDefault();
    ev.stopPropagation();
    delivOpenFile(cwd, p);
    return;
  }
  /* ② 工具卡文件链接：摘要文本反解（相对路径按 cwd；~ 摘要无法反解，放行外部） */
  const link = tgt.closest(DELIV_TOOL_LINK_SEL);
  if (!link) return;
  const raw = (link.textContent || "").trim();
  if (!raw || raw.charAt(0) === "~") return;
  ev.preventDefault();
  ev.stopPropagation();
  delivOpenFile(cwd, raw);
}
function installDelivChipHook() {
  /* HMR 幂等：模块重载重跑 apply 时先摘旧闭包（旧实例 store/probe 已冻结） */
  const flag = "__dshDelivChipHook";
  if (document[flag]) document.removeEventListener("click", document[flag], true);
  document[flag] = delivChipHook;
  document.addEventListener("click", delivChipHook, true);
}
