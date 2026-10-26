import { sheetGcode } from '../../core/job'
import { sheetSvg } from '../../core/svg'
import type { Marking, Sheet } from '../../core/types'
import { saveSvg, saveText, type MachineSettings } from '../../laser'
import { Btn, Notice } from '../../laser/ui'
import { MarkingToggles } from '../MarkingToggles'
import { SheetPreview } from '../SheetPreview'

/** Résumé des pièces qui ne tiennent pas : « 3 × CX-01, 1 × N-02 ». */
export const rejectedText = (sheet: Sheet) => {
  const count = new Map<string, number>()
  for (const p of sheet.rejected) count.set(p.id, (count.get(p.id) ?? 0) + 1)
  return [...count].map(([id, n]) => `${n} × ${id}`).join(', ')
}

/** Téléchargements et envoi d'une planche : SVG (coupe rouge, gravure bleue), G-code, pilotage de la laser. */
export function SheetActions({ sheet, marking, machine, onLaser }: { sheet: Sheet; marking: Marking; machine: MachineSettings; onLaser: () => void }) {
  const empty = !sheet.items.length
  return (
    <div className="flex flex-wrap gap-2">
      <Btn block={false} disabled={empty} onClick={() => saveSvg(sheetSvg(sheet, { marking }), `${sheet.key}.svg`)}>SVG</Btn>
      <Btn block={false} disabled={empty} onClick={() => saveText(sheetGcode(sheet, marking, machine).text, `${sheet.key}.gcode`)}>G-code</Btn>
      <Btn block={false} variant="primary" disabled={empty} onClick={onLaser}>Envoyer au laser</Btn>
    </div>
  )
}

/** Une planche automatique : aperçu, cases à cocher (nom des pièces, contour), actions. */
export function SheetCard({ sheet, marking, onMarking, machine, onLaser }: { sheet: Sheet; marking: Marking; onMarking: (patch: Partial<Marking>) => void; machine: MachineSettings; onLaser: () => void }) {
  return (
    <article className="space-y-2.5 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800">{sheet.label}</h3>
        <span className="text-[11px] text-stone-500">
          {sheet.items.length} pièces · {Math.round(sheet.fill * 100)} % rempli · {sheet.width} × {sheet.height} mm
        </span>
      </header>
      <SheetPreview sheet={sheet} marking={marking} />
      {sheet.rejected.length > 0 && <Notice kind="warn">Ne tient pas sur une planche de {sheet.width} × {sheet.height} mm : {rejectedText(sheet)}.</Notice>}
      <MarkingToggles value={marking} onChange={onMarking} />
      <SheetActions sheet={sheet} marking={marking} machine={machine} onLaser={onLaser} />
    </article>
  )
}
