import { sheetSvg } from '@/core/svg'
import { saveSvg } from '@/laser'
import { Btn, Toolbar } from '@/components/ui'
import type { SheetActionsProps } from './types'

/** Téléchargement et envoi d'une planche : SVG (coupe rouge, gravure bleue), pilotage de la laser. */
export const SheetActions = ({ sheet, marking, onLaser, onEdit }: SheetActionsProps) => {
  const empty = !sheet.items.length
  return (
    <Toolbar className="gap-2">
      <Btn block={false} disabled={empty} onClick={() => saveSvg(sheetSvg(sheet, { marking }), `${sheet.key}.svg`)}>SVG</Btn>
      <Btn block={false} variant="primary" disabled={empty} onClick={onLaser}>Envoyer au laser</Btn>
      {onEdit && <Btn block={false} disabled={empty} onClick={onEdit}>Afficher dans planche perso</Btn>}
    </Toolbar>
  )
}
