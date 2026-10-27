import { Btn } from '@/components/ui'
import { TABS } from './constants'
import type { AppHeaderProps } from './types'

/** En-tête : titre (avec le modèle 3D choisi et l'épaisseur du contreplaqué des pièces), onglets des vues et bouton du pilotage laser. */
export const AppHeader = ({ tab, onTab, laserLowered, onLaserClick, modelName, thicknesses }: AppHeaderProps) => (
  <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
    <h1 className="text-base font-semibold text-stone-800">Découpe CNC{modelName && <span className="ml-2 text-sm font-normal text-stone-500">· {modelName}</span>}
      {thicknesses.length > 0 && <span className="ml-3 rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-medium text-amber-900">Contreplaqué {thicknesses.map((t) => `${t} mm`).join(' / ')}</span>}
    </h1>
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
