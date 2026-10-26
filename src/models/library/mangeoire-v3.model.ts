import { circle, count, placePanel, plate, rectHole, T, toShape, type Placed2, type Shape2, type V3 } from '../testbrick'
import { defineModel, type Panel } from '../types'

// Mangeoire à perruches V3 de testBrick (iris.js, trappe à languette), portée : mêmes cotes, mêmes crans (box.js `plate`), mêmes pièces, sauf la planche de plafond sous le plafond du bac les plaques du bas et du haut du boîtier et les goujons de testBrick (remplacés par 4 trous de goujon de 3 × 3 mm dans R-01, BO-01 et BA-02).
// Repère de calcul = celui de testBrick (Z vertical, centré en X et Y, boîtier de l'iris à z = 0) ; `placePanel` le tourne vers le monde de l'app.
//
// Trappe à languette : une languette de contreplaqué 3 mm coulisse entre deux plaques percées d'un trou de Ø 30 ; tirée, son trou vient en face de ceux des plaques (ouvert), poussée, elle les ferme.
// De bas en haut : plaque du bas, cadre (U ouvert sur le devant : fente de la languette), plaque du haut ; puis le réservoir à graines (fond, 4 murs, escalier d'anneaux), son couvercle amovible ;
// sous le boîtier, le bac (3 parois, fond, plafond) et le tiroir. 

const S = 143 // côté du boîtier, le même que le bac dessous
const FRAME_Z = T // dessous du cadre, et de la languette
const TOP_Z = 2 * T // dessous de la plaque du haut
const GATE = { hole: 15, stroke: 36, w: 40, head: 52, headLen: 6, back: 56, front: 106, grip: 11, clear: 0.6 }
const NECK = -GATE.back + GATE.headLen + GATE.stroke

// goujons : 4 trous de 3 × 3 mm (le goujon, large de 3,4, rentre serré) alignés dans le fond du réservoir (R-01), le cadre (BO-01) et le plafond du bac (BA-02)
const DOWEL = { side: 3.4, inset: 9, out: 0 }
const DOWELS: [number, number][] = [-1, 1].flatMap((sy) => [-S / 2 + DOWEL.inset, 50 - DOWEL.inset].map((x): [number, number] => [x, (sy * (S / 2 - DOWEL.inset))]))
const dowelHoles = (sh: Shape2, ox: number, oy: number) => DOWELS.forEach(([x, y]) => sh.holes.push(rectHole(x - ox - T / 2, y - oy - T / 2, x - ox + T / 2, y - oy + T / 2)))

const X: V3 = [1, 0, 0]
const Y: V3 = [0, 1, 0]
const Z: V3 = [0, 0, 1]

// cadre : carré découpé en U ouvert sur le devant : fente de la languette puis loge plus large pour la tête
const frameShape = (): Shape2 => {
  const c = GATE.clear / 2
  const a = GATE.w / 2 + c
  const b = GATE.head / 2 + c
  const h = S / 2
  const back = -GATE.back - 0.5
  const sh = toShape([[-h, -h], [h, -h], [h, -a], [NECK, -a], [NECK, -b], [back, -b], [back, b], [NECK, b], [NECK, a], [h, a], [h, h], [-h, h]])
  return sh
}

// languette (centrée sur l'ouverture, fermée) : bande, tête plus large au fond, trou de Ø 30, bout arrondi percé pour l'index
const tabShape = (): Shape2 => {
  const a = GATE.w / 2
  const b = GATE.head / 2
  const x0 = -GATE.back
  const cx = GATE.front - a
  const pts: [number, number][] = [[x0, -b], [x0 + GATE.headLen, -b], [x0 + GATE.headLen, -a], [cx, -a]]
  for (let k = 1; k < 24; k++) pts.push([cx + a * Math.sin((Math.PI * k) / 24), -a * Math.cos((Math.PI * k) / 24)])
  pts.push([cx, a], [x0 + GATE.headLen, a], [x0 + GATE.headLen, b], [x0, b])
  const sh = toShape(pts)
  sh.holes.push(circle(-GATE.stroke, 0, GATE.hole, 64))
  sh.holes.push(circle(cx, 0, GATE.grip, 40))
  return sh
}

// réservoir : faces extérieures des murs (x0, x1, y), dessous du fond (z), trou, jour
const FUN = { x0: -S / 2, x1: 50, y: S / 2, z: TOP_Z + T, hole: 20, gap: 3, volume: 1e6, wall: 0 }
const tabSpans = (len: number): [number, number][] => {
  const n = count(len)
  const sg = len / n
  const out: [number, number][] = []
  for (let k = 1; k < n; k += 2) out.push([-len / 2 + k * sg, -len / 2 + (k + 1) * sg])
  return out
}
const FI = { xa: FUN.x0 + T, xb: FUN.x1 - T, ya: FUN.y - T, hh: FUN.hole / 2 }

const STEPS = { n: 18, w: 3, ring: 10, min: 3 }
const edge = (v: number, lim: number, dir: number) => (Math.abs(lim - v) < STEPS.min || (v - lim) * dir > 0 ? lim : v)
const stepHole = (j: number) => ({ x0: edge(-FI.hh - STEPS.w * j, FI.xa, -1), x1: edge(FI.hh + STEPS.w * j, FI.xb, 1), y: edge(FI.hh + STEPS.w * j, FI.ya, 1) })
const stepFrame = (j: number) => {
  const h = stepHole(j)
  const open = h.x1 >= FI.xb // ouvert côté droit
  const o = { x0: Math.max(FI.xa, h.x0 - STEPS.ring), x1: Math.min(FI.xb, h.x1 + STEPS.ring), y: Math.min(FI.ya, h.y + STEPS.ring) }
  const u = (x: number) => x - o.x0
  const v = (y: number) => y + o.y
  const sh = open
    ? toShape([[u(o.x0), v(-o.y)], [u(o.x1), v(-o.y)], [u(o.x1), v(-h.y)], [u(h.x0), v(-h.y)], [u(h.x0), v(h.y)], [u(o.x1), v(h.y)], [u(o.x1), v(o.y)], [u(o.x0), v(o.y)]])
    : toShape([[u(o.x0), v(-o.y)], [u(o.x1), v(-o.y)], [u(o.x1), v(o.y)], [u(o.x0), v(o.y)]])
  if (!open) sh.holes.push(rectHole(u(h.x0), v(-h.y), u(h.x1), v(h.y)))
  return { shape: sh, x0: o.x0, y0: -o.y, o, h }
}

const OPEN = { x0: FI.xa, x1: FI.xb, y: FI.ya }

// contenance utile : volume sous le dessous du couvercle, au-dessus de l'escalier, hors du trou, sommé par cellules de 1 mm
const funnelCapacity = (wall: number) => {
  const rings = Array.from({ length: STEPS.n }, (_, j) => stepFrame(j + 1))
  let v = 0
  for (let x = Math.ceil(OPEN.x0) + 0.5; x < OPEN.x1; x++)
    for (let y = -Math.floor(OPEN.y) + 0.5; y < OPEN.y; y++) {
      if (Math.abs(x) < FI.hh && Math.abs(y) < FI.hh) continue
      let top = 0
      rings.forEach(({ o, h }, k) => {
        const inO = x >= o.x0 && x <= o.x1 && Math.abs(y) <= o.y
        const inH = x > h.x0 && x < h.x1 && Math.abs(y) < h.y
        if (inO && !inH) top = (k + 1) * T
      })
      v += Math.max(0, wall - top)
    }
  return v
}
// hauteur des murs : la plus petite (au dixième de mm) qui contient FUN.volume (1 L)
let wallCache = 0
const wallHeight = () => {
  if (wallCache) return wallCache
  let lo = STEPS.n * T
  let hi = 400
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (funnelCapacity(mid) < FUN.volume) lo = mid
    else hi = mid
  }
  wallCache = Math.ceil(hi * 10) / 10
  return wallCache
}

const funnelFloor = (): Shape2 => {
  const W = FUN.x1 - FUN.x0
  const D = 2 * FUN.y
  const sides = { a: T, b: D - T, d: -T }
  const sh = plate(W, D, { d: -T }, sides, { d: -T }, sides)
  sh.holes.push(rectHole(-FUN.x0 - FI.hh, FUN.y - FI.hh, -FUN.x0 + FI.hh, FUN.y + FI.hh))
  dowelHoles(sh, FUN.x0, -FUN.y)
  return sh
}

const BIN_LIFT = 200 + 2 * T // le modèle est remonté de cette hauteur : le dessous du bac est posé sur le quadrillage
const COVER_LIFT = 120 // hauteur dont on soulève le couvercle retiré
const DRAWER_PULL = 140 // course du tiroir tiré

/** Préfixes d'id (ceux de testBrick) : le numéro est ajouté par l'app. */
const PREFIX: Record<string, string> = { Boîtier: 'BO', Réservoir: 'R', Couvercle: 'C', Bac: 'BA', Tiroir: 'T', Iris: 'I', Goujon: 'G' }

interface Item extends Placed2 {
  name: string
  cat: string
}

/** Toutes les pièces à plat, avec leur place dans le repère de testBrick. */
const items = (): Item[] => {
  const list: Item[] = []
  const add = (name: string, cat: string, shape: Shape2, origin: V3, axes: [V3, V3]) => list.push({ name, cat, shape, origin, ex: axes[0], ey: axes[1] })
  const tab = { d: T }
  const notch = { d: -T }
  const flat = { d: 0 }

  // boîtier : seul le cadre (la fente de la languette) est gardé ; les plaques du bas et du haut de testBrick sont supprimées
  const frame = frameShape()
  dowelHoles(frame, 0, 0)
  add('cadre', 'Boîtier', frame, [0, 0, FRAME_Z], [X, Y])

  // réservoir : fond percé, quatre murs, escalier d'anneaux
  const fw = wallHeight()
  const W = FUN.x1 - FUN.x0
  const DEP = 2 * FUN.y
  const addF = (name: string, cat: string, shape: Shape2, origin: V3, axes: [V3, V3]) => add(name, cat, shape, [origin[0], origin[1], origin[2] + FUN.z], axes) // posé sur la plaque du haut
  addF('fond', 'Réservoir', funnelFloor(), [FUN.x0, -FUN.y, 0], [X, Y])
  addF('mur avant', 'Réservoir', plate(W, fw, tab, notch, flat, notch), [FUN.x0, -FUN.y + T, T], [X, Z])
  addF('mur arrière', 'Réservoir', plate(W, fw, tab, notch, flat, notch), [FUN.x0, FUN.y, T], [X, Z])
  addF('mur côté', 'Réservoir', plate(DEP - 2 * T, fw, tab, tab, flat, tab), [FUN.x0, -FUN.y + T, T], [Y, Z])
  addF('mur côté', 'Réservoir', plate(DEP - 2 * T, fw, tab, tab, flat, tab), [FUN.x1 - T, -FUN.y + T, T], [Y, Z])
  for (let j = 1; j <= STEPS.n; j++) {
    const f = stepFrame(j)
    addF('marche', 'Réservoir', f.shape, [f.x0, f.y0, T + (j - 1) * T], [X, Y])
  }
  const zTop = T + fw // haut des murs

  // couvercle amovible : dessus + 4 parois de 12 mm qui descendent DANS les murs, et une poignée à doigts encastrée
  const CAP = { clear: 0, skirt: 12, handleW: 60, handleH: 30 }
  const lx0 = OPEN.x0 + CAP.clear
  const lx1 = OPEN.x1 - CAP.clear
  const ly = OPEN.y - CAP.clear
  const LW = lx1 - lx0
  const LD = 2 * ly
  const lidTop = zTop
  const capTop = toShape([[0, 0], [W, 0], [W, DEP], [0, DEP]])
  const mx = (lx0 + lx1) / 2
  for (const [a, b] of tabSpans(LW)) {
    capTop.holes.push(rectHole(mx + a - FUN.x0, FUN.y - ly, mx + b - FUN.x0, FUN.y - ly + T))
    capTop.holes.push(rectHole(mx + a - FUN.x0, FUN.y + ly - T, mx + b - FUN.x0, FUN.y + ly))
  }
  for (const [a, b] of tabSpans(LD - 2 * T)) {
    capTop.holes.push(rectHole(lx0 - FUN.x0, FUN.y + a, lx0 - FUN.x0 + T, FUN.y + b))
    capTop.holes.push(rectHole(lx1 - T - FUN.x0, FUN.y + a, lx1 - FUN.x0, FUN.y + b))
  }
  for (const [a, b] of tabSpans(CAP.handleW)) capTop.holes.push(rectHole(mx + a - FUN.x0, FUN.y - T / 2, mx + b - FUN.x0, FUN.y + T / 2))
  addF('dessus du couvercle', 'Couvercle', capTop, [FUN.x0, -FUN.y, lidTop], [X, Y])
  const hs = CAP.skirt
  addF('rebord avant', 'Couvercle', plate(LW, hs, flat, notch, tab, notch), [lx0, -ly + T, lidTop - hs], [X, Z])
  addF('rebord arrière', 'Couvercle', plate(LW, hs, flat, notch, tab, notch), [lx0, ly, lidTop - hs], [X, Z])
  addF('rebord côté', 'Couvercle', plate(LD - 2 * T, hs, flat, tab, tab, tab), [lx0, -ly + T, lidTop - hs], [Y, Z])
  addF('rebord côté', 'Couvercle', plate(LD - 2 * T, hs, flat, tab, tab, tab), [lx1 - T, -ly + T, lidTop - hs], [Y, Z])
  const handle = plate(CAP.handleW, CAP.handleH, tab, flat, flat, flat)
  {
    // trou pour les doigts : un stade de 36 × 10 mm
    const hx = CAP.handleW / 2
    const hy = CAP.handleH * 0.55
    const pts: [number, number][] = []
    for (let k = 0; k <= 12; k++) pts.push([hx + 13 + 5 * Math.cos(-Math.PI / 2 + (Math.PI * k) / 12), hy + 5 * Math.sin(-Math.PI / 2 + (Math.PI * k) / 12)])
    for (let k = 0; k <= 12; k++) pts.push([hx - 13 + 5 * Math.cos(Math.PI / 2 + (Math.PI * k) / 12), hy + 5 * Math.sin(Math.PI / 2 + (Math.PI * k) / 12)])
    handle.holes.push(pts)
  }
  addF('poignée', 'Couvercle', handle, [mx - CAP.handleW / 2, T / 2, lidTop + T], [X, Z])

  // bac sous le boîtier : trois parois, un fond, un plafond ; le devant (côté de la manivelle, +x) reste ouvert
  const BS = 143
  const BIN_H = 200
  const BIN_Z0 = -BIN_H - T
  const binFloor = plate(BS, BS, { a: T, b: BS, d: -T }, flat, { a: T, b: BS, d: -T }, notch)
  add('fond du bac', 'Bac', binFloor, [-BS / 2, -BS / 2, BIN_Z0 - T], [X, Y])
  const binCeiling = plate(BS, BS, { a: T, b: BS, d: -T }, flat, { a: T, b: BS, d: -T }, notch)
  binCeiling.holes.push(circle(BS / 2, BS / 2, 15, 64))
  dowelHoles(binCeiling, -BS / 2, -BS / 2)
  add('plafond du bac', 'Bac', binCeiling, [-BS / 2, -BS / 2, -T], [X, Y])
  add('paroi du fond', 'Bac', plate(BS, BIN_H, tab, notch, tab, notch), [-BS / 2, -BS / 2, BIN_Z0], [Y, Z])
  add('paroi côté', 'Bac', plate(BS - T, BIN_H, tab, flat, tab, tab), [-BS / 2 + T, -BS / 2 + T, BIN_Z0], [X, Z])
  add('paroi côté', 'Bac', plate(BS - T, BIN_H, tab, flat, tab, tab), [-BS / 2 + T, BS / 2, BIN_Z0], [X, Z])

  // tiroir : boîte ouverte de 4 cm de haut dans le bac, à glisser vers le devant (+x) ; poignée en U de 4 couches collées
  const DR = { h: 40, handleL: 30, handleW: 60, handleArm: 8, layers: 4 }
  const drX0 = -BS / 2 + T
  const drX1 = BS / 2
  const drL = drX1 - drX0
  const drW = BS - 2 * T
  const drWall = DR.h - T
  const drSide = { a: T, b: drL - T, d: -T }
  add('fond du tiroir', 'Tiroir', plate(drL, drW, drSide, notch, drSide, notch), [drX0, -drW / 2, BIN_Z0], [X, Y])
  const front = plate(drW, drWall, tab, notch, flat, notch)
  const hz = (drWall - DR.layers * T) / 2
  for (const [a, b] of [[DR.handleW / 2 - DR.handleArm, DR.handleW / 2], [-DR.handleW / 2, -DR.handleW / 2 + DR.handleArm]]) front.holes.push(rectHole(drW / 2 + a, hz, drW / 2 + b, hz + DR.layers * T))
  add('devant du tiroir', 'Tiroir', front, [drX1 - T, -drW / 2, BIN_Z0 + T], [Y, Z])
  const hw2 = DR.handleW / 2
  const hi = hw2 - DR.handleArm
  const handleU = toShape([[-T, -hw2], [DR.handleL, -hw2], [DR.handleL, hw2], [-T, hw2], [-T, hi], [DR.handleL - DR.handleArm, hi], [DR.handleL - DR.handleArm, -hi], [-T, -hi]])
  const hz0 = BIN_Z0 + T + (drWall - DR.layers * T) / 2
  for (let k = 0; k < DR.layers; k++) add('poignée du tiroir', 'Tiroir', handleU, [drX1, 0, hz0 + k * T], [X, Y])
  // (la « planche de plafond » de testBrick, posée à plat sous le plafond du bac, est supprimée : un seul plafond)
  add('derrière du tiroir', 'Tiroir', plate(drW, drWall, tab, notch, flat, notch), [drX0, -drW / 2, BIN_Z0 + T], [Y, Z])
  add('côté du tiroir', 'Tiroir', plate(drL - 2 * T, drWall, tab, tab, flat, tab), [drX0 + T, -drW / 2 + T, BIN_Z0 + T], [X, Z])
  add('côté du tiroir', 'Tiroir', plate(drL - 2 * T, drWall, tab, tab, flat, tab), [drX0 + T, drW / 2, BIN_Z0 + T], [X, Z])

  // pièce mobile : la languette, dans l'épaisseur du cadre
  add('languette', 'Iris', tabShape(), [0, 0, FRAME_Z], [X, Y])

  // goujons : lamelles de 3,4 mm de large (dans l'épaisseur du contreplaqué) debout dans les trous, de dessous le plafond du bac à dessus du fond du réservoir (3 plaques), sans dépasser
  const dl = 3 * T + 2 * DOWEL.out
  for (const [x, y] of DOWELS) add('goujon', 'Goujon', toShape([[0, 0], [DOWEL.side, 0], [DOWEL.side, dl], [0, dl]]), [x - DOWEL.side / 2, y + T / 2, -T - DOWEL.out], [X, Z])
  return list
}

export default defineModel({
  id: 'mangeoire-v3',
  name: 'Mangeoire à perruches V3',
  description: 'Trappe à languette, réservoir à graines, couvercle, bac et tiroir (testBrick).',
  params: [
    { key: 'gate', label: 'Languette tirée (ouvert)', type: 'boolean', default: true },
    { key: 'cover', label: 'Couvercle posé', type: 'boolean', default: true },
    { key: 'drawer', label: 'Tiroir tiré', type: 'boolean', default: false },
  ],
  build: (p) => {
    const gateOpen = p.gate as boolean
    const coverOn = p.cover as boolean
    const drawerOut = p.drawer as boolean
    // sans les plaques du bas et du haut, le réservoir descend de 2 T et le bac reste en place : tout touche le cadre (dessus et dessous)
    const shiftOf = (cat: string, name: string): V3 => {
      if (name === 'languette') return [gateOpen ? GATE.stroke : 0, 0, BIN_LIFT - T]
      if (cat === 'Boîtier') return [0, 0, BIN_LIFT - T]
      if (cat === 'Réservoir') return [0, 0, BIN_LIFT - 2 * T]
      if (cat === 'Couvercle') return [0, 0, BIN_LIFT - 2 * T + (coverOn ? 0 : COVER_LIFT)]
      if (cat === 'Tiroir') return [drawerOut ? DRAWER_PULL : 0, 0, BIN_LIFT]
      return [0, 0, BIN_LIFT]
    }
    // la languette porte la couleur du boîtier (marron)
    const panels: Panel[] = items().map((it) => placePanel(it, { id: PREFIX[it.cat], category: it.name === 'languette' ? 'Boîtier' : it.cat }, shiftOf(it.cat, it.name)))

    return { panels }
  },
})
