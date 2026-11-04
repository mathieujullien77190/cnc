import type { Solid } from './types'

/** Cellules d'un solide : indice `(k * ny + j) * nx + i`, 1 = plein. `runs` alterne vides et pleines en commençant par des vides. */
export const solidCells = (s: Solid): { nx: number; ny: number; nz: number; cells: Uint8Array } => {
  const nx = s.x.length - 1, ny = s.y.length - 1, nz = s.z.length - 1
  const cells = new Uint8Array(nx * ny * nz)
  let at = 0
  s.runs.forEach((n, r) => {
    if (r % 2) cells.fill(1, at, at + n)
    at += n
  })
  return { nx, ny, nz, cells }
}

/** Cellules → suite de longueurs (vides, pleines, vides…). */
export const encodeRuns = (cells: Uint8Array): number[] => {
  const runs: number[] = []
  let cur = 0, n = 0
  for (const c of cells) {
    if (c === cur) n++
    else {
      runs.push(n)
      cur = c
      n = 1
    }
  }
  runs.push(n)
  return runs
}

type V3 = [number, number, number]
export interface Quad {
  a: V3
  b: V3
  c: V3
  d: V3
  /** Normale vers l'extérieur du solide. */
  n: V3
}

/** Faces du solide : une par côté de cellule pleine voisin d'une cellule vide (ou du bord), sens trigo vu du dehors. Toutes sont des cellules de la grille : aucune jonction en T. */
export const solidQuads = (s: Solid): Quad[] => {
  const { nx, ny, nz, cells } = solidCells(s)
  const full = (i: number, j: number, k: number) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && cells[(k * ny + j) * nx + i] === 1
  const out: Quad[] = []
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!full(i, j, k)) continue
        const x0 = s.x[i], x1 = s.x[i + 1], y0 = s.y[j], y1 = s.y[j + 1], z0 = s.z[k], z1 = s.z[k + 1]
        if (!full(i - 1, j, k)) out.push({ a: [x0, y0, z0], b: [x0, y0, z1], c: [x0, y1, z1], d: [x0, y1, z0], n: [-1, 0, 0] })
        if (!full(i + 1, j, k)) out.push({ a: [x1, y0, z0], b: [x1, y1, z0], c: [x1, y1, z1], d: [x1, y0, z1], n: [1, 0, 0] })
        if (!full(i, j - 1, k)) out.push({ a: [x0, y0, z0], b: [x1, y0, z0], c: [x1, y0, z1], d: [x0, y0, z1], n: [0, -1, 0] })
        if (!full(i, j + 1, k)) out.push({ a: [x0, y1, z0], b: [x0, y1, z1], c: [x1, y1, z1], d: [x1, y1, z0], n: [0, 1, 0] })
        if (!full(i, j, k - 1)) out.push({ a: [x0, y0, z0], b: [x0, y1, z0], c: [x1, y1, z0], d: [x1, y0, z0], n: [0, 0, -1] })
        if (!full(i, j, k + 1)) out.push({ a: [x0, y0, z1], b: [x1, y0, z1], c: [x1, y1, z1], d: [x0, y1, z1], n: [0, 0, 1] })
      }
  return out
}
