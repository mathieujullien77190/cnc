import type { Pt } from '../../core/types'
import { markSize } from '../../core/marking'
import { circle, plateOutline, windowsFor } from '../helpers'
import { defineModel, type Panel } from '../types'

/** Diamètres des mèches rangées (mm), du plus gros (au fond) au plus petit (devant). */
const DIAMETERS = [10, 9, 8, 7, 6, 5, 4, 3, 2.5]
/** Un lot de trous par matériau, côte à côte. */
const LOTS = ['BOIS', 'METAL', 'BETON']
/** Bois laissé autour du plus gros trou, dans sa case (mm). */
const WOOD = 6
/** Marge entre le tableau et le bord de la plaque (mm) : le nom de la pièce se pose là. */
const PAD = 10
/** Écart entre deux lots de trous (mm). */
const LOT_GAP = 10
/** Marge entre les diamètres gravés et le tableau (mm). */
const DIAM_GAP = 5
/** Hauteur de l'en-tête (BOIS, METAL, BETON) : lettres plus un blanc de 3 mm au-dessus et au-dessous. */
const HEADER = 5.6 + 6
/** Hauteur des lettres gravées au-dessus de chaque lot (mm). */
const LABEL_H = 5.6
/** Hauteur des diamètres gravés à gauche de chaque rangée (mm). */
const DIAM_H = 4.5
/** Écarts de diamètre essayés sur la plaque d'essai (mm) : le trou fait le diamètre de la mèche plus l'écart. */
const TEST_OFFSETS = [0, 0.1, 0.2, -0.1, -0.2]
const offsetText = (o: number) => (o === 0 ? '0' : `${o > 0 ? '+' : '-'}${Math.abs(o)}`)

export default defineModel({
  id: 'range-meches',
  name: 'Étui à mèches',
  description: 'Range-mèches de perceuse de 2,5 à 10 mm en trois lots côte à côte (BOIS, METAL, BETON), plusieurs mèches par diamètre. Boîte fermée : deux plaques percées (haut à ras des flancs, et guidage), un fond, deux flancs et deux parois crantés.',
  params: [
    { key: 'count', label: 'Mèches par diamètre et par lot', type: 'number', default: 3, min: 1, max: 4, step: 1 },
    { key: 'height', label: 'Hauteur', type: 'number', default: 70, min: 30, max: 120, step: 5, unit: 'mm' },
    { key: 'clearance', label: 'Jeu des trous', type: 'number', default: 0.5, min: 0.2, max: 1.5, step: 0.1, unit: 'mm' },
    { key: 'thickness', label: 'Épaisseur', type: 'number', default: 3, min: 2, max: 6, step: 0.5, unit: 'mm' },
    { key: 'test', label: 'Plaque d’essai des trous', type: 'boolean', default: true },
  ],
  build: (p) => {
    const n = p.count as number
    const Hs = p.height as number
    const clr = p.clearance as number
    const t = p.thickness as number

    // Plaque percée : corps W × Dp (entre les flancs et les parois). Tableau régulier gravé : les diamètres à gauche (hors tableau), puis un lot de trous par
    // matériau (nom en en-tête). Toutes les cases ont la même taille (celle du plus gros trou), chaque trou est centré dans sa case, les lignes
    // et colonnes sont tracées.
    const cell = DIAMETERS[0] + clr + WOOD
    const diamW = Math.max(...DIAMETERS.map((d) => markSize(String(d), DIAM_H).w))
    const dcw = diamW + DIAM_GAP
    const lot = n * cell
    const left = PAD
    const gridLeft = left + dcw
    const right = gridLeft + LOTS.length * lot + (LOTS.length - 1) * LOT_GAP
    const top = PAD
    const rowsTop = top + HEADER
    const bottom = rowsTop + DIAMETERS.length * cell
    const W = right + PAD
    const Dp = bottom + PAD
    const holes: Pt[][] = []
    const labels: NonNullable<Panel['labels']> = []
    const rules: NonNullable<Panel['rules']> = []
    // chaque lot est un tableau à part (LOT_GAP entre deux lots) ; les diamètres sont gravés à gauche, à DIAM_GAP du premier
    const lotX = (k: number) => gridLeft + k * (lot + LOT_GAP)
    const rowY = (i: number) => (i < 0 ? top : rowsTop + i * cell)
    for (let i = -1; i <= DIAMETERS.length; i++) {
      rules.push([gridLeft, rowY(i), lotX(0) + lot, rowY(i)])
      for (let k = 1; k < LOTS.length; k++) rules.push([lotX(k), rowY(i), lotX(k) + lot, rowY(i)])
    }
    rules.push([gridLeft, top, gridLeft, bottom])
    LOTS.forEach((name, k) => {
      const x0 = lotX(k)
      rules.push([x0 + lot, top, x0 + lot, bottom])
      if (k) rules.push([x0, top, x0, bottom])
      for (let j = 1; j < n; j++) rules.push([x0 + j * cell, rowsTop, x0 + j * cell, bottom])
      labels.push({ text: name, x: x0 + (lot - markSize(name, LABEL_H).w) / 2, y: top + (HEADER - LABEL_H) / 2, h: LABEL_H })
      DIAMETERS.forEach((d, i) => {
        for (let j = 0; j < n; j++) holes.push(circle(x0 + (j + 0.5) * cell, rowsTop + (i + 0.5) * cell, (d + clr) / 2))
      })
    })
    DIAMETERS.forEach((d, i) => labels.push({ text: String(d), x: left + diamW - markSize(String(d), DIAM_H).w, y: rowsTop + (i + 0.5) * cell - DIAM_H / 2, h: DIAM_H }))

    // Hauteurs (dessus de chaque plaque, depuis le bas) : haut à ras du bord des flancs, guidage au milieu, fond à ras du bas.
    const yTop = Hs
    const yGuide = Math.round(Hs / 2)
    const yBase = t
    const WW = W + 2 * t
    const tongues = { top: { d: t }, bottom: { d: t }, left: { d: t }, right: { d: t } }
    const plate = (id: string, category: string, y: number, drilled: boolean): Panel => ({
      id,
      category,
      thickness: t,
      outer: plateOutline(W, Dp, tongues),
      holes: drilled ? holes : [],
      ...(drilled ? { labels, rules } : {}),
      position: [0, y - t / 2, 0],
      rotation: [-90, 0, 0],
    })
    // Flanc : languettes avant et arrière dans les parois, encoches en haut et en bas pour les plaques de bord, fenêtres pour la plaque de guidage.
    const side = (x: number): Panel => ({
      id: 'F',
      category: 'Flanc',
      thickness: t,
      outer: plateOutline(Dp, Hs, { top: { d: -t }, bottom: { d: -t }, left: { d: t }, right: { d: t } }),
      holes: windowsFor(Dp, t, Hs - yGuide, true),
      position: [x, Hs / 2, 0],
      rotation: [0, -90, 0],
    })
    // Paroi (avant, arrière) : encoches sur les côtés pour les languettes des flancs, encoches en haut et en bas et fenêtres pour les plaques.
    const zone = { a: t, b: t + W }
    const wall = (z: number): Panel => ({
      id: 'A',
      category: 'Paroi',
      thickness: t,
      outer: plateOutline(WW, Hs, { top: { d: -t, ...zone }, bottom: { d: -t, ...zone }, left: { d: -t }, right: { d: -t } }),
      holes: windowsFor(W, t, Hs - yGuide, true, 0, W, t),
      position: [0, Hs / 2, z],
    })

    // Plaque d'essai : un trou par diamètre et par écart (0, +0,1, +0,2, -0,1, -0,2 mm), diamètre exact de la mèche, sans jeu : pour trouver le bon ajustement.
    // petite plaque : 5 mm de bois entre deux trous (colonnes réglées sur le plus gros trou, rangées sur leur propre diamètre)
    const TGAP = 5
    const tcell = DIAMETERS[0] + 0.2 + TGAP
    const rowH = DIAMETERS.map((d) => d + 0.2 + TGAP)
    const tw = TEST_OFFSETS.length * tcell
    const tleft = PAD
    const tgrid = tleft + diamW + DIAM_GAP
    const trows = PAD + DIAM_H + 6
    const TW = tgrid + tw + PAD
    const rowTop = (i: number) => trows + rowH.slice(0, i).reduce((s, h) => s + h, 0)
    const TD = rowTop(DIAMETERS.length) + PAD
    const thead = PAD + 3
    const tHoles: Pt[][] = []
    const tLabels: NonNullable<Panel['labels']> = []
    const tRules: NonNullable<Panel['rules']> = []
    for (let i = -1; i <= DIAMETERS.length; i++) tRules.push([tgrid, i < 0 ? PAD : rowTop(i), tgrid + tw, i < 0 ? PAD : rowTop(i)])
    for (let j = 0; j <= TEST_OFFSETS.length; j++) tRules.push([tgrid + j * tcell, PAD, tgrid + j * tcell, rowTop(DIAMETERS.length)])
    TEST_OFFSETS.forEach((o, j) => {
      const txt = offsetText(o)
      tLabels.push({ text: txt, x: tgrid + (j + 0.5) * tcell - markSize(txt, DIAM_H).w / 2, y: thead, h: DIAM_H })
      DIAMETERS.forEach((d, i) => tHoles.push(circle(tgrid + (j + 0.5) * tcell, rowTop(i) + rowH[i] / 2, (d + o) / 2, 96)))
    })
    DIAMETERS.forEach((d, i) => tLabels.push({ text: String(d), x: tleft + diamW - markSize(String(d), DIAM_H).w, y: rowTop(i) + rowH[i] / 2 - DIAM_H / 2, h: DIAM_H }))
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
      panels: [plate('P', 'Plaque', yTop, true), plate('P', 'Plaque', yGuide, true), plate('S', 'Fond', yBase, false), side(-sideX), side(sideX), wall(-wallZ), wall(wallZ), ...(p.test ? [testPlate] : [])],
      notes: WW > 300 || Dp + 2 * t > 300 ? ['Plaque trop grande pour une planche de 300 mm : réduire le nombre de mèches.'] : [],
    }
  },
})
