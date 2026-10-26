# Antigravité - Application Personnelle de Gestion Locale (Windows)

Bienvenue dans le projet **Antigravité**, votre application de gestion personnelle moderne, sobre et respectueuse de votre autonomie, conçue spécifiquement pour fonctionner en local sur votre PC Windows.

---

## 🚀 Démarrage rapide (1 clic)

Vous êtes débutant en programmation ? Rien de plus simple pour lancer votre application :

1. Dans ce dossier (`c:\Users\Lucas Peutot\Documents\Antigravité`), double-cliquez sur le fichier :
   👉 **`Lancer_Antigravite.bat`**
2. L'application s'ouvre immédiatement dans une fenêtre de bureau moderne et sobre (mode *Desktop App* autonome, sans barre d'adresse ni onglets).
3. **Alternative directe :** Vous pouvez également double-cliquer directement sur `index.html` pour l'ouvrir dans n'importe quel navigateur moderne.

---

## 🧭 Fonctionnalités de la Première Phase

### 1. 🏠 Écran Accueil (Tableau de bord)
- Vue synthétique immédiate :
  - Nombre de tâches prévues pour aujourd'hui.
  - Échéances impératives dans les 72 prochaines heures.
  - Créneaux horaires réservés dans l'agenda pour la journée.
  - Projets actifs.
- Listes rapides des tâches et des créneaux du jour.
- Accès au bouton d'ajout rapide global (`➕ Nouvelle tâche`).

### 2. 📋 Écran Tâches (Gestion hiérarchique sans limite)
- **Sous-tâches et sous-sous-tâches illimitées :** Chaque tâche peut contenir des sous-tâches à n'importe quelle profondeur (arborescence dépliable/repliable).
- **Aucune réorganisation automatique :** Vos tâches conservent scrupuleusement l'ordre dans lequel vous les organisez. Aucun tri forcé intempestif.
- **Réorganisation manuelle :** Boutons `▲ Monter` et `▼ Descendre` sur chaque tâche.
- **Distinction stricte des dates :**
  - **Échéance (Deadline) :** Date et heure limites impératives (alerte rouge si dépassée).
  - **Date prévue (Planned Date) :** Le jour où vous comptez vous y atteler.
  - **Créneau de travail :** Plage horaire précise réservée dans l'agenda.
- **Priorités visuelles :** Urgente (🔥), Élevée (⚡), Normale, Basse, Aucune.
- **Rattachement à un projet :** Facultatif, avec badge coloré.

### 3. 📁 Écran Projets
- Suivi visuel des projets personnels.
- Code couleur personnalisé par projet.
- **Taux d'avancement automatique :** Calcul du pourcentage de complétion en fonction de l'ensemble des tâches et sous-tâches associées.
- Filtre rapide pour afficher les tâches d'un projet en un clic.

### 4. 📅 Écran Agenda (Vue hebdomadaire & Google Agenda)
- Grille de 7 jours (Lundi à Dimanche) avec repères horaires de 07h00 à 23h00.
- Navigation fluide : `◀ Semaine précédente`, `Aujourd'hui`, `Semaine suivante ▶`.
- **Intégration bidirectionnelle Google Agenda :** Synchronisation complète avec votre compte Google (création, modification, suppression, fuseaux horaires, journée entière, lieu/visio Meet).
- **File d'attente hors-ligne :** Création, modification et suppression possibles sans connexion Internet avec synchronisation différée automatique.
- **Règle d'or des chevauchements :** Les événements simultanés sont **toujours autorisés**. Un algorithme de placement divise intelligemment la largeur en colonnes virtuelles pour que tous les créneaux superposés soient lisibles côte à côte sans aucun message d'erreur.
- **Règle d'or de suppression :** Supprimer un créneau d'agenda ne supprime **jamais** la tâche associée.
- 👉 **[Guide pas à pas de configuration Google Agenda](docs/GUIDE_CONNEXION_GOOGLE_AGENDA.md)**

### 5. 📝 Écran Notes (Compatible Obsidian)
- Gestionnaire de notes locales au format Markdown.
- Double panneau : éditeur de texte Markdown à gauche, prévisualisation stylisée en temps réel à droite (titres, listes à puces, cases à cocher `[ ]` / `[x]`, blocs de code).
- Bouton **`📥 Exporter .md (Obsidian)`** : télécharge la note sous forme de fichier `.md` directement déplaçable dans votre coffre Obsidian (`Vault`).

### 6. 💾 Système de Sauvegardes Locales
- **100% local :** Toutes les données restent stockées sur votre machine dans le dossier de profil et le dossier `data/`.
- Bouton permanent **`💾 Sauvegarder`** dans la barre latérale pour créer un instantané complet horodaté en 1 clic.
- Écran dédié avec historique des sauvegardes (date, heure, nombre d'éléments, taille).
- Bouton **`🔄 Restaurer`** pour revenir à un état antérieur en toute sécurité.
- Bouton **`📥 Exporter archive JSON`** pour exporter un fichier autonome sur votre disque ou clé USB.
- Sélecteur de fichier pour importer une sauvegarde externe.

---

## 🧪 Tests Automatisés et Vérifications

Pour vérifier la validité de l'ensemble du projet et s'assurer qu'aucune règle impérative n'est enfreinte, une suite complète de tests est fournie.

Pour lancer les tests :
👉 Double-cliquez sur **`Lancer_Tests.bat`**

La suite vérifie automatiquement 18 points de contrôle :
1. Présence et validité JSON de `tasks.json`.
2. Présence et validité JSON de `projects.json`.
3. Présence et validité JSON de `events.json`.
4. Présence et validité JSON de `notes.json`.
5. Présence et validité JSON de `settings.json`.
6. Gestion récursive des tâches à 4+ niveaux de profondeur.
7. Maintien de l'ordre manuel sans réorganisation automatique.
8. Distinction entre échéance (deadline) et date prévue.
9. Indépendance du créneau de travail dans l'agenda.
10. Sécurité de suppression : un événement supprimé laisse la tâche intacte.
11. Présence et affichage sans conflit d'événements simultanés qui se chevauchent.
12. Création effective d'un instantané dans `backups/`.
13. Intégrité et restauration de la sauvegarde locale.
14. Authentification Google OAuth 2.0 sécurisée (chiffrement DPAPI, masquage des secrets).
15. Affichage fidèle et fusion des événements Google Agenda sans doublon (Phase 3).
16. Création et modification bidirectionnelles sans boucle infinie (Phase 4).
17. Suppressions, détection des conflits (ETag) et file d'attente hors-ligne (Phase 5).
18. Compatibilité totale avec les sauvegardes physiques et non-fuite de secrets (Phase 6).

---

## 📂 Structure des Fichiers du Projet

```text
Antigravité/
├── Lancer_Antigravite.bat    # Lanceur 1-clic en mode application bureau
├── Lancer_Tests.bat         # Lanceur 1-clic de la suite de tests
├── index.html               # Interface utilisateur principale
├── README.md                # Documentation complète du projet
├── css/
│   └── styles.css           # Thème moderne, sobre, ergonomique (clair/sombre)
├── js/
│   ├── app.js               # Contrôleur général, navigation et tableau de bord
│   ├── storage.js           # Gestionnaire de persistance locale
│   ├── tasks.js             # Gestionnaire de tâches récursives et ordre manuel
│   ├── projects.js          # Gestionnaire des projets et progression
│   ├── agenda.js            # Agenda hebdomadaire et gestion des chevauchements
│   ├── notes.js             # Éditeur Markdown prêt pour Obsidian
│   └── backups.js           # Moteur d'instantanés et de restauration
├── data/                    # Fichiers de données initiaux au format JSON
│   ├── tasks.json
│   ├── projects.json
│   ├── events.json
│   ├── notes.json
│   └── settings.json
├── backups/                 # Dossier des instantanés de sauvegarde
└── tests/
    └── run_tests.ps1        # Script PowerShell des tests unitaires
```

---

## 🔮 Évolutions Futures Prévues (Phase 2)

L'architecture actuelle a été spécifiquement conçue pour accueillir les prochaines intégrations sans refonte :
1. **Google Agenda :** Les événements possèdent déjà les champs `source: "local" | "google"` et `externalId`. L'intégration utilisera l'API Google Agenda pour synchroniser les créneaux.
2. **Obsidian :** Les notes respectent la syntaxe Markdown standard. La future phase permettra de pointer directement vers le dossier de votre coffre Obsidian pour une synchronisation automatique bidirectionnelle.
3. **Notifications Windows :** Le système de toasts actuel sera relié aux notifications natives du centre de notifications Windows.
