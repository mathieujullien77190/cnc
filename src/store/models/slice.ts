import { createSlice } from '@reduxjs/toolkit'
import * as r from './reducers'

export const modelsSlice = createSlice({
  name: 'models',
  initialState: r.initialModels,
  reducers: {
    modelPicked: r.modelPicked,
    paramsSet: r.paramsSet,
    explodeSet: r.explodeSet,
    hiddenSet: r.hiddenSet,
    measuringSet: r.measuringSet,
    coloredSet: r.coloredSet,
    marksSet: r.marksSet,
    sectionSet: r.sectionSet,
  },
})

export const modelsReducer = modelsSlice.reducer
