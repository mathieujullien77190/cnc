import type { Pt } from '../../core/types'
import { markSize } from '../../core/marking'
import { plateOutline } from '../helpers'
import { defineModel, type Panel } from '../types'

/** Types d'embouts : un groupe de 16 trous par type, dessin gravé du type devant chaque rangée. */
type Rule = NonNullable<Panel['rules']>[number]
const polygon = (pts: Pt[]): Rule[] => pts.map((p, i): Rule => [p[0], p[1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]])
const around = (n: number, r: (k: number) => number, start = -90): Pt[] => Array.from({ length: n }, (_, k): Pt => [r(k) * Math.cos(((start + (360 * k) / n) * Math.PI) / 180), r(k) * Math.sin(((start + (360 * k) / n) * Math.PI) / 180)])
const R = 4.5
const plus: Rule[] = [[-R, 0, R, 0], [0, -R, 0, R]]
const torx = polygon(around(12, (k) => (k % 2 ? 0.62 * R : R)))

/** Dessin de chaque type, centré en (0, 0), y vers le bas, rayon R. */
const TYPES: { name: string; icon: Rule[] }[] = [
  { name: 'cruciforme PH', icon: plus },
  { name: 'Torx', icon: torx },
  { name: 'Torx troué', icon: [...torx, ...polygon(around(8, () => 1.1))] },
  { name: 'hexagonal', icon: polygon(around(6, () => R)) },
  { name: 'plat', icon: [[-R, 0, R, 0]] },
]
const PER_TYPE = 16
/** Bois laissé entre deux trous voisins (mm). */
const WOOD = 4.5
/** Marge entre le tableau et le bord de la plaque (mm). */
const PAD = 10
/** Écart entre deux groupes (mm). */
const GROUP_GAP = 5
/** Largeur du dessin du type (mm) et marge entre le dessin et le tableau (mm). */
const ICON_W = 2 * R
const ICON_GAP = 5
/** Largeur sur plats d'un embout 1/4" (mm). */
const BIT_FLATS = 6.35
/** Écarts de largeur essayés sur la plaque d'essai (mm) : le trou fait la largeur de l'embout plus l'écart. */
const TEST_OFFSETS = [0, 0.1, 0.2, -0.1, -0.2]
const offsetText = (o: number) => (o === 0 ? '0' : `${o > 0 ? '+' : '-'}${Math.abs(o)}`)
/** Hauteur des écarts gravés (mm) et bois entre deux trous de la plaque d'essai (mm). */
const TEST_H = 3.4
const TEST_GAP = 5

/** Réglages fixes : jeu des trous et épaisseur du bois (mm). */
const CLEARANCE = 0.3
const THICKNESS = 3

export default defineModel({
  id: 'embouts',
  name: 'Étui à embouts',
  description: 'Boîte fermée pour embouts de visseuse 1/4" : 80 trous hexagonaux en 5 groupes de 16 (cruciforme PH, Torx, Torx troué, hexagonal, plat), le type dessiné devant chaque groupe. Trois plaques identiques empilées (9 mm de trou) sur un fond plein (trous borgnes), deux flancs et deux parois bas (12 mm), crantés.',
  params: [],
  build: () => {
    const clr = CLEARANCE
    const t = THICKNESS
    // Les flancs et les parois montent jusqu'au haut des trois plaques : 4 épaisseurs (le fond vert en bas).
    const Hs = 4 * t

    // Plaque percée : corps W × Dp. Un tableau par type (16 cases carrées, le dessin du type à 5 mm à gauche), trou hexagonal centré dans sa case.
    const hexR = (BIT_FLATS + clr) / 2 / Math.cos(Math.PI / 6)
    const cell = Math.ceil((2 * hexR + WOOD) * 10) / 10
    const left = PAD
    const gridLeft = left + ICON_W + ICON_GAP
    const right = gridLeft + PER_TYPE * cell
    const W = right + PAD
    const rowY = (i: number) => PAD + i * (cell + GROUP_GAP)
    const Dp = rowY(TYPES.length - 1) + cell + PAD
    const holes: Pt[][] = []
    const rules: Rule[] = []
    TYPES.forEach(({ icon }, i) => {
      const y0 = rowY(i)
      const cy = y0 + cell / 2
      rules.push([gridLeft, y0, right, y0], [gridLeft, y0 + cell, right, y0 + cell], [gridLeft, y0, gridLeft, y0 + cell])
      for (let j = 0; j < PER_TYPE; j++) {
        const cx = gridLeft + (j + 0.5) * cell
        holes.push(around(6, () => hexR, 0).map(([x, y]): Pt => [cx + x, cy + y]))
        rules.push([gridLeft + (j + 1) * cell, y0, gridLeft + (j + 1) * cell, y0 + cell])
      }
      for (const [x0, y1, x1, y2] of icon) rules.push([left + R + x0, cy + y1, left + R + x1, cy + y2])
    })

    // Trois plaques empilées à ras du haut des flancs (9 mm de trou), le fond (vert) pile en dessous, à ras du bas des flancs : les trous sont borgnes.
    const WW = W + 2 * t
    const tongues = { top: { d: t }, bottom: { d: t }, left: { d: t }, right: { d: t } }
    const plate = (id: string, category: string, y: number, drilled: boolean, engraved: boolean): Panel => ({
      id,
      category,
      thickness: t,
      // le fond est un rectangle sans languettes, calé entre les flancs et les parois
      outer: plateOutline(W, Dp, id === 'S' ? {} : tongues),
      holes: drilled ? holes : [],
      ...(engraved ? { rules } : {}),
      position: [0, y - t / 2, 0],
      rotation: [-90, 0, 0],
    })
    // Flanc : languettes avant et arrière dans les parois, en haut une encoche de 3 épaisseurs pour les trois plaques empilées ; le fond vert est collé entre eux, en dessous.
    const side = (x: number): Panel => ({
      id: 'F',
      category: 'Flanc',
      thickness: t,
      outer: plateOutline(Dp, Hs, { top: { d: -3 * t }, left: { d: t }, right: { d: t } }),
      position: [x, Hs / 2, 0],
      rotation: [0, -90, 0],
      snugDepths: [1, 3],
    })
    const zone = { a: t, b: t + W }
    const wall = (z: number): Panel => ({
      id: 'A',
      category: 'Paroi',
      thickness: t,
      outer: plateOutline(WW, Hs, { top: { d: -3 * t, ...zone }, left: { d: -t }, right: { d: -t } }),
      position: [0, Hs / 2, z],
      snugDepths: [1, 3],
    })

    // Plaque d'essai : un trou hexagonal par écart (0, +0,1, +0,2, -0,1, -0,2 mm), largeur exacte de l'embout, sans jeu : pour trouver le bon ajustement.
    const tcell = 2 * ((BIT_FLATS + 0.2) / 2 / Math.cos(Math.PI / 6)) + TEST_GAP
    const tgrid = PAD
    const trow = PAD + TEST_H + 6
    const TW = tgrid + TEST_OFFSETS.length * tcell + PAD
    const TD = trow + tcell + PAD
    const tLabels: NonNullable<Panel['labels']> = []
    const tRules: NonNullable<Panel['rules']> = [[tgrid, PAD, tgrid + TEST_OFFSETS.length * tcell, PAD], [tgrid, trow, tgrid + TEST_OFFSETS.length * tcell, trow], [tgrid, trow + tcell, tgrid + TEST_OFFSETS.length * tcell, trow + tcell]]
    const tHoles = TEST_OFFSETS.map((o, j) => {
      const cx = tgrid + (j + 0.5) * tcell
      const txt = offsetText(o)
      tLabels.push({ text: txt, x: cx - markSize(txt, TEST_H).w / 2, y: PAD + 3, h: TEST_H })
      return around(6, () => (BIT_FLATS + o) / 2 / Math.cos(Math.PI / 6), 0).map(([x, y]): Pt => [cx + x, trow + tcell / 2 + y])
    })
    for (let j = 0; j <= TEST_OFFSETS.length; j++) tRules.push([tgrid + j * tcell, PAD, tgrid + j * tcell, trow + tcell])
    const testPlate: Panel = {
      id: 'T',
      category: 'Essai',
      thickness: t,
      outer: plateOutline(TW, TD, {}),
      holes: tHoles,
      labels: tLabels,
      rules: tRules,
      position: [WW / 2 + 20 + TW / 2, t / 2, 0],
      rotation: [-90, 0, 0],
    }

    const sideX = W / 2 + t / 2
    const wallZ = Dp / 2 + t / 2
    return {
      panels: [
        plate('P', 'Plaque', Hs, true, true),
        plate('P', 'Plaque', Hs - t, true, false),
        plate('P', 'Plaque', Hs - 2 * t, true, false),
        plate('S', 'Fond', t, false, false),
        side(-sideX),
        side(sideX),
        wall(-wallZ),
        wall(wallZ),
        testPlate,
      ],
      notes: WW > 300 || Dp + 2 * t > 300 ? ['Plaque trop grande pour une planche de 300 mm.'] : [],
    }
  },
})
