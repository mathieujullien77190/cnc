import { useAppSelector } from '@/store/hooks'
import { selectAutoSheets, selectBoardSheets, selectEntries } from './selectors'

/** Planches calculées (automatiques, perso, toutes avec leurs cases) : jamais stockées, recalculées seulement quand ce dont elles dépendent change. */
export const useSheets = () => ({
  autoSheets: useAppSelector(selectAutoSheets),
  boardSheets: useAppSelector(selectBoardSheets),
  entries: useAppSelector(selectEntries),
})
