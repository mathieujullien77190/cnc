import type { ReactNode } from 'react'

export type DropZoneProps = {
  onFiles: (files: File[]) => void
  children: ReactNode
}
