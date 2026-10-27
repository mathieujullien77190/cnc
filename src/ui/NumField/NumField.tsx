import { useEffect, useRef, useState } from 'react'

/** Champ numérique : on peut effacer et retaper ; la valeur n'est transmise que si elle est valide (≥ min). Au-dessus de `warnAbove`, le texte passe en rouge. Avec `debounce` (ms), la valeur n'est transmise qu'une fois les clics ou la frappe terminés (flèches comprises) ; le champ, lui, suit tout de suite. */
export function NumField({ label, value, onChange, min = 0, step = 1, suffix, className = '', warnAbove, debounce = 0 }: { label?: string; value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string; className?: string; warnAbove?: number; debounce?: number }) {
  const over = warnAbove !== undefined && value > warnAbove
  const [text, setText] = useState(String(value))
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; v: number } | null>(null)
  const flush = () => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    const { v } = pending.current
    pending.current = null
    onChange(v)
  }
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current.timer) }, [])
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
          if (e.target.value === '' || !Number.isFinite(v) || v < min) return
          if (!debounce) return onChange(v)
          if (pending.current) clearTimeout(pending.current.timer)
          pending.current = { v, timer: setTimeout(flush, debounce) }
        }}
        onBlur={() => { flush(); setText(String(value)) }}
        className={`w-16 rounded border bg-white px-1.5 py-1 text-right text-xs tabular-nums ${over ? 'border-red-400 font-semibold text-red-600' : 'border-stone-300 text-stone-800'}`}
      />
      {suffix && <span className="text-stone-400">{suffix}</span>}
    </label>
  )
}
