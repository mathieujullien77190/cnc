import { Chip, Notice, Slider } from '../../ui';
import { FEED_RANGE } from '../../constants';
import { powerToS } from '../../grbl';
import type { LaserMachine } from '../../hooks/useLaserMachine';

/** Réglages de coupe (vitesse, puissance, passes, plafond), gardés d'une session à l'autre. Valeurs de départ prudentes, à calibrer. */
export function CutSettings({ m }: { m: LaserMachine }) {
  const { settings: s, setSettings, sMax } = m;
  const set = (patch: Partial<typeof s>) => setSettings({ ...s, ...patch });
  const effective = Math.min(s.power, s.capPct);
  return (
    <div className="space-y-2.5">
      <Slider label="Vitesse de coupe" value={s.feed} min={FEED_RANGE.min} max={FEED_RANGE.max} step={10} unit=" mm/min" onChange={(feed) => set({ feed })} />
      <Slider label="Puissance" value={Math.min(s.power, s.capPct)} min={1} max={s.capPct} step={1} unit=" %" onChange={(power) => set({ power })} />
      <Slider label="Nombre de passes" value={s.passes} min={1} max={10} step={1} onChange={(passes) => set({ passes })} />
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
        Passes
        <Chip active={s.passMode === 'all'} onClick={() => set({ passMode: 'all' })} title="Tout le jeu de contours, puis on recommence">Toute la planche</Chip>
        <Chip active={s.passMode === 'contour'} onClick={() => set({ passMode: 'contour' })} title="Chaque contour est repassé avant le suivant">Contour par contour</Chip>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-stone-700" title="La pompe de la Sculpfun E1 Pro est commandée par la carte : le programme envoie M8 avant la coupe et M9 après. À décocher si la pompe est débranchée.">
        <input type="checkbox" checked={s.air} onChange={(e) => set({ air: e.target.checked })} />
        Assistance d'air (M8 / M9)
      </label>
      {!!m.item?.job?.layers.engrave?.length && (
        <>
          <Slider label="Vitesse de gravure" value={s.engraveFeed} min={FEED_RANGE.min} max={FEED_RANGE.max} step={10} unit=" mm/min" onChange={(engraveFeed) => set({ engraveFeed })} />
          <Slider label="Puissance de gravure" value={Math.min(s.engravePower, s.capPct)} min={1} max={s.capPct} step={1} unit=" %" onChange={(engravePower) => set({ engravePower })} />
        </>
      )}
      <Slider label="Plafond de puissance" value={s.capPct} min={5} max={100} step={5} unit=" %" onChange={(capPct) => set({ capPct, power: Math.min(s.power, capPct) })} />
    </div>
  );
}
