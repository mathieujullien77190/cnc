import type { ReactNode } from 'react'

export type SelectProps = {
  value: string | number
  /** Reçoit la valeur de l'option choisie (texte). */
  onChange: (value: string) => void
  /** Les `<option>`. */
  children: ReactNode
  /** Classes en plus (padding, taille du texte, largeur…). */
  className?: string
  disabled?: boolean
}
