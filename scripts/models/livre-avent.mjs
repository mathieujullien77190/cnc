// Livre de l'Avent : une boîte en forme de livre qui s'ouvre en deux ; chaque face porte 12 cases (une boîte par case, couvercle numéroté) : 1 à 12
// à gauche, 13 à 24 à droite. Les deux moitiés sont articulées par une charnière en bois (gonds sur tourillons).
// node scripts/models/livre-avent.mjs  →  models/livre-avent.model.json
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { rect, circle, fingerSpans } = await server.ssrLoadModule('/src/models/helpers.ts')
const { markSize } = await server.ssrLoadModule('/src/core/marking.ts')

const t = 3
const NX = 3 // cases en largeur, par face
const NZ = 4 // cases en hauteur, par face : 12 cases par face, 24 en tout
const CELLX = 49 // case intérieure (mm) en largeur = boîte hors tout + 0,4 mm de jeu (flancs extérieurs de 12 mm)
const CELLZ = 59 // en hauteur
const DIV = 2 * t // quadrillage doublé : chaque cloison = deux plaques de 3 mm
const HW = 44 // profondeur des cases (hauteur des parois et des cloisons) = hauteur d'une boîte (fond compris)
const PITX = CELLX + DIV // 58 : pas des cases = largeur d'un couvercle
const PITZ = CELLZ + DIV // 66
const WI = NX * CELLX + (NX - 1) * DIV // 168 : intérieur en largeur
const HI = NZ * CELLZ + (NZ - 1) * DIV // 258 : intérieur en hauteur
const WALL_OUT = 4 * t // épaisseur réservée au flanc extérieur : 12 mm, dont deux plaques de 3 mm aux extrémités ; les deux du milieu sont retirées (l'espace est laissé libre)
const WALL_IN = t // flanc côté charnière : une plaque (3 mm)
const W = WI + WALL_OUT + WALL_IN // 174 : face hors tout = 3 couvercles de 58 ; couverture à ras : 174 mm
const H = HI + 2 * t // 260 = 4 couvercles de 65 ; avec 9 mm de débord en haut et en bas sur la charnière, la couverture fait 278 mm (≤ 280)
const OVER = 0 // débord de la couverture : à ras des parois (les languettes des parois passent dans des encoches du bord)
const OVER_Z = 9 // débord en haut et en bas : les couvertures recouvrent les blocs de la charnière (pile de trois plaques de 3 mm au bout du livre)
const EDGE_LINE = 0.3 // largeur du trait pile sur le bord : la moitié d'un trait normal (0,6)
const RW = 0.4 // un peu plus que la demi-largeur d'un trait gravé (RULE_W / 2 = 0,3) : les traits d'un bout à l'autre s'arrêtent à cette distance du bord, pour rester sur le bois
const PAGE = 3 // espacement des traits de pages (mm)
const EDGE = 3 // les traits de pages commencent (et finissent) à 3 mm du bord de la planche
const BASE = 2 * t // 6 : dessus de la planche posée sur la couverture (couverture 3 + planche 3), là où reposent les parois et les boîtes
const HALF = BASE + HW + t // 53 : épaisseur d'une face (couverture, planche, parois, couvercles) ; le livre fermé fait 106 mm, sans dos : les faces se touchent
const PLAY = 0.2 // jeu : chaque face de chaque boîte perd 0,2 mm de chaque côté (boîte et couvercle)
const BOXX = CELLX - 2 * PLAY // 51,6 : boîte hors tout
const BOXZ = CELLZ - 2 * PLAY // 59,6
const LIDWX = PITX - 2 * PLAY // 57,6 : couvercle (déborde de 3 mm de la boîte, repose sur le quadrillage doublé)
const LIDWZ = PITZ - 2 * PLAY // 65,6
const CORNER_B = 16 // largeur d'un bras
const CORNER_R = 16 // rayon du creux arrondi dans l'angle
const OPEN_GAP = 1 // écart entre les deux faces livre ouvert (la charnière est au milieu de l'écart ; fermé, les faces se touchent)
const NOTCH = 7 // rayon du demi-rond pour le doigt (bord haut du couvercle, repris dans la cloison dessous)

// ---- contours crantés à languettes placées (même dessin que plateOutline, crans choisis à la main) ----
const edge = (len, feats = []) => {
  const pts = [[0, 0]]
  for (const f of [...feats].sort((a, b) => a.u0 - b.u0)) {
    if (f.arc) pts.push(...f.arc) // creux arrondi : les points sont donnés
    else pts.push([f.u0, 0], [f.u0, f.d], [f.u1, f.d], [f.u1, 0])
  }
  pts.push([len, 0])
  return pts
}
const outline = (w, h, { top, right, bottom, left } = {}) => {
  const raw = [
    ...edge(w, top).map(([s, d]) => [s, -d]),
    ...edge(h, right).map(([s, d]) => [w + d, s]),
    ...edge(w, bottom)
      .map(([s, d]) => [s, h + d])
      .reverse(),
    ...edge(h, left)
      .map(([s, d]) => [-d, s])
      .reverse(),
  ]
  return raw.filter((p, i) => i === 0 || p[0] !== raw[i - 1][0] || p[1] !== raw[i - 1][1]).filter((p, i, a) => i < a.length - 1 || p[0] !== a[0][0] || p[1] !== a[0][1])
}
const r2 = (v) => Math.round(v * 100) / 100
/** Creux en demi-rond (rayon r, centre sur l'arête en u = c), vers l'intérieur de la plaque. */
const dip = (c, r) => ({ u0: c - r, arc: Array.from({ length: 17 }, (_, k) => [r2(c - r * Math.cos((k * Math.PI) / 16)), r2(-r * Math.sin((k * Math.PI) / 16))]) })
const slots = (n, d, cell, pitch) => Array.from({ length: n }, (_, k) => ({ u0: cell + k * pitch, u1: cell + DIV + k * pitch, d }))
const corner = (h, d) => [{ u0: r2(h / 3), u1: r2((2 * h) / 3), d }] // un seul cran au milieu d'une arête courte (3 crans)
/** Centre (y monde) de la boîte englobante d'une paroi dont le bord haut (v = 0) est à y = yTop ; v va vers le bas. */
const yc = (outer, yTop) => yTop - (Math.min(...outer.map((q) => q[1])) + Math.max(...outer.map((q) => q[1]))) / 2
/** Crénelage classique (helpers.ts : crans impairs de 16 mm environ, bouts droits) d'une arête de longueur len, décalé de `at` mm. Partout, coins compris. */
const crans = (len, d, at = 0) => fingerSpans(len).map(({ u0, u1 }) => ({ u0: r2(at + u0), u1: r2(at + u1), d }))
const mid = (len, w, d) => [{ u0: r2(len / 2 - w / 2), u1: r2(len / 2 + w / 2), d }] // une languette / encoche de w mm au milieu d'une arête
/** Creux sous le demi-rond de chaque couvercle d'une rangée (la grosse boîte, si elle y est, en a un seul, au milieu des deux cases). */
const cellDips = (big, row, off = 0) => {
  const out = []
  for (let i = 0; i < NX; i++) {
    if (big && big.row === row && i === big.col + 1) continue
    out.push(dip(off + i * PITX + CELLX / 2 + (big && big.row === row && i === big.col ? (CELLX + DIV) / 2 : 0), NOTCH))
  }
  return out
}

// ---- une face de 12 cases ; bx = x du bord de la face côté extérieur (gauche), zc = 0 ----
const box1 = [] // indices des planches de la boîte 1 (couvercle, fond, 3 parois), pour l'action « Boîte 1 sortie »
const half = (bx, firstNumber, { free = false, big = null } = {}) => {
  // big : { row, col } = la grosse boîte de cette face occupe les cases (col, row) et (col + 1, row) ; la cloison entre les deux est raccourcie
  const xw = (u) => bx + u // u (0 = paroi extérieure) → x monde
  const zw = (v) => -H / 2 + v // v (0 = bord haut du livre) → z monde
  const yWall = BASE + HW / 2 // centre d'une paroi
  const wallL = free ? WALL_IN : WALL_OUT // épaisseur du flanc du côté u = 0 (la face de gauche a son bord libre à gauche, celle de droite à droite)
  const xIn = (u) => xw(wallL + u) // x monde depuis le bord intérieur du flanc de gauche (u = 0)
  const panels = []
  // couverture lisse : à ras des parois dehors et côté charnière, 9 mm de débord en haut et en bas qui recouvrent les blocs de charnière. La face de gauche est posée
  // face avant dehors (rotation [90, 0, 180], contour en miroir : mêmes cotes) pour que son titre se lise de dos ; celle de droite est lisse.
  const HC = H + 2 * OVER_Z
  const WC = W + OVER
  // couverture lisse, 9 mm de débord en haut et en bas qui recouvrent les blocs de charnière
  // couverture lisse ; une planche de 3 mm collée dessus (W × H, à ras des parois) porte le crénelage où entrent les languettes du grand contour (flancs et bouts : crans de 16 mm) ; les cloisons du milieu ne sont pas crantées
  // décor géométrique gravé sur la face extérieure : deux cadres entre les coins (les coins en L recouvrent les angles) et, sur la première de couverture seulement, un ciel étoilé de petites croix (+, certaines avec une croix en diagonale en plus) dispersé partout sauf sur le titre et les coins ; les deux couvertures sont posées face gravée dehors
  const CK = CORNER_A + 6 // les coins en L couvrent les angles jusqu'à 59 mm : les cadres s'arrêtent avant
  // ciel étoilé : de petites étoiles en croix (+ de 4, 6 ou 8 mm) dispersées un peu partout entre les cadres, hors de la bande du titre et des angles couverts par les
  // coins ; positions tirées avec un générateur fixe : le décor est toujours le même
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const stars = []
  // répartition régulière (meilleur candidat) : à chaque étoile, on tire 40 positions et on garde la plus éloignée des étoiles déjà posées ; les croix doubles (avec diagonale)
  // sont les plus grandes (rayon 4,5 à 7 mm), les simples plus petites (1,5 à 3,5 mm)
  const BAND_HALF = free ? 70 : 34 // bande du milieu laissée libre : le poème au dos (de 79 à 195 mm), le titre devant
  const free2 = (x, y) => !((x < CK + 4 || x > WC - CK - 4) && (y < CK + 4 || y > HC - CK - 4)) && !(y > HC / 2 - BAND_HALF && y < HC / 2 + BAND_HALF)
  const M = 11 + 10 + 7 // une étoile reste à 1 cm au moins du cadre intérieur (à 11 mm du bord), croix la plus grande comprise (rayon 7)
  for (let n = 0; n < (free ? 7 : 14); n++) { // moins d'étoiles au dos (7) que devant (14)
    let best = null
    for (let c = 0; c < 40; c++) {
      const x = M + (WC - 2 * M) * rnd(), y = M + (HC - 2 * M) * rnd()
      if (!free2(x, y)) continue
      const d = stars.length ? Math.min(...stars.map((q) => Math.hypot(q.x - x, q.y - y))) : 1e9
      if (!best || d > best.d) best = { x, y, d }
    }
    if (!best || best.d < 20) continue
    const diag = n % 5 < 2 // 2 étoiles sur 5 ont une croix en diagonale en plus
    // tailles variées : les simples de 1,5 à 3,5 mm de rayon, les doubles de 4,5 à 7 mm : une double est toujours plus grande que n'importe quelle simple
    stars.push({ x: best.x, y: best.y, h: diag ? 4.5 + 2.5 * rnd() : 1.5 + 2 * rnd(), diag })
  }
  const coverDeco = [
    ...[5, 11].flatMap((i) => [[CK, i, WC - CK, i], [CK, HC - i, WC - CK, HC - i], [i, CK, i, HC - CK], [WC - i, CK, WC - i, HC - CK]]),
    // toutes les étoiles sont une croix droite (+) ; certaines ont en plus une croix en diagonale (×), toujours plus courte
    ...stars.flatMap(({ x, y, h, diag }) => [
      [r2(x - h), r2(y), r2(x + h), r2(y)],
      [r2(x), r2(y - h), r2(x), r2(y + h)],
      ...(diag ? [[r2(x - h * 0.45), r2(y - h * 0.45), r2(x + h * 0.45), r2(y + h * 0.45)], [r2(x - h * 0.45), r2(y + h * 0.45), r2(x + h * 0.45), r2(y - h * 0.45)]] : []), // la croix en diagonale est toujours plus courte que la croix droite (1,3 h contre 2 h)
    ]),
  ]
  panels.push({ id: 'C', category: 'Couverture', thickness: t, outer: rect(0, 0, WC, HC), rules: coverDeco, position: [xw(free ? W / 2 + OVER / 2 : W / 2 - OVER / 2), t / 2, 0], rotation: [90, 0, 180] }) // les deux couvertures : face gravée dehors, orientée pour que le texte se lise à l'endroit une fois le livre debout (la face de droite lue de dos)
  panels.push({ id: 'PL', category: 'Planche', thickness: t, outer: outline(W, H, { left: crans(H, -t), right: crans(H, -t), top: crans(WI, -t, wallL), bottom: crans(WI, -t, wallL) }), position: [xw(W / 2), t + t / 2, 0], rotation: [-90, 0, 0] })
  // 4 coins « à cheval » sur les angles de la couverture : une plaque en L sur la face extérieure (3 mm, bras de 59,5 mm sur 16 de large, creux arrondi dans
  // l'angle, étoile ajourée) qui déborde de 3 mm au-delà du bord, et sous ce débord des ailes de 3 mm appliquées sur les côtés qui touchent l'angle : en haut /
  // en bas (aile de bout) et, côté dehors, le long du bord libre (aile du bord libre). Côté charnière, pas d'aile du bord libre ni de débord le long du bord
  // (l'écart entre les faces n'est que de 1 mm). Les ailes sont les mêmes L que la plaque de face, sans l'étoile.
  const OUT = 3 // le coin dépasse de 3 mm du livre
  for (const xc of [bx, bx + W])
    for (const zc of [-H / 2 - OVER_Z, H / 2 + OVER_Z]) {
      const sx = xc === bx ? 1 : -1 // sens des bras en x depuis le coin (vers l'intérieur)
      const sz = zc < 0 ? 1 : -1
      const outerX = xc === (free ? bx + W : bx) // vrai : coin du bord libre (dehors) ; faux : coin côté charnière
      const ex = 0 // la plaque de face est à ras du bord : elle ne déborde pas sous les ailes
      const L0 = [[0, 0], [CORNER_A, 0], [CORNER_A, CORNER_B], [CORNER_B + CORNER_R, CORNER_B], ...Array.from({ length: 9 }, (_, k) => [CORNER_B + CORNER_R + CORNER_R * Math.cos(((-90 - (k + 1) * 10) * Math.PI) / 180), CORNER_B + CORNER_R + CORNER_R * Math.sin(((-90 - (k + 1) * 10) * Math.PI) / 180)]), [CORNER_B, CORNER_B + CORNER_R], [CORNER_B, CORNER_A], [0, CORNER_A]]
      // petit crénelage, propre aux coins et uniforme partout où deux pièces de coin se touchent (plaque ↔ ailes, aile ↔ aile) : mêmes dents de 6 mm environ,
      // nombre impair, une dent sur deux, bouts droits, sur les bras de 59,5 mm (4 languettes)
      const small = (d) => {
        const n = Math.max(3, 2 * Math.round((CORNER_A / 6 - 1) / 2) + 1)
        const sg = CORNER_A / n
        return Array.from({ length: Math.floor(n / 2) }, (_, i) => ({ u0: r2((2 * i + 1) * sg), u1: r2((2 * i + 2) * sg), d }))
      }
      const spans = small(t)
      const spansX = spans
      const notchesZ = spans.flatMap(({ u0, u1 }) => [[u0, -OUT], [u0, -OUT + t], [u1, -OUT + t], [u1, -OUT]])
      const notchesX = outerX ? [...spansX].reverse().flatMap(({ u0, u1 }) => [[-ex, u1], [-ex + t, u1], [-ex + t, u0], [-ex, u0]]) : []
      // petits crans entre la plaque de face (à ras du bord) et les ailes : la plaque a des languettes de 3 mm qui sortent de son bord et entrent dans des encoches du bas des ailes
      // (les ailes descendent de 3 mm, jusqu'à l'épaisseur de la plaque, et touchent son chant) ; elles restent dans l'épaisseur de l'aile, rien ne dépasse
      const tabsZ = spans.flatMap(({ u0, u1 }) => [[u0, 0], [u0, -t], [u1, -t], [u1, 0]])
      const tabsXe = outerX ? [...spansX].reverse().flatMap(({ u0, u1 }) => [[0, u1], [-t, u1], [-t, u0], [0, u0]]) : []
      // les angles de la plaque qui ne touchent aucune autre pièce de coin et ne sont pas au bord crénelé (bouts des deux bras, côté intérieur) sont arrondis (rayon 5)
      const RT = 5
      const arcAt = (cu, cv, a0, a1) => Array.from({ length: 7 }, (_, k) => [r2(cu + RT * Math.cos(((a0 + ((a1 - a0) * k) / 6) * Math.PI) / 180)), r2(cv + RT * Math.sin(((a0 + ((a1 - a0) * k) / 6) * Math.PI) / 180))])
      const A = CORNER_A, B = CORNER_B
      const L = [
        [0, 0], ...tabsZ,
        [A, 0], // angle côté bord (crénelé) : reste droit
        ...arcAt(A - RT, B - RT, 0, 90), // angle du bout du bras, côté intérieur (A, B), arrondi
        ...L0.slice(3, -2), // creux arrondi dans l'angle
        ...arcAt(B - RT, A - RT, 0, 90), // angle du bout de l'autre bras (B, A), arrondi
        [0, A], // angle côté bord (crénelé) : reste droit
        ...tabsXe,
      ]
      const star = Array.from({ length: 10 }, (_, k) => [CORNER_B / 2 + (k % 2 ? 2 : 4.5) * Math.sin((k * Math.PI) / 5), CORNER_B / 2 - (k % 2 ? 2 : 4.5) * Math.cos((k * Math.PI) / 5)])
      const world = (pts) => pts.map(([u, v]) => [xc + sx * u, zc + sz * v])
      const wo = world(L)
      const mnx = Math.min(...wo.map((q) => q[0])), mxx = Math.max(...wo.map((q) => q[0])), mnz = Math.min(...wo.map((q) => q[1])), mxz = Math.max(...wo.map((q) => q[1]))
      const loc = (pts) => pts.map(([x, z]) => [r2(x - mnx), r2(z - mnz)])
      panels.push({ id: 'CO', category: 'Coin', thickness: t, outer: loc(wo), holes: [loc(world(star))], position: [(mnx + mxx) / 2, -t / 2, (mnz + mxz) / 2], rotation: [-90, 0, 0] })
      // les deux ailes d'un même coin se touchent et s'emboîtent : l'aile de bout (z) a 2 languettes de 3 mm qui traversent 2 encoches de l'aile du bord libre (x),
      // dont le bord déborde de 3 mm pour couvrir l'angle
      const IL = small(t).map(({ u0, u1 }) => ({ v1: u0, v2: u1 })) // languettes d'emboîtement : le même petit crénelage uniforme
      const wing = (xs, along, rot, pos, ws, kind, mate = true) => {
        // xs : origine le long du côté ; along : sens du côté vers l'intérieur ; ws : crans du bord bas (dans la plaque de face)
        const bottom = ws.flatMap(({ u0, u1 }) => [[u0, 0], [u0, t], [u1, t], [u1, 0]]) // encoches du bas : les languettes de la plaque de face y entrent
        const desc = [...IL].reverse()
        const pts = kind === 'z'
          ? [[0, 0], ...bottom, ...L0.slice(1), ...(mate ? desc.flatMap(({ v1, v2 }) => [[0, v2], [-t, v2], [-t, v1], [0, v1]]) : [])] // pas d'aile voisine côté charnière : bord droit
          : [[-OUT, 0], ...bottom, [CORNER_A, 0], ...L0.slice(2, -1), [-OUT, CORNER_A], ...desc.flatMap(({ v1, v2 }) => [[-OUT, v2], [0, v2], [0, v1], [-OUT, v1]])]
        const wo2 = pts.map(([u, v]) => [xs + along * u, v - t]) // l'aile descend de 3 mm : son pied est à la hauteur de la plaque de face (y de -3 à 0)
        const mn = Math.min(...wo2.map((q) => q[0])), mx = Math.max(...wo2.map((q) => q[0])), mxy = Math.max(...wo2.map((q) => q[1])), mny = Math.min(...wo2.map((q) => q[1]))
        const loc2 = (pp) => pp.map(([a2, y]) => [r2(a2 - mn), r2(mxy - y)])
        return { id: 'CW', category: 'Coin', thickness: t, outer: loc2(wo2), rotation: rot, position: pos((mn + mx) / 2, (mny + mxy) / 2) }
      }
      panels.push(wing(xc, sx, [0, 0, 0], (c, y) => [c, y, zc + sz * (-OUT / 2)], spans, 'z', outerX))
      if (outerX) panels.push(wing(zc, sz, [0, -90, 0], (c, y) => [xc - sx * (OUT / 2), y, c], spansX, 'x'))
    }
  // une bande en U, à plat sur le dessus de la face (3 mm : à ras des couvercles) : elle part du décroché du gond du haut, longe le dessus du pied du gond jusqu'au
  // bord libre, descend le long du flanc extérieur (9 mm de large, à côté des couvercles) et repart vers la charnière sur le gond du bas jusqu'à son décroché
  {
    const zE = H / 2 + OVER_Z // bout de la couverture / du bloc de charnière
    const inward = free ? -1 : 1 // sens du bord libre vers l'intérieur de la face
    const xo = free ? bx + W : bx // bord libre
    const xh = AXIS[0] - inward * (KN + STEP_AT) // le décroché du gond (à 1 cm du rond), côté charnière
    const legW = 3 * t // les trois plaques du bloc de charnière : 9 mm
    const spineW = 3 * t // le dos du U fait 9 mm : il passe à côté des couvercles, qui débordent de 3 mm sur le flanc (la bande ne les recouvre pas)
    const U = [[xo, -zE], [xh, -zE], [xh, -zE + legW], [xo + inward * spineW, -zE + legW], [xo + inward * spineW, zE - legW], [xh, zE - legW], [xh, zE], [xo, zE]]
    const mnx = Math.min(...U.map((q) => q[0])), mxx = Math.max(...U.map((q) => q[0]))
    panels.push({ id: 'BU', category: 'Pages', thickness: t, outer: U.map(([x, z]) => [r2(x - mnx), r2(z + zE)]), position: [(mnx + mxx) / 2, HALF - t / 2, 0], rotation: [-90, 0, 0] })
  }
  // flancs (le long de z) : crans de 16 mm en bas dans la planche ; les bouts sont collés contre eux, sans crans.
  // le flanc côté charnière (F-06) a des encoches de 6 mm (demi-hauteur du haut) qui reçoivent les languettes des cloisons en travers
  const flanc = outline(H, HW, { top: Array.from({ length: NZ - 1 }, (_, j) => ({ u0: t + CELLZ + j * PITZ, u1: t + CELLZ + j * PITZ + DIV, d: -HW / 2 })), bottom: crans(H, t) })
  // les flancs extérieurs (bord libre de chaque face), côté qu'on voit : traits gravés qui font les pages d'un livre. Ils passent dans l'espace libéré
  // par les gonds, qui s'arrêtent à 3 mm du bord : ils couvrent toute la longueur de la couverture (H + 2 × 9 mm), jusqu'au bout des blocs de charnière.
  // Leur bas descend jusqu'à la couverture dans ces bouts (là où il n'y a pas de planche) ; les bouts (BT) sont simplement collés contre les flancs, sans crans.
  const LZ = H + 2 * OVER_Z
  const tabs = crans(H, t, OVER_Z)
  const outerFlank = [[0, 0], [LZ, 0], [LZ, HW + t], [LZ - OVER_Z, HW + t], [LZ - OVER_Z, HW]]
  for (const { u0, u1 } of [...tabs].sort((a, b) => b.u0 - a.u0)) outerFlank.push([u1, HW], [u1, HW + t], [u0, HW + t], [u0, HW])
  outerFlank.push([OVER_Z, HW], [OVER_Z, HW + t], [0, HW + t])
  const pages = [[EDGE, EDGE_LINE / 2 + 0.05, LZ - EDGE, EDGE_LINE / 2 + 0.05, EDGE_LINE], ...Array.from({ length: 13 }, (_, k) => [EDGE, PAGE + PAGE * k, LZ - EDGE, PAGE + PAGE * k])] // + un trait pile sur le bord du dessus (tout juste sur le bois : à 0,2 mm du bord), moitié moins large // 13 traits d'un bout à l'autre de la planche, espacés de 3 mm (le premier à 3 mm du trait du bord)
  const flankOuter = { id: 'FL', category: 'Pages', thickness: t, outer: outerFlank.map(([u, v]) => [r2(u), r2(v)]), rules: pages, rotation: [0, -90, 0] }
  // le flanc extérieur de la face de droite est tourné de 180° (contour symétrique) : sa face gravée regarde dehors (+x), comme celle du flanc de gauche (-x)
  panels.push({ ...flankOuter, rotation: free ? [0, 90, 0] : [0, -90, 0], position: [xw(free ? W - t / 2 : t / 2), yc(outerFlank, BASE + HW), 0] })
  // flanc extérieur : la plaque gravée dehors et une plaque unie à 9 mm (collée sur la planche, sans crans) ; les deux plaques du milieu (à 3 et 6 mm) sont supprimées,
  // leur place de 6 mm reste libre
  const flatFlank = outline(H, HW, {})
  // la plaque unie à 9 mm (F-05) reste d'un seul tenant : elle a des encoches de 6 mm (demi-hauteur du haut) où passent les cloisons en travers (DX), à mi-bois
  const flatFlank5 = outline(H, HW, { top: Array.from({ length: NZ - 1 }, (_, j) => ({ u0: t + CELLZ + j * PITZ, u1: t + CELLZ + j * PITZ + DIV, d: -HW / 2 })) })
  panels.push({ id: 'FL', category: 'Pages', thickness: t, outer: flatFlank5, position: [xw(free ? W - t / 2 - 3 * t : t / 2 + 3 * t), yc(flatFlank5, BASE + HW), 0], rotation: [0, -90, 0] })
  // le flanc du côté charnière garde la longueur H (la pile de gonds est juste à côté) ; il n'a pas de traits de pages (c'est le derrière du livre, vers la charnière)
  panels.push({ id: 'FL', category: 'Pages', thickness: t, outer: flanc, position: [xw(free ? t / 2 : W - t / 2), yc(flanc, BASE + HW), 0], rotation: [0, -90, 0] })
  // bouts (le long de x) entre les flancs : collés contre eux ; celui du haut porte les creux pour le doigt de la première rangée
  const bout = (feats) => {
    const outer = outline(WI, HW, { top: feats, bottom: crans(WI, t) })
    return { id: 'BT', category: 'Pages', thickness: t, outer, rotation: [0, 0, 0], y: yc(outer, BASE + HW) }
  }
  // pas de traits de pages sur les bouts (BT) : leur face est cachée par les blocs de charnière ; voir hingeParts pour les planches du dessus et du dessous
  for (const [feats, z, rules, rot] of [[cellDips(big, 0), zw(t / 2), undefined, [0, 0, 0]], [[], zw(H - t / 2), undefined, [0, 0, 0]]]) {
    const { y, ...b } = bout(feats)
    panels.push({ ...b, rules, rotation: rot, position: [xIn(WI / 2), y, z] }) // le bout du bas est retourné (contour symétrique) : sa face gravée regarde vers l'intérieur du livre (z -)
  }
  // quadrillage doublé : chaque cloison = deux plaques côte à côte, à mi-bois entre elles (fentes de 6 mm), collées sur la couverture et contre les parois
  const dz = { id: 'DZ', category: 'Cloison', thickness: t, outer: outline(HI, HW, { top: slots(NZ - 1, -HW / 2, CELLZ, PITZ) }), rotation: [0, -90, 0] }
  // à la grosse boîte, la cloison entre ses deux cases est raccourcie : en haut (rangée 0) elle commence au premier croisement, en bas (dernière
  // rangée) elle s'arrête au dernier : son bout garde la demi-hauteur de la fente et s'encastre dans la cloison en travers (DX), comme un croisement à mi-bois
  const dzShort = big && (big.row === 0
    ? { id: 'DZ', category: 'Cloison', thickness: t, outer: outline(HI - CELLZ, HW, { top: slots(NZ - 1, -HW / 2, 0, PITZ) }), rotation: [0, -90, 0], z: CELLZ / 2 }
    : { id: 'DZ', category: 'Cloison', thickness: t, outer: outline((NZ - 1) * PITZ, HW, { top: slots(NZ - 1, -HW / 2, CELLZ, PITZ) }), rotation: [0, -90, 0], z: (-HI + (NZ - 1) * PITZ) / 2 })
  for (let i = 0; i < NX - 1; i++)
    for (const k of [0, 1]) {
      const { z, ...d } = big && i === big.col ? dzShort : { ...dz, z: 0 }
      panels.push({ ...d, position: [xIn(CELLX + i * PITX + t / 2 + k * t), yWall, z] })
    }
  // cloisons le long de x : la plaque côté rangée du dessous (z +) porte les creux pour le doigt
  // les cloisons en travers (DX) vont d'un flanc à l'autre : elles traversent le vide du flanc extérieur et touchent la plaque gravée (F-04) ; de u = 3 mm à W - 3 mm
  // (la plaque de renfort du flanc extérieur est coupée en tronçons entre elles, plus bas)
  const dxOff = wallL - t // décalage des cases par rapport au début de la cloison : 9 mm côté flanc extérieur de 12 mm, 0 sinon
  const LD = W - 2 * t
  // côté charnière, la cloison a une languette de 3 mm (demi-hauteur du haut) qui entre dans une encoche du flanc F-06, à mi-bois comme les croisements entre cloisons
  const hingeEnd = free ? { left: [{ u0: 0, u1: HW / 2, d: t }] } : { right: [{ u0: 0, u1: HW / 2, d: t }] }
  // où elle traverse la plaque F-05 (à 9 mm du bord libre) : encoche de 3 mm sur la demi-hauteur du bas, à mi-bois avec l'encoche de F-05
  const f5 = free ? W - 4 * t - t : 3 * t - t // début de F-05 en coordonnées de la cloison (qui commence à u = 3)
  const dxOuter = (feats) => outline(LD, HW, { top: feats, bottom: [...slots(NX - 1, -HW / 2, CELLX + dxOff, PITX), { u0: f5, u1: f5 + t, d: -HW / 2 }], ...hingeEnd })
  const dxCx = (o) => (Math.min(...o.map((q) => q[0])) + Math.max(...o.map((q) => q[0]))) / 2 // centre en u de la cloison, languette comprise
  const dx = (feats) => { const outer = dxOuter(feats); return { id: 'DX', category: 'Cloison', thickness: t, outer, rotation: [0, 0, 0], cx: dxCx(outer) } }
  for (let j = 0; j < NZ - 1; j++) for (const [feats, k] of [[[], 0], [cellDips(big, j + 1, dxOff), 1]]) { const { cx, ...d } = dx(feats); panels.push({ ...d, position: [xw(t + cx), yWall, zw(t + CELLZ + j * PITZ + t / 2 + k * t)] }) }
  // une boîte par case (sauf les deux grosses : la 1 à gauche et la 24 à droite, deux cases de large), qui la remplit : fond + paroi basse + 2 côtés (ouverte côté haut) + couvercle numéroté qui déborde de 3 mm et repose sur
  // le quadrillage ; demi-rond au bord haut du couvercle, repris dans la cloison dessous : le doigt passe dans la boîte et la soulève. Petit
  // crantage (crans de 6 mm) : les côtés BB ont des languettes dans les encoches de la paroi basse BA, et chaque paroi des languettes en bas dans des encoches
  // du fond (affleurantes dessous) ; 3 petits carrés discrets : une languette de 3 × 3 au milieu du haut de chaque paroi traverse le couvercle
  const numH = 14
  const BH = HW - t - 2 * PLAY // 40,6 : parois de la boîte (0,2 mm de jeu en haut et en bas), sur le fond de 3 mm
  const yBox = BASE + HW // haut des parois de la boîte
  const lidY = BASE + HW + t / 2
  const zc = (outer, zStart) => zStart + (Math.min(...outer.map((q) => q[0])) + Math.max(...outer.map((q) => q[0]))) / 2 // centre z d'une plaque u → z dont u = 0 est en zStart
  /** Toutes les formes d'une boîte de largeur bw (x) dont le couvercle fait lw ; profondeur BOXZ. */
  const makeBox = (bw, lw) => {
    const MX = (lw - bw) / 2 // 3 : marge du couvercle autour de la boîte
    const MZ = (LIDWZ - BOXZ) / 2
    const SL = BOXZ - t // 56 : longueur d'un côté (du bord haut du fond à la paroi basse)
    const lid = [[0, 0], [lw / 2 - NOTCH, 0], ...Array.from({ length: 15 }, (_, k) => [lw / 2 - NOTCH * Math.cos(((k + 1) * Math.PI) / 16), NOTCH * Math.sin(((k + 1) * Math.PI) / 16)].map(r2)), [lw / 2 + NOTCH, 0], [lw, 0], [lw, LIDWZ], [0, LIDWZ]]
    const sideSpans = crans(SL, -t) // encoches du fond sous les languettes d'un côté (v depuis le bord haut)
    // décor géométrique gravé sur le couvercle (traits fins) : un motif dans chaque coin (deux équerres emboîtées et une diagonale), à plus de 2 mm des trous des
    // languettes et de l'encoche du doigt
    const corner4 = (ox, oz, sx, sz) => {
      const P = (u, v) => [ox + sx * u, oz + sz * v]
      const seg = (u0, v0, u1, v1) => [...P(u0, v0), ...P(u1, v1)]
      return [seg(4, 16, 4, 4), seg(4, 4, 16, 4), seg(7, 12, 7, 7), seg(7, 7, 12, 7), seg(4, 4, 7, 7)]
    }
    const deco = [corner4(0, 0, 1, 1), corner4(lw, 0, -1, 1), corner4(0, LIDWZ, 1, -1), corner4(lw, LIDWZ, -1, -1)].flat()
    return {
      lw,
      bw,
      SL,
      lid,
      deco,
      back: outline(bw, BH, { top: mid(bw, t, t), left: crans(BH, -t), right: crans(BH, -t), bottom: crans(bw, t) }),
      side: outline(SL, BH, { top: mid(SL, t, t), right: crans(BH, t), bottom: crans(SL, t) }),
      lidWindows: [rect(MX + bw / 2 - t / 2, MZ + BOXZ - t, t, t), rect(MX, MZ + SL / 2 - t / 2, t, t), rect(MX + bw - t, MZ + SL / 2 - t / 2, t, t)],
      floor: outline(bw, BOXZ, { bottom: crans(bw, -t), left: sideSpans, right: sideSpans }),
    }
  }
  const small = makeBox(BOXX, LIDWX)
  const large = makeBox(2 * CELLX + DIV - 2 * PLAY, 2 * PITX - 2 * PLAY) // la grosse boîte : deux cases de large, sans la cloison entre elles
  const put = (bx, text, cx, cz) => {
    const { w } = markSize(text, numH)
    if (text === '1') box1.push(panels.length, panels.length + 1, panels.length + 2, panels.length + 3, panels.length + 4) // les 5 planches de la boîte 1
    panels.push({ id: 'T', category: 'Couvercle', thickness: t, outer: bx.lid, holes: bx.lidWindows, labels: [{ text, x: r2(bx.lw / 2 - w / 2), y: 20, h: numH, font: 'round' }], rules: bx.deco, position: [cx, lidY, cz], rotation: [-90, 0, 0] })
    panels.push({ id: 'BF', category: 'Boîte', thickness: t, outer: bx.floor, position: [cx, yBox - BH - t / 2, cz], rotation: [-90, 0, 0] })
    panels.push({ id: 'BA', category: 'Boîte', thickness: t, outer: bx.back, position: [cx, yc(bx.back, yBox), cz + (BOXZ - t) / 2], rotation: [0, 0, 0] })
    for (const sg of [-1, 1]) panels.push({ id: 'BB', category: 'Boîte', thickness: t, outer: bx.side, position: [cx + (sg * (bx.bw - t)) / 2, yc(bx.side, yBox), zc(bx.side, cz - BOXZ / 2)], rotation: [0, -90, 0] })
  }
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const isBig = big && big.row === j && i === big.col
      if (big && big.row === j && i === big.col + 1) continue // la case est dans la grosse boîte
      const cx = xIn(i * PITX + CELLX / 2 + (isBig ? (CELLX + DIV) / 2 : 0))
      const cz = zw(t + j * PITZ + CELLZ / 2)
      // la grosse boîte porte le plus petit numéro de ses deux cases côté gauche (1), côté droit le plus grand (24)
      const text = String(firstNumber + i + NX * j + (isBig && free ? 1 : 0))
      put(isBig ? large : small, text, cx, cz)
    }
  return panels
}

// ---- charnière en bois, au milieu (pas de dos) : axe au bord supérieur de la couture (x = 0, y = 46), là où les deux faces se touchent ; fermé,
// la face droite se retourne sur la gauche. À chaque bout du livre, dans le débord des couvertures (6 mm), deux gonds (plaques dans le plan xy, un par
// face) enfilés sur un axe fait de trois ronds de Ø 8 empilés ; le gond qui n'est pas contre son bout repose sur une cale collée au bout. Rien n'est entaillé dans les faces.
const AXLE_R = 4 // rayon d'un rond de l'axe (Ø 8 mm)
const KN = 9.5 // rayon du gond autour de l'axe (5,5 mm de bois autour du trou)
const CORNER_A = 56 // bras d'un coin : coin carré de 56 mm de côté (les deux bras ont la même longueur)
const AXIS = [OPEN_GAP / 2, HALF] // axe de la charnière (x, y), repère à plat, au milieu de l'écart entre les faces
const STEP_AT = 10 // à 1 cm du rond de l'œil, le bord haut du pied d'un gond (et de sa cale) fait un décrochement
const STEP = 3 // de 3 mm vers le fond du livre (vers la couverture), puis repart vers l'extérieur
const FOOT = W + OPEN_GAP / 2 - 3 // le gond couvre le bout de sa face, de la charnière jusqu'à 3 mm du bord extérieur (la cale, côté opposé, fait la même longueur)
const knuckle = (side, holeR) => {
  // side = -1 : gond de la face gauche (pied vers x < 0) ; +1 : face droite (miroir)
  const arc = Array.from({ length: 19 }, (_, k) => [KN * Math.cos(-Math.PI / 2 + ((k + 1) * Math.PI * 1.5) / 20), HALF + KN * Math.sin(-Math.PI / 2 + ((k + 1) * Math.PI * 1.5) / 20)])
  const pts = [[-FOOT, t], [0, t], [0, HALF - KN], ...arc, [-KN, HALF], [-KN - STEP_AT, HALF], [-KN - STEP_AT, HALF - STEP], [-FOOT, HALF - STEP]].map(([x, y]) => [side === -1 ? x : -x, y])
  const xs = pts.map((q) => q[0])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = HALF + KN
  const local = (pts2) => pts2.map(([x, y]) => [r2(x - x0), r2(y1 - y)])
  return { outer: local(side === -1 ? pts : [...pts].reverse()), holes: [circle(r2(-x0), r2(y1 - HALF), holeR)], center: [(x0 + x1) / 2, (t + y1) / 2] }
}
// Un bout : trois plaques empilées enfilées sur le tourillon, la face de gauche en prend deux (GG au-dessus et au-dessous) et emprisonne le gond
// de la face de droite (GD) au milieu. A (contre les parois) : GG + cale droite ; B : GD + cale gauche ; C : GG + cale droite (au-dessus de GD). Les cales relient les gonds à leur face.
/**
 * Une plaque gravée vue de dessus : la gravure n'est tracée que sur la face avant (+z local), qui regarde vers le bas dans le livre debout ; on retourne la
 * plaque de 180° autour de son axe y (contour, trous et traits en miroir en u) pour que les traits soient sur la face visible.
 */
const faceUp = (pl) => {
  const umax = Math.max(...pl.outer.map((q) => q[0]))
  const fu = ([u, v]) => [r2(umax - u), v]
  return { ...pl, outer: pl.outer.map(fu), holes: pl.holes?.map((h) => h.map(fu)), rules: pl.rules?.map(([x0, y0, x1, y1]) => [r2(umax - x0), y0, r2(umax - x1), y1]), rotation: [0, 180, 0] }
}
const spacerFor = (side, lines = false, flip = false) => {
  // la cale épouse le rond de l'œil du gond d'en face : creux de rayon KN + 0,2 mm autour de l'axe
  const R = KN + PLAY
  const cp = [[0, t], [FOOT, t], [FOOT, HALF - STEP], [KN + STEP_AT, HALF - STEP], [KN + STEP_AT, HALF], [R, HALF], ...Array.from({ length: 17 }, (_, i) => [R * Math.cos((-i * Math.PI) / 32), HALF + R * Math.sin((-i * Math.PI) / 32)]), [0, t]].map(([x, y]) => [side * x, y])
  const cxs = cp.map((q) => q[0])
  const c0 = Math.min(...cxs), c1 = Math.max(...cxs)
  // la cale de droite (CLD) est rangée avec les faces (F) et porte les mêmes traits de pages que les flancs, d'un bout à l'autre du pied (sous le creux de l'œil)
  // mêmes hauteurs que les traits du gond de gauche (y = HALF - 6,5 - 3 k) : ils tombent en face les uns des autres ; ils s'arrêtent au décroché
  const rules = side === 1 && lines ? Array.from({ length: 13 }, (_, k) => [KN + STEP_AT, KN - 3 + PAGE * k, FOOT - EDGE, KN - 3 + PAGE * k]) : undefined // traits de pages sur la plaque du bout (visible du dessus / du dessous)
  const sp = { id: side === 1 ? 'CLD' : 'CLG', category: side === 1 ? 'Pages' : 'Gond', thickness: t, rules, outer: cp.map(([x, y]) => [r2(x - c0), r2(HALF - y)]), position: [AXIS[0] + (c0 + c1) / 2, (t + HALF) / 2, 0], rotation: [0, 0, 0] }
  return sp.rules && flip ? faceUp(sp) : sp
}
const hingeParts = () => {
  // le gond de gauche (GG) est rangé avec les faces (F) et porte lui aussi des traits de pages, du bout du pied jusqu'avant l'œil
  const ggRules = Array.from({ length: 13 }, (_, k) => [EDGE, 16 + PAGE * k, FOOT - KN - STEP_AT, 16 + PAGE * k]) // traits de pages du gond de gauche (plaque du bout), jusqu'au décroché
  const gg = knuckle(-1, AXLE_R), gd = knuckle(1, AXLE_R + PLAY) // le gond du milieu (GD) tourne : trou de 0,2 mm plus grand de chaque côté
  const plate = (id, k, rules, flip = false) => {
    const pl = { id, category: id === 'GG' ? 'Pages' : 'Gond', thickness: t, rules, outer: k.outer, holes: k.holes, position: [AXIS[0] + k.center[0], k.center[1], 0], rotation: [0, 0, 0] }
    return rules && flip ? faceUp(pl) : pl
  }
  const at = (p, z) => ({ ...p, position: [p.position[0], p.position[1], z] })
  const zEnd = H / 2 // bord des parois ; les gonds vont de zEnd à zEnd + 9
  const L = [], R = []
  for (const e of [1, -1]) {
    const zA = e * (zEnd + t / 2), zB = e * (zEnd + 1.5 * t), zC = e * (zEnd + 2.5 * t)
    // les traits de pages ne sont que sur la plaque du bout (zC) du gond de gauche et de la cale de droite : c'est elle qu'on voit du dessus et du dessous du livre ; gravée sur la face
    // qui regarde vers l'extérieur (bas : z +, rien à faire ; haut : z -, planche retournée de 180°)
    L.push(at(plate('GG', gg), zA), at(spacerFor(-1), zB), at(plate('GG', gg, ggRules, e < 0), zC))
    R.push(at(spacerFor(1), zA), at(plate('GD', gd), zB), at(spacerFor(1, true, e < 0), zC)) // une cale au-dessus de GD aussi : la pile est pleine des deux côtés de la charnière
  }
  return { left: L, right: R }
}
// l'axe de chaque bout : trois ronds de Ø 6 mm empilés, un dans l'œil de chaque plaque (A, B, C), découpés dans le bois
// + un goujon par axe (lamelle de 3,4 mm, 9 mm de long, ras des faces) qui traverse les trois ronds par un trou de 3 × 3 mm : l'axe est un seul bloc
const dowels = [1, -1].flatMap((e) => [
  ...[0.5, 1.5, 2.5].map((k) => ({ id: 'RO', category: 'Axe', thickness: t, outer: circle(AXLE_R, AXLE_R, AXLE_R), holes: [rect(AXLE_R - t / 2, AXLE_R - t / 2, t, t)], position: [AXIS[0], AXIS[1], e * (H / 2 + k * t)], rotation: [0, 0, 0] })),
  { id: 'G', category: 'Goujon', thickness: t, outer: rect(0, 0, 3 * t, 3.4), position: [AXIS[0], AXIS[1], e * (H / 2 + 1.5 * t)], rotation: [0, -90, 0] },
])
const hinges = hingeParts()

const left = [...half(-W, 1, { big: { row: 0, col: 0 } }), ...hinges.left, ...dowels]
const right = [...half(OPEN_GAP, 1 + NX * NZ, { free: true, big: { row: NZ - 1, col: 1 } }), ...hinges.right]
const title = (text, h, dy) => ({ text, x: r2((W + OVER) / 2 - markSize(text, h).w / 2), y: r2((H + 2 * OVER_Z) / 2 - h / 2 + dy), h, font: 'round' }) // même police arrondie que les numéros
left[0].labels = [title('CALENDRIER', 18, -14), title("DE L'AVENT", 18, 14)]
// quatrième de couverture : un court poème gravé, dans l'esprit des marchombres, signé Ellundril Chariakin (police à segments : majuscules sans accents ni virgules), centré
const blurb = ['UN MARCHOMBRE NE PRESSE PAS', 'LE TEMPS,', "IL APPREND A L'HABITER.", 'SUR LA VOIE, AVANCE LEGER,', 'SANS COMPTER.', '', 'VINGT-QUATRE JOURS,', 'VINGT-QUATRE SECRETS,', 'ET LA LUMIERE DE NOEL.', '', '- ELLUNDRIL CHARIAKIN']
const BH_TXT = 6 // hauteur des lettres
const TXT_STEP = 11
right[0].labels = blurb.flatMap((text, k) => (text ? [{ text, x: r2((W + OVER) / 2 - markSize(text, BH_TXT).w / 2), y: r2((H + 2 * OVER_Z) / 2 - (blurb.length * TXT_STEP) / 2 + k * TXT_STEP), h: BH_TXT }] : []))
// quatre groupes pour la vue 3D et les planches (un groupe = les planches dont l'id a les mêmes lettres) : B = toutes les pièces des mini boîtes
// (couvercle, fond, parois), CH = les blocs de la charnière (gond de droite, cale de gauche, ronds et goujons de l'axe), CN = les coins en L (plaques de face et ailes), marron clair ; F = tout le reste (faces, quadrillage, gond de gauche et cale de droite)
const GROUP = { T: 'B', BF: 'B', BA: 'B', BB: 'B', GG: 'F', CLD: 'F', CO: 'CN', CW: 'CN', GD: 'CH', CLG: 'CH', RO: 'CH', G: 'CH' }
const flat = [...left, ...right].map((p) => ({ ...p, id: GROUP[p.id] ?? 'F' }))

// ---- livre debout : tout le modèle tourne de 90° autour de x (le plan des couvertures devient vertical, face au spectateur) ----
const deg = Math.PI / 180
const matOf = ([ax, ay, az]) => {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * deg), Math.sin(ax * deg), Math.cos(ay * deg), Math.sin(ay * deg), Math.cos(az * deg), Math.sin(az * deg)]
  return [cy * cz, -cy * sz, sy, cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy, sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy]
}
const mul = (a, b) => Array.from({ length: 9 }, (_, i) => a[Math.floor(i / 3) * 3] * b[i % 3] + a[Math.floor(i / 3) * 3 + 1] * b[3 + (i % 3)] + a[Math.floor(i / 3) * 3 + 2] * b[6 + (i % 3)])
const eulerOf = (m) => {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])))
  const near = Math.abs(m[2]) > 0.9999999
  const x = near ? Math.atan2(m[7], m[4]) : Math.atan2(-m[5], m[8])
  const z = near ? 0 : Math.atan2(-m[1], m[0])
  return [x, y, z].map((v) => Math.round((v / deg) * 1e4) / 1e4 + 0)
}
const UP = matOf([90, 0, 0])
const LIFT = (H + 2 * OVER_Z) / 2 // le bas du livre debout repose à y = 0
const place = ([x, y, z]) => [r2(x), r2(-z + LIFT), r2(y)].map((v) => v + 0)
const panels = flat.map((p) => ({ ...p, position: place(p.position), rotation: eulerOf(mul(UP, matOf(p.rotation ?? [0, 0, 0]))) }))
const rightIdx = right.map((_, i) => left.length + i)

const model = {
  format: 'cnc-model',
  version: 1,
  id: 'livre-avent',
  name: 'Livre de l’Avent',
  description: 'Boîte-livre : 24 cases (12 par face) avec leur boîte (ouvertes côté haut, retrait par le haut, demi-rond pour le doigt) ; charnière en bois au milieu (gonds sur tourillons).',
  colors: { Couverture: '#8b2f2f', Pages: '#f3e9d2', Cloison: '#e2cfae', Fermoir: '#c69c6d', Planche: '#b9936a', Gond: '#c69c6d', Coin: '#c49a6c', Axe: '#7a5a34', Goujon: '#d9b277', Couvercle: '#d9a84a', Boîte: '#b98a4a' },
  panels,
  actions: [
    // curseur : la face droite se retourne sur la gauche autour de l'axe de la charnière (0 % ouvert à plat, 100 % fermé)
    { key: 'closed', label: 'Fermeture du livre', default: 0, type: 'swing', steps: [{ panels: rightIdx, by: [0, -180, 0], pivot: place([AXIS[0], AXIS[1], 0]) }] }, // −180 : la face passe devant (z > 46), pas derrière
    { key: 'box1', label: 'Boîte 1 sortie', default: false, type: 'move', panels: box1, by: [0, 0, 60] }, // la boîte 1 (couvercle, fond, parois) sort de sa case vers le spectateur
  ],
}
writeFileSync('models/livre-avent.model.json', JSON.stringify(model))
console.log(`${panels.length} planches`)
await server.close()
