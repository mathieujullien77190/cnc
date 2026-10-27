import type { Project } from '@/state/useProject'

export type AutoViewProps = {
  project: Project
  onLaser: (key: string) => void
}
