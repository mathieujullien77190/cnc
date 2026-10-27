// Couleur par famille de pièces, commune à la vue planche et à la vue 3D : une famille garde la même couleur partout.
// Les couleurs sont FIXES : une catégorie a toujours la même couleur, quel que soit l'ordre dans lequel les vues la demandent. Les catégories connues
// ont leur couleur dans `FIXED` ; une autre prend une couleur de la palette choisie par son nom (jamais par l'ordre d'arrivée).

/** Traits gravés dans l'aperçu : les noms des pièces en bleu, les dessins du modèle (textes, traits, tableaux) en violet. */
export const NAME_COLOR = '#2563eb'
export const DRAWING_COLOR = '#9333ea'

/** Couleurs choisies par l'app : TOUJOURS pastel clair (luminosité ≥ 0,6, vérifié par `npm run check`). Les couleurs foncées ou vives ne viennent que d'un modèle (`colors`). */
export const PALETTE = [0xd9b98a, 0xa9c4a0, 0x9fb4d6, 0xd6a5b8, 0xd8d08a, 0xb6a4d6, 0x9fcfc8, 0xe0a98f, 0xc3c8a0, 0xa7b9cf, 0xcfa3c6, 0xd2c29a]

/** Couleurs des catégories connues, toutes pastel (le couvercle et l'habillage sont imposés par le modèle du nichoir, qui prime). */
export const FIXED: Record<string, number> = {
  Plaque: 0xd9b98a, Fond: 0xa9c4a0, Flanc: 0x9fb4d6, Paroi: 0xd6a5b8, Essai: 0xd8d08a, Boîtier: 0xa9c4a0, Réservoir: 0xd8d08a, Bac: 0xd6a5b8, Tiroir: 0x9fb4d6, Goujon: 0xb6a4d6,
  Corps: 0xd9b98a, Toit: 0xa9c4a0, Entrée: 0x9fb4d6, Ventilation: 0xd6a5b8, Aération: 0x9fcfc8, Hiver: 0xb6a4d6, Couvercle: 0xd9b98a, Habillage: 0xf4f1ea,
}

/** Teinte stable d'un nom (FNV-1a) : la même catégorie donne toujours le même indice. */
const hashOf = (name: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193)
  return h >>> 0
}
/** Couleurs imposées par les modèles (`colors` du fichier) : elles priment sur la palette. */
const preset = new Map<string, number>()

export const presetCategoryColor = (category: string, hex: number): void => {
  preset.set(category, hex)
}

export const categoryHex = (category: string): number => {
  const fixed = preset.get(category)
  if (fixed !== undefined) return fixed
  return FIXED[category] ?? PALETTE[hashOf(category) % PALETTE.length]
}

/** Couleur du texte lisible sur la couleur d'une famille : blanc sur un fond foncé (marron foncé…), gris très foncé sur un fond clair. */
export const categoryInk = (category: string): string => {
  const hex = categoryHex(category)
  const lum = (0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255)) / 255
  return lum < 0.55 ? '#ffffff' : '#1c1917'
}

export const categoryCss = (category: string): string => `#${categoryHex(category).toString(16).padStart(6, '0')}`
