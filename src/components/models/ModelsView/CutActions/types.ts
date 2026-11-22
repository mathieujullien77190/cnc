import type { ImportReport } from '@/types'

export type CutActionsProps = {
  report: ImportReport | null
  /** Renvoie les planches du modèle à la découpe (remplace le catalogue). */
  onRefresh: () => void
}
