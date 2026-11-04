// Cuve en plastique du nichoir, imprimée en 3D d'un seul bloc (hors découpe) : remplace dans models/nichoir.model.json toutes les plaques `CU` par UNE pièce `solid` (grille de cellules).
//   node scripts/models/cuve.mjs
// Deux cuves emboîtées, reliées par le fond, l'eau entre elles : cuve intérieure (contre le nid) et cuve extérieure, parois de 3 mm, 9 mm d'eau.
//   - fond de 3 mm (y 27–30) sur le plancher de la zone, dessus de 3 mm sous le nid (y 39–42), le nid repose dessus
//   - parois intérieures 63–66, parois extérieures 75–78, de y 30 à y 246 (ouvert en haut : pas de plafond pour le moment)
//   - fenêtres en bas des parois intérieures (y 31,5–37,5) : l'eau passe du côté au compartiment sous le nid
//   - ouverture de 65 mm à l'avant pour le tunnel de l'entrée (à partir de y 178,5), fermée par deux cloisons de côté et par une dalle au bas de l'ouverture (y 175,5–178,5)
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { encodeRuns } = await server.ssrLoadModule('/src/models/solid.ts')
const file = new URL('../../models/nichoir.model.json', import.meta.url)
const raw = readFileSync(file, 'utf8')
const model = JSON.parse(raw)

const W = 3, Y_B = 27, Y_C = 30, Y_T = 39, Y_N = 42, Y_TOP = 246, Y_SPLIT = 178.5, OPEN = 32.5
const IN0 = 63, IN1 = IN0 + W, OUT1 = 78, OUT0 = OUT1 - W
const WIN_Y = [31.5, 37.5], WIN_W = 20, WIN_AT = [-35, 0, 35]
// boîtes [x0, y0, z0, x1, y1, z1]
const solids = [
  [-OUT1, Y_B, -OUT1, OUT1, Y_C, OUT1],                                    // fond
  [-IN0, Y_T, -IN0, IN0, Y_N, IN0],                                        // dessus du compartiment sous le nid
  [-IN1, Y_C, -IN1, -IN0, Y_TOP, IN1], [IN0, Y_C, -IN1, IN1, Y_TOP, IN1],  // parois intérieures gauche / droite
  [-IN0, Y_C, IN0, IN0, Y_TOP, IN1], [-IN0, Y_C, -IN1, IN0, Y_TOP, -IN0],  // avant / arrière
  [-OUT1, Y_C, -OUT1, -OUT0, Y_TOP, OUT1], [OUT0, Y_C, -OUT1, OUT1, Y_TOP, OUT1], // parois extérieures gauche / droite
  [-OUT0, Y_C, OUT0, OUT0, Y_TOP, OUT1], [-OUT0, Y_C, -OUT1, OUT0, Y_TOP, -OUT0], // avant / arrière
  [-(OPEN + W), Y_SPLIT, IN1, -OPEN, Y_TOP, OUT0], [OPEN, Y_SPLIT, IN1, OPEN + W, Y_TOP, OUT0], // cloisons de chaque côté du passage
  [-(OPEN + W), Y_SPLIT - W, IN1, OPEN + W, Y_SPLIT, OUT0],                          // dalle qui ferme l'eau au bas de l'ouverture de l'entrée
]
const voids = [
  [-OPEN, Y_SPLIT, IN0, OPEN, Y_TOP, IN1], [-OPEN, Y_SPLIT, OUT0, OPEN, Y_TOP, OUT1], // passage du tunnel dans les parois avant
]
for (const c of WIN_AT) {
  const h = WIN_W / 2
  voids.push([-IN1, WIN_Y[0], c - h, -IN0, WIN_Y[1], c + h], [IN0, WIN_Y[0], c - h, IN1, WIN_Y[1], c + h]) // gauche / droite
  voids.push([c - h, WIN_Y[0], IN0, c + h, WIN_Y[1], IN1], [c - h, WIN_Y[0], -IN1, c + h, WIN_Y[1], -IN0]) // avant / arrière
}

// grille formée par toutes les arêtes, cellules pleines si le centre est dans une boîte pleine et dans aucun vide
const axes = [0, 1, 2].map((k) => [...new Set([...solids, ...voids].flatMap((b) => [b[k], b[k + 3]]))].sort((a, b) => a - b))
const [GX, GY, GZ] = axes
const nx = GX.length - 1, ny = GY.length - 1, nz = GZ.length - 1
const cells = new Uint8Array(nx * ny * nz)
const inBox = (b, c) => c[0] > b[0] && c[0] < b[3] && c[1] > b[1] && c[1] < b[4] && c[2] > b[2] && c[2] < b[5]
for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const c = [(GX[i] + GX[i + 1]) / 2, (GY[j] + GY[j + 1]) / 2, (GZ[k] + GZ[k + 1]) / 2]
  if (solids.some((b) => inBox(b, c)) && !voids.some((b) => inBox(b, c))) cells[(k * ny + j) * nx + i] = 1
}
// la pièce est centrée sur sa boîte englobante (comme toute planche) : les coordonnées de la grille sont relatives à sa position
const centre = [(GX[0] + GX[nx]) / 2, (GY[0] + GY[ny]) / 2, (GZ[0] + GZ[nz]) / 2]
const rel = (G, c) => G.map((v) => Math.round((v - c) * 1000) / 1000)
const solid = { x: rel(GX, centre[0]), y: rel(GY, centre[1]), z: rel(GZ, centre[2]), runs: encodeRuns(cells) }
const piece = {
  id: 'CU', category: 'Cuve', material: 'plastique', cut: false, thickness: GY[ny] - GY[0],
  outer: [[GX[0], GZ[0]], [GX[nx], GZ[0]], [GX[nx], GZ[nz]], [GX[0], GZ[nz]]].map(([x, z]) => [x - centre[0], z - centre[2]]), // emprise à plat
  holes: [], position: centre, rotation: [-90, 0, 0], solid,
}
model.panels = model.panels.filter((p) => p.id !== 'CU')
model.panels.push(piece)
writeFileSync(file, JSON.stringify(model, null, 1).replace(/\n/g, '\r\n') + (raw.endsWith('\n') ? '\r\n' : ''))
await server.close()
console.log(`cuve : ${nx} × ${ny} × ${nz} cellules, ${solid.runs.length} séries, centre ${centre.join(', ')}`)
