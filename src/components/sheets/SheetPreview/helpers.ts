import type { Pt, Sheet } from '@/core/types'
import { MAX_ZOOM, MIN_ZOOM } from './constants'
import type { View } from './types'

/** Vue entière de la planche. */
export const fullView = (sheet: Sheet): View => ({ x: 0, y: 0, w: sheet.width })

/** Largeur de fenêtre bornée entre le zoom maximal et le dézoom maximal. */
export const clampWidth = (sheet: Sheet, w: number): number => Math.min(sheet.width / MIN_ZOOM, Math.max(sheet.width / MAX_ZOOM, w))

/** Garde la fenêtre près de la planche (un peu de marge autour). */
export const clampView = (sheet: Sheet, v: View): View => {
  const w = clampWidth(sheet, v.w)
  const h = w * (sheet.height / sheet.width)
  const mx = sheet.width * 0.05
  const my = sheet.height * 0.05
  // plus large que la planche : elle reste centrée ; sinon on la parcourt avec un peu de marge autour
  return {
    w,
    x: w >= sheet.width ? (sheet.width - w) / 2 : Math.min(Math.max(v.x, -mx), sheet.width + mx - w),
    y: h >= sheet.height ? (sheet.height - h) / 2 : Math.min(Math.max(v.y, -my), sheet.height + my - h),
  }
}

/** Position du pointeur dans le repère de la planche (mm). */
export const toMm = (el: SVGSVGElement, e: { clientX: number; clientY: number }): Pt => {
  const p = el.createSVGPoint()
  p.x = e.clientX
  p.y = e.clientY
  const q = p.matrixTransform(el.getScreenCTM()!.inverse())
  return [q.x, q.y]
}
