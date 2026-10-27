---
name: creer-modele
description: Créer un modèle 3D pour l'app de découpe CNC (un fichier models/<id>.model.json : planches, positions 3D, actions). À utiliser quand l'utilisateur demande « crée / fais / ajoute un modèle », « une boîte », « un étui », « un support » ou tout objet en planches à découper au laser.
---

# Créer un modèle

Un modèle = **un fichier `models/<id>.model.json`** à la racine du dépôt (format `cnc-model`, lu par `src/models/json.ts`). Il décrit des **planches** (contour 2D, épaisseur, position et rotation dans le monde) et, au besoin, des **actions** (interrupteurs de la vue 3D). L'app en tire la vue 3D et les pièces à découper. Il n'y a pas de code dans un modèle : le code est dans l'app.

Référence : `docs/MODELES.md`. Exemples : `models/embouts.model.json`, `models/mangeoire-v3.model.json`. Types : `src/models/types.ts` (`Panel`). Aides de calcul : `src/models/helpers.ts` (`rect`, `circle`, `plateOutline`, `windowsFor`).

## Marche à suivre

1. **Cadrer la demande.** Objet, dimensions utiles, épaisseur (3 mm contreplaqué par défaut), mode d'assemblage (crans, collage). Si une cote clé manque, prendre un défaut raisonnable et le dire ; ne poser une question que si le choix change tout.
2. **Concevoir sur papier d'abord.** Lister les planches, leur plan et comment elles s'emboîtent. Rotation par plan :
   - plan XY (face) : pas de rotation, u → x, v → -y ;
   - plan YZ (flanc) : `"rotation": [0, -90, 0]`, u → z ;
   - plan XZ (à plat) : `"rotation": [-90, 0, 0]`, u → x, v → z (v vers l'avant).
   `position` = centre de la boîte englobante du contour. Repère des contours : u vers la droite, v vers le **bas**, mm.
3. **Calculer les contours avec un script jetable**, pas à la main : écrire `scripts/_<id>.mjs` qui charge les aides via Vite et écrit le JSON :
   ```js
   import { createServer } from 'vite'
   import { writeFileSync } from 'node:fs'
   const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
   const { plateOutline, windowsFor, circle, rect } = await server.ssrLoadModule('/src/models/helpers.ts')
   const t = 3
   const panels = [
     { id: 'P', category: 'Plateau', thickness: t, outer: plateOutline(120, 80, { left: { d: t }, right: { d: t } }), holes: [circle(60, 40, 5)], position: [0, t / 2, 0], rotation: [-90, 0, 0] },
   ]
   writeFileSync('models/plateau.model.json', JSON.stringify({ format: 'cnc-model', version: 1, id: 'plateau', name: 'Plateau', panels }, null, 1))
   await server.close()
   ```
   Lancer `node scripts/_plateau.mjs`, puis **supprimer le script** (ou le garder sous `scripts/models/` s'il a une valeur de source). Les cotes sont nominales : le serrage des crans (0,4 mm) et la numérotation sont ajoutés par l'app au chargement, ne pas les mettre dans le fichier.
4. **Identifiants** : `id` d'une planche = **préfixe de famille** en majuscules (`P`, `F`, `CX`). La numérotation (`P-01`, `P-02`…) est automatique : un numéro par contour distinct, planches identiques = même numéro, comptées en `qty`. `category` donne la couleur (même couleur en vue planche et en 3D) : une catégorie claire par planche.
5. **Règles de découpe** :
   - assemblages : skill `cranter-plaques` (crans impairs de 16 mm, profondeur = épaisseur, serrage ajouté tout seul : ne pas ajouter de jeu) ; goujons : skill `goujon` ;
   - un trou reste strictement dans le contour (≥ 4,5 mm de bois autour) ;
   - nom gravé : garder la place pour un nom court sur la plus grande face ; textes et traits du modèle = `labels` / `rules` (skill `gravure-noms-dessins`) ;
   - chaque pièce tient dans **290 × 290 mm** (planche 300 × 300, marge 5).
6. **Actions** (optionnel) : un interrupteur qui déplace des planches en 3D (couvercle retiré, tiroir tiré). Déclaration dans le fichier, code dans l'app : skill `ajouter-action`. Pas de réglage qui change la découpe : c'est un autre modèle.
7. **Vérifier** :
   ```sh
   npm run check      # chaque modèle, chaque action allumée / éteinte : fichier valide, planches numérotées, trous dedans, textes sur du bois plein, tout tient sur 300 × 300
   ```
   Corriger jusqu'au vert. Ne pas ouvrir de navigateur : l'utilisateur regarde la vue 3D lui-même. Contrôler par le calcul que les tenons tombent dans leurs fentes (positions monde des deux côtés).
8. **Conclure** : nom du modèle, ses actions, ses planches (id, quantité, taille) ; il apparaît dans l'onglet « Modèles 3D » dès que le fichier existe. Ne pas commiter sans demande.

## Préférences de l'utilisateur

- **Titre seul** : la liste des modèles n'affiche que `name` ; `description` reste courte.
- **Pas de réglages inutiles** : seulement des actions utiles à la vue. Les étuis n'en ont aucune.
- **Vue éclatée** : le curseur « Éclaté » est toujours là, rien à faire dans le modèle.
- Figer un modèle avec ses actions dans un état donné : bouton « Télécharger le modèle (.model.json) » de l'onglet 3D.

## Rendu 3D (automatique)

- Couleur par `category` (`src/core/colors.ts`), tranche plus foncée que les faces (`EDGE_SHADE`), arêtes noires, nom gravé sur les deux faces. Rien à coder dans le modèle.

## Pièges

- `v` va vers le **bas** dans le contour ; une hauteur mesurée depuis le bas d'un flanc se convertit en `v = H - y`.
- Une fente qui touche le bord du contour n'est plus un trou : garder un retrait (≈ 15 mm).
- Un fichier invalide est ignoré par l'app, avec le motif dans la console du navigateur et dans `npm run check` (`modelFromJson` lève une erreur lisible).
- Un `.model.ts` n'est plus lu : tout modèle est en JSON.
