import { describe, expect, it } from 'vitest'
import { createShapeFromData, getAnnotationId, shapeToData } from '../src/shapeFactory'
import type { AnnotationData } from '../src/types'

/**
 * 标注数据 <-> fabric 图形对象 的往返一致性：
 * 这是「坐标基于图片原始像素、任何缩放下不错位」承诺的核心保障。
 */
describe('createShapeFromData / shapeToData 往返', () => {
  it('rect：坐标与尺寸往返一致', () => {
    const data: AnnotationData = {
      id: 'r1',
      type: 'rect',
      label: '太阳',
      x: 880,
      y: 100,
      width: 140,
      height: 140,
    }
    const shape = createShapeFromData(data)
    expect(shape).not.toBeNull()
    expect(getAnnotationId(shape)).toBe('r1')
    expect(shapeToData(shape!)).toEqual(data)
  })

  it('circle：width/height 与椭圆 rx/ry 往返一致', () => {
    const data: AnnotationData = {
      id: 'c1',
      type: 'circle',
      label: '行人',
      x: 36.5,
      y: 120.25,
      width: 90,
      height: 60,
    }
    const shape = createShapeFromData(data)
    expect(shape).not.toBeNull()
    expect(shapeToData(shape!)).toEqual(data)
  })

  it('polygon：顶点绝对坐标经 pathOffset 换算后往返一致', () => {
    const data: AnnotationData = {
      id: 'p1',
      type: 'polygon',
      label: '大山',
      points: [
        { x: 380, y: 640 },
        { x: 680, y: 300 },
        { x: 980, y: 640 },
      ],
    }
    const shape = createShapeFromData(data)
    expect(shape).not.toBeNull()
    expect(shapeToData(shape!)).toEqual(data)
  })

  it('polygon：含小数顶点往返一致（两位小数精度）', () => {
    const data: AnnotationData = {
      id: 'p2',
      type: 'polygon',
      label: '',
      points: [
        { x: 0, y: 0 },
        { x: 100.56, y: 33.33 },
        { x: 66.67, y: 99.99 },
      ],
    }
    const shape = createShapeFromData(data)
    expect(shapeToData(shape!)).toEqual(data)
  })

  it('缺少必要字段的类型返回 null', () => {
    const bad = { id: 'x1', type: 'polygon', label: '' } as unknown as AnnotationData // 无 points
    expect(createShapeFromData(bad)).toBeNull()
    expect(createShapeFromData({ id: 'x2', type: 'unknown' } as unknown as AnnotationData)).toBeNull()
  })
})
