import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { frameRect } from '@/core/job'
import { angleOf, drawingsFor, turnTo } from '@/core/sheets'
import { round1 } from '@/helpers'
import SheetPiece from './SheetPiece'
import ToolButton from './ToolButton'
import { MAX_ZOOM, MIN_ZOOM, STEP } from './constants'
import { toMm } from './helpers'
import { f, path } from './svgPath'
import type { Drag, Pan, SheetPreviewProps } from './types'
import { useMarks } from './useMarks'
import { useSheetView } from './useSheetView'

/**
 * Aperçu d'une planche en SVG, zoomable : molette pour zoomer vers le curseur, glisser le fond pour déplacer la vue, boutons + / − / ajuster, ⤢ pour agrandir en plein écran.
 * Avec `interact`, on déplace une pièce en la glissant et on la tourne avec la touche R.
 */
export const SheetPreview = ({ sheet, marking, bad, interact, highlight }: SheetPreviewProps) => {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pan, setPan] = useState<Pan | null>(null)
  const [full, setFull] = useState(false)
  const { view, setView, vh, zoomed, clamp, reset, zoomCenter } = useSheetView(sheet, svg)
  const frame = marking.frame ? frameRect(sheet) : null
  const marks = useMarks(sheet, marking)
  const drawings = useMemo(() => (marking.drawings !== false ? drawingsFor(sheet) : null), [sheet, marking.drawings])
  const selected = interact?.selected ?? null

  // Échap ferme le plein écran
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  // touche R : tourne la pièce choisie de 90°
  useEffect(() => {
    if (!interact || !selected) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'r' && e.key !== 'R') || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('input, select, textarea')) return
      const it = sheet.items.find((i) => i.uid === selected)
      if (!it || it.part.rotate === 'none') return
      e.preventDefault()
      interact.onCommit(it.uid, turnTo(it, angleOf(it) + 90))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interact, selected, sheet.items])

  const downPieceNow = (e: PointerEvent<SVGGElement>, uid: string) => {
    if (!interact) return
    e.stopPropagation()
    interact.onSelect(uid)
    svg.current?.setPointerCapture(e.pointerId)
    setDrag({ uid, from: toMm(svg.current!, e), dx: 0, dy: 0 })
  }
  // identité stable : les pièces inchangées ne sont pas redessinées
  const downRef = useRef(downPieceNow)
  downRef.current = downPieceNow
  const downPiece = useCallback((e: PointerEvent<SVGGElement>, uid: string) => downRef.current(e, uid), [])
  const downBackground = (e: PointerEvent) => {
    interact?.onSelect(null)
    if (e.button !== 0) return
    svg.current?.setPointerCapture(e.pointerId)
    setPan({ px: e.clientX, py: e.clientY, view })
  }
  const move = (e: PointerEvent) => {
    if (drag) {
      const [x, y] = toMm(svg.current!, e)
      setDrag({ ...drag, dx: x - drag.from[0], dy: y - drag.from[1] })
    } else if (pan) {
      const mmPerPx = pan.view.w / svg.current!.getBoundingClientRect().width
      setView(clamp({ ...pan.view, x: pan.view.x - (e.clientX - pan.px) * mmPerPx, y: pan.view.y - (e.clientY - pan.py) * mmPerPx }))
    }
  }
  const up = () => {
    setPan(null)
    if (!drag || !interact) return setDrag(null)
    const it = sheet.items.find((i) => i.uid === drag.uid)
    if (it && (Math.abs(drag.dx) > 0.05 || Math.abs(drag.dy) > 0.05)) interact.onCommit(it.uid, { x: round1(it.x + drag.dx), y: round1(it.y + drag.dy), rot: it.rot, angle: it.angle })
    setDrag(null)
  }

  const canvas = (
    <div className={`relative ${full ? 'flex min-h-0 flex-1 items-center justify-center' : ''}`}>
      <svg
        ref={svg}
        viewBox={`${f(view.x)} ${f(view.y)} ${f(view.w)} ${f(vh)}`}
        className={`block rounded border border-stone-300 bg-[#f7f0e2] select-none touch-none ${full ? 'max-h-full max-w-full' : 'h-auto w-full'} ${pan ? 'cursor-grabbing' : zoomed ? 'cursor-grab' : ''}`}
        style={full ? { aspectRatio: `${sheet.width} / ${sheet.height}`, height: '100%' } : { maxHeight: '75vh' }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { setDrag(null); setPan(null) }}
        onPointerDown={downBackground}
        onDoubleClick={reset}
      >
        <defs>
          <pattern id="hachure-conflit" width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={3} height={3} fill="#fde2e2" />
            <line x1={0} y1={0} x2={0} y2={3} stroke="#dc2626" strokeWidth={1.2} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={sheet.width} height={sheet.height} fill="#fbf7ee" stroke="#a8a29e" strokeWidth={0.5} />
        {frame && <path d={path(frame)} fill="none" stroke="#2563eb" strokeWidth={0.5} strokeDasharray="3 2" />}
        {sheet.items.map((it) => (
          <SheetPiece
            key={it.uid}
            it={it}
            bad={!!bad?.has(it.uid)}
            selected={selected === it.uid || (!!highlight && it.part.key === highlight)}
            marks={marks?.get(it.uid) ?? null}
            drawings={drawings?.get(it.uid) ?? null}
            drag={drag?.uid === it.uid ? drag : null}
            movable={!!interact}
            onDown={downPiece}
          />
        ))}
      </svg>
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {zoomed && <span className="rounded bg-white/90 px-1.5 py-1 text-[10px] tabular-nums text-stone-600 shadow-sm">×{(sheet.width / view.w).toFixed(1)}</span>}
        <ToolButton onClick={() => zoomCenter(STEP)} disabled={view.w <= sheet.width / MAX_ZOOM + 1e-6} aria-label="Zoomer" title="Zoomer (molette)">+</ToolButton>
        <ToolButton onClick={() => zoomCenter(1 / STEP)} disabled={view.w >= sheet.width / MIN_ZOOM - 1e-6} aria-label="Dézoomer" title="Dézoomer (molette)">−</ToolButton>
        <ToolButton onClick={reset} disabled={!zoomed} title="Voir toute la planche (double-clic)">Ajuster</ToolButton>
        <ToolButton onClick={() => setFull((v) => !v)} aria-label={full ? 'Réduire' : 'Agrandir'} title={full ? 'Réduire (Échap)' : 'Plein écran'}>{full ? '✕' : '⤢'}</ToolButton>
      </div>
    </div>
  )

  if (!full) return canvas
  return (
    <>
      <div style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }} className="w-full rounded border border-dashed border-stone-300 bg-stone-100" />
      <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/80 p-4" onClick={(e) => e.target === e.currentTarget && setFull(false)}>
        <h3 className="mb-2 text-sm font-semibold text-white">{sheet.label} <span className="font-normal text-stone-300">· molette pour zoomer, glisser pour déplacer, Échap pour fermer</span></h3>
        {canvas}
      </div>
    </>
  )
}
