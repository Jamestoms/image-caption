import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ImageCaptionPlugin from '../../src/index'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus)
// 组件库插件注册：app.use 后即可全局使用 <ImageCaption />
app.use(ImageCaptionPlugin)

app.mount('#app')
