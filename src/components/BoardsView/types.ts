import type { Project } from '@/state/useProject'

export type BoardsViewProps = {
  project: Project
  onLaser: (key: string) => void
}
