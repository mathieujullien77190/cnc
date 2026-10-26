import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseCutParts } from '../core/format'
import { buildAutoSheets, buildCustomSheet } from '../core/sheets'
import type { CustomBoard, Marking, Override, Part, Sheet, SheetSettings } from '../core/types'

const KEY = 'cnc-projet-v1'

export const DEFAULT_SETTINGS: SheetSettings = { width: 300, height: 300, margin: 5, gap: 1, spread: false }
export const DEFAULT_MARKING: Marking = { names: true, frame: true }

interface Stored {
  parts: Part[]
  settings: SheetSettings
  /** Cases cochées par planche automatique (clé de planche). */
  autoMarking: Record<string, Marking>
  boards: CustomBoard[]
}

const EMPTY: Stored = { parts: [], settings: DEFAULT_SETTINGS, autoMarking: {}, boards: [] }

const load = (): Stored => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Stored>) } : EMPTY
  } catch {
    return EMPTY
  }
}

const uid = () => Math.random().toString(36).slice(2, 7)

/** Une planche (automatique ou perso) avec ses cases cochées. */
export interface SheetEntry {
  sheet: Sheet
  marking: Marking
  board?: CustomBoard
}

export interface ImportReport {
  file: string
  added: number
  replaced: number
  errors: string[]
}

/** État du projet : catalogue de pièces, réglages de planche, planches automatiques et personnalisées. Gardé dans localStorage. */
export function useProject() {
  const [state, setState] = useState<Stored>(load)
  const { parts, settings, autoMarking, boards } = state

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* stockage plein ou indisponible : le projet reste en mémoire */
    }
  }, [state])

  const update = useCallback((f: (s: Stored) => Stored) => setState(f), [])

  /** Lit des textes de fichiers `.cutparts.json`. Une pièce déjà connue (même projet, même id) est remplacée en gardant sa quantité choisie. */
  const importTexts = useCallback(
    (files: { name: string; text: string }[]): ImportReport[] => {
      const known = new Set(parts.map((p) => p.key))
      const reports: ImportReport[] = []
      const incoming: Part[] = []
      for (const f of files) {
        const r = parseCutParts(f.text)
        const replaced = r.parts.filter((p) => known.has(p.key)).length
        reports.push({ file: f.name, added: r.parts.length - replaced, replaced, errors: r.errors })
        incoming.push(...r.parts)
      }
      update((s) => {
        const byKey = new Map(s.parts.map((p) => [p.key, p]))
        for (const p of incoming) {
          const old = byKey.get(p.key)
          byKey.set(p.key, old ? { ...p, qty: old.qty } : p)
        }
        return { ...s, parts: [...byKey.values()] }
      })
      return reports
    },
    [parts, update],
  )
  const importFiles = useCallback(async (files: File[]) => importTexts(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })))), [importTexts])

  /** Ajoute des pièces déjà lues (bibliothèque) ; une pièce connue garde sa quantité choisie. */
  const addParts = useCallback(
    (list: Part[]) =>
      update((s) => {
        const byKey = new Map(s.parts.map((p) => [p.key, p]))
        for (const p of list) byKey.set(p.key, byKey.get(p.key) ?? p)
        return { ...s, parts: [...byKey.values()] }
      }),
    [update],
  )
  const setQty = useCallback((key: string, qty: number) => update((s) => ({ ...s, parts: s.parts.map((p) => (p.key === key ? { ...p, qty: Math.max(0, Math.round(qty) || 0) } : p)) })), [update])
  const removePart = useCallback(
    (key: string) =>
      update((s) => ({
        ...s,
        parts: s.parts.filter((p) => p.key !== key),
        boards: s.boards.map((b) => {
          const { [key]: _gone, ...qty } = b.qty
          return { ...b, qty, overrides: Object.fromEntries(Object.entries(b.overrides).filter(([u]) => !u.startsWith(`${key}#`))) }
        }),
      })),
    [update],
  )
  const removeProject = useCallback((project: string) => update((s) => ({ ...s, parts: s.parts.filter((p) => p.project !== project) })), [update])
  const clearAll = useCallback(() => update(() => EMPTY), [update])
  const setSettings = useCallback((patch: Partial<SheetSettings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })), [update])
  const setAutoMarking = useCallback((key: string, patch: Partial<Marking>) => update((s) => ({ ...s, autoMarking: { ...s.autoMarking, [key]: { ...(s.autoMarking[key] ?? DEFAULT_MARKING), ...patch } } })), [update])

  const addBoard = useCallback(
    (thickness: number): string => {
      const id = uid()
      update((s) => ({
        ...s,
        boards: [...s.boards, { id, name: `Essai ${s.boards.length + 1}`, thickness, width: s.settings.width, height: s.settings.height, qty: {}, overrides: {}, marking: DEFAULT_MARKING }],
      }))
      return id
    },
    [update],
  )
  const updateBoard = useCallback((id: string, patch: Partial<CustomBoard>) => update((s) => ({ ...s, boards: s.boards.map((b) => (b.id === id ? { ...b, ...patch } : b)) })), [update])
  const removeBoard = useCallback((id: string) => update((s) => ({ ...s, boards: s.boards.filter((b) => b.id !== id) })), [update])
  const setBoardQty = useCallback(
    (id: string, key: string, qty: number) =>
      update((s) => ({
        ...s,
        boards: s.boards.map((b) => {
          if (b.id !== id) return b
          const n = Math.max(0, Math.round(qty) || 0)
          // les exemplaires en trop perdent leur position manuelle
          const overrides = Object.fromEntries(Object.entries(b.overrides).filter(([u]) => !u.startsWith(`${key}#`) || Number(u.split('#')[1]) <= n))
          return { ...b, qty: { ...b.qty, [key]: n }, overrides }
        }),
      })),
    [update],
  )
  const setOverride = useCallback((id: string, instance: string, o: Override | null) => {
    update((s) => ({
      ...s,
      boards: s.boards.map((b) => {
        if (b.id !== id) return b
        const overrides = { ...b.overrides }
        if (o) overrides[instance] = o
        else delete overrides[instance]
        return { ...b, overrides }
      }),
    }))
  }, [update])

  const autoSheets = useMemo(() => buildAutoSheets(parts, settings), [parts, settings])
  const boardSheets = useMemo(() => boards.map((b) => buildCustomSheet(b, parts, settings.margin, settings.gap, !!settings.spread)), [boards, parts, settings.margin, settings.gap, settings.spread])
  const entries = useMemo<SheetEntry[]>(
    () => [
      ...autoSheets.map((sheet) => ({ sheet, marking: autoMarking[sheet.key] ?? DEFAULT_MARKING })),
      ...boardSheets.map((sheet, i) => ({ sheet, marking: boards[i].marking, board: boards[i] })),
    ],
    [autoSheets, boardSheets, autoMarking, boards],
  )

  return {
    parts, settings, boards, autoSheets, boardSheets, entries,
    importFiles, importTexts, addParts, setQty, removePart, removeProject, clearAll, setSettings, setAutoMarking,
    addBoard, updateBoard, removeBoard, setBoardQty, setOverride,
  }
}

export type Project = ReturnType<typeof useProject>
