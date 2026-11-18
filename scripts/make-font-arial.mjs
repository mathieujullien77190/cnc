// Génère src/core/fontArial.ts : contours aplatis de la police « Arial » (Monotype / Microsoft), lus en place dans C:/Windows/Fonts/arial.ttf (rien n'est copié dans le projet).
// Usage : node scripts/make-font-arial.mjs   (ARIAL_FONT=<chemin> pour une autre copie ; opentype.js n'est utilisé qu'ici, jamais dans le navigateur)
// Licence d'Arial : police propriétaire de Microsoft, usage PERSONNEL seulement (comme Astoria). Le fichier généré n'est pas à redistribuer publiquement.
import { readFileSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'
const { parse } = opentype

const b = readFileSync(process.env.ARIAL_FONT ?? 'C:/Windows/Fonts/arial.ttf')
const font = parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))
const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.'-+:!? ;()/=@&%éèêëàâçôîïûùüœÉÈÀÇ"
const TOL = 1.5 // tolérance d'aplatissement (unités de 1/1000 em)
const SCALE = 1000 / font.unitsPerEm // Arial : 2048 unités par em, ramenées à 1000 comme Astoria

const dist = (p, a, c) => {
  const dx = c[0] - a[0]
  const dy = c[1] - a[1]
  const l = Math.hypot(dx, dy)
  return l === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + c[0] * a[1] - c[1] * a[0]) / l
}
const rdp = (pts, tol) => {
  if (pts.length < 3) return pts
  let m = 0
  let at = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1])
    if (d > m) { m = d; at = i }
  }
  if (m <= tol) return [pts[0], pts[pts.length - 1]]
  return [...rdp(pts.slice(0, at + 1), tol).slice(0, -1), ...rdp(pts.slice(at), tol)]
}

/** Contours fermés d'un glyphe, points [x, y] (y vers le haut), courbes aplaties. */
const contours = (glyph) => {
  const out = []
  let cur = []
  let last
  for (const c of glyph.path.commands) {
    if (c.type === 'M') { if (cur.length) out.push(cur); cur = [[c.x, c.y]] }
    else if (c.type === 'L') cur.push([c.x, c.y])
    else if (c.type === 'C') for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; cur.push([u * u * u * last.x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * last.y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]) }
    else if (c.type === 'Q') for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; cur.push([u * u * last.x + 2 * u * t * c.x1 + t * t * c.x, u * u * last.y + 2 * u * t * c.y1 + t * t * c.y]) }
    else if (c.type === 'Z') { if (cur.length) out.push(cur); cur = [] }
    if (c.type !== 'Z') last = c
  }
  if (cur.length) out.push(cur)
  return out.map((raw) => {
    const p = raw.map(([x, y]) => [x * SCALE, y * SCALE])
    const closed = p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6 ? p.slice(0, -1) : p
    return rdp([...closed, closed[0]], TOL).slice(0, -1).map(([x, y]) => [Math.round(x), Math.round(y)])
  }).filter((p) => p.length >= 3)
}

const bbox = (cs) => {
  const pts = cs.flat()
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) }
}
const shift = (cs, dx) => cs.map((p) => p.map(([x, y]) => [x + dx, y]))

const glyphs = {}
for (const ch of CHARS) {
  const g = font.charToGlyph(ch)
  if (!g || g.index === 0) throw new Error(`caractère absent : ${ch}`)
  glyphs[ch] = { a: Math.round(g.advanceWidth * SCALE), c: contours(g), o: [] }
}

const cap = Math.max(...glyphs.H.c.flat(2).filter((_, i) => i % 2))
const all = Object.values(glyphs).flatMap((g) => [...g.c, ...g.o]).flat()
const top = Math.max(...all.map((p) => p[1]))
const bottom = Math.min(...all.map((p) => p[1]))
const flat = (p) => p.flat().join(',')
const lines = Object.entries(glyphs).map(([ch, g]) => `  ${JSON.stringify(ch)}: { a: ${g.a}, c: [${g.c.map((p) => `[${flat(p)}]`).join(', ')}]${g.o.length ? `, o: [${g.o.map((p) => `[${flat(p)}]`).join(', ')}]` : ''} },`)
const text = `// Fichier GÉNÉRÉ par scripts/make-font-arial.mjs : ne pas modifier à la main.
// Contours aplatis de la police « Arial » (Monotype / Microsoft).
// LICENCE D'ARIAL : police propriétaire de Microsoft, usage PERSONNEL seulement. Ces contours en sont dérivés :
// ne pas redistribuer ce fichier ni le projet publiquement sans cette licence. La police source est lue en place dans C:/Windows/Fonts, rien n'en est copié ici.
// Unités : 1/1000 em, y vers le haut, ligne de base à 0. a = avance, c = contours fermés [x, y, x, y, ...], o = traits ouverts (accents).

import type { ScriptGlyph } from './fontScript'

/** Hauteur des capitales (référence de \`h\`), et plus haut / plus bas point de tous les glyphes. */
export const ARIAL_CAP = ${cap}
export const ARIAL_TOP = ${top}
export const ARIAL_BOTTOM = ${bottom}

export const ARIAL_GLYPHS: Record<string, ScriptGlyph> = {
${lines.join('\n')}
}
`
writeFileSync(new URL('../src/core/fontArial.ts', import.meta.url), text.replace(/\n/g, '\r\n'))
console.log(Object.keys(glyphs).length, 'glyphes,', all.length, 'points, haut', top, 'bas', bottom, 'octets', text.length)
