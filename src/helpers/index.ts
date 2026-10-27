import type { Sheet } from '@/core/types'

/** Arrondi au dixième (mm affichés). */
export const round1 = (v: number): number => Math.round(v * 10) / 10

/** Résumé des pièces qui ne tiennent pas : « 3 × CX-01, 1 × N-02 ». */
export const rejectedText = (sheet: Sheet): string => {
  const count = new Map<string, number>()
  for (const p of sheet.rejected) count.set(p.id, (count.get(p.id) ?? 0) + 1)
  return [...count].map(([id, n]) => `${n} × ${id}`).join(', ')
}
