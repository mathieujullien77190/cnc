import type { ContextMenuProps } from './types'

/** Menu du clic droit sur une planche de la vue 3D : cacher la planche ou son groupe. */
export const ContextMenu = ({ x, y, panelId, group, groupCount, onHide, onHideGroup }: ContextMenuProps) => (
  <ul className="absolute z-10 min-w-40 rounded-md border border-stone-200 bg-white py-1 text-xs shadow-lg" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
    <li>
      <button className="w-full px-3 py-1.5 text-left hover:bg-stone-100" onClick={onHide}>
        Cacher {panelId}
      </button>
    </li>
    <li>
      <button className="w-full px-3 py-1.5 text-left hover:bg-stone-100" onClick={onHideGroup}>
        Cacher le groupe {group} ({groupCount})
      </button>
    </li>
  </ul>
)
