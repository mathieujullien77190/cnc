import type { panelsToCutParts } from '@/models/toCutParts'
import type { ModelResult, Panel } from '@/models/types'

/** Planches pour la découpe (serrage des crans appliqué) et planches pour la vue 3D (cotes nominales : sans serrage, les languettes ne mordent pas dans les flancs, pas de traits qui se superposent). */
export type Built = ModelResult & { view: Panel[]; /** Planches telles que `build` les a produites (pour le fichier `.model.json`). */ raw: Panel[] }

/** Menu contextuel de la vue 3D : planche visée et position (px, dans la vue). */
export type MenuState = { index: number; x: number; y: number }

/** Fichier de pièces produit à partir des planches du modèle, avec ses avertissements. */
export type Cut = ReturnType<typeof panelsToCutParts>
