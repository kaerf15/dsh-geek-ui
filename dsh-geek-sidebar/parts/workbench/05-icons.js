function iconSvg(t, e) {
  return React.createElement(
    "svg",
    {
      width: e || 13,
      height: e || 13,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    t,
  );
}
const elIcon = React.createElement;
function ic(t, e) {
  return iconSvg(
    t.map((s, o) => {
      const a = s[0];
      return a === "p"
        ? elIcon("path", { key: o, d: s[1] })
        : a === "l"
          ? elIcon("line", { key: o, x1: s[1], y1: s[2], x2: s[3], y2: s[4] })
          : a === "pl"
            ? elIcon("polyline", { key: o, points: s[1] })
            : a === "r"
              ? elIcon("rect", {
                  key: o,
                  x: s[1],
                  y: s[2],
                  width: s[3],
                  height: s[4],
                  rx: s[5],
                })
              : elIcon("circle", { key: o, cx: s[1], cy: s[2], r: s[3] });
    }),
    e,
  );
}
/* PencilIcon 与 skills.js 的同名图标不算可去重的重复：skills.js 版是 11px 固定尺寸
 *（技能弹窗专用），本版参数化且两个调用点（08/11）都是 13px——统一需动 skills.js 或
 * head.js 共享层（评审修复轮均划为禁区），保持各自本体（评审修复 #7 只收敛了 shortPath） */
function PencilIcon(t) {
  return ic(
    [["p", "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"]],
    t,
  );
}
function TrashIcon(t) {
  return ic(
    [
      ["pl", "3 6 5 6 21 6"],
      ["p", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
      ["p", "M10 11v6M14 11v6"],
      ["p", "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"],
    ],
    t,
  );
}
function ArchiveIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 4, 1],
      ["p", "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"],
      ["p", "M10 12h4"],
    ],
    t,
  );
}
function FolderIcon(t) {
  return ic(
    [
      [
        "p",
        "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
      ],
    ],
    t,
  );
}
function FileIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
    ],
    t,
  );
}
function FileTextIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
      ["l", 16, 13, 8, 13],
      ["l", 16, 17, 8, 17],
    ],
    t,
  );
}
function ImageIcon(t) {
  return ic(
    [
      ["r", 3, 3, 18, 18, 2],
      ["c", 8.5, 8.5, 1.5],
      ["pl", "21 15 16 10 5 21"],
    ],
    t,
  );
}
function CodeIcon(t) {
  return ic(
    [
      ["pl", "16 18 22 12 16 6"],
      ["pl", "8 6 2 12 8 18"],
    ],
    t,
  );
}
function BracesIcon(t) {
  return ic(
    [
      [
        "p",
        "M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1",
      ],
      [
        "p",
        "M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1",
      ],
    ],
    t,
  );
}
function GlobeIcon(t) {
  return ic(
    [
      ["c", 12, 12, 10],
      ["l", 2, 12, 22, 12],
      [
        "p",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
      ],
    ],
    t,
  );
}
function RefreshIcon(t) {
  return ic(
    [
      ["p", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"],
      ["p", "M3 3v5h5"],
    ],
    t,
  );
}
function ExternalIcon(t) {
  return ic(
    [
      ["p", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
      ["pl", "15 3 21 3 21 9"],
      ["l", 10, 14, 21, 3],
    ],
    t,
  );
}
function DownloadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "7 10 12 15 17 10"],
      ["l", 12, 15, 12, 3],
    ],
    t,
  );
}
function UploadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "17 8 12 3 7 8"],
      ["l", 12, 3, 12, 15],
    ],
    t,
  );
}
function ListIcon(t) {
  return ic(
    [
      ["l", 8, 6, 21, 6],
      ["l", 8, 12, 21, 12],
      ["l", 8, 18, 21, 18],
      ["l", 3, 6, 3.01, 6],
      ["l", 3, 12, 3.01, 12],
      ["l", 3, 18, 3.01, 18],
    ],
    t,
  );
}
function ChevronRight(t) {
  return ic([["pl", "9 18 15 12 9 6"]], t);
}
function ChevronDown(t) {
  return ic([["pl", "6 9 12 15 18 9"]], t);
}
function CheckIcon(t) {
  return ic([["pl", "20 6 9 17 4 12"]], t);
}
function AtIcon(t) {
  return ic(
    [
      ["c", 12, 12, 4],
      ["p", "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
    ],
    t,
  );
}
function GitBranchIcon(t) {
  return ic(
    [
      ["l", 6, 3, 6, 15],
      ["c", 18, 6, 3],
      ["c", 6, 18, 3],
      ["p", "M18 9a9 9 0 0 1-9 9"],
    ],
    t,
  );
}
function CopyIcon(t) {
  return ic(
    [
      ["r", 9, 9, 13, 13, 2],
      ["p", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
    ],
    t,
  );
}
function MinimizeIcon(t) {
  return ic(
    [
      ["pl", "4 14 10 14 10 20"],
      ["pl", "20 10 14 10 14 4"],
      ["l", 10, 14, 3, 21],
      ["l", 21, 3, 14, 10],
    ],
    t,
  );
}
/* 实心停止块（压缩中等中止态用，pi-web 同款）：ic() 是描边体系，这里子节点显式填充 */
function StopIcon(t) {
  return iconSvg([elIcon("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2, fill: "currentColor", stroke: "none" })], t);
}
/* 对勾闪现：置位 1.2s 后自动复位（评审修复：原先只置位不复位，刷新/下载对勾永久残留；
 * 两处调用方 03-tree.js/09-sidebar.js 均传布尔 setter，宿主组件常驻，超时后 setState 安全） */
function flashDone(t) {
  t(!0);
  setTimeout(() => t(!1), 1200);
}
const flashEl = (t) =>
  React.createElement("span", { className: "pw-flash-check" }, CheckIcon(t));