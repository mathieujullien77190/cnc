import type { ReactNode } from 'react'

export type TitleProps = {
  children: ReactNode
  /** Balise du titre (`h3` par défaut). */
  as?: 'h2' | 'h3' | 'h4'
  /** Taille du texte (`sm` par défaut). */
  size?: 'sm' | 'xs'
  /** `dark` : stone-800 (par défaut) ; `medium` : stone-700. */
  tone?: 'dark' | 'medium'
  /** Classes en plus (marges). */
  className?: string
}
