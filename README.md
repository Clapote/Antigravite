# Antigravité - Application Personnelle de Gestion Locale (Windows)

[![Version](https://img.shields.io/badge/version-1.2.5-blue.svg)](package.json)
[![Plateforme](https://img.shields.io/badge/plateforme-Windows%2010%20%2F%2011-0078d7.svg)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-39%20suites%20(100%25)-success.svg)](tests/)

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

## 🧭 Fonctionnalités (Version 1.1.2)

### 1. 🏠 Écran Accueil (Tableau de bord dynamique)
- Synthèse visuelle en temps réel des tâches du jour, échéances imminentes (72h) et projets actifs.
- Aperçu des créneaux de travail réservés pour la journée.
- Bouton d'ajout rapide global (`➕ Nouvelle tâche`).

### 2. 📋 Écran Tâches (Hiérarchie récursive & Planification fine)
- Sous-tâches imbriquées à profondeur arbitraire (dépliage/repliage complet ou ciblé).
- Réorganisation manuelle via boutons fléchés `▲` / `▼` ou glisser-déposer.
- **Horaire précis de planification (`plannedTime`) :** Choix d'un horaire précis lors de la planification (par défaut 09:00).
- Rattachement facultatif à un projet avec badge coloré.

### 3. 📁 Écran Projets (Interconnexion totale)
- Suivi visuel des projets avec jauge de progression automatique calculée sur l'arborescence des tâches.
- **Modale de consultation approfondie :** Clic sur un projet pour afficher la liste de ses tâches actives/terminées (cochables directement) et ses notes rattachées avec liens d'accès direct.

### 4. 📅 Écran Agenda (Jour / Semaine / Mois & Google Agenda)
- **Vues multiples :** Bascule instantanée entre vue **Jour**, vue **Semaine** et vue **Mois**.
- **Saut direct de date :** Sélecteur calendrier intégré pour rejoindre immédiatement n'importe quel jour ou mois sans faire défiler semaine par semaine.
- **Synchronisation bidirectionnelle Google Agenda :** Intégration complète avec gestion de la file d'attente hors-ligne et chiffrement sécurisé des jetons DPAPI.
- **Palette de couleurs :** Nuancier de 12 teintes prédéfinies harmonieuses et sélecteur de nuance sur mesure avec retour visuel immédiat.
- **Liaisons directes :** Création facultative de tâche lors de l'ajout d'un créneau sans doublon, et association directe à une note de réunion ou compte-rendu.

### 5. 📝 Écran Notes (Compatible Obsidian)
- Éditeur Markdown double volet avec prévisualisation stylisée en temps réel (titres, listes, cases à cocher `[ ]` / `[x]`, citations, blocs de code).
- **Rangement par projet :** Filtrage clair entre vos notes personnelles et vos notes classées par projet.
- **Export direct Obsidian :** Bouton `📥 Exporter .md (Obsidian)` pour intégrer vos fichiers dans votre coffre Obsidian (`Vault`).

### 6. 💾 Sauvegardes Locales & Robustesse
- Instantanés complets horodatés en 1 clic et sauvegardes automatiques quotidiennes au premier lancement.
- Historique complet, restauration sécurisée en 1 clic, export et import d'archives JSON indépendantes.

### 7. ⚙️ Paramètres, Ergonomie & Système Windows
- **Apparence :** Thèmes Sombre / Clair, sélection de couleurs d'accentuation, choix de la densité, de l'échelle typographique et fond d'écran d'ambiance.
- **Barre latérale rétractable :** Bouton unique ergonomique `◀` / `▶` pour agrandir l'espace de travail.
- **Système Windows :** Réduction en zone de notification (System Tray), icône multi-résolution dédiée (`assets/icon.ico`) dans la barre des tâches et gestion de l'AppUserModelId.
- **Mises à jour automatiques :** Module intégré vérifiant les publications GitHub Releases.

---

## 🧪 Tests Automatisés

Le projet intègre une suite complète de **39 suites de tests unitaires et d'intégration** (100% de réussite) validant l'intégrité des données, la persistance, la récursivité, les vues d'agenda, l'interface utilisateur, le débriefing et les mécanismes de synchronisation et de mise à jour.

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

