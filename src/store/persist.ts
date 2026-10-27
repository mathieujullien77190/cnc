import { MODELS_KEY, PERSIST_DELAY, PROJECT_KEY } from '@/constants'
import { serializeModels } from './modelsSlice'
import { serializeProject } from './projectSlice'
import type { AppStore } from './index'

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
export const persistStore = (store: AppStore): (() => void) => {
  let project = store.getState().project
  let models = store.getState().models
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const s = store.getState()
    if (s.project !== project) write(PROJECT_KEY, serializeProject(s.project))
    if (s.models.model !== models.model || s.models.params !== models.params) write(MODELS_KEY, serializeModels(s.models))
    project = s.project
    models = s.models
  }
  const unsubscribe = store.subscribe(() => {
    const s = store.getState()
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
