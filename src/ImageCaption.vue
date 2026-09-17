<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ToolBar from './components/ToolBar.vue'
import ThumbnailList from './components/ThumbnailList.vue'
import LabelPopover from './components/LabelPopover.vue'
import { useCanvasEngine } from './useCanvasEngine'
import type { CanvasEngine } from './useCanvasEngine'
import type { AllAnnotations, AnnotationData, ImageItem } from './types'
import { clamp } from './utils'

const props = withDefaults(
  defineProps<{
    /** 图片列表（项内含已有标注则回显） */
    images: ImageItem[]
    /** 预设标签列表，标签输入时可选择 */
    labels?: string[]
    /** 是否开启下载功能（工具栏显示下载按钮，导出含标注的图片） */
    downloadable?: boolean
  }>(),
  {
    images: () => [],
    labels: () => [],
    downloadable: false,
  }
)

const emit = defineEmits<{
  (e: 'change', imageId: string, annotations: AnnotationData[]): void
  (e: 'download', imageId: string, filename: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapRef = ref<HTMLDivElement | null>(null)

/** 标签输入浮层状态 */
const popover = reactive({
  visible: false,
  mode: 'create' as 'create' | 'edit',
  label: '',
  x: 0,
  y: 0,
})

// engine 回调中访问 engine 自身（定义时还未赋值，运行时已就绪）
let self: CanvasEngine

const engine = useCanvasEngine({
  onChange(imageId, list) {
    emit('change', imageId, list)
  },
  onSelect(id, label) {
    if (id) {
      const screen = self.getSelectedScreenPoint()
      if (screen) openPopover('edit', label, screen)
    } else {
      closePopover()
    }
  },
  onPendingDrawn({ screen }) {
    openPopover('create', '', screen)
  },
  onPendingCancelled() {
    if (popover.mode === 'create') closePopover()
  },
})
self = engine

const {
  mode,
  currentImageId,
  imageLoaded,
  imageError,
  selectedId,
  zoomPercent,
  annotationCounts,
  canUndo,
  canRedo,
} = engine

// ---------- 浮层 ----------

const POPOVER_WIDTH = 268
const POPOVER_HEIGHT = 132

function openPopover(
  mode: 'create' | 'edit',
  label: string,
  screen: { x: number; y: number }
) {
  const wrap = wrapRef.value
  const w = wrap ? wrap.clientWidth : 0
  const h = wrap ? wrap.clientHeight : 0
  popover.x = clamp(screen.x - POPOVER_WIDTH / 2, 8, Math.max(w - POPOVER_WIDTH - 8, 8))
  // 优先显示在标注上方
  popover.y = clamp(screen.y - POPOVER_HEIGHT - 24, 8, Math.max(h - POPOVER_HEIGHT - 8, 8))
  popover.mode = mode
  popover.label = label
  popover.visible = true
}

function closePopover() {
  popover.visible = false
}

function handlePopoverConfirm() {
  const label = popover.label.trim()
  if (!label) return // 空标签校验与提示由浮层内部完成，此处兜底
  if (popover.mode === 'create') {
    engine.confirmPending(label)
  } else {
    engine.updateSelectedLabel(label)
  }
  closePopover()
}

function handlePopoverCancel() {
  if (popover.mode === 'create') {
    engine.cancelPending()
  }
  closePopover()
}

function handlePopoverDelete() {
  engine.deleteSelected()
  closePopover()
}

// ---------- 工具栏 ----------

function handleClear() {
  // 二次确认由工具栏按钮的确认态交互完成，此处直接执行
  engine.clearCurrent()
}

// ---------- 图片下载 ----------

/** 轻量提示条（替代全局 Message，避免 UI 框架依赖） */
const toast = reactive({
  visible: false,
  text: '',
  type: 'success' as 'success' | 'error',
})
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(text: string, type: 'success' | 'error') {
  toast.text = text
  toast.type = type
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
  }, 2600)
}

function handleDownload() {
  const imageId = engine.currentImageId.value
  if (!imageId) return
  const dataUrl = engine.exportImage()
  if (!dataUrl) {
    showToast('导出失败，请重试', 'error')
    return
  }
  // 文件名：图片名（去扩展名）-annotated.png，无名时用图片 id
  const item = props.images.find((i) => i.id === imageId)
  const base = (item?.name || imageId).replace(/\.[^.]+$/, '')
  const filename = `${base}-annotated.png`

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  emit('download', imageId, filename)
  showToast(`已导出：${filename}`, 'success')
}

// ---------- 图片 ----------

function handleSelectImage(id: string) {
  const img = props.images.find((i) => i.id === id)
  if (img) {
    closePopover()
    engine.loadImage(img)
  }
}

function switchImage(id: string) {
  handleSelectImage(id)
}

watch(
  () => props.images,
  (list) => {
    engine.preloadAnnotations(list)
    if (!list.some((i) => i.id === engine.currentImageId.value)) {
      closePopover()
      if (list.length) engine.loadImage(list[0])
    }
  }
)

// ---------- 键盘 ----------

function onKeydown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const inInput =
    !!t &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as unknown as any).isContentEditable)
  if (inInput) return
  const key = e.key.toLowerCase()
  if ((e.ctrlKey || e.metaKey) && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) engine.redo()
    else engine.undo()
  } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
    e.preventDefault()
    engine.redo()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (engine.selectedId.value) {
      e.preventDefault()
      engine.deleteSelected()
    }
  } else if (e.key === 'Escape') {
    if (popover.visible) handlePopoverCancel()
    else engine.handleEscape()
  } else if (e.key === 'Enter') {
    engine.handleEnter()
  }
}

// ---------- 生命周期 ----------

onMounted(() => {
  if (canvasRef.value && wrapRef.value) {
    engine.init(canvasRef.value, wrapRef.value)
  }
  if (props.images.length) {
    engine.preloadAnnotations(props.images)
    engine.loadImage(props.images[0])
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (toastTimer) clearTimeout(toastTimer)
  engine.destroy()
})

// ---------- 对外方法（ref 调用） ----------

function getAnnotations(imageId?: string): AnnotationData[] {
  return engine.getAnnotations(imageId)
}

function getAllAnnotations(): AllAnnotations {
  return engine.getAllAnnotations()
}

function undo() {
  engine.undo()
}

function redo() {
  engine.redo()
}

function deleteSelected() {
  engine.deleteSelected()
}

function clearCurrent() {
  engine.clearCurrent()
}

function zoomIn() {
  engine.zoomIn()
}

function zoomOut() {
  engine.zoomOut()
}

function fitView() {
  engine.fitView()
}

function exportImage(): string | null {
  return engine.exportImage()
}

defineExpose({
  /** 获取标注数据（不传 imageId 为当前图片） */
  getAnnotations,
  /** 获取全部图片标注数据 */
  getAllAnnotations,
  /** 撤销 */
  undo,
  /** 反撤销 */
  redo,
  /** 删除当前选中标注 */
  deleteSelected,
  /** 清空当前图片标注 */
  clearCurrent,
  /** 放大 */
  zoomIn,
  /** 缩小 */
  zoomOut,
  /** 适应视野 */
  fitView,
  /** 导出当前图片（含标注）的 PNG dataURL（原始像素尺寸） */
  exportImage,
  /** 切换图片 */
  switchImage,
  /** 当前图片 id（无图时为空字符串） */
  currentImageId: engine.currentImageId,
})
</script>

<template>
  <div class="ic-container">
    <ThumbnailList
      :images="images"
      :current-id="currentImageId"
      :counts="annotationCounts"
      @select="handleSelectImage"
    />
    <div class="ic-main">
      <ToolBar
        :mode="mode"
        :zoom-percent="zoomPercent"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :has-selected="!!selectedId"
        :has-image="!!currentImageId"
        :has-annotations="(annotationCounts[currentImageId] || 0) > 0"
        :downloadable="downloadable"
        @set-mode="engine.setMode"
        @zoom-in="engine.zoomIn"
        @zoom-out="engine.zoomOut"
        @fit="engine.fitView"
        @undo="engine.undo"
        @redo="engine.redo"
        @delete="engine.deleteSelected"
        @clear="handleClear"
        @download="handleDownload"
      >
        <template #actions>
          <slot name="actions" />
        </template>
      </ToolBar>
      <div ref="wrapRef" class="ic-canvas-wrap">
        <canvas ref="canvasRef" class="ic-canvas" />
        <LabelPopover
          v-model="popover.label"
          :visible="popover.visible"
          :mode="popover.mode"
          :labels="labels"
          :x="popover.x"
          :y="popover.y"
          @confirm="handlePopoverConfirm"
          @cancel="handlePopoverCancel"
          @delete="handlePopoverDelete"
        />
        <div v-if="imageError" class="ic-empty">{{ imageError }}</div>
        <div v-else-if="!images.length" class="ic-empty">暂无图片</div>
        <div v-else-if="!imageLoaded" class="ic-empty">图片加载中…</div>
      </div>
      <div v-if="toast.visible" class="ic-toast" :class="`is-${toast.type}`">{{ toast.text }}</div>
    </div>
  </div>
</template>
