# src/models/

Le moteur des modèles 3D. Les modèles eux-mêmes sont des fichiers `models/<id>.model.json` à la racine du dépôt (pas ici). Référence : `docs/MODELES.md`.

| Fichier | Rôle |
|---|---|
| `types.ts` | `Panel` (contour u droite / v bas, `thickness`, `position` = centre de la boîte, `rotation` Euler XYZ en degrés, `labels`, `rules`, `snugDepths`), `ModelDef` |
| `json.ts` | Lecture et validation d'un fichier `cnc-model` (`modelFromJson`, erreurs en français), export figé (`modelToJson`) |
| `actions.ts` | Code des actions déclarées dans le JSON : interrupteurs `move`, `turn` (+ `show` / `hide`) et liste de choix `choice` (chaque option montre, cache, décale) ; `apply` reçoit la valeur du réglage. Nouveau type : skill `ajouter-action` |
| `registry.ts` | Glob des `.model.json` → `MODELS` (un fichier invalide est ignoré, motif dans la console) |
| `toCutParts.ts` | `finishPanels` (serrage puis numérotation : un numéro par contour distinct, dessins compris), `panelsToCutParts` (→ fichier `cnc-parts`) |
| `snug.ts` | Serrage de 0,4 mm des crans dont la profondeur est un multiple de l'épaisseur (`snugDepths`) |
| `helpers.ts`, `testbrick.ts`, `edges.ts` | Contours crantés (`plateOutline`, `windowsFor`), `rect`, `circle` : servent aux scripts qui génèrent un modèle et aux planches d'essai |
| `crenelTest.ts`, `goujonTest.ts` | Planches d'essai (crantage, goujons) du bloc « Test » |
| `validate.ts` | Traits résiduels d'un contour (`panelIssues`), nom gravé mal posé (`markIssues`) : utilisé par `check` |
| `viewer3d.ts` | Scène three.js : extrusion des planches, couleurs par catégorie, tranche plus foncée, éclaté, sélection, mesure, planches cachées. Reste hors du store |

Règles :
- Un modèle ne contient pas de code : un réglage qui change la découpe est un autre fichier ; une action ne déplace que des planches.
- Pas de three.js ailleurs que dans `viewer3d.ts`.
- `npm run check` passe chaque modèle avec chaque interrupteur allumé / éteint et chaque option de chaque liste : fichier valide, planches numérotées, trous dedans, textes sur du bois plein, pièces dans 290 × 290 mm.
