// Export des pièces à découper au format « cnc-parts » (voir docs/FORMAT.md).
// Module autonome, sans dépendance : à copier tel quel dans un projet three.js.
//
//   import { toCutParts, downloadCutParts } from './exportParts.js'
//   downloadCutParts(toCutParts(pieces, { project: 'exemple', thickness: 3 }), 'exemple')
//
// `pieces` : tableau de pièces à plat { outer: [[x, y], …], holes: [[[x, y], …], …], … } en millimètres, y vers le bas.
// Plusieurs pièces qui portent le même identifiant (`id`) sont regroupées en une seule entrée avec `qty`.

const r3 = (v) => Math.round(v * 1000) / 1000
const round = (poly) => poly.map(([x, y]) => [r3(x), r3(y)])

// Signature d'une pièce indépendante de sa position et d'une rotation de 180° (même pièce posée à l'envers) : points triés après recalage sur la boîte englobante.
const signature = (outer, holes) => {
  const xs = outer.map((p) => p[0])
  const ys = outer.map((p) => p[1])
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const sorted = (f) => [outer, ...holes].map((poly) => poly.map(([x, y]) => f(x - x0, y - y0)).map((p) => `${r3(p[0])},${r3(p[1])}`).sort().join(';')).sort().join('|')
  const a = sorted((x, y) => [x, y])
  const b = sorted((x, y) => [x1 - x0 - x, y1 - y0 - y])
  return a < b ? a : b
}

/**
 * @param {object[]} pieces
 * @param {object} o
 * @param {string} o.project nom du projet (préfixe des identifiants dans l'app)
 * @param {number | ((p: object) => number)} o.thickness épaisseur du matériau en mm, ou fonction pièce → épaisseur
 * @param {string | ((p: object) => string)} [o.material] défaut « contreplaque »
 * @param {(p: object) => string} [o.id] défaut `p.code ?? p.id`
 * @param {(p: object) => string} [o.category] défaut `p.cat ?? p.category ?? ''`
 * @param {(p: object) => 'any90' | 'none'} [o.rotate] défaut « any90 » (rotation de 90° permise)
 * @returns {{ file: object, warnings: string[] }}
 */
export const toCutParts = (pieces, o) => {
  const pick = (v, p) => (typeof v === 'function' ? v(p) : v)
  const id = o.id ?? ((p) => p.code ?? p.id)
  const category = o.category ?? ((p) => p.cat ?? p.category ?? '')
  const warnings = []
  const byId = new Map()
  for (const p of pieces) {
    const name = String(id(p) ?? '').trim()
    if (!name) {
      warnings.push('pièce sans identifiant ignorée')
      continue
    }
    const outer = round(p.outer)
    const holes = (p.holes ?? []).map(round)
    const known = byId.get(name)
    if (known) {
      // même identifiant : on compte un exemplaire de plus, mais deux contours différents sous le même nom sont une erreur de nommage
      if (known.sig !== signature(outer, holes)) warnings.push(`« ${name} » : deux contours différents portent le même identifiant`)
      known.qty++
      continue
    }
    byId.set(name, {
      sig: signature(outer, holes),
      id: name,
      category: category(p),
      qty: 1,
      thickness: pick(o.thickness, p),
      material: pick(o.material ?? 'contreplaque', p),
      rotate: o.rotate ? o.rotate(p) : 'any90',
      outer,
      holes,
    })
  }
  return { file: { format: 'cnc-parts', version: 1, project: o.project, unit: 'mm', parts: [...byId.values()].map(({ sig, ...part }) => part) }, warnings }
}

/** Télécharge le fichier `<nom>.cutparts.json` (navigateur). */
export const downloadCutParts = ({ file, warnings }, name) => {
  if (warnings.length) console.warn(`Export CNC : ${warnings.join(' ; ')}`)
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.cutparts.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
