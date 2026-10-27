import { useEffect, useState } from 'react'
import { marksFor } from '@/core/sheets'
import type { Marking, Sheet } from '@/core/types'

/** Noms gravés par pièce. Calculés après l'affichage (le calcul peut prendre 200 ms) ; on ne montre que ceux de la planche affichée. */
export const useMarks = (sheet: Sheet, marking: Marking) => {
  const [named, setNamed] = useState<{ sheet: Sheet; marks: ReturnType<typeof marksFor> } | null>(null)
  useEffect(() => {
    if (!marking.names) return setNamed(null)
    const id = setTimeout(() => setNamed({ sheet, marks: marksFor(sheet) }), 0)
    return () => clearTimeout(id)
  }, [sheet, marking.names])
  return marking.names && named?.sheet === sheet ? named.marks : null
}
