import { inside } from '../laser/job/geometry'
import type { Pt } from './types'
import { SCRIPT_CAP, SCRIPT_GLYPHS, type ScriptGlyph } from './fontScript'

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
  ',': [[[1.2, 0.9], [1.2, 0.3], [0.7, 0]]],
  "'": [[[1, 4], [1, 3.2]]],
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

/** Arc d'ellipse (centre cx, cy ; rayons rx, ry ; angles en degrés, sens trigonométrique si a1 > a0), n segments. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): Stroke =>
  Array.from({ length: n + 1 }, (_, k): [number, number] => {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180
    return [Math.round((cx + rx * Math.cos(a)) * 1000) / 1000, Math.round((cy + ry * Math.sin(a)) * 1000) / 1000]
  })

/** Chiffres et lettres arrondis (numéros des jours, titre) : mêmes cases 2 × 4 que `FONT`, courbes à la place des angles droits. */
const ROUND_FONT: Record<string, Stroke[]> = {
  0: [arc(1, 2, 1, 2, 90, 450, 24)],
  1: [[[0.2, 3.1], [1.05, 4], [1.05, 0]], [[0.2, 0], [1.9, 0]]],
  2: [[...arc(1, 3, 1, 1, 170, -35, 10), [0, 0], [2, 0]]],
  3: [arc(1, 3, 0.95, 1, 155, -90, 10), arc(1, 1, 1, 1, 90, -155, 12)],
  4: [[[1.6, 0], [1.6, 4], [0, 1.3], [2, 1.3]]],
  5: [[[1.9, 4], [0.25, 4], [0.1, 2.2]], arc(0.95, 1.15, 1, 1.15, 125, -150, 12)],
  6: [[...arc(1.05, 3, 0.95, 1, 30, 180, 8), [0, 1.2]], arc(1, 1.1, 1, 1.1, 0, 360, 20)],
  7: [[[0, 4], [2, 4], [0.7, 0]]],
  8: [arc(1, 3, 0.9, 1, 0, 360, 18), arc(1, 1.05, 1, 1.05, 0, 360, 20)],
  9: [arc(1, 2.9, 1, 1.1, 0, 360, 20), [[2, 2.9], ...arc(1, 1, 1, 1, 0, -140, 9)]],
  // lettres arrondies (titre) ; les autres lettres, déjà faites de droites, gardent la police à segments
  A: [[[0, 0], [0, 2.6], ...arc(1, 2.6, 1, 1.4, 180, 0, 12).slice(1), [2, 0]], [[0, 1.4], [2, 1.4]]],
  C: [arc(1, 2, 1, 2, 45, 315, 16)],
  D: [[[0, 0], [0, 4], [0.9, 4], ...arc(0.9, 2, 1.1, 2, 90, -90, 14).slice(1), [0, 0]]],
  O: [arc(1, 2, 1, 2, 90, 450, 24)],
  P: [[[0, 0], [0, 4], [0.9, 4], ...arc(0.9, 3, 1.1, 1, 90, -90, 10).slice(1), [0, 2]]],
  R: [[[0, 0], [0, 4], [0.9, 4], ...arc(0.9, 3, 1.1, 1, 90, -90, 10).slice(1), [0, 2]], [[0.9, 2], [2, 0]]],
  U: [[[0, 4], [0, 1], ...arc(1, 1, 1, 1, 180, 360, 10).slice(1), [2, 4]]],
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

// Police manuscrite (Astoria, contours remplis : voir fontScript.ts pour la licence). Chaque glyphe est gravé par son contour
// (segments de largeur SCRIPT_STROKE) puis, là où le plein est épais, par un hachurage horizontal fin. Avance proportionnelle.
const SCRIPT_STROKE = 0.5 // trait du contour, en mm (fixe : la finesse du laser ne dépend pas de la taille du texte)
const SCRIPT_HATCH = 0.6 // pas du hachurage (mm), trait de 80 % du pas
/** Largeurs de rectangles emboîtés (w, w - 0,25, … jusqu'à 0,1 mm) : le laser suit les contours, ils recouvrent tout le trait. */
export const filledWidths = (w: number, step = 0.25, min = 0.1): number[] => {
  const ws = [w]
  while (ws[ws.length - 1] - step >= min) ws.push(ws[ws.length - 1] - step)
  return ws
}
const SCRIPT_MIN_FILL = 0.4 // un plein de moins de cette largeur (mm) à l'intérieur du contour n'est pas hachuré

/** Contours du texte manuscrit en unités de la police (y vers le haut) et largeur, après décalage pour que le bord gauche soit à 0. */
const scriptLayout = (text: string) => {
  const glyphs: { g: ScriptGlyph; pen: number }[] = []
  let pen = 0
  for (const ch of text) {
    const g = SCRIPT_GLYPHS[ch] ?? SCRIPT_GLYPHS[' ']
    glyphs.push({ g, pen })
    pen += g.a
  }
  const xs = glyphs.flatMap(({ g, pen: p }) => [...g.c, ...(g.o ?? [])].flatMap((c) => c.filter((_, i) => i % 2 === 0).map((v) => v + p)))
  const x0 = xs.length ? Math.min(0, ...xs) : 0
  const x1 = xs.length ? Math.max(pen, ...xs) : 0
  return { glyphs, x0, w: x1 - x0 }
}

/** Intersections (x triés) de la ligne y = yy avec les contours fermés `cs` (points à plat), règle pair-impair. */
const scanSpans = (cs: number[][], yy: number): number[] => {
  const xs: number[] = []
  for (const c of cs) {
    for (let i = 0, n = c.length / 2; i < n; i++) {
      const ax = c[2 * i], ay = c[2 * i + 1], bx = c[(2 * ((i + 1) % n))], by = c[2 * ((i + 1) % n) + 1]
      if (ay <= yy !== by <= yy) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax))
    }
  }
  return xs.sort((p, q) => p - q)
}

/** Angle de virage (rad) au sommet i d'un contour fermé à plat : les sommets presque droits n'ont pas besoin de jonction. */
const turn = (c: number[], i: number) => {
  const n = c.length / 2
  const [p, q, r] = [(i + n - 1) % n, i, (i + 1) % n]
  const d = Math.atan2(c[2 * r + 1] - c[2 * q + 1], c[2 * r] - c[2 * q]) - Math.atan2(c[2 * q + 1] - c[2 * p + 1], c[2 * q] - c[2 * p])
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))
}

/** Octogone de diamètre w centré en (x, y) : arrondit les jonctions entre segments successifs. */
const joint = (x: number, y: number, w: number): Pt[] => Array.from({ length: 8 }, (_, k): Pt => [x + (w / 2) * Math.cos(((k + 0.5) * Math.PI) / 4), y + (w / 2) * Math.sin(((k + 0.5) * Math.PI) / 4)])

const scriptRects = (text: string, x: number, y: number, h: number): Pt[][] => {
  const k = h / SCRIPT_CAP // mm par unité
  const { glyphs, x0 } = scriptLayout(text)
  const pad = SCRIPT_STROKE / 2
  const at = (px: number, py: number): Pt => [x + pad + (px - x0) * k, y + h - py * k]
  const out: Pt[][] = []
  const seg = (ax: number, ay: number, bx: number, by: number, w: number) => {
    if (Math.hypot(bx - ax, by - ay) < 1e-6) return
    for (const sw of filledWidths(w)) out.push(segmentRect(at(ax, ay), at(bx, by), sw)) // le laser ne suit que les contours : traits emboîtés pour que l'intérieur soit brûlé aussi
  }
  for (const { g, pen } of glyphs) {
    for (const c of g.c) for (let i = 0, n = c.length / 2; i < n; i++) seg(pen + c[2 * i], c[2 * i + 1], pen + c[2 * ((i + 1) % n)], c[2 * ((i + 1) % n) + 1], SCRIPT_STROKE)
    for (const c of g.c) for (let i = 0, n = c.length / 2; i < n; i++) if (turn(c, i) > 0.15) out.push(joint(...at(pen + c[2 * i], c[2 * i + 1]), SCRIPT_STROKE)) // sommet arrondi : pas d'encoche entre deux segments
    for (const c of g.o ?? []) for (let i = 0; i + 3 < c.length; i += 2) seg(pen + c[i], c[i + 1], pen + c[i + 2], c[i + 3], SCRIPT_STROKE * 1.2)
    if (!g.c.length) continue
    const step = SCRIPT_HATCH / k
    const ys = g.c.flat().filter((_, i) => i % 2)
    const margin = (SCRIPT_STROKE / 2 + SCRIPT_MIN_FILL / 2) / k
    for (let yy = Math.ceil(Math.min(...ys) / step) * step + step / 2; yy < Math.max(...ys); yy += step) {
      const xs = scanSpans(g.c, yy)
      for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 2 * margin) seg(pen + xs[i] + margin, yy, pen + xs[i + 1] - margin, yy, SCRIPT_HATCH * 0.8)
    }
  }
  return out
}

const textW = (n: number) => n * ADVANCE - (ADVANCE - GLYPH_W)

export type MarkFont = 'round' | 'script'

/** Rectangles (4 points) d'un texte, coin haut-gauche en (x, y), hauteur h, y vers le bas. `font: 'script'` : écriture manuscrite (Astoria : casse respectée, accents français, avance proportionnelle ; h = hauteur des capitales, les jambages passent sous la boîte de 0,35 h, `passes` ignoré). `font: 'round'` : chiffres et quelques lettres arrondis (A C D O P R U ; les autres caractères gardent la police à segments). */
export const digitRects = (text: string, x: number, y: number, h: number, passes = 2, font?: MarkFont): Pt[][] => {
  if (font === 'script') return scriptRects(text, x, y, h)
  const k = h / GLYPH_H
  const w = textW([...text].length)
  const clamp = ([px, py]: Pt): Pt => [Math.min(Math.max(px, 0), w) * k, Math.min(Math.max(py, 0), GLYPH_H) * k]
  const out: Pt[][] = []
  ;[...text.toUpperCase()].forEach((ch, i) => {
    const x0 = i * ADVANCE + STROKE / 2
    const y0 = STROKE / 2
    for (const stroke of (font === 'round' ? ROUND_FONT[ch] : undefined) ?? FONT[ch] ?? []) {
      for (let j = 0; j + 1 < stroke.length; j++) {
        const a: Pt = [x0 + stroke[j][0] * UNIT, y0 + stroke[j][1] * UNIT]
        const b: Pt = [x0 + stroke[j + 1][0] * UNIT, y0 + stroke[j + 1][1] * UNIT]
        for (const sw of passes === 1 ? [STROKE] : [STROKE, INNER_STROKE]) out.push(segmentRect(a, b, sw).map(clamp).map(([px, py]): Pt => [x + px, y + (h - py)]))
      }
    }
  })
  return out
}

/** Largeur réelle du texte (proportionnelle pour `script`) et hauteur h de la boîte. */
export const markSize = (text: string, h: number, font?: MarkFont) => ({ w: font === 'script' ? (text ? scriptLayout(text).w * (h / SCRIPT_CAP) + SCRIPT_STROKE : 0) : textW([...text].length) * (h / GLYPH_H), h })

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
