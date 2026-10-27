import { familyOf } from '@/core/family'
import type { Part } from '@/core/types'
import type { PartFamily } from './types'

export { familyOf }

/** Ordre alphabétique, puis par numéro (`R-2` avant `R-10`). */
export const byId = (a: Part, b: Part): number => a.id.localeCompare(b.id, 'fr', { numeric: true })

/** Pièces rangées par famille : familles dans l'ordre alphabétique, pièces par numéro. */
export const groupByFamily = (parts: Part[]): PartFamily[] => {
  const out = new Map<string, Part[]>()
  for (const p of [...parts].sort(byId)) {
    const key = familyOf(p.id)
    out.set(key, [...(out.get(key) ?? []), p])
  }
  return [...out].map(([family, list]) => ({ family, parts: list }))
}
