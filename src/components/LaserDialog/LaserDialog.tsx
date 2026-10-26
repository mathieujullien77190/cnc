import { LaserMachineModal, type LaserMachine } from '../../laser'

/** Choix de la planche à piloter, en haut de la colonne de gauche du pilotage. */
function SheetPicker({ m }: { m: LaserMachine }) {
  return (
    <label className="block space-y-1 rounded-lg border border-stone-200 bg-white/70 p-3 text-xs font-semibold text-stone-700">
      Planche à découper
      <select value={m.itemIndex} onChange={(e) => m.setItemIndex(Number(e.target.value))} disabled={m.job.running} className="block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs font-normal">
        {m.items.map((it, i) => <option key={it.fileName} value={i}>{it.label}</option>)}
      </select>
      {m.item?.notice && <span className="block text-[11px] font-normal text-stone-500">{m.item.notice}</span>}
    </label>
  )
}

/** Fenêtre de pilotage de la laser. Reste montée tant que la machine est utilisée : la connexion et un envoi en cours survivent à la fermeture. */
export function LaserDialog({ m, lowered, setLowered }: { m: LaserMachine; lowered: boolean; setLowered: (v: boolean) => void }) {
  if (!m.open) return null
  return <LaserMachineModal m={m} top={<SheetPicker m={m} />} lowered={lowered} setLowered={setLowered} />
}
