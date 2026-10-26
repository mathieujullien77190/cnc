// Rangement de rectangles dans des planches : MaxRects, règle « meilleur petit côté restant ». Plusieurs ordres de tri sont
// essayés, on garde celui qui range le plus de pièces avec le moins de planches. Rotation de 90° permise sauf `noRotate`.
// Les trous rectangulaires d'une pièce redeviennent de la place libre (des carrés dans des carrés).

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface PackItem {
  w: number
  h: number
  idx: number
  noRotate?: boolean
  /** Trous rectangulaires dans le repère de la pièce. */
  holes?: Box[]
}

export interface PackPlace extends PackItem {
  x: number
  y: number
  rot: boolean
}

export class Bin {
  free: Box[]
  items: PackPlace[] = []
  constructor(sw: number, sh: number, readonly gap: number) {
    this.free = [{ x: 0, y: 0, w: sw + gap, h: sh + gap }] // le jeu peut dépasser de la planche : une pièce de pleine taille tient
  }

  find(w: number, h: number, noRotate?: boolean) {
    let best: { x: number; y: number; w: number; h: number; rot: boolean; short: number; long: number } | null = null
    for (const f of this.free) {
      const tries: [number, number, boolean][] = noRotate ? [[w, h, false]] : [[w, h, false], [h, w, true]]
      for (const [pw, ph, rot] of tries) {
        if (pw > f.w || ph > f.h) continue
        const short = Math.min(f.w - pw, f.h - ph)
        const long = Math.max(f.w - pw, f.h - ph)
        if (!best || short < best.short || (short === best.short && long < best.long)) best = { x: f.x, y: f.y, w: pw, h: ph, rot, short, long }
      }
    }
    return best
  }

  place(item: PackItem): boolean {
    const p = this.find(item.w + this.gap, item.h + this.gap, item.noRotate)
    if (!p) return false
    this.items.push({ ...item, x: p.x, y: p.y, w: p.rot ? item.h : item.w, h: p.rot ? item.w : item.h, rot: p.rot })
    this.carve({ x: p.x, y: p.y, w: p.w, h: p.h }, item, p.rot)
    return true
  }

  /** Occupe la place d'une pièce déjà posée (x, y, w, h de la planche) : pour ranger d'autres pièces autour. */
  occupy(it: PackPlace) {
    const { rot } = it
    this.carve({ x: it.x, y: it.y, w: it.w + this.gap, h: it.h + this.gap }, { ...it, w: rot ? it.h : it.w, h: rot ? it.w : it.h }, rot)
  }

  carve(r: Box, item: PackItem, rot: boolean) {
    const nested = (item.holes ?? []).map((h) => {
      const [x0, x1, y0, y1] = rot ? [item.h - h.y - h.h, item.h - h.y, h.x, h.x + h.w] : [h.x, h.x + h.w, h.y, h.y + h.h]
      return { x: r.x + x0 + this.gap, y: r.y + y0 + this.gap, w: x1 - x0 - this.gap, h: y1 - y0 - this.gap }
    })
    const next: Box[] = []
    for (const f of this.free) {
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) {
        next.push(f)
        continue
      }
      if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h })
      if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h })
      if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y })
      if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h })
    }
    next.push(...nested.filter((n) => n.w > 0 && n.h > 0))
    this.free = next.filter(
      (a, i) =>
        a.w > 0 &&
        a.h > 0 &&
        !next.some((b, j) => j !== i && b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h && !(i < j && b.x === a.x && b.y === a.y && b.w === a.w && b.h === a.h)),
    )
  }
}

type Packed = { bins: Bin[]; rejected: PackItem[] }

const tooBig = (it: PackItem, sw: number, sh: number) =>
  it.noRotate ? it.w > sw || it.h > sh : Math.min(it.w, it.h) > Math.min(sw, sh) || Math.max(it.w, it.h) > Math.max(sw, sh)

const ORDERS: ((a: PackItem, b: PackItem) => number)[] = [
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
  (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h,
  (a, b) => b.w + b.h - (a.w + a.h),
  (a, b) => b.h - a.h || b.w - a.w,
  (a, b) => b.w - a.w || b.h - a.h,
]

/**
 * Range `items` dans des planches de sw × sh (jeu `gap` entre pièces). `multi` faux : une seule planche, ce qui ne tient pas est rejeté.
 * `fixed` : pièces déjà posées (x, y, w, h de la planche, rot) autour desquelles on range le reste (première planche seulement).
 */
export const pack = (items: PackItem[], sw: number, sh: number, gap: number, { multi = true, fixed = [] as PackPlace[] } = {}): { bins: PackPlace[][]; rejected: PackItem[] } => {
  let best: Packed | null = null
  for (const order of ORDERS) {
    const start = new Bin(sw, sh, gap)
    for (const f of fixed) start.occupy(f)
    const bins = packOnce(start, items, sw, sh, gap, order, multi)
    if (!best || bins.rejected.length < best.rejected.length || (bins.rejected.length === best.rejected.length && bins.bins.length < best.bins.length)) best = bins
  }
  return { bins: (best?.bins ?? []).map((b) => b.items), rejected: best?.rejected ?? [] }
}

// La première planche peut être déjà préparée (pièces fixes) : on y range d'abord.
const packOnce = (first: Bin, items: PackItem[], sw: number, sh: number, gap: number, order: (a: PackItem, b: PackItem) => number, multi: boolean): Packed => {
  const out: Packed = { bins: [first], rejected: [] }
  for (const it of [...items].sort(order)) {
    if (tooBig(it, sw, sh)) {
      out.rejected.push(it)
      continue
    }
    if (out.bins.some((b) => b.place(it))) continue
    if (!multi) {
      out.rejected.push(it)
      continue
    }
    const b = new Bin(sw, sh, gap)
    if (b.place(it)) out.bins.push(b)
    else out.rejected.push(it)
  }
  return out
}
