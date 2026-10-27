import type { ParamFieldProps } from './types'

/** Un réglage du modèle : case à cocher, liste ou curseur selon son type. */
export const ParamField = ({ def, value, onChange }: ParamFieldProps) => {
  if (def.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-stone-700">
        <input type="checkbox" className="accent-emerald-700" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
        {def.label}
      </label>
    )
  }
  if (def.type === 'select') {
    return (
      <label className="block text-xs text-stone-700">
        {def.label}
        <select className="mt-0.5 w-full rounded border border-stone-300 bg-white px-1.5 py-1" value={value as string} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
