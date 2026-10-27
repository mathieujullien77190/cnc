import type { Box } from './nesting'
import type { Part, Pt } from './types'

// Pièces rangées DANS les trous d'autres pièces (fenêtres, découpes, ronds, polygones quelconques). Une petite pièce se pose dans un trou
// quand son contour, tourné, reste entièrement dans le polygone du trou à au moins `clearance` mm de toute coupe (bord du trou, autre pièce
// déjà posée dans ce trou). Une pièce posée dans un trou peut avoir ses propres trous, qui accueillent à leur tour d'autres pièces.
// Le résultat est un « composite » : une pièce hôte et ses invitées, à des positions fixes dans le repère de l'hôte (elles suivent l'hôte).

/** Contour tourné d'un angle quelconque (degrés, sens horaire, y vers le bas) autour du centre de la pièce, ramené à l'origine. */
export const turnAny = (part: Part, deg: number) => {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const cx = part.w / 2
  const cy = part.h / 2
  const rot = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
  const outer = rot(part.outer)
  const x0 = Math.min(...outer.map((p) => p[0]))
  const y0 = Math.min(...outer.map((p) => p[1]))
  const shift = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x - x0, y - y0])
  return { outer: shift(outer), holes: part.holes.map((h) => shift(rot(h))), labels: part.labels?.map((l) => shift(rot(l))), w: Math.max(...outer.map((p) => p[0])) - x0, h: Math.max(...outer.map((p) => p[1])) - y0 }
}

export const polyArea = (p: Pt[]) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2

/** Trou par trou : sa boîte si c'est un rectangle droit d'au moins 12 mm, sinon `null`. */
export const rectHoleBoxes = (part: Part): (Box | null)[] =>
  part.holes.map((h) => {
    const xs = h.map((p) => p[0])
    const ys = h.map((p) => p[1])
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    return Math.abs(polyArea(h) - box.w * box.h) < 1e-3 * box.w * box.h && box.w >= 12 && box.h >= 12 ? box : null
  })

/** Trous rectangulaires (droits, d'au moins 12 mm) d'une pièce : des pièces plus petites peuvent s'y ranger. */
export const rectHoles = (part: Part): Box[] => rectHoleBoxes(part).filter((b): b is Box => !!b)

/** Générateur pseudo-aléatoire reproductible (mulberry32) : même graine, même suite. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inPolyAt = (x: number, y: number, poly: Pt[]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const ptSeg2 = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  const ex = a[0] + t * dx - p[0]
  const ey = a[1] + t * dy - p[1]
  return ex * ex + ey * ey
}

const orient = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

/** Carré de la distance entre deux segments (0 s'ils se croisent). */
const seg2 = (a: Pt, b: Pt, c: Pt, d: Pt) => {
  const d1 = orient(a, b, c)
  const d2 = orient(a, b, d)
  const d3 = orient(c, d, a)
  const d4 = orient(c, d, b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0
  return Math.min(ptSeg2(a, c, d), ptSeg2(b, c, d), ptSeg2(c, a, b), ptSeg2(d, a, b))
}

/** Les deux contours sont-ils partout à au moins `c` mm l'un de l'autre ? (ne dit rien de l'inclusion) */
const apart = (a: Pt[], b: Pt[], c: number) => {
  const c2 = c * c
  for (let i = 0; i < a.length; i++) {
    const p = a[i]
    const q = a[(i + 1) % a.length]
    const x0 = Math.min(p[0], q[0]) - c
    const x1 = Math.max(p[0], q[0]) + c
    const y0 = Math.min(p[1], q[1]) - c
    const y1 = Math.max(p[1], q[1]) + c
    for (let j = 0; j < b.length; j++) {
      const r = b[j]
      const s = b[(j + 1) % b.length]
      if (Math.max(r[0], s[0]) < x0 || Math.min(r[0], s[0]) > x1 || Math.max(r[1], s[1]) < y0 || Math.min(r[1], s[1]) > y1) continue
      if (seg2(p, q, r, s) < c2) return false
    }
  }
  return true
}

/** Un contour fermé et sa boîte englobante. */
export interface Shape {
  pts: Pt[]
  x0: number
  y0: number
  x1: number
  y1: number
}

export const shapeOf = (pts: Pt[]): Shape => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Le point est-il dans l'une des matières de `s` (contour extérieur `s[0]`, hors de ses trous `s[1..]`) ? */
const inSolidOf = (p: Pt, s: Shape[]) => inPolyAt(p[0], p[1], s[0].pts) && !s.some((h, i) => i > 0 && inPolyAt(p[0], p[1], h.pts))

/**
 * Deux pièces posées (contour extérieur en premier, puis les trous) sont-elles compatibles : tous leurs contours à au moins `c` mm les uns
 * des autres, et aucune ne couvre la matière de l'autre ? Une pièce dans un trou de l'autre, ou dans le creux d'un U, est permise.
 * Vrai test de polygones (distance entre segments, point dans polygone), les boîtes ne servent que de pré-filtre.
 */
export const clearOf = (a: Shape[], b: Shape[], c: number): boolean => {
  if (a[0].x0 > b[0].x1 + c || b[0].x0 > a[0].x1 + c || a[0].y0 > b[0].y1 + c || b[0].y0 > a[0].y1 + c) return true
  for (const ra of a) {
    for (const rb of b) {
      if (ra.x0 > rb.x1 + c || rb.x0 > ra.x1 + c || ra.y0 > rb.y1 + c || rb.y0 > ra.y1 + c) continue
      if (!apart(ra.pts, rb.pts, c)) return false
    }
  }
  // les contours sont loin les uns des autres : un seul sommet dit si une pièce est dans la matière de l'autre
  return !inSolidOf(a[0].pts[0], b) && !inSolidOf(b[0].pts[0], a)
}

interface Cavity extends Shape {
  /** Pièces déjà posées dans ce trou (contours dans le repère de l'hôte). */
  placed: Shape[]
  /** Forme du trou (pièce, angle de la pièce qui le porte, numéro de trou) : un échec dans un trou vide vaut pour tous les trous identiques. */
  sig: string
  /** Numéro du trou dans la pièce hôte, si c'est un trou de l'hôte lui-même (et non d'une invitée), sinon -1. */
  holeIdx: number
  area: number
  /** Surface du trou pas encore occupée (mm²). */
  room: number
}

/** Une pièce du composite : `idx` (exemplaire), angle et coin de sa boîte tournée dans le repère de l'hôte. L'hôte est le premier membre (angle 0, en 0, 0). */
export interface Member {
  idx: number
  deg: number
  x: number
  y: number
}

export interface Composite {
  members: Member[]
  /** Trous rectangulaires de l'hôte restés libres (réutilisables par le rangement de la planche). */
  holes: Box[]
  noRotate: boolean
}

/** Calculs gardés d'un essai à l'autre (même pièces, même jeu) : contours tournés, et (trou, pièce, angle) qui ne tiennent pas même dans un trou vide. */
export interface NestCache {
  turns: Map<string, ReturnType<typeof turnAny>>
  never: Set<string>
}

export const makeNestCache = (): NestCache => ({ turns: new Map(), never: new Set() })

export interface NestOpts {
  /** À réutiliser entre plusieurs appels avec les mêmes pièces et le même `clearance`. */
  cache?: NestCache
  /** Distance mini entre deux coupes (mm) : jeu de la planche, au moins 1 mm de bois. */
  clearance: number
  /** Exemplaires qui peuvent être rangés (les trop grands pour la planche restent seuls). */
  eligible: boolean[]
  rng?: () => number
  /** Amplitude du bruit sur l'ordre des tailles (0 : ordre strict). */
  noise?: number
  /** Pas des angles essayés (90 : 0, 90, 180, 270). */
  angleStep?: number
  shuffleAngles?: boolean
  /** Probabilité de laisser un trou rectangulaire de l'hôte au rangement de la planche. */
  skip?: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

const positions = (a: number, b: number, step: number) => {
  const out: number[] = []
  for (let v = a; v <= b + 1e-9; v += step) out.push(v)
  if (out[out.length - 1] < b - 1e-9) out.push(b)
  return out
}

/**
 * Range des pièces dans les trous d'autres pièces. `parts[i]` est l'exemplaire i. Les grandes pièces d'abord : chaque trou reçoit les pièces
 * restantes, de la plus grande à la plus petite, qui y tiennent (angles essayés dans l'ordre, première place libre en haut à gauche).
 * Renvoie un composite par pièce qui n'est pas posée dans un trou, dans l'ordre des exemplaires.
 */
export const nestParts = (parts: Part[], o: NestOpts): Composite[] => {
  const c = o.clearance
  const rng = o.rng
  const n = parts.length
  const outerArea = parts.map((p) => polyArea(p.outer))
  const key = outerArea.map((a) => a * (1 + (o.noise && rng ? o.noise * (rng() * 2 - 1) : 0)))
  const order = parts.map((_, i) => i).filter((i) => o.eligible[i]).sort((a, b) => key[b] - key[a] || a - b)
  const step = o.angleStep ?? 90
  const angles = Array.from({ length: Math.round(360 / step) }, (_, i) => i * step)
  if (o.shuffleAngles && rng) {
    for (let i = angles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[angles[i], angles[j]] = [angles[j], angles[i]]
    }
  }
  const minArea = Math.min(...order.map((i) => outerArea[i]))

  const { turns, never } = o.cache ?? makeNestCache()
  const turned = (p: Part, deg: number) => {
    const k = `${p.key}|${deg}`
    let t = turns.get(k)
    if (!t) turns.set(k, (t = turnAny(p, deg)))
    return t
  }

  const fits = (cav: Cavity, q: Pt[], ox: number, oy: number) => {
    for (const v of q) if (!inPolyAt(v[0] + ox, v[1] + oy, cav.pts)) return null
    const moved = q.map((v): Pt => [v[0] + ox, v[1] + oy])
    if (!apart(moved, cav.pts, c)) return null
    const m = shapeOf(moved)
    for (const s of cav.placed) {
      if (m.x0 > s.x1 + c || s.x0 > m.x1 + c || m.y0 > s.y1 + c || s.y0 > m.y1 + c) continue
      if (inPolyAt(moved[0][0], moved[0][1], s.pts) || inPolyAt(s.pts[0][0], s.pts[0][1], moved) || !apart(moved, s.pts, c)) return null
    }
    return m
  }

  const scan = (cav: Cavity, t: ReturnType<typeof turnAny>) => {
    const xa = cav.x0 + c
    const xb = cav.x1 - c - t.w
    const ya = cav.y0 + c
    const yb = cav.y1 - c - t.h
    if (xb < xa - 1e-9 || yb < ya - 1e-9) return null
    const st = clamp(Math.min(cav.x1 - cav.x0, cav.y1 - cav.y0) / 30, 0.4, 2)
    const xs = positions(xa, xb, st)
    for (const y of positions(ya, yb, st)) {
      for (const x of xs) {
        const m = fits(cav, t.outer, x, y)
        if (m) return { x, y, m }
      }
    }
    return null
  }

  const assigned = new Array<boolean>(n).fill(false)
  const members = new Map<number, Member[]>()
  const usedHoles = new Map<number, Set<number>>()
  const rects = parts.map((p) => rectHoleBoxes(p))
  const free = order.slice()

  const cavitiesOf = (p: Part, deg: number, ox: number, oy: number, root: boolean): Cavity[] => {
    const holes = root ? p.holes : turned(p, deg).holes
    return holes.flatMap((h, hi) => {
      const pts = h.map((q): Pt => [q[0] + ox, q[1] + oy])
      const area = polyArea(pts)
      return area >= minArea ? [{ ...shapeOf(pts), placed: [], sig: `${p.key}|${deg}|${hi}`, holeIdx: root ? hi : -1, area, room: area }] : []
    })
  }

  const fill = (host: number, queue: Cavity[]) => {
    for (let qi = 0; qi < queue.length; qi++) {
      const cav = queue[qi]
      if (cav.holeIdx >= 0 && rects[host][cav.holeIdx] && o.skip && rng && rng() < o.skip) continue
      for (let fi = 0; fi < free.length; fi++) {
        const k = free[fi]
        const p = parts[k]
        if (outerArea[k] >= cav.room) continue
        for (const deg of p.rotate === 'none' ? [0] : angles) {
          const nk = `${cav.sig}|${p.key}|${deg}`
          if (!cav.placed.length && never.has(nk)) continue
          const hit = scan(cav, turned(p, deg))
          if (!hit) {
            if (!cav.placed.length) never.add(nk)
            continue
          }
          cav.placed.push(hit.m)
          cav.room -= outerArea[k]
          assigned[k] = true
          free.splice(fi, 1)
          fi--
          members.get(host)!.push({ idx: k, deg, x: hit.x, y: hit.y })
          if (cav.holeIdx >= 0) {
            if (!usedHoles.has(host)) usedHoles.set(host, new Set())
            usedHoles.get(host)!.add(cav.holeIdx)
          }
          queue.push(...cavitiesOf(p, deg, hit.x, hit.y, false))
          break
        }
      }
    }
  }

  for (const i of order) {
    if (assigned[i]) continue
    assigned[i] = true
    const at = free.indexOf(i)
    if (at >= 0) free.splice(at, 1)
    members.set(i, [{ idx: i, deg: 0, x: 0, y: 0 }])
    fill(i, cavitiesOf(parts[i], 0, 0, 0, true).sort((a, b) => b.area - a.area))
  }

  const out: Composite[] = []
  for (let i = 0; i < n; i++) {
    if (!members.has(i)) {
      if (assigned[i]) continue
      members.set(i, [{ idx: i, deg: 0, x: 0, y: 0 }])
    }
    const ms = members.get(i)!
    const used = usedHoles.get(i)
    const holes = rects[i].flatMap((b, hi) => (b && !used?.has(hi) ? [b] : []))
    out.push({ members: ms, holes, noRotate: ms.some((m) => parts[m.idx].rotate === 'none') })
  }
  return out
}
