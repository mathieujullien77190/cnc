import { parseCutParts } from '../core/format'
import { buildCustomSheet } from '../core/sheets'
import type { Marking, Part, Sheet } from '../core/types'
import { plateOutline } from './helpers'
import { finishPanels, panelsToCutParts } from './toCutParts'
import type { Panel } from './types'

export const CRENEL_TEST_PROJECT = 'essai-crans'

/** Bouts d'essai : 20 mm de haut, la largeur donne le nombre de dents (impair, une dent sur deux, bouts droits). */
const SMALL_H = 20
const SMALL_TOOTH = 6
const BIG_W = 50 // trois crans de 16 mm environ (comme les grandes plaques)
const SMALL_W = 30 // cinq crans de 6 mm (comme les coins en L du livre de l'Avent)

/** Dents de 6 mm sur une longueur `len` : même règle que les coins (nombre impair d'au moins 3, une dent sur deux). */
const smallSpans = (len: number): [number, number][] => {
  const n = Math.max(3, 2 * Math.round((len / SMALL_TOOTH - 1) / 2) + 1)
  const sg = len / n
  return Array.from({ length: Math.floor(n / 2) }, (_, i): [number, number] => [(2 * i + 1) * sg, (2 * i + 2) * sg])
}

/** Bout à languettes (bas) ou à encoches (haut) de profondeur d, aux dents de 6 mm. */
const smallOutline = (tabs: boolean, d: number): [number, number][] => {
  const sp = smallSpans(SMALL_W)
  if (tabs) return [[0, 0], [SMALL_W, 0], [SMALL_W, SMALL_H], ...[...sp].reverse().flatMap(([a, b]): [number, number][] => [[b, SMALL_H], [b, SMALL_H + d], [a, SMALL_H + d], [a, SMALL_H]]), [0, SMALL_H]]
  return [[0, 0], ...sp.flatMap(([a, b]): [number, number][] => [[a, 0], [a, d], [b, d], [b, 0]]), [SMALL_W, 0], [SMALL_W, SMALL_H], [0, SMALL_H]]
}

/**
 * Planche d'essai du crantage : des petits bouts plutôt que les grandes plaques, une paire (languettes / encoches) par sorte de crantage du livre.
 * CG-01 / CG-02 : grands crans (16 mm environ) ; CP-01 / CP-02 : petits crans de 6 mm (coins). Serrage de 0,4 mm sur les encoches comme dans testBrick.
 */
export const crenelTestParts = (thickness: number): Part[] => {
  const panel = (id: string, outer: Panel['outer']): Panel => ({ id, category: 'Essai crans', thickness, outer, position: [0, 0, 0] })
  const panels = [
    panel('CG', plateOutline(BIG_W, SMALL_H, { bottom: { d: thickness } })),
    panel('CG', plateOutline(BIG_W, SMALL_H, { top: { d: -thickness } })),
    panel('CP', smallOutline(true, thickness)),
    panel('CP', smallOutline(false, thickness)),
  ]
  const { file } = panelsToCutParts(finishPanels(panels), CRENEL_TEST_PROJECT)
  return parseCutParts(JSON.stringify(file)).parts.map((p) => ({ ...p, qty: 0 }))
}

/** Écart au bord et entre les deux plaques de l'essai (mm). */
const TEST_GAP = 3

/**
 * Planche d'essai du crantage, hors projet : rien n'est ajouté au catalogue ni aux planches, elle n'existe que le temps du pilotage laser.
 * Une colonne par sorte de crantage, dans le coin de l'origine de la machine (bas-gauche), serrées, pour tenir sur une petite chute.
 */
export const crenelTestSheet = (thickness: number, width: number, height: number): { sheet: Sheet; marking: Marking } => {
  const parts = crenelTestParts(thickness)
  const overrides: Record<string, { x: number; y: number; rot: boolean }> = {}
  let x = TEST_GAP
  for (const kind of ['CG', 'CP']) {
    const col = parts.filter((p) => p.id.startsWith(kind))
    let y = height - TEST_GAP
    for (const p of col) {
      y -= p.h
      overrides[`${p.key}#1`] = { x, y, rot: false }
      y -= TEST_GAP
    }
    x += Math.max(...col.map((p) => p.w)) + TEST_GAP
  }
  const marking = { names: true, frame: true }
  const sheet = buildCustomSheet({ id: 'essai-crantage', name: 'Essai crantage', thickness, width, height, qty: Object.fromEntries(parts.map((p) => [p.key, 1])), overrides, marking }, parts, TEST_GAP, TEST_GAP)
  return { sheet, marking }
}
