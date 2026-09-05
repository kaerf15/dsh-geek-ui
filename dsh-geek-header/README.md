# dsh-geek-header

DSH Web 会话页头重排插件：第一行第三方插件区，第二行页签/谱系/动作收纳成统一分段条。

## 安装

```bash
dsh plugin --profile web add dsh-geek-header
```

## 布局

```
┌──────────────────────────────────────────────┐
│ [第三方插件区 · geekUiHeader]                 │  ← 第一行，空则整行塌陷
│ [对话][轨迹][生成标题][谱系][动作区…][⋯]      │  ← 第二行，pi-web 式分段条
└──────────────────────────────────────────────┘
                          ⋯ = 「更多」：拥挤时收动作区，Session log 总在里头
```

- **第一行**：第三方插件区，官方不放任何内容。
- **第二行分段条**：页签 + 生成标题 + 子代理谱系 + actions 槽各项，全部压平成统一格子
  （hairline 边框、36px 通高、无缝接缝）。actions 槽按 `> *` 套格子——第三方注册任何形状都自动统一。
- **⋯ 折叠开关**：仅拥挤（条带放不下）时出现，钉在条带**最右侧**，面板右对齐展开；
  放得下时所有内容一律平铺，不折叠。点击外部或再次点击收起。
- **隐藏**：面包屑标题文字与 `/` 分隔符；utilities 槽（Session log 按钮）整段隐藏，导出走 `/export` 命令。
- **生成标题**：点击后按整段对话用当前选中的模型生成会话标题；生成中/成功/失败均有即时反馈，空会话禁用。

## 第三方插件接入（第一行）

client 半插件里通过 cordis 服务注册：

```js
export const inject = ['geekUiHeader']

export function apply(ctx) {
  ctx.geekUiHeader.register({
    id: 'my-entry',           // 唯一 id
    order: 0,                  // 升序渲染，可选
    component: ({ sessionId }) => /* React 元素 */,
  })
  // register 返回注销函数；建议挂进 ctx.effect 的 disposer 随 Fiber 回收
}
```

`component` 是 React 函数组件，props 为 `{ sessionId }`（无当前会话时为 `undefined`）。
`react` / `react-dom/client` 从模块表 `require` 即可，无需打包进自己的 bundle。

## 兼容

`dsh.verifiedWith: 0.1.2-rc.1`

## License

MIT
