import { Btn } from '@/laser/ui'
import type { ViewToolbarProps } from './types'

/** Barre d'outils posée sur la vue 3D : mesurer, cadrer, tout réafficher. */
export const ViewToolbar = ({ measuring, hiddenCount, onMeasure, onFit, onShowAll }: ViewToolbarProps) => (
  <div className="absolute top-2 right-2 flex gap-1.5">
    <Btn block={false} variant={measuring ? 'primary' : undefined} onClick={onMeasure}>Mesurer</Btn>
    <Btn block={false} onClick={onFit}>Cadrer</Btn>
    <Btn block={false} disabled={!hiddenCount} onClick={onShowAll}>Afficher tout{hiddenCount ? ` (${hiddenCount})` : ''}</Btn>
  </div>
)
