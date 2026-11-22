import { Btn, Card, Notice } from '@/components/ui'
import type { CutActionsProps } from './types'

/** Planches envoyées à la découpe automatiquement (le bouton les renvoie à la demande). */
export const CutActions = ({ report, onRefresh }: CutActionsProps) => (
  <Card className="space-y-2">
    <Btn onClick={onRefresh}>Rafraîchir les planches</Btn>
    {report && <Notice kind="ok">{report.added} pièces envoyées à la découpe (tout le reste a été remplacé).</Notice>}
  </Card>
)
