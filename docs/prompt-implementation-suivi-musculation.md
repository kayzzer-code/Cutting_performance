# Prompt prêt à copier dans Codex — suivi de musculation visuel sur téléphone et ordinateur

$pixel-functional-from-png

Tu dois analyser puis implémenter dans l’application existante **Cutting Performance** le nouveau parcours visuel et fonctionnel de suivi de musculation représenté par les deux mockups fournis :

- `mockups/seance-suivi-desktop.png` : référence principale pour la vue ordinateur ;
- `mockups/seance-suivi-mobile.png` : référence principale pour la vue téléphone.

Les noms, dates, charges, répétitions, durées, tonnages, pourcentages et nombres de séries visibles dans les mockups sont des **données fictives de démonstration**. Ils ne doivent jamais être recopiés en dur dans l’interface. Le rendu doit être alimenté par les vraies données du profil, du planning, du catalogue d’exercices et du journal de l’utilisateur.

## 1. Contexte

### Application concernée

L’application est un tracker sportif et nutritionnel React/Vite/TypeScript nommé **Cutting Performance**. Elle possède déjà une identité visuelle, un stockage local versionné, un journal par date, un planning sportif, des objectifs caloriques calculés et un premier module Séances.

Avant toute modification :

1. inspecte la structure réelle du dépôt, les instructions locales éventuelles et le gestionnaire de paquets déjà utilisé ;
2. lis les types, le stockage, les migrations, les calculs et les tests existants avant d’étendre le modèle ;
3. réutilise les composants, icônes, tokens CSS, fonctions de date, formatages français et mécanismes de persistance existants ;
4. ne recrée pas l’application et ne remplace pas son architecture par une nouvelle architecture générique ;
5. conserve toutes les données déjà enregistrées dans le navigateur grâce à une migration rétrocompatible.

### Routes existantes à faire évoluer

Le module Séances existe déjà. Conserve ses routes et fais-les évoluer :

- `/seances` : modèles de séances et accès à la bibliothèque ;
- `/seances/nouvelle` : création d’un modèle ;
- `/seances/:templateId` : détail d’un modèle ;
- `/seances/:templateId/modifier` : modification d’un modèle ;
- `/seances/planning` : répartition des séances sur le calendrier ;
- `/seances/journal?date=YYYY-MM-DD` : séance réelle du jour ou d’une date historique ;
- `/seances/statistiques` : statistiques et historique.

Tu peux ajouter des sous-routes cohérentes, par exemple `/seances/exercices`, seulement si cela clarifie vraiment la navigation. Ne casse aucun lien existant et conserve l’alias historique `/musculation`.

### Objectif utilisateur

L’utilisateur doit pouvoir :

- choisir ou créer une séance Upper, Lower, Épaules-bras ou personnalisée ;
- organiser ses modèles sur la semaine ;
- démarrer la séance prévue pour la date active ;
- enregistrer charge, répétitions, RIR et type de série extrêmement rapidement ;
- retrouver sa performance précédente sur le même exercice et le même matériel ;
- valider, dévalider, ajouter, retirer ou corriger une série sans perdre l’historique ;
- remplacer un exercice uniquement pour la séance en cours ou dans le modèle global ;
- consulter le nombre de séries, les répétitions, la durée et le tonnage de la séance ;
- consulter le volume hebdomadaire par groupe musculaire ;
- analyser sa progression par exercice sans comparer artificiellement des machines ou conventions de charge différentes ;
- utiliser l’intégralité du parcours confortablement à une main sur téléphone et avec davantage de densité sur ordinateur.

## 2. Mapping fonctionnel des mockups

### 2.1 Structure générale et identité visuelle

Respecte fidèlement le design system actuel et les mockups :

- fond général gris bleuté très clair ;
- cartes blanches aux angles arrondis, bordure bleu-gris fine et ombre douce ;
- texte principal bleu marine ;
- turquoise pour les validations, états actifs et résultats positifs ;
- bleu royal pour les actions secondaires, liens et focus ;
- orange pour les deltoïdes, avertissements ou informations à surveiller ;
- icônes provenant de la bibliothèque déjà utilisée dans le projet, sans créer de nouveaux faux SVG ;
- typographie, logo **CUTTING PERFORMANCE**, espacements, rayons et ombres identiques au reste de l’application ;
- transitions courtes sur hover, focus, press et ouverture des cartes ;
- aucun thème violet, aucun glassmorphism, aucune photographie de sportif et aucune esthétique de dashboard sombre dans la zone de contenu.

Le scanner alimentaire présent dans l’en-tête mobile doit être conservé. Le travail demandé concerne le contenu Séances, pas la suppression ou la régression des fonctions Nutrition.

### 2.2 Navigation du module Séances

Conserve une navigation claire entre :

- **Mes séances** ;
- **Planning** ;
- **Journal du jour** ;
- **Statistiques** ;
- **Exercices** ou **Bibliothèque**, si une route dédiée est nécessaire.

Sur ordinateur, cette navigation peut rester sous forme d’onglets secondaires dans la zone Séances, en complément de la barre latérale principale. Sur téléphone, elle doit tenir sans débordement horizontal : onglets défilables accessibles, menu compact ou raccourcis sous forme de cartes. La navigation principale inférieure de l’application doit rester visible et l’onglet **Séances** doit rester actif sur toutes les sous-routes du module.

### 2.3 En-tête de la séance en cours

Dans `/seances/journal`, affiche dynamiquement :

- le nom réel de la séance ou du modèle planifié ;
- son type de journée et sa description ;
- la date actuellement sélectionnée dans le journal global ;
- le statut : prévue, en cours, en pause, terminée ou historique en correction ;
- la durée active calculée avec les données réelles de la séance ;
- le nombre d’exercices ;
- la progression réelle `séries validées / séries prévues` ;
- une barre de progression ;
- l’action **Démarrer la séance**, **Reprendre**, **Pause** ou **Terminer la séance** selon l’état réel.

Le démarrage doit rester idempotent : plusieurs clics ne doivent jamais créer plusieurs occurrences pour la même journée. Une séance terminée doit être protégée en lecture seule tant que l’utilisateur n’a pas explicitement activé la correction de cette occurrence.

### 2.4 Carte d’exercice

Chaque carte doit être construite à partir de l’occurrence réelle de la séance et afficher :

- ordre de l’exercice dans la séance ;
- nom de l’exercice ;
- icône ou pictogramme cohérent avec son matériel ou son mouvement ;
- groupe musculaire principal ;
- éventuels groupes secondaires sous forme de tags plus discrets ;
- matériel ;
- prescription du modèle : séries, plage de répétitions, RIR cible et temps de repos ;
- note éventuelle du modèle ;
- meilleure performance comparable de la séance précédente ;
- état d’avancement, par exemple `3 / 4 séries` ;
- état de remplacement ponctuel ou global, lorsqu’il existe.

La « dernière performance » doit provenir de la dernière séance terminée antérieure à la date active, pour le **même identifiant d’exercice, le même matériel et la même convention de charge**. Ne mélange jamais deux variantes simplement parce que leurs noms se ressemblent.

Sur ordinateur :

- toutes les cartes peuvent être empilées ;
- la carte active est ouverte et les autres peuvent être repliées ;
- un clic sur l’en-tête d’un exercice le rend actif ;
- les actions Ajouter une série, Remplacer, Déplacer et ouvrir les statistiques doivent être explicites.

Sur téléphone :

- une seule carte d’exercice doit être dominante et ouverte ;
- les autres exercices sont présentés sous forme d’accordéons compacts ou d’un bloc « Exercice suivant » ;
- les boutons Précédent et Exercice suivant changent réellement l’exercice actif ;
- le passage à l’exercice suivant ne doit pas supprimer les valeurs non encore validées.

### 2.5 Saisie d’une série

Chaque ligne représente une vraie série et contient :

- son numéro ;
- son type : échauffement ou travail ;
- charge en kilogrammes quand la convention l’autorise ;
- répétitions ;
- RIR facultatif, entre 0 et 10 ;
- tonnage calculé pour cette série, lorsqu’il est valide ;
- bouton de validation ou de dévalidation ;
- action de suppression.

Ergonomie téléphone obligatoire :

- champs tactiles de 48 px minimum ;
- clavier numérique ou décimal approprié ;
- aucune table plus large que l’écran ;
- valeurs lisibles sans zoom ;
- ligne active clairement encadrée en bleu ;
- gros bouton turquoise **Valider la série** immédiatement sous la ligne active ;
- possibilité de valider soit avec ce bouton, soit avec le bouton de la ligne ;
- après validation, sélectionner intelligemment la prochaine série incomplète ;
- préremplir la nouvelle série avec la charge et éventuellement le RIR de la série précédente, tout en laissant les répétitions modifiables ;
- ne jamais valider silencieusement une valeur invalide.

Ergonomie ordinateur :

- navigation clavier logique entre Charge, Répétitions et RIR ;
- touche Entrée sur une ligne valide pour la valider ;
- focus visible ;
- hover discret sur les lignes et les actions ;
- aucune action destructive placée trop près de la validation principale.

Lorsqu’une série validée est supprimée, demande confirmation ou propose une annulation immédiate. Une série d’échauffement ne doit pas compter dans les statistiques de séries de travail, le tonnage principal ni le volume musculaire effectif.

### 2.6 Minuteur de repos

Après validation d’une série de travail :

- lance automatiquement le temps de repos prescrit si le repos automatique est activé ;
- affiche le décompte au format `mm:ss` ;
- propose Pause/Reprendre, `+30 s`, Relancer et Arrêter ;
- conserve correctement le temps restant lors d’une navigation dans l’application ou d’un rafraîchissement ;
- ne crée pas plusieurs intervalles concurrents ;
- respecte `prefers-reduced-motion` ;
- ne dépend pas d’un onglet gardé actif en permanence : calcule le temps depuis des timestamps persistés.

Sur téléphone, le minuteur doit rester proche de la zone de validation. Il ne doit jamais masquer les champs ni la navigation inférieure.

### 2.7 Résumé « Séance en direct »

Le panneau du mockup doit afficher uniquement des valeurs dérivées des séries validées :

- séries de travail validées ;
- répétitions totales ;
- tonnage valide ;
- durée active ;
- progression par rapport au nombre de séries prévues.

Sur ordinateur, place ce panneau dans une colonne latérale sticky comme sur le mockup. Sur téléphone, transforme-le en carte repliable située après l’exercice actif. Une carte repliée doit au minimum conserver les quatre KPI compacts.

### 2.8 Volume musculaire de la séance

Ajoute un bloc très visuel **Volume par muscle** ou **Volume musculaire** contenant :

- groupes musculaires réellement sollicités par les séries de travail validées ;
- barres horizontales colorées ;
- nombre de séries directes ;
- nombre de séries effectives pondérées ;
- option ou tooltip expliquant le calcul ;
- clic sur un muscle pour ouvrir son détail et la contribution de chaque exercice.

Le graphique doit afficher zéro ou un état vide si aucune série n’est validée. Il ne doit pas utiliser les chiffres du mockup.

### 2.9 Statistiques hebdomadaires

Fais évoluer `/seances/statistiques` avec des vues réellement filtrables :

1. **Par exercice** : conserver et améliorer les comparaisons existantes à matériel et convention identiques ;
2. **Par muscle** : séries directes, séries effectives et tonnage attribué par groupe musculaire ;
3. **Hebdomadaire** : totaux par semaine et évolution par rapport à la semaine précédente ;
4. **Historique** : liste des occurrences avec lien vers la séance réelle correspondante.

Filtres minimum : période, exercice, matériel, séance, groupe musculaire et type de série. Tous les filtres doivent modifier réellement les données et, si l’architecture actuelle le permet, être synchronisés dans l’URL afin de conserver la vue au rafraîchissement.

Affiche notamment :

- nombre de séances terminées ;
- adhérence au planning ;
- séries de travail ;
- répétitions ;
- tonnage comparable ;
- RIR moyen ;
- meilleure série ;
- progression des répétitions à charge fixe ;
- tonnage par séance et par semaine ;
- volume hebdomadaire par groupe musculaire ;
- comparaison avec la semaine précédente.

Les graphiques doivent présenter un état vide explicite lorsqu’il n’existe pas assez de points. Ne fabrique aucun point de données pour rendre un graphique plus joli.

## 3. Bibliothèque d’exercices

### Catalogue initial

Fournis un catalogue initial conséquent, en français, couvrant les exercices usuels de musculation sans doublons artificiels. Il doit inclure des mouvements courants pour :

- pectoraux ;
- grand dorsal et haut du dos ;
- trapèzes ;
- deltoïde antérieur, latéral et postérieur ;
- biceps, brachial et avant-bras ;
- triceps ;
- quadriceps ;
- ischio-jambiers ;
- fessiers ;
- adducteurs et abducteurs ;
- mollets ;
- abdominaux et gainage.

Matériels à couvrir : barre, haltères, poulie, machine guidée, Smith machine, élastique, poids du corps, charge additionnelle et assistance.

Chaque définition doit posséder au minimum :

- identifiant stable ;
- nom français ;
- éventuels alias de recherche ;
- famille de mouvement ;
- matériel ;
- convention de charge ;
- muscle principal ;
- muscles secondaires avec coefficients ;
- caractère bilatéral ou unilatéral ;
- temps de repos par défaut ;
- statut actif ou archivé.

Le catalogue initial est une donnée de référence légitime, mais les performances fictives visibles dans les mockups ne le sont pas. Ne crée jamais de séances réelles ou de séries factices dans le journal de l’utilisateur.

### Recherche et filtres

La bibliothèque doit permettre :

- recherche tolérante aux accents et à la casse ;
- filtres par muscle, matériel et famille de mouvement ;
- affichage des muscles principal et secondaires ;
- favoris ou exercices récemment utilisés ;
- création d’un exercice personnalisé ;
- modification et archivage d’un exercice personnalisé ;
- conservation des exercices archivés dans les anciennes séances ;
- prévention des doublons évidents avec un avertissement non bloquant.

### Création d’un exercice personnalisé

Le formulaire doit demander : nom, matériel, convention de charge, muscle principal, muscles secondaires, coefficients de contribution, unilatéral/bilatéral et repos par défaut. Valide les bornes et empêche un coefficient négatif ou non numérique.

## 4. Modèle de données et règles de calcul

### 4.1 Ne pas casser l’existant

Pars des types et fonctions déjà présents. Étends-les sans renommer arbitrairement toutes les propriétés. Les anciennes séances, même sans métadonnées musculaires, doivent rester lisibles. Ajoute une migration du schéma de stockage actuel vers la nouvelle version. La migration doit être idempotente et testée.

Conserve le principe de snapshot : lorsqu’une séance est planifiée ou démarrée, elle doit conserver une copie suffisante du modèle et des métadonnées nécessaires. Une modification future du catalogue ou du modèle ne doit pas réécrire rétroactivement l’historique.

### 4.2 Entités à compléter

Adapte les noms aux conventions existantes du code, mais couvre conceptuellement :

- `ExerciseDefinition` : définition globale de l’exercice et contributions musculaires ;
- `TrainingTemplate` : modèle réutilisable ;
- `TemplateExercise` : exercice prescrit dans un modèle ;
- `PlannedSession` : occurrence planifiée pour une date ;
- `TrainingSession` : séance réellement démarrée ;
- `ExerciseLog` : exercice réel, remplacement compris ;
- `SetLog` : série réelle ;
- éventuelles préférences utilisateur pour coefficients musculaires, repos automatique et unité de charge.

Pour les contributions musculaires, utilise une structure explicite plutôt qu’une simple chaîne libre, par exemple une liste `{ muscleId, role, coefficient }`. Prévois au minimum les rôles principal et secondaire.

### 4.3 Séries de travail

Une série compte dans les statistiques seulement si :

- elle est explicitement validée ;
- elle respecte les bornes de charge, répétitions et RIR ;
- elle n’est pas une série d’échauffement ;
- l’exercice n’est pas une ligne originale rendue inactive par un remplacement.

Les séries non validées restent des brouillons et ne comptent pas. Les séries partielles peuvent être conservées quand l’utilisateur termine la séance, mais doivent rester exclues des totaux.

### 4.4 Tonnage

Définis le tonnage d’une série comparable comme :

`tonnageSérie = chargeSaisie × répétitions`

Puis :

- tonnage exercice = somme des séries de travail validées de cet exercice ;
- tonnage séance = somme des tonnages d’exercices disponibles ;
- tonnage semaine = somme des séances terminées de la semaine.

Respecte strictement les conventions de charge existantes. En particulier, ne double pas automatiquement la valeur « par haltère » si l’application actuelle définit cette convention comme une charge saisie non doublée. Ne change pas rétroactivement la signification des données historiques.

Pour poids du corps, assistance ou convention inconnue, n’invente pas de tonnage. Affiche `—` ou « non comparable » jusqu’à ce qu’une convention explicite et testée permette un calcul fiable. Les piles de machines et poulies peuvent être suivies dans le temps pour le même exercice et le même matériel, mais ne doivent pas être présentées comme scientifiquement comparables à une barre ou à une autre machine.

### 4.5 Séries directes et séries effectives par muscle

Utilise deux métriques distinctes :

- **séries directes** : une série complète pour le muscle principal ;
- **séries effectives pondérées** : série multipliée par le coefficient de contribution de chaque muscle.

Valeurs initiales raisonnables :

- muscle principal : coefficient `1` ;
- muscle secondaire : coefficient `0,5` ;
- stabilisateur éventuel : coefficient `0` par défaut, sauf choix explicite.

Ces coefficients sont des conventions de suivi, pas une mesure physiologique exacte. Explique-le dans un tooltip. Permets leur adaptation dans la définition d’un exercice personnalisé. Stocke un snapshot des contributions sur l’exercice réel afin que les statistiques historiques ne changent pas après une édition du catalogue.

Pour chaque série de travail validée :

`sériesEffectivesMuscle = coefficientMuscle`

Pour chaque période :

`volumeMuscle = somme des coefficients de toutes les séries valides de la période`

Si tu affiches un tonnage attribué à un muscle :

`tonnageAttribuéMuscle = tonnageSérie × coefficientMuscle`

Nomme clairement cette métrique **tonnage attribué** ou **volume de charge attribué**. Ajoute un tooltip indiquant qu’elle est utile pour suivre une tendance interne, mais qu’elle ne rend pas la tension mécanique réelle et ne permet pas de comparer directement des exercices ou machines différents.

### 4.6 Comparaisons et records

Une performance est comparable uniquement si elle concerne le même exercice, le même matériel et la même convention de charge. Conserve les statistiques existantes à charge fixe. Tu peux ajouter un meilleur nombre de répétitions à une charge donnée et un record de charge, mais n’ajoute pas d’estimation de 1RM globale si elle n’est pas clairement séparée et expliquée.

### 4.7 Semaines et dates

Utilise la semaine et le fuseau déjà employés par l’application. Toutes les statistiques doivent être calculées à partir de la date du journal sélectionnée, pas d’un `new Date()` dispersé dans les composants. Les journées futures restent planifiables mais non saisissables. Les séances historiques terminées sont en lecture seule avant activation explicite du mode correction.

## 5. Parcours et interactions

### Démarrer une séance

Depuis Mes séances, Planning, Aujourd’hui ou Journal :

1. déterminer le modèle réellement prévu pour la date ;
2. afficher sa prescription sans fausses performances ;
3. demander un clic explicite pour démarrer ;
4. créer une seule occurrence réelle ;
5. démarrer le chronomètre ;
6. laisser tous les champs réels vides, avec éventuellement des suggestions visuelles issues de la dernière séance, sans les enregistrer tant que l’utilisateur ne les valide pas.

### Valider une série

1. vérifier charge, répétitions et RIR ;
2. sauvegarder immédiatement la série ;
3. actualiser KPI, tonnage et volume musculaire sans rechargement ;
4. démarrer le repos automatique si activé ;
5. déplacer le focus vers la prochaine série ;
6. afficher un retour visuel bref, sans popup bloquante.

### Remplacer un exercice

Propose clairement :

- **Cette séance uniquement** : conserve le modèle et l’historique, remplace seulement l’occurrence courante ;
- **Cette séance et le modèle** : demande confirmation, modifie le modèle pour l’avenir sans réécrire les séances déjà démarrées ou terminées.

Le sélecteur de remplacement doit privilégier le même muscle principal et permettre de filtrer par matériel. Les séries déjà validées sur l’exercice original restent conservées et clairement identifiées.

### Terminer une séance

- si toutes les séries sont validées, terminer directement après confirmation légère ;
- si la séance est partielle, afficher le nombre de séries validées et préciser que les brouillons seront conservés mais exclus des statistiques ;
- figer la durée ;
- enregistrer ou mettre à jour l’activité de musculation du journal avec la source `journal` ;
- recalculer la cible calorique via les fonctions existantes ;
- ne pas ajouter une deuxième dépense de musculation si une activité équivalente existe déjà pour cette occurrence.

### Corrections

Une correction historique modifie seulement l’occurrence choisie, sauf action globale explicitement confirmée. Toute suppression importante doit être confirmée ou annulable.

## 6. Intégration avec le reste de Cutting Performance

### Planning et calories

Réutilise la source de vérité existante pour :

- type de journée Upper, Lower, Épaules-bras ou Repos ;
- calories de base selon le type de journée ;
- pas cibles ;
- activité de musculation réellement effectuée ;
- cible calorique ajustée.

Ne duplique pas le calcul calorique dans les composants Séances. Appelle les fonctions métier existantes. Un remplacement d’exercice ne change pas arbitrairement les calories. Une séance imprévue un jour de repos doit continuer à suivre le parcours déjà prévu dans Activités et le journal.

### Persistance locale

Conserve le stockage local actuel. N’ajoute ni authentification ni base de données distante dans cette tâche. Toutes les nouvelles données doivent survivre au rafraîchissement, aux changements de route et à la fermeture du navigateur sur le même appareil.

Préserve le mécanisme existant de révision ou de fusion multi-onglets. Deux onglets ne doivent pas écraser silencieusement leurs modifications récentes.

### Données d’exemple

Les valeurs suivantes visibles dans les mockups sont uniquement visuelles : `Upper A`, `32,5 kg`, `12 reps`, `18 séries`, `7 840 kg`, `58 min`, `+8 %`, ainsi que toutes les dates et répartitions musculaires affichées. Utilise les vraies valeurs calculées. Si l’utilisateur n’a encore rien saisi, affiche un état vide utile.

## 7. États, accessibilité et responsive

### États obligatoires

Prévois :

- aucune séance prévue ;
- modèle vide ;
- séance prévue non démarrée ;
- séance en cours ;
- séance en pause ;
- séance partiellement terminée ;
- séance terminée en lecture seule ;
- correction historique ;
- aucune performance précédente ;
- tonnage indisponible à cause de la convention ;
- catalogue vide ou recherche sans résultat ;
- erreur de validation ;
- erreur de sauvegarde locale ;
- minuteur arrivé à zéro.

### Accessibilité

- utiliser des éléments natifs lorsque possible ;
- associer chaque champ à un label explicite incluant numéro de série et exercice ;
- boutons d’icône avec `aria-label` ;
- `aria-pressed` pour validation, pause et états basculables ;
- modales avec titre accessible, focus initial, piégeage du focus, fermeture par Échap et restauration du focus ;
- couleurs accompagnées de texte ou icônes, jamais comme seule information ;
- focus visible ;
- contraste suffisant ;
- zones tactiles de 44 à 48 px minimum ;
- respect de `prefers-reduced-motion`.

### Responsive

Valide au minimum les largeurs 360, 390, 412, 768, 1024, 1440 et 1536 px.

Sur téléphone :

- zéro défilement horizontal ;
- aucun chevauchement avec la navigation fixe ;
- carte active, bouton Valider et minuteur visibles sans gymnastique ;
- zones numériques lisibles avec de grandes valeurs ;
- colonne latérale transformée en cartes repliables ;
- action Terminer accessible sans masquer les champs.

Sur ordinateur :

- contenu principal large ;
- liste d’exercices à gauche ;
- statistiques en direct à droite ;
- en-têtes alignés ;
- largeur des colonnes stable avec de grandes charges et de grands tonnages ;
- hover utile sur boutons, lignes, filtres et cartes cliquables.

## 8. Méthode d’implémentation

1. Faire un audit rapide du module Séances existant et lister ce qui peut être conservé.
2. Étendre les types et ajouter une migration rétrocompatible avant de modifier les pages.
3. Centraliser les calculs purs de séries, tonnage, contributions musculaires et agrégats hebdomadaires dans le domaine, jamais dans le JSX.
4. Ajouter ou enrichir le catalogue d’exercices.
5. Adapter le journal de séance aux mockups desktop et mobile.
6. Ajouter les KPI en direct et les volumes musculaires.
7. Enrichir les statistiques par muscle et par semaine.
8. Brancher tous les formulaires sur la vraie persistance.
9. Vérifier la connexion au planning et aux calories sans double comptage.
10. Ajouter les tests unitaires et les scénarios navigateur.
11. Faire une comparaison visuelle avec chaque mockup aux dimensions correspondantes et corriger les écarts importants.

Ne t’arrête pas à une page statique. Tous les boutons, champs, filtres, minuteurs, accordéons, modales et graphiques visibles doivent être reliés à un comportement réel ou retirés s’ils n’ont aucune fonction légitime.

## 9. Tests obligatoires

### Tests unitaires

Teste au minimum :

- validation d’une série ;
- exclusion des échauffements ;
- tonnage d’une série, d’un exercice, d’une séance et d’une semaine ;
- résultat indisponible pour poids du corps, assistance ou convention inconnue ;
- absence de doublage arbitraire pour la convention par haltère existante ;
- séries directes et séries effectives par muscle ;
- tonnage attribué par muscle ;
- agrégats hebdomadaires ;
- comparaison même exercice + même matériel + même convention ;
- snapshot des contributions musculaires ;
- migration d’un ancien état ;
- démarrage idempotent ;
- remplacement ponctuel et global ;
- conservation d’une séance partielle.

### Tests fonctionnels navigateur

Teste sur ordinateur et téléphone :

- créer ou modifier un modèle ;
- choisir un exercice depuis le catalogue avec filtres ;
- créer un exercice personnalisé ;
- planifier une séance ;
- démarrer la séance de la bonne date ;
- saisir et valider plusieurs séries ;
- démarrage et pause du minuteur ;
- ajout et suppression annulable d’une série ;
- remplacement ponctuel ;
- fin de séance complète et partielle ;
- persistance après rechargement ;
- historique en lecture seule puis correction autorisée ;
- mise à jour des KPI et volumes musculaires ;
- filtres statistiques actifs ;
- absence de débordement à 360 px ;
- navigation et focus clavier ;
- erreur de stockage sans faux message de succès.

### Vérification visuelle

Capture et inspecte au minimum :

- journal actif ordinateur, proche de `seance-suivi-desktop.png` ;
- journal actif téléphone, proche de `seance-suivi-mobile.png` ;
- très grand nom d’exercice ;
- charge et tonnage à quatre ou cinq chiffres ;
- séance avec beaucoup d’exercices ;
- état vide ;
- modale de remplacement ;
- statistiques musculaires sur téléphone.

## 10. Critères d’acceptation

- [ ] Le rendu desktop reprend fidèlement la hiérarchie, les cartes, les couleurs et la colonne de statistiques du mockup ordinateur.
- [ ] Le rendu mobile reprend fidèlement la carte active, les gros champs, la validation rapide et le minuteur du mockup téléphone.
- [ ] Aucune donnée fictive du mockup n’est codée en dur dans le journal.
- [ ] La bibliothèque couvre les principaux muscles, matériels et mouvements et accepte les exercices personnalisés.
- [ ] Chaque série peut être saisie, validée, dévalidée, ajoutée, retirée et corrigée.
- [ ] La validation actualise immédiatement les répétitions, séries, tonnage et volumes musculaires.
- [ ] Les séries d’échauffement et brouillons sont exclues des agrégats.
- [ ] Les conventions de charge sont respectées et les tonnages non fiables restent indisponibles.
- [ ] Les séries directes et effectives par muscle sont distinctes et expliquées.
- [ ] Les statistiques hebdomadaires proviennent uniquement des vraies séances enregistrées.
- [ ] Les comparaisons par exercice ne mélangent ni matériel ni convention.
- [ ] Le remplacement ponctuel ne modifie pas le modèle ; le remplacement global est confirmé et ne réécrit pas l’historique.
- [ ] Le minuteur résiste à la navigation et au rafraîchissement.
- [ ] Le planning et les calories continuent d’utiliser les calculs existants sans double comptage.
- [ ] Les anciennes données locales sont migrées sans perte.
- [ ] Tous les formulaires persistent réellement leurs données.
- [ ] Les filtres modifient réellement les graphiques et tableaux.
- [ ] L’application ne déborde pas horizontalement sur 360, 390 ou 412 px.
- [ ] Les interactions clavier, focus, labels et modales sont accessibles.
- [ ] Les routes, le scanner nutritionnel, les activités, les dates et les tests existants ne régressent pas.
- [ ] Le lint, la compilation TypeScript, les tests unitaires, le build et les tests navigateur sont tous réussis.
- [ ] Toute différence visuelle nécessaire à cause de données dynamiques ou d’une contrainte d’accessibilité est documentée dans le compte rendu final.

À la fin, fournis un compte rendu concis comprenant : fichiers modifiés, évolution du schéma et migration, formules retenues, tests exécutés, résultats, limites connues et captures de validation. N’effectue aucun push GitHub ni déploiement Netlify sans demande explicite.
