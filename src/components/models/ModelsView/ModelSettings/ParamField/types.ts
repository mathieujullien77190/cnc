import type { ParamDef } from '@/models/types'

export type ParamValue = number | boolean | string

export type ParamFieldProps = {
  def: ParamDef
  value: ParamValue
  onChange: (v: ParamValue) => void
}
