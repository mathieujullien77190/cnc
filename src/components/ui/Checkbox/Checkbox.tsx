import type { CheckboxProps } from './types'

/** Case à cocher avec son libellé (cliquable), cochée en vert. */
export const Checkbox = ({ label, checked, onChange, className = 'cursor-pointer items-center gap-1.5', inputClassName = '' }: CheckboxProps) => (
  <label className={`flex ${className}`}>
    <input type="checkbox" className={`${inputClassName ? inputClassName + ' ' : ''}accent-emerald-700`} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
)
