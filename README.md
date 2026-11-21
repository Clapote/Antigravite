# Antigravité - Application Personnelle de Gestion Locale (Windows)

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](package.json)
[![Plateforme](https://img.shields.io/badge/plateforme-Windows%2010%20%2F%2011-0078d7.svg)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-42%20suites%20(100%25)-success.svg)](tests/)

Bienvenue dans le projet **Antigravité**, une application de bureau open source moderne, sobre et respectueuse de votre autonomie, conçue spécifiquement pour fonctionner 100 % en local sur Windows (gestion des tâches récursives, projets, agenda, notes, focus, ambiances sonores et bilan quotidien bienveillant).

---

## 🚀 Démarrage rapide (1 clic)

Vous pouvez lancer immédiatement l'application de bureau :

1. Dans le dossier du projet, double-cliquez sur :  
   👉 **`Lancer_Antigravite.bat`**
2. L'application démarre dans sa fenêtre native Electron fluide et optimisée.
3. **Raccourci global Windows :** Utilisez **`Ctrl + Shift + A`** à tout moment pour masquer ou faire réapparaître l'application au premier plan.

---

## 🛠️ Principes Fondamentaux et Impératifs

1. **100% Local :** Vos données personnelles restent hébergées sur votre machine dans votre profil utilisateur Windows.
2. **Aucune réorganisation automatique :** Vos tâches et sous-tâches conservent scrupuleusement l'ordre défini manuellement.
3. **Chevauchements d'agenda toujours autorisés :** Les événements simultanés s'affichent côte à côte de manière fluide et lisible sans aucune collision ni erreur.
4. **Arborescence récursive illimitée :** Tâches, sous-tâches et sous-sous-tâches sans limite de profondeur.
5. **Distinction des trois notions temporelles :** Échéance impérative, date prévue de réalisation et créneau réservé dans l'agenda sont trois données strictement indépendantes.
6. **Indépendance de suppression :** Supprimer un créneau d'agenda n'affecte jamais la tâche associée.

---

## 🧭 Fonctionnalités (Version 1.3.0)

### 1. 🏠 Écran Accueil (Tableau de bord dynamique)
- Synthèse visuelle en temps réel des tâches du jour, échéances imminentes (72h) et projets actifs.
- Aperçu des créneaux de travail réservés pour la journée.
- Bouton d'ajout rapide global (`➕ Nouvelle tâche`).

### 2. 📋 Écran Tâches (Hiérarchie récursive & Planification fine)
- Sous-tâches imbriquées à profondeur arbitraire avec **bouton bascule unique « Tout replier / Tout déplier »**.
- Réorganisation manuelle via boutons fléchés `▲` / `▼` ou glisser-déposer.
- **Horaire précis de planification (`plannedTime`) :** Choix d'un horaire précis lors de la planification (par défaut 09:00).
- Rattachement facultatif à un projet avec badge coloré et exclusion intelligente des tâches des projets archivés.

### 3. 📁 Écran Projets (Archivage complet & Arborescence visuelle)
- Suivi visuel des projets avec jauge de progression automatique calculée sur l'arborescence des tâches.
- **Archivage et désarchivage complet :** Mettez de côté vos projets terminés en un clic, avec archivage récursif en cascade des sous-projets et masquage automatique des tâches associées sans suppression.
- **Arborescence en vue ligne :** Connecteurs graphiques fins et branches en L reliant clairement les projets parents à leurs sous-projets, avec bouton bascule replier/déplier universel.
- **Modale de consultation approfondie :** Clic sur un projet pour afficher la liste de ses sous-projets, ses tâches actives/terminées (cochables directement) et ses notes rattachées avec liens d'accès direct.

### 4. 📅 Écran Agenda (Jour / Semaine / Mois & Google Agenda)
- **Vues multiples :** Bascule instantanée entre vue **Jour**, vue **Semaine** et vue **Mois**.
- **Saut direct de date :** Sélecteur calendrier intégré pour rejoindre immédiatement n'importe quel jour ou mois sans faire défiler semaine par semaine.
- **Synchronisation bidirectionnelle Google Agenda :** Intégration complète avec gestion de la file d'attente hors-ligne et chiffrement sécurisé des jetons DPAPI.
- **Palette de couleurs :** Nuancier de 12 teintes prédéfinies harmonieuses et sélecteur de nuance sur mesure avec retour visuel immédiat.
- **Liaisons directes :** Création facultative de tâche lors de l'ajout d'un créneau sans doublon, et association directe à une note de réunion ou compte-rendu.

### 5. 📝 Écran Notes (Format enrichi & Markdown Universel)
- Éditeur WYSIWYG épuré avec mise en forme riche immédiate (titres, listes, cases à cocher `[ ]` / `[x]`, citations, blocs de code, surlignage, callouts et wikilinks universels).
- **Rangement par projet et dossiers :** Organisation par dossiers personnalisés et filtrage clair entre vos notes personnelles et vos notes classées par projet (y compris archivés).
- **Export polyvalent :** Exportez vos notes au format HTML mis en page ou texte brut pour les archiver ou les partager.

### 6. 🌌 Écran Constellation (Mind Map, Whiteboard & Gravitation Planétaire - v1.3.0)
- **Gravitation orbitale par projet :** En mode constellation rayonnante, les tâches, sous-tâches, notes et événements gravitent désormais en orbites planétaires harmonieuses directement autour de leur projet respectif.
- **Arbre décisionnel horizontal :** Vue d'ensemble structurée de gauche à droite reliant le noyau racine, tous les projets, les tâches récursives, les créneaux d'agenda et les notes sans chevauchement.
- **Constellation rayonnante :** Disposition orbitale aérienne avec orbes compacts et relaxation physique garantie sans collision.
- **Interactions fluides :** Clic gauche pour ouvrir la fiche détaillée ou l'éditeur, menu contextuel complet au clic droit (sur un élément ou sur l'espace vide du canevas pour créer instantanément une ressource), pan infini et zoom à la molette orienté vers le curseur.
- **Filtrage stable et synchronisation :** Les filtres par type masquent les nœuds sans bousculer la disposition spatiale, et toute modification apportée aux tâches, projets, agenda ou notes s'actualise en temps réel.
- **Raccourcis clavier :** Touches `+` / `-` pour le zoom, `0` / `F` pour cadrer tout, `1` pour l'arbre et `2` pour le mode rayonnant.

### 7. 💾 Sauvegardes Locales & Robustesse
- Instantanés complets horodatés en 1 clic et sauvegardes automatiques quotidiennes au premier lancement.
- Historique complet, restauration sécurisée en 1 clic, export et import d'archives JSON indépendantes.

### 8. ⚙️ Paramètres, Ergonomie, Esthétique & Système Windows
- **Contrôles de fenêtre unifiés (v1.3.0) :** Boutons Réduire, Grand écran et Fermer intégrés nativement au bandeau supérieur (`top-bar`), garantissant une transparence absolue et zéro démarcation de couleur quel que soit le thème ou le fond actif.
- **Personnalisation esthétique sur-mesure (v1.3.0) :**
  - **Teinte chromatique libre :** Sélecteur couleur / code HEX libre pour l'accentuation de l'interface avec calcul dynamique des reflets, et système d'enregistrement / réutilisation de vos teintes favorites partout dans l'application.
  - **Studio de création de fonds d'écran génératifs :** Générateur CSS temps réel d'ambiances nébuleuses (Mesh), dégradés directionnels, auras radiales, dots matrix, grilles blueprint et rayures fines avec préréglages, harmonie aléatoire 🎲, prévisualisation interactive et galerie de sauvegarde locale.
- **Apparence :** Thèmes Sombre / OLED / Clair, choix de la densité, de l'échelle typographique, arrondis, translucidité glassmorphism et fonds d'écran d'ambiance (dont Anthracite).
- **Premier lancement épuré :** Seuls 7 onglets essentiels activés par défaut, widgets secondaires désactivés au départ.
- **Barre latérale rétractable :** Bouton ergonomique `◀` / `▶` pour agrandir l'espace de travail.
- **Système Windows & Démarrage garanti (v1.3.0) :** Raccourci natif infaillible dans le dossier Démarrage Windows (`shell:startup`) couplé à la clé de registre `HKCU\Run`, réduction en zone de notification (System Tray), icône multi-résolution dédiée (`assets/icon.ico`) dans la barre des tâches et gestion de l'AppUserModelId.
- **Mises à jour automatiques :** Module intégré vérifiant les publications GitHub Releases.

---

## 🧪 Tests Automatisés

Le projet intègre une suite complète de **42 suites de tests unitaires et d'intégration** (100% de réussite) validant l'intégrité des données, la persistance, la récursivité, les vues d'agenda, l'interface utilisateur, le débriefing, le module Constellation, les contrôles de fenêtre, l'esthétique personnalisée et les mécanismes de synchronisation et de démarrage.

Pour exécuter la suite de tests :
```powershell
npm test
# ou double-cliquez sur Lancer_Tests.bat
```

---

## 📦 Commandes Développeur

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm start

# Exécution des tests automatisés
npm test

# Génération de l'installateur Windows autonome (.exe NSIS)
npm run dist
```

---

## 📂 Structure du Répertoire

```text
Antigravité/
├── Lancer_Antigravite.bat     # Lanceur 1-clic pour Windows
├── Lancer_Tests.bat          # Exécution de la suite de tests 1-clic
├── main.js                   # Processus principal Electron & Raccourcis Windows
├── preload.js                # Pont de communication sécurisé (IPC Context Isolation)
├── index.html                # Interface utilisateur unifiée
├── package.json              # Métadonnées, scripts npm et configuration electron-builder
├── README.md                 # Documentation du projet
├── assets/                   # Logos et icônes multi-résolution (.ico, .png)
├── css/
│   └── styles.css            # Styles modernes, thèmes et animations
├── js/
│   ├── app.js                # Contrôleur principal et navigation
│   ├── storage.js            # Persistance locale et intégrité JSON
│   ├── tasks.js              # Moteur des tâches récursives et horaires
│   ├── projects.js           # Moteur des projets et interconnexions
│   ├── agenda.js             # Moteur d'agenda (Jour/Semaine/Mois, chevauchements)
│   ├── notes.js              # Éditeur Markdown et filtrage par projet
│   ├── backups.js            # Gestionnaire des instantanés locaux
│   ├── settings.js           # Paramètres d'apparence et mise à jour
│   ├── google-sync.js        # Gestionnaire de synchronisation Google
│   └── notifications.js      # Notifications Windows et alertes
├── services/
│   ├── google-auth-service.js     # Authentification OAuth sécurisée (DPAPI)
│   ├── google-calendar-service.js # API Google Calendar & File hors-ligne
│   └── update-service.js          # Service de mises à jour GitHub Releases
├── data/                     # Schémas et jeux de données initiaux JSON
└── tests/                    # 39 suites de tests unitaires et d'intégration
```

---

## 🔐 Signature de Code & Confidentialité (Code Signing Policy)

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- **Binaires signés :** Les versions Windows officielles (`Antigravite.exe` et `Antigravite.Setup.<version>.exe`) sont compilées de manière transparente via GitHub Actions (`.github/workflows/release.yml`) et signées par SignPath Foundation.
- **Politique détaillée & Confidentialité :** Consultez [CODE_SIGNING.md](CODE_SIGNING.md). Antigravité est une application **100 % locale** sans télémétrie ni collecte de données personnelles.

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.

