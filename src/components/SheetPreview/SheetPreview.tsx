import { categoryCss } from '../../core/colors'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent } from 'react'
import { frameRect } from '../../core/job'
import { angleOf, marksFor, turnTo } from '../../core/sheets'
import type { Marking, Override, Pt, Sheet } from '../../core/types'

const f = (v: number) => Math.round(v * 1000) / 1000
const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
const round1 = (v: number) => Math.round(v * 10) / 10

/** Zoom maximal : la vue la plus serrée montre 1/MAX_ZOOM de la largeur de la planche. */
const MAX_ZOOM = 40
/** Dézoom maximal : la vue peut montrer jusqu'à MIN_ZOOM fois la planche (la planche paraît alors deux fois plus petite). */
const MIN_ZOOM = 0.5
const STEP = 1.25

export interface Interaction {
  selected: string | null
  onSelect: (uid: string | null) => void
  /** Position finale d'un exemplaire déplacé ou tourné à la main. */
  onCommit: (uid: string, o: Override) => void
}

interface Drag {
  uid: string
  from: Pt
  dx: number
  dy: number
}

/** Fenêtre visible de la planche (mm) : x, y du coin haut-gauche et largeur ; la hauteur suit le rapport de la planche. */
interface View {
  x: number
  y: number
  w: number
}

interface Pan {
  px: number
  py: number
  view: View
}

const ToolButton = ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props} className="h-7 min-w-7 rounded border border-stone-300 bg-white/90 px-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-white disabled:opacity-40">
    {children}
  </button>
)

/**
 * Aperçu d'une planche en SVG, zoomable : molette pour zoomer vers le curseur, glisser le fond pour déplacer la vue, boutons + / − / ajuster, ⤢ pour agrandir en plein écran.
 * Avec `interact`, on déplace une pièce en la glissant et on la tourne avec la touche R.
 */
export function SheetPreview({ sheet, marking, bad, interact }: { sheet: Sheet; marking: Marking; bad?: Set<string>; interact?: Interaction }) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pan, setPan] = useState<Pan | null>(null)
  const [full, setFull] = useState(false)
  const full0: View = { x: 0, y: 0, w: sheet.width }
  const [view, setView] = useState<View>(full0)
  const ratio = sheet.height / sheet.width
  const vh = view.w * ratio
  const zoomed = Math.abs(view.w - sheet.width) > 1e-6
  const frame = marking.frame ? frameRect(sheet) : null
  const marks = marking.names ? marksFor(sheet) : null
  const selected = interact?.selected ?? null

  // une autre taille de planche remet la vue entière
  useEffect(() => setView({ x: 0, y: 0, w: sheet.width }), [sheet.width, sheet.height])

  /** Garde la fenêtre près de la planche (un peu de marge autour). */
  const clamp = (v: View): View => {
    const w = Math.min(sheet.width / MIN_ZOOM, Math.max(sheet.width / MAX_ZOOM, v.w))
    const h = w * ratio
    const mx = sheet.width * 0.05
    const my = sheet.height * 0.05
    // plus large que la planche : elle reste centrée ; sinon on la parcourt avec un peu de marge autour
    return {
      w,
      x: w >= sheet.width ? (sheet.width - w) / 2 : Math.min(Math.max(v.x, -mx), sheet.width + mx - w),
      y: h >= sheet.height ? (sheet.height - h) / 2 : Math.min(Math.max(v.y, -my), sheet.height + my - h),
    }
  }

  /** Zoom d'un facteur `k` (> 1 : on se rapproche) autour du point (cx, cy) de la planche. */
  const zoomAt = (k: number, cx: number, cy: number) =>
    setView((v) => {
      const w = Math.min(sheet.width / MIN_ZOOM, Math.max(sheet.width / MAX_ZOOM, v.w / k))
      const s = w / v.w
      return clamp({ w, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s })
    })
  const zoomCenter = (k: number) => zoomAt(k, view.x + view.w / 2, view.y + vh / 2)

  const toMm = (e: { clientX: number; clientY: number }): Pt => {
    const el = svg.current!
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const q = p.matrixTransform(el.getScreenCTM()!.inverse())
    return [q.x, q.y]
  }

  // molette : zoom vers le curseur (écouteur non passif pour garder la page immobile)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = el.createSVGPoint()
      p.x = e.clientX
      p.y = e.clientY
      const q = p.matrixTransform(el.getScreenCTM()!.inverse())
      zoomAt(e.deltaY < 0 ? STEP : 1 / STEP, q.x, q.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

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

  const downPiece = (e: PointerEvent<SVGGElement>, uid: string) => {
    if (!interact) return
    e.stopPropagation()
    interact.onSelect(uid)
    svg.current?.setPointerCapture(e.pointerId)
    setDrag({ uid, from: toMm(e), dx: 0, dy: 0 })
  }
  const downBackground = (e: PointerEvent) => {
    interact?.onSelect(null)
    if (e.button !== 0) return
    svg.current?.setPointerCapture(e.pointerId)
    setPan({ px: e.clientX, py: e.clientY, view })
  }
  const move = (e: PointerEvent) => {
    if (drag) {
      const [x, y] = toMm(e)
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
        onDoubleClick={() => setView({ x: 0, y: 0, w: sheet.width })}
      >
        <defs>
          <pattern id="hachure-conflit" width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={3} height={3} fill="#fde2e2" />
            <line x1={0} y1={0} x2={0} y2={3} stroke="#dc2626" strokeWidth={1.2} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={sheet.width} height={sheet.height} fill="#fbf7ee" stroke="#a8a29e" strokeWidth={0.5} />
        {frame && <path d={path(frame)} fill="none" stroke="#2563eb" strokeWidth={0.5} strokeDasharray="3 2" />}
        {sheet.items.map((it) => {
          const d = drag?.uid === it.uid ? drag : null
          const isBad = bad?.has(it.uid)
          return (
            <g key={it.uid} transform={d ? `translate(${f(d.dx)} ${f(d.dy)})` : undefined} onPointerDown={(e) => downPiece(e, it.uid)} className={interact ? 'cursor-move' : ''}>
              <path
                d={[it.outer, ...it.holes].map(path).join('')}
                fillRule="evenodd"
                fill={isBad ? 'url(#hachure-conflit)' : categoryCss(it.part.category)}
                stroke={selected === it.uid ? '#047857' : '#ff0000'}
                strokeWidth={selected === it.uid ? 1.2 : 0.6}
                strokeLinejoin="round"
              >
                <title>{`${it.part.id}${it.part.category ? ` · ${it.part.category}` : ''}`}</title>
              </path>
              {(marks?.get(it.uid) ?? []).map((r, i) => <path key={i} d={path(r)} fill="none" stroke="#2563eb" strokeWidth={0.3} />)}
            </g>
          )
        })}
      </svg>
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {zoomed && <span className="rounded bg-white/90 px-1.5 py-1 text-[10px] tabular-nums text-stone-600 shadow-sm">×{(sheet.width / view.w).toFixed(1)}</span>}
        <ToolButton onClick={() => zoomCenter(STEP)} disabled={view.w <= sheet.width / MAX_ZOOM + 1e-6} aria-label="Zoomer" title="Zoomer (molette)">+</ToolButton>
        <ToolButton onClick={() => zoomCenter(1 / STEP)} disabled={view.w >= sheet.width / MIN_ZOOM - 1e-6} aria-label="Dézoomer" title="Dézoomer (molette)">−</ToolButton>
        <ToolButton onClick={() => setView({ x: 0, y: 0, w: sheet.width })} disabled={!zoomed} title="Voir toute la planche (double-clic)">Ajuster</ToolButton>
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
