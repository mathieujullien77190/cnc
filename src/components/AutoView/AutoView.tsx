import type { Sheet } from '../../core/types'
import type { MachineSettings } from '../../laser'
import type { Project } from '../../state/useProject'
import { DEFAULT_MARKING } from '../../state/useProject'
import { SheetCard } from '../SheetCard'

/** Planches automatiques : toutes les pièces importées, rangées par épaisseur. */
export function AutoView({ project, machine, onLaser }: { project: Project; machine: MachineSettings; onLaser: (key: string) => void }) {
  const { autoSheets, entries, setAutoMarking, done, setDone } = project
  if (!autoSheets.length) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">
        Aucune pièce à découper. Importe un fichier <b>.cutparts.json</b> (bouton à gauche) ou mets une quantité sur au moins une pièce.
      </div>
    )
  }
  const thicknesses = [...new Set(autoSheets.map((s) => s.thickness))]
  const markingOf = (s: Sheet) => entries.find((e) => e.sheet.key === s.key)?.marking ?? DEFAULT_MARKING
  return (
    <div className="space-y-6">
      {thicknesses.map((t) => {
        const list = autoSheets.filter((s) => s.thickness === t)
        return (
          <section key={t} className="space-y-2.5">
            <h2 className="text-sm font-semibold text-stone-700">
              Contreplaqué {t} mm <span className="font-normal text-stone-500">· {list.length} planche{list.length > 1 ? 's' : ''} · {list.reduce((n, s) => n + s.items.length, 0)} pièces</span>
            </h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((s) => (
                <SheetCard key={s.key} sheet={s} marking={markingOf(s)} onMarking={(patch) => setAutoMarking(s.key, patch)} machine={machine} onLaser={() => onLaser(s.key)} done={!!done[s.key]} onDone={(v) => setDone(s.key, v)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
