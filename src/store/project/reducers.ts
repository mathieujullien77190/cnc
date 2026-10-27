import type { PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_MARKING, DEFAULT_SETTINGS } from '@/constants'
import type { CustomBoard, Part, SheetSettings } from '@/core/types'
import type { AutoMarkingPayload, BoardAddedPayload, BoardQtyPayload, BoardUpdatedPayload, DonePayload, OverridePayload, ProjectState, QtyPayload } from './types'

/** Projet vide (copie neuve à chaque appel : jamais partagée). */
export const emptyProject = (): ProjectState => ({ parts: [], settings: { ...DEFAULT_SETTINGS }, autoMarking: {}, boards: [], done: {} })

const toQty = (qty: number): number => Math.max(0, Math.round(qty) || 0)

const boardOf = (state: ProjectState, id: string): CustomBoard | undefined => state.boards.find((b) => b.id === id)

/** Retire les positions manuelles des exemplaires `clé#n` pour lesquels `keep` est faux. */
const dropOverrides = (b: CustomBoard, keep: (key: string, n: number) => boolean): void => {
  for (const u of Object.keys(b.overrides)) {
    if (!u.includes('#')) continue
    const i = u.lastIndexOf('#')
    if (!keep(u.slice(0, i), Number(u.slice(i + 1)))) delete b.overrides[u]
  }
}

/** Pièces lues (fichiers) : une pièce déjà connue (même projet, même id) est remplacée en gardant sa quantité choisie. */
export const partsImported = (state: ProjectState, { payload }: PayloadAction<Part[]>): void => {
  const byKey = new Map(state.parts.map((p) => [p.key, p]))
  for (const p of payload) {
    const old = byKey.get(p.key)
    byKey.set(p.key, old ? { ...p, qty: old.qty } : p)
  }
  state.parts = [...byKey.values()]
}

/** Remplace tout le catalogue : quantités des planches perso et cases « Fait » repartent à zéro (réglages et cases de gravure gardés). */
export const catalogReplaced = (state: ProjectState, { payload }: PayloadAction<Part[]>): void => {
  state.parts = payload
  state.done = {}
  for (const b of state.boards) {
    b.qty = {}
    b.overrides = {}
  }
}

/** Ajoute des pièces déjà lues (bibliothèque) ; une pièce connue garde sa quantité choisie. */
export const partsAdded = (state: ProjectState, { payload }: PayloadAction<Part[]>): void => {
  const byKey = new Map(state.parts.map((p) => [p.key, p]))
  for (const p of payload) byKey.set(p.key, byKey.get(p.key) ?? p)
  state.parts = [...byKey.values()]
}

export const qtySet = (state: ProjectState, { payload }: PayloadAction<QtyPayload>): void => {
  const p = state.parts.find((q) => q.key === payload.key)
  if (p) p.qty = toQty(payload.qty)
}

export const partRemoved = (state: ProjectState, { payload: key }: PayloadAction<string>): void => {
  state.parts = state.parts.filter((p) => p.key !== key)
  for (const b of state.boards) {
    delete b.qty[key]
    dropOverrides(b, (k) => k !== key)
  }
}

export const projectRemoved = (state: ProjectState, { payload: project }: PayloadAction<string>): void => {
  state.parts = state.parts.filter((p) => p.project !== project)
}

export const cleared = (): ProjectState => emptyProject()

export const settingsSet = (state: ProjectState, { payload }: PayloadAction<Partial<SheetSettings>>): void => {
  Object.assign(state.settings, payload)
}

export const autoMarkingSet = (state: ProjectState, { payload }: PayloadAction<AutoMarkingPayload>): void => {
  state.autoMarking[payload.key] = { ...(state.autoMarking[payload.key] ?? DEFAULT_MARKING), ...payload.patch }
}

export const doneSet = (state: ProjectState, { payload }: PayloadAction<DonePayload>): void => {
  if (payload.value) state.done[payload.key] = true
  else delete state.done[payload.key]
}

export const boardAdded = (state: ProjectState, { payload }: PayloadAction<BoardAddedPayload>): void => {
  state.boards.push({ id: payload.id, name: 'Planche perso', thickness: payload.thickness, width: state.settings.width, height: state.settings.height, qty: {}, overrides: {}, marking: { ...DEFAULT_MARKING } })
}

/** Prépare l'action « ajouter une planche perso » : l'identifiant est tiré ici, pas dans le reducer. */
export const prepareBoardAdded = (thickness: number) => ({ payload: { id: Math.random().toString(36).slice(2, 7), thickness } })

export const boardUpdated = (state: ProjectState, { payload }: PayloadAction<BoardUpdatedPayload>): void => {
  const b = boardOf(state, payload.id)
  if (b) Object.assign(b, payload.patch)
}

export const boardRemoved = (state: ProjectState, { payload: id }: PayloadAction<string>): void => {
  state.boards = state.boards.filter((b) => b.id !== id)
}

export const boardQtySet = (state: ProjectState, { payload }: PayloadAction<BoardQtyPayload>): void => {
  const b = boardOf(state, payload.id)
  if (!b) return
  const n = toQty(payload.qty)
  // les exemplaires en trop perdent leur position manuelle
  dropOverrides(b, (k, i) => k !== payload.key || i <= n)
  b.qty[payload.key] = n
}

export const overrideSet = (state: ProjectState, { payload }: PayloadAction<OverridePayload>): void => {
  const b = boardOf(state, payload.id)
  if (!b) return
  if (payload.override) b.overrides[payload.instance] = payload.override
  else delete b.overrides[payload.instance]
}
