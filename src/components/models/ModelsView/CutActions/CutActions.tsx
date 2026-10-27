import { Btn, Card, Notice } from '@/components/ui'
import type { CutActionsProps } from './types'

/** Planches envoyées à la découpe automatiquement ; téléchargement du `.cutparts.json` (pièces) ou du `.model.json` (modèle figé, sans code). */
export const CutActions = ({ report, onDownload, onDownloadModel }: CutActionsProps) => (
  <Card className="space-y-2">
    <Btn onClick={onDownload}>Télécharger le .cutparts.json</Btn>
    <Btn onClick={onDownloadModel}>Télécharger le modèle (.model.json)</Btn>
    {report && <Notice kind="ok">{report.added} pièces envoyées à la découpe (tout le reste a été remplacé).</Notice>}
  </Card>
)
