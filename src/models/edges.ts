import type { Panel } from './types'

/**
 * Arêtes noires d'une planche dans la vue 3D, tracées depuis ses contours : face avant, face arrière, et arête verticale aux vrais angles seulement.
 * Jamais `EdgesGeometry` : la triangulation d'une face à fenêtres alignées crée des triangles plats entre elles, d'où de faux traits noirs d'une fenêtre à l'autre.
 * Renvoie des paires de points (x, y, z) à plat, repère de la planche centrée sur sa boîte englobante.
 */
export const contourEdges = (p: Panel, cx: number, cy: number): number[] => {
  const lines: number[] = []
  const z = p.thickness / 2
  for (const ring of [p.outer, ...(p.holes ?? [])]) {
    const n = ring.length
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % n]
      const prev = ring[(i + n - 1) % n]
      const [ax, ay, bx, by] = [a[0] - cx, -(a[1] - cy), b[0] - cx, -(b[1] - cy)]
      lines.push(ax, ay, z, bx, by, z, ax, ay, -z, bx, by, -z)
      const turn = Math.abs(Math.atan2((b[1] - a[1]) * (a[0] - prev[0]) - (b[0] - a[0]) * (a[1] - prev[1]), (b[0] - a[0]) * (a[0] - prev[0]) + (b[1] - a[1]) * (a[1] - prev[1])))
      if (turn > 0.45) lines.push(ax, ay, -z, ax, ay, z)
    })
  }
  return lines
}
