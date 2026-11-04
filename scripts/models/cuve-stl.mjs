// Cuve en plastique du nichoir (pièce `solid` de models/nichoir.model.json) écrite en STL binaire (mm), d'un seul bloc à imprimer en 3D.
//   node scripts/models/cuve-stl.mjs [sortie.stl]      (défaut : le dossier Téléchargements)
// Repère d'impression : x, y = plan du plateau, z = hauteur, fond de la cuve à z = 0.
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { solidQuads, solidCells } = await server.ssrLoadModule('/src/models/solid.ts')
const model = JSON.parse(readFileSync(new URL('../../models/nichoir.model.json', import.meta.url), 'utf8'))
const piece = model.panels.find((p) => p.id === 'CU' && p.solid)
if (!piece) throw new Error('aucune pièce solid `CU` dans le modèle : lancer scripts/models/cuve.mjs')
const s = piece.solid
const quads = solidQuads(s)
const yMin = s.y[0]
const toPrinter = ([x, y, z]) => [x, -z, y - yMin]

const buf = Buffer.alloc(84 + quads.length * 2 * 50)
buf.write('cuve nichoir - un seul tenant', 0, 'ascii')
buf.writeUInt32LE(quads.length * 2, 80)
let o = 84
const tri = (n, a, b, c) => {
  const pn = [n[0], -n[2], n[1]]
  ;[pn, toPrinter(a), toPrinter(b), toPrinter(c)].forEach((v, q) => v.forEach((val, k) => buf.writeFloatLE(val, o + (q * 3 + k) * 4)))
  buf.writeUInt16LE(0, o + 48)
  o += 50
}
for (const { a, b, c, d, n } of quads) { tri(n, a, b, c); tri(n, a, c, d) }
const out = process.argv[2] ?? join(homedir(), 'Downloads', 'cuve-nichoir.stl')
writeFileSync(out, buf)

// mesures : plastique, contenance d'eau (cavité reliée au dessous du nid, sans l'intérieur du nid ni le passage de l'entrée)
const { nx, ny, nz, cells } = solidCells(s)
const at = (i, j, k) => (k * ny + j) * nx + i
const dim = (G, i) => G[i + 1] - G[i]
let vol = 0
for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (cells[at(i, j, k)]) vol += dim(s.x, i) * dim(s.y, j) * dim(s.z, k)
const find = (G, v) => G.findIndex((g, n) => n < G.length - 1 && v >= g && v < G[n + 1])
const seen = new Uint8Array(cells.length)
const stack = [[find(s.x, 0), find(s.y, 34.5 - piece.position[1]), find(s.z, 0)]]
let water = 0
while (stack.length) {
  const [i, j, k] = stack.pop()
  if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz || seen[at(i, j, k)] || cells[at(i, j, k)]) continue
  const mx = (s.x[i] + s.x[i + 1]) / 2, my = (s.y[j] + s.y[j + 1]) / 2 + piece.position[1], mz = (s.z[k] + s.z[k + 1]) / 2
  if ((Math.abs(mx) < 63 && Math.abs(mz) < 63 && my > 42) || (Math.abs(mx) < 32.5 && my > 178.5 && mz > 63)) continue // l'intérieur du nid et le passage de l'entrée ne sont pas de l'eau
  seen[at(i, j, k)] = 1
  water += dim(s.x, i) * dim(s.y, j) * dim(s.z, k)
  stack.push([i + 1, j, k], [i - 1, j, k], [i, j + 1, k], [i, j - 1, k], [i, j, k + 1], [i, j, k - 1])
}
const size = [s.x[nx] - s.x[0], s.z[nz] - s.z[0], s.y[ny] - s.y[0]]
console.log(`écrit ${out}`)
console.log(`${quads.length * 2} triangles ; encombrement ${size.map((v) => Math.round(v * 10) / 10).join(' × ')} mm (x × y × hauteur) ; plastique ≈ ${Math.round(vol / 1000)} cm³ ; contenance d'eau ≈ ${Math.round(water / 1000)} cm³ = ${Math.round(water / 1e4) / 100} L`)
await server.close()
