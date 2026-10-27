# models/

Les modèles 3D de l'app : **un fichier `<id>.model.json` par modèle**, format `cnc-model`, sans code. Ils apparaissent dans l'onglet « Modèles 3D » dès que le fichier existe.

Un fichier contient :
- `id` (kebab-case), `name`, `description` courte ;
- `panels` : les planches aux cotes nominales (contour u droite / v bas en mm, `thickness`, `position` = centre de la boîte dans le monde x droite / y haut / z avant, `rotation` Euler XYZ en degrés, `category` pour la couleur, `id` = préfixe de famille en MAJUSCULES, `holes`, `labels`, `rules`, `snugDepths`) ;
- `colors` (optionnel) : couleur imposée par catégorie (`#rrggbb`), vue 3D et planches ;
- `actions` : réglages de la vue 3D (`{ key, label, default, type, ...paramètres }`) : interrupteurs `move` / `turn` (avec `show` / `hide` en option) et listes de choix `choice` (une option montre, cache, décale) ; le code est dans `src/models/actions.ts`. Une planche cachée est découpée quand même.

Règles :
- Le serrage des crans (0,4 mm) et la numérotation (`P-01`…) sont appliqués par l'app au chargement : ne pas les mettre dans le fichier.
- Une action ne change jamais une forme : la découpe ne dépend d'aucune action. Un réglage qui change la découpe = un autre fichier.
- Les contours se calculent avec un script jetable (`src/models/helpers.ts` via Vite), pas à la main : skill `creer-modele`. Actions : skill `ajouter-action`.
- Chaque pièce tient dans 290 × 290 mm ; `npm run check` vérifie chaque fichier (actions allumées et éteintes).
- Un fichier invalide est ignoré par l'app, avec le motif dans la console.
