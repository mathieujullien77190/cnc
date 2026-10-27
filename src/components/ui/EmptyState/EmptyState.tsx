import type { EmptyStateProps } from './types'

/** Zone en pointillés qui dit qu'il n'y a rien à montrer. */
export const EmptyState = ({ children }: EmptyStateProps) => (
  <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">{children}</div>
)
