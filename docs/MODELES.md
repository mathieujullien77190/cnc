# Modèles 3D

Onglet « Modèles 3D » : une liste de modèles qui donnent à la fois la vue 3D et les pièces à découper. Un modèle = **un fichier `models/<id>.model.json`** (format `cnc-model`), sans code : les planches, leurs positions 3D et des actions (interrupteurs de la vue). Le code des actions est dans l'app (`src/models/actions.ts`, skill `ajouter-action`).

## Ajouter un modèle

Créer `models/<nom>.model.ts`. Il apparaît dans la liste tout seul (`import.meta.glob`, rechargement à chaud).

```ts
import { rect } from '@/models/helpers'
import { defineModel } from '@/models/types'

export default defineModel({
  id: 'plateau',                       // unique, sert de nom de projet
  name: 'Plateau',
  description: 'Une planche percée.',
  params: [
    { key: 'width', label: 'Largeur', type: 'number', default: 120, min: 40, max: 280, step: 5, unit: 'mm' },
  ],
  build: (p) => ({
    panels: [
      { id: 'P', category: 'Plateau', thickness: 3, outer: rect(0, 0, p.width as number, 80), position: [0, 0, 0], rotation: [-90, 0, 0] },
    ],
    notes: [],                         // remarques affichées sous la vue (optionnel)
  }),
})
```

Pas besoin d'importer three.js : le modèle décrit des **planches** (`Panel`, `src/models/types.ts`), la vue 3D les extrude et l'export les découpe.

## Modèle en JSON (sans code)

Un modèle figé (sans réglages) peut être un simple fichier `models/<id>.model.json` :

```json
{
  "format": "cnc-model",
  "version": 1,
  "id": "plateau",
  "name": "Plateau",
  "panels": [
    { "id": "P", "category": "Plateau", "thickness": 3, "outer": [[0, 0], [120, 0], [120, 80], [0, 80]], "holes": [], "position": [0, 1.5, 0], "rotation": [-90, 0, 0] }
  ]
}
```

Les planches ont les mêmes champs que `Panel` (ci-dessous), aux cotes nominales : le serrage des crans et la numérotation sont appliqués au chargement, comme pour un modèle TS. Le bouton « Télécharger le modèle (.model.json) » de l'onglet 3D produit ce fichier pour le modèle choisi avec ses réglages du moment : on peut ainsi figer une variante. Un fichier invalide est ignoré, avec le motif dans la console du navigateur.

Couleurs : `"colors": { "Habillage": "#ffffff" }` impose une couleur à une catégorie (vue 3D et planches) ; les autres prennent la palette.

Actions : `"actions": [{ "key", "label", "default", "type", ... }]`, réglages de la vue 3D dont le code est dans `src/models/actions.ts` (skill `ajouter-action`). Interrupteurs `move` (`panels`, `by` en mm), `turn` (`by` en degrés, autour du centre de chaque planche) et `hinge` (charnière : `steps: [{ panels, by, pivot }]`, chaque pas tourne ses planches de `by` degrés autour du point du monde `pivot`, positions et rotations suivent ; un livre qui se ferme, un couvercle sur gonds) ; curseur `swing` (mêmes `steps` que `hinge`, `default` de 0 à 100 : chaque pas tourne de `by` × valeur / 100, pour voir une charnière travailler), curseur `angle` (en degrés : `min`, `max`, `default` en degrés ; chaque pas tourne de `by` × valeur, `by` étant l'axe, par exemple `[0, 1, 0]` pour un degré par degré du curseur autour de la verticale), avec en option `show` / `hide` (planches montrées / cachées allumé, l'inverse éteint) ; liste `choice` (`options: [{ value, label, show?, hide?, move?: [{ panels, by }] }]`, `default` = la `value` de départ). Une cible = famille, catégorie, liste de celles-ci ou indices. Une planche cachée (`visible: false`) est découpée quand même (une pièce `"cut": false`, tuyau PVC ou quincaillerie, n'est jamais découpée : vue 3D seulement ; un tuyau rond se décrit par `tube: { path }`, trajet de l'axe en points relatifs à `position`, avec `outer` = sa section circulaire ; une pièce imprimée en 3D d'un seul bloc se décrit par `solid: { x, y, z, runs }`, une grille de cellules pleines ou vides, générée par un script) ; aucune action ne change une forme. Exemple : le nichoir (siège du ventilateur à trois états, bloc d'aération posé ou non).

## Une planche

- `outer`, `holes` : contours 2D en mm, **u vers la droite, v vers le bas** (comme le `.cutparts.json`). Cercles déjà en segments (`circle()` dans `helpers.ts`).
- `labels` (option) : textes gravés en plus du nom, `{ text, x, y, h }` (coin haut-gauche dans le repère de la planche, hauteur de lettre en mm ; majuscules, chiffres, espace, `-`, `.` et `'` ; avec `"font": "script"` (manuscrite) ou `"font": "arial"` (Arial, usage personnel) ou `"font": "arial-line"` (Arial en simple ligne : le contour seulement, un trait fin de 0,3 mm, sans hachurage, comme les traits des chiffres), toute la casse, la ponctuation `, . ' - + : ! ?` et les accents français). Ils doivent tenir sur du bois plein ; le nom de la planche se pose ailleurs. `rules` : traits gravés `[x0, y0, x1, y1]` ou `[x0, y0, x1, y1, largeur]` (largeur en mm de ce trait, `RULE_W` = 0,6 sinon) ou `[x0, y0, x1, y1, largeur, pas]` (le trait est gravé en contours emboîtés, chacun plus étroit de `pas` mm que le précédent, 0,25 par défaut ; la vue 3D les montre un par un en lignes au lieu d'un trait plein) ; `circles` (option) : ronds gravés `[cx, cy, r]`, `[cx, cy, r, pas]` ou `[cx, cy, r, pas, rMin]` ou `[cx, cy, r, pas, rMin, a0, a1, du]` (arc de a0 à a1, en degrés, comme le trait d'un 5 ; 0 et 360 : le tour entier ; `du` : rayon en plus dans le sens u, un ovale comme le 0 ; repère de la planche, mm) : un rond de rayon r est gravé en cercles emboîtés, chacun plus petit de `pas` mm de rayon (0,25 par défaut), jusqu'au centre ou jusqu'à `rMin` (un anneau, comme le trait d'un 0 ou d'un 8) ; un seul élément par rond au lieu de centaines de petits traits. `"font": "round"` (option) : chiffres et lettres A C D O P R U arrondis, les autres caractères gardent la police à segments. `"font": "script"` : écriture manuscrite (Astoria, usage personnel : voir `src/core/CLAUDE.md`), `h` = hauteur des capitales (les jambages descendent de 0,35 h sous la ligne), largeur proportionnelle : centrer avec `markSize(text, h, 'script')` ; environ 55 rectangles par lettre à 12-18 mm. Dans la vue 3D, textes et traits ne sont montrés que sur la face avant (local +z) : pour un texte dehors sur une planche couchée, la poser face avant dehors (`rotation: [90, 0, 180]`, contour en miroir en u). L'interrupteur « Numéros » de l'onglet ne cache que les noms des planches, jamais ces textes. Exemple : `range-meches.model.ts`.
- `thickness` : épaisseur du matériau ; c'est aussi l'épaisseur de l'extrusion.
- `position` : centre de la boîte englobante de la planche dans le monde (x droite, y haut, z vers l'avant).
- `rotation` : Euler en degrés, ordre XYZ. Sans rotation, la planche est dans le plan XY (u → x, v → -y). Debout dans le plan YZ : `[0, -90, 0]` (u → z). Couchée : `[-90, 0, 0]` (u → x, v → z).
- `id` : **préfixe de famille** (`E`, `B`, `CX`…). Le numéro est attribué automatiquement : `E-01`, `E-02`… un numéro par contour distinct (identiques à 180° près = même numéro, comptées en `qty`), dans l'ordre d'apparition. Le numéro est dessiné sur la face avant de chaque planche dans la vue 3D, avec les mêmes traits que ceux gravés à la découpe (une planche trop petite pour porter son nom n'en a pas).
- `rotate: 'none'` impose le sens du fil.
- `snugDepths` (option) : profondeurs de cran à serrer, en épaisseurs (défaut `[1]`). `[]` désactive le serrage pour une planche dont les crans sont déjà ajustés (modèle importé d'un autre projet).

## Règles de conception

- `build` est pur et rapide (rappelé à chaque mouvement de curseur).
- Les valeurs des réglages arrivent déjà bornées par `min` / `max`.
- Garder les pièces dans 290 × 290 mm (planche 300 × 300, marge 5) sauf besoin contraire ; `npm run check` le vérifie aux réglages par défaut, minimum et maximum.
- Crans : mêmes règles que testBrick, via `plateOutline` / `windowsFor` (`helpers.ts`) — nombre de crans impair, dent visée 16 mm, profondeur = épaisseur ; le serrage de 0,4 mm (`snug.ts`) est appliqué tout seul après `build`. Voir le skill `cranter-plaques`. Le bouton « Tester le crantage » (colonne de gauche) crée une planche perso avec 2 mini plaques à emboîter.
- Au moins 4,5 mm de bois autour d'un trou, 1,2 mm autour d'un nom gravé.

- Un trou doit rester strictement à l'intérieur du contour (pas de fente ouverte sur le bord, sinon c'est un contour à part).

## Envoyer à la découpe

Choisir un modèle (ou changer l'un de ses réglages) envoie ses pièces à la découpe toute seule : elles **remplacent tout le catalogue** de l'app (anciennes pièces, quantités des planches perso et cases « Fait » repartent à zéro ; réglages de planche et cases de gravure gardés). Le bouton « .cutparts.json » télécharge le même fichier, pour le garder ou le réimporter.

## Piloter depuis le navigateur (IA)

`window.cnc3d` existe quand l'onglet est ouvert :

| Appel | Effet |
|---|---|
| `models()` | modèles et leurs réglages (clé, type, bornes) |
| `state()` | modèle choisi, réglages, pièces (avec `qty`), remarques |
| `select(id)` | choisit un modèle |
| `setParams({ width: 150 })` | change des réglages |
| `addToCut()` | envoie les planches à la découpe |
| `hide(i)`, `hideGroup('BO')`, `showAll()` | cache une planche ou un groupe (toutes les planches dont l'id a les mêmes lettres), remet tout |
| `fit()`, `explode(0..1)`, `screenshot()` | cadrage, éclaté, image PNG (data URL) |

## Nichoir (import depuis testLowPoly)

`models/nichoir.model.json` est produit par `node scripts/models/nichoir-from-testLowPoly.mjs` (lance Vite et three de `C:/projet/testLowPoly`, appelle `makeNest` aux réglages par défaut, garde les plaques de bois, convertit le repère Z haut → Y haut et vérifie les coins). À relancer après un changement du nichoir ; ses crans sont déjà serrés par testLowPoly, d'où `snugDepths: []`.

## Skill

`/creer-modele <objet>` (`.claude/skills/creer-modele`) : Claude conçoit les planches, écrit le fichier, lance `npm run check`.
