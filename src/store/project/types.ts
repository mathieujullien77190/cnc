import type { CustomBoard, Marking, Override, Part, SheetSettings } from '@/core/types'

/** Le projet tel qu'il est gardé dans localStorage (format `cnc-projet-v1`). */
export type ProjectState = {
  parts: Part[]
  settings: SheetSettings
  /** Cases cochées par planche automatique (clé de planche). */
  autoMarking: Record<string, Marking>
  boards: CustomBoard[]
  /** Planches marquées « fait » (clé de planche). */
  done: Record<string, boolean>
}

/** Contenu d'un fichier de pièces déjà lu. */
export type FileText = { name: string; text: string }

export type QtyPayload = { key: string; qty: number }
export type AutoMarkingPayload = { key: string; patch: Partial<Marking> }
export type DonePayload = { key: string; value: boolean }
export type BoardAddedPayload = { id: string; thickness: number }
export type BoardUpdatedPayload = { id: string; patch: Partial<CustomBoard> }
export type BoardQtyPayload = { id: string; key: string; qty: number }
export type OverridePayload = { id: string; instance: string; override: Override | null }
