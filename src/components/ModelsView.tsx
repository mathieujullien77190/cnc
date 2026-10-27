import { useEffect, useMemo, useRef, useState } from 'react'
import { MODELS, modelById } from '../models/registry'
import { finishPanels, panelsToCutParts } from '../models/toCutParts'
import { cleanParams, defaultParams, type ModelDef, type ModelResult, type Panel, type ParamDef, type Params } from '../models/types'
import { Viewer3D } from '../models/viewer3d'
import { Btn, Notice } from '../laser/ui'
import type { ImportReport } from '../state/useProject'
import { saveText } from '../laser'

const KEY = 'cnc-modeles-v1'

/** Un groupe = toutes les planches dont l'id a les mêmes lettres (BO-01, BO-02 → « BO »). */
const groupName = (id: string) => id.replace(/-?\d+$/, '')
const groupOf = (panels: Panel[], index: number) => panels.flatMap((p, i) => (groupName(p.id) === groupName(panels[index].id) ? [i] : []))

interface Saved {
  model: string
  params: Record<string, Params>
}

const load = (): Saved => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Saved
    if (s && typeof s.model === 'string' && s.params && typeof s.params === 'object') return s
  } catch {
    /* pas de sauvegarde lisible */
  }
  return { model: MODELS[0]?.id ?? '', params: {} }
}

/** Planches pour la découpe (serrage des crans appliqué) et planches pour la vue 3D (cotes nominales : sans serrage, les languettes ne mordent pas dans les flancs, pas de traits qui se superposent). */
type Built = ModelResult & { view: Panel[] }

const build = (m: ModelDef, p: Params): { result: Built | null; error: string } => {
  try {
    const r = m.build(p)
    const panels = finishPanels(r.panels)
    return { result: { ...r, panels, view: r.panels.map((q, i) => ({ ...q, id: panels[i].id })) }, error: '' }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
}

function ParamField({ def, value, onChange }: { def: ParamDef; value: number | boolean | string; onChange: (v: number | boolean | string) => void }) {
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

/**
 * Onglet « Modèles 3D » : liste des modèles du dossier `src/models/library`, réglages, vue three.js, envoi des planches à la découpe.
 * Les modèles sont du code (écrit par l'IA) ; l'API `window.cnc3d` laisse aussi l'IA piloter la vue depuis le navigateur.
 */
export function ModelsView({ onReplace }: { onReplace: (files: { name: string; text: string }[]) => ImportReport[] }) {
  const [saved, setSaved] = useState<Saved>(load)
  const [explode, setExplode] = useState(0)
  const [selected, setSelected] = useState(-1)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [measuring, setMeasuring] = useState(false)
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer3D | null>(null)

  const model = modelById(saved.model) ?? MODELS[0]
  const params = useMemo(() => (model ? cleanParams(model, saved.params[model.id] ?? defaultParams(model)) : {}), [model, saved.params])
  const { result, error } = useMemo(() => (model ? build(model, params) : { result: null, error: '' }), [model, params])
  const cut = useMemo(() => (result && model ? panelsToCutParts(result.panels, model.id) : null), [result, model])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      /* stockage indisponible */
    }
  }, [saved])

  // la vue 3D vit le temps de l'onglet
  useEffect(() => {
    if (!host.current) return
    const v = new Viewer3D(host.current)
    v.onSelect = (i) => {
      setSelected(i)
      setMenu(null)
    }
    v.onHidden = setHiddenCount
    v.onMenu = (index, cx, cy) => {
      const r = host.current!.getBoundingClientRect()
      setMenu(index < 0 ? null : { index, x: cx - r.left, y: cy - r.top })
    }
    viewer.current = v
    return () => {
      v.dispose()
      viewer.current = null
    }
  }, [])

  const firstView = useRef(true)
  const lastModel = useRef('')
  useEffect(() => {
    if (!viewer.current) return
    viewer.current.setPanels(result?.view ?? [], !(firstView.current || lastModel.current !== model?.id))
    firstView.current = false
    lastModel.current = model?.id ?? ''
    setSelected(-1)
  }, [result, model?.id])
  useEffect(() => viewer.current?.setExplode(explode), [explode])
  useEffect(() => viewer.current?.select(selected), [selected])
  useEffect(() => viewer.current?.setMeasure(measuring), [measuring])

  const pick = (id: string) => setSaved((s) => ({ ...s, model: id }))
  const setParam = (key: string, v: number | boolean | string) => model && setSaved((s) => ({ ...s, params: { ...s.params, [model.id]: { ...params, [key]: v } } }))
  const reset = () => model && setSaved((s) => ({ ...s, params: { ...s.params, [model.id]: defaultParams(model) } }))

  const toCut = () => {
    if (!cut || !model) return null
    const r = onReplace([{ name: `${model.id}.cutparts.json`, text: JSON.stringify(cut.file) }])[0]
    setReport(r)
    return r
  }
  const download = () => cut && model && saveText(JSON.stringify(cut.file), `${model.id}.cutparts.json`)

  // API pour l'IA (pilotage depuis le navigateur) : toujours la dernière version des fermetures
  const api = useRef({ pick, setParam, toCut, model, params, result, cut, selected })
  api.current = { pick, setParam, toCut, model, params, result, cut, selected }
  useEffect(() => {
    const w = window as unknown as { cnc3d?: object }
    w.cnc3d = {
      /** Modèles disponibles et leurs réglages. */
      models: () => MODELS.map((m) => ({ id: m.id, name: m.name, description: m.description, params: m.params })),
      /** Modèle choisi, réglages, planches (avec nombre d'exemplaires) et remarques. */
      state: () => ({ model: api.current.model?.id, params: api.current.params, notes: api.current.result?.notes ?? [], parts: api.current.cut?.file.parts, warnings: api.current.cut?.warnings ?? [] }),
      select: (id: string) => api.current.pick(id),
      setParams: (p: Params) => Object.entries(p).forEach(([k, v]) => api.current.setParam(k, v)),
      /** Envoie les planches à la découpe en remplaçant tout (comme le bouton). */
      addToCut: () => api.current.toCut(),
      fit: () => viewer.current?.fit(),
      /** Mode mesure (coins aimantés) : `measure(true)` puis clics sur la vue. */
      measure: (on: boolean) => setMeasuring(on),
      explode: (k: number) => setExplode(k),
      /** Cache la planche d'indice i (vue seulement) / remet tout. */
      hide: (i: number) => viewer.current?.hide(i),
      /** Cache toutes les planches dont l'id commence par ces lettres (« BO »). */
      hideGroup: (letters: string) => viewer.current?.hideMany((api.current.result?.view ?? []).flatMap((p, i) => (groupName(p.id) === letters ? [i] : []))),
      showAll: () => viewer.current?.showAll(),
      /** Image PNG de la vue (data URL). */
      screenshot: () => viewer.current?.screenshot(),
    }
    return () => {
      delete w.cnc3d
    }
  }, [])

  const sel = selected >= 0 ? result?.panels[selected] : undefined

  return (
    <div className="grid gap-3 lg:grid-cols-[17rem_1fr]">
      <div className="space-y-3">
        <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Modèles ({MODELS.length})</h2>
          <ul className="space-y-1">
            {MODELS.map((m) => (
              <li key={m.id}>
                <button onClick={() => pick(m.id)} aria-current={m.id === model?.id} className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${m.id === model?.id ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                  <span className="font-medium text-stone-800">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-stone-500">Un modèle = un fichier <code>src/models/library/nom.model.ts</code>. Demande à Claude d’en écrire un : il apparaît ici tout seul.</p>
        </section>

        {model && (
          <section className="space-y-2.5 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-stone-800">Réglages</h2>
              <button className="text-[11px] text-stone-500 underline" onClick={reset}>par défaut</button>
            </div>
            {model.params.map((d) => <ParamField key={d.key} def={d} value={params[d.key]} onChange={(v) => setParam(d.key, v)} />)}
            <label className="block text-xs text-stone-700">
              <span className="flex justify-between">Éclaté<span className="tabular-nums text-stone-500">{Math.round(explode * 100)} %</span></span>
              <input type="range" className="w-full accent-emerald-700" min={0} max={1} step={0.05} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
            </label>
          </section>
        )}

        {cut && model && (
          <section className="space-y-2 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <Btn variant="primary" onClick={() => toCut()}>Ajouter à la découpe (remplace tout)</Btn>
            <Btn onClick={download}>Télécharger le .cutparts.json</Btn>
            {report && <Notice kind="ok">{report.added} pièces envoyées à la découpe. Tout le reste a été remplacé.</Notice>}
          </section>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm">
          <div ref={host} className="h-[calc(100dvh-6.5rem)] min-h-96 w-full" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Btn block={false} variant={measuring ? 'primary' : undefined} onClick={() => setMeasuring((v) => !v)}>Mesurer</Btn>
            <Btn block={false} onClick={() => viewer.current?.fit()}>Cadrer</Btn>
            <Btn block={false} disabled={!hiddenCount} onClick={() => viewer.current?.showAll()}>Afficher tout{hiddenCount ? ` (${hiddenCount})` : ''}</Btn>
          </div>
          {menu && result?.panels[menu.index] && (
            <ul className="absolute z-10 min-w-40 rounded-md border border-stone-200 bg-white py-1 text-xs shadow-lg" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
              <li>
                <button className="w-full px-3 py-1.5 text-left hover:bg-stone-100" onClick={() => { viewer.current?.hide(menu.index); setMenu(null) }}>
                  Cacher {result.panels[menu.index].id}
                </button>
              </li>
              <li>
                <button className="w-full px-3 py-1.5 text-left hover:bg-stone-100" onClick={() => { viewer.current?.hideMany(groupOf(result.view, menu.index)); setMenu(null) }}>
                  Cacher le groupe {groupName(result.view[menu.index].id)} ({groupOf(result.view, menu.index).length})
                </button>
              </li>
            </ul>
          )}
          {sel && (
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/90 px-2.5 py-1.5 text-xs shadow">
              <b>{sel.id}</b> · {sel.category ?? '—'} · {sel.thickness} mm
            </div>
          )}
        </div>

        {error && <Notice kind="warn">Le modèle plante : {error}</Notice>}
        {result?.notes?.map((n) => <Notice key={n} kind="warn">{n}</Notice>)}
        {cut?.warnings.map((w) => <Notice key={w} kind="warn">{w}</Notice>)}
      </div>
    </div>
  )
}
