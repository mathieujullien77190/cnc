import { useEffect, useMemo } from 'react'
import { conflicts } from '@/core/sheets'
import type { Override } from '@/core/types'
import DoneToggle from '@/components/DoneToggle'
import MarkingToggles from '@/components/MarkingToggles'
import SheetActions from '@/components/SheetActions'
import SheetPreview from '@/components/SheetPreview'
import SizePicker from '@/components/SizePicker'
import { rejectedText } from '@/helpers'
import { Btn, Notice } from '@/laser/ui'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { uiActions } from '@/store/uiSlice'
import PartQuantities from './PartQuantities'
import PieceControls from './PieceControls'
import type { BoardsViewProps } from './types'

/**
 * Planche perso : une seule planche, créée toute seule, pour tester deux ou trois pièces avant la vraie découpe. On dit quelles pièces
 * (et combien), l'app les range ; on peut ensuite les déplacer à la main (glisser) ou les tourner (R).
 */
export const BoardsView = ({ project, onLaser }: BoardsViewProps) => {
  const { parts, boards, boardSheets, addBoard, updateBoard, setBoardQty, setOverride, done, setDone } = project
  const dispatch = useAppDispatch()
  const selected = useAppSelector((s) => s.ui.selectedPiece)
  const setSelected = (uid: string | null) => dispatch(uiActions.selectedPieceSet(uid))
  const thicknesses = [...new Set(parts.map((p) => p.thickness))].sort((a, b) => a - b)
  const board = boards[0]
  const sheet = boardSheets[0]
  const bad = useMemo(() => (sheet ? conflicts(sheet) : new Set<string>()), [sheet])
  const choices = board ? parts.filter((p) => p.thickness === board.thickness).sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true })) : []
  const sel = sheet?.items.find((i) => i.uid === selected)

  // déplacer une pièce fige aussi toutes les autres à leur place actuelle : rien d'autre ne bouge
  const pin = (uid: string, o: Override) => {
    const overrides = { ...board.overrides }
    for (const it of sheet.items) if (!overrides[it.uid]) overrides[it.uid] = { x: it.x, y: it.y, rot: it.rot, angle: it.angle }
    overrides[uid] = o
    updateBoard(board.id, { overrides })
  }

  // la planche perso est unique : elle se crée toute seule, vide
  useEffect(() => {
    if (parts.length && !boards.length) addBoard(thicknesses[0] ?? 3)
  }, [parts.length, boards.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!parts.length) {
    return <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">Importe d’abord des pièces : une planche perso en pioche dedans.</div>
  }

  return (
    <div>
      {board && sheet && (
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-stone-200 bg-white p-3">
            <label className="flex items-center gap-1.5 text-[11px] text-stone-600">
              Épaisseur
              <select
                value={board.thickness}
                onChange={(e) => updateBoard(board.id, { thickness: Number(e.target.value), qty: {}, overrides: {} })}
                className="rounded border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-800"
              >
                {thicknesses.map((t) => <option key={t} value={t}>{t} mm</option>)}
              </select>
            </label>
            <SizePicker key={board.id} width={board.width} height={board.height} onChange={(width, height) => updateBoard(board.id, { width, height })} />
            <Btn block={false} variant="ghost" className="ml-auto" disabled={!Object.values(board.qty).some(Boolean)} onClick={() => { updateBoard(board.id, { qty: {}, overrides: {} }); setSelected(null) }}>Vider la planche</Btn>
          </div>

          <div className="grid gap-3 xl:grid-cols-[18rem_1fr]">
            <PartQuantities thickness={board.thickness} choices={choices} qty={board.qty} onQty={(key, n) => setBoardQty(board.id, key, n)} />

            <section className={`min-w-0 space-y-2.5 rounded-lg border p-3 transition-colors ${done[sheet.key] ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-800">{board.name}</h3>
                <span className="text-[11px] text-stone-500">{sheet.items.length} pièces · {Math.round(sheet.fill * 100)} % rempli</span>
              </div>
              <SheetPreview
                sheet={sheet}
                marking={board.marking}
                bad={bad}
                interact={{ selected, onSelect: setSelected, onCommit: (uid, o) => pin(uid, o) }}
              />
              <p className="text-[11px] text-stone-500">Glisse une pièce pour la placer, <kbd className="rounded border border-stone-300 px-1">R</kbd> pour la tourner.</p>
              {sheet.rejected.length > 0 && <Notice kind="warn">Ne tient pas sur la planche : {rejectedText(sheet)}.</Notice>}
              {bad.size > 0 && <Notice kind="error">{bad.size} pièce(s) se chevauchent ou sortent de la planche (hachurées en rouge).</Notice>}
              <PieceControls
                sel={sel}
                overrides={board.overrides}
                onPin={pin}
                onReset={(uid) => setOverride(board.id, uid, null)}
                onResetAll={() => updateBoard(board.id, { overrides: {} })}
              />
              <MarkingToggles value={board.marking} onChange={(patch) => updateBoard(board.id, { marking: { ...board.marking, ...patch } })} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SheetActions sheet={sheet} marking={board.marking} onLaser={() => onLaser(sheet.key)} />
                <DoneToggle done={!!done[sheet.key]} onChange={(v) => setDone(sheet.key, v)} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
