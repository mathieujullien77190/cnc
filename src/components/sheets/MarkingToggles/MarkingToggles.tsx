import { Checkbox, Toolbar } from '@/components/ui'
import type { MarkingTogglesProps } from './types'

/** Les passes de gravure avant la coupe : le contour de la planche (pour vérifier la position), les noms des pièces, puis les dessins des modèles (textes, traits, tableaux). */
export const MarkingToggles = ({ value, onChange }: MarkingTogglesProps) => (
  <Toolbar className="items-center gap-x-4 gap-y-1 text-xs text-stone-700">
    <Checkbox label="Mettre le nom des pièces" checked={value.names} onChange={(names) => onChange({ names })} />
    <Checkbox label="Mettre les dessins" checked={value.drawings !== false} onChange={(drawings) => onChange({ drawings })} />
    <Checkbox label="Mettre un contour" checked={value.frame} onChange={(frame) => onChange({ frame })} />
  </Toolbar>
)
