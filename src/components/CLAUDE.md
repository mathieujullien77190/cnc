# src/components/

L'interface React, rangée par domaine. Forme d'un composant : skill `react-structure` (dossier = `index.ts` barrel avec le default, `X.tsx` en export nommé, `types.ts`, `helpers.ts` / `constants.ts` si contenu réel).

| Dossier | Contenu |
|---|---|
| `app/` | `AppHeader` (titre, modèle choisi, épaisseur du contreplaqué, onglets, bouton laser ; fixé en haut), `DropZone` |
| `sheets/` | `AutoView`, `BoardsView` (planche perso : quantités, glisser / R, pièces en trop empilées), `SheetCard`, `SheetPreview` (SVG, zoom, zone de prise sur tout le contour, noms et dessins), `SheetActions`, `MarkingToggles`, `DoneToggle` |
| `parts/` | `PartsPanel` (import, liste), `PartTree` (arborescence par famille, barres colorées, clic = planche / liste) |
| `settings/` | `SettingsPanel` (bloc Planches : taille, marge, jeu, desserrer, modes de rangement ; bloc Test), `SizePicker`, `DeepOptimizer` |
| `models/` | `ModelsView` (onglet 3D, toujours monté) et ses sous-composants |
| `laser/` | `LaserDialog` : fenêtre de pilotage, reste montée tant que la machine est utilisée |
| `ui/` | Les briques d'interface : voir `ui/CLAUDE.md` |

Règles :
- Importer un composant par son dossier : `import SheetCard from '@/components/sheets/SheetCard'` ; les briques par `import { Btn, Card } from '@/components/ui'`.
- Seul le composant « conteneur » parle au store ; les feuilles reçoivent données et callbacks par props.
- Les classes Tailwind restent dans le JSX ; un motif répété au moins trois fois devient une brique dans `ui/`.
- Textes d'interface en français, courts, sans texte d'aide inutile.
