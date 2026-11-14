import type { Pt } from '../core/types'
import { digitRects, filledWidths } from '../core/marking'
import { snugPanel } from './snug'
import { RULE_W, type Panel } from './types'

const r3 = (v: number) => Math.round(v * 1000) / 1000
const round = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [r3(x), r3(y)])

/** Un trait gravé : rectangle fin autour du segment (droit ou oblique), un demi-trait de rallonge à chaque bout. */
export const ruleRect = ([x0, y0, x1, y1, w]: number[]): Pt[] => {
  const h = (w ?? RULE_W) / 2 // 5e valeur (option) : largeur de ce trait, sinon RULE_W ; la 6e (option) est le pas entre deux contours emboîtés (0,25 mm par défaut)
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const [ux, uy] = [((x1 - x0) / len) * h, ((y1 - y0) / len) * h]
  const [ax, ay, bx, by] = [x0 - ux, y0 - uy, x1 + ux, y1 + uy]
  return [[ax - uy, ay + ux], [bx - uy, by + ux], [bx + uy, by - ux], [ax + uy, ay - ux]]
}

/** Un rond gravé en cercles emboîtés : du rayon r vers le centre (ou jusqu'à rMin : un anneau), un cercle tous les `pas` mm (polygones de 48 côtés). */
export const CIRCLE_SIDES = 48
export const circleRings = ([cx, cy, r, pas, rMin, a0, a1, du]: number[]): Pt[][] => {
  const out: Pt[][] = []
  const full = a0 === undefined || a1 === undefined || Math.abs(a1 - a0) >= 359.99
  for (let rr = r; rr >= (rMin ?? 0.1) - 1e-9; rr -= pas ?? 0.25) {
    const pt = (deg: number, rad: number): Pt => [cx + (rad + (du ?? 0)) * Math.cos((deg * Math.PI) / 180), cy + rad * Math.sin((deg * Math.PI) / 180)] // `du` : rayon en plus dans le sens u (un ovale)
    if (full) {
      out.push(Array.from({ length: CIRCLE_SIDES }, (_, i): Pt => pt((360 * i) / CIRCLE_SIDES, rr)))
      continue
    }
    // un arc (de a0 à a1, en degrés) : un trait de 0,12 mm de large le long de l'arc, polygone fermé (le laser en suit les deux bords, soit une ligne)
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (360 / CIRCLE_SIDES)))
    const hw = Math.min(0.06, rr * 0.5)
    out.push([...Array.from({ length: n + 1 }, (_, k) => pt(a0 + ((a1 - a0) * k) / n, rr + hw)), ...Array.from({ length: n + 1 }, (_, k) => pt(a0 + ((a1 - a0) * (n - k)) / n, rr - hw))])
  }
  return out
}

/** Les lignes d'un rond gravé pour la vue 3D : une ligne par cercle (fermée pour un tour entier, ouverte pour un arc), sans l'épaisseur de bande que la découpe leur donne. */
export const circleLines = ([cx, cy, r, pas, rMin, a0, a1, du]: number[]): { pts: Pt[]; closed: boolean }[] => {
  const out: { pts: Pt[]; closed: boolean }[] = []
  const full = a0 === undefined || a1 === undefined || Math.abs(a1 - a0) >= 359.99
  for (let rr = r; rr >= (rMin ?? 0.1) - 1e-9; rr -= pas ?? 0.25) {
    const pt = (deg: number): Pt => [cx + (rr + (du ?? 0)) * Math.cos((deg * Math.PI) / 180), cy + rr * Math.sin((deg * Math.PI) / 180)]
    if (full) out.push({ pts: Array.from({ length: CIRCLE_SIDES }, (_, i) => pt((360 * i) / CIRCLE_SIDES)), closed: true })
    else {
      const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (360 / CIRCLE_SIDES)))
      out.push({ pts: Array.from({ length: n + 1 }, (_, k) => pt(a0 + ((a1 - a0) * k) / n)), closed: false })
    }
  }
  return out
}

/** Rectangles gravés des textes et des traits d'une planche (même police que le nom). */
export const labelRects = (p: Panel): Pt[][] => [...(p.labels ?? []).flatMap((l) => digitRects(l.text, l.x, l.y, l.h, 2, l.font)), ...(p.rules ?? []).flatMap((r) => filledWidths(r[4] ?? RULE_W, r[5]).map((w) => ruleRect([r[0], r[1], r[2], r[3], w]))), ...(p.circles ?? []).flatMap(circleRings)].map(round)

/** Clé des textes d'une planche : deux planches au même contour mais aux textes différents sont deux pièces. */
const labelKey = (p: Panel) => [...(p.labels ?? []).map((l) => `${l.text}@${r3(l.x)},${r3(l.y)},${r3(l.h)}`), ...(p.rules ?? []).map((r) => r.map(r3).join(',')), ...(p.circles ?? []).map((c) => 'o' + c.map(r3).join(','))].join(';')

/** Signature d'un contour indépendante de sa position et d'une rotation de 180° (même logique que export/exportParts.js). */
const signature = (outer: Pt[], holes: Pt[][]) => {
  const xs = outer.map((p) => p[0])
  const ys = outer.map((p) => p[1])
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const sorted = (f: (x: number, y: number) => Pt) =>
    [outer, ...holes]
      .map((poly) => poly.map(([x, y]) => f(x - x0, y - y0)).map((q) => `${r3(q[0])},${r3(q[1])}`).sort().join(';'))
      .sort()
      .join('|')
  const a = sorted((x, y) => [x, y])
  const b = sorted((x, y) => [x1 - x0 - x, y1 - y0 - y])
  return a < b ? a : b
}

/**
 * Numérotation systématique : l'id d'une planche est un préfixe de famille (« E », « E-01 » compte pour « E »),
 * le numéro est attribué ici — un numéro par contour distinct (identiques à 180° près = même numéro), dans l'ordre d'apparition.
 */
export const numberPanels = (panels: Panel[]): Panel[] => {
  const seen = new Map<string, string>()
  const next = new Map<string, number>()
  return panels.map((p) => {
    const prefix = p.id.replace(/-?\d+$/, '').replace(/-+$/, '') || 'P'
    const sig = `${prefix}|${p.thickness}|${signature(round(p.outer), (p.holes ?? []).map(round))}|${labelKey(p)}`
    let id = seen.get(sig)
    if (!id) {
      const n = (next.get(prefix) ?? 0) + 1
      next.set(prefix, n)
      id = `${prefix}-${String(n).padStart(2, '0')}`
      seen.set(sig, id)
    }
    return { ...p, id }
  })
}

/** Passage obligé après `build` : serrage des crans (comme testBrick) puis numérotation. */
export const finishPanels = (panels: Panel[]): Panel[] => numberPanels(panels.map(snugPanel))

export interface CutPartsResult {
  file: { format: 'cnc-parts'; version: 1; project: string; unit: 'mm'; parts: object[] }
  warnings: string[]
}

/** Planches d'un modèle → fichier `cnc-parts` : les planches de même id sont regroupées (`qty`) ; une planche `cut: false` n'y est pas. */
export const panelsToCutParts = (panels: Panel[], project: string): CutPartsResult => {
  const warnings: string[] = []
  const byId = new Map<string, { sig: string; part: Record<string, unknown> & { qty: number } }>()
  for (const p of panels) {
    if (p.cut === false) continue // tuyau, quincaillerie : vue 3D seulement
    const outer = round(p.outer)
    const holes = (p.holes ?? []).map(round)
    const sig = `${signature(outer, holes)}|${labelKey(p)}`
    const labels = labelRects(p)
    const known = byId.get(p.id)
    if (known) {
      if (known.sig !== sig) warnings.push(`« ${p.id} » : deux contours différents portent le même id`)
      known.part.qty++
      continue
    }
    byId.set(p.id, { sig, part: { id: p.id, category: p.category ?? '', qty: 1, thickness: p.thickness, material: p.material ?? 'contreplaque', rotate: p.rotate ?? 'any90', outer, holes, ...(labels.length ? { labels } : {}) } })
  }
  return { file: { format: 'cnc-parts', version: 1, project, unit: 'mm', parts: [...byId.values()].map((v) => v.part) }, warnings }
}
