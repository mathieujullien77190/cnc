import { useCallback, useEffect, useRef, useState } from 'react'
import { DEEP_BUDGET_MS, type DeepMessage, type DeepProgress, type DeepRequest, type DeepResult } from '@/core/deep'
import { deepSignature } from '@/core/sheets'
import type { DeepPlan, Part, SheetSettings } from '@/core/types'

export type DeepState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number; progress: DeepProgress | null }
  | { phase: 'done'; message: string; /** Empreinte des pièces et réglages au moment du bilan : le bilan ne vaut plus s'ils changent. */ sig: string }

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`
const planches = (n: number) => `${n} planche${n > 1 ? 's' : ''}`
const percent = (v: number) => `${Math.round(v * 100)} %`

/** Bilan en une phrase : « 5 planches → 4 planches », ou « Aucune amélioration ». */
export const reportOf = (r: DeepResult): string =>
  r.plan
    ? `${planches(r.before.sheets)} → ${planches(r.after.sheets)}${r.after.lost < r.before.lost ? `, ${r.before.lost - r.after.lost} pièce(s) de moins perdue(s)` : ''} (remplissage ${percent(r.before.fill)} → ${percent(r.after.fill)}, ${r.tried} essais en ${seconds(r.ms)}).`
    : `Aucune amélioration : ${planches(r.before.sheets)} comme avant (${r.tried} essais en ${seconds(r.ms)}).`

/**
 * « Optimiser mieux » : lance la recherche dans un Web Worker (l'interface reste libre), suit sa progression, et rend le plan trouvé par `onPlan`.
 * Le résultat est ignoré si les pièces ou les réglages ont changé pendant la recherche. `cancel` arrête le worker.
 */
export const useDeepSearch = (parts: Part[], settings: SheetSettings, onPlan: (plan: DeepPlan) => void) => {
  const [state, setState] = useState<DeepState>({ phase: 'idle' })
  const [now, setNow] = useState(0)
  const worker = useRef<Worker | null>(null)
  const latest = useRef({ parts, settings, onPlan })
  latest.current = { parts, settings, onPlan }

  const stop = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
  }, [])
  useEffect(() => stop, [stop])

  const running = state.phase === 'running'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [running])

  const start = useCallback(() => {
    stop()
    const startedAt = performance.now()
    setNow(startedAt)
    setState({ phase: 'running', startedAt, progress: null })
    const w = new Worker(new URL('./deepSearch.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    const finish = (message: string) => {
      stop()
      setState({ phase: 'done', message, sig: deepSignature(latest.current.parts, latest.current.settings) })
    }
    w.onmessage = (e: MessageEvent<DeepMessage>) => {
      const m = e.data
      if (m.type === 'progress') setState((s) => (s.phase === 'running' ? { ...s, progress: m } : s))
      else if (m.type === 'error') finish(`La recherche a échoué : ${m.message}`)
      else {
        const { plan } = m.result
        const cur = latest.current
        if (plan && plan.sig !== deepSignature(cur.parts, cur.settings)) finish('Les pièces ou les réglages ont changé pendant la recherche : résultat ignoré.')
        else {
          if (plan) cur.onPlan(plan)
          finish(reportOf(m.result))
        }
      }
    }
    w.onerror = () => finish('La recherche a échoué (worker indisponible).')
    const req: DeepRequest = { parts: latest.current.parts, settings: { ...latest.current.settings, deep: undefined }, budgetMs: DEEP_BUDGET_MS }
    w.postMessage(req)
  }, [stop])

  const cancel = useCallback(() => {
    stop()
    setState({ phase: 'idle' }) // annulée : rien à dire, le bouton redevient disponible
  }, [stop])

  const elapsedMs = state.phase === 'running' ? Math.max(0, now - state.startedAt) : 0
  return { state, elapsedMs, budgetMs: DEEP_BUDGET_MS, start, cancel }
}
