# Découpe CNC / laser

App qui range des pièces 2D en planches et pilote une laser (Sculpfun E1 Pro 21 W, GRBL 1.1, Web Serial : Chrome ou Edge). Les pièces viennent de projets 3D (three.js) sous forme de fichiers `.cutparts.json` : voir `docs/FORMAT.md`.
Langue : français (UI, commentaires, docs), code en anglais. Commits : Conventional Commits en anglais, faits par l'utilisateur (jamais de co-auteur ni de mention de l'assistant).

## Stack et commandes
Vite + React 19 + TypeScript + Tailwind v4 (pas de styled-components).
```sh
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run typecheck
npm run check      # scripts/check.mjs : format, rangement, gravure, G-code, planches perso
node scripts/make-example.mjs   # régénère examples/exemple.cutparts.json
```

## Fichiers
| Fichier | Rôle |
|---|---|
| `src/core/format.ts` | Lecture et validation du `.cutparts.json` (pièces recalées sur 0, 0, erreurs par pièce) |
| `src/core/nesting.ts` | Rangement MaxRects (rotation 90°, `noRotate`, trous réutilisés, pièces fixes) |
| `src/core/sheets.ts` | Planches automatiques (une série par épaisseur), planches perso (quantités + positions manuelles), conflits, noms gravés (`marksOf`) |
| `src/core/marking.ts` | Police à segments et placement du nom sur la pièce |
| `src/core/route.ts` | Parcours de la tête : ordre des pièces et point d'attaque de chaque contour (plus proche voisin + 2-opt/or-opt, contraintes « a avant b », budget 150 ms par étape) |
| `src/core/job.ts` | Planche → travail de découpe (`LaserJob`) : cadre et noms gravés avant la coupe, ordre de coupe ; G-code |
| `src/core/svg.ts` | Export SVG (calque coupe rouge, calque gravure bleu) |
| `src/state/useProject.ts` | État du projet (localStorage `cnc-projet-v1`) : catalogue, réglages, cases, planches perso |
| `src/components/` | `PartsPanel`, `SettingsPanel`, `AutoView`, `BoardsView`, `SheetCard`, `SheetPreview` (glisser / R), `LaserDialog`… |
| `src/models/` | Modèles 3D three.js : `library/*.model.ts` (un fichier = un modèle, `defineModel`), `registry.ts` (glob), `viewer3d.ts` (scène), `toCutParts.ts` (planches → `cnc-parts`). Voir `docs/MODELES.md` |
| `src/components/ModelsView.tsx` | Onglet « Modèles 3D » : liste, réglages, vue, envoi à la découpe, API `window.cnc3d` |
| `src/laser/` | Pilotage GRBL (connexion, déplacements, cadre à vide, envoi, webcam), copié de testBrick ; sans planche d'essai ni machine simulée |
| `export/exportParts.js` | Module à copier dans un projet three.js pour produire le fichier |

## Règles
- Repère des planches : y vers le bas ; repère machine : y vers le haut (`flipY` dans `job.ts`).
- Une planche ne contient qu'une épaisseur.
- Une pièce posée dans le trou d'une autre est toujours coupée avant elle (`insideOf` → contraintes de `route.ts`). Le travail d'une planche est calculé à la demande et mis en cache (`laserItems` en getter paresseux).
- Noms : toujours sur la pièce. Trait double (2 passes) en taille normale ; si la pièce est vraiment petite, texte minuscule en un seul trait (`MINI_HEIGHTS` dans `marking.ts`). Une pièce où rien ne tient reste sans nom.
- Aperçu : molette, glisser, + / − / Ajuster / plein écran ; dézoom jusqu'à ×0,5, hauteur bornée à 75 % de l'écran.
- Gravure avant coupe, dans cet ordre : cadre (case « Mettre un contour »), puis noms (case « Mettre le nom des pièces »). La coupe ne dépend pas des cases.
- Réglages de coupe (vitesse, puissance, passes) globaux, gardés par `useLaserMachine` ; pas encore de réglages par épaisseur.
- Test visuel : l'utilisateur teste lui-même dans son navigateur.
- Modèles 3D : un modèle décrit des planches 2D + position/rotation (pas de three.js dans le modèle) ; la vue et la découpe en sortent. Nouveau modèle = nouveau fichier dans `src/models/library`, et `npm run check` doit rester vert (bornes comprises).
- Crans : identiques à testBrick (impair, 16 mm visés, profondeur = épaisseur, serrage de 0,4 mm appliqué par `finishPanels`) ; skill `cranter-plaques`. Goujons : lamelles de 3,4 mm de large × 3 mm d’épaisseur, dans des trous de 3 × 3 mm alignés dans les plaques empilées, skill `goujon`. Couleurs par famille communes à la vue planche et à la vue 3D (`src/core/colors.ts`).
