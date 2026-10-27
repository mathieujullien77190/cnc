import { useState } from 'react'
import { categoryCss } from '@/core/colors'
import { groupByFamily } from './helpers'
import type { PartTreeProps } from './types'

/** Liste de pièces en arborescence : une branche par famille (R -> R-01 R-02…), fermées au départ (sauf `defaultOpen`), que l'on déplie ou replie. */
export const PartTree = ({ parts, renderPart, empty, defaultOpen = false }: PartTreeProps) => {
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set()) // familles dont l'état a été inversé par un clic
  const isOpen = (family: string) => defaultOpen !== flipped.has(family)
  const toggle = (family: string) =>
    setFlipped((s) => {
      const next = new Set(s)
      if (!next.delete(family)) next.add(family)
      return next
    })
  const families = groupByFamily(parts)
  return (
    <ul className="space-y-1">
      {families.map(({ family, parts: list }) => (
        <li key={family}>
          <button
            type="button"
            onClick={() => toggle(family)}
            aria-expanded={isOpen(family)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-semibold text-stone-900 shadow-sm hover:brightness-95"
            style={{ backgroundColor: categoryCss(list[0].category) }}
          >
            <span className="w-3 text-[10px]">{isOpen(family) ? '▾' : '▸'}</span>
            <span>{family}</span>
            {list[0].category && <span className="truncate font-normal">{list[0].category}</span>}
            <span className="ml-auto text-[11px] font-normal tabular-nums">{list.length} {list.length > 1 ? 'pièces' : 'pièce'}</span>
          </button>
          {isOpen(family) && <ul className="mt-1 space-y-1 border-l border-stone-200 pl-3 ml-1.5">{list.map(renderPart)}</ul>}
        </li>
      ))}
      {!parts.length && empty}
    </ul>
  )
}
