import { deepSearch, type DeepMessage, type DeepRequest } from '@/core/deep'

// Web Worker de « Optimiser mieux » : la recherche tourne ici pour ne pas bloquer l'interface. Reçoit des pièces et des réglages (données
// sérialisables), renvoie la progression puis le bilan. La page l'annule en l'arrêtant (`terminate`).

type Port = { postMessage: (message: DeepMessage) => void }
const port = self as unknown as Port

self.onmessage = (e: MessageEvent<DeepRequest>) => {
  const { parts, settings, budgetMs } = e.data
  try {
    const result = deepSearch(parts, settings, { budgetMs, onProgress: (p) => port.postMessage({ type: 'progress', ...p }) })
    port.postMessage({ type: 'done', result })
  } catch (err) {
    port.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
