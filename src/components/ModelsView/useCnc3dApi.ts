import { useEffect, useRef, type RefObject } from 'react'
import { MODELS } from '@/models/registry'
import type { Viewer3D } from '@/models/viewer3d'
import type { ModelDef, Params } from '@/models/types'
import { groupName } from './helpers'
import type { Built, Cut } from './types'

type Api = {
  pick: (id: string) => void
  setParam: (key: string, v: number | boolean | string) => void
  toCut: () => unknown
  hide: (i: number) => void
  hideMany: (indices: number[]) => void
  showAll: () => void
  model: ModelDef | undefined
  params: Params
  result: Built | null
  cut: Cut | null
  selected: number
}

type Controls = { viewer: RefObject<Viewer3D | null>; setMeasuring: (on: boolean) => void; setExplode: (k: number) => void }

/** API `window.cnc3d` pour l'IA (pilotage depuis le navigateur) : toujours la dernière version des fermetures. */
export const useCnc3dApi = (latest: Api, { viewer, setMeasuring, setExplode }: Controls) => {
  const api = useRef(latest)
  api.current = latest
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
      hide: (i: number) => api.current.hide(i),
      /** Cache toutes les planches dont l'id commence par ces lettres (« BO »). */
      hideGroup: (letters: string) => api.current.hideMany((api.current.result?.view ?? []).flatMap((p, i) => (groupName(p.id) === letters ? [i] : []))),
      showAll: () => api.current.showAll(),
      /** Image PNG de la vue (data URL). */
      screenshot: () => viewer.current?.screenshot(),
    }
    return () => {
      delete w.cnc3d
    }
  }, [])
}
