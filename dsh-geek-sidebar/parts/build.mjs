#!/usr/bin/env node
// dsh-geek-sidebar client.js 拼装器：vendor(xterm) + head + workbench/*(按文件名序) + skills + tail（纯拼接）。
// 各 feature 的可读维护源码都在 parts/；workbench 按域拆在 parts/workbench/ 目录，
// 数字前缀即拼接顺序。任意目录下可运行（ROOT 取自脚本位置）：
//   node dsh-plugins/dsh-geek-sidebar/parts/build.mjs   或   npm run build
// 注意：apply 所在文件必须排最后——IIFE 体内的 return 之后是死代码，
// 函数声明可提升但 const/let 不会初始化（15-bottom-panel 的 ANSI 常量曾因此 TDZ）。
// 下方两条构建期断言把这条纪律工具化（评审 P2：拼接架构的最低限度护栏）：
//   A. 只有排序最后的 part 允许出现顶层 return；
//   B. 各 part 顶层符号（行首 function/const/let/var/class）不得重名。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(p, 'utf8')

// workbench 体：目录内按文件名序拼接，包进 IIFE（React/host 走参数，隔离内部命名）
const WB_DIR = join(ROOT, 'parts', 'workbench')
const files = readdirSync(WB_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()
const parts = files.map((f) => ({ file: f, src: read(join(WB_DIR, f)) }))

/* 断言 A：顶层 return 只允许出现在排序最后的 part（IIFE return 之后皆死代码） */
for (const { file, src } of parts.slice(0, -1)) {
  if (/^return\b/m.test(src)) {
    console.error(`build failed: ${file} 含顶层 return——IIFE return 之后皆死代码，只有排序最后的 part 允许 return`)
    process.exit(1)
  }
}

/* 断言 B：顶层符号跨 part 不得重名（行首声明；多声明子续行的名字抓不到，仅作绊索） */
const seen = new Map()
for (const { file, src } of parts) {
  const re = /^(?:function\s+([\w$]+)|(?:const|let|var|class)\s+([\w$]+))/gm
  let m
  while ((m = re.exec(src))) {
    const name = m[1] || m[2]
    if (seen.has(name)) {
      console.error(`build failed: 顶层符号 "${name}" 重名（${seen.get(name)} 与 ${file}）——拼接共享作用域会互相覆盖`)
      process.exit(1)
    }
    seen.set(name, file)
  }
}

const wb = parts.map((p) => p.src).join('\n')
const WB_PART = 'const workbenchMod = (function (React, host) {\n' + wb + '\n})(React, host)\n'

const out = read(join(ROOT, 'parts', 'vendor-xterm.js')) + '\n' + read(join(ROOT, 'parts', 'head.js')) + WB_PART + '\n' + read(join(ROOT, 'parts', 'skills.js')) + read(join(ROOT, 'parts', 'tail.js'))
writeFileSync(join(ROOT, 'lib', 'client.js'), out)
console.log('client.js written,', out.length, 'bytes ·', parts.length, 'parts ·', seen.size, 'top-level symbols checked')
