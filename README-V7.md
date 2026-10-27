# Gestion de classe — V7 modulaire

Cette archive contient uniquement l'application V7 organisée en modules ES JavaScript. Aucun dossier ni fichier source V6 n'est inclus.

## Architecture

- `js/core/AbsenceApp.js` : classe de session et état de l'application.
- `js/core/database.js` : accès IndexedDB.
- `js/modules/lifecycle-profile.js` : démarrage, année scolaire et profil.
- `js/modules/ui-navigation.js` : navigation, interface, modales et utilitaires visuels.
- `js/modules/dashboard-search.js` : tableau de bord et recherche globale (favoris supprimés).
- `js/modules/attendance-schedule.js` : emploi du temps, cours et appels.
- `js/modules/students-classes.js` : classes, élèves, fiches et données de suivi.
- `js/modules/pedagogical-followup.js` : pratiques, comportements et rapports.
- `js/modules/calendar-journal.js` : calendrier, événements et journal de classe.
- `js/modules/activities.js` : catégories, actions, notes et pénalités d'activités.
- `js/modules/statistics-history.js` : statistiques et historique.
- `js/modules/data-backup.js` : sauvegardes, restauration, fusion et export/import.
- `js/extensions/` : extensions ordonnées (appel, initialisation, réglages d'activités et action collective).
- `tests/` : vérifications de syntaxe et de présence des méthodes.

Les 157 méthodes de la classe d'origine sont réparties entre les modules métier. L'ordre des extensions est conservé pour respecter les surcharges qui dépendent les unes des autres.

## Lancer sous Windows

1. Décompresser le ZIP dans un nouveau dossier.
2. Lancer `start.bat`.
3. L'application s'ouvre sur `http://127.0.0.1:8000/`.
4. Pour fermer le serveur, revenir à la fenêtre noire et appuyer sur `Ctrl+C`.

Le lancement via serveur local est nécessaire pour les modules ES et le service worker. Éviter d'ouvrir `index.html` directement en `file://`.

## Déploiement GitHub Pages

Publier le contenu de ce dossier à la racine du chemin public prévu pour la V7, sans renommer les sous-dossiers. Vérifier l'URL publique, la portée du service worker et le mode hors ligne avant de remplacer le site actuellement utilisé.

## Données et compatibilité

- La base reste `AbsenceAppDB`, version IndexedDB 9, avec les mêmes magasins de données. Aucun changement de schéma n'est requis pour ce découpage modulaire.
- Les données IndexedDB restent propres à chaque navigateur/appareil. Cette version ne synchronise pas automatiquement le PC et l'iPhone.
- Avant le premier lancement, exporter une sauvegarde JSON depuis l'application actuelle et en conserver une copie indépendante.
- Ne pas tester une restauration ou un effacement sur les seules données réelles.

## Vérifications et limites

Les tests fournis vérifient la syntaxe ES modules, le chargement de l'entrée V7 et la présence des méthodes métier et de l'action collective. Ils ne remplacent pas les essais fonctionnels complets dans un navigateur, sur Windows et Safari/iPhone. Les règles métier sont migrées dans les modules en conservant leur implémentation existante afin de réduire le risque d'une réécriture simultanée du comportement et de l'architecture. Les vulnérabilités XSS, la suppression/archivage des classes et les scénarios de sauvegarde doivent faire l'objet d'une validation de sécurité séparée avant usage avec les données réelles.


### Modification de cette édition
- Le bloc « Favoris » des classes a été supprimé du tableau de bord.
- Les étoiles et commandes de favoris ont été retirées de la recherche globale.
- Les méthodes, l’état et le chargement des favoris ont été supprimés ; la recherche et la navigation par classe restent disponibles.


### Correctif V7.0.1 — retour visuel des activités
- Après l'enregistrement d'une pénalité ou d'une récompense, un message confirme l'élève, l'action, les points appliqués et la note recalculée.
- Le bouton concerné est temporairement surligné en vert ; pendant l'enregistrement, il reçoit un indicateur visuel.
- Les doubles clics sur la même action sont ignorés pendant son enregistrement. Les limites atteintes et les erreurs produisent également un message visible.
- Le cache du service worker a été versionné pour faciliter la mise à jour des fichiers sur le site.
- Vérifications exécutées : syntaxe des modules, test de démarrage/présence des méthodes et intégrité ZIP. Les essais complets dans un navigateur réel restent à effectuer.


## V7.1 — Progression pédagogique

- Ajout d'une rubrique « Progression pédagogique » accessible depuis l'accueil et « Mes cours du jour ».
- Programmations 2AC et 3AC 2026/2027 intégrées à partir des deux PDF fournis, organisées par période, leçon et tâche/activité.
- Le professeur choisit manuellement la tâche et son statut : À faire, En cours, Terminée ou À reprendre.
- Le bilan de maîtrise des élèves est facultatif et distinct de l'état de réalisation de la tâche.
- Chaque validation crée une nouvelle entrée d'historique ; une reprise ne supprime pas les séances précédentes.
- Les données sont conservées dans IndexedDB, dans le magasin `settings`, et suivent le mécanisme de sauvegarde JSON existant.
- Le statut « Terminée » et la tâche 1 de 2AC/Période 1 sont préselectionnés comme exemple d'interface, mais rien n'est enregistré tant que le professeur ne clique pas sur « Enregistrer cette séance ».

### Limites de validation

Les contrôles automatisés vérifient la syntaxe des modules et la présence des méthodes. Ils ne remplacent pas un test navigateur complet sur PC et Safari/iPhone, ni une validation manuelle de chaque ligne extraite des PDF. Avant de remplacer la version en service, tester la navigation, l'enregistrement, la sauvegarde/restauration et le mode hors ligne sur une copie des données.
