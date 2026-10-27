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

Actions : `"actions": [{ "key", "label", "default", "type", ... }]`, réglages de la vue 3D dont le code est dans `src/models/actions.ts` (skill `ajouter-action`). Interrupteurs `move` (`panels`, `by` en mm) et `turn` (`by` en degrés), avec en option `show` / `hide` (planches montrées / cachées allumé, l'inverse éteint) ; liste `choice` (`options: [{ value, label, show?, hide?, move?: [{ panels, by }] }]`, `default` = la `value` de départ). Une cible = famille, catégorie, liste de celles-ci ou indices. Une planche cachée (`visible: false`) est découpée quand même ; aucune action ne change une forme. Exemple : le nichoir (siège du ventilateur à trois états, bloc d'aération posé ou non).

## Une planche

- `outer`, `holes` : contours 2D en mm, **u vers la droite, v vers le bas** (comme le `.cutparts.json`). Cercles déjà en segments (`circle()` dans `helpers.ts`).
- `labels` (option) : textes gravés en plus du nom, `{ text, x, y, h }` (coin haut-gauche dans le repère de la planche, hauteur de lettre en mm ; majuscules, chiffres, `-` et `.`). Ils doivent tenir sur du bois plein ; le nom de la planche se pose ailleurs. Exemple : `range-meches.model.ts`.
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
