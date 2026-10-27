import type { Part, SheetSettings } from '@/core/types'

export type DeepOptimizerProps = {
  parts: Part[]
  settings: SheetSettings
  onChange: (patch: Partial<SheetSettings>) => void
}
