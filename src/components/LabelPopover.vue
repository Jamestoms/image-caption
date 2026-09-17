<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ElButton, ElSelect, ElOption } from 'element-plus'

const props = defineProps<{
  visible: boolean
  /** create：新绘制标注输入标签；edit：编辑选中标注 */
  mode: 'create' | 'edit'
  labels: string[]
  modelValue: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'delete'): void
}>()

// 浮层根元素（通过 DOM 方式聚焦内部输入框，避免组件实例类型泄漏到 .d.ts）
const rootRef = ref<HTMLElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      nextTick(() => {
        rootRef.value?.querySelector('input')?.focus()
      })
    }
  }
)
</script>

<template>
  <div v-if="visible" ref="rootRef" class="ic-label-popover" :style="{ left: `${x}px`, top: `${y}px` }">">
    <div class="ic-label-popover-title">
      {{ mode === 'create' ? '新标注' : '编辑标注' }}
    </div>
    <el-select
      :model-value="modelValue"
      allow-create
      filterable
      clearable
      default-first-option
      placeholder="输入或选择标签名称"
      size="default"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('confirm')"
    >
      <el-option v-for="l in labels" :key="l" :label="l" :value="l" />
    </el-select>
    <div class="ic-label-popover-actions">
      <el-button v-if="mode === 'edit'" size="small" type="danger" plain @click="emit('delete')">
        删除
      </el-button>
      <span class="ic-label-popover-spacer" />
      <el-button size="small" @click="emit('cancel')">取消</el-button>
      <el-button size="small" type="primary" @click="emit('confirm')">确定</el-button>
    </div>
  </div>
</template>
