---
name: goujon
description: Ajouter ou modifier des goujons (lamelles de 3,4 mm de large + trous de 3 × 3 mm qui alignent des plaques empilées) dans un modèle de l'app de découpe CNC. À utiliser quand l'utilisateur dit « mets des goujons », « ajoute un goujon dans X », « aligne les plaques avec des goujons », ou parle de trous de goujon.
---

# Goujons

Un goujon est toujours le même :

- **3,4 mm de large** (c'est la largeur, pas l'épaisseur), de la longueur qu'il faut ; découpé dans le contreplaqué comme les autres pièces, donc de l'épaisseur du matériau (`T`).
- **Longueur = somme des épaisseurs des plaques traversées** (3 plaques de `T` = 9 mm dans la mangeoire). **Il ne ressort jamais** : ses bouts sont au ras des faces extérieures des plaques extrêmes (`DOWEL.out = 0`). Ne mettre un dépassement que si l'utilisateur le demande.
- **Debout dans une pile de plaques** : chaque plaque traversée a un **trou de 3 × 3 mm** (l'épaisseur du matériau `T`, pas 3,4 : le goujon, large de 3,4 mm, rentre serré) à la même position (x, y) monde.
- C'est **une pièce du modèle** : catégorie `Goujon`, préfixe d'id `G` (G-01…), épaisseur `T` comme les autres planches (il apparaît donc dans les planches perso de cette épaisseur), forme = rectangle 3,4 × longueur, posée debout (axes `[X, Z]`). Elle est donc dans la vue 3D et dans l'export de découpe.
- Pas de jeu à ajouter : le trou fait T × T (3 × 3) exprès, le goujon de 3,4 mm de large rentre serré.

## Référence : `src/models/library/mangeoire-v3.model.ts`

```ts
const DOWEL = { side: 3.4, inset: 9, out: 0 }          // côté, retrait au bord, dépassement
const DOWELS: [number, number][] = ...                   // positions MONDE (x, y), définies une seule fois
const dowelHoles = (sh, ox, oy) => ...                   // trou T × T dans une forme ; (ox, oy) = origine monde de la forme
```

- Les trous : `dowelHoles(shape, ox, oy)` sur chaque plaque de la pile, **avant** `add(...)`. Mêmes `DOWELS` partout, donc alignés.
- Les pièces : une boucle sur `DOWELS` qui fait `add('goujon', 'Goujon', rect 3,4 × (somme des épaisseurs + 2·out), [x − side/2, y + side/2, z bas de la pile], [X, Z])`.
- Ajouter `Goujon: 'G'` dans `PREFIX`.

## Règles de placement

1. Choisir la pile : les plaques dessus / dessous / entre, qui se touchent.
2. Les positions doivent tomber dans le contour de **chaque** plaque de la pile (la plus petite décide : le fond du réservoir s'arrête à x = 50 → x ≤ 50 − retrait).
3. Retrait au bord ≥ 9 mm : au moins 4,5 mm de bois autour du trou, à l'écart des crans et des fenêtres (profondeur `T` sur les bords).
4. Loin des autres trous et ouvertures (fente de la languette, trou central…).
5. Mettre à jour le commentaire d'en-tête du modèle (plaques percées) et le décompte du test dans `scripts/check.mjs` (planches et pièces différentes : +1 pièce `G`, +N planches).

## Vérifier

`npm run typecheck` puis `npm run check` (trous dans le contour, tout tient sur du 300 × 300). L'utilisateur contrôle l'alignement dans la vue 3D.
