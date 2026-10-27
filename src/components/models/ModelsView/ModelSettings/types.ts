import type { ModelDef, Params } from '@/models/types'
import type { ParamValue } from './ParamField/types'

export type ModelSettingsProps = {
  model: ModelDef
  params: Params
  explode: number
  onParam: (key: string, v: ParamValue) => void
  onReset: () => void
  onExplode: (v: number) => void
}
