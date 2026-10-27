import type { SelectProps } from './types'

/** Menu déroulant : bord fin arrondi, fond blanc. Les `<option>` sont les enfants ; la taille et les marges viennent de `className`. */
export const Select = ({ value, onChange, children, className = '', disabled }: SelectProps) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`rounded border border-stone-300 bg-white ${className}`}>
    {children}
  </select>
)
