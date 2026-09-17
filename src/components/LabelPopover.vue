<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import LabelSelect from './LabelSelect.vue'

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
const error = ref('')

watch(
  () => props.visible,
  (v) => {
    if (v) {
      error.value = ''
      nextTick(() => {
        rootRef.value?.querySelector('input')?.focus()
      })
    }
  }
)

watch(
  () => props.modelValue,
  () => {
    error.value = ''
  }
)

function confirm() {
  if (!props.modelValue.trim()) {
    error.value = '请输入或选择标签名称'
    rootRef.value?.querySelector('input')?.focus()
    return
  }
  emit('confirm')
}
</script>

<template>
  <div v-if="visible" ref="rootRef" class="ic-label-popover" :style="{ left: `${x}px`, top: `${y}px` }">
    <div class="ic-label-popover-title">
      {{ mode === 'create' ? '新标注' : '编辑标注' }}
    </div>
    <LabelSelect
      :model-value="modelValue"
      :options="labels"
      placeholder="输入或选择标签名称"
      @update:model-value="emit('update:modelValue', $event)"
      @confirm="confirm"
    />
    <div v-if="error" class="ic-label-popover-error">{{ error }}</div>
    <div class="ic-label-popover-actions">
      <button v-if="mode === 'edit'" type="button" class="ic-btn ic-btn--danger-plain" @click="emit('delete')">
        删除
      </button>
      <span class="ic-label-popover-spacer" />
      <button type="button" class="ic-btn" @click="emit('cancel')">取消</button>
      <button type="button" class="ic-btn ic-btn--primary" @click="confirm">确定</button>
    </div>
  </div>
</template>
