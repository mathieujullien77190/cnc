import type { ImportReport } from '@/types'

export type CutActionsProps = {
  report: ImportReport | null
  onDownload: () => void
  /** Télécharge le modèle figé (`.model.json`), à déposer dans `models/`. */
  onDownloadModel: () => void
}
