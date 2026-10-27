import { finishPanels } from '@/models/toCutParts'
import type { ModelDef, Panel, Params } from '@/models/types'
import type { Built } from './types'

/** Un groupe = toutes les planches dont l'id a les mêmes lettres (BO-01, BO-02 → « BO »). */
export const groupName = (id: string): string => id.replace(/-?\d+$/, '')
export const groupOf = (panels: Panel[], index: number): number[] => panels.flatMap((p, i) => (groupName(p.id) === groupName(panels[index].id) ? [i] : []))

export const build = (m: ModelDef, p: Params): { result: Built | null; error: string } => {
  try {
    const r = m.build(p)
    const panels = finishPanels(r.panels)
    return { result: { ...r, panels, view: r.panels.map((q, i) => ({ ...q, id: panels[i].id })), raw: r.panels }, error: '' }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
}
