// Génère models/wifi-invite.model.json : plaque carrée à coins arrondis de 100 mm : le QR code de la page « Chez Matou » (celui de l’onglet « Page invité » de House, clé comprise), coupé en marqueterie (noir = pièces `L`, îlots de bois = `W`), et « wifi : matoudu77 » dessous en minuscules (police Arial en minuscules, coupée : le texte est évidé).
// Usage : node scripts/models/wifi-invite.mjs <guest-runs.json>. Le fichier est { size, runs: [{ x, y, n }] } : les suites de modules noirs du QR code, ligne par ligne (x, y en modules, n = longueur).
// Le QR contient la clé de la page : ne pas versionner le fichier de suites ni le modèle généré.
import { createServer } from 'vite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Modules noirs du QR : fichier en argument ({ size, runs }), sinon le dernier fichier utilisé (RUNS, hors git), sinon les traits gravés d'un ancien modèle généré.
const [file] = process.argv.slice(2)
const OUT = 'models/wifi-invite.model.json'
const RUNS = 'scripts/models/wifi-invite.runs.json'
const S = 100 // côté de la plaque
const m0 = 1.9 // module du QR (mm)
let source = file ? JSON.parse(readFileSync(file, 'utf8')) : existsSync(RUNS) ? JSON.parse(readFileSync(RUNS, 'utf8')) : null
if (!source) { // ancien modèle : un trait de 6 valeurs (largeur m, pas 0,6) par suite de modules
  const old = JSON.parse(readFileSync(OUT, 'utf8')).panels[0].rules.filter((r) => r.length === 6 && r[5] === 0.6)
  const x0 = Math.min(...old.map((r) => r[0])) - m0 / 2
  const y0 = Math.min(...old.map((r) => r[1])) - m0 / 2
  source = { size: Math.round((S - 2 * x0) / m0), runs: old.map((r) => ({ x: Math.round((r[0] - m0 / 2 - x0) / m0), y: Math.round((r[1] - m0 / 2 - y0) / m0), n: Math.round((r[2] - r[0]) / m0) + 1 })) }
}
writeFileSync(RUNS, JSON.stringify(source))
const { size, runs } = source

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

const R = 8 // rayon des coins
const t = 3
const side = 72 // côté voulu du QR (mm) ; le module ne dépasse pas 1,9 mm
const m = Math.min(m0, +(side / size).toFixed(3))
const qr = size * m
const qx = (S - qr) / 2
const qy = 8
const TEXT_H = 8 // hauteur des capitales du texte (Arial)

const outer = []
const corner = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = ((a0 + (90 * i) / 8) * Math.PI) / 180; outer.push([+(cx + R * Math.cos(a)).toFixed(3), +(cy + R * Math.sin(a)).toFixed(3)]) } }
corner(S - R, R, -90); corner(S - R, S - R, 0); corner(R, S - R, 90); corner(R, R, 180)

// QR code COUPÉ, en marqueterie : chaque zone noire est un trou de la plaque, comblée par une pièce `L` (le noir) ; chaque îlot de bois blanc enfermé dans le noir est une pièce `W` (comme la plaque). Zones de 4 modules voisins par un côté ; aux coins qui se touchent, les pièces restent séparées.
const black = new Set(runs.flatMap(({ x, y, n }) => Array.from({ length: n }, (_, i) => `${x + i},${y}`)))
const isBlack = (c, r) => black.has(`${c},${r}`)
const inGrid = (c, r) => c >= 0 && r >= 0 && c < size && r < size
const colorOf = (c, r) => (inGrid(c, r) && isBlack(c, r) ? 1 : 0) // 1 noir, 0 blanc (la marge autour du QR est blanche)
// composantes par côté commun, marge d'un module autour
const comp = new Map()
let nComp = 0
const compColor = []
for (let r = -1; r <= size; r++) for (let c = -1; c <= size; c++) {
  if (comp.has(`${c},${r}`)) continue
  const col = colorOf(c, r), id = nComp++
  compColor.push(col)
  const stack = [[c, r]]
  comp.set(`${c},${r}`, id)
  while (stack.length) {
    const [x, y] = stack.pop()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < -1 || ny < -1 || nx > size || ny > size || comp.has(`${nx},${ny}`) || colorOf(nx, ny) !== col) continue
      comp.set(`${nx},${ny}`, id)
      stack.push([nx, ny])
    }
  }
}
// arêtes orientées, la cellule à droite (y vers le bas) ; seulement entre deux couleurs différentes
const outgoing = new Map()
const edges = []
const addEdge = (ax, ay, bx, by, owner) => { const e = { ax, ay, bx, by, owner, used: false }; edges.push(e); const key = `${ax},${ay}`; if (!outgoing.has(key)) outgoing.set(key, []); outgoing.get(key).push(e) }
for (let r = -1; r <= size; r++) for (let c = -1; c <= size; c++) {
  const col = colorOf(c, r), owner = comp.get(`${c},${r}`)
  if (r - 1 >= -1 && colorOf(c, r - 1) !== col) addEdge(c, r, c + 1, r, owner)
  if (c + 1 <= size && colorOf(c + 1, r) !== col) addEdge(c + 1, r, c + 1, r + 1, owner)
  if (r + 1 <= size && colorOf(c, r + 1) !== col) addEdge(c + 1, r + 1, c, r + 1, owner)
  if (c - 1 >= -1 && colorOf(c - 1, r) !== col) addEdge(c, r + 1, c, r, owner)
}
// Une boucle qui se touche en un sommet (deux modules en diagonale) est coupée en boucles simples à ce sommet : agrandir un contour qui se touche le ferait se croiser.
const simpleLoops = (loop) => {
  const out = [], stack = []
  for (const q of loop) {
    const i = stack.findIndex((v) => v[0] === q[0] && v[1] === q[1])
    if (i >= 0) { const cyc = stack.splice(i); if (cyc.length >= 3) out.push(cyc) }
    stack.push(q)
  }
  if (stack.length >= 3) out.push(stack)
  return out
}
const loopsOf = new Map() // composante -> boucles (listes de sommets entiers)
for (const e0 of edges) {
  if (e0.used) continue
  const loop = []
  let e = e0
  while (e && !e.used) {
    e.used = true
    loop.push([e.ax, e.ay])
    const [dx, dy] = [e.bx - e.ax, e.by - e.ay]
    const next = (outgoing.get(`${e.bx},${e.by}`) ?? []).filter((q) => !q.used && q.owner === e.owner)
    e = next.find((q) => q.bx - q.ax === -dy && q.by - q.ay === dx) ?? next[0] // au coin qui se touche, tourner à droite : la boucle reste autour de sa propre zone
  }
  if (!loopsOf.has(e0.owner)) loopsOf.set(e0.owner, [])
  loopsOf.get(e0.owner).push(...simpleLoops(loop))
}
const signedArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; a += r[i][0] * r[j][1] - r[j][0] * r[i][1] } return a / 2 }
const gridArea = (l) => { let a = 0; for (let i = 0; i < l.length; i++) { const j = (i + 1) % l.length; a += l[i][0] * l[j][1] - l[j][0] * l[i][1] } return Math.abs(a / 2) }
const straight = (l) => l.filter((p, i) => { const a = l[(i + l.length - 1) % l.length], b = l[(i + 1) % l.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0 }) // sans sommet aligné
const mm = (l) => straight(l).map(([x, y]) => [+(qx + x * m).toFixed(3), +(qy + y * m).toFixed(3)])
const qrPlateHoles = []
const qrPieces = [] // { black, outer, holes }
for (const [id, loops] of loopsOf) {
  if (id === comp.get('-1,-1')) { qrPlateHoles.push(...loops.map(mm)); continue } // la plaque (le blanc de la marge) : toutes ses boucles sont des trous, les contours extérieurs du noir
  // même sens que la plus grande boucle : un contour extérieur (une pièce) ; sens contraire : un trou, rangé dans la plus petite pièce dont l'emprise le contient
  const big = loops.reduce((p, q) => (gridArea(q) > gridArea(p) ? q : p))
  const sg = Math.sign(signedArea(big))
  const lobes = loops.filter((l) => Math.sign(signedArea(l)) === sg).map((l) => ({ l, holes: [] }))
  const box = (l) => [Math.min(...l.map((q) => q[0])), Math.max(...l.map((q) => q[0])), Math.min(...l.map((q) => q[1])), Math.max(...l.map((q) => q[1]))]
  for (const h of loops.filter((l) => Math.sign(signedArea(l)) !== sg)) {
    const hb = box(h)
    const host = lobes.filter(({ l }) => { const lb = box(l); return lb[0] <= hb[0] && lb[1] >= hb[1] && lb[2] <= hb[2] && lb[3] >= hb[3] }).sort((p, q) => gridArea(p.l) - gridArea(q.l))[0]
    host.holes.push(h)
  }
  for (const { l, holes: hs } of lobes) qrPieces.push({ black: compColor[id] === 1, outer: mm(l), holes: hs.map(mm) })
}

// Le texte est COUPÉ : tout l'intérieur de chaque lettre d'Arial (fontArial.ts) est évidé de part en part, un trou par lettre. Le centre du a, d, o (la contre-forme) est évidé aussi, puis ressort comme une petite pièce à part (famille `W`, comme la plaque). Chaque trou est comblé par sa lettre (`L`, avec le trou de sa contre-forme) : aucun pont, tout ce qui a été évidé revient en pièce à coller.
const { ARIAL_GLYPHS, ARIAL_CAP } = await server.ssrLoadModule('/src/core/fontArial.ts')
const label = 'wifi : matoudu77'
const k = TEXT_H / ARIAL_CAP
let pen = 0
const placed = [...label].map((ch) => { const g = ARIAL_GLYPHS[ch] ?? ARIAL_GLYPHS[' ']; const at = pen; pen += g.a; return { g, at } })
const xsAll = placed.flatMap(({ g, at }) => g.c.flatMap((c) => c.filter((_, i) => i % 2 === 0).map((v) => v + at)))
const gx0 = Math.min(0, ...xsAll)
const gx1 = Math.max(pen, ...xsAll)
const textX = (S - (gx1 - gx0) * k) / 2
const baseY = qy + qr + 5 + TEXT_H
const pt = ([px, py]) => [+(textX + (px - gx0) * k).toFixed(3), +(baseY - py * k).toFixed(3)]
const pairs = (c) => Array.from({ length: c.length / 2 }, (_, i) => [c[2 * i], c[2 * i + 1]])
const area = (c) => { let s = 0; for (let i = 0, n = c.length; i < n; i++) { const j = (i + 1) % n; s += c[i][0] * c[j][1] - c[j][0] * c[i][1] } return s / 2 }
const within = (q, c) => { let w = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) if (c[i][1] > q[1] !== c[j][1] > q[1] && q[0] < ((c[j][0] - c[i][0]) * (q[1] - c[i][1])) / (c[j][1] - c[i][1]) + c[i][0]) w = !w; return w }
const holes = []
const centres = []
const letters = [] // pièces qui comblent les trous : la lettre (avec le trou de sa contre-forme) et son centre à part
for (const { g, at } of placed) {
  const rings = g.c.map((c) => pairs(c).map(([x, y]) => [x + at, y]))
  const outers = rings.filter((r) => !rings.some((o) => o !== r && within(r[0], o)))
  for (const o of outers) {
    const ring = o.map(pt)
    holes.push(ring) // toute la lettre est évidée, contre-forme comprise : plus de pont ni de fente
    const counters = rings.filter((r) => r !== o && within(r[0], o)).map((cn) => cn.map(pt))
    letters.push({ outer: ring, holes: counters }) // même tableau que le trou : le lissage plus bas touche les deux
    centres.push(...counters) // le bois du centre (a, d, o) devient une petite pièce à part
  }
}
// Un bout de courbe presque droit entre deux traits droits (le crochet du t) serait pris pour un cran penché par `npm run check` : on le courbe d'un souffle (0,02 mm) avec un point au milieu.
const ax = (a, b) => Math.abs(b[0] - a[0]) < 1e-6 || Math.abs(b[1] - a[1]) < 1e-6
for (const r of holes) {
  for (let i = 0; i < r.length; i++) {
    const [prev, a, b, next] = [r[(i + r.length - 1) % r.length], r[i], r[(i + 1) % r.length], r[(i + 2) % r.length]]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6 && Math.min(Math.abs(dx), Math.abs(dy)) < 1 && ax(prev, a) && ax(b, next)) {
      const l = Math.hypot(dx, dy)
      r.splice(i + 1, 0, [+((a[0] + b[0]) / 2 - (dy / l) * 0.02).toFixed(3), +((a[1] + b[1]) / 2 + (dx / l) * 0.02).toFixed(3)])
      i++
    }
  }
}

const bbox = (r) => { const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] }
const centrePanels = centres.map((r) => { const [cx, cy] = bbox(r); return { id: 'W', category: 'Plaque', thickness: t, outer: r, position: [+(cx - S / 2).toFixed(3), t / 2, +(cy - S / 2).toFixed(3)], rotation: [-90, 0, 0] } })
// Sous la plaque : une plaque pleine de même contour (famille `W`), qui ferme les trous par en dessous.
// Les pièces `L` (le noir) sont agrandies de GROW mm sur tout leur tour : le contour extérieur sort de GROW, le bord de chacun de leurs trous rentre de GROW. Elles chevauchent donc les pièces `W` voisines (collage serré, voulu). Coins à onglet, longueur limitée à 3 GROW.
const GROW = 0.1
const grow = (r, d) => { // d > 0 : le contour s'éloigne de son centre (extérieur) ; d < 0 : il se resserre (trou)
  const sg = Math.sign(signedArea(r)), n = r.length
  return r.map((q, i) => {
    const a = r[(i + n - 1) % n], b = r[(i + 1) % n]
    const norm = (p, c) => { const dx = c[0] - p[0], dy = c[1] - p[1], l = Math.hypot(dx, dy) || 1; return [(dy / l) * sg, (-dx / l) * sg] }
    const n1 = norm(a, q), n2 = norm(q, b)
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]
    const ml = Math.hypot(mx, my)
    if (ml < 1e-9) return [+(q[0] + n1[0] * d).toFixed(3), +(q[1] + n1[1] * d).toFixed(3)]
    mx /= ml; my /= ml
    const len = Math.min(3, 1 / Math.max(mx * n1[0] + my * n1[1], 1e-6)) * d
    return [+(q[0] + mx * len).toFixed(3), +(q[1] + my * len).toFixed(3)]
  })
}
const growL = (outer, holes) => ({ outer: grow(outer, GROW), holes: holes.map((h) => grow(h, -GROW)) })
const lettrePanels = letters.map(({ outer: r, holes: hs }) => { const [cx, cy] = bbox(r); const g = growL(r, hs); return { id: 'L', category: 'Lettre', thickness: t, outer: g.outer, ...(hs.length ? { holes: g.holes } : {}), position: [+(cx - S / 2).toFixed(3), t / 2, +(cy - S / 2).toFixed(3)], rotation: [-90, 0, 0] } })
const qrPanels = qrPieces.map(({ black: b, outer: r, holes: hs }) => { const [cx, cy] = bbox(r); const g = b ? growL(r, hs) : { outer: r, holes: hs }; return { id: b ? 'L' : 'W', category: b ? 'Lettre' : 'Plaque', thickness: t, outer: g.outer, ...(hs.length ? { holes: g.holes } : {}), position: [+(cx - S / 2).toFixed(3), t / 2, +(cy - S / 2).toFixed(3)], rotation: [-90, 0, 0] } })
const panels = [{ id: 'W', category: 'Plaque', thickness: t, outer, holes: [...holes, ...qrPlateHoles], position: [0, t / 2, 0], rotation: [-90, 0, 0] }, { id: 'W', category: 'Plaque', thickness: t, outer, position: [0, -t / 2, 0], rotation: [-90, 0, 0] }, ...lettrePanels, ...centrePanels, ...qrPanels]
writeFileSync('models/wifi-invite.model.json', JSON.stringify({ format: 'cnc-model', version: 1, id: 'wifi-invite', name: 'Wifi invité', description: 'Plaque carrée à coins arrondis : QR code de la page « Chez Matou » et le mot de passe du wifi.', panels }))
console.log({ size, module: m, qr, bottom: +(qy + qr + 5 + TEXT_H * 1.35).toFixed(1) })
await server.close()
