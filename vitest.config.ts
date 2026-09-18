import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    // HTML 报告器（官方文档：https://cn.vitest.dev/guide/reporters.html#html-报告器）
    // - 需要安装 @vitest/ui（已安装）
    // - singleFile: 生成自包含单文件（资源全部内联，便于分享）
    // - 输出位置：默认 .vitest/index.html（如需自定义目录用报告器自身的 outputDir 选项）
    reporters: ['default', ['html', { singleFile: true }]],
  },
})
