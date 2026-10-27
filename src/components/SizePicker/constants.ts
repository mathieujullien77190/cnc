/** Zone de travail de la E1 Pro (mm) : au-delà, la valeur passe en rouge. */
export const MAX_W = 400
export const MAX_H = 320
/** Délai avant de transmettre une nouvelle taille (ms) : plusieurs clics sur les flèches ne font qu'un seul recalcul. */
export const SIZE_DEBOUNCE = 200

/** Formats de planche proposés (largeur × hauteur, mm). */
export const SHEET_FORMATS: readonly [number, number][] = [
  [300, 300],
  [400, 320],
]
