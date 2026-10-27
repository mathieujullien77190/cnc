# Découpe CNC / laser

Logiciel pour **créer un modèle 3D avec une IA (LLM), puis le découper au laser**.

On décrit un objet en langage courant (« un étui pour mes mèches de perceuse », « une mangeoire à perruches »). L'IA écrit un petit modèle three.js fait de planches à emboîter. Le logiciel le montre en 3D, met les planches à plat, les range sur des feuilles de contreplaqué, puis pilote la découpeuse laser jusqu'à la pièce finie.

Site en ligne : https://mathieujullien77190.github.io/cnc/

## Le principe

```
Idée ──► IA (LLM) ──► Modèle 3D ──► Planches à plat ──► Rangement ──► Laser
 texte    écrit un     vue 3D,       pièces 2D avec     feuilles de    découpe et
          fichier      réglable      crans et trous     300 × 300 mm   gravure
```

1. **Le modèle.** L'IA écrit un fichier `src/models/library/<nom>.model.ts`. Il décrit des planches (contour 2D, épaisseur, position, rotation) et des réglages. Il n'y a pas de three.js dans le modèle : l'application en tire la vue 3D et les pièces à découper.
2. **La vue 3D.** Le modèle apparaît tout seul dans l'onglet « Modèles 3D », avec ses réglages et un curseur d'éclaté pour vérifier l'assemblage.
3. **Les pièces.** Choisir un modèle envoie ses planches à la découpe toutes seules. Elles arrivent au format `.cutparts.json`, le même qu'on peut importer depuis n'importe quel projet three.js.
4. **Le rangement.** Les pièces sont rangées automatiquement sur des feuilles, une série par épaisseur. On peut aussi composer une planche à la main.
5. **La découpe.** L'application pilote la laser en direct : cadre à vide, gravure des noms, découpe.

## Ce que fait l'application

### Modèles 3D
- Une liste de modèles réglables (dimensions, nombre de pièces, épaisseur…), vue 3D avec orbite, éclairage et bords plus foncés pour lire l'épaisseur du bois.
- Éclaté réglable, planches que l'on peut cacher, mesure entre deux points.
- Assemblages crantés (languettes et encoches), goujons, jeu de serrage appliqué automatiquement.
- Textes et traits gravés sur les planches (étiquettes, tableaux, dessins de types d'embouts).
- Modèles fournis : mangeoire à perruches V3, étui à mèches de perceuse (BOIS / MÉTAL / BÉTON), étui à embouts de visseuse, plus des plaques d'essai pour régler les jeux des trous.
- Une API `window.cnc3d` permet de piloter l'onglet depuis le navigateur (pour une IA qui teste ses modèles).

### Planches
- **Automatiques** : toutes les pièces importées, rangées au mieux (rotation à 90°, trous réutilisés), une série par épaisseur, jamais deux épaisseurs sur la même feuille.
- **Perso** : on choisit les pièces et leur quantité sur une feuille (boutons − / +), on les déplace à la main, on les tourne (touche R ou angle libre). Les conflits sont signalés en rouge.
- Aperçu zoomable, formats 300 × 300 et 400 × 320 mm (zone de la machine) ou taille libre.
- Export SVG (calque coupe rouge, calque gravure bleu).

### Laser
- Pilotage en direct d'une **Sculpfun E1 Pro 21 W** (GRBL 1.1) par Web Serial : Chrome ou Edge.
- Avant la coupe : cadre de la feuille, puis nom de chaque pièce gravé dessus. Chacun se coche à part.
- Ordre de coupe optimisé : une pièce posée dans le trou d'une autre est toujours coupée avant elle.
- Réglages de coupe (vitesse, puissance, passes), cadre à vide, déplacements manuels, webcam, reprise après une coupure.
- Essais intégrés : crantage, goujons, puissance × vitesse.

## Démarrer

Il faut Node.js.

```sh
npm install
npm run dev          # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification TypeScript et compilation |
| `npm run typecheck` | vérification TypeScript seule |
| `npm run check` | contrôles du cœur : format, rangement, gravure, G-code, planches perso, chaque modèle à ses réglages par défaut, minimum et maximum |
| `node scripts/make-example.mjs` | régénère `examples/exemple.cutparts.json` |

## Créer un modèle avec une IA

1. Ouvrir ce dépôt avec Claude Code (ou un autre agent) et décrire l'objet voulu.
2. L'agent écrit `src/models/library/<nom>.model.ts` en suivant la référence `docs/MODELES.md`. Le skill `creer-modele` détaille la marche à suivre.
3. Le modèle apparaît dans l'onglet « Modèles 3D » à chaud. On règle, on regarde en éclaté, puis on envoie à la découpe.
4. `npm run check` doit rester vert : chaque pièce tient sur 290 × 290 mm à tous les réglages permis.

Des skills guident l'IA pour les points délicats :

| Skill | Pour quoi faire |
|---|---|
| `creer-modele` | écrire un modèle de A à Z |
| `cranter-plaques` | faire s'emboîter des planches (crans impairs de 16 mm, jeu de 0,4 mm) |
| `goujon` | aligner des plaques empilées avec des lamelles de 3,4 mm |

## Importer des pièces d'un autre projet

Un projet three.js peut produire ses pièces sans passer par ici : copier `export/exportParts.js`, appeler la fonction d'export, puis glisser le fichier `.cutparts.json` dans l'application. Le format est décrit dans `docs/FORMAT.md` (schéma JSON dans `docs/cutparts.schema.json`).

## Organisation du code

| Dossier | Contenu |
|---|---|
| `src/models/` | modèles 3D (`library/`), vue three.js, conversion en pièces |
| `src/core/` | format des pièces, rangement, planches, parcours de la tête, gravure, SVG, G-code |
| `src/laser/` | pilotage GRBL, connexion, déplacements, envoi, webcam |
| `src/components/` | interface React, un dossier par composant |
| `src/store/` | état de l'application (Redux Toolkit) : projet, interface, modèles 3D ; le projet est gardé dans le navigateur |
| `docs/` | format des pièces, écriture des modèles |
| `scripts/` | contrôles automatiques et génération de l'exemple |

Détails et règles de fonctionnement : `CLAUDE.md`.

## Stack

Vite, React 19, TypeScript, Tailwind v4, three.js. Le site est publié sur GitHub Pages à chaque envoi sur `main`.

## À savoir

- Le repère des planches a son axe y vers le bas, celui de la machine vers le haut. La conversion est faite à l'export.
- Les noms gravés sont toujours posés sur la pièce. Si elle est trop petite, le texte est réduit à un seul trait ; si rien ne tient, elle reste sans nom.
- Pas encore de réglages de coupe par épaisseur : ils sont globaux.
- Le rendu visuel et la découpe réelle se testent à la main : le contrôle automatique vérifie la géométrie, pas le résultat sur le bois.
