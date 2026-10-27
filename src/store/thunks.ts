import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit'
import { parseCutParts } from '@/core/format'
import type { Part } from '@/core/types'
import type { ImportReport } from '@/types'
import type { RootState } from './index'
import { projectActions } from './projectSlice'

type AppThunk<R> = ThunkAction<R, RootState, unknown, UnknownAction>

/** Contenu d'un fichier de pièces déjà lu. */
export type FileText = { name: string; text: string }

/** Lit des textes de fichiers `.cutparts.json`. Une pièce déjà connue (même projet, même id) est remplacée en gardant sa quantité choisie. */
export const importTexts =
  (files: FileText[]): AppThunk<ImportReport[]> =>
  (dispatch, getState) => {
    const known = new Set(getState().project.parts.map((p) => p.key))
    const reports: ImportReport[] = []
    const incoming: Part[] = []
    for (const f of files) {
      const r = parseCutParts(f.text)
      const replaced = r.parts.filter((p) => known.has(p.key)).length
      reports.push({ file: f.name, added: r.parts.length - replaced, replaced, errors: r.errors })
      incoming.push(...r.parts)
    }
    dispatch(projectActions.partsImported(incoming))
    return reports
  }

/** Lit des fichiers déposés puis les importe. */
export const importFiles =
  (files: File[]): AppThunk<Promise<ImportReport[]>> =>
  async (dispatch) =>
    dispatch(importTexts(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })))))

/** Remplace tout le catalogue par le contenu de ces fichiers : l'ancien catalogue, les quantités des planches perso et les cases « Fait » repartent à zéro (réglages et cases de gravure gardés). */
export const replaceTexts =
  (files: FileText[]): AppThunk<ImportReport[]> =>
  (dispatch) => {
    const reports: ImportReport[] = []
    const incoming: Part[] = []
    for (const f of files) {
      const r = parseCutParts(f.text)
      reports.push({ file: f.name, added: r.parts.length, replaced: 0, errors: r.errors })
      incoming.push(...r.parts)
    }
    dispatch(projectActions.catalogReplaced(incoming))
    return reports
  }
