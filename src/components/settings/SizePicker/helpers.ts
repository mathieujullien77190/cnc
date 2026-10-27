import { SHEET_FORMATS } from './constants'

export const isPreset = (w: number, h: number): boolean => SHEET_FORMATS.some(([pw, ph]) => pw === w && ph === h)
