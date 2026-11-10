# AUDIT GLOBAL DU PROJET ANTIGRAVITÉ

**Date de réalisation :** 25 octobre 2026  
**Auditeur :** Assistant IA Spécialiste Electron & Architecture logicielle  
**Périmètre :** Code source, configuration, sécurité, persistance, tests et packaging  
**Version applicative :** 1.0.0  

---

## 1. Résumé exécutif

L'application **Antigravité** est un environnement personnel unifié de productivité développé sur le socle **Electron / HTML5 / CSS3 / JavaScript (ES2022 Vanilla)**, fonctionnant sous Windows 11. Elle intègre un gestionnaire de tâches récursives à profondeur arbitraire, un gestionnaire de projets, un agenda hebdomadaire minuté, un carnet de notes et un système de synchronisation bidirectionnelle avec Google Agenda.

### Points forts majeurs
- **Architecture de sécurité Electron exemplaire** : Isolation de contexte activée (`contextIsolation: true`), intégration Node désactivée (`nodeIntegration: false`), bac à sable activé (`sandbox: true`), et chiffrement matériel des jetons Google via DPAPI Windows (`safeStorage`).
- **Respect scrupuleux des règles métier** : La suppression d'un créneau dans l'agenda ne supprime jamais la tâche liée (Règle n°6). L'arborescence récursive des tâches supporte une profondeur arbitraire sans réorganisation non consentie. Les chevauchements de créneaux sont parfaitement supportés grâce à un algorithme de partitionnement horizontal sans collision.
- **Suite de tests robuste** : 19 suites de tests automatisées (58 tests unitaires et d'intégration granulaires) sont présentes et validées à 100% (0 échec).
- **Richesse de l'interface et du ressenti utilisateur** : Thèmes dynamiques (sombre, clair, OLED), personnalisation visuelle poussée (fonds d'écran avec opacité et flou dynamique), volet latéral pliable avec persistance, écran de démarrage chaleureux avec calcul de créneau d'accueil, notifications Windows natives prévenantes (à T-60m, T-30m et T-0).

### Vulnérabilité et anomalies critiques identifiées
1. **Défaut critique de packaging Windows (`package.json`)** : La section `build.files` exclut le répertoire `services/**/*`. Dans l'installateur généré par `electron-builder`, les modules `google-auth-service.js` et `google-calendar-service.js` sont absents de l'archive `app.asar`, ce qui provoque le crash immédiat de l'application installée au démarrage (`MODULE_NOT_FOUND`).
2. **Déconnexion de persistance et risque de quota `localStorage`** : L'intégralité des données en cours d'utilisation est conservée dans le `localStorage` du moteur Chromium. Les fichiers `data/*.json` sur le disque ne servent que d'amorce initiale et ne sont jamais mis à jour. De plus, `BackupManager` stocke jusqu'à 20 instantanés complets dans le `localStorage` en plus des sauvegardes physiques sur disque ; combiné à des images de fond personnalisées en base64, un risque de dépassement de quota (`QuotaExceededError`, 5-10 Mo) menace la persistance des données.
3. **Absence de Content Security Policy (CSP)** : Aucun en-tête ni balise `<meta http-equiv="Content-Security-Policy">` n'est configuré dans `index.html`.

---

## 2. État général du projet

| Axe d'évaluation | Niveau de maturité | Note | Commentaire synthétique |
| :--- | :--- | :---: | :--- |
| **Fonctionnel Métier** | Mature & Avancé | 9.5/10 | Respect strict des exigences d'indépendance tâche/créneau, récursivité et non-réorganisation. |
| **Ergonomie & UI/UX** | Moderne & Poli | 9.0/10 | Agenda plein écran réactif, drag & drop fluide, raccourcis (Ctrl+B, Échap), menu contextuel clic droit. |
| **Sécurité Electron** | Très élevé | 8.5/10 | Chiffrement DPAPI, pont IPC strict, validation des URLs externes. Manque une politique CSP explicite. |
| **Architecture Données** | Hybride perfectible | 7.0/10 | Fonctionne impeccablement via `localStorage`, mais les fichiers `data/*.json` restent orphelins. |
| **Packaging & Déploiement**| Bloquant en production | 4.0/10 | Configuration `build.files` incomplète bloquant l'exécutable finalisé. Facile à corriger. |

---

## 3. Architecture et cartographie des fichiers

### 3.1 Vue d'ensemble de l'arborescence

```text
Antigravité/
├── dist/                                  # Exécutables d'installation générés (NSIS)
├── data/                                  # Fichiers JSON d'amorce initiale (seed)
│   ├── tasks.json                         # Amorce des tâches (arborescence récursive)
│   ├── projects.json                      # Amorce des projets
│   ├── events.json                        # Amorce des événements d'agenda
│   ├── notes.json                         # Amorce des notes
│   └── settings.json                      # Amorce des réglages utilisateur
├── backups/                               # Dossier local des sauvegardes physiques manuelles/tests
├── css/
│   └── styles.css                         # Feuille de style unique (~60 Ko)
├── js/                                    # Processus de rendu (Renderer Process)
│   ├── app.js                             # Contrôleur d'application, navigation, horloge, dashboard
│   ├── storage.js                         # Couche de persistance localStorage & initialisation
│   ├── tasks.js                           # Logique métier des tâches, glisser-déposer, récursivité
│   ├── projects.js                        # Gestion des projets et métriques d'avancement
│   ├── agenda.js                          # Agenda hebdomadaire, partitionnement, redimensionnement
│   ├── notes.js                           # Éditeur de notes, liaisons réciproques avec l'agenda
│   ├── backups.js                         # Moteur de sauvegarde physique et gestion des exports
│   ├── settings.js                        # Personnalisation visuelle (thèmes, fonds d'écran, densité)
│   ├── notifications.js                   # Moteur de notifications Windows prévenantes (T-60, T-30, T-0)
│   └── google-sync.js                     # Gestionnaire renderer Google Agenda et file hors-ligne
├── services/                              # Processus principal (Main Process Services)
│   ├── google-auth-service.js             # OAuth 2.0 loopback RFC 8252, chiffrement DPAPI safeStorage
│   └── google-calendar-service.js         # Client API Google Calendar v3, mappage et résolutions
├── tests/                                 # Suites de tests automatisés
│   ├── run_tests.ps1                      # Lanceur global PowerShell (19 suites validées)
│   ├── test_google_phase2.js              # Tests lecture seule et masquage des secrets
│   ├── test_google_phase3.js              # Tests affichage, fusion et préservation des tâches
│   ├── test_google_phase4.js              # Tests écriture, modification et anti-boucle
│   ├── test_google_phase5.js              # Tests suppressions, gestion des conflits et file d'attente
│   ├── test_google_phase6.js              # Tests sauvegarde physique et étanchéité des secrets
│   └── test_new_features.js               # Tests des 20 fonctionnalités récentes
├── index.html                             # Vue unique SPA (Single Page Application)
├── main.js                                # Point d'entrée Electron (Main Process, IPC, cycle de vie)
├── preload.js                             # Pont contextBridge sécurisé exposant `AntigraviteAPI`
├── package.json                           # Dépendances et configuration electron-builder
└── package-lock.json                      # Verrou des dépendances npm
```

### 3.2 Relations et flux inter-modules

```text
+---------------------------------------------------------------------------------------+
|                                    MAIN PROCESS                                       |
|  [main.js] <---> [services/google-auth-service.js] <---> [services/google-calendar]   |
|       ^                                                                               |
|       | IPC (invoke / handle via safe channels)                                       |
+-------v-------------------------------------------------------------------------------+
|                                      PRELOAD                                          |
|  [preload.js] : contextBridge.exposeInMainWorld('AntigraviteAPI', { ... })            |
+---------------------------------------------------------------------------------------+
|                                  RENDERER PROCESS                                     |
|  [index.html]                                                                         |
|       |                                                                               |
|  [app.js] (Orchestrateur & Navigation)                                                |
|       +---> [tasks.js] --------+                                                      |
|       +---> [agenda.js] <------+ (Liaison programmation tâche -> créneau agenda)      |
|       +---> [notes.js]  <------+ (Liaison bidirectionnelle note <-> créneau agenda)   |
|       +---> [projects.js] <----+ (Liaison tâche -> projet)                            |
|       +---> [settings.js]                                                             |
|       +---> [notifications.js] (Surveillance créneaux et Toasts Windows)             |
|       +---> [google-sync.js] --+ (Communication avec AntigraviteAPI.google)           |
|       +---> [backups.js] ------+ (Communication avec AntigraviteAPI.saveBackup)       |
|                                                                                       |
|  [storage.js] (Persistance centrale localStorage / Clés unifiées antigravite_*_v1)    |
+---------------------------------------------------------------------------------------+
```

---

## 4. Inventaire fonctionnel

| Fonctionnalité | Écran / Composant | Fichiers concernés | État réel | Niveau de vérification | Problèmes ou limites constatés |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tableau de bord Accueil** | `screen-home` | `js/app.js`, `index.html` | Opérationnel | Testé et vérifié | Affichage temps réel de l'horloge, résumé des tâches du jour, créneaux du jour et dernières notes. |
| **Tâches récursives** | `screen-tasks` | `js/tasks.js`, `index.html` | Opérationnel | Testé unitairement | Profondeur arbitraire (>= 4 testé), pas de réorganisation automatique, conservation stricte de l'ordre. |
| **Glisser-déposer des tâches**| `screen-tasks` | `js/tasks.js` | Opérationnel | Testé unitairement | Permet de réordonner (`before`/`after`), d'imbriquer (`inside`) avec garde anti-boucle, et de désimbriquer (`outdent`). |
| **Programmation de tâche** | Modal Tâche | `js/tasks.js`, `js/agenda.js`| Opérationnel | Testé unitairement | Renseigner `plannedDate` crée ou synchronise obligatoirement un créneau dans l'agenda de base (source `local`). |
| **Projets & Avancement** | `screen-projects` | `js/projects.js` | Opérationnel | Testé unitairement | Calcul récursif de la progression (%), dissociation propre en cas de suppression de projet. |
| **Agenda hebdomadaire** | `screen-agenda` | `js/agenda.js`, `css/styles.css` | Opérationnel | Testé et vérifié | Grille 07h-23h adaptée à la hauteur disponible (sans défilement), disposition par grappes pour chevauchements. |
| **Déplacement / Étirement Agenda** | `screen-agenda` | `js/agenda.js` | Opérationnel | Testé unitairement | Drag & drop de créneau (jour/heure), poignées de redimensionnement en haut (début) et en bas (fin). |
| **Menu contextuel Clic Droit** | `screen-agenda` | `js/agenda.js` | Opérationnel | Testé unitairement | Sur créneau : modifier/supprimer ; Sur grille vide : ajout immédiat à l'heure précise cliquée. |
| **Distinction visuelle Agenda**| `screen-agenda` | `js/agenda.js` | Opérationnel | Testé unitairement | Badges et styles distinctifs : bleu pour Google (`dot-google`), violet signature pour Antigravité. |
| **Carnet de Notes** | `screen-notes` | `js/notes.js` | Opérationnel | Testé et vérifié | Création, recherche, suppression, export `.md`, aperçu temps réel. Suppression de l'affichage Markdown brut demandé. |
| **Liaison Notes <-> Agenda** | `screen-notes` & `modal-event` | `js/notes.js`, `js/agenda.js` | Opérationnel | Testé unitairement | Indépendance totale : supprimer une note conserve le créneau, supprimer le créneau conserve la note. |
| **Sauvegarde physique sur disque**| `screen-backups` | `js/backups.js`, `main.js`, `preload.js` | Opérationnel | Testé et validé | Fichier JSON horodaté écrit dans `userData/backups/`. Détection automatique au premier lancement. |
| **Import / Restauration** | `screen-backups` | `js/backups.js`, `js/storage.js` | Opérationnel | Testé et validé | Création automatique d'une sauvegarde de sécurité AVANT tout écrasement par import externe. |
| **Notifications Windows** | Background Timer | `js/notifications.js`, `main.js` | Opérationnel | Testé unitairement | Rappels à T-60m, T-30m et T-0 avec messages bienveillants aléatoires non répétitifs. AppUserModelId configuré. |
| **Thèmes & Apparence** | `screen-settings` | `js/settings.js`, `js/app.js` | Opérationnel | Testé et vérifié | Thèmes Dark / Light / OLED, 5 couleurs d'accent, 2 densités, 3 arrondis, bandeau natif Windows synchronisé. |
| **Fond d'écran personnalisé** | `screen-settings` | `js/settings.js`, `js/app.js` | Opérationnel | Testé unitairement | Présélections (Nebula, Aurora...) ou image utilisateur (optimisée canvas 1080p JPEG), opacité et flou. |
| **Volet latéral rétractable** | Barre latérale | `js/app.js`, `index.html` | Opérationnel | Testé unitairement | Raccourci `Ctrl+B`, bouton dédié, persistance de l'état ouvert/fermé dans le stockage. |
| **Google Agenda : Authentification**| `screen-settings` | `services/google-auth-service.js` | Opérationnel en mock | Testé en mock | RFC 8252 (Loopback 127.0.0.1), jetons chiffrés DPAPI, masquage des secrets côté Renderer. |
| **Google Agenda : Synchronisation**| `screen-agenda` & `js/google-sync.js` | `services/google-calendar-service.js` | Opérationnel en mock | Testé en mock | Synchronisation incrémentale via `syncToken`, file d'attente hors-ligne, détection des erreurs réseau. |
| **Packaging Windows (NSIS)** | Distributable | `package.json` | **DÉFAILLANT** | Évalué par inspection | Exclut `services/**/*` de la distribution. L'installateur final produit un binaire qui plante au lancement. |

---

## 5. Tests effectués et résultats

Les tests ont été exécutés directement sur l'environnement Windows PowerShell officiel sans modifier le code applicatif.

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\run_tests.ps1
```

### Synthèse quantitative
- **Nombre total de suites de tests exécutées :** 19
- **Nombre de tests granulaires exécutés :** 58
- **Succès :** 58 (100%)
- **Échecs :** 0 (0%)

### Détail des phases de test validées
1. **Persistance locale et intégrité JSON** : Validation de la présence et de la syntaxe des 5 fichiers de référence dans `data/` (5 tests réussis).
2. **Arborescence récursive des tâches** : Validation de la profondeur arbitraire sans rupture (>= 4 niveaux validés).
3. **Préservation de l'ordre utilisateur** : Vérification de la non-réorganisation automatique.
4. **Distinction des trois concepts temporels** : Échéance (`deadline`) != Date prévue (`plannedDate`) != Créneau de calendrier (`events`).
5. **Règle impérative n°6** : Suppression d'un créneau dans l'agenda sans altération de la tâche liée.
6. **Règle impérative n°3** : Chevauchement simultané de multiples créneaux dans le même créneau horaire.
7. **Sauvegardes physiques** : Écriture sur disque d'un instantané JSON complet et test de désérialisation.
8. **Google Agenda Phase 2** : Mappage des créneaux minutés et all-day, masquage des tokens (4 tests réussis).
9. **Google Agenda Phase 3** : Fusion non destructive, préservation des identifiants locaux et des tâches (4 tests réussis).
10. **Google Agenda Phase 4** : Formatage des payloads RFC 3339 pour l'API Google, anti-boucle de réémission (7 tests réussis).
11. **Google Agenda Phase 5** : Suppression distante, gestion robuste des erreurs réseau et file hors-ligne (6 tests réussis).
12. **Google Agenda Phase 6** : Étanchéité absolue des secrets OAuth dans les fichiers de sauvegarde (4 tests réussis).
13. **Nouvelles fonctionnalités (Phase 7 / Évolutions récentes)** : 20 tests unitaires réussis portant sur :
    - La liaison bidirectionnelle Note <-> Agenda (indépendance stricte des suppressions) ;
    - La mémorisation de l'état replié/déplié du volet latéral ;
    - Le message d'accueil dynamique au démarrage selon l'heure ;
    - L'actualisation de l'agenda au clic sur l'onglet navigation ;
    - La variété et la non-répétition des notifications Windows (T-60m, T-30m, T-0) ;
    - Les réglages de fond d'écran et leur persistance ;
    - Le glisser-déposer des tâches (réordonnancement, imbrication et outdent) ;
    - L'horloge dynamique et l'extraction des notes récentes sur le tableau de bord ;
    - Le calcul dynamique de la hauteur des créneaux (`slotHeight`) ;
    - Le menu contextuel clic droit de l'agenda ;
    - La création automatique obligatoire d'un créneau pour toute tâche planifiée ;
    - Le déplacement et le redimensionnement interactifs des créneaux de l'agenda.

---

## 6. Bugs confirmés

### Bug n°1 (Critique) : Omission du dossier `services/` dans la configuration de compilation
- **Fichier concerné :** `package.json` (Lignes 21-29)
- **Constat formel :**
  ```json
  "files": [
    "main.js",
    "preload.js",
    "index.html",
    "css/**/*",
    "js/**/*",
    "data/**/*",
    "package.json"
  ]
  ```
  Le dossier `services/` n'y figure pas.
- **Impact :** Dans `main.js`, les lignes 5 et 6 exécutent :
  ```javascript
  const googleAuth = require('./services/google-auth-service');
  const googleCalendar = require('./services/google-calendar-service');
  ```
  Lors de la génération de l'installateur Windows (`npm run dist`), `electron-builder` n'embarque pas le dossier `services/` dans le fichier `app.asar`. L'exécutable installé plante immédiatement au démarrage avec une erreur fatale Node.js : `Cannot find module './services/google-auth-service'`.
- **Proposition de correction (à appliquer lors de la prochaine phase de dev) :**
  Ajouter `"services/**/*"` dans la liste `"files"` de `package.json`.

---

## 7. Risques potentiels et cas limites

### Risque n°1 (Élevé) : Saturation du quota `localStorage` (QuotaExceededError)
- **Localisation :** `js/storage.js` et `js/backups.js`
- **Mécanisme :** Le navigateur Chromium alloue typiquement entre 5 et 10 Mo pour le `localStorage`. Dans l'état actuel :
  1. `BackupManager.createManualBackup` insère l'objet complet `payload: fullData` directement dans l'entrée `antigravite_backups_metadata_v1` du `localStorage` et conserve jusqu'à 20 versions.
  2. L'image de fond personnalisée importée par l'utilisateur est convertie en URL Data base64 JPEG (`~300-800 Ko`) et sauvée dans `antigravite_settings_v1`.
  3. Des notes volumineuses ou de nombreux historiques de notifications font croître la taille globale.
- **Conséquence :** Dès que le total franchit 5-10 Mo, tout appel à `localStorage.setItem()` lèvera une exception non gérée `QuotaExceededError`, empêchant la sauvegarde des tâches, événements et réglages.
- **Recommandation :** Dans `localStorage`, ne conserver que les métadonnées légères des sauvegardes (`id`, `filename`, `label`, `createdAt`, `size`, `counts`), sans le champ `payload`. Le contenu complet est déjà persisté physiquement sur le disque via `AntigraviteAPI.saveBackup()`.

### Risque n°2 (Moyen) : Décalage entre `data/*.json` et l'état réel des données
- **Localisation :** `js/storage.js`
- **Mécanisme :** Les fichiers `data/tasks.json`, `data/projects.json`, etc., ne sont lus qu'au tout premier démarrage pour pré-remplir l'application si le `localStorage` est vide. Aucune écriture n'est jamais répercutée dans ces fichiers lors de la vie de l'application.
- **Conséquence :** Si l'utilisateur ou un administrateur inspecte le dossier `data/` en pensant y trouver ses données à jour, il constatera des données périmées datant du premier jour.

### Risque n°3 (Moyen) : Événements Google Calendar en journée entière multi-jours
- **Localisation :** `services/google-calendar-service.js` (Lignes 260-263)
- **Mécanisme :**
  ```javascript
  if (isAllDay) {
    const datePart = gEvt.start.date;
    startIso = `${datePart}T08:00`;
    endIso = `${datePart}T19:00`;
  }
  ```
  Si un événement Google est une mission ou des vacances durant 5 jours (`start.date: "2026-11-02"`, `end.date: "2026-11-07"`), le convertisseur ignore `gEvt.end.date`. L'événement n'est affiché que sur le lundi 2 novembre de 08:00 à 19:00, et disparaît des mardi, mercredi, jeudi et vendredi.

### Risque n°4 (Faible) : Divergence de l'AppUserModelId sous Windows
- **Localisation :** `main.js` vs `package.json`
- **Mécanisme :** `main.js` déclare `app.setAppUserModelId('com.antigravite.app')` alors que `package.json` déclare `"appId": "fr.antigravite.app"`.
- **Conséquence :** Risque que le centre de notifications Windows n'associe pas le logo de l'application au raccourci installé dans le menu Démarrer.

---

## 8. Vérification du système de sauvegarde et de restauration

### 8.1 Emplacements et formats
- **Sauvegardes physiques sur disque :** Situées dans `C:\Users\<User>\AppData\Roaming\Antigravite\backups\`.
- **Nomenclature :** `antigravite_backup_YYYY-MM-DDTHH-mm-ss.json`.
- **Structure du fichier exporté :**
  ```json
  {
    "version": "1.0",
    "exportedAt": "2026-10-25T20:30:00.000Z",
    "tasks": [...],
    "projects": [...],
    "events": [...],
    "notes": [...],
    "settings": {...}
  }
  ```

### 8.2 Analyse de sécurité et intégrité
- **Étanchéité des secrets :** Vérifié et certifié par le test Phase 6 (`test_google_phase6.js`). Aucun jeton d'accès (`access_token`), jeton de rafraîchissement (`refresh_token`) ni secret client (`clientSecret`) n'est présent dans les exports JSON.
- **Protection pré-importation :** Dans `js/backups.js`, la méthode `handleFileImport()` déclenche systématiquement un instantané physique préalable avant d'écraser les données en mémoire. Si la sauvegarde échoue, l'importation est avortée.
- **Écriture atomique et sans écrasement :** `main.js` utilise le drapeau Node.js `'wx'` pour interdire l'écrasement silencieux d'un fichier de sauvegarde préexistant portant le même nom.

---

## 9. Audit spécifique de Google Agenda

### 9.1 Mécanisme d'autorisation (OAuth 2.0)
- **Conformité RFC 8252 (Best Current Practice for Native Apps) :** L'application n'utilise aucune WebView intégrée non sécurisée. Elle ouvre le navigateur système par défaut (`shell.openExternal`) et écoute sur un serveur HTTP loopback éphémère (`127.0.0.1`) sur un port aléatoire.
- **Sécurité CSRF :** Un paramètre `state` cryptographiquement aléatoire (16 octets hexadécimaux) est généré et contrôlé lors du rappel.
- **Stockage des jetons :** Les jetons et identifiants sont chiffrés sur le disque via l'API native Windows DPAPI (`safeStorage.encryptString`), enregistrés dans `userData/google_auth/auth_data.enc`. Si DPAPI n'est pas disponible, une sérialisation de secours est prévue.

### 9.2 Synchronisation et robustesse hors-ligne
- **Stratégie anti-boucle :** Le flag `syncStatus: 'synced'` empêche qu'un créneau reçu de Google ne soit renvoyé en boucle vers Google.
- **File d'attente hors-ligne :** Enregistrée dans `antigravite_google_sync_queue`. Si une requête échoue pour cause d'absence de réseau, elle est mise en attente et dépilée automatiquement dès le retour de l'événement système `online` ou lors du prochain démarrage.
- **Détection des conflits :** Utilisation des en-têtes ETag (`If-Match`) avec gestion du code HTTP 412.
- **Limitation réelle constatée :** Seul le compte configuré avec un Client ID/Secret valide peut tester le flux en réel. Dans notre environnement de test, les communications avec l'API Google ont été validées via des mocks complets couvrant l'intégralité des routes API.

---

## 10. Sécurité Electron

| Critère de sécurité | État | Analyse technique |
| :--- | :---: | :--- |
| **Context Isolation** | Activé | `contextIsolation: true` dans `webPreferences`. Le Renderer ne peut pas altérer les prototypes Node.js. |
| **Node Integration** | Désactivé | `nodeIntegration: false`. Aucun accès direct aux API système (`fs`, `child_process`) depuis le DOM. |
| **Sandbox Chromium** | Activé | `sandbox: true`. Isolation stricte du processus de rendu. |
| **Filtrage Shell External**| Conforme | `main.js` valide que les URLs commencent strictement par `http://` ou `https://` avant `shell.openExternal`. |
| **Content Security Policy**| **Absent** | Manque une balise `<meta http-equiv="Content-Security-Policy">`. Avertissement console standard Electron. |
| **Protection des secrets** | Conforme | Aucun secret ni jeton OAuth n'est accessible par le Renderer via l'objet `window.AntigraviteAPI`. |

---

## 11. Interface et expérience utilisateur

### 11.1 Écrans audités
1. **Écran de démarrage (Splash Screen) :** Animation de barre de progression avec message bienveillant calculé dynamiquement selon la tranche horaire (matin, déjeuner, soirée). Délai d'affichage étendu à 2,3 s pour une lecture confortable.
2. **Tableau de bord (Accueil) :** Horloge temps réel affichant la date complète en français, compteurs dynamiques, panneau des créneaux du jour (avec badge source), panneau des tâches prioritaires et panneau des dernières notes modifiées.
3. **Gestionnaire de tâches :** Arborescence hiérarchique avec icônes de dépliage/repliage, boutons de montée/descente, gestion du glisser-déposer sur 3 zones (`before`, `after`, `inside`), modal de tâche enrichie avec programmation obligatoire dans l'agenda.
4. **Agenda hebdomadaire :** Plein écran sans ascenseur vertical parasite (`slotHeight` adaptatif), navigation par semaine, vue simultanée des chevauchements, différenciation visuelle Google (bleu) vs Antigravité (violet signature), poignées de redimensionnement de début et de fin de créneau, déplacement souris complet jour/heure, menu contextuel clic droit.
5. **Notes :** Volet liste avec recherche instantanée, zone d'édition agrandie (version Markdown brut retirée au profit de la lisibilité), sélecteur de créneau d'agenda lié avec bouton de navigation directe.
6. **Sauvegardes :** Tableau récapitulatif des instantanés locaux et physiques avec taille, nombre d'éléments, boutons de restauration et de téléchargement JSON direct.
7. **Paramètres :** Sélection visuelle interactive des thèmes (Dark, Light, OLED), des couleurs d'accent, sélection de fonds d'écran avec curseurs d'opacité et de flou, configuration Google OAuth.

---

## 12. Packaging Windows

- **Outil de compilation :** `electron-builder` version `^26.18.0`.
- **Cible :** Installateur Windows NSIS standard (`dist/Antigravite Setup 1.0.0.exe`).
- **Options NSIS :** `oneClick: false`, raccourcis Bureau et Menu Démarrer activés, choix du répertoire d'installation activé.
- **Anomalie bloquante :** L'omission de `services/**/*` dans la clé `build.files` de `package.json` neutralise le bon fonctionnement du binaire packagé.

---

## 13. Dépendances et avertissements

### Dépendances de production
Le projet utilise **zéro dépendance externe au runtime** (`dependencies: {}`), ce qui est un atout exceptionnel en termes de légèreté, d'auditabilité, d'empreinte mémoire et d'immunité contre les attaques de chaîne logistique (supply chain attacks). Tout repose sur les API natives de Node.js (`http`, `crypto`, `fs/promises`, `path`) et les API d'Electron (`safeStorage`, `ipcMain`, `Notification`).

### Dépendances de développement
- `electron`: `^45.0.0`
- `electron-builder`: `^26.18.0`

---

## 14. Limites de l'audit

1. **Absence de test en conditions réelles avec un compte Google en production :** L'audit n'a pas déclenché de connexion interactive vers Google pour ne pas altérer l'agenda réel de l'utilisateur. Toutes les vérifications ont été effectuées via les bancs de tests automatisés simulant les flux OAuth et les réponses de l'API REST v3.
2. **Mesure de performance sur des bases de données volumineuses :** Les tests ont porté sur des jeux de données comptant plusieurs dizaines de tâches et créneaux. Le comportement sous une charge extrême (> 5 000 tâches ou notes) n'a pas été mesuré sur le moteur de rendu DOM.

---

## 15. Problèmes classés par gravité

### 🔴 Gravité Critique
- **PC-01 : Fichiers `services/**/*` omis dans `package.json`**
  - **Fichier :** `package.json`
  - **Description :** Exclusion du code du processus principal lors de la compilation NSIS.
  - **Conséquence :** Crash systématique de l'application installée via l'installateur Windows.
  - **Correction :** Ajouter `"services/**/*"` dans `build.files`.

### 🟠 Gravité Élevée
- **PE-01 : Risque de saturation du `localStorage` par accumulation des instantanés**
  - **Fichier :** `js/backups.js`
  - **Description :** Stockage du `payload` JSON complet dans le `localStorage` pour 20 sauvegardes successives.
  - **Conséquence :** `QuotaExceededError` potentiel bloquant l'enregistrement des tâches et des réglages.
  - **Correction :** Ne stocker que les métadonnées dans `localStorage` ; le corps complet reste sur le disque dans `userData/backups/`.

### 🟡 Gravité Moyenne
- **PM-01 : Absence de politique de sécurité de contenu (CSP)**
  - **Fichier :** `index.html`
  - **Description :** Aucune directive CSP définie.
  - **Correction :** Insérer `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;">`.
- **PM-02 : Événements Google all-day multi-jours tronqués au premier jour**
  - **Fichier :** `services/google-calendar-service.js`
  - **Description :** `gEvt.end.date` n'est pas pris en compte pour générer les créneaux des jours suivants.
  - **Correction :** Boucler entre `start.date` et `end.date` pour instancier un créneau par jour couvert.
- **PM-03 : Déconnexion des fichiers `data/*.json` après le premier démarrage**
  - **Fichier :** `js/storage.js`
  - **Description :** Les fichiers du répertoire `data/` ne reflètent plus les données réelles dès que l'utilisateur modifie l'application.
  - **Correction :** Documenter explicitement que la vérité de persistance réside dans le profil utilisateur Electron, ou synchroniser périodiquement un export automatique.

### 🟢 Gravité Faible
- **PF-01 : Nettoyage des nombreux fichiers temporaires de développement**
  - **Emplacement :** Racine du projet, `js/`, `css/`
  - **Description :** Présence de multiples fichiers `.backup*` et `.bak`.
  - **Correction :** Archiver ou supprimer ces fichiers obsolètes pour assainir l'espace de travail.
- **PF-02 : Incohérence de nommage de l'AppUserModelId**
  - **Fichiers :** `main.js` (`com.antigravite.app`) vs `package.json` (`fr.antigravite.app`).
  - **Correction :** Harmoniser les deux identifiants sur `fr.antigravite.app`.

---

## 16. Améliorations recommandées

1. **Corriger `package.json` (`build.files`)** : Permettre la génération immédiate d'un installeur Windows sain et testable.
2. **Alléger le stockage des sauvegardes dans `localStorage`** : Déporter le contenu volumineux exclusivement vers le système de fichiers physique via le pont IPC existant `saveBackup` / `listBackups`.
3. **Mettre en place une Content Security Policy (CSP)** : Sécuriser formellement le DOM de l'application contre d'éventuelles injections XSS.
4. **Prendre en charge les événements Google récurrents ou multi-jours** : Étendre le convertisseur pour créer un créneau visuel par journée couverte.
5. **Assainir l'arborescence** : Archiver l'ensemble des fichiers `.bak` et `.backup` dans un sous-dossier dédié `archive/`.

---

## 17. État précis des travaux restant à effectuer

1. **Phase Packaging (Priorité 1) :**
   - Mise à jour de `package.json` (`services/**/*` et `appId`).
   - Compilation test via `npm run dist`.
   - Test d'installation et de lancement sur machine Windows vierge.
2. **Phase Robustesse Stockage (Priorité 2) :**
   - Révision de `BackupManager` pour ne plus encombrer le `localStorage` avec les corps des backups.
   - Ajout d'une balise CSP stricte dans `index.html`.
3. **Phase Google Agenda Réelle (Priorité 3) :**
   - Saisie par l'utilisateur de ses identifiants OAuth Google Cloud.
   - Première synchronisation interactive en situation réelle.
