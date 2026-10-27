import { useState } from 'react'
import { Chip } from '../../laser/ui'
import { NumField } from '../../ui/NumField'

/** Zone de travail de la E1 Pro (mm) : au-delà, la valeur passe en rouge. */
const MAX_W = 400
const MAX_H = 320
/** Délai avant de transmettre une nouvelle taille (ms) : plusieurs clics sur les flèches ne font qu'un seul recalcul. */
const SIZE_DEBOUNCE = 200

/** Formats de planche proposés (largeur × hauteur, mm). */
export const SHEET_FORMATS: readonly [number, number][] = [
  [300, 300],
  [400, 320],
]

const isPreset = (w: number, h: number) => SHEET_FORMATS.some(([pw, ph]) => pw === w && ph === h)

/** Choix du format de planche : 300 × 300, 400 × 320 (zone de la E1 Pro) ou personnalisé (largeur et hauteur libres). */
export function SizePicker({ width, height, onChange }: { width: number; height: number; onChange: (w: number, h: number) => void }) {
  const [custom, setCustom] = useState(() => !isPreset(width, height))
  const showFields = custom || !isPreset(width, height)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format de planche">
        {SHEET_FORMATS.map(([w, h]) => (
          <Chip key={`${w}x${h}`} active={!showFields && width === w && height === h} onClick={() => { setCustom(false); onChange(w, h) }}>
            {w} × {h}
          </Chip>
        ))}
        <Chip active={showFields} onClick={() => setCustom(true)}>Personnalisé</Chip>
      </div>
      {showFields && (
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          <NumField label="Largeur" value={width} min={20} warnAbove={MAX_W} debounce={SIZE_DEBOUNCE} onChange={(v) => onChange(v, height)} suffix="mm" />
          <NumField label="Hauteur" value={height} min={20} warnAbove={MAX_H} debounce={SIZE_DEBOUNCE} onChange={(v) => onChange(width, v)} suffix="mm" />
        </div>
      )}
    </div>
  )
}
