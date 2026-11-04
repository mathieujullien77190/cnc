import { DEFAULT_MODEL_ID } from '@/constants'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { HiddenPayload, ModelsState, ParamsPayload, SectionState } from './types'

export const initialModels = (): ModelsState => ({ model: DEFAULT_MODEL_ID, params: {}, explode: 0, hidden: {}, measuring: false, colored: true, marks: true, section: { axis: null, t: 0.5, flip: false } })

export const modelPicked = (state: ModelsState, { payload }: PayloadAction<string>): void => {
  state.model = payload
}

export const paramsSet = (state: ModelsState, { payload }: PayloadAction<ParamsPayload>): void => {
  state.params[payload.modelId] = payload.params
}

export const explodeSet = (state: ModelsState, { payload }: PayloadAction<number>): void => {
  state.explode = payload
}

export const hiddenSet = (state: ModelsState, { payload }: PayloadAction<HiddenPayload>): void => {
  if (payload.indices.length) state.hidden[payload.modelId] = payload.indices
  else delete state.hidden[payload.modelId]
}

export const coloredSet = (state: ModelsState, { payload }: PayloadAction<boolean>): void => {
  state.colored = payload
}

export const marksSet = (state: ModelsState, { payload }: PayloadAction<boolean>): void => {
  state.marks = payload
}

export const sectionSet = (state: ModelsState, { payload }: PayloadAction<Partial<SectionState>>): void => {
  state.section = { ...state.section, ...payload }
}

export const measuringSet = (state: ModelsState, { payload }: PayloadAction<boolean>): void => {
  state.measuring = payload
}
