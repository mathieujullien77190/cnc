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
7. **Essai physique** : bouton « Tester le crantage » (colonne de gauche) → planche perso « Essai crantage » avec 2 mini plaques CR-01 (languettes) et CR-02 (encoches) à découper avant la vraie pièce.

## Pièges

- Languettes et encoches de **mêmes crans impairs**, jamais décalés d'un cran.
- Une fenêtre qui touche le bord du contour n'est plus un trou : garder un retrait.
- Épaisseur non entière (3,5 mm) : le serrage reconnaît la profondeur à ±0,01 mm.
- Ne pas mettre de jeu en plus du serrage : les plaques seraient lâches.
