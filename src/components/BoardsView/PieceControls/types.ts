import type { Override, Placed } from '@/core/types'

export type PieceControlsProps = {
  /** Pièce choisie sur la planche (rien si aucune). */
  sel: Placed | undefined
  /** La planche a-t-elle des positions manuelles ? Sinon « Replacer auto » n'a rien à faire. */
  overrides: Record<string, Override>
  onPin: (uid: string, o: Override) => void
  onReset: (uid: string) => void
  onResetAll: () => void
}
