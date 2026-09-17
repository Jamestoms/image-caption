import { describe, expect, it } from 'vitest'
import { useHistory } from '../src/useHistory'
import { MAX_HISTORY } from '../src/constants'
import type { AnnotationData } from '../src/types'

function anno(id: string, label = ''): AnnotationData {
  return { id, type: 'rect', label, x: 1, y: 2, width: 10, height: 20 }
}

describe('useHistory', () => {
  it('init 初始快照不可撤销', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
    expect(h.undo('img-1')).toBeNull()
    expect(h.redo('img-1')).toBeNull()
  })

  it('commit 后可撤销，undo 返回上一快照的深拷贝', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    h.commit('img-1', [anno('a1'), anno('a2')])
    expect(h.canUndo.value).toBe(true)

    const snap = h.undo('img-1')
    expect(snap).toEqual([anno('a1')])
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(true)
  })

  it('undo 后 redo 返回后续快照', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    h.commit('img-1', [anno('a1'), anno('a2')])
    h.commit('img-1', [anno('a1'), anno('a2'), anno('a3')])

    expect(h.undo('img-1')).toEqual([anno('a1'), anno('a2')])
    expect(h.redo('img-1')).toEqual([anno('a1'), anno('a2'), anno('a3')])
    expect(h.canRedo.value).toBe(false)
  })

  it('撤销后提交新快照会截断 redo 分支', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    h.commit('img-1', [anno('a1'), anno('a2')])
    h.commit('img-1', [anno('a1'), anno('a2'), anno('a3')])
    h.undo('img-1')

    // 撤销一次后提交新分支，原 a3 分支应失效
    h.commit('img-1', [anno('a1'), anno('b1')])
    expect(h.canRedo.value).toBe(false)
    expect(h.redo('img-1')).toBeNull()
    expect(h.undo('img-1')).toEqual([anno('a1'), anno('a2')])
  })

  it('undo 返回深拷贝，修改不影响内部快照', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    h.commit('img-1', [anno('a1'), anno('a2')])
    const snap = h.undo('img-1')
    snap!.push(anno('hack'))
    expect(h.redo('img-1')).toEqual([anno('a1'), anno('a2')])
    h.undo('img-1')
    expect(snap).not.toEqual(h.redo('img-1'))
  })

  it('多张图片历史栈相互独立', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('a1')])
    h.init('img-2', [anno('b1'), anno('b2')])
    h.commit('img-2', [anno('b1'), anno('b2'), anno('b3')])

    expect(h.has('img-1')).toBe(true)
    expect(h.has('img-2')).toBe(true)
    expect(h.has('img-3')).toBe(false)
    // img-1 未提交过变更
    expect(h.undo('img-1')).toBeNull()
    // img-2 有一次可撤销
    expect(h.undo('img-2')).toEqual([anno('b1'), anno('b2')])
  })

  it('setCurrent 切换图片时更新 canUndo / canRedo 标记', () => {
    const h = useHistory()
    h.init('img-1', [anno('a1')])
    h.init('img-2', [anno('b1')])
    h.commit('img-2', [anno('b1'), anno('b2')])

    h.setCurrent('img-1')
    expect(h.canUndo.value).toBe(false)

    h.setCurrent('img-2')
    expect(h.canUndo.value).toBe(true)
  })

  it('未 init 直接 commit 也可建立历史', () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.commit('img-1', [anno('a1')])
    expect(h.canUndo.value).toBe(false) // 首条快照即初始状态，index 0
    h.commit('img-1', [anno('a1'), anno('a2')])
    expect(h.canUndo.value).toBe(true)
    expect(h.undo('img-1')).toEqual([anno('a1')])
  })

  it(`快照数超过上限 ${MAX_HISTORY} 时裁剪最旧记录`, () => {
    const h = useHistory()
    h.setCurrent('img-1')
    h.init('img-1', [anno('v0')])
    for (let i = 1; i <= MAX_HISTORY; i++) {
      h.commit('img-1', [anno(`v${i}`)])
    }
    // init(1) + 50 次 commit = 51 条，裁剪 1 条后剩 50 条，index=49
    // 连续撤销最多 49 次回到最旧快照，再撤销返回 null
    let count = 0
    while (h.undo('img-1')) count++
    expect(count).toBe(MAX_HISTORY - 1)
    expect(h.undo('img-1')).toBeNull()
  })
})
