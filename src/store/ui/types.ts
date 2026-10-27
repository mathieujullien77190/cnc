import type { ImportReport, SheetViewState, Tab } from '@/types'

export type UiState = {
  tab: Tab
  /** Bilans des derniers fichiers déposés. */
  importReports: ImportReport[]
  /** Bilan du dernier envoi d'un modèle 3D à la découpe. */
  modelReport: ImportReport | null
  /** Pièce choisie dans la planche perso (uid de l'exemplaire). */
  selectedPiece: string | null
  /** Pièce cliquée dans la liste (onglet auto) : sa planche s'affiche. `n` change à chaque clic, pour refaire défiler même sur la même pièce. */
  focusedPart: { key: string; n: number } | null
  /** Pièce cliquée sur une planche : sa ligne s'affiche dans la liste (branche dépliée, défilement, surlignage). `n` change à chaque clic. */
  revealedPart: { key: string; n: number } | null
  /** Zoom et position des aperçus, par clé de planche (absent : planche entière). */
  sheetViews: Record<string, SheetViewState>
}

export type SheetViewPayload = { key: string; state: SheetViewState | null }
