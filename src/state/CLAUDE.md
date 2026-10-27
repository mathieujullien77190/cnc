# src/state/

Les hooks qui relient le store, la laser et les composants. Pas d'état partagé ici : il est dans `src/store/`.

| Fichier | Rôle |
|---|---|
| `useProject.ts` | Façade mince sur le store (`parts`, `settings`, `boards`, `autoSheets`, `boardSheets`, actions) : l'API que `AutoView` et `BoardsView` consomment |
| `useLaserSession.ts` | Pilotage laser du projet : planches proposées (`laserItems`), planche d'essai (crantage, goujons), fenêtre abaissée, envoi d'une planche |
| `useDeepSearch.ts` + `deepSearch.worker.ts` | « Optimiser encore mieux » dans un Web Worker : lancement, progression, annulation ; le résultat va dans `settings.deep` |

Règles :
- Le worker ne reçoit que des données sérialisables (pièces, réglages), jamais d'objet React ou three.js.
- Une recherche annulée revient à l'état de départ, sans message.
