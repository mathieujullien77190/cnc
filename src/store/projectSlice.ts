import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_MARKING, DEFAULT_SETTINGS, PROJECT_KEY } from '@/constants'
import type { CustomBoard, Marking, Override, Part, SheetSettings } from '@/core/types'
import type { ProjectState } from '@/types'

/** Projet vide (copie neuve à chaque appel : jamais partagée). */
export const emptyProject = (): ProjectState => ({ parts: [], settings: { ...DEFAULT_SETTINGS }, autoMarking: {}, boards: [], done: {} })

/** Lit le projet gardé dans localStorage (même format qu'avant le store) ; un stockage absent ou illisible donne un projet vide. */
export const loadProject = (): ProjectState => {
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    return raw ? { ...emptyProject(), ...(JSON.parse(raw) as Partial<ProjectState>) } : emptyProject()
  } catch {
    return emptyProject()
  }
}

/** Texte écrit dans localStorage : exactement le format d'avant le store. */
export const serializeProject = (p: ProjectState): string => JSON.stringify(p)

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

export const projectSlice = createSlice({
  name: 'project',
  initialState: emptyProject,
  reducers: {
    /** Pièces lues (fichiers) : une pièce déjà connue (même projet, même id) est remplacée en gardant sa quantité choisie. */
    partsImported: (state, { payload }: PayloadAction<Part[]>) => {
      const byKey = new Map(state.parts.map((p) => [p.key, p]))
      for (const p of payload) {
        const old = byKey.get(p.key)
        byKey.set(p.key, old ? { ...p, qty: old.qty } : p)
      }
      state.parts = [...byKey.values()]
    },
    /** Remplace tout le catalogue : quantités des planches perso et cases « Fait » repartent à zéro (réglages et cases de gravure gardés). */
    catalogReplaced: (state, { payload }: PayloadAction<Part[]>) => {
      state.parts = payload
      state.done = {}
      for (const b of state.boards) {
        b.qty = {}
        b.overrides = {}
      }
    },
    /** Ajoute des pièces déjà lues (bibliothèque) ; une pièce connue garde sa quantité choisie. */
    partsAdded: (state, { payload }: PayloadAction<Part[]>) => {
      const byKey = new Map(state.parts.map((p) => [p.key, p]))
      for (const p of payload) byKey.set(p.key, byKey.get(p.key) ?? p)
      state.parts = [...byKey.values()]
    },
    qtySet: (state, { payload }: PayloadAction<{ key: string; qty: number }>) => {
      const p = state.parts.find((q) => q.key === payload.key)
      if (p) p.qty = toQty(payload.qty)
    },
    partRemoved: (state, { payload: key }: PayloadAction<string>) => {
      state.parts = state.parts.filter((p) => p.key !== key)
      for (const b of state.boards) {
        delete b.qty[key]
        dropOverrides(b, (k) => k !== key)
      }
    },
    projectRemoved: (state, { payload: project }: PayloadAction<string>) => {
      state.parts = state.parts.filter((p) => p.project !== project)
    },
    cleared: () => emptyProject(),
    settingsSet: (state, { payload }: PayloadAction<Partial<SheetSettings>>) => {
      Object.assign(state.settings, payload)
    },
    autoMarkingSet: (state, { payload }: PayloadAction<{ key: string; patch: Partial<Marking> }>) => {
      state.autoMarking[payload.key] = { ...(state.autoMarking[payload.key] ?? DEFAULT_MARKING), ...payload.patch }
    },
    doneSet: (state, { payload }: PayloadAction<{ key: string; value: boolean }>) => {
      if (payload.value) state.done[payload.key] = true
      else delete state.done[payload.key]
    },
    boardAdded: {
      reducer: (state, { payload }: PayloadAction<{ id: string; thickness: number }>) => {
        state.boards.push({ id: payload.id, name: 'Planche perso', thickness: payload.thickness, width: state.settings.width, height: state.settings.height, qty: {}, overrides: {}, marking: { ...DEFAULT_MARKING } })
      },
      prepare: (thickness: number) => ({ payload: { id: Math.random().toString(36).slice(2, 7), thickness } }),
    },
    boardUpdated: (state, { payload }: PayloadAction<{ id: string; patch: Partial<CustomBoard> }>) => {
      const b = boardOf(state, payload.id)
      if (b) Object.assign(b, payload.patch)
    },
    boardRemoved: (state, { payload: id }: PayloadAction<string>) => {
      state.boards = state.boards.filter((b) => b.id !== id)
    },
    boardQtySet: (state, { payload }: PayloadAction<{ id: string; key: string; qty: number }>) => {
      const b = boardOf(state, payload.id)
      if (!b) return
      const n = toQty(payload.qty)
      // les exemplaires en trop perdent leur position manuelle
      dropOverrides(b, (k, i) => k !== payload.key || i <= n)
      b.qty[payload.key] = n
    },
    overrideSet: (state, { payload }: PayloadAction<{ id: string; instance: string; override: Override | null }>) => {
      const b = boardOf(state, payload.id)
      if (!b) return
      if (payload.override) b.overrides[payload.instance] = payload.override
      else delete b.overrides[payload.instance]
    },
  },
})

export const projectActions = projectSlice.actions
