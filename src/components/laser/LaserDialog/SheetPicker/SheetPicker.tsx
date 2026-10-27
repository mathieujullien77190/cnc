import { Select } from '@/components/ui'
import type { SheetPickerProps } from './types'

/** Choix de la planche à piloter, en haut de la colonne de gauche du pilotage. */
export const SheetPicker = ({ m }: SheetPickerProps) => (
  <label className="block space-y-1 rounded-lg border border-stone-200 bg-white/70 p-3 text-xs font-semibold text-stone-700">
    Planche à découper
    <Select value={m.itemIndex} onChange={(v) => m.setItemIndex(Number(v))} disabled={m.job.running} className="block w-full px-2 py-1.5 text-xs font-normal">
      {m.items.map((it, i) => <option key={it.fileName} value={i}>{it.label}</option>)}
    </Select>
    {m.item?.notice && <span className="block text-[11px] font-normal text-stone-500">{m.item.notice}</span>}
  </label>
)
