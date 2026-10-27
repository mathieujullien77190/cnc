import DoneToggle from '@/components/sheets/DoneToggle'
import MarkingToggles from '@/components/sheets/MarkingToggles'
import SheetActions from '@/components/sheets/SheetActions'
import SheetPreview from '@/components/sheets/SheetPreview'
import { rejectedText } from '@/helpers'
import { Notice, Title, Toolbar } from '@/components/ui'
import type { SheetCardProps } from './types'

/** Une planche automatique : aperçu, cases à cocher (nom des pièces, contour), actions. */
export const SheetCard = ({ sheet, marking, onMarking, onLaser, done, onDone, onEdit, highlight, focused, onPiece, selectedUid }: SheetCardProps) => (
  <article id={`sheet-${sheet.key}`} className={`scroll-mt-20 space-y-2.5 rounded-lg border p-3 shadow-sm transition-colors ${focused ? 'ring-2 ring-emerald-600 ' : ''}${done ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
    <header className="flex items-baseline justify-between gap-2">
      <Title>{sheet.label}</Title>
      <span className="text-[11px] text-stone-500">
        {sheet.items.length} pièces · {Math.round(sheet.fill * 100)} % rempli · {sheet.width} × {sheet.height} mm
      </span>
    </header>
    <SheetPreview sheet={sheet} marking={marking} highlight={highlight} onPiece={onPiece} selectedUid={selectedUid} />
    {sheet.rejected.length > 0 && <Notice kind="warn">Ne tient pas sur une planche de {sheet.width} × {sheet.height} mm : {rejectedText(sheet)}.</Notice>}
    <MarkingToggles value={marking} onChange={onMarking} />
    <Toolbar className="items-center justify-between gap-2">
      <SheetActions sheet={sheet} marking={marking} onLaser={onLaser} onEdit={onEdit} />
      <DoneToggle done={done} onChange={onDone} />
    </Toolbar>
  </article>
)
