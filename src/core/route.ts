import type { Pt } from './types'

// Parcours de la tête entre les contours : on cherche l'ordre des groupes (une pièce, ou les traits gravés d'une pièce) et le point
// d'attaque de chaque contour qui réduisent les déplacements à vide (laser éteint), sans jamais violer une contrainte « a avant b ».

/**
 * Un groupe est visité d'un bloc : d'abord ses contours libres (trous, traits gravés), repris au plus proche voisin, puis `last`
 * (le contour extérieur) s'il y en a un. Chaque contour est fermé : on le quitte là où on est entré.
 */
export interface Group {
  free: Pt[][]
  last?: Pt[]
}

/** Contraintes de précédence : `[a, b]` = le groupe a est coupé avant le groupe b. */
export type Before = [number, number][]

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Indice du sommet de `pts` le plus proche de `from`. */
const nearestIndex = (pts: Pt[], from: Pt): number => {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = dist(pts[i], from)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

const startAt = (pts: Pt[], i: number): Pt[] => (i === 0 ? pts : [...pts.slice(i), ...pts.slice(0, i)])

interface Visit {
  contours: Pt[][]
  end: Pt
  cost: number
}

/** Visite un groupe depuis `from` : contours libres au plus proche voisin, puis le contour extérieur. */
const visit = (g: Group, from: Pt, build: boolean): Visit => {
  let pos = from
  let cost = 0
  const out: Pt[][] = []
  const left = g.free.slice()
  while (left.length) {
    let bk = 0
    let bi = 0
    let bd = Infinity
    for (let k = 0; k < left.length; k++) {
      const i = nearestIndex(left[k], pos)
      const d = dist(left[k][i], pos)
      if (d < bd) {
        bd = d
        bk = k
        bi = i
      }
    }
    const [c] = left.splice(bk, 1)
    cost += bd
    pos = c[bi]
    if (build) out.push(startAt(c, bi))
  }
  if (g.last) {
    const i = nearestIndex(g.last, pos)
    cost += dist(g.last[i], pos)
    pos = g.last[i]
    if (build) out.push(startAt(g.last, i))
  }
  return { contours: out, end: pos, cost }
}

/** Longueur des déplacements à vide d'un ordre de groupes, depuis `start` et, si `end`, jusqu'au retour en `end`. */
export const travelCost = (groups: Group[], order: number[], start: Pt, end?: Pt): number => {
  let pos = start
  let cost = 0
  for (const i of order) {
    const v = visit(groups[i], pos, false)
    cost += v.cost
    pos = v.end
  }
  return end ? cost + dist(pos, end) : cost
}

/** Ordre de départ : plus proche voisin parmi les groupes dont tous les prédécesseurs sont déjà faits. */
export const greedyOrder = (groups: Group[], before: Before, start: Pt): number[] => {
  const need = groups.map(() => [] as number[])
  for (const [a, b] of before) need[b].push(a)
  const done = new Set<number>()
  const order: number[] = []
  let pos = start
  while (order.length < groups.length) {
    let best = -1
    let bd = Infinity
    for (let i = 0; i < groups.length; i++) {
      if (done.has(i) || !need[i].every((a) => done.has(a))) continue
      const v = visit(groups[i], pos, false)
      if (v.cost < bd) {
        bd = v.cost
        best = i
      }
    }
    if (best < 0) best = groups.findIndex((_, i) => !done.has(i)) // contraintes incohérentes : on ne bloque pas
    done.add(best)
    order.push(best)
    pos = visit(groups[best], pos, false).end
  }
  return order
}

const respects = (order: number[], before: Before): boolean => {
  if (!before.length) return true
  const at = new Map(order.map((g, k) => [g, k]))
  return before.every(([a, b]) => (at.get(a) ?? 0) < (at.get(b) ?? 0))
}

/**
 * Améliore un ordre par échanges locaux (inversion d'un tronçon « 2-opt », déplacement d'un groupe « or-opt ») tant que le trajet raccourcit,
 * dans la limite de `budgetMs`. Un échange qui violerait une contrainte est refusé.
 */
export const improveOrder = (groups: Group[], order: number[], before: Before, start: Pt, end: Pt | undefined, budgetMs: number): number[] => {
  const n = order.length
  if (n < 3) return order
  const t0 = Date.now()
  let best = order.slice()
  let bestCost = travelCost(groups, best, start, end)
  const tryOrder = (cand: number[]) => {
    if (!respects(cand, before)) return false
    const c = travelCost(groups, cand, start, end)
    if (c < bestCost - 1e-9) {
      best = cand
      bestCost = c
      return true
    }
    return false
  }
  let improved = true
  while (improved && Date.now() - t0 < budgetMs) {
    improved = false
    for (let i = 0; i < n - 1 && Date.now() - t0 < budgetMs; i++) {
      for (let j = i + 1; j < n; j++) {
        // 2-opt : on inverse le tronçon i..j
        if (tryOrder([...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)])) improved = true
      }
      // or-opt : on déplace le groupe i ailleurs
      const g = best[i]
      const rest = [...best.slice(0, i), ...best.slice(i + 1)]
      for (let k = 0; k <= rest.length; k++) {
        if (k === i) continue
        if (tryOrder([...rest.slice(0, k), g, ...rest.slice(k)])) {
          improved = true
          break
        }
      }
    }
  }
  return best
}

export interface Route {
  /** Contours à parcourir, dans l'ordre, chacun démarré au sommet d'attaque choisi ; `groups[i]` donne le groupe d'origine. */
  steps: { group: number; contours: Pt[][] }[]
  /** Position de la tête à la fin. */
  end: Pt
  /** Déplacements à vide (mm), retour en `end` compris s'il est demandé. */
  travel: number
  /** Déplacements à vide avec le seul plus proche voisin, pour comparer. */
  baseline: number
}

/** Calcule le parcours d'un ensemble de groupes : ordre, sommets d'attaque, longueur à vide. */
export const planRoute = (groups: Group[], before: Before, start: Pt, { end, budgetMs = 150 }: { end?: Pt; budgetMs?: number } = {}): Route => {
  const greedy = greedyOrder(groups, before, start)
  const baseline = travelCost(groups, greedy, start, end)
  const order = improveOrder(groups, greedy, before, start, end, budgetMs)
  const steps: Route['steps'] = []
  let pos = start
  for (const i of order) {
    const v = visit(groups[i], pos, true)
    steps.push({ group: i, contours: v.contours })
    pos = v.end
  }
  const travel = travelCost(groups, order, start, end)
  return { steps, end: end ?? pos, travel: Math.min(travel, baseline), baseline }
}
