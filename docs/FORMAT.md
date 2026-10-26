# Format `cnc-parts` (`.cutparts.json`)

Fichier d'échange entre un projet 3D (three.js) et l'app de découpe. Il ne contient que des formes plates : un contour par pièce, ses trous, son épaisseur et une quantité.

```json
{
  "format": "cnc-parts",
  "version": 1,
  "project": "exemple",
  "unit": "mm",
  "parts": [
    {
      "id": "CX-03",
      "category": "Couvre-joint",
      "qty": 4,
      "thickness": 3,
      "material": "contreplaque",
      "rotate": "any90",
      "outer": [[0, 0], [56, 0], [56, 50], [0, 50]],
      "holes": [[[10, 20], [13, 20], [13, 40], [10, 40]]]
    }
  ]
}
```

## Champs d'une pièce

| Champ | Obligatoire | Rôle |
|---|---|---|
| `id` | oui | Nom gravé sur la pièce (`CX-03`). Lettres A-Z, chiffres, tiret. Unique dans le fichier. Court : il doit tenir sur la pièce. |
| `thickness` | oui | Épaisseur du matériau en mm. L'app ne mélange jamais deux épaisseurs sur une planche. |
| `outer` | oui | Contour extérieur : points `[x, y]` en mm, reliés dans l'ordre, fermé automatiquement (ne pas répéter le premier point). 3 points au moins. |
| `holes` | non | Trous : liste de contours, même écriture. |
| `labels` | non | Textes gravés en plus du nom (« BOIS », « 2.5 »…) : rectangles fermés dans le repère de `outer`, comme les lettres du nom (voir `digitRects` dans `src/core/marking.ts`). Gravés avec le nom ; le nom se pose ailleurs. |
| `qty` | non (1) | Nombre d'exemplaires identiques. |
| `category` | non | Famille (« Nervure »…). Sert à la couleur de l'aperçu. |
| `material` | non | `contreplaque` par défaut. |
| `rotate` | non | `any90` (défaut) : l'app peut tourner la pièce de 90°. `none` : sens du fil imposé. |

## Règles

- Unité : **millimètre**. Repère : x vers la droite, **y vers le bas**. La position absolue n'a pas d'importance : l'app recale chaque pièce sur son coin haut-gauche.
- Les arcs et cercles sont déjà découpés en segments (32 points par cercle donnent une coupe lisse).
- Des pièces identiques portent **le même `id`** et une `qty` (pas de doublons dans la liste). Deux contours différents sous le même `id` sont une erreur.
- Une pièce par entrée : si deux faces sont identiques à une rotation de 180° près, c'est le même `id`.
- Les trous rectangulaires d'au moins 12 × 12 mm servent de place libre : l'app y range de plus petites pièces.
- Un fichier invalide n'est pas importé en entier : les pièces valides passent, chaque pièce refusée est listée avec la raison.

## Réimport

Importer de nouveau un fichier du même `project` met à jour les pièces de même `id` (la quantité choisie dans l'app est conservée) et ajoute les nouvelles.

## Produire le fichier depuis un projet three.js

Copier `export/exportParts.js` dans le projet, puis :

```js
import { toCutParts, downloadCutParts } from './exportParts.js'

const result = toCutParts(pieces, { project: 'exemple', thickness: 3 })
downloadCutParts(result, 'exemple')   // télécharge exemple.cutparts.json
```

`pieces` : tableau de `{ outer, holes, code, cat }`. Les options `id`, `category`, `thickness`, `material` et `rotate` acceptent une fonction pour s'adapter à un autre nommage. `result.warnings` signale les noms en double.

Prompt à donner à Claude dans un projet 3D : « ajoute un bouton Exporter pour CNC qui génère un fichier cnc-parts avec `export/exportParts.js` (voir docs/FORMAT.md de C:\projet\cnc) ».

Schéma JSON : `docs/cutparts.schema.json`.
