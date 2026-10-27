export type ModelParams = Record<string, number | boolean | string>

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
}

export type ParamsPayload = { modelId: string; params: ModelParams }
export type HiddenPayload = { modelId: string; indices: number[] }
