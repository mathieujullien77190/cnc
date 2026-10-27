import { createSlice } from '@reduxjs/toolkit'
import * as r from './reducers'

export const uiSlice = createSlice({
  name: 'ui',
  initialState: r.initialUi,
  reducers: {
    tabSet: r.tabSet,
    importReportsSet: r.importReportsSet,
    modelReportSet: r.modelReportSet,
    selectedPieceSet: r.selectedPieceSet,
    partFocused: r.partFocused,
    partRevealed: r.partRevealed,
    sheetViewSet: r.sheetViewSet,
  },
})

export const uiReducer = uiSlice.reducer
