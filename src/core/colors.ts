// Couleur par famille de pièces, commune à la vue planche et à la vue 3D : une famille garde la même couleur partout.
// Chaque famille reçoit la couleur suivante de la palette la première fois qu'une vue la demande.

export const PALETTE = [0xd9b98a, 0xa9c4a0, 0x9fb4d6, 0xd6a5b8, 0xd8d08a, 0xb6a4d6]

const order = new Map<string, number>()

export const categoryHex = (category: string): number => {
  if (!order.has(category)) order.set(category, order.size)
  return PALETTE[order.get(category)! % PALETTE.length]
}

export const categoryCss = (category: string): string => `#${categoryHex(category).toString(16).padStart(6, '0')}`
