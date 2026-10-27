import type { Marking } from '@/core/types'

export type MarkingTogglesProps = {
  value: Marking
  onChange: (patch: Partial<Marking>) => void
}
