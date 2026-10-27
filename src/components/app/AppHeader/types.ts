import type { Tab } from '@/types'

export type AppHeaderProps = {
  tab: Tab
  onTab: (tab: Tab) => void
  /** Le pilotage laser est ouvert et rabaissé. */
  laserLowered: boolean
  onLaserClick: () => void
  /** Nom du modèle 3D choisi (absent : aucun). */
  modelName?: string
  /** Épaisseurs des pièces à découper (mm), de la plus fine à la plus épaisse. */
  thicknesses: number[]
}
