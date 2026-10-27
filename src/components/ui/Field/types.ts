import type { ReactNode } from 'react'

export type FieldProps = {
  /** Libellé affiché à gauche. */
  label?: string
  /** Le champ (et son éventuelle unité), poussé à droite. */
  children: ReactNode
  className?: string
}
