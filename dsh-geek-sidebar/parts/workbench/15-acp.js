/* ==================== ACP 智能体 tabs（Kimi Code）：连接存储层 + 视图 ====================
 * 架构：WS 连接与全部会话状态放在纯 JS 的 AcpClient（不挂 React 生命周期）——
 * 面板关闭/切 tab 组件卸载，连接和 agent 进程照样活着，tab 状态点与侧栏"助手"
 * 徽标因此是实时值。只有 tab 上的 × 会断 WS（host 30s 宽限后回收进程）。
 * 状态机：connecting → idle ⇄ running ⇄ waiting（权限卡）→ idle；dead（退出/失败）可重连。
 * bus.fire 做 50ms 节流：流式 chunk 高频到达，避免每个 token 都全量重渲染。 */

/* content → 纯文本（模块级：acpApplyUpdate 与 AcpClient.applyUpdate 的压缩吸收共用）。
 * 工具调用的 content 是双层包装 {type:'content', content:{type:'text',text}}（实测），须先剥内层 */
const acpTextOf = (c) => {
  if (!c) return "";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(acpTextOf).join("");
  const inner = c.content && typeof c.content === "object" ? acpTextOf(c.content) : "";
  return inner || String(c.text || "");
};

/* update 事件 → 流式列表项（append/merge 规则集中在这一处；副作用类 update 走 applyUpdate） */
function acpApplyUpdate(items, update) {
  const kind = update && update.sessionUpdate;
  const content = update && update.content;
  const textOf = acpTextOf;
  /* 工具关键参数提取（实测形状）：locations[0].path 最可靠（completed 时才有）；
   * 其次 in_progress 阶段 content 文本是 input JSON 的完整前缀快照（覆盖语义，非 delta）；
   * 再其次 diff 类条目把 path 放在条目级。 */
  const argOf = (u) => {
    const loc = u && u.locations && u.locations[0] && u.locations[0].path;
    if (loc) return String(loc);
    const cl = u && u.content;
    if (Array.isArray(cl)) {
      for (const it of cl) if (it && typeof it.path === "string" && it.path) return it.path;
    }
    const t = textOf(cl);
    if (!t) return "";
    try {
      const j = JSON.parse(t);
      return String(j.path || j.command || j.file_path || j.filePath || j.query || j.pattern || j.url || j.cmd || "");
    } catch (e) {
      return "";
    }
  };
  const next = items.slice();
  const appendText = (k, t) => {
    if (next.length && next[next.length - 1].kind === k) {
      next[next.length - 1] = Object.assign({}, next[next.length - 1], { text: next[next.length - 1].text + t });
    } else {
      next.push({ key: next.length, kind: k, text: t });
    }
  };
  if (kind === "user_message_chunk") appendText("user", textOf(content));
  else if (kind === "agent_message_chunk") appendText("agent", textOf(content));
  else if (kind === "agent_thought_chunk") appendText("thought", textOf(content));
  else if (kind === "tool_call") {
    next.push({
      key: next.length,
      kind: "tool",
      id: update.toolCallId,
      title: update.title || "工具调用",
      status: update.status || "pending",
      arg: argOf(update),
      output: "",
    });
  } else if (kind === "tool_call_update") {
    const i = next.findIndex((x) => x.kind === "tool" && x.id === update.toolCallId);
    if (i >= 0) {
      const cur = next[i];
      const done = update.status === "completed" || update.status === "failed";
      next[i] = Object.assign({}, cur, {
        status: update.status || cur.status,
        title: update.title || cur.title,
        arg: argOf(update) || cur.arg,
        /* 完成帧的 content/rawOutput 才是工具输出；进行中的 content 只是 input 快照，不入 output */
        output: done ? (typeof update.rawOutput === "string" && update.rawOutput ? update.rawOutput : textOf(update.content)) || cur.output : cur.output,
      });
    }
  } else if (kind === "plan") {
    const entries = (update.entries || []).map((en) => (en.status === "completed" ? "☑ " : en.status === "in_progress" ? "▶ " : "☐ ") + (en.content || ""));
    next.push({ key: next.length, kind: "plan", text: entries.join("\n") });
  }
  return next;
}

/* 压缩通知剥离（kimi 0.37 实测三种形态）：
 * - 回放/auto-compaction：通知 chunk 并入上一条回复的 agent 条目尾部，无法按条目剔除；
 * - 完整形态 "Context compaction started … Tokens after: N"，或裸 "Compaction completed/cancelled."（轮后片段）；
 * - 故渲染层取两类起点中较早者截到通知尾（有 Tokens after 则保其后的文本），前缀真实回复保留。
 *   实时手动压缩走 compacting 缓冲，不进流、无需此兜底 */
const stripCompactNotice = (t) => {
  const s = String(t || "");
  let i = s.indexOf("Context compaction started");
  const j = s.search(/Compaction (?:completed|cancelled)\./);
  if (j >= 0 && (i < 0 || j < i)) i = j;
  if (i < 0) return t;
  const rest = s.slice(i);
  const m = /Tokens after:\s*[\d,]+/.exec(rest);
  return s.slice(0, i) + (m ? rest.slice(m.index + m[0].length) : "");
};

const ACP_STATUS = {
  connecting: { label: "连接中" },
  idle: { label: "空闲" },
  running: { label: "运行中" },
  waiting: { label: "待交互" },
  dead: { label: "已退出" },
};

/* 工具调用状态中文化（kimi 原值 pending/in_progress/completed/failed） */
const TOOL_STATUS = { pending: "等待", in_progress: "运行中", completed: "完成", failed: "失败" };
/* 工具参数显示缩短：路径留末两段，非路径（如命令行）原样交给 CSS 省略 */
const shortArg = (p) => {
  const s = String(p || "");
  if (s.indexOf("/") < 0) return s;
  const seg = s.split("/").filter(Boolean);
  return seg.length > 2 ? "…/" + seg.slice(-2).join("/") : s;
};

class AcpClient {
  constructor(tabId, cwd) {
    this.tabId = tabId;
    this.cwd = cwd;
    this.status = "connecting";
    this.items = [];
    this.sessionId = null;
    this.compacting = false; /* 压缩轮：通知文本属元信息，缓冲到 compactText 不入流 */
    this.compactText = null;
    this._compactTimer = 0; /* 压缩态兜底定时器（120s 自复位） */
    this.modes = null; /* session/new 的 modes（default/plan/auto/yolo） */
    this.configOptions = null; /* configOptions（model/thinking/mode 选择器数据源） */
    this.capabilities = null; /* agentCapabilities（image 等） */
    this.usage = null; /* usage_update：{used,size} */
    this.commands = []; /* available_commands_update：斜杠命令 */
    this.title = ""; /* session_info_update */
    this.perm = null;
    this.fatal = null;
    this.sessions = null; /* session/list 结果（不过滤，渲染时按 cwd 过滤） */
    this.historyBusy = false;
    this.queue = []; /* 后续消息队列 {text,images}：运行中入队，回 idle 自动补发 */
    this.steer = null; /* 待引导消息：cancel 当前轮后回发 */
    this.intentionalClose = false;
    this._fireT = 0;
    this.connect();
  }
  /* 50ms 节流 fire：流式更新合并成约 20fps 的重渲染。
   * hot=true 走 "acp" 频道（评审修复：chunk 不再扇出到侧栏/详情）；同一节流窗口内
   * 出现非热事件即升级为全局 fire——FootBar 徽标等全局订阅者不会错过状态跳变 */
  fire(hot) {
    if (!hot) this._fireGlobal = true;
    if (this._fireT) return;
    this._fireT = setTimeout(() => {
      this._fireT = 0;
      const g = this._fireGlobal;
      this._fireGlobal = false;
      g ? bus.fire() : bus.fire("acp");
    }, 50);
  }
  connect() {
    this.intentionalClose = false;
    this.status = "connecting";
    this.fatal = null;
    const u = new URL("/__dsh-geek-sidebar__/wb/acp-ws", location.origin);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.search = new URLSearchParams({ agent: "kimi", session: this.tabId, cwd: this.cwd }).toString();
    /* 评审修复：socket 代际号——重连/手动 reconnect 后，旧 socket 晚到的 onmessage/onclose
     * 不得写新连接的状态（旧版无守卫：旧 close 会把新态误置 dead 并多排一次退避，双连接
     * 并存时 replay/update 还会交错进同一份 items） */
    const gen = (this._gen = (this._gen || 0) + 1);
    const ws = new WebSocket(u.toString());
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (gen !== this._gen) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "hello") {
        const sameSession = !!(this.sessionId && msg.sessionId === this.sessionId);
        this.sessionId = msg.sessionId;
        this.modes = msg.modes || null;
        this.configOptions = msg.configOptions || null;
        this.capabilities = msg.capabilities || null;
        if (this.status === "connecting") this.status = "idle";
        /* 重连成功：复位退避计数 */
        this._rcAttempt = 0;
        this.reconnecting = 0;
        if (this._rcTimer) {
          clearTimeout(this._rcTimer);
          this._rcTimer = 0;
        }
        /* 刷新恢复/断线回捞（resumeRecent）：拉会话列表，sessions 帧里回捞该目录最近一条有标题会话。
         * 同进程重挂（sessionId 未变）除外——replay 会补齐，不许 load 走当前会话 */
        if (this.resumeRecent) {
          this.resumeRecent = false;
          if (!sameSession) {
            this.resumePick = true;
            this.ws.send(JSON.stringify({ type: "list_sessions" }));
          }
        }
        this._flushQueue(); /* dead 期排队的消息：连回即补发 */
      } else if (msg.type === "replay") {
        for (const u2 of msg.events || []) this.applyUpdate(u2);
      } else if (msg.type === "update") {
        this.applyUpdate(msg.update);
      } else if (msg.type === "turn_end") {
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        /* 注意：不在此清压缩态——实测 kimi 的 /compact 轮次 ~50ms 即 turn_end（仅应答），
         * 压缩本体在后台跑，完成/取消文本轮后才到（大上下文可达 ~10s）。收场由
         * applyUpdate 见到 completed/cancelled 文本触发，120s 定时兜底 */
        this._flushQueue();
      } else if (msg.type === "permission") {
        this.perm = { requestId: msg.requestId, title: msg.title, options: msg.options || [] };
        this.status = "waiting";
      } else if (msg.type === "sessions") {
        /* 空白对话（title 空 = 从未提问）直接删除、不进历史。两道边界（均实测）：
         * 1) kimi 的 session/delete 只能删本进程 cwd 的会话，跨 cwd 必回 Internal error → 只扫同 cwd，
         *    异 cwd 空白保留在列表数据里（渲染层本来也按 cwd 过滤），等那个目录的 tab 开历史时自清理；
         * 2) 豁免所有存活 tab 的当前会话——它可能正空白等输入，删了下条 prompt 会失效。
         * 清扫删除带 silent：家务操作，失败（理论上不该再有）也不许污染对话流。 */
        const liveIds = Object.keys(acpTabs.clients)
          .map((k) => acpTabs.clients[k] && acpTabs.clients[k].sessionId)
          .filter(Boolean);
        const keep = [];
        for (const s of msg.sessions || []) {
          const blank = s && s.sessionId && !(s.title && String(s.title).trim());
          if (blank && s.cwd === this.cwd && liveIds.indexOf(s.sessionId) < 0) {
            this.ws.send(JSON.stringify({ type: "delete_session", sessionId: s.sessionId, silent: true }));
          } else keep.push(s);
        }
        this.sessions = keep;
        this.historyBusy = false;
        /* 刷新恢复的回捞：最近一条有标题、非当前、未被其他恢复 tab 认领的同 cwd 会话 */
        if (this.resumePick) {
          this.resumePick = false;
          const cand = keep
            .filter((s) => s && s.sessionId && s.cwd === this.cwd && s.title && String(s.title).trim() && s.sessionId !== this.sessionId && acpResumedIds.indexOf(s.sessionId) < 0)
            .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
          if (cand) {
            acpResumedIds.push(cand.sessionId);
            this.loadSession(cand.sessionId, true); /* keepQueue：断线期排队的消息在 loaded 后补发 */
          }
        }
      } else if (msg.type === "loaded") {
        /* 换会话：清空流，kimi 随后以 update 帧回放历史 */
        this.items = [];
        this.sessionId = msg.sessionId;
        this.perm = null;
        this.usage = null;
        this._clearCompacting();
        if (this.status !== "dead") this.status = "idle";
        this._flushQueue(); /* 回捞完成后补发断线期排队消息（用户主动换会话时队列已清空，空转） */
      } else if (msg.type === "config") {
        if (msg.sessionId) this.sessionId = msg.sessionId;
        if (msg.modes) this.modes = msg.modes;
        if (msg.configOptions) this.configOptions = msg.configOptions;
      } else if (msg.type === "session_deleted") {
        if (this.sessions) this.sessions = this.sessions.filter((s) => s && s.sessionId !== msg.sessionId);
      } else if (msg.type === "note") {
        this.items = this.items.concat({ key: this.items.length, kind: "note", text: msg.message });
      } else if (msg.type === "error") {
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: msg.message });
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        this._clearCompacting();
        this._flushQueue();
      } else if (msg.type === "exit") {
        this.status = "dead";
        this._clearCompacting();
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: "进程已退出（code " + msg.code + "）" });
      }
      /* 纯流式增量标 hot 走 "acp" 频道（评审修复）：chunk/usage 是 20fps 源，
       * 侧栏/详情无需随之重渲染；其余（hello/turn_end/permission/sessions/exit…）
       * 保持全局 fire——FootBar 徽标与 tab 列表靠状态跳变 */
      const su = msg.type === "update" && msg.update && msg.update.sessionUpdate;
      this.fire(su === "agent_message_chunk" || su === "agent_thought_chunk" || su === "usage_update");
    };
    ws.onclose = (ev) => {
      if (gen !== this._gen) return;
      if (ev.code === 1011 && ev.reason) this.fatal = ev.reason;
      this._clearCompacting();
      if (!this.intentionalClose) {
        this.status = "dead";
        this._scheduleReconnect(); /* 异常断线：指数退避自动重连（dsh 重启/网络抖动无感恢复） */
      }
      this.fire();
    };
    ws.onerror = () => {};
    this.fire();
  }
  /* session/update：副作用类本地吸收，流式类交给 acpApplyUpdate */
  applyUpdate(u) {
    const kind = u && u.sessionUpdate;
    if (kind === "usage_update") this.usage = { used: u.used || 0, size: u.size || 0 };
    else if (kind === "available_commands_update") this.commands = u.availableCommands || [];
    else if (kind === "session_info_update") this.title = u.title || "";
    else if (kind === "current_mode_update" && u.currentModeId) {
      if (this.modes) this.modes = Object.assign({}, this.modes, { currentModeId: u.currentModeId });
      else this.modes = { currentModeId: u.currentModeId, availableModes: [] };
    } else if (kind === "config_option_update" && Array.isArray(u.configOptions)) {
      this.configOptions = u.configOptions;
    } else if (this.compacting && (kind === "agent_message_chunk" || kind === "agent_thought_chunk")) {
      /* 压缩通知吸收（kimi 0.37 实测：started 应答在轮内，completed/cancelled 在轮后到达，
       * 均属元信息不是对话内容，用户决策不展示）：入缓冲不入流，
       * 见到完成/取消文本立即收场——此后若有真实回复 chunk（压缩期间又发了新消息）正常入流 */
      this.compactText = (this.compactText || "") + acpTextOf(u.content);
      if (/Compaction (?:completed|cancelled)\./.test(this.compactText)) this._clearCompacting();
    } else if (kind === "user_message_chunk" && acpTextOf(u.content).trim() === "/compact") {
      /* kimi 侧 /compact 回声（实时或回放）同样吞掉——压缩命令本身也不进对话 */
    } else {
      this.items = acpApplyUpdate(this.items, u);
    }
  }
  open() {
    return this.ws && this.ws.readyState === 1;
  }
  /* 压缩态跨轮持有：/compact 轮次仅应答（实测 ~50ms 即 turn_end），压缩本体后台运行，
   * 完成/取消文本轮后才到。收场三途：见到 Compaction completed/cancelled 文本、
   * error/loaded/断线清场、120s 定时兜底（kimi 异常静默时不至于卡红钮） */
  _markCompacting() {
    this.compacting = true;
    this.compactText = "";
    if (this._compactTimer) clearTimeout(this._compactTimer);
    this._compactTimer = setTimeout(() => {
      this._compactTimer = 0;
      this._clearCompacting();
      this.fire();
    }, 120000);
  }
  _clearCompacting() {
    this.compacting = false;
    this.compactText = null;
    if (this._compactTimer) {
      clearTimeout(this._compactTimer);
      this._compactTimer = 0;
    }
  }
  sendPrompt(text, images) {
    if (!this.open() || this.status === "running" || this.status === "waiting" || this.status === "dead") return;
    const imgs = (images || []).filter((im) => im && im.data).map((im) => ({ data: im.data, mimeType: im.mimeType }));
    if (!String(text || "").trim() && !imgs.length) return;
    this.ws.send(JSON.stringify({ type: "prompt", text: text || "", images: imgs.length ? imgs : undefined }));
    /* /compact：标记压缩态（通知不回流），本地用户回声也不插——命令本身不污染对话 */
    if (String(text || "").trim() === "/compact") {
      this._markCompacting();
    } else {
      this.items = this.items.concat({
        key: this.items.length,
        kind: "user",
        text: text || "",
        images: (images || []).map((im) => ({ url: im.url })),
      });
    }
    this.status = "running";
    this.perm = null;
    this.fire();
  }
  cancel() {
    if (this.open()) this.ws.send(JSON.stringify({ type: "cancel" }));
  }
  /* 后续消息排队 / 立即引导（参考 Cursor 交互，用户决策 2026-08）。纯客户端编排，
   * 不赌 ACP 中途 prompt 行为：排队=入队后等 turn_end/error 回 idle 自动补发；
   * 引导=cancel 当前轮，轮次结束回发引导文本（等效"打断并转向"）。 */
  enqueue(text, images) {
    this.queue = this.queue.concat({ text: String(text || ""), images: images || [] });
    this.fire();
  }
  popQueue() {
    const m = this.queue[this.queue.length - 1];
    this.queue = this.queue.slice(0, -1);
    this.fire();
    return m || null;
  }
  steerNow(text, images) {
    if (this.status === "running" || this.status === "waiting") {
      this.steer = { text: String(text || ""), images: images || [] };
      this.cancel();
    } else this.sendPrompt(text, images);
  }
  _flushQueue() {
    if (this.status !== "idle" || !this.open()) return;
    let m = this.steer;
    this.steer = null;
    if (!m && this.queue.length) m = this.queue[0];
    if (!m) return;
    if (this.queue[0] === m) this.queue = this.queue.slice(1);
    this.sendPrompt(m.text, m.images);
  }
  answerPermission(requestId, optionId) {
    if (this.open()) this.ws.send(JSON.stringify({ type: "permission", requestId, optionId }));
    this.perm = null;
    if (this.status === "waiting") this.status = "running";
    this.fire();
  }
  setMode(modeId) {
    if (this.open() && modeId) this.ws.send(JSON.stringify({ type: "set_mode", modeId }));
  }
  setConfig(configId, value) {
    if (this.open() && configId) this.ws.send(JSON.stringify({ type: "set_config", configId, value }));
  }
  listSessions() {
    if (!this.open()) return;
    this.historyBusy = true;
    this.ws.send(JSON.stringify({ type: "list_sessions" }));
    this.fire();
  }
  loadSession(sessionId, keepQueue) {
    if (!this.open() || !sessionId || sessionId === this.sessionId || this.status === "running") return;
    if (!keepQueue) {
      this.queue = []; /* 用户主动换会话：队列属于旧会话上下文，即清空 */
      this.steer = null;
    }
    this.ws.send(JSON.stringify({ type: "load_session", sessionId }));
    this.status = "connecting";
    this.perm = null;
    this.fire();
  }
  /* 会话操作三件套：运行/等待中禁止（new/fork 会换 sessionId，中途换会出乱） */
  busy() {
    return this.status === "running" || this.status === "waiting" || this.status === "connecting" || this.status === "dead";
  }
  newSession() {
    if (!this.open() || this.busy()) return;
    this.queue = []; /* 同上：新会话不继承旧队列 */
    this.steer = null;
    this.ws.send(JSON.stringify({ type: "new_session" }));
  }
  forkSession() {
    if (!this.open() || this.busy()) return;
    this.ws.send(JSON.stringify({ type: "fork_session" }));
  }
  deleteSession(sessionId) {
    if (!this.open() || !sessionId || sessionId === this.sessionId) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId }));
  }
  /* 关 tab 前调用：本会话从未提问（无 user 条目——本地发送/回放/重连三路径都会留下 user
   * 条目，判据可靠）则直接删除，不留历史空白。注意 deleteSession() 拒删当前会话，这里须绕开。 */
  discardIfBlank() {
    if (!this.sessionId || !this.open()) return;
    if (this.items.some((it) => it && it.kind === "user")) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId: this.sessionId, silent: true }));
  }
  /* 自动重连（用户决策 2026-08）：1s→2s→4s→8s 封顶，最多 12 次（约 93s 窗口，覆盖 dsh 重启）。
   * 成功由 hello 复位计数；放弃后保留 dead 横幅，手动按钮仍可立即重连。 */
  _scheduleReconnect() {
    if (this._rcTimer) return;
    const attempt = (this._rcAttempt || 0) + 1;
    if (attempt > 12) {
      this.reconnecting = 0;
      return;
    }
    this._rcAttempt = attempt;
    this.reconnecting = attempt;
    this._rcTimer = setTimeout(
      () => {
        this._rcTimer = 0;
        this.reconnect();
      },
      Math.min(1000 * Math.pow(2, attempt - 1), 8000),
    );
  }
  reconnect() {
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    this._rcAttempt = 0;
    this.reconnecting = 0;
    /* 同进程重挂：hello 同 sessionId 自动取消回捞；新进程：回捞最近历史会话 */
    this.resumeRecent = true;
    this.connect();
  }
  close() {
    this.intentionalClose = true;
    this._gen = (this._gen || 0) + 1; /* 评审修复：close 后晚到帧一并作废（同代际守卫） */
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    try {
      this.ws && this.ws.close();
    } catch (e) {}
  }
}

/* tab 列表 localStorage 持久化（用户要求 2026-08：刷新不丢已选目录）。
 * 仅存 {id,cwd}；无 window 环境（无头冒烟）安全降级为空操作。 */
const ACP_LS_KEY = "pw-acp-tabs";
const acpLs = {
  read() {
    try {
      if (typeof window === "undefined") return [];
      const v = JSON.parse(window.localStorage.getItem(ACP_LS_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  },
  write(tabs) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(ACP_LS_KEY, JSON.stringify(tabs.map((t) => ({ id: t.id, cwd: t.cwd }))));
    } catch (e) {}
  },
};
/* 恢复回捞的会话认领表：多个恢复 tab 同目录时不许抢同一条历史会话 */
const acpResumedIds = [];

/* 智能体 tab 注册表：tab 元信息 + 各 tab 的 AcpClient。 */
const acpTabs = {
  seq: 0,
  tabs: [] /* {id,cwd,name} */,
  clients: {} /* id -> AcpClient */,
  add(cwd) {
    const id = "k" + Date.now().toString(36) + ++acpTabs.seq;
    acpTabs.clients[id] = new AcpClient(id, cwd);
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd, name: baseName(cwd) || cwd });
    acpLs.write(acpTabs.tabs);
    bottomPanel.set({ open: true, tab: id });
    bus.fire();
    return id;
  },
  close(id) {
    const c = acpTabs.clients[id];
    if (c) {
      try {
        c.discardIfBlank();
        c.close();
      } catch (e) {}
    }
    delete acpTabs.clients[id];
    acpTabs.tabs = acpTabs.tabs.filter((t) => t.id !== id);
    acpLs.write(acpTabs.tabs);
    if (bottomPanel.tab === id) bottomPanel.set({ tab: "terminal" });
    bus.fire();
  },
  counts() {
    let run = 0,
      wait = 0;
    for (const t of acpTabs.tabs) {
      const c = acpTabs.clients[t.id];
      if (!c) continue;
      if (c.status === "running") run++;
      else if (c.status === "waiting") wait++;
    }
    return { run, wait, total: acpTabs.tabs.length };
  },
};

/* 刷新恢复：重建上次的 tab（上限 6 个防爆量），AcpClient 重连后回捞该目录最近一条
 * 有标题会话（session/load 回放完整历史，对话不丢）。纯客户端方案，无需 host 改动；
 * 重建时新建的空白会话交给历史面板的空白清扫兜底。 */
function acpRestore() {
  if (typeof window === "undefined") return;
  const saved = acpLs.read();
  for (const t of saved.slice(0, 6)) {
    if (!t || typeof t.cwd !== "string" || !t.cwd) continue;
    const id = typeof t.id === "string" && t.id && !acpTabs.clients[t.id] ? t.id : "k" + Date.now().toString(36) + ++acpTabs.seq;
    const c = new AcpClient(id, t.cwd);
    c.resumeRecent = true;
    acpTabs.clients[id] = c;
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd: t.cwd, name: baseName(t.cwd) || t.cwd });
  }
  if (acpTabs.tabs.length) bus.fire();
}
acpRestore();

/* 单个智能体 tab 的视图：头部（状态/模式/模型/thinking/历史）+ 用量条 + 流 + 权限卡 + 输入行 */
function AgentTabView({ client }) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  /* "acp" 频道订阅（评审修复：bus 拆分后唯一需要随流式 chunk 重渲染的视图；
   * 全局 fire 按语义仍会送达本频道——store/bottomPanel 等稀有事件不丢） */
  React.useEffect(() => bus.sub(() => force((x) => x + 1), "acp"), []);
  const [draft, setDraft] = React.useState("");
  const [images, setImages] = React.useState([]); /* {url,data,mimeType}，最多 4 张 */
  const [histOpen, setHistOpen] = React.useState(false);
  /* 评审修复：两击确认收敛 06-misc 共享状态机（原手抄 useState；id=sessionId，适配器保持原签名） */
  const cf = useTwoClick();
  const delId = cf[0], setDelId = (id) => (id == null ? cf[2]() : cf[1](id));
  const [slashIdx, setSlashIdx] = React.useState(0);
  const [slashOff, setSlashOff] = React.useState(false); /* Esc 关闭补全弹窗，继续输入自动复位 */
  const [usageOpen, setUsageOpen] = React.useState(false); /* 上下文用量浮层 */
  const [copiedKey, setCopiedKey] = React.useState(null); /* 消息操作条「已复制」反馈（按 item.key） */
  const scrollRef = React.useRef(null);
  const fileRef = React.useRef(null);
  /* 自动滚动信号 = 条数 + 末条文本长度：流式 chunk 并入末条（appendText 合并）时
   * items.length 不变，只盯条数会长回复流式期间不滚动（评审修复） */
  const lastIt = client.items[client.items.length - 1];
  const scrollSig = client.items.length + ":" + (lastIt && lastIt.text ? lastIt.text.length : 0);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollSig]);
  /* usage/历史两浮层的外点与 Esc 收回：pointerdown 早于按钮 click，命中自身
   * 控件（closest 命中）时忽略——开关按钮自身的切换逻辑不受影响；点控制行
   * 其他按钮（新对话/分叉/下拉）同样收回浮层。 */
  React.useEffect(() => {
    if (!usageOpen && !histOpen) return undefined;
    const onDown = (ev) => {
      const t = ev.target;
      if (t && typeof t.closest === "function"
        && (t.closest(".pw-acp-usage") || t.closest(".pw-acp-pop")
          || t.closest(".pw-acp-hist-btn") || t.closest(".pw-acp-hist"))) return;
      setUsageOpen(false);
      setHistOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") { setUsageOpen(false); setHistOpen(false); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [usageOpen, histOpen]);
  /* configOptions 里的三个 select 数据源（kimi 0.36 实测：model/thinking/mode） */
  const coOf = (id) => (client.configOptions || []).find((o) => o && o.id === id) || null;
  const modeCo = coOf("mode"),
    modelCo = coOf("model"),
    thinkCo = coOf("thinking");
  const modeValue = (client.modes && client.modes.currentModeId) || (modeCo && modeCo.currentValue) || "";
  const modeOptions =
    client.modes && client.modes.availableModes && client.modes.availableModes.length
      ? client.modes.availableModes.map((m) => ({ value: m.id, name: m.name || m.id }))
      : (modeCo && modeCo.options) || [];
  const sel = (title, value, options, onChange) =>
    options && options.length
      ? e(
          "select",
          { className: "pw-acp-sel", title, value, onChange: (ev) => onChange(ev.target.value) },
          options.map((o) => e("option", { key: o.value, value: o.value }, o.name || o.value)),
        )
      : null;
  /* 上下文用量条（usage_update） */
  const pct = client.usage && client.usage.size ? Math.min(100, Math.round((client.usage.used / client.usage.size) * 100)) : 0;
  const kfmt = (n) => (n >= 1000 ? (n / 1024).toFixed(n >= 10240 ? 0 : 1) + "k" : String(n));
  /* 历史会话：kimi 的 session/list 不按 cwd 过滤（实测），前端过滤 */
  const histList = (client.sessions || [])
    .filter((s) => s && s.sessionId && s.cwd === client.cwd)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  /* 斜杠命令补全：draft 以 / 开头且不含空白时弹出；kimi 会把全部技能暴露成 /skill:*（实测 72 条），
   * 用子串模糊匹配（不区分大小写），弹窗可滚动、键盘全量导航 */
  const slashQ = draft.slice(1).toLowerCase();
  const slashAll =
    !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
      ? client.commands.filter((c) => c && c.name && (slashQ === "" || c.name.toLowerCase().indexOf(slashQ) >= 0))
      : [];
  const sIdx = Math.min(slashIdx, Math.max(0, slashAll.length - 1));
  /* 发送语义按状态分派（参考 Cursor 排队/引导交互，用户决策 2026-08）：
   * 空闲=直接发；运行中 Enter/后续消息=入队（轮次结束自动补发）；引导=cancel 后回发；
   * 断线=入队并立即触发重连，连回（hello/loaded）后自动补发 */
  const send = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    if (client.status === "dead") {
      client.enqueue(text, images);
      client.reconnect();
    } else if (client.status === "running" || client.status === "waiting") client.enqueue(text, images);
    else client.sendPrompt(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const steer = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    client.steerNow(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const pickSlash = (c) => {
    setDraft("/" + c.name + " ");
    setSlashIdx(0);
  };
  /* 读图入队（文件选择 / 剪贴板粘贴共用）：超 4 张静默丢弃，host 侧另有 8MB/张守卫 */
  const addImageFile = (f) => {
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result || "");
      const comma = url.indexOf(",");
      if (comma < 0) return;
      setImages((cur) => (cur.length >= 4 ? cur : cur.concat([{ url, data: url.slice(comma + 1), mimeType: f.type }]).slice(0, 4)));
    };
    rd.readAsDataURL(f);
  };
  const onFiles = (ev) => {
    Array.prototype.slice.call(ev.target.files || []).forEach(addImageFile);
    ev.target.value = "";
  };
  /* Cmd/Ctrl+V 直接粘贴截图/图片文件；纯文本剪贴板不拦截，走默认粘贴 */
  const onPaste = (ev) => {
    const cd = ev.clipboardData;
    if (!cd) return;
    const items = Array.prototype.slice.call(cd.items || []).filter((it) => it.kind === "file" && /^image\//.test(it.type));
    if (!items.length) return;
    ev.preventDefault();
    items.forEach((it) => addImageFile(it.getAsFile()));
  };
  const imageCap = !!(client.capabilities && client.capabilities.promptCapabilities && client.capabilities.promptCapabilities.image);
  /* 消息悬停操作条：只有复制（用户与 AI 消息同款）。已复制反馈按 item.key 记 */
  const copyText = (t) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) { /* 忽略 */ }
    ta.remove();
    return Promise.resolve();
  };
  const copyMsg = (it) => {
    copyText(it.text || "");
    setCopiedKey(it.key);
    setTimeout(() => setCopiedKey((k) => (k === it.key ? null : k)), 1200);
  };
  const msgActs = (it) =>
    e(
      "div",
      { className: "pw-acp-acts" },
      e(
        "button",
        { className: "pw-acp-act" + (copiedKey === it.key ? " ok" : ""), title: "复制内容", onClick: () => copyMsg(it) },
        copiedKey === it.key ? CheckIcon(11) : CopyIcon(11),
        copiedKey === it.key ? "已复制" : "复制",
      ),
    );
  /* 顶部控制条已按用户决策移除（2026-08）：头条干扰阅读输出，名字/状态与 tab 重复。
   * 布局：会话操作（＋新增/历史/分叉）在输入区图片钮左方；模式（左）与模型/思考/上下文（右）
   * 在输入区下沿控制行；上下文为紧凑指示器，点击展开明细浮层（主对话同款交互）。 */
  return e(
    "div",
    { className: "pw-acp" },
    client.status === "dead"
      ? e(
          "div",
          { className: "pw-acp-dead" },
          e(
            "span",
            { className: "pw-acp-dead-text" },
            client.reconnecting ? "连接已断开，正在自动重连（第 " + client.reconnecting + " 次）…" : client.fatal || "agent 进程已退出 / 连接已断开",
          ),
          e("button", { className: "pw-btn-plain", onClick: () => client.reconnect() }, "立即重连"),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-stream", ref: scrollRef },
      client.items.map((it) =>
        it.kind === "tool"
          ? e(
              "div",
              { key: it.key, className: "pw-acp-tool st-" + it.status, title: it.arg || it.title },
              e("span", { className: "pw-acp-tool-status" }, TOOL_STATUS[it.status] || it.status),
              e("span", { className: "pw-acp-tool-title" }, it.title),
              /* kimi 的 Bash 类标题是 "Running: <命令>"，与提取的 arg 重复——标题已含 arg 就不再重复显示 */
              it.arg && it.title.indexOf(it.arg) < 0 ? e("span", { className: "pw-acp-tool-arg" }, shortArg(it.arg)) : null,
              it.output
                ? e(
                    "details",
                    { className: "pw-acp-tool-out" },
                    e("summary", null, "输出"),
                    e("pre", null, it.output.length > 2000 ? it.output.slice(0, 2000) + "\n…（截断）" : it.output),
                  )
                : null,
            )
          : it.kind === "plan"
            ? e("pre", { key: it.key, className: "pw-acp-plan" }, it.text)
            : it.kind === "note"
              ? e("div", { key: it.key, className: "pw-acp-note" }, it.text)
              : it.kind === "error"
                ? e("div", { key: it.key, className: "pw-acp-error" }, it.text)
                : it.kind === "agent"
                  ? /* agent 正文按 markdown 渲染（复用预览栏渲染器；user 回声/think 保持纯文本）。
                     * 流式中途的未闭合围栏/半行语法由渲染器自然降级为原文，下一 chunk 到来即自愈 */
                  e(
                    "div",
                    { key: it.key, className: "pw-acp-msgw agent" },
                    e("div", { className: "pw-acp-msg agent pw-acp-md" }, renderMarkdown(stripCompactNotice(it.text), null, client.cwd)),
                    msgActs(it),
                  )
                  : it.kind === "user"
                    ? e(
                        "div",
                        { key: it.key, className: "pw-acp-msgw user" },
                        e(
                          "div",
                          { className: "pw-acp-msg user" },
                          it.images && it.images.length
                            ? e(
                                "span",
                                { className: "pw-acp-imgs" },
                                it.images.map((im, i) => e("img", { key: i, className: "pw-acp-thumb", src: im.url })),
                              )
                            : null,
                          it.text,
                        ),
                        msgActs(it),
                      )
                    : /* thought 等其余条目保持裸气泡（无操作条） */
                      e("div", { key: it.key, className: "pw-acp-msg " + it.kind }, it.text),
      ),
      client.perm
        ? e(
            "div",
            { className: "pw-acp-perm" },
            e("div", { className: "pw-acp-perm-title" }, client.perm.title),
            e(
              "div",
              { className: "pw-acp-perm-opts" },
              (client.perm.options || []).map((o) =>
                e(
                  "button",
                  {
                    key: o.optionId || o.id || o.name,
                    className: "pw-btn-plain",
                    onClick: () => client.answerPermission(client.perm.requestId, o.optionId || o.id || o.name),
                  },
                  o.name || o.optionId || o.id,
                ),
              ),
            ),
          )
        : null,
    ),
    images.length
      ? e(
          "div",
          { className: "pw-acp-chips" },
          images.map((im, i) =>
            e(
              "span",
              { key: i, className: "pw-acp-chip" },
              e("img", { src: im.url }),
              e(
                "span",
                { className: "pw-acp-chip-x", title: "移除", onClick: () => setImages((cur) => cur.filter((_, j) => j !== i)) },
                "×",
              ),
            ),
          ),
        )
      : null,
    histOpen
      ? e(
          "div",
          { className: "pw-acp-hist" },
          client.historyBusy
            ? e("div", { className: "pw-hint" }, "加载中…")
            : histList.length
              ? histList.map((s) =>
                  e(
                    "button",
                    {
                      key: s.sessionId,
                      className: "pw-acp-hist-row" + (s.sessionId === client.sessionId ? " cur" : ""),
                      title: s.sessionId,
                      onClick: () => {
                        setHistOpen(false);
                        client.loadSession(s.sessionId);
                      },
                    },
                    e("span", { className: "pw-acp-hist-title" }, s.title || "(无标题)"),
                    e("span", { className: "pw-acp-hist-time" }, relTime(Date.parse(s.updatedAt || "") || 0)),
                    /* 删除：两击确认；当前会话不显示（成功帧 session_deleted 会把行移除） */
                    s.sessionId !== client.sessionId
                      ? e(
                          "span",
                          {
                            className: "pw-acp-hist-del" + (delId === s.sessionId ? " confirm" : ""),
                            title: delId === s.sessionId ? "再次点击确认删除" : "删除该会话",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              if (delId === s.sessionId) {
                                setDelId(null);
                                client.deleteSession(s.sessionId);
                              } else {
                                setDelId(s.sessionId);
                              }
                            },
                          },
                          delId === s.sessionId ? "删?" : "×",
                        )
                      : null,
                  ),
                )
              : e("div", { className: "pw-hint" }, "该目录下没有历史会话"),
        )
      : null,
    /* 已排队面板（参考截图交互）：左侧计数，右侧"移回输入框"（取回最近一条到草稿） */
    client.queue.length
      ? e(
          "div",
          { className: "pw-acp-queue" },
          e(
            "div",
            { className: "pw-acp-queue-head" },
            e("span", { className: "pw-acp-queue-n" }, "已排队 · " + client.queue.length),
            e(
              "button",
              {
                className: "pw-acp-hbtn",
                title: "把最近一条排队消息移回输入框",
                onClick: () => {
                  const m = client.popQueue();
                  if (m) {
                    setDraft(m.text);
                    setImages(m.images || []);
                  }
                },
              },
              "移回输入框",
            ),
          ),
          client.queue.map((m, i) =>
            e("div", { key: i, className: "pw-acp-queue-item", title: m.text }, (m.images && m.images.length ? "[图×" + m.images.length + "] " : "") + (m.text || "(空)")),
          ),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-composer" },
      slashAll.length
        ? e(
            "div",
            { className: "pw-acp-slash" },
            slashAll.map((c, i) =>
              e(
                "button",
                {
                  key: c.name,
                  className: "pw-acp-slash-row" + (i === sIdx ? " cur" : ""),
                  /* 键盘导航时让选中行滚进可视区 */
                  ref: i === sIdx ? (el) => el && el.scrollIntoView({ block: "nearest" }) : null,
                  onMouseDown: (ev) => {
                    ev.preventDefault();
                    pickSlash(c);
                  },
                },
                e("span", { className: "pw-acp-slash-name" }, "/" + c.name),
                e("span", { className: "pw-acp-slash-desc", title: c.description || "" }, String(c.description || "").split("\n")[0]),
              ),
            ),
          )
        : !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
          ? e(
              "div",
              { className: "pw-acp-slash" },
              e("div", { className: "pw-acp-slash-empty" }, client.commands.length ? "无匹配命令" : "命令加载中…"),
            )
          : null,
      /* 输入框独立成框（用户决策）：运行中也可输入——占位提示 引导/排队 双出口 */
      e("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: onFiles }),
      e("input", {
        value: draft,
        placeholder:
          client.status === "running" || client.status === "waiting"
            ? "立即引导 / 排队后续消息…"
            : client.status === "dead"
              ? "连接已断开——输入后回车将自动重连并发送"
              : imageCap
                ? "向 Kimi Code 发送指令…（/ 命令，可粘贴图片）"
                : "向 Kimi Code 发送指令…（/ 命令）",
        onChange: (ev) => {
          setDraft(ev.target.value);
          setSlashIdx(0);
          setSlashOff(false);
        },
        onPaste: imageCap ? onPaste : undefined,
        onKeyDown: (ev) => {
          if (ev.isComposing) return;
          if (slashAll.length && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
            ev.preventDefault();
            setSlashIdx((i) => (i + (ev.key === "ArrowDown" ? 1 : -1) + slashAll.length) % slashAll.length);
          } else if (slashAll.length && (ev.key === "Tab" || ev.key === "Enter")) {
            ev.preventDefault();
            pickSlash(slashAll[sIdx]);
          } else if (ev.key === "Escape") {
            setSlashOff(true);
          } else if (ev.key === "Enter") {
            send();
          }
        },
        }),
      client.status === "running" || client.status === "waiting"
        ? [
            e(
              "button",
              { key: "steer", className: "pw-acp-mini", title: "引导：打断当前任务，立即处理这条消息", disabled: !draft.trim() && !images.length, onClick: steer },
              "引导",
            ),
            e(
              "button",
              { key: "queue", className: "pw-acp-mini", title: "后续消息：加入队列，当前任务结束后自动发送", disabled: !draft.trim() && !images.length, onClick: send },
              "后续消息",
            ),
          ]
        : e("button", { className: "pw-btn-primary", disabled: !draft.trim() && !images.length, onClick: send }, "发送"),
    ),
    /* 控制行（框外下方）：会话操作（新对话/历史/分叉/图片）+ 模式（左）；模型/思考/上下文/停止（右）。
     * 浮层数据只有 usage_update 的 {used,size}——ACP 不提供系统提示词/工具分项，明细从简 */
    e(
      "div",
      { className: "pw-acp-controls" },
      e(
        "button",
        { className: "pw-acp-hbtn", title: "新对话（同目录开一个空白 Kimi 会话）", disabled: client.busy(), onClick: () => client.newSession() },
        "新对话",
      ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-hist-btn" + (histOpen ? " on" : ""),
            title: "历史会话（该目录下的 Kimi 会话，可恢复）",
            onClick: () => {
              const v = !histOpen;
              setHistOpen(v);
              /* 替换式弹出：开历史收 usage（外点监听护住开关按钮，
               * 互斥只能放在按钮自己的 click 里） */
              if (v) { client.listSessions(); setUsageOpen(false); }
            },
          },
          "历史",
        ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn",
            title: "分叉当前会话（复制出带完整上下文的副本，原会话保留）",
            disabled: client.busy(),
            onClick: () => client.forkSession(),
          },
          GitBranchIcon(11),
        ),
        imageCap
          ? e(
              "button",
              { className: "pw-acp-attach", title: "附加图片（最多 4 张）", onClick: () => fileRef.current && fileRef.current.click() },
              ImageIcon(14),
            )
          : null,
        sel("模式（default/plan/auto/yolo）", modeValue, modeOptions, (v) => client.setMode(v)),
        e("span", { className: "pw-bpanel-flex" }),
        modelCo ? sel("模型", modelCo.currentValue, modelCo.options, (v) => client.setConfig("model", v)) : null,
        thinkCo ? sel("Thinking 档位", thinkCo.currentValue, thinkCo.options, (v) => client.setConfig("thinking", v)) : null,
        /* 压缩上下文：发送 kimi 内建 /compact（已实测暴露在 available_commands）。
         * 参照 pi-web ChatInput：压缩中图标换实心停止块、点击=中止（onCompact/onAbort 切换） */
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn pw-acp-compact" + (client.compacting ? " ing" : ""),
            title: client.compacting ? "中止压缩" : "压缩上下文（发送 /compact：总结历史、释放上下文窗口，原会话内容随之精简）",
            disabled: client.busy() && !client.compacting,
            onClick: () => (client.compacting ? client.cancel() : client.sendPrompt("/compact")),
          },
          client.compacting ? StopIcon(11) : MinimizeIcon(11),
          client.compacting ? "压缩中…" : "压缩",
        ),
        client.usage && client.usage.size
        ? e(
            "button",
            {
              className: "pw-acp-usage" + (pct >= 80 ? " hot" : "") + (usageOpen ? " on" : ""),
              title: "上下文占用，点击展开明细",
              onClick: () => {
                /* 替换式弹出：开 usage 收历史（外点监听护住开关按钮，
                 * 互斥只能放在按钮自己的 click 里） */
                const v = !usageOpen;
                setUsageOpen(v);
                if (v) setHistOpen(false);
              },
            },
            /* 圆环占用指示（对齐 Kimi 原生应用）：pathLength 归一到 100，
             * dasharray 第一段即百分比；≥80% 走 error 色（沿用原 hot 语义） */
            e(
              "svg",
              { className: "pw-acp-usage-ring", viewBox: "0 0 20 20", "aria-hidden": "true" },
              e("circle", { className: "pw-acp-usage-ring-track", cx: 10, cy: 10, r: 8 }),
              e("circle", {
                className: "pw-acp-usage-ring-arc" + (pct >= 80 ? " hot" : ""),
                cx: 10, cy: 10, r: 8,
                pathLength: 100,
                strokeDasharray: pct + " " + (100 - pct),
                transform: "rotate(-90 10 10)",
              }),
            ),
            e("span", { className: "pw-acp-usage-text" }, pct + "%"),
          )
        : null,
      /* 红色停止（用户决策：不叫取消；运行/等待中出现，位于控制行右端） */
      client.status === "running" || client.status === "waiting"
        ? e("button", { className: "pw-acp-stop", title: "停止当前任务", onClick: () => client.cancel() }, "■ 停止")
        : null,
      usageOpen && client.usage && client.usage.size
        ? e(
            "div",
            { className: "pw-acp-pop" },
            e("div", { className: "pw-acp-pop-title" }, "上下文已用 " + pct + "%"),
            e(
              "div",
              { className: "pw-acp-pop-bar" },
              e("div", { className: "pw-acp-usage-fill" + (pct >= 80 ? " hot" : ""), style: { width: pct + "%" } }),
            ),
            e("div", { className: "pw-acp-pop-num" }, kfmt(client.usage.used) + " / " + kfmt(client.usage.size) + " tokens"),
          )
        : null,
      ),
  );
}
