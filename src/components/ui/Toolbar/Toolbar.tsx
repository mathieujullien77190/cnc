import type { ToolbarProps } from './types'

/** Rangée d'éléments (boutons, cases…) qui passe à la ligne quand la place manque. */
export const Toolbar = ({ children, className = 'items-center gap-2', role, 'aria-label': ariaLabel }: ToolbarProps) => (
  <div role={role} aria-label={ariaLabel} className={`flex flex-wrap ${className}`}>{children}</div>
)
