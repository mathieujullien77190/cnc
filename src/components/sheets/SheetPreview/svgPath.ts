import type { Pt } from '@/core/types'

/** Arrondi à 1 µm : garde les chaînes de tracé courtes. */
export const f = (v: number) => Math.round(v * 1000) / 1000

/** Contour fermé en tracé SVG. */
export const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
