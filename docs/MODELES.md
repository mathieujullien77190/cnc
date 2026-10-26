# Modèles 3D

Onglet « Modèles 3D » : une liste de modèles three.js, réglables, qui donnent à la fois la vue 3D et les pièces à découper. Les modèles sont du **code écrit par l'IA** : un fichier = un modèle.

## Ajouter un modèle

Créer `src/models/library/<nom>.model.ts`. Il apparaît dans la liste tout seul (`import.meta.glob`, rechargement à chaud).

```ts
import { rect } from '../helpers'
import { defineModel } from '../types'

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

## Une planche

- `outer`, `holes` : contours 2D en mm, **u vers la droite, v vers le bas** (comme le `.cutparts.json`). Cercles déjà en segments (`circle()` dans `helpers.ts`).
- `thickness` : épaisseur du matériau ; c'est aussi l'épaisseur de l'extrusion.
- `position` : centre de la boîte englobante de la planche dans le monde (x droite, y haut, z vers l'avant).
- `rotation` : Euler en degrés, ordre XYZ. Sans rotation, la planche est dans le plan XY (u → x, v → -y). Debout dans le plan YZ : `[0, -90, 0]` (u → z). Couchée : `[-90, 0, 0]` (u → x, v → z).
- `id` : **préfixe de famille** (`E`, `B`, `CX`…). Le numéro est attribué automatiquement : `E-01`, `E-02`… un numéro par contour distinct (identiques à 180° près = même numéro, comptées en `qty`), dans l'ordre d'apparition. Le numéro est dessiné sur la face avant de chaque planche dans la vue 3D, avec les mêmes traits que ceux gravés à la découpe (une planche trop petite pour porter son nom n'en a pas).
- `rotate: 'none'` impose le sens du fil.

## Règles de conception

- `build` est pur et rapide (rappelé à chaque mouvement de curseur).
- Les valeurs des réglages arrivent déjà bornées par `min` / `max`.
- Garder les pièces dans 290 × 290 mm (planche 300 × 300, marge 5) sauf besoin contraire ; `npm run check` le vérifie aux réglages par défaut, minimum et maximum.
- Bois autour d'un trou ≥ 4,5 mm, 1,2 mm autour d'un nom gravé ; tenons et fentes de même largeur (le trait du laser donne le jeu).
- Un trou doit rester strictement à l'intérieur du contour (pas de fente ouverte sur le bord, sinon c'est un contour à part).

## Envoyer à la découpe

Bouton « Ajouter à la découpe (remplace tout) » : les pièces du modèle **remplacent tout le catalogue** de l'app (anciennes pièces, quantités des planches perso et cases « Fait » repartent à zéro ; réglages de planche et cases de gravure gardés). Le bouton « .cutparts.json » télécharge le même fichier, pour le garder ou le réimporter.

## Piloter depuis le navigateur (IA)

`window.cnc3d` existe quand l'onglet est ouvert :

| Appel | Effet |
|---|---|
| `models()` | modèles et leurs réglages (clé, type, bornes) |
| `state()` | modèle choisi, réglages, pièces (avec `qty`), remarques |
| `select(id)` | choisit un modèle |
| `setParams({ width: 150 })` | change des réglages |
| `addToCut()` | envoie les planches à la découpe |
| `fit()`, `explode(0..1)`, `screenshot()` | cadrage, éclaté, image PNG (data URL) |

## Skill

`/creer-modele <objet>` (`.claude/skills/creer-modele`) : Claude conçoit les planches, écrit le fichier, lance `npm run check`.
