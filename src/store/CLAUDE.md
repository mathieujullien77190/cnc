# src/store/

L'état de l'app, Redux Toolkit. Règles complètes : skill `store-redux`.

| Chemin | Rôle |
|---|---|
| `index.ts` | `store`, `createAppStore`, `persistStore` (écriture groupée dans localStorage), `RootState`, `AppDispatch` |
| `hooks.ts` | `useAppDispatch`, `useAppSelector` |
| `project/` | Pièces, réglages de planche, cases de gravure et « fait », planches perso ; sélecteurs mémoïsés des planches (`selectAutoSheets`, `selectBoardSheets`, `selectEntries`, `useSheets`) ; thunks d'import ; sauvegarde `cnc-projet-v1` |
| `ui/` | Onglet, bilans d'import, pièce choisie (planche et liste), zoom des aperçus |
| `models/` | Modèle choisi, ses actions, éclaté, planches cachées, mesure ; sauvegarde `cnc-modeles-v1` |

Chaque domaine : `types.ts`, `reducers.ts` (fonctions pures), `slice.ts`, `actions.ts`, `selectors.ts`, `persist.ts` si sauvegardé, `index.ts` (barrel). Importer par `@/store/project`, `@/store/ui`, `@/store/models`.

Règles :
- Seulement des données sérialisables ; les planches calculées ne sont jamais stockées (sélecteurs).
- Le format de sauvegarde du projet ne change pas sans migration : un champ nouveau est optionnel.
- Les contrôles de développement `immutableCheck` / `serializableCheck` sont coupés sur `project` (trop de contours) : ne pas les rallumer sans mesurer.
- Un geste transitoire (glisser, champ en cours de frappe, debounce) reste en `useState` dans le composant.
