import type { Pt } from '../core/types'
import type { Panel } from './types'

// Serrage des crans, repris à l'identique de testBrick (`CRENEL_SNUG` de beam.js).
// Le trait du laser enlève 0,1 à 0,2 mm : avec un jeu de 0 les plaques glissaient sans tenir. Chaque cran de profondeur T (deux coins rentrants, ≥ 4 mm de large)
// est donc resserré de 0,4 mm (0,2 de chaque côté), et chaque fenêtre de languette (rectangle de T de large, ≥ 4 mm de long) raccourcie de 0,4 mm : la dent entre en force.
// Un cran qui touche le coin de la plaque, la profondeur et la largeur de T ne bougent pas. Les parois restent droites (aucun trait en biais). Les languettes (dents saillantes) gardent leur largeur.
export const CRENEL_SNUG = -0.4
export const SNUG_MIN = 4

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

/** Contour sans points doublons ni points alignés. */
const clean = (pts: Pt[]): Pt[] => {
  const p = pts.filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-6)
  if (p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6) p.pop()
  return p.filter((q, i) => {
    const a = p[(i + p.length - 1) % p.length]
    const b = p[(i + 1) % p.length]
    return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > 1e-9
  })
}

const snugOuter = (pts: Pt[], T: number): Pt[] => {
  const n = pts.length
  if (n < 4) return pts
  const area = pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1], 0)
  const out = pts.map((p): Pt => [p[0], p[1]])
  const axis = (d: Pt) => Math.abs(d[0]) < 1e-6 || Math.abs(d[1]) < 1e-6
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [0, 1, 2, 3].map((k) => pts[(i + k) % n])
    const d1: Pt = [p1[0] - p0[0], p1[1] - p0[1]]
    const d2: Pt = [p2[0] - p1[0], p2[1] - p1[1]]
    const d3: Pt = [p3[0] - p2[0], p3[1] - p2[1]]
    const l2 = Math.hypot(d2[0], d2[1])
    if (!axis(d1) || !axis(d2) || !near(Math.hypot(d1[0], d1[1]), T) || l2 < SNUG_MIN) continue
    if (!near(d3[0], -d1[0]) || !near(d3[1], -d1[1]) || Math.abs(d1[0] * d2[0] + d1[1] * d2[1]) > 1e-6) continue
    if ((d1[0] * d2[1] - d1[1] * d2[0]) * area >= 0) continue // coins saillants : une dent, pas un cran
    const k = -CRENEL_SNUG / 2
    const ux = (d2[0] / l2) * k
    const uy = (d2[1] / l2) * k
    out[(i + 1) % n] = [p1[0] + ux, p1[1] + uy]
    out[(i + 2) % n] = [p2[0] - ux, p2[1] - uy]
    // les parois du cran restent droites : leur bout sur le bord de la plaque suit, si ce bord est aligné avec le fond du cran
    // (sinon, cran au coin de la plaque, le bout reste en place pour ne pas pencher le bord voisin)
    const pm = pts[(i + n - 1) % n]
    const p4 = pts[(i + 4) % n]
    if (collinearDir(pm, p0, d2)) out[i] = [p0[0] + ux, p0[1] + uy]
    if (collinearDir(p3, p4, d2)) out[(i + 3) % n] = [p3[0] - ux, p3[1] - uy]
  }
  return out
}

/** Le segment a → b est parallèle à d (même axe). */
const collinearDir = (a: Pt, b: Pt, d: Pt) => Math.abs((b[0] - a[0]) * d[1] - (b[1] - a[1]) * d[0]) < 1e-6 && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6

const snugHole = (pts: Pt[], T: number): Pt[] => {
  if (pts.length !== 4) return pts
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  if (!pts.every((p) => (near(p[0], x0) || near(p[0], x1)) && (near(p[1], y0) || near(p[1], y1)))) return pts
  const k = -CRENEL_SNUG / 2
  if (near(y1 - y0, T) && x1 - x0 >= SNUG_MIN) return pts.map(([x, y]): Pt => [near(x, x0) ? x + k : x - k, y])
  if (near(x1 - x0, T) && y1 - y0 >= SNUG_MIN) return pts.map(([x, y]): Pt => [x, near(y, y0) ? y + k : y - k])
  return pts
}

/** Serrage de testBrick appliqué à une planche (crans et fenêtres de l'épaisseur du matériau). */
export const snugPanel = (p: Panel): Panel => ({ ...p, outer: snugOuter(clean(p.outer), p.thickness), holes: (p.holes ?? []).map((h) => snugHole(clean(h), p.thickness)) })
