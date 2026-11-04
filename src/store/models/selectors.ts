import type { RootState } from '@/store'

export const selectModel = (s: RootState) => s.models.model
export const selectModelParams = (s: RootState) => s.models.params
export const selectExplode = (s: RootState) => s.models.explode
export const selectHidden = (s: RootState) => s.models.hidden
export const selectMeasuring = (s: RootState) => s.models.measuring
export const selectSection = (s: RootState) => s.models.section
export const selectColored = (s: RootState) => s.models.colored
export const selectMarks = (s: RootState) => s.models.marks
