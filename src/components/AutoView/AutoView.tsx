import { useEffect } from 'react'
import type { Sheet } from '@/core/types'
import { boardFromSheet } from '@/core/sheets'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { uiActions } from '@/store/uiSlice'
import { DEFAULT_MARKING } from '@/constants'
import SheetCard from '@/components/SheetCard'
import type { AutoViewProps } from './types'

/** Planches automatiques : toutes les pièces importées, rangées par épaisseur. */
export const AutoView = ({ project, onLaser }: AutoViewProps) => {
  const { autoSheets, entries, setAutoMarking, done, setDone, boards, addBoard, updateBoard } = project
  const dispatch = useAppDispatch()
  // pièce cliquée dans la liste : on affiche la planche qui la porte (défilement + cadre vert + pièce surlignée)
  const focus = useAppSelector((s) => s.ui.focusedPart)
  const focusedSheet = focus ? autoSheets.find((s) => s.items.some((i) => i.part.key === focus.key)) : undefined
  useEffect(() => {
    if (focusedSheet) document.getElementById(`sheet-${focusedSheet.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focus?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!autoSheets.length) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">
        Aucune pièce à découper. Importe un fichier <b>.cutparts.json</b> (bouton à gauche) ou mets une quantité sur au moins une pièce.
      </div>
    )
  }
  const thicknesses = [...new Set(autoSheets.map((s) => s.thickness))]
  const markingOf = (s: Sheet) => entries.find((e) => e.sheet.key === s.key)?.marking ?? DEFAULT_MARKING
  // « Modifier la planche » : la planche remplace la planche perso (la seule qui existe), puis on passe dans l'onglet perso
  const edit = (s: Sheet) => {
    const id = boards[0]?.id ?? addBoard(s.thickness)
    updateBoard(id, boardFromSheet(s, markingOf(s)))
    dispatch(uiActions.selectedPieceSet(null))
    dispatch(uiActions.tabSet('perso'))
  }
  return (
    <div className="space-y-6">
      {thicknesses.map((t) => {
        const list = autoSheets.filter((s) => s.thickness === t)
        return (
          <section key={t} className="space-y-2.5">
            <h2 className="text-sm font-semibold text-stone-700">
              Contreplaqué {t} mm <span className="font-normal text-stone-500">· {list.length} planche{list.length > 1 ? 's' : ''} · {list.reduce((n, s) => n + s.items.length, 0)} pièces</span>
            </h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((s) => (
                <SheetCard key={s.key} sheet={s} marking={markingOf(s)} onMarking={(patch) => setAutoMarking(s.key, patch)} onLaser={() => onLaser(s.key)} done={!!done[s.key]} onDone={(v) => setDone(s.key, v)} onEdit={() => edit(s)} highlight={focusedSheet?.key === s.key ? focus?.key : null} focused={focusedSheet?.key === s.key} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
