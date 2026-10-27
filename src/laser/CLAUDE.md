# src/laser/

Pilotage de la laser (Sculpfun E1 Pro 21 W, GRBL 1.1, Web Serial). **Copié du projet testBrick** : logique de machine générique, sans planche d'essai ni machine simulée.

| Dossier | Rôle |
|---|---|
| `grbl/` | Client série, G-code (`Writer`, `GcodeJob`, `Segment`), statut, déplacements, erreurs |
| `job/` | Format neutre d'un travail (`LaserJob` : couches `cut`, `engrave`, `drawings`), `buildGcode`, import SVG / G-code, reprise |
| `hooks/` | `useGrbl`, `useGcodeJob`, `useLaserMachine` (réglages de coupe gardés dans `laser-reglages`) |
| `components/` | Fenêtre de pilotage : connexion, déplacements, cadre à vide, réglages, aperçu du trajet, envoi, journal, webcam |
| `ui/` | Briques d'interface (`Btn`, `Chip`, `Notice`, `Section`, `Modal`…), ré-exportées par `@/components/ui` |
| `constants.ts` | Zone machine, réglages par défaut (coupe 650 mm/min à 100 %), couleur des dessins dans l'aperçu |

Règles :
- Ne pas y mettre de logique propre à l'app (planches, pièces) : elle passe par `LaserItem` (`src/core/job.ts`) et `src/state/useLaserSession.ts`.
- Le travail d'une planche n'est calculé que fenêtre ouverte, à la demande (getters non énumérables de `laserItems`).
- Gravure avant coupe : cadre, noms (bleu), dessins (violet), à bas régime ; puis coupe.
