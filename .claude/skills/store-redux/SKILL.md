---
name: store-redux
description: Organisation du store Redux Toolkit de l'app de découpe CNC (src/store) et façon d'y ajouter ou modifier de l'état. À utiliser quand l'utilisateur parle du « store », de « redux », d'un « slice », d'un « reducer », d'une « action », d'un « sélecteur », ou quand un état doit survivre à un changement d'onglet ou de vue.
---

# Store Redux

Tout l'état partagé de l'app vit dans `src/store/` (Redux Toolkit + react-redux). Un composant « conteneur » lit et écrit le store ; les composants feuilles restent pilotés par props.

## Organisation : un dossier par domaine

```
src/store/
  index.ts          # configureStore, createAppStore, types RootState / AppDispatch
  hooks.ts          # useAppDispatch, useAppSelector
  <domaine>/        # project, ui, models
    types.ts        # forme de l'état et des payloads (alias `type`)
    reducers.ts     # reducers : fonctions pures (state, action) => void (Immer)
    slice.ts        # createSlice : état initial + reducers ; exporte le reducer
    actions.ts      # actions exportées : celles du slice (ré-export) et les actions asynchrones (thunks)
    selectors.ts    # lecture de l'état : sélecteurs simples et mémoïsés (createSelector)
    persist.ts      # (si le domaine est sauvegardé) lecture / écriture localStorage
    index.ts        # barrel : ce que le reste de l'app a le droit d'importer
```

Un domaine = un thème (`project` : pièces, planches, réglages ; `ui` : onglet, sélections, zoom ; `models` : modèle 3D choisi, réglages, éclaté). Ne pas mélanger deux thèmes dans un slice.

## Règles

1. **Seulement des données sérialisables.** Pas de classe, de fonction, de `Set`/`Map`, d'instance three.js ni d'élément DOM dans l'état. Le viewer 3D (`src/models/viewer3d.ts`) reste hors store, piloté par l'état.
2. **L'état est la source, le reste est dérivé.** Les planches calculées (`autoSheets`, `boardSheets`, `entries`) ne sont jamais stockées : ce sont des sélecteurs mémoïsés. Un sélecteur ne renvoie pas de nouvel objet à chaque appel sans mémoïsation (sinon re-rendu à chaque action).
3. **Reducers purs et courts.** Les règles métier (arrondi des quantités, exemplaires en trop qui perdent leur position…) sont dans `reducers.ts`, testables sans React.
4. **Importer par le barrel du domaine** (`@/store/project`), pas par un fichier interne. Les composants utilisent `useAppSelector` / `useAppDispatch`.
5. **Sauvegarde.** Seul le projet est écrit dans localStorage (`cnc-projet-v1`, format inchangé), une fois, après un court délai et seulement si la tranche a changé. Un champ ajouté au projet doit être optionnel : les anciennes sauvegardes restent lisibles. Le choix du modèle 3D et ses réglages sont sauvegardés dans `cnc-modeles-v1`.
6. **Performance.** Les contrôles de développement `immutableCheck` et `serializableCheck` sont coupés sur la tranche `project` (trop de contours). Ne pas les rallumer sans mesurer. Un clic ne doit déclencher qu'un calcul.
7. **Local ou store ?** Un geste transitoire (glisser, plein écran, champ en cours de frappe, debounce) reste en `useState`. Ce qui doit survivre à un changement d'onglet, de vue ou de modèle va dans le store.

## Ajouter de l'état

1. Choisir le domaine ; ajouter le champ à `types.ts` (optionnel s'il est sauvegardé) et à l'état initial de `slice.ts`.
2. Écrire le reducer dans `reducers.ts`, l'enregistrer dans `slice.ts`, ré-exporter l'action dans `actions.ts`.
3. Écrire le sélecteur dans `selectors.ts` (mémoïsé s'il construit un objet ou un tableau).
4. Dans le composant conteneur : `useAppSelector(selector)` et `dispatch(action(...))`.
5. Ajouter un contrôle dans `scripts/check.mjs` (reducers purs : état avant -> état après, sérialisation de l'ancien format).
6. `npm run typecheck`, `npm run check` (0 ECHEC), `npm run build`.

## Pièges connus

- Le debounce d'un champ se fait dans le composant (état local), pas dans le reducer : le champ doit suivre la frappe tout de suite.
- Une valeur qui revient du store pendant des clics en attente ne doit pas faire reculer le nombre affiché (voir `NumField`).
- Les vues restent montées (masquées) hors de leur onglet ; leur état local survit donc, mais elles se re-rendent quand le store change.
