import type { MarkingTogglesProps } from './types'

/** Les passes de gravure avant la coupe : le contour de la planche (pour vérifier la position), les noms des pièces, puis les dessins des modèles (textes, traits, tableaux). */
export const MarkingToggles = ({ value, onChange }: MarkingTogglesProps) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-700">
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" className="accent-emerald-700" checked={value.names} onChange={(e) => onChange({ names: e.target.checked })} />
      Mettre le nom des pièces
    </label>
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" className="accent-emerald-700" checked={value.drawings !== false} onChange={(e) => onChange({ drawings: e.target.checked })} />
      Mettre les dessins
    </label>
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" className="accent-emerald-700" checked={value.frame} onChange={(e) => onChange({ frame: e.target.checked })} />
      Mettre un contour
    </label>
  </div>
)
