import type { ModelDef } from '@/models/types'

export type ModelListProps = {
  models: ModelDef[]
  currentId: string | undefined
  /** Clic sur un modèle : le choisir, ou le désélectionner s'il est déjà choisi. */
  onPick: (id: string) => void
}
