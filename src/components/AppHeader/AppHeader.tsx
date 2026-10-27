import { Btn } from '@/laser/ui'
import { TABS } from './constants'
import type { AppHeaderProps } from './types'

/** En-tête : titre, onglets des vues et bouton du pilotage laser. */
export const AppHeader = ({ tab, onTab, laserLowered, onLaserClick }: AppHeaderProps) => (
  <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
    <h1 className="text-base font-semibold text-stone-800">Découpe CNC <span className="text-xs font-normal text-stone-500">pièces → planches → laser</span></h1>
    <nav className="flex gap-1" aria-label="Vues">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          aria-current={tab === t.id}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${tab === t.id ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
    <Btn block={false} variant={laserLowered ? 'primary' : 'secondary'} onClick={onLaserClick}>{laserLowered ? '▴ Remonter le pilotage laser' : 'Piloter la laser'}</Btn>
  </header>
)
