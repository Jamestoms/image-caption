<script setup lang="ts">
import type { ImageItem } from '../types'

defineProps<{
  images: ImageItem[]
  currentId: string
  counts: Record<string, number>
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()
</script>

<template>
  <div class="ic-thumbnails">
    <div
      v-for="img in images"
      :key="img.id"
      class="ic-thumb-item"
      :class="{ active: img.id === currentId }"
      @click="emit('select', img.id)"
    >
      <div class="ic-thumb-img">
        <img :src="img.url" :alt="img.name || img.id" loading="lazy" draggable="false" />
      </div>
      <div class="ic-thumb-name" :title="img.name || img.id">{{ img.name || img.id }}</div>
      <span v-if="counts[img.id]" class="ic-thumb-count">{{ counts[img.id] }}</span>
    </div>
    <div v-if="!images.length" class="ic-thumb-empty">暂无图片</div>
  </div>
</template>
