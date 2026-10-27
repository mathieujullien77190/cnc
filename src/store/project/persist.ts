import { PROJECT_KEY } from '@/constants'
import { emptyProject } from './reducers'
import type { ProjectState } from './types'

/** Lit le projet gardé dans localStorage (même format qu'avant le store) ; un stockage absent ou illisible donne un projet vide. */
export const loadProject = (): ProjectState => {
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    return raw ? { ...emptyProject(), ...(JSON.parse(raw) as Partial<ProjectState>) } : emptyProject()
  } catch {
    return emptyProject()
  }
}

/** Texte écrit dans localStorage : exactement le format d'avant le store. */
export const serializeProject = (p: ProjectState): string => JSON.stringify(p)
