import { ref } from 'vue'
import type { Ref } from 'vue'
import { Canvas, Rect, Ellipse, Polygon, Polyline, Line, FabricImage, Point, util } from 'fabric'
import type { FabricObject, Text as FabricText } from 'fabric'
import type { AllAnnotations, AnnotationData, ImageItem, Point as IPT } from './types'
import type { ToolMode } from './constants'
import {
  MIN_ZOOM,
  MAX_ZOOM,
  WHEEL_ZOOM_FACTOR,
  FIT_PADDING,
  MIN_SHAPE_SIZE,
  POLYGON_MIN_POINTS,
  POLYGON_CLOSE_DISTANCE,
  POLYGON_DEDUPE_DISTANCE,
  POLYGON_VERTEX_RADIUS,
  BUTTON_ZOOM_RATIO,
} from './constants'
import { clamp, deepClone, dist, genId } from './utils'
import { useHistory } from './useHistory'
import {
  createShapeFromData,
  createLabelText,
  getAnnotationId,
  isAnnotationShape,
  setLabelText,
  shapeToData,
  syncLabelText,
  annotationShapeProps,
} from './shapeFactory'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EngineOptions {
  /** 标注数据发生变化（新增/删除/移动/标签修改/撤销/重做/清空） */
  onChange?: (imageId: string, annotations: AnnotationData[]) => void
  /** 选中标注变化 */
  onSelect?: (annotationId: string | null, label: string) => void
  /** 图形绘制完成，等待输入标签（screen 为画布容器内的屏幕坐标） */
  onPendingDrawn?: (payload: { id: string; screen: { x: number; y: number } }) => void
  /** 待确认标签的图形被取消（切换工具/切图/ESC） */
  onPendingCancelled?: () => void
}

/**
 * fabric 画布引擎：视图（缩放/平移/fit/自适应）、三种图形绘制、
 * 选中/拖动/删除、标签、撤销重做、数据序列化与回显。
 *
 * 坐标约定：所有标注对象均在图片原始像素坐标系，缩放平移仅通过
 * viewportTransform 实现，保证任何缩放状态下坐标不会错位。
 */
export function useCanvasEngine(options: EngineOptions) {
  const mode: Ref<ToolMode> = ref('pan')
  const currentImageId = ref('')
  const imageLoaded = ref(false)
  const imageError = ref('')
  const selectedId = ref<string | null>(null)
  const zoomPercent = ref(100)
  const annotationCounts = ref<Record<string, number>>({})

  const history = useHistory()

  let canvas: Canvas | null = null
  let canvasWrap: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let bgImage: FabricObject | null = null
  let imgW = 0
  let imgH = 0

  /** annotationId -> { shape 图形, label 标签文本 } */
  const shapeMap = new Map<string, { shape: FabricObject; label: FabricText }>()
  /** imageId -> 标注数据（组件内部权威数据源） */
  const annotationsByImage = new Map<string, AnnotationData[]>()

  // ---------- 交互中间状态 ----------
  let panning = false
  let panLast = { x: 0, y: 0 }
  let drawing = false
  let drawStart: IPT = { x: 0, y: 0 }
  /** 矩形/圆/多边形绘制完成、等待标签确认的图形 */
  let pendingShape: FabricObject | null = null
  let polygonPts: IPT[] = []
  let tempPolyline: Polyline | null = null
  let tempGuideLine: Line | null = null
  let tempDots: Ellipse[] = []
  let loadToken = 0

  // ---------- 工具函数 ----------

  function getZoom(): number {
    return canvas ? canvas.getZoom() : 1
  }

  function clampToImage(p: IPT): IPT {
    if (!imgW || !imgH) return p
    return { x: clamp(p.x, 0, imgW), y: clamp(p.y, 0, imgH) }
  }

  function updateCounts(imageId: string, count: number) {
    annotationCounts.value = { ...annotationCounts.value, [imageId]: count }
  }

  /** 缩放变化后同步标签字号/位置与多边形顶点视觉大小（保持视觉恒定） */
  function afterZoomChanged() {
    if (!canvas) return
    zoomPercent.value = Math.round(canvas.getZoom() * 100)
    const zoom = canvas.getZoom()
    shapeMap.forEach(({ shape, label }) => syncLabelText(label, shape, zoom))
    tempDots.forEach((d) => d.set({ radius: POLYGON_VERTEX_RADIUS / zoom }))
    canvas.requestRenderAll()
  }

  // ---------- 数据同步 ----------

  function serializeFromCanvas(): AnnotationData[] {
    const list: AnnotationData[] = []
    shapeMap.forEach(({ shape }) => {
      const d = shapeToData(shape)
      if (d) list.push(d)
    })
    return list
  }

  /** 提交一次变更：以画布为数据源入历史栈并通知外部 */
  function commit() {
    const imageId = currentImageId.value
    if (!imageId || !canvas) return
    const list = serializeFromCanvas()
    annotationsByImage.set(imageId, list)
    updateCounts(imageId, list.length)
    history.commit(imageId, list)
    options.onChange?.(imageId, deepClone(list))
  }

  /** 用快照重建画布标注对象（撤销/重做/清空） */
  function applySnapshot(imageId: string, list: AnnotationData[]) {
    if (!canvas) return
    annotationsByImage.set(imageId, list)
    updateCounts(imageId, list.length)
    if (imageId === currentImageId.value) {
      rebuildShapes(list)
      if (selectedId.value && !shapeMap.has(selectedId.value)) {
        canvas.discardActiveObject()
        selectedId.value = null
        options.onSelect?.(null, '')
      }
    }
    options.onChange?.(imageId, deepClone(list))
  }

  function rebuildShapes(list: AnnotationData[]) {
    if (!canvas) return
    shapeMap.forEach(({ shape, label }) => {
      canvas.remove(shape)
      canvas.remove(label)
    })
    shapeMap.clear()
    const zoom = canvas.getZoom() || 1
    list.forEach((data) => {
      const shape = createShapeFromData(data)
      if (!shape) return
      canvas.add(shape)
      const label = createLabelText(shape, data.label, zoom)
      canvas.add(label)
      shapeMap.set(data.id, { shape, label })
    })
    canvas.requestRenderAll()
  }

  // ---------- 视图：缩放 / 平移 / fit ----------

  function zoomAt(viewportPoint: { x: number; y: number }, factor: number) {
    if (!canvas) return
    const zoom = clamp(getZoom() * factor, MIN_ZOOM, MAX_ZOOM)
    canvas.zoomToPoint(new Point(viewportPoint.x, viewportPoint.y), zoom)
    afterZoomChanged()
  }

  function zoomByCenter(ratio: number) {
    if (!canvas) return
    zoomAt({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }, ratio)
  }

  function zoomIn() {
    zoomByCenter(BUTTON_ZOOM_RATIO)
  }

  function zoomOut() {
    zoomByCenter(1 / BUTTON_ZOOM_RATIO)
  }

  function fitView() {
    if (!canvas || !imgW || !imgH) return
    const vw = canvas.getWidth()
    const vh = canvas.getHeight()
    if (!vw || !vh) return
    const zoom = clamp(
      Math.min((vw - FIT_PADDING * 2) / imgW, (vh - FIT_PADDING * 2) / imgH),
      MIN_ZOOM,
      MAX_ZOOM
    )
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (vw - imgW * zoom) / 2,
      (vh - imgH * zoom) / 2,
    ])
    afterZoomChanged()
  }

  // ---------- 模式切换 ----------

  function setMode(m: ToolMode) {
    if (!canvas) {
      mode.value = m
      return
    }
    if (mode.value !== m || pendingShape || polygonPts.length) {
      cancelDrawState()
    }
    mode.value = m
    canvas.skipTargetFind = m !== 'pan'
    canvas.defaultCursor = m === 'pan' ? 'grab' : 'crosshair'
    if (m !== 'pan') {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      if (selectedId.value) {
        selectedId.value = null
        options.onSelect?.(null, '')
      }
    }
  }

  /** 取消进行中的绘制（未确认标签的图形、多边形临时元素） */
  function cancelDrawState() {
    if (pendingShape) {
      canvas?.remove(pendingShape)
      pendingShape = null
      options.onPendingCancelled?.()
    }
    cleanupPolygonTemp()
    polygonPts = []
    drawing = false
  }

  // ---------- 矩形 / 椭圆 拖拽绘制 ----------

  function startRectEllipseDraw(p: IPT) {
    if (!canvas) return
    const common = annotationShapeProps()
    const extra = { selectable: false, evented: false, strokeUniform: true }
    drawStart = p
    drawing = true
    if (mode.value === 'rect') {
      pendingShape = new Rect({ left: p.x, top: p.y, width: 1, height: 1, ...common, ...extra })
    } else {
      pendingShape = new Ellipse({ left: p.x, top: p.y, rx: 0.5, ry: 0.5, ...common, ...extra })
    }
    canvas.add(pendingShape)
    canvas.requestRenderAll()
  }

  function updateRectEllipseDraw(p: IPT) {
    if (!pendingShape) return
    const left = Math.min(drawStart.x, p.x)
    const top = Math.min(drawStart.y, p.y)
    if (pendingShape.type === 'rect') {
      pendingShape.set({
        left,
        top,
        width: Math.abs(p.x - drawStart.x),
        height: Math.abs(p.y - drawStart.y),
      })
    } else {
      pendingShape.set({
        left,
        top,
        rx: Math.max(Math.abs(p.x - drawStart.x) / 2, 0.5),
        ry: Math.max(Math.abs(p.y - drawStart.y) / 2, 0.5),
      })
    }
    canvas?.requestRenderAll()
  }

  function finishRectEllipseDraw() {
    if (!pendingShape) return
    drawing = false
    const zoom = getZoom()
    const w =
      pendingShape.type === 'rect'
        ? (pendingShape as any).width
        : (pendingShape as any).rx * 2
    const h =
      pendingShape.type === 'rect'
        ? (pendingShape as any).height
        : (pendingShape as any).ry * 2
    if (w * zoom < MIN_SHAPE_SIZE || h * zoom < MIN_SHAPE_SIZE) {
      // 尺寸过小视为误触，丢弃
      canvas?.remove(pendingShape)
      pendingShape = null
      canvas?.requestRenderAll()
      return
    }
    notifyPendingDrawn()
  }

  // ---------- 多边形逐点绘制 ----------

  function cleanupPolygonTemp() {
    if (!canvas) {
      tempPolyline = null
      tempGuideLine = null
      tempDots = []
      return
    }
    if (tempPolyline) canvas.remove(tempPolyline)
    if (tempGuideLine) canvas.remove(tempGuideLine)
    tempDots.forEach((d) => canvas!.remove(d))
    tempPolyline = null
    tempGuideLine = null
    tempDots = []
  }

  function rebuildTempPolyline() {
    if (!canvas || !polygonPts.length) return
    if (tempPolyline) canvas.remove(tempPolyline)
    tempPolyline = new Polyline(polygonPts.map((p) => ({ ...p })), {
      ...annotationShapeProps(),
      fill: 'rgba(64, 158, 255, 0.06)',
      strokeUniform: true,
      selectable: false,
      evented: false,
      strokeDashArray: [6 / getZoom(), 4 / getZoom()],
    })
    canvas.add(tempPolyline)
    canvas.requestRenderAll()
  }

  function addPolygonDot(p: IPT) {
    if (!canvas) return
    const dot = new Ellipse({
      left: p.x - POLYGON_VERTEX_RADIUS / getZoom(),
      top: p.y - POLYGON_VERTEX_RADIUS / getZoom(),
      rx: POLYGON_VERTEX_RADIUS / getZoom(),
      ry: POLYGON_VERTEX_RADIUS / getZoom(),
      fill: '#ffffff',
      stroke: '#409eff',
      strokeWidth: 2,
      strokeUniform: true,
      selectable: false,
      evented: false,
      objectCaching: false,
    })
    tempDots.push(dot)
    canvas.add(dot)
  }

  function showGuideLine(p: IPT) {
    if (!canvas || !polygonPts.length) return
    const last = polygonPts[polygonPts.length - 1]
    if (!tempGuideLine) {
      tempGuideLine = new Line([last.x, last.y, p.x, p.y], {
        stroke: '#409eff',
        strokeWidth: 1.5,
        strokeUniform: true,
        strokeDashArray: [4 / getZoom(), 3 / getZoom()],
        selectable: false,
        evented: false,
        objectCaching: false,
      })
      canvas.add(tempGuideLine)
    } else {
      ;(tempGuideLine as any).set({ x1: last.x, y1: last.y, x2: p.x, y2: p.y })
    }
    canvas.requestRenderAll()
  }

  function handlePolygonDown(p: IPT) {
    if (!canvas) return
    if (!polygonPts.length) {
      polygonPts = [p]
      addPolygonDot(p)
      rebuildTempPolyline()
      showGuideLine(p)
      return
    }
    const zoom = getZoom()
    if (
      polygonPts.length >= POLYGON_MIN_POINTS &&
      dist(p, polygonPts[0]) * zoom < POLYGON_CLOSE_DISTANCE
    ) {
      // 点击起始顶点附近：闭合完成
      finishPolygon()
      return
    }
    polygonPts.push(p)
    addPolygonDot(p)
    rebuildTempPolyline()
  }

  function finishPolygon() {
    if (!canvas) return
    const zoom = getZoom()
    const dedupe = POLYGON_DEDUPE_DISTANCE / zoom
    // 去除双击等产生的相邻重复顶点
    const pts: IPT[] = []
    polygonPts.forEach((p) => {
      if (!pts.length || dist(p, pts[pts.length - 1]) >= dedupe) pts.push({ ...p })
    })
    if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) < dedupe) pts.pop()

    cleanupPolygonTemp()
    polygonPts = []

    if (pts.length < POLYGON_MIN_POINTS) {
      canvas.requestRenderAll()
      return
    }
    // 与 createShapeFromData 保持一致：以包围盒左上角为局部原点构造，
    // left/top 承载绝对坐标，保证序列化往返不错位
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    pendingShape = new Polygon(
      pts.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      {
        ...annotationShapeProps(),
        left: minX,
        top: minY,
        selectable: false,
        evented: false,
      }
    )
    canvas.add(pendingShape)
    canvas.requestRenderAll()
    notifyPendingDrawn()
  }

  /** 通知组件层弹出标签输入浮层（附带标注中心点的屏幕坐标） */
  function notifyPendingDrawn() {
    if (!canvas || !pendingShape) return
    const id = genId()
    ;(pendingShape as any).annotationId = id
    ;(pendingShape as any).label = ''
    const center = pendingShape.getCenterPoint()
    const screen = util.transformPoint(center, canvas.viewportTransform)
    options.onPendingDrawn?.({ id, screen: { x: screen.x, y: screen.y } })
    canvas.requestRenderAll()
  }

  // ---------- 待确认标签的图形 ----------

  /** 标签确认：转正式标注并提交历史 */
  function confirmPending(label: string): string | null {
    if (!canvas || !pendingShape) return null
    const shape = pendingShape
    pendingShape = null
    const id = getAnnotationId(shape as any) || genId()
    ;(shape as any).annotationId = id
    ;(shape as any).label = label
    shape.set({ selectable: true, evented: true })
    const text = createLabelText(shape, label, canvas.getZoom())
    canvas.add(text)
    shapeMap.set(id, { shape, label: text })
    commit()
    setMode('pan')
    canvas.setActiveObject(shape)
    canvas.requestRenderAll()
    return id
  }

  /** 标签取消：丢弃图形 */
  function cancelPending() {
    if (pendingShape) {
      canvas?.remove(pendingShape)
      pendingShape = null
      canvas?.requestRenderAll()
    }
    options.onPendingCancelled?.()
    setMode('pan')
  }

  // ---------- 选中 / 拖动 / 删除 ----------

  function handleSelection() {
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (obj && isAnnotationShape(obj)) {
      const id = getAnnotationId(obj as any) || ''
      selectedId.value = id
      options.onSelect?.(id, String((obj as any).label ?? ''))
    } else {
      handleSelectionClear()
    }
  }

  function handleSelectionClear() {
    if (selectedId.value) {
      selectedId.value = null
      options.onSelect?.(null, '')
    }
  }

  function handleObjectMoving(e: any) {
    const obj: FabricObject = e.target
    if (!obj || !isAnnotationShape(obj)) return
    // 拖动时限制标注整体保持在图片范围内
    const w = (obj.width || 0) * (obj.scaleX || 1)
    const h = (obj.height || 0) * (obj.scaleY || 1)
    obj.set({
      left: clamp(obj.left ?? 0, 0, Math.max(imgW - w, 0)),
      top: clamp(obj.top ?? 0, 0, Math.max(imgH - h, 0)),
    })
    obj.setCoords()
    const entry = shapeMap.get(getAnnotationId(obj as any) || '')
    if (entry) syncLabelText(entry.label, obj, getZoom())
    canvas?.requestRenderAll()
  }

  /** 删除当前选中标注 */
  function deleteSelected() {
    const id = selectedId.value
    if (!id || !canvas) return
    const entry = shapeMap.get(id)
    if (entry) {
      canvas.remove(entry.shape)
      canvas.remove(entry.label)
    }
    shapeMap.delete(id)
    canvas.discardActiveObject()
    selectedId.value = null
    options.onSelect?.(null, '')
    canvas.requestRenderAll()
    commit()
  }

  /** 修改选中标注的标签 */
  function updateSelectedLabel(label: string) {
    const id = selectedId.value
    if (!id) return
    const entry = shapeMap.get(id)
    if (!entry) return
    ;(entry.shape as any).label = label
    setLabelText(entry.label, label)
    canvas?.requestRenderAll()
    commit()
  }

  /** 清空当前图片标注 */
  function clearCurrent() {
    if (!canvas || !currentImageId.value) return
    cancelDrawState()
    shapeMap.forEach(({ shape, label }) => {
      canvas!.remove(shape)
      canvas!.remove(label)
    })
    shapeMap.clear()
    canvas.discardActiveObject()
    selectedId.value = null
    options.onSelect?.(null, '')
    canvas.requestRenderAll()
    commit()
  }

  // ---------- 撤销 / 反撤销 ----------

  function undo() {
    const imageId = currentImageId.value
    if (!imageId) return
    cancelDrawState()
    const snap = history.undo(imageId)
    if (snap) applySnapshot(imageId, snap)
  }

  function redo() {
    const imageId = currentImageId.value
    if (!imageId) return
    cancelDrawState()
    const snap = history.redo(imageId)
    if (snap) applySnapshot(imageId, snap)
  }

  // ---------- 键盘 ----------

  function handleEnter() {
    if (mode.value === 'polygon' && polygonPts.length >= POLYGON_MIN_POINTS) {
      finishPolygon()
    }
  }

  function handleEscape() {
    if (pendingShape || polygonPts.length) {
      cancelDrawState()
      return
    }
    if (mode.value !== 'pan') {
      setMode('pan')
      return
    }
    canvas?.discardActiveObject()
    canvas?.requestRenderAll()
  }

  // ---------- 图片加载 ----------

  async function loadImage(item: ImageItem) {
    if (!canvas) return
    const token = ++loadToken
    cancelDrawState()
    panning = false
    canvas.discardActiveObject()
    if (selectedId.value) {
      selectedId.value = null
      options.onSelect?.(null, '')
    }
    currentImageId.value = item.id
    history.setCurrent(item.id)
    imageLoaded.value = false
    imageError.value = ''

    // 清空画布
    canvas.remove(...canvas.getObjects())
    bgImage = null
    imgW = 0
    imgH = 0
    shapeMap.clear()

    try {
      const img = await FabricImage.fromURL(item.url, { crossOrigin: 'anonymous' })
      if (token !== loadToken) return // 加载期间已切换图片，丢弃
      img.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
        moveCursor: 'default',
      })
      bgImage = img
      imgW = img.width || 0
      imgH = img.height || 0
      canvas.add(img)

      let list = annotationsByImage.get(item.id)
      if (!list) {
        list = (item.annotations || []).map((a) => deepClone(a))
      }
      if (!history.has(item.id)) history.init(item.id, list)
      rebuildShapes(list)
      annotationsByImage.set(item.id, list)
      updateCounts(item.id, list.length)
      fitView()
      imageLoaded.value = true
    } catch (err) {
      if (token !== loadToken) return
      imageError.value = '图片加载失败，请检查图片地址'
      console.error('[ImageCaption] 图片加载失败:', err)
    }
  }

  /** 预填充各图片初始标注（用于 getAnnotations / getAllAnnotations 覆盖未打开过的图片） */
  function preloadAnnotations(images: ImageItem[]) {
    images.forEach((img) => {
      if (!annotationsByImage.has(img.id) && img.annotations && img.annotations.length) {
        const list = img.annotations.map((a) => deepClone(a))
        annotationsByImage.set(img.id, list)
        updateCounts(img.id, list.length)
      }
    })
  }

  // ---------- 事件绑定 ----------

  function bindEvents() {
    if (!canvas) return

    canvas.on('mouse:wheel', (opt: any) => {
      const e = opt.e as WheelEvent
      e.preventDefault()
      e.stopPropagation()
      const factor = Math.pow(WHEEL_ZOOM_FACTOR, e.deltaY)
      zoomAt({ x: opt.viewportPoint.x, y: opt.viewportPoint.y }, factor)
    })

    canvas.on('mouse:down', (opt: any) => {
      if (!canvas) return
      const e = opt.e as MouseEvent
      if (e.button !== 0) return // 仅左键
      const scene: IPT = { x: opt.scenePoint.x, y: opt.scenePoint.y }
      if (mode.value === 'pan') {
        if (!opt.target) {
          // 点击空白处：开始平移（点中标注时由 fabric 处理选中与拖动）
          panning = true
          panLast = { x: e.clientX, y: e.clientY }
          canvas.defaultCursor = 'grabbing'
        }
      } else if (mode.value === 'rect' || mode.value === 'circle') {
        if (!pendingShape) startRectEllipseDraw(clampToImage(scene))
      } else if (mode.value === 'polygon') {
        if (!pendingShape) handlePolygonDown(clampToImage(scene))
      }
    })

    canvas.on('mouse:move', (opt: any) => {
      if (!canvas) return
      const scene: IPT = { x: opt.scenePoint.x, y: opt.scenePoint.y }
      if (panning) {
        const e = opt.e as MouseEvent
        const vpt = canvas.viewportTransform
        vpt[4] += e.clientX - panLast.x
        vpt[5] += e.clientY - panLast.y
        canvas.setViewportTransform(vpt)
        panLast = { x: e.clientX, y: e.clientY }
        return
      }
      if (drawing && pendingShape) {
        updateRectEllipseDraw(clampToImage(scene))
      } else if (mode.value === 'polygon' && polygonPts.length && !pendingShape) {
        showGuideLine(clampToImage(scene))
      }
    })

    canvas.on('mouse:up', () => {
      if (panning) {
        panning = false
        if (canvas) canvas.defaultCursor = mode.value === 'pan' ? 'grab' : 'crosshair'
      }
      if (drawing) finishRectEllipseDraw()
    })

    canvas.on('mouse:dblclick', () => {
      if (mode.value === 'polygon' && polygonPts.length) finishPolygon()
    })

    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleSelectionClear)

    canvas.on('object:moving', handleObjectMoving)
    canvas.on('object:modified', (e: any) => {
      const obj: FabricObject = e.target
      if (obj && isAnnotationShape(obj)) commit() // 拖动结束，重新计算并更新标注坐标
    })
  }

  const onGlobalMouseUp = () => {
    if (panning) {
      panning = false
      if (canvas) canvas.defaultCursor = mode.value === 'pan' ? 'grab' : 'crosshair'
    }
    if (drawing) finishRectEllipseDraw()
  }

  // ---------- 初始化 / 销毁 ----------

  function init(canvasEl: HTMLCanvasElement, wrapEl: HTMLElement) {
    canvas = new Canvas(canvasEl, {
      selection: false, // 禁用框选
      preserveObjectStacking: true, // 选中时保持对象层级（背景图不置顶）
      stopContextMenu: true,
      fireRightClick: false,
      enableRetinaScaling: true,
    })
    canvas.defaultCursor = 'grab'
    canvasWrap = wrapEl

    const w = wrapEl.clientWidth
    const h = wrapEl.clientHeight
    if (w > 0 && h > 0) canvas.setDimensions({ width: w, height: h })

    bindEvents()
    window.addEventListener('mouseup', onGlobalMouseUp)

    // 屏幕尺寸适配：容器尺寸变化时重设画布尺寸（保持当前视口缩放平移）
    resizeObserver = new ResizeObserver(() => {
      if (!canvas || !canvasWrap) return
      const w = canvasWrap.clientWidth
      const h = canvasWrap.clientHeight
      if (w > 0 && h > 0) {
        canvas.setDimensions({ width: w, height: h })
        canvas.requestRenderAll()
      }
    })
    resizeObserver.observe(wrapEl)
  }

  function destroy() {
    window.removeEventListener('mouseup', onGlobalMouseUp)
    resizeObserver?.disconnect()
    resizeObserver = null
    canvasWrap = null
    cancelDrawState()
    if (canvas) {
      canvas.off()
      canvas.dispose()
      canvas = null
    }
  }

  // ---------- 图片导出 ----------

  /**
   * 导出当前图片（含标注与标签）为 PNG dataURL，尺寸为图片原始像素。
   * 导出时临时重置视口为 1:1 并隐藏未确认/绘制中的临时对象，导出后恢复原状。
   * 失败（无图片或画布异常）返回 null。
   */
  function exportImage(): string | null {
    if (!canvas || !bgImage || !imgW || !imgH) return null
    const zoom = getZoom()
    const savedVpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform

    // 临时隐藏未确认图形与多边形绘制辅助元素
    const hidden: FabricObject[] = []
    if (pendingShape) {
      pendingShape.visible = false
      hidden.push(pendingShape)
    }
    ;[tempPolyline, tempGuideLine].forEach((o) => {
      if (o) {
        o.visible = false
        hidden.push(o)
      }
    })
    tempDots.forEach((d) => {
      d.visible = false
      hidden.push(d)
    })

    let url: string | null = null
    try {
      // 视口重置为 1:1（图片原始像素），标签字号同步为基准字号（视觉恒定）
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
      shapeMap.forEach(({ shape, label }) => syncLabelText(label, shape, 1))
      canvas.renderAll()
      url = canvas.toDataURL({
        format: 'png',
        multiplier: 1,
        left: 0,
        top: 0,
        width: imgW,
        height: imgH,
      })
    } catch (err) {
      console.error('[ImageCaption] 导出图片失败:', err)
      url = null
    } finally {
      // 恢复视口、标签字号与临时对象可见性
      canvas.setViewportTransform(savedVpt)
      shapeMap.forEach(({ shape, label }) => syncLabelText(label, shape, zoom))
      hidden.forEach((o) => {
        o.visible = true
      })
      canvas.requestRenderAll()
    }
    return url
  }

  // ---------- 数据获取 ----------

  function getAnnotations(imageId?: string): AnnotationData[] {
    const id = imageId || currentImageId.value
    if (!id) return []
    return deepClone(annotationsByImage.get(id) || [])
  }

  function getAllAnnotations(): AllAnnotations {
    const res: AllAnnotations = {}
    annotationsByImage.forEach((v, k) => {
      res[k] = deepClone(v)
    })
    return res
  }

  /** 获取选中标注中心的屏幕坐标（画布容器内，用于标签浮层定位） */
  function getSelectedScreenPoint(): { x: number; y: number } | null {
    if (!canvas || !selectedId.value) return null
    const entry = shapeMap.get(selectedId.value)
    if (!entry) return null
    const center = entry.shape.getCenterPoint()
    const screen = util.transformPoint(center, canvas.viewportTransform)
    return { x: screen.x, y: screen.y }
  }

  return {
    // 状态
    mode,
    currentImageId,
    imageLoaded,
    imageError,
    selectedId,
    zoomPercent,
    annotationCounts,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    // 生命周期
    init,
    destroy,
    // 图片
    loadImage,
    preloadAnnotations,
    // 视图
    zoomIn,
    zoomOut,
    fitView,
    // 模式与绘制
    setMode,
    confirmPending,
    cancelPending,
    handleEnter,
    handleEscape,
    // 标注操作
    deleteSelected,
    updateSelectedLabel,
    clearCurrent,
    // 历史
    undo,
    redo,
    // 数据
    getAnnotations,
    getAllAnnotations,
    getSelectedScreenPoint,
    // 导出
    exportImage,
  }
}

export type CanvasEngine = ReturnType<typeof useCanvasEngine>
