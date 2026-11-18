// Génère models/wifi-invite.model.json : plaque carrée à coins arrondis de 100 mm : le QR code de la page « Chez Matou » (celui de l’onglet « Page invité » de House, clé comprise) et « wifi : matoudu77 » dessous en minuscules (police Arial, `font: 'arial'` : la police à segments n'a que des majuscules).
// Usage : node scripts/models/wifi-invite.mjs <guest-runs.json>. Le fichier est { size, runs: [{ x, y, n }] } : les suites de modules noirs du QR code, ligne par ligne (x, y en modules, n = longueur).
// Le QR contient la clé de la page : ne pas versionner le fichier de suites ni le modèle généré.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'

const [file] = process.argv.slice(2)
if (!file) throw new Error('usage : wifi-invite.mjs <guest-runs.json>')
const { size, runs } = JSON.parse(readFileSync(file, 'utf8'))

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

const S = 100 // côté de la plaque
const R = 8 // rayon des coins
const t = 3
const side = 72 // côté voulu du QR (mm) ; le module ne dépasse pas 1,9 mm
const m = Math.min(1.9, +(side / size).toFixed(3))
const qr = size * m
const qx = (S - qr) / 2
const qy = 8
const TEXT_H = 8 // hauteur des capitales du texte (Arial)

const outer = []
const corner = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = ((a0 + (90 * i) / 8) * Math.PI) / 180; outer.push([+(cx + R * Math.cos(a)).toFixed(3), +(cy + R * Math.sin(a)).toFixed(3)]) } }
corner(S - R, R, -90); corner(S - R, S - R, 0); corner(R, S - R, 90); corner(R, R, 180)

// Un trait par suite de modules noirs, en traits fins comme les nombres : 6 valeurs, la dernière est le pas (0,6 mm de largeur : 0,3 mm entre deux lignes) entre contours emboîtés (la vue 3D les montre en lignes, le laser brûle toute la bande) : largeur = un module, rallonge d'un demi-trait à chaque bout déjà comptée par le moteur ; sixième valeur = pas des contours emboîtés.
// Une suite d'un seul module a ses deux bouts au même point : le moteur (`ruleRect`) perd alors la direction du trait et ne dessine rien (les côtés des grands carrés du QR disparaissaient). On rallonge de 0,001 mm.
const PAS = 0.6 // pas de la largeur entre deux contours emboîtés : chaque bord recule de 0,3 mm (largeurs 1,9 / 1,3 / 0,7 mm) ; le centre est une vraie ligne (CENTER_W), pas un rectangle
const CENTER_W = 0.1 // la ligne du milieu : un trait de 0,1 mm (la vue 3D le montre en une seule ligne, la gravure en une seule passe)
const rules = runs.flatMap(({ x, y, n }) => {
  const x0 = +(qx + x * m + m / 2).toFixed(3)
  const y0 = +(qy + y * m + m / 2).toFixed(3)
  const x1 = Math.max(+(qx + (x + n) * m - m / 2).toFixed(3), +(x0 + 0.001).toFixed(3))
  return [[x0, y0, x1, y0, m, PAS], [x0, y0, x1, y0, CENTER_W, 1]]
})

// Le texte est gravé en traits fins comme le QR : chaque segment du contour des lettres d'Arial (fontArial.ts) devient un trait de 0,2 mm à 6 valeurs (la vue 3D montre un trait de 0,2 mm ou moins comme une seule ligne fine, et la gravure fait une seule passe).
const { ARIAL_GLYPHS, ARIAL_CAP } = await server.ssrLoadModule('/src/core/fontArial.ts')
const label = 'wifi : matoudu77'
const LINE_W = 0.2
const k = TEXT_H / ARIAL_CAP
let pen = 0
const placed = [...label].map((ch) => { const g = ARIAL_GLYPHS[ch] ?? ARIAL_GLYPHS[' ']; const at = pen; pen += g.a; return { g, at } })
const xsAll = placed.flatMap(({ g, at }) => [...g.c, ...(g.o ?? [])].flatMap((c) => c.filter((_, i) => i % 2 === 0).map((v) => v + at)))
const gx0 = Math.min(0, ...xsAll)
const gx1 = Math.max(pen, ...xsAll)
const textX = (S - (gx1 - gx0) * k) / 2
const baseY = qy + qr + 5 + TEXT_H
const pt = (px, py) => [+(textX + (px - gx0) * k).toFixed(3), +(baseY - py * k).toFixed(3)]
const textRules = []
const line = (ax, ay, bx, by) => { const a = pt(ax, ay), b = pt(bx, by); if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.001) textRules.push([a[0], a[1], b[0], b[1], LINE_W, 0.25]) }
// Chaque contour est gravé trois fois : le contour des lettres, puis deux copies décalées de 0,3 mm et 0,6 mm vers l'intérieur de la matière (angles à onglet, limités à 3 fois le décalage). Une contre-forme (le trou d'un o, d'un a) se gonfle : la matière est de l'autre côté.
const INNER_STEP = 0.3 // mm : espace entre deux lignes du texte
const area = (c) => { let s = 0; for (let i = 0, n = c.length / 2; i < n; i++) { const j = (i + 1) % n; s += c[2 * i] * c[2 * j + 1] - c[2 * j] * c[2 * i + 1] } return s / 2 }
const offset = (c, d) => { // d > 0 : vers la gauche du sens du contour (unités de la police)
  const n = c.length / 2, out = []
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n
    const e1 = [c[2 * i] - c[2 * p], c[2 * i + 1] - c[2 * p + 1]], e2 = [c[2 * q] - c[2 * i], c[2 * q + 1] - c[2 * i + 1]]
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2]
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]
    const ml = Math.hypot(mx, my)
    if (ml < 1e-9) { out.push(c[2 * i] + n1[0] * d, c[2 * i + 1] + n1[1] * d); continue }
    mx /= ml; my /= ml
    const cos = mx * n1[0] + my * n1[1] // longueur de l'onglet : d / cos, limitée à 3 d
    const len = Math.min(3, 1 / Math.max(cos, 1e-6)) * d
    out.push(c[2 * i] + mx * len, c[2 * i + 1] + my * len)
  }
  return out
}
for (const { g, at } of placed) {
  const outerSign = Math.sign(area(g.c.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a), g.c[0] ?? [0, 0, 0, 0, 0, 0])))
  for (const c of g.c) {
    const sign = Math.sign(area(c)) === outerSign ? 1 : -1 // matière : à gauche d'un contour de même sens que le plus grand (y vers le haut, sens trigonométrique), à droite d'un trou
    const left = outerSign > 0 ? sign : -sign
    for (const step of [0, 1, 2]) {
      const q = step === 0 ? c : offset(c, left * step * INNER_STEP / k)
      if (step > 0 && Math.sign(area(q)) !== Math.sign(area(c))) continue // une forme trop étroite (le point d'un i) s'est retournée : pas de copie
      for (let i = 0, n = q.length / 2; i < n; i++) line(at + q[2 * i], q[2 * i + 1], at + q[2 * ((i + 1) % n)], q[2 * ((i + 1) % n) + 1])
    }
  }
  for (const c of g.o ?? []) for (let i = 0; i + 3 < c.length; i += 2) line(at + c[i], c[i + 1], at + c[i + 2], c[i + 3])
}
rules.push(...textRules)
const labels = []

const panels = [{ id: 'W', category: 'Plaque', thickness: t, outer, position: [0, t / 2, 0], rotation: [-90, 0, 0], labels, rules }]
writeFileSync('models/wifi-invite.model.json', JSON.stringify({ format: 'cnc-model', version: 1, id: 'wifi-invite', name: 'Wifi invité', description: 'Plaque carrée à coins arrondis : QR code de la page « Chez Matou » et le mot de passe du wifi.', panels }))
console.log({ size, module: m, qr, bottom: +(qy + qr + 5 + TEXT_H * 1.35).toFixed(1) })
await server.close()
