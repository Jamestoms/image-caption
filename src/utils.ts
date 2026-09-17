/** 数值夹取 */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

let idSeed = 0

/** 生成唯一 id */
export function genId(prefix = 'anno'): string {
  idSeed += 1
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${idSeed}`
}

/** 深拷贝（标注数据为纯 JSON 结构） */
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** 两点距离 */
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 保留两位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
