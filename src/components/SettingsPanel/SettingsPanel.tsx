import { Btn, Section } from '@/laser/ui'
import NumField from '@/components/ui/NumField'
import SizePicker from '@/components/SizePicker'
import type { SettingsPanelProps } from './types'

/** Taille des planches, marge au bord et jeu entre les pièces (planches automatiques), puis un bloc « Test » pour les essais de découpe. */
export const SettingsPanel = ({ settings, onChange, onCrenelTest, onGoujonTest, onPowerSpeedTest }: SettingsPanelProps) => (
  <>
  <Section title="Planches" defaultOpen>
    <SizePicker width={settings.width} height={settings.height} onChange={(width, height) => onChange({ width, height })} />
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <NumField label="Marge" value={settings.margin} onChange={(v) => onChange({ margin: v })} suffix="mm" />
      <NumField label="Jeu" value={settings.gap} step={0.5} onChange={(v) => onChange({ gap: v })} suffix="mm" />
    </div>
    <label className="flex cursor-pointer items-start gap-1.5 text-xs text-stone-700">
      <input type="checkbox" className="mt-0.5 accent-emerald-700" checked={!!settings.spread} onChange={(e) => onChange({ spread: e.target.checked })} />
      <span>
        Desserrer les petites pièces
        <span className="block text-[11px] text-stone-500">Les écarte autant que possible, sans créer de planche en plus.</span>
      </span>
    </label>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Rangement des pièces">
      <Btn variant={settings.byType ? 'primary' : 'secondary'} aria-pressed={!!settings.byType} onClick={() => onChange({ byType: true })}>Organiser par type</Btn>
      <Btn variant={settings.byType ? 'secondary' : 'primary'} aria-pressed={!settings.byType} onClick={() => onChange({ byType: false })}>Optimiser au mieux</Btn>
    </div>
    <p className="text-[11px] text-stone-500">Marge : bande libre au bord de la planche. Jeu : espace entre deux pièces.</p>
  </Section>
  <Section title="Test" defaultOpen>
    <Btn onClick={onCrenelTest}>Tester le crantage</Btn>
    <Btn onClick={onGoujonTest}>Tester les goujons</Btn>
    <Btn onClick={onPowerSpeedTest}>Tester puissance / vitesse</Btn>
  </Section>
  </>
)
