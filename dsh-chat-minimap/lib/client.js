/**
 * dsh-chat-minimap — a faithful pi-web ChatMinimap replica for the DeepSeek
 * Harness web GUI.
 *
 * A 36px rail floats over the right edge of the conversation scrollport, one
 * 8px node per turn (user message). Hovering pops out a 320px outline panel
 * to the left: turn number, user-message summary, and the h1–h3 outline of
 * each assistant answer. Clicking a node / answer / heading smooth-scrolls
 * the conversation to that exact spot; the rail supports press-drag scrubbing.
 *
 * Data comes from the session's ConversationSnapshot (chat view nodes); DOM
 * anchoring uses the chat view's own [data-conversation-scroll] scrollport
 * and per-row [data-chat-anchor-key] markers.
 *
 * Behavior ported from pi-web components/ChatMinimap.tsx (v0.8.8):
 * MAX_NODE_GAP / MINIMAP_PADDING layout, 30% focus-line active node,
 * 1.6s navigation lock, 250ms preview hide delay, hit-radius tolerance,
 * pending navigation across history loading.
 */
window.__ModuleLoader__.load({
  id: 'dsh-chat-minimap',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require('react');
    const h = React.createElement;
    const {
      useState, useEffect, useRef, useMemo, useCallback,
      useSyncExternalStore,
    } = React;

    const MINIMAP_WIDTH = 36;
    const MAX_NODE_GAP = 50;
    const MINIMAP_PADDING = 12;
    const PREVIEW_HIDE_DELAY = 250;
    const NAVIGATION_ACTIVE_LOCK_MS = 1600;
    const MAX_PENDING_ATTEMPTS = 12;

    /* ------------------------------------------------------------------ */
    /* Styles (ported from pi-web ChatMinimap.module.css, dshm- scoped)    */
    /* ------------------------------------------------------------------ */

    const STYLE_ID = 'dsh-chat-minimap-styles';
    const CSS = `
.dshm-root {
  --dshm-bg: #ffffff;
  --dshm-bg-panel: #f5f5f5;
  --dshm-border: #e0e0e0;
  --dshm-text: #1a1a1a;
  --dshm-text-muted: #6b7280;
  --dshm-text-dim: #9ca3af;
  --dshm-bg-subtle: rgba(0,0,0,0.03);
  --dshm-font-mono: var(--ds-font-family-code, ui-monospace, 'SF Mono', 'JetBrains Mono', Consolas, monospace);
  position: fixed;
  z-index: 60;
  pointer-events: none;
}
body[data-ds-dark-theme] .dshm-root {
  --dshm-bg: #1a1a1a;
  --dshm-bg-panel: #242424;
  --dshm-border: #3a3a3a;
  --dshm-text: #e8e8e8;
  --dshm-text-muted: #9ca3af;
  --dshm-text-dim: #6b7280;
  --dshm-bg-subtle: rgba(255,255,255,0.04);
}
.dshm-rail {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: pointer;
  user-select: none;
  overflow: visible;
  pointer-events: auto;
}
.dshm-track {
  position: absolute;
  left: 50%;
  width: 1px;
  background: var(--dshm-border);
  transform: translateX(-50%);
  z-index: 0;
}
.dshm-node {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}
.dshm-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  transition: transform 0.1s, background 0.1s;
}
.dshm-preview {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 100%;
  z-index: 100;
  width: 320px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--dshm-border) transparent;
  background: var(--dshm-bg);
  border-left: 1px solid color-mix(in srgb, var(--dshm-border) 82%, transparent);
  box-shadow: -10px 0 26px rgba(0, 0, 0, 0.07);
  pointer-events: auto;
  cursor: default;
  user-select: text;
}
.dshm-turn {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  border-bottom: 1px solid color-mix(in srgb, var(--dshm-border) 68%, transparent);
  transition: background 120ms ease, box-shadow 120ms ease;
}
.dshm-turn[data-located="true"] {
  background: color-mix(in srgb, var(--dshm-text) 4%, var(--dshm-bg));
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--dshm-text-muted) 70%, transparent);
}
.dshm-number {
  grid-column: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 34px;
  padding-top: 7px;
  color: var(--dshm-text-dim);
  font-family: var(--dshm-font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}
.dshm-turn[data-located="true"] .dshm-number { color: var(--dshm-text-muted); }
.dshm-content { grid-column: 2; min-width: 0; }
.dshm-user {
  display: block;
  width: calc(100% + 34px);
  min-height: 32px;
  max-height: 86px;
  margin: 0 0 0 -34px;
  padding: 7px 10px 7px 40px;
  border: 0;
  background: transparent;
  color: var(--dshm-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: background 100ms ease;
}
.dshm-user-text {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
.dshm-user:hover { background: color-mix(in srgb, var(--dshm-text) 6%, transparent); }
.dshm-assistant {
  position: relative;
  display: block;
  border-top: 1px solid color-mix(in srgb, var(--dshm-border) 52%, transparent);
}
.dshm-assistant-jump {
  position: absolute;
  top: 0;
  left: -29px;
  z-index: 2;
  width: 24px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dshm-text-dim);
  font-family: var(--dshm-font-mono);
  font-size: 10px;
  font-weight: 600;
  line-height: 26px;
  text-align: center;
  cursor: pointer;
  transition: color 100ms ease, background 100ms ease;
}
.dshm-assistant-jump:hover { color: var(--dshm-text); background: var(--dshm-bg-subtle); }
.dshm-outline { display: grid; min-width: 0; }
.dshm-heading, .dshm-paragraph {
  display: block;
  width: calc(100% + 34px);
  min-height: 26px;
  margin-left: -34px;
  padding: 4px 10px 4px 40px;
  border: 0;
  background: transparent;
  font-family: inherit;
  line-height: 18px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
}
.dshm-heading:hover, .dshm-paragraph:hover {
  background: color-mix(in srgb, var(--dshm-text) 6%, transparent);
  color: var(--dshm-text);
}
.dshm-heading[data-level="1"] {
  min-height: 32px;
  padding-top: 7px;
  padding-bottom: 7px;
  color: var(--dshm-text);
  font-size: 14px;
  font-weight: 600;
}
.dshm-heading[data-level="2"] {
  min-height: 28px;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-left: 50px;
  color: color-mix(in srgb, var(--dshm-text) 88%, var(--dshm-text-muted));
  font-size: 12px;
  font-weight: 500;
}
.dshm-heading[data-level="3"] {
  padding-left: 60px;
  color: var(--dshm-text-muted);
  font-size: 11px;
  font-weight: 400;
}
.dshm-paragraph { color: var(--dshm-text-muted); font-size: 14px; }
.dshm-assistant:has(.dshm-heading[data-level="1"]:first-child) .dshm-assistant-jump { height: 32px; line-height: 32px; }
.dshm-assistant:has(.dshm-heading[data-level="2"]:first-child) .dshm-assistant-jump { height: 28px; line-height: 28px; }
.dshm-user:focus-visible, .dshm-heading:focus-visible, .dshm-paragraph:focus-visible {
  outline: 0;
  background: color-mix(in srgb, var(--dshm-text) 6%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--dshm-text-muted) 65%, transparent);
}
`;

    // Inject the stylesheet synchronously at factory scope (the module loader
    // auto-tags styles created during factory evaluation via data-plugin and
    // owns their HMR lifecycle — the pattern used by shipped plugins).
    (function adoptStyles() {
      if (typeof document === 'undefined') return;
      if (document.getElementById(STYLE_ID)) return;
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.dataset.plugin = 'dsh-chat-minimap';
      el.dataset.pluginCss = 'dsh-chat-minimap/client.css';
      el.textContent = CSS;
      document.head.appendChild(el);
    })();

    /* ------------------------------------------------------------------ */
    /* Snapshot -> turns                                                    */
    /* ------------------------------------------------------------------ */

    function contentText(content) {
      if (typeof content === 'string') return content.trim();
      if (!Array.isArray(content)) return '';
      return content
        .filter((b) => b && (b.type === 'text' || b.kind === 'text') && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }

    function assistantMarkdown(data) {
      const blocks = data && Array.isArray(data.blocks) ? data.blocks : [];
      return blocks
        .filter((b) => b && b.kind === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n\n')
        .trim();
    }

    /** Build turn list from the chat view snapshot: user/steering opens a turn,
     *  assistant-step text lands in the current turn. ChatSnapshot.nodes is a
     *  live per-key store; render order comes from chat.order. */
    function buildTurns(snapshot) {
      const chat = snapshot && snapshot.chat;
      const order = chat && Array.isArray(chat.order) ? chat.order : [];
      const store = chat && chat.nodes;
      if (!store || typeof store.get !== 'function') return [];
      const turns = [];
      let current = null;
      for (const key of order) {
        const node = store.get(key);
        if (!node || node.visibility === 'hidden') continue;
        if (node.kind === 'user' || node.kind === 'steering') {
          const text = contentText(node.data && node.data.content);
          current = { key: node.key, userText: text, assistants: [] };
          turns.push(current);
          continue;
        }
        if (node.kind === 'assistant-step') {
          if (!current) continue;
          const md = assistantMarkdown(node.data);
          if (md) current.assistants.push({ key: node.key, markdown: md });
        }
      }
      // Streaming partial answer joins the last turn.
      const partial = snapshot && snapshot.partial;
      if (partial && current) {
        const md = assistantMarkdown(partial);
        if (md) current.assistants.push({ key: '__partial__', markdown: md });
      }
      return turns;
    }

    /* ------------------------------------------------------------------ */
    /* Markdown outline (remark-free port of remarkPreviewOutline):         */
    /* keep h1-h3 in order; fall back to the first paragraph.               */
    /* ------------------------------------------------------------------ */

    function stripInline(md) {
      return md
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .trim();
    }

    function extractOutline(markdown) {
      const lines = markdown.split('\n');
      const headings = [];
      let inFence = false;
      let firstParagraph = null;
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = /^(#{1,6})\s+(.+)$/.exec(line);
        if (m) {
          if (m[1].length <= 3) headings.push({ level: m[1].length, text: stripInline(m[2]) });
          continue;
        }
        if (firstParagraph === null && line.trim().length > 0 && !/^\s*([-*+]|\d+\.)\s/.test(line) && !/^\s*>/.test(line) && !/^\s*\|/.test(line)) {
          firstParagraph = stripInline(line);
        }
      }
      if (headings.length > 0) return { headings, paragraph: null };
      return { headings: [], paragraph: firstParagraph };
    }

    /* ------------------------------------------------------------------ */
    /* Layout (verbatim port)                                               */
    /* ------------------------------------------------------------------ */

    function layoutNodes(count, minimapHeight) {
      if (count === 0) return { topRatios: [], gap: MAX_NODE_GAP, fillsHeight: false };
      const height = Math.max(1, minimapHeight);
      const usableHeight = Math.max(0, height - MINIMAP_PADDING * 2);
      if (count === 1) {
        return { topRatios: [MINIMAP_PADDING / height], gap: MAX_NODE_GAP, fillsHeight: false };
      }
      const naturalGap = usableHeight / (count - 1);
      const gap = Math.min(MAX_NODE_GAP, naturalGap);
      const topRatios = [];
      for (let i = 0; i < count; i++) topRatios.push((MINIMAP_PADDING + i * gap) / height);
      return { topRatios, gap, fillsHeight: naturalGap <= MAX_NODE_GAP };
    }

    /* ------------------------------------------------------------------ */
    /* React helpers                                                        */
    /* ------------------------------------------------------------------ */

    function useObservable(obs) {
      const subscribe = useCallback(
        (fn) => (obs && typeof obs.subscribe === 'function' ? obs.subscribe(fn) : () => {}),
        [obs],
      );
      const getSnapshot = useCallback(() => (obs ? obs.getSnapshot() : undefined), [obs]);
      return useSyncExternalStore(subscribe, getSnapshot);
    }

    function findScrollport() {
      const els = Array.from(document.querySelectorAll('[data-conversation-scroll]'));
      return els.find((el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0) || els[0] || null;
    }

    function findNodeElement(scrollEl, key) {
      if (!scrollEl || !key || key === '__partial__') return null;
      // Keys look like "13:input-message<uuid>" — safe inside a quoted
      // attribute string with only quotes/backslashes escaped (CSS.escape is
      // for identifiers and mangles the leading digit).
      try {
        return scrollEl.querySelector('[data-chat-anchor-key="' + String(key).replace(/["\\]/g, '\\$&') + '"]');
      } catch {
        return null;
      }
    }

    // The chat content column carries data-chat-flow (max-width:
    // var(--dsh-chat-content-width), centered).
    function findContentColumn(scrollEl) {
      return scrollEl.querySelector('[data-chat-flow]');
    }

    // Restore the element that previously yielded the rail gutter.
    function restoreGutter(ref) {
      const el = ref.current;
      if (el) { el.style.paddingRight = ''; ref.current = null; }
    }

    /* ------------------------------------------------------------------ */
    /* The overlay component                                                */
    /* ------------------------------------------------------------------ */

    function MinimapOverlay(props) {
      const sessions = props.sessions;

      const listState = useObservable(sessions.list);
      const sessionId = listState && listState.current;

      const face = useMemo(() => {
        if (!sessionId) return undefined;
        try {
          const scope = sessions.scope(sessionId);
          return scope ? sessions.sessionOf(scope) : undefined;
        } catch {
          return undefined;
        }
      }, [sessions, sessionId]);
      const snapshot = useObservable(face);

      const turns = useMemo(() => buildTurns(snapshot), [snapshot]);


      const [visible, setVisible] = useState(false);
      const [frame, setFrame] = useState(null); // {top, left, height}
      const [nodeCount, setNodeCount] = useState(0);
      const [activeIndex, setActiveIndex] = useState(null);
      const [minimapHeight, setMinimapHeight] = useState(600);
      const [minimapHovered, setMinimapHovered] = useState(false);
      const [mouseYRatio, setMouseYRatio] = useState(null);

      const draggingRef = useRef(false);
      const dragCleanupRef = useRef(null);
      const containerRef = useRef(null);
      const gutterElRef = useRef(null);
      const gutterPadRef = useRef(0);
      // Details-column yield: while the right details panel is open the rail
      // hides and the gutter padding is restored. ctx.layout exposes verbs
      // only (no readable state), so openness is read off the AppFrame root's
      // data-details-collapsed attribute (set iff the column solves to 0).
      // Platform-private surface: packages/client/ui-layout AppFrame.tsx —
      // re-check on platform upgrades.
      const detailsOpenRef = useRef(false);
      const previewBoxRef = useRef(null);
      const previewItemRefs = useRef(new Map());
      const previewHideTimerRef = useRef(null);
      const activeNodeLockRef = useRef(null);
      const pendingNavigationRef = useRef(null);
      const pendingAttemptsRef = useRef(0);
      const measureThrottleRef = useRef(null);

      // turn.key -> measured absolute scrollTop (null while not rendered)
      const turnTopsRef = useRef([]);
      const layoutRef = useRef({ topRatios: [], gap: MAX_NODE_GAP, fillsHeight: false });
      const turnsRef = useRef(turns);
      turnsRef.current = turns;

      const layout = useMemo(() => layoutNodes(nodeCount, minimapHeight), [nodeCount, minimapHeight]);
      layoutRef.current = layout;

      const lockActiveNode = useCallback((index) => {
        activeNodeLockRef.current = { index, until: Date.now() + NAVIGATION_ACTIVE_LOCK_MS };
        setActiveIndex(index);
      }, []);

      const syncActiveNode = useCallback((scrollEl) => {
        const lock = activeNodeLockRef.current;
        if (lock && Date.now() < lock.until) {
          setActiveIndex(lock.index);
          return;
        }
        activeNodeLockRef.current = null;
        const tops = turnTopsRef.current;
        const measured = [];
        for (let i = 0; i < tops.length; i++) {
          if (tops[i] !== null && tops[i] !== undefined) measured.push(i);
        }
        if (measured.length === 0) {
          setActiveIndex(null);
          return;
        }
        const focusTop = scrollEl.scrollTop + scrollEl.clientHeight * 0.3;
        let best = measured[0];
        for (const i of measured) {
          if (Math.abs(tops[i] - focusTop) < Math.abs(tops[best] - focusTop)) best = i;
        }
        setActiveIndex(best);
      }, []);

      const measureFrame = useCallback(() => {
        const scrollEl = findScrollport();
        if (!scrollEl) return null;
        const rect = scrollEl.getBoundingClientRect();
        // The scrollport runs full-height behind the floating composer; cap
        // the rail's bottom at the composer seat's top edge so the rail
        // stays flush with the composer's top instead of crossing into it.
        const seat = scrollEl.querySelector('[data-composer-seat]');
        const seatTop = seat ? seat.getBoundingClientRect().top : rect.bottom;
        const bottom = Math.min(rect.bottom, Math.max(rect.top, seatTop));
        // Dock the rail at the conversation column's right edge, flush with
        // the right sidebar's left edge. The bottom still stops at the
        // composer seat's top edge.
        const rightLimit = rect.right;
        let left = rightLimit - MINIMAP_WIDTH;
        // The rail must not cover the text column. The column is
        // width:100% + margin:0 auto, so a right margin cannot move it in the
        // uncapped (narrow) regime — padding-right on its parent list can, in
        // both regimes. The composer seat/card is a sibling of the session
        // view, NOT inside the padded list, so padding never moves it and the
        // solver cannot feed back on itself. Iterate a bounded fixpoint: grow
        // the list's right padding until the column's right edge sits exactly
        // MINIMAP_WIDTH left of the scrollport's right edge, then park the
        // rail in that gutter. Wide windows (capped centered column) usually
        // need no gutter at all and the solver converges to pad 0 there. The
        // centered/capped regime responds at half rate (centering), the
        // full-width regime at 1:1.
        const column = findContentColumn(scrollEl);
        // No turns → no rail → the content must not be displaced either.
        // Details open → the rail is hidden, so the gutter must release too
        // (otherwise the column yields width to an invisible rail).
        const padTarget = !detailsOpenRef.current && turnsRef.current.length > 0 && column && column.parentElement && column.parentElement !== scrollEl
          ? column.parentElement
          : null;
        if (gutterElRef.current && gutterElRef.current !== padTarget) {
          restoreGutter(gutterElRef);
          gutterPadRef.current = 0;
        }
        if (column && padTarget) {
          gutterElRef.current = padTarget;
          const maxW = parseFloat(getComputedStyle(column).maxWidth) || 748;
          let pad = gutterPadRef.current;
          for (let i = 0; i < 6; i++) {
            const over = column.getBoundingClientRect().right - (rightLimit - MINIMAP_WIDTH);
            if (Math.abs(over) <= 1 || (over < 0 && pad <= 0)) break;
            pad = Math.max(0, pad + over * (column.offsetWidth >= maxW - 1 ? 2 : 1));
            const value = pad > 0
              ? 'calc(var(--dsh-composer-side-clearance) + 16px + ' + Math.round(pad) + 'px)'
              : '';
            if (padTarget.style.paddingRight !== value) padTarget.style.paddingRight = value;
          }
          gutterPadRef.current = pad;
        } else {
          restoreGutter(gutterElRef);
          gutterPadRef.current = 0;
        }
        const next = {
          top: rect.top,
          left: left,
          height: bottom - rect.top,
        };
        setFrame((prev) => (
          prev && prev.top === next.top && prev.left === next.left && prev.height === next.height
            ? prev
            : next
        ));
        return scrollEl;
      }, []);

      const resolvePending = useCallback((scrollEl) => {
        const pending = pendingNavigationRef.current;
        if (!pending) return;
        // Keys, not indexes: history loading PREPENDS rows, which shifts
        // every turn index between the click and this resolution.
        const currentTurns = turnsRef.current;
        const nodeIndex = currentTurns.findIndex((t) => t.key === pending.turnKey);
        const turn = nodeIndex >= 0 ? currentTurns[nodeIndex] : null;
        if (!turn) { pendingNavigationRef.current = null; return; }
        const assistantIndex = pending.assistantKey === undefined
          ? -1
          : turn.assistants.findIndex((a) => a.key === pending.assistantKey);
        const containerRect = scrollEl.getBoundingClientRect();
        let targetEl = null;
        if (pending.target === 'user') {
          targetEl = findNodeElement(scrollEl, turn.key);
        } else if (pending.target === 'assistant') {
          const a = assistantIndex >= 0 ? turn.assistants[assistantIndex] : null;
          targetEl = a ? findNodeElement(scrollEl, a.key) : null;
        } else if (pending.target === 'heading') {
          const a = assistantIndex >= 0 ? turn.assistants[assistantIndex] : null;
          const aEl = a ? findNodeElement(scrollEl, a.key) : null;
          targetEl = aEl ? aEl.querySelectorAll('h1, h2, h3').item(pending.headingIndex) : null;
        }
        if (targetEl) {
          pendingNavigationRef.current = null;
          pendingAttemptsRef.current = 0;
          lockActiveNode(nodeIndex);
          const rect = targetEl.getBoundingClientRect();
          const top = rect.top - containerRect.top + scrollEl.scrollTop - scrollEl.clientHeight * 0.3;
          scrollEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          return;
        }
        // Target not rendered: walk history upward to trigger loading.
        pendingAttemptsRef.current += 1;
        if (pendingAttemptsRef.current > MAX_PENDING_ATTEMPTS) {
          pendingNavigationRef.current = null;
          pendingAttemptsRef.current = 0;
          return;
        }
        scrollEl.scrollTo({ top: 0, behavior: 'auto' });
      }, [lockActiveNode]);

      const measureNodes = useCallback(() => {
        if (measureThrottleRef.current) return;
        measureThrottleRef.current = setTimeout(() => {
          measureThrottleRef.current = null;
          const scrollEl = measureFrame();
          if (!scrollEl) {
            setVisible(false);
            return;
          }
          const containerRect = scrollEl.getBoundingClientRect();
          const currentTurns = turnsRef.current;
          const tops = currentTurns.map((turn) => {
            const el = findNodeElement(scrollEl, turn.key);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return r.top - containerRect.top + scrollEl.scrollTop;
          });
          turnTopsRef.current = tops;
          setNodeCount(currentTurns.length);
          setMinimapHeight((containerRef.current && containerRef.current.clientHeight) || 600);
          const nextVisible = scrollEl.scrollHeight - scrollEl.clientHeight > 20 && currentTurns.length > 0 && !detailsOpenRef.current;
          setVisible(nextVisible);
          syncActiveNode(scrollEl);
          resolvePending(scrollEl);
        }, 150);
      }, [measureFrame, resolvePending, syncActiveNode]);

      const updateScroll = useCallback(() => {
        const scrollEl = measureFrame();
        if (!scrollEl) { setVisible(false); return; }
        setVisible(scrollEl.scrollHeight - scrollEl.clientHeight > 20 && turnsRef.current.length > 0 && !detailsOpenRef.current);
        syncActiveNode(scrollEl);
      }, [measureFrame, syncActiveNode]);

      // Scroll listener (attached to whatever scrollport is live).
      useEffect(() => {
        let el = null;
        let ro = null;
        let seatEl = null;
        let cancelled = false;
        const attach = () => {
          if (cancelled) return;
          const next = findScrollport();
          const seat = next ? next.querySelector('[data-composer-seat]') : null;
          // Re-attach when the scrollport OR the composer seat is replaced
          // (phase switches swap the seat; a detached seat's RO never fires).
          if (next === el && seat === seatEl) return;
          if (el) el.removeEventListener('scroll', updateScroll);
          if (ro) ro.disconnect();
          el = next;
          seatEl = seat;
          ro = null;
          if (el) {
            el.addEventListener('scroll', updateScroll, { passive: true });
            ro = new ResizeObserver(() => { measureNodes(); updateScroll(); });
            ro.observe(el);
            if (el.firstElementChild) ro.observe(el.firstElementChild);
            // Composer growth (multi-line input) moves the seat's top edge;
            // observe it so the rail's bottom follows without a scroll.
            if (seatEl) ro.observe(seatEl);
            measureNodes();
            updateScroll();
          } else {
            setVisible(false);
          }
        };
        attach();
        const poll = setInterval(attach, 800);
        const onResize = () => { measureNodes(); updateScroll(); };
        window.addEventListener('resize', onResize);
        return () => {
          cancelled = true;
          clearInterval(poll);
          restoreGutter(gutterElRef);
          gutterPadRef.current = 0;
          window.removeEventListener('resize', onResize);
          if (el) el.removeEventListener('scroll', updateScroll);
          if (ro) ro.disconnect();
          if (measureThrottleRef.current) {
            clearTimeout(measureThrottleRef.current);
            measureThrottleRef.current = null;
          }
        };
      }, [measureNodes, updateScroll]);

      // Re-measure when the conversation changes.
      const turnSignature = useMemo(() => turns.map((t) => t.key).join('|'), [turns]);
      useEffect(() => {
        const timer = setTimeout(() => { measureNodes(); updateScroll(); }, 50);
        return () => clearTimeout(timer);
      }, [turnSignature, sessionId, measureNodes, updateScroll]);

      const scrollToTopOf = useCallback((el, behavior) => {
        const scrollEl = findScrollport();
        if (!scrollEl || !el) return;
        const containerRect = scrollEl.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const top = rect.top - containerRect.top + scrollEl.scrollTop - scrollEl.clientHeight * 0.3;
        scrollEl.scrollTo({ top: Math.max(0, top), behavior });
      }, []);

      const scrollToNode = useCallback((index, behavior) => {
        const scrollEl = findScrollport();
        if (!scrollEl) return;
        lockActiveNode(index);
        const turn = turnsRef.current[index];
        const el = turn ? findNodeElement(scrollEl, turn.key) : null;
        if (!el) {
          if (!turn) return;
          pendingNavigationRef.current = { turnKey: turn.key, target: 'user' };
          pendingAttemptsRef.current = 0;
          scrollEl.scrollTo({ top: 0, behavior: 'auto' });
          setTimeout(() => measureNodes(), 250);
          return;
        }
        scrollToTopOf(el, behavior);
      }, [lockActiveNode, measureNodes, scrollToTopOf]);

      const scrollToAssistant = useCallback((nodeIndex, assistantIndex) => {
        const scrollEl = findScrollport();
        if (!scrollEl) return;
        const turn = turnsRef.current[nodeIndex];
        const a = turn && turn.assistants[assistantIndex];
        const el = a ? findNodeElement(scrollEl, a.key) : null;
        if (!el) {
          if (!a) return;
          pendingNavigationRef.current = { turnKey: turn.key, assistantKey: a.key, target: 'assistant' };
          pendingAttemptsRef.current = 0;
          scrollEl.scrollTo({ top: 0, behavior: 'auto' });
          setTimeout(() => measureNodes(), 250);
          return;
        }
        lockActiveNode(nodeIndex);
        scrollToTopOf(el, 'smooth');
      }, [lockActiveNode, measureNodes, scrollToTopOf]);

      const scrollToHeading = useCallback((nodeIndex, assistantIndex, headingIndex) => {
        const scrollEl = findScrollport();
        if (!scrollEl) return;
        const turn = turnsRef.current[nodeIndex];
        const a = turn && turn.assistants[assistantIndex];
        const aEl = a ? findNodeElement(scrollEl, a.key) : null;
        if (!aEl) {
          if (!a) return;
          pendingNavigationRef.current = { turnKey: turn.key, assistantKey: a.key, headingIndex, target: 'heading' };
          pendingAttemptsRef.current = 0;
          scrollEl.scrollTo({ top: 0, behavior: 'auto' });
          setTimeout(() => measureNodes(), 250);
          return;
        }
        const heading = aEl.querySelectorAll('h1, h2, h3').item(headingIndex);
        if (!heading) return;
        lockActiveNode(nodeIndex);
        scrollToTopOf(heading, 'smooth');
      }, [lockActiveNode, measureNodes, scrollToTopOf]);

      const findNearestNode = useCallback((ratio) => {
        const { topRatios, gap, fillsHeight } = layoutRef.current;
        const height = containerRef.current ? containerRef.current.clientHeight : 0;
        if (topRatios.length === 0 || height <= 0) return null;
        const pointerY = Math.max(0, Math.min(height, ratio * height));
        const firstNodeY = topRatios[0] * height;
        const rawIndex = gap > 0 ? Math.round((pointerY - firstNodeY) / gap) : 0;
        const index = Math.max(0, Math.min(topRatios.length - 1, rawIndex));
        if (!fillsHeight) {
          const nodeY = topRatios[index] * height;
          const hitRadius = Math.max(10, gap / 2);
          if (Math.abs(pointerY - nodeY) > hitRadius) return null;
        }
        return index;
      }, []);

      const cancelPreviewHide = useCallback(() => {
        if (previewHideTimerRef.current) {
          clearTimeout(previewHideTimerRef.current);
          previewHideTimerRef.current = null;
        }
      }, []);

      const showPreview = useCallback(() => {
        cancelPreviewHide();
        setMinimapHovered(true);
      }, [cancelPreviewHide]);

      const schedulePreviewHide = useCallback(() => {
        cancelPreviewHide();
        previewHideTimerRef.current = setTimeout(() => {
          previewHideTimerRef.current = null;
          setMinimapHovered(false);
          setMouseYRatio(null);
        }, PREVIEW_HIDE_DELAY);
      }, [cancelPreviewHide]);

      useEffect(() => () => cancelPreviewHide(), [cancelPreviewHide]);

      // Watch the details column's open flips and yield/return with it. The
      // AppFrame root is the shell.overlay host's parent; open ⇔ it lacks
      // data-details-collapsed. On open: restore the gutter and drop every
      // hover remnant so the rail's return starts clean. On close: re-measure
      // (measureFrame re-derives the gutter for the now-visible rail).
      useEffect(() => {
        const overlayHost = document.querySelector('[data-shell-overlay]');
        const frameEl = overlayHost && overlayHost.parentElement;
        if (!frameEl) return undefined;
        const syncDetailsGate = () => {
          const open = !frameEl.hasAttribute('data-details-collapsed');
          if (open === detailsOpenRef.current) return;
          detailsOpenRef.current = open;
          if (open) {
            restoreGutter(gutterElRef);
            gutterPadRef.current = 0;
            cancelPreviewHide();
            setMinimapHovered(false);
            setMouseYRatio(null);
            setVisible(false);
          } else {
            measureNodes();
            updateScroll();
          }
        };
        syncDetailsGate();
        const mo = new MutationObserver(syncDetailsGate);
        mo.observe(frameEl, { attributes: true, attributeFilter: ['data-details-collapsed'] });
        return () => mo.disconnect();
      }, [measureNodes, updateScroll, cancelPreviewHide]);

      const handleMouseDown = useCallback((event) => {
        if (!visible) return;
        draggingRef.current = true;
        showPreview();
        const rect = event.currentTarget.getBoundingClientRect();
        const jumpToPointer = (clientY, behavior) => {
          const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
          setMouseYRatio(ratio);
          const index = findNearestNode(ratio);
          if (index !== null) scrollToNode(index, behavior);
        };
        jumpToPointer(event.clientY, 'smooth');
        const onMove = (moveEvent) => {
          if (!draggingRef.current) return;
          jumpToPointer(moveEvent.clientY, 'auto');
        };
        const onUp = () => {
          draggingRef.current = false;
          dragCleanupRef.current = null;
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        dragCleanupRef.current = onUp;
      }, [findNearestNode, scrollToNode, showPreview, visible]);

      // HMR/unmount during a press-drag must not leave window listeners behind.
      useEffect(() => () => {
        if (dragCleanupRef.current) dragCleanupRef.current();
      }, []);

      const nearestNodeIndex = mouseYRatio === null ? null : findNearestNode(mouseYRatio);

      // Keep the located turn centered inside the preview panel.
      useEffect(() => {
        if (!minimapHovered || nearestNodeIndex === null) return;
        const box = previewBoxRef.current;
        const item = previewItemRefs.current.get(nearestNodeIndex);
        if (!box || !item) return;
        const targetTop = item.offsetTop - (box.clientHeight - item.offsetHeight) / 2;
        box.scrollTop = Math.max(0, targetTop);
      }, [nodeCount, minimapHovered, nearestNodeIndex]);

      if (!visible || !frame || nodeCount === 0) return null;

      const { topRatios, gap: nodeGap } = layout;
      const lastNodeTop = topRatios.length > 0 ? topRatios[topRatios.length - 1] * minimapHeight : MINIMAP_PADDING;
      const railHeight = Math.max(1, lastNodeTop - MINIMAP_PADDING);

      return h('div', {
        className: 'dshm-root',
        style: { top: frame.top, left: frame.left, height: frame.height, width: MINIMAP_WIDTH },
      },
        h('div', {
          ref: containerRef,
          className: 'dshm-rail',
          onMouseDown: handleMouseDown,
          onMouseEnter: showPreview,
          onMouseLeave: schedulePreviewHide,
          onMouseMove: (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMouseYRatio((event.clientY - rect.top) / rect.height);
          },
        },
          h('div', { className: 'dshm-track', style: { top: MINIMAP_PADDING, height: railHeight } }),
          topRatios.map((topRatio, index) => {
            const isNearest = minimapHovered && nearestNodeIndex === index;
            const isActive = activeIndex === index;
            return h('div', {
              key: index,
              className: 'dshm-node',
              'data-minimap-node-index': index,
              'data-minimap-node-active': isActive ? '' : undefined,
              style: {
                top: (topRatio * 100) + '%',
                transform: 'translateY(-50%)',
                height: Math.max(1, nodeGap),
              },
            },
              h('div', {
                className: 'dshm-dot',
                style: {
                  background: isActive ? 'rgba(128,128,128,0.42)' : 'rgba(128,128,128,0.16)',
                  border: '1.5px solid ' + (isActive ? 'rgba(128,128,128,0.95)' : 'rgba(128,128,128,0.58)'),
                  boxShadow: isActive ? '0 0 0 2px var(--dshm-bg-panel)' : 'none',
                  transform: isNearest ? 'scale(1.25)' : 'scale(1)',
                },
              }),
            );
          }),
          minimapHovered && nodeCount > 0 && h('div', {
            ref: previewBoxRef,
            className: 'dshm-preview',
            onMouseEnter: showPreview,
            onMouseDown: (event) => event.stopPropagation(),
            onMouseMove: (event) => event.stopPropagation(),
          },
            turns.map((turn, index) => {
              const isLocated = nearestNodeIndex === index;
              const outlines = turn.assistants.map((a) => extractOutline(a.markdown));
              return h('div', {
                key: turn.key + ':' + index,
                ref: (el) => {
                  if (el) previewItemRefs.current.set(index, el);
                  else previewItemRefs.current.delete(index);
                },
                className: 'dshm-turn',
                'data-located': isLocated ? 'true' : undefined,
              },
                h('span', { className: 'dshm-number', 'aria-hidden': 'true' },
                  String(index + 1).padStart(2, '0')),
                h('div', { className: 'dshm-content' },
                  h('button', {
                    type: 'button',
                    className: 'dshm-user',
                    onClick: () => scrollToNode(index, 'smooth'),
                  }, h('span', { className: 'dshm-user-text' }, turn.userText || '(空消息)')),
                  turn.assistants.map((a, assistantIndex) => {
                    const outline = outlines[assistantIndex];
                    return h('div', { key: a.key + ':' + assistantIndex, className: 'dshm-assistant' },
                      h('button', {
                        type: 'button',
                        className: 'dshm-assistant-jump',
                        title: '定位助手回复',
                        'aria-label': '定位助手回复',
                        onClick: () => scrollToAssistant(index, assistantIndex),
                      }, 'A'),
                      h('div', { className: 'dshm-outline' },
                        outline.headings.length > 0
                          ? outline.headings.map((heading, headingIndex) => h('button', {
                              key: headingIndex,
                              type: 'button',
                              className: 'dshm-heading',
                              'data-level': heading.level,
                              onClick: () => scrollToHeading(index, assistantIndex, headingIndex),
                            }, heading.text))
                          : (outline.paragraph
                              ? [h('button', {
                                  key: 'p',
                                  type: 'button',
                                  className: 'dshm-paragraph',
                                  onClick: () => scrollToAssistant(index, assistantIndex),
                                }, outline.paragraph)]
                              : null),
                      ),
                    );
                  }),
                ),
              );
            }),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin entry                                                         */
    /* ------------------------------------------------------------------ */

    exports.name = 'dsh-chat-minimap';
    exports.inject = ['sessions', 'slots'];
    exports.apply = function apply(ctx) {
      const sessions = ctx.sessions;
      const slots = ctx.slots;
      const doRegister = () => {
        return slots.register(
          { name: 'shell.overlay', id: 'dsh-chat-minimap' },
          () => h(MinimapOverlay, { sessions }),
        );
      };
      if (typeof slots.inject === 'function') {
        ctx.slots.inject('shell.overlay', () => { doRegister(); });
      } else {
        doRegister();
      }
    };

    return module.exports;
  },
});
