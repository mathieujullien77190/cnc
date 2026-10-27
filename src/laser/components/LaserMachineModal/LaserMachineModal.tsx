import type { ReactNode } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { IconButton, Section, StatusDot } from '../../ui';
import type { LaserMachine } from '../../hooks/useLaserMachine';
import { ConnectionBar } from '../ConnectionBar';
import { indicator } from '../ConnectionBar/helpers';
import { CutSettings } from '../CutSettings';
import { FramePanel } from '../FramePanel';
import { GcodePreview } from '../GcodePreview';
import { GrblConsole } from '../GrblConsole';
import { JogPad } from '../JogPad';
import { SendPanel } from '../SendPanel';
import { StopButton } from '../StopButton';
import { Webcam } from '../Webcam';

/** Contenu du pilotage laser : connexion, déplacements, cadre, réglages, aperçu, envoi, journal. `top` = blocs ajoutés en haut de la colonne de gauche (fichiers…). */
export function LaserPanel({ m, top }: { m: LaserMachine; top?: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-2.5">
        {top}
        <Section title="Connexion" defaultOpen><ConnectionBar m={m} /></Section>
        <Section title="Déplacements et origine" defaultOpen><JogPad m={m} /></Section>
        <Section title="Cadre à vide" defaultOpen><FramePanel m={m} /></Section>
        <Section title="Réglages de coupe" defaultOpen><CutSettings m={m} /></Section>
      </div>
      <div className="min-w-0 space-y-2.5">
        <Section title="Caméra de la machine"><Webcam /></Section>
        <Section title="Aperçu du trajet" defaultOpen><GcodePreview m={m} /></Section>
        <Section title="Envoi à la machine" defaultOpen><SendPanel m={m} /></Section>
        <GrblConsole grbl={m.grbl} />
      </div>
    </div>
  );
}

/** Fenêtre « Pilotage laser » (Sculpfun E1 Pro 21 W, GRBL 1.1, Web Serial). Le bouton ▾ la cache (la machine continue) ; l'état `lowered` appartient à l'appelant, qui le montre sur son bouton du haut pour la remonter. */
export function LaserMachineModal({ m, top, lowered, setLowered }: { m: LaserMachine; top?: ReactNode; lowered: boolean; setLowered: (v: boolean) => void }) {
  const ind = indicator(m.grbl);
  useEscapeKey(() => m.setOpen(false));
  return (
    <div className={`fixed inset-0 z-50 flex justify-center p-4 ${lowered ? 'hidden' : 'items-center bg-stone-900/60'}`} onClick={() => m.setOpen(false)}>
      <div className={`pointer-events-auto flex w-full flex-col rounded-xl bg-white shadow-2xl max-h-full max-w-7xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-stone-800">Pilotage laser</h2>
            <StatusDot tone={ind.tone} pulse={ind.pulse}>{ind.label}</StatusDot>
            {m.job.running && <StopButton onStop={() => void m.job.stop()} />}
          </div>
          <div className="flex items-center gap-1">
            <IconButton size="lg" onClick={() => setLowered(true)} title="Abaisser la fenêtre (le bouton du haut la remonte)">▾</IconButton>
            <IconButton size="lg" onClick={() => m.setOpen(false)} title="Fermer (Échap)">×</IconButton>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col"><LaserPanel m={m} top={top} /></div>
      </div>
    </div>
  );
}
