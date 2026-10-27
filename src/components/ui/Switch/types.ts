import type { ReactNode } from 'react'

export type SwitchProps = {
  /** Libellé, à gauche. */
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  /** Classes en plus pour la ligne entière. */
  className?: string
}
