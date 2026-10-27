import type { FieldProps } from './types'

/** Un réglage : libellé à gauche, champ à droite (le champ passe en enfant). */
export const Field = ({ label, children, className = '' }: FieldProps) => (
  <label className={`flex items-center gap-1.5 text-[11px] text-stone-600 ${className}`}>
    {label && <span className="whitespace-nowrap">{label}</span>}
    <span className="ml-auto flex items-center gap-1.5">{children}</span>
  </label>
)
