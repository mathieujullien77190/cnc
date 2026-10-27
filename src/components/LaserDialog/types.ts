import type { LaserMachine } from '@/laser'

export type LaserDialogProps = {
  m: LaserMachine
  lowered: boolean
  setLowered: (v: boolean) => void
}
