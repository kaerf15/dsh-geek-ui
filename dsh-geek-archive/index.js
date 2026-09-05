/**
 * dsh-geek-archive host 根：会话归档管理。
 *
 * HTTP 路由表由 lib/archive.js 提供，统一挂到 webServer 的 /__dsh-geek-archive__/ 前缀下
 * （共享 lib/http.js 的分发 / JSON / 同源护栏约定）：
 *   /__dsh-geek-archive__/wb/unarchiveSession  放回对话（解除归档）
 *   /__dsh-geek-archive__/wb/deleteSession     永久删除（解除归档 + 删落盘目录 + 通知 client 移除）
 */
import { mountApi } from './lib/http.js'
import { archiveApi } from './lib/archive.js'

export const name = 'dsh-geek-archive'

/* webServer 是硬依赖（路由挂载点）。不做可选能力，无需 ctx.get 判空。 */
export const inject = ['webServer']

export function apply(ctx) {
  const routes = archiveApi(ctx)
  mountApi(ctx, '/__dsh-geek-archive__', routes)
  console.log('[dsh-geek-archive] api mounted at /__dsh-geek-archive__ (' + Object.keys(routes).length + ' routes)')
}