import { Card, PartTag, Title } from '@/components/ui'
import PartTree from '@/components/parts/PartTree'
import { round1 as mm } from '@/helpers'
import { QtyStepper } from './QtyStepper'
import type { PartQuantitiesProps } from './types'

/** Pièces de l'épaisseur choisie, avec − / + pour dire combien en mettre sur la planche. */
export const PartQuantities = ({ thickness, choices, qty, onQty, reveal, selectedKey }: PartQuantitiesProps) => (
  <Card>
    <Title size="xs" tone="medium" className="mb-2">Pièces à découper ({thickness} mm)</Title>
    <PartTree
      parts={choices}
      defaultOpen
      reveal={reveal}
      empty={<li className="text-[11px] text-stone-500">Aucune pièce de {thickness} mm.</li>}
      renderPart={(p) => (
        <div className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${p.key === selectedKey ? 'bg-stone-300/70' : ''}`}>
          <span className="min-w-0 flex-1">
            <PartTag id={p.id} category={p.category} />
            <span className="ml-1.5 text-[11px] text-stone-500">{mm(p.w)} × {mm(p.h)}</span>
          </span>
          <QtyStepper id={p.id} n={qty[p.key] ?? 0} onCommit={(v) => onQty(p.key, v)} />
        </div>
      )}
    />
  </Card>
)
