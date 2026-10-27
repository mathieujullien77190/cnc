---
name: gravure-noms-dessins
description: Distinguer le nom gravé d'une pièce et les dessins gravés dessus (textes, traits, tableaux, icônes) dans l'app de découpe CNC. À utiliser quand l'utilisateur parle de « nom des pièces », « dessins », « gravure », « labels », « règles », de leur couleur ou de leur case à cocher, ou quand un modèle (src/models/library/*.model.ts) grave quelque chose sur ses planches.
---

# Noms et dessins gravés

Deux choses différentes sont gravées sur une pièce. Ne jamais les mélanger.

| | **Nom** | **Dessin** |
|---|---|---|
| Quoi | l'identifiant de la pièce (`P-01`, `F-02`) | tout ce que le modèle ajoute : textes (`labels`), traits (`rules`), tableaux, icônes de types d'embouts |
| D'où ça vient | calculé par l'app (`marksOf`, `markPiece` dans `core/marking.ts`) | écrit dans le modèle (`Panel.labels`, `Panel.rules`), recopié dans le `.cutparts.json` (`labels` de la pièce) |
| Où poser | l'app cherche seule une place libre sur du bois plein | le modèle choisit la position exacte |
| Case à cocher | « Mettre le nom des pièces » (`marking.names`) | « Mettre les dessins » (`marking.drawings`, actif sauf si `false`) |
| Couleur dans l'aperçu | bleu `NAME_COLOR` (`#2563eb`) | violet `DRAWING_COLOR` (`#9333ea`) |
| Export SVG | groupe `gravure` (bleu `#0000ff`) | groupe `dessins` (violet) |
| Dans le travail laser | 2e passe de gravure | 3e passe, après les noms |

Ordre de gravure avant la coupe : **cadre** (`marking.frame`) → **noms** → **dessins**. La coupe ne dépend d'aucune case.

## Où c'est dans le code

- `src/core/sheets.ts` : `marksOf` / `marksFor` (noms seulement), `drawingsOf` / `drawingsFor` (dessins seulement). Les dessins restent des obstacles pour la pose du nom, qu'ils soient gravés ou non.
- `src/core/job.ts` : `buildJob` (ordre de gravure, le cache du travail dépend des trois cases). `src/core/svg.ts` : calques.
- `src/core/colors.ts` : `NAME_COLOR`, `DRAWING_COLOR`.
- `src/components/MarkingToggles/` : les cases. `src/components/SheetPreview/SheetPiece/` : un tracé bleu pour le nom, un violet pour les dessins.
- Vue 3D (`src/models/viewer3d.ts`) : affiche les deux sur les deux faces, sans distinction de couleur ni de case.

## Règles pour écrire un modèle

- Un texte ou un trait du modèle va dans `labels` / `rules` : c'est un **dessin**. Ne jamais y recopier l'identifiant de la pièce : le nom, lui, est ajouté tout seul.
- Un dessin tient sur du bois plein (pas sur un trou ni hors du contour). `npm run check` le vérifie (« textes gravés sur du bois plein »).
- Des planches de même contour mais avec des dessins différents ont des numéros différents (la signature de numérotation inclut les dessins).
- Police de gravure : majuscules, chiffres, `-`, `.`, `+` (`src/core/marking.ts`). Voir `docs/MODELES.md` pour `labels`, et `range-meches.model.ts` / `embouts.model.ts` pour des exemples.
- Garder 1,2 mm de bois autour d'un texte, 4,5 mm autour d'un trou.

## En cas de demande de l'utilisateur

- « Change la couleur des dessins » : `DRAWING_COLOR` dans `core/colors.ts` (aperçu et SVG).
- « Ajoute une case pour … » : suivre le motif de `drawings` (type `Marking`, `DEFAULT_MARKING`, `MarkingToggles`, clé de cache de `sheetToJob`).
- Après toute modification : `npm run typecheck` et `npm run check`. L'utilisateur teste le rendu lui-même dans son navigateur.
