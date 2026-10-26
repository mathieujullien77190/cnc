import { inside } from '../laser/job/geometry'
import type { Pt } from '../core/types'
import type { Panel } from './types'

// Contrôle d'un contour cranté : repère les « traits résiduels » (segments qui ne devraient pas exister après le crantage et le serrage).

const EPS = 1e-6

export interface Issue {
  panel: string
  kind: 'minuscule' | 'biais' | 'point-inutile' | 'doublon' | 'croisement'
  where: string
}

type Seg = { a: Pt; b: Pt; ring: number; i: number }

const segsOf = (rings: Pt[][]): Seg[] => rings.flatMap((r, ring) => r.map((a, i): Seg => ({ a, b: r[(i + 1) % r.length], ring, i })))

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** Deux segments se croisent franchement (pas un simple contact en bout). */
const crosses = (s: Seg, t: Seg) => {
  const d1 = cross(t.a, t.b, s.a)
  const d2 = cross(t.a, t.b, s.b)
  const d3 = cross(s.a, s.b, t.a)
  const d4 = cross(s.a, s.b, t.b)
  return d1 * d2 < -EPS && d3 * d4 < -EPS
}

const fmt = (p: Pt) => `(${Math.round(p[0] * 100) / 100}, ${Math.round(p[1] * 100) / 100})`

/**
 * Traits résiduels d'une planche :
 * - `minuscule` : segment de moins de 0,05 mm ;
 * - `biais` : segment presque horizontal ou vertical (écart < 1 mm) entre deux segments bien alignés — un cran dont un coin a bougé seul, la paroi penche (les cercles, faits de petits segments obliques, ne comptent pas) ;
 * - `point-inutile` : point aligné sur ses deux voisins (trait fantôme dans la découpe) ;
 * - `doublon` : deux points identiques qui se suivent ;
 * - `croisement` : deux traits qui se croisent (contour ou fenêtre).
 */
export const panelIssues = (p: Panel): Issue[] => {
  const out: Issue[] = []
  const rings = [p.outer, ...(p.holes ?? [])]
  const add = (kind: Issue['kind'], where: string) => out.push({ panel: p.id, kind, where })
  rings.forEach((r, ring) => {
    const name = ring === 0 ? 'contour' : `fenêtre ${ring}`
    const aligned = (a: Pt, b: Pt) => Math.abs(b[0] - a[0]) < EPS || Math.abs(b[1] - a[1]) < EPS
    r.forEach((a, i) => {
      const b = r[(i + 1) % r.length]
      const prev = r[(i + r.length - 1) % r.length]
      const next = r[(i + 2) % r.length]
      const dx = Math.abs(b[0] - a[0])
      const dy = Math.abs(b[1] - a[1])
      const len = Math.hypot(dx, dy)
      if (len < EPS) add('doublon', `${name} ${fmt(a)}`)
      else if (len < 0.05) add('minuscule', `${name} ${fmt(a)} → ${fmt(b)}`)
      else if (dx > EPS && dy > EPS && Math.min(dx, dy) < 1 && aligned(prev, a) && aligned(b, next)) add('biais', `${name} ${fmt(a)} → ${fmt(b)} (écart ${Math.round(Math.min(dx, dy) * 100) / 100} mm)`)
      if (len >= EPS && Math.abs(cross(prev, a, b)) < 1e-9) add('point-inutile', `${name} ${fmt(a)}`)
    })
  })
  const segs = segsOf(rings)
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) if (crosses(segs[i], segs[j])) add('croisement', `${fmt(segs[i].a)}→${fmt(segs[i].b)} × ${fmt(segs[j].a)}→${fmt(segs[j].b)}`)
  return out
}

/** Traits gravés (le nom) qui sortent de la planche, tombent dans une fenêtre ou coupent un bord : `[]` si le nom est bien posé. */
export const markIssues = (p: Panel, rects: Pt[][]): Issue[] => {
  const rings = [p.outer, ...(p.holes ?? [])]
  const edges = segsOf(rings)
  const out: Issue[] = []
  rects.forEach((r, k) => {
    const bad = r.some((q) => !inside(q, p.outer) || (p.holes ?? []).some((h) => inside(q, h))) || segsOf([r]).some((a) => edges.some((e) => crosses(a, e)))
    if (bad) out.push({ panel: p.id, kind: 'croisement', where: `trait gravé ${k + 1} ${fmt(r[0])} touche un bord ou une fenêtre` })
  })
  return out
}
