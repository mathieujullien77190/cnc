import type { PointerEvent } from 'react'
import type { Placed, Pt } from '@/core/types'

export type SheetPieceProps = {
  it: Placed
  bad: boolean
  selected: boolean
  /** Noms gravés de la pièce, `null` tant qu'ils ne sont pas calculés ou masqués. */
  marks: Pt[][] | null
  /** Dessins du modèle gravés sur la pièce (autre couleur que les noms), `null` si masqués. */
  drawings: Pt[][] | null
  /** Décalage pendant un glisser. */
  drag: { dx: number; dy: number } | null
  movable: boolean
  onDown: (e: PointerEvent<SVGGElement>, uid: string) => void
}
