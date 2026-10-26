// Génère examples/exemple.cutparts.json : quelques pièces de formes variées, en deux épaisseurs. `node scripts/make-example.mjs`
import { mkdirSync, writeFileSync } from 'node:fs'

const rect = (w, h, x = 0, y = 0) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const circle = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)].map((v) => Math.round(v * 1000) / 1000))
const ell = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 50], [0, 50]]

const parts = [
  { id: 'CX-01', category: 'Couvre-joint', qty: 6, thickness: 3, outer: rect(56, 50), holes: [rect(3, 20, 10, 15), rect(3, 20, 43, 15)] },
  { id: 'CX-02', category: 'Couvre-joint', qty: 4, thickness: 3, outer: rect(120, 50) },
  { id: 'N-01', category: 'Nervure', qty: 8, thickness: 3, outer: rect(56, 56), holes: [circle(28, 28, 6)] },
  { id: 'N-02', category: 'Nervure', qty: 2, thickness: 3, outer: rect(100, 100), holes: [rect(60, 60, 20, 20)] },
  { id: 'L-01', category: 'Équerre', qty: 3, thickness: 3, outer: ell },
  { id: 'R-01', category: 'Rondelle', qty: 4, thickness: 3, outer: circle(20, 20, 20, 48), holes: [circle(20, 20, 5)] },
  { id: 'F-01', category: 'Fond', qty: 1, thickness: 5, rotate: 'none', outer: rect(196, 196), holes: [circle(98, 98, 25, 48)] },
  { id: 'P-01', category: 'Paroi', qty: 4, thickness: 5, outer: rect(196, 57) },
]

mkdirSync(new URL('../examples/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../examples/exemple.cutparts.json', import.meta.url),
  JSON.stringify({ format: 'cnc-parts', version: 1, project: 'exemple', unit: 'mm', parts }, null, 1),
)
console.log(`${parts.length} pièces écrites`)
