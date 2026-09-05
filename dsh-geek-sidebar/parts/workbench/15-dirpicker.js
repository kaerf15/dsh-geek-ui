/* DirPicker：应用内目录选择模态（交互复刻 pi-web 的 DirectoryPicker），统一三处路径选择
 * ——09 项目"自定义路径" / 15 终端 ＋ / 01 笔记"选择目录…"，替换原生 OS 对话框
 *（svc.pickDirectory、/wb/notesPick 的 osascript；原生路由仍在 host 保留给外部调用）。
 *
 * 架构（对齐既有模式）：
 *  - dirPicker 是纯状态机 store（不挂 React 钩子，可无头驱动；代际 seq 防迟到回包写态）；
 *  - pickDir(opts) → Promise<path|null>，签名对齐平台 workspaces.pickDirectory，
 *    调用点把 svc.pickDirectory() 换成 pickDir() 即完成迁移；
 *  - DirPickerHost 单实例挂 shell.overlay（16-apply），req 空即卸载；
 *  - 导航走自家 workbench.listDir（响应带 path/parent）；起点语义收口在 nav：
 *    null = 默认目录（workbench.prefsGet，未自定义回落桌面；footer 星钮经 prefsSet 自定），
 *    无 native capability 依赖——纯浏览器远程访问场景同样可用（原生对话框的盲区）；
 *  - 专属 bus 频道 'dirPicker'（对齐 01-stores 的热路径扇出纪律）：击键/导航重渲染
 *    只触达本模态，不扰动侧栏树等全局订阅者。
 * 只列目录（listDir 同时返回文件，此处过滤）；隐藏目录保留（~/.dsh 这类目标可达）。 */
const DIRPICKER_CHAN = "dirPicker",
  dirPicker = {
  req: null /* { title, resolve }——非空即"打开中" */,
  path: "",
  parent: null,
  input: "",
  entries: [],
  loading: false,
  error: null,
  seq: 0 /* 导航代际：每次 nav/settle 递增，迟到的响应不得写态 */,
  /* 默认打开目录（1.19.12）：defDir null = 未加载；未自定义/已失效时 host 回落桌面。
   * 首开由 nav(null) 先拉偏好再导航，之后常驻内存（footer 星钮可改） */
  defDir: null,
  defCustom: false,
  open(t) {
    dirPicker.req && dirPicker.settle(false) /* 重开先结算旧请求，不留悬空 Promise */;
    const e = ++dirPicker.seq;
    return new Promise((s) => {
      ((dirPicker.req = { title: (t && t.title) || "选择目录", resolve: s }),
        (dirPicker.path = ""),
        (dirPicker.parent = null),
        (dirPicker.input = (t && t.initialPath) || ""),
        (dirPicker.entries = []));
      /* 起点解析单点收口在 nav：null = 默认目录 */
      dirPicker.nav(t && t.initialPath ? String(t.initialPath) : null, e);
    });
  },
  /* footer 星钮：把当前目录设为默认；当前即自定义默认时再点为清除（恢复桌面回落） */
  toggleDefault() {
    const t = dirPicker.path;
    if (!t) return;
    const e = t === dirPicker.defDir && dirPicker.defCustom;
    host.call("workbench.prefsSet", { pickerDir: e ? "" : t }).then(
      (s) => {
        if (!s || s.ok === false) return;
        /* host prefsSet 经 prefsOut 自愈回包（pickerDir 为空时回 desktopDir），
         * s.pickerDir 恒非空——直接赋值（原先的 || dirPicker.defDir 是死分支） */
        ((dirPicker.defDir = s.pickerDir),
          (dirPicker.defCustom = !!s.custom),
          bus.fire(DIRPICKER_CHAN));
      },
      () => {},
    );
  },
  nav(t, e) {
    const s = e || ++dirPicker.seq;
    if (t === null && dirPicker.defDir === null) {
      /* 首开且偏好未载：先拉默认目录再导航；拉取失败不挡路，空串由 host 回落 home */
      ((dirPicker.loading = !0), (dirPicker.error = null), bus.fire(DIRPICKER_CHAN));
      host.call("workbench.prefsGet", {}).then(
        (o) => {
          if (s !== dirPicker.seq || !dirPicker.req) return;
          ((dirPicker.defDir = (o && o.pickerDir) || ""),
            (dirPicker.defCustom = !!(o && o.custom)),
            dirPicker.nav(dirPicker.defDir, s));
        },
        () => {
          if (s !== dirPicker.seq || !dirPicker.req) return;
          ((dirPicker.defDir = ""), dirPicker.nav("", s));
        },
      );
      return;
    }
    const p = t === null ? dirPicker.defDir : t;
    ((dirPicker.loading = !0), (dirPicker.error = null), bus.fire(DIRPICKER_CHAN));
    host.call("workbench.listDir", { path: p }).then(
      (o) => {
        if (s !== dirPicker.seq || !dirPicker.req) return;
        if (o && o.error) {
          /* 目录不可读：留在原位，错误内联展示（对齐 pi-web），输入框保持用户所敲 */
          ((dirPicker.loading = !1), (dirPicker.error = String(o.error)), bus.fire(DIRPICKER_CHAN));
          return;
        }
        ((dirPicker.path = (o && o.path) || p),
          (dirPicker.parent = (o && o.parent) || null),
          (dirPicker.input = dirPicker.path),
          (dirPicker.entries = ((o && o.entries) || []).filter(
            (a) => a.type === "directory",
          )),
          (dirPicker.loading = !1),
          bus.fire(DIRPICKER_CHAN));
      },
      (o) => {
        if (s !== dirPicker.seq || !dirPicker.req) return;
        ((dirPicker.loading = !1),
          (dirPicker.error = String((o && o.message) || o)),
          bus.fire(DIRPICKER_CHAN));
      },
    );
  },
  /* 关闭并结算：commit 取当前 path，否则 null。bump 代际使在途导航回包失效 */
  settle(t) {
    const e = dirPicker.req;
    if (!e) return;
    (++dirPicker.seq, (dirPicker.req = null), bus.fire(DIRPICKER_CHAN), e.resolve(t ? dirPicker.path : null));
  },
};
const pickDir = (t) => dirPicker.open(t);
function DirPickerHost() {
  const t = React.createElement,
    [, e] = React.useState(0);
  React.useEffect(() => bus.sub(() => e((s) => s + 1), DIRPICKER_CHAN), []);
  const s = dirPicker.req;
  if (!s) return null;
  /* 输入框有未提交改动时禁用"选择"（对齐 pi-web：先打开再选，防误选旧目录） */
  const o = dirPicker.input.trim() !== dirPicker.path,
    a = !!dirPicker.path && !o && !dirPicker.loading,
    /* 星钮三态：非默认（可设为默认）/ 自定义默认（再点恢复桌面）/ 桌面回落默认（禁用展示） */
    i = !!dirPicker.path && dirPicker.path === dirPicker.defDir,
    l = i && !dirPicker.defCustom;
  return t(
    "div",
    {
      className: "pw-dpk-mask",
      onClick: (i) => {
        i.target === i.currentTarget && dirPicker.settle(false);
      },
      /* Esc 经冒泡捕获（输入框 autoFocus，按键事件沿虚拟 DOM 上溯） */
      onKeyDown: (i) => {
        i.key === "Escape" && dirPicker.settle(false);
      },
    },
    t(
      "div",
      { className: "pw-dpk-panel" },
      t(
        "div",
        { className: "pw-dpk-head" },
        t("span", { className: "pw-dpk-title" }, s.title),
        t(
          "button",
          {
            className: "pw-dpk-x",
            title: "关闭",
            onClick: () => dirPicker.settle(false),
          },
          "×",
        ),
      ),
      t(
        "div",
        { className: "pw-dpk-bar" },
        t(
          "button",
          {
            className: "pw-dpk-up",
            disabled: dirPicker.loading || !dirPicker.parent,
            title: "上级目录",
            onClick: () =>
              dirPicker.parent && dirPicker.nav(dirPicker.parent),
          },
          ic([["p", "m18 15-6-6-6 6"]], 15),
        ),
        t("input", {
          className: "pw-dpk-path",
          value: dirPicker.input,
          autoFocus: !0,
          autoComplete: "off",
          spellCheck: !1,
          placeholder: "/path/to/project 或 ~/project",
          onChange: (i) => {
            ((dirPicker.input = i.target.value),
              (dirPicker.error = null),
              bus.fire(DIRPICKER_CHAN));
          },
          onKeyDown: (i) => {
            if (i.key === "Enter") {
              const l = dirPicker.input.trim();
              l && dirPicker.nav(l);
            }
          },
        }),
        t(
          "button",
          {
            className: "pw-dpk-go",
            disabled: dirPicker.loading || !dirPicker.input.trim(),
            onClick: () => {
              const i = dirPicker.input.trim();
              i && dirPicker.nav(i);
            },
          },
          "前往",
        ),
      ),
      t(
        "div",
        { className: "pw-dpk-list" },
        dirPicker.loading
          ? t("div", { className: "pw-dpk-hint" }, "加载目录…")
          : dirPicker.entries.length
            ? dirPicker.entries.map((i) =>
                t(
                  "button",
                  {
                    key: i.path,
                    className: "pw-dpk-row",
                    title: i.path,
                    onClick: () => dirPicker.nav(i.path),
                  },
                  FolderIcon(12),
                  t("span", { className: "pw-dpk-name" }, i.name),
                ),
              )
            : t("div", { className: "pw-dpk-hint" }, "没有子目录"),
        dirPicker.error
          ? t("div", { className: "pw-dpk-err" }, dirPicker.error)
          : null,
      ),
      t(
        "div",
        { className: "pw-dpk-foot" },
        t(
          "button",
          {
            className: "pw-dpk-star" + (i ? " on" : ""),
            disabled: l,
            title: i
              ? dirPicker.defCustom
                ? "当前即默认打开目录，点击恢复默认（桌面）"
                : "默认打开目录（桌面）；进入其他目录可设为默认"
              : "把当前目录设为默认打开目录",
            onClick: () => dirPicker.toggleDefault(),
          },
          ic(
            [
              [
                "p",
                "M12 2l2.9 6.3 6.6 1-5 4.8 1.4 6.9L12 17.8 6.1 21l1.4-6.9-5-4.8 6.6-1z",
              ],
            ],
            12,
          ),
          i ? "默认目录" : "设为默认",
        ),
        t(
          "div",
          { className: "pw-dpk-foot-r" },
          t(
            "button",
            {
              className: "pw-dpk-cancel",
              onClick: () => dirPicker.settle(false),
            },
            "取消",
          ),
          t(
            "button",
            {
              className: "pw-dpk-ok",
              disabled: !a,
              title: o ? "先回车或点「前往」打开输入的路径" : "选择当前目录",
              onClick: () => a && dirPicker.settle(true),
            },
            "选择此文件夹",
          ),
        ),
      ),
    ),
  );
}
