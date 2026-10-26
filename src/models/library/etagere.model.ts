import { plateOutline, rect, windowsFor } from '../helpers'
import { defineModel, type Panel } from '../types'

/**
 * Étagère à crans : 2 flancs fenêtrés, N tablettes dont les languettes (crans impairs, 16 mm visés comme testBrick)
 * entrent dans les fenêtres des flancs. Le serrage de 0,4 mm est ajouté tout seul.
 */
export default defineModel({
  id: 'etagere',
  name: 'Étagère à crans',
  description: 'Deux flancs, des tablettes qui s’enfilent dans des fenêtres (crans de testBrick).',
  params: [
    { key: 'width', label: 'Largeur hors-tout', type: 'number', default: 240, min: 100, max: 280, step: 5, unit: 'mm' },
    { key: 'depth', label: 'Profondeur', type: 'number', default: 120, min: 60, max: 280, step: 5, unit: 'mm' },
    { key: 'height', label: 'Hauteur', type: 'number', default: 200, min: 80, max: 280, step: 5, unit: 'mm' },
    { key: 'shelves', label: 'Tablettes', type: 'number', default: 3, min: 2, max: 8, step: 1 },
    { key: 'thickness', label: 'Épaisseur', type: 'number', default: 3, min: 2, max: 8, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const W = p.width as number
    const D = p.depth as number
    const H = p.height as number
    const n = Math.round(p.shelves as number)
    const t = p.thickness as number
    const inset = 15 // bois gardé entre une fenêtre et le bord du flanc
    const ys = Array.from({ length: n }, (_, k) => inset + t / 2 + (k * (H - 2 * inset - t)) / (n - 1))

    // flanc : D × H, une rangée de fenêtres par tablette, aux crans impairs de la profondeur (v vers le bas)
    const side = (x: number): Panel => ({
      id: 'E',
      category: 'Flanc',
      thickness: t,
      outer: rect(0, 0, D, H),
      holes: ys.flatMap((y) => windowsFor(D, t, H - y - t / 2, true)),
      position: [x, H / 2, 0],
      rotation: [0, -90, 0],
    })

    // tablette : corps entre les flancs, languettes aux mêmes crans impairs sur ses deux côtés
    const bw = W - 2 * t
    const shelf = plateOutline(bw, D, { left: { d: t }, right: { d: t } })
    const shelves: Panel[] = ys.map((y) => ({ id: 'E', category: 'Tablette', thickness: t, outer: shelf, position: [0, y, 0], rotation: [-90, 0, 0] }))

    const notes = H / (n - 1) < 40 ? ['Tablettes très rapprochées (moins de 40 mm).'] : []
    return { panels: [side(-(W / 2 - t / 2)), side(W / 2 - t / 2), ...shelves], notes }
  },
})
