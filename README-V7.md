# Gestion de classe — V7 modulaire

Cette archive contient uniquement l'application V7 organisée en modules ES JavaScript. Aucun dossier ni fichier source V6 n'est inclus.

## Architecture

- `js/core/AbsenceApp.js` : classe de session et état de l'application.
- `js/core/database.js` : accès IndexedDB.
- `js/modules/lifecycle-profile.js` : démarrage, année scolaire et profil.
- `js/modules/ui-navigation.js` : navigation, interface, modales et utilitaires visuels.
- `js/modules/dashboard-search.js` : tableau de bord, favoris et recherche globale.
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
