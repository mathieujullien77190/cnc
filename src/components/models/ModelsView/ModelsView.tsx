import { useEffect, useMemo, useRef, useState } from 'react'
import { Notice } from '@/components/ui'
import { saveText } from '@/laser'
import { MODELS, modelById } from '@/models/registry'
import { modelToJson } from '@/models/json'
import { panelsToCutParts } from '@/models/toCutParts'
import { cleanParams, defaultParams } from '@/models/types'
import { Viewer3D } from '@/models/viewer3d'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { modelsActions } from '@/store/models'
import { projectActions, replaceTexts } from '@/store/project'
import { uiActions } from '@/store/ui'
import ContextMenu from './ContextMenu'
import CutActions from './CutActions'
import ModelList from './ModelList'
import ModelSettings from './ModelSettings'
import ViewToolbar from './ViewToolbar'
import { build, groupName, groupOf } from './helpers'
import { SYNC_DELAY } from './constants'
import type { MenuState } from './types'
import { useCnc3dApi } from './useCnc3dApi'

/**
 * Onglet « Modèles 3D » : liste des modèles du dossier `models/`, réglages, vue three.js, envoi des planches à la découpe.
 * Les modèles sont du code (écrit par l'IA) ; l'API `window.cnc3d` laisse aussi l'IA piloter la vue depuis le navigateur.
 */
export const ModelsView = () => {
  // modèle choisi, réglages, éclaté, planches cachées et mode mesure vivent dans le store : rien ne se perd en changeant d'onglet ou de modèle
  const dispatch = useAppDispatch()
  const savedModel = useAppSelector((s) => s.models.model)
  const savedParams = useAppSelector((s) => s.models.params)
  const explode = useAppSelector((s) => s.models.explode)
  const colored = useAppSelector((s) => s.models.colored)
  const measuring = useAppSelector((s) => s.models.measuring)
  const hidden = useAppSelector((s) => s.models.hidden)
  const report = useAppSelector((s) => s.ui.modelReport)
  const [selected, setSelected] = useState(-1)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer3D | null>(null)

  // pas de modèle choisi au départ : la vue est vide et le catalogue de la découpe n'est pas touché
  const model = savedModel ? modelById(savedModel) : undefined
  const modelId = model?.id ?? ''
  const params = useMemo(() => (model ? cleanParams(model, savedParams[model.id] ?? defaultParams(model)) : {}), [model, savedParams])
  const { result, error } = useMemo(() => (model ? build(model, params) : { result: null, error: '' }), [model, params])
  const cut = useMemo(() => (result && model ? panelsToCutParts(result.panels, model.id) : null), [result, model])

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
      // clic droit dans le vide : le menu s'ouvre quand même (pour réafficher les planches cachées)
      setMenu({ index, x: cx - r.left, y: cy - r.top })
    }
    viewer.current = v
    return () => {
      v.dispose()
      viewer.current = null
    }
  }, [])

  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden
  const hiddenNow = () => hiddenRef.current[modelId] ?? []
  const count = result?.view.length ?? 0

  const firstView = useRef(true)
  const lastModel = useRef('')
  useEffect(() => {
    if (!viewer.current) return
    viewer.current.setPanels(result?.view ?? [], !(firstView.current || lastModel.current !== model?.id))
    firstView.current = false
    lastModel.current = model?.id ?? ''
    setSelected(-1)
    // la vue oublie les planches cachées quand on change de modèle : on remet celles de ce modèle
    const stored = hiddenRef.current[model?.id ?? ''] ?? []
    const keep = result ? stored.filter((i) => i < result.view.length) : stored
    if (keep.length) viewer.current.hideMany(keep)
    if (keep.length !== stored.length) dispatch(modelsActions.hiddenSet({ modelId: model?.id ?? '', indices: keep }))
  }, [result, model?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => viewer.current?.setExplode(explode), [explode])
  useEffect(() => viewer.current?.setColors(colored), [colored])
  useEffect(() => viewer.current?.select(selected), [selected])
  useEffect(() => viewer.current?.setMeasure(measuring), [measuring])

  // choisir un modèle ou changer un réglage envoie les planches à la découpe toutes seules (voir plus bas) ; recharger la page ne touche à rien
  const syncCut = useRef(false)
  // première ouverture avec un modèle déjà choisi (le nichoir par défaut) et rien à découper : ses planches partent à la découpe, comme si on venait de le choisir
  const catalogEmpty = useAppSelector((s) => s.project.parts.length === 0)
  const firstSync = useRef(true)
  if (firstSync.current) {
    firstSync.current = false
    if (model && catalogEmpty) syncCut.current = true
  }
  const pick = (id: string) => {
    syncCut.current = !!id
    dispatch(modelsActions.modelPicked(id))
    // aucun modèle : plus de planches à découper (réglages de planche gardés)
    if (!id) {
      dispatch(projectActions.catalogReplaced([]))
      dispatch(uiActions.modelReportSet(null))
    }
  }
  /** Clic dans la liste : choisir un modèle, ou le désélectionner en recliquant dessus. */
  const toggle = (id: string) => pick(id === model?.id ? '' : id)
  const setParam = (key: string, v: number | boolean | string) => {
    if (!model) return
    syncCut.current = true
    dispatch(modelsActions.paramsSet({ modelId: model.id, params: { ...params, [key]: v } }))
  }
  const reset = () => {
    if (!model) return
    syncCut.current = true
    dispatch(modelsActions.paramsSet({ modelId: model.id, params: defaultParams(model) }))
  }
  const setExplode = (k: number) => dispatch(modelsActions.explodeSet(k))
  const setColored = (on: boolean) => dispatch(modelsActions.coloredSet(on))
  const setMeasuring = (on: boolean) => dispatch(modelsActions.measuringSet(on))
  const setHidden = (indices: number[]) => dispatch(modelsActions.hiddenSet({ modelId, indices }))
  const hide = (i: number) => {
    if (i < 0 || i >= count) return
    viewer.current?.hide(i)
    setHidden([...new Set([...hiddenNow(), i])])
  }
  const hideMany = (indices: number[]) => {
    const ok = indices.filter((i) => i >= 0 && i < count)
    viewer.current?.hideMany(ok)
    setHidden([...new Set([...hiddenNow(), ...ok])])
  }
  const show = (indices: number[]) => {
    viewer.current?.showMany(indices)
    setHidden(hiddenNow().filter((i) => !indices.includes(i)))
  }
  const showAll = () => {
    viewer.current?.showAll()
    setHidden([])
  }

  const toCut = () => {
    if (!cut || !model) return null
    const r = dispatch(replaceTexts([{ name: `${model.id}.cutparts.json`, text: JSON.stringify(cut.file) }]))[0]
    dispatch(uiActions.modelReportSet(r))
    return r
  }
  // les planches du modèle remplacent le catalogue de la découpe dès qu'on choisit le modèle ou qu'on règle un paramètre (un court délai pour les curseurs)
  useEffect(() => {
    if (!syncCut.current || !cut) return
    const id = setTimeout(() => {
      syncCut.current = false
      toCut()
    }, SYNC_DELAY)
    return () => clearTimeout(id)
  }, [cut]) // eslint-disable-line react-hooks/exhaustive-deps
  const download = () => cut && model && saveText(JSON.stringify(cut.file), `${model.id}.cutparts.json`)
  // le modèle figé en JSON : à déposer dans `models/` pour l'avoir dans la liste sans code
  const downloadModel = () => result && model && saveText(JSON.stringify(modelToJson(model, result.raw), null, 2), `${model.id}.model.json`)

  useCnc3dApi({ pick, setParam, toCut, hide, hideMany, showAll, model, params, result, cut, selected }, { viewer, setMeasuring, setExplode })

  const sel = selected >= 0 ? result?.panels[selected] : undefined
  const menuPanel = menu && menu.index >= 0 ? result?.panels[menu.index] : undefined
  // planches cachées du modèle : une entrée par planche (nom numéroté), plus une par groupe quand plusieurs planches d'un groupe sont cachées
  const hiddenItems = useMemo(() => {
    if (!result) return []
    const idx = (hidden[modelId] ?? []).filter((i) => i < result.view.length).sort((a, b) => a - b)
    const groups = new Map<string, number[]>()
    for (const i of idx) groups.set(groupName(result.view[i].id), [...(groups.get(groupName(result.view[i].id)) ?? []), i])
    return [...idx.map((i) => ({ label: result.view[i].id, indices: [i] })), ...[...groups].filter(([, list]) => list.length > 1).map(([g, list]) => ({ label: `le groupe ${g} (${list.length})`, indices: list }))]
  }, [hidden, modelId, result])

  return (
    <div className="grid gap-3 lg:grid-cols-[17rem_1fr]">
      <div className="space-y-3">
        <ModelList models={MODELS} currentId={model?.id} onPick={toggle} />
        {model && <ModelSettings model={model} params={params} explode={explode} colored={colored} onColored={setColored} onParam={setParam} onReset={reset} onExplode={setExplode} />}
        {cut && model && <CutActions report={report} onDownload={download} onDownloadModel={downloadModel} />}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm">
          <div ref={host} className="h-[calc(100dvh-6.5rem)] min-h-96 w-full" />
          <ViewToolbar measuring={measuring} hiddenCount={hiddenCount} onMeasure={() => setMeasuring(!measuring)} onFit={() => viewer.current?.fit()} onShowAll={showAll} />
          {menu && result && (menuPanel || hiddenItems.length > 0) && (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              panel={menuPanel ? { id: menuPanel.id, group: groupName(result.view[menu.index].id), groupCount: groupOf(result.view, menu.index).length, onHide: () => { hide(menu.index); setMenu(null) }, onHideGroup: () => { hideMany(groupOf(result.view, menu.index)); setMenu(null) } } : undefined}
              hiddenItems={hiddenItems}
              onShow={(indices) => { show(indices); setMenu(null) }}
              onShowAll={() => { showAll(); setMenu(null) }}
            />
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
