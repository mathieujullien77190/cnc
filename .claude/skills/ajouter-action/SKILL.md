---
name: ajouter-action
description: Ajouter ou modifier une action de modèle 3D (interrupteur de la vue 3D : ouvrir une trappe, retirer un couvercle, tirer un tiroir…) dans l'app de découpe CNC. À utiliser quand l'utilisateur dit « ajoute une action », « un bouton pour ouvrir / retirer / tirer … », « un nouveau type d'action », ou quand un fichier models/*.model.json a besoin d'un comportement que les types `move` / `turn` ne couvrent pas.
---

# Actions d'un modèle

Une **action** est un interrupteur on/off affiché dans les réglages de l'onglet « Modèles 3D ». Allumée, elle déplace ou tourne des planches dans la vue 3D. **Elle ne change jamais la forme d'une planche** : la découpe n'en dépend pas.

Le **code** des actions est dans l'app, le **fichier** ne fait que les déclarer :

| Où | Quoi |
|---|---|
| `src/models/actions.ts` | `ACTION_TYPES` : un type d'action = `{ describe, check, apply }` |
| `models/<id>.model.json` | `"actions": [{ "key", "label", "default", "type", ...paramètres }]` |
| `src/models/json.ts` | lecture du fichier : vérifie chaque action avec `check`, puis `build` applique `apply` pour chaque action allumée |

## Déclarer une action dans un modèle

```json
"actions": [
  { "key": "cover", "label": "Couvercle posé", "default": true, "type": "move", "panels": "Couvercle", "by": [0, -120, 0] },
  { "key": "drawer", "label": "Tiroir tiré", "default": false, "type": "move", "panels": "T", "by": [140, 0, 0] }
]
```

- `key` : identifiant (lettres, chiffres, `-`, `_`), unique dans le fichier ; `label` : texte de l'interrupteur ; `default` : allumé au départ.
- `panels` : les planches visées, par **catégorie** (`"Couvercle"`), par **famille** (`"T"` = toutes les planches d'id `T`), ou par **indices** dans `panels` (`[3, 4]`). Une cible qui ne vise rien est une erreur.
- Types existants : `move` (décale de `by` en mm, x droite, y haut, z avant), `turn` (tourne de `by` en degrés, ordre XYZ, autour du centre de la planche).
- Les actions s'appliquent dans l'ordre du fichier, à partir des planches « tout éteint » ; les effets s'additionnent.

## Ajouter un type d'action

1. Dans `src/models/actions.ts`, ajouter une entrée à `ACTION_TYPES` :
   ```ts
   lift: {
     describe: 'soulève les planches visées de « mm »',
     check: (p, panels) => ({ panels: targetIndices(p.panels, panels), mm: isNum(p.mm) ? p.mm : fail('"mm" doit être un nombre') }),
     apply: (panels, { panels: idx, mm }) => panels.map((q, i) => (idx.includes(i) ? { ...q, position: [q.position[0], q.position[1] + mm, q.position[2]] } : q)),
   },
   ```
   `check` lève une `Error` en français sur un paramètre faux (message repris tel quel dans la console : « action 2 (lift) : "mm" doit être un nombre »). `apply` est pure et ne touche ni `outer`, ni `holes`, ni `thickness`, ni `id`.
2. Si le type a des paramètres d'une autre forme que `Shift`, élargir le type générique de `ACTION_TYPES` (`Record<string, ActionType<any>>` est acceptable ici, le `check` typant déjà).
3. Documenter le type dans ce skill (tableau ci-dessus) et dans `docs/MODELES.md` (section « Modèle en JSON »).
4. `npm run check` : il essaie chaque modèle avec chaque action allumée et éteinte (planches numérotées, trous dedans, pièces identiques quel que soit l'état). Ajouter un contrôle du nouveau type dans `scripts/check.mjs` (un modèle minimal en mémoire passé à `modelFromJson`).
5. `npm run typecheck`, `npm run build`. L'utilisateur regarde le rendu 3D lui-même.

## Pièges

- Une action ne sert qu'à la vue : si un réglage doit changer la découpe (taille, nombre de trous), ce n'est pas une action, c'est un autre modèle (fichier à part).
- Ne pas viser une planche par son numéro final (`T-03`) : la numérotation est faite après, viser la famille `T` ou des indices.
- `default: true` ne veut pas dire « état de base » : les planches du fichier sont toujours l'état **tout éteint**.
