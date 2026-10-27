import { useState } from 'react'
import { Chip, NumField, Toolbar } from '@/components/ui'
import { MAX_H, MAX_W, SHEET_FORMATS, SIZE_DEBOUNCE } from './constants'
import { isPreset } from './helpers'
import type { SizePickerProps } from './types'

/** Choix du format de planche : 300 × 300, 400 × 320 (zone de la E1 Pro) ou personnalisé (largeur et hauteur libres). */
export const SizePicker = ({ width, height, onChange }: SizePickerProps) => {
  const [custom, setCustom] = useState(() => !isPreset(width, height))
  const showFields = custom || !isPreset(width, height)
  return (
    <div className="space-y-2">
      <Toolbar className="gap-1.5" role="group" aria-label="Format de planche">
        {SHEET_FORMATS.map(([w, h]) => (
          <Chip key={`${w}x${h}`} active={!showFields && width === w && height === h} onClick={() => { setCustom(false); onChange(w, h) }}>
            {w} × {h}
          </Chip>
        ))}
        <Chip active={showFields} onClick={() => setCustom(true)}>Personnalisé</Chip>
      </Toolbar>
      {showFields && (
        <Toolbar className="gap-x-3 gap-y-2">
          <NumField label="Largeur" value={width} min={20} warnAbove={MAX_W} debounce={SIZE_DEBOUNCE} onChange={(v) => onChange(v, height)} suffix="mm" />
          <NumField label="Hauteur" value={height} min={20} warnAbove={MAX_H} debounce={SIZE_DEBOUNCE} onChange={(v) => onChange(width, v)} suffix="mm" />
        </Toolbar>
      )}
    </div>
  )
}
