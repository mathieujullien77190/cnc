import type { ModelDef } from './types'

// Tout fichier `library/*.model.ts` est un modèle : il apparaît dans la liste dès qu'il existe (rechargement à chaud en dev).
const files = import.meta.glob<{ default: ModelDef }>('./library/*.model.ts', { eager: true })

export const MODELS: ModelDef[] = Object.values(files)
  .map((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

export const modelById = (id: string) => MODELS.find((m) => m.id === id)
