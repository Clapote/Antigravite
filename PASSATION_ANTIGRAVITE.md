# DOSSIER DE PASSATION TECHNIQUE - PROJET ANTIGRAVITÉ

**Destinataire :** Assistant IA / Développeur reprenant le projet  
**Date de passation :** 25 octobre 2026  
**Application :** Antigravité (Version 1.0.0)  
**Environnement cible :** Windows 11 (x64)  

---

## 1. Vision et principes directeurs du projet

**Antigravité** est une application personnelle de productivité locale conçue pour centraliser :
1. Un **gestionnaire de tâches récursives** (arborescence sans limite de niveau).
2. Un **agenda hebdomadaire** fluide et sans barres de défilement parasites.
3. Un **gestionnaire de projets** avec suivi de progression en temps réel.
4. Un **carnet de notes personnelles** interconnecté à l'agenda.
5. Une **synchronisation bidirectionnelle avec Google Agenda**.

### ⚠️ Règles fondamentales d'architecture (À respecter impérativement)
- **Règle d'or de persistance locale** : Toutes les données personnelles de l'utilisateur restent stockées localement sur sa machine. Aucune donnée n'est envoyée à des serveurs tiers en dehors de l'API officielle Google Calendar si le compte est connecté.
- **Règle n°1 (Ordre manuel des tâches)** : Aucune réorganisation automatique des tâches. L'ordre établi par l'utilisateur (manuellement ou par glisser-déposer) est scrupuleusement préservé.
- **Règle n°2 (Distinction temporelle stricte)** : Il ne faut jamais confondre l'échéance d'une tâche (`deadline`), sa date de planification (`plannedDate`) et ses créneaux de travail réservés dans l'agenda (`events`).
- **Règle n°3 (Autorisation des chevauchements)** : Les créneaux simultanés ou qui se chevauchent dans l'agenda sont **toujours autorisés**. L'application utilise un algorithme de partitionnement horizontal automatique (colonnes virtuelles par grappes) pour les afficher côte à côte sans collision.
- **Règle n°6 (Indépendance stricte des suppressions)** : L'application ne doit **JAMAIS** supprimer une tâche simplement parce que son événement d'agenda lié est supprimé. De même, supprimer une note liée à un créneau ne doit jamais supprimer le créneau, et inversement.

---

## 2. Stack technique et environnement

- **Moteur d'exécution :** Electron `^45.0.0`
- **Packaging :** `electron-builder` `^26.18.0` (Cible : NSIS Windows 64 bits)
- **Frontend :** HTML5 Vanilla, CSS3 moderne (Variables CSS, Grilles, Flexbox), JavaScript ES2022 Vanilla (Zéro framework : pas de React, pas de Vue, pas de build bundle).
- **Node.js :** Exécutable disponible sur la machine dans `C:\Program Files\nodejs\node.exe`.
- **Zéro dépendance de production (`dependencies: {}`)** : Seules les API natives d'Electron et de Node.js (`http`, `crypto`, `fs/promises`, `path`) sont exploitées.

---

## 3. Cartographie commentée des fichiers clés

### Processus Principal Electron (Main Process)
- **`main.js`** : Initialise la fenêtre principale (`BrowserWindow`), configure la barre de titre Windows intégrée (`setTitleBarOverlay`), gère les notifications natives Windows (`Notification`), et héberge les écouteurs IPC pour les sauvegardes sur disque et l'authentification Google.
- **`preload.js`** : Pont sécurisé exposant l'objet `window.AntigraviteAPI` en lecture seule (`Object.freeze`), respectant `contextIsolation: true` et `sandbox: true`.
- **`services/google-auth-service.js`** : Service OAuth 2.0 natif conforme RFC 8252 (serveur loopback sur `127.0.0.1`). Chiffre les jetons Google sur le disque avec **DPAPI Windows** (`safeStorage`).
- **`services/google-calendar-service.js`** : Interface avec l'API Google Calendar v3 (fetchEvents incrémental, createEvent, updateEvent avec If-Match ETag, deleteEvent).

### Processus de Rendu (Renderer Process)
- **`index.html`** : Structure SPA unifiée contenant tous les écrans (`screen-home`, `screen-tasks`, `screen-projects`, `screen-agenda`, `screen-notes`, `screen-backups`, `screen-settings`), les fenêtres modales et l'écran de démarrage.
- **`css/styles.css`** : Styles complets gérant les 3 thèmes (`dark`, `light`, `oled`), les 5 couleurs d'accent, le volet rétractable et les calques de fond d'écran.
- **`js/app.js`** : Chef d'orchestre de l'application, horloge dynamique, écran de démarrage (Splash Screen) avec message d'accueil contextuel, navigation et Toasts.
- **`js/storage.js`** : Gestionnaire de persistance dans `localStorage` (clés `antigravite_*_v1`). Effectue l'amorçage initial depuis `data/*.json` si le stockage est vide.
- **`js/tasks.js`** : Arborescence récursive sans limite de profondeur, drag & drop hiérarchique, synchronisation obligatoire des tâches planifiées vers l'agenda.
- **`js/agenda.js`** : Vue hebdomadaire, calcul adaptatif de la hauteur horaire (`slotHeight`) sans ascenseur, drag & drop de créneaux (jour/heure), poignées d'étirement de durée, clic droit contextuel, distinction visuelle des sources (Google vs Antigravité).
- **`js/notes.js`** : Carnet de notes, moteur de recherche, export Markdown, liaison bidirectionnelle sécurisée avec les créneaux d'agenda.
- **`js/projects.js`** : Gestion des projets et calcul récursif de la complétion des tâches.
- **`js/backups.js`** : Création d'instantanés locaux et écriture physique de fichiers JSON sur disque via le Main Process (`userData/backups/`).
- **`js/notifications.js`** : Surveillance périodique de l'agenda et déclenchement de notifications Windows à T-60m, T-30m et T-0 avec des messages chaleureux et variés.
- **`js/settings.js`** : Contrôleur des thèmes, accents, polices, et traitement d'image de fond d'écran via HTML Canvas (1080p JPEG).
- **`js/google-sync.js`** : Gestionnaire de l'état Google dans le Renderer, fusion non destructive des événements et file d'attente hors-ligne (`antigravite_google_sync_queue`).

---

## 4. État d'avancement des modules

| Module | Statut | Validation | Remarques pour la reprise |
| :--- | :---: | :---: | :--- |
| **Accueil & Dashboard** | **Opérationnel** | Validé | Horloge française, compteurs, notes récentes intégrés. |
| **Gestionnaire de Tâches**| **Opérationnel** | Validé | Récursivité, drag & drop et synchronisation agenda complets. |
| **Agenda Hebdomadaire** | **Opérationnel** | Validé | Plein écran, sans ascenseur, étirement souris et clic droit prêts. |
| **Gestion des Projets** | **Opérationnel** | Validé | Calcul du pourcentage d'avancement récursif fonctionnel. |
| **Carnet de Notes** | **Opérationnel** | Validé | Liaison directe créneau d'agenda et affichage épuré. |
| **Sauvegardes Physiques**| **Opérationnel** | Validé | Écriture disque opérationnelle. Alléger le `localStorage`. |
| **Notifications Windows**| **Opérationnel** | Validé | Déclenchement à 1h, 30min et au moment même avec anti-doublon. |
| **Google Agenda (Mock)** | **Opérationnel** | Validé | Tous les cas de figures (sync, conflits, offline) testés en mock. |
| **Google Agenda (Réel)** | **En attente** | Non testé | Nécessite que l'utilisateur saisisse ses identifiants OAuth. |
| **Packaging Windows** | **BLOQUÉ** | Erreur identifiée | `services/**/*` manquant dans `package.json` `build.files`. |

---

## 5. Commandes utiles pour développer et tester

### Lancer l'application en mode développement
```powershell
# Depuis la racine du projet :
.\Lancer_Antigravite.bat
# Ou directement via Electron :
npx electron .
```

### Exécuter la suite complète de tests (19 suites / 58 tests)
```powershell
powershell -ExecutionPolicy Bypass -File .\tests\run_tests.ps1
```

### Exécuter spécifiquement les tests des fonctionnalités récentes
```powershell
& "C:\Program Files\nodejs\node.exe" .\tests\test_new_features.js
```

### Compiler l'installateur Windows (NSIS)
```powershell
npm run dist
```
*(Attention : Ne pas compiler avant d'avoir appliqué le correctif du point 6 ci-dessous).*

---

## 6. Pièges identifiés et points d'attention critiques

### 🚨 1. Le bug bloquant de compilation (`package.json`)
Dans `package.json`, la section `build.files` omet `"services/**/*"`. Lorsque `npm run dist` est exécuté, les fichiers `google-auth-service.js` et `google-calendar-service.js` ne sont pas copiés dans l'exécutable. L'application plantait au démarrage.
**Action à mener :** Ajouter `"services/**/*"` dans la liste `"files"` de `package.json`.

### 🚨 2. Le piège du stockage (`localStorage` vs `data/*.json`)
Ne modifiez pas les fichiers du dossier `data/*.json` en pensant que cela modifie l'application en cours d'exécution ! Ces fichiers ne sont lus qu'au premier lancement pour injecter les données initiales. Ensuite, la source de vérité est le `localStorage` de Chromium.
Les vraies sauvegardes physiques générées par l'utilisateur sont écrites dans :
`%APPDATA%\Antigravite\backups\antigravite_backup_*.json`.

### 🚨 3. Risque de saturation `QuotaExceededError` dans `localStorage`
Dans `js/backups.js`, `createManualBackup()` enregistre le `payload` complet (JSON complet de toute la base) dans l'objet de métadonnées du `localStorage`. Avec 20 sauvegardes et un fond d'écran personnalisé en base64, le quota de 5 Mo peut être franchi.
**Recommandation immédiate :** Modifier `createManualBackup()` pour ne sauvegarder dans `localStorage` que les métadonnées (nom, date, taille, décomptes) et purger le champ `payload`, le fichier complet étant déjà sur le disque.

### 🚨 4. Gestion des événements Google multi-jours
Dans `services/google-calendar-service.js`, les événements "journée entière" (`isAllDay`) ne créent pour l'instant un créneau que sur la date de début (`start.date`). Si un événement dure plusieurs jours, les jours suivants ne sont pas affichés.

---

## 7. Plan d'action recommandé pour le prochain assistant

1. **Étape 1 (Priorité absolue) : Corriger `package.json`**
   - Ouvrir `package.json`.
   - Insérer `"services/**/*"` dans le tableau `"build.files"`.
   - Harmoniser l'`appId` (`fr.antigravite.app`).

2. **Étape 2 : Optimiser `js/backups.js`**
   - Supprimer le champ `payload` des éléments enregistrés dans `antigravite_backups_metadata_v1` du `localStorage` pour éliminer tout risque de saturation.

3. **Étape 3 : Insérer la balise CSP dans `index.html`**
   - Ajouter la balise `<meta http-equiv="Content-Security-Policy">` dans l'en-tête pour éliminer les avertissements de sécurité de la console Electron.

4. **Étape 4 : Tester la compilation de l'installateur**
   - Lancer `npm run dist`.
   - Vérifier que `dist/Antigravite Setup 1.0.0.exe` s'installe et se lance sans erreur.

5. **Étape 5 : Accompagner l'utilisateur sur la connexion Google réelle**
   - Guider l'utilisateur pour renseigner son `Client ID` et son `Client Secret` dans l'écran Paramètres.
   - Valider la synchronisation en temps réel avec son agenda Google personnel.
