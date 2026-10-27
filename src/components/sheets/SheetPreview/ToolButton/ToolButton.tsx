import type { ToolButtonProps } from './types'

/** Petit bouton de la barre de l'aperçu (+ / − / Ajuster / plein écran). */
export const ToolButton = ({ children, ...props }: ToolButtonProps) => (
  <button type="button" {...props} className="h-7 min-w-7 rounded border border-stone-300 bg-white/90 px-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-white disabled:opacity-40">
    {children}
  </button>
)
