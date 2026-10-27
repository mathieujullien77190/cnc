import type { Part, SheetSettings } from '@/core/types'

export type SettingsPanelProps = {
  parts: Part[]
  settings: SheetSettings
  onChange: (patch: Partial<SheetSettings>) => void
  onCrenelTest: () => void
  onGoujonTest: () => void
  onPowerSpeedTest: () => void
}
