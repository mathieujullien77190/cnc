import { memo } from 'react'
import { categoryCss, DRAWING_COLOR, NAME_COLOR } from '@/core/colors'
import { f, path } from '../svgPath'
import type { SheetPieceProps } from './types'

/** Même pièce au même endroit : inutile de la redessiner (les `Placed` sont recréés à chaque rangement). */
const same = (a: SheetPieceProps, b: SheetPieceProps) =>
  a.it.uid === b.it.uid && a.it.part === b.it.part && a.it.x === b.it.x && a.it.y === b.it.y && a.it.rot === b.it.rot && a.it.angle === b.it.angle &&
  a.bad === b.bad && a.selected === b.selected && a.movable === b.movable && a.onDown === b.onDown &&
  (a.marks === null) === (b.marks === null) && (a.drawings === null) === (b.drawings === null) && a.drag?.dx === b.drag?.dx && a.drag?.dy === b.drag?.dy

/** Une pièce de la planche : contour et trous (avec une zone de prise sur tout le contour), noms et dessins gravés (un tracé chacun). */
export const SheetPiece = memo(function SheetPiece({ it, bad, selected, marks, drawings, drag, movable, onDown }: SheetPieceProps) {
  return (
    <g transform={drag ? `translate(${f(drag.dx)} ${f(drag.dy)})` : undefined} onPointerDown={(e) => onDown(e, it.uid)} className={movable ? 'cursor-move' : ''}>
      {/* zone de prise invisible sur tout le contour : on attrape la pièce même en cliquant dans un de ses trous (une pièce plus petite posée dessus passe avant, elle est dessinée au-dessus) */}
      <path d={path(it.outer)} fill="transparent" stroke="none" />
      <path
        d={[it.outer, ...it.holes].map(path).join('')}
        fillRule="evenodd"
        fill={bad ? 'url(#hachure-conflit)' : categoryCss(it.part.category)}
        stroke={selected ? '#047857' : '#ff0000'}
        strokeWidth={selected ? 1.2 : 0.6}
        strokeLinejoin="round"
      >
        <title>{`${it.part.id}${it.part.category ? ` · ${it.part.category}` : ''}`}</title>
      </path>
      {marks && marks.length > 0 && <path d={marks.map(path).join('')} fill="none" stroke={NAME_COLOR} strokeWidth={0.3} />}
      {drawings && drawings.length > 0 && <path d={drawings.map(path).join('')} fill="none" stroke={DRAWING_COLOR} strokeWidth={0.3} />}
    </g>
  )
}, same)
