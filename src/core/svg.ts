import { frameRect } from './job'
import { boardMark, marksFor } from './sheets'
import type { Marking, Pt, Sheet } from './types'

const f = (v: number) => Math.round(v * 1000) / 1000
const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const PALETTE = ['#e3d4b5', '#d9c3a0', '#c9d8c5', '#cdd5e3', '#e3cdd5', '#e0d9a8']

/**
 * Planche en SVG, unités mm (y vers le bas, origine en haut à gauche).
 * Export : calque « coupe » rouge, calque « gravure » bleu (cadre et noms selon `marking`), sans remplissage.
 * Aperçu : pièces remplies ; `bad` = uid des pièces en conflit (rouge).
 */
export const sheetSvg = (sheet: Sheet, { marking, preview = false, bad = new Set<string>() }: { marking: Marking; preview?: boolean; bad?: Set<string> }): string => {
  const { width: W, height: H } = sheet
  const size = preview ? '' : ` width="${W}mm" height="${H}mm"`
  const cats = [...new Set(sheet.items.map((it) => it.part.category))]
  const cutPaths = sheet.items
    .map((it) => {
      const d = [it.outer, ...it.holes].map(path).join('')
      const fill = preview ? ` fill="${bad.has(it.uid) ? '#f3a6a6' : PALETTE[cats.indexOf(it.part.category) % PALETTE.length]}" fill-rule="evenodd"` : ''
      return `<path data-uid="${esc(it.uid)}" d="${d}"${fill}><title>${esc(it.part.id)}${it.part.category ? ` · ${esc(it.part.category)}` : ''}</title></path>`
    })
    .join('\n')
  const frame = marking.frame ? frameRect(sheet) : null
  const marks = [...(frame ? [frame] : []), ...(marking.names ? [...boardMark(sheet), ...[...marksFor(sheet).values()].flat()] : [])].map((r) => `<path d="${path(r)}"/>`).join('')
  const labels = preview
    ? sheet.items
        .map((it) => {
          const fs = Math.max(3, Math.min(10, Math.min(it.w, it.h) * 0.35))
          return `<text x="${f(it.x + it.w / 2)}" y="${f(it.y + it.h / 2)}" font-size="${f(fs)}" text-anchor="middle" dominant-baseline="central">${esc(it.part.id)}</text>`
        })
        .join('')
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="0 0 ${W} ${H}">
<rect id="planche" x="0" y="0" width="${W}" height="${H}" fill="${preview ? '#f7f0e2' : 'none'}" stroke="#888888" stroke-width="${preview ? 0.8 : 0.1}"/>
<g id="coupe" fill="none" stroke="#ff0000" stroke-width="${preview ? 0.6 : 0.1}" stroke-linejoin="round">
${cutPaths}
</g>
<g id="gravure" fill="none" stroke="#0000ff" stroke-width="${preview ? 0.4 : 0.1}">${marks}</g>
${preview ? `<g id="noms" fill="#1a1a1a" stroke="none" font-family="system-ui, sans-serif" pointer-events="none">${labels}</g>` : ''}
</svg>
`
}
