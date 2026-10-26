import type { Pt } from '../core/types'

/** Réglage exposé dans le panneau d'un modèle. */
export type ParamDef =
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; type: 'boolean'; default: boolean }
  | { key: string; label: string; type: 'select'; default: string; options: { value: string; label: string }[] }

export type ParamValue = number | boolean | string
export type Params = Record<string, ParamValue>

/**
 * Une planche du modèle : un contour plat, extrudé sur son épaisseur dans la vue 3D, et découpé tel quel.
 * Repère de la planche : u vers la droite, v vers le BAS (comme les .cutparts.json), mm.
 * Le contour est centré sur sa boîte englobante dans le monde : `position` est le centre de cette boîte.
 * Dans le monde : x droite, y haut, z vers l'avant. Hors rotation, u → x, v → -y, l'épaisseur suit z.
 */
export interface Panel {
  /** Nom gravé (CX-01…). Des planches identiques portent le même id : elles sont comptées dans `qty`. */
  id: string
  category?: string
  /** Épaisseur du matériau (mm). */
  thickness: number
  outer: Pt[]
  holes?: Pt[][]
  /** Centre de la planche dans le monde (mm). */
  position: [number, number, number]
  /** Rotation d'Euler en degrés (ordre XYZ). */
  rotation?: [number, number, number]
  /** `none` : sens du fil imposé. */
  rotate?: 'any90' | 'none'
  material?: string
  /** Textes gravés en plus du nom (« BOIS »…) : coin haut-gauche (x, y) dans le repère de la planche, hauteur de lettre h (mm). Ils doivent tenir sur du bois plein. */
  labels?: PanelLabel[]
  /** Traits gravés (lignes d'un tableau, dessins…) : `[x0, y0, x1, y1]` dans le repère de la planche, tracés en rectangle fin (`RULE_W`). */
  rules?: [number, number, number, number][]
  /** Profondeurs de cran à serrer, en multiples de l'épaisseur (défaut [1]) : [1, 3] si une encoche reçoit trois plaques empilées. */
  snugDepths?: number[]
}

/** Largeur d'un trait gravé (mm). */
export const RULE_W = 0.6

export interface PanelLabel {
  text: string
  x: number
  y: number
  h: number
}

export interface ModelResult {
  panels: Panel[]
  /** Remarques affichées sous le modèle (cotes hors limites, jeu trop faible…). */
  notes?: string[]
}

/**
 * Un modèle = un fichier `src/models/library/<nom>.model.ts` qui exporte `default defineModel({...})`.
 * `build` est pur : mêmes réglages, mêmes planches. Aucun import de three.js nécessaire.
 */
export interface ModelDef {
  id: string
  name: string
  description: string
  params: ParamDef[]
  build: (p: Params) => ModelResult
}

export const defineModel = (m: ModelDef): ModelDef => m

export const defaultParams = (m: ModelDef): Params => Object.fromEntries(m.params.map((d) => [d.key, d.default]))

/** Réglages valides : valeur absente ou hors limites ramenée au défaut / à la borne. */
export const cleanParams = (m: ModelDef, p: Params): Params =>
  Object.fromEntries(
    m.params.map((d) => {
      const v = p[d.key]
      if (d.type === 'number') return [d.key, typeof v === 'number' && Number.isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.default]
      if (d.type === 'boolean') return [d.key, typeof v === 'boolean' ? v : d.default]
      return [d.key, typeof v === 'string' && d.options.some((o) => o.value === v) ? v : d.default]
    }),
  )
