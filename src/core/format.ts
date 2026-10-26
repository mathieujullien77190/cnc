import type { Part, Pt } from './types'

export const FORMAT_NAME = 'cnc-parts'
export const FORMAT_VERSION = 1

/** Fichier d'échange `.cutparts.json` produit par les projets 3D. */
export interface CutPartsFile {
  format: typeof FORMAT_NAME
  version: number
  project: string
  unit?: 'mm'
  parts: CutPartEntry[]
}

export interface CutPartEntry {
  id: string
  category?: string
  qty?: number
  thickness: number
  material?: string
  rotate?: 'any90' | 'none'
  outer: Pt[]
  holes?: Pt[][]
  /** Textes gravés en plus du nom : rectangles fermés (le laser grave les contours bleus fermés), même repère que `outer`. */
  labels?: Pt[][]
}

export interface ParseResult {
  project: string
  parts: Part[]
  errors: string[]
}

const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v))
const isPoly = (p: unknown): p is Pt[] => Array.isArray(p) && p.length >= 3 && p.every(isPt)
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Signature d'une pièce indépendante de sa position et d'une rotation de 180° (même pièce posée à l'envers). */
const signature = (outer: Pt[], holes: Pt[][]): string => {
  const xs = outer.map((p) => p[0])
  const ys = outer.map((p) => p[1])
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const sorted = (f: (x: number, y: number) => Pt) => [outer, ...holes].map((poly) => poly.map(([x, y]) => f(x - x0, y - y0)).map((p) => `${r3(p[0])},${r3(p[1])}`).sort().join(';')).sort().join('|')
  const a = sorted((x, y) => [x, y])
  const b = sorted((x, y) => [x1 - x0 - x, y1 - y0 - y])
  return a < b ? a : b
}

interface LegacyPart {
  outer?: Pt[]
  holes?: Pt[][]
  code?: string
  mark?: string
  cat?: string
}

/**
 * Ancien export de testBrick : { model, thicknessMm, parts: [{ outer, holes, code, mark, cat, … }] }, une entrée par exemplaire.
 * Converti au format cnc-parts : exemplaires regroupés par nom (qty).
 */
const fromLegacy = (raw: { model?: string; thicknessMm?: number; parts: LegacyPart[] }): { file: CutPartsFile; errors: string[] } => {
  const errors: string[] = []
  const byId = new Map<string, CutPartEntry & { sig: string }>()
  raw.parts.forEach((p, i) => {
    const id = String(p.mark || p.code || '').trim()
    if (!id || !Array.isArray(p.outer)) return void errors.push(`pièce ${i + 1} : nom ou contour manquant.`)
    const holes = p.holes ?? []
    const sig = isPoly(p.outer) && holes.every(isPoly) ? signature(p.outer, holes) : ''
    const known = byId.get(id)
    if (known) {
      known.qty = (known.qty ?? 1) + 1
      if (known.sig !== sig) errors.push(`« ${id} » : deux contours différents portent le même nom.`)
      return
    }
    byId.set(id, { id, category: p.cat ?? '', qty: 1, thickness: raw.thicknessMm as number, outer: p.outer, holes, sig })
  })
  return { file: { format: FORMAT_NAME, version: FORMAT_VERSION, project: raw.model ?? 'projet', parts: [...byId.values()].map(({ sig: _sig, ...e }) => e) }, errors }
}

/** Lit un fichier `.cutparts.json` : renvoie les pièces valides (contours recalés sur 0, 0) et la liste des erreurs. */
export function parseCutParts(text: string): ParseResult {
  const errors: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { project: '', parts: [], errors: ['Fichier illisible : ce n’est pas du JSON.'] }
  }
  let f = raw as Partial<CutPartsFile> | null
  if (f && f.format === undefined && Array.isArray(f.parts) && typeof (raw as { thicknessMm?: unknown }).thicknessMm === 'number') {
    const legacy = fromLegacy(raw as Parameters<typeof fromLegacy>[0])
    f = legacy.file
    errors.push(...legacy.errors)
  }
  if (!f || f.format !== FORMAT_NAME) return { project: '', parts: [], errors: [`Ce fichier n’est pas au format « ${FORMAT_NAME} ».`] }
  if (typeof f.version !== 'number' || f.version > FORMAT_VERSION) errors.push(`Version ${String(f.version)} non prise en charge (max ${FORMAT_VERSION}).`)
  if (!Array.isArray(f.parts)) return { project: '', parts: [], errors: [...errors, 'La liste « parts » est absente.'] }
  const project = typeof f.project === 'string' && f.project.trim() ? f.project.trim() : 'projet'
  const parts: Part[] = []
  const seen = new Set<string>()
  f.parts.forEach((e: Partial<CutPartEntry>, i: number) => {
    const where = `pièce ${i + 1}${typeof e?.id === 'string' ? ` (${e.id})` : ''}`
    if (typeof e?.id !== 'string' || !e.id.trim()) return void errors.push(`${where} : « id » manquant.`)
    if (typeof e.thickness !== 'number' || !(e.thickness > 0)) return void errors.push(`${where} : « thickness » doit être un nombre positif.`)
    if (!isPoly(e.outer)) return void errors.push(`${where} : « outer » doit contenir au moins 3 points [x, y].`)
    const holes = e.holes ?? []
    if (!Array.isArray(holes) || !holes.every(isPoly)) return void errors.push(`${where} : « holes » invalide.`)
    const labels = e.labels ?? []
    if (!Array.isArray(labels) || !labels.every(isPoly)) return void errors.push(`${where} : « labels » invalide.`)
    const key = `${project}/${e.id.trim()}`
    if (seen.has(key)) return void errors.push(`${where} : identifiant en double.`)
    seen.add(key)
    const xs = e.outer.map((p) => p[0])
    const ys = e.outer.map((p) => p[1])
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    const mv = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [r3(x - x0), r3(y - y0)])
    parts.push({
      key,
      id: e.id.trim(),
      category: typeof e.category === 'string' ? e.category : '',
      project,
      thickness: e.thickness,
      material: typeof e.material === 'string' && e.material ? e.material : 'contreplaque',
      outer: mv(e.outer),
      holes: holes.map(mv),
      ...(labels.length ? { labels: labels.map(mv) } : {}),
      qty: Number.isInteger(e.qty) && (e.qty as number) >= 0 ? (e.qty as number) : 1,
      rotate: e.rotate === 'none' ? 'none' : 'any90',
      w: r3(Math.max(...xs) - x0),
      h: r3(Math.max(...ys) - y0),
    })
  })
  return { project, parts, errors }
}
