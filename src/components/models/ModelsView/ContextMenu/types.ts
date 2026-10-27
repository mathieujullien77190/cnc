export type ShowItem = {
  /** Texte de l'entrée (« BO-01 », « le groupe BO (3) »). */
  label: string
  /** Planches à réafficher. */
  indices: number[]
}

export type ContextMenuProps = {
  x: number
  y: number
  /** Planche visée par le clic droit (absent : clic dans le vide). */
  panel?: {
    id: string
    /** Lettres du groupe de la planche (« BO ») et nombre de planches dans le groupe. */
    group: string
    groupCount: number
    onHide: () => void
    onHideGroup: () => void
  }
  /** Planches cachées, une entrée chacune (plus une par groupe quand plusieurs planches d'un groupe sont cachées). */
  hiddenItems: ShowItem[]
  onShow: (indices: number[]) => void
  onShowAll: () => void
}
