import { Btn, Notice } from '@/laser/ui'
import type { CutActionsProps } from './types'

/** Planches envoyées à la découpe automatiquement, et téléchargement du `.cutparts.json`. */
export const CutActions = ({ report, onDownload }: CutActionsProps) => (
  <section className="space-y-2 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
    <Btn onClick={onDownload}>Télécharger le .cutparts.json</Btn>
    {report && <Notice kind="ok">{report.added} pièces envoyées à la découpe (tout le reste a été remplacé).</Notice>}
  </section>
)
