import * as THREE from 'three'
import type { Pt } from '../core/types'
import type { Panel } from './types'

// Outils pour porter un modèle de testBrick (iris.js, box.js) : mêmes formules, formes en points (y vers le HAUT, comme les THREE.Shape d'origine).

/** Épaisseur du contreplaqué de testBrick (`T` de beam.js). */
export const T = 3

/** Forme de testBrick : contour et trous, y vers le haut. */
export interface Shape2 {
  outer: Pt[]
  holes: Pt[][]
}

export const toShape = (pts: Pt[]): Shape2 => ({ outer: pts, holes: [] })

export const circle = (cx: number, cy: number, r: number, n = 40): Pt[] => Array.from({ length: n }, (_, i): Pt => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)])

/** Trou carré centré de côté `side`, tourné de `ang`. */
export const squareAt = (cx: number, cy: number, side: number, ang = 0): Pt[] => {
  const h = side / 2
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  return ([[-h, -h], [h, -h], [h, h], [-h, h]] as Pt[]).map(([x, y]): Pt => [cx + x * c - y * sn, cy + x * sn + y * c])
}

export const rectHole = (u0: number, v0: number, u1: number, v1: number): Pt[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]

// ---- crans de box.js : `count`, `edgePoints`, `plate` ----

/** Largeur visée d'un cran (mm), `FINGER` de box.js. */
const FINGER = 16

/** Nombre impair de crans sur une longueur (`count` de box.js). */
export const count = (len: number) => Math.max(3, 2 * Math.round((len / FINGER - 1) / 2) + 1)

export interface Side {
  a?: number
  b?: number
  d: number
}

const edgePoints = (len: number, a: number, b: number, d: number): Pt[] => {
  const n = count(b - a)
  const sg = (b - a) / n
  const pts: Pt[] = [[0, 0]]
  for (let k = 1; k < n; k += 2) pts.push([a + k * sg, 0], [a + k * sg, d], [a + (k + 1) * sg, d], [a + (k + 1) * sg, 0])
  pts.push([len, 0])
  return pts
}

/** Plaque w × h, côtés bas, droite, haut, gauche : `d` = T (languettes) ou -T (encoches), 0 = droit ; `a`, `b` : zone crantée (`plate` de box.js). */
export const plate = (w: number, h: number, bottom: Side, right: Side, top: Side, left: Side): Shape2 => {
  const edge = (len: number, e: Side) => edgePoints(len, e.a ?? 0, e.b ?? len, e.d)
  return toShape([
    ...edge(w, bottom).map(([s, d]): Pt => [s, -d]),
    ...edge(h, right).map(([s, d]): Pt => [w + d, s]),
    ...edge(w, top).map(([s, d]): Pt => [s, h + d]).reverse(),
    ...edge(h, left).map(([s, d]): Pt => [-d, s]).reverse(),
  ])
}

// ---- placement : repère de testBrick (Z vertical) → monde de l'app (Y vertical) ----

export type V3 = [number, number, number]

/** (X, Y, Z) de testBrick → (x, y, z) de l'app : le haut (Z) devient Y, l'arrière (Y) devient -Z ; le devant (+X) reste +X. */
const toWorld = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y)

export interface Placed2 {
  shape: Shape2
  /** Point du monde (repère testBrick) où est l'origine (0, 0) de la forme. */
  origin: V3
  /** Axes de la forme dans le monde (x puis y de la forme). */
  ex: V3
  ey: V3
}

/** Une forme de testBrick placée par son origine et ses axes → planche de l'app (extrudée de T le long de ex × ey). `shift` : décalage en repère testBrick (pièce mobile). */
export const placePanel = (p: Placed2, meta: { id: string; category: string; thickness?: number }, shift: V3 = [0, 0, 0]): Panel => {
  const t = meta.thickness ?? T
  const xs = p.shape.outer.map((q) => q[0])
  const ys = p.shape.outer.map((q) => q[1])
  const cxs = (Math.min(...xs) + Math.max(...xs)) / 2
  const cys = (Math.min(...ys) + Math.max(...ys)) / 2
  const ex = new THREE.Vector3(...p.ex)
  const ey = new THREE.Vector3(...p.ey)
  const ez = ex.clone().cross(ey)
  const centre = new THREE.Vector3(...p.origin).add(new THREE.Vector3(...shift)).addScaledVector(ex, cxs).addScaledVector(ey, cys).addScaledVector(ez, t / 2)
  const w = toWorld(centre)
  const basis = new THREE.Matrix4().makeBasis(toWorld(ex), toWorld(ey), toWorld(ez))
  const e = new THREE.Euler().setFromRotationMatrix(basis, 'XYZ')
  const flip = (r: Pt[]): Pt[] => r.map(([x, y]): Pt => [x, -y]) // y vers le haut → v vers le bas
  const r = (v: number) => Math.round(v * 1e4) / 1e4
  return {
    id: meta.id,
    category: meta.category,
    thickness: t,
    outer: flip(p.shape.outer),
    holes: p.shape.holes.map(flip),
    position: [r(w.x), r(w.y), r(w.z)],
    rotation: [r(THREE.MathUtils.radToDeg(e.x)), r(THREE.MathUtils.radToDeg(e.y)), r(THREE.MathUtils.radToDeg(e.z))],
  }
}
