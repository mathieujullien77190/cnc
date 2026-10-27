import type { Marking, Override, Pt, Sheet } from '@/core/types'
import type { View } from '@/types'

export type { View }

export type Interaction = {
  selected: string | null
  onSelect: (uid: string | null) => void
  /** Position finale d'un exemplaire déplacé ou tourné à la main. */
  onCommit: (uid: string, o: Override) => void
}

export type SheetPreviewProps = {
  sheet: Sheet
  marking: Marking
  bad?: Set<string>
  interact?: Interaction
  /** Clé d'une pièce du catalogue à surligner (tous ses exemplaires de la planche). */
  highlight?: string | null
  /** Clic sur une pièce (clé du catalogue et uid de l'exemplaire), ou sur le fond (deux `null`). */
  onPiece?: (partKey: string | null, uid: string | null) => void
  /** Hauteur maximale de l'aperçu hors plein écran (CSS). Par défaut 75 % de la fenêtre ; la planche perso prend toute la hauteur disponible. */
  maxHeight?: string
  /** Exemplaire au contour vert quand l'aperçu n'est pas interactif (planches automatiques). */
  selectedUid?: string | null
}

/** Pièce en cours de glisser : point de départ (mm) et décalage courant. */
export type Drag = {
  uid: string
  from: Pt
  dx: number
  dy: number
}

/** Déplacement de la vue en cours : position du pointeur (px) et vue au départ. */
export type Pan = {
  px: number
  py: number
  view: View
}
