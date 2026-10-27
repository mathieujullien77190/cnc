import type { ReactNode } from 'react'

export type CardProps = {
  children: ReactNode
  /** Classes en plus (espacement des enfants, disposition…). */
  className?: string
  /** Balise de la boîte (`section` par défaut). */
  as?: 'section' | 'div' | 'article'
}
