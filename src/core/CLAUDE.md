# src/core/

Le cœur de l'app, sans React ni DOM : des fonctions pures sur des données. Tout est testé par `scripts/check.mjs`.

| Fichier | Rôle |
|---|---|
| `types.ts` | `Part`, `Placed`, `Sheet`, `SheetSettings` (dont `deep`), `Marking`, `CustomBoard`, `Override` |
| `format.ts` | Lecture et validation d'un `.cutparts.json` (pièces recalées sur 0, 0, une erreur par pièce) |
| `nesting.ts` | MaxRects : rangement de boîtes, rotation 90°, `noRotate`, trous rectangulaires réutilisés, pièces fixes, `flipY` |
| `sheets.ts` | Planches automatiques (`buildAutoSheets`, une série par épaisseur et par famille avec `byType`), planche perso (`buildCustomSheet`), conflits (`conflicts`, polygonal), noms gravés (`marksOf`), dessins (`drawingsOf`), plans « Optimiser encore mieux » rejoués (`layoutGroup`, `layoutValid`) |
| `hollow.ts` | Géométrie polygonale : `clearOf` (deux pièces à au moins `c` mm), `turnAny`, `nestParts` (pièces dans les trous) |
| `polynest.ts` | Rangement avec le vrai contour (quadrillage d'occupation à `RES` mm, pose bas-gauche, compactage, insertion) |
| `deep.ts` | Recherche « Optimiser encore mieux » : graines, budget `DEEP_BUDGET_MS`, meilleur plan sous forme de placements |
| `route.ts` | Ordre des pièces et point d'attaque des contours (plus proche voisin + 2-opt / or-opt, contraintes « a avant b ») |
| `job.ts` | Planche → travail laser (`sheetToJob`) : cadre, noms, dessins gravés puis coupe (trous avant contour, pièce dans un trou avant son hôte) ; `laserItems` paresseux |
| `marking.ts` | Police à segments, placement du nom sur la pièce |
| `svg.ts` | Export SVG : calques `coupe` (rouge), `gravure` (bleu), `dessins` (violet) |
| `colors.ts` | Couleurs par famille, communes à la vue planche et à la 3D ; `NAME_COLOR`, `DRAWING_COLOR` |
| `family.ts` | `familyOf('R-02')` → `'R'` |

Règles :
- Repère des planches : y vers le bas ; repère machine : y vers le haut (`flipY` dans `job.ts`). Le rangement part du coin bas-gauche : `packSpread` range dans un repère retourné (`flipY` de `Bin`, qui retourne aussi les trous).
- Un rangement ne doit jamais faire se chevaucher des pièces : `baseLayout` vérifie avec `layoutValid` et refait sans réutiliser les trous si besoin ; un plan `deep` est rejoué seulement s'il passe `layoutValid`.
- Rien de lourd au rendu : les calculs polygonaux ne tournent que dans le worker, au clic.
- Aucune dépendance vers `src/components`, `src/store` ou `src/laser` (sauf `laser/job/geometry` pour `inside`).
