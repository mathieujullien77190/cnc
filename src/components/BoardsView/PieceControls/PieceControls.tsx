import { angleOf, turnTo } from '@/core/sheets'
import { Btn } from '@/laser/ui'
import type { PieceControlsProps } from './types'

/** Rotation et retour au rangement auto de la pièce choisie, plus « Tout replacer auto ». */
export const PieceControls = ({ sel, overrides, onPin, onReset, onResetAll }: PieceControlsProps) => (
  <div className="flex flex-wrap items-center gap-2">
    {sel && (
      <>
        <span className="text-xs font-semibold text-stone-700">{sel.part.id}</span>
        <Btn block={false} disabled={sel.part.rotate === 'none'} onClick={() => onPin(sel.uid, turnTo(sel, angleOf(sel) + 90))}>↻ +90°</Btn>
        <label className="flex items-center gap-1 text-[11px] text-stone-600">
          Angle
          <input
            type="number"
            step={1}
            disabled={sel.part.rotate === 'none'}
            value={Math.round(angleOf(sel) * 100) / 100}
            onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onPin(sel.uid, turnTo(sel, e.target.valueAsNumber))}
            className="w-16 rounded border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-800"
          />
          °
        </label>
        <Btn block={false} disabled={!overrides[sel.uid]} onClick={() => onReset(sel.uid)}>Replacer auto</Btn>
      </>
    )}
    <Btn block={false} variant="ghost" disabled={!Object.keys(overrides).length} onClick={onResetAll}>Tout replacer auto</Btn>
  </div>
)
