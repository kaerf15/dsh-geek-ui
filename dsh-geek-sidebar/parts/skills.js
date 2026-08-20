    /* ============================ feature 3: skills ============================ */
    const V = {
      bg: 'var(--dsw-alias-bg-base)',
      panel: 'var(--dsw-alias-bg-layer-1)',
      selected: 'var(--dsw-alias-bg-layer-2)',
      border: 'var(--dsw-alias-border-l1)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      accent: 'var(--dsw-alias-button-info-fill, var(--dsw-alias-brand-primary))', /* brand-primary 在亮色主题近黑；button-info-fill 才是 DeepSeek 蓝 */
      error: 'var(--dsw-alias-state-error-primary)',
      warn: '#d97706',
      ok: '#16a34a',
    }
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

    function shortenPath(p) { return String(p || '').replace(/^\/(?:Users|home)\/[^/]+/, '~') }
    function shortVersion(v) { return v ? String(v).slice(0, 8) : 'unknown' }
    function updateKey(skill) { return skill.install ? skill.install.scope + '\0' + skill.install.package : null }
    function groupOf(skill) {
      const sh = Boolean(skill.install && skill.install.skillsShUrl)
      return skill.scope + (sh ? ' / skills.sh' : '')
    }

    const api2 = (method, path, body) => api(method, '/skills' + path, body)

    function PlusIcon() {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }), h('line', { x1: 5, y1: 12, x2: 19, y2: 12 }))
    }
    function PencilIcon() {
      return h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }))
    }
    function Toggle(props) {
      return h('button', {
        onClick: props.onToggle,
        disabled: props.loading,
        title: props.enabled ? '提示词中可见' : '提示词中隐藏（仍可手动调用）',
        style: {
          flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', padding: 0,
          cursor: props.loading ? 'wait' : 'pointer',
          background: props.enabled ? V.accent : V.border,
          position: 'relative', transition: 'background 0.18s', outline: 'none',
        },
      }, h('span', {
        style: {
          position: 'absolute', top: 3, left: props.enabled ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: V.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
        },
      }))
    }

    function Section(props) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
        h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, props.label),
        props.children)
    }

    function Detail(props) {
      const skill = props.skill
      const enabled = !skill.disableModelInvocation
      const st = props.updateStatus
      const displayPath = skill.scope === 'project' && props.cwd && skill.filePath.indexOf(props.cwd) === 0
        ? './' + skill.filePath.slice(props.cwd.length).replace(/^[/\\]/, '')
        : shortenPath(skill.filePath)
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
            h('span', {
              style: {
                fontSize: 10, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                background: skill.scope === 'project' ? 'rgba(99,102,241,0.12)' : 'rgba(120,120,120,0.12)',
                color: skill.scope === 'project' ? 'rgba(99,102,241,0.9)' : V.muted,
              },
            }, skill.scope),
            h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: skill.filePath }, displayPath),
            h(Toggle, { enabled, loading: props.toggling, onToggle: () => props.onToggle(skill) })),
          h('div', { style: { minHeight: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', textAlign: 'right' } },
            !enabled ? h('span', { style: { fontSize: 11, color: V.muted } }, '已在提示词中隐藏（仍可手动调用）') : null,
            props.saveError ? h('span', { style: { fontSize: 12, color: V.error, overflowWrap: 'anywhere' } }, props.saveError) : null)),
        skill.install && skill.install.skillsShUrl ? h(Section, { label: 'Source' },
          h('a', {
            href: skill.install.skillsShUrl, target: '_blank', rel: 'noreferrer',
            style: { display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', color: V.accent, textDecoration: 'none' },
          }, h('span', { style: { fontFamily: MONO, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.install.skillsShUrl.replace(/^https?:\/\//, '') + ' ↗'))) : null,
        skill.install ? h(Section, { label: 'Version' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.muted } }, shortVersion(st && st.currentVersion ? st.currentVersion : skill.install.versionHash)),
            skill.install.canCheckForUpdates ? h('button', {
              onClick: props.onCheckUpdate, disabled: props.checkingUpdate || props.updating,
              style: { padding: '4px 9px', border: '1px solid ' + V.border, borderRadius: 5, background: 'none', color: V.muted, cursor: props.checkingUpdate || props.updating ? 'not-allowed' : 'pointer', opacity: props.checkingUpdate || props.updating ? 0.5 : 1, fontSize: 11 },
            }, '检查') : null,
            st && st.state === 'update-available' ? h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.warn } }, shortVersion(st.latestVersion)) : null,
            props.checkingUpdate || (st && st.state !== 'update-available')
              ? h('span', { style: { fontSize: 12, color: props.checkingUpdate ? V.accent : st && st.state === 'up-to-date' ? V.ok : st && st.state === 'error' ? V.error : V.muted } },
                  props.checkingUpdate ? '检查中…' : st && st.state === 'up-to-date' ? '已是最新' : st && st.state === 'unsupported' ? '自动检查不可用' : (st && st.message) || '检查失败')
              : null,
            st && st.state === 'update-available' ? h('button', {
              onClick: props.onUpdate, disabled: props.updating || props.checkingUpdate,
              style: { padding: '4px 10px', border: 'none', borderRadius: 5, background: V.accent, color: '#fff', cursor: props.updating || props.checkingUpdate ? 'not-allowed' : 'pointer', opacity: props.updating || props.checkingUpdate ? 0.5 : 1, fontSize: 11, fontWeight: 600 },
            }, props.updating ? '更新中…' : '更新') : null),
          props.updateError ? h('span', { style: { fontSize: 12, color: V.error } }, props.updateError) : null) : null,
        h(Section, { label: 'Name' }, h('span', { style: { fontFamily: MONO, fontSize: 14, color: V.text } }, skill.name)),
        h(Section, { label: 'Description' }, h('span', { style: { fontSize: 14, color: V.muted, lineHeight: 1.6 } }, skill.description || '—')))
    }

    function AddPanel(props) {
      const [query, setQuery] = useState('')
      const [results, setResults] = useState([])
      const [searching, setSearching] = useState(false)
      const [searchError, setSearchError] = useState(null)
      const [installing, setInstalling] = useState(null)
      const [installError, setInstallError] = useState(null)
      const [installed, setInstalled] = useState(new Set())
      const [scope, setScope] = useState('global')
      const inputRef = useRef(null)
      useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [])

      const search = async () => {
        if (!query.trim()) return
        setSearching(true); setSearchError(null); setResults([])
        try {
          const d = await api2('POST', '/search', { query: query.trim() })
          setResults(d.results || [])
          if (!(d.results || []).length) setSearchError('没有找到匹配的技能')
        } catch (e) { setSearchError(String(e && e.message ? e.message : e)) } finally { setSearching(false) }
      }
      const install = async (pkg) => {
        setInstalling(pkg); setInstallError(null)
        try {
          await api2('POST', '/install', { package: pkg, scope, cwd: props.cwd })
          setInstalled((prev) => new Set(prev).add(scope + ':' + pkg))
          props.onInstalled()
        } catch (e) { setInstallError(String(e && e.message ? e.message : e)) } finally { setInstalling(null) }
      }
      const installPath = scope === 'global' ? shortenPath(props.globalDir) + '/' : shortenPath(props.cwd) + '/.agents/skills/'

      return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 } },
          h('div', { style: { fontSize: 14, fontWeight: 600, color: V.text } }, '添加技能'),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('input', {
              ref: inputRef, value: query, placeholder: '搜索 skills.sh…',
              onChange: (e) => setQuery(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') search() },
              style: { flex: 1, padding: '7px 10px', fontSize: 13, background: V.panel, border: '1px solid ' + V.border, borderRadius: 6, color: V.text, outline: 'none' },
            }),
            h('button', {
              onClick: search, disabled: searching || !query.trim(),
              style: { padding: '7px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: V.accent, color: '#fff', cursor: searching || !query.trim() ? 'not-allowed' : 'pointer', opacity: searching || !query.trim() ? 0.5 : 1, flexShrink: 0 },
            }, searching ? '搜索中…' : '搜索')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('div', { style: { display: 'flex', borderRadius: 5, border: '1px solid ' + V.border, overflow: 'hidden', fontSize: 12, flexShrink: 0 } },
              ['global', 'project'].map((s2) => h('button', {
                key: s2,
                onClick: () => setScope(s2),
                style: {
                  padding: '3px 10px', border: 'none', cursor: 'pointer',
                  background: scope === s2 ? V.selected : 'none',
                  color: scope === s2 ? V.text : V.muted,
                  fontWeight: scope === s2 ? 600 : 400,
                  borderRight: s2 === 'global' ? '1px solid ' + V.border : 'none',
                },
              }, s2))),
            h('span', { style: { fontSize: 12, color: V.muted, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '→ ' + installPath)),
          searchError ? h('div', { style: { fontSize: 12, color: V.error } }, searchError) : null,
          installError ? h('div', { style: { fontSize: 12, color: V.error, wordBreak: 'break-word' } }, installError) : null),
        results.length > 0
          ? h('div', { style: { flex: 1, overflowY: 'auto' } },
              results.map((r) => {
                const isInstalled = props.installedPackages[scope].has(r.package) || installed.has(scope + ':' + r.package)
                const isInstalling = installing === r.package
                const at = r.package.indexOf('@')
                const repo = at > -1 ? r.package.slice(0, at) : r.package
                const skillPart = at > -1 ? r.package.slice(at + 1) : null
                return h('div', { key: r.package, style: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid ' + V.border } },
                  h('div', { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 3 } }, skillPart || repo),
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                      h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted } }, repo),
                      h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, r.installs || ''),
                      r.url ? h('a', { href: r.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 12, color: V.accent, textDecoration: 'none' } }, 'skills.sh ↗') : null)),
                  h('button', {
                    onClick: () => { if (!isInstalled && !isInstalling) install(r.package) },
                    disabled: isInstalled || isInstalling || installing !== null,
                    style: {
                      flexShrink: 0, padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 5,
                      border: '1px solid ' + V.border,
                      cursor: isInstalled || isInstalling || installing !== null ? 'not-allowed' : 'pointer',
                      background: isInstalled ? 'rgba(34,197,94,0.1)' : 'none',
                      color: isInstalled ? V.ok : isInstalling ? V.accent : V.muted,
                    },
                  }, isInstalled ? '✓ 已安装' : isInstalling ? '安装中…' : '安装'))
              }))
          : (!searchError && !searching
              ? h('div', { style: { fontSize: 13, color: V.muted, lineHeight: 1.8 } },
                  '在 ', h('a', { href: 'https://skills.sh', target: '_blank', rel: 'noreferrer', style: { color: V.accent, textDecoration: 'none' } }, 'skills.sh'), ' 搜索并安装技能。')
              : null))
    }

    function SkillsModal() {
      const [open, setOpen] = useState(false)
      const [cwd, setCwd] = useState('')
      const [skills, setSkills] = useState([])
      const [globalDir, setGlobalDir] = useState('')
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [selected, setSelected] = useState(null)
      const [toggling, setToggling] = useState(new Set())
      const [saveError, setSaveError] = useState(null)
      const [addMode, setAddMode] = useState(false)
      const [statuses, setStatuses] = useState({})
      const [checking, setChecking] = useState(new Set())
      const [updatingKey, setUpdatingKey] = useState(null)
      const [updateError, setUpdateError] = useState(null)
      const [checkingAll, setCheckingAll] = useState(false)
      const [dormantOpen, setDormantOpen] = useState({})
      const [pathEditing, setPathEditing] = useState(false)
      const [pathDraft, setPathDraft] = useState('')

      const load = useCallback(async (forCwd) => {
        setLoading(true); setError(null)
        try {
          const d = await api2('GET', '/list?cwd=' + encodeURIComponent(forCwd || ''))
          const list = d.skills || []
          setSkills(list)
          setGlobalDir(d.globalDir || '')
          setSelected((prev) => {
            if (prev && list.some((s) => s.filePath === prev)) return prev
            const first = list.find((s) => !s.disableModelInvocation) || list[0]
            return first ? first.filePath : null
          })
        } catch (e) { setError(String(e && e.message ? e.message : e)) } finally { setLoading(false) }
      }, [])

      useEffect(() => {
        skillsModalApi = {
          open(forCwd) {
            setCwd(forCwd || '')
            setOpen(true)
            setAddMode(false)
            setStatuses({})
            setUpdateError(null)
            load(forCwd || '')
          },
          close() { setOpen(false) },
        }
        return () => { skillsModalApi = null }
      }, [load])

      const toggle = async (skill) => {
        const next = !skill.disableModelInvocation
        setToggling((s) => new Set(s).add(skill.filePath))
        setSaveError(null)
        try {
          await api2('POST', '/toggle', { filePath: skill.filePath, disable: next })
          setSkills((prev) => prev.map((s) => s.filePath === skill.filePath ? Object.assign({}, s, { disableModelInvocation: next }) : s))
          if (next) setDormantOpen((cur) => Object.assign({}, cur, { [groupOf(skill)]: true }))
        } catch (e) { setSaveError(String(e && e.message ? e.message : e)) } finally {
          setToggling((s) => { const n = new Set(s); n.delete(skill.filePath); return n })
        }
      }

      const updateOne = async (skill) => {
        if (!skill.install) return
        const key = updateKey(skill)
        setUpdatingKey(key); setUpdateError(null)
        try {
          const d = await api2('POST', '/update', { cwd, package: skill.install.package, scope: skill.install.scope })
          await load(cwd)
          setStatuses((cur) => Object.assign({}, cur, { [key]: { state: 'up-to-date', currentVersion: d.versionHash, latestVersion: d.versionHash } }))
        } catch (e) { setUpdateError(String(e && e.message ? e.message : e)) } finally { setUpdatingKey(null) }
      }
      /* 检查只做远端版本比对，不重装；传 skill 则只查单个 */
      const checkForUpdates = async (skill) => {
        const targets = skill ? [skill] : skills.filter((s) => Boolean(s.install))
        const keys = targets.map(updateKey).filter(Boolean)
        if (!keys.length) return
        setUpdateError(null)
        setChecking((cur) => new Set([...cur, ...keys]))
        if (!skill) setCheckingAll(true)
        try {
          const d = await api2('POST', '/check', {
            cwd,
            package: skill && skill.install ? skill.install.package : undefined,
            scope: skill && skill.install ? skill.install.scope : undefined,
          })
          setStatuses((cur) => {
            const next = Object.assign({}, cur)
            for (const u of d.updates || []) next[u.scope + '\0' + u.package] = u
            return next
          })
        } catch (e) {
          setUpdateError(String(e && e.message ? e.message : e))
        } finally {
          setChecking((cur) => { const n = new Set(cur); for (const k of keys) n.delete(k); return n })
          if (!skill) setCheckingAll(false)
        }
      }
      const saveGlobalDir = async () => {
        const dir = pathDraft.trim()
        setPathEditing(false)
        if (!dir || dir === globalDir) return
        try {
          await api2('POST', '/prefs', { globalDir: dir })
          await load(cwd)
        } catch (e) { setError(String(e && e.message ? e.message : e)) }
      }

      if (!open) return null
      const selectedSkill = skills.find((s) => s.filePath === selected) || null
      const groups = []
      const defs = ['project / skills.sh', 'project', 'global / skills.sh', 'global']
      for (const label of defs) {
        const rows = skills.filter((s) => groupOf(s) === label)
        if (rows.length) groups.push({ label, rows })
      }
      const renderRow = (skill) => {
        const isSelected = !addMode && selected === skill.filePath
        const disabled = skill.disableModelInvocation
        return h('div', {
          key: skill.filePath,
          onClick: () => { setSelected(skill.filePath); setAddMode(false) },
          style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 8px', borderRadius: 5, cursor: 'pointer', background: isSelected ? V.selected : 'none' },
          onMouseEnter: (e) => { if (!isSelected) e.currentTarget.style.background = V.panel },
          onMouseLeave: (e) => { if (!isSelected) e.currentTarget.style.background = 'none' },
        },
          h('span', { style: { flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: disabled ? V.border : V.accent, boxShadow: disabled ? 'none' : '0 0 4px ' + V.accent, transition: 'background 0.15s, box-shadow 0.15s' } }),
          h('span', { style: { fontSize: 12, fontWeight: isSelected ? 600 : 400, color: disabled ? V.muted : V.text, fontFamily: MONO, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.name),
          /* 可更新标记：行尾橙色 ↑ */
          (() => {
            const key = updateKey(skill)
            const st = key ? statuses[key] : undefined
            if (!st || st.state !== 'update-available') return null
            return h('span', { title: '有可用更新', style: { color: V.warn, fontSize: 13, lineHeight: 1, flexShrink: 0 } }, '↑')
          })())
      }

      return h('div', {
        style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' },
        onClick: (e) => { if (e.target === e.currentTarget) setOpen(false) },
      },
        h('div', {
          style: { width: 860, maxWidth: 'calc(100vw - 16px)', height: '78vh', maxHeight: 'calc(100dvh - 16px)', background: V.bg, border: '1px solid ' + V.border, borderRadius: 10, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' },
        },
          /* Header */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 } },
              h('span', { style: { fontSize: 15, fontWeight: 700, color: V.text } }, '技能'),
              h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, shortenPath(cwd) || '—'),
              pathEditing
                ? h('input', {
                    value: pathDraft, autoFocus: true,
                    onChange: (e) => setPathDraft(e.target.value),
                    onBlur: saveGlobalDir,
                    onKeyDown: (e) => { if (e.key === 'Enter') saveGlobalDir(); if (e.key === 'Escape') setPathEditing(false) },
                    style: { fontSize: 11, fontFamily: MONO, padding: '2px 6px', border: '1px solid ' + V.accent, borderRadius: 4, background: V.bg, color: V.text, outline: 'none', width: 220 },
                  })
                : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: 'global 技能目录' }, shortenPath(globalDir) + '/'),
                    h('button', {
                      onClick: () => { setPathDraft(globalDir); setPathEditing(true) },
                      title: '编辑 global 技能目录',
                      style: { border: 'none', background: 'none', color: V.muted, cursor: 'pointer', padding: 2, display: 'inline-flex' },
                    }, h(PencilIcon)))),
            h('button', { onClick: () => setOpen(false), style: { background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' } }, '×')),
          /* Body */
          h('div', { style: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' } },
            h('div', { style: { width: 210, borderRight: '1px solid ' + V.border, display: 'flex', flexDirection: 'column', flexShrink: 0, background: V.panel } },
              h('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 6px' } },
                loading ? h('div', { style: { padding: '10px 8px', fontSize: 12, color: V.muted } }, '加载中…')
                  : error ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.error } }, error)
                  : skills.length === 0 ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.muted } }, '没有技能')
                  : groups.map((g) => {
                      const active = g.rows.filter((s) => !s.disableModelInvocation)
                      const dormant = g.rows.filter((s) => s.disableModelInvocation)
                      const dOpen = dormantOpen[g.label] || false
                      return h('div', { key: g.label, style: { marginBottom: 6 } },
                        h('div', { style: { padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em' } }, g.label),
                        active.map(renderRow),
                        dormant.length > 0 ? h('div', {
                          onClick: () => setDormantOpen((cur) => Object.assign({}, cur, { [g.label]: !dOpen })),
                          style: { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none' },
                        }, h('span', { style: { fontSize: 8 } }, dOpen ? '▾' : '▸'), '已停用 (' + dormant.length + ')') : null,
                        dOpen ? dormant.map(renderRow) : null)
                    })),
              h('div', { style: { padding: '8px 6px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
                h('div', {
                  onClick: () => setAddMode(true),
                  style: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 5, cursor: 'pointer', background: addMode ? V.selected : 'none', color: addMode ? V.accent : V.muted, fontSize: 12 },
                  onMouseEnter: (e) => { if (!addMode) e.currentTarget.style.background = V.selected },
                  onMouseLeave: (e) => { if (!addMode) e.currentTarget.style.background = 'none' },
                }, h(PlusIcon), '添加技能'))),
            h('div', { style: { flex: 1, overflowY: 'auto', padding: 20 } },
              addMode
                ? h(AddPanel, {
                    cwd,
                    globalDir,
                    installedPackages: {
                      global: new Set(skills.filter((s) => s.install && s.install.scope === 'global').map((s) => s.install.package)),
                      project: new Set(skills.filter((s) => s.install && s.install.scope === 'project').map((s) => s.install.package)),
                    },
                    onInstalled: () => load(cwd),
                  })
                : selectedSkill
                  ? h(Detail, {
                      skill: selectedSkill,
                      cwd,
                      toggling: toggling.has(selectedSkill.filePath),
                      saveError,
                      updateStatus: updateKey(selectedSkill) ? statuses[updateKey(selectedSkill)] : undefined,
                      checkingUpdate: updateKey(selectedSkill) ? checking.has(updateKey(selectedSkill)) : false,
                      updating: updatingKey === updateKey(selectedSkill),
                      updateError,
                      onToggle: toggle,
                      onCheckUpdate: () => checkForUpdates(selectedSkill),
                      onUpdate: () => updateOne(selectedSkill),
                    })
                  : h('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V.muted, fontSize: 13 } }, loading ? '' : '选择一个技能'))),
          /* Footer */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              skills.some((s) => s.install) ? h('button', {
                onClick: () => checkForUpdates(),
                disabled: checkingAll || updatingKey !== null,
                style: { padding: '6px 12px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: checkingAll || updatingKey !== null ? 'not-allowed' : 'pointer', opacity: checkingAll || updatingKey !== null ? 0.5 : 1, fontSize: 12 },
              }, checkingAll ? '检查中…' : '检查更新') : null,
              Object.values(statuses).filter((st) => st.state === 'update-available').length > 0
                ? h('span', { style: { fontSize: 12, color: V.warn } }, Object.values(statuses).filter((st) => st.state === 'update-available').length + ' 项更新')
                : null),
            h('button', { onClick: () => setOpen(false), style: { padding: '6px 14px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: 'pointer', fontSize: 13 } }, '关闭'))))
    }


    function applySkillsUI(ctx) {
      ctx.provide('dshSkillsUI')
      ctx.dshSkillsUI = {
        open(cwd) { skillsUI.open(cwd) },
        close() { skillsUI.close() },
      }
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-geek-sidebar-skills' }, () => h(SkillsModal, null))
      )
    }

