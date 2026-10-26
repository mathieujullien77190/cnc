import type { SheetSettings } from '../../core/types'
import { Btn, Section } from '../../laser/ui'
import { NumField } from '../../ui/NumField'
import { SizePicker } from '../SizePicker'

/** Taille des planches, marge au bord et jeu entre les pièces (planches automatiques). */
export function SettingsPanel({ settings, onChange, onCrenelTest, onPowerSpeedTest }: { settings: SheetSettings; onChange: (patch: Partial<SheetSettings>) => void; onCrenelTest: () => void; onPowerSpeedTest: () => void }) {
  return (
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
      <Btn onClick={onCrenelTest}>Tester le crantage</Btn>
      <p className="text-[11px] text-stone-500">Ouvre le pilotage de la laser sur 2 mini plaques crantées qui s’emboîtent (languettes et encoches de testBrick). Rien n’est ajouté à tes planches.</p>
      <Btn onClick={onPowerSpeedTest}>Tester puissance / vitesse</Btn>
      <p className="text-[11px] text-stone-500">Ouvre le pilotage de la laser sur la planche d’essai : 36 carrés de 10 mm, 6 vitesses (colonnes) × 6 puissances (lignes), valeurs gravées à côté. À couper sur une chute du même bois. Rien n’est ajouté à tes planches.</p>
      <p className="text-[11px] text-stone-500">Marge : bande libre au bord de la planche. Jeu : espace entre deux pièces.</p>
    </Section>
  )
}
