import type { SwitchProps } from './types'

/** Interrupteur on / off : le libellé à gauche, la case à bascule à droite. Un clic sur la ligne entière bascule. */
export const Switch = ({ label, checked, onChange, className = '' }: SwitchProps) => (
  <label className={`flex cursor-pointer items-center justify-between gap-3 text-xs text-stone-700 ${className}`}>
    <span>{label}</span>
    <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span
      aria-hidden
      className="relative h-5 w-9 shrink-0 rounded-full bg-stone-300 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-1"
    />
  </label>
)
