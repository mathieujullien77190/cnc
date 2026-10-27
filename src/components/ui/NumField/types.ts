export type NumFieldProps = {
  label?: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  suffix?: string
  className?: string
  warnAbove?: number
  debounce?: number
}
