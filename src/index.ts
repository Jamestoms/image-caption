import type { App, Plugin } from 'vue'
import ImageCaption from './ImageCaption.vue'
import './styles/index.css'

export * from './types'

/** vue 插件：app.use(ImageCaptionPlugin) 全局注册 <ImageCaption /> */
const plugin: Plugin = {
  install(app: App) {
    app.component('ImageCaption', ImageCaption)
  },
}

// 具名导入时也支持 app.use(ImageCaption)
;(ImageCaption as unknown as { install?: Plugin['install'] }).install = plugin.install

export { ImageCaption }

export default plugin
