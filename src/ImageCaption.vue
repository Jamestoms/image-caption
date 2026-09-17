<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ToolBar from './components/ToolBar.vue'
import ThumbnailList from './components/ThumbnailList.vue'
import LabelPopover from './components/LabelPopover.vue'
import { useCanvasEngine } from './useCanvasEngine'
import type { CanvasEngine } from './useCanvasEngine'
import type { AllAnnotations, AnnotationData, ImageItem, SaveHandler } from './types'
import { clamp } from './utils'

const props = withDefaults(
  defineProps<{
    /** 图片列表（项内含已有标注则回显） */
    images: ImageItem[]
    /** 预设标签列表，标签输入时可选择 */
    labels?: string[]
    /** 保存处理函数 */
    onSave?: SaveHandler
  }>(),
  {
    images: () => [],
    labels: () => [],
    onSave: undefined,
  }
)

const emit = defineEmits<{
  (e: 'save', imageId: string, annotations: AnnotationData[]): void
  (e: 'change', imageId: string, annotations: AnnotationData[]): void
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
  if (!label) {
    ElMessage.warning('请输入或选择标签名称')
    return
  }
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
  if (!engine.getAnnotations().length) {
    ElMessage.info('当前图片暂无标注')
    return
  }
  ElMessageBox.confirm('确定清空当前图片的全部标注吗？', '提示', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      engine.clearCurrent()
    })
    .catch(() => {})
}

function handleSave() {
  const imageId = engine.currentImageId.value
  if (!imageId) {
    ElMessage.warning('暂无图片')
    return
  }
  const list = engine.getAnnotations(imageId)
  emit('save', imageId, list)
  props.onSave?.(imageId, list)
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
  /** 切换图片 */
  switchImage,
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
        @set-mode="engine.setMode"
        @zoom-in="engine.zoomIn"
        @zoom-out="engine.zoomOut"
        @fit="engine.fitView"
        @undo="engine.undo"
        @redo="engine.redo"
        @delete="engine.deleteSelected"
        @clear="handleClear"
        @save="handleSave"
      />
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
    </div>
  </div>
</template>
