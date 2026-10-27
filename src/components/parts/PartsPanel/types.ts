import type { Part } from '@/core/types'
import type { ImportReport } from '@/types'

export type PartsPanelProps = {
  parts: Part[]
  reports: ImportReport[]
  onFiles: (files: File[]) => void
  /** Clic sur une pièce de la liste (absent : les lignes ne sont pas cliquables). */
  onPick?: (key: string) => void
  /** Pièce cliquée sur une planche : sa ligne est montrée dans la liste. */
  reveal?: { key: string; n: number } | null
  /** Clé de la pièce choisie (sur une planche ou dans la liste) : sa ligne est en gris. */
  selectedKey?: string | null
  onClear: () => void
}
