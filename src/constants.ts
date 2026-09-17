/** 工具模式：平移/选择 | 矩形 | 圆形 | 多边形 */
export type ToolMode = 'pan' | 'rect' | 'circle' | 'polygon'

/** 标注描边颜色 */
export const SHAPE_STROKE_COLOR = '#409eff'
/** 标注填充颜色 */
export const SHAPE_FILL_COLOR = 'rgba(64, 158, 255, 0.12)'
/** 标注描边宽度（视觉像素，配合 strokeUniform 保证缩放时视觉恒定） */
export const SHAPE_STROKE_WIDTH = 2
/** 选中边框颜色 */
export const SHAPE_SELECTED_BORDER = '#f56c6c'
/** 选中边框宽度（视觉像素） */
export const SHAPE_BORDER_SCALE = 1.5
/** 标签字号（视觉像素，随缩放补偿保证视觉恒定） */
export const LABEL_FONT_SIZE = 12
/** 标签与图形上边缘间距（视觉像素） */
export const LABEL_GAP = 6
/** 标签文字颜色 */
export const LABEL_TEXT_COLOR = '#ffffff'
/** 标签背景色 */
export const LABEL_TEXT_BG = 'rgba(64, 158, 255, 0.85)'
/** fit 视野四周留白（视觉像素） */
export const FIT_PADDING = 24
/** 缩放范围 */
export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 40
/** 滚轮缩放系数（zoom * factor^deltaY） */
export const WHEEL_ZOOM_FACTOR = 0.999
/** 矩形/椭圆最小绘制尺寸（视觉像素） */
export const MIN_SHAPE_SIZE = 5
/** 多边形最少顶点数 */
export const POLYGON_MIN_POINTS = 3
/** 点击起始顶点自动闭合的距离（视觉像素） */
export const POLYGON_CLOSE_DISTANCE = 12
/** 多边形顶点标记半径（视觉像素） */
export const POLYGON_VERTEX_RADIUS = 4
/** 相邻重复顶点合并距离（视觉像素，双击结束时去重用） */
export const POLYGON_DEDUPE_DISTANCE = 6
/** 历史栈最大长度 */
export const MAX_HISTORY = 50
/** 按钮点击缩放倍率 */
export const BUTTON_ZOOM_RATIO = 1.25
