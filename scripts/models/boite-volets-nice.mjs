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
const H_AXIS = 7.5
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
const WALL_Y = t + HI / 2 - t / 2 // la languette du bas dépasse sous le corps : le centre de la planche est t/2 plus bas
const REMOTE_Z = DI / 2 - FRONT - R / 2 // 17 : centre en z des télécommandes (le dos est tourné vers l'ESP32)

// ---- l'ESP32 : la carte à 38 broches du schéma 3D du site (28 × 52 mm, USB-C du côté du mur droit), posée sur un socle de 2 plaques ----
const ESP_X = 100
const ESP_Z = -46
const SOCLE_N = 2
const ESP_Y = t + SOCLE_N * t + 0.8 // centre de la carte : 9,8
const ESP_LEFT = ['3V3', 'EN', 'VP', 'VN', 'G34', 'G35', 'G32', 'G33', 'G25', 'G26', 'G27', 'G14', 'G12', 'GND', 'G13', 'SD2', 'SD3', 'CMD', '5V']
const ESP_RIGHT = ['GND', 'G23', 'G22', 'TX', 'RX', 'G21', 'GND', 'G19', 'G18', 'G5', 'G17', 'G16', 'G4', 'G0', 'G2', 'G15', 'SD1', 'SD0', 'CLK']
const PIN_X = (i) => ESP_X - 22.86 + 2.54 * i // la broche i (0 : côté antenne) de chaque rangée
const ROW_Z = { left: ESP_Z - 12.7, right: ESP_Z + 12.7 }
const PIN_TOP = ESP_Y + 4.5 + 4 // 18,3 : bout des broches
const pinOf = (name) => {
  const l = ESP_LEFT.indexOf(name)
  if (l >= 0) return { x: PIN_X(l), z: ROW_Z.left, row: 'left' }
  const r = ESP_RIGHT.indexOf(name)
  return { x: PIN_X(r), z: ROW_Z.right, row: 'right' }
}
// Un GPIO par servo (pas de broche de démarrage : 0, 2, 5, 12, 14, 15), de la télécommande de gauche à celle de droite, touche du haut (monter), du milieu (stop), du bas (descendre).
const SERVO_PINS = ['G32', 'G33', 'G25', 'G26', 'G27', 'G13', 'G23', 'G22', 'G21']

// ---- les fenêtres du fond pour les languettes du mur de droite (le seul mur qui reste) ----
const wallWindows = [...windowsFor(DI, t, WI / 2 + FW / 2, false, 0, DI, -DI / 2 + FD / 2)]

// ---- les neuf servos : chacun appuie sur une touche ----
// j = 0 : touche du haut, servo à gauche, corps vers l'arrière ; j = 1 : milieu, servo à droite, corps vers l'arrière ; j = 2 : bas, servo à gauche, corps vers l'avant
const servos = []
for (const rx of REMOTE_X) {
  for (let j = 0; j < 3; j++) {
    const sx = j === 1 ? 1 : -1 // côté de l'axe par rapport au milieu de la touche
    const dir = j === 2 ? -1 : 1 // sens du palonnier le long de z
    const zb = REMOTE_Z + BTN_Z[j]
    servos.push({ rx, j, sx, dir, xs: rx + sx * D, zb, zp: zb - dir * HORN_Z, pin: SERVO_PINS[servos.length] })
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

// murs : crantés en bas (dans le fond) et aux quatre coins ; le haut est lisse
const wallSide = (len) => plateOutline(len, HI, { bottom: { d: t }, left: { d: t }, right: { d: t } }) // côtés : languettes aux deux bouts, dans les encoches

// ---- la cale : trois poches de 80,6 × 80,6 mm qui tiennent les télécommandes ----
const POCKET = R + 0.6
const CALE_W = WI - 0.6
const CALE_Z0 = REMOTE_Z - R / 2 - 6 // 6 mm de bois derrière les poches
const CALE_Z1 = DI / 2 - 0.6
const CALE_D = CALE_Z1 - CALE_Z0
const caleHoles = REMOTE_X.map((rx) => rect(rx + CALE_W / 2 - POCKET / 2, REMOTE_Z - R / 2 - 0.3 - CALE_Z0, POCKET, POCKET))

const panels = [
  { id: 'F', category: 'Fond', thickness: t, outer: rect(0, 0, FW, FD), holes: wallWindows, position: [0, t / 2, 0], rotation: [-90, 0, 0] },
  { id: 'K', category: 'Cale', thickness: t, outer: rect(0, 0, CALE_W, CALE_D), holes: caleHoles, position: [0, t + t / 2, (CALE_Z0 + CALE_Z1) / 2], rotation: [-90, 0, 0] },
  // mur droit : le trou du câble USB de l'ESP32 (14 × 8 mm, centré sur la prise USB-C de la carte posée sur son socle), au fond de la boîte
  { id: 'M', category: 'Mur', thickness: t, outer: wallSide(DI), holes: [rect(10, HI + t - 16, 14, 8)], position: [WI / 2 + t / 2, WALL_Y, 0], rotation: [0, -90, 0] },
  // socle de l'ESP32 : deux plaques empilées
  ...Array.from({ length: SOCLE_N }, (_, k) => ({ id: 'E', category: 'Socle ESP', thickness: t, outer: rect(0, 0, 58, 32), position: [ESP_X, t + t / 2 + k * t, ESP_Z], rotation: [-90, 0, 0] })),
]

// palonniers (l'accessoire pousse la touche) : les servos ne sont tenus par rien dans le modèle (ni plaque, ni bloc, ni planche, ni couvercle)
const hornIndex = []
for (const s of servos) {
  const h = horn(s)
  hornIndex.push({ index: panels.length, s })
  panels.push({ id: 'H', category: 'Palonnier', thickness: HORN_T, outer: h.outer, holes: [h.hole], cut: false, position: h.position })
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
  panels.push({ id: 'AXE', category: 'Axe et vis', thickness: shaft[1], outer: cyl(SHAFT_R), cut: false, position: [r2(s.xs), PIVOT_Y, shaft[0]] })
  const screw = z(LEVER_Z0, LEVER_Z0 + SCREW_L) // la vis centrale, sur le palonnier
  panels.push({ id: 'AXE', category: 'Axe et vis', thickness: screw[1], outer: cyl(SCREW_R), cut: false, position: [r2(s.xs), PIVOT_Y, screw[0]] })
}
for (const rx of REMOTE_X) {
  panels.push({ id: 'T', category: 'Télécommande', thickness: RH, outer: rect(0, 0, R, R), cut: false, position: [rx, t + RH / 2, REMOTE_Z], rotation: [-90, 0, 0] })
  for (const dz of BTN_Z) {
    panels.push({ id: 'B', category: 'Touche', thickness: BTN_RAISE, outer: rect(0, 0, BTN_W, BTN_H), cut: false, position: [rx, BTN_TOP + BTN_RAISE / 2, REMOTE_Z + dz], rotation: [-90, 0, 0] })
  }
}

// l'ESP32 (mêmes cotes que le schéma 3D du site : carte 1,6 mm, module Wi-Fi, USB-C, deux boutons, deux rangées de broches) ; son axe long est x, l'USB-C vers le mur droit
const flat = (id, category, w, d, h, x, y, zc) => panels.push({ id, category, thickness: h, outer: rect(0, 0, w, d), cut: false, position: [r2(x), r2(y), r2(zc)], rotation: [-90, 0, 0] })
flat('E', 'ESP32', 52, 28, 1.6, ESP_X, ESP_Y, ESP_Z) // la carte
flat('E', 'ESP32 composants', 25.5, 18, 3.2, ESP_X - 13.5, ESP_Y + 2.4, ESP_Z) // le module Wi-Fi
flat('E', 'ESP32 composants', 7.5, 9, 3.2, ESP_X + 24.5, ESP_Y + 2.4, ESP_Z) // la prise USB-C
flat('E', 'ESP32 composants', 3.6, 3.6, 2, ESP_X + 20.5, ESP_Y + 1.8, ESP_Z - 7) // les deux boutons
flat('E', 'ESP32 composants', 3.6, 3.6, 2, ESP_X + 20.5, ESP_Y + 1.8, ESP_Z + 7)
flat('E', 'ESP32', 48.3, 2.5, 2.5, ESP_X, ESP_Y + 2.05, ROW_Z.left) // les deux supports de broches
flat('E', 'ESP32', 48.3, 2.5, 2.5, ESP_X, ESP_Y + 2.05, ROW_Z.right)
const gndPin = { x: PIN_X(6), z: ROW_Z.right, row: 'right' } // la deuxième broche GND de la rangée de droite
for (const name of [...SERVO_PINS, '5V', 'GND']) {
  const pin = name === 'GND' ? gndPin : pinOf(name)
  flat('P', 'Broches', 0.64, 0.64, 8, pin.x, ESP_Y + 4.5, pin.z)
}

// « Palonnier au repos » : curseur de 0 (le bout sur la touche, comme dessiné) à 100 % (le servo a relevé le palonnier de 8 degrés autour de son axe).
// Ceux de gauche se relèvent en tournant dans le sens trigonométrique, ceux de droite dans l'autre.
const REST_DEG = 8
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
    'Boîte pour trois télécommandes murales Nice (8 × 8 cm), pilotées par neuf servos SG90 (un par touche) montrés dans la boîte (sans support), dont le palonnier (l’accessoire du servo) appuie au milieu de la touche, et une ESP32. Pas de couvercle ; la cale tient les télécommandes.',
  // les moteurs ont les couleurs du MF90 du schéma du site (corps brun fumé, embase sombre, axe clair, corne noire), dans leur propre groupe (famille MOT) : clic droit sur l'un d'eux pour les cacher tous
  colors: {
    Moteurs: '#4b4640',
    Embase: '#2a2d31',
    Palonnier: '#1b1b1b',
    'Axe et vis': '#cfd3d8',
    ESP32: '#1f2429',
    'ESP32 composants': '#bac1c8',
    Broches: '#c9b25a',
  },
  panels,
  actions,
}
writeFileSync('models/boite-volets-nice.model.json', JSON.stringify(model, null, 1))
console.log('ok', panels.length, 'pièces ; fond', FW, 'x', FD, ', hauteur intérieure', HI, ', axe à', PIVOT_Y, ', portée', REACH, 'mm')
await server.close()
