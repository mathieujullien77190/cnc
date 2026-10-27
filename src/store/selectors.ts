import { createSelector } from '@reduxjs/toolkit'
import { buildAutoSheets, buildCustomSheet } from '@/core/sheets'
import type { SheetEntry } from '@/types'
import { DEFAULT_MARKING } from '@/constants'
import type { RootState } from './index'

export const selectParts = (s: RootState) => s.project.parts
export const selectSettings = (s: RootState) => s.project.settings
export const selectBoards = (s: RootState) => s.project.boards
export const selectDone = (s: RootState) => s.project.done
export const selectAutoMarking = (s: RootState) => s.project.autoMarking

const selectMargin = (s: RootState) => s.project.settings.margin
const selectGap = (s: RootState) => s.project.settings.gap
const selectSpread = (s: RootState) => !!s.project.settings.spread

/** Planches automatiques (une série par épaisseur) : recalculées seulement si les pièces ou les réglages changent. */
export const selectAutoSheets = createSelector([selectParts, selectSettings], (parts, settings) => buildAutoSheets(parts, settings))

/** Planches perso : recalculées seulement si une planche, une pièce, la marge, l'écart ou l'étalement change. */
export const selectBoardSheets = createSelector([selectBoards, selectParts, selectMargin, selectGap, selectSpread], (boards, parts, margin, gap, spread) =>
  boards.map((b, i) => ({ ...buildCustomSheet(b, parts, margin, gap, spread), mark: `P${i + 1}` })),
)

/** Toutes les planches avec leurs cases cochées. */
export const selectEntries = createSelector([selectAutoSheets, selectBoardSheets, selectAutoMarking, selectBoards], (autoSheets, boardSheets, autoMarking, boards): SheetEntry[] => [
  ...autoSheets.map((sheet) => ({ sheet, marking: autoMarking[sheet.key] ?? DEFAULT_MARKING })),
  ...boardSheets.map((sheet, i) => ({ sheet, marking: boards[i].marking, board: boards[i] })),
])
