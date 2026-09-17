import { createApp } from 'vue'
import ImageCaptionPlugin from '../../src/index'
import App from './App.vue'

const app = createApp(App)

// 组件库插件注册：app.use 后即可全局使用 <ImageCaption />（零 UI 框架依赖）
app.use(ImageCaptionPlugin)

app.mount('#app')
