import type { ReactNode } from 'react'
import type { Part } from '@/core/types'

export type PartTreeProps = {
  /** Pièces de la liste, dans l'ordre voulu. */
  parts: Part[]
  /** Contenu d'une ligne de pièce (l'arbre l'enveloppe dans son `<li>`). */
  renderPart: (p: Part) => ReactNode
  /** Texte affiché quand il n'y a aucune pièce. */
  empty?: ReactNode
  /** Branches dépliées au départ (fermées sinon). */
  defaultOpen?: boolean
  /** Pièce à montrer (cliquée sur une planche) : sa branche s'ouvre, la liste défile jusqu'à elle et elle est surlignée. `n` change à chaque demande. */
  reveal?: { key: string; n: number } | null
}

/** Une famille de pièces : R pour R-01, R-02… */
export type PartFamily = {
  family: string
  parts: Part[]
}
