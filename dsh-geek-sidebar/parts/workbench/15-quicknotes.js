/* ============================ 便签（Typora 风格编辑即预览） ============================
 * 纯粹的 Markdown 实时编辑预览区：所见即所得，粘图片即是图片，无多余编辑/完成按钮，无底部冗余状态行；
 * 顶栏极简（左侧 + 图标、紧凑搜索框、AI 生成标题；右侧与侧边栏同款 ChevronDown SVG 图标）；
 * 整体配色与 dsh-geek-sidebar 100% 统一（基于 --dsw-alias-bg-base 与标准 1px 分割线，无杂乱色块）；
 * 便签项悬停展现与侧栏统一尺寸位置的标准按钮（@、改名、删除）；纵向分割线与顶边拖拽线采用标准 1px 细线风格。 */

function NotebookIcon(t) {
  return ic(
    [
      ["r", 4, 3, 16, 18, 2, 2],
      ["l", 8, 3, 8, 21],
      ["l", 12, 8, 16, 8],
      ["l", 12, 12, 16, 12],
    ],
    t,
  );
}

function SparkleIcon(t) {
  return ic(
    [
      ["p", "M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z"],
    ],
    t || 12,
  );
}

/* 同步到项目：纯左向分支箭头（绝对镜像对称） */
function ForkProjectIcon(t) {
  return ic(
    [
      ["p", "M16 19v-6a4 4 0 0 0-4-4H5"],
      ["pl", "9 5 5 9 9 13"],
    ],
    t || 15,
  );
}

/* 同步到知识库：纯右向分支箭头（绝对镜像对称） */
function ForkKbIcon(t) {
  return ic(
    [
      ["p", "M8 19v-6a4 4 0 0 1 4-4h7"],
      ["pl", "15 5 19 9 15 13"],
    ],
    t || 15,
  );
}

/* 抽屉最大化/还原：复用原 "»" 双叉角风格，仅改变上下方向组合（unfold more/less）。
 * 一上一下（上∧ + 下∨）= 向上扩大；一下一上（上∨ + 下∧）= 收缩。尺寸 13 与原一致。 */
function ExpandIcon(t) {
  return ic(
    [
      ["pl", "17 11 12 6 7 11"],
      ["pl", "7 13 12 18 17 13"],
    ],
    t || 13,
  );
}
function CollapseIcon(t) {
  return ic(
    [
      ["pl", "7 6 12 11 17 6"],
      ["pl", "7 18 12 13 17 18"],
    ],
    t || 13,
  );
}

/* 目录栏展开/收起缩放图标（Apple 风格，居中紧凑） */
function SidebarToggleIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 16, 2],
      ["l", 9, 4, 9, 20],
    ],
    t || 13,
  );
}

/* 新增目录图标 */
function FolderPlusIcon(t) {
  return ic(
    [
      ["p", "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
      ["l", 12, 11, 12, 17],
      ["l", 9, 14, 15, 14],
    ],
    t || 13,
  );
}

/* 跨目录查看全部便签图标 */
function AllNotesIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 16, 2],
      ["l", 7, 8, 17, 8],
      ["l", 7, 12, 17, 12],
      ["l", 7, 16, 13, 16],
    ],
    t || 13,
  );
}

/* 纯目录图标 */
function FolderSimpleIcon(t) {
  return ic(
    [
      ["p", "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
    ],
    t || 13,
  );
}

function qnExtractFirstImage(text) {
  if (!text) return null;
  const m = String(text).match(/!\[[^\]]*\]\(([^)]+)\)/);
  return m ? m[1] : null;
}

/* 零宽字符统一剔除：空便签占位符 U+200B（E2 80 8B）及零宽连字/BOM */
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF]/g;

/* 便签内容规范化：空/纯空白 → 零宽占位符（host 拒绝空内容） */
function qnContentOrBlank(content) {
  return typeof content === "string" && content.trim() ? content : "\u200B";
}

function qnStripMarkdown(text) {
  return String(text || "")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*`_~>-]/g, "")
    .trim();
}

function qnDeriveTitle(content, fallbackTitle) {
  if (!content) return fallbackTitle || "新便签";
  const clean = String(content).replace(ZERO_WIDTH_RE, "").trim();
  if (!clean) return fallbackTitle || "新便签";
  const lines = clean.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split("\n");
  const first = lines.map((s) => s.replace(/^[#*\-`_~>\s]+/, "").trim()).find((s) => s.length > 0);
  return first ? first.slice(0, 30) : (fallbackTitle || "新便签");
}

function qnFormatAppleDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  if (d.toDateString() === now.toDateString()) {
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  if (d.getFullYear() === now.getFullYear()) {
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
}

function qnSplitWords(text) {
  const fallback = text.match(/\S+/g) || [];
  if (typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined") {
    return text.match(/[\p{Script=Han}]+|\S+/gu) || fallback;
  }
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    const words = [];
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike && segment.segment.trim() !== "") {
        words.push(segment.segment);
      }
    }
    return words.length > 0 ? words : fallback;
  } catch {
    return fallback;
  }
}

function qnSummarize(text, excerptWords, thresholdChars) {
  const clean = qnStripMarkdown(text);
  if (!clean) return "";
  const maxChars = thresholdChars || 80;
  if (clean.length <= maxChars) return clean;
  const hasHan = /[\p{Script=Han}]/u.test(clean);
  const keepWords = excerptWords || 3;
  const keep = hasHan ? keepWords * 2 : keepWords;
  const words = qnSplitWords(clean);
  if (words.length <= keep * 2) return clean;
  const head = words.slice(0, keep);
  const tail = words.slice(-keep);
  const joiner = hasHan ? "" : " ";
  return head.join(joiner) + " … " + tail.join(joiner);
}

/* ============================ Typora Markdown <-> HTML 序列化 ============================ */
function qnEscapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function qnInlineMd(text) {
  return qnEscapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function qnMdToHtml(md) {
  if (!md || !md.replace(ZERO_WIDTH_RE, "").trim()) return "<p><br></p>";
  const lines = md.split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCode) {
        html += "<pre><code>" + qnEscapeHtml(codeBuf.join("\n")) + "</code></pre>";
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (/^#{6}\s+/.test(line)) {
      html += "<h6>" + qnInlineMd(line.replace(/^#{6}\s+/, "")) + "</h6>";
    } else if (/^#{5}\s+/.test(line)) {
      html += "<h5>" + qnInlineMd(line.replace(/^#{5}\s+/, "")) + "</h5>";
    } else if (/^#{4}\s+/.test(line)) {
      html += "<h4>" + qnInlineMd(line.replace(/^#{4}\s+/, "")) + "</h4>";
    } else if (/^#{3}\s+/.test(line)) {
      html += "<h3>" + qnInlineMd(line.replace(/^#{3}\s+/, "")) + "</h3>";
    } else if (/^#{2}\s+/.test(line)) {
      html += "<h2>" + qnInlineMd(line.replace(/^#{2}\s+/, "")) + "</h2>";
    } else if (/^#{1}\s+/.test(line)) {
      html += "<h1>" + qnInlineMd(line.replace(/^#{1}\s+/, "")) + "</h1>";
    } else if (/^>\s*/.test(line)) {
      html += "<blockquote>" + qnInlineMd(line.replace(/^>\s*/, "")) + "</blockquote>";
    } else if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) {
      html += "<hr />";
    } else if (/^[-*]\s+\[([ xX])\]\s+(.*)/.test(line)) {
      const m = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
      const isChecked = m[1].toLowerCase() === "x";
      html += `<ul class="pw-qn-task-list"><li class="pw-qn-task${isChecked ? " checked" : ""}"><input type="checkbox"${isChecked ? " checked" : ""} /><span>` + qnInlineMd(m[2]) + "</span></li></ul>";
    } else if (/^\d+\.\s+/.test(line)) {
      html += "<ol><li>" + qnInlineMd(line.replace(/^\d+\.\s+/, "")) + "</li></ol>";
    } else if (/^[-*]\s+/.test(line)) {
      html += "<ul><li>" + qnInlineMd(line.replace(/^[-*]\s+/, "")) + "</li></ul>";
    } else if (/^!\[([^\]]*)\]\(([^)]+)\)/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      html += '<p><img src="' + m[2] + '" alt="' + (m[1] || "") + '" style="max-width:100%;border-radius:6px;margin:8px 0;display:block;" /></p>';
    } else if (line.trim() === "") {
      html += "<p><br></p>";
    } else {
      html += "<p>" + qnInlineMd(line) + "</p>";
    }
  }
  if (inCode) {
    html += "<pre><code>" + qnEscapeHtml(codeBuf.join("\n")) + "</code></pre>";
  }
  return html;
}

function qnHtmlToMd(node) {
  if (!node) return "";
  let md = "";
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3) {
      md += child.textContent;
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === "h1") {
        md += "# " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h2") {
        md += "## " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h3") {
        md += "### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h4") {
        md += "#### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h5") {
        md += "##### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "h6") {
        md += "###### " + qnHtmlToMd(child).trim() + "\n\n";
      } else if (tag === "blockquote") {
        const text = qnHtmlToMd(child).trim();
        if (text) md += "> " + text + "\n\n";
      } else if (tag === "hr") {
        md += "---\n\n";
      } else if (tag === "p" || tag === "div") {
        const text = qnHtmlToMd(child).trim();
        if (text) md += text + "\n\n";
        else md += "\n";
      } else if (tag === "li") {
        const chk = child.querySelector && child.querySelector('input[type="checkbox"]');
        if (chk) {
          const isChecked = chk.checked;
          const clone = child.cloneNode(true);
          const cInput = clone.querySelector('input[type="checkbox"]');
          if (cInput) cInput.remove();
          const t = qnHtmlToMd(clone).trim();
          md += (isChecked ? "- [x] " : "- [ ] ") + t + "\n";
        } else if (child.parentElement && child.parentElement.tagName.toLowerCase() === "ol") {
          md += "1. " + qnHtmlToMd(child).trim() + "\n";
        } else {
          md += "- " + qnHtmlToMd(child).trim() + "\n";
        }
      } else if (tag === "ul" || tag === "ol") {
        md += qnHtmlToMd(child) + "\n";
      } else if (tag === "a") {
        const href = child.getAttribute("href") || "";
        const text = qnHtmlToMd(child).trim();
        md += "[" + (text || href) + "](" + href + ")";
      } else if (tag === "img") {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "图片";
        md += "![" + alt + "](" + src + ")\n\n";
      } else if (tag === "strong" || tag === "b") {
        md += "**" + qnHtmlToMd(child) + "**";
      } else if (tag === "em" || tag === "i") {
        md += "*" + qnHtmlToMd(child) + "*";
      } else if (tag === "del" || tag === "s" || tag === "strike") {
        md += "~~" + qnHtmlToMd(child) + "~~";
      } else if (tag === "code") {
        md += "`" + child.textContent + "`";
      } else if (tag === "pre") {
        md += "```\n" + child.textContent.trim() + "\n```\n\n";
      } else if (tag === "br") {
        md += "\n";
      } else {
        md += qnHtmlToMd(child);
      }
    }
  }
  return md;
}

const qnPending = new Map();
let qnQuoteSeq = 0;
let qnQuoteApi = null;
let qnAppCtx = null;

/* 活跃会话 id：sessionProbe 在 06-misc，本文件被 smoke 单独 eval 时可能不在，故用 typeof 守卫 */
function qnActiveSid() {
  return typeof sessionProbe !== "undefined" && sessionProbe ? sessionProbe.sid : null;
}

/* 把单个便签按绝对文件路径提为 @ 提及（与侧边栏文件 @ 同机制）。返回是否插入成功 */
function qnMentionNote(sid, name) {
  const dir = qnStore.dir ? String(qnStore.dir).replace(/[\\/]+$/, "") : "";
  if (!dir) return false; // 无便签目录信息，无法构造绝对路径（避免误提相对文件名）
  const ref = mentionRef(dir + "/" + name, false, { abs: true });
  return fileMentionBridge ? fileMentionBridge.mention(sid, ref) : false;
}

function installQnQuote(ctx) {
  qnAppCtx = ctx;
  const it = ctx.get("inputTriggers");
  if (it && typeof it.registerSource === "function") {
    ctx.effect(() => {
      return it.registerSource({
        trigger: "@",
        name: "geek-notes-quote",
        order: 200,
        showGroupTitle: false,
        candidates: async () => [],
        onPick: () => undefined,
        codec: {
          clipboardText(ref) {
            const t = qnPending.get(ref);
            return t ? qnSummarize(t) : ref;
          },
          async serialize(ref) {
            const t = qnPending.get(ref);
            return t !== undefined ? t : ref;
          },
        },
      });
    });
  }
  qnQuoteApi = {
    insert(text) {
      const clean = String(text || "").replace(ZERO_WIDTH_RE, "").trim();
      if (!clean) {
        qnToast("无内容可引用");
        return false;
      }
      const sid = qnActiveSid();
      const actx = sid && ctx.sessions ? ctx.sessions.scope(sid) : null;
      const conv = ctx.get("conversation");
      const resolver = conv && conv.input;
      if (!actx || !resolver) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(clean).catch(() => {});
        }
        qnToast("无活跃会话，已复制全文到剪贴板");
        return false;
      }
      let input;
      try { input = resolver.for(actx); } catch { return false; }
      if (!input) return false;
      const snapshot = input.state.getSnapshot();
      const draft = String(snapshot.draft || "");
      const draftRev = snapshot.draftRev;
      const refId = "qn-" + (++qnQuoteSeq) + "-" + Date.now();
      qnPending.set(refId, clean);
      if (qnPending.size > 50) {
        const oldest = qnPending.keys().next().value;
        qnPending.delete(oldest);
      }
      const span = { start: draft.length, end: draft.length, draftRev };
      const label = qnSummarize(clean);
      const ok = input.insertReference(
        {
          source: "geek-notes-quote",
          ref: refId,
          label,
          appearance: "file",
          clipboardText: label,
        },
        span,
      );
      if (ok) {
        qnToast("已引用到输入框");
      } else {
        qnToast("引用失败，请稍后重试");
      }
      return ok;
    },
  };
}

let qnToastTimer = null;
function qnToast(msg) {
  if (qnToastTimer) clearTimeout(qnToastTimer);
  qnStore.set({ toast: msg });
  qnToastTimer = setTimeout(() => {
    qnStore.set({ toast: null });
    qnToastTimer = null;
  }, 2500);
}

/* 便签目录（分类）元数据读写 */
async function qnLoadFoldersMeta() {
  try {
    const res = await host.call("workbench.qnFoldersGet").catch(() => null);
    if (res && res.ok && Array.isArray(res.folders)) {
      qnStore.set({ folders: res.folders, noteFolders: res.noteFolders || {} });
      return { folders: res.folders, noteFolders: res.noteFolders || {} };
    }
  } catch {}
  try {
    const raw = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("pw-qn-folders-meta") : null;
    if (raw) {
      const j = JSON.parse(raw);
      if (j && Array.isArray(j.folders)) {
        qnStore.set({ folders: j.folders, noteFolders: j.noteFolders || {} });
        return j;
      }
    }
  } catch {}
  return { folders: [], noteFolders: {} };
}

async function qnSaveFoldersMeta(meta) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("pw-qn-folders-meta", JSON.stringify(meta));
    }
  } catch {}
  qnStore.set({ folders: meta.folders, noteFolders: meta.noteFolders });
  try {
    await host.call("workbench.qnFoldersSet", meta).catch(() => {});
  } catch {}
}

async function qnCreateFolder(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    qnToast("目录名称不能为空");
    return false;
  }
  const cur = qnStore.folders || [];
  if (cur.includes(trimmed)) {
    qnToast("已存在同名目录");
    return false;
  }
  const next = [...cur, trimmed];
  await qnSaveFoldersMeta({ folders: next, noteFolders: qnStore.noteFolders || {} });
  qnStore.set({ selectedFolder: trimmed });
  qnToast("已创建目录: " + trimmed);
  return true;
}

async function qnRenameFolder(oldName, newName) {
  const trimmed = String(newName || "").trim();
  if (!trimmed || trimmed === oldName) return false;
  const cur = qnStore.folders || [];
  if (cur.includes(trimmed)) {
    qnToast("已存在同名目录");
    return false;
  }
  const nextFolders = cur.map((f) => (f === oldName ? trimmed : f));
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  for (const k of Object.keys(nextNoteFolders)) {
    if (nextNoteFolders[k] === oldName) nextNoteFolders[k] = trimmed;
  }
  await qnSaveFoldersMeta({ folders: nextFolders, noteFolders: nextNoteFolders });
  if (qnStore.selectedFolder === oldName) {
    qnStore.set({ selectedFolder: trimmed });
  }
  await qnLoadNotes(qnStore.q);
  qnToast("目录已改名");
  return true;
}

async function qnDeleteFolder(folderName) {
  const cur = qnStore.folders || [];
  const nextFolders = cur.filter((f) => f !== folderName);
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  for (const k of Object.keys(nextNoteFolders)) {
    if (nextNoteFolders[k] === folderName) delete nextNoteFolders[k];
  }
  await qnSaveFoldersMeta({ folders: nextFolders, noteFolders: nextNoteFolders });
  if (qnStore.selectedFolder === folderName) {
    qnStore.set({ selectedFolder: null });
  }
  await qnLoadNotes(qnStore.q);
  qnToast("目录已删除");
}

async function qnMoveNoteToFolder(noteName, targetFolder) {
  const nextNoteFolders = { ...(qnStore.noteFolders || {}) };
  if (targetFolder) {
    nextNoteFolders[noteName] = targetFolder;
    qnToast("已移至目录: " + targetFolder);
  } else {
    delete nextNoteFolders[noteName];
    qnToast("已移出目录");
  }
  await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nextNoteFolders });
  await qnLoadNotes(qnStore.q);
}

async function qnLoadNotes(q) {
  qnStore.set({ loading: true });
  try {
    const [res, meta] = await Promise.all([
      host.call("workbench.qnList", { q: q || "" }),
      qnLoadFoldersMeta(),
    ]);
    if (res && res.ok) {
      const nf = (meta && meta.noteFolders) || qnStore.noteFolders || {};
      const rawNotes = res.notes || [];
      const notes = rawNotes.map((n) => ({
        ...n,
        folder: nf[n.name] || "",
      }));
      const selected = qnStore.selected && notes.some((n) => n.name === qnStore.selected)
        ? qnStore.selected
        : notes.length > 0 ? notes[0].name : null;
      qnStore.set({ notes, selected, loading: false, dir: res.dir || qnStore.dir });
    } else {
      qnStore.set({ loading: false });
    }
  } catch {
    qnStore.set({ loading: false });
  }
}

async function qnCreateNote(title, content) {
  try {
    const text = qnContentOrBlank(content);
    const res = await host.call("workbench.qnCreate", { title: title || "新便签", content: text });
    if (res && res.ok) {
      if (qnStore.selectedFolder) {
        const nf = { ...(qnStore.noteFolders || {}) };
        nf[res.name] = qnStore.selectedFolder;
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      qnStore.set({ selected: res.name });
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("创建失败: " + (e.message || e));
  }
  return null;
}

async function qnUpdateNote(name, content, title) {
  try {
    const text = qnContentOrBlank(content);
    const res = await host.call("workbench.qnUpdate", { name, content: text, title });
    if (res && res.ok) {
      if (res.name && res.name !== name && qnStore.noteFolders && qnStore.noteFolders[name]) {
        const nf = { ...(qnStore.noteFolders || {}) };
        nf[res.name] = nf[name];
        delete nf[name];
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      if (res.name && res.name !== name) {
        qnStore.set({ selected: res.name });
      }
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("更新失败: " + (e.message || e));
  }
  return null;
}

async function qnDeleteNote(name) {
  try {
    const res = await host.call("workbench.qnDelete", { name });
    if (res && res.ok) {
      if (qnStore.noteFolders && qnStore.noteFolders[name]) {
        const nf = { ...(qnStore.noteFolders || {}) };
        delete nf[name];
        await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
      }
      qnToast("便签已删除");
      await qnLoadNotes(qnStore.q);
      return res;
    }
  } catch (e) {
    qnToast("删除失败: " + (e.message || e));
  }
  return null;
}

/* 划选浮动气泡 */
function QnSelectionBubble() {
  const [bubble, setBubble] = React.useState(null);
  const bubbleRef = React.useRef(null);

  React.useEffect(() => {
    function checkSelection() {
      if (qnStore.capture === false) {
        setBubble(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setBubble(null);
        return;
      }
      const text = sel.toString().trim();
      const anchorNode = sel.anchorNode;
      const el = anchorNode && anchorNode.nodeType === 1 ? anchorNode : (anchorNode && anchorNode.parentElement);
      if (!el) {
        setBubble(null);
        return;
      }
      if (el.closest("input, textarea")) {
        setBubble(null);
        return;
      }
      // 便签编辑区（contenteditable）内的选中内容也允许划选引用
      const inEditor = el.closest(".pw-qn-typora-canvas");
      if (inEditor) {
        if (text.length < 1) {
          setBubble(null);
          return;
        }
      } else {
        if (el.closest("[data-pw-qn]")) {
          setBubble(null);
          return;
        }
        if (text.length < 4) {
          setBubble(null);
          return;
        }
        const validContainer = el.closest("[data-conversation-scroll], .pw-details, .pw-drawer-wrap, main, [data-panel]");
        if (!validContainer) {
          setBubble(null);
          return;
        }
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          setBubble(null);
          return;
        }
        const top = Math.max(10, rect.top - 40);
        const left = Math.max(10, Math.min(window.innerWidth - 180, rect.left + rect.width / 2 - 80));
        setBubble({ text, top, left, mode: inEditor ? "note" : "global" });
      } catch {
        setBubble(null);
      }
    }

    function onPointerUp() {
      setTimeout(checkSelection, 20);
    }

    function onMouseDown(e) {
      if (bubbleRef.current && bubbleRef.current.contains(e.target)) return;
      setBubble(null);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setBubble(null);
    }

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!bubble) return null;

  const isNote = bubble.mode === "note";

  return React.createElement(
    "div",
    {
      ref: bubbleRef,
      "data-pw-qn": "bubble",
      className: "pw-qn-bubble",
      style: { top: bubble.top + "px", left: bubble.left + "px" },
    },
    !isNote &&
      React.createElement(
        "button",
        {
          className: "pw-qn-bubble-btn",
          onClick: (e) => {
            e.stopPropagation();
            qnCreateNote("", bubble.text);
            setBubble(null);
          },
        },
        "存入便签",
      ),
    !isNote && React.createElement("span", { className: "pw-qn-bubble-sep" }),
    React.createElement(
      "button",
      {
        className: "pw-qn-bubble-btn accent",
        onClick: (e) => {
          e.stopPropagation();
          if (qnQuoteApi) qnQuoteApi.insert(bubble.text);
          setBubble(null);
        },
      },
      "引用到对话",
    ),
  );
}

/* 中间列定位：抽屉挂在 shell.overlay（盖住整框），必须用中间列的盒子，绝不能回退成视口全宽。
 * 列节点取 AppFrame 里 overlay / data-side 之外的第二个 grid 子项（sidebar | center | details），
 * 不碰构建哈希类。读不到中间列就保持上次宽度，避免上拉盖住左右栏。
 * 坐标相对 overlay（抽屉 position:absolute），不用 viewport fixed。 */
function qnOverlayEl() {
  return typeof document === "undefined" ? null : document.querySelector("[data-shell-overlay]");
}

function qnFrameColumns() {
  const overlay = qnOverlayEl();
  const frame = overlay && overlay.parentElement;
  if (!frame) return [];
  const cols = [];
  for (let i = 0; i < frame.children.length; i++) {
    const el = frame.children[i];
    if (el === overlay) continue;
    if (el.getAttribute("data-side")) continue;
    cols.push(el);
  }
  return cols;
}

function qnFindCenterCol() {
  const cols = qnFrameColumns();
  if (cols[1]) return cols[1];
  return typeof document === "undefined" ? null : document.querySelector("[data-conversation-scroll]");
}

function qnReadCenterBand() {
  const overlay = qnOverlayEl();
  const col = qnFindCenterCol();
  if (!overlay || !col) return null;
  const origin = overlay.getBoundingClientRect();
  const r = col.getBoundingClientRect();
  const width = Math.round(r.width);
  if (width <= 0) return null;
  return { left: Math.max(0, Math.round(r.left - origin.left)), width };
}

/* 下边栏吸底抽屉：Typora 风格编辑即预览工作台 */
function QuickNotesPanel() {
  const e = React.createElement;
  const [colRect, setColRect] = React.useState({ left: 0, width: 0 });
  const [activeNoteText, setActiveNoteText] = React.useState("");
  const [genState, setGenState] = React.useState({ kind: "idle" });
  const [renamingName, setRenamingName] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [isExporting, setIsExporting] = React.useState(false);
  const [tipInfo, setTipInfo] = React.useState(null);
  const kbDir = notesStore.current || (notesStore.dirs && notesStore.dirs[0]) || null;
  const canvasRef = React.useRef(null);
  const autoSaveTimerRef = React.useRef(null);
  const currentLoadingNoteRef = React.useRef(null);
  const [prevHeight, setPrevHeight] = React.useState(null);
  const maxDrawerHeight = typeof window !== "undefined" ? Math.max(400, window.innerHeight - 48) : 800;
  const isMaximized = qnStore.height >= maxDrawerHeight - 20;

  const handleToggleMaximize = () => {
    if (isMaximized) {
      const restored = prevHeight && prevHeight >= 200 ? prevHeight : 320;
      qnStore.set({ height: restored });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(restored));
        }
      } catch {}
    } else {
      setPrevHeight(qnStore.height);
      qnStore.set({ height: maxDrawerHeight });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(maxDrawerHeight));
        }
      } catch {}
    }
  };

  /* 左栏宽度与可拖拽 resizer */
  const [listWidth, setListWidth] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? Number(window.localStorage.getItem("pw-qn-list-width")) : 0;
      if (v >= 140 && v <= 480) return v;
    } catch {}
    return 240;
  });

  /* 目录栏展开态与宽度（Apple Notes 风格 3 栏支持） */
  const [showFolders, setShowFolders] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("pw-qn-show-folders") : null;
      if (v !== null) return v === "true";
    } catch {}
    return true;
  });

  const [folderWidth, setFolderWidth] = React.useState(() => {
    try {
      const v = typeof window !== "undefined" && window.localStorage ? Number(window.localStorage.getItem("pw-qn-folder-width")) : 0;
      if (v >= 120 && v <= 320) return v;
    } catch {}
    return 150;
  });

  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderVal, setNewFolderVal] = React.useState("");
  const [renamingFolder, setRenamingFolder] = React.useState(null);
  const [renameFolderVal, setRenameFolderVal] = React.useState("");
  const [draggingNote, setDraggingNote] = React.useState(null);
  const [dragOverFolder, setDragOverFolder] = React.useState(null);
  /* 两击确认删除：复用 06-misc 共享状态机 useTwoClick（armed id 用便签 name），
   * 与 03 树删除 / 08 会话归档 / 09 worktree 同源，不再手抄 useState。 */
  const cnf = useTwoClick();

  const onFolderResizerStart = (ev) => {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = folderWidth;
    let latestW = startW;
    const onMove = (moveEv) => {
      const delta = moveEv.clientX - startX;
      latestW = Math.max(120, Math.min(320, startW + delta));
      setFolderWidth(latestW);
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-folder-width", String(latestW));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const onResizerStart = (ev) => {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = listWidth;
    let latestW = startW;
    const onMove = (moveEv) => {
      const delta = moveEv.clientX - startX;
      latestW = Math.max(140, Math.min(480, startW + delta));
      setListWidth(latestW);
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-list-width", String(latestW));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  /* 跟踪中间列位置：观察三列本身（拖左右栏时 frame 宽度不变，只观察 frame 会漏） */
  React.useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    const update = () => {
      const r = qnReadCenterBand();
      if (!r) return;
      setColRect((prev) => (prev.left !== r.left || prev.width !== r.width ? r : prev));
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) {
      const cols = qnFrameColumns();
      for (let i = 0; i < cols.length; i++) ro.observe(cols[i]);
      const scroll = document.querySelector("[data-conversation-scroll]");
      if (scroll) ro.observe(scroll);
    }
    window.addEventListener("resize", update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [qnStore.open]);

  /* 会话列挤压 padding-bottom（只垫滚动口，不碰哈希类） */
  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const col = document.querySelector("[data-conversation-scroll]");
    if (!col) return undefined;
    if (!col.style.transition) col.style.transition = "padding-bottom var(--ds-transition-duration-slow) var(--ds-ease-in-out)";
    col.style.paddingBottom = qnStore.open ? qnStore.height + "px" : "0px";
    return () => {
      col.style.paddingBottom = "0px";
    };
  }, [qnStore.open, qnStore.height]);

  /* 打开时加载便签 */
  React.useEffect(() => {
    if (qnStore.open && qnStore.notes === null) {
      qnLoadNotes();
    }
  }, [qnStore.open]);

  /* 切换便签时，加载 Markdown 并渲染为 Typora 可视化内容 */
  React.useEffect(() => {
    if (qnStore.selected) {
      currentLoadingNoteRef.current = qnStore.selected;
      host.call("workbench.qnRead", { name: qnStore.selected }).then((res) => {
        if (res && res.ok && currentLoadingNoteRef.current === qnStore.selected) {
          const text = res.text || "";
          setActiveNoteText(text);
          if (canvasRef.current) {
            canvasRef.current.innerHTML = qnMdToHtml(text);
          }
        }
      }).catch(() => {
        setActiveNoteText("");
        if (canvasRef.current) canvasRef.current.innerHTML = "<p><br></p>";
      });
    } else {
      setActiveNoteText("");
      if (canvasRef.current) canvasRef.current.innerHTML = "";
    }
  }, [qnStore.selected]);

  const pendingSaveRef = React.useRef(null);
  const flushSave = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { name, md, title } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      await qnUpdateNote(name, md, title);
    }
  };

  /* 组件卸载时安全刷盘 */
  React.useEffect(() => {
    return () => {
      flushSave();
    };
  }, []);

  /* 切换目录或便签列表变更时，自动保持选中项与当前目录视图一致 */
  React.useEffect(() => {
    if (!qnStore.open) return;
    const curList = qnStore.selectedFolder === null
      ? (qnStore.notes || [])
      : (qnStore.notes || []).filter((n) => n.folder === qnStore.selectedFolder);
    if (qnStore.selected && !curList.some((n) => n.name === qnStore.selected)) {
      qnStore.set({ selected: curList.length > 0 ? curList[0].name : null });
    }
  }, [qnStore.selectedFolder, qnStore.notes, qnStore.open, qnStore.selected]);

  if (!qnStore.open) return null;
  if (colRect.width <= 0) return null;

  /* 顶部高度拖拽手柄 */
  const onDragStart = (ev) => {
    ev.preventDefault();
    const startY = ev.clientY;
    const startH = qnStore.height;
    let latestH = startH;
    const onMove = (moveEv) => {
      const delta = startY - moveEv.clientY;
      latestH = Math.max(180, Math.min(maxDrawerHeight, startH + delta));
      qnStore.set({ height: latestH });
    };
    const onUp = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("pw-qn-height", String(latestH));
        }
      } catch {}
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const notes = qnStore.notes || [];
  const visibleNotes = qnStore.selectedFolder === null
    ? notes
    : notes.filter((n) => n.folder === qnStore.selectedFolder);
  const selectedNote = visibleNotes.find((n) => n.name === qnStore.selected) || null;

  /* 编辑即预览：内容输入变更（序列化为 Markdown 并自动保存） */
  const onEditorInput = () => {
    if (!canvasRef.current || !selectedNote) return;
    const newMd = qnHtmlToMd(canvasRef.current);
    setActiveNoteText(newMd);
    const derived = qnDeriveTitle(newMd, selectedNote.title);
    pendingSaveRef.current = { name: selectedNote.name, md: newMd, title: derived };

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 350);
  };

  /* 待办清单点击切换：点击 Checkbox 实时切换勾选态并同步 Markdown */
  const onCanvasClick = (ev) => {
    if (ev.target && ev.target.type === "checkbox") {
      const li = ev.target.closest("li.pw-qn-task");
      if (li) {
        if (ev.target.checked) li.classList.add("checked");
        else li.classList.remove("checked");
      }
      onEditorInput();
    }
  };

  /* 剪贴板图片直接粘贴：Typora 体验——直接插入可见图片，并更新序列化 Markdown */
  const handlePaste = (ev) => {
    const items = ev.clipboardData && ev.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        ev.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (uploadEv) => {
          const dataUrl = uploadEv.target.result;
          const img = document.createElement("img");
          img.src = dataUrl;
          img.alt = "图片";
          img.style.maxWidth = "100%";
          img.style.borderRadius = "6px";
          img.style.margin = "8px 0";
          img.style.display = "block";
          img.onclick = (e) => {
            e.stopPropagation();
            if (typeof imgZoomStore !== "undefined" && imgZoomStore.set) {
              imgZoomStore.set(dataUrl);
            }
          };

          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            if (img.parentNode) {
              img.parentNode.insertBefore(p, img.nextSibling);
            }
            range.setStartAfter(img);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else if (canvasRef.current) {
            canvasRef.current.appendChild(img);
          }
          onEditorInput();
          qnToast("图片已粘贴");
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  /* AI 智能生成标题并改名（逻辑完全对齐 dsh-geek-header） */
  /* 使用 AI 模型根据内容提炼标题并同步重命名当前便签（保持所在目录不变） */
  const handleGenerateTitle = async () => {
    if (genState.kind === "busy") return;
    const content = activeNoteText || (canvasRef.current ? qnHtmlToMd(canvasRef.current) : "");
    if (!selectedNote || !content.trim()) {
      qnToast("便签内容为空，无法生成标题");
      return;
    }
    await flushSave();
    const origName = selectedNote.name;
    const origFolder = selectedNote.folder || (qnStore.noteFolders && qnStore.noteFolders[origName]);

    setGenState({ kind: "busy" });
    try {
      const sid = qnActiveSid();
      let route = null;
      try {
        const dirs = qnAppCtx ? qnAppCtx.get("modelDirectories") : null;
        if (dirs && sid) {
          const directory = dirs.directoryFor(sid);
          const models = await directory.load();
          const current = models && models.current;
          if (current && current.provider && current.model) {
            route = { provider: current.provider, model: current.model };
          }
        }
      } catch {}

      if (!route) {
        try {
          const sessions = qnAppCtx ? qnAppCtx.get("sessions") : null;
          if (sessions && sessions.list) {
            const snap = sessions.list.getSnapshot();
            const curId = sid || snap.current;
            const curSess = curId && snap.byId ? snap.byId[curId] : null;
            if (curSess && curSess.projectionValues && curSess.projectionValues.modelSelection) {
              const ms = curSess.projectionValues.modelSelection;
              const cur = ms.next || ms.lastUsed;
              if (cur && cur.provider && cur.model) {
                route = { provider: cur.provider, model: cur.model };
              }
            }
          }
        } catch {}
      }

      if (!route) {
        route = { provider: "turing", model: "turing/gemini-3.8-flash" };
      }

      const res = await host.call("workbench.qnGenTitle", {
        name: origName,
        content,
        sessionId: sid,
        ...route,
      });

      if (res && res.ok && res.title) {
        /* 关键修复：便签改名后必须同步更新目录归属，避免便签脱离原文件夹 */
        if (res.name && res.name !== origName && origFolder) {
          const nf = { ...(qnStore.noteFolders || {}) };
          nf[res.name] = origFolder;
          delete nf[origName];
          await qnSaveFoldersMeta({ folders: qnStore.folders || [], noteFolders: nf });
        }
        setGenState({ kind: "done" });
        qnToast("AI 标题已生成: " + res.title);
        await qnLoadNotes(qnStore.q);
        if (res.name) qnStore.set({ selected: res.name });
        setTimeout(() => setGenState({ kind: "idle" }), 2000);
      } else {
        setGenState({ kind: "error" });
        qnToast("生成标题失败: " + ((res && res.error) || "未知原因"));
        setTimeout(() => setGenState({ kind: "idle" }), 3000);
      }
    } catch (err) {
      setGenState({ kind: "error" });
      qnToast("生成失败: " + (err.message || err));
      setTimeout(() => setGenState({ kind: "idle" }), 3000);
    }
  };

  /* 新建便签（内容空白，标题为新便签） */
  const handleCreateNew = async () => {
    const res = await qnCreateNote("新便签");
    if (res && res.ok) {
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
      }, 50);
    }
  };

  /* 顶栏即时悬停气泡调度（0ms 响应，浮动置顶） */
  const showTip = (ev, text) => {
    if (!text) return;
    const r = ev.currentTarget.getBoundingClientRect();
    setTipInfo({
      text,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top - 7),
    });
  };

  const hideTip = () => {
    setTipInfo(null);
  };

  /* 同步到当前项目（纯复制写盘，不删除源便签） */
  const handleSyncToProject = async () => {
    if (isExporting) return;
    if (!selectedNote) {
      qnToast("请先选择或新建便签");
      return;
    }
    if (!currentRootPath) {
      qnToast("当前未打开任何项目");
      return;
    }
    setIsExporting(true);
    try {
      await flushSave();
      let res = await host
        .call("workbench.qnSyncTo", {
          name: selectedNote.name,
          targetDir: currentRootPath,
        })
        .catch(() => null);

      if (!res || !res.ok) {
        /* 热插拔自愈兜底：若后台尚未重启生效新路由，经 qnMoveToKb 并在源端保留副本实现同步 */
        const text = activeNoteText;
        const prevKb = notesStore.current || (notesStore.dirs && notesStore.dirs[0]);
        await host.call("workbench.notesSelect", { dir: currentRootPath }).catch(() => {});
        res = await host
          .call("workbench.qnMoveToKb", {
            name: selectedNote.name,
            targetDir: currentRootPath,
          })
          .catch(() => null);
        if (prevKb && prevKb !== currentRootPath) {
          await host.call("workbench.notesSelect", { dir: prevKb }).catch(() => {});
        }
        /* 关键：同步语义绝不删除源便签，立刻将源便签恢复写回便签池 */
        await host.call("workbench.qnCreate", { title: selectedNote.title, content: text }).catch(() => {});
        qnStore.set({ selected: selectedNote.name });
      }

      if (res && res.ok) {
        qnToast("已同步到项目: " + baseName(res.path));
        await qnLoadNotes(qnStore.q);
      } else {
        qnToast("同步失败: " + ((res && res.error) || "未知错误"));
      }
    } catch (e) {
      qnToast("同步异常: " + (e.message || e));
    } finally {
      setIsExporting(false);
    }
  };

  /* 同步到当前知识库（纯复制写盘，不删除源便签） */
  const handleSyncToKb = async () => {
    if (isExporting) return;
    if (!selectedNote) {
      qnToast("请先选择或新建便签");
      return;
    }
    setIsExporting(true);
    try {
      await flushSave();
      let target = kbDir;
      if (!target) {
        const base = pathDir(currentRootPath || "") || "~";
        const defDir = pathJoinFor(base, "知识库");
        const resDef = await host.call("workbench.notesSelect", { dir: defDir });
        if (resDef && resDef.current) target = resDef.current;
      }
      if (!target) {
        qnToast("请先在左侧选择知识库目录");
        return;
      }
      let res = await host
        .call("workbench.qnSyncTo", {
          name: selectedNote.name,
          targetDir: target,
        })
        .catch(() => null);

      if (!res || !res.ok) {
        /* 热插拔自愈兜底：若后台尚未重启生效新路由，经 qnMoveToKb 并在源端保留副本实现同步 */
        const text = activeNoteText;
        res = await host
          .call("workbench.qnMoveToKb", {
            name: selectedNote.name,
            targetDir: target,
          })
          .catch(() => null);
        /* 关键：同步语义绝不删除源便签，立刻将源便签恢复写回便签池 */
        await host.call("workbench.qnCreate", { title: selectedNote.title, content: text }).catch(() => {});
        qnStore.set({ selected: selectedNote.name });
      }

      if (res && res.ok) {
        qnToast("已同步到知识库: " + baseName(res.path));
        await qnLoadNotes(qnStore.q);
      } else {
        qnToast("同步失败: " + ((res && res.error) || "未知错误"));
      }
    } catch (e) {
      qnToast("同步异常: " + (e.message || e));
    } finally {
      setIsExporting(false);
    }
  };

  /* 目录 @ 引用功能：目录下每个便签按各自文件路径插成 @ 提及（与侧边栏文件 @ 同机制） */
  const handleQuoteFolder = (folderName) => {
    const allNotes = qnStore.notes || [];
    const folderNotes = folderName === null
      ? allNotes
      : allNotes.filter((n) => n.folder === folderName);

    if (folderNotes.length === 0) {
      qnToast("该目录下暂无便签可引用");
      return;
    }
    const sid = qnActiveSid();
    if (!sid) {
      qnToast("无活跃会话，无法引用");
      return;
    }
    let okCount = 0;
    for (const n of folderNotes) {
      if (qnMentionNote(sid, n.name)) okCount++;
    }
    if (okCount > 0) {
      qnToast("已引用 " + okCount + " 个便签");
    } else {
      qnToast("引用失败，请稍后重试");
    }
  };

  return e(
    "div",
    {
      "data-pw-qn": "geek-notes",
      className: "pw-qn-drawer",
      style: {
        left: colRect.left + "px",
        width: colRect.width + "px",
        height: qnStore.height + "px",
      },
    },
    /* 顶部拖拽手柄（标准细线风格，悬停微弱高亮，无原生提示框） */
    e("div", {
      className: "pw-qn-drag",
      onPointerDown: onDragStart,
    }),

    /* 极简顶栏（与侧栏通体同色背景，标准 1px 分割线） */
    e(
      "div",
      { className: "pw-qn-header" },
      /* 左侧操作组：+ 图标、紧凑搜索框、AI 生成标题 */
      e(
        "div",
        { className: "pw-qn-header-left" },
        /* 目录栏展开/收起缩放按钮（加号左边） */
        e(
          "button",
          {
            className: "pw-icon-btn" + (showFolders ? " active" : ""),
            onMouseEnter: (ev) => showTip(ev, showFolders ? "收起目录栏" : "展开目录栏"),
            onMouseLeave: hideTip,
            onClick: () => {
              const next = !showFolders;
              setShowFolders(next);
              qnStore.set({ showFolders: next });
              try { window.localStorage.setItem("pw-qn-show-folders", String(next)); } catch {}
            },
          },
          SidebarToggleIcon(14),
        ),
        /* 新建便签 +：标准 pw-icon-btn 风格与 PlusIcon(13) */
        e(
          "button",
          {
            className: "pw-icon-btn",
            onMouseEnter: (ev) => showTip(ev, "新建便签"),
            onMouseLeave: hideTip,
            onClick: handleCreateNew,
          },
          PlusIcon(13),
        ),
        /* 新增目录按钮（加号右边） */
        e(
          "button",
          {
            className: "pw-icon-btn",
            onMouseEnter: (ev) => showTip(ev, "新建目录"),
            onMouseLeave: hideTip,
            onClick: () => {
              if (!showFolders) {
                setShowFolders(true);
                qnStore.set({ showFolders: true });
                try { window.localStorage.setItem("pw-qn-show-folders", "true"); } catch {}
              }
              setIsCreatingFolder(true);
              setNewFolderVal("");
            },
          },
          FolderPlusIcon(14),
        ),
        /* 紧凑搜索框（与侧栏统一规范） */
        e(
          "div",
          { className: "pw-qn-search-wrap" },
          e("span", { className: "pw-qn-search-ico" }, SearchIcon(12)),
          e("input", {
            className: "pw-qn-search-input",
            placeholder: "搜索便签...",
            value: qnStore.q || "",
            onChange: (ev) => {
              const q = ev.target.value;
              qnStore.set({ q });
              qnLoadNotes(q);
            },
          }),
        ),
        /* 生成标题按钮（纯文字，与搜索框高度严格一致） */
        e(
          "button",
          {
            className: "pw-qn-gen-btn" + (genState.kind === "busy" ? " busy" : ""),
            disabled: genState.kind === "busy" || !selectedNote,
            title: "使用 AI 模型根据便签内容生成标题并改名",
            onClick: handleGenerateTitle,
          },
          genState.kind === "busy"
            ? "生成中…"
            : genState.kind === "done"
            ? "标题已更新"
            : "生成标题",
        ),
        /* 对称同步按键组：透明排布，间距仅 2px，颜色淡雅 */
        e(
          "div",
          { style: { display: "inline-flex", alignItems: "center", gap: "2px" } },
          /* 同步到当前项目（左箭头）：独立图标按钮，淡雅色调 */
          e(
            "button",
            {
              className: "pw-icon-btn pw-qn-sync-btn" + (!selectedNote ? " is-disabled" : ""),
              disabled: isExporting,
              onMouseEnter: (ev) =>
                showTip(
                  ev,
                  currentRootPath
                    ? `同步到项目：将当前便签同步保存到项目 (${shortenPath(currentRootPath)})`
                    : "同步到项目：将当前便签同步保存到当前项目根目录"
                ),
              onMouseLeave: hideTip,
              onClick: handleSyncToProject,
            },
            ForkProjectIcon(15),
          ),
          /* 同步到当前知识库（右箭头）：独立图标按钮，淡雅色调 */
          e(
            "button",
            {
              className: "pw-icon-btn pw-qn-sync-btn" + (!selectedNote ? " is-disabled" : ""),
              disabled: isExporting,
              onMouseEnter: (ev) =>
                showTip(
                  ev,
                  kbDir
                    ? `同步到知识库：将当前便签同步保存到知识库 (${shortenPath(kbDir)})`
                    : "同步到知识库：将当前便签同步保存到知识库目录"
                ),
              onMouseLeave: hideTip,
              onClick: handleSyncToKb,
            },
            ForkKbIcon(15),
          ),
        ),
      ),

      /* 右侧：与侧栏「«」/右栏「»」风格完全一致的双向下尖角折叠符 */
      /* 右侧功能组：向上最大化/还原 + 向下收起折叠符（风格完全一致，方向相反） */
      e(
        "div",
        { className: "pw-qn-header-right" },
        /* 向上扩大便签抽屉到最大 / 还原高度 */
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: isMaximized ? "还原高度" : "向上扩到最大",
            onClick: handleToggleMaximize,
          },
          isMaximized ? CollapseIcon(13) : ExpandIcon(13),
        ),
        /* 收起下栏 (Esc) */
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: "收起下栏 (Esc)",
            onClick: () => qnStore.set({ open: false }),
          },
          e("span", { className: "pw-qn-collapse-icon" }, "»"),
        ),
      ),
    ),

    /* 主体三栏：目录列 + 便签列表列 + Typora 编辑区（参考 Apple 备忘录架构） */
    e(
      "div",
      { className: "pw-qn-body" },
      /* 第一栏：目录栏（可展开/收起，含「全部便签」与自定义目录） */
      showFolders &&
        e(
          "div",
          {
            className: "pw-qn-col-folders",
            style: { width: folderWidth + "px" },
          },
          /* 全部便签（跨目录查看全部，支持拖入移出目录） */
          e(
            "div",
            {
              className: "pw-qn-folder-item" + (qnStore.selectedFolder === null ? " active" : "") + (dragOverFolder === "__all__" ? " drag-over" : ""),
              onClick: () => qnStore.set({ selectedFolder: null }),
              onDragOver: (ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
              },
              onDragEnter: (ev) => {
                ev.preventDefault();
                setDragOverFolder("__all__");
              },
              onDragLeave: (ev) => {
                if (dragOverFolder === "__all__") setDragOverFolder(null);
              },
              onDrop: async (ev) => {
                ev.preventDefault();
                setDragOverFolder(null);
                const n = ev.dataTransfer.getData("text/plain") || draggingNote;
                if (n) await qnMoveNoteToFolder(n, "");
              },
            },
            e("span", { className: "pw-qn-folder-ico" }, AllNotesIcon(13)),
            e("span", { className: "pw-qn-folder-name" }, "全部便签"),
            e("span", { className: "pw-qn-folder-count" }, notes.length),
            /* 悬停快捷按钮：引用全部便签到输入框 @ */
            e(
              "div",
              {
                className: "pw-qn-folder-acts",
                onClick: (ev) => ev.stopPropagation(),
              },
              e(
                "button",
                {
                  className: "pw-qn-folder-act-btn",
                  title: "引用全部便签到输入框 (@)",
                  onClick: () => handleQuoteFolder(null),
                },
                AtIcon(11),
              ),
            ),
          ),
          /* 用户自定义目录项（无冗余「我的目录」行，支持拖拽放置） */
          (qnStore.folders || []).map((f) => {
            const count = notes.filter((n) => n.folder === f).length;
            if (renamingFolder === f) {
              return e(
                "div",
                { key: f, className: "pw-qn-folder-item active" },
                e("input", {
                  className: "pw-qn-folder-input",
                  value: renameFolderVal,
                  autoFocus: true,
                  onFocus: (ev) => ev.target.select(),
                  onChange: (ev) => setRenameFolderVal(ev.target.value),
                  onKeyDown: (ev) => {
                    if (ev.key === "Enter") {
                      qnRenameFolder(f, renameFolderVal);
                      setRenamingFolder(null);
                    } else if (ev.key === "Escape") {
                      setRenamingFolder(null);
                    }
                  },
                  onBlur: () => {
                    if (renameFolderVal.trim() && renameFolderVal.trim() !== f) {
                      qnRenameFolder(f, renameFolderVal);
                    }
                    setRenamingFolder(null);
                  },
                }),
              );
            }
            return e(
              "div",
              {
                key: f,
                className: "pw-qn-folder-item" + (qnStore.selectedFolder === f ? " active" : "") + (dragOverFolder === f ? " drag-over" : ""),
                onClick: () => qnStore.set({ selectedFolder: f }),
                onDragOver: (ev) => {
                  ev.preventDefault();
                  ev.dataTransfer.dropEffect = "move";
                },
                onDragEnter: (ev) => {
                  ev.preventDefault();
                  setDragOverFolder(f);
                },
                onDragLeave: (ev) => {
                  if (dragOverFolder === f) setDragOverFolder(null);
                },
                onDrop: async (ev) => {
                  ev.preventDefault();
                  setDragOverFolder(null);
                  const n = ev.dataTransfer.getData("text/plain") || draggingNote;
                  if (n) await qnMoveNoteToFolder(n, f);
                },
              },
              e("span", { className: "pw-qn-folder-ico" }, FolderSimpleIcon(13)),
              e("span", { className: "pw-qn-folder-name", title: f }, f),
              e("span", { className: "pw-qn-folder-count" }, count),
              /* 鼠标悬停出现引用、重命名、删除按钮 */
              e(
                "div",
                {
                  className: "pw-qn-folder-acts",
                  onClick: (ev) => ev.stopPropagation(),
                },
                /* 引用该目录到输入框 @ */
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: `引用目录「${f}」全部便签到输入框 (@)`,
                    onClick: () => handleQuoteFolder(f),
                  },
                  AtIcon(11),
                ),
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: "重命名目录",
                    onClick: () => {
                      setRenamingFolder(f);
                      setRenameFolderVal(f);
                    },
                  },
                  PencilIcon(10),
                ),
                e(
                  "button",
                  {
                    className: "pw-qn-folder-act-btn",
                    title: "删除目录",
                    onClick: () => qnDeleteFolder(f),
                  },
                  TrashIcon(10),
                ),
              ),
            );
          }),
          /* 新增目录输入框 */
          isCreatingFolder &&
            e(
              "div",
              { className: "pw-qn-folder-item active" },
              e("input", {
                className: "pw-qn-folder-input",
                placeholder: "新目录名称...",
                value: newFolderVal,
                autoFocus: true,
                onChange: (ev) => setNewFolderVal(ev.target.value),
                onKeyDown: (ev) => {
                  if (ev.key === "Enter") {
                    if (newFolderVal.trim()) {
                      qnCreateFolder(newFolderVal.trim());
                    }
                    setIsCreatingFolder(false);
                  } else if (ev.key === "Escape") {
                    setIsCreatingFolder(false);
                  }
                },
                onBlur: () => {
                  if (newFolderVal.trim()) {
                    qnCreateFolder(newFolderVal.trim());
                  }
                  setIsCreatingFolder(false);
                },
              }),
            ),
        ),

      /* 目录栏与列表栏之间的调整线 */
      showFolders &&
        e("div", {
          className: "pw-qn-col-resizer",
          onPointerDown: onFolderResizerStart,
        }),

      /* 第二栏：便签列表（根据选中目录筛选展示） */
      e(
        "div",
        {
          className: "pw-qn-col-list",
          style: { width: listWidth + "px" },
        },
        qnStore.loading && visibleNotes.length === 0
          ? e("div", { className: "pw-qn-empty-hint" }, "载入中…")
          : visibleNotes.length === 0
          ? e(
              "div",
              { className: "pw-qn-empty-hint" },
              qnStore.selectedFolder
                ? `目录「${qnStore.selectedFolder}」暂无便签\n点击上方「+」新建`
                : "无便签\n点击上方「+」新建",
            )
          : visibleNotes.map((item) => {
              const thumb = qnExtractFirstImage(item.preview || "");
              const isCur = qnStore.selected === item.name;
              const isRenaming = renamingName === item.name;

              return e(
                "div",
                {
                  key: item.name,
                  className: "pw-qn-side-item" + (isCur ? " active" : "") + (draggingNote === item.name ? " is-dragging" : ""),
                  draggable: !isRenaming,
                  onDragStart: (ev) => {
                    ev.dataTransfer.setData("text/plain", item.name);
                    ev.dataTransfer.effectAllowed = "move";
                    setDraggingNote(item.name);
                  },
                  onDragEnd: () => {
                    setDraggingNote(null);
                    setDragOverFolder(null);
                  },
                  onClick: async () => {
                    if (isRenaming) return;
                    await flushSave();
                    qnStore.set({ selected: item.name });
                  },
                },
                e(
                  "div",
                  { className: "pw-qn-side-main" },
                  isRenaming
                    ? e("input", {
                        className: "pw-qn-rename-input",
                        autoFocus: true,
                        value: renameVal,
                        onFocus: (ev) => ev.target.select(),
                        onClick: (ev) => ev.stopPropagation(),
                        onChange: (ev) => setRenameVal(ev.target.value),
                        onKeyDown: async (ev) => {
                          if (ev.key === "Enter") {
                            ev.stopPropagation();
                            const newT = renameVal.trim();
                            setRenamingName(null);
                            if (newT && newT !== item.title) {
                              await qnUpdateNote(item.name, item.preview || " ", newT);
                            }
                          } else if (ev.key === "Escape") {
                            ev.stopPropagation();
                            setRenamingName(null);
                          }
                        },
                        onBlur: async () => {
                          const newT = renameVal.trim();
                          setRenamingName(null);
                          if (newT && newT !== item.title) {
                            await qnUpdateNote(item.name, item.preview || " ", newT);
                          }
                        },
                      })
                    : e("div", { className: "pw-qn-side-title", title: item.title }, item.title || "无标题"),
                  e(
                    "div",
                    { className: "pw-qn-side-row" },
                    e("span", { className: "pw-qn-side-time" }, qnFormatAppleDate(item.mtime)),
                    /* 显示目录归属标签（参考苹果备忘录） */
                    item.folder
                      ? e(
                          "span",
                          {
                            className: "pw-qn-side-folder-tag",
                            title: "所属目录：" + item.folder,
                            onClick: (ev) => {
                              ev.stopPropagation();
                              qnStore.set({ selectedFolder: item.folder });
                            },
                          },
                          FolderSimpleIcon(9),
                          item.folder,
                        )
                      : null,
                    e("span", { className: "pw-qn-side-snippet" }, qnStripMarkdown(item.preview || "无内容")),
                  ),
                ),
                thumb && e("img", { src: thumb, className: "pw-qn-side-thumb", alt: "" }),
                /* 鼠标悬停在卡片上展现的标准尺寸按钮组（与侧边栏 session-row 完全同款：pw-row-acts + pw-act-btn） */
                !isRenaming &&
                  (cnf[0] === item.name
                    ? e(
                        "div",
                        { className: "pw-row-acts" },
                        /* 确认删除（二次点击才真正删除） */
                        e(
                          "button",
                          {
                            className: "pw-act-btn danger",
                            title: "确认删除该便签",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[2]();
                              qnDeleteNote(item.name);
                            },
                          },
                          "✓",
                        ),
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "取消删除",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[2]();
                            },
                          },
                          "×",
                        ),
                      )
                    : e(
                        "div",
                        { className: "pw-row-acts" },
                        /* 引用到对话 @ */
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "引用到输入框",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              const sid = qnActiveSid();
                              if (!sid) {
                                qnToast("无活跃会话，无法引用");
                                return;
                              }
                              if (qnMentionNote(sid, item.name)) {
                                qnToast("已引用到输入框");
                              } else {
                                qnToast("引用失败，请稍后重试");
                              }
                            },
                          },
                          AtIcon(13),
                        ),
                        /* 改名 */
                        e(
                          "button",
                          {
                            className: "pw-act-btn",
                            title: "重命名",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              setRenamingName(item.name);
                              setRenameVal(item.title || "");
                            },
                          },
                          PencilIcon(13),
                        ),
                        /* 删除 */
                        e(
                          "button",
                          {
                            className: "pw-act-btn danger",
                            title: "删除便签（需确认）",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              cnf[1](item.name);
                            },
                          },
                          TrashIcon(13),
                        ),
                      )
                  ),
              );
            }),
      ),

      /* 纵向拖拽调整线（标准细线风格，悬停微弱高亮，与全局边框粗细完全一致） */
      e("div", {
        className: "pw-qn-col-resizer",
        onPointerDown: onResizerStart,
      }),

      /* 第三栏：Typora 风格纯粹编辑即预览（全高度沉浸画布） */
      e(
        "div",
        { className: "pw-qn-col-paper" },
        selectedNote
          ? e("div", {
              ref: canvasRef,
              className: "pw-qn-typora-canvas",
              contentEditable: true,
              suppressContentEditableWarning: true,
              onInput: onEditorInput,
              onPaste: handlePaste,
              onClick: onCanvasClick,
            })
          : null,
      ),
    ),

    /* 悬浮 Toast 提示 */
    qnStore.toast && e("div", { className: "pw-qn-toast" }, qnStore.toast),

    /* 顶栏即时浮动气泡（0ms 响应，置顶防 overflow 裁剪） */
    tipInfo
      ? e(
          "div",
          {
            className: "pw-qn-tip",
            style: { left: tipInfo.x + "px", top: tipInfo.y + "px" },
          },
          tipInfo.text,
        )
      : null,
  );
}

function QuickNotesHost() {
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);

  React.useEffect(() => {
    function onKeyDown(ev) {
      if (ev.key === "Escape" && qnStore.open) {
        qnStore.set({ open: false });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(QnSelectionBubble, null),
    React.createElement(QuickNotesPanel, null),
  );
}
