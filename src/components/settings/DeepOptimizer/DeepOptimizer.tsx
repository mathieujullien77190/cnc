import { useMemo } from 'react'
import { deepSignature, validDeep } from '@/core/sheets'
import { Btn, Hint, ProgressBar } from '@/components/ui'
import { useDeepSearch } from '@/state/useDeepSearch'
import type { DeepOptimizerProps } from './types'

/** « Optimiser mieux » : cherche pendant quelques secondes (sans bloquer la page) à ranger des pièces dans les trous d'autres pièces. Le résultat est gardé dans les réglages. */
export const DeepOptimizer = ({ parts, settings, onChange }: DeepOptimizerProps) => {
  const { state, elapsedMs, budgetMs, start, cancel } = useDeepSearch(parts, settings, (deep) => onChange({ deep }))
  const active = validDeep(parts, settings)
  const sig = useMemo(() => deepSignature(parts, settings), [parts, settings])
  const hasParts = parts.some((p) => p.qty > 0)

  if (state.phase === 'running') {
    const p = state.progress
    return (
      <div className="space-y-1.5">
        <ProgressBar value={elapsedMs / budgetMs} tone="busy" label={`Recherche… ${(elapsedMs / 1000).toFixed(0)} s sur ${(budgetMs / 1000).toFixed(0)} s`} />
        <p className="text-[11px] text-stone-600">{p ? `${p.before} planches → ${p.best} planches (${p.tried} essais)` : 'Démarrage…'}</p>
        <Btn variant="warn" onClick={cancel}>Annuler</Btn>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Btn onClick={start} disabled={!hasParts || !!active}>Optimiser mieux</Btn>
      {active ? (
        <p className="text-[11px] text-emerald-800">
          Rangement optimisé : {active.before} → {active.after} planches.{' '}
          <button type="button" className="underline hover:text-emerald-950" onClick={() => onChange({ deep: undefined })}>Revenir au rangement normal</button>
        </p>
      ) : (
        <Hint>{state.phase === 'done' && state.sig === sig ? state.message : `Cherche à ranger des pièces dans les trous d’autres pièces (environ ${Math.round(budgetMs / 1000)} s).`}</Hint>
      )}
    </div>
  )
}
