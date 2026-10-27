import { LaserMachineModal } from '@/laser'
import SheetPicker from './SheetPicker'
import type { LaserDialogProps } from './types'

/** Fenêtre de pilotage de la laser. Reste montée tant que la machine est utilisée : la connexion et un envoi en cours survivent à la fermeture. */
export const LaserDialog = ({ m, lowered, setLowered }: LaserDialogProps) => {
  if (!m.open) return null
  return <LaserMachineModal m={m} top={<SheetPicker m={m} />} lowered={lowered} setLowered={setLowered} />
}
