import { useRef } from 'react'
import PartTag from '@/components/ui/PartTag'
import PartTree from '@/components/PartTree'
import { round1 as mm } from '@/helpers'
import { Btn, Notice, Section } from '@/laser/ui'
import type { PartsPanelProps } from './types'

/** Import des fichiers `.cutparts.json` et liste des pièces regroupées par épaisseur, avec leur quantité (elle vient du fichier, elle ne se règle pas ici). */
export const PartsPanel = ({ parts, reports, onFiles, onPick, onRemoveProject, onClear }: PartsPanelProps) => {
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
          <Section key={t} title={thicknesses.length > 1 ? `Pièces · ${t} mm` : 'Pièces'} note={`${list.length} modèles · ${total} pièces`} defaultOpen>
            <PartTree
              parts={list}
              renderPart={(p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    disabled={!onPick}
                    onClick={() => onPick?.(p.key)}
                    title={onPick ? 'Afficher la planche de cette pièce' : undefined}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs ${onPick ? 'cursor-pointer hover:bg-stone-200/70' : 'cursor-default'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <PartTag id={p.id} category={p.category} />
                      <span className="ml-1.5 text-[11px] text-stone-500">{mm(p.w)} × {mm(p.h)}</span>
                    </span>
                    <span className="w-8 text-right text-[11px] tabular-nums text-stone-500" title="Quantité">×{p.qty}</span>
                  </button>
                </li>
              )}
            />
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
