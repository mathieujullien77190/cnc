import type { Marking, Sheet } from '@/core/types'

export type SheetActionsProps = {
  sheet: Sheet
  marking: Marking
  onLaser: () => void
  /** Reprend la planche dans la planche perso pour la modifier (absent : pas de bouton). */
  onEdit?: () => void
}
