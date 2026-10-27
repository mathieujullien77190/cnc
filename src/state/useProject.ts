import { useMemo } from 'react'
import type { CustomBoard, Marking, Override, Part, SheetSettings } from '@/core/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { importFiles, importTexts, projectActions, replaceTexts, selectBoards, selectDone, selectParts, selectSettings, useSheets, type FileText } from '@/store/project'

/**
 * Façade mince sur le store : le projet (catalogue de pièces, réglages de planche, planches automatiques et personnalisées)
 * avec les mêmes noms qu'avant. L'état vit dans `src/store/` et est gardé dans localStorage par `persistStore`.
 */
export const useProject = () => {
  const dispatch = useAppDispatch()
  const parts = useAppSelector(selectParts)
  const settings = useAppSelector(selectSettings)
  const boards = useAppSelector(selectBoards)
  const done = useAppSelector(selectDone)
  const sheets = useSheets()

  const actions = useMemo(
    () => ({
      importFiles: (files: File[]) => dispatch(importFiles(files)),
      importTexts: (files: FileText[]) => dispatch(importTexts(files)),
      replaceTexts: (files: FileText[]) => dispatch(replaceTexts(files)),
      addParts: (list: Part[]) => dispatch(projectActions.partsAdded(list)),
      setQty: (key: string, qty: number) => dispatch(projectActions.qtySet({ key, qty })),
      removePart: (key: string) => dispatch(projectActions.partRemoved(key)),
      removeProject: (project: string) => dispatch(projectActions.projectRemoved(project)),
      clearAll: () => dispatch(projectActions.cleared()),
      setSettings: (patch: Partial<SheetSettings>) => dispatch(projectActions.settingsSet(patch)),
      setAutoMarking: (key: string, patch: Partial<Marking>) => dispatch(projectActions.autoMarkingSet({ key, patch })),
      setDone: (key: string, value: boolean) => dispatch(projectActions.doneSet({ key, value })),
      addBoard: (thickness: number): string => dispatch(projectActions.boardAdded(thickness)).payload.id,
      updateBoard: (id: string, patch: Partial<CustomBoard>) => dispatch(projectActions.boardUpdated({ id, patch })),
      removeBoard: (id: string) => dispatch(projectActions.boardRemoved(id)),
      setBoardQty: (id: string, key: string, qty: number) => dispatch(projectActions.boardQtySet({ id, key, qty })),
      setOverride: (id: string, instance: string, override: Override | null) => dispatch(projectActions.overrideSet({ id, instance, override })),
    }),
    [dispatch],
  )

  return { parts, settings, boards, done, ...sheets, ...actions }
}

export type Project = ReturnType<typeof useProject>
