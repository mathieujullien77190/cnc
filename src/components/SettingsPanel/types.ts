import type { SheetSettings } from '@/core/types'

export type SettingsPanelProps = {
  settings: SheetSettings
  onChange: (patch: Partial<SheetSettings>) => void
  onCrenelTest: () => void
  onGoujonTest: () => void
  onPowerSpeedTest: () => void
}
