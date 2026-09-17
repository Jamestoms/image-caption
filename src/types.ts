/**
 * ImageCaption 对外数据类型定义
 * 所有坐标均为图片原始像素坐标，与画布缩放/平移完全解耦
 */

/** 标注图形类型 */
export type AnnotationType = 'rect' | 'circle' | 'polygon'

/** 点坐标（图片原始像素坐标系） */
export interface Point {
  x: number
  y: number
}

/** 单条标注数据 */
export interface AnnotationData {
  id: string
  type: AnnotationType
  /** 标签名称 */
  label: string
  /** rect / circle：外接框左上角坐标与宽高 */
  x?: number
  y?: number
  width?: number
  height?: number
  /** polygon：顶点列表 */
  points?: Point[]
}

/** 图片项 */
export interface ImageItem {
  id: string
  url: string
  name?: string
  /** 已有标注数据，加载后回显，可继续编辑 */
  annotations?: AnnotationData[]
}

/** 保存处理函数 */
export type SaveHandler = (
  imageId: string,
  annotations: AnnotationData[]
) => void | Promise<void>

/** 全部图片标注数据映射 */
export type AllAnnotations = Record<string, AnnotationData[]>
