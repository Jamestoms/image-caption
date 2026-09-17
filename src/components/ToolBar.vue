<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { ToolMode } from '../constants'

defineProps<{
  mode: ToolMode
  zoomPercent: number
  canUndo: boolean
  canRedo: boolean
  hasSelected: boolean
  hasImage: boolean
  hasAnnotations: boolean
}>()

const emit = defineEmits<{
  (e: 'set-mode', mode: ToolMode): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'fit'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'delete'): void
  (e: 'clear'): void
  (e: 'save'): void
}>()

// 清空二次确认：首次点击进入确认态（按钮变红），3 秒内再次点击执行，超时自动还原
const confirmingClear = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | undefined

function handleClearClick() {
  if (confirmingClear.value) {
    confirmingClear.value = false
    if (clearTimer) clearTimeout(clearTimer)
    emit('clear')
  } else {
    confirmingClear.value = true
    clearTimer = setTimeout(() => {
      confirmingClear.value = false
    }, 3000)
  }
}

onBeforeUnmount(() => {
  if (clearTimer) clearTimeout(clearTimer)
})
</script>

<template>
  <div class="ic-toolbar">
    <!-- 绘制工具 -->
    <div class="ic-toolbar-group">
      <div class="ic-tip">
        <button
          type="button"
          class="ic-btn ic-btn--icon"
          :class="{ 'is-active': mode === 'pan' }"
          @click="emit('set-mode', 'pan')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M5 2 5 18 9.5 14.5 12 20.5 14.5 19.5 12 13.5 18 13 Z" fill="currentColor" />
          </svg>
        </button>
        <span class="ic-tip__bubble">选择 / 平移（空白拖动平移，滚轮缩放）</span>
      </div>
      <div class="ic-tip">
        <button
          type="button"
          class="ic-btn ic-btn--icon"
          :class="{ 'is-active': mode === 'rect' }"
          @click="emit('set-mode', 'rect')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <span class="ic-tip__bubble">矩形标注（按住拖拽绘制）</span>
      </div>
      <div class="ic-tip">
        <button
          type="button"
          class="ic-btn ic-btn--icon"
          :class="{ 'is-active': mode === 'circle' }"
          @click="emit('set-mode', 'circle')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <span class="ic-tip__bubble">圆形标注（按住拖拽绘制）</span>
      </div>
      <div class="ic-tip">
        <button
          type="button"
          class="ic-btn ic-btn--icon"
          :class="{ 'is-active': mode === 'polygon' }"
          @click="emit('set-mode', 'polygon')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <polygon points="12,3.5 21,18 3,18" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <span class="ic-tip__bubble">多边形标注（逐点点击，双击或回车结束，ESC 取消）</span>
      </div>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 视图控制 -->
    <div class="ic-toolbar-group">
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" @click="emit('zoom-out')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
            <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <line x1="7.5" y1="10.5" x2="13.5" y2="10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <span class="ic-tip__bubble">缩小</span>
      </div>
      <span class="ic-zoom-text">{{ zoomPercent }}%</span>
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" @click="emit('zoom-in')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
            <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <line x1="7.5" y1="10.5" x2="13.5" y2="10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <line x1="10.5" y1="7.5" x2="10.5" y2="13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <span class="ic-tip__bubble">放大</span>
      </div>
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" @click="emit('fit')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <span class="ic-tip__bubble">适应视野</span>
      </div>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 撤销 / 重做 -->
    <div class="ic-toolbar-group">
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" :disabled="!canUndo" @click="emit('undo')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M8 4 3.5 8.5 8 13"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M3.5 8.5H14a6 6 0 0 1 0 12h-3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <span class="ic-tip__bubble">撤销（Ctrl+Z）</span>
      </div>
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" :disabled="!canRedo" @click="emit('redo')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M16 4l4.5 4.5L16 13"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M20.5 8.5H10a6 6 0 0 0 0 12h3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <span class="ic-tip__bubble">反撤销（Ctrl+Shift+Z / Ctrl+Y）</span>
      </div>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 删除 / 清空 -->
    <div class="ic-toolbar-group">
      <div class="ic-tip">
        <button type="button" class="ic-btn ic-btn--icon" :disabled="!hasSelected" @click="emit('delete')">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l1 14h9l1-14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M10.5 10.5v6M13.5 10.5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <span class="ic-tip__bubble">删除选中标注（Delete）</span>
      </div>
      <div class="ic-tip">
        <button
          type="button"
          class="ic-btn ic-btn--icon"
          :class="{ 'is-danger': confirmingClear }"
          :disabled="!hasAnnotations"
          :title="confirmingClear ? '' : '清空当前图片标注'"
          @click="handleClearClick"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M4.5 6.5h15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path
              d="M9.5 6.5v-2h5v2"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M6.5 6.5l1 14h9l1-14z" fill="currentColor" />
          </svg>
          <span v-if="confirmingClear" class="ic-btn__text">确认清空？</span>
        </button>
        <span class="ic-tip__bubble" :class="{ 'is-hidden': confirmingClear }">清空当前图片标注</span>
      </div>
    </div>

    <div class="ic-toolbar-spacer" />

    <button type="button" class="ic-btn ic-btn--primary" :disabled="!hasImage" @click="emit('save')">
      <svg viewBox="0 0 24 24" width="14" height="14" style="margin-right: 4px">
        <path
          d="M6 2.5h8.5L19 7v14.5H6z"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path d="M14 2.5V7h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        <path
          d="m9.5 13.5 2.5 2.5 5-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      保存
    </button>
  </div>
</template>
