export type QtyStepperProps = {
  /** Nom de la pièce, pour les libellés d'accessibilité. */
  id: string
  /** Quantité actuelle de la planche. */
  n: number
  /** Appelé une fois les clics terminés, avec la quantité finale. */
  onCommit: (n: number) => void
}
