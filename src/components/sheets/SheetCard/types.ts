import type { Marking, Sheet } from '@/core/types'

export type SheetCardProps = {
  sheet: Sheet
  marking: Marking
  onMarking: (patch: Partial<Marking>) => void
  onLaser: () => void
  done: boolean
  onDone: (v: boolean) => void
  /** Pièce à surligner dans l'aperçu (clé du catalogue). */
  /** Reprend la planche dans la planche perso. */
  onEdit?: () => void
  highlight?: string | null
  /** Clic sur une pièce de l'aperçu (clé du catalogue). */
  onPiece?: (partKey: string | null, uid: string | null) => void
  /** Exemplaire au contour vert. */
  selectedUid?: string | null
  /** Planche mise en avant (pièce cliquée dans la liste). */
  focused?: boolean
}
