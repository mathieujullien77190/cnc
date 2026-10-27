import { Card, Switch, Title } from '@/components/ui'
import ParamField from './ParamField'
import type { ModelSettingsProps } from './types'

/** Réglages du modèle choisi, plus le curseur « Éclaté » de la vue 3D. */
export const ModelSettings = ({ model, params, explode, colored, onColored, onParam, onReset, onExplode }: ModelSettingsProps) => (
  <Card className="space-y-2.5">
    <div className="flex items-baseline justify-between">
      <Title as="h2">Réglages</Title>
      <button className="text-[11px] text-stone-500 underline" onClick={onReset}>par défaut</button>
    </div>
    {model.params.map((d) => <ParamField key={d.key} def={d} value={params[d.key]} onChange={(v) => onParam(d.key, v)} />)}
    <Switch label="Couleurs" checked={colored} onChange={onColored} />
    <label className="block text-xs text-stone-700">
      <span className="flex justify-between">Éclaté<span className="tabular-nums text-stone-500">{Math.round(explode * 100)} %</span></span>
      <input type="range" className="w-full accent-emerald-700" min={0} max={1} step={0.05} value={explode} onChange={(e) => onExplode(Number(e.target.value))} />
    </label>
  </Card>
)
