import type { Pt } from '../core/types'
import { ACTION_TYPES } from './actions'
import { cleanParams, type ModelDef, type Panel, type ParamDef, type Params, type ParamValue } from './types'

/**
 * Le format unique des modèles : un fichier `models/<id>.model.json` (`cnc-model`). Il décrit les planches aux cotes nominales (le serrage
 * des crans et la numérotation sont appliqués au chargement) et, au besoin, des **actions** : des réglages de la vue 3D (interrupteurs ou listes
 * de choix) dont le code est dans l'app (`actions.ts`) ; le fichier dit seulement leur type et leurs paramètres.
 */
export interface CncModelFile {
  format: 'cnc-model'
  version: 1
  /** Identifiant (kebab-case) ; par défaut, le nom du fichier. */
  id?: string
  name: string
  description?: string
  actions?: ModelAction[]
  /** Couleur imposée par catégorie (`#rrggbb`) ; absente : couleur de la palette. */
  colors?: Record<string, string>
  panels: Panel[]
}

/** Une action du fichier : `{ key, label, default, type, ...paramètres du type }` ; `default` : booléen d'un interrupteur, `value` de l'option d'une liste. */
export interface ModelAction {
  key: string
  label: string
  default: boolean | string
  type: string
  [param: string]: unknown
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])
const isRing = (v: unknown): v is Pt[] => Array.isArray(v) && v.length >= 3 && v.every(isPt)
const isVec3 = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(isNum)
const isGrid = (v: unknown): v is number[] => Array.isArray(v) && v.length >= 2 && v.every(isNum) && v.every((n, i) => i === 0 || n > (v as number[])[i - 1])
const isSolid = (v: unknown): v is { x: number[]; y: number[]; z: number[]; runs: number[] } => {
  const s = v as { x?: unknown; y?: unknown; z?: unknown; runs?: unknown } | null
  if (!s || typeof s !== 'object' || !isGrid(s.x) || !isGrid(s.y) || !isGrid(s.z) || !Array.isArray(s.runs) || !s.runs.every((n) => Number.isInteger(n) && n >= 0)) return false
  return (s.runs as number[]).reduce((a, b) => a + b, 0) === (s.x.length - 1) * (s.y.length - 1) * (s.z.length - 1)
}

const fail = (msg: string): never => {
  throw new Error(msg)
}

type LabelLike = { text?: unknown; x?: unknown; y?: unknown; h?: unknown }

/** Vérifie une planche du fichier et la renvoie typée (seuls les champs connus sont gardés). */
const panelOf = (raw: unknown, i: number): Panel => {
  const p = raw as Record<string, unknown>
  const at = `planche ${i + 1}`
  if (!p || typeof p !== 'object') return fail(`${at} : objet attendu`)
  if (typeof p.id !== 'string' || !/^[A-Z]+$/.test(p.id)) return fail(`${at} : "id" doit être un préfixe de famille en majuscules (ex. "P")`)
  if (!isNum(p.thickness) || p.thickness <= 0) return fail(`${at} (${p.id}) : "thickness" doit être une épaisseur en mm`)
  if (!isRing(p.outer)) return fail(`${at} (${p.id}) : "outer" doit être un contour d’au moins 3 points [x, y]`)
  if (p.holes !== undefined && !(Array.isArray(p.holes) && p.holes.every(isRing))) return fail(`${at} (${p.id}) : "holes" doit être une liste de contours`)
  if (!isVec3(p.position)) return fail(`${at} (${p.id}) : "position" doit être [x, y, z]`)
  if (p.rotation !== undefined && !isVec3(p.rotation)) return fail(`${at} (${p.id}) : "rotation" doit être [rx, ry, rz] en degrés`)
  if (p.visible !== undefined && typeof p.visible !== 'boolean') return fail(`${at} (${p.id}) : "visible" vaut true ou false`)
  if (p.tube !== undefined && !(p.tube && typeof p.tube === 'object' && Array.isArray((p.tube as { path?: unknown }).path) && ((p.tube as { path: unknown[] }).path.length >= 2) && (p.tube as { path: unknown[] }).path.every(isVec3))) return fail(`${at} (${p.id}) : "tube" doit être { path: [[x, y, z], …] } (au moins deux points)`)
  if (p.solid !== undefined && !isSolid(p.solid)) return fail(`${at} (${p.id}) : "solid" doit être { x, y, z, runs } (plans de la grille croissants, longueurs de cellules vides / pleines dont la somme est le nombre de cellules)`)
  if (p.cut !== undefined && typeof p.cut !== 'boolean') return fail(`${at} (${p.id}) : "cut" vaut true ou false`)
  if (p.rotate !== undefined && p.rotate !== 'any90' && p.rotate !== 'none') return fail(`${at} (${p.id}) : "rotate" vaut "any90" ou "none"`)
  if (p.labels !== undefined && !(Array.isArray(p.labels) && p.labels.every((l) => l && typeof (l as LabelLike).text === 'string' && isNum((l as LabelLike).x) && isNum((l as LabelLike).y) && isNum((l as LabelLike).h)))) return fail(`${at} (${p.id}) : "labels" doit être une liste de { text, x, y, h }`)
  if (p.rules !== undefined && !(Array.isArray(p.rules) && p.rules.every((r) => Array.isArray(r) && (r.length >= 4 && r.length <= 6) && r.every(isNum)))) return fail(`${at} (${p.id}) : "rules" doit être une liste de [x0, y0, x1, y1] (ou [x0, y0, x1, y1, largeur, pas entre deux contours])`)
  if (p.circles !== undefined && !(Array.isArray(p.circles) && p.circles.every((c) => Array.isArray(c) && (c.length >= 3 && c.length <= 8 && c.length !== 6) && c.every(isNum) && (c as number[])[2] > 0))) return fail(`${at} (${p.id}) : "circles" doit être une liste de [cx, cy, r], [cx, cy, r, pas], [cx, cy, r, pas, rMin] ou [cx, cy, r, pas, rMin, a0, a1, du] (r > 0, en mm ; angles en degrés ; du = rayon en plus dans le sens u : un ovale)`)
  if (p.snugDepths !== undefined && !(Array.isArray(p.snugDepths) && p.snugDepths.every(isNum))) return fail(`${at} (${p.id}) : "snugDepths" doit être une liste de nombres`)
  const out: Panel = { id: p.id, thickness: p.thickness, outer: p.outer, position: p.position }
  if (typeof p.category === 'string') out.category = p.category
  if (p.holes !== undefined) out.holes = p.holes as Pt[][]
  if (p.rotation !== undefined) out.rotation = p.rotation
  if (p.rotate !== undefined) out.rotate = p.rotate
  if (p.visible !== undefined) out.visible = p.visible
  if (p.cut !== undefined) out.cut = p.cut
  if (p.tube !== undefined) out.tube = p.tube as Panel['tube']
  if (p.solid !== undefined) out.solid = p.solid as Panel['solid']
  if (typeof p.material === 'string') out.material = p.material
  if (p.labels !== undefined) out.labels = p.labels as Panel['labels']
  if (p.rules !== undefined) out.rules = p.rules as Panel['rules']
  if (p.circles !== undefined) out.circles = p.circles as Panel['circles']
  if (p.snugDepths !== undefined) out.snugDepths = p.snugDepths as number[]
  return out
}

/** Une action vérifiée : son réglage (construit par le type, code dans `actions.ts`) et son effet pour une valeur de ce réglage. */
type Checked = { key: string; param: ParamDef; apply: (panels: Panel[], value: ParamValue) => Panel[] }

const actionOf = (raw: unknown, i: number, panels: Panel[]): Checked => {
  const a = raw as Record<string, unknown>
  const at = `action ${i + 1}`
  if (!a || typeof a !== 'object') return fail(`${at} : objet attendu`)
  if (typeof a.key !== 'string' || !/^[a-zA-Z][\w-]*$/.test(a.key)) return fail(`${at} : "key" doit être un identifiant`)
  if (typeof a.label !== 'string' || !a.label.trim()) return fail(`${at} (${a.key}) : "label" manquant`)
  const type = typeof a.type === 'string' ? ACTION_TYPES[a.type] : undefined
  if (!type) return fail(`${at} (${a.key}) : "type" inconnu « ${String(a.type)} » (types possibles : ${Object.keys(ACTION_TYPES).join(', ')})`)
  const { key, label, default: def, type: _t, ...params } = a
  try {
    const checked = type.check(params, panels)
    const param = type.param(checked, key, label, def)
    return { key, param, apply: (ps, v) => type.apply(ps, checked, v) }
  } catch (e) {
    return fail(`${at} (${key}) : ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Lit un fichier `cnc-model` (objet déjà parsé). `fallbackId` : nom du fichier sans extension. Lève une `Error` lisible si le fichier est invalide. */
export const modelFromJson = (raw: unknown, fallbackId: string): ModelDef => {
  const f = raw as Partial<CncModelFile>
  if (!f || typeof f !== 'object') return fail('fichier de modèle : objet JSON attendu')
  if (f.format !== 'cnc-model') return fail('fichier de modèle : "format" doit valoir "cnc-model"')
  if (f.version !== 1) return fail('fichier de modèle : "version" doit valoir 1')
  const id = typeof f.id === 'string' && f.id ? f.id : fallbackId
  if (!/^[a-z0-9-]+$/.test(id)) return fail(`fichier de modèle : "id" doit être en kebab-case ("${id}")`)
  if (typeof f.name !== 'string' || !f.name.trim()) return fail('fichier de modèle : "name" manquant')
  if (!Array.isArray(f.panels)) return fail('fichier de modèle : "panels" doit être une liste de planches (vide permis)')
  const panels = f.panels.map(panelOf)
  if (f.actions !== undefined && !Array.isArray(f.actions)) return fail('fichier de modèle : "actions" doit être une liste')
  const actions = (f.actions ?? []).map((a, i) => actionOf(a, i, panels))
  if (new Set(actions.map((a) => a.key)).size !== actions.length) return fail('fichier de modèle : deux actions ont la même "key"')
  if (f.colors !== undefined && !(f.colors && typeof f.colors === 'object' && Object.values(f.colors).every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)))) return fail('fichier de modèle : "colors" associe une catégorie à une couleur "#rrggbb"')
  // les actions s'appliquent dans l'ordre du fichier, avec la valeur de leur réglage (absente ou invalide : le défaut)
  const build = (p: Params): Panel[] => actions.reduce((ps, a) => a.apply(ps, p[a.key]), panels.map((q) => ({ ...q })))
  const def: ModelDef = {
    id,
    name: f.name,
    description: typeof f.description === 'string' ? f.description : '',
    params: actions.map((a) => a.param),
    ...(f.colors ? { colors: { ...f.colors } } : {}),
    build: (p) => ({ panels: build(cleanParams(def, p)), notes: [] }),
  }
  return def
}

/** Le fichier `cnc-model` d'un modèle figé : ses planches telles qu'elles sont affichées (actions appliquées), sans action. */
export const modelToJson = (model: Pick<ModelDef, 'id' | 'name' | 'description'>, panels: Panel[]): CncModelFile => ({
  format: 'cnc-model',
  version: 1,
  id: model.id,
  name: model.name,
  ...(model.description ? { description: model.description } : {}),
  panels,
})
