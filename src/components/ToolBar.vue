<script setup lang="ts">
import { ElButton, ElIcon, ElTooltip } from 'element-plus'
import {
  Pointer,
  ZoomIn,
  ZoomOut,
  FullScreen,
  RefreshLeft,
  RefreshRight,
  Delete,
  DeleteFilled,
  DocumentChecked,
} from '@element-plus/icons-vue'
import type { ToolMode } from '../constants'

defineProps<{
  mode: ToolMode
  zoomPercent: number
  canUndo: boolean
  canRedo: boolean
  hasSelected: boolean
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
</script>

<template>
  <div class="ic-toolbar">
    <!-- 绘制工具 -->
    <div class="ic-toolbar-group">
      <el-tooltip content="选择 / 平移（拖动空白平移，滚轮缩放）">
        <el-button
          size="small"
          :type="mode === 'pan' ? 'primary' : 'default'"
          @click="emit('set-mode', 'pan')"
        >
          <el-icon><Pointer /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="矩形标注（按住拖拽绘制）">
        <el-button
          size="small"
          :type="mode === 'rect' ? 'primary' : 'default'"
          @click="emit('set-mode', 'rect')"
        >
          <el-icon>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="圆形标注（按住拖拽绘制）">
        <el-button
          size="small"
          :type="mode === 'circle' ? 'primary' : 'default'"
          @click="emit('set-mode', 'circle')"
        >
          <el-icon>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="多边形标注（逐点点击，双击/回车结束，ESC 取消）">
        <el-button
          size="small"
          :type="mode === 'polygon' ? 'primary' : 'default'"
          @click="emit('set-mode', 'polygon')"
        >
          <el-icon>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <polygon points="12,3.5 21,18 3,18" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 视图控制 -->
    <div class="ic-toolbar-group">
      <el-tooltip content="缩小">
        <el-button size="small" @click="emit('zoom-out')">
          <el-icon><ZoomOut /></el-icon>
        </el-button>
      </el-tooltip>
      <span class="ic-zoom-text">{{ zoomPercent }}%</span>
      <el-tooltip content="放大">
        <el-button size="small" @click="emit('zoom-in')">
          <el-icon><ZoomIn /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="适应视野">
        <el-button size="small" @click="emit('fit')">
          <el-icon><FullScreen /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 撤销 / 重做 -->
    <div class="ic-toolbar-group">
      <el-tooltip content="撤销（Ctrl+Z）">
        <el-button size="small" :disabled="!canUndo" @click="emit('undo')">
          <el-icon><RefreshLeft /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="反撤销（Ctrl+Shift+Z / Ctrl+Y）">
        <el-button size="small" :disabled="!canRedo" @click="emit('redo')">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <span class="ic-toolbar-sep" />

    <!-- 删除 / 清空 -->
    <div class="ic-toolbar-group">
      <el-tooltip content="删除选中标注（Delete）">
        <el-button size="small" :disabled="!hasSelected" @click="emit('delete')">
          <el-icon><Delete /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="清空当前图片标注">
        <el-button size="small" @click="emit('clear')">
          <el-icon><DeleteFilled /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <div class="ic-toolbar-spacer" />

    <el-button size="small" type="primary" @click="emit('save')">
      <el-icon style="margin-right: 4px"><DocumentChecked /></el-icon>
      保存
    </el-button>
  </div>
</template>
