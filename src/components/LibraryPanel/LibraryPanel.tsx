import { useCallback, useEffect, useState } from 'react'
import { parseCutParts } from '../../core/format'
import type { Part } from '../../core/types'
import { Btn, Notice, Section } from '../../laser/ui'

interface LibraryFile {
  name: string
  dir: string
  size: number
  mtime: number
}

interface Loaded extends LibraryFile {
  text: string
  project: string
  parts: Part[]
  errors: string[]
}

const mm = (v: number) => Math.round(v * 10) / 10

/**
 * Bibliothèque : les fichiers `.cutparts.json` trouvés dans les dossiers surveillés par le serveur de dev (voir `vite.config.ts`, variable CNC_PARTS_DIR).
 * On y voit les pièces disponibles avant de les ajouter au projet. Sans serveur (build statique), le panneau ne s'affiche pas.
 */
export function LibraryPanel({ onAdd, onAddParts, onRemovePart, known }: { onAdd: (files: { name: string; text: string }[]) => void; onAddParts: (parts: Part[]) => void; onRemovePart: (key: string) => void; known: Set<string> }) {
  const [files, setFiles] = useState<Loaded[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/library')
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return setFiles(null)
      const list = (await res.json()) as LibraryFile[]
      const loaded = await Promise.all(
        list.map(async (f): Promise<Loaded> => {
          const text = await (await fetch(`/api/library/${encodeURIComponent(f.name)}`)).text()
          const r = parseCutParts(text)
          return { ...f, text, project: r.project, parts: r.parts, errors: r.errors }
        }),
      )
      setFiles(loaded)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  if (files === null) return error ? <Notice kind="error">Bibliothèque : {error}</Notice> : null

  return (
    <Section title="Pièces disponibles" note={`${files.length} fichier${files.length > 1 ? 's' : ''}`} defaultOpen>
      {!files.length && <p className="text-[11px] text-stone-500">Aucun fichier .json dans le dossier surveillé.</p>}
      {files.map((f) => {
        const total = f.parts.reduce((s, p) => s + p.qty, 0)
        const cats = [...new Set(f.parts.map((p) => p.category))]
        const added = f.parts.length > 0 && f.parts.every((p) => known.has(p.key))
        return (
          <details key={`${f.dir}/${f.name}`} className="rounded-md border border-stone-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 truncate">
                <b className="text-stone-800">{f.project || f.name}</b>
                <span className="ml-1.5 text-[11px] text-stone-500">{f.parts.length} modèles · {total} pièces</span>
              </span>
              <Btn
                block={false}
                variant={added ? 'secondary' : 'primary'}
                disabled={!f.parts.length}
                onClick={(e) => { e.preventDefault(); onAdd([{ name: f.name, text: f.text }]) }}
              >
                {added ? 'Mettre à jour' : 'Ajouter'}
              </Btn>
            </summary>
            <div className="space-y-2 border-t border-stone-100 px-2.5 py-2">
              <p className="break-all text-[10px] text-stone-400">{f.dir}/{f.name} · clique une pièce pour l’ajouter</p>
              {f.errors.map((e, i) => <Notice key={i} kind="warn">{e}</Notice>)}
              {cats.map((c) => (
                <div key={c}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-semibold text-stone-600">{c || 'Sans catégorie'}</h4>
                    <button type="button" className="text-[10px] text-stone-500 underline" onClick={() => onAddParts(f.parts.filter((p) => p.category === c))}>tout ajouter</button>
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {f.parts.filter((p) => p.category === c).map((p) => (
                      <li key={p.key}>
                        <button
                          type="button"
                          onClick={() => (known.has(p.key) ? onRemovePart(p.key) : onAddParts([p]))}
                          title={known.has(p.key) ? 'Déjà dans le projet : clique pour la retirer' : 'Clique pour l’ajouter au projet'}
                          className={`flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-stone-100 ${known.has(p.key) ? 'text-emerald-800' : 'text-stone-700'}`}
                        >
                          <span className="w-3 font-bold" aria-hidden>{known.has(p.key) ? '✓' : '+'}</span>
                          <span className="w-14 font-semibold">{p.id}</span>
                          <span className="w-8 text-right tabular-nums">{p.qty}×</span>
                          <span className="text-stone-500">{mm(p.w)} × {mm(p.h)} · {p.thickness} mm{p.holes.length ? ` · ${p.holes.length} trou${p.holes.length > 1 ? 's' : ''}` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )
      })}
      <Btn block={false} variant="ghost" onClick={() => void refresh()}>Actualiser</Btn>
    </Section>
  )
}
