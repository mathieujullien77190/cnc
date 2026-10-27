import { presetCategoryColor } from '../core/colors'
import { DEFAULT_MODEL_ID } from '../constants'
import { modelFromJson } from './json'
import type { ModelDef } from './types'

// Tout fichier `models/<id>.model.json` (dossier à la racine du dépôt, hors `src`, format `cnc-model`) est un modèle : il apparaît dans la liste
// dès qu'il existe (rechargement à chaud en dev). Un fichier invalide est ignoré, avec le motif dans la console.
const files = import.meta.glob<unknown>('/models/*.model.json', { eager: true, import: 'default' })

export const MODELS: ModelDef[] = Object.entries(files)
  .flatMap(([path, raw]) => {
    const fallbackId = (path.split('/').pop() ?? '').replace('.model.json', '')
    try {
      const m = modelFromJson(raw, fallbackId)
      for (const [category, hex] of Object.entries(m.colors ?? {})) presetCategoryColor(category, parseInt(hex.slice(1), 16))
      return [m]
    } catch (e) {
      console.error(`Modèle ${path} ignoré : ${e instanceof Error ? e.message : String(e)}`)
      return []
    }
  })
  // le modèle par défaut (nichoir) en tête, les autres par ordre alphabétique
  .sort((a, b) => Number(b.id === DEFAULT_MODEL_ID) - Number(a.id === DEFAULT_MODEL_ID) || a.name.localeCompare(b.name, 'fr'))

export const modelById = (id: string) => MODELS.find((m) => m.id === id)
