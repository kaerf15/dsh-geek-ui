/**
 * dsh-geek-sidebar 共享宿主依赖解析（评审修复：makeRequire 原在 terminal.js/acp.js
 * 各抄一份，acp 版少了 import.meta.url 保底候选、行为不一致——收敛到较严谨的
 * terminal 版，两处改为引用本模块）。
 *
 * node-pty / ws 等运行时依赖的解析链：dsh CLI 入口 → web profile 的 hoisted
 * node_modules → dsh 安装目录 → 插件自身。插件零依赖声明，运行时从宿主环境解析。
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function makeRequire() {
  const candidates = []
  try { candidates.push(createRequire(process.argv[1] || import.meta.url)) } catch { /* 无 argv[1] */ }
  try { candidates.push(createRequire(join(homedir(), '.dsh', 'profiles', 'web', 'package.json'))) } catch { /* 无该 profile */ }
  try { candidates.push(createRequire('/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/package.json')) } catch { /* 非 homebrew 安装 */ }
  try { candidates.push(createRequire(import.meta.url)) } catch { /* 保底 */ }
  return (id) => {
    let lastErr
    for (const r of candidates) {
      try {
        return r(id)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr || new Error(id + ' unavailable')
  }
}
