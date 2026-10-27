import PartTag from '@/components/ui/PartTag'
import PartTree from '@/components/PartTree'
import { round1 as mm } from '@/helpers'
import { QtyStepper } from './QtyStepper'
import type { PartQuantitiesProps } from './types'

/** Pièces de l'épaisseur choisie, avec − / + pour dire combien en mettre sur la planche. */
export const PartQuantities = ({ thickness, choices, qty, onQty }: PartQuantitiesProps) => (
  <section className="rounded-lg border border-stone-200 bg-white p-3">
    <h3 className="mb-2 text-xs font-semibold text-stone-700">Pièces à découper ({thickness} mm)</h3>
    <PartTree
      parts={choices}
      defaultOpen
      empty={<li className="text-[11px] text-stone-500">Aucune pièce de {thickness} mm.</li>}
      renderPart={(p) => (
        <li key={p.key} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1">
            <PartTag id={p.id} category={p.category} />
            <span className="ml-1.5 text-[11px] text-stone-500">{mm(p.w)} × {mm(p.h)}</span>
          </span>
          <QtyStepper id={p.id} n={qty[p.key] ?? 0} onCommit={(v) => onQty(p.key, v)} />
        </li>
      )}
    />
  </section>
)
