#!/usr/bin/env node
// dsh-geek-archive host 冒烟：archiveApi 路由的校验/私有面行为。
import { archiveApi } from '../lib/archive.js'

let passed = 0, failed = 0
function ok(label, cond) {
  if (cond) { passed++ } else { failed++; console.error('  ✗', label) }
}
async function thrownStatus(fn) {
  try { await fn(); return 0 } catch (e) { return Number(e && e.status) || 500 }
}

const noReg = archiveApi({ get: () => undefined, emit: () => {} })

const ws = {
  state: { workspaceIds: [], archivedSessionIds: ['session-a', 'session-b'] },
  requireState() { return this.state },
  async setState(s) { this.state = s },
  async enqueueOperation(fn) { return fn() },
}
const routes = archiveApi({ get: (n) => (n === 'workspaceRegistry' ? ws : undefined), emit: () => {} })

const main = async () => {
  ok('unarchiveSession 拒空 id（400）', (await thrownStatus(() => noReg['POST /wb/unarchiveSession']({ body: {} }))) === 400)
  ok('deleteSession 拒空 id（400）', (await thrownStatus(() => noReg['POST /wb/deleteSession']({ body: {} }))) === 400)
  ok('unarchiveSession 无 registry 503', (await thrownStatus(() => noReg['POST /wb/unarchiveSession']({ body: { id: 'session-a' } }))) === 503)
  ok('deleteSession 无 registry 503', (await thrownStatus(() => noReg['POST /wb/deleteSession']({ body: { id: 'session-a' } }))) === 503)

  const un1 = await routes['POST /wb/unarchiveSession']({ body: { id: 'session-a' } })
  ok('unarchiveSession 移除归档 id', un1.ok === true && JSON.stringify(un1.ids) === JSON.stringify(['session-b']) && JSON.stringify(ws.state.archivedSessionIds) === JSON.stringify(['session-b']))
  const un2 = await routes['POST /wb/unarchiveSession']({ body: { id: 'session-a' } })
  ok('unarchiveSession 重复移除幂等', un2.ok === true && JSON.stringify(un2.ids) === JSON.stringify(['session-b']))

  const del1 = await routes['POST /wb/deleteSession']({ body: { id: 'session-b', cwd: '/nonexistent-proj-for-smoke' } })
  ok('deleteSession 解除归档并删除', del1.ok === true && del1.ids.length === 0 && ws.state.archivedSessionIds.length === 0)
  const del2 = await thrownStatus(() => routes['POST /wb/deleteSession']({ body: { id: 'session-z', cwd: '/nonexistent-proj-for-smoke' } }))
  ok('deleteSession 拒未归档 id（404 fail-closed）', del2 === 404 && ws.state.archivedSessionIds.length === 0)

  console.log(passed + ' passed, ' + failed + ' failed')
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })