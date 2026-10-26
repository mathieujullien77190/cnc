import { useMemo, useState } from 'react'
import { sheetGcode, sheetToJob, travelOf } from '../../core/job'
import type { Marking, Sheet } from '../../core/types'
import type { MachineSettings } from '../../laser'
import { JobStats } from '../../laser'

/** Chiffres de la découpe d'une planche (distances, temps, lignes…). Le G-code n'est construit qu'à l'ouverture du bloc. */
export function SheetStats({ sheet, marking, machine }: { sheet: Sheet; marking: Marking; machine: MachineSettings }) {
  const [open, setOpen] = useState(false)
  const data = useMemo(() => {
    if (!open || !sheet.items.length) return null
    const { job } = sheetGcode(sheet, marking, machine)
    return { job, travel: travelOf(sheetToJob(sheet, marking)) }
  }, [open, sheet, marking, machine])
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-md border border-stone-200 bg-white/60">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-stone-700 select-none">Distances, temps et détails</summary>
      <div className="p-2.5">
        {data ? (
          <JobStats program={data.job} settings={machine} extra={{ pieces: sheet.items.length, sheetMm: { w: sheet.width, h: sheet.height }, fill: sheet.fill, travel: data.travel }} />
        ) : (
          <p className="text-[11px] text-stone-500">Aucune pièce sur cette planche.</p>
        )}
      </div>
    </details>
  )
}
