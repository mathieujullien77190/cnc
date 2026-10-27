import type { ImportReport } from '@/types'

export type CutActionsProps = {
  report: ImportReport | null
  /** Renvoie les planches du modèle à la découpe (remplace le catalogue). */
  onRefresh: () => void
  onDownload: () => void
  /** Télécharge le modèle figé (`.model.json`), à déposer dans `models/`. */
  onDownloadModel: () => void
}
