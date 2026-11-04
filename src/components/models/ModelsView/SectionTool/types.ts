import type { SectionState } from '@/store/models'

export type SectionToolProps = {
  section: SectionState
  /** Allume la coupe sur cet axe, ou l'éteint en recliquant dessus. */
  onAxis: (axis: SectionState['axis']) => void
  onPosition: (t: number) => void
  onFlip: () => void
}
