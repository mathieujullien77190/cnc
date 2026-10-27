import type { Marking, SheetSettings } from '@/core/types'

/** Clé localStorage du projet (pièces, réglages, planches perso). */
export const PROJECT_KEY = 'cnc-projet-v1'
/** Clé localStorage du modèle 3D choisi et de ses réglages. */
export const MODELS_KEY = 'cnc-modeles-v1'
/** Délai avant d'écrire le projet dans localStorage (ms) : les rafales d'actions ne font qu'une écriture. */
export const PERSIST_DELAY = 250

export const DEFAULT_SETTINGS: SheetSettings = { width: 300, height: 300, margin: 5, gap: 1, spread: false }
export const DEFAULT_MARKING: Marking = { names: true, frame: true, drawings: true }
