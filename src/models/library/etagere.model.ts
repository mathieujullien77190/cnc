import { rect } from '../helpers'
import { defineModel, type Panel } from '../types'

/** Étagère à tenons : 2 flancs fendus, N tablettes dont les tenons traversent les flancs. */
export default defineModel({
  id: 'etagere',
  name: 'Étagère à tenons',
  description: 'Deux flancs, des tablettes qui s’enfilent dans des fentes.',
  params: [
    { key: 'width', label: 'Largeur hors-tout (planche 300 max)', type: 'number', default: 240, min: 100, max: 280, step: 5, unit: 'mm' },
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
    const inset = 15 // bois gardé autour des fentes et des tenons
    const ys = Array.from({ length: n }, (_, k) => inset + t / 2 + (k * (H - 2 * inset - t)) / (n - 1))
    const slotLen = D - 2 * inset

    // flanc : D × H, fentes à la hauteur de chaque tablette (v vers le bas)
    const side = (x: number): Panel => ({
      id: 'E',
      category: 'Flanc',
      thickness: t,
      outer: rect(0, 0, D, H),
      holes: ys.map((y) => rect(inset, H - y - t / 2, slotLen, t)),
      position: [x, H / 2, 0],
      rotation: [0, -90, 0],
    })

    // tablette : corps entre les flancs + un tenon par flanc
    const bw = W - 2 * t
    const shelf: Panel['outer'] = [[t, 0], [t + bw, 0], [t + bw, inset], [W, inset], [W, D - inset], [t + bw, D - inset], [t + bw, D], [t, D], [t, D - inset], [0, D - inset], [0, inset], [t, inset]]
    const shelves: Panel[] = ys.map((y) => ({ id: 'E', category: 'Tablette', thickness: t, outer: shelf, position: [0, y, 0], rotation: [-90, 0, 0] }))

    const notes = H / (n - 1) < 40 ? ['Tablettes très rapprochées (moins de 40 mm).'] : []
    return { panels: [side(-(W / 2 - t / 2)), side(W / 2 - t / 2), ...shelves], notes }
  },
})
