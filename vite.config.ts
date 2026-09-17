import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

// 库构建时外部化的依赖（vue 为 peer；fabric 为 dependencies，运行时从宿主环境解析）
const externalDeps = ['vue', 'fabric']

export default defineConfig(({ command }) => {
  const isLib = command === 'build'

  return {
    plugins: [
      vue(),
      dts({
        tsconfigPath: './tsconfig.json',
        outDir: 'dist/types',
        include: ['src/**/*'],
      }),
    ],
    build: isLib
      ? {
          lib: {
            entry: 'src/index.ts',
            name: 'ImageCaption',
            fileName: 'image-caption',
            formats: ['es', 'umd'],
          },
          rollupOptions: {
            external: externalDeps,
            output: {
              globals: {
                vue: 'Vue',
                fabric: 'fabric',
              },
            },
          },
          outDir: 'dist',
        }
      : {
          outDir: 'dist-demo',
        },
  }
})
