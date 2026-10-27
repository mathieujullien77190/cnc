export type ContextMenuProps = {
  x: number
  y: number
  /** Id de la planche visée. */
  panelId: string
  /** Lettres du groupe de la planche (« BO ») et nombre de planches dans le groupe. */
  group: string
  groupCount: number
  onHide: () => void
  onHideGroup: () => void
}
