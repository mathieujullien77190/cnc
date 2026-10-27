import type { RootState } from '@/store'

export const selectTab = (s: RootState) => s.ui.tab
export const selectImportReports = (s: RootState) => s.ui.importReports
export const selectModelReport = (s: RootState) => s.ui.modelReport
export const selectSelectedPiece = (s: RootState) => s.ui.selectedPiece
export const selectFocusedPart = (s: RootState) => s.ui.focusedPart
/** Clé du catalogue de la pièce choisie, qu'elle l'ait été sur une planche (uid `clé#n`) ou dans la liste : la liste la montre en gris. */
export const selectSelectedPartKey = (s: RootState): string | null => {
  const uid = s.ui.selectedPiece
  if (uid) return uid.slice(0, uid.lastIndexOf('#'))
  return s.ui.focusedPart?.key ?? null
}
export const selectSheetViews = (s: RootState) => s.ui.sheetViews
