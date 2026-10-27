# src/components/ui/

Les briques d'interface de l'app : pures, pilotées par props et `className`, sans logique métier ni accès au store. Tout s'importe depuis `@/components/ui`, qui ré-exporte aussi celles de `src/laser/ui` (`Btn`, `Chip`, `Notice`, `Section`, `Hint`, `IconButton`, `Modal`, `Slider`…).

| Brique | Rôle |
|---|---|
| `Card` | Boîte blanche arrondie à ombre légère (`as`, `className`) |
| `Title` | Titre de bloc (`as`, `size`, `tone`) |
| `Field` | Libellé à gauche, champ à droite |
| `NumField` | Champ numérique : frappe libre, valeur transmise si valide, `warnAbove` (rouge), `debounce` |
| `Checkbox` | Case à cocher avec libellé |
| `Switch` | Interrupteur on / off, libellé à gauche |
| `Select` | Menu déroulant stylé |
| `Toolbar` | Rangée de boutons qui passe à la ligne |
| `EmptyState` | Zone en pointillés « rien à afficher » |
| `PartTag` | Étiquette d'une pièce sur la couleur de sa famille |

Règles :
- Une brique = un dossier (`index.ts` avec le default, `X.tsx`, `types.ts`). Pas d'import vers les composants métier (cycles).
- Ajouter une brique quand un motif revient au moins trois fois, pas avant.
- Ne pas modifier `src/laser/ui` (code copié de testBrick) : envelopper ou créer ici.
