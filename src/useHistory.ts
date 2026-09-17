import { ref } from 'vue'
import type { Ref } from 'vue'
import type { AnnotationData } from './types'
import { deepClone } from './utils'
import { MAX_HISTORY } from './constants'

interface HistoryStack {
  list: AnnotationData[][]
  index: number
}

/**
 * 撤销/反撤销历史栈（快照模式）
 * 每张图片独立记录，覆盖：新增、删除、移动、标签修改、清空
 */
export function useHistory() {
  /** imageId -> 历史栈 */
  const stacks = new Map<string, HistoryStack>()
  const canUndo: Ref<boolean> = ref(false)
  const canRedo: Ref<boolean> = ref(false)
  /** 当前历史栈对应的图片 id */
  let currentId = ''

  function updateFlags() {
    const s = stacks.get(currentId)
    canUndo.value = !!s && s.index > 0
    canRedo.value = !!s && s.index >= 0 && s.index < s.list.length - 1
  }

  /** 设置当前图片（用于 canUndo/canRedo 标记计算） */
  function setCurrent(imageId: string) {
    currentId = imageId
    updateFlags()
  }

  /** 初始化某张图片的历史栈（已有数据作为初始快照，不可撤销到更早） */
  function init(imageId: string, annotations: AnnotationData[]) {
    stacks.set(imageId, { list: [deepClone(annotations)], index: 0 })
    if (imageId === currentId) updateFlags()
  }

  /** 某图片是否已有历史栈 */
  function has(imageId: string): boolean {
    return stacks.has(imageId)
  }

  /** 提交一次变更快照 */
  function commit(imageId: string, annotations: AnnotationData[]) {
    let s = stacks.get(imageId)
    if (!s) {
      s = { list: [], index: -1 }
      stacks.set(imageId, s)
    }
    // 截断撤销指针之后的分支（新操作使 redo 失效）
    s.list = s.list.slice(0, s.index + 1)
    s.list.push(deepClone(annotations))
    if (s.list.length > MAX_HISTORY) {
      s.list.shift()
    }
    s.index = s.list.length - 1
    if (imageId === currentId) updateFlags()
  }

  /** 撤销：返回上一个快照（已深拷贝），无可撤销时返回 null */
  function undo(imageId: string): AnnotationData[] | null {
    const s = stacks.get(imageId)
    if (!s || s.index <= 0) return null
    s.index -= 1
    if (imageId === currentId) updateFlags()
    return deepClone(s.list[s.index])
  }

  /** 反撤销：返回下一个快照（已深拷贝），无可重做时返回 null */
  function redo(imageId: string): AnnotationData[] | null {
    const s = stacks.get(imageId)
    if (!s || s.index < 0 || s.index >= s.list.length - 1) return null
    s.index += 1
    if (imageId === currentId) updateFlags()
    return deepClone(s.list[s.index])
  }

  return { canUndo, canRedo, setCurrent, init, has, commit, undo, redo }
}
