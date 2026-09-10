/* ==================== sidebarRight.openResource 拦截（漏网文件打开 → geek 预览） ====================
 * 0.1.5 平台把「聊天里打开文件」收敛到 client 服务 sidebarRight.openResource
 *（ui-chat apply.ts：fileAddressFor(sessionId, cwd, path) → openResource）。
 * 15-deliv 的 capture 点击拦截只覆盖 DOM 点击面；键盘触发、程序化调用等漏网
 * 路径仍会把文件开进官方右栏预览 tab。这里在 client apply 时给该服务的
 * openResource 包一层：dsh-resource://file/ 地址改道自家预览（与 12-mdpath
 * openLocalPath 同语义：当前会话 + store.open），其余地址原样放行。
 *
 * 钉住的平台私有面（0.1.5-rc.1，平台升级先核对）：
 *   - sidebarRight 服务存在（ui-sidebar-right 提供），openResource 可被实例属性覆写
 *     （服务是 SidebarRightController 实例，cordis 不冻结服务面对象）
 *   - dsh-resource://file/ 地址文法（util/workspace-path file-address.ts）：
 *     session/<sessionId>/<path> 与 absolute/<path> 两种 scope，段级
 *     encodeURIComponent（%3A 保留字面冒号，Windows 盘符可读）
 *   - chat openFile 恒以当前会话构造地址；跨会话文件地址本预览不接管（放行官方）
 */

const OPEN_RES_PREFIX = "dsh-resource://file/";

/* 解析 dsh-resource://file/ 地址；非文件地址返回 null（放行）。
 * 返回 { sessionId?, path }：session scope 带会话 id，path 为工作区相对或绝对；
 * absolute scope 无会话，path 恒为 / 拼回的绝对路径（POSIX 前缀 /、UNC 双斜、盘符原样）。 */
function parseOpenResAddress(addr) {
  if (typeof addr !== "string" || !addr.startsWith(OPEN_RES_PREFIX)) return null;
  const segs = addr
    .slice(OPEN_RES_PREFIX.length)
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch (e) {
        return s;
      }
    });
  if (segs[0] === "session" && segs.length >= 2) {
    return { sessionId: segs[1], path: segs.slice(2).join("/") };
  }
  if (segs[0] === "absolute") {
    const rest = segs.slice(1).join("/");
    /* Windows 盘符（C:/x）保持无前导斜杠；UNC 首段为空 → rest 以 / 开头 → 前缀 / 成双斜 */
    const path = /^[A-Za-z]:\//.test(rest) ? rest : "/" + rest;
    return { path };
  }
  return null;
}

/* 包 sidebarRight.openResource：文件地址 → 自家预览；其余 → 原实现。
 * 挂载进 ctx.effect，卸载时还原原方法；__geekWrapped 标记防 HMR 重复包层。 */
function installOpenResourceHook(t) {
  const sbr = t.get("sidebarRight");
  if (!sbr || typeof sbr.openResource !== "function") {
    /* 服务缺席 = 平台契约变动，与正常静默不同，留痕 */
    console.warn("[dsh-geek-sidebar] sidebarRight 不可读，漏网文件打开无法接管（平台契约变动？）");
    return;
  }
  t.effect(() => {
    if (sbr.openResource.__geekWrapped) return undefined;
    const orig = sbr.openResource;
    const wrapped = function (address, options) {
      const f = parseOpenResAddress(address);
      /* 非文件地址、或其他会话的文件地址 → 官方路径 */
      if (!f || (f.sessionId !== undefined && f.sessionId !== sessionProbe.sid)) {
        return orig.call(this, address, options);
      }
      if (!f.path) return orig.call(this, address, options);
      /* 与 15-deliv 同纪律：先请栏内占用者退场，再进自家预览 */
      yieldToPreview();
      openLocalPath(f.path);
      return undefined;
    };
    wrapped.__geekWrapped = true;
    try {
      sbr.openResource = wrapped;
    } catch (e) {
      /* 服务面对象被冻结等极端情况：接管失败不致命，官方路径仍可用 */
      console.warn("[dsh-geek-sidebar] sidebarRight.openResource 覆写失败", e);
      return undefined;
    }
    return () => {
      if (sbr.openResource === wrapped) sbr.openResource = orig;
    };
  }, "geek-sidebar: openResource hook");
}
