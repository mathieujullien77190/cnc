import type { Pt } from '../core/types'
import { digitRects } from '../core/marking'
import { snugPanel } from './snug'
import { RULE_W, type Panel } from './types'

const r3 = (v: number) => Math.round(v * 1000) / 1000
const round = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [r3(x), r3(y)])

/** Un trait gravé : rectangle fin autour du segment (droit ou oblique), un demi-trait de rallonge à chaque bout. */
export const ruleRect = ([x0, y0, x1, y1]: [number, number, number, number]): Pt[] => {
  const h = RULE_W / 2
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const [ux, uy] = [((x1 - x0) / len) * h, ((y1 - y0) / len) * h]
  const [ax, ay, bx, by] = [x0 - ux, y0 - uy, x1 + ux, y1 + uy]
  return [[ax - uy, ay + ux], [bx - uy, by + ux], [bx + uy, by - ux], [ax + uy, ay - ux]]
}

/** Rectangles gravés des textes et des traits d'une planche (même police que le nom). */
export const labelRects = (p: Panel): Pt[][] => [...(p.labels ?? []).flatMap((l) => digitRects(l.text, l.x, l.y, l.h)), ...(p.rules ?? []).map(ruleRect)].map(round)

/** Clé des textes d'une planche : deux planches au même contour mais aux textes différents sont deux pièces. */
const labelKey = (p: Panel) => [...(p.labels ?? []).map((l) => `${l.text}@${r3(l.x)},${r3(l.y)},${r3(l.h)}`), ...(p.rules ?? []).map((r) => r.map(r3).join(','))].join(';')

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

/** Planches d'un modèle → fichier `cnc-parts` : les planches de même id sont regroupées (`qty`). */
export const panelsToCutParts = (panels: Panel[], project: string): CutPartsResult => {
  const warnings: string[] = []
  const byId = new Map<string, { sig: string; part: Record<string, unknown> & { qty: number } }>()
  for (const p of panels) {
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
