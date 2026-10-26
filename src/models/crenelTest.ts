import { parseCutParts } from '../core/format'
import { buildCustomSheet } from '../core/sheets'
import type { Marking, Part, Sheet } from '../core/types'
import { plateOutline } from './helpers'
import { finishPanels, panelsToCutParts } from './toCutParts'
import type { Panel } from './types'

export const CRENEL_TEST_PROJECT = 'essai-crans'

/**
 * Deux mini plaques de 80 × 40 mm pour essayer le crantage avant la vraie coupe : CR-01 porte des languettes sur un grand côté,
 * CR-02 les encoches correspondantes (mêmes crans impairs, serrage de 0,4 mm sur les encoches comme dans testBrick).
 */
export const crenelTestParts = (thickness: number): Part[] => {
  const panel = (outer: Panel['outer']): Panel => ({ id: 'CR', category: 'Essai crans', thickness, outer, position: [0, 0, 0] })
  const panels = [panel(plateOutline(80, 40, { bottom: { d: thickness } })), panel(plateOutline(80, 40, { top: { d: -thickness } }))]
  const { file } = panelsToCutParts(finishPanels(panels), CRENEL_TEST_PROJECT)
  return parseCutParts(JSON.stringify(file)).parts.map((p) => ({ ...p, qty: 0 }))
}

/** Écart au bord et entre les deux plaques de l'essai (mm). */
const TEST_GAP = 3

/**
 * Planche d'essai du crantage, hors projet : rien n'est ajouté au catalogue ni aux planches, elle n'existe que le temps du pilotage de la laser.
 * Les plaques sont empilées dans le coin de l'origine de la machine (bas-gauche), serrées, pour tenir sur une petite chute.
 */
export const crenelTestSheet = (thickness: number, width: number, height: number): { sheet: Sheet; marking: Marking } => {
  const parts = crenelTestParts(thickness)
  let y = height - TEST_GAP
  const overrides: Record<string, { x: number; y: number; rot: boolean }> = {}
  for (const p of parts) {
    y -= p.h
    overrides[`${p.key}#1`] = { x: TEST_GAP, y, rot: false }
    y -= TEST_GAP
  }
  const marking = { names: true, frame: true }
  const sheet = buildCustomSheet({ id: 'essai-crantage', name: 'Essai crantage', thickness, width, height, qty: Object.fromEntries(parts.map((p) => [p.key, 1])), overrides, marking }, parts, TEST_GAP, TEST_GAP)
  return { sheet, marking }
}
