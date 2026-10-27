import { categoryCss } from '@/core/colors'
import type { PartTagProps } from './types'

/** Étiquette d'une pièce : son nom sur la couleur de sa famille (la même que sur la planche et en 3D). */
export const PartTag = ({ id, category }: PartTagProps) => (
  <span className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-stone-900 shadow-sm" style={{ backgroundColor: categoryCss(category) }}>{id}</span>
)
