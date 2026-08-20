
    /* ============================ 模块出口 ============================ */
    exports.name = 'dsh-geek-sidebar'
    exports.inject = ['sessions', 'slots']
    exports.apply = function apply(ctx) {
      /* filemention 必须先于 workbench：后者经 fileMentionBridge 惰性取用
       *（ctx.get 在 fiber 启动态拿不到，见 head.js 桥注释） */
      try { applyFilemention(ctx) } catch (e) { console.error('[dsh-geek-sidebar] filemention 挂载失败', e) }
      try { applySkillsUI(ctx) } catch (e) { console.error('[dsh-geek-sidebar] skills 挂载失败', e) }
      try { workbenchMod.apply(ctx) } catch (e) { console.error('[dsh-geek-sidebar] workbench 挂载失败', e) }
    }

    return module.exports
  },
})
