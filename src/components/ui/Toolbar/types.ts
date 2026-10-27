import type { ReactNode } from 'react'

export type ToolbarProps = {
  children: ReactNode
  /** Classes de la rangée en plus de `flex flex-wrap` (remplace `items-center gap-2` par défaut). */
  className?: string
  /** Pour annoncer la rangée comme un groupe (`role="group"`). */
  role?: 'group'
  'aria-label'?: string
}
