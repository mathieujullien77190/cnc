import { useEffect } from 'react'
import type { Sheet } from '@/core/types'
import { boardFromSheet } from '@/core/sheets'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { uiActions } from '@/store/ui'
import { DEFAULT_MARKING } from '@/constants'
import SheetCard from '@/components/sheets/SheetCard'
import type { AutoViewProps } from './types'
import { EmptyState, Title } from '@/components/ui'

/** Planches automatiques : toutes les pièces importées, rangées par épaisseur. */
export const AutoView = ({ project, onLaser }: AutoViewProps) => {
  const { autoSheets, entries, setAutoMarking, done, setDone, boards, addBoard, updateBoard } = project
  const dispatch = useAppDispatch()
  // clic sur une pièce : contour vert sur l'exemplaire, sa ligne est montrée dans la liste ; clic sur le fond : plus rien de choisi
  const selectedUid = useAppSelector((s) => s.ui.selectedPiece)
  const pickPiece = (key: string | null, uid: string | null) => {
    dispatch(uiActions.selectedPieceSet(uid))
    if (key) dispatch(uiActions.partRevealed(key))
  }
  // pièce cliquée dans la liste : on affiche la planche qui la porte (défilement + cadre vert + pièce surlignée)
  const focus = useAppSelector((s) => s.ui.focusedPart)
  const focusedSheet = focus ? autoSheets.find((s) => s.items.some((i) => i.part.key === focus.key)) : undefined
  useEffect(() => {
    if (focusedSheet) document.getElementById(`sheet-${focusedSheet.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focus?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!autoSheets.length) {
    return (
      <EmptyState>
        Aucune pièce à découper. Importe un fichier <b>.cutparts.json</b> (bouton à gauche) ou mets une quantité sur au moins une pièce.
      </EmptyState>
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
            <Title as="h2" tone="medium">
              {/* l'épaisseur est dans l'en-tête ; on ne la répète ici que s'il y en a plusieurs */}
              {thicknesses.length > 1 && <>{t} mm </>}<span className="font-normal text-stone-500">{thicknesses.length > 1 && '· '}{list.length} planche{list.length > 1 ? 's' : ''} · {list.reduce((n, s) => n + s.items.length, 0)} pièces</span>
            </Title>
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((s) => (
                <SheetCard key={s.key} sheet={s} marking={markingOf(s)} onMarking={(patch) => setAutoMarking(s.key, patch)} onLaser={() => onLaser(s.key)} done={!!done[s.key]} onDone={(v) => setDone(s.key, v)} onEdit={() => edit(s)} onPiece={pickPiece} selectedUid={selectedUid} highlight={focusedSheet?.key === s.key ? focus?.key : null} focused={focusedSheet?.key === s.key} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
