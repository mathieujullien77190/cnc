import type { DoneToggleProps } from './types'

/** Case « Fait » : la planche est découpée. */
export const DoneToggle = ({ done, onChange }: DoneToggleProps) => (
  <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${done ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'border-stone-300 bg-white text-stone-700'}`}>
    <input type="checkbox" className="accent-emerald-700" checked={done} onChange={(e) => onChange(e.target.checked)} />
    Fait
  </label>
)
