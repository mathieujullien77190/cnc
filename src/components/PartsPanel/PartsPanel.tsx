import { useRef } from 'react'
import type { Part } from '../../core/types'
import { Btn, IconButton, Notice, Section } from '../../laser/ui'
import type { ImportReport } from '../../state/useProject'

const mm = (v: number) => Math.round(v * 10) / 10

/** Import des fichiers `.cutparts.json` et liste des pièces regroupées par épaisseur, avec la quantité à découper. */
export function PartsPanel({ parts, reports, onFiles, onQty, onRemove, onRemoveProject, onClear }: {
  parts: Part[]
  reports: ImportReport[]
  onFiles: (files: File[]) => void
  onQty: (key: string, qty: number) => void
  onRemove: (key: string) => void
  onRemoveProject: (project: string) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const thicknesses = [...new Set(parts.map((p) => p.thickness))].sort((a, b) => a - b)
  return (
    <div className="space-y-2.5">
      <input ref={input} type="file" accept=".json,application/json" multiple hidden onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      <div className="rounded-lg border-2 border-dashed border-stone-300 bg-white/60 p-3 text-center">
        <Btn variant="primary" block={false} onClick={() => input.current?.click()}>Importer des pièces…</Btn>
        <p className="mt-1.5 text-[11px] text-stone-500">ou dépose ici un ou plusieurs fichiers <b>.cutparts.json</b></p>
      </div>
      {reports.map((r, i) => (
        <Notice key={`${r.file}-${i}`} kind={r.errors.length ? 'warn' : 'ok'}>
          <b>{r.file}</b> : {r.added} ajoutée(s){r.replaced ? `, ${r.replaced} mise(s) à jour` : ''}.
          {r.errors.map((e, j) => <span key={j} className="block">• {e}</span>)}
        </Notice>
      ))}
      {thicknesses.map((t) => {
        const list = parts.filter((p) => p.thickness === t)
        const total = list.reduce((s, p) => s + p.qty, 0)
        return (
          <Section key={t} title={`${t} mm`} note={`${list.length} modèles · ${total} pièces`} defaultOpen>
            <ul className="space-y-1">
              {list.map((p) => (
                <li key={p.key} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-stone-800">{p.id}</span>
                    <span className="ml-1.5 text-[11px] text-stone-500">{mm(p.w)} × {mm(p.h)}{p.category ? ` · ${p.category}` : ''}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={p.qty}
                    onChange={(e) => onQty(p.key, Number(e.target.value))}
                    aria-label={`Quantité de ${p.id}`}
                    className="w-14 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-right tabular-nums"
                  />
                  <IconButton size="sm" onClick={() => onRemove(p.key)} aria-label={`Retirer ${p.id}`} title="Retirer">×</IconButton>
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
      {parts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
          {[...new Set(parts.map((p) => p.project))].map((pr) => (
            <button key={pr} className="rounded border border-stone-300 bg-white px-1.5 py-0.5 hover:bg-stone-100" onClick={() => onRemoveProject(pr)} title="Retirer toutes les pièces de ce projet">retirer « {pr} »</button>
          ))}
          <button className="underline" onClick={onClear}>tout effacer</button>
        </div>
      )}
    </div>
  )
}
