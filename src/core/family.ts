/** Famille d'une pièce : son nom sans le numéro (`R-02` -> `R`). Sans numéro, le nom entier. */
export const familyOf = (id: string): string => id.replace(/-\d+$/, '')
