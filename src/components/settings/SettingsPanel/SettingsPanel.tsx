import { Btn, NumField, Section, Switch } from '@/components/ui'
import DeepOptimizer from '@/components/settings/DeepOptimizer'
import SizePicker from '@/components/settings/SizePicker'
import type { SettingsPanelProps } from './types'

/** Deux blocs : « Planches » (taille, marge, jeu, rangement) et « Test » (essais de découpe). */
export const SettingsPanel = ({ parts, settings, onChange, onCrenelTest, onGoujonTest, onPowerSpeedTest }: SettingsPanelProps) => (
  <>
  <Section title="Planches" defaultOpen>
    <SizePicker width={settings.width} height={settings.height} onChange={(width, height) => onChange({ width, height })} />
    <div className="space-y-2">
      <NumField className="w-full" label="Marge" value={settings.margin} onChange={(v) => onChange({ margin: v })} suffix="mm" />
      <NumField className="w-full" label="Jeu" value={settings.gap} step={0.5} onChange={(v) => onChange({ gap: v })} suffix="mm" />
    </div>
    <Switch label="Desserrer les petites pièces" checked={!!settings.spread} onChange={(spread) => onChange({ spread })} />
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Rangement des pièces">
      <Btn variant={settings.byType ? 'primary' : 'secondary'} aria-pressed={!!settings.byType} onClick={() => onChange({ byType: true, deep: undefined })}>Organiser par type</Btn>
      <Btn variant={settings.byType ? 'secondary' : 'primary'} aria-pressed={!settings.byType} onClick={() => onChange({ byType: false, deep: undefined })}>Optimiser au mieux</Btn>
    </div>
    <DeepOptimizer parts={parts} settings={settings} onChange={onChange} />
  </Section>
  <Section title="Test" defaultOpen>
    <Btn onClick={onCrenelTest}>Tester le crantage</Btn>
    <Btn onClick={onGoujonTest}>Tester les goujons</Btn>
    <Btn onClick={onPowerSpeedTest}>Tester puissance / vitesse</Btn>
  </Section>
  </>
)
