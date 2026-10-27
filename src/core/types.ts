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
  /** Textes gravés en plus du nom (rectangles fermés dans le repère de la pièce, comme `outer`). */
  labels?: Pt[][]
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
  /** Angle libre (degrés, sens horaire) : s'il est présent, il remplace `rot`. */
  angle?: number
  outer: Pt[]
  holes: Pt[][]
  /** Textes gravés de la pièce, posés comme le contour. */
  labels?: Pt[][]
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

/** Solution de « Optimiser mieux » : une graine par groupe de pièces (épaisseur, ou épaisseur et famille), valable tant que `sig` est celle des pièces et réglages. */
export interface DeepPlan {
  sig: string
  /** Clé de groupe (`3`, `3|R`) -> graine du rangement en profondeur. Un groupe absent garde le rangement normal. */
  seeds: Record<string, number>
  /** Nombre de planches avant et après (pour l'affichage). */
  before: number
  after: number
}

export interface SheetSettings {
  width: number
  height: number
  margin: number
  gap: number
  /** Desserre les petites pièces tant que cela ne demande pas de planche de plus. */
  spread?: boolean
  /** Une série de planches par famille de pièces (R, S…) au lieu de tout mélanger. */
  byType?: boolean
  /** Solution de « Optimiser mieux » (absente : rangement normal). */
  deep?: DeepPlan
}

export interface Marking {
  /** Nom de chaque pièce, gravé sur elle. */
  names: boolean
  frame: boolean
  /** Dessins du modèle (textes, traits, tableaux) gravés sur les pièces : actifs sauf si `false`. */
  drawings?: boolean
}

export interface Override {
  x: number
  y: number
  rot: boolean
  angle?: number
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
