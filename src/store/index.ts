import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { loadModels, modelsSlice } from './modelsSlice'
import { persistStore } from './persist'
import { loadProject, projectSlice } from './projectSlice'
import { uiSlice } from './uiSlice'

const reducer = combineReducers({ project: projectSlice.reducer, ui: uiSlice.reducer, models: modelsSlice.reducer })

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

/** Le store de l'application, rempli depuis localStorage et gardé dans localStorage (sauf hors navigateur). */
export const store = createAppStore({ project: loadProject(), models: loadModels() })
if (typeof window !== 'undefined') persistStore(store)
