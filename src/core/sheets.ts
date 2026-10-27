import { familyOf } from './family'
import { markPiece } from './marking'
import { makeRng, nestParts, rectHoles, turnAny, type Composite, type NestCache } from './hollow'
import { ORDERS, pack, tooBig, type Order, type PackItem, type PackPlace, type Rule } from './nesting'
import type { CustomBoard, Marking, Override, Part, Placed, Pt, Sheet, SheetSettings } from './types'

const r3 = (v: number) => Math.round(v * 1000) / 1000

export interface Instance {
  uid: string
  part: Part
}

export const instancesOf = (parts: Part[], qtyOf: (p: Part) => number): Instance[] =>
  parts.flatMap((part) => Array.from({ length: Math.max(0, qtyOf(part)) }, (_, i) => ({ uid: `${part.key}#${i + 1}`, part })))

/** Rotation de 90° d'un contour (y vers le bas) dans sa boîte de hauteur h : (x, y) -> (h - y, x). */
const turn90 = (pts: Pt[], h: number): Pt[] => pts.map(([x, y]) => [h - y, x])

/** Angle actuel d'une pièce posée (degrés). */
export const angleOf = (it: { rot: boolean; angle?: number }) => it.angle ?? (it.rot ? 90 : 0)

/** Position qui met la pièce à `deg` degrés en gardant son centre en place. */
export const turnTo = (it: Placed, deg: number): Override => {
  const d = ((deg % 360) + 360) % 360
  const t = turnAny(it.part, d)
  return { x: r3(it.x + it.w / 2 - t.w / 2), y: r3(it.y + it.h / 2 - t.h / 2), rot: false, angle: r3(d) }
}

/** Pose `part` à (x, y) de la planche, tournée ou non (`angle` : rotation libre, x, y = coin de la boîte du contour tourné). */
export const placePart = (inst: Instance, x: number, y: number, rot: boolean, n: number, angle?: number): Placed => {
  const { part } = inst
  if (angle !== undefined) {
    const t = turnAny(part, angle)
    const move = (pts: Pt[]): Pt[] => pts.map(([px, py]) => [r3(px + x), r3(py + y)])
    return { uid: inst.uid, part, n, x: r3(x), y: r3(y), w: r3(t.w), h: r3(t.h), rot: false, angle, outer: move(t.outer), holes: t.holes.map(move), ...(t.labels ? { labels: t.labels.map(move) } : {}) }
  }
  const move = (pts: Pt[]): Pt[] => (rot ? turn90(pts, part.h) : pts).map(([px, py]) => [r3(px + x), r3(py + y)])
  return { uid: inst.uid, part, n, x: r3(x), y: r3(y), w: rot ? part.h : part.w, h: rot ? part.w : part.h, rot, outer: move(part.outer), holes: part.holes.map(move), ...(part.labels ? { labels: part.labels.map(move) } : {}) }
}

const toItem = (inst: Instance, idx: number): PackItem => ({ w: inst.part.w, h: inst.part.h, idx, noRotate: inst.part.rotate === 'none', holes: rectHoles(inst.part) })

/** Une pièce est « petite » quand son grand côté ne dépasse pas ce quart du petit côté de la planche. */
const SMALL_RATIO = 0.25
/** Espaces supplémentaires essayés autour des petites pièces (mm), du plus large au plus serré. */
const EXTRAS = [12, 10, 8, 6, 5, 4, 3, 2, 1.5, 1]

interface PackOpts {
  multi: boolean
  fixed?: PackPlace[]
  orders?: Order[]
  rule?: Rule
}

const smallOf = (items: PackItem[], W: number, H: number) => items.map((it) => Math.max(it.w, it.h) <= Math.min(W, H) * SMALL_RATIO)

/**
 * Range les pièces ; avec `spread`, desserre les petites : on cherche le plus grand espace supplémentaire autour d'elles qui ne demande
 * ni planche de plus ni pièce rejetée de plus que le rangement serré. Sans solution, on garde le rangement serré.
 */
const packSpreadItems = (list: PackItem[], W: number, H: number, gap: number, spread: boolean, o: PackOpts) => {
  const base = pack(list, W, H, gap, o)
  if (!spread) return base
  const small = smallOf(list, W, H)
  if (!small.some(Boolean)) return base
  for (const extra of EXTRAS) {
    const items = list.map((it, idx): PackItem => {
      if (!small[idx]) return it
      return { ...it, w: it.w + extra, h: it.h + extra, holes: it.holes?.map((h) => ({ ...h, x: h.x + extra / 2, y: h.y + extra / 2 })) }
    })
    const r = pack(items, W, H, gap, o)
    if (r.rejected.length > base.rejected.length || r.bins.length > base.bins.length) continue
    // la pièce est recentrée dans sa case agrandie
    const bins = r.bins.map((bin) => bin.map((pl) => (small[pl.idx] ? { ...pl, x: pl.x + extra / 2, y: pl.y + extra / 2, w: pl.w - extra, h: pl.h - extra } : pl)))
    return { bins, rejected: r.rejected }
  }
  return base
}

const packSpreadTop = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, o: PackOpts) => packSpreadItems(insts.map(toItem), W, H, gap, spread, o)

/** Le rangement part du coin bas-gauche de la planche (comme la machine) : on range depuis le haut dans un repère retourné, puis on retourne le résultat. */
const packSpread = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, o: PackOpts) => {
  const flip = <T extends { y: number; h: number }>(p: T): T => ({ ...p, y: H - p.y - p.h })
  const r = packSpreadTop(insts, W, H, gap, spread, { ...o, fixed: o.fixed?.map(flip) })
  return { bins: r.bins.map((bin) => bin.map(flip)), rejected: r.rejected }
}

/** Une pièce posée sur la planche (coin de sa boîte, `rot` : 90°, `angle` : rotation libre) : le résultat d'un rangement, avant de devenir une `Placed`. */
export interface Row {
  inst: Instance
  x: number
  y: number
  rot: boolean
  angle?: number
}

/** Un rangement : les pièces de chaque planche (repère de la zone utile, sans la marge) et ce qui ne tient pas. */
export interface Layout {
  bins: Row[][]
  rejected: Instance[]
}

/** Rangement normal (MaxRects, trous rectangulaires réutilisés, desserrage éventuel). */
export const baseLayout = (insts: Instance[], W: number, H: number, gap: number, spread: boolean): Layout => {
  const { bins, rejected } = packSpread(insts, W, H, gap, spread, { multi: true })
  return { bins: bins.map((bin) => bin.map((pl) => ({ inst: insts[pl.idx], x: pl.x, y: pl.y, rot: pl.rot }))), rejected: rejected.map((r) => insts[r.idx]) }
}

/** Pas d'angle essayés pour les pièces rangées dans des trous : 90° le plus souvent, parfois plus fin. */
const DEEP_STEPS = [90, 90, 45, 30, 15]
const DEEP_RULES: Rule[] = ['bssf', 'blsf', 'baf', 'bl']

/** Pièces d'un composite sur la planche : l'hôte posé en `pl` (tourné de 90° ou non), les invitées à leur place dans son repère. */
const rowsOf = (insts: Instance[], comp: Composite, pl: { x: number; y: number; rot: boolean }): Row[] => {
  const root = insts[comp.members[0].idx]
  return comp.members.map((m, k) => {
    const inst = insts[m.idx]
    if (k === 0) return { inst, x: pl.x, y: pl.y, rot: pl.rot }
    const t = turnAny(inst.part, m.deg)
    const deg = (m.deg + (pl.rot ? 90 : 0)) % 360
    const x = r3(pl.rot ? pl.x + root.part.h - m.y - t.h : pl.x + m.x)
    const y = r3(pl.rot ? pl.y + m.x : pl.y + m.y)
    return deg === 0 ? { inst, x, y, rot: false } : deg === 90 ? { inst, x, y, rot: true } : { inst, x, y, rot: false, angle: deg }
  })
}

/**
 * Rangement « en profondeur » de la graine `seed` : les pièces qui tiennent dans le trou d'une autre (forme quelconque, vrai test de polygone,
 * jeu `max(gap, 1)` mm) y sont posées d'abord ; chaque hôte avec ses invitées est ensuite rangé comme une seule pièce. La graine 0 est
 * déterministe (tailles décroissantes, 4 angles) ; les autres perturbent l'ordre, les angles essayés, les ordres de tri et la règle de place. Sans validation : voir `layoutValid`.
 * `cache` : à partager entre des essais sur les mêmes pièces (accélère la recherche, ne change pas le résultat).
 */
export const deepLayout = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, seed: number, cache?: NestCache): Layout => {
  const rng = makeRng(Math.imul(seed + 1, 0x9e3779b1) ^ 0x5bd1e995)
  const rnd = seed > 0
  const noise = rnd ? 0.05 + 0.4 * rng() : 0
  const angleStep = rnd ? DEEP_STEPS[Math.floor(rng() * DEEP_STEPS.length)] : 90
  const skip = rnd && rng() < 0.5 ? 0.1 + 0.3 * rng() : 0
  const shuffleAngles = rnd && rng() < 0.5
  const eligible = insts.map((i) => !tooBig({ w: i.part.w, h: i.part.h, noRotate: i.part.rotate === 'none' }, W, H))
  const comps = nestParts(insts.map((i) => i.part), { clearance: Math.max(gap, 1), cache, eligible, rng, noise, angleStep, shuffleAngles, skip })
  const items = comps.map((c, ci): PackItem => {
    const root = insts[c.members[0].idx].part
    return { w: root.w, h: root.h, idx: ci, noRotate: c.noRotate, holes: c.holes }
  })
  const keyed = (): Order => {
    const k = items.map((it) => it.w * it.h * (1 + noise * (rng() * 2 - 1)))
    return (a, b) => k[b.idx] - k[a.idx] || a.idx - b.idx
  }
  const orders = rnd ? [...ORDERS, keyed(), keyed()] : ORDERS
  const rule = rnd ? DEEP_RULES[Math.floor(rng() * DEEP_RULES.length)] : 'bssf'
  const r = packSpreadItems(items, W, H, gap, spread, { multi: true, orders, rule })
  return {
    bins: r.bins.map((bin) => bin.flatMap((pl) => rowsOf(insts, comps[pl.idx], { x: pl.x, y: H - pl.y - pl.h, rot: pl.rot }))),
    rejected: r.rejected.flatMap((it) => comps[it.idx].members.map((m) => insts[m.idx])),
  }
}

/** Le rangement est-il sûr ? Toutes les pièces posées une fois, aucune ne sort ni n'en chevauche une autre (une pièce dans un trou est permise). */
export const layoutValid = (l: Layout, insts: Instance[], W: number, H: number): boolean => {
  if (l.bins.reduce((s, b) => s + b.length, 0) + l.rejected.length !== insts.length) return false
  return l.bins.every((bin) => {
    const items = bin.map((r, i) => placePart(r.inst, r.x, r.y, r.rot, i + 1, r.angle))
    return conflicts({ items, width: W, height: H } as Sheet).size === 0
  })
}

/** Rangement d'un groupe : normal, ou « en profondeur » si une graine est donnée (et sûre : sinon le rangement normal). */
export const layoutGroup = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, seed?: number): Layout => {
  if (seed !== undefined) {
    const l = deepLayout(insts, W, H, gap, spread, seed)
    if (layoutValid(l, insts, W, H)) return l
  }
  return baseLayout(insts, W, H, gap, spread)
}

/** Un groupe de pièces rangées ensemble : même épaisseur (et même famille avec `byType`). `key` : `3` ou `3|R`. */
export interface AutoGroup {
  t: number
  family: string
  key: string
  insts: Instance[]
}

export const autoGroups = (parts: Part[], s: SheetSettings): AutoGroup[] => {
  const thicknesses = [...new Set(parts.filter((p) => p.qty > 0).map((p) => p.thickness))].sort((a, b) => a - b)
  return thicknesses.flatMap((t) => {
    const all = instancesOf(parts.filter((p) => p.thickness === t), (p) => p.qty)
    // sans `byType` tout est rangé ensemble ; avec, chaque famille a ses propres planches
    const groups = s.byType ? [...new Set(all.map((i) => familyOf(i.part.id)))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })).map((family) => ({ family, insts: all.filter((i) => familyOf(i.part.id) === family) })) : [{ family: '', insts: all }]
    return groups.map((g) => ({ t, family: g.family, key: g.family ? `${t}|${g.family}` : `${t}`, insts: g.insts }))
  })
}

/** Empreinte de ce dont dépend le rangement automatique (réglages de planche, pièces et quantités) : une solution « Optimiser mieux » n'est valable que pour la même. */
export const deepSignature = (parts: Part[], s: SheetSettings): string => {
  let h = 2166136261
  const add = (text: string) => {
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }
  add(`${s.width}|${s.height}|${s.margin}|${s.gap}|${s.spread ? 1 : 0}|${s.byType ? 1 : 0}`)
  for (const p of parts) {
    if (p.qty <= 0) continue
    add(`;${p.key}|${p.qty}|${p.thickness}|${p.rotate}|${p.w}|${p.h}`)
    for (const pts of [p.outer, ...p.holes]) add(`|${pts.length}:${pts.reduce((a, q) => a + q[0] * 7 + q[1] * 13, 0).toFixed(2)}`)
  }
  return (h >>> 0).toString(36)
}

/** La solution « Optimiser mieux » gardée dans les réglages, si elle correspond encore aux pièces et aux réglages. */
export const validDeep = (parts: Part[], s: SheetSettings) => (s.deep && s.deep.sig === deepSignature(parts, s) ? s.deep : undefined)

const fillOf = (items: Placed[], w: number, h: number) => items.reduce((s, it) => s + it.w * it.h, 0) / (w * h)

const numbered = (rows: { inst: Instance; x: number; y: number; rot: boolean; angle?: number }[]) =>
  rows.sort((a, b) => a.y - b.y || a.x - b.x).map((r, i) => placePart(r.inst, r.x, r.y, r.rot, i + 1, r.angle))

/** Planches automatiques : une série par épaisseur (et par famille de pièces avec `byType`), jamais deux épaisseurs sur la même planche. */
export const buildAutoSheets = (parts: Part[], s: SheetSettings): Sheet[] => {
  const W = s.width - 2 * s.margin
  const H = s.height - 2 * s.margin
  const out: Sheet[] = []
  const families = new Map<string, string>() // clé de planche -> famille (avec `byType`)
  const plan = validDeep(parts, s)
  for (const { t, family, key: groupKey, insts } of autoGroups(parts, s)) {
    const stem = family ? `auto-${t}-${family}` : `auto-${t}`
    const { bins, rejected } = layoutGroup(insts, W, H, s.gap, !!s.spread, plan?.seeds[groupKey])
    bins.forEach((bin, bi) => {
      const items = numbered(bin.map((r) => ({ ...r, x: r.x + s.margin, y: r.y + s.margin })))
      const key = `${stem}-${bi + 1}`
      families.set(key, family)
      out.push({ key, label: `${t} mm · planche ${bi + 1}`, thickness: t, width: s.width, height: s.height, items, rejected: [], custom: false, fill: fillOf(items, s.width, s.height) })
    })
    if (rejected.length) {
      const last = [...out].reverse().find((sh) => sh.thickness === t && families.get(sh.key) === family)
      const lost = rejected.map((r) => r.part)
      if (last) last.rejected = lost
      else {
        families.set(`${stem}-0`, family)
        out.push({ key: `${stem}-0`, label: `${t} mm · rien ne tient`, thickness: t, width: s.width, height: s.height, items: [], rejected: lost, custom: false, fill: 0 })
      }
    }
  }
  // numéro de planche unique sur tout le travail, toutes épaisseurs confondues
  let n = 0
  return out.map((sh) => (sh.items.length ? { ...sh, mark: String(++n), label: `planche ${n}${families.get(sh.key) ? ` · ${families.get(sh.key)}` : ''}` } : sh))
}

/** Une planche (automatique) reprise telle quelle comme planche perso : mêmes pièces, chacune à sa place. */
export const boardFromSheet = (sheet: Sheet, marking: Marking): Pick<CustomBoard, 'name' | 'thickness' | 'width' | 'height' | 'qty' | 'overrides' | 'marking'> => {
  const qty: Record<string, number> = {}
  const overrides: Record<string, Override> = {}
  for (const it of sheet.items) {
    // les exemplaires d'une planche perso sont numérotés 1, 2, 3… par pièce, quelle que soit leur numérotation d'origine
    const n = (qty[it.part.key] = (qty[it.part.key] ?? 0) + 1)
    overrides[`${it.part.key}#${n}`] = { x: it.x, y: it.y, rot: it.rot, angle: it.angle }
  }
  return { name: sheet.label, thickness: sheet.thickness, width: sheet.width, height: sheet.height, qty, overrides, marking: { ...marking } }
}

/** Une planche personnalisée : les pièces demandées sur une seule planche ; celles déplacées à la main restent où elles sont. */
export const buildCustomSheet = (b: CustomBoard, catalog: Part[], margin: number, gap: number, spread = false): Sheet => {
  const insts = instancesOf(catalog.filter((p) => p.thickness === b.thickness), (p) => b.qty[p.key] ?? 0)
  const W = b.width - 2 * margin
  const H = b.height - 2 * margin
  const fixedInsts = insts.filter((i) => b.overrides[i.uid])
  const free = insts.filter((i) => !b.overrides[i.uid])
  const fixed: PackPlace[] = fixedInsts.map((inst, i) => {
    const o = b.overrides[inst.uid]
    if (o.angle !== undefined) {
      const t = turnAny(inst.part, o.angle)
      return { ...toItem(inst, i), holes: [], w: t.w, h: t.h, x: o.x - margin, y: o.y - margin, rot: false }
    }
    return { ...toItem(inst, i), w: o.rot ? inst.part.h : inst.part.w, h: o.rot ? inst.part.w : inst.part.h, x: o.x - margin, y: o.y - margin, rot: o.rot }
  })
  const { bins, rejected } = packSpread(free, W, H, gap, spread, { multi: false, fixed })
  const rows = [
    ...fixedInsts.map((inst) => ({ inst, x: b.overrides[inst.uid].x, y: b.overrides[inst.uid].y, rot: b.overrides[inst.uid].rot, angle: b.overrides[inst.uid].angle })),
    ...(bins[0] ?? []).map((pl) => ({ inst: free[pl.idx], x: pl.x + margin, y: pl.y + margin, rot: pl.rot })),
  ]
  const items = numbered(rows)
  return { key: `perso-${b.id}`, label: b.name, thickness: b.thickness, width: b.width, height: b.height, items, rejected: rejected.map((r) => free[r.idx].part), custom: true, fill: fillOf(items, b.width, b.height) }
}

const bbox = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

const EPS = 1e-6

/** Point strictement à l'intérieur du polygone (le bord compte comme dehors). */
const strictlyIn = (p: Pt, poly: Pt[]) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const cross = (xj - xi) * (p[1] - yi) - (yj - yi) * (p[0] - xi)
    if (Math.abs(cross) < EPS && p[0] >= Math.min(xi, xj) - EPS && p[0] <= Math.max(xi, xj) + EPS && p[1] >= Math.min(yi, yj) - EPS && p[1] <= Math.max(yi, yj) + EPS) return false
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Deux segments se croisent franchement (se toucher au bout ou se longer ne compte pas). */
const crosses = (a: Pt, b: Pt, c: Pt, d: Pt) => {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(a, b, c)
  const d2 = o(a, b, d)
  const d3 = o(c, d, a)
  const d4 = o(c, d, b)
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
}

interface Solid {
  outer: Pt[]
  holes: Pt[][]
}

const inSolid = (p: Pt, s: Solid) => strictlyIn(p, s.outer) && !s.holes.some((h) => strictlyIn(p, h) || h.some((q) => Math.abs(q[0] - p[0]) < EPS && Math.abs(q[1] - p[1]) < EPS))

/** Deux pièces occupent-elles la même matière ? (contours réels, pas les boîtes : une pièce dans un trou, ou dans le creux d'un U, est permise) */
const overlaps = (a: Solid, b: Solid) => {
  const ra = [a.outer, ...a.holes]
  const rb = [b.outer, ...b.holes]
  for (const pa of ra) for (let i = 0; i < pa.length; i++) for (const pb of rb) for (let j = 0; j < pb.length; j++) if (crosses(pa[i], pa[(i + 1) % pa.length], pb[j], pb[(j + 1) % pb.length])) return true
  const probes = (s: Solid): Pt[] => s.outer.flatMap((q, i): Pt[] => [q, [(q[0] + s.outer[(i + 1) % s.outer.length][0]) / 2, (q[1] + s.outer[(i + 1) % s.outer.length][1]) / 2]])
  return probes(a).some((q) => inSolid(q, b)) || probes(b).some((q) => inSolid(q, a))
}

/** Exemplaires qui sortent de la planche ou se chevauchent (pièces déplacées à la main). Une pièce posée dans le trou d'une autre est permise. */
export const conflicts = (sheet: Sheet): Set<string> => {
  const bad = new Set<string>()
  const boxes = sheet.items.map((it) => ({ it, b: bbox(it.outer) }))
  for (const { it, b } of boxes) if (b.x0 < -EPS || b.y0 < -EPS || b.x1 > sheet.width + EPS || b.y1 > sheet.height + EPS) bad.add(it.uid)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      if (a.b.x0 >= c.b.x1 - EPS || c.b.x0 >= a.b.x1 - EPS || a.b.y0 >= c.b.y1 - EPS || c.b.y0 >= a.b.y1 - EPS) continue
      if (!overlaps(a.it, c.it)) continue
      bad.add(a.it.uid)
      bad.add(c.it.uid)
    }
  }
  return bad
}

const markCache = new Map<string, Pt[][]>()

/** Rectangles gravés du NOM d'une pièce posée (les dessins sont à part : `drawingsOf`). Calculés une fois par pièce et orientation (dans le repère de la pièce), puis déplacés. */
export const marksOf = (it: Placed): Pt[][] => {
  const key = `${it.part.key}|${it.rot ? 1 : 0}${it.angle ?? ''}|${it.part.id}|${it.part.w}x${it.part.h}|${it.part.outer.length}.${it.part.holes.length}`
  let local = markCache.get(key)
  if (!local) {
    const mv = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x - it.x, y - it.y])
    // les textes gravés en plus du nom sont des obstacles : le nom ne se pose pas dessus
    local = markPiece({ x: 0, y: 0, w: it.w, h: it.h, outer: mv(it.outer), holes: [...it.holes, ...(it.labels ?? [])].map(mv) }, it.part.id)
    markCache.set(key, local)
  }
  const placed = local.map((r) => r.map(([x, y]): Pt => [r3(x + it.x), r3(y + it.y)]))
  return placed
}

/** Dessins gravés d'une pièce posée (textes, traits, tableaux du modèle) : à part des noms, avec leur propre case et leur propre couleur. */
export const drawingsOf = (it: Placed): Pt[][] => it.labels ?? []

/** Dessins gravés de toutes les pièces d'une planche, par exemplaire. */
export const drawingsFor = (sheet: Sheet): Map<string, Pt[][]> => new Map(sheet.items.filter((it) => it.labels?.length).map((it) => [it.uid, drawingsOf(it)]))

const marksForCache = new WeakMap<Sheet, Map<string, Pt[][]>>()

/** Noms gravés de toutes les pièces d'une planche, par exemplaire (mis en cache par planche). */
export const marksFor = (sheet: Sheet): Map<string, Pt[][]> => {
  let m = marksForCache.get(sheet)
  if (!m) {
    m = new Map(sheet.items.map((it) => [it.uid, marksOf(it)]))
    marksForCache.set(sheet, m)
  }
  return m
}
