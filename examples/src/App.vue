<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import type { AnnotationData, ImageItem } from '../../src/index'

/** 生成 SVG data-url 图片（demo 无网络依赖） */
function makeSvgImage(w: number, h: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const images = ref<ImageItem[]>([
  {
    id: 'img-1',
    name: '风景图 1200x800',
    url: makeSvgImage(
      1200,
      800,
      `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#aee3ff"/><stop offset="1" stop-color="#f6fbff"/>
        </linearGradient>
        <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7cc08b"/><stop offset="1" stop-color="#4e9a63"/>
        </linearGradient>
        <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9fd0a9"/><stop offset="1" stop-color="#6aab7c"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="950" cy="170" r="70" fill="#ffd66b"/>
      <path d="M0,640 L260,360 L520,640 Z" fill="url(#hill1)"/>
      <path d="M380,640 L680,300 L980,640 Z" fill="url(#hill2)"/>
      <path d="M820,640 L1060,420 L1200,560 L1200,640 Z" fill="url(#hill1)"/>
      <rect y="640" width="1200" height="160" fill="#3d7d52"/>
      <path d="M0,640 Q300,600 600,640 T1200,640 L1200,800 L0,800 Z" fill="#4a8f5f"/>
      <text x="40" y="70" font-size="42" fill="#5b7a99" font-family="sans-serif">Scene 1200 x 800</text>
      `
    ),
    // 回显示例：加载后直接显示以下标注
    annotations: [
      {
        id: 'demo-a1',
        type: 'rect',
        label: '太阳',
        x: 880,
        y: 100,
        width: 140,
        height: 140,
      },
      {
        id: 'demo-a2',
        type: 'polygon',
        label: '大山',
        points: [
          { x: 380, y: 640 },
          { x: 680, y: 300 },
          { x: 980, y: 640 },
        ],
      },
    ] as AnnotationData[],
  },
  {
    id: 'img-2',
    name: '街景图 900x900',
    url: makeSvgImage(
      900,
      900,
      `
      <rect width="900" height="900" fill="#dfe7ef"/>
      <rect x="80" y="120" width="200" height="420" fill="#8aa8c4"/>
      <rect x="340" y="200" width="180" height="340" fill="#a3bed8"/>
      <rect x="580" y="100" width="240" height="560" fill="#7c9cbf"/>
      <rect x="60" y="620" width="780" height="80" fill="#b9c6d4"/>
      <rect y="700" width="900" height="200" fill="#6f7d8c"/>
      <rect x="300" y="740" width="120" height="70" fill="#c9a07a"/>
      <rect x="560" y="750" width="140" height="60" fill="#c9a07a"/>
      <text x="40" y="70" font-size="36" fill="#55677a" font-family="sans-serif">Street 900 x 900</text>
      `
    ),
  },
  {
    id: 'img-3',
    name: '宽幅图 1600x600',
    url: makeSvgImage(
      1600,
      600,
      `
      <defs>
        <linearGradient id="g3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#364f6b"/><stop offset="0.5" stop-color="#3fc1c9"/><stop offset="1" stop-color="#f5f0da"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="600" fill="url(#g3)"/>
      <circle cx="400" cy="300" r="110" fill="#fc5185" opacity="0.85"/>
      <circle cx="800" cy="300" r="110" fill="#fcd44d" opacity="0.85"/>
      <circle cx="1200" cy="300" r="110" fill="#77e08a" opacity="0.85"/>
      <text x="40" y="70" font-size="40" fill="#ffffff" font-family="sans-serif">Panorama 1600 x 600</text>
      `
    ),
  },
])

const presetLabels = ['行人', '车辆', '建筑', '植被', '天空', '道路']

const captionRef = ref<any>(null)

function handleSave(imageId: string, annotations: AnnotationData[]) {
  console.log('[demo] save:', imageId, annotations)
  ElMessage.success(`已保存图片 ${imageId} 的 ${annotations.length} 条标注，数据见控制台`)
}

function handleChange(imageId: string, annotations: AnnotationData[]) {
  // 标注数据变化时触发，可在此做自动暂存等
  console.log('[demo] change:', imageId, annotations.length)
}

function showAllData() {
  const all = captionRef.value?.getAllAnnotations?.()
  ElMessageBox.alert(
    `<pre style="max-height:420px;overflow:auto;font-size:12px;">${JSON.stringify(
      all,
      null,
      2
    ).replace(/</g, '&lt;')}</pre>`,
    '全部标注数据',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '关闭',
    }
  ).catch(() => {})
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-header">
      <div>
        <h2 class="demo-title">ImageCaption 图片标注组件 Demo</h2>
        <p class="demo-desc">
          滚轮缩放 / 空白处拖动平移 · 矩形、圆形拖拽绘制 · 多边形逐点点击（双击或回车结束，ESC
          取消）· 点击标注可选中、拖动、改标签、删除 · Ctrl+Z / Ctrl+Shift+Z 撤销重做
        </p>
      </div>
      <div class="demo-header-actions">
        <el-button @click="showAllData">获取全部标注数据</el-button>
      </div>
    </div>

    <ImageCaption
      ref="captionRef"
      class="demo-caption"
      :images="images"
      :labels="presetLabels"
      :on-save="handleSave"
      @change="handleChange"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
}

body {
  background: #f0f2f5;
}

.demo-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}

.demo-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.demo-title {
  font-size: 20px;
  color: #303133;
  margin-bottom: 8px;
}

.demo-desc {
  font-size: 13px;
  color: #909399;
  line-height: 1.7;
}

.demo-caption {
  height: 660px;
}
</style>
