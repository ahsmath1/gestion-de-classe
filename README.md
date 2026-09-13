# Gestion des Absences 2026/2027 — version 2.1 avec profils enseignants

## Lancer sous Windows

1. Décompresser le dossier.
2. Double-cliquer sur `start.bat`.
3. Chrome/Edge ouvre automatiquement `http://127.0.0.1:8000/index.html`.
4. Laisser la fenêtre noire ouverte pendant l'utilisation.
5. Pour arrêter le serveur : fermer la fenêtre noire.

Python 3 doit être installé. Le script cherche automatiquement `py` puis `python`.

## Pourquoi un serveur local ?

La PWA et le Service Worker nécessitent un contexte HTTP/HTTPS. `start.bat` fournit
un petit serveur local sans Internet. Toutes les données des élèves et des appels
restent dans IndexedDB du navigateur.

## Import des élèves

Version autonome : CSV/TXT. Format recommandé :

```text
Nom;Prénom
ALAOUI;Ahmed
BENNANI;Yassine
```

Pour un fichier Excel, choisir `Enregistrer sous > CSV UTF-8`, puis importer le CSV.

## Sauvegarde

Utiliser `Sauvegarde / Export > Exporter la sauvegarde JSON` régulièrement.
Le fichier JSON contient classes, élèves, emploi du temps, calendrier, appels,
sessions et paramètres.

## Installation sur téléphone

Cette version est d'abord prête à fonctionner sur Windows. Pour l'installer sur
un téléphone tout en conservant le mode hors ligne, il faudra ensuite la publier
sur une adresse HTTPS ou utiliser un serveur local du réseau. Ne pas simplement
ouvrir `index.html` par double-clic si l'on veut le Service Worker/PWA.

## Calendrier

Le début effectif obligatoire des cours est fixé au 7 septembre 2026 par le
Ministère marocain. Les dates religieuses grégoriennes pouvant dépendre de
l'observation lunaire sont signalées comme indicatives et restent modifiables.

## Utilisation par plusieurs enseignants

Le même lien GitHub Pages peut être partagé avec plusieurs enseignants.
Chaque appareil possède sa propre base IndexedDB locale : classes, élèves,
emploi du temps, appels et profil ne sont pas partagés entre les appareils.

Au premier lancement, l'application propose de renseigner le nom de l'enseignant.
Les classes initiales sont celles de la configuration de référence et peuvent
être supprimées/remplacées dans « Élèves → Gérer les Classes ». L'emploi du temps
est modifiable dans « Emploi du temps ».

Aucune donnée d'élève ou d'appel n'est envoyée à GitHub Pages par l'application.
GitHub Pages sert uniquement les fichiers statiques de l'application.


## Nouveau dans la version 3.0
- Module « Activités & comportement d'apprentissage ».
- Note de départ configurable (20/20 par défaut).
- Pénalités en un clic pour chaque élève.
- Catégories, budgets et actions entièrement configurables depuis l'application.
- Historique des pénalités et annulation individuelle.
- Nouvelle période avec archivage des anciennes pénalités.
- Données incluses dans les sauvegardes JSON.


## Version 3.5 — Mise à jour immédiate des classes

Correction : après l'ajout d'une classe, tous les sélecteurs de classe sont actualisés immédiatement sans recharger la page. La nouvelle classe est sélectionnée automatiquement dans les vues concernées. Les sélecteurs des élèves, activités, statistiques, historique, import et emploi du temps sont également synchronisés.


## Version 3.6 — Profil, nom de l'application et langues
- Nom/prénom de l'enseignant modifiable depuis le profil.
- Matière enseignée modifiable et affichée sur l'accueil.
- Nom de l'application par défaut : « Gestion de classe ».
- Choix de langue français / العربية, avec affichage RTL en arabe.
- La langue, le profil, la matière et le nom de l'application sont conservés dans les paramètres et inclus dans les sauvegardes.

## Version 3.8 — Nom de l'application fixe
- Le nom de l'application est définitivement « Gestion de classe ».
- Il n'est plus modifiable depuis le profil.
- Les anciennes valeurs éventuellement présentes dans une sauvegarde sont ignorées pour l'affichage.

## 🔄 Fusion sécurisée téléphone → PC (v3.10)

Dans **Sauvegarde & Exports**, utilisez **« Fusionner une sauvegarde »** lorsque vous avez fait l’appel sur un autre appareil.

- Les anciennes données du PC sont conservées.
- Les élèves sont reconnus par **classe + nom + prénom**, même si leurs IDs locaux sont différents.
- Les nouveaux appels sont ajoutés sans doublonner un même appel (date + élève + créneau).
- Les activités et historiques sont ajoutés sans réimporter deux fois le même événement.
- Les réglages du PC restent prioritaires.
- Une **sauvegarde de sécurité du PC est automatiquement téléchargée avant la fusion**.

⚠️ **Ne pas utiliser « Restaurer les données » pour synchroniser un téléphone avec un PC déjà utilisé** : la restauration remplace les données actuelles. Utilisez **« Fusionner avec les données actuelles »**.


## Version 4.0 — Gestion multi-années
- Année scolaire active sélectionnable depuis l'en-tête.
- Création d'une nouvelle année scolaire avec archivage automatique de l'année précédente.
- Possibilité de reprendre les classes, l'emploi du temps et les catégories/actions sans copier les élèves ni les historiques.
- Chaque année est archivée séparément dans IndexedDB et peut être réactivée sans mélanger ses données.
- Les sauvegardes JSON indiquent l'année scolaire concernée.
- La fusion téléphone → PC est refusée si les deux sauvegardes concernent des années différentes, afin d'éviter les mélanges.
- Le nom de l'application reste fixe : Gestion de classe.


## Version 4.7 — Appel terminé en un seul geste et ergonomie mobile

- Glissement d’un élève vers la gauche = A (absent), vers la droite = R (retard).
- Bouton « Tous présents » pour initialiser rapidement l’appel puis corriger uniquement les A/R.
- Glissement dans l’en-tête de l’appel pour passer au cours précédent/suivant sur iPhone.
- Mémorisation locale de la dernière classe utilisée.
- Indicateurs discrets « À faire / Fait » dans les cours du jour.
- Mode « Cours intensif » pour consacrer l’écran à la liste des élèves.
- 4 à 6 actions fréquentes personnalisables dans Activités & comportement.
- Actions de comportement de type « + Récompense » en plus des pénalités « − ».
- Le résumé de l’appel est affiché immédiatement après « APPEL TERMINÉ ».
- Tableau de bord enrichi : Aujourd’hui, À surveiller, Dernier appel et Prochain cours.


## Version 5.0 — Fiabilité et données
- Schéma IndexedDB 7 avec index `schoolYear` pour préparer les requêtes par année.
- Normalisation automatique des anciennes données vers l'année active, sans écraser une année déjà renseignée.
- Restaurations JSON et restaurations automatiques effectuées dans une transaction multi-stores : en cas d'échec, l'opération n'est pas validée partiellement.
- Sauvegarde locale de sécurité créée avant une restauration.
- Service Worker versionné en `gestion-classe-v5.0.0` avec nettoyage des anciens caches et stratégie réseau d'abord pour la navigation.
- Notifications discrètes (toast) pour les opérations importantes.
- Les actions fréquentes sont configurables de 2 à 6.
- Les données restent locales dans IndexedDB ; aucune synchronisation serveur n'est introduite.

### Mise à jour depuis v4.7
La mise à jour conserve la base IndexedDB existante. Le navigateur effectue automatiquement la migration du schéma lors du premier lancement de v5.0. Il est recommandé de faire une exportation JSON avant la première mise à jour majeure.
