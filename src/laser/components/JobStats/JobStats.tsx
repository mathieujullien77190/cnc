import { formatDuration, MACHINE_AREA, type GcodeJob } from '../../grbl';
import type { JobExtra, MachineSettings } from '../../types';
import type { ReactNode } from 'react';

const m = (mm: number) => (mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5" title={hint}>
      <dt className="text-stone-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-stone-900' : 'text-stone-800'}`}>{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md bg-stone-50 px-2.5 py-2">
      <h4 className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-400 uppercase">{title}</h4>
      <dl className="text-[11px]">{children}</dl>
    </section>
  );
}

/** Tableau de bord d'un programme : distances (coupe, gravure, déplacements, total), temps, programme, planche, parcours. */
export function JobStats({ program, settings, extra = {} }: { program: GcodeJob; settings?: MachineSettings; extra?: JobExtra }) {
  const st = program.stats;
  const drawMm = st.cutMm + st.engraveMm;
  const totalMm = drawMm + st.rapidMm;
  const b = st.bounds;
  const used = b ? { w: b.maxX - b.minX, h: b.maxY - b.minY } : null;
  const gain = extra.travel && extra.travel.baselineMm > 0 ? extra.travel.baselineMm - extra.travel.mm : 0;
  const passes = settings ? Math.max(1, Math.round(settings.passes)) : null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <Group title="Distances">
        <Row label="Coupe" value={m(st.cutMm)} hint="Longueur du laser allumé à pleine puissance, toutes passes comprises" />
        <Row label="Dessin (gravure)" value={m(st.engraveMm)} hint="Cadre et noms gravés à bas régime" />
        <Row label="Déplacements à vide" value={m(st.rapidMm)} hint="La tête bouge, laser éteint" />
        <Row label="Total" value={m(totalMm)} strong />
        <Row label="Part à vide" value={pct(st.rapidMm, totalMm)} hint="Plus c'est bas, mieux c'est rangé et ordonné" />
      </Group>
      <Group title="Temps estimé">
        <Row label="Coupe" value={formatDuration(st.cutSeconds)} />
        <Row label="Gravure" value={formatDuration(st.engraveSeconds)} />
        <Row label="Déplacements" value={formatDuration(st.rapidSeconds)} />
        <Row label="Total" value={formatDuration(st.seconds)} strong />
        <Row label="Part à vide" value={pct(st.rapidSeconds, st.seconds)} />
      </Group>
      <Group title="Programme">
        {extra.pieces !== undefined && <Row label="Pièces" value={String(extra.pieces)} />}
        <Row label="Contours" value={String(st.contours)} hint="Pièces + trous + traits gravés" />
        <Row label="Lignes de G-code" value={String(st.lines)} />
        {passes !== null && <Row label="Passes de coupe" value={String(passes)} />}
        {settings && <Row label="Vitesse de coupe" value={`${Math.round(settings.feed)} mm/min`} />}
        {settings && <Row label="Vitesse de gravure" value={`${Math.round(settings.engraveFeed)} mm/min`} />}
        <Row label="S maximum" value={`${st.maxS}${st.clamped ? ' (plafonné)' : ''}`} />
      </Group>
      <Group title="Planche et parcours">
        {extra.sheetMm && <Row label="Planche" value={`${extra.sheetMm.w} × ${extra.sheetMm.h} mm`} />}
        {extra.fill !== undefined && <Row label="Remplissage" value={`${Math.round(extra.fill * 100)} %`} />}
        {used && <Row label="Zone tracée" value={`${Math.round(used.w)} × ${Math.round(used.h)} mm`} />}
        {extra.pieces ? <Row label="Coupe par pièce" value={m(st.cutMm / extra.pieces)} /> : null}
        {extra.pieces ? <Row label="Temps par pièce" value={formatDuration(st.seconds / extra.pieces)} /> : null}
        {extra.travel && <Row label="Gain de parcours" value={gain > 0 ? `${m(gain)} (−${Math.round((gain / extra.travel.baselineMm) * 100)} %)` : '—'} hint="Déplacements à vide économisés par rapport au plus proche voisin" />}
        <Row label="Zone machine" value={st.outOfBounds || (b && (b.maxX > MACHINE_AREA.W || b.maxY > MACHINE_AREA.H)) ? 'dépassée !' : `ok (${MACHINE_AREA.W} × ${MACHINE_AREA.H})`} />
      </Group>
    </div>
  );
}
