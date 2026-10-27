import type { ModelDef, Params } from '@/models/types'
import type { ParamValue } from './ParamField/types'

export type ModelSettingsProps = {
  model: ModelDef
  params: Params
  explode: number
  colored: boolean
  onColored: (on: boolean) => void
  onParam: (key: string, v: ParamValue) => void
  onReset: () => void
  onExplode: (v: number) => void
}
