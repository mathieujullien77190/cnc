import { MODELS_KEY } from '@/constants'
import { initialModels } from './reducers'
import type { ModelsState } from './types'

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
