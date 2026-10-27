---
name: creer-modele
description: Créer un modèle 3D (three.js) pour l'onglet « Modèles 3D » de l'app de découpe CNC : un fichier src/models/library/<nom>.model.ts qui décrit des planches 2D assemblables, réglables, exportables en .cutparts.json. À utiliser quand l'utilisateur demande « crée un modèle », « ajoute un modèle de <objet> », « fais-moi un <objet> à découper ».
---

# Créer un modèle

Un modèle = un fichier `src/models/library/<id>.model.ts`. Il décrit des **planches** (contour 2D + épaisseur + position/rotation dans le monde) ; l'app en tire la vue 3D et les pièces à découper. Pas d'import de three.js dans le modèle.

Référence complète : `docs/MODELES.md`. Exemple : `src/models/library/mangeoire-v3.model.ts`. Types : `src/models/types.ts`. Aides : `src/models/helpers.ts` (`rect`, `circle`, `tabbedBottom`).

## Marche à suivre

1. **Cadrer la demande.** Objet, dimensions utiles, épaisseur du matériau (3 mm contreplaqué par défaut), mode d'assemblage (tenons/fentes, collage). Si une cote clé manque, prendre un défaut raisonnable et le dire ; ne poser une question que si le choix change tout.
2. **Concevoir sur papier d'abord.** Lister les planches, leur plan (XY, YZ ou XZ) et comment elles s'emboîtent. Établir pour chaque planche la rotation :
   - plan XY (face) : pas de rotation, u → x, v → -y ;
   - plan YZ (flanc) : `rotation: [0, -90, 0]`, u → z ;
   - plan XZ (à plat) : `rotation: [-90, 0, 0]`, u → x, v → z (v vers l'avant).
   `position` = centre de la boîte englobante du contour.
3. **Écrire le fichier** avec `defineModel` : `id` (kebab-case, unique, = nom du fichier), `name`, `description`, `params` (bornes `min`/`max` qui gardent chaque pièce dans **290 × 290 mm**), `build`.
4. **Identifiants** : donner seulement le **préfixe de famille** (`E`, `B`, `CX`, lettres A-Z). La numérotation est automatique (`E-01`, `E-02`…) : un numéro par contour distinct, planches identiques = même numéro (comptées en `qty`). Ne pas numéroter à la main.
5. **Règles de découpe** :
   - assemblages : utiliser le skill `cranter-plaques` (crans impairs de 16 mm, mêmes que testBrick ; le serrage de 0,4 mm est ajouté tout seul, ne pas ajouter de jeu) ;
   - un trou reste strictement dans le contour (≥ 4,5 mm de bois autour) ;
   - nom gravé : garder la place pour un nom court sur la plus grande face.
6. **Remarques** : `notes` signale les réglages douteux (pièces trop proches, boîte trop étroite…). `build` ne lève pas d'erreur pour un réglage permis.
7. **Vérifier** :
   ```sh
   npm run typecheck
   npm run check      # défaut, minimum et maximum de chaque modèle : fichier valide, trous dedans, tout tient sur 300 × 300
   ```
   Corriger jusqu'au vert. Ne pas ouvrir de navigateur : l'utilisateur teste lui-même la vue 3D. Contrôler à la place par le calcul que les tenons tombent bien dans leurs fentes (positions monde des deux côtés).
8. **Conclure** : dire le nom du modèle, ses réglages et ses planches (id, quantité, taille) ; rappeler qu'il apparaît dans l'onglet « Modèles 3D ». Ne pas commiter sans demande.

## Préférences de l'utilisateur

- **Titre seul** : la liste des modèles n'affiche que le `name`, jamais la `description`. Garder `description` courte (le champ est obligatoire), ne pas y mettre de texte à lire.
- **Pas de réglages inutiles** : ne déclarer dans `params` que ce que l'utilisateur veut vraiment régler. Les modèles « étui » (`range-meches`, `embouts`) n'en ont aucun (`params: []`) : valeurs fixes en constantes en tête de fichier, plaque d'essai toujours produite.
- **Vue éclatée** : le curseur « Éclaté » est toujours présent dans les réglages, pour tous les modèles, même sans `params`. C'est pratique pour vérifier l'assemblage : ne jamais le retirer, ne rien faire dans le modèle pour l'avoir.

## Noms et dessins

Le nom d'une pièce (`E-01`) est gravé par l'app ; un texte, un trait ou un tableau du modèle (`labels`, `rules`) est un **dessin**, avec sa propre case et sa propre couleur. Voir le skill `gravure-noms-dessins`.

## Rendu 3D (automatique, rien à faire dans le modèle)

- La couleur d'une planche vient de sa `category` (la même couleur en vue planche et en vue 3D, `src/core/colors.ts`) : donner une `category` claire à chaque planche, ne jamais coder une couleur.
- La **tranche** de chaque planche (le tour de l'épaisseur) est automatiquement plus foncée que les faces (`EDGE_SHADE` dans `viewer3d.ts`, 20 % de moins) pour lire l'épaisseur du bois. Une pièce créée par un modèle l'a donc sans rien ajouter ; ne pas la contourner (matériau unique, couleur imposée) et la garder pour toute nouvelle sorte de pièce dans la vue 3D.
- Les arêtes noires sont tracées depuis les contours et le nom est gravé sur les deux faces (voir `cranter-plaques`, étape 8).

## Gabarit

```ts
import { rect } from '../helpers'
import { defineModel } from '../types'

export default defineModel({
  id: 'plateau',
  name: 'Plateau',
  description: 'Une planche percée.',
  params: [
    { key: 'width', label: 'Largeur', type: 'number', default: 120, min: 40, max: 280, step: 5, unit: 'mm' },
    { key: 'thickness', label: 'Épaisseur', type: 'number', default: 3, min: 2, max: 8, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const W = p.width as number
    const t = p.thickness as number
    return {
      panels: [{ id: 'P', category: 'Plateau', thickness: t, outer: rect(0, 0, W, 80), holes: [rect(20, 20, 20, 20)], position: [0, t / 2, 0], rotation: [-90, 0, 0] }],
      notes: [],
    }
  },
})
```

## Pièges

- `v` va vers le **bas** dans le contour ; une hauteur mesurée depuis le bas d'un flanc se convertit en `v = H - y`.
- Une fente qui touche le bord du contour n'est plus un trou : garder un retrait (≈ 15 mm) comme `mangeoire-v3.model.ts`.
- `build` est rappelé à chaque mouvement de curseur : pas de calcul lourd.
- Les valeurs de `p` sont des `number | boolean | string` : les convertir (`as number`).
