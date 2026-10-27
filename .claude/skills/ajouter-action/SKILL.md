---
name: ajouter-action
description: Ajouter ou modifier une action de modèle 3D (réglage de la vue 3D : ouvrir une trappe, retirer un couvercle, tirer un tiroir, choisir ce qui occupe un siège…) dans l'app de découpe CNC. À utiliser quand l'utilisateur dit « ajoute une action », « un bouton pour ouvrir / retirer / tirer … », « un choix entre … », « un nouveau type d'action », ou quand un fichier models/*.model.json a besoin d'un comportement que les types `move` / `turn` / `choice` ne couvrent pas.
---

# Actions d'un modèle

Une **action** est un réglage de la vue 3D affiché dans le panneau de l'onglet « Modèles 3D » : un **interrupteur** on/off (`move`, `turn`) ou une **liste de choix** (`choice`). Elle déplace, tourne, montre ou cache des planches. **Elle ne change jamais la forme d'une planche** : la découpe n'en dépend pas, et une planche cachée est découpée quand même.

Le **code** des actions est dans l'app, le **fichier** ne fait que les déclarer :

| Où | Quoi |
|---|---|
| `src/models/actions.ts` | `ACTION_TYPES` : un type d'action = `{ describe, check, param, apply }` |
| `models/<id>.model.json` | `"actions": [{ "key", "label", "default", "type", ...paramètres }]` |
| `src/models/json.ts` | lecture du fichier : vérifie chaque action avec `check`, construit son réglage avec `param`, puis `build` applique `apply` avec la valeur du réglage |

## Déclarer une action dans un modèle

```json
"actions": [
  { "key": "cover", "label": "Couvercle posé", "default": true, "type": "move", "panels": "Couvercle", "by": [0, -120, 0] },
  { "key": "drawer", "label": "Tiroir tiré", "default": false, "type": "move", "panels": "T", "by": [140, 0, 0] },
  { "key": "plug", "label": "Bloc d'aération posé", "default": false, "type": "move", "panels": "HP", "by": [174.85, -15, -45], "show": "HP" },
  { "key": "seat", "label": "Siège du ventilateur", "default": "cassette", "type": "choice", "options": [
    { "value": "cassette", "label": "Cassette ventilateur", "show": "VE", "hide": "HB" },
    { "value": "block", "label": "Bloc isolant", "show": "HB", "hide": "VE", "move": [{ "panels": "HB", "by": [265.8, 230, -58.2] }] },
    { "value": "none", "label": "Rien", "hide": ["VE", "HB"] }
  ] }
]
```

- `key` : identifiant (lettres, chiffres, `-`, `_`), unique dans le fichier ; `label` : texte du réglage ; `default` : état de départ (`true` / `false` pour un interrupteur, la `value` d'une option pour une liste).
- Une **cible** (`panels`, `show`, `hide`) : une **catégorie** (`"Couvercle"`), une **famille** (`"T"` = toutes les planches d'id `T`), une **liste de celles-ci** (`["VE", "HB"]`) ou des **indices** dans `panels` (`[3, 4]`). Une cible qui ne vise rien est une erreur.
- **Interrupteurs** : `move` (décale `panels` de `by` en mm, x droite, y haut, z avant), `turn` (tourne `panels` de `by` en degrés, ordre XYZ, autour du centre de la planche). En option, `show` / `hide` : planches montrées / cachées quand l'interrupteur est **allumé** ; éteint, c'est l'inverse (`show` cachées, `hide` montrées). Un interrupteur sans `show` ni `hide` ne touche pas à la visibilité.
- **Liste** : `choice` avec `options: [{ value, label, show?, hide?, move?: [{ panels, by }] }]` (au moins deux options, `value` uniques). Pour l'option choisie : `show` montrées, `hide` cachées (`visible: false`), chaque `move` appliqué ; les autres options n'ont aucun effet. Le réglage affiché est une liste dont les entrées sont les `label`s.
- Les actions s'appliquent dans l'ordre du fichier, à partir des planches du fichier ; les effets s'additionnent. Une valeur absente ou invalide vaut `default`.
- Une planche cachée reste dans les pièces à découper : pour des pièces de rechange qui s'échangent (bloc d'hiver ↔ cassette), ranger dans le fichier l'état par défaut et cacher ce qui n'est pas en place.

## Ajouter un type d'action

1. Dans `src/models/actions.ts`, ajouter une entrée à `ACTION_TYPES` (typer l'objet à part, `const lift: ActionType<Lift>`, puis l'ajouter au `Record`) :
   ```ts
   lift: {
     describe: 'interrupteur : soulève les planches visées de « mm »',
     check: (p, panels) => ({ panels: targetIndices(p.panels, panels), mm: isNum(p.mm) ? p.mm : fail('"mm" doit être un nombre') }),
     param: (_s, key, label, def) => switchParam(key, label, def),
     apply: (panels, { panels: idx, mm }, value) => (value === true ? panels.map((q, i) => (idx.includes(i) ? { ...q, position: [q.position[0], q.position[1] + mm, q.position[2]] } : q)) : panels),
   },
   ```
   `check` lève une `Error` en français sur un paramètre faux (message repris tel quel dans la console : « action 2 (lift) : "mm" doit être un nombre »). `param` construit le `ParamDef` affiché (`switchParam` pour un interrupteur ; une liste vérifie que `default` est une de ses options). `apply` reçoit la valeur du réglage (booléen ou `value` d'option), est pure et ne touche ni `outer`, ni `holes`, ni `thickness`, ni `id`.
2. Documenter le type dans ce skill (ci-dessus) et dans `docs/MODELES.md` (section « Modèle en JSON »).
3. `npm run check` : il essaie chaque modèle avec chaque interrupteur allumé et éteint et chaque option de chaque liste (planches numérotées, trous dedans, mêmes pièces découpées quel que soit l'état). Ajouter un contrôle du nouveau type dans `scripts/check.mjs` (un modèle minimal en mémoire passé à `modelFromJson`).
4. `npm run typecheck`, `npm run build`. L'utilisateur regarde le rendu 3D lui-même.

## Pièges

- Une action ne sert qu'à la vue : si un réglage doit changer la découpe (taille, nombre de trous), ce n'est pas une action, c'est un autre modèle (fichier à part).
- Ne pas viser une planche par son numéro final (`T-03`) : la numérotation est faite après, viser la famille `T`, une catégorie ou des indices. Deux groupes de planches qu'une action doit viser séparément ont besoin de deux familles (ou deux catégories), même s'ils partagent une couleur.
- `default` ne veut pas dire « état de base » : les planches du fichier sont toujours l'état **tout éteint** d'un interrupteur ; une liste applique toujours une de ses options.
- `npm run check` exige qu'un interrupteur déplace au moins une planche : un interrupteur qui ne ferait que cacher n'existe pas (le `move` sert aussi à mettre la pièce en place).
