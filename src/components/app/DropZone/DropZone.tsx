import { useState, type DragEvent } from 'react'
import type { DropZoneProps } from './types'

/** Toute la page accepte le dépôt de fichiers ; un voile indique la zone de dépôt pendant le glisser. */
export const DropZone = ({ onFiles, children }: DropZoneProps) => {
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    onFiles([...e.dataTransfer.files])
  }
  return (
    <div
      className="flex min-h-screen flex-col"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false) }}
      onDrop={onDrop}
    >
      {children}
      {over && <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-emerald-900/20 text-lg font-semibold text-emerald-900">Dépose les fichiers .cutparts.json</div>}
    </div>
  )
}
