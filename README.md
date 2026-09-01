# CUT Performance

Application responsive de suivi de sèche : activité, cible calorique ajustée, nutrition, marge hebdomadaire, poids et journal de musculation hypertrophie.

## Démarrer

```bash
pnpm install
pnpm dev
```

Ouvrir ensuite `http://localhost:5173/aujourdhui` (ou le port indiqué par Vite).

## Vérifications

```bash
pnpm test
pnpm build
pnpm test:e2e
```

Les tests E2E utilisent l’URL définie dans `playwright.config.ts`. Si Vite démarre sur un autre port, il faut y adapter `baseURL`.

## Logique métier

- Les pas saisis représentent le total de la montre, course incluse.
- Les pas de course sont estimés avec la cadence configurée puis retranchés avant le calcul de la marche.
- La course est estimée par `distance × poids × coefficient`.
- Un cardio sans pas utilise la dépense nette `(MET − 1) × poids × durée`.
- La différence entre activité réelle et planifiée est réintégrée au taux configuré, plafonnée puis arrondie.
- La base calorique et les pas cibles peuvent être personnalisés jour par jour depuis le planning.
- Les jours sans nutrition ne sont jamais assimilés à zéro calorie.
- La moyenne de poids sur 7 jours exige au moins 5 pesées. Toute suggestion calorique demande une confirmation.

Le cas de référence Lower (3 200 kcal, 15 000 pas cibles, 29 000 pas totaux, 17 km en 96 min à 90 kg) aboutit à 4 350 kcal avec les coefficients fournis.

## Données

Cette version est un prototype local mono-utilisateur. Les données sont persistées dans `localStorage` sous la clé `cutting-performance-app:v1`. Les données de démonstration sont isolées dans `src/domain/seed.ts` ; les composants ne contiennent pas de valeurs métier figées.

La cartographie entre les huit mockups, les routes et les actions se trouve dans `docs/functional-mapping.md`.
