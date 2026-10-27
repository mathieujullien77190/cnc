# src/

Le code de l'app (Vite + React 19 + TypeScript + Tailwind v4). Langue : commentaires et textes d'interface en français, code en anglais.

| Dossier | Rôle |
|---|---|
| `core/` | Le cœur sans React : format des pièces, rangement, planches, parcours de la tête, gravure, SVG, G-code |
| `models/` | Moteur des modèles 3D : lecture des `.model.json`, actions, crans, serrage, vue three.js, conversion en pièces |
| `laser/` | Pilotage de la laser (GRBL, Web Serial), copié de testBrick : ne pas y mettre de logique de l'app |
| `store/` | État de l'app (Redux Toolkit), un dossier par domaine |
| `state/` | Hooks qui font le lien entre le store, la laser et les composants |
| `components/` | Interface React : un dossier par composant, rangés par domaine, briques dans `components/ui/` |
| `types/`, `constants/`, `helpers/` | Partagés entre composants : types, clés et valeurs par défaut, petites fonctions pures |

Règles :
- Imports : `@/...` (alias de `src/`) entre dossiers, `./...` à l'intérieur d'un composant. Chaque dossier a son `CLAUDE.md`.
- `App.tsx` reste court : en-tête, zone de dépôt, les trois onglets (toujours montés, masqués hors de leur onglet), fenêtre laser.
- Après toute modification : `npm run typecheck`, `npm run check`, `npm run build`. L'utilisateur regarde le rendu lui-même.
