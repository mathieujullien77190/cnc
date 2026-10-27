import { useEffect, useRef, useState } from 'react'
import { QTY_DEBOUNCE } from './constants'
import type { QtyStepperProps } from './types'

const BTN = 'h-6 w-6 rounded border border-stone-300 bg-white leading-none hover:bg-stone-100 disabled:opacity-40'

/** Quantité d'une pièce : le nombre s'affiche tout de suite, la planche n'est recalculée qu'une fois les clics terminés. */
export const QtyStepper = ({ id, n, onCommit }: QtyStepperProps) => {
  const [shown, setShown] = useState(n)
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; v: number } | null>(null)
  const commit = useRef(onCommit)
  commit.current = onCommit

  // la quantité venue d'ailleurs (planche vidée, changement d'épaisseur) remplace l'affichage, sauf clics en attente
  useEffect(() => {
    if (!pending.current) setShown(n)
  }, [n])
  // démonté avec un clic en attente : il n'est pas perdu
  useEffect(() => () => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    commit.current(pending.current.v)
  }, [])

  const set = (v: number) => {
    setShown(v)
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = {
      v,
      timer: setTimeout(() => {
        pending.current = null
        commit.current(v)
      }, QTY_DEBOUNCE),
    }
  }

  return (
    <>
      <button className={BTN} disabled={!shown} onClick={() => set(shown - 1)} aria-label={`Une ${id} de moins`}>−</button>
      <span className="w-6 text-center tabular-nums">{shown}</span>
      <button className={BTN} onClick={() => set(shown + 1)} aria-label={`Une ${id} de plus`}>+</button>
    </>
  )
}
