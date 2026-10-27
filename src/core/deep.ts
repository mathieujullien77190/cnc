import { makeNestCache, polyArea } from './hollow'
import { autoGroups, baseLayout, deepLayout, deepSignature, layoutValid, type AutoGroup, type Layout } from './sheets'
import type { DeepPlan, Part, SheetSettings } from './types'

// « Optimiser mieux » : recherche longue (lancée par un bouton, dans un Web Worker) d'un rangement qui pose des pièces dans les trous d'autres pièces.
// Pour chaque groupe de pièces (épaisseur, famille), on essaie des graines 0, 1, 2… (ordre des pièces, angles, ordres de tri) ; la graine qui
// bat le rangement normal est gardée dans les réglages (`settings.deep`), et `buildAutoSheets` la rejoue à l'identique.

/** Temps laissé à la recherche (ms). */
export const DEEP_BUDGET_MS = 10000

/** Ce que la recherche compare : d'abord moins de pièces perdues, puis moins de planches, puis des planches plus remplies (les unes pleines, la dernière libre). */
export interface Score {
  lost: number
  sheets: number
  /** Somme des carrés des remplissages : grande quand la matière est concentrée sur peu de planches. */
  packed: number
}

const areaCache = new WeakMap<Part, number>()
/** Surface de matière d'une pièce (contour moins trous), mm². */
const solidArea = (p: Part) => {
  let a = areaCache.get(p)
  if (a === undefined) areaCache.set(p, (a = polyArea(p.outer) - p.holes.reduce((s, h) => s + polyArea(h), 0)))
  return a
}

export const scoreOf = (l: Layout, W: number, H: number): Score => ({
  lost: l.rejected.length,
  sheets: l.bins.length,
  packed: l.bins.reduce((s, bin) => s + (bin.reduce((t, r) => t + solidArea(r.inst.part), 0) / (W * H)) ** 2, 0),
})

/** `a` est-il meilleur que `b` ? (un gain de remplissage de moins de 0,2 % ne compte pas) */
export const better = (a: Score, b: Score) => (a.lost !== b.lost ? a.lost < b.lost : a.sheets !== b.sheets ? a.sheets < b.sheets : a.packed > b.packed + 2e-3)

/** Remplissage moyen des planches d'un rangement : matière réelle / surface des planches. */
const fillOf = (layouts: Layout[], W: number, H: number) => {
  const sheets = layouts.reduce((s, l) => s + l.bins.length, 0)
  const solid = layouts.reduce((s, l) => s + l.bins.reduce((t, bin) => t + bin.reduce((u, r) => u + solidArea(r.inst.part), 0), 0), 0)
  return sheets ? solid / (sheets * W * H) : 0
}

export interface DeepProgress {
  /** Graines essayées au total. */
  tried: number
  elapsedMs: number
  /** Planches du rangement normal, et du meilleur trouvé jusqu'ici. */
  before: number
  best: number
  /** Groupe en cours (à partir de 1) sur le nombre de groupes à chercher. */
  group: number
  groups: number
}

export interface DeepResult {
  /** `null` : aucune amélioration, le rangement normal reste. */
  plan: DeepPlan | null
  before: { sheets: number; lost: number; fill: number }
  after: { sheets: number; lost: number; fill: number }
  tried: number
  ms: number
}

export interface DeepOptions {
  budgetMs?: number
  /** Nombre maxi de graines par groupe (tests). */
  maxSeeds?: number
  onProgress?: (p: DeepProgress) => void
  now?: () => number
}

/**
 * Cherche, groupe par groupe, la graine qui donne le meilleur rangement en profondeur dans le temps imparti. Ne renvoie un plan que s'il y a
 * un gain par rapport au rangement normal. Le calcul est synchrone (à lancer dans un worker) ; on l'annule en arrêtant le worker.
 */
export const deepSearch = (parts: Part[], s: SheetSettings, o: DeepOptions = {}): DeepResult => {
  const now = o.now ?? (() => performance.now())
  const t0 = now()
  const budget = o.budgetMs ?? DEEP_BUDGET_MS
  const W = s.width - 2 * s.margin
  const H = s.height - 2 * s.margin
  const groups = autoGroups(parts, s)
  const base = groups.map((g) => baseLayout(g.insts, W, H, s.gap, !!s.spread))
  const best = base.slice()
  const scores = base.map((l) => scoreOf(l, W, H))
  const seeds: Record<string, number> = {}
  // un groupe à une seule planche sans perte ne peut pas gagner de planche ; les autres sont cherchés
  const todo = groups.map((_, i) => i).filter((i) => base[i].bins.length > 1 || base[i].rejected.length > 0)
  const lowerBound = (g: AutoGroup) => Math.ceil(g.insts.reduce((a, i) => a + solidArea(i.part), 0) / (W * H) - 1e-9)
  let tried = 0
  const sheetsNow = () => best.reduce((a, l) => a + l.bins.length, 0)
  const before = base.reduce((a, l) => a + l.bins.length, 0)
  const report = (g: number) => o.onProgress?.({ tried, elapsedMs: now() - t0, before, best: sheetsNow(), group: g, groups: todo.length })

  todo.forEach((gi, k) => {
    const g = groups[gi]
    // le temps qui reste est partagé entre les groupes restants
    const deadline = now() + (budget - (now() - t0)) / (todo.length - k)
    const bound = lowerBound(g)
    const cache = makeNestCache()
    for (let seed = 0; seed < (o.maxSeeds ?? Infinity); seed++) {
      if (best[gi].bins.length <= bound && best[gi].rejected.length === 0 && seed > 0) break
      if (seed > 0 && now() >= deadline) break
      const cand = deepLayout(g.insts, W, H, s.gap, !!s.spread, seed, cache)
      tried++
      const sc = scoreOf(cand, W, H)
      if (better(sc, scores[gi]) && layoutValid(cand, g.insts, W, H)) {
        best[gi] = cand
        scores[gi] = sc
        seeds[g.key] = seed
        report(k + 1)
      } else if (tried % 5 === 0) report(k + 1)
    }
    // sans planche gagnée (ni pièce perdue en moins), le rangement normal reste : un autre rangement qui ne gagne rien n'a pas d'intérêt
    if (best[gi].bins.length >= base[gi].bins.length && best[gi].rejected.length >= base[gi].rejected.length) {
      best[gi] = base[gi]
      scores[gi] = scoreOf(base[gi], W, H)
      delete seeds[g.key]
    }
  })

  const ms = now() - t0
  const stat = (ls: Layout[]) => ({ sheets: ls.reduce((a, l) => a + l.bins.length, 0), lost: ls.reduce((a, l) => a + l.rejected.length, 0), fill: fillOf(ls, W, H) })
  const plan: DeepPlan | null = Object.keys(seeds).length ? { sig: deepSignature(parts, s), seeds, before, after: sheetsNow() } : null
  return { plan, before: stat(base), after: stat(best), tried, ms }
}

/** Message du worker vers la page. */
export type DeepMessage = ({ type: 'progress' } & DeepProgress) | { type: 'done'; result: DeepResult } | { type: 'error'; message: string }

/** Demande de la page au worker : que des données sérialisables. */
export interface DeepRequest {
  parts: Part[]
  settings: SheetSettings
  budgetMs: number
}
