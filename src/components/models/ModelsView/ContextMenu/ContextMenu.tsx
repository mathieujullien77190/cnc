import type { ContextMenuProps } from './types'

const ITEM = 'w-full px-3 py-1.5 text-left hover:bg-stone-100'

/** Menu du clic droit dans la vue 3D : sur une planche, la cacher (elle ou son groupe) ; n'importe où, réafficher les planches cachées une par une, par groupe, ou toutes. */
export const ContextMenu = ({ x, y, panel, hiddenItems, onShow, onShowAll }: ContextMenuProps) => {
  const total = hiddenItems.filter((h) => h.indices.length === 1).length
  return (
    <ul className="absolute z-10 max-h-80 min-w-44 overflow-y-auto rounded-md border border-stone-200 bg-white py-1 text-xs shadow-lg" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {panel && (
        <>
          <li>
            <button className={ITEM} onClick={panel.onHide}>Cacher {panel.id}</button>
          </li>
          <li>
            <button className={ITEM} onClick={panel.onHideGroup}>Cacher le groupe {panel.group} ({panel.groupCount})</button>
          </li>
        </>
      )}
      {hiddenItems.length > 0 && (
        <>
          {hiddenItems.map((h, i) => (
            <li key={h.label} className={i === 0 && panel ? 'mt-1 border-t border-stone-200 pt-1' : ''}>
              <button className={ITEM} onClick={() => onShow(h.indices)}>Afficher {h.label}</button>
            </li>
          ))}
          {total > 1 && (
            <li className="mt-1 border-t border-stone-200 pt-1">
              <button className={`${ITEM} font-semibold`} onClick={onShowAll}>Afficher tout ({total})</button>
            </li>
          )}
        </>
      )}
    </ul>
  )
}
