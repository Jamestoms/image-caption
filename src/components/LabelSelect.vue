<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 自绘标签选择下拉：可自由输入，也可从预设列表中选择（支持过滤与键盘导航）
 * 替代 element-plus 的 el-select（allow-create + filterable 场景）
 */
const props = defineProps<{
  modelValue: string
  options: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  /** 选中预设项或按回车确认输入值 */
  (e: 'confirm'): void
}>()

const open = ref(false)
const highlight = ref(0)

const filtered = computed(() => {
  const kw = props.modelValue.trim().toLowerCase()
  if (!kw) return props.options
  return props.options.filter((o) => o.toLowerCase().includes(kw))
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  open.value = true
  highlight.value = 0
}

function select(val: string) {
  emit('update:modelValue', val)
  open.value = false
  emit('confirm')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    open.value = true
    if (filtered.value.length) {
      highlight.value = (highlight.value + 1) % filtered.value.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (filtered.value.length) {
      highlight.value = (highlight.value - 1 + filtered.value.length) % filtered.value.length
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (open.value && filtered.value.length) {
      select(filtered.value[highlight.value])
    } else {
      open.value = false
      emit('confirm')
    }
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="ic-select">
    <input
      class="ic-select__input"
      type="text"
      autocomplete="off"
      :value="modelValue"
      :placeholder="placeholder || '输入或选择'"
      @input="onInput"
      @focus="open = true"
      @blur="open = false"
      @keydown="onKeydown"
    />
    <div v-if="open && filtered.length" class="ic-select__dropdown">
      <div
        v-for="(opt, i) in filtered"
        :key="opt"
        class="ic-select__option"
        :class="{ 'is-active': i === highlight }"
        @mousedown.prevent="select(opt)"
        @mousemove="highlight = i"
      >
        {{ opt }}
      </div>
    </div>
  </div>
</template>
