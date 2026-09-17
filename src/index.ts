import type { App, Plugin } from 'vue'
import ImageCaption from './ImageCaption.vue'
import './styles/index.css'

// element-plus 按需样式（组件库内部使用的组件，保证宿主未引入 EP 样式时正常显示）
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/icon/style/css'
import 'element-plus/es/components/tooltip/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

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
