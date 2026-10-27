import { Checkbox, Select } from '@/components/ui'
import type { ParamFieldProps } from './types'

/** Un réglage du modèle : case à cocher, liste ou curseur selon son type. */
export const ParamField = ({ def, value, onChange }: ParamFieldProps) => {
  if (def.type === 'boolean') {
    return (
      <Checkbox label={def.label} checked={value as boolean} onChange={onChange} className="items-center gap-2 text-xs text-stone-700" />
    )
  }
  if (def.type === 'select') {
    return (
      <label className="block text-xs text-stone-700">
        {def.label}
        <Select className="mt-0.5 w-full px-1.5 py-1" value={value as string} onChange={onChange}>
          {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </label>
    )
  }
  return (
    <label className="block text-xs text-stone-700">
      <span className="flex justify-between">
        {def.label}
        <span className="tabular-nums text-stone-500">{value as number}{def.unit ? ` ${def.unit}` : ''}</span>
      </span>
      <input type="range" className="w-full accent-emerald-700" min={def.min} max={def.max} step={def.step ?? 1} value={value as number} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
