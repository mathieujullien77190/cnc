import type { RootState } from '@/store'

export const selectModel = (s: RootState) => s.models.model
export const selectModelParams = (s: RootState) => s.models.params
export const selectExplode = (s: RootState) => s.models.explode
export const selectHidden = (s: RootState) => s.models.hidden
export const selectMeasuring = (s: RootState) => s.models.measuring
