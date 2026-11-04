import { Btn } from '@/components/ui'
import type { SectionToolProps } from './types'

const AXES = ['x', 'y', 'z'] as const

/** Coupe de la vue 3D : un plan perpendiculaire à X, Y (hauteur) ou Z, déplacé au curseur ; « Inverser » garde l'autre côté. */
export const SectionTool = ({ section, onAxis, onPosition, onFlip }: SectionToolProps) => (
  <div className="absolute top-12 right-2 flex w-44 flex-col gap-1.5 rounded-md bg-white/90 p-1.5 shadow">
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-600">Coupe</span>
      {AXES.map((a) => (
        <Btn key={a} block={false} variant={section.axis === a ? 'primary' : undefined} onClick={() => onAxis(section.axis === a ? null : a)}>{a.toUpperCase()}</Btn>
      ))}
    </div>
    {section.axis && (
      <>
        <input type="range" className="w-full accent-emerald-700" min={0} max={1} step={0.005} value={section.t} onChange={(e) => onPosition(Number(e.target.value))} />
        <Btn block={false} onClick={onFlip}>Inverser le côté</Btn>
      </>
    )}
  </div>
)
