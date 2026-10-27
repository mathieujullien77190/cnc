import type { Tab } from '@/types'

export type AppHeaderProps = {
  tab: Tab
  onTab: (tab: Tab) => void
  /** Le pilotage laser est ouvert et rabaissé. */
  laserLowered: boolean
  onLaserClick: () => void
}
