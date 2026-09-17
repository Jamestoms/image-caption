import { Rect, Ellipse, Polygon, Text } from 'fabric'
import type { FabricObject } from 'fabric'
import type { AnnotationData, Point } from './types'
import {
  SHAPE_STROKE_COLOR,
  SHAPE_FILL_COLOR,
  SHAPE_STROKE_WIDTH,
  SHAPE_SELECTED_BORDER,
  SHAPE_BORDER_SCALE,
  LABEL_FONT_SIZE,
  LABEL_GAP,
  LABEL_TEXT_COLOR,
  LABEL_TEXT_BG,
} from './constants'
import { round2 } from './utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 读取对象上的标注 id（自定义属性） */
export function getAnnotationId(obj: any): string | undefined {
  return obj?.annotationId
}

/** 是否为标注标签文本对象 */
export function isLabelObject(obj: any): boolean {
  return !!obj?.annotationLabel
}

/** 是否为标注图形对象（非标签、非背景图） */
export function isAnnotationShape(obj: any): boolean {
  return !!obj?.annotationId && !obj?.annotationLabel
}

/** 图形对象通用样式（坐标均为图片原始像素坐标） */
export function annotationShapeProps() {
  return {
    stroke: SHAPE_STROKE_COLOR,
    strokeWidth: SHAPE_STROKE_WIDTH,
    fill: SHAPE_FILL_COLOR,
    // 描边宽度视觉恒定：任何缩放级别下边框视觉粗细一致
    strokeUniform: true,
    objectCaching: false,
    // 禁用控制柄缩放/旋转，只允许整体拖动，保证坐标可靠
    hasControls: false,
    hasBorders: true,
    borderColor: SHAPE_SELECTED_BORDER,
    borderScaleFactor: SHAPE_BORDER_SCALE,
    cornerStyle: 'circle' as const,
    hoverCursor: 'move',
    moveCursor: 'move',
  }
}

/** 根据标注数据创建 fabric 图形对象 */
export function createShapeFromData(data: AnnotationData): FabricObject | null {
  const common = annotationShapeProps()
  if (data.type === 'rect') {
    const shape = new Rect({
      left: data.x ?? 0,
      top: data.y ?? 0,
      width: Math.max(data.width ?? 1, 1),
      height: Math.max(data.height ?? 1, 1),
      ...common,
    })
    ;(shape as any).annotationId = data.id
    ;(shape as any).label = data.label
    return shape
  }
  if (data.type === 'circle') {
    const shape = new Ellipse({
      left: data.x ?? 0,
      top: data.y ?? 0,
      rx: Math.max((data.width ?? 2) / 2, 0.5),
      ry: Math.max((data.height ?? 2) / 2, 0.5),
      ...common,
    })
    ;(shape as any).annotationId = data.id
    ;(shape as any).label = data.label
    return shape
  }
  if (data.type === 'polygon' && data.points && data.points.length > 0) {
    // 以绝对坐标点构造，fabric 自动计算包围盒 left/top 与 pathOffset
    const shape = new Polygon(data.points as Point[], common)
    ;(shape as any).annotationId = data.id
    ;(shape as any).label = data.label
    return shape
  }
  return null
}

/** fabric 图形对象 -> 标注数据（坐标换算为图片原始像素坐标） */
export function shapeToData(obj: FabricObject): AnnotationData | null {
  const o = obj as any
  const id = getAnnotationId(o)
  if (!id) return null
  const label = String(o.label ?? '')

  if (obj.type === 'rect') {
    return {
      id,
      type: 'rect',
      label,
      x: round2(o.left),
      y: round2(o.top),
      width: round2(o.width * o.scaleX),
      height: round2(o.height * o.scaleY),
    }
  }
  if (obj.type === 'ellipse') {
    return {
      id,
      type: 'circle',
      label,
      x: round2(o.left),
      y: round2(o.top),
      width: round2(o.rx * 2 * o.scaleX),
      height: round2(o.ry * 2 * o.scaleY),
    }
  }
  if (obj.type === 'polygon') {
    // 顶点绝对坐标 = 对象位置 + 本地点 - pathOffset（scale 恒为 1）
    const offset = o.pathOffset || { x: 0, y: 0 }
    const points = ((o.points || []) as Point[]).map((p) => ({
      x: round2(o.left + p.x - offset.x),
      y: round2(o.top + p.y - offset.y),
    }))
    return { id, type: 'polygon', label, points }
  }
  return null
}

/** 创建标注标签文本（视觉大小恒定：字号随缩放补偿） */
export function createLabelText(shape: FabricObject, label: string, zoom: number): Text {
  const fontSize = LABEL_FONT_SIZE / zoom
  const text = new Text(label || '', {
    left: shape.left ?? 0,
    top: (shape.top ?? 0) - fontSize - LABEL_GAP / zoom,
    fontSize,
    fill: LABEL_TEXT_COLOR,
    textBackgroundColor: LABEL_TEXT_BG,
    fontFamily:
      '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
    selectable: false,
    evented: false,
    objectCaching: false,
    hoverCursor: 'default',
  })
  ;(text as any).annotationLabel = true
  ;(text as any).annotationId = getAnnotationId(shape as any)
  return text
}

/** 同步标签文本位置与字号（图形移动、缩放变化后调用） */
export function syncLabelText(text: Text, shape: FabricObject, zoom: number) {
  const fontSize = LABEL_FONT_SIZE / zoom
  text.set({
    fontSize,
    left: shape.left ?? 0,
    top: (shape.top ?? 0) - fontSize - LABEL_GAP / zoom,
  })
  text.setCoords()
}

/** 更新标签文本内容 */
export function setLabelText(text: Text, label: string) {
  text.set({ text: label || '' })
}
