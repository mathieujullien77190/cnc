import { clearOf, makeRng, polyArea, shapeOf, turnAny, type Shape } from './hollow'
import { tooBig } from './nesting'
import { angleOf, type Instance, type Layout, type Row } from './sheets'
import type { Part, Pt } from './types'

// Rangement polygonal (« Optimiser encore mieux ») : les pièces sont posées avec leur vrai contour, pas leur boîte. Une pièce peut donc
// entrer dans le creux d'un U, s'imbriquer dans un C, se glisser dans le trou d'une autre, ou chevaucher une boîte sans toucher la matière.
// Chaque planche a un quadrillage d'occupation (cellules de `RES` mm) où la matière des pièces posées est dilatée du jeu : une position
// candidate est d'abord testée sur ce quadrillage (rapide, jamais trop sévère), puis confirmée par un vrai test de polygones (`clearOf`).
// Les pièces sont posées une à une au plus bas puis au plus à gauche (origine machine : coin bas-gauche, soit y vers `H` dans le repère
// des planches), sur la première planche où elles tiennent ; puis chaque planche est compactée et reçoit ce qu'elle peut des suivantes.

/** Côté d'une cellule du quadrillage d'occupation (mm) : les positions essayées en sont des multiples. */
export const RES = 1
/** Espace en plus autour des petites pièces quand « desserrer » est coché (mm). */
const SPREAD_EXTRA = 4
/** Une pièce est « petite » quand son grand côté ne dépasse pas ce quart du petit côté de la planche (comme le rangement normal). */
const SMALL_RATIO = 0.25
/** Pas des angles essayés selon la graine (90 le plus souvent : 0, 90, 180, 270). */
const ANGLE_STEPS = [90, 90, 90, 45, 30]
/** Tours de compactage / insertion par planche. */
const MAX_ROUNDS = 4

type Turned = ReturnType<typeof turnAny>

/** Cellules de matière d'une pièce tournée : par rangée, des plages [i0, i1) de colonnes ; `order` : rangées à tester d'abord (la dernière bloquante en tête). */
interface Mask {
  rows: number
  spans: Int32Array[]
  order: number[]
}

/** Une pièce sous un angle : contour tourné, ses contours (extérieur puis trous) et son masque. */
interface Form {
  deg: number
  t: Turned
  rings: Shape[]
  mask: Mask
}

/** Une pièce posée sur une planche. */
interface Spot {
  idx: number
  deg: number
  x: number
  y: number
  h: number
  /** Contours dans le repère de la planche (extérieur puis trous). */
  rings: Shape[]
  /** Jeu demandé autour de cette pièce (mm). */
  cl: number
  area: number
}

interface Board {
  spots: Spot[]
  /** Occupation vue par une pièce normale, et par une petite pièce desserrée (si « desserrer »). */
  grid: Uint8Array
  gridSmall: Uint8Array | null
  used: number
}

/** Formes tournées et masques gardés d'un essai à l'autre (mêmes pièces). */
export interface PolyCache {
  forms: Map<string, Form>
}

export const makePolyCache = (): PolyCache => ({ forms: new Map() })

const maskOf = (t: Turned): Mask => {
  const rows = Math.max(1, Math.ceil(t.h / RES - 1e-9))
  const cols = Math.max(1, Math.ceil(t.w / RES - 1e-9))
  const rings = [t.outer, ...t.holes]
  const spans: Int32Array[] = []
  let cells = 0
  const xs: number[] = []
  for (let j = 0; j < rows; j++) {
    const yc = (j + 0.5) * RES
    xs.length = 0
    for (const ring of rings) {
      for (let i = 0, n = ring.length; i < n; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % n]
        if (a[1] > yc !== b[1] > yc) xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
    }
    xs.sort((p, q) => p - q)
    const sp: number[] = []
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / RES - 0.5 - 1e-9))
      const i1 = Math.min(cols, Math.floor(xs[k + 1] / RES - 0.5 + 1e-9) + 1)
      if (i1 > i0) {
        sp.push(i0, i1)
        cells += i1 - i0
      }
    }
    spans.push(Int32Array.from(sp))
  }
  if (!cells) {
    // pièce plus fine que le quadrillage : ses sommets au moins
    const byRow = new Map<number, Set<number>>()
    for (const [x, y] of t.outer) {
      const j = Math.min(rows - 1, Math.max(0, Math.floor(y / RES)))
      if (!byRow.has(j)) byRow.set(j, new Set())
      byRow.get(j)!.add(Math.min(cols - 1, Math.max(0, Math.floor(x / RES))))
    }
    for (const [j, cs] of byRow) spans[j] = Int32Array.from([...cs].sort((a, b) => a - b).flatMap((i) => [i, i + 1]))
  }
  const len = spans.map((sp) => {
    let s = 0
    for (let k = 0; k < sp.length; k += 2) s += sp[k + 1] - sp[k]
    return s
  })
  const order = spans.map((_, j) => j).filter((j) => len[j] > 0).sort((a, b) => len[b] - len[a])
  return { rows, spans, order }
}

const formOf = (cache: PolyCache, part: Part, deg: number): Form => {
  const key = `${part.key}|${deg}`
  let f = cache.forms.get(key)
  if (!f) {
    const t = turnAny(part, deg)
    cache.forms.set(key, (f = { deg, t, rings: [t.outer, ...t.holes].map(shapeOf), mask: maskOf(t) }))
  }
  return f
}

const shifted = (rings: Shape[], x: number, y: number): Shape[] => rings.map((r) => ({ pts: r.pts.map((p): Pt => [p[0] + x, p[1] + y]), x0: r.x0 + x, x1: r.x1 + x, y0: r.y0 + y, y1: r.y1 + y }))

const segDist2 = (px: number, py: number, a: Pt, b: Pt) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0
  const ex = a[0] + t * dx - px
  const ey = a[1] + t * dy - py
  return ex * ex + ey * ey
}

/** Marque sur le quadrillage les cellules dont le centre est dans la matière de `rings` ou à moins de `c` mm d'un de ses contours. */
const mark = (grid: Uint8Array, GW: number, GH: number, rings: Shape[], c: number) => {
  const o = rings[0]
  const j0 = Math.max(0, Math.floor((o.y0 - c) / RES))
  const j1 = Math.min(GH - 1, Math.ceil((o.y1 + c) / RES))
  const xs: number[] = []
  for (let j = j0; j <= j1; j++) {
    const yc = (j + 0.5) * RES
    xs.length = 0
    for (const r of rings) {
      if (yc < r.y0 || yc > r.y1) continue
      const p = r.pts
      for (let i = 0, n = p.length; i < n; i++) {
        const a = p[i]
        const b = p[(i + 1) % n]
        if (a[1] > yc !== b[1] > yc) xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
    }
    if (xs.length < 2) continue
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / RES - 0.5))
      const i1 = Math.min(GW - 1, Math.floor(xs[k + 1] / RES - 0.5))
      if (i1 >= i0) grid.fill(1, j * GW + i0, j * GW + i1 + 1)
    }
  }
  const c2 = c * c - 1e-9
  for (const r of rings) {
    const p = r.pts
    for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i]
      const b = p[(i + 1) % n]
      const ia = Math.max(0, Math.ceil((Math.min(a[0], b[0]) - c) / RES - 0.5))
      const ib = Math.min(GW - 1, Math.floor((Math.max(a[0], b[0]) + c) / RES - 0.5))
      const ja = Math.max(0, Math.ceil((Math.min(a[1], b[1]) - c) / RES - 0.5))
      const jb = Math.min(GH - 1, Math.floor((Math.max(a[1], b[1]) + c) / RES - 0.5))
      for (let j = ja; j <= jb; j++) {
        const yc = (j + 0.5) * RES
        for (let ii = ia; ii <= ib; ii++) {
          if (!grid[j * GW + ii] && segDist2((ii + 0.5) * RES, yc, a, b) < c2) grid[j * GW + ii] = 1
        }
      }
    }
  }
}

/** La pièce (masque) posée en (gx, gy) touche-t-elle une cellule occupée ? 0 : libre ; sinon de combien de colonnes avancer pour dépasser la cellule bloquante. */
const blocked = (grid: Uint8Array, GW: number, m: Mask, gx: number, gy: number): number => {
  const order = m.order
  for (let r = 0; r < order.length; r++) {
    const j = order[r]
    const sp = m.spans[j]
    const row = (gy + j) * GW + gx
    for (let k = 0; k < sp.length; k += 2) {
      const end = row + sp[k + 1]
      for (let q = row + sp[k]; q < end; q++) {
        if (grid[q]) {
          if (r) {
            // la rangée bloquante passe en tête : elle bloquera sans doute encore à la position suivante
            order[r] = order[0]
            order[0] = j
          }
          return q - (row + sp[k]) + 1
        }
      }
    }
  }
  return 0
}

/**
 * Range `insts` dans des planches de W × H avec leurs vrais contours (jeu max(`gap`, 1) mm). `seed` 0 : déterministe (boîtes décroissantes,
 * 0/90/180/270) ; les autres graines perturbent l'ordre, les angles (parfois 45° ou 30°) et le critère de tri. `start` : un rangement déjà
 * fait (par ex. MaxRects) qu'on compacte et resserre au lieu de partir de zéro. `deadline` : au-delà, le compactage s'arrête (le résultat
 * reste complet et sûr). Sans validation : voir `layoutValid`.
 */
export const polyLayout = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, seed: number, cache: PolyCache, o: { start?: Layout; deadline?: number; now?: () => number } = {}): Layout => {
  if (!(W > 0 && H > 0)) return { bins: [], rejected: insts.slice() }
  const now = o.now ?? (() => performance.now())
  const timeUp = () => o.deadline !== undefined && now() >= o.deadline
  const c = Math.max(gap, 1)
  const cSmall = c + SPREAD_EXTRA
  const GW = Math.ceil(W / RES - 1e-9)
  const GH = Math.ceil(H / RES - 1e-9)
  const rng = makeRng(Math.imul(seed + 1, 0x85ebca6b) ^ 0x27d4eb2f)
  const rnd = seed > 0
  const step = rnd ? ANGLE_STEPS[Math.floor(rng() * ANGLE_STEPS.length)] : 90
  const angles = Array.from({ length: Math.round(360 / step) }, (_, i) => i * step)
  if (rnd && rng() < 0.5) {
    for (let i = angles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[angles[i], angles[j]] = [angles[j], angles[i]]
    }
  }
  const n = insts.length
  const parts = insts.map((i) => i.part)
  const area = parts.map((p) => polyArea(p.outer) - p.holes.reduce((s, h) => s + polyArea(h), 0))
  const small = parts.map((p) => spread && Math.max(p.w, p.h) <= Math.min(W, H) * SMALL_RATIO)
  const clOf = (i: number) => (small[i] ? cSmall : c)
  const formsOf = (i: number): Form[] => (parts[i].rotate === 'none' ? [0] : angles).map((deg) => formOf(cache, parts[i], deg))

  const newBoard = (): Board => ({ spots: [], grid: new Uint8Array(GW * GH), gridSmall: spread ? new Uint8Array(GW * GH) : null, used: 0 })
  const addSpot = (b: Board, s: Spot) => {
    b.spots.push(s)
    b.used += s.area
    mark(b.grid, GW, GH, s.rings, s.cl)
    if (b.gridSmall) mark(b.gridSmall, GW, GH, s.rings, Math.max(s.cl, cSmall))
  }
  const rebuild = (b: Board) => {
    b.grid.fill(0)
    b.gridSmall?.fill(0)
    for (const s of b.spots) {
      mark(b.grid, GW, GH, s.rings, s.cl)
      if (b.gridSmall) mark(b.gridSmall, GW, GH, s.rings, Math.max(s.cl, cSmall))
    }
  }
  const removeSpot = (b: Board, s: Spot) => {
    b.spots.splice(b.spots.indexOf(s), 1)
    b.used -= s.area
    rebuild(b)
  }
  const spotOf = (i: number, f: Form, x: number, y: number, rings: Shape[]): Spot => ({ idx: i, deg: f.deg, x, y, h: f.t.h, rings, cl: clOf(i), area: area[i] })

  /** Test exact de la pièce `i` sous la forme `f` en (x, y) : ses contours décalés si tout est compatible, sinon `null`. */
  const exact = (b: Board, i: number, f: Form, x: number, y: number): Shape[] | null => {
    const rings = shifted(f.rings, x, y)
    const cl = clOf(i)
    for (const s of b.spots) if (!clearOf(rings, s.rings, Math.max(cl, s.cl))) return null
    return rings
  }

  /** Place la plus basse puis la plus à gauche où la pièce `i` tient sur la planche, toutes formes confondues. */
  const scan = (b: Board, i: number, forms: Form[]): Spot | null => {
    if (b.used + area[i] > W * H + 1e-6) return null
    const grid = small[i] && b.gridSmall ? b.gridSmall : b.grid
    for (let bottom = GH; bottom >= 1; bottom--) {
      for (const f of forms) {
        const gy = bottom - f.mask.rows
        if (gy < 0) continue
        const y = gy * RES
        if (y + f.t.h > H + 1e-6) continue
        const maxGx = Math.floor((W - f.t.w) / RES + 1e-6)
        for (let gx = 0; gx <= maxGx; ) {
          const skip = blocked(grid, GW, f.mask, gx, gy)
          if (skip) {
            gx += skip
            continue
          }
          const x = gx * RES
          const rings = exact(b, i, f, x, y)
          if (rings) return spotOf(i, f, x, y, rings)
          gx++
        }
      }
    }
    return null
  }

  const boards: Board[] = []
  const rejected: number[] = []
  const eligible = parts.map((p) => !tooBig({ w: p.w, h: p.h, noRotate: p.rotate === 'none' }, W, H))

  if (o.start) {
    // rangement déjà fait : on le reprend tel quel (positions quelconques, pas forcément sur le quadrillage)
    const seen = new Set<number>()
    for (const bin of o.start.bins) {
      const b = newBoard()
      for (const r of bin) {
        const i = insts.indexOf(r.inst)
        seen.add(i)
        const f = formOf(cache, parts[i], angleOf(r))
        addSpot(b, spotOf(i, f, r.x, r.y, shifted(f.rings, r.x, r.y)))
      }
      boards.push(b)
    }
    for (let i = 0; i < n; i++) if (!seen.has(i)) rejected.push(i)
  } else {
    const keyPick = rnd ? Math.floor(rng() * 4) : 0
    const noise = rnd ? 0.3 * rng() : 0
    const key = parts.map((p, i) => {
      const k = keyPick === 0 ? p.w * p.h : keyPick === 1 ? Math.max(p.w, p.h) ** 2 : keyPick === 2 ? area[i] : ((p.w + p.h) / 2) ** 2
      return k * (1 + noise * (rng() * 2 - 1))
    })
    const order = parts.map((_, i) => i).sort((a, b) => key[b] - key[a] || a - b)
    for (const i of order) {
      if (!eligible[i]) {
        rejected.push(i)
        continue
      }
      const forms = formsOf(i)
      let hit: Spot | null = null
      let at: Board | undefined
      for (const b of boards) {
        hit = scan(b, i, forms)
        if (hit) {
          at = b
          break
        }
      }
      if (!at) {
        at = newBoard()
        hit = scan(at, i, forms)
        if (!hit) {
          rejected.push(i)
          continue
        }
        boards.push(at)
      }
      if (!hit) continue
      addSpot(at, hit)
    }
  }

  // compactage de chaque planche (chaque pièce redescend au plus bas à gauche), puis insertion de ce qui tient depuis les planches suivantes
  for (let si = 0; si < boards.length && !timeUp(); si++) {
    const b = boards[si]
    let changed = true
    for (let round = 0; changed && round < MAX_ROUNDS && !timeUp(); round++) {
      changed = false
      for (const s of [...b.spots].sort((p, q) => q.y + q.h - (p.y + p.h) || p.x - q.x)) {
        if (timeUp()) break
        removeSpot(b, s)
        const forms = formsOf(s.idx)
        const own = forms.find((f) => f.deg === s.deg)
        const hit = scan(b, s.idx, own ? [own, ...forms.filter((f) => f !== own)] : forms)
        if (hit && (hit.y + hit.h > s.y + s.h + 1e-6 || (Math.abs(hit.y + hit.h - (s.y + s.h)) <= 1e-6 && hit.x < s.x - 1e-6))) {
          addSpot(b, hit)
          changed = true
        } else addSpot(b, s)
      }
      const later = boards.slice(si + 1).flatMap((bb) => bb.spots.map((s) => ({ bb, s }))).sort((p, q) => q.s.area - p.s.area || p.s.idx - q.s.idx)
      for (const { bb, s } of later) {
        if (timeUp()) break
        if (b.used + s.area > W * H + 1e-6) continue
        const hit = scan(b, s.idx, formsOf(s.idx))
        if (!hit) continue
        removeSpot(bb, s)
        addSpot(b, hit)
        changed = true
      }
    }
  }

  const rowOf = (s: Spot): Row => (s.deg === 0 ? { inst: insts[s.idx], x: s.x, y: s.y, rot: false } : s.deg === 90 ? { inst: insts[s.idx], x: s.x, y: s.y, rot: true } : { inst: insts[s.idx], x: s.x, y: s.y, rot: false, angle: s.deg })
  return { bins: boards.filter((b) => b.spots.length).map((b) => b.spots.map(rowOf)), rejected: rejected.map((i) => insts[i]) }
}
