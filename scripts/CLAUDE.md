# scripts/

| Fichier | Rôle |
|---|---|
| `check.mjs` | `npm run check` : charge les modules de `src/` via Vite (`server.ssrLoadModule`) et vérifie le format, le rangement (conflits, plans « Optimiser encore mieux »), la gravure, le G-code, les planches perso, le store (reducers, sauvegarde) et chaque modèle (actions allumées / éteintes, pièces dans 300 × 300). Doit rester à 0 ECHEC |
| `make-example.mjs` | Régénère `examples/exemple.cutparts.json` |
| `models/cuve.mjs` | Génère la cuve en plastique du nichoir (hors découpe, imprimée en 3D d'un seul bloc) : une pièce `solid` `CU` dans `models/nichoir.model.json` |
| `models/cuve-stl.mjs` | Écrit cette cuve en STL (dossier Téléchargements) et donne le plastique et la contenance d'eau |
| `models/livre-avent.mjs` | Génère `models/livre-avent.model.json` (livre de l'Avent : deux faces de 12 cases à boîtes crantées numérotées 1–12 et 13–24, quadrillage doublé, charnière en bois au milieu (le gond de gauche en deux plaques qui emprisonne celui de droite) ; curseur `swing` « Fermeture du livre », interrupteur « Boîte 1 sortie ») |
| `models/nichoir-from-testLowPoly.mjs` | Régénère `models/nichoir.model.json` depuis le nichoir de `C:/projet/testLowPoly` (voir `docs/MODELES.md`) |

Règles :
- Un nouveau comportement du cœur ou du store s'accompagne d'un contrôle ici (un état avant → un état après, en quelques lignes).
- Un script jetable (mesure, génération d'un modèle) se nomme `_xxx.mjs` et se supprime avant le commit.
- Pas de navigateur dans les scripts : l'utilisateur teste le rendu lui-même.
