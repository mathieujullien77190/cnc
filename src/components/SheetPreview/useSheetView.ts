import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { Sheet } from '@/core/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { uiActions } from '@/store/uiSlice'
import { STEP } from './constants'
import { clampView, clampWidth, fullView, toMm } from './helpers'
import type { View } from './types'

/**
 * Fenêtre visible de l'aperçu : zoom (boutons, molette vers le curseur), bornes, retour à la vue entière.
 * La vue est gardée dans le store (par planche) : changer d'onglet ne la perd pas ; une autre taille de planche remet la vue entière.
 */
export const useSheetView = (sheet: Sheet, svg: RefObject<SVGSVGElement | null>) => {
  const dispatch = useAppDispatch()
  const stored = useAppSelector((s) => s.ui.sheetViews[sheet.key])
  const kept = stored && stored.width === sheet.width && stored.height === sheet.height ? stored.view : null
  const view = useMemo<View>(() => kept ?? fullView(sheet), [kept, sheet.width, sheet.height]) // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(view)
  latest.current = view

  const vh = view.w * (sheet.height / sheet.width)
  const zoomed = Math.abs(view.w - sheet.width) > 1e-6
  const clamp = (v: View): View => clampView(sheet, v)

  const setView = (next: View | ((v: View) => View)) => {
    const v = typeof next === 'function' ? next(latest.current) : next
    latest.current = v
    const entire = Math.abs(v.w - sheet.width) <= 1e-6
    dispatch(uiActions.sheetViewSet({ key: sheet.key, state: entire ? null : { width: sheet.width, height: sheet.height, view: v } }))
  }
  const reset = () => setView(fullView(sheet))

  /** Zoom d'un facteur `k` (> 1 : on se rapproche) autour du point (cx, cy) de la planche. */
  const zoomAt = (k: number, cx: number, cy: number) =>
    setView((v) => {
      const w = clampWidth(sheet, v.w / k)
      const s = w / v.w
      return clamp({ w, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s })
    })
  const zoomCenter = (k: number) => zoomAt(k, view.x + view.w / 2, view.y + vh / 2)

  // molette : zoom vers le curseur (écouteur non passif pour garder la page immobile)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const [x, y] = toMm(el, e)
      zoomAt(e.deltaY < 0 ? STEP : 1 / STEP, x, y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  return { view, setView, vh, zoomed, clamp, reset, zoomCenter }
}
