import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
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
  /** Zoom et position des aperçus, par clé de planche (absent : planche entière). */
  sheetViews: Record<string, SheetViewState>
}

const initialState = (): UiState => ({ tab: 'modeles', importReports: [], modelReport: null, selectedPiece: null, focusedPart: null, sheetViews: {} })

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    tabSet: (state, { payload }: PayloadAction<Tab>) => {
      state.tab = payload
    },
    importReportsSet: (state, { payload }: PayloadAction<ImportReport[]>) => {
      state.importReports = payload
    },
    modelReportSet: (state, { payload }: PayloadAction<ImportReport | null>) => {
      state.modelReport = payload
    },
    selectedPieceSet: (state, { payload }: PayloadAction<string | null>) => {
      state.selectedPiece = payload
    },
    partFocused: (state, { payload }: PayloadAction<string>) => {
      state.focusedPart = { key: payload, n: (state.focusedPart?.n ?? 0) + 1 }
    },
    /** `state` nul : l'aperçu revient à la planche entière. */
    sheetViewSet: (state, { payload }: PayloadAction<{ key: string; state: SheetViewState | null }>) => {
      if (payload.state) state.sheetViews[payload.key] = payload.state
      else delete state.sheetViews[payload.key]
    },
  },
})

export const uiActions = uiSlice.actions
