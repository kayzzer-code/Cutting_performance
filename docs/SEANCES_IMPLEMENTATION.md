# Module Séances — livraison du 3 septembre 2026

## Résultat

Le module est intégré à l’application existante, sans backend, compte utilisateur, publication ni push GitHub.

Routes : `/seances`, `/seances/nouvelle`, `/seances/:templateId`, `/seances/:templateId/modifier`, `/seances/planning`, `/seances/journal` et `/seances/statistiques`. L’ancienne adresse `/musculation` redirige vers le même journal en conservant les paramètres de date.

## Fonctionnalités branchées

- Bibliothèque : modèles réels, recherche insensible aux accents et à la casse, filtres par type explicite, duplication indépendante, archives et restauration.
- Éditeur : formulaire vierge, catalogue et création de variantes, prescriptions structurées, notes, ordre par glisser-déposer ou boutons, validation et avertissement avant abandon du brouillon.
- Portée : modifier un modèle n’altère pas les copies déjà planifiées. L’option supplémentaire de mise à jour des futures occurrences non démarrées présente un aperçu et demande confirmation. Aucune séance active ou terminée n’est réécrite.
- Planning : semaines passées ou futures, sélection tactile, listes et glisser-déposer, échange/remplacement explicite, répétition d’une semaine, aperçu avant/après, validation ou annulation. Les jours passés sont verrouillés jusqu’à autorisation explicite.
- Journal : démarrage idempotent, séries initialement vides, charge/répétitions/RIR, séries de travail ou d’échauffement, validation individuelle, nombre de séries variable, suppression confirmée et annulable, reprise après rechargement.
- Chronométrage : durée active calculée depuis des timestamps, pause/reprise et minuteur de repos à échéance persistée, ajout de 30 secondes et repos automatique facultatif.
- Remplacement : limité à l’occurrence par défaut ; les séries originales déjà validées restent sur leur exercice original. La modification du modèle global nécessite un second accord.
- Fin de séance : confirmation des séances partielles, aucune validation inventée ; correction d’une séance terminée sans effacement ni redémarrage silencieux.
- Statistiques : exercice, matériel et période dans l’URL ; séances terminées seulement ; séries de travail validées ; meilleure série selon la charge puis les répétitions ; répétitions à charge fixe sur des dates distinctes ; volumes, historique daté et adhérence au planning. Aucun graphe ou record fictif pour un compte vide.
- Mobile : un exercice actif, navigation précédent/suivant, grands contrôles, panneau inférieur, dates de planning sélectionnables et bouton de fin accessible au-dessus de la navigation.

## Calculs : ce qui reste identique

Le moteur `calculateDay` n’a pas été remplacé. Le type explicite d’une séance sélectionne la base et les pas de `settings.dayTypePlans`.

La cible finale conserve les estimations marche/course/cardio, la soustraction des pas de course pour éviter le double comptage, le taux de restitution, les plafonds, l’arrondi et les garde-fous existants. Aucun supplément de musculation n’est ajouté à la base et aucun tonnage n’est converti en calories.

Une modification de planning conserve les activités, repas, calories réellement consommées, pesées et pas saisis. Les différences manuelles de base calorique et de pas sont conservées par défaut comme offsets par rapport au plan de type précédent. L’option de remplacement de ces personnalisations est explicite et soumise à l’aperçu.

La répartition de marge et la distinction « non renseigné » / zéro restent conservées. La marge hebdomadaire utilise toujours uniquement les journées dont la nutrition est renseignée.

Changer les paramètres du profil ne réécrit pas les prescriptions des occurrences : les types et copies déjà planifiés sont conservés et seuls leurs plans caloriques sont adaptés.

## Stockage et migration

- Clé conservée : `cutting-performance-app:v1`.
- Nouveau schéma : `schemaVersion: 3`.
- Avant conversion d’un ancien état, sauvegarde brute sous `cutting-performance-app:v1:backup-before-v3`. La première sauvegarde n’est pas écrasée.
- Validation du JSON, des journaux, des modèles, des activités, des séries, du catalogue et des copies planifiées. Migration idempotente.
- Les prescriptions textuelles sont conservées ; seules les plages reconnues sont structurées. Une prescription non reconnue n’est pas remplacée par une prescription inventée.
- Les exercices historiques inconnus restent des snapshots identifiables. Les conventions de charge anciennes non renseignées sont marquées inconnues : charges et répétitions conservées, volume indisponible plutôt qu’inventé.
- En cas d’erreur de migration, les données sources ne sont pas effacées : écran de récupération avec export brut et possibilité de réessayer.
- En cas de quota dépassé, les modifications restent en mémoire avec alerte, export et tentative de sauvegarde. Le statut de sauvegarde n’est confirmé qu’après une écriture réussie.
- Les événements de stockage actualisent les autres onglets. Vérification de la version enregistrée avant écriture et contrôle de la version des modèles/brouillons pour éviter l’écrasement silencieux d’une modification récente. Ce mécanisme local n’est ni une synchronisation cloud ni un système de collaboration multi-utilisateur.

## Fichiers principaux

- `src/domain/types.ts`, `training.ts`, `storage.ts`, `journal.ts` : types, opérations pures, snapshots, statistiques et migration.
- `src/state/AppContext.tsx` : mutations existantes conservées, transactions persistées et état d’erreur/conflit.
- `src/pages/SessionsLibraryPage.tsx`, `SessionEditorPage.tsx`, `SessionsPlanningPage.tsx`, `SessionJournalPage.tsx`, `SessionsStatsPage.tsx` : écrans du module.
- `src/components/sessions/SessionsUI.tsx` : cadre commun, dialogues accessibles, catalogue, protection des brouillons et aperçu calorique.
- `src/styles/sessions.css` : styles responsives et identité conservée.
- `src/App.tsx`, `src/main.tsx`, `src/components/Layout.tsx`, `src/components/ui.tsx`, `src/pages/TodayPage.tsx` : routes, navigation, date et intégration aux composants existants.
- L’ancien `TrainingPage.tsx` a été remplacé par le nouveau journal ; il n’existe pas de second historique concurrent.

Composants réutilisés : marque d’origine, header de date, tooltips, cartes, formulaires, boutons et barres de progression. Icônes Lucide ; graphiques Recharts ; typographie et couleurs existantes.

## Références et validation visuelle

Les sept références du dossier `outputs/mockups_seances_2026-09-03` ont été inspectées. Aucun PNG n’est utilisé comme fond pour simuler l’interface.

Captures reproductibles : `tests/sessions-visual.spec.ts`, sorties dans `test-results/sessions-visual/`.

Les captures utilisent un navigateur de test isolé. Les quelques performances permettant de vérifier les graphiques et la séance en cours sont des **fixtures de test**, jamais injectées dans le journal de l’utilisateur ni dans le code de production.

Écarts visuels assumés : contenu et ordre des modèles issus des données réelles, noms plus longs, champs historiques vides, contrôles supplémentaires pour l’archivage, les confirmations et les conventions de charge. L’éditeur et le journal mobile peuvent être plus hauts que le PNG pour conserver les formulaires accessibles. Les captures pleine page montrent les barres fixes à la position du viewport. Il ne s’agit pas d’une promesse de correspondance pixel parfaite.

## Vérifications

- `pnpm build` : réussi, incluant le contrôle TypeScript et la compilation Vite.
- `pnpm lint` : réussi, sans avertissement sur le code livré.
- `pnpm test` : 23 tests unitaires réussis (calculs existants, nouveaux modèles, migration, snapshots, séries et statistiques).
- `pnpm test:e2e --workers=2` : 47 tests réussis, 3 exclusions intentionnelles liées aux projets desktop/mobile. Aucun échec.
- Contrôles responsives à 360, 390, 1024 et 1440 px ; absence de débordement horizontal global. Contrôle mobile supplémentaire à 360 × 640 px : saisie décimale, bouton de fin dans le viewport et suppression accessible sur une cible de 44 × 44 px.
- Tests de navigation clavier, Escape, retour du focus, brouillon conservé à la fermeture du catalogue, quota, JSON corrompu, modifications concurrentes, remplacement local, historique, chronomètre, annulation de suppression et édition globale sans modifier la séance active.
- Les anciens parcours activités, nutrition, date, semaine, paramètres et remise à zéro passent également. Le test historique « recommencer » a été adapté au comportement demandé : correction explicite sans effacement, avec confirmation des séances partielles.

Les sept captures finales sont conservées aussi hors du dossier temporaire des tests : `../outputs/verification_seances_2026-09-03/` depuis la racine du projet applicatif.

## Limites explicites

- Données locales au navigateur et à son origine : pas de partage automatique ordinateur/téléphone, ni de sauvegarde cloud.
- L’installation PWA, le lancement complet hors ligne, Safari sur un appareil physique et les lecteurs d’écran réels ne sont pas certifiés par cette livraison. Le serveur de développement est local, pas publié sur Internet.
- Les formulaires d’exercice conservent leur brouillon lors de la fermeture/réouverture du panneau dans la session de navigation. Les brouillons d’édition de modèles non enregistrés déclenchent un avertissement avant navigation/rechargement ; les séries du journal sont, elles, persistées à chaque modification.
- Les mesures caloriques restent des estimations selon le moteur existant, pas une mesure de dépense réelle ni une validation médicale de l’entraînement.
