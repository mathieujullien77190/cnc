import type { Part } from '@/core/types'

export type PartQuantitiesProps = {
  thickness: number
  choices: Part[]
  qty: Record<string, number>
  onQty: (key: string, qty: number) => void
  /** Pièce cliquée sur la planche : sa ligne est montrée dans la liste. */
  reveal?: { key: string; n: number } | null
  /** Clé de la pièce choisie : sa ligne est en gris. */
  selectedKey?: string | null
}
