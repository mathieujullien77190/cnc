import type { Tab } from '@/types'

/** Onglets affichés dans l'en-tête, dans l'ordre. */
export const TABS: { id: Tab; label: string }[] = [
  { id: 'modeles', label: 'Modèles 3D' },
  { id: 'auto', label: 'Planches automatiques' },
  { id: 'perso', label: 'Planches perso' },
]
