import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import AppHeader from '@/components/app/AppHeader'
import AutoView from '@/components/sheets/AutoView'
import BoardsView from '@/components/sheets/BoardsView'
import DropZone from '@/components/app/DropZone'
import LaserDialog from '@/components/laser/LaserDialog'
import ModelsView from '@/components/models/ModelsView'
import PartsPanel from '@/components/parts/PartsPanel'
import SettingsPanel from '@/components/settings/SettingsPanel'
import { crenelTestSheet } from '@/models/crenelTest'
import { goujonTestSheet } from '@/models/goujonTest'
import { modelById } from '@/models/registry'
import { useLaserSession } from '@/state/useLaserSession'
import { useProject } from '@/state/useProject'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { Tab } from '@/types'
import { selectSelectedPartKey, uiActions } from '@/store/ui'

export const App = () => {
  const project = useProject()
  const { parts, settings, importFiles } = project
  const { m, lowered, setLowered, startTest, sendToLaser } = useLaserSession(project)
  const dispatch = useAppDispatch()
  const tab = useAppSelector((s) => s.ui.tab)
  const reports = useAppSelector((s) => s.ui.importReports)
  const modelId = useAppSelector((s) => s.models.model)
  const reveal = useAppSelector((s) => s.ui.revealedPart)
  const selectedKey = useAppSelector(selectSelectedPartKey)
  // épaisseur du contreplaqué : celle des pièces du modèle (3 mm / 4 mm / 5 mm…)
  const thicknesses = useMemo(() => [...new Set(parts.filter((p) => p.qty > 0).map((p) => p.thickness))].sort((a, b) => a - b), [parts])

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
      <AppHeader tab={tab} onTab={goTo} thicknesses={thicknesses} modelName={modelId ? modelById(modelId)?.name : undefined} laserLowered={m.open && lowered} onLaserClick={() => { if (m.open && lowered) setLowered(false); else m.setOpen(true) }} />

      <div className={`grid flex-1 gap-4 p-4 ${tab === 'modeles' ? '' : 'lg:grid-cols-[20rem_1fr]'}`}>
        {/* les vues restent toutes montées (masquées hors de leur onglet) : sélections, zoom, branches ouvertes et vue 3D se retrouvent comme on les a laissés */}
        <aside className={`space-y-3 ${tab === 'modeles' ? 'hidden' : ''} lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto`}>
          <PartsPanel selectedKey={selectedKey} reveal={reveal} parts={parts} reports={reports} onFiles={(f) => void onFiles(f)} onPick={tab === 'auto' ? (key) => dispatch(uiActions.partFocused(key)) : undefined} onClear={project.clearAll} />
          <SettingsPanel parts={parts} settings={settings} onChange={project.setSettings} onCrenelTest={() => startTest(crenelTestSheet)} onGoujonTest={() => startTest(goujonTestSheet)} onPowerSpeedTest={m.startTest} />
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
