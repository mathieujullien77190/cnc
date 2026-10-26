import type { Marking } from '../../core/types'

/** Les deux passes de gravure avant la coupe : le contour de la planche (pour vérifier la position) et les noms des pièces. */
export function MarkingToggles({ value, onChange }: { value: Marking; onChange: (patch: Partial<Marking>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-700">
      <label className="flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" className="accent-emerald-700" checked={value.names} onChange={(e) => onChange({ names: e.target.checked })} />
        Mettre le nom des pièces
      </label>
      <label className="flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" className="accent-emerald-700" checked={value.frame} onChange={(e) => onChange({ frame: e.target.checked })} />
        Mettre un contour
      </label>
    </div>
  )
}
