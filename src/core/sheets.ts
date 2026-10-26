import { frameBox } from './job'
import { digitRects, markPiece, markSize } from './marking'
import { pack, type Box, type PackItem, type PackPlace } from './nesting'
import type { CustomBoard, Part, Placed, Pt, Sheet, SheetSettings } from './types'

const r3 = (v: number) => Math.round(v * 1000) / 1000

interface Instance {
  uid: string
  part: Part
}

export const instancesOf = (parts: Part[], qtyOf: (p: Part) => number): Instance[] =>
  parts.flatMap((part) => Array.from({ length: Math.max(0, qtyOf(part)) }, (_, i) => ({ uid: `${part.key}#${i + 1}`, part })))

/** Trous rectangulaires (droits, d'au moins 12 mm) d'une pièce : des pièces plus petites peuvent s'y ranger. */
const rectHoles = (part: Part): Box[] =>
  part.holes
    .map((h) => {
      const xs = h.map((p) => p[0])
      const ys = h.map((p) => p[1])
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
      const area = Math.abs(h.reduce((s, p, i) => s + p[0] * h[(i + 1) % h.length][1] - h[(i + 1) % h.length][0] * p[1], 0)) / 2
      return Math.abs(area - box.w * box.h) < 1e-3 * box.w * box.h && box.w >= 12 && box.h >= 12 ? box : null
    })
    .filter((b): b is Box => !!b)

/** Rotation de 90° d'un contour (y vers le bas) dans sa boîte de hauteur h : (x, y) -> (h - y, x). */
const turn90 = (pts: Pt[], h: number): Pt[] => pts.map(([x, y]) => [h - y, x])

/** Pose `part` à (x, y) de la planche, tournée ou non. */
export const placePart = (inst: Instance, x: number, y: number, rot: boolean, n: number): Placed => {
  const { part } = inst
  const move = (pts: Pt[]): Pt[] => (rot ? turn90(pts, part.h) : pts).map(([px, py]) => [r3(px + x), r3(py + y)])
  return { uid: inst.uid, part, n, x: r3(x), y: r3(y), w: rot ? part.h : part.w, h: rot ? part.w : part.h, rot, outer: move(part.outer), holes: part.holes.map(move) }
}

const toItem = (inst: Instance, idx: number): PackItem => ({ w: inst.part.w, h: inst.part.h, idx, noRotate: inst.part.rotate === 'none', holes: rectHoles(inst.part) })

/** Une pièce est « petite » quand son grand côté ne dépasse pas ce quart du petit côté de la planche. */
const SMALL_RATIO = 0.25
/** Espaces supplémentaires essayés autour des petites pièces (mm), du plus large au plus serré. */
const EXTRAS = [12, 10, 8, 6, 5, 4, 3, 2, 1.5, 1]

interface PackOpts {
  multi: boolean
  fixed?: PackPlace[]
}

/**
 * Range les pièces ; avec `spread`, desserre les petites : on cherche le plus grand espace supplémentaire autour d'elles qui ne demande
 * ni planche de plus ni pièce rejetée de plus que le rangement serré. Sans solution, on garde le rangement serré.
 */
const packSpread = (insts: Instance[], W: number, H: number, gap: number, spread: boolean, o: PackOpts) => {
  const base = pack(insts.map(toItem), W, H, gap, o)
  if (!spread) return base
  const limit = Math.min(W, H) * SMALL_RATIO
  const small = insts.map((i) => Math.max(i.part.w, i.part.h) <= limit)
  if (!small.some(Boolean)) return base
  for (const extra of EXTRAS) {
    const items = insts.map((inst, idx): PackItem => {
      const it = toItem(inst, idx)
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

const fillOf = (items: Placed[], w: number, h: number) => items.reduce((s, it) => s + it.w * it.h, 0) / (w * h)

const numbered = (rows: { inst: Instance; x: number; y: number; rot: boolean }[]) =>
  rows.sort((a, b) => a.y - b.y || a.x - b.x).map((r, i) => placePart(r.inst, r.x, r.y, r.rot, i + 1))

/** Planches automatiques : une série par épaisseur, jamais deux épaisseurs sur la même planche. */
export const buildAutoSheets = (parts: Part[], s: SheetSettings): Sheet[] => {
  const W = s.width - 2 * s.margin
  const H = s.height - 2 * s.margin
  const out: Sheet[] = []
  const thicknesses = [...new Set(parts.filter((p) => p.qty > 0).map((p) => p.thickness))].sort((a, b) => a - b)
  for (const t of thicknesses) {
    const insts = instancesOf(parts.filter((p) => p.thickness === t), (p) => p.qty)
    const { bins, rejected } = packSpread(insts, W, H, s.gap, !!s.spread, { multi: true })
    bins.forEach((bin, bi) => {
      const items = numbered(bin.map((pl) => ({ inst: insts[pl.idx], x: pl.x + s.margin, y: pl.y + s.margin, rot: pl.rot })))
      out.push({ key: `auto-${t}-${bi + 1}`, label: `${t} mm · planche ${bi + 1}`, thickness: t, width: s.width, height: s.height, items, rejected: [], custom: false, fill: fillOf(items, s.width, s.height) })
    })
    if (rejected.length) {
      const last = [...out].reverse().find((sh) => sh.thickness === t)
      const lost = rejected.map((r) => insts[r.idx].part)
      if (last) last.rejected = lost
      else out.push({ key: `auto-${t}-0`, label: `${t} mm · rien ne tient`, thickness: t, width: s.width, height: s.height, items: [], rejected: lost, custom: false, fill: 0 })
    }
  }
  // numéro de planche unique sur tout le travail, toutes épaisseurs confondues
  let n = 0
  return out.map((sh) => (sh.items.length ? { ...sh, mark: String(++n), label: `planche ${n} · ${sh.thickness} mm` } : sh))
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
    return { ...toItem(inst, i), w: o.rot ? inst.part.h : inst.part.w, h: o.rot ? inst.part.w : inst.part.h, x: o.x - margin, y: o.y - margin, rot: o.rot }
  })
  const { bins, rejected } = packSpread(free, W, H, gap, spread, { multi: false, fixed })
  const rows = [
    ...fixedInsts.map((inst) => ({ inst, x: b.overrides[inst.uid].x, y: b.overrides[inst.uid].y, rot: b.overrides[inst.uid].rot })),
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

/** Exemplaires qui sortent de la planche ou se chevauchent (pièces déplacées à la main). Une pièce posée dans le trou d'une autre est permise. */
export const conflicts = (sheet: Sheet): Set<string> => {
  const bad = new Set<string>()
  const boxes = sheet.items.map((it) => ({ it, b: bbox(it.outer), holes: it.holes.map(bbox) }))
  const eps = 1e-6
  for (const { it, b } of boxes) if (b.x0 < -eps || b.y0 < -eps || b.x1 > sheet.width + eps || b.y1 > sheet.height + eps) bad.add(it.uid)
  const within = (a: ReturnType<typeof bbox>, h: ReturnType<typeof bbox>) => a.x0 >= h.x0 - eps && a.x1 <= h.x1 + eps && a.y0 >= h.y0 - eps && a.y1 <= h.y1 + eps
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      if (a.b.x0 >= c.b.x1 - eps || c.b.x0 >= a.b.x1 - eps || a.b.y0 >= c.b.y1 - eps || c.b.y0 >= a.b.y1 - eps) continue
      if (c.holes.some((h) => within(a.b, h)) || a.holes.some((h) => within(c.b, h))) continue
      bad.add(a.it.uid)
      bad.add(c.it.uid)
    }
  }
  return bad
}

const markCache = new Map<string, Pt[][]>()

/** Rectangles gravés du nom d'une pièce posée. Calculés une fois par pièce et orientation (dans le repère de la pièce), puis déplacés. */
export const marksOf = (it: Placed): Pt[][] => {
  const key = `${it.part.key}|${it.rot ? 1 : 0}|${it.part.id}|${it.part.w}x${it.part.h}|${it.part.outer.length}.${it.part.holes.length}`
  let local = markCache.get(key)
  if (!local) {
    const mv = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x - it.x, y - it.y])
    local = markPiece({ x: 0, y: 0, w: it.w, h: it.h, outer: mv(it.outer), holes: it.holes.map(mv) }, it.part.id)
    markCache.set(key, local)
  }
  return local.map((r) => r.map(([x, y]): Pt => [r3(x + it.x), r3(y + it.y)]))
}

/** Hauteur du numéro de planche gravé (mm). */
const BOARD_MARK_H = 2.8

/**
 * Numéro de la planche (`sheet.mark`) en rectangles à graver, deux fois : en haut et en bas de la planche (à gauche, sinon à droite),
 * hors des pièces et du cadre. Un emplacement sans place (marge trop petite) est sauté. [] s'il n'y a pas de numéro.
 */
export const boardMark = (sheet: Sheet): Pt[][] => {
  if (!sheet.mark) return []
  const h = BOARD_MARK_H
  const { w } = markSize(sheet.mark, h)
  const g = 0.8
  const f = frameBox(sheet)
  type Box = { x0: number; y0: number; x1: number; y1: number }
  const hit = (a: Box, b: Box) => a.x0 < b.x1 + 0.5 && a.x1 > b.x0 - 0.5 && a.y0 < b.y1 + 0.5 && a.y1 > b.y0 - 0.5
  const free = (x: number, y: number) => {
    const box = { x0: x, y0: y, x1: x + w, y1: y + h }
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > sheet.width || box.y1 > sheet.height) return false
    if (sheet.items.some((it) => hit(box, { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h }))) return false
    return !(f && hit(box, f))
  }
  const out: Pt[][] = []
  for (const y of [g, sheet.height - h - g]) {
    const x = [g, sheet.width - w - g].find((x) => free(x, y))
    if (x !== undefined) out.push(...digitRects(sheet.mark, x, y, h, 2))
  }
  return out
}

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
