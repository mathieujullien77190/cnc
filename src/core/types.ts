export type Pt = [number, number]

/** Pièce du catalogue : contours normalisés (coin haut-gauche de la boîte englobante en 0, 0 ; y vers le bas, mm). */
export interface Part {
  /** Identifiant unique dans le catalogue : `projet/id`. */
  key: string
  /** Nom court gravé sur la pièce (ex. CX-03). */
  id: string
  category: string
  project: string
  thickness: number
  material: string
  outer: Pt[]
  holes: Pt[][]
  /** Quantité demandée par le fichier ; modifiable dans l'app. */
  qty: number
  rotate: 'any90' | 'none'
  w: number
  h: number
}

/** Une pièce posée sur une planche (contours dans le repère de la planche, y vers le bas). */
export interface Placed {
  /** Identifiant d'exemplaire : `partKey#copie`. */
  uid: string
  part: Part
  n: number
  x: number
  y: number
  w: number
  h: number
  rot: boolean
  outer: Pt[]
  holes: Pt[][]
}

export interface Sheet {
  /** `auto-3-1`, `perso-ab12`… */
  key: string
  label: string
  /** Numéro gravé dans un coin de la planche (« 3 », « P1 ») pour la reconnaître après la coupe. */
  mark?: string
  thickness: number
  width: number
  height: number
  items: Placed[]
  /** Exemplaires demandés qui ne tiennent pas sur cette planche. */
  rejected: Part[]
  custom: boolean
  /** Occupation de la planche (0 à 1). */
  fill: number
}

export interface SheetSettings {
  width: number
  height: number
  margin: number
  gap: number
  /** Desserre les petites pièces tant que cela ne demande pas de planche de plus. */
  spread?: boolean
}

export interface Marking {
  names: boolean
  frame: boolean
}

export interface Override {
  x: number
  y: number
  rot: boolean
}

export interface CustomBoard {
  id: string
  name: string
  thickness: number
  width: number
  height: number
  /** Quantité voulue par clé de pièce. */
  qty: Record<string, number>
  /** Pièces déplacées à la main, par uid d'exemplaire. */
  overrides: Record<string, Override>
  marking: Marking
}
