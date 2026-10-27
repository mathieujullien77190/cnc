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
  if (p.rotate !== undefined && p.rotate !== 'any90' && p.rotate !== 'none') return fail(`${at} (${p.id}) : "rotate" vaut "any90" ou "none"`)
  if (p.labels !== undefined && !(Array.isArray(p.labels) && p.labels.every((l) => l && typeof (l as LabelLike).text === 'string' && isNum((l as LabelLike).x) && isNum((l as LabelLike).y) && isNum((l as LabelLike).h)))) return fail(`${at} (${p.id}) : "labels" doit être une liste de { text, x, y, h }`)
  if (p.rules !== undefined && !(Array.isArray(p.rules) && p.rules.every((r) => Array.isArray(r) && r.length === 4 && r.every(isNum)))) return fail(`${at} (${p.id}) : "rules" doit être une liste de [x0, y0, x1, y1]`)
  if (p.snugDepths !== undefined && !(Array.isArray(p.snugDepths) && p.snugDepths.every(isNum))) return fail(`${at} (${p.id}) : "snugDepths" doit être une liste de nombres`)
  const out: Panel = { id: p.id, thickness: p.thickness, outer: p.outer, position: p.position }
  if (typeof p.category === 'string') out.category = p.category
  if (p.holes !== undefined) out.holes = p.holes as Pt[][]
  if (p.rotation !== undefined) out.rotation = p.rotation
  if (p.rotate !== undefined) out.rotate = p.rotate
  if (p.visible !== undefined) out.visible = p.visible
  if (typeof p.material === 'string') out.material = p.material
  if (p.labels !== undefined) out.labels = p.labels as Panel['labels']
  if (p.rules !== undefined) out.rules = p.rules as Panel['rules']
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
  if (!Array.isArray(f.panels) || !f.panels.length) return fail('fichier de modèle : "panels" doit contenir au moins une planche')
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
