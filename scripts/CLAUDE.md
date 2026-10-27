# scripts/

| Fichier | Rôle |
|---|---|
| `check.mjs` | `npm run check` : charge les modules de `src/` via Vite (`server.ssrLoadModule`) et vérifie le format, le rangement (conflits, plans « Optimiser encore mieux »), la gravure, le G-code, les planches perso, le store (reducers, sauvegarde) et chaque modèle (actions allumées / éteintes, pièces dans 300 × 300). Doit rester à 0 ECHEC |
| `make-example.mjs` | Régénère `examples/exemple.cutparts.json` |
| `models/nichoir-from-testLowPoly.mjs` | Régénère `models/nichoir.model.json` depuis le nichoir de `C:/projet/testLowPoly` (voir `docs/MODELES.md`) |

Règles :
- Un nouveau comportement du cœur ou du store s'accompagne d'un contrôle ici (un état avant → un état après, en quelques lignes).
- Un script jetable (mesure, génération d'un modèle) se nomme `_xxx.mjs` et se supprime avant le commit.
- Pas de navigateur dans les scripts : l'utilisateur teste le rendu lui-même.
