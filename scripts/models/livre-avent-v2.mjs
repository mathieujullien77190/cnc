// Livre de l'Avent v2 : repartie de zéro, une étoile à 8 branches en une seule pièce, 28 cm de diamètre (tient sur la planche 300 × 300).
// node scripts/models/livre-avent-v2.mjs [--echelle=1.2] [--sortie=models/autre.model.json]  →  models/livre-avent-v2.model.json
// --echelle agrandit (ou réduit) tout d'un coup : l'étoile, l'octogone du centre, les petites pièces, tout en découle. Épaisseurs, bordures et jeu ne bougent pas.
// (Une action du modèle ne peut pas changer une forme : un autre réglage de taille = un autre fichier, d'où ce paramètre.)
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { markSize, digitStrokes } = await server.ssrLoadModule('/src/core/marking.ts')

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const SCALE = Number(arg('echelle') ?? 1)
if (!(SCALE > 0)) throw new Error('--echelle doit être un nombre > 0')

const t = 3 // épaisseur de l'étoile pleine
const N = 8 // branches
const R = 140 * SCALE // rayon des pointes (140 mm à l'échelle 1)
const HOLLOW = 0.4 // rayon des creux, en part du rayon des pointes (plus petit = creux plus près du centre, branches plus fines)
const STAR_FRAME = 4 // bordure des pièces évidées posées sur chaque pièce de l'étoile
const STAR_STACK = 12 // nombre de ces pièces évidées empilées
const r2 = (v) => Math.round(v * 1000) / 1000 + 0 // 1 µm : l'arrondi ne laisse plus de chevauchement entre pièces voisines (à 0,01 il faisait ~0,01 mm)

// 16 sommets : une pointe puis un creux, tous les 22,5°
const pts = []
for (let k = 0; k < N; k++) {
  const a = ((2 * Math.PI) / N) * k
  pts.push([Math.cos(a) * R, Math.sin(a) * R], [Math.cos(a + Math.PI / N) * R * HOLLOW, Math.sin(a + Math.PI / N) * R * HOLLOW])
}

// contour rentré de `w` mm : chaque côté recule vers l'intérieur, chaque sommet = croisement des deux côtés voisins reculés
const orient = (poly) => poly.reduce((s, [x, z], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * z, 0)
const insetPoly = (poly, w) => {
  const area = orient(poly)
  const lines = poly.map(([x0, z0], i) => {
    const [x1, z1] = poly[(i + 1) % poly.length]
    const l = Math.hypot(x1 - x0, z1 - z0)
    const [dx, dz] = [(x1 - x0) / l, (z1 - z0) / l]
    const n = area > 0 ? [-dz, dx] : [dz, -dx] // normale vers l'intérieur
    const wi = Array.isArray(w) ? w[i] : w // un recul par côté (tableau) ou le même partout
    return { p: [x0 + n[0] * wi, z0 + n[1] * wi], d: [dx, dz] }
  })
  return poly.map((_, i) => {
    const a = lines[(i + poly.length - 1) % poly.length], b = lines[i]
    const det = a.d[0] * b.d[1] - a.d[1] * b.d[0]
    const k = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / det
    return [a.p[0] + a.d[0] * k, a.p[1] + a.d[1] * k]
  })
}

// l'étoile elle-même est retirée : `pts` ne sert plus qu'à placer les pièces dans ses creux
const panels = []

// dans chaque creux, à l'extérieur : une pièce à 4 côtés calée contre les deux côtés du creux (sommet dans le creux H).
// Les 2 côtés collés à l'étoile (longueur a) font la moitié des 2 côtés dans le vide (2a), et le bout touche la droite qui joindrait les deux pointes voisines, sur l'axe du creux.
const LO_FRAME = 2 // bordure des pièces évidées posées sur chaque petite pièce
const LO_STACK = 13 // nombre de ces pièces évidées empilées
const h = R * HOLLOW // rayon du creux
const tx = R * Math.cos(Math.PI / N) - h, tz = R * Math.sin(Math.PI / N) // pointe voisine relativement au creux (u = vers l'extérieur) ; tx = distance du creux à la corde entre deux pointes
const cosf = tx / Math.hypot(tx, tz), sinf = tz / Math.hypot(tx, tz) // direction d'un côté du creux
// |bout - point collé|² = (tx - a·cosf)² + (a·sinf)² = (2a)²  →  3a² + 2·tx·cosf·a - tx² = 0
const a = (tx * (-cosf + Math.sqrt(cosf * cosf + 3))) / 3
const GLUE = a // longueur d'un côté collé à l'étoile
const eu = a * cosf, ev = a * sinf // les deux points collés à l'étoile, relativement à H
const pu = tx // le bout, sur la corde
const rhombus = [[0, ev], [eu, 0], [pu, ev], [eu, 2 * ev]].map(([u, v]) => [r2(u), r2(v)]) // contour local : creux à gauche, bout à droite
const MID = h + pu / 2 // le centre de la pièce, du creux vers l'extérieur
const loHole = insetPoly(rhombus, LO_FRAME).map(([u, v]) => [r2(u), r2(v)]) // le vide des pièces évidées
// LO-03 : la pièce du couvercle qui s'emboîte, la forme du vide, rentrée de PLUG_GAP de chaque côté ; son centre n'est pas celui de la grande pièce, on la décale le long de l'axe
const mid = (poly) => (Math.max(...poly.map((q) => q[0])) + Math.min(...poly.map((q) => q[0]))) / 2
// les pièces cachées par les boutons de l'action (indices dans `panels`)
const loLids = [] // cercle 1 : un couvercle LO = LO-01 du dessus + LO-03 dessous (8 couvercles, 16 pièces)
const e06 = [] // cercle 2 : le couvercle E-06 (losange, recouvre E-04 et E-05) + E-07 dessous
const eTrap = [] // cercle 3 : le couvercle E-04 (triangle centre–coin–coin) + E-03 dessous
const PLUG_FRAME = 5 // bordure des pièces d'emboîtement, évidées au lieu d'être pleines
const hollowPlug = (poly) => insetPoly(poly, PLUG_FRAME).map(([u, v]) => [r2(u), r2(v)])
const PLUG_GAP = 0.2 // jeu entre la LO-03 et le vide, de chaque côté (0 = pile à la taille du vide)
const plug = PLUG_GAP ? insetPoly(loHole, PLUG_GAP).map(([u, v]) => [r2(u), r2(v)]) : loHole
const plugMID = MID + (mid(plug) - mid(rhombus))
const NUM_H = 10 // hauteur de TOUS les numéros gravés (1 à 24), la même partout : donc aussi le même écart entre les lignes
const LO_NUM_H = NUM_H // couvercles LO (1 à 8)
const E04_NUM_H = NUM_H // pièces E-04 (17 à 24)
const E_NUM_H = NUM_H // couvercles E-05 (9 à 16)
// chaque losange (couvercle numéroté) est en 2 pièces : le contour, un cadre de FRAME_INSET mm de large (groupe LN), et la pièce du milieu qui porte le numéro
const FRAME_INSET = 2 // largeur du cadre
// décor gravé : une ligne coudée à chaque coin de la pièce du milieu (4 par losange), à CORNER_D mm du bord, de CORNER_L mm de long de chaque côté (jamais plus de 40 % d'un côté : elles ne se rejoignent pas).
// Chaque ligne est tracée comme les chiffres : 2 lignes parallèles fines (de part et d'autre de l'axe, au même écart que les numéros), le coin en onglet
const CORNER_D = 2.5
const CORNER_L = 8
const CORNER_LINES = 2 // lignes parallèles par ligne de coin
const cornerLines = (poly, only = null) => { // only : les indices des coins à dessiner (tous par défaut)
  const sc = NUM_H / NUM_REF_H // même écart et même épaisseur de ligne que les numéros
  const step = Math.round(NUM_STEP_REF * sc * 1000) / 1000
  const lw = NUM_LINE_W_REF * sc
  const J = insetPoly(poly, CORNER_D)
  const toward = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const t = Math.min(CORNER_L, d * 0.4) / d; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }
  return J.flatMap((q, i) => {
    if (only && !only.includes(i)) return []
    const path = [toward(q, J[(i + J.length - 1) % J.length]), q, toward(q, J[(i + 1) % J.length])]
    return Array.from({ length: CORNER_LINES }, (_, k) => (k - (CORNER_LINES - 1) / 2) * step).flatMap((d) => {
      const line = offsetOpen(path, d, 0)
      return line.slice(0, -1).map((a, k) => [a[0], a[1], line[k + 1][0], line[k + 1][1], lw, 1].map(r2))
    })
  })
}
// le milieu des numéros 1 à 16 est sur la ligne des deux coins larges de la pièce (le sommet n° 1 de son contour : lidIn[1] et lidEIn[1])
// un trait au milieu de chaque angle d'une pièce, le long de la bissectrice, à BISECT_D mm du sommet (distance aux deux côtés), de BISECT_L mm de long, tracé comme les chiffres (2 lignes parallèles fines) ; seulement s'il tient dans du bois plein (à BISECT_MARGIN mm au moins du bord et des vides)
const BISECT_D = 2.5
const BISECT_L = 5
const BISECT_MARGIN = 1.2
const bisectorLines = (poly, holes = []) => {
  const sc = NUM_H / NUM_REF_H
  const step = Math.round(NUM_STEP_REF * sc * 1000) / 1000
  const lw = NUM_LINE_W_REF * sc
  const unit = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / d, (b[1] - a[1]) / d] }
  const distSeg = (q, a, b) => { const d = [b[0] - a[0], b[1] - a[1]]; const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2))); return Math.hypot(q[0] - a[0] - t * d[0], q[1] - a[1] - t * d[1]) }
  const inPoly = (q, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > q[1] !== P[j][1] > q[1] && q[0] < ((P[j][0] - P[i][0]) * (q[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c }
  const edgeDist = (q, P) => Math.min(...P.map((a, i) => distSeg(q, a, P[(i + 1) % P.length])))
  const onWood = (q) => inPoly(q, poly) && edgeDist(q, poly) >= BISECT_MARGIN && holes.every((h) => !inPoly(q, h) && edgeDist(q, h) >= BISECT_MARGIN)
  return poly.flatMap((q, i) => {
    const e1 = unit(q, poly[(i + poly.length - 1) % poly.length]), e2 = unit(q, poly[(i + 1) % poly.length])
    const bis = unit([0, 0], [e1[0] + e2[0], e1[1] + e2[1]])
    const half = Math.acos(Math.max(-1, Math.min(1, e1[0] * e2[0] + e1[1] * e2[1]))) / 2 // demi-angle au sommet
    const start = [q[0] + (bis[0] * BISECT_D) / Math.sin(half), q[1] + (bis[1] * BISECT_D) / Math.sin(half)]
    const end = [start[0] + bis[0] * BISECT_L, start[1] + bis[1] * BISECT_L]
    if (!Array.from({ length: 11 }, (_, k) => [start[0] + ((end[0] - start[0]) * k) / 10, start[1] + ((end[1] - start[1]) * k) / 10]).every(onWood)) return []
    return [step / 2, -step / 2].map((d) => {
      const line = [start, end].map(([x, y]) => [x - bis[1] * d, y + bis[0] * d])
      return [line[0][0], line[0][1], line[1][0], line[1][1], lw, 1].map(r2)
    })
  })
}
const innerOf = (outline, w = FRAME_INSET) => insetPoly(outline, w).map(([u, v]) => [r2(u), r2(v)]) // le bord intérieur du cadre = le contour de la pièce du milieu
// les couvercles LO du dessus : leurs 2 côtés collés à l'étoile (arêtes 0 et 3 du losange) reculent de LID_GAP mm là où ils touchent les couvercles E du même niveau, pour ne pas les forcer
const LID_GAP = 0.2
const lidLO = insetPoly(rhombus, [LID_GAP, 0, 0, LID_GAP]).map(([u, v]) => [r2(u), r2(v)])
// numéro gravé, centré en (cu, cv) du repère de la pièce et tourné de 90° dans le sens trigonométrique (un texte `labels` ne se tourne pas : on trace les chiffres en traits `rules`, à partir des mêmes glyphes que le nom des pièces).
// Repère de la pièce : u à droite, v vers le bas ; vu de face, une rotation trigo envoie un point (dx, dy) sur (dy, -dx).
const NUM_REF_H = 13 // hauteur de référence : un chiffre de 13 mm a ses lignes à 0,3 mm d'écart ; plus petit, l'écart et la largeur du trait diminuent dans la même proportion (toujours 6 lignes)
const NUM_STEP_REF = 0.3 // écart entre deux lignes d'un chiffre de la hauteur de référence
const NUM_LINES = 6 // nombre de lignes dans l'épaisseur d'un trait, le même pour tous les chiffres (donc la même largeur de trait, quelle que soit la taille du chiffre)
const NUM_HALF_REF = ((NUM_LINES - 1) * NUM_STEP_REF) / 2 // demi-largeur du trait : 0,75 mm (les lignes sont à ±0,15, ±0,45, ±0,75 de l'axe)
const NUM_LINE_W_REF = 0.12 // largeur de chaque ligne de contour (une seule passe : le pas est plus grand)
// décalage d'une polyligne ouverte de s mm sur sa gauche, sommets en onglet (intersection des deux côtés décalés) ; les bouts sont rallongés de `ext`
const offsetOpen = (pts, s, ext) => {
  const P = pts.map((q) => [...q])
  const dir = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }
  const d0 = dir(P[0], P[1]), dn = dir(P[P.length - 2], P[P.length - 1])
  P[0] = [P[0][0] - d0[0] * ext, P[0][1] - d0[1] * ext]
  P[P.length - 1] = [P[P.length - 1][0] + dn[0] * ext, P[P.length - 1][1] + dn[1] * ext]
  const segs = P.slice(0, -1).map((a, i) => { const d = dir(a, P[i + 1]); return { p: [a[0] - d[1] * s, a[1] + d[0] * s], d } }) // gauche d'une direction (dx, dy) : (-dy, dx)
  return P.map((q, i) => {
    if (i === 0) return [q[0] - segs[0].d[1] * s, q[1] + segs[0].d[0] * s]
    if (i === P.length - 1) { const d = segs[segs.length - 1].d; return [q[0] - d[1] * s, q[1] + d[0] * s] }
    const a = segs[i - 1], b = segs[i]
    const det = a.d[0] * b.d[1] - a.d[1] * b.d[0]
    if (Math.abs(det) < 1e-6) return [q[0] - a.d[1] * s, q[1] + a.d[0] * s]
    const k = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / det
    return [a.p[0] + a.d[0] * k, a.p[1] + a.d[1] * k]
  })
}
// un numéro = des traits (`rules`) et des ronds (`circles`) : une boucle fermée presque ronde (les 2 ronds du 8, le bas du 6, le haut du 9) devient des cercles concentriques de l'extérieur du trait (rayon + largeur / 2) à l'intérieur (rayon - largeur / 2), un tous les NUM_STEP mm ; les autres traits sont des contours décalés
// cherche des arcs de cercle dans un trait ouvert (le 5, le haut du 6, le 2, le 3, le bas du 9) : la plus longue suite de points qui épouse un cercle (écart < 8 %) devient un arc, le reste reste une polyligne
const circumcircle = (p, q, r) => {
  const d = 2 * (p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1]))
  if (Math.abs(d) < 1e-9) return null
  const ux = ((p[0] ** 2 + p[1] ** 2) * (q[1] - r[1]) + (q[0] ** 2 + q[1] ** 2) * (r[1] - p[1]) + (r[0] ** 2 + r[1] ** 2) * (p[1] - q[1])) / d
  const uy = ((p[0] ** 2 + p[1] ** 2) * (r[0] - q[0]) + (q[0] ** 2 + q[1] ** 2) * (p[0] - r[0]) + (r[0] ** 2 + r[1] ** 2) * (q[0] - p[0])) / d
  return { c: [ux, uy], r: Math.hypot(p[0] - ux, p[1] - uy) }
}
// cercle qui épouse au mieux des points (moindres carrés, méthode de Kåsa) : un demi-ovale un peu allongé (le bol du 5) reste d'un seul arc
const fitCircle = (P) => {
  const n = P.length
  const mx = P.reduce((a, q) => a + q[0], 0) / n, my = P.reduce((a, q) => a + q[1], 0) / n
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0
  for (const q of P) { const u = q[0] - mx, v = q[1] - my; Suu += u * u; Svv += v * v; Suv += u * v; Suuu += u ** 3; Svvv += v ** 3; Suvv += u * v * v; Svuu += v * u * u }
  const det = Suu * Svv - Suv * Suv
  if (Math.abs(det) < 1e-9) return null
  const b1 = 0.5 * (Suuu + Suvv), b2 = 0.5 * (Svvv + Svuu)
  const uc = (b1 * Svv - b2 * Suv) / det, vc = (Suu * b2 - Suv * b1) / det
  return { c: [mx + uc, my + vc], r: Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / n) }
}
const arcFit = (pts, i, j) => {
  const cc = fitCircle(pts.slice(i, j + 1))
  if (!cc || cc.r > 30) return null
  if (pts.slice(i, j + 1).some((q) => Math.abs(Math.hypot(q[0] - cc.c[0], q[1] - cc.c[1]) - cc.r) / cc.r > 0.09)) return null
  // les points d'un arc sont régulièrement espacés : un long segment droit collé à l'arc (la queue du 9, le pied du 2) n'en fait pas partie
  const steps = pts.slice(i, j).map((q, k) => Math.hypot(pts[i + k + 1][0] - q[0], pts[i + k + 1][1] - q[1]))
  if (Math.max(...steps) / Math.min(...steps) > 1.7) return null
  let a = Math.atan2(pts[i][1] - cc.c[1], pts[i][0] - cc.c[0]), sweep = 0
  for (let k = i + 1; k <= j; k++) {
    const b = Math.atan2(pts[k][1] - cc.c[1], pts[k][0] - cc.c[0])
    let da = b - a
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    sweep += da
    a = b
  }
  return { ...cc, a0: Math.atan2(pts[i][1] - cc.c[1], pts[i][0] - cc.c[0]), sweep }
}
const splitRuns = (pts) => {
  const runs = []
  let i = 0, polyStart = 0
  while (i < pts.length - 1) {
    let found = null
    for (let j = pts.length - 1; j >= i + 4; j--) { const f = arcFit(pts, i, j); if (f) { found = { ...f, j }; break } }
    if (found) {
      if (polyStart < i) runs.push({ poly: pts.slice(polyStart, i + 1) })
      runs.push({ arc: found })
      i = found.j
      polyStart = found.j
    } else i++
  }
  if (polyStart < pts.length - 1) runs.push({ poly: pts.slice(polyStart) })
  return runs
}
// les parties d'un segment a→b qui sont hors du disque (centre c, rayon R) : un trait droit s'arrête au plus grand cercle d'un rond au lieu de le traverser
const outsideDisc = (a, b, c, R) => {
  const d = [b[0] - a[0], b[1] - a[1]], f = [a[0] - c[0], a[1] - c[1]]
  const A = d[0] ** 2 + d[1] ** 2, B = 2 * (f[0] * d[0] + f[1] * d[1]), C = f[0] ** 2 + f[1] ** 2 - R * R
  const disc = B * B - 4 * A * C
  const ts = [0, 1]
  if (A > 1e-12 && disc > 0) for (const t of [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)]) if (t > 1e-9 && t < 1 - 1e-9) ts.push(t)
  ts.sort((x, y) => x - y)
  const at = (t) => [a[0] + d[0] * t, a[1] + d[1] * t]
  const out = []
  for (let i = 0; i + 1 < ts.length; i++) {
    const m = at((ts[i] + ts[i + 1]) / 2)
    if (Math.hypot(m[0] - c[0], m[1] - c[1]) >= R - 1e-9) out.push([at(ts[i]), at(ts[i + 1])])
  }
  return out
}
// les parties d'un segment a→b qui sont hors d'un polygone (la bande d'un trait droit)
const outsidePoly = (a, b, poly) => {
  const inPoly = (p) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c } return c }
  const ts = [0, 1]
  const d = [b[0] - a[0], b[1] - a[1]]
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], e = [q[0] - p[0], q[1] - p[1]]
    const den = d[0] * e[1] - d[1] * e[0]
    if (Math.abs(den) < 1e-12) return
    const t = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / den
    const u = ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / den
    if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t)
  })
  ts.sort((x, y) => x - y)
  const at = (t) => [a[0] + d[0] * t, a[1] + d[1] * t]
  const out = []
  for (let i = 0; i + 1 < ts.length; i++) if (ts[i + 1] - ts[i] > 1e-9 && !inPoly(at((ts[i] + ts[i + 1]) / 2))) out.push([at(ts[i]), at(ts[i + 1])])
  return out
}
// la boucle (l'arc) d'un 6 ou d'un 9 a la même taille que son rond : même rayon, même axe ; les points des traits droits qui partaient de l'arc suivent
const equalizeArc = (runs, discs) => {
  const arcs = runs.filter((r) => r.arc)
  if (discs.length !== 1 || arcs.length !== 1) return
  const { c, r, a0, sweep } = arcs[0].arc
  const ring = discs[0]
  const s = ring.rc / r
  const nc = [ring.c[0], c[1]] // même axe vertical que le rond
  const T = (p) => [nc[0] + (p[0] - c[0]) * s, nc[1] + (p[1] - c[1]) * s]
  const ends = [a0, a0 + sweep].map((a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)])
  for (const run of runs) if (run.poly) run.poly = run.poly.map((p) => (ends.some((e) => Math.hypot(p[0] - e[0], p[1] - e[1]) < 0.01) ? T(p) : p))
  arcs[0].arc = { ...arcs[0].arc, c: nc, r: ring.rc }
}
const FLAG_GROW = 1.3 // le petit bout en haut du 1 est 1,3 fois plus long
const ARC_GAP_REF = 0.1 // un arc s'arrête à 0,1 mm d'un trait droit (sans le toucher)
const ARC_EXT = (100 * Math.PI) / 180 // un arc dont un bout touche un trait droit d'un autre trait est prolongé d'autant à ce bout (la bande l'arrête ensuite)
const segDist = (q, A, B) => { const [dx, dy] = [B[0] - A[0], B[1] - A[1]]; const t = Math.max(0, Math.min(1, ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(q[0] - A[0] - t * dx, q[1] - A[1] - t * dy) }
const EXT_END = 0.06 // un trait droit qui finit sur un arc d'un autre trait (le 5) descend de EXT_END × hauteur du chiffre de plus : l'arc arrive dessus
// les traits d'un texte, chiffre par chiffre ; le 6 est le 9 retourné de 180° autour du centre de sa case (même tracé, donc les mêmes réglages : boucle complète, queue qui s'arrête dessus)
const glyphStrokes = (text, h) => {
  const chars = [...text]
  const { w } = markSize(text, h, 'round')
  const gw = markSize(chars[0], h, 'round').w
  const adv = chars.length > 1 ? (w - gw) / (chars.length - 1) : 0 // l'avance d'un chiffre au suivant
  return chars.flatMap((ch, i) => {
    const x = -w / 2 + i * adv
    if (ch === '5') { // le 5 : l'équerre (barre du haut + trait qui descend) est décalée à droite pour que le bas du trait arrive au niveau du début du bol
      const [square, bowl] = digitStrokes('5', x, -h / 2, h, 'round').strokes
      const dx = bowl[0][0] - square[square.length - 1][0]
      return [square.map(([px, py]) => [px + dx, py]), bowl]
    }
    if (ch !== '6') return digitStrokes(ch, x, -h / 2, h, 'round').strokes
    const cx = x + gw / 2
    return digitStrokes('9', x, -h / 2, h, 'round').strokes.map((st) => st.map(([px, py]) => [2 * cx - px, -py]))
  })
}
const numberShapes = (text, cu, cv, h) => {
  const sc = h / NUM_REF_H // les lignes suivent la taille du chiffre : écart, demi-largeur du trait, épaisseur d'une ligne et jeu des arcs
  const NUM_STEP = Math.round(NUM_STEP_REF * sc * 1000) / 1000 // arrondi au µm : l'écart écrit dans le fichier est exactement celui du calcul, donc toujours NUM_LINES lignes
  const NUM_HALF = ((NUM_LINES - 1) * NUM_STEP) / 2
  const NUM_LINE_W = NUM_LINE_W_REF * sc, ARC_GAP = ARC_GAP_REF * sc
  const raw = glyphStrokes(text, h)
  // le petit bout en haut du 1 (le trait de 3 points dont la tige est verticale) est un peu plus grand : FLAG_GROW × sa longueur
  const strokes = raw.map((st) => (st.length === 3 && Math.abs(st[1][0] - st[2][0]) < 1e-6 && Math.abs(st[0][0] - st[1][0]) > 1e-6 ? [[st[1][0] + (st[0][0] - st[1][0]) * FLAG_GROW, st[1][1] + (st[0][1] - st[1][1]) * FLAG_GROW], st[1], st[2]] : st))
  // on centre l'encre réelle du numéro (l'étendue de ses traits, plus la demi-largeur du trait), pas la boîte du texte et ses marges : un 1 ou un 7 est bien au centre comme un 8
  const allPts = strokes.flat()
  const inkX = (Math.max(...allPts.map((q) => q[0])) + Math.min(...allPts.map((q) => q[0]))) / 2
  const inkY = (Math.max(...allPts.map((q) => q[1])) + Math.min(...allPts.map((q) => q[1]))) / 2
  const turn = ([x, y]) => [cu + (y - inkY), cv - (x - inkX)] // 90° dans le sens trigonométrique, autour du centre de l'encre
  const deg = (rad) => (rad * 180) / Math.PI - 90 // angle dans le repère de la pièce (rotation de 90° trigo : angle - 90°)
  const rules = [], circles = []
  const edges = (poly) => poly.forEach((q, i) => { const n = poly[(i + 1) % poly.length]; rules.push([...turn(q), ...turn(n), NUM_LINE_W, 1].map(r2)) })
  const emit = (parts) => { for (const [x, y] of parts) rules.push([...turn(x), ...turn(y), NUM_LINE_W, 1].map(r2)) }
  const isClosed = (st) => Math.hypot(st[0][0] - st[st.length - 1][0], st[0][1] - st[st.length - 1][1]) < 1e-6
  const fitRing = (st) => {
    const ring = st.slice(0, -1)
    const c = [ring.reduce((a, q) => a + q[0], 0) / ring.length, ring.reduce((a, q) => a + q[1], 0) / ring.length]
    const dist = ring.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]))
    const rc = dist.reduce((a, b) => a + b, 0) / dist.length
    return { ring, c, rc, round: Math.max(...dist.map((d) => Math.abs(d - rc))) / rc < 0.12 }
  }
  // les ronds de ce chiffre (boucles fermées presque rondes) : leur plus grand cercle (rayon + NUM_HALF) arrête les traits droits qui les touchent
  const discs = strokes.filter(isClosed).map(fitRing).filter((f) => f.round).map((f) => ({ c: f.c, rc: f.rc, R: f.rc + NUM_HALF }))
  const polys = [], curves = [] // les traits droits, et les ronds et arcs, dans l'ordre du tracé
  strokes.forEach((st, si) => {
    if (isClosed(st)) {
      const f = fitRing(st)
      if (f.round) { // presque un rond : de vrais cercles (tracés plus bas, après les arcs et les traits droits)
        curves.push({ c: f.c, r: f.rc, a0: 0, sweep: 2 * Math.PI, si, full: true })
        return
      }
      const xs = f.ring.map((q) => q[0]), ys = f.ring.map((q) => q[1])
      const c = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]
      const rx = (Math.max(...xs) - Math.min(...xs)) / 2, ry = (Math.max(...ys) - Math.min(...ys)) / 2
      if (Math.max(...f.ring.map((q) => Math.abs(Math.hypot((q[0] - c[0]) / rx, (q[1] - c[1]) / ry) - 1))) < 0.08) { // un ovale (le 0) : dans le repère de la pièce (tournée de 90°), le rayon du glyphe en y devient le rayon en u
        circles.push([...turn(c), rx + NUM_HALF, NUM_STEP, Math.max(rx - NUM_HALF - 0.004, 0.1), 0, 360, ry - rx].map(r2))
        return
      }
      for (let d = NUM_HALF; d >= 0.06 * sc; d -= NUM_STEP) { edges(insetPoly(f.ring, -d)); edges(insetPoly(f.ring, d)) }
      return
    }
    const runs = splitRuns(st)
    equalizeArc(runs, discs)
    for (const run of runs) {
      if (run.arc) curves.push({ ...run.arc, si, full: false })
      else polys.push({ pts: run.poly, si })
    }
  })
  // un trait droit qui finit tout près du départ d'un arc d'un autre trait (le trait qui descend du 5) descend un peu plus : l'arc arrive dessus
  for (const p of polys) {
    const L = p.pts[p.pts.length - 1], Q = p.pts[p.pts.length - 2]
    const near = curves.filter((a) => !a.full).some((a) => a.si !== p.si && [a.a0, a.a0 + a.sweep].some((t) => Math.hypot(a.c[0] + a.r * Math.cos(t) - L[0], a.c[1] + a.r * Math.sin(t) - L[1]) < 0.12 * h))
    if (near) { const len = Math.hypot(L[0] - Q[0], L[1] - Q[1]); p.pts = [...p.pts.slice(0, -1), [L[0] + ((L[0] - Q[0]) / len) * EXT_END * h, L[1] + ((L[1] - Q[1]) / len) * EXT_END * h]] }
  }
  const band = (pts) => [...offsetOpen(pts, NUM_HALF, 0), ...offsetOpen(pts, -NUM_HALF, 0).reverse()] // la bande (±NUM_HALF) d'un trait droit, bouts plats
  const bands = polys.map((p) => band(p.pts))
  const bandsGap = polys.map((p) => [...offsetOpen(p.pts, NUM_HALF + ARC_GAP, ARC_GAP), ...offsetOpen(p.pts, -NUM_HALF - ARC_GAP, ARC_GAP).reverse()]) // la même bande, plus large de ARC_GAP de chaque côté et aux bouts
  // les traits droits : NUM_LINES lignes parallèles (±0,15, ±0,45, ±0,75 de l'axe), ouvertes, sans bouts ; un trait s'arrête à la bande des traits suivants et au plus grand cercle d'un rond
  polys.forEach((p, idx) => {
    for (let d = NUM_HALF; d >= -NUM_HALF - 1e-6; d -= NUM_STEP) {
      const line = offsetOpen(p.pts, d, 0)
      line.slice(0, -1).forEach((q, k) => {
        let parts = [[q, line[k + 1]]]
        for (const { c, R } of discs) parts = parts.flatMap(([x, y]) => outsideDisc(x, y, c, R))
        for (const b of bands.slice(idx + 1)) parts = parts.flatMap(([x, y]) => outsidePoly(x, y, b))
        // dans un même tracé qui se recroise (la barre du 4 sur sa tige) : la ligne d'un segment s'arrête à la bande des segments suivants qui ne le touchent pas ; les coins (haut et gauche du 4) restent d'un seul tenant, en onglet
        for (let jj = k + 2; jj + 1 < p.pts.length; jj++) parts = parts.flatMap(([x, y]) => outsidePoly(x, y, band([p.pts[jj], p.pts[jj + 1]])))
        emit(parts)
      })
    }
  })
  // les ronds et les arcs : de vrais cercles (primitive `circles`). Un rond ou un arc ne coupe jamais un autre mais le touche : chacun de ses cercles s'arrête exactement à la bande d'un trait droit d'un autre trait (le 5) ou au plus grand cercle d'un rond ou d'un arc qui le suit (le 3, le 8), à son propre angle ; il reste un arc
  const RADII = Array.from({ length: NUM_LINES }, (_, k) => NUM_HALF - k * NUM_STEP) // les 6 rayons de l'épaisseur du trait, autour de l'axe
  curves.forEach((cv_, idx) => {
    // priorités : un rond complet n'est arrêté que par un rond qui le suit (le 8) ; un arc l'est par la bande d'un trait droit d'un autre trait (le 5), par le grand cercle de tout rond (la queue du 9 s'arrête sur sa boucle) et par celui d'un arc qui le suit (le 3)
    const doms = [
      ...(cv_.full ? [] : polys.flatMap((p, k) => (p.si === cv_.si ? [] : [{ band: bandsGap[k] }]))), // un arc s'arrête à ARC_GAP d'un trait droit (il ne le touche pas)
      ...curves.filter((b, k) => b.si !== cv_.si && (cv_.full ? k > idx && b.full : b.full || k > idx)).map((b) => ({ disc: { c: b.c, R: b.r + NUM_HALF } })),
    ]
    // un arc dont un bout est tout près d'un trait droit d'un autre trait (le bol du 5 contre le trait qui descend) est prolongé de ARC_EXT à ce bout : ses cercles intérieurs, qui s'arrêtaient avant, vont aussi contre le trait ; la bande l'arrête ensuite, pile
    const sgn = Math.sign(cv_.sweep) || 1
    const nearPoly = (q) => polys.some((p) => p.si !== cv_.si && p.pts.slice(0, -1).some((a, k) => segDist(q, a, p.pts[k + 1]) < 0.2 * h))
    const endPt = (a) => [cv_.c[0] + cv_.r * Math.cos(a), cv_.c[1] + cv_.r * Math.sin(a)]
    const ext0 = !cv_.full && nearPoly(endPt(cv_.a0)), ext1 = !cv_.full && nearPoly(endPt(cv_.a0 + cv_.sweep))
    const a0c = cv_.a0 - (ext0 ? sgn * ARC_EXT : 0)
    const sweepc = cv_.sweep + (ext0 ? sgn * ARC_EXT : 0) + (ext1 ? sgn * ARC_EXT : 0)
    const extended = ext0 || ext1
    const N = Math.max(16, Math.ceil((Math.abs(sweepc) * 180) / Math.PI / 0.05)) // un point tous les 0,05°
    const ang = (k) => a0c + (sweepc * k) / N
    // un point est libre s'il n'est pas à l'intérieur de la bande ou du disque d'un autre (sur le bord : libre, il touche)
    const free = (rho, k) => {
      const q = [cv_.c[0] + rho * Math.cos(ang(k)), cv_.c[1] + rho * Math.sin(ang(k))]
      return !doms.some((d) => (d.band ? outsidePoly(q, [q[0] + 1e-4, q[1]], d.band).length === 0 : Math.hypot(q[0] - d.disc.c[0], q[1] - d.disc.c[1]) < d.disc.R - 1e-9))
    }
    const okAll = Array.from({ length: N + 1 }, (_, k) => RADII.every((dr) => free(cv_.r + dr, k)))
    if (okAll.every(Boolean) && !extended) { // rien ne le touche : le rond ou l'arc entier, tous ses cercles d'un coup
      circles.push(cv_.full ? [...turn(cv_.c), cv_.r + NUM_HALF, NUM_STEP, Math.max(cv_.r - NUM_HALF - 0.004, 0.1)].map(r2) : [...turn(cv_.c), cv_.r + NUM_HALF, NUM_STEP, Math.max(cv_.r - NUM_HALF - 0.004, 0.1), deg(ang(0)), deg(ang(N))].map(r2))
      return
    }
    const midK = Math.round(N / 2) // le milieu de l'arc : le morceau qui le contient est le bon (le prolongement ne doit pas ressortir de l'autre côté du trait)
    for (const dr of RADII) { // un cercle à la fois, à son propre angle d'arrêt
      const rho = cv_.r + dr
      const ok = Array.from({ length: N + 1 }, (_, k) => free(rho, k))
      const len = cv_.full ? N : N + 1 // un rond : N points distincts (le dernier est le premier)
      const first = cv_.full ? ok.findIndex((v) => !v) : 0
      let run = null
      const runs = []
      for (let m = 0; m < len; m++) {
        const k = (first + m) % len
        if (ok[k]) { if (!run) run = { k0: m, k1: m }; else run.k1 = m } else if (run) { runs.push(run); run = null }
      }
      if (run) runs.push(run)
      for (const r of runs) if (r.k1 - r.k0 >= 100 && (!extended || (r.k0 <= midK && midK <= r.k1))) { // moins de 5° : on l'oublie
        // un cercle prolongé qui n'a trouvé aucune bande jusqu'au bout du prolongement ne l'atteint pas : il garde l'arc d'origine
        const extN = Math.round((N * ARC_EXT) / Math.abs(sweepc))
        const kStart = ext0 && r.k0 === 0 ? extN : r.k0
        const kEnd = ext1 && r.k1 >= N ? N - extN : r.k1
        circles.push([...turn(cv_.c), rho, NUM_STEP, rho - 0.004, deg(a0c + (sweepc * (first + kStart)) / N), deg(a0c + (sweepc * (first + kEnd)) / N)].map(r2))
      }
    }
  })
  return { rules, circles }
}
// les gravures d'une pièce : le numéro (traits + ronds) et des traits en plus (le liseré) ; `circles` n'est présent que s'il y en a
const engrave = (text, cu, cv, h, extra = []) => {
  const { rules, circles } = numberShapes(text, cu, cv, h)
  // l'encre finale (traits, cercles et arcs) est recentrée sur (cu, cv) : les chiffres sont alignés quelle que soit leur forme
  const xs = [], ys = []
  for (const r of rules) { xs.push(r[0], r[2]); ys.push(r[1], r[3]) }
  for (const [cx, cy, r, , rMin, a0, a1, du = 0] of circles) {
    const full = a0 === undefined || Math.abs(a1 - a0) >= 359.99
    const steps = full ? 72 : Math.max(2, Math.ceil(Math.abs(a1 - a0) / 2))
    for (let k = 0; k <= steps; k++) for (const rad of [r, rMin ?? r]) {
      const a = ((full ? (360 * k) / steps : a0 + ((a1 - a0) * k) / steps) * Math.PI) / 180
      xs.push(cx + (rad + du) * Math.cos(a))
      ys.push(cy + rad * Math.sin(a))
    }
  }
  // dans le sens de la largeur de la pièce (v), un chiffre qui contient un 4 est centré sur le centre de masse de ses lignes : la barre du 4 dépasse de sa tige, la boîte seule le décalait de ~0,9 mm
  let centerV = (Math.min(...ys) + Math.max(...ys)) / 2
  if (text.includes('4') && rules.length) {
    const len = (r) => Math.hypot(r[2] - r[0], r[3] - r[1])
    const total = rules.reduce((a, r) => a + len(r), 0)
    centerV = rules.reduce((a, r) => a + (len(r) * (r[1] + r[3])) / 2, 0) / total
  }
  const dx = cu - (Math.min(...xs) + Math.max(...xs)) / 2, dy = cv - centerV
  const sh = (v, d) => r2(v + d)
  const moved = rules.map(([x0, y0, x1, y1, ...rest]) => [sh(x0, dx), sh(y0, dy), sh(x1, dx), sh(y1, dy), ...rest])
  const movedCircles = circles.map(([cx, cy, ...rest]) => [sh(cx, dx), sh(cy, dy), ...rest])
  return { rules: [...moved, ...extra], ...(movedCircles.length ? { circles: movedCircles } : {}) }
}
for (let k = 0; k < N; k++) {
  const deg = (360 / N) * k + 180 / N
  const a = (deg * Math.PI) / 180
  const lo = (radius, level, extra) => ({ id: 'LO', category: 'Losange', thickness: t, ...extra, position: [r2(Math.cos(a) * radius), t / 2 + level * t, r2(Math.sin(a) * radius)], rotation: [-90, 0, r2(-deg)] })
  panels.push(lo(MID, 0, { outer: rhombus })) // le fond
  // par-dessus : LO_STACK fois la même pièce, évidée (bordure de LO_FRAME mm)
  for (let l = 1; l <= LO_STACK; l++) panels.push(lo(MID, l, { outer: rhombus, holes: [loHole] }))
  loLids.push(panels.length)
  panels.push(lo(plugMID, LO_STACK, { outer: plug, holes: [hollowPlug(plug)] })) // la pièce LO-03, dans le vide de la dernière couche évidée
  const lidIn = innerOf(lidLO)
  loLids.push(panels.length)
  panels.push(lo(MID + (mid(lidLO) - mid(rhombus)), LO_STACK + 1, { id: 'LN', category: 'Numéroté', outer: lidLO, holes: [lidIn] })) // le contour du couvercle : un cadre, groupe LN
  loLids.push(panels.length)
  panels.push(lo(MID + (mid(lidIn) - mid(rhombus)), LO_STACK + 1, { outer: lidIn, ...engrave(String(k + 1), lidIn[1][0], ev, LO_NUM_H, cornerLines(lidIn)) })) // la pièce du milieu, qui porte le numéro (1 à 8)
}

// l'étoile de 28 cm (même forme qu'avant : pointes à R, creux à R × HOLLOW) en N pièces identiques : chacune va du centre O à une pointe T en passant par les deux creux voisins H1 / H2
const starV = R * HOLLOW * Math.sin(Math.PI / N) // demi-largeur de la pièce, au niveau des creux
const starU = R * HOLLOW * Math.cos(Math.PI / N) // position des creux le long de l'axe
const piece = [[0, starV], [starU, 0], [R, starV], [starU, 2 * starV]].map(([u, v]) => [r2(u), r2(v)])
// le vide d'une pièce évidée (contour reculé de STAR_FRAME) : la nervure de STAR_FRAME mm, à mi-chemin entre le centre de l'étoile (u = 0) et l'endroit le plus large du vide, devient la paroi côté centre.
// Les pièces n'ont plus leur bout côté centre (les pleines comme les évidées) : leurs 8 bouts coupés dessinent un octogone vide au milieu de l'étoile, sur toute la hauteur.
const hole = insetPoly(piece, STAR_FRAME) // [creux côté centre, côté, pointe, côté]
const at = (p, q, u) => [u, p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0])] // point du segment p–q à l'abscisse u
const cut = hole[1][0] / 2 // abscisse de la nervure
const rib = STAR_FRAME / 2
const u0 = cut - rib // distance du centre à la coupe
const topPiece = [at(piece[0], piece[1], u0), piece[1], piece[2], piece[3], at(piece[0], piece[3], u0)].map(([u, v]) => [r2(u), r2(v)])
const bigHole = [at(hole[0], hole[1], cut + rib), hole[1], hole[2], hole[3], at(hole[0], hole[3], cut + rib)] // le vide d'une seule pièce, du côté de la paroi centrale à la pointe
// ce vide est coupé en deux par une nervure de STAR_FRAME mm au niveau de son coin (SPLIT) : un compartiment vers la pointe (un triangle), l'autre vers le centre (un trapèze)
const SPLIT = hole[1][0] // au niveau du coin du vide (là où il est le plus large)
const clipU = (poly, x, keepAbove) => {
  const inside = ([u]) => (keepAbove ? u >= x - 1e-9 : u <= x + 1e-9)
  const out = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    if (inside(p)) out.push(p)
    if (inside(p) !== inside(q)) out.push([x, p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0])])
  })
  return out
}
const topHoles = [clipU(bigHole, SPLIT - rib, false), clipU(bigHole, SPLIT + rib, true)].map((poly) => poly.map(([u, v]) => [r2(u), r2(v)])) // [vers le centre, vers la pointe]
const topMid = (u0 + R) / 2 // le centre de la pièce coupée, du centre de l'étoile vers la pointe

const trapPlug = insetPoly(topHoles[0], PLUG_GAP).map(([u, v]) => [r2(u), r2(v)]) // le trapèze rentré du jeu
// les couvercles E du dessus : leurs 2 côtés qui partent du centre (arêtes 0 et 3 de `piece`) reculent de LID_E_SIDE mm là où ils touchent le couvercle voisin (0,2 mm de jeu entre deux voisins)
const LID_E_SIDE = 0.1
const lidE = insetPoly(piece, [LID_E_SIDE, 0, 0, LID_E_SIDE]).map(([u, v]) => [r2(u), r2(v)])
const triPlug = insetPoly(topHoles[1], PLUG_GAP).map(([u, v]) => [r2(u), r2(v)]) // la pièce qui s'emboîte dans le vide de E-05 (même vide que celui des E-02)
const triHole = topHoles[1] // le vide de E-05 = le vide triangulaire des E-02 en dessous (la cavité continue, la paroi n'y dépasse pas) ; côté coin la bordure est plus fine que STAR_FRAME

for (let k = 0; k < N; k++) {
  const deg = (360 / N) * k // une pointe sur chaque axe de 45°
  const a = (deg * Math.PI) / 180
  panels.push({ id: 'E', category: 'Etoile', thickness: t, outer: topPiece, position: [r2(Math.cos(a) * topMid), t / 2, r2(Math.sin(a) * topMid)], rotation: [-90, 0, r2(-deg)] })
  // par-dessus : STAR_STACK fois la même pièce, évidée (bordure de STAR_FRAME mm)
  for (let l = 1; l <= STAR_STACK; l++)
    panels.push({ id: 'E', category: 'Etoile', thickness: t, outer: topPiece, holes: topHoles, position: [r2(Math.cos(a) * topMid), t / 2 + l * t, r2(Math.sin(a) * topMid)], rotation: [-90, 0, r2(-deg)] })
  // un couvercle juste sur le trapèze (le compartiment côté centre) : sa pièce qui s'emboîte dans le vide de la dernière couche (PLUG_GAP de jeu) et, par-dessus, une plaque qui déborde du trapèze de STAR_FRAME mm sans toucher le triangle
  const onAxis = (outer, level) => ({ id: 'E', category: 'Etoile', thickness: t, outer, position: [r2(Math.cos(a) * mid(outer)), t / 2 + level * t, r2(Math.sin(a) * mid(outer))], rotation: [-90, 0, r2(-deg)] })
  eTrap.push(panels.length)
  panels.push({ ...onAxis(trapPlug, STAR_STACK), holes: [hollowPlug(trapPlug)] }) // E-03 : monte avec E-04
  // les pièces 17 à 24 sont en 2 pièces comme les couvercles : le cadre qui fait tout le tour du losange (groupe LN) et la pièce du milieu, avec le vide triangulaire et le numéro
  const pieceIn = innerOf(piece)
  eTrap.push(panels.length)
  panels.push({ ...onAxis(piece, STAR_STACK + 1), id: 'LN', category: 'Numéroté', holes: [pieceIn] })
  eTrap.push(panels.length)
  panels.push({ ...onAxis(pieceIn, STAR_STACK + 1), holes: [triHole], ...engrave(String(2 * N + k + 1), 33, starV, E04_NUM_H, bisectorLines(pieceIn, [triHole])) })
  // un couvercle sur E-05 et E-04, avec dessous la pièce qui s'emboîte dans son vide (PLUG_GAP de jeu, évidée avec PLUG_FRAME de bordure), même principe que les autres
  const lidEIn = innerOf(lidE)
  e06.push(panels.length)
  panels.push({ ...onAxis(lidE, STAR_STACK + 2), id: 'LN', category: 'Numéroté', holes: [lidEIn] }) // le contour du couvercle E : un cadre, groupe LN
  e06.push(panels.length)
  panels.push({ ...onAxis(lidEIn, STAR_STACK + 2), ...engrave(String(N + k + 1), lidEIn[1][0], starV, E_NUM_H, cornerLines(lidEIn)) }) // la pièce du milieu, qui porte le numéro (9 à 16)
  e06.push(panels.length)
  panels.push({ ...onAxis(triPlug, STAR_STACK + 1), holes: [hollowPlug(triPlug)] })
}

// au centre : un octogone qui s'emboîte exactement dans le vide laissé par les 8 pièces (côtés à u0 du centre, face à chaque pièce), monté comme les autres (une pièce pleine puis OCT_STACK évidées, bordure OCT_FRAME), la dernière couche ayant le contour plein de l'octogone et un trou octogonal au milieu (FINGER_HOLE) pour y passer l'index
const OCT_FRAME = 4
const OCT_STACK = 13
const octR = u0 / Math.cos(Math.PI / N) // rayon des sommets : les côtés sont à u0, perpendiculaires aux axes des pièces
const octPts = Array.from({ length: N }, (_, k) => [octR * Math.cos(Math.PI / N + (2 * Math.PI * k) / N), octR * Math.sin(Math.PI / N + (2 * Math.PI * k) / N)])
const octOf = (poly) => poly.map(([x, z]) => [r2(octR + x), r2(octR + z)])
const octOuter = octOf(octPts)
const octHole = octOf(insetPoly(octPts, OCT_FRAME))
const octLevel = (l, extra) => ({ id: 'O', category: 'Octogone', thickness: t, ...extra, position: [0, t / 2 + l * t, 0], rotation: [-90, 0, 0] })
panels.push(octLevel(0, { outer: octOuter })) // le fond
for (let l = 1; l < OCT_STACK; l++) panels.push(octLevel(l, { outer: octOuter, holes: [octHole] })) // les couches évidées
// plus de couvercle ni de pièce qui s'emboîte sur l'octogone : il s'arrête à la dernière couche évidée

const model = {
  format: 'cnc-model',
  version: 1,
  id: 'livre-avent-v2',
  name: 'Livre de l’Avent v2',
  description: 'Étoile à 8 branches de 28 cm en 8 pièces identiques, chacune avec 10 pièces évidées (bordure 4 mm, vide coupé en deux compartiments, un trapèze et un triangle, par une nervure au niveau du coin) empilées dessus, chaque compartiment avec son couvercle et sa pièce qui s’emboîte, un couvercle sur le trapèze et une couche sur le triangle, toutes sans leur bout côté centre (un octogone vide au milieu) ; un octogone au centre qui s’emboîte dans le vide, monté de même (pleine + évidées, bordure 4 mm), dont la dernière couche est un couvercle plein avec dessous une pièce qui s’emboîte ; autour, huit petites pièces calées dans ses creux, chacune jusqu’à la droite entre deux pointes, avec 10 pièces évidées (bordure 2 mm) empilées dessus.',
  colors: { Etoile: '#d9b98c', Losange: '#d9b98c', Octogone: '#d9b98c', Numéroté: '#8f6130' }, // E, LO et O : marron clair, LN (couvercles numérotés 1 à 8) : marron nettement plus foncé, O : le même marron clair
  panels,
  actions: [
    // quatre boutons : chacun cache un groupe de pièces (allumé : caché ; éteint : visible). La découpe ne change pas.
    { key: 'hideRing1', label: 'Cacher cercle 1', default: false, type: 'move', panels: loLids, by: [0, 0, 0], hide: loLids },
    { key: 'hideRing2', label: 'Cacher cercle 2', default: false, type: 'move', panels: e06, by: [0, 0, 0], hide: e06 },
    { key: 'hideRing3', label: 'Cacher cercle 3', default: false, type: 'move', panels: eTrap, by: [0, 0, 0], hide: eTrap },
  ],
}
writeFileSync(arg('sortie') ?? 'models/livre-avent-v2.model.json', JSON.stringify(model))
console.log(`${panels.length} planches ; échelle ${SCALE} : rayon ${r2(R)} mm, octogone central de ${r2(2 * u0)} mm d'un côté plat à l'autre`)
await server.close()
