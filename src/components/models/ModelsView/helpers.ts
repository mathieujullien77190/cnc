import { finishPanels } from '@/models/toCutParts'
import type { ModelDef, Panel, Params } from '@/models/types'
import type { Built } from './types'

/** Un groupe = toutes les planches dont l'id a les mêmes lettres (BO-01, BO-02 → « BO »). */
export const groupName = (id: string): string => id.replace(/-?\d+$/, '')
export const groupOf = (panels: Panel[], index: number): number[] => panels.flatMap((p, i) => (groupName(p.id) === groupName(panels[index].id) ? [i] : []))

/** Deux listes de planches ont les mêmes formes (contours, trous, textes, épaisseur : mêmes objets) : seuls leur position, rotation ou visibilité ont pu changer. */
export const sameShapes = (a: Panel[], b: Panel[]): boolean =>
  a.length === b.length && a.every((p, i) => {
    const q = b[i]
    return p.id === q.id && p.outer === q.outer && p.holes === q.holes && p.labels === q.labels && p.rules === q.rules && p.solid === q.solid && p.tube === q.tube && p.thickness === q.thickness && p.category === q.category && p.cut === q.cut
  })

/** Dernière construction : un curseur de charnière ne change que les positions, on ne refait ni le serrage ni la numérotation. */
let last: { raw: Panel[]; panels: Panel[] } | null = null

export const build = (m: ModelDef, p: Params): { result: Built | null; error: string } => {
  try {
    const r = m.build(p)
    const prev = last
    const panels = prev && sameShapes(prev.raw, r.panels) ? prev.panels.map((q, i) => ({ ...q, position: r.panels[i].position, rotation: r.panels[i].rotation, visible: r.panels[i].visible })) : finishPanels(r.panels)
    last = { raw: r.panels, panels }
    return { result: { ...r, panels, view: r.panels.map((q, i) => ({ ...q, id: panels[i].id })), raw: r.panels }, error: '' }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
}
