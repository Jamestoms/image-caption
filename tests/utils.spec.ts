import { describe, expect, it } from 'vitest'
import { clamp, deepClone, dist, genId, round2 } from '../src/utils'

describe('clamp', () => {
  it('范围内返回原值', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('低于下界返回下界', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
  })

  it('高于上界返回上界', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('genId', () => {
  it('默认前缀 anno_ 且每次唯一', () => {
    const a = genId()
    const b = genId()
    expect(a.startsWith('anno_')).toBe(true)
    expect(b.startsWith('anno_')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('支持自定义前缀', () => {
    expect(genId('img').startsWith('img_')).toBe(true)
  })
})

describe('deepClone', () => {
  it('深拷贝嵌套结构且与源数据互不影响', () => {
    const src = { a: 1, b: { c: [{ d: 3 }, { d: 4 }] } }
    const copy = deepClone(src)
    expect(copy).toEqual(src)
    expect(copy).not.toBe(src)
    expect(copy.b).not.toBe(src.b)
    copy.b.c[0].d = 99
    expect(src.b.c[0].d).toBe(3)
  })
})

describe('dist', () => {
  it('勾股定理计算两点距离', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('相同点距离为 0', () => {
    expect(dist({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })
})

describe('round2', () => {
  it('保留两位小数', () => {
    expect(round2(3.14159)).toBe(3.14)
    expect(round2(2.567)).toBe(2.57)
  })

  it('整数值不受影响', () => {
    expect(round2(5)).toBe(5)
  })
})
