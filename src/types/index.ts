import type { CustomBoard, Marking, Part, Sheet, SheetSettings } from '@/core/types'

/** Onglets de l'application. */
export type Tab = 'auto' | 'perso' | 'modeles'

/** Une planche (automatique ou perso) avec ses cases cochées. */
export type SheetEntry = {
  sheet: Sheet
  marking: Marking
  board?: CustomBoard
}

/** Bilan de la lecture d'un fichier de pièces. */
export type ImportReport = {
  file: string
  added: number
  replaced: number
  errors: string[]
}

/** Le projet tel qu'il est gardé dans localStorage (format `cnc-projet-v1`). */
export type ProjectState = {
  parts: Part[]
  settings: SheetSettings
  /** Cases cochées par planche automatique (clé de planche). */
  autoMarking: Record<string, Marking>
  boards: CustomBoard[]
  /** Planches marquées « fait » (clé de planche). */
  done: Record<string, boolean>
}

/** Fenêtre visible d'une planche (mm) : x, y du coin haut-gauche et largeur ; la hauteur suit le rapport de la planche. */
export type View = {
  x: number
  y: number
  w: number
}

/** Vue (zoom, déplacement) d'un aperçu de planche, valable pour cette taille de planche seulement. */
export type SheetViewState = {
  width: number
  height: number
  view: View
}
