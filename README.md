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

## Données et synchronisation Supabase

Sans variables Supabase, l’application continue de fonctionner localement et conserve les données dans `localStorage` sous la clé `cutting-performance-app:v1`.

Avec Supabase, copie `.env.example` vers `.env.local`, puis renseigne uniquement l’URL du projet et sa clé publique/publishable. L’application active alors :

- la création de compte et la connexion par e-mail/mot de passe ;
- une importation guidée des données locales avec sauvegarde JSON côté serveur ;
- une synchronisation automatique après chaque modification ;
- un stockage relationnel séparé pour les objectifs, journées, aliments, activités, séances, exercices et séries ;
- des règles RLS qui limitent chaque ligne à son propriétaire authentifié.

La migration initiale se trouve dans `supabase/migrations`. Pour un nouveau projet lié :

```bash
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push
pnpm exec supabase gen types typescript --linked > src/domain/database.types.ts
```

Ne jamais ajouter une clé `service_role` aux variables Vite ou Netlify : elle contourne les règles RLS.

Les données de démonstration sont isolées dans `src/domain/seed.ts` ; les composants ne contiennent pas de valeurs métier figées.

La cartographie entre les huit mockups, les routes et les actions se trouve dans `docs/functional-mapping.md`.
