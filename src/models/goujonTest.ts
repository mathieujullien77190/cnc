import { parseCutParts } from '../core/format'
import { buildCustomSheet } from '../core/sheets'
import type { Marking, Part, Sheet } from '../core/types'
import { rect } from './helpers'
import { finishPanels, panelsToCutParts } from './toCutParts'
import type { Panel } from './types'

export const GOUJON_TEST_PROJECT = 'essai-goujons'

/** Largeurs essayées (mm) : de la cote du trou à celle du goujon. */
export const GOUJON_TEST_WIDTHS = [3, 3.1, 3.2, 3.3, 3.4]

/** Trou de la mini planche (mm), le même que celui des plaques du modèle. */
const HOLE = 3
const PLATE = 20
const LENGTH = 9

/**
 * Une mini planche de 20 × 20 mm percée d'un trou de 3 × 3 mm (GT-01) et 5 goujons de 9 mm de long, larges de 3 / 3,1 / 3,2 / 3,3 / 3,4 mm (GJ-01 à GJ-05, dans cet ordre),
 * pour voir quelle largeur rentre dans le trou avant la vraie coupe. On enfonce le bout de chaque goujon dans le trou.
 */
export const goujonTestParts = (thickness: number): Part[] => {
  const plate = rect(0, 0, PLATE, PLATE)
  const hole = rect((PLATE - HOLE) / 2, (PLATE - HOLE) / 2, HOLE, HOLE)
  const panels: Panel[] = [
    { id: 'GT', category: 'Essai goujons', thickness, outer: plate, holes: [hole], position: [0, 0, 0] },
    ...GOUJON_TEST_WIDTHS.map((w): Panel => ({ id: 'GJ', category: 'Essai goujons', thickness, outer: rect(0, 0, w, LENGTH), position: [0, 0, 0] })),
  ]
  const { file } = panelsToCutParts(finishPanels(panels), GOUJON_TEST_PROJECT)
  return parseCutParts(JSON.stringify(file)).parts.map((p) => ({ ...p, qty: 0 }))
}

/** Écart au bord et entre les pièces de l'essai (mm). */
const TEST_GAP = 3

/**
 * Planche d'essai des goujons, hors projet (comme celle du crantage) : rien n'est ajouté au catalogue ni aux planches.
 * La mini planche et les goujons (du plus étroit au plus large, de gauche à droite) sont serrés dans le coin de l'origine de la machine (bas-gauche).
 */
export const goujonTestSheet = (thickness: number, width: number, height: number): { sheet: Sheet; marking: Marking } => {
  const parts = goujonTestParts(thickness)
  const plate = parts.find((p) => p.id.startsWith('GT'))!
  const sticks = parts.filter((p) => p.id.startsWith('GJ')).sort((a, b) => a.w - b.w)
  const overrides: Record<string, { x: number; y: number; rot: boolean }> = {}
  const yPlate = height - TEST_GAP - plate.h
  overrides[`${plate.key}#1`] = { x: TEST_GAP, y: yPlate, rot: false }
  let x = TEST_GAP
  for (const p of sticks) {
    overrides[`${p.key}#1`] = { x, y: yPlate - TEST_GAP - p.h, rot: false }
    x += p.w + TEST_GAP
  }
  const marking = { names: true, frame: true }
  const sheet = buildCustomSheet({ id: 'essai-goujons', name: 'Essai goujons', thickness, width, height, qty: Object.fromEntries(parts.map((p) => [p.key, 1])), overrides, marking }, parts, TEST_GAP, TEST_GAP)
  return { sheet, marking }
}
