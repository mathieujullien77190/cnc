# Découpe CNC / laser

App qui range des pièces 2D sur des planches et pilote une laser (Sculpfun E1 Pro 21 W, zone 400 × 320 mm, GRBL 1.1, Web Serial : Chrome ou Edge). Les pièces viennent de modèles 3D (`models/*.model.json`) ou de fichiers `.cutparts.json` (`docs/FORMAT.md`).

Langue : français (interface, commentaires, docs), code en anglais. Commits : Conventional Commits en anglais, faits par l'utilisateur, jamais de co-auteur ni de mention de l'assistant.

## Commandes

```sh
npm run dev          # http://localhost:5173
npm run typecheck    # tsc
npm run check        # scripts/check.mjs : cœur, store, modèles (0 ECHEC attendu)
npm run build        # tsc + vite build
```

Après tout changement : les trois. L'utilisateur regarde le rendu (3D, planches, laser) lui-même dans son navigateur : ne pas ouvrir de navigateur, ne pas affirmer qu'un rendu est bon.

## Où est quoi

Chaque dossier a son `CLAUDE.md` avec le détail. En bref :

| Dossier | Rôle |
|---|---|
| `models/` | Les modèles 3D : un `.model.json` par modèle (planches, positions 3D, actions, couleurs), sans code |
| `src/core/` | Cœur sans React : format, rangement, planches, parcours, gravure, SVG, G-code |
| `src/models/` | Moteur des modèles : lecture du JSON, actions, serrage, numérotation, vue three.js |
| `src/laser/` | Pilotage GRBL, copié de testBrick : pas de logique de l'app dedans |
| `src/store/` | État Redux Toolkit par domaine (`project`, `ui`, `models`) ; skill `store-redux` |
| `src/state/` | Hooks de liaison : `useProject`, `useLaserSession`, `useDeepSearch` (worker) |
| `src/components/` | Interface React par domaine (`app`, `sheets`, `parts`, `settings`, `models`, `laser`) ; briques dans `ui/` |
| `docs/`, `scripts/`, `export/`, `examples/` | Doc de référence, contrôles, module d'export three.js, exemple |
| `.claude/skills/` | `creer-modele`, `ajouter-action`, `cranter-plaques`, `goujon`, `gravure-noms-dessins`, `store-redux`, `react-structure` |

Imports : `@/...` (alias de `src/`) entre dossiers, `./...` dans un composant. Un composant = un dossier (`index.ts`, `X.tsx`, `types.ts`), briques importées depuis `@/components/ui`.

## Les trois onglets

- **Modèles 3D** : liste des modèles (titre seul). Choisir un modèle envoie ses planches à la découpe (le catalogue est remplacé) ; recliquer le désélectionne (plus de planches). Réglages = les actions du modèle (interrupteurs) + l'éclaté. Clic droit : cacher une planche ou son groupe, réafficher une par une ou tout. Téléchargement du `.cutparts.json` ou du `.model.json` figé. API `window.cnc3d`.
- **Planches automatiques** : toutes les pièces, une série de planches par épaisseur (« Optimiser par type » : une série par famille). Clic sur une pièce de la liste → sa planche ; clic sur une pièce de la planche → sa ligne dans la liste. « Afficher dans planche perso » copie une planche en perso sans toucher à l'automatique.
- **Planche perso** : une seule planche, quantités par pièce (− / +), glisser, tourner (R ou angle), les pièces en trop empilées en haut à gauche (en conflit, à déplacer).

Les trois vues restent montées (masquées hors de leur onglet) : sélections, zoom, défilement et vue 3D se retrouvent comme on les a laissés.

## Règles du cœur

- Repère des planches : y vers le bas ; machine : y vers le haut (`flipY` dans `job.ts`). Le rangement part du coin bas-gauche (`packSpread` range dans un repère retourné, trous compris).
- Une planche = une épaisseur. Un rangement ne fait jamais se chevaucher des pièces : `baseLayout` vérifie (`layoutValid`) et refait sans réutiliser les trous si besoin.
- « Optimiser encore mieux » : recherche polygonale dans un Web Worker, au clic seulement (`polynest.ts`, `deep.ts`). Le résultat est `settings.deep` (`sig`, placements par groupe), rejoué tel quel par `buildAutoSheets` tant que `sig` correspond aux pièces et réglages ; sinon rangement normal. Gardé seulement s'il gagne une planche. Les deux boutons de mode l'effacent ; annuler ne dit rien.
- Une pièce posée dans le trou d'une autre est coupée avant elle (`insideOf` → `route.ts`). Le travail laser d'une planche n'est calculé que fenêtre ouverte (`laserItems` paresseux, propriétés non énumérables).
- Gravure avant coupe, dans l'ordre : cadre, noms des pièces (bleu), dessins des modèles (violet, case « Mettre les dessins ») ; skill `gravure-noms-dessins`. Noms toujours sur la pièce (trait double, ou minuscule sur une petite pièce, ou rien).
- Couleurs par famille communes à la vue planche et à la 3D (`src/core/colors.ts`) ; un modèle peut en imposer (`colors`).
- Réglages de coupe globaux (`useLaserMachine`, défaut 650 mm/min à 100 %) ; pas de réglage par épaisseur.

## Règles des modèles

- Un modèle décrit des planches aux cotes nominales ; serrage des crans (0,4 mm, `snugDepths`, `[]` pour l'éviter) et numérotation sont appliqués au chargement. Pas de three.js ni de code dans un modèle.
- Une action déplace ou tourne des planches, jamais une forme : un réglage qui change la découpe = un autre fichier. Types d'actions dans `src/models/actions.ts` (skill `ajouter-action`).
- Crans : comme testBrick (impair, 16 mm, profondeur = épaisseur) ; skill `cranter-plaques`. Goujons : skill `goujon`. Contours calculés par script, jamais à la main (skill `creer-modele`).
- `npm run check` passe chaque modèle avec chaque action : fichier valide, planches numérotées, trous dedans, textes sur du bois plein, pièces sur la machine (400 × 320) ; au-delà de 300 × 300 il le signale (« note »).

## État et sauvegarde

- Tout ce qui survit à un changement d'onglet est dans le store ; les planches sont calculées par sélecteurs mémoïsés, jamais stockées. Pas d'objet non sérialisable (le viewer three.js reste hors store).
- localStorage : `cnc-projet-v1` (pièces, réglages dont `deep`, cases, planches perso ; format inchangé, champs nouveaux optionnels), `cnc-modeles-v1` (modèle choisi, actions), `laser-reglages`. Écriture groupée après les rafales d'actions.
