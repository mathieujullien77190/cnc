import type { Part } from '@/core/types'
import type { ImportReport } from '@/types'

export type PartsPanelProps = {
  parts: Part[]
  reports: ImportReport[]
  onFiles: (files: File[]) => void
  /** Clic sur une pièce de la liste (absent : les lignes ne sont pas cliquables). */
  onPick?: (key: string) => void
  onRemoveProject: (project: string) => void
  onClear: () => void
}
