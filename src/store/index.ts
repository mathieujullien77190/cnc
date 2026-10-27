import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { MODELS_KEY, PERSIST_DELAY, PROJECT_KEY } from '@/constants'
import { loadModels, modelsReducer, serializeModels } from '@/store/models'
import { loadProject, projectReducer, serializeProject } from '@/store/project'
import { uiReducer } from '@/store/ui'

const reducer = combineReducers({ project: projectReducer, ui: uiReducer, models: modelsReducer })

export type RootState = ReturnType<typeof reducer>

/**
 * Fabrique un store (les tests en créent un par scénario). Le projet pèse lourd (contours des pièces) : les contrôles de développement
 * d'immutabilité et de sérialisation l'ignorent pour ne pas ralentir chaque action ; le reste de l'état reste contrôlé.
 */
export const createAppStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer,
    preloadedState,
    middleware: (getDefault) => getDefault({ immutableCheck: { ignoredPaths: ['project'] }, serializableCheck: { ignoredPaths: ['project'] } }),
  })

export type AppStore = ReturnType<typeof createAppStore>
export type AppDispatch = AppStore['dispatch']

const write = (key: string, text: string): void => {
  try {
    localStorage.setItem(key, text)
  } catch {
    /* stockage plein ou indisponible : l'état reste en mémoire */
  }
}

/**
 * Garde dans localStorage la tranche projet (clé `cnc-projet-v1`, format inchangé) et le modèle choisi avec ses réglages (`cnc-modeles-v1`).
 * Une écriture n'a lieu que si la tranche a changé (même référence : rien), et une rafale d'actions (frappe, clics sur + / −) ne fait qu'une écriture ;
 * ce qui reste à écrire part quand la page se ferme ou passe en arrière-plan.
 */
export const persistStore = (target: AppStore): (() => void) => {
  let project = target.getState().project
  let models = target.getState().models
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const s = target.getState()
    if (s.project !== project) write(PROJECT_KEY, serializeProject(s.project))
    if (s.models.model !== models.model || s.models.params !== models.params) write(MODELS_KEY, serializeModels(s.models))
    project = s.project
    models = s.models
  }
  const unsubscribe = target.subscribe(() => {
    const s = target.getState()
    const dirty = s.project !== project || s.models.model !== models.model || s.models.params !== models.params
    if (dirty && timer === undefined) timer = setTimeout(flush, PERSIST_DELAY)
  })
  const onHide = () => flush()
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onHide)

  return () => {
    unsubscribe()
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onHide)
    flush()
  }
}

/** Le store de l'application, rempli depuis localStorage et gardé dans localStorage (sauf hors navigateur). */
export const store = createAppStore({ project: loadProject(), models: loadModels() })
if (typeof window !== 'undefined') persistStore(store)
