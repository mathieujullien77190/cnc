# scripts/

| Fichier | Rôle |
|---|---|
| `check.mjs` | `npm run check` : charge les modules de `src/` via Vite (`server.ssrLoadModule`) et vérifie le format, le rangement (conflits, plans « Optimiser encore mieux »), la gravure, le G-code, les planches perso, le store (reducers, sauvegarde) et chaque modèle (actions allumées / éteintes, pièces dans 300 × 300). Doit rester à 0 ECHEC |
| `make-example.mjs` | Régénère `examples/exemple.cutparts.json` |
| `make-font-script.mjs` | Régénère `src/core/fontScript.ts` depuis `fonts/Astoria.otf` (non versionné, dans `.gitignore` ; licence d'usage personnel seulement) avec `opentype.js` (devDependency, jamais chargée dans le navigateur) |
| `models/cuve.mjs` | Génère la cuve en plastique du nichoir (hors découpe, imprimée en 3D d'un seul bloc) : une pièce `solid` `CU` dans `models/nichoir.model.json` |
| `models/cuve-stl.mjs` | Écrit cette cuve en STL (dossier Téléchargements) et donne le plastique et la contenance d'eau |
| `models/livre-avent.mjs` | Génère `models/livre-avent.model.json` (livre de l'Avent : titre et poème en police manuscrite `script`, numéros en police arrondie ; deux faces de 12 cases à boîtes crantées numérotées 1–12 et 13–24, quadrillage doublé, charnière en bois au milieu (le gond de gauche en deux plaques qui emprisonne celui de droite) ; curseur `swing` « Fermeture du livre », interrupteur « Boîte 1 sortie ») |
| `models/livre-avent-v2.mjs` | Génère `models/livre-avent-v2.model.json` : 8 petites pièces calées dans les creux d’une étoile à 8 branches (l’étoile elle-même n’est plus dans le modèle), chacune avec 10 pièces évidées (bordure 2 mm) empilées dessus ; l’étoile de 28 cm en 8 pièces identiques, chacune avec 10 pièces évidées (bordure 4 mm) empilées dessus ; 4 boutons « Cacher » (cercles 1, 2, 3 = les couvercles de LO, E-06, E-04, et l’octogone) ; paramètre `--echelle=k` (taille de tout le modèle) et `--sortie=fichier` |
| `models/nichoir-from-testLowPoly.mjs` | Régénère `models/nichoir.model.json` depuis le nichoir de `C:/projet/testLowPoly` (voir `docs/MODELES.md`) |

Règles :
- Un nouveau comportement du cœur ou du store s'accompagne d'un contrôle ici (un état avant → un état après, en quelques lignes).
- Un script jetable (mesure, génération d'un modèle) se nomme `_xxx.mjs` et se supprime avant le commit.
- Pas de navigateur dans les scripts : l'utilisateur teste le rendu lui-même.
