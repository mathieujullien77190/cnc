import type { Pt } from '../core/types'

/** Rectangle de coin haut-gauche (x, y). */
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

/** Cercle découpé en segments (32 par défaut). */
export const circle = (cx: number, cy: number, r: number, n = 32): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)])

// ---- crans (mêmes règles que testBrick : box.js `count`, `plate`, beam.js serrage) ----

/** Largeur visée d'un cran (mm) : la dent réelle = longueur / nombre de crans. */
export const FINGER = 16

/** Nombre de crans (impair, 3 au moins) sur une longueur. */
export const fingerCount = (len: number) => Math.max(3, 2 * Math.round((len / FINGER - 1) / 2) + 1)

/** Crans impairs d'une arête de longueur `len`, dans la zone [a, b] (hors zone : droit). Les crans pairs, dont les deux bouts, restent droits. */
export const fingerSpans = (len: number, a = 0, b = len): { u0: number; u1: number }[] => {
  const n = fingerCount(b - a)
  const sg = (b - a) / n
  return Array.from({ length: Math.floor(n / 2) }, (_, i) => ({ u0: a + (2 * i + 1) * sg, u1: a + (2 * i + 2) * sg }))
}

/**
 * Un côté de plaque : `d` > 0 = languettes de d mm vers l'extérieur sur les crans impairs, `d` < 0 = encoches (creux), 0 = droit.
 * `a`, `b` : zone crantée (défaut : tout le côté).
 */
export interface EdgeSpec {
  d: number
  a?: number
  b?: number
}

const edgePts = (len: number, e: EdgeSpec | undefined): [number, number][] => {
  const pts: [number, number][] = [[0, 0]]
  if (e && e.d) for (const { u0, u1 } of fingerSpans(len, e.a ?? 0, e.b ?? len)) pts.push([u0, 0], [u0, e.d], [u1, e.d], [u1, 0])
  pts.push([len, 0])
  return pts
}

/**
 * Contour d'une plaque w × h (coin haut-gauche du corps en 0, 0, v vers le bas) dont les côtés portent des languettes ou des encoches.
 * Pour que deux plaques s'emboîtent : sur l'arête commune, l'une a des languettes (`d = T`) et l'autre des encoches (`d = -T`) aux mêmes crans impairs
 * (même zone, même longueur). Les languettes dépassent du corps : la boîte englobante est plus grande que w × h.
 * Le serrage (cran resserré de 0,4 mm) est appliqué ensuite, tout seul, à toutes les planches.
 */
export const plateOutline = (w: number, h: number, sides: { top?: EdgeSpec; right?: EdgeSpec; bottom?: EdgeSpec; left?: EdgeSpec }): Pt[] => [
  ...edgePts(w, sides.top).map(([s, d]): Pt => [s, -d]),
  ...edgePts(h, sides.right).map(([s, d]): Pt => [w + d, s]),
  ...edgePts(w, sides.bottom).map(([s, d]): Pt => [s, h + d]).reverse(),
  ...edgePts(h, sides.left).map(([s, d]): Pt => [-d, s]).reverse(),
]

/** Fenêtres (rectangles de t de large) qui reçoivent les languettes d'une arête : à poser dans une plaque, à la position de l'arête de l'autre plaque. */
export const windowsFor = (len: number, t: number, at: number, alongU: boolean, a = 0, b = len, offset = 0): Pt[][] =>
  fingerSpans(len, a, b).map(({ u0, u1 }) => (alongU ? rect(offset + u0, at, u1 - u0, t) : rect(at, offset + u0, t, u1 - u0)))
