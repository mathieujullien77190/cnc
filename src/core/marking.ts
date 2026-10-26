import { inside } from '../laser/job/geometry'
import type { Pt } from './types'

// Nom gravé sur chaque pièce (ex. CX-01) : petits rectangles fermés (le laser grave les contours bleus fermés),
// placés à un endroit libre de la pièce, loin des bords et des trous.

export const MARK_CLEARANCE = 1.2 // matière libre autour du code (mm)

/** Nom normal : trait double (deux passes, le second à l'intérieur du premier) et matière libre de MARK_CLEARANCE autour. */
const HEIGHTS = [5.6, 4.5, 3.4, 2.8]
/** Nom minuscule, quand rien de plus grand ne tient : un seul trait (une passe), matière libre réduite. */
const MINI_HEIGHTS = [2.4, 1.9, 1.5, 1.2]
const MINI_CLEARANCE = 0.5

// Police à segments : grille de 3 × 5 points, y vers le haut. Chaque segment devient un petit rectangle fermé.
const UNIT = 1.2
const STROKE = 0.8
const INNER_STROKE = 0.3 // second trait à l'intérieur du premier : le trait gravé est plus large et plus marqué
const ADVANCE = 4.4
const GLYPH_W = 2 * UNIT + STROKE
const GLYPH_H = 4 * UNIT + STROKE
type Stroke = [number, number][]
const BOX: Stroke = [[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]]
const PP: Stroke = [[0, 0], [0, 4], [2, 4], [2, 2], [0, 2]]
const FONT: Record<string, Stroke[]> = {
  0: [BOX, [[0, 0], [2, 4]]],
  1: [[[1, 0], [1, 4], [0, 3]]],
  2: [[[0, 4], [2, 4], [2, 2], [0, 2], [0, 0], [2, 0]]],
  3: [[[0, 4], [2, 4], [2, 0], [0, 0]], [[0, 2], [2, 2]]],
  4: [[[0, 4], [0, 2], [2, 2]], [[2, 4], [2, 0]]],
  5: [[[2, 4], [0, 4], [0, 2], [2, 2], [2, 0], [0, 0]]],
  6: [[[2, 4], [0, 4], [0, 0], [2, 0], [2, 2], [0, 2]]],
  7: [[[0, 4], [2, 4], [1, 0]]],
  8: [BOX, [[0, 2], [2, 2]]],
  9: [[[2, 0], [2, 4], [0, 4], [0, 2], [2, 2]]],
  '-': [[[0.2, 2], [1.8, 2]]],
  '.': [[[1, 0], [1, 0.4]]],
  '+': [[[0, 2], [2, 2]], [[1, 3], [1, 1]]],
  A: [[[0, 0], [0, 3], [1, 4], [2, 3], [2, 0]], [[0, 2], [2, 2]]],
  B: [[[0, 0], [0, 4], [1, 4], [2, 3], [1, 2], [0, 2]], [[1, 2], [2, 1], [1, 0], [0, 0]]],
  C: [[[2, 4], [0, 4], [0, 0], [2, 0]]],
  D: [[[0, 0], [0, 4], [1, 4], [2, 3], [2, 1], [1, 0], [0, 0]]],
  E: [[[2, 4], [0, 4], [0, 0], [2, 0]], [[0, 2], [1, 2]]],
  F: [[[2, 4], [0, 4], [0, 0]], [[0, 2], [1, 2]]],
  G: [[[2, 4], [0, 4], [0, 0], [2, 0], [2, 2], [1, 2]]],
  H: [[[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]],
  I: [[[0, 4], [2, 4]], [[1, 4], [1, 0]], [[0, 0], [2, 0]]],
  J: [[[0, 1], [1, 0], [2, 0], [2, 4]]],
  K: [[[0, 0], [0, 4]], [[2, 4], [0, 2], [2, 0]]],
  L: [[[0, 4], [0, 0], [2, 0]]],
  M: [[[0, 0], [0, 4], [1, 2], [2, 4], [2, 0]]],
  N: [[[0, 0], [0, 4], [2, 0], [2, 4]]],
  O: [BOX],
  P: [PP],
  Q: [BOX, [[1, 1], [2, 0]]],
  R: [PP, [[1, 2], [2, 0]]],
  S: [[[2, 3], [1, 4], [0, 3], [2, 1], [1, 0], [0, 1]]],
  T: [[[0, 4], [2, 4]], [[1, 4], [1, 0]]],
  U: [[[0, 4], [0, 0], [2, 0], [2, 4]]],
  V: [[[0, 4], [1, 0], [2, 4]]],
  W: [[[0, 4], [0, 0], [1, 2], [2, 0], [2, 4]]],
  X: [[[0, 4], [2, 0]], [[2, 4], [0, 0]]],
  Y: [[[0, 4], [1, 2], [2, 4]], [[1, 2], [1, 0]]],
  Z: [[[0, 4], [2, 4], [0, 0], [2, 0]]],
}

const segmentRect = (a: Pt, b: Pt, w: number): Pt[] => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const h = w / 2
  const ax = a[0] - ux * h
  const ay = a[1] - uy * h
  const bx = b[0] + ux * h
  const by = b[1] + uy * h
  return [[ax - uy * h, ay + ux * h], [bx - uy * h, by + ux * h], [bx + uy * h, by - ux * h], [ax + uy * h, ay - ux * h]]
}

const textW = (n: number) => n * ADVANCE - (ADVANCE - GLYPH_W)

/** Rectangles (4 points) d'un texte, coin haut-gauche en (x, y), hauteur h, y vers le bas. */
export const digitRects = (text: string, x: number, y: number, h: number, passes = 2): Pt[][] => {
  const k = h / GLYPH_H
  const w = textW([...text].length)
  const clamp = ([px, py]: Pt): Pt => [Math.min(Math.max(px, 0), w) * k, Math.min(Math.max(py, 0), GLYPH_H) * k]
  const out: Pt[][] = []
  ;[...text.toUpperCase()].forEach((ch, i) => {
    const x0 = i * ADVANCE + STROKE / 2
    const y0 = STROKE / 2
    for (const stroke of FONT[ch] ?? []) {
      for (let j = 0; j + 1 < stroke.length; j++) {
        const a: Pt = [x0 + stroke[j][0] * UNIT, y0 + stroke[j][1] * UNIT]
        const b: Pt = [x0 + stroke[j + 1][0] * UNIT, y0 + stroke[j + 1][1] * UNIT]
        for (const sw of passes === 1 ? [STROKE] : [STROKE, INNER_STROKE]) out.push(segmentRect(a, b, sw).map(clamp).map(([px, py]): Pt => [x + px, y + (h - py)]))
      }
    }
  })
  return out
}

export const markSize = (text: string, h: number) => ({ w: textW([...text].length) * (h / GLYPH_H), h })

/** Rectangles du texte posé dans la boîte de coin haut-gauche (x, y), `c` mm de matière libre autour. Couché : rotation de 90° dans la boîte du texte (x, y) -> (h - y, x). */
const placeText = (text: string, h: number, vertical: boolean, x: number, y: number, c: number, passes: number): Pt[][] =>
  digitRects(text, 0, 0, h, passes).map((r) => r.map(([px, py]): Pt => (vertical ? [x + c + (h - py), y + c + px] : [x + c + px, y + c + py])))

interface Shape {
  x: number
  y: number
  w: number
  h: number
  outer: Pt[]
  holes: Pt[][]
}

const okBox = (it: Shape, x0: number, y0: number, x1: number, y1: number) => {
  for (const c of [it.outer, ...it.holes]) for (const [px, py] of c) if (px > x0 - 1e-9 && px < x1 + 1e-9 && py > y0 - 1e-9 && py < y1 + 1e-9) return false
  const clear = (p: Pt) => inside(p, it.outer) && !it.holes.some((hole) => inside(p, hole))
  const step = 0.5
  for (let x = x0; x <= x1 + 1e-9; x += step) if (!clear([x, y0]) || !clear([x, y1])) return false
  for (let y = y0; y <= y1 + 1e-9; y += step) if (!clear([x0, y]) || !clear([x1, y])) return false
  return true
}

/**
 * Rectangles à graver pour le nom `text` de la pièce `it` (contours placés sur la planche), ou [] s'il n'y a pas de place.
 * Texte horizontal ou couché, cherché depuis le centre de la pièce vers l'extérieur. D'abord en trait double, puis, si la pièce est vraiment
 * petite, en minuscule avec un seul trait (une passe).
 */
export const markPiece = (it: Shape, text: string): Pt[][] => {
  const cx = it.x + it.w / 2
  const cy = it.y + it.h / 2
  const tiers = [
    { heights: HEIGHTS, c: MARK_CLEARANCE, passes: 2 },
    { heights: MINI_HEIGHTS, c: MINI_CLEARANCE, passes: 1 },
  ]
  for (const { heights, c, passes } of tiers) {
    for (const h of heights) {
      const { w } = markSize(text, h)
      for (const vertical of [false, true]) {
        const bw = (vertical ? h : w) + 2 * c
        const bh = (vertical ? w : h) + 2 * c
        if (bw > it.w || bh > it.h) continue
        const step = it.w * it.h > 3000 ? 4 : it.w * it.h > 200 ? 1 : 0.25
        const spots: [number, number, number][] = []
        for (let y = it.y; y + bh <= it.y + it.h + 1e-9; y += step) for (let x = it.x; x + bw <= it.x + it.w + 1e-9; x += step) spots.push([x, y, Math.hypot(x + bw / 2 - cx, y + bh / 2 - cy)])
        spots.sort((a, b) => a[2] - b[2])
        for (const [x, y] of spots) {
          if (okBox(it, x, y, x + bw, y + bh)) return placeText(text, h, vertical, x, y, c, passes)
        }
      }
    }
  }
  return []
}
