import { useCallback, useLayoutEffect, useRef } from 'react'
import AppHeader from '@/components/AppHeader'
import AutoView from '@/components/AutoView'
import BoardsView from '@/components/BoardsView'
import DropZone from '@/components/DropZone'
import LaserDialog from '@/components/LaserDialog'
import ModelsView from '@/components/ModelsView'
import PartsPanel from '@/components/PartsPanel'
import SettingsPanel from '@/components/SettingsPanel'
import { crenelTestSheet } from '@/models/crenelTest'
import { goujonTestSheet } from '@/models/goujonTest'
import { useLaserSession } from '@/state/useLaserSession'
import { useProject } from '@/state/useProject'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { Tab } from '@/types'
import { uiActions } from '@/store/uiSlice'

export const App = () => {
  const project = useProject()
  const { parts, settings, importFiles } = project
  const { m, lowered, setLowered, startTest, sendToLaser } = useLaserSession(project)
  const dispatch = useAppDispatch()
  const tab = useAppSelector((s) => s.ui.tab)
  const reports = useAppSelector((s) => s.ui.importReports)

  // chaque onglet retrouve sa position de défilement
  const scrolls = useRef<Record<string, number>>({})
  const goTo = (t: Tab) => {
    scrolls.current[tab] = window.scrollY
    dispatch(uiActions.tabSet(t))
  }
  useLayoutEffect(() => {
    window.scrollTo(0, scrolls.current[tab] ?? 0)
  }, [tab])

  const onFiles = useCallback(
    async (files: File[]) => {
      const json = files.filter((f) => /\.json$/i.test(f.name))
      if (json.length) dispatch(uiActions.importReportsSet(await importFiles(json)))
    },
    [importFiles, dispatch],
  )

  return (
    <DropZone onFiles={(f) => void onFiles(f)}>
      <AppHeader tab={tab} onTab={goTo} laserLowered={m.open && lowered} onLaserClick={() => { if (m.open && lowered) setLowered(false); else m.setOpen(true) }} />

      <div className={`grid flex-1 gap-4 p-4 ${tab === 'modeles' ? '' : 'lg:grid-cols-[20rem_1fr]'}`}>
        {/* les vues restent toutes montées (masquées hors de leur onglet) : sélections, zoom, branches ouvertes et vue 3D se retrouvent comme on les a laissés */}
        <aside className={`space-y-3 ${tab === 'modeles' ? 'hidden' : ''} lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto`}>
          <PartsPanel parts={parts} reports={reports} onFiles={(f) => void onFiles(f)} onPick={tab === 'auto' ? (key) => dispatch(uiActions.partFocused(key)) : undefined} onRemoveProject={project.removeProject} onClear={project.clearAll} />
          <SettingsPanel settings={settings} onChange={project.setSettings} onCrenelTest={() => startTest(crenelTestSheet)} onGoujonTest={() => startTest(goujonTestSheet)} onPowerSpeedTest={m.startTest} />
        </aside>
        <main className="min-w-0">
          <div className={tab === 'auto' ? '' : 'hidden'}>
            <AutoView project={project} onLaser={sendToLaser} />
          </div>
          <div className={tab === 'perso' ? '' : 'hidden'}>
            <BoardsView project={project} onLaser={sendToLaser} />
          </div>
          <div className={tab === 'modeles' ? '' : 'hidden'}>
            <ModelsView />
          </div>
        </main>
      </div>

      <LaserDialog m={m} lowered={lowered} setLowered={setLowered} />
    </DropZone>
  )
}
