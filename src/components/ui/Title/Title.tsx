import type { TitleProps } from './types'

/** Titre de bloc : gras, en taille `sm` ou `xs`. */
export const Title = ({ children, as: Tag = 'h3', size = 'sm', tone = 'dark', className = '' }: TitleProps) => (
  <Tag className={`${className ? className + ' ' : ''}${size === 'sm' ? 'text-sm' : 'text-xs'} font-semibold ${tone === 'dark' ? 'text-stone-800' : 'text-stone-700'}`}>{children}</Tag>
)
