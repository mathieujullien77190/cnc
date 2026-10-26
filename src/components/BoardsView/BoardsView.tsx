import { useEffect, useMemo, useState } from 'react'
import { angleOf, conflicts, turnTo } from '../../core/sheets'
import type { MachineSettings } from '../../laser'
import { Btn, Notice } from '../../laser/ui'
import type { Override } from '../../core/types'
import type { Project } from '../../state/useProject'
import { MarkingToggles } from '../MarkingToggles'
import { DoneToggle, SheetActions, rejectedText } from '../SheetCard'
import { SheetStats } from '../SheetStats'
import { SheetPreview } from '../SheetPreview'
import { SizePicker } from '../SizePicker'

const mm = (v: number) => Math.round(v * 10) / 10

/**
 * Planche perso : une seule planche, créée toute seule, pour tester deux ou trois pièces avant la vraie découpe. On dit quelles pièces
 * (et combien), l'app les range ; on peut ensuite les déplacer à la main (glisser) ou les tourner (R).
 */
export function BoardsView({ project, machine, onLaser }: { project: Project; machine: MachineSettings; onLaser: (key: string) => void }) {
  const { parts, boards, boardSheets, addBoard, updateBoard, setBoardQty, setOverride, done, setDone } = project
  const [selected, setSelected] = useState<string | null>(null)
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
            <section className="rounded-lg border border-stone-200 bg-white p-3">
              <h3 className="mb-2 text-xs font-semibold text-stone-700">Pièces à découper ({board.thickness} mm)</h3>
              <ul className="space-y-1">
                {choices.map((p) => {
                  const n = board.qty[p.key] ?? 0
                  return (
                    <li key={p.key} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-stone-800">{p.id}</span>
                        <span className="ml-1.5 text-[11px] text-stone-500">{mm(p.w)} × {mm(p.h)}</span>
                      </span>
                      <button className="h-6 w-6 rounded border border-stone-300 bg-white leading-none hover:bg-stone-100 disabled:opacity-40" disabled={!n} onClick={() => setBoardQty(board.id, p.key, n - 1)} aria-label={`Une ${p.id} de moins`}>−</button>
                      <span className="w-6 text-center tabular-nums">{n}</span>
                      <button className="h-6 w-6 rounded border border-stone-300 bg-white leading-none hover:bg-stone-100" onClick={() => setBoardQty(board.id, p.key, n + 1)} aria-label={`Une ${p.id} de plus`}>+</button>
                    </li>
                  )
                })}
                {!choices.length && <li className="text-[11px] text-stone-500">Aucune pièce de {board.thickness} mm.</li>}
              </ul>
            </section>

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
              <div className="flex flex-wrap items-center gap-2">
                {sel && (
                  <>
                    <span className="text-xs font-semibold text-stone-700">{sel.part.id}</span>
                    <Btn block={false} disabled={sel.part.rotate === 'none'} onClick={() => pin(sel.uid, turnTo(sel, angleOf(sel) + 90))}>↻ +90°</Btn>
                    <label className="flex items-center gap-1 text-[11px] text-stone-600">
                      Angle
                      <input
                        type="number"
                        step={1}
                        disabled={sel.part.rotate === 'none'}
                        value={Math.round(angleOf(sel) * 100) / 100}
                        onChange={(e) => Number.isFinite(e.target.valueAsNumber) && pin(sel.uid, turnTo(sel, e.target.valueAsNumber))}
                        className="w-16 rounded border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-800"
                      />
                      °
                    </label>
                    <Btn block={false} disabled={!board.overrides[sel.uid]} onClick={() => setOverride(board.id, sel.uid, null)}>Replacer auto</Btn>
                  </>
                )}
                <Btn block={false} variant="ghost" disabled={!Object.keys(board.overrides).length} onClick={() => updateBoard(board.id, { overrides: {} })}>Tout replacer auto</Btn>
              </div>
              <MarkingToggles value={board.marking} onChange={(patch) => updateBoard(board.id, { marking: { ...board.marking, ...patch } })} />
              <SheetStats sheet={sheet} marking={board.marking} machine={machine} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SheetActions sheet={sheet} marking={board.marking} machine={machine} onLaser={() => onLaser(sheet.key)} />
                <DoneToggle done={!!done[sheet.key]} onChange={(v) => setDone(sheet.key, v)} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
