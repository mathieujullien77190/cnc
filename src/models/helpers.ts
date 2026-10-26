import type { Pt } from '../core/types'

/** Rectangle de coin haut-gauche (x, y). */
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

/** Cercle découpé en segments (32 par défaut). */
export const circle = (cx: number, cy: number, r: number, n = 32): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)])

/**
 * Planche rectangulaire L × H dont le bord bas porte `n` tenons de hauteur `t` (largeur L / (2n + 1), séparés par des creux de même largeur).
 * La boîte englobante fait L × (H + t) ; les tenons sont en bas.
 */
export const tabbedBottom = (L: number, H: number, t: number, n: number): { outer: Pt[]; tabs: { u0: number; u1: number }[] } => {
  const tw = L / (2 * n + 1)
  const tabs = Array.from({ length: n }, (_, k) => ({ u0: (2 * k + 1) * tw, u1: (2 * k + 2) * tw }))
  const outer: Pt[] = [[0, 0], [L, 0], [L, H]]
  for (const { u0, u1 } of [...tabs].reverse()) outer.push([u1, H], [u1, H + t], [u0, H + t], [u0, H])
  outer.push([0, H])
  return { outer, tabs }
}
