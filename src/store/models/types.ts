export type ModelParams = Record<string, number | boolean | string>

/** Coupe de la vue 3D : axe du plan (null : pas de coupe), position dans la boîte du modèle (0 à 1), côté gardé. */
export type SectionState = { axis: 'x' | 'y' | 'z' | null; t: number; flip: boolean }

export type ModelsState = {
  /** Modèle choisi (vide : le premier de la liste). */
  model: string
  /** Réglages de chaque modèle. */
  params: Record<string, ModelParams>
  /** Éclaté de la vue 3D. */
  explode: number
  /** Indices des planches cachées dans la vue 3D, par modèle (la découpe ne change pas). */
  hidden: Record<string, number[]>
  /** Mode mesure de la vue 3D. */
  measuring: boolean
  /** Couleurs par famille dans la vue 3D (faux : bois uni). */
  colored: boolean
  /** Numéros et dessins gravés visibles dans la vue 3D, pour tous les modèles (faux : cachés). */
  marks: boolean
  /** Plan de coupe de la vue 3D (gardé en mémoire seulement). */
  section: SectionState
}

export type ParamsPayload = { modelId: string; params: ModelParams }
export type HiddenPayload = { modelId: string; indices: number[] }
