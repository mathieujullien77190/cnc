// Boîte à télécommandes Nice : trois télécommandes murales (8 × 8 cm, 1 cm d'épaisseur) posées à plat, touches vers le haut ; pour chaque touche (haut, milieu, bas) un servo SG90
// sans plaque, ni bloc, ni planche autour (montré seulement) ; sur l'axe du servo : une embase, le palonnier, un LEVIER découpé
// au laser (collé sur le palonnier) et la vis centrale. Le servo tourne de quelques degrés, le levier pivote et son pied appuie au MILIEU de la touche.
// Une ESP32 (même carte que le schéma 3D du site, `src/components/ShutterWiring3D`) à l'arrière, sur un socle.
// node scripts/models/boite-volets-nice.mjs  →  models/boite-volets-nice.model.json
//
// Cotes mesurées : télécommande 80 × 80 × 10 mm ; les touches sont centrées à 40 mm du bord (milieu de la largeur) et à 27, 40 et 52 mm du haut.
// Servo : Miuzei MS60 (micro servo 9 g à engrenages métal, 180°, 500 à 2500 µs, neutre 1500 µs ; carte fournie avec les servos). Cotes de la carte : corps 22,4 × 12,1 mm (SERVO_L, SERVO_W), hauteur du corps
// 22,8 mm (SERVO_DEPTH), arbre de 4,9 mm de diamètre à 20 dents (SHAFT_R). Palonnier : la corne simple noire du MF90, 21,5 mm (HORN_HUB_R, HORN_TIP_R, HORN_TIP_AT, mesurés sur la photo).
// Cotes qui ne sont pas sur la carte (reprises de l'annonce du MF90, un servo voisin, ou supposées ; à vérifier au pied à coulisse) : longueur avec les oreilles 32,2 mm (EARS_L), hauteur des oreilles depuis le
// dessous (SERVO_FRONT = 6 mm de corps devant la plaque ; 16 mm sur un autre SG90), l'axe de sortie à 5,9 mm du bout du corps (PIVOT_FROM_END), embase de 9 mm de diamètre et de 4 mm de haut (BOSS_R, BOSS_L),
// palonnier de 1,5 mm ; touche 50 × 10 mm. À corriger ici puis relancer le script.
//
// Pourquoi trois côtés : les touches sont à 12-13 mm l'une de l'autre, et un servo fait 12 mm d'épaisseur sur 23 de long. Les trois ne tiennent pas côte à côte devant leurs touches.
// Le servo du haut et celui du bas sont donc à gauche (l'un a son corps vers l'arrière, l'autre vers l'avant, pour ne pas se gêner), celui du milieu à droite.
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { rect, circle, plateOutline, windowsFor, fingerSpans } = await server.ssrLoadModule('/src/models/helpers.ts')

const t = 3
const r2 = (n) => Math.round(n * 1000) / 1000

// ---- les télécommandes ----
const R = 80 // côté (mm), carré
const REMOTE_TRIM = 2 // le bloc violet (la télécommande) est réduit de 2 mm de chaque côté : 76 × 76 mm ; les bords et la plaque gardent les 80 mm
const RH = 7 // épaisseur de la télécommande (10 mm avant, 3 mm de moins)
const GAP = 8 // écart entre deux télécommandes
const SIDE = 8 // marge entre la télécommande et le mur (côtés)
const FRONT = 6 // marge devant (la cale a 6,4 mm de bois autour des poches)
const ESP_STRIP = 33 // profondeur réservée à l'ESP32 derrière les télécommandes (la carte fait 28 × 52)
const REMOTE_X = [-(R + GAP), 0, R + GAP] // centres des trois télécommandes
const BTN_Z = [-13, 0, 12] // les trois touches par rapport au centre de la télécommande (de haut en bas : 27, 40, 52 mm du haut)
const BTN_W = 50 // largeur d'une touche (supposée)
const BTN_H = 10 // hauteur d'une touche (supposée)

// ---- les servos, leur axe et leurs leviers ----
const SERVO_W = 12.1 // corps du servo, sens de la largeur (carte Miuzei MS60 : 12,1 mm)
const SERVO_L = 22.4 // corps du servo, sens de la longueur (carte Miuzei MS60 : 22,4 mm) ; le servo est COUCHÉ : ce grand côté est horizontal (x), l'axe près de son bout tourné vers la touche
const SERVO_DEPTH = 22.8 // longueur du corps le long de l'axe (carte MS60 : 22,8 mm du dessous au dessus du corps)
const SERVO_FRONT = 6 // les oreilles (18 mm du dessous) reposent sur la plaque : le corps dépasse de 6 mm devant sa face
const EARS_L = 32.2 // longueur avec les oreilles (pas sur la carte MS60 ; annonce MF90 : 32,2 mm, entraxe des trous 27,6 mm, trous de 2 mm)
const EARS_SHIFT = 1 // les ailettes (les oreilles du servo) sont décalées de 1 mm vers l'avant (vers le palonnier), pour laisser 1 mm de plus aux planches de côté
const PIVOT_FROM_END = 5.9 // l'axe de sortie est à 5,9 mm du bout du corps, celui qui est tourné vers la touche
const BOSS_R = 4.5 // embase ronde autour de l'axe (9 mm de diamètre)
const BOSS_L = 4 // l'embase monte à 28 mm du dessous (fiche) : 4 mm au-dessus du corps
const HORN_T = 1.5 // palonnier en plastique
// La corne simple noire du MF90 (21,5 mm d'après l'annonce), contour pris sur la photo des trois cornes à l'échelle de leurs longueurs annoncées (21,5, 31,3 et 33,7 mm) : un moyeu rond
// de 6,8 mm de diamètre et un bout rond de 4 mm, 16,1 mm plus loin, reliés par deux droites (3,4 + 16,1 + 2 = 21,5 mm). Le trou du moyeu a le diamètre de l'arbre (4,9 mm, SHAFT_R).
const HORN_HUB_R = 3.4
const HORN_TIP_R = 2
const HORN_TIP_AT = 16.1 // du centre du moyeu au centre du bout
const SHAFT_R = 2.45 // axe cannelé (carte MS60 : 4,9 mm de diamètre ; 20 dents)
const SCREW_R = 2 // tête de la vis centrale
const SCREW_L = 1.5
// Pile le long de l'axe, à partir du centre de la plaque (dir = sens du palonnier) : plaque 1,5, corps 6 devant la plaque (jusqu'à 7,5), embase 4 (11,5), palonnier 1,5 (13), levier 3 (16), vis 1,5 (17,5).
const BODY_TOP = t / 2 + SERVO_FRONT // 7,5
const HORN_Z0 = BODY_TOP + BOSS_L // 11,5 : dessous du palonnier
const LEVER_Z0 = HORN_Z0 + HORN_T // 13 : dessus du palonnier (le servo mesure 31 mm avec son axe : 14,5 depuis le centre de la plaque)
const HORN_Z = HORN_Z0 + HORN_T / 2 // 12,25 : plan du palonnier, du centre de la plaque
const BTN_TOP = t + RH // 13 : dessus de la télécommande posée sur le fond
const BTN_RAISE = 0.5 // les touches dépassent de 0,5 mm (supposé) : le bout du palonnier s'arrête sur leur face
const BTN_FACE = BTN_TOP + BTN_RAISE // 13,5
const REACH = 18.1 // de l'axe au milieu de la touche : le bout de la corne (16,1 + 2 = 18,1 mm devant l'axe) la touche sans être coupé ni la traverser
// Servo couché : l'axe est le plus bas possible au-dessus de la touche (le corps, large de 12,1 mm, dépasse de 6,05 mm sous l'axe, plus 1,5 mm de jeu), donc la corne attaque presque à plat : plus de force utile sur la touche.
const REST_DEG = 8 // le servo relève le palonnier de 8 degrés au repos
const BORD_H = 9 // hauteur des bords autour de la télécommande (12 mm avant, 3 mm de moins)
const LID_TOP = t + BORD_H + t // dessus de la plaque posée sur les bords : les servos sont posés dessus
const H_AXIS = LID_TOP + SERVO_W / 2 - BTN_FACE // l'axe est à la moitié du corps (couché) au-dessus de la plaque
const D = Math.sqrt(REACH ** 2 - H_AXIS ** 2) // 16,5 : distance horizontale de l'axe du servo au milieu de la touche
const PIVOT_Y = BTN_FACE + H_AXIS // 21 : hauteur de l'axe du servo
const LID_BOTTOM = 40 // le haut des murs (les servos couchés sont bas)

// ---- la boîte ----
const WI = 3 * R + 2 * GAP + 2 * SIDE // 272 : largeur intérieure
const DI = R + 2 * 5 + ESP_STRIP + 3 // 126 : profondeur intérieure
const HI = LID_BOTTOM - t // 69 : hauteur intérieure
const OVER = 5 // le fond déborde de 5 mm des murs (≥ 4,5 mm de bois autour des fenêtres)
const FW = WI + 2 * t + 2 * OVER // 288
const FD = DI + 2 * t + 2 * OVER // 142
const REMOTE_Z = DI / 2 - FRONT - R / 2 // 17 : centre en z des télécommandes (le dos est tourné vers l'ESP32)

// ---- les trois servos (ceux de la première télécommande) : chacun appuie sur une touche ----
// j = 0 : touche du haut, servo à gauche, corps vers l'arrière ; j = 1 : milieu, servo à droite, corps vers l'arrière ; j = 2 : bas, servo à gauche, corps vers l'avant
const servos = []
for (const rx of [REMOTE_X[0]]) {
  for (let j = 0; j < 3; j++) {
    const sx = j === 1 ? 1 : -1 // côté de l'axe par rapport au milieu de la touche
    const dir = j === 2 ? -1 : 1 // sens du palonnier le long de z
    const zb = REMOTE_Z + BTN_Z[j]
    servos.push({ rx, j, sx, dir, xs: rx + sx * D, zb, zp: zb - dir * HORN_Z })
  }
}


// ---- le palonnier ----
// La corne noire du MF90 entière (jamais coupée), posée sur l'axe du servo et dirigée vers le milieu de la touche, dont son bout rond touche la face. Au repos le servo la relève de quelques degrés.
/** Le polygone du monde → contour de planche (u, v) et position (centre de la boîte). */
const toPanel = (poly, z) => {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y1 = Math.max(...ys)
  return { outer: poly.map(([x, y]) => [r2(x - x0), r2(y1 - y)]), x0, y1, position: [r2((x0 + Math.max(...xs)) / 2), r2((Math.min(...ys) + y1) / 2), r2(z)] }
}
/** Le contour de la corne dans son repère (a le long de la corne vers le bout, b en travers), centré sur le moyeu : deux arcs reliés par les tangentes extérieures. */
const hornOutline = () => {
  const beta = Math.acos((HORN_HUB_R - HORN_TIP_R) / HORN_TIP_AT)
  const pts = []
  const arc = (cx, r, from, to, n) => {
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n
      pts.push([cx + r * Math.cos(a), r * Math.sin(a)])
    }
  }
  arc(0, HORN_HUB_R, beta, 2 * Math.PI - beta, 24) // le moyeu, par l'arrière
  arc(HORN_TIP_AT, HORN_TIP_R, -beta, beta, 12) // le bout
  return pts
}
/** La corne d'un servo : son contour entier posé sur l'axe, dirigé vers le milieu de la touche ; et le trou de l'arbre dans le repère de la planche. */
const horn = (s) => {
  const len = Math.hypot(s.rx - s.xs, BTN_FACE - PIVOT_Y)
  const dx = (s.rx - s.xs) / len
  const dy = (BTN_FACE - PIVOT_Y) / len
  const world = hornOutline().map(([a, b]) => [s.xs + dx * a - dy * b, PIVOT_Y + dy * a + dx * b])
  const panel = toPanel(world, s.zp + s.dir * HORN_Z)
  return { ...panel, hole: circle(r2(s.xs - panel.x0), r2(panel.y1 - PIVOT_Y), SHAFT_R, 24) }
}

const FOND = R + 40 // le fond est un carré plus grand que la télécommande : 40 mm de plus (20 mm de chaque côté)
// bords autour de la télécommande (la plaque violette) : 4 bandes de BORD_H de haut, contre ses côtés (pas de jeu) ; devant et derrière couvrent les coins.
// Chaque bande a des languettes en bas qui entrent dans des fenêtres du fond et en haut dans la plaque posée dessus (encastrées : elles affleurent).
const rx0 = REMOTE_X[0]
const RW = R - 2 * REMOTE_TRIM // l'intérieur des bords : 76 mm (ils sont rapprochés de 2 mm de chaque côté)
const LONG = RW + 2 * t // devant et derrière
const half = FOND / 2
const LID = LONG + 30 // la plaque du dessus : 1 cm de plus de chaque côté (puis encore 1 cm) que les bords
const wy = t + BORD_H / 2
const windowsAt = (h) => [
  ...windowsFor(LONG, t, h + RW / 2, true, 0, LONG, h - RW / 2 - t), // devant
  ...windowsFor(LONG, t, h - RW / 2 - t, true, 0, LONG, h - RW / 2 - t), // derrière
  ...windowsFor(RW, t, h - RW / 2 - t, false, 0, RW, h - RW / 2), // côté gauche
  ...windowsFor(RW, t, h + RW / 2, false, 0, RW, h - RW / 2), // côté droit
] // fenêtres pour les languettes des bords dans une plaque carrée dont la moitié du côté est h, centrée sur la télécommande
const fondHoles = windowsAt(half)

const panels = [
  { id: 'F', category: 'Fond', thickness: t, outer: rect(0, 0, FOND, FOND), holes: fondHoles, position: [REMOTE_X[0], t / 2, REMOTE_Z], rotation: [-90, 0, 0] },
]
/** Une bande debout : contour à languettes en bas et en haut ; `u0` = position du coin haut-gauche du corps (u), `top` = hauteur du haut du corps ; la boîte englobante (languettes comprises) donne la position. */
const standing = (len, place) => {
  const outer = plateOutline(len, BORD_H, { top: { d: t }, bottom: { d: t } })
  const us = outer.map((p) => p[0])
  const vs = outer.map((p) => p[1])
  const cu = (Math.min(...us) + Math.max(...us)) / 2
  const cv = (Math.min(...vs) + Math.max(...vs)) / 2
  return { id: 'W', category: 'Bord', thickness: t, outer, ...place(cu, t + BORD_H - cv) }
}
for (const sz of [-1, 1]) panels.push(standing(LONG, (cu, y) => ({ position: [r2(rx0 - LONG / 2 + cu), r2(y), r2(REMOTE_Z + sz * (RW / 2 + t / 2))] })))
for (const sx of [-1, 1]) panels.push(standing(RW, (cu, y) => ({ position: [r2(rx0 + sx * (RW / 2 + t / 2)), r2(y), r2(REMOTE_Z - RW / 2 + cu)], rotation: [0, -90, 0] })))

// palonniers (l'accessoire pousse la touche) : les servos ne sont tenus par rien dans le modèle (ni plaque, ni bloc, ni planche, ni couvercle)
const hornIndex = []
const KEPT = servos.filter((q) => q.j === 1) // un seul moteur gardé : celui du milieu (les fentes de la plaque restent pour les trois)
for (const s of KEPT) {
  const h = horn(s)
  hornIndex.push({ index: panels.length, s })
  panels.push({ id: 'MOT', category: 'Palonnier', thickness: HORN_T, outer: h.outer, holes: [h.hole], cut: false, position: [h.position[0], r2(h.position[1] + t), h.position[2]] })
}

// la plaque posée sur les bords (96 × 96, 1 cm de plus que la télécommande avec ses bords ; des fenêtres reçoivent les languettes du haut des bords) ; les servos sont posés dessus, le palonnier passe dessous par une fente
// (un rectangle de l'épaisseur du palonnier, qui couvre le trajet du palonnier de sa position jusqu'à l'angle de repos)
const SLOT_MORE_L = 20
const SLOT_B03_LEFT = 5 // la fente de B-03 est réduite de 5 mm sur la gauche
const SLOT_BAR = 3 // bois mini entre deux fentes (mm)
const SLOT_W = Math.min(BTN_Z[1] - BTN_Z[0], BTN_Z[2] - BTN_Z[1]) - SLOT_BAR // largeur des fentes (9 mm : les touches sont à 12 et 13 mm l'une de l'autre)
const slotRange = (s) => {
  const h = hornOutline().map(([a, b]) => {
    const len = Math.hypot(s.rx - s.xs, BTN_FACE - PIVOT_Y)
    const dx = (s.rx - s.xs) / len
    const dy = (BTN_FACE - PIVOT_Y) / len
    return [s.xs + dx * a - dy * b, PIVOT_Y + dy * a + dx * b]
  })
  let x0 = Infinity
  let x1 = -Infinity
  for (let deg = 0; deg <= REST_DEG; deg += 1) {
    const th = ((s.sx < 0 ? 1 : -1) * deg * Math.PI) / 180
    const w = h.map(([x, y]) => [s.xs + (x - s.xs) * Math.cos(th) - (y - PIVOT_Y) * Math.sin(th), PIVOT_Y + (x - s.xs) * Math.sin(th) + (y - PIVOT_Y) * Math.cos(th)])
    for (let i = 0; i < w.length; i++) {
      const [ax, ay] = w[i]
      const [bx, by] = w[(i + 1) % w.length]
      for (let k = 0; k <= 50; k++) {
        const x = ax + ((bx - ax) * k) / 50
        const y = ay + ((by - ay) * k) / 50
        if (y >= LID_TOP - t && y <= LID_TOP) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
        }
      }
    }
  }
  // la fente est bien plus large que le palonnier : 20 mm de plus en longueur (x) et SLOT_W en largeur (z), avec SLOT_BAR de bois au moins entre deux fentes
  const cut = s.j === 2 ? SLOT_B03_LEFT : 0 // la fente au-dessus de B-03 (la touche du bas) est raccourcie à gauche
  return [x0 - SLOT_MORE_L / 2 + cut, x1 + SLOT_MORE_L / 2] // [début, fin] en x (monde)
}
// les 3 fentes sont alignées sur celle de B-03 (même début et même fin en x) ; elles couvrent bien le trajet de chaque palonnier
const SLOT_RIGHT_PLUS = 5 // les fentes sont plus longues de 5 mm sur la droite
const alignedRange = [slotRange(servos[2])[0], slotRange(servos[2])[1] + SLOT_RIGHT_PLUS]
const slotOf = (s) => {
  const [a, b] = slotRange(s) // la fente propre à ce palonnier, avec ses marges
  const hornA = a + SLOT_MORE_L / 2 - (s.j === 2 ? SLOT_B03_LEFT : 0)
  const hornB = b - SLOT_MORE_L / 2
  if (hornA < alignedRange[0] || hornB > alignedRange[1]) throw new Error(`la fente alignée ne couvre pas le palonnier ${s.j}`)
  const [x0, x1] = alignedRange
  return rect(r2(x0 - (rx0 - LID / 2)), r2(s.zb - SLOT_W / 2 - (REMOTE_Z - LID / 2)), r2(x1 - x0), SLOT_W)
}
const lidHoles = [...windowsAt(LID / 2), ...servos.map(slotOf)]
// la plaque est couverte de mini croix, une à chaque intersection d'un quadrillage de GRID mm (la première à GRID_FIRST mm du bord) : un bras de CROSS mm de chaque côté du point.
// Partout sur le bois ; une croix qui touche un trou est coupée au bord du trou (on ne grave jamais dans un trou).
const GRID = 5
const GRID_FIRST = 2.5
const CROSS = 0.15
const CROSS_W = 0.12 // trait fin de 0,12 mm, une seule passe (pas de 1), comme les traits des numéros (NUM_LINE_W de livre-avent-v2)
const crossRules = () => {
  const boxes = lidHoles.map((h) => {
    const us = h.map((q) => q[0])
    const vs = h.map((q) => q[1])
    return [Math.min(...us) - CROSS_W / 2 - 0.01, Math.min(...vs) - CROSS_W / 2 - 0.01, Math.max(...us) + CROSS_W / 2 + 0.01, Math.max(...vs) + CROSS_W / 2 + 0.01] // le trait a une largeur : il s'arrête avant le bord du trou
  })
  const out = []
  /** Le bout de segment [lo, hi] sur la ligne `fixed`, sans les parties dans un trou ; `vertical` : la ligne est u = fixed. */
  const piece = (fixed, lo, hi, vertical) => {
    let spans = [[lo, hi]]
    for (const [u0, v0, u1, v1] of boxes) {
      const [a, b, c, d] = vertical ? [u0, u1, v0, v1] : [v0, v1, u0, u1]
      if (!(fixed > a && fixed < b)) continue
      spans = spans.flatMap(([s0, s1]) => (d <= s0 || c >= s1 ? [[s0, s1]] : [[s0, Math.min(s1, c)], [Math.max(s0, d), s1]].filter(([p, q]) => q - p > 0.02)))
    }
    for (const [s0, s1] of spans) out.push(vertical ? [r2(fixed), r2(s0), r2(fixed), r2(s1), CROSS_W, 1] : [r2(s0), r2(fixed), r2(s1), r2(fixed), CROSS_W, 1])
  }
  for (let a = GRID_FIRST; a <= LID - GRID_FIRST + 1e-9; a += GRID)
    for (let b = GRID_FIRST; b <= LID - GRID_FIRST + 1e-9; b += GRID) {
      piece(b, a - CROSS, a + CROSS, false)
      piece(a, b - CROSS, b + CROSS, true)
    }
  return out
}
panels.push({ id: 'C', category: 'Couvercle', thickness: t, outer: rect(0, 0, LID, LID), holes: lidHoles, rules: crossRules(), position: [rx0, LID_TOP - t / 2, REMOTE_Z], rotation: [-90, 0, 0] })

// 3 planches debout autour du cul du moteur du milieu (une derrière, une de chaque côté) et une planche à plat par-dessus, posées sur la plaque, de la hauteur du corps du moteur (12 mm) ;
// les côtés vont du cul jusqu'aux ailettes. Le vide entre les côtés est celui du corps du moteur plus 0,3 mm (ajustement trouvé avec les U d'essai).
// Elles s'emboîtent par de mini crans (comme les autres planches, crans impairs, profondeur = épaisseur) : le bout des côtés dans des encoches du fond, le haut des trois dans des encoches de la planche du dessus.
{
  const SIDE_PLAY = 0.3
  const LIFT = t // une plaque à plat de t sous les planches debout : le bloc et le moteur sont montés d'autant
  const s = servos[1]
  const d = s.dir
  const cx = s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END) // milieu du corps en x
  const rear = s.zp - d * (SERVO_DEPTH - BODY_TOP) // le cul : le bout du corps, à l'opposé du palonnier
  const inner = SERVO_L + SIDE_PLAY
  const H = 12.3 // hauteur des 3 planches debout : 0,3 mm de plus que le corps du moteur (12 mm), pour que la planche du dessus ne le touche pas
  const W = inner + 2 * t // largeur de la planche du cul et de celle du dessus
  const L = SERVO_DEPTH - BODY_TOP + t / 2 + EARS_SHIFT + 0.1 // longueur des côtés : jusqu'à la face arrière des ailettes (décalées de EARS_SHIFT)
  const box = (o) => {
    const us = o.map((q) => q[0])
    const vs = o.map((q) => q[1])
    return { cu: (Math.min(...us) + Math.max(...us)) / 2, cv: (Math.min(...vs) + Math.max(...vs)) / 2 }
  }
  const r2o = (o) => o.map(([a, b]) => [r2(a), r2(b)])
  // le côté de l'axe du servo (le bout du corps le plus près de l'axe) a sa planche raccourcie de SHORT mm du côté de la planche du cul : pas de crans à ce bout
  const axisSide = -s.sx // -1 : côté des x petits (gauche), 1 : côté des x grands
  const SHORT = 6
  const BIT_H = 3 // hauteur du bout du haut qui relie la bande à la planche
  const BAND_W = 3 // largeur de la bande collée à S-01, sur toute la hauteur
  // derrière (plan XY) : languettes en haut, encoches sur les bords debout (là où entrent les côtés ; pas du côté de l'axe)
  const backO = plateOutline(W, H, { top: { d: t }, bottom: { d: t }, ...(axisSide === -1 ? {} : { left: { d: -t } }), ...(axisSide === 1 ? {} : { right: { d: -t } }) })
  const b = box(backO)
  panels.push({ id: 'S', category: 'Planche moteur', thickness: t, outer: r2o(backO), position: [r2(cx - W / 2 + b.cu), r2(LID_TOP + LIFT + H - b.cv), r2(rear - d * (t / 2))] })
  // côtés (plan YZ, u vers z) : languette en haut et languette au bout du cul (bord gauche si le cul est du côté des z petits, droit sinon), sauf du côté de l'axe : raccourci, sans languette au bout
  for (const sx of [-1, 1]) {
    const short = sx === axisSide
    const len = short ? L - SHORT : L
    const sideO = plateOutline(len, H, { top: { d: t }, ...(short ? {} : { bottom: { d: t } }), ...(short ? {} : d > 0 ? { left: { d: t } } : { right: { d: t } }) })
    if (short) {
      // une bande de BAND_W mm sur toute la hauteur, collée à la planche du cul (S-01), reliée à la planche raccourcie par un bout du haut (BIT_H de haut)
      if (d > 0) {
        sideO.pop() // le dernier point est le coin haut gauche, déjà le premier
        sideO.push([0, BIT_H], [-BAND_W, BIT_H], [-BAND_W, H], [-SHORT, H], [-SHORT, 0])
      } else {
        const at = sideO.findIndex((q, k) => q[0] === len && q[1] === 0 && sideO[k - 1] && sideO[k - 1][0] === len && sideO[k - 1][1] === 0)
        sideO.splice(at + 1, 0, [len + SHORT, 0], [len + SHORT, H], [len + BAND_W, H], [len + BAND_W, BIT_H], [len, BIT_H])
      }
    }
    const sb = box(sideO)
    const zu0 = d > 0 ? rear + (short ? SHORT : 0) : rear - L // z du bord u = 0 du corps
    panels.push({ id: 'S', category: 'Planche moteur', thickness: t, outer: r2o(sideO), position: [r2(cx + sx * (inner / 2 + t / 2)), r2(LID_TOP + LIFT + H - sb.cv), r2(zu0 + sb.cu)], rotation: [0, -90, 0] })
  }
  // dessus (à plat) : encoches sur le bord du cul et sur les deux bords, là où entrent les languettes du haut
  if (d < 0) throw new Error("le bloc devant le moteur n'est prévu que pour un moteur dont le cul est vers les z petits")
  // le bloc devant le moteur, du côté qui n'est pas celui de l'axe, collé à la face avant du corps ; il monte jusqu'à la planche du dessus
  // côté axe : 1 mm de moins que l'embase ; côté opposé : jusqu'au coin de la planche du dessus (le bord dehors de la planche de ce côté)
  const bx = [s.xs + s.sx * (BOSS_R + 1), cx + s.sx * (W / 2)].sort((a, b2) => a - b2)
  const BW = bx[1] - bx[0]
  // côté moteur : le bloc est rogné jusqu'au bord du trou du crantage (la languette du haut et du bas finit au bout du bloc) ; les encoches des plaques à plat gardent leur place
  const tabSpan = fingerSpans(BW, 0, BW)[0] // la languette du bloc entier, dans le repère du bloc entier
  const motorLow = s.sx > 0 // le côté moteur (l'embase) est celui des x petits
  const cutAt = motorLow ? tabSpan.u0 : BW - tabSpan.u1
  const BW2 = BW - cutAt
  const tw = tabSpan.u1 - tabSpan.u0
  const tabO = (w) => [[0, -t], [tw, -t], [tw, 0], [w, 0], [w, H], [tw, H], [tw, H + t], [0, H + t]]
  const blockO = motorLow ? tabO(BW2) : tabO(BW2).map(([u, v]) => [BW2 - u, v]).reverse()
  const bb = box(blockO)
  const bx0 = motorLow ? bx[0] + cutAt : bx[0]
  panels.push({ id: 'S', category: 'Planche moteur', thickness: t, outer: r2o(blockO), position: [r2(bx0 + bb.cu), r2(LID_TOP + LIFT + H - bb.cv), r2(rear + SERVO_DEPTH + t / 2)] })
  const LP = SERVO_DEPTH + 2 * t // la planche du dessus va du dos de la planche du cul jusqu'au devant du bloc (t après le bout du corps, MOT-02)
  const blockU0 = bx[0] - (cx - W / 2) // où le bloc commence sur la planche du dessus (u)
  const zoneFor = (sx) => {
    const cut = sx === axisSide ? SHORT : 0
    return d > 0 ? { a: t + cut, b: t + L } : { a: SERVO_DEPTH - L, b: SERVO_DEPTH - cut }
  }
  const topO = plateOutline(W, LP, { top: { d: -t }, bottom: { d: -t, a: blockU0, b: blockU0 + BW }, left: { d: -t, ...zoneFor(-1) }, right: { d: -t, ...zoneFor(1) } })
  const tb = box(topO)
  const zv0 = d > 0 ? rear - t : rear - SERVO_DEPTH // z du bord v = 0
  panels.push({ id: 'S', category: 'Planche moteur', thickness: t, outer: r2o(topO), position: [r2(cx - W / 2 + tb.cu), r2(LID_TOP + LIFT + H + t / 2), r2(zv0 + tb.cv)], rotation: [-90, 0, 0] })
  // la plaque du dessous (à plat, sur le couvercle) : mêmes encoches que celle du dessus, sauf du côté de l'axe où la planche raccourcie n'a pas de bout du bas
  const zoneBot = (sx) => (sx === axisSide ? null : zoneFor(sx))
  const EXT = 10 // la plaque dépasse de 1 cm derrière et de chaque côté (pas devant, vers le moteur) : les encoches deviennent des fenêtres
  const zb = (sx) => zoneBot(sx)
  const botHoles = [
    ...windowsFor(W, t, EXT, true, 0, W, EXT), // derrière (la planche du cul)
    ...[-1, 1].filter((sx) => zb(sx)).flatMap((sx) => windowsFor(LP, t, sx < 0 ? EXT : EXT + W - t, false, zb(sx).a, zb(sx).b, EXT)),
  ]
  const botO = plateOutline(W + 2 * EXT, LP + EXT, { bottom: { d: -t, a: blockU0 + EXT, b: blockU0 + EXT + BW } })
  const bt = box(botO)
  panels.push({ id: 'S', category: 'Planche moteur', thickness: t, outer: r2o(botO), holes: botHoles.map(r2o), position: [r2(cx - W / 2 - EXT + bt.cu), r2(LID_TOP + t / 2), r2(zv0 - EXT + bt.cv)], rotation: [-90, 0, 0] })
}

// pièces montrées mais non découpées : servos, axes, télécommandes, touches
const cyl = (r) => circle(0, 0, r, 24)
for (const s of KEPT) {
  const z = (a, b) => [r2(s.zp + s.dir * ((a + b) / 2)), Math.abs(b - a)] // [centre en z, épaisseur] d'un étage de la pile (de a à b depuis le centre de la plaque)
  const body = z(-(SERVO_DEPTH - BODY_TOP), BODY_TOP) // du fond du corps jusqu'à son haut
  panels.push({ id: 'MOT', category: 'Moteurs', thickness: body[1], outer: rect(0, 0, SERVO_L, SERVO_W), cut: false, position: [r2(s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END)), PIVOT_Y + t, body[0]] })
  const ears = z(t / 2 + EARS_SHIFT, t / 2 + 2.5 + EARS_SHIFT)
  panels.push({ id: 'MOT', category: 'Moteurs', thickness: ears[1], outer: rect(0, 0, EARS_L, SERVO_W), cut: false, position: [r2(s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END)), PIVOT_Y + t, ears[0]] })
  const boss = z(BODY_TOP, HORN_Z0)
  panels.push({ id: 'MOT', category: 'Embase', thickness: boss[1], outer: cyl(BOSS_R), cut: false, position: [r2(s.xs), PIVOT_Y + t, boss[0]] })
  const shaft = z(BODY_TOP, LEVER_Z0) // l'axe cannelé traverse l'embase et le palonnier
  panels.push({ id: 'MOT', category: 'Axe et vis', thickness: shaft[1], outer: cyl(SHAFT_R), cut: false, position: [r2(s.xs), PIVOT_Y + t, shaft[0]] })
  const screw = z(LEVER_Z0, LEVER_Z0 + SCREW_L) // la vis centrale, sur le palonnier
  panels.push({ id: 'MOT', category: 'Axe et vis', thickness: screw[1], outer: cyl(SCREW_R), cut: false, position: [r2(s.xs), PIVOT_Y + t, screw[0]] })
}
for (const rx of [REMOTE_X[0]]) {
  panels.push({ id: 'T', category: 'Télécommande', thickness: RH, outer: rect(0, 0, R - 2 * REMOTE_TRIM, R - 2 * REMOTE_TRIM), cut: false, position: [rx, t + RH / 2, REMOTE_Z], rotation: [-90, 0, 0] })
  for (const [i, dz] of BTN_Z.entries()) {
    // chaque touche a son numéro (B-01, B-02, B-03) sans rien graver : la numérotation donne un numéro par contour distinct, donc l'épaisseur de la touche diffère de 0,01 mm de l'une à l'autre
    const bt = r2(BTN_RAISE + i * 0.01)
    panels.push({ id: 'B', category: 'Touche', thickness: bt, outer: rect(0, 0, BTN_W, BTN_H), cut: false, position: [rx, r2(BTN_TOP + bt / 2), REMOTE_Z + dz], rotation: [-90, 0, 0] })
  }
}

// « Palonnier au repos » : curseur de 0 (le bout sur la touche, comme dessiné) à 100 % (le servo a relevé le palonnier de 8 degrés autour de son axe).
// Ceux de gauche se relèvent en tournant dans le sens trigonométrique, ceux de droite dans l'autre.
const actions = [
  {
    key: 'rest',
    label: 'Palonnier au repos (servo tourné)',
    default: 0,
    type: 'swing',
    steps: hornIndex.map(({ index, s }) => ({ panels: [index], by: [0, 0, s.sx < 0 ? REST_DEG : -REST_DEG], pivot: [r2(s.xs), r2(PIVOT_Y + t), r2(s.zb)] })),
  },
]

const model = {
  format: 'cnc-model',
  version: 1,
  id: 'boite-volets-nice',
  name: 'Boîte volets Nice',
  description:
    'Une télécommande murale Nice (8 × 8 cm) sur un fond carré, avec ses 3 touches, des bords encastrés et une plaque dessus ; trois servos (un par touche) posés sur la plaque, montrés sans support, dont le palonnier (l’accessoire du servo) appuie au milieu de la touche.',
  // les moteurs sont blancs (corps, embase, axe, palonnier), dans leur propre groupe (famille MOT) : clic droit sur l'un d'eux pour les cacher tous
  colors: {
    Moteurs: '#f5f5f5',
    Embase: '#f5f5f5',
    Palonnier: '#f5f5f5',
    'Axe et vis': '#f5f5f5',
  },
  panels,
  actions,
}
writeFileSync('models/boite-volets-nice.model.json', JSON.stringify(model, null, 1))
console.log('ok', panels.length, 'pièces ; fond', FOND, 'x', FOND, ', axe à', PIVOT_Y, ', portée', REACH, 'mm')
await server.close()
