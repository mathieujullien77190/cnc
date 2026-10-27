import type { PayloadAction } from '@reduxjs/toolkit'
import type { ImportReport, Tab } from '@/types'
import type { SheetViewPayload, UiState } from './types'

export const initialUi = (): UiState => ({ tab: 'modeles', importReports: [], modelReport: null, selectedPiece: null, focusedPart: null, revealedPart: null, sheetViews: {} })

export const tabSet = (state: UiState, { payload }: PayloadAction<Tab>): void => {
  state.tab = payload
}

export const importReportsSet = (state: UiState, { payload }: PayloadAction<ImportReport[]>): void => {
  state.importReports = payload
}

export const modelReportSet = (state: UiState, { payload }: PayloadAction<ImportReport | null>): void => {
  state.modelReport = payload
}

export const selectedPieceSet = (state: UiState, { payload }: PayloadAction<string | null>): void => {
  state.selectedPiece = payload
  if (payload) state.focusedPart = null // une seule sélection à la fois : la pièce de la planche remplace celle de la liste
}

export const partRevealed = (state: UiState, { payload }: PayloadAction<string>): void => {
  state.revealedPart = { key: payload, n: (state.revealedPart?.n ?? 0) + 1 }
}

export const partFocused = (state: UiState, { payload }: PayloadAction<string>): void => {
  state.focusedPart = { key: payload, n: (state.focusedPart?.n ?? 0) + 1 }
  state.selectedPiece = null // la pièce de la liste remplace celle de la planche
}

/** `state` nul : l'aperçu revient à la planche entière. */
export const sheetViewSet = (state: UiState, { payload }: PayloadAction<SheetViewPayload>): void => {
  if (payload.state) state.sheetViews[payload.key] = payload.state
  else delete state.sheetViews[payload.key]
}
