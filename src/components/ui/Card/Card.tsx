import type { CardProps } from './types'

/** Boîte de l'interface : fond blanc, bord fin arrondi, ombre légère. Le contenu et sa disposition viennent de l'appelant. */
export const Card = ({ children, className = '', as: Tag = 'section' }: CardProps) => (
  <Tag className={`rounded-lg border border-stone-200 bg-white p-3 shadow-sm ${className}`}>{children}</Tag>
)
