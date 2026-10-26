# Guide complet de connexion à Google Agenda dans Antigravité

Ce guide vous accompagne pas à pas pour connecter votre propre compte **Google Agenda** à votre application personnelle **Antigravité** et profiter d'une synchronisation bidirectionnelle fluide et sécurisée.

---

## Sommaire
1. [Prérequis](#1-prérequis)
2. [Étape 1 : Créer un projet sur Google Cloud](#2-étape-1--créer-un-projet-sur-google-cloud)
3. [Étape 2 : Activer l'API Google Calendar](#3-étape-2--activer-lapi-google-calendar)
4. [Étape 3 : Configurer l'écran de consentement OAuth](#4-étape-3--configurer-lécran-de-consentement-oauth)
5. [Étape 4 : Créer les identifiants de bureau OAuth 2.0](#5-étape-4--créer-les-identifiants-de-bureau-oauth-20)
6. [Étape 5 : Connecter votre compte dans Antigravité](#6-étape-5--connecter-votre-compte-dans-antigravité)
7. [Fonctionnalités au quotidien](#7-fonctionnalités-au-quotidien)
8. [Sécurité et Confidentialité](#8-sécurité-et-confidentialité)

---

## 1. Prérequis
- Un compte Google personnel (adresse `@gmail.com` ou Google Workspace).
- L'application **Antigravité** lancée sur votre ordinateur Windows.

---

## 2. Étape 1 : Créer un projet sur Google Cloud

1. Rendez-vous sur la **[Google Cloud Console](https://console.cloud.google.com/)** et connectez-vous avec votre compte Google.
2. En haut à gauche, cliquez sur le sélecteur de projets, puis sur **Nouveau projet**.
3. Saisissez un nom (par exemple : `Antigravité Personnel`), puis cliquez sur **Créer**.
4. Sélectionnez le nouveau projet que vous venez de créer dans la liste déroulante en haut de page.

---

## 3. Étape 2 : Activer l'API Google Calendar

1. Dans le menu de gauche (☰), accédez à **API et services** > **Bibliothèque**.
2. Dans la barre de recherche, tapez **Google Calendar API**.
3. Cliquez sur le résultat **Google Calendar API**, puis sur le bouton bleu **Activer**.

---

## 4. Étape 3 : Configurer l'écran de consentement OAuth

1. Dans le menu de gauche, rendez-vous dans **API et services** > **Écran de consentement OAuth**.
2. Choisissez le type d'utilisateur : **Externe** (parfaitement adapté à un usage personnel), puis cliquez sur **Créer**.
3. **Informations sur l'application** :
   - *Nom de l'application* : `Antigravité`
   - *Adresse e-mail d'assistance utilisateur* : sélectionnez votre adresse e-mail.
   - *Coordonnées du développeur* : saisissez votre adresse e-mail.
   - Cliquez sur **Enregistrer et continuer**.
4. **Champs d'application (Scopes)** :
   - Cliquez sur **Ajouter ou supprimer des champs d'application**.
   - Cochez le champ : `.../auth/calendar.events` *(Afficher, modifier, partager et supprimer définitivement tous les événements de vos agendas)*.
   - Cliquez sur **Mettre à jour**, puis sur **Enregistrer et continuer**.
5. **Utilisateurs tests (Étape indispensable)** :
   - Cliquez sur **+ Add users** (Ajouter des utilisateurs).
   - Saisissez **votre propre adresse e-mail Google** (celle avec laquelle vous utiliserez Antigravité).
   - Cliquez sur **Ajouter**, puis sur **Enregistrer et continuer**.
6. Cliquez sur **Retour au tableau de bord**.

> **Note :** En laissant l'application en mode *Test*, seuls les utilisateurs déclarés dans la liste des utilisateurs tests peuvent se connecter. C'est la méthode recommandée et entièrement gratuite de Google pour un usage personnel, sans nécessiter de vérification payante ni de domaine public.

---

## 5. Étape 4 : Créer les identifiants de bureau OAuth 2.0

1. Dans le menu de gauche, rendez-vous dans **API et services** > **Identifiants**.
2. Cliquez en haut sur **+ Créer des identifiants**, puis sélectionnez **ID client OAuth**.
3. Dans la liste déroulante *Type d'application*, choisissez **Application de bureau** *(Desktop app)*.
4. Dans le champ *Nom*, saisissez par exemple : `Antigravité Desktop`.
5. Cliquez sur **Créer**.
6. Une fenêtre modale apparaît affichant vos deux clés :
   - **Votre ID client** (ressemble à `123456789-xxxxxxxx.apps.googleusercontent.com`)
   - **Votre code secret client** (ressemble à `GOCSPX-xxxxxxxxxxxx`)
7. Vous pouvez copier ces valeurs ou télécharger le fichier JSON.

---

## 6. Étape 5 : Connecter votre compte dans Antigravité

1. Ouvrez l'application **Antigravité**.
2. Dans le menu de gauche, cliquez sur l'icône **⚙️ Paramètres**.
3. Descendez jusqu'à la section **📅 Connexion Google Agenda**.
4. Cliquez sur le bouton **Configurer Client ID / Secret** pour déplier le formulaire.
5. Collez votre **Client ID** et votre **Client Secret** dans les champs correspondants.
6. Cliquez sur **Enregistrer les identifiants**. La pastille indique alors : *🟡 Identifiants configurés • Prêt à connecter*.
7. Cliquez sur le bouton bleu **🌐 Se connecter avec Google** :
   - Votre navigateur web par défaut s'ouvre automatiquement sur la page sécurisée de connexion Google.
   - Connectez-vous avec votre compte Gmail (déclaré dans les utilisateurs tests).
   - Si un écran *"Google n'a pas validé cette application"* apparaît, cliquez sur **Paramètres avancés**, puis sur **Accéder à Antigravité (non sécurisé)**. *(Ce message est standard pour toute application personnelle en cours de test)*.
   - Cochez l'autorisation pour gérer vos événements Google Agenda, puis confirmez.
   - La page affiche alors : *"Authentification Antigravité réussie ! Vous pouvez fermer cette fenêtre."*
8. Revenez sur Antigravité :
   - La pastille passe instantanément au vert : *🟢 Connecté : votre_email@gmail.com*.
   - La liste déroulante de vos calendriers Google apparaît (par défaut, votre agenda **Principal** est sélectionné).
   - Vos événements Google sont immédiatement récupérés et visibles dans l'onglet **Agenda** !

---

## 7. Fonctionnalités au quotidien

### Choix du calendrier cible
Si vous possédez plusieurs calendriers Google (par exemple *Personnel*, *Professionnel*, *Sport*), vous pouvez choisir à tout moment le calendrier à synchroniser dans **Paramètres** > **Calendrier cible**.

### Création d'événements
Lorsque vous cliquez sur **+ Nouveau créneau** dans l'Agenda hebdomadaire :
- Un sélecteur vous permet de choisir d'enregistrer l'événement en **📍 Local Antigravité** ou dans **🌐 Google Agenda**.
- Vous pouvez définir un titre, une description, un **lieu / lien Google Meet**, une date et des horaires précis, ou cocher **Journée entière**.
- Vous pouvez également associer une tâche de votre liste Antigravité : la liaison est conservée localement.

### Modification bidirectionnelle
- Cliquez sur n'importe quel événement Google dans votre semaine pour modifier son titre, son heure, son lieu ou sa description.
- Cliquez sur **Mettre à jour dans Google Agenda** : les modifications sont immédiatement transmises à Google via un `PATCH` qui préserve les métadonnées distantes (Meet, pièces jointes, invités).
- À l'inverse, si vous modifiez un créneau sur votre téléphone ou dans Google Calendar web, cliquez sur le bouton **🔄 Actualiser** dans Antigravité pour importer les nouveautés sans créer de doublon.

### Suppression sécurisée
- Vous pouvez supprimer un créneau Google depuis Antigravité via le bouton rouge **Supprimer de Google Agenda**.
- Une confirmation explicite vous est demandée.
- **Règle absolue :** Si une tâche Antigravité était liée à ce créneau, la tâche reste **100% intacte** dans votre liste de tâches.

### Fonctionnement hors-ligne et file d'attente
- Si vous êtes dans le train ou sans connexion Internet, vous pouvez continuer à créer, modifier ou supprimer des événements sans blocage.
- Antigravité affiche une pastille `⏳ En attente` et stocke vos actions dans une file locale sécurisée.
- Dès que le réseau est rétabli ou lors du prochain clic sur *Actualiser*, Antigravité transmet automatiquement vos modifications à Google Agenda.

---

## 8. Sécurité et Confidentialité

- **Aucun mot de passe demandé** : Antigravité n'a jamais accès à votre mot de passe Google. L'authentification se fait directement sur les serveurs de Google (OAuth 2.0 PKCE / Loopback conforme RFC 8252).
- **Chiffrement local Windows DPAPI** : Vos jetons d'accès et votre secret sont chiffrés sur votre disque dur via le coffre-fort natif de Windows (`safeStorage`).
- **Sauvegardes physiques protégées** : Aucun jeton ni secret OAuth n'est jamais inclus dans les fichiers d'export JSON ni dans vos sauvegardes `backups/`. Vos données personnelles restent strictement privées et locales sur votre ordinateur.
