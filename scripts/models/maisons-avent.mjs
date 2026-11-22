// Maison de l’Avent : une seule maison numérotée 1 (N = 24 pour le calendrier complet), contreplaqué 3 mm.
// node scripts/models/maisons-avent.mjs  →  models/maisons-avent.model.json
// Une maison (60 × 60 × 90 mm, faîtage selon x) : 2 pignons (avant numéroté + fenêtre, arrière plein), 2 murs, 1 sol, 2 pans de toit.
// Pignons : encoches ; murs : languettes aux bouts + fenêtres pour les languettes du sol .
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { rect, circle } = await server.ssrLoadModule('/src/models/helpers.ts')
const { markSize } = await server.ssrLoadModule('/src/core/marking.ts')

const t = 3
const L = 60 // longueur (x, faîtage)
const Wd = 60 // largeur (z)
const H = 60 // hauteur des murs
const G = 30 // hauteur du pignon (pente 45°)
const FLOOR_Y = 5 // dessous du sol (et bas de la fenêtre du mur), depuis le bas des murs
const N = 24 // 6 lignes de 4 maisons : fenêtres rondes, carrées, hexagonales, en losange, octogonales, en cœur
const SERIE = 4 // 4 maisons par ligne : lune, étoile, marque-page, flocon
const COLS = 4 // 4 maisons par ligne
const DX = 100 // écart entre maisons côte à côte (une ligne), 1 cm de plus qu'avant
const DZ = 90 // écart entre les lignes, 1 cm de plus qu'avant
const WIN_R = 18
const WIN_V = 26 // centre du trou, v depuis le haut du mur
// même hauteur que le rond et le carré (2 × WIN_R) : le rayon des sommets est WIN_R / sin 60°, donc un peu plus large
const HEX_R = WIN_R / Math.sin(Math.PI / 3)

// pignon avant : côtés droits + débord de 1 cm qui prolonge la pente de chaque côté (pointe à 45°, dessous à 45° vers le mur, soit 135° avec le bord vertical)
const OVER = 10
const o = OVER * Math.SQRT1_2
const frontOutline = [[-o, o], [Wd / 2, -G], [Wd + o, o], [Wd, 2 * o], [Wd, H], [0, H], [0, 2 * o]]
// pignon arrière : même contour que l'avant (plus de crans sur les côtés)
// CH : chevron de 10 mm de large le long des pentes, posé contre la face INTÉRIEURE de P (et de PA), avec 2 languettes qui entrent dans le toit
// haut du mur / de la languette des murs (v depuis le haut du pignon) : centré sur le petit triangle du débord
const TAB_V = o - 1.5
const BAND = 10 // largeur du chevron, mesurée perpendiculairement à la pente
const bandV = BAND * Math.SQRT2 // décalage vertical de la ligne intérieure (= 2 * o pour 10 mm)
const TAB_IN = t // les languettes du chevron traversent le toit sans dépasser (épaisseur du toit)
const TAB_S1 = 16 // distance du bout du débord au début de la languette, le long de la pente
const TAB_LEN = 16 // longueur de la languette le long de la pente
const sl = Math.SQRT1_2
const tabLeft = (() => {
  // de bout du débord (-o, o) vers le faîtage : direction (1, -1)/√2, normale sortante (-1, -1)/√2
  const at = (sig, out) => [-o + sig * sl - out * sl, o - sig * sl - out * sl]
  return [at(TAB_S1, 0), at(TAB_S1, TAB_IN), at(TAB_S1 + TAB_LEN, TAB_IN), at(TAB_S1 + TAB_LEN, 0)]
})()
const tabRight = [...tabLeft].reverse().map(([u, v]) => [Wd - u, v])
// bout du chevron découpé pour laisser la place au haut des murs (t de large, à partir de TAB_V), agrandi de NOTCH_PLAY de chaque côté
const NOTCH_PLAY = 0.1
const chevronOutline = [[-o, o], ...tabLeft, [Wd / 2, -G], ...tabRight, [Wd + o, o], [Wd + NOTCH_PLAY, bandV - NOTCH_PLAY], [Wd + NOTCH_PLAY, TAB_V], [Wd - t - NOTCH_PLAY, TAB_V], [Wd - t - NOTCH_PLAY, bandV - t - NOTCH_PLAY], [Wd / 2, -G + bandV], [t + NOTCH_PLAY, bandV - t - NOTCH_PLAY], [t + NOTCH_PLAY, TAB_V], [-NOTCH_PLAY, TAB_V], [-NOTCH_PLAY, bandV - NOTCH_PLAY]]
const backOutline = frontOutline // PA : même contour que P
// haut de la languette des murs / du trou de P (v depuis le haut du mur) : centré sur le petit triangle du débord
const wallSlots = [rect(0, TAB_V, t, 3), rect(Wd - t, TAB_V, t, 3)] // trous des languettes des murs (dans P et PA)
// 2e ligne de maisons : fenêtre carrée (trou carré de 2 × WIN_R, 4 vitres carrées aux coins arrondis) au lieu de ronde
const squarePanes = (c, half) => {
  const out = half - (WIN_R - 15) // même bois autour des vitres que pour la fenêtre ronde
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) =>
    roundCorners([[c + sx * BAR, c + sy * BAR], [c + sx * out, c + sy * BAR], [c + sx * out, c + sy * out], [c + sx * BAR, c + sy * out]], [0, 1, 2, 3], RC),
  )
}
// 3e ligne : fenêtre en hexagone régulier (sommets à gauche et à droite), 4 vitres découpées dans un hexagone un peu plus petit
const hexagon = (cx, cy, R) => Array.from({ length: 6 }, (_, k) => [cx + R * Math.cos((k * Math.PI) / 3), cy + R * Math.sin((k * Math.PI) / 3)])
const clipHalf = (poly, inside, cross) => {
  const out = []
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    if (inside(a)) out.push(a)
    if (inside(a) !== inside(b)) out.push(cross(a, b))
  })
  return out
}
const hexPanes = (cx, cy) => {
  const Ri = HEX_R - (WIN_R - 15) / Math.cos(Math.PI / 6) // même bois autour des vitres (mesuré perpendiculairement)
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
    let q = hexagon(0, 0, Ri).map(([x, y]) => [x * sx, y * sy])
    q = clipHalf(q, (p) => p[0] >= BAR, (a, b) => [BAR, a[1] + ((BAR - a[0]) * (b[1] - a[1])) / (b[0] - a[0])])
    q = clipHalf(q, (p) => p[1] >= BAR, (a, b) => [a[0] + ((BAR - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), BAR])
    return roundCorners(q.map(([x, y]) => [cx + x * sx, cy + y * sy]), q.map((_, i) => i), RC)
  })
}
// 4e ligne : fenêtre en losange (un peu plus grand que les autres, plus étroit que haut), 4 vitres : le losange réduit de 3 mm de bois, coupé par une croix de 3 mm
const DIAMOND_H = 1.15 * WIN_R // demi-hauteur (un peu plus grand que les autres fenêtres : 41,4 mm de haut)
const DIAMOND_W = 0.85 * DIAMOND_H // demi-largeur
const diamond = (cx, cy, k = 1) => [[cx, cy - DIAMOND_H * k], [cx + DIAMOND_W * k, cy], [cx, cy + DIAMOND_H * k], [cx - DIAMOND_W * k, cy]]
const diamondPanes = (cx, cy) => {
  const inr = (DIAMOND_W * DIAMOND_H) / Math.hypot(DIAMOND_W, DIAMOND_H) // rayon du cercle inscrit
  const k = (inr - (WIN_R - 15)) / inr // réduction pour garder le même bois autour des vitres
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
    let q = diamond(0, 0, k).map(([x, y]) => [x * sx, y * sy])
    q = clipHalf(q, (p) => p[0] >= BAR, (a, b) => [BAR, a[1] + ((BAR - a[0]) * (b[1] - a[1])) / (b[0] - a[0])])
    q = clipHalf(q, (p) => p[1] >= BAR, (a, b) => [a[0] + ((BAR - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), BAR])
    return roundCorners(q.map(([x, y]) => [cx + x * sx, cy + y * sy]), q.map((_, i) => i), RC)
  })
}
const roundedDiamond = (cx, cy) => roundCorners(diamond(cx, cy), [0, 1, 2, 3], SQUARE_ROUND)
// 5e ligne : fenêtre en octogone régulier (côtés plats en haut, en bas, à gauche et à droite : 2 × WIN_R entre côtés opposés comme les autres), 4 vitres
const OCT_R = WIN_R / Math.cos(Math.PI / 8) // rayon des sommets
const octagon = (cx, cy, R) => Array.from({ length: 8 }, (_, k) => [cx + R * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), cy + R * Math.sin(Math.PI / 8 + (k * Math.PI) / 4)])
const octPanes = (cx, cy) => {
  const Ri = OCT_R - (WIN_R - 15) / Math.cos(Math.PI / 8) // même bois autour des vitres (mesuré perpendiculairement)
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
    let q = octagon(0, 0, Ri).map(([x, y]) => [x * sx, y * sy])
    q = clipHalf(q, (p) => p[0] >= BAR, (a, b) => [BAR, a[1] + ((BAR - a[0]) * (b[1] - a[1])) / (b[0] - a[0])])
    q = clipHalf(q, (p) => p[1] >= BAR, (a, b) => [a[0] + ((BAR - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), BAR])
    return roundCorners(q.map(([x, y]) => [cx + x * sx, cy + y * sy]), q.map((_, i) => i), RC)
  })
}
// 6e ligne : fenêtre en cœur (hauteur 2 × WIN_R comme les autres), 4 vitres : le cœur réduit de 3 mm de bois partout, coupé par une croix de 3 mm
const heartRaw = Array.from({ length: 96 }, (_, k) => {
  const a = (2 * Math.PI * k) / 96
  return [16 * Math.sin(a) ** 3, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]
})
const heartYs = heartRaw.map((q) => q[1])
const heartK = (2 * WIN_R) / (Math.max(...heartYs) - Math.min(...heartYs)) // échelle : hauteur 2 × WIN_R
const heartMid = (Math.max(...heartYs) + Math.min(...heartYs)) / 2
// contour centré sur (cx, cy), pointe en bas (v vers le bas : v = -y)
const heart = (cx, cy) => heartRaw.map(([x, y]) => [cx + x * heartK, cy - (y - heartMid) * heartK])
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
const HEART_ROUND = 0 // rayon d'arrondi des coins des vitres du cœur (0 : coins vifs là où les traits se rejoignent)
const HEART_MIN_PANE = 6 // une vitre plus petite que 6 mm² (pointe du bas) est supprimée : le bois reste plein
const HEART_BAR_UP = 4 // la barre horizontale du cœur est remontée de 4 mm : le V du haut du cœur vient se fondre dans la barre sans empâtement
const heartPanes = (cx, cy) => {
  const poly = heart(0, 0)
  const inPoly = (x, y) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[i]
      const [bx, by] = poly[j]
      if (ay > y !== by > y && x < ((y - ay) * (bx - ax)) / (by - ay) + ax) c = !c
    }
    return c
  }
  const WOOD = WIN_R - 15 // bois autour des vitres
  const f = (x, y) => {
    let d = Infinity
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(x, y, poly[j], poly[i]))
    const inside = (inPoly(x, y) ? d : -d) - WOOD // > 0 dans le cœur réduit
    return Math.min(inside, Math.abs(x) - BAR, Math.abs(y + HEART_BAR_UP) - BAR) // croix : barres de 2 × BAR (la barre horizontale est remontée de HEART_BAR_UP)
  }
  if (HEART_ROUND === 0) return traceLoops(f, -(WIN_R * 1.3), WIN_R * 1.3).filter((l) => polyArea(l) > HEART_MIN_PANE).map((l) => l.map(([x, y]) => [cx + x, cy + y]))
  // arrondit tous les coins des vitres (rayon HEART_ROUND) : « ouverture » morphologique du champ (érosion puis dilatation), et supprime les éclats trop petits (la pointe du bas)
  const lo = -(WIN_R * 1.3)
  const hi = WIN_R * 1.3
  const h = 0.1
  const n = Math.ceil((hi - lo) / h)
  const r = Math.ceil(HEART_ROUND / h)
  const inside = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => f(lo + i * h, lo + j * h) > 0))
  const eroded = inside.map((col, i) =>
    col.map((v, j) => {
      if (!v) return false
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (di * di + dj * dj > r * r) continue
        const a = i + di
        const b = j + dj
        if (a < 0 || b < 0 || a > n || b > n || !inside[a][b]) return false
      }
      return true
    }),
  )
  const opened = (i, j) => {
    let d = Infinity
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      const a = i + di
      const b = j + dj
      if (a < 0 || b < 0 || a > n || b > n || !eroded[a][b]) continue
      d = Math.min(d, Math.hypot(di, dj) * h)
    }
    return Number.isFinite(d) ? HEART_ROUND - d + 1e-6 : -h
  }
  const field = (x, y) => opened(Math.round((x - lo) / h), Math.round((y - lo) / h))
  return traceLoops(field, lo, hi, h)
    .filter((l) => polyArea(l) > HEART_MIN_PANE)
    .map((l) => l.map(([x, y]) => [cx + x, cy + y]))
}
const SQUARE_ROUND = 1 // les coins du carré, de l'hexagone et de l'octogone (trou du pignon et pièce FE) sont légèrement arrondis (rayon 1 mm)
const roundedHex = (cx, cy) => roundCorners(hexagon(cx, cy, HEX_R), [0, 1, 2, 3, 4, 5], SQUARE_ROUND) // même arrondi léger pour l'hexagone et l'octogone
const roundedOct = (cx, cy) => roundCorners(octagon(cx, cy, OCT_R), [0, 1, 2, 3, 4, 5, 6, 7], SQUARE_ROUND)
const roundedSquare = (x, y) => roundCorners(rect(x, y, 2 * WIN_R, 2 * WIN_R), [0, 1, 2, 3], SQUARE_ROUND)
// trou du pignon, contour de la pièce FE et vitres selon la forme (round, square, hex)
const windowHole = (kind) => (kind === 'square' ? roundedSquare(Wd / 2 - WIN_R, WIN_V - WIN_R) : kind === 'hex' ? roundedHex(Wd / 2, WIN_V) : kind === 'octagon' ? roundedOct(Wd / 2, WIN_V) : kind === 'heart' ? heart(Wd / 2, WIN_V) : kind === 'diamond' ? roundedDiamond(Wd / 2, WIN_V) : circle(Wd / 2, WIN_V, WIN_R, 72))
const windowPiece = (kind) =>
  kind === 'square'
    ? { outer: roundedSquare(0, 0), holes: squarePanes(WIN_R, WIN_R) }
    : kind === 'hex'
      ? { outer: roundedHex(HEX_R, WIN_R), holes: hexPanes(HEX_R, WIN_R) }
      : kind === 'heart'
        ? { outer: heart(WIN_R * 1.3, WIN_R), holes: heartPanes(WIN_R * 1.3, WIN_R) }
        : kind === 'octagon'
        ? { outer: roundedOct(OCT_R, WIN_R), holes: octPanes(OCT_R, WIN_R) }
        : kind === 'diamond'
        ? { outer: roundedDiamond(WIN_R, WIN_R), holes: diamondPanes(WIN_R, WIN_R) }
      : { outer: circle(WIN_R, WIN_R, WIN_R, 72), holes: quarterWindows(WIN_R, WIN_R, 15) }
const KINDS = ['round', 'square', 'hex', 'diamond', 'octagon', 'heart'] // une forme de fenêtre par ligne
// la fenêtre est un composant : un disque FE (rayon WIN_R, bois de 3 mm autour des 4 quarts) qui se pose dans le trou rond du pignon avant
// fenêtre ronde partagée en 4 quarts par une croix de bois (barres de 2 × BAR mm)
const BAR = 1.5
// arrondit les coins `idx` d'un polygone (rayon rc, m pas par coin)
const roundCorners = (pts, idx, rc0, m = 6) => {
  const out = []
  pts.forEach((c, i) => {
    if (!idx.includes(i)) return out.push(c)
    const p = pts[(i + pts.length - 1) % pts.length]
    const q = pts[(i + 1) % pts.length]
    const norm = (v) => [v[0] / Math.hypot(...v), v[1] / Math.hypot(...v)]
    const u = norm([p[0] - c[0], p[1] - c[1]])
    const v = norm([q[0] - c[0], q[1] - c[1]])
    const th = Math.acos(u[0] * v[0] + u[1] * v[1])
    // rayon limité pour que le raccord tienne dans les segments voisins (pointes très aiguës)
    const rc = Math.min(rc0, 0.45 * Math.min(Math.hypot(p[0] - c[0], p[1] - c[1]), Math.hypot(q[0] - c[0], q[1] - c[1])) * Math.tan(th / 2))
    const d = rc / Math.tan(th / 2)
    const bis = norm([u[0] + v[0], u[1] + v[1]])
    const ctr = [c[0] + (bis[0] * rc) / Math.sin(th / 2), c[1] + (bis[1] * rc) / Math.sin(th / 2)]
    const t1 = [c[0] + u[0] * d, c[1] + u[1] * d]
    const t2 = [c[0] + v[0] * d, c[1] + v[1] * d]
    const a1 = Math.atan2(t1[1] - ctr[1], t1[0] - ctr[0])
    let da = Math.atan2(t2[1] - ctr[1], t2[0] - ctr[0]) - a1
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    for (let k = 0; k <= m; k++) out.push([ctr[0] + rc * Math.cos(a1 + (da * k) / m), ctr[1] + rc * Math.sin(a1 + (da * k) / m)])
  })
  return out
}
// fenêtre ronde partagée en 4 quarts par une croix de bois (barres de 2 × BAR mm), coins arrondis
const RC = 1
const quarterWindows = (cx, cy, r, n = 12) => {
  const a0 = Math.asin(BAR / r)
  const a1 = Math.PI / 2 - a0
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
    const pts = [
      [cx + sx * BAR, cy + sy * BAR],
      ...Array.from({ length: n + 1 }, (_, k) => {
        const a = a0 + ((a1 - a0) * k) / n
        return [cx + sx * r * Math.cos(a), cy + sy * r * Math.sin(a)]
      }),
    ]
    return roundCorners(pts, [0, 1, pts.length - 1], RC)
  })
}
// numéro gravé : chiffres tirés de SVG (scripts/models/maisons-avent-chiffres.json : contours normalisés à une hauteur de 1, chiffres 0 à 9),
// gravés en contour (traits fins de 0,12 mm le long du contour). Un chiffre absent → texte de la police.
const DIGITS = JSON.parse(readFileSync(new URL('./maisons-avent-chiffres.json', import.meta.url), 'utf8'))
const NUM_H = 10 // hauteur du numéro (mm)
const NUM_TOP = -10 // haut du numéro (v depuis le haut du mur ; négatif = dans la pointe du pignon)
const NUM_GAP = 1.5 // espace entre deux chiffres
const NUM_SIMPLIFY = 0.03 // tolérance de simplification du contour (mm)
// Douglas-Peucker sur une polyligne ouverte
const simplify = (pts, tol) => {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  const len = Math.hypot(bx - ax, by - ay) || 1e-9
  let dmax = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
    if (d > dmax) { dmax = d; idx = i }
  }
  if (dmax <= tol) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)]
}
// contour du chiffre : un trait fin de 0,12 mm le long de chaque contour (extérieur et creux)
const digitRules = (digit, x0, y0, h) => {
  const rules = []
  for (const poly of DIGITS[digit]) {
    const pts = poly.map(([x, y]) => [x0 + x * h, y0 + y * h])
    if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop()
    // le contour est fermé : on coupe en deux au point le plus éloigné pour simplifier chaque moitié
    let far = 1
    let dm = 0
    pts.forEach((q, i) => { const d = Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]); if (d > dm) { dm = d; far = i } })
    const half1 = simplify(pts.slice(0, far + 1), NUM_SIMPLIFY)
    const half2 = simplify([...pts.slice(far), pts[0]], NUM_SIMPLIFY)
    const ring = [...half1, ...half2.slice(1)]
    for (let i = 0; i + 1 < ring.length; i++) rules.push([+ring[i][0].toFixed(3), +ring[i][1].toFixed(3), +ring[i + 1][0].toFixed(3), +ring[i + 1][1].toFixed(3), 0.12, 1])
  }
  return rules
}
const numberEngraving = (n) => {
  const s = String(n)
  const widths = [...s].map((d) => (DIGITS[d] ? Math.max(...DIGITS[d].flat().map((q) => q[0])) * NUM_H : null))
  if (widths.includes(null)) {
    // chiffre sans SVG : texte de la police
    const { w } = markSize(s, NUM_H)
    return { labels: [{ text: s, x: Wd / 2 - w / 2, y: NUM_TOP, h: NUM_H }] }
  }
  const total = widths.reduce((a, b) => a + b, 0) + NUM_GAP * (s.length - 1)
  let x = Wd / 2 - total / 2
  const rules = []
  ;[...s].forEach((d, k) => {
    rules.push(...digitRules(d, x, NUM_TOP, NUM_H))
    x += widths[k] + NUM_GAP
  })
  return { rules }
}
const gableFront = (n, kind = 'round') => ({
  outer: frontOutline, // côtés droits, avec le débord ; le chevron CH est posé contre sa face intérieure
  holes: [windowHole(kind), ...wallSlots, rect(Wd / 2 - FRONT_W / 2, H - FLOOR_Y - t, FRONT_W, t)], // trou rond : la fenêtre est une pièce à part (FE)
  ...numberEngraving(n),
})

const wallLen = L - 2 * t
// mur raccourci par le haut jusqu'à la languette (son haut = le haut de la languette, 5,6 mm sous le haut du pignon)
const Hw = H - TAB_V
// chaque bout a une languette de 3 mm de large tout en haut, qui entre dans le trou de P (avant) ou de PA (arrière)
const wallOuter = [[-t, 0], [wallLen + t, 0], [wallLen + t, 3], [wallLen, 3], [wallLen, Hw], [0, Hw], [0, 3], [-t, 3]]
// le sol s'emboîte dans chaque mur par UNE languette centrée de TAB_W mm (fenêtre dans le mur, languette sur le bord du sol)
const TAB_W = 16
// motif des murs, par maison (les 2 murs identiques) : 1 lune, 2 étoile à 5 branches, 3 marque-page, puis on recommence ; trous à pointes vives
const STAR_U = wallLen / 2
const STAR_V = 24 // centre, v depuis le haut du mur
const MOON_TILT = -25 // degrés : l'ouverture de la lune regarde en haut à droite (v vers le bas)
// croissant à pointes vives : cercle R = 11 moins un cercle de coupe de 8,8 décalé de 4,8
const moonSharp = (cx, cy, R, d, r2, n = 48) => {
  const x0 = (d * d + R * R - r2 * r2) / (2 * d)
  const th = Math.atan2(Math.sqrt(R * R - x0 * x0), x0)
  const ph = Math.atan2(Math.sqrt(R * R - x0 * x0), x0 - d)
  const pts = []
  for (let k = 0; k <= n; k++) {
    const a = th + ((2 * Math.PI - 2 * th) * k) / n
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
  }
  for (let k = 1; k < n; k++) {
    const a = 2 * Math.PI - ph - ((2 * Math.PI - 2 * ph) * k) / n
    pts.push([cx + d + r2 * Math.cos(a), cy + r2 * Math.sin(a)])
  }
  return pts
}
const moonHole = moonSharp(STAR_U, STAR_V, 11, 4.8, 8.8).map(([x, y]) => {
  const a = (MOON_TILT * Math.PI) / 180
  const dx = x - STAR_U
  const dy = y - STAR_V
  return [STAR_U + dx * Math.cos(a) - dy * Math.sin(a), STAR_V + dx * Math.sin(a) + dy * Math.cos(a)]
})
const STAR_R = 14 // rayon des pointes
const STAR_RATIO = 0.42 // rayon des creux / rayon des pointes (0,382 = pentagramme régulier)
const starHole = Array.from({ length: 10 }, (_, k) => {
  const a = ((-90 + 36 * k) * Math.PI) / 180
  const r = k % 2 === 0 ? STAR_R : STAR_R * STAR_RATIO
  return [+(STAR_U + r * Math.cos(a)).toFixed(4), +(STAR_V + r * Math.sin(a)).toFixed(4)]
})
const floorWindow = rect(wallLen / 2 - TAB_W / 2, Hw - FLOOR_Y - t, TAB_W, t)
const wallHolesMoon = [floorWindow, moonHole]
const wallHolesStar = [floorWindow, starHole]
// marque-page (rectangle à bas en V, comme la photo) : 14 de large, 22 de haut, encoche de 5,5
const BM_W = 14
const BM_H = 22
const BM_NOTCH = 5.5
const bookmarkHole = [[STAR_U - BM_W / 2, STAR_V - BM_H / 2], [STAR_U + BM_W / 2, STAR_V - BM_H / 2], [STAR_U + BM_W / 2, STAR_V + BM_H / 2], [STAR_U, STAR_V + BM_H / 2 - BM_NOTCH], [STAR_U - BM_W / 2, STAR_V + BM_H / 2]]
const wallHolesBookmark = [floorWindow, bookmarkHole]
// flocon de l'image en négatif : un trou rond (rayon SNOW_RIM) où le flocon reste en bois, et dont le milieu est vide
// flocon : 6 branches à bouts ronds, chacune avec une fourche en V (2 piques à 45°) ; les branches touchent le bord du trou (elles tiennent au mur), les piques sont libres
// le contour du trou est calculé sur une grille (distance aux traits épais) puis suivi par « marching squares » et simplifié : un seul contour, sans îlot
// SNOW_NEGATIVE = false : le trou a la forme du flocon (tout le noir de l'image est enlevé) ; true : trou rond où le flocon reste en bois, milieu vide
const SNOW_NEGATIVE = false
const SNOW_ARM = 15 // longueur d'une branche du flocon en trou (du centre au centre du bout rond)
const SNOW_RIM = 17 // rayon du trou rond
const SNOW_HUB = 3 // les branches commencent à cette distance du centre : le milieu est vide
const SNOW_BAR = 2 // largeur des branches
const SNOW_FORK_AT = 0.52 // position de la fourche sur la branche (part du rayon)
const SNOW_FORK_LEN = 7.5 // longueur d'une pique
const snowSegments = (() => {
  const segs = []
  const R = SNOW_NEGATIVE ? SNOW_RIM + 2 : SNOW_ARM // en négatif la branche dépasse du trou et se fond dans le mur
  const bx = SNOW_FORK_AT * (SNOW_NEGATIVE ? SNOW_RIM : SNOW_ARM)
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    const rotp = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
    segs.push([rotp([0, 0]), rotp([R, 0])])
    for (const sg of [1, -1]) segs.push([rotp([bx, 0]), rotp([bx + SNOW_FORK_LEN * Math.SQRT1_2, sg * SNOW_FORK_LEN * Math.SQRT1_2])])
  }
  return segs
})()
const distSeg = (px, py, [[ax, ay], [bx, by]]) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
// > 0 dans le vide (trou), < 0 dans le bois
const snowField = (x, y) => {
  const dF = Math.min(...snowSegments.map((sg) => distSeg(x, y, sg))) - SNOW_BAR / 2 // > 0 hors flocon
  if (!SNOW_NEGATIVE) return -dF // le trou est le flocon lui-même
  const sdfF = Math.max(dF, SNOW_HUB - Math.hypot(x, y)) // flocon privé de son milieu
  return Math.min(SNOW_RIM - Math.hypot(x, y), sdfF)
}
// contours d'un champ f(x, y) > 0 (marching squares sur une grille de pas h entre lo et hi, boucles fermées), simplifiés (Douglas-Peucker, tolérance 0,04) et sans micro-segment (< 0,3 mm)
const traceLoops = (f, lo, hi, h = 0.1) => {
  const n = Math.ceil((hi - lo) / h)
  const grid = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => f(lo + i * h, lo + j * h)))
  const key = (i, j, d) => `${i},${j},${d}` // d = 0 : arête horizontale (i,j)-(i+1,j) ; d = 1 : arête verticale (i,j)-(i,j+1)
  const pt = {}
  const edgePt = (i, j, d) => {
    const k = key(i, j, d)
    if (!pt[k]) {
      const [i2, j2] = d === 0 ? [i + 1, j] : [i, j + 1]
      const v1 = grid[i][j]
      const v2 = grid[i2][j2]
      const t = v1 / (v1 - v2)
      pt[k] = [lo + (i + t * (i2 - i)) * h, lo + (j + t * (j2 - j)) * h]
    }
    return k
  }
  const adj = {}
  const link = (a, b) => {
    ;(adj[a] ||= []).push(b)
    ;(adj[b] ||= []).push(a)
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]].map((v) => v > 0)
      const edges = []
      if (c[0] !== c[1]) edges.push(edgePt(i, j, 0))
      if (c[1] !== c[2]) edges.push(edgePt(i + 1, j, 1))
      if (c[3] !== c[2]) edges.push(edgePt(i, j + 1, 0))
      if (c[0] !== c[3]) edges.push(edgePt(i, j, 1))
      if (edges.length === 2) link(edges[0], edges[1])
      else if (edges.length === 4) {
        const center = (grid[i][j] + grid[i + 1][j] + grid[i + 1][j + 1] + grid[i][j + 1]) / 4 > 0
        const [bottom, right, top, left] = edges
        if (center === c[0]) { link(bottom, right); link(top, left) } else { link(bottom, left); link(top, right) }
      }
    }
  }
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts
    const [ax, ay] = pts[0]
    const [bx, by] = pts[pts.length - 1]
    const len = Math.hypot(bx - ax, by - ay) || 1e-9
    let dmax = 0
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
      if (d > dmax) { dmax = d; idx = i }
    }
    return dmax <= tol ? [pts[0], pts[pts.length - 1]] : [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)]
  }
  const seen = new Set()
  const loops = []
  for (const start of Object.keys(adj)) {
    if (seen.has(start)) continue
    const loop = []
    let prev = null
    let cur = start
    while (!seen.has(cur)) {
      seen.add(cur)
      loop.push(pt[cur])
      const next = adj[cur].find((q) => q !== prev && !seen.has(q))
      if (!next) break
      prev = cur
      cur = next
    }
    if (loop.length < 8) continue
    const mid = Math.floor(loop.length / 2)
    const ring = [...dp(loop.slice(0, mid + 1), 0.04).slice(0, -1), ...dp([...loop.slice(mid), loop[0]], 0.04).slice(0, -1)]
    const clean = []
    for (const q of ring) if (!clean.length || Math.hypot(q[0] - clean[clean.length - 1][0], q[1] - clean[clean.length - 1][1]) >= 0.3) clean.push(q)
    while (clean.length > 3 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 0.3) clean.pop()
    loops.push(clean)
  }
  return loops
}
const polyArea = (p) => Math.abs(p.reduce((a, q, i) => a + (p[(i + p.length - 1) % p.length][0] * q[1] - q[0] * p[(i + p.length - 1) % p.length][1]), 0) / 2)
const snowflakeHole = traceLoops(snowField, -(SNOW_RIM + 1), SNOW_RIM + 1)
  .sort((a, b) => polyArea(b) - polyArea(a))[0]
  .map(([x, y]) => [+(STAR_U + x).toFixed(3), +(STAR_V + y).toFixed(3)])
const wallHolesSnow = [floorWindow, snowflakeHole]
const wallHolesByHouse = [wallHolesMoon, wallHolesStar, wallHolesBookmark, wallHolesSnow]
const fl = Wd - 2 * t
const fa = wallLen / 2 - TAB_W / 2
const fb = wallLen / 2 + TAB_W / 2
const fc = fl / 2
const FRONT_W = 24 // largeur de la languette avant du sol
const FRONT_OUT = 5 // elle dépasse de 5 mm de la face extérieure de P
const fe = t + FRONT_OUT // longueur totale de la languette
// + une languette centrée sur le bord avant (côté P), qui entre dans la fenêtre de P
// bout de la languette avant = arc d'un grand cercle (flèche FRONT_OUT) : droit dans P, puis bombé sur la partie qui ressort
const arcR = ((FRONT_W / 2) ** 2 + FRONT_OUT ** 2) / (2 * FRONT_OUT)
const arcA = Math.asin(FRONT_W / 2 / arcR)
const tipArc = Array.from({ length: 13 }, (_, k) => {
  const a = -arcA + (2 * arcA * k) / 12
  return [wallLen + fe - arcR + arcR * Math.cos(a), fc + arcR * Math.sin(a)]
})
const floorOuter = [[0, 0], [fa, 0], [fa, -t], [fb, -t], [fb, 0], [wallLen, 0], [wallLen, fc - FRONT_W / 2], ...tipArc, [wallLen, fc + FRONT_W / 2], [wallLen, fl], [fb, fl], [fb, fl + t], [fa, fl + t], [fa, fl], [0, fl]]

// toit : 2 pans identiques (TB et sa copie inversée TA) collés sur les pentes, qui s'emboîtent par une fente chacun
// collés par ailleurs sur les pentes des pignons
const SIDE_OVER = 3 // le toit dépasse de 3 mm de chaque pignon (P et PA)
const LR = L + 2 * SIDE_OVER // longueur du toit selon x
const c45 = Math.SQRT1_2
const slope = (Wd / 2 + o) * Math.SQRT2 // longueur de pente, du bout du débord au faîtage
const RIDGE_OVER = 5 // dépassement au faîtage (5 mm)
const EAVE_OVER = 5 // le toit dépasse de 5 mm vers la gouttière
const roofLen = slope + EAVE_OVER + t + RIDGE_OVER // longueur hors tout (bout du débord → bout des languettes)
// bord de la gouttière en nuage : CLOUDS bosses d'arc de flèche CLOUD_H (les sommets restent au bord du dépassement, les creux sont CLOUD_H en retrait)
const CLOUDS = 6
const CLOUD_H = 3
const cloudW = LR / CLOUDS
const cloudR = ((cloudW / 2) ** 2 + CLOUD_H ** 2) / (2 * CLOUD_H)
// hauteur de la bosse (0 dans les creux, CLOUD_H au sommet) à l'abscisse u
const cloud = (u) => {
  const x = (u % cloudW) - cloudW / 2
  return Math.sqrt(Math.max(cloudR * cloudR - x * x, 0)) - (cloudR - CLOUD_H)
}
const cloudPts = (v0, dir) => {
  // u de 0 à LR ; v = v0 + dir * hauteur
  const pts = []
  for (let k = 0; k < CLOUDS; k++) {
    for (let j = 0; j <= 10; j++) {
      if (k > 0 && j === 0) continue
      const u = k * cloudW + (cloudW * j) / 10
      const h = j === 0 || j === 10 ? 0 : cloud(u)
      pts.push([u, v0 + dir * h])
    }
  }
  return pts
}
// TB : v descend le long de la pente, le faîtage est en haut du contour ; trous à RIDGE_OVER du bord
const tipY = H - o // hauteur du bout du débord
const tipZ = Wd / 2 + o // distance du bout du débord à l'axe
// TB : v descend le long de la pente (faîtage en haut du contour, en nuage lui aussi), fente de t de large qui part du milieu jusqu'au bord +x
// trous des languettes des chevrons dans TB (un à chaque bout, dans l'épaisseur du chevron, posé contre la face intérieure des pignons) ; TA = copie tournée de 180°
const vTip = roofLen - EAVE_OVER // position du bout du débord sur TB (v descend vers la gouttière)
const roofBHoles = [LR / 2 + L / 2 - 2 * t, LR / 2 - L / 2 + t].map((u0) => rect(u0, vTip - TAB_S1 - TAB_LEN, t, TAB_LEN))
const roofB = [...cloudPts(CLOUD_H, -1), [LR, RIDGE_OVER], [LR / 2, RIDGE_OVER], [LR / 2, RIDGE_OVER + t], [LR, RIDGE_OVER + t], ...cloudPts(roofLen - CLOUD_H, 1).reverse()]
// TA = TB tourné de 180° dans son plan (copie inversée) : sa fente part du milieu jusqu'au bord -x ; les deux pans coulissent l'un dans l'autre selon x
const roofA = roofB.map(([u, v]) => [LR - u, roofLen - v])
const roofAHoles = roofBHoles.map((h) => h.map(([u, v]) => [LR - u, roofLen - v]))
// numéros 1 à 24 dans l'ordre des maisons (4 par ligne) ; tous ont leur SVG
const HOUSE_NUMBERS = Array.from({ length: 24 }, (_, k) => k + 1)
const panels = []
// rotation d'une pièce : matrice de l'Euler XYZ (three : R = Rx · Ry · Rz) et retour ; sert à poser chaque maison de travers (angle `yaw` autour de la verticale)
const deg = Math.PI / 180
const matOf = ([a, b, c]) => {
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a * deg), Math.sin(a * deg), Math.cos(b * deg), Math.sin(b * deg), Math.cos(c * deg), Math.sin(c * deg)]
  return [[cb * cc, -cb * sc, sb], [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb], [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb]]
}
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
const eulerOf = (m) => {
  const y = Math.asin(Math.max(-1, Math.min(1, m[0][2])))
  const [x, z] = Math.abs(m[0][2]) < 0.9999999 ? [Math.atan2(-m[1][2], m[2][2]), Math.atan2(-m[0][1], m[0][0])] : [Math.atan2(m[2][1], m[1][1]), 0]
  return [x / deg, y / deg, z / deg].map((v) => +v.toFixed(6))
}
const yawMat = (yaw) => [[Math.cos(yaw * deg), 0, Math.sin(yaw * deg)], [0, 1, 0], [-Math.sin(yaw * deg), 0, Math.cos(yaw * deg)]]
// pose une pièce de maison : tourne de `yaw` degrés autour de la verticale (Ry), puis translate de (x, y, z)
const placed = (p, { x, y, z, yaw }) => {
  const R = yawMat(yaw)
  const [px, py, pz] = p.position
  return { ...p, position: [R[0][0] * px + R[0][2] * pz + x, py + y, R[2][0] * px + R[2][2] * pz + z].map((v) => +v.toFixed(4)), rotation: yaw === 0 ? p.rotation : eulerOf(mul(R, matOf(p.rotation))) }
}
// ---- les maisons sont coupées là où le plateau (un disque entier, de centre (cx, cz), rayon Rd, épaisseur y0 → y1) les traverse ----
// monde d'un point (u, v) d'une pièce posée, à la profondeur zl dans son épaisseur
const worldOf = (q, u, v, zl) => {
  const us = q.outer.map((pt) => pt[0])
  const vs = q.outer.map((pt) => pt[1])
  const uc = (Math.min(...us) + Math.max(...us)) / 2
  const vc = (Math.min(...vs) + Math.max(...vs)) / 2
  const R = matOf(q.rotation)
  const l = [u - uc, -(v - vc), zl]
  return [0, 1, 2].map((i) => q.position[i] + R[i][0] * l[0] + R[i][1] * l[1] + R[i][2] * l[2])
}
const inPoly = (pt, poly) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[j]
    if (ay > pt[1] !== by > pt[1] && pt[0] < ((pt[1] - ay) * (bx - ax)) / (by - ay) + ax) c = !c
  }
  return c
}
// mur (plan vertical) coupé par le plateau : fente de la hauteur du plateau sur la partie du mur qui est dans le disque
const carveWall = (q, { cx, cz, Rd, y0, y1 }) => {
  const vs0 = q.outer.map((pt) => pt[1])
  const vc = (Math.min(...vs0) + Math.max(...vs0)) / 2
  const ya = worldOf(q, 0, vc, 0)[1]
  const slope = worldOf(q, 0, vc + 1, 0)[1] - ya
  if (Math.abs(Math.abs(slope) - 1) > 1e-6) return [q] // pas un plan vertical
  const vOf = (y) => vc + (y - ya) / slope
  const [vA, vB] = [vOf(y0), vOf(y1)].sort((a, b) => a - b)
  const vm = (vA + vB) / 2
  const us = q.outer.map((pt) => pt[0])
  const uMin = Math.min(...us)
  const uMax = Math.max(...us)
  let iA = Infinity
  let iB = -Infinity
  for (let u = uMin; u <= uMax; u += 0.05) {
    const inside = [-t / 2, t / 2].some((zl) => {
      const w = worldOf(q, u, vm, zl)
      return Math.hypot(w[0] - cx, w[2] - cz) <= Rd
    })
    if (inside) { iA = Math.min(iA, u); iB = Math.max(iB, u) }
  }
  if (!Number.isFinite(iA)) return [q] // le plateau ne touche pas ce mur
  // étendue du contour à mi-hauteur de la fente
  const xs = []
  for (let i = 0, j = q.outer.length - 1; i < q.outer.length; j = i++) {
    const [ax, ay] = q.outer[i]
    const [bx, by] = q.outer[j]
    if (ay > vm !== by > vm) xs.push(ax + ((vm - ay) * (bx - ax)) / (by - ay))
  }
  const u0 = Math.min(...xs)
  const u1 = Math.max(...xs)
  const left = iA <= u0 + 0.3
  const right = iB >= u1 - 0.3
  const holes = q.holes || []
  // une pièce découpée change de boîte englobante : sa position (centre de la boîte) est recalculée dans le repère d'origine
  const make = (panel, outer, hs) => {
    const us2 = outer.map((pt) => pt[0])
    const vs2 = outer.map((pt) => pt[1])
    const pos = worldOf(q, (Math.min(...us2) + Math.max(...us2)) / 2, (Math.min(...vs2) + Math.max(...vs2)) / 2, 0)
    return { ...panel, outer, holes: hs.length ? hs : undefined, position: pos.map((x) => +x.toFixed(4)) }
  }
  if (left && right) {
    // le plateau traverse tout le mur : il est coupé en deux (partie haute, partie basse), à coller de chaque côté du plateau
    const cut = (limit, upper) => {
      const keep = (pt) => (upper ? pt[1] <= limit : pt[1] >= limit)
      const out = []
      q.outer.forEach((a, i) => {
        const b = q.outer[(i + 1) % q.outer.length]
        const [ka, kb] = [keep(a), keep(b)]
        if (ka) out.push(a)
        if (ka !== kb) out.push([a[0] + ((limit - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), limit])
      })
      return out
    }
    return [
      make(q, cut(vA, true), holes.filter((h) => h.every((pt) => pt[1] < vA))),
      make({ ...q, kind: q.kind + 'B' }, cut(vB, false), holes.filter((h) => h.every((pt) => pt[1] > vB))),
    ]
  }
  if (!left && !right) return [make(q, q.outer, [...holes, rect(iA, vA, iB - iA, vB - vA)])] // fente fermée au milieu du mur
  // fente ouverte sur un bord : encoche de profondeur `dep` (mesurée depuis le bord). Un trou posé juste sous la fente (fenêtre du sol) ou dedans s'y fond.
  const edgeU = left ? u0 : u1
  const toD = (u) => (left ? u - u0 : u1 - u) // abscisse → profondeur depuis le bord
  const toU = (d) => (left ? u0 + d : u1 - d)
  let dep = left ? iB - u0 : u1 - iA
  const kept = []
  let merge = null
  for (const h of holes) {
    const hd = h.map((pt) => toD(pt[0]))
    const hv = h.map((pt) => pt[1])
    const inBand = Math.min(...hv) >= vA - 0.01 && Math.max(...hv) <= vB + 0.01
    const below = Math.abs(Math.min(...hv) - vB) < 0.01 // posé juste sous la fente
    const over = Math.min(...hd) <= dep + 0.01 // il touche la partie coupée
    if (inBand && over) dep = Math.max(dep, ...hd)
    else if (below && over) merge = { d0: Math.min(...hd), d1: Math.max(...hd), v1: Math.max(...hv) }
    else kept.push(h)
  }
  // chemin de l'encoche dans le sens des v croissants (de vA à vB), en profondeur → abscisse
  const path = merge
    ? [[0, vA], [dep, vA], [dep, vB], [merge.d1, vB], [merge.d1, merge.v1], [merge.d0, merge.v1], [merge.d0, vB], [0, vB]]
    : [[0, vA], [dep, vA], [dep, vB], [0, vB]]
  const outer = []
  const n = q.outer.length
  for (let i = 0; i < n; i++) {
    const a = q.outer[i]
    const b = q.outer[(i + 1) % n]
    outer.push(a)
    const vertical = Math.abs(a[0] - edgeU) < 1e-6 && Math.abs(b[0] - edgeU) < 1e-6
    if (vertical && Math.min(a[1], b[1]) <= vA + 1e-6 && Math.max(a[1], b[1]) >= (merge ? merge.v1 : vB) - 1e-6) {
      const pts = path.map(([d, v]) => [d === 0 ? edgeU : toU(d), v])
      outer.push(...(b[1] > a[1] ? pts : [...pts].reverse()))
    }
  }
  return [make(q, outer, kept)]
}
const carve = (q, plate) => (q.kind === 'M' || q.kind === 'PA' ? carveWall(q, plate) : [q]) // le sol est sous le plateau (3 mm plus bas) : rien à lui retirer
// construit une maison (numéro i + 1 : lune / étoile / marque-page / flocon selon la colonne, forme de fenêtre selon la ligne) à la pose donnée
const buildHouse = (i, pose, out, keep = false) => {
  // toutes les pièces d'une maison sont dans le groupe « Maison » (même lettre M, même couleur) ; la fenêtre est un autre groupe « Fenêtre » (lettre FE)
  const finish = ({ kind, ...q }) => ({ ...q, id: kind === 'FE' ? 'FE' : 'M', category: kind === 'FE' ? 'Fenêtre' : 'Maison' })
  const P = (p) => out.push(...(pose.plate ? carve(placed({ ...p, kind: p.id }, pose), pose.plate) : [placed({ ...p, kind: p.id }, pose)]).map(keep ? (q) => q : finish))
  const gx = L / 2 - t / 2
  // position d'une pièce du plan du pignon : centre de sa boîte (u → z, v vers le bas depuis le haut du mur)
  const gp = (outline, x) => {
    const us = outline.map((q) => q[0])
    const vs = outline.map((q) => q[1])
    return [x, H - (Math.min(...vs) + Math.max(...vs)) / 2, (Math.min(...us) + Math.max(...us)) / 2 - Wd / 2]
  }
  P({ id: 'P', category: 'Pignon', thickness: t, ...gableFront(HOUSE_NUMBERS[i % HOUSE_NUMBERS.length], KINDS[Math.min(Math.floor(i / SERIE), KINDS.length - 1)]), position: gp(frontOutline, gx), rotation: [0, 90, 0] }) // retournée : la face avant (celle qui porte le numéro) regarde vers l'extérieur de la maison
  for (const sx of [1, -1]) P({ id: 'CH', category: 'Chevron', thickness: t, outer: chevronOutline, position: gp(chevronOutline, sx * (gx - t)), rotation: [0, -90, 0] })
  const kind = KINDS[Math.min(Math.floor(i / SERIE), KINDS.length - 1)] // ligne 1 ronde, 2 carrée, 3 hexagone
  P({ id: 'FE', category: 'Fenêtre', thickness: t, ...windowPiece(kind), position: [gx, H - WIN_V, 0], rotation: [0, -90, 0] })
  P({ id: 'PA', category: 'Pignon arrière', thickness: t, outer: backOutline, holes: wallSlots, position: gp(frontOutline, -gx), rotation: [0, -90, 0] })
  for (const sz of [-1, 1]) P({ id: 'M', category: 'Mur', thickness: t, outer: wallOuter, holes: wallHolesByHouse[(i % SERIE) % wallHolesByHouse.length], position: [0, Hw / 2, sz * (Wd / 2 - t / 2)], rotation: [0, 0, 0] })
  // repère (y, z) : A côté z < 0 (pente montante vers +z), B côté z > 0
  P({ id: 'TA', category: 'Toit', thickness: t, outer: roofA, holes: roofAHoles, position: [0, tipY + c45 * (roofLen / 2 - EAVE_OVER + t / 2), -tipZ + c45 * (roofLen / 2 - EAVE_OVER - t / 2)], rotation: [-90 - 45, 0, 0] })
  P({ id: 'TB', category: 'Toit', thickness: t, outer: roofB, holes: roofBHoles, position: [0, tipY + c45 * (roofLen / 2 - EAVE_OVER + t / 2), tipZ - c45 * (roofLen / 2 - EAVE_OVER - t / 2)], rotation: [-90 + 45, 0, 0] })
  P({ id: 'S', category: 'Sol', thickness: t, outer: floorOuter, position: [fe / 2, FLOOR_Y + t / 2, 0], rotation: [-90, 0, 0] })
}
// hauteur d'une maison : point le plus haut du toit, mesuré sur une maison de référence posée à l'origine
const ref = []
buildHouse(0, { x: 0, y: 0, z: 0, yaw: 0 }, ref, true) // sans renommage : on y repère les pans de toit par leur `kind`
const houseTop = Math.max(
  ...ref.filter((q) => q.kind === 'TA' || q.kind === 'TB').flatMap((q) => {
    const a = (q.rotation[0] * Math.PI) / 180
    const vs = q.outer.map((pt) => pt[1])
    const vc = (Math.min(...vs) + Math.max(...vs)) / 2
    return q.outer.flatMap(([, v]) => [-t / 2, t / 2].map((zl) => q.position[1] + (-(v - vc)) * Math.cos(a) - zl * Math.sin(a)))
  }),
)
// plateaux ronds empilés sur le même axe (29, 25, 21 et 10 cm), chacun à une hauteur de maison + 1 cm au-dessus du précédent : les maisons de chaque étage passent dessous
const plateauX = -205
const plateauZ = 100
const TIER_STEP = houseTop + 10 + t // d'un plateau au suivant (dessous à dessous) : hauteur d'une maison + 1 cm + épaisseur
const PLATEAUX = [{ id: 'PL', d: 290 }, { id: 'PM', d: 240 }, { id: 'PN', d: 190 }, { id: 'PO', d: 140 }, { id: 'PP', d: 90 }] // 29, 24, 19, 14 et 9 cm
// maisons par étage, de bas en haut : 8 (8 à 1), 7 (15 à 9), 5 (20 à 16), 3 (23 à 21) et 1 (24) ; en couronne, façade (le numéro) vers l'extérieur, qui déborde un peu du plateau
const TIERS = [[8, 7, 6, 5, 4, 3, 2, 1], [15, 14, 13, 12, 11, 10, 9], [20, 19, 18, 17, 16], [23, 22, 21], [24]]
const TANG = 90 // place tangentielle d'une maison dans la couronne (largeur 85 mm + 5 mm)
const HX = L / 2 + SIDE_OVER // demi-empreinte d'une maison dans le sens du faîtage (radial : le faîtage pointe vers l'extérieur)
const HZ = 43 // demi-empreinte dans l'autre sens (toit compris)
const MIN_GAP = 3 // jeu minimal exigé entre deux empreintes voisines
// empreinte d'une maison (rectangle HX × HZ orienté selon phi) : deux maisons voisines se chevauchent-elles ?
const footprint = (R, phi) => {
  const cx = R * Math.cos(phi * deg)
  const cz = R * Math.sin(phi * deg)
  const a = [Math.cos(phi * deg), Math.sin(phi * deg)]
  const b = [-a[1], a[0]]
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([i, j]) => [cx + a[0] * HX * i + b[0] * HZ * j, cz + a[1] * HX * i + b[1] * HZ * j])
}
const sepGap = (r1, r2) => {
  let g = -Infinity
  for (const r of [r1, r2]) {
    for (let e = 0; e < 2; e++) {
      const d = [r[e + 1][0] - r[e][0], r[e + 1][1] - r[e][1]]
      const l = Math.hypot(...d)
      const ax = [-d[1] / l, d[0] / l]
      const pr = (q) => q.map((pt) => pt[0] * ax[0] + pt[1] * ax[1])
      const [p1, p2] = [pr(r1), pr(r2)]
      g = Math.max(g, Math.min(...p2) - Math.max(...p1), Math.min(...p1) - Math.max(...p2))
    }
  }
  return g
}
// rayon d'une couronne : toutes les maisons d'un étage sur le même cercle, le plus petit rayon (par pas de 1 mm) qui évite tout chevauchement entre voisines
const ringRadii = (n) => {
  if (n === 1) return [0]
  for (let R = (n * TANG) / (2 * Math.PI); R < 400; R += 1) {
    const rects = Array.from({ length: n }, (_, j) => footprint(R, -90 + (j * 360) / n))
    let ok = true
    for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n && ok; j++) if (sepGap(rects[i], rects[j]) < MIN_GAP) ok = false
    if (ok) return Array.from({ length: n }, () => R)
  }
  throw new Error(`couronne de ${n} maisons impossible`)
}
const DROP = 11 // sauf celle du haut, les maisons sont posées de façon que le plateau touche leur sol (le sol est à 5 → 8 mm au-dessus de la base du mur : le plateau occupe donc 8 → 11 mm, juste au-dessus du sol)
// la rainure (encoche du plateau dans les murs de côté) de la maison 21 est la bonne : toutes les autres maisons ont la même profondeur de rainure
// profondeur de la rainure d'un mur de côté : le mur va de R - L/2 à R + L/2 en radial ; le plateau (rayon Rd) l'entame depuis le bout côté centre jusqu'à sqrt(Rd² - (face intérieure)²)
const WALL_IN = Wd / 2 - t // distance de la face intérieure du mur de côté à l'axe de la maison (27 mm)
const grooveDepth = (Rd, R) => Math.sqrt(Rd * Rd - WALL_IN * WALL_IN) + L / 2 - R
const REF_TIER = 3 // l'étage de la maison 21 (23, 22, 21 sur le plateau de 14 cm)
const REF_R = ringRadii(TIERS[REF_TIER].length)[0] + 20 // sa couronne : sans chevauchement, reculée de 2 cm (la position validée)
const GROOVE = grooveDepth(PLATEAUX[REF_TIER].d / 2, REF_R)
// les maisons d'un étage ne sont pas alignées avec celles de l'étage voisin : chaque étage est tourné d'un angle différent (TIER_PHASES)
const TIER_PHASES = [-90, 106, 0, 4, -90] // phase de chaque étage (calculée pour que les maisons de deux étages voisins soient au moins à 3° les unes des autres)
const tierPhase = (k) => TIER_PHASES[k]
const layouts = TIERS.map((nums, k) => {
  const minR = ringRadii(nums.length)[0]
  // rayon qui donne la même rainure que la maison 21 (jamais en dessous de la couronne sans chevauchement)
  const R = nums.length > 1 ? Math.max(minR, Math.sqrt((PLATEAUX[k].d / 2) ** 2 - WALL_IN * WALL_IN) + L / 2 - GROOVE) : 0
  return nums.map((n, j) => ({ n, R, phi: tierPhase(k) + (j * 360) / nums.length }))
})
console.log('rainure de référence (maison 21) :', GROOVE.toFixed(1), 'mm ; rayons des couronnes :', layouts.map((h) => h[0].R.toFixed(0)).join(', '))
layouts.forEach((houses, k) => {
  const top = k === TIERS.length - 1 // la maison du haut n'est pas descendue ni coupée
  const plate = top ? undefined : { cx: plateauX, cz: plateauZ, Rd: PLATEAUX[k].d / 2, y0: k * TIER_STEP, y1: k * TIER_STEP + t }
  houses.forEach(({ n, R, phi }) => buildHouse(n - 1, { x: plateauX + R * Math.cos(phi * deg), y: k * TIER_STEP + t - (top ? 0 : DROP), z: plateauZ + R * Math.sin(phi * deg), yaw: -phi, plate }, panels))
})
// colonnes entre chaque plateau et celui du dessus : autant de planches `CO` que de maisons sur l'étage du dessous, à égale distance les unes des autres, entre les maisons
// chaque planche : bord droit au centre (à 5 mm de l'axe), bord extérieur en quart de cercle creux (rayon g / √2) dont les coins sont à 45 mm de l'axe ; 1 cran en haut et 1 en bas, à des distances de l'axe différentes (le cran du haut, côté extérieur, 34 mm ; celui du bas 16 mm) pour que les fenêtres des deux séries d'un même plateau ne se touchent jamais
const COL_R0 = 5 // distance de l'axe au bord droit des planches
const COL_W = 45 - COL_R0 // largeur d'une planche (bord extérieur à 45 mm de l'axe : tient dans le plus petit plateau)
const COL_TAB_W = 16 // longueur des crans (dans le sens radial)
const COL_TOP = 34 // distance de l'axe du centre du cran du haut
const COL_BOTTOM = 16 // distance de l'axe du centre du cran du bas
const colG = TIER_STEP - t // hauteur entre deux plateaux (dessus du plateau du bas → dessous du plateau du haut) : hauteur d'une maison + 1 cm
const colR = colG / Math.SQRT2 // rayon du quart de cercle (corde = g, angle 90°)
// la planche est retournée de 180° autour de la verticale : le repère u de son contour (0 = côté creux) va vers l'axe ; distance de l'axe d'un point u : COL_R0 + COL_W - u
const uOf = (rho) => COL_R0 + COL_W - rho // abscisse u du contour pour une distance à l'axe donnée
const colOutline = (() => {
  const [t0, t1] = [uOf(COL_TOP + COL_TAB_W / 2), uOf(COL_TOP - COL_TAB_W / 2)] // cran du haut
  const [b0, b1] = [uOf(COL_BOTTOM + COL_TAB_W / 2), uOf(COL_BOTTOM - COL_TAB_W / 2)] // cran du bas
  const arc = Array.from({ length: 25 }, (_, k) => {
    const th = (45 - (90 * k) / 24) * deg // de +45° (bas) à -45° (haut)
    return [-colG / 2 + colR * Math.cos(th), colG / 2 + colR * Math.sin(th)]
  })
  return [[0, 0], [t0, 0], [t0, -t], [t1, -t], [t1, 0], [COL_W, 0], [COL_W, colG], [b1, colG], [b1, colG + t], [b0, colG + t], [b0, colG], ...arc.slice(0, -1)]
})()
const colAngles = (n, k) => Array.from({ length: n }, (_, j) => tierPhase(k) + 180 / n + (j * 360) / n) // entre les maisons de l'étage k (maisons à tierPhase(k) + j × 360 / n)
const slotAt = (d, phi, rho) => {
  // fenêtre d'un cran (COL_TAB_W dans le sens radial, t dans l'autre) dans un plateau de diamètre d (repère de la planche : u → x, v → z, centre en (d / 2, d / 2))
  const c = [d / 2 + rho * Math.cos(phi * deg), d / 2 + rho * Math.sin(phi * deg)]
  const ra = [Math.cos(phi * deg), Math.sin(phi * deg)]
  const ta = [-ra[1], ra[0]]
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [+(c[0] + ra[0] * (COL_TAB_W / 2) * i + ta[0] * (t / 2) * j).toFixed(4), +(c[1] + ra[1] * (COL_TAB_W / 2) * i + ta[1] * (t / 2) * j).toFixed(4)])
}
const plateSlots = PLATEAUX.map(() => [])
const midY = (k) => k * TIER_STEP + t + colG / 2 // milieu de la hauteur entre le plateau k et le plateau k + 1
for (let k = 0; k < PLATEAUX.length - 1; k++) {
  const n = TIERS[k].length
  colAngles(n, k).forEach((phi) => {
    const rho = COL_R0 + COL_W / 2 // centre de la planche (la boîte du contour va de 5 à 45 mm)
    panels.push({ id: 'CO', category: 'Colonne', thickness: t, outer: colOutline, position: [plateauX + rho * Math.cos(phi * deg), midY(k), plateauZ + rho * Math.sin(phi * deg)], rotation: [0, 180 - phi, 0] })
    plateSlots[k].push(slotAt(PLATEAUX[k].d, phi, COL_BOTTOM)) // cran du bas dans le plateau du dessous
    plateSlots[k + 1].push(slotAt(PLATEAUX[k + 1].d, phi, COL_TOP)) // cran du haut dans le plateau du dessus
  })
}
// plateaux : disques entiers (ce sont les maisons qui sont coupées là où ils passent), percés des fenêtres des crans des colonnes
// repère gravé : le rectangle (60 × 60 mm, les murs) de chaque maison, tracé sur son plateau pour savoir où elle se pose ; coupé là où il sort du disque (bois plein à 1,5 mm du bord) ou traverse une fenêtre de cran
const houseMarks = (k) => {
  const d = PLATEAUX[k].d
  const slots = plateSlots[k]
  const free = (x, y) => Math.hypot(x - d / 2, y - d / 2) <= d / 2 - 1.5 && !slots.some((poly) => inPoly([x, y], poly) || poly.some(([a, b], i) => { const [c, e] = poly[(i + 1) % poly.length]; const dx = c - a; const dy = e - b; const tt = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - (a + tt * dx), y - (b + tt * dy)) < 1 }))
  const rules = []
  layouts[k].forEach(({ R, phi }) => {
    const c = [d / 2 + R * Math.cos(phi * deg), d / 2 + R * Math.sin(phi * deg)]
    const a = [Math.cos(phi * deg), Math.sin(phi * deg)]
    const b = [-a[1], a[0]]
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [c[0] + a[0] * (L / 2) * i + b[0] * (Wd / 2) * j, c[1] + a[1] * (L / 2) * i + b[1] * (Wd / 2) * j])
    corners.forEach((p0, e) => {
      const p1 = corners[(e + 1) % 4]
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const n = Math.round(len / 0.2)
      let run = null
      for (let q = 0; q <= n; q++) {
        const x = p0[0] + ((p1[0] - p0[0]) * q) / n
        const y = p0[1] + ((p1[1] - p0[1]) * q) / n
        if (free(x, y)) run = run ? [run[0], [x, y]] : [[x, y], [x, y]]
        else if (run) { if (Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]) > 0.5) rules.push([+run[0][0].toFixed(3), +run[0][1].toFixed(3), +run[1][0].toFixed(3), +run[1][1].toFixed(3), 0.12, 1]); run = null }
      }
      if (run && Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]) > 0.5) rules.push([+run[0][0].toFixed(3), +run[0][1].toFixed(3), +run[1][0].toFixed(3), +run[1][1].toFixed(3), 0.12, 1])
    })
  })
  return rules
}
PLATEAUX.forEach(({ id, d }, k) => {
  panels.push({ id, category: 'Plateau', thickness: t, outer: circle(d / 2, d / 2, d / 2, d >= 200 ? 180 : 120), ...(plateSlots[k].length ? { holes: plateSlots[k] } : {}), rules: houseMarks(k), position: [plateauX, t / 2 + k * TIER_STEP, plateauZ], rotation: [-90, 0, 0] })
})
layouts.forEach((houses, k) => {
  if (houses.length < 2) return
  let mg = Infinity
  for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++) mg = Math.min(mg, sepGap(footprint(houses[i].R, houses[i].phi), footprint(houses[j].R, houses[j].phi)))
  console.log(`étage ${k + 1} : rayon ${houses[0].R.toFixed(0)} mm, jeu minimal entre empreintes voisines ${mg.toFixed(1)} mm`)
})
console.log('hauteur maison', houseTop.toFixed(1), 'mm ; plateaux à', PLATEAUX.map((_, k) => (k * TIER_STEP).toFixed(1)).join(', '), 'mm')

writeFileSync(
  'models/maisons-avent.model.json',
  JSON.stringify({ format: 'cnc-model', version: 1, id: 'maisons-avent', name: 'Maisons de l’Avent', colors: { Maison: '#d2a679', Fenêtre: '#6b4423' }, description: 'Une petite maison numérotée, 60 × 60 × 90 mm.', panels }, null, 1),
)
await server.close()
console.log(panels.length, 'planches')
