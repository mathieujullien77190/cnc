import type { ReactNode } from 'react'
import type { Part } from '@/core/types'

export type PartTreeProps = {
  /** Pièces de la liste, dans l'ordre voulu. */
  parts: Part[]
  /** Une ligne de pièce (le `<li>` complet). */
  renderPart: (p: Part) => ReactNode
  /** Texte affiché quand il n'y a aucune pièce. */
  empty?: ReactNode
  /** Branches dépliées au départ (fermées sinon). */
  defaultOpen?: boolean
}

/** Une famille de pièces : R pour R-01, R-02… */
export type PartFamily = {
  family: string
  parts: Part[]
}
