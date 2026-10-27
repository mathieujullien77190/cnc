import { Card, Title } from '@/components/ui'
import type { ModelListProps } from './types'

/** Liste des modèles du dossier `src/models/library`. */
export const ModelList = ({ models, currentId, onPick }: ModelListProps) => (
  <Card>
    <Title as="h2" className="mb-2">Modèles ({models.length})</Title>
    <ul className="space-y-1">
      {models.map((m) => (
        <li key={m.id}>
          <button onClick={() => onPick(m.id)} aria-current={m.id === currentId} className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${m.id === currentId ? 'border-emerald-700 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
            <span className="font-medium text-stone-800">{m.name}</span>
          </button>
        </li>
      ))}
    </ul>
    <p className="mt-2 text-[11px] text-stone-500">Clique de nouveau sur le modèle choisi pour n’en avoir aucun. Un modèle = un fichier <code>src/models/library/nom.model.ts</code>. Demande à Claude d’en écrire un : il apparaît ici tout seul.</p>
  </Card>
)
