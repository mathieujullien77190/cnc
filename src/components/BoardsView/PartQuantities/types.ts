import type { Part } from '@/core/types'

export type PartQuantitiesProps = {
  thickness: number
  choices: Part[]
  qty: Record<string, number>
  onQty: (key: string, qty: number) => void
}
