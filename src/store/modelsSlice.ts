import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { MODELS_KEY } from '@/constants'

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

const initialModels = (): ModelsState => ({ model: '', params: {}, explode: 0, hidden: {}, measuring: false })

/** Lit le modèle choisi et ses réglages dans localStorage (même format qu'avant le store) ; le reste n'est gardé qu'en mémoire. */
export const loadModels = (): ModelsState => {
  try {
    const s = JSON.parse(localStorage.getItem(MODELS_KEY) ?? '') as { model?: unknown; params?: unknown }
    if (s && typeof s.model === 'string' && s.params && typeof s.params === 'object') return { ...initialModels(), model: s.model, params: s.params as ModelsState['params'] }
  } catch {
    /* pas de sauvegarde lisible */
  }
  return initialModels()
}

/** Texte écrit dans localStorage : modèle choisi et réglages. */
export const serializeModels = (m: ModelsState): string => JSON.stringify({ model: m.model, params: m.params })

export const modelsSlice = createSlice({
  name: 'models',
  initialState: initialModels,
  reducers: {
    modelPicked: (state, { payload }: PayloadAction<string>) => {
      state.model = payload
    },
    paramsSet: (state, { payload }: PayloadAction<{ modelId: string; params: ModelParams }>) => {
      state.params[payload.modelId] = payload.params
    },
    explodeSet: (state, { payload }: PayloadAction<number>) => {
      state.explode = payload
    },
    hiddenSet: (state, { payload }: PayloadAction<{ modelId: string; indices: number[] }>) => {
      if (payload.indices.length) state.hidden[payload.modelId] = payload.indices
      else delete state.hidden[payload.modelId]
    },
    measuringSet: (state, { payload }: PayloadAction<boolean>) => {
      state.measuring = payload
    },
  },
})

export const modelsActions = modelsSlice.actions
