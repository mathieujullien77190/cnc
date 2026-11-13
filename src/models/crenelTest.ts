import { parseCutParts } from '../core/format'
import { markSize } from '../core/marking'
import { buildCustomSheet } from '../core/sheets'
import type { Marking, Part, Sheet } from '../core/types'
import { finishPanels, panelsToCutParts } from './toCutParts'
import type { Panel } from './types'

export const CRENEL_TEST_PROJECT = 'essai-crans'

/** Bouts d'essai : 20 mm de haut, la largeur donne le nombre de dents (impair, une dent sur deux, bouts droits). */
const SMALL_H = 20
const SMALL_TOOTH = 6
const LABEL_H = 5 // hauteur du texte de configuration gravé sur les encoches d'essai (mm)
const SMALL_EXTRAS = [0.1, 0.2] // variantes de largeur des encoches des petits crans (mm)
const SMALL_W = 30 // cinq crans de 6 mm (comme les coins en L du livre de l'Avent)

/** Dents de 6 mm sur une longueur `len` : même règle que les coins (nombre impair d'au moins 3, une dent sur deux). */
const smallSpans = (len: number): [number, number][] => {
  const n = Math.max(3, 2 * Math.round((len / SMALL_TOOTH - 1) / 2) + 1)
  const sg = len / n
  return Array.from({ length: Math.floor(n / 2) }, (_, i): [number, number] => [(2 * i + 1) * sg, (2 * i + 2) * sg])
}

/** Bout à languettes ou à encoches de profondeur d, aux dents de 6 mm, sur ses deux grands côtés (haut et bas), comme les coins qui s'emboîtent des deux côtés. */
const smallOutline = (tabs: boolean, d: number, extra = 0): [number, number][] => {
  // extra : largeur ajoutée à chaque encoche (mm), avant le serrage de 0,4 mm ; les languettes restent à leur largeur
  const sp = smallSpans(SMALL_W).map(([a, b]): [number, number] => (tabs ? [a, b] : [a - extra / 2, b + extra / 2]))
  const o = tabs ? d : 0 // les languettes dépassent : le corps est décalé pour que tout reste dans y ≥ 0
  const out = tabs ? -d : d // sens des dents sur le côté haut ; le côté bas va à l'opposé
  const top = sp.flatMap(([a, b]): [number, number][] => [[a, o], [a, o + out], [b, o + out], [b, o]])
  const bottom = [...sp].reverse().flatMap(([a, b]): [number, number][] => [[b, o + SMALL_H], [b, o + SMALL_H - out], [a, o + SMALL_H - out], [a, o + SMALL_H]])
  return [[0, o], ...top, [SMALL_W, o], [SMALL_W, o + SMALL_H], ...bottom, [0, o + SMALL_H]]
}

/**
 * Planche d'essai du crantage : des petits bouts plutôt que les grandes plaques, une paire (languettes / encoches) par sorte de crantage du livre.
 * CP-01 / CE-01 : couple à +0,1 mm ; CP-02 / CE-02 : couple à +0,2 mm (largeur ajoutée à chaque encoche, avant le serrage ; la valeur est gravée sur les pièces). Serrage de 0,4 mm sur les encoches comme dans testBrick.
 */
export const crenelTestParts = (thickness: number): Part[] => {
  const panel = (id: string, outer: Panel['outer']): Panel => ({ id, category: 'Essai crans', thickness, outer, position: [0, 0, 0] })
  // deux couples (languettes + encoches) : le couple +0,1 et le couple +0,2 mm de largeur ajoutée à chaque encoche (avant le serrage de 0,4 mm), la valeur gravée sur les deux pièces
  const panels = SMALL_EXTRAS.flatMap((e) => {
    const text = `+${e}`
    const label = (y0: number) => [{ text, x: Math.round((SMALL_W - markSize(text, LABEL_H).w) * 5) / 10, y: y0, h: LABEL_H }]
    return [
      { ...panel('CP', smallOutline(true, thickness)), labels: label(thickness + 6) },
      { ...panel('CE', smallOutline(false, thickness, e)), labels: label(thickness + 3) },
    ]
  })
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
  // toutes les pièces en rangée, alignées sur le bas ; à la fin de la largeur, une nouvelle rangée au-dessus
  const row = parts
  let x = TEST_GAP
  let base = height - TEST_GAP
  let rowH = 0
  for (const p of row) {
    if (x > TEST_GAP && x + p.w > width - TEST_GAP) {
      x = TEST_GAP
      base -= rowH + TEST_GAP
      rowH = 0
    }
    overrides[`${p.key}#1`] = { x, y: base - p.h, rot: false }
    x += p.w + TEST_GAP
    rowH = Math.max(rowH, p.h)
  }
  const marking = { names: true, frame: true }
  const sheet = buildCustomSheet({ id: 'essai-crantage', name: 'Essai crantage', thickness, width, height, qty: Object.fromEntries(parts.map((p) => [p.key, 1])), overrides, marking }, parts, TEST_GAP, TEST_GAP)
  return { sheet, marking }
}
