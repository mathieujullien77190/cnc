import { createSlice } from '@reduxjs/toolkit'
import * as r from './reducers'

export const projectSlice = createSlice({
  name: 'project',
  initialState: r.emptyProject,
  reducers: {
    partsImported: r.partsImported,
    catalogReplaced: r.catalogReplaced,
    partsAdded: r.partsAdded,
    qtySet: r.qtySet,
    partRemoved: r.partRemoved,
    projectRemoved: r.projectRemoved,
    cleared: r.cleared,
    settingsSet: r.settingsSet,
    autoMarkingSet: r.autoMarkingSet,
    doneSet: r.doneSet,
    boardAdded: { reducer: r.boardAdded, prepare: r.prepareBoardAdded },
    boardUpdated: r.boardUpdated,
    boardRemoved: r.boardRemoved,
    boardQtySet: r.boardQtySet,
    overrideSet: r.overrideSet,
  },
})

export const projectReducer = projectSlice.reducer
