---
name: chiffres-contours
description: Construire des chiffres (et des lettres) gravés en lignes parallèles et en cercles emboîtés dans un modèle de l'app de découpe CNC (le livre de l'Avent v2 : numéros 1 à 24 sur les couvercles). À utiliser quand l'utilisateur parle de « numéros », « chiffres », « nombres » ou « lettres » gravés en traits, de « lignes » ou « contours » à 0,3 mm, de « cercle », « arc », « ovale », de lignes qui « se coupent » ou qui doivent « se toucher », ou quand un chiffre gravé a un défaut (le 6, le 8, le 5…).
---

# Chiffres en contours emboîtés

Un chiffre gravé n'est **pas** un texte plein (`labels`) : c'est un dessin fait de lignes fines, que la vue 3D montre une par une. Le code est dans `scripts/models/livre-avent-v2.mjs` (`numberShapes`, `engrave`), pas dans l'app. Les lettres de la police (`digitStrokes`, `src/core/marking.ts`) donnent le tracé central de chaque trait, en mm.

## La règle de base (la même pour tous les chiffres)

- **6 lignes** dans l'épaisseur de chaque trait. L'écart entre deux lignes et la largeur du trait **suivent la hauteur du chiffre** : 0,3 mm d'écart et 1,5 mm de trait pour un chiffre de 13 mm (`NUM_REF_H`), dans la même proportion pour un autre (`sc = h / NUM_REF_H`). Toujours 6 lignes, jamais un nombre qui change. L'écart est arrondi au µm avant tout calcul, sinon le dernier cercle sort.
- Chaque ligne est un trait fin de 0,12 mm (`NUM_LINE_W`) : une règle `[x0, y0, x1, y1, 0.12, 1]` (6ᵉ valeur = pas entre contours : grand, donc une seule passe). La vue 3D dessine un trait de 0,12 mm ou moins en **une seule ligne** (pas deux bords).
- Le chiffre est tourné de **90° dans le sens trigonométrique** autour de son centre : un point `(x, y)` du glyphe devient `(cu + y, cv − x)` dans la pièce (`turn`) ; un angle de glyphe devient `angle − 90°`.
- **Tous les numéros ont la même hauteur** : `NUM_H` = 10 mm (numéros 1 à 8 sur les couvercles `LN`, 9 à 16 sur les couvercles `E`, 17 à 24 sur les pièces `E-04`), donc aussi le même écart entre lignes. Leur **encre réelle** est recentrée sur le centre de la pièce (`engrave` mesure les traits et les cercles finis, puis décale) : un 1 ou un 7 est aussi centré qu'un 8.
- Les 8 couvercles numérotés de 1 à 8 sont dans leur propre groupe `LN` (couleur « Numéroté »).

## Comment chaque partie d'un chiffre est tracée

| Partie du glyphe | Tracé |
|---|---|
| Rond fermé (le 8, le bas du 6, le haut du 9) | `circles` : 6 cercles concentriques `[cx, cy, r + 0,75, 0.3, r − 0,75]` |
| Ovale (le 0) | `circles` avec les 8ᵉ valeur `du` (rayon en plus dans le sens u) et les angles 0 et 360 |
| Arc de cercle (le haut du 6, le 5, le 3, le 2, la queue du 9) | `circles` avec angles : `[cx, cy, r + 0,75, 0.3, r − 0,75, a0, a1]` (un trait en bande de 0,12 mm à la découpe) |
| Trait droit (le 1, le 4, le 7, les pieds) | 6 lignes parallèles **ouvertes**, sans bouts carrés (`offsetOpen(poly, d, 0)`) |

Un arc est détecté dans un trait de la police (`splitRuns`, `arcFit`) : suite de points qui épouse un cercle ajusté aux moindres carrés (`fitCircle`, écart < 9 % : un bol un peu ovale, comme celui du 5, reste d'un seul arc) **et régulièrement espacés** (sinon un trait droit collé à l'arc, comme la queue du 9, passerait pour un grand arc). Un trait ouvert = arcs + traits droits.

## Les lignes ne se coupent jamais, elles se touchent

Le défaut classique : deux traits se croisent et leurs lignes se traversent. Règles (`numberShapes`) :

- Un **trait droit** s'arrête à la bande (±0,75) du trait droit qui **vient après** (le pied du 1 sur sa tige) et au **plus grand cercle d'un rond** (la queue du 6, du 9).
- Un **rond ou un arc** s'arrête **exactement** (sans marge, `R − 1e-9`) à la bande d'un trait droit d'un **autre** trait (le 5) ou au plus grand cercle d'un rond ou arc qui le **suit** (le 3, le 8). **Chaque cercle de l'épaisseur a son propre angle d'arrêt** : il reste 6 arcs, jamais des segments droits.
- Dans un même tracé qui se recroise (la barre du 4 sur sa tige), le tracé reste **d'un seul tenant** (coins en onglet : le haut et la gauche du 4 sont les pointes du triangle) ; seules les lignes d'un segment qui entrent dans la bande d'un segment suivant non adjacent sont coupées.
- **Priorités entre courbes** : un **rond complet** n'est arrêté que par un rond qui le suit (le 8 : le premier rond s'arrête sur le second) ; la queue d'un 9 (un arc) s'arrête sur son rond, qui reste complet ; un arc s'arrête au grand cercle de tout rond et d'un arc qui le suit.
- La boucle d'un **6 ou d'un 9** (l'arc) a **le même rayon et le même axe** que son rond (`equalizeArc`) ; le trait droit qui les relie suit.
- L'équerre du **5** (la barre du haut et le trait qui descend) est décalée à droite pour que le bas du trait arrive au niveau du début du bol (`glyphStrokes`). Le **6** est le **9** retourné de 180° (même tracé, mêmes règles).
- Le petit bout en haut du **1** est `FLAG_GROW` (1,3) fois plus long que dans la police.
- Un trait droit qui finit sur l'arc d'un autre trait (le 5) **descend un peu plus** (`EXT_END` = 0,06 × hauteur, le minimum pour que les 6 cercles du bol l’atteignent) ; les arcs s’arrêtent à `ARC_GAP` = 0,1 mm de ce trait, sans le toucher (les ronds entre eux se touchent).

## Marche à suivre pour un nouveau chiffre ou un défaut

1. Regarder le tracé de la police (`ROUND_FONT` / `FONT` dans `src/core/marking.ts`, grille 2 × 4) : traits droits, arcs, boucles fermées.
2. Faire un **rendu en texte** : un script jetable `scripts/_ascii.mjs` qui charge `models/…model.json`, trace les règles (`-`) et `circleLines` des `circles` (via `vite`, `ssrLoadModule('/src/models/toCutParts.ts')`) dans une grille de caractères ; **le supprimer après**. On voit les croisements sans navigateur.
3. Corriger dans `numberShapes` (pas dans le modèle JSON, généré) et relancer `node scripts/models/livre-avent-v2.mjs`.
4. Vérifier : `npm run typecheck`, `npm run check` (« textes gravés sur du bois plein » : tout le dessin doit être sur du bois plein, au-dedans du liseré), et compter les lignes (6 par trait).

## Pièges

- Un panneau est **centré sur sa boîte englobante** : si une gravure change la boîte, la position doit suivre (les numéros sont posés en coordonnées de la pièce, pas du monde).
- Chaque numéro gravé rend sa pièce **unique** (la numérotation `LO-04`, `E-05`… suit les contours) : ne pas s'étonner de plus de pièces différentes.
- L'ordre des traits dans la police compte : « celui qui vient après » domine. Pour inverser, changer l'ordre ou la règle, pas l'écart.
- Ne pas remettre des `labels` : ils ne se tournent pas et se remplissent en gros trait.
- Le format `circles` (arcs, ovales, `rMin`) et les règles à 6 valeurs sont décrits dans `docs/MODELES.md` ; leur code est dans `src/models/` (`toCutParts.ts` : `circleRings` pour la découpe, `circleLines` pour la vue 3D ; `viewer3d.ts`).

## Les losanges numérotés : cadre et pièce du milieu (livre-avent-v2)

Chaque losange qui porte un numéro (couvercles `LO` 1 à 8, couvercles `E` 9 à 16, pièces 17 à 24) est en **2 pièces** : un **cadre** de `FRAME_INSET` (2 mm) qui fait tout le tour, dans le groupe `LN` (couleur « Numéroté »), et la **pièce du milieu**, qui garde son groupe et porte le numéro (`innerOf`). Le cadre a un trou exactement de la forme de la pièce du milieu, sans jeu. Les numéros 1 à 16 sont sur la ligne des coins larges de leur pièce ; les lignes de coin (`cornerLines`) sont 2 lignes parallèles fines, comme les chiffres, qui ne se rejoignent pas.
