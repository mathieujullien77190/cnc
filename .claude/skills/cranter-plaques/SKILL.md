---
name: cranter-plaques
description: Cranter des plaques pour qu'elles s'emboîtent (languettes et encoches / fenêtres, mêmes règles que testBrick) dans un modèle de l'app de découpe CNC. À utiliser quand l'utilisateur demande « crante les plaques », « fais-les s'emboîter », « ajoute des crans / des languettes / des fenêtres », ou quand un modèle (src/models/library/*.model.ts) assemble des planches.
---

# Cranter des plaques

Les crans sont **identiques à testBrick** (`../testBrick/src/box.js` : `count`, `plate`, `edgePoints` ; `beam.js` : `CRENEL_SNUG`). Ils sont dans `src/models/helpers.ts` et `src/models/snug.ts`. Ne jamais redessiner les crans à la main.

## Les règles (déjà codées, à connaître)

- **Nombre de crans impair, 3 au moins**, dent visée **16 mm** : `fingerCount(len)` ; la dent réelle = `len / n`. Ex. 120 mm → 7 crans de 17,1 mm ; 50 mm → 3 ; 260 mm → 17.
- Les crans **impairs** (1er, 3e…) sont les languettes / encoches ; les crans **pairs, dont les deux bouts, restent droits**.
- **Profondeur exacte = épaisseur du matériau** (`T`).
- Sur une arête commune, une plaque a des **languettes** (`d = +T`), l'autre des **encoches** (`d = -T`) — ou des **fenêtres** (trous de T de large) quand la languette traverse la plaque — **aux mêmes crans impairs** (même zone, même longueur).
- **Serrage automatique** : tout cran de profondeur T (≥ 4 mm de large) est resserré de 0,4 mm (0,2 de chaque côté), toute fenêtre de T de large (≥ 4 mm de long) est raccourcie de 0,4 mm ; les languettes gardent leur largeur. C'est `snugPanel`, appelé par `finishPanels` : **ne pas ajouter de jeu soi-même**.
- Un cran qui touche le coin de la plaque ne bouge pas.
- Bois autour d'une fenêtre ≥ 4,5 mm du bord (retrait ≈ 15 mm dans l'étagère).

## Outils (`src/models/helpers.ts`)

| Fonction | Rôle |
|---|---|
| `fingerCount(len)` | nombre de crans (impair) |
| `fingerSpans(len, a?, b?)` | intervalles `{u0, u1}` des crans impairs, dans la zone `[a, b]` |
| `plateOutline(w, h, { top, right, bottom, left })` | contour w × h dont chaque côté porte `{ d, a?, b? }` : `d > 0` languettes, `d < 0` encoches, `0` droit |
| `windowsFor(len, t, at, alongU, a?, b?, offset?)` | fenêtres (rectangles) pour recevoir les languettes d'une arête |
| `rect`, `circle` | formes simples |

Repère d'une plaque : u vers la droite, v vers le **bas**, coin haut-gauche du corps en 0, 0. Les languettes dépassent du corps (boîte englobante plus grande que w × h).

## Marche à suivre

1. **Lister les arêtes qui se touchent.** Pour chacune : quelle plaque porte les languettes, laquelle les encoches/fenêtres. Règle de choix : la plaque qui **traverse ou reçoit** (flanc, fond) a les fenêtres/encoches ; la plaque qui **arrive dessus** a les languettes. Sur une boîte fermée, l'une des deux est « propriétaire » des crans pairs.
2. **Même arête, mêmes crans.** Donner à `fingerSpans` / `plateOutline` la **même longueur et la même zone** `[a, b]` des deux côtés. Si les longueurs diffèrent (plaque plus courte de 2 T…), dire la zone explicitement avec `a` / `b`.
3. **Languette qui traverse la plaque voisine** (étagère entre deux flancs) : languettes sur la tablette (`plateOutline`), fenêtres dans le flanc (`windowsFor`) à la hauteur de la tablette ; les positions u doivent correspondre en coordonnées monde (voir `etagere.model.ts`).
4. **Languette en bout d'arête** (angle de boîte) : encoches (`d < 0`) dans la plaque qui reçoit.
5. **Ne pas appeler `snugPanel` dans le modèle** : `finishPanels` le fait (vue 3D, export, découpe voient la même géométrie).
6. **Vérifier** : `npm run typecheck && npm run check`. Le check contrôle le comptage des crans, le serrage (fenêtre −0,4 mm, encoche −0,4 mm, languette intacte), et que les trous restent dans le contour. Vérifier aussi par le calcul que les positions monde des languettes tombent dans les fenêtres (même z / x des deux côtés).
7. **Chasser les traits résiduels (obligatoire après chaque crantage).** Un « trait résiduel » est un segment qui ne devrait pas exister dans la découpe : paroi de cran en biais, micro-segment, point aligné inutile, doublon, deux traits qui se croisent, nom gravé qui touche une fenêtre. `npm run check` les cherche sur **chaque planche de chaque modèle, aux réglages par défaut, minimum et maximum** (`panelIssues` et `markIssues` de `src/models/validate.ts`) et affiche la ligne `… aucun trait résiduel` ; s'il y a un ECHEC, lire le type et la position affichés :
   - `biais` : un coin d'un cran a bougé seul (le serrage doit déplacer les deux bouts de chaque paroi, `snug.ts`) ; ne jamais bouger un seul point d'un contour à la main ;
   - `minuscule` / `doublon` / `point-inutile` : zone `a`/`b` qui ne tombe pas sur un cran, deux languettes qui se touchent, contour construit en recollant des morceaux ;
   - `croisement` : fenêtre qui dépasse du bord, languette qui entre dans une autre, nom gravé posé sur une fenêtre.
   Corriger la géométrie du modèle (jamais le contrôle) puis relancer. Si l'utilisateur signale un trait vu à l'écran, reproduire avec `panelIssues` sur la planche (`finishPanels(model.build(params))`) avant de corriger, et ajouter le cas au `check`.
8. **Vue 3D : pas de faux traits.** Les arêtes noires sont tracées depuis les contours (`src/models/edges.ts`), jamais avec `EdgesGeometry` : sur une face dont les fenêtres sont alignées à la même hauteur (flanc d'étagère), la triangulation crée des triangles plats et `EdgesGeometry` en tire des traits noirs d'une fenêtre à l'autre, bien que la découpe soit propre. `npm run check` interdit `EdgesGeometry` dans `viewer3d.ts` et vérifie que chaque trait de face est un côté de contour. Ne pas contourner ce contrôle, ne pas remettre `EdgesGeometry` ; la vue 3D montre les cotes nominales (sans serrage), le serrage ne vaut que pour la découpe.
9. **Essai physique** : bouton « Tester le crantage » (colonne de gauche) → planche perso « Essai crantage » avec 2 mini plaques CR-01 (languettes) et CR-02 (encoches) à découper avant la vraie pièce.

## Pièges

- Languettes et encoches de **mêmes crans impairs**, jamais décalés d'un cran.
- Une fenêtre qui touche le bord du contour n'est plus un trou : garder un retrait.
- Un seul coin de cran déplacé = paroi en biais (trait résiduel) : le serrage de `snug.ts` déplace toujours la paroi entière.
- Trait noir entre deux fenêtres à l'écran alors que le contour est propre = arêtes 3D mal calculées (`EdgesGeometry`), pas un défaut de crantage : voir étape 8.
- Épaisseur non entière (3,5 mm) : le serrage reconnaît la profondeur à ±0,01 mm.
- Ne pas mettre de jeu en plus du serrage : les plaques seraient lâches.
