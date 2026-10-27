import { Btn, Card, Notice } from '@/components/ui'
import type { CutActionsProps } from './types'

/** Planches envoyées à la découpe automatiquement, et téléchargement du `.cutparts.json`. */
export const CutActions = ({ report, onDownload }: CutActionsProps) => (
  <Card className="space-y-2">
    <Btn onClick={onDownload}>Télécharger le .cutparts.json</Btn>
    {report && <Notice kind="ok">{report.added} pièces envoyées à la découpe (tout le reste a été remplacé).</Notice>}
  </Card>
)
