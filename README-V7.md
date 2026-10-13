# Gestion de classe — V7 complète (édition de compatibilité)

## Ce que contient cette archive

- `v7/` : version active avec l’ensemble des écrans et fonctions de l’application complète, basée sur le moteur éprouvé de la V6.0.1. Le nom/version et le cache hors ligne sont distincts. Les corrections XSS ciblées portent notamment sur les noms d’élèves à l’appel, les noms de classes rendus en listes/sélecteurs et les titres du calendrier.
- `v6/` : copie de référence de la V6.0.1, conservée intacte pour comparaison et retour arrière.
- `prototype-v7/` : prototype modulaire de diagnostic issu de l’étape précédente, destiné au développement et non à l’usage en classe.
- `start.bat` : lance la V7 complète sur Windows via un serveur local.

## Lancement sous Windows

1. Décompresser tout le ZIP dans un dossier neuf.
2. Lancer `start.bat` à la racine.
3. Le navigateur s’ouvre sur `http://127.0.0.1:8000/v7/`. Pour éviter les conflits de cache, fermer les anciennes pages de la V6 avant les essais.
4. Garder la V6 comme solution de secours jusqu’à validation de la V7 sur tes appareils.

## Déploiement sur GitHub Pages

Publier le contenu de `v7/` à l’emplacement destiné à la V7, en conservant les sous-dossiers `css/`, `js/`, `icons/`, ainsi que `manifest.json` et `service-worker.js`. Vérifier la portée du service worker et le chemin public avant de remplacer le site actuel. Ne pas placer les deux versions sous une portée de service worker qui pourrait intercepter les fichiers de l’autre version.

## Données et compatibilité

- La base IndexedDB et son schéma ne sont pas migrés : aucun changement de version IndexedDB n’est introduit dans cette édition de compatibilité.
- Les données restent locales à chaque appareil. Ce ZIP ne synchronise pas automatiquement le PC et l’iPhone.
- Avant le premier lancement, exporter une sauvegarde JSON depuis l’application actuelle et conserver une copie indépendante. Ne pas tester d’import/restauration sur la seule copie de tes données.

## Limites importantes

Cette archive est **fonctionnellement complète par conservation du moteur V6**, mais elle n’est pas encore une réécriture complète de toutes les fonctions en modules V7. Les corrections de sécurité sont ciblées et ne constituent pas une garantie d’absence de toutes les vulnérabilités XSS. La suppression de classe et d’autres cas de données orphelines nécessitent encore une correction dédiée. Les tests automatisés et essais réels Safari/iPhone/Windows doivent être exécutés avant de considérer cette édition comme validée pour les données réelles.
