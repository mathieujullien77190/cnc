import { useEffect, useState } from 'react'

/** Champ numérique : on peut effacer et retaper ; la valeur n'est transmise que si elle est valide (≥ min). */
export function NumField({ label, value, onChange, min = 0, step = 1, suffix, className = '' }: { label?: string; value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string; className?: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText((t) => (Number(t) === value ? t : String(value))), [value])
  return (
    <label className={`flex items-center gap-1.5 text-[11px] text-stone-600 ${className}`}>
      {label && <span className="whitespace-nowrap">{label}</span>}
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        step={step}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(v) && v >= min) onChange(v)
        }}
        onBlur={() => setText(String(value))}
        className="w-16 rounded border border-stone-300 bg-white px-1.5 py-1 text-right text-xs tabular-nums text-stone-800"
      />
      {suffix && <span className="text-stone-400">{suffix}</span>}
    </label>
  )
}
