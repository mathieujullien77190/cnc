import { useEffect, useMemo, useState } from 'react'
import { laserItems } from '@/core/job'
import type { Marking, Sheet } from '@/core/types'
import { useLaserMachine } from '@/laser'
import type { crenelTestSheet } from '@/models/crenelTest'
import type { useProject } from './useProject'

/** Essai de crantage ou de goujons : planche temporaire, hors projet. */
type TestSheet = { sheet: Sheet; marking: Marking }

/**
 * Pilotage laser du projet : les planches du projet plus l'éventuelle planche d'essai, la machine,
 * et les raccourcis « envoyer cette planche » / « lancer un essai ». La planche d'essai disparaît à la fermeture du pilotage.
 */
export const useLaserSession = (project: ReturnType<typeof useProject>) => {
  const { parts, settings, entries } = project
  const [lowered, setLowered] = useState(false)
  const [test, setTest] = useState<TestSheet | null>(null)
  const items = useMemo(() => laserItems(test ? [...entries, test] : entries), [entries, test])
  const m = useLaserMachine(items, { W: settings.width, H: settings.height })
  useEffect(() => {
    if (!m.open) {
      setLowered(false)
      setTest(null)
    }
  }, [m.open])

  const startTest = (make: typeof crenelTestSheet) => {
    const count = new Map<number, number>()
    for (const p of parts) count.set(p.thickness, (count.get(p.thickness) ?? 0) + 1)
    const thickness = [...count].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 3 // l'épaisseur la plus utilisée du projet, 3 mm sinon
    setTest(make(thickness, settings.width, settings.height))
    m.setItemIndex(entries.filter((e) => e.sheet.items.length).length)
    m.setOpen(true)
  }

  const sendToLaser = (key: string) => {
    const i = items.findIndex((it) => it.fileName === key)
    if (i < 0) return
    m.setItemIndex(i)
    m.setOpen(true)
  }

  return { m, lowered, setLowered, startTest, sendToLaser }
}
