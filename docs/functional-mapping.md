# Cartographie fonctionnelle des mockups

| Référence | Route | Données dynamiques | Actions réelles | États couverts |
|---|---|---|---|---|
| `01_onboarding_objectif.png` | `/onboarding/objectif` | profil, objectif, expérience, calories, pas | parcours 4 étapes, sauvegarde et sortie | validation native, récapitulatif |
| `02_tableau_de_bord.png` | `/aujourdhui` | journal du jour, calcul v2026.1, planning | navigation vers activité/nutrition/séance | cible, marge, repos ou séance |
| `03_ajout_activites.png` | `/activites` | pas hors course, course, vélo et cardio MET | ajout ou remplacement, aperçu instantané | vide, confirmation, recalcul sans double comptage |
| `04_saisie_nutrition.png` | `/nutrition` | calories, repas, marge semaine | saisie totale, ajout et modification d’un repas | sous/sur cible, confirmation |
| `05_bilan_hebdomadaire.png` | `/semaine` | 7 journaux, cibles calculées | sélection et application confirmée d’une stratégie | jour manquant, marge positive/négative |
| `06_progression_ajustements.png` | `/progression` | pesées, moyenne 7 j, calories | ajout pesée, confirmation ajustement | données insuffisantes, tendance, suggestion |
| `07_journal_musculation.png` | `/musculation` | planning, modèles, séries | démarrer, éditer, cocher, terminer | planifiée, en cours, terminée, repos |
| `08_parametres_calculs.png` | `/parametres` | profil et coefficients | édition, aperçu, réinitialisation confirmée | confirmation, zone sensible |

Les valeurs de démonstration vivent dans `src/domain/seed.ts`. Aucun composant ne fige les poids, calories, pas, marges ou résultats des mockups. La persistance passe par un dépôt local versionné dans `AppContext`, remplaçable par une API sans modifier le moteur de calcul.
