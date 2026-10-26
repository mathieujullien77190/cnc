import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { AutoView, BoardsView, LaserDialog, ModelsView, PartsPanel, SettingsPanel } from './components'
import { laserItems } from './core/job'
import { useLaserMachine } from './laser'
import { Btn } from './laser/ui'
import { useProject, type ImportReport } from './state/useProject'

type Tab = 'auto' | 'perso' | 'modeles'

const TABS: { id: Tab; label: string }[] = [
  { id: 'auto', label: 'Planches automatiques' },
  { id: 'perso', label: 'Planches perso' },
  { id: 'modeles', label: 'Modèles 3D' },
]

export default function App() {
  const project = useProject()
  const { parts, settings, entries, importFiles, importTexts } = project
  const [tab, setTab] = useState<Tab>('auto')
  const [reports, setReports] = useState<ImportReport[]>([])
  const [over, setOver] = useState(false)

  const items = useMemo(() => laserItems(entries), [entries])
  const m = useLaserMachine(items, { W: settings.width, H: settings.height })

  const onFiles = useCallback(
    async (files: File[]) => {
      const json = files.filter((f) => /\.json$/i.test(f.name))
      if (json.length) setReports(await importFiles(json))
    },
    [importFiles],
  )

  const sendToLaser = (key: string) => {
    const i = items.findIndex((it) => it.fileName === key)
    if (i < 0) return
    m.setItemIndex(i)
    m.setOpen(true)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void onFiles([...e.dataTransfer.files])
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false) }}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold text-stone-800">Découpe CNC <span className="text-xs font-normal text-stone-500">pièces → planches → laser</span></h1>
        <nav className="flex gap-1" aria-label="Vues">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${tab === t.id ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <Btn block={false} onClick={() => m.setOpen(true)}>Piloter la laser</Btn>
      </header>

      <div className={`grid flex-1 gap-4 p-4 ${tab === 'modeles' ? '' : 'lg:grid-cols-[20rem_1fr]'}`}>
        {tab !== 'modeles' && (
        <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          <PartsPanel parts={parts} reports={reports} onFiles={(f) => void onFiles(f)} onQty={project.setQty} onRemove={project.removePart} onRemoveProject={project.removeProject} onClear={project.clearAll} />
          <SettingsPanel settings={settings} onChange={project.setSettings} />
        </aside>
        )}
        <main className="min-w-0">
          {tab === 'auto' && <AutoView project={project} machine={m.settings} onLaser={sendToLaser} />}
          {tab === 'perso' && <BoardsView project={project} machine={m.settings} onLaser={sendToLaser} />}
          {tab === 'modeles' && <ModelsView onReplace={project.replaceTexts} />}
        </main>
      </div>

      {over && <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-emerald-900/20 text-lg font-semibold text-emerald-900">Dépose les fichiers .cutparts.json</div>}
      <LaserDialog m={m} />
    </div>
  )
}
