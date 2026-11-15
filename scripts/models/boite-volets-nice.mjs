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
const { rect, circle, plateOutline, windowsFor } = await server.ssrLoadModule('/src/models/helpers.ts')

const t = 3
const r2 = (n) => Math.round(n * 1000) / 1000

// ---- les télécommandes ----
const R = 80 // côté (mm), carré
const RH = 10 // épaisseur
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
const BORD_H = 12 // hauteur des bords autour de la télécommande
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
const LONG = R + 2 * t // devant et derrière
const half = FOND / 2
const wy = t + BORD_H / 2
const windowsAt = (h) => [
  ...windowsFor(LONG, t, h + R / 2, true, 0, LONG, h - R / 2 - t), // devant
  ...windowsFor(LONG, t, h - R / 2 - t, true, 0, LONG, h - R / 2 - t), // derrière
  ...windowsFor(R, t, h - R / 2 - t, false, 0, R, h - R / 2), // côté gauche
  ...windowsFor(R, t, h + R / 2, false, 0, R, h - R / 2), // côté droit
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
for (const sz of [-1, 1]) panels.push(standing(LONG, (cu, y) => ({ position: [r2(rx0 - LONG / 2 + cu), r2(y), r2(REMOTE_Z + sz * (R / 2 + t / 2))] })))
for (const sx of [-1, 1]) panels.push(standing(R, (cu, y) => ({ position: [r2(rx0 + sx * (R / 2 + t / 2)), r2(y), r2(REMOTE_Z - R / 2 + cu)], rotation: [0, -90, 0] })))

// palonniers (l'accessoire pousse la touche) : les servos ne sont tenus par rien dans le modèle (ni plaque, ni bloc, ni planche, ni couvercle)
const hornIndex = []
for (const s of servos) {
  const h = horn(s)
  hornIndex.push({ index: panels.length, s })
  panels.push({ id: 'MOT', category: 'Palonnier', thickness: HORN_T, outer: h.outer, holes: [h.hole], cut: false, position: h.position })
}

// la plaque posée sur les bords (à la taille de la télécommande avec ses bords : 86 × 86 ; des encoches sur son pourtour reçoivent les languettes du haut des bords) ; les servos sont posés dessus, le palonnier passe dessous par une fente
// (un rectangle de l'épaisseur du palonnier, qui couvre le trajet du palonnier de sa position jusqu'à l'angle de repos)
const SLOT_MORE_L = 20
const SLOT_BAR = 3 // bois mini entre deux fentes (mm)
const SLOT_W = Math.min(BTN_Z[1] - BTN_Z[0], BTN_Z[2] - BTN_Z[1]) - SLOT_BAR // largeur des fentes (9 mm : les touches sont à 12 et 13 mm l'une de l'autre)
const slotOf = (s) => {
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
  return rect(r2(x0 - SLOT_MORE_L / 2 - (rx0 - LONG / 2)), r2(s.zb - SLOT_W / 2 - (REMOTE_Z - LONG / 2)), r2(x1 - x0 + SLOT_MORE_L), SLOT_W)
}
const lidAt = panels.length
panels.push({ id: 'C', category: 'Couvercle', thickness: t, outer: plateOutline(LONG, LONG, { top: { d: -t }, bottom: { d: -t }, left: { d: -t, a: t, b: LONG - t }, right: { d: -t, a: t, b: LONG - t } }), holes: servos.map(slotOf), position: [rx0, LID_TOP - t / 2, REMOTE_Z], rotation: [-90, 0, 0] })

// un support en U (3 mm de large) posé sur la plaque autour du cul du moteur du milieu, par-dessus 3 L (le bras de gauche manque : les fils du servo sortent de ce côté), puis une plaque carrée sur le dessus du moteur ; d'autres couches s'empileront ensuite. Le U entoure le corps sans jeu, ouvert vers l'axe du servo.
const ENGR_BOIS = 1.2 // bois mini entre un trait gravé et une fente
const U_W = 3 // largeur des bras du U
const U_ARM = SERVO_DEPTH - BODY_TOP + t / 2 // longueur des bras à partir du cul : ils vont jusqu'aux ailettes (les oreilles du servo, qui commencent à t / 2 de la plaque de l'axe)
{
  const s = servos[1]
  const cx = s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END) // milieu du corps en x
  const rear = s.zp - s.dir * (SERVO_DEPTH - BODY_TOP) // le cul : le bout du corps, à l'opposé du palonnier
  const bx0 = cx - SERVO_L / 2
  const bx1 = cx + SERVO_L / 2
  const zOut = rear - s.dir * U_W // derrière le fond du U
  const zEnd = rear + s.dir * U_ARM // le bout des bras
  // contour en x, z (monde), dans l'ordre : fond du U, bras droit, bras gauche
  const world = [[bx0 - U_W, zOut], [bx1 + U_W, zOut], [bx1 + U_W, zEnd], [bx1, zEnd], [bx1, rear], [bx0, rear], [bx0, zEnd], [bx0 - U_W, zEnd]]
  const put = (world, level) => {
    const xmin = Math.min(...world.map((q) => q[0]))
    const zmin = Math.min(...world.map((q) => q[1]))
    const xmax = Math.max(...world.map((q) => q[0]))
    const zmax = Math.max(...world.map((q) => q[1]))
    panels.push({ id: 'U', category: 'Support moteur', thickness: t, outer: world.map(([x, z]) => [r2(x - xmin), r2(z - zmin)]), position: [r2((xmin + xmax) / 2), r2(LID_TOP + (level + 0.5) * t), r2((zmin + zmax) / 2)], rotation: [-90, 0, 0] })
  }
  put(world, 0) // le U sur la plaque
  // son emplacement est gravé sur la plaque (C-01) : le contour du U, en traits
  // (les parties qui tombent dans une fente, ou à moins de ENGR_BOIS d'elle, ne sont pas gravées : un dessin reste sur du bois plein)
  const o = [rx0 - LONG / 2, REMOTE_Z - LONG / 2]
  const holes = panels[lidAt].holes.map((h) => {
    const us = h.map((q) => q[0])
    const vs = h.map((q) => q[1])
    return [Math.min(...us) - ENGR_BOIS, Math.min(...vs) - ENGR_BOIS, Math.max(...us) + ENGR_BOIS, Math.max(...vs) + ENGR_BOIS]
  })
  const rules = []
  world.forEach(([x, z], i) => {
    const [x2, z2] = world[(i + 1) % world.length]
    const a = [x - o[0], z - o[1]]
    const b = [x2 - o[0], z2 - o[1]]
    // les bouts du segment qui sont hors de toutes les fentes (le long d'un segment horizontal ou vertical)
    let spans = [[0, 1]]
    for (const [u0, v0, u1, v1] of holes) {
      const lo = (a[0] === b[0] ? (a[0] > u0 && a[0] < u1 ? [Math.min(a[1], b[1]), Math.max(a[1], b[1]), v0, v1, a[1] < b[1]] : null) : a[1] > v0 && a[1] < v1 ? [Math.min(a[0], b[0]), Math.max(a[0], b[0]), u0, u1, a[0] < b[0]] : null)
      if (!lo) continue
      const len = lo[1] - lo[0]
      const c0 = Math.max(0, (lo[2] - lo[0]) / len)
      const c1 = Math.min(1, (lo[3] - lo[0]) / len)
      if (c1 <= c0) continue
      const [t0, t1] = lo[4] ? [c0, c1] : [1 - c1, 1 - c0]
      spans = spans.flatMap(([s0, s1]) => (t1 <= s0 || t0 >= s1 ? [[s0, s1]] : [[s0, Math.min(s1, t0)], [Math.max(s0, t1), s1]].filter(([p, q]) => q > p)))
    }
    for (const [s0, s1] of spans) rules.push([r2(a[0] + (b[0] - a[0]) * s0), r2(a[1] + (b[1] - a[1]) * s0), r2(a[0] + (b[0] - a[0]) * s1), r2(a[1] + (b[1] - a[1]) * s1)])
  })
  panels[lidAt].rules = rules
  // par-dessus : un L, sans le bras de gauche (côté bx0, où sortent les fils du servo)
  for (const level of [1, 2, 3]) put([[bx0, zOut], [bx1 + U_W, zOut], [bx1 + U_W, zEnd], [bx1, zEnd], [bx1, rear], [bx0, rear]], level)
  // tout en haut : une plaque carrée (la largeur du U) qui recouvre le dessus du moteur, posée sur les L
  const SQ = bx1 - bx0 + 2 * U_W
  put([[bx0 - U_W, zOut], [bx1 + U_W, zOut], [bx1 + U_W, zOut + s.dir * SQ], [bx0 - U_W, zOut + s.dir * SQ]], 4)
}

// pièces montrées mais non découpées : servos, axes, télécommandes, touches
const cyl = (r) => circle(0, 0, r, 24)
for (const s of servos) {
  const z = (a, b) => [r2(s.zp + s.dir * ((a + b) / 2)), Math.abs(b - a)] // [centre en z, épaisseur] d'un étage de la pile (de a à b depuis le centre de la plaque)
  const body = z(-(SERVO_DEPTH - BODY_TOP), BODY_TOP) // du fond du corps jusqu'à son haut
  panels.push({ id: 'MOT', category: 'Moteurs', thickness: body[1], outer: rect(0, 0, SERVO_L, SERVO_W), cut: false, position: [r2(s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END)), PIVOT_Y, body[0]] })
  const ears = z(t / 2, t / 2 + 2.5)
  panels.push({ id: 'MOT', category: 'Moteurs', thickness: ears[1], outer: rect(0, 0, EARS_L, SERVO_W), cut: false, position: [r2(s.xs + s.sx * (SERVO_L / 2 - PIVOT_FROM_END)), PIVOT_Y, ears[0]] })
  const boss = z(BODY_TOP, HORN_Z0)
  panels.push({ id: 'MOT', category: 'Embase', thickness: boss[1], outer: cyl(BOSS_R), cut: false, position: [r2(s.xs), PIVOT_Y, boss[0]] })
  const shaft = z(BODY_TOP, LEVER_Z0) // l'axe cannelé traverse l'embase et le palonnier
  panels.push({ id: 'MOT', category: 'Axe et vis', thickness: shaft[1], outer: cyl(SHAFT_R), cut: false, position: [r2(s.xs), PIVOT_Y, shaft[0]] })
  const screw = z(LEVER_Z0, LEVER_Z0 + SCREW_L) // la vis centrale, sur le palonnier
  panels.push({ id: 'MOT', category: 'Axe et vis', thickness: screw[1], outer: cyl(SCREW_R), cut: false, position: [r2(s.xs), PIVOT_Y, screw[0]] })
}
for (const rx of [REMOTE_X[0]]) {
  panels.push({ id: 'T', category: 'Télécommande', thickness: RH, outer: rect(0, 0, R, R), cut: false, position: [rx, t + RH / 2, REMOTE_Z], rotation: [-90, 0, 0] })
  for (const dz of BTN_Z) {
    panels.push({ id: 'B', category: 'Touche', thickness: BTN_RAISE, outer: rect(0, 0, BTN_W, BTN_H), cut: false, position: [rx, BTN_TOP + BTN_RAISE / 2, REMOTE_Z + dz], rotation: [-90, 0, 0] })
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
    steps: hornIndex.map(({ index, s }) => ({ panels: [index], by: [0, 0, s.sx < 0 ? REST_DEG : -REST_DEG], pivot: [r2(s.xs), PIVOT_Y, r2(s.zb)] })),
  },
]

const model = {
  format: 'cnc-model',
  version: 1,
  id: 'boite-volets-nice',
  name: 'Boîte volets Nice',
  description:
    'Une télécommande murale Nice (8 × 8 cm) sur un fond carré, avec ses 3 touches, des bords encastrés et une plaque dessus ; trois servos (un par touche) posés sur la plaque, montrés sans support, dont le palonnier (l’accessoire du servo) appuie au milieu de la touche.',
  // les moteurs ont les couleurs du MF90 du schéma du site (corps brun fumé, embase sombre, axe clair, corne noire), dans leur propre groupe (famille MOT) : clic droit sur l'un d'eux pour les cacher tous
  colors: {
    Moteurs: '#4b4640',
    Embase: '#2a2d31',
    Palonnier: '#1b1b1b',
    'Axe et vis': '#cfd3d8',
  },
  panels,
  actions,
}
writeFileSync('models/boite-volets-nice.model.json', JSON.stringify(model, null, 1))
console.log('ok', panels.length, 'pièces ; fond', FOND, 'x', FOND, ', axe à', PIVOT_Y, ', portée', REACH, 'mm')
await server.close()
