import type { ImportReport } from '@/types'

export type CutActionsProps = {
  report: ImportReport | null
  onDownload: () => void
}
