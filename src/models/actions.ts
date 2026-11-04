import type { Panel, ParamDef, ParamValue } from './types'

/**
 * Les actions d'un modèle : des réglages de la vue 3D (ouvrir une trappe, retirer un couvercle, tirer un tiroir, choisir ce qui occupe un siège…).
 * Le code de chaque type d'action est ici ; le fichier `.model.json` dit seulement « telle action, de tel type, avec tels paramètres ». Une action
 * ne change jamais la forme d'une planche : la découpe n'en dépend pas, et une planche cachée (`visible: false`) est découpée quand même.
 * Deux sortes de réglages : l'**interrupteur** (`move`, `turn` : valeur booléenne) et la **liste** (`choice` : valeur = l'option choisie).
 * Ajouter un type = ajouter une entrée à `ACTION_TYPES` (skill `ajouter-action`).
 */

/** Planches visées par une action : une famille (`"T"`), une catégorie (`"Tiroir"`), une liste de familles / catégories (`["T", "Tiroir"]`) ou des indices dans `panels`. */
export type ActionTarget = string | string[] | number[]

export interface ActionType<P> {
  /** Ce que fait l'action, pour la doc et les messages. */
  describe: string
  /** Vérifie les paramètres du fichier et les renvoie typés ; lève une `Error` lisible sinon. */
  check(params: Record<string, unknown>, panels: Panel[]): P
  /** Le réglage affiché dans le panneau (interrupteur ou liste) ; vérifie le `default` du fichier, lève une `Error` lisible sinon. */
  param(params: P, key: string, label: string, def: unknown): ParamDef
  /** Planches du modèle pour la valeur `value` du réglage (booléen d'un interrupteur, valeur d'option d'une liste) ; jamais de changement de forme. */
  apply(panels: Panel[], params: P, value: ParamValue): Panel[]
}

type Vec3 = [number, number, number]

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum)

const fail = (msg: string): never => {
  throw new Error(msg)
}

/** Indices des planches visées par `target` (paramètre `what` du fichier) ; une cible qui ne vise rien est une erreur (faute de frappe probable). */
export const targetIndices = (target: unknown, panels: Panel[], what = 'panels'): number[] => {
  if (typeof target === 'string') {
    const hit = panels.flatMap((p, i) => (p.id === target || p.category === target ? [i] : []))
    return hit.length ? hit : fail(`"${what}": aucune planche de famille ou de catégorie « ${target} »`)
  }
  if (Array.isArray(target) && target.length && target.every((t) => typeof t === 'string')) return [...new Set(target.flatMap((t) => targetIndices(t, panels, what)))]
  if (Array.isArray(target) && target.length && target.every((i) => Number.isInteger(i) && i >= 0 && i < panels.length)) return target as number[]
  return fail(`"${what}" doit être une famille ("T"), une catégorie ("Tiroir"), une liste de celles-ci ou une liste d’indices de planches`)
}

const vec = (v: unknown, what: string): Vec3 => (isVec3(v) ? v : fail(`"${what}" doit être [x, y, z]`))

/** Un décalage : planches visées et vecteur (mm ou degrés). */
type Shift = { panels: number[]; by: Vec3 }

/** Planches montrées (`show`) et cachées (`hide`) quand l'action est allumée ou l'option choisie ; l'inverse quand un interrupteur est éteint. */
type Visibility = { show: number[]; hide: number[] }
const visibilityOf = (p: Record<string, unknown>, panels: Panel[]): Visibility => {
  const show = p.show === undefined ? [] : targetIndices(p.show, panels, 'show')
  const hide = p.hide === undefined ? [] : targetIndices(p.hide, panels, 'hide')
  if (show.some((i) => hide.includes(i))) fail('une planche ne peut pas être à la fois dans "show" et dans "hide"')
  return { show, hide }
}
const setVisible = (panels: Panel[], { show, hide }: Visibility, on: boolean): Panel[] => panels.map((q, i) => (show.includes(i) ? { ...q, visible: on } : hide.includes(i) ? { ...q, visible: !on } : q))

const translate = (panels: Panel[], shifts: Shift[]): Panel[] =>
  shifts.reduce((ps, { panels: idx, by }) => ps.map((q, i) => (idx.includes(i) ? { ...q, position: [q.position[0] + by[0], q.position[1] + by[1], q.position[2] + by[2]] } : q)), panels)

const rotate = (panels: Panel[], { panels: idx, by }: Shift): Panel[] =>
  panels.map((q, i) => {
    if (!idx.includes(i)) return q
    const r = q.rotation ?? [0, 0, 0]
    return { ...q, rotation: [r[0] + by[0], r[1] + by[1], r[2] + by[2]] }
  })

/** Réglage d'un interrupteur : `default` vaut true ou false. */
const switchParam = (key: string, label: string, def: unknown): ParamDef => (typeof def === 'boolean' ? { key, label, type: 'boolean', default: def } : fail('"default" doit valoir true ou false'))

/** Paramètres d'un interrupteur : les planches décalées / tournées (`panels`, `by`) et, en option, montrées / cachées (`show`, `hide`). */
type Switch = Shift & Visibility
const switchOf = (p: Record<string, unknown>, panels: Panel[]): Switch => ({ panels: targetIndices(p.panels, panels), by: vec(p.by, 'by'), ...visibilityOf(p, panels) })

/** Décale des planches dans le monde (mm) : x droite, y haut, z vers l'avant. */
const move: ActionType<Switch> = {
  describe: 'interrupteur : décale les planches « panels » de « by » (mm, x droite, y haut, z avant) ; montre « show » et cache « hide » (l’inverse une fois éteint)',
  check: switchOf,
  param: (_s, key, label, def) => switchParam(key, label, def),
  apply: (panels, s, value) => (value === true ? translate(setVisible(panels, s, true), [s]) : setVisible(panels, s, false)),
}

/** Tourne des planches sur elles-mêmes (degrés, ordre XYZ), autour de leur centre. */
const turn: ActionType<Switch> = {
  describe: 'interrupteur : tourne les planches « panels » de « by » (degrés, ordre XYZ) ; montre « show » et cache « hide » (l’inverse une fois éteint)',
  check: switchOf,
  param: (_s, key, label, def) => switchParam(key, label, def),
  apply: (panels, s, value) => (value === true ? rotate(setVisible(panels, s, true), s) : setVisible(panels, s, false)),
}

/** Une option d'une liste de choix : ce qu'elle montre, cache et décale. */
type Option = Visibility & { value: string; label: string; move: Shift[] }
type Choice = { options: Option[] }

const optionOf = (raw: unknown, i: number, panels: Panel[]): Option => {
  const o = raw as Record<string, unknown>
  const at = `option ${i + 1}`
  if (!o || typeof o !== 'object') return fail(`${at} : objet attendu`)
  if (typeof o.value !== 'string' || !o.value.trim()) return fail(`${at} : "value" doit être un texte non vide`)
  if (typeof o.label !== 'string' || !o.label.trim()) return fail(`${at} (${o.value}) : "label" manquant`)
  if (o.move !== undefined && !Array.isArray(o.move)) return fail(`${at} (${o.value}) : "move" doit être une liste de { panels, by }`)
  try {
    const move = ((o.move ?? []) as unknown[]).map((m) => {
      const s = m as Record<string, unknown>
      return s && typeof s === 'object' ? { panels: targetIndices(s.panels, panels), by: vec(s.by, 'by') } : fail('"move" doit être une liste de { panels, by }')
    })
    return { value: o.value, label: o.label, move, ...visibilityOf(o, panels) }
  } catch (e) {
    return fail(`${at} (${o.value}) : ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Une liste de choix : pour l'option choisie, montre `show`, cache `hide` et applique les décalages `move` ; les autres options n'ont aucun effet. */
const choice: ActionType<Choice> = {
  describe: 'liste : pour l’option choisie, montre « show », cache « hide » et applique « move » ([{ panels, by }]) ; les planches cachées sont découpées quand même',
  check: (p, panels) => {
    if (!Array.isArray(p.options) || p.options.length < 2) return fail('"options" doit être une liste d’au moins deux options { value, label, show?, hide?, move? }')
    const options = p.options.map((o, i) => optionOf(o, i, panels))
    if (new Set(options.map((o) => o.value)).size !== options.length) return fail('deux options ont la même "value"')
    return { options }
  },
  param: ({ options }, key, label, def) =>
    typeof def === 'string' && options.some((o) => o.value === def)
      ? { key, label, type: 'select', default: def, options: options.map((o) => ({ value: o.value, label: o.label })) }
      : fail(`"default" doit être la "value" d’une option (${options.map((o) => o.value).join(', ')})`),
  apply: (panels, { options }, value) => {
    const o = options.find((x) => x.value === value) ?? options[0]
    return translate(setVisible(panels, o, true), o.move)
  },
}

// ---- charnière : rotation autour d'un point du monde (couvercle sur gonds, livre qui se ferme) ----

type Mat = number[] // 3 × 3, lignes
const deg = Math.PI / 180
const matOf = ([ax, ay, az]: Vec3): Mat => {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * deg), Math.sin(ax * deg), Math.cos(ay * deg), Math.sin(ay * deg), Math.cos(az * deg), Math.sin(az * deg)]
  // même convention que three.js : ordre XYZ, M = Rx · Ry · Rz
  return [cy * cz, -cy * sz, sy, cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy, sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy]
}
const mul = (a: Mat, b: Mat): Mat => Array.from({ length: 9 }, (_, i) => a[Math.floor(i / 3) * 3] * b[i % 3] + a[Math.floor(i / 3) * 3 + 1] * b[3 + (i % 3)] + a[Math.floor(i / 3) * 3 + 2] * b[6 + (i % 3)])
const eulerOf = (m: Mat): Vec3 => {
  // inverse de `matOf` (three.js `Euler.setFromRotationMatrix`, ordre XYZ)
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])))
  const near = Math.abs(m[2]) > 0.9999999
  const x = near ? Math.atan2(m[7], m[4]) : Math.atan2(-m[5], m[8])
  const z = near ? 0 : Math.atan2(-m[1], m[0])
  const clean = (v: number) => Math.round((v / deg) * 1e6) / 1e6 + 0 // -0 → 0
  return [clean(x), clean(y), clean(z)]
}

/** Un pas de charnière : planches visées, angle (degrés, ordre XYZ) et point du monde autour duquel elles tournent. */
type Swing = Shift & { pivot: Vec3 }
const swingOf = (raw: unknown, i: number, panels: Panel[]): Swing => {
  const s = raw as Record<string, unknown>
  if (!s || typeof s !== 'object') return fail(`pas ${i + 1} : objet { panels, by, pivot } attendu`)
  return { panels: targetIndices(s.panels, panels), by: vec(s.by, 'by'), pivot: vec(s.pivot, 'pivot') }
}
const swing = (panels: Panel[], { panels: idx, by, pivot }: Swing): Panel[] => {
  const R = matOf(by)
  return panels.map((q, i) => {
    if (!idx.includes(i)) return q
    const d = [q.position[0] - pivot[0], q.position[1] - pivot[1], q.position[2] - pivot[2]]
    const position: Vec3 = [0, 1, 2].map((r) => pivot[r] + R[r * 3] * d[0] + R[r * 3 + 1] * d[1] + R[r * 3 + 2] * d[2]) as Vec3
    return { ...q, position: position.map((v) => Math.round(v * 1e6) / 1e6 + 0) as Vec3, rotation: eulerOf(mul(R, matOf(q.rotation ?? [0, 0, 0]))) }
  })
}

type Hinge = Visibility & { steps: Swing[] }
/** Tourne des planches autour d'un point du monde (charnière) : chaque pas vise des planches, un angle et son pivot ; les positions et les rotations suivent. */
const hinge: ActionType<Hinge> = {
  describe: 'interrupteur : fait tourner les planches de chaque pas de « steps » ([{ panels, by (degrés, ordre XYZ), pivot (point du monde) }]) autour de son pivot ; montre « show » et cache « hide » (l’inverse une fois éteint)',
  check: (p, panels) => {
    if (!Array.isArray(p.steps) || !p.steps.length) return fail('"steps" doit être une liste d’au moins un pas { panels, by, pivot }')
    return { steps: p.steps.map((s, i) => swingOf(s, i, panels)), ...visibilityOf(p, panels) }
  },
  param: (_s, key, label, def) => switchParam(key, label, def),
  apply: (panels, h, value) => (value === true ? h.steps.reduce(swing, setVisible(panels, h, true)) : setVisible(panels, h, false)),
}

/** Comme `hinge`, mais réglé par un curseur de 0 à 100 % : chaque pas tourne de « by » × valeur / 100 (ouvrir un livre peu à peu, voir une charnière travailler). */
const slide: ActionType<Hinge> = {
  describe: 'curseur (0 à 100 %) : fait tourner les planches de chaque pas de « steps » ([{ panels, by (degrés, ordre XYZ), pivot }]) autour de son pivot, de « by » × valeur / 100 ; montre « show » et cache « hide » dès que la valeur n’est pas nulle',
  check: hinge.check,
  param: (_s, key, label, def) => (isNum(def) && def >= 0 && def <= 100 ? { key, label, type: 'number', default: def, min: 0, max: 100, step: 1, unit: '%' } : fail('"default" doit être un nombre de 0 à 100')),
  apply: (panels, h, value) => {
    const k = isNum(value) ? Math.min(100, Math.max(0, value)) / 100 : 0
    return h.steps.map((s) => ({ ...s, by: s.by.map((d) => d * k) as Vec3 })).reduce(swing, setVisible(panels, h, k > 0))
  },
}

export const ACTION_TYPES: Record<string, ActionType<unknown>> = { move, turn, hinge, swing: slide, choice }
