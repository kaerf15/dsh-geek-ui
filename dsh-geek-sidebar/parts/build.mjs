#!/usr/bin/env node
// dsh-geek-sidebar client.js 拼装器：vendor(xterm) + head + workbench/*(按文件名序) + skills + tail（纯拼接）。
// 各 feature 的可读维护源码都在 parts/；workbench 按域拆在 parts/workbench/ 目录，
// 数字前缀即拼接顺序。改源码后从项目根目录运行：
//   node dsh-plugins/dsh-geek-sidebar/parts/build.mjs
// 注意：apply 所在文件必须排最后——IIFE 体内的 return 之后是死代码，
// 函数声明可提升但 const/let 不会初始化（16-bottom-panel 的 ANSI 常量曾因此 TDZ）。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'dsh-plugins/dsh-geek-sidebar'
const read = (p) => readFileSync(p, 'utf8')

// workbench 体：目录内按文件名序拼接，包进 IIFE（React/host 走参数，隔离内部命名）
const WB_DIR = `${ROOT}/parts/workbench`
const wb = readdirSync(WB_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => read(join(WB_DIR, f)))
  .join('\n')
const WB_PART = 'const workbenchMod = (function (React, host) {\n' + wb + '\n})(React, host)\n'

const out = read(`${ROOT}/parts/vendor-xterm.js`) + '\n' + read(`${ROOT}/parts/head.js`) + WB_PART + '\n' + read(`${ROOT}/parts/skills.js`) + read(`${ROOT}/parts/tail.js`)
writeFileSync(`${ROOT}/lib/client.js`, out)
console.log('client.js written,', out.length, 'bytes')
