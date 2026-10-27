import { categoryCss, DRAWING_COLOR } from './colors'
import { frameRect } from './job'
import { drawingsFor, marksFor } from './sheets'
import type { Marking, Pt, Sheet } from './types'

const f = (v: number) => Math.round(v * 1000) / 1000
const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * Planche en SVG, unités mm (y vers le bas, origine en haut à gauche).
 * Export : calque « coupe » rouge, calque « gravure » bleu (cadre et noms selon `marking`), sans remplissage.
 * Aperçu : pièces remplies ; `bad` = uid des pièces en conflit (rouge hachuré).
 */
export const sheetSvg = (sheet: Sheet, { marking, preview = false, bad = new Set<string>() }: { marking: Marking; preview?: boolean; bad?: Set<string> }): string => {
  const { width: W, height: H } = sheet
  const size = preview ? '' : ` width="${W}mm" height="${H}mm"`
  const cutPaths = sheet.items
    .map((it) => {
      const d = [it.outer, ...it.holes].map(path).join('')
      const fill = preview ? ` fill="${bad.has(it.uid) ? 'url(#hachure-conflit)' : categoryCss(it.part.category)}" fill-rule="evenodd"` : ''
      return `<path data-uid="${esc(it.uid)}" d="${d}"${fill}><title>${esc(it.part.id)}${it.part.category ? ` · ${esc(it.part.category)}` : ''}</title></path>`
    })
    .join('\n')
  const frame = marking.frame ? frameRect(sheet) : null
  const marks = [...(frame ? [frame] : []), ...(marking.names ? [...[...marksFor(sheet).values()].flat()] : [])].map((r) => `<path d="${path(r)}"/>`).join('')
  const drawings = (marking.drawings !== false ? [...drawingsFor(sheet).values()].flat() : []).map((r) => `<path d="${path(r)}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="0 0 ${W} ${H}">${preview ? '<defs><pattern id="hachure-conflit" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#fde2e2"/><line x1="0" y1="0" x2="0" y2="3" stroke="#dc2626" stroke-width="1.2"/></pattern></defs>' : ''}
<rect id="planche" x="0" y="0" width="${W}" height="${H}" fill="${preview ? '#f7f0e2' : 'none'}" stroke="#888888" stroke-width="${preview ? 0.8 : 0.1}"/>
<g id="coupe" fill="none" stroke="#ff0000" stroke-width="${preview ? 0.6 : 0.1}" stroke-linejoin="round">
${cutPaths}
</g>
<g id="gravure" fill="none" stroke="#0000ff" stroke-width="${preview ? 0.4 : 0.1}">${marks}</g>
<g id="dessins" fill="none" stroke="${DRAWING_COLOR}" stroke-width="${preview ? 0.4 : 0.1}">${drawings}</g>
</svg>
`
}
