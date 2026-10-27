import type { ReactNode } from 'react'

export type CheckboxProps = {
  /** Texte (ou contenu) à côté de la case. */
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  /** Classes du libellé (remplace curseur, alignement et espacement par défaut : `cursor-pointer items-center gap-1.5`). */
  className?: string
  /** Classes en plus pour la case elle-même. */
  inputClassName?: string
}
