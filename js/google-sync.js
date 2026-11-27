/**
 * Antigravité - Module de Synchronisation & Gestion Google Agenda
 * 
 * Phase 2 :
 * - Gestion de l'état de connexion Google
 * - Saisie sécurisée des identifiants OAuth 2.0 Client ID / Secret
 * - Déclenchement du flux d'authentification loopback
 * - Liste et sélection des calendriers du compte
 * - Test de lecture seule des événements (vérification sans modification de données)
 * - Compatibilité transparente Electron et mode de secours navigateur
 */

const GoogleSyncManager = {
  status: null,
  calendars: [],
  initialized: false,
  _initPromise: null,
  _queuePromise: null,
  _onlineBound: false,

  async init() {
    if (this._initPromise) {
      await this._initPromise;
      return;
    }
    if (this.initialized) {
      await this.refreshStatus();
      await this.processOfflineQueue();
      return;
    }

    this._initPromise = (async () => {
      this.initialized = true;
      this.bindEvents();
      this.bindOnlineEvents();
      await this.refreshStatus();
      // Traiter la file d'attente hors-ligne au démarrage
      await this.processOfflineQueue();
    })();

    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  },

  bindOnlineEvents() {
    if (this._onlineBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    this._onlineBound = true;
    window.addEventListener('online', async () => {
      console.log("[GoogleSync] Connexion rétablie : traitement de la file d'attente hors-ligne...");
      await this.processOfflineQueue();
      await this.syncCalendarNow(true);
    });
  },

  bindEvents() {
    // 1. Bascule d'affichage du formulaire Client ID / Secret (Affectation idempotente onclick)
    const toggleCreds = document.getElementById('btn-toggle-google-creds');
    const credsForm = document.getElementById('google-creds-form');
    if (toggleCreds && credsForm) {
      toggleCreds.onclick = (e) => {
        e.preventDefault();
        const isHidden = credsForm.style.display === 'none' || !credsForm.style.display;
        credsForm.style.display = isHidden ? 'block' : 'none';
        toggleCreds.textContent = isHidden ? 'Masquer la configuration' : 'Configurer Client ID / Secret';
        if (isHidden) {
          const clientIdInput = document.getElementById('google-input-client-id');
          if (clientIdInput) clientIdInput.focus();
        }
      };
    }

    // 2. Bascule visibilité du secret (Mot de passe / Texte clair)
    const toggleSecret = document.getElementById('btn-toggle-secret-visibility');
    const secretInput = document.getElementById('google-input-client-secret');
    if (toggleSecret && secretInput) {
      toggleSecret.onclick = (e) => {
        e.preventDefault();
        const isPass = secretInput.type === 'password';
        secretInput.type = isPass ? 'text' : 'password';
        toggleSecret.innerHTML = isPass
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      };
    }

    // 3. Bouton Enregistrer les identifiants
    const btnSaveCreds = document.getElementById('btn-save-google-creds');
    if (btnSaveCreds) {
      btnSaveCreds.onclick = (e) => {
        e.preventDefault();
        this.saveCredentials();
      };
    }

    // 4. Bouton Se connecter avec Google
    const btnLogin = document.getElementById('btn-google-login');
    if (btnLogin) {
      btnLogin.onclick = (e) => {
        e.preventDefault();
        this.startLogin();
      };
    }

    // 5. Bouton Déconnecter
    const btnLogout = document.getElementById('btn-google-logout');
    if (btnLogout) {
      btnLogout.onclick = (e) => {
        e.preventDefault();
        this.disconnect();
      };
    }

    // 6. Sélecteur de calendrier
    const calSelect = document.getElementById('google-calendar-select');
    if (calSelect) {
      calSelect.onchange = (e) => {
        this.selectCalendar(e.target.value);
      };
    }

    // 7. Bouton tester la lecture (Phase 2)
    const btnTest = document.getElementById('btn-google-test-fetch');
    if (btnTest) {
      btnTest.onclick = (e) => {
        e.preventDefault();
        this.testFetchEvents();
      };
    }

    // 8. Indicateur dans l'en-tête de l'Agenda
    const agendaIndicator = document.getElementById('agenda-google-indicator');
    if (agendaIndicator) {
      agendaIndicator.onclick = (e) => {
        e.preventDefault();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('settings');
          setTimeout(() => {
            const googleSec = document.getElementById('settings-section-google');
            if (googleSec) googleSec.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      };
    }
  },

  // Récupérer et rafraîchir l'état de connexion
  async refreshStatus() {
    // Mode Electron
    if (window.AntigraviteAPI && window.AntigraviteAPI.google) {
      try {
        this.status = await window.AntigraviteAPI.google.getStatus();
        this.renderStatus(this.status);

        if (this.status.isConnected) {
          await this.loadCalendars();
        }
        return;
      } catch (err) {
        console.warn("Erreur lecture statut Google via Electron IPC:", err);
      }
    }

    // Mode Secours Navigateur (Edge / Chrome sans Electron)
    try {
      const rawFallback = localStorage.getItem('antigravite_google_creds_fallback');
      if (rawFallback) {
        const parsed = JSON.parse(rawFallback);
        this.status = {
          hasCredentials: true,
          clientIdMasked: parsed.clientId ? `${parsed.clientId.slice(0, 14)}...` : null,
          isConnected: false,
          browserMode: true
        };
        const idInput = document.getElementById('google-input-client-id');
        const secInput = document.getElementById('google-input-client-secret');
        if (idInput && !idInput.value) idInput.value = parsed.clientId || '';
        if (secInput && !secInput.value) secInput.value = parsed.clientSecret || '';
      } else {
        this.status = {
          hasCredentials: false,
          clientIdMasked: null,
          isConnected: false,
          browserMode: true
        };
      }
    } catch {
      this.status = { hasCredentials: false, isConnected: false, browserMode: true };
    }

    this.renderStatus(this.status);
  },

  renderStatus(status) {
    if (!status) return;

    const badge = document.getElementById('google-connection-badge');
    const userEmailEl = document.getElementById('google-user-email');
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-google-logout');
    const calRow = document.getElementById('google-calendar-selection-row');
    const testSection = document.getElementById('google-test-fetch-section');
    const agendaIndicator = document.getElementById('agenda-google-indicator');
    const credsSummary = document.getElementById('google-creds-summary');
    const toggleCreds = document.getElementById('btn-toggle-google-creds');

    if (badge) {
      if (status.isConnected) {
        badge.className = 'status-chip status-connected';
        badge.innerHTML = `<span class="status-dot status-dot-connected" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--success);"></span> <span>Connecté : <strong>${status.userEmail || 'Compte Google'}</strong></span>`;
      } else if (status.hasCredentials) {
        badge.className = 'status-chip status-configured';
        badge.innerHTML = `<span class="status-dot status-dot-configured" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--warning);"></span> <span>Identifiants configurés • Prêt à connecter</span>`;
      } else {
        badge.className = 'status-chip status-disconnected';
        badge.innerHTML = `<span class="status-dot status-dot-disconnected" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:var(--text-dim);"></span> <span>Non connecté</span>`;
      }
    }

    if (credsSummary) {
      if (status.hasCredentials) {
        credsSummary.innerHTML = `Identifiants Google Cloud mémorisés (Client ID: <code>${status.clientIdMasked || '***'}</code>)`;
        if (toggleCreds) toggleCreds.textContent = 'Modifier Client ID / Secret';
      } else {
        credsSummary.textContent = "Aucun identifiant Google Cloud enregistré pour le moment.";
        if (toggleCreds) toggleCreds.textContent = 'Configurer Client ID / Secret';
      }
    }

    if (userEmailEl) {
      userEmailEl.textContent = status.userEmail ? `Compte Google connecté : ${status.userEmail}` : '';
    }

    if (btnLogin) {
      btnLogin.style.display = status.isConnected ? 'none' : 'inline-flex';
      btnLogin.disabled = !status.hasCredentials;
      if (!status.hasCredentials) {
        btnLogin.title = "Veuillez d'abord renseigner vos identifiants Client ID et Client Secret";
      } else {
        btnLogin.title = "Ouvre votre navigateur pour autoriser Antigravité";
      }
    }

    if (btnLogout) {
      btnLogout.style.display = status.isConnected ? 'inline-flex' : 'none';
    }

    if (calRow) {
      calRow.style.display = status.isConnected ? 'flex' : 'none';
    }

    if (testSection) {
      testSection.style.display = status.isConnected ? 'block' : 'none';
    }

    // Mise à jour de la pastille dans l'en-tête de l'Agenda
    if (agendaIndicator) {
      if (status.isConnected) {
        agendaIndicator.className = 'google-sync-indicator connected';
        agendaIndicator.title = `Google Agenda connecté (${status.userEmail || ''}) • Calendrier : ${status.selectedCalendarSummary || 'Principal'}`;
        agendaIndicator.innerHTML = `
          <span class="sync-dot connected"></span>
          <span>Google : <strong>${this.escapeHtml(status.selectedCalendarSummary || 'Principal')}</strong></span>
        `;
      } else {
        agendaIndicator.className = 'google-sync-indicator disconnected';
        agendaIndicator.title = "Google Agenda non connecté. Cliquez pour configurer dans les Paramètres.";
        agendaIndicator.innerHTML = `
          <span class="sync-dot"></span>
          <span>Google Agenda (Non connecté)</span>
        `;
      }
    }

    this.updateOfflineBadge();
  },

  async saveCredentials() {
    const clientIdInput = document.getElementById('google-input-client-id');
    const clientSecretInput = document.getElementById('google-input-client-secret');
    if (!clientIdInput || !clientSecretInput) return;

    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();

    if (!clientId || !clientSecret) {
      alert("Veuillez saisir à la fois le Client ID et le Client Secret.");
      return;
    }

    // Mode Electron
    if (window.AntigraviteAPI && window.AntigraviteAPI.google) {
      try {
        this.status = await window.AntigraviteAPI.google.saveCredentials(clientId, clientSecret);
        this.renderStatus(this.status);
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Identifiants Google Cloud enregistrés avec succès", "success");
        }

        const credsForm = document.getElementById('google-creds-form');
        if (credsForm) credsForm.style.display = 'none';
        return;
      } catch (err) {
        alert(`Erreur enregistrement : ${err.message}`);
        return;
      }
    }

    // Mode Secours Navigateur
    try {
      localStorage.setItem('antigravite_google_creds_fallback', JSON.stringify({ clientId, clientSecret }));
      this.status = {
        hasCredentials: true,
        clientIdMasked: `${clientId.slice(0, 14)}...`,
        isConnected: false,
        browserMode: true
      };
      this.renderStatus(this.status);

      const credsForm = document.getElementById('google-creds-form');
      if (credsForm) credsForm.style.display = 'none';

      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Identifiants enregistrés localement", "success");
      }
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  },

  async startLogin() {
    // Si exécuté dans un navigateur web standard
    if (!window.AntigraviteAPI || !window.AntigraviteAPI.google) {
      alert(
        "Mode Navigateur détecté (Microsoft Edge) :\n\n" +
        "L'authentification Google OAuth 2.0 pour application de bureau (avec serveur local loopback sur 127.0.0.1 et chiffrement sécurisé Windows DPAPI) nécessite l'environnement Electron.\n\n" +
        "Pour vous connecter, lancez Antigravité via le lanceur Electron ou la commande 'npm start'."
      );
      return;
    }

    const btnLogin = document.getElementById('btn-google-login');
    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.innerHTML = `<span>⏳</span> <span>Connexion dans le navigateur...</span>`;
    }

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Ouverture de votre navigateur pour validation...", "info");
    }

    try {
      this.status = await window.AntigraviteAPI.google.startLogin();
      this.renderStatus(this.status);
      if (this.status.isConnected) {
        await this.loadCalendars();
        // Synchroniser immédiatement les événements dans l'agenda
        await this.syncCalendarNow(false);
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Connecté avec succès à Google (${this.status.userEmail})`, "success");
      }
    } catch (err) {
      alert(`Échec de la connexion à Google :\n${err.message}`);
    } finally {
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> <span>Se connecter avec Google</span>`;
      }
    }
  },

  async disconnect() {
    let shouldDisconnect = true;
    if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
      shouldDisconnect = await window.App.confirm({
        title: "Déconnexion Google Agenda",
        message: "Déconnecter votre compte Google Agenda d'Antigravité ?\n(Vos événements créés localement resteront intacts).",
        confirmText: "Déconnecter le compte",
        danger: true,
        icon: "🔗"
      });
    } else if (typeof confirm === 'function') {
      shouldDisconnect = confirm("Déconnecter votre compte Google Agenda d'Antigravité ?\n(Vos événements créés localement resteront intacts).");
    }
    if (!shouldDisconnect) return;

    // Retirer les événements Google du calendrier actif d'Antigravité et nettoyer les liens notes orphelins
    const currentEvents = StorageManager.getEvents();
    const removedIds = new Set(currentEvents.filter(e => e.source === 'google').map(e => e.id));
    const localEventsOnly = currentEvents.filter(e => e.source !== 'google');
    StorageManager.saveEvents(localEventsOnly);
    this._cleanupRemovedEventLinks(removedIds, { clearTaskSchedule: false });
    if (window.AgendaManager) window.AgendaManager.render();

    if (window.AntigraviteAPI && window.AntigraviteAPI.google) {
      try {
        this.status = await window.AntigraviteAPI.google.disconnect();
        this.renderStatus(this.status);
        const resultBox = document.getElementById('google-test-fetch-results');
        if (resultBox) resultBox.style.display = 'none';

        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Compte Google déconnecté", "info");
        }
        return;
      } catch (err) {
        alert(`Erreur lors de la déconnexion : ${err.message}`);
        return;
      }
    }

    // Mode Navigateur
    localStorage.removeItem('antigravite_google_creds_fallback');
    this.status = { hasCredentials: false, isConnected: false, browserMode: true };
    this.renderStatus(this.status);
  },

  async loadCalendars() {
    const calSelect = document.getElementById('google-calendar-select');
    if (!calSelect || !window.AntigraviteAPI?.google) return;

    try {
      this.calendars = await window.AntigraviteAPI.google.listCalendars();
      calSelect.innerHTML = '';

      this.calendars.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.summary}${c.primary ? ' (Principal)' : ''}`;
        if (c.id === (this.status?.selectedCalendarId || 'primary') || (c.primary && this.status?.selectedCalendarId === 'primary')) {
          opt.selected = true;
        }
        calSelect.appendChild(opt);
      });
    } catch (err) {
      console.warn("Impossible de lister les calendriers:", err.message);
    }
  },

  async selectCalendar(calendarId) {
    if (!window.AntigraviteAPI?.google) return;

    const selectedObj = this.calendars.find(c => c.id === calendarId);
    const summary = selectedObj ? selectedObj.summary : calendarId;

    try {
      this.status = await window.AntigraviteAPI.google.selectCalendar(calendarId, summary);
      this.renderStatus(this.status);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Calendrier synchronisé : ${summary}`, "info");
      }
      // Actualiser immédiatement les événements pour le nouveau calendrier choisi
      await this.syncCalendarNow(false);
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  },

  // =========================================================================
  // SYNCHRONISATION DES ÉVÉNEMENTS DANS L'AGENDA (PHASE 3)
  // =========================================================================

  _isSyncing: false,
  _lastSyncSuccessAt: 0,

  async syncCalendarNow(silent = false) {
    if (this._isSyncing) return;

    // Éviter les actualisations réseau redondantes en arrière-plan lorsque l'utilisateur bascule entre les écrans
    const now = Date.now();
    if (silent && this._lastSyncSuccessAt && (now - this._lastSyncSuccessAt < 30000)) {
      return;
    }

    if (!window.AntigraviteAPI || !window.AntigraviteAPI.google) {
      if (!silent && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Mode hors-ligne (Navigateur)", "info");
      }
      return;
    }

    if (!this.status || !this.status.isConnected) {
      if (!silent && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Google Agenda non connecté", "info");
      }
      return;
    }

    this._isSyncing = true;
    const syncBtn = document.getElementById('btn-sync-calendar');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.classList.add('syncing');
      syncBtn.innerHTML = `<span>⏳</span> <span>Actualisation...</span>`;
    }

    try {
      // 1. Dépiler d'abord les actions hors-ligne locales en attente
      await this.processOfflineQueue();

      const result = await window.AntigraviteAPI.google.fetchEvents({
        useSyncToken: true,
        maxResults: 250
      });

      this._lastSyncSuccessAt = Date.now();

      if (result && Array.isArray(result.events)) {
        const isIncremental = result.isIncremental !== false;
        if (isIncremental && result.events.length === 0) {
          // Aucun changement côté Google : éviter toute écriture disque inutile
          if (!silent && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Agenda déjà à jour", "info");
          }
          return;
        }

        this.mergeGoogleEvents(result.events, isIncremental);

        if (window.AgendaManager) {
          window.AgendaManager.render();
        }

        if (window.App && typeof window.App.updateDashboard === 'function') {
          window.App.updateDashboard();
        }

        if (!silent && window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Agenda actualisé (${result.totalCount} créneaux Google)`, "success");
        }
      }
    } catch (err) {
      console.warn("Échec synchronisation automatique:", err.message);
      if (!silent && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Synchronisation Google : ${err.message}`, "error");
      }
    } finally {
      this._isSyncing = false;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.classList.remove('syncing');
        syncBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> <span>Actualiser</span>`;
      }
    }
  },

  _cleanupRemovedEventLinks(removedEventIds, { clearTaskSchedule = true, remainingEvents = null } = {}) {
    if (!removedEventIds || removedEventIds.size === 0) return;

    // 1. Détacher les notes liées aux événements supprimés / annulés
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function') {
      try {
        const notes = StorageManager.getNotes();
        let notesChanged = false;
        notes.forEach(n => {
          if (n && n.linkedEventId && removedEventIds.has(n.linkedEventId)) {
            n.linkedEventId = null;
            n.updatedAt = new Date().toISOString();
            notesChanged = true;
          }
        });
        if (notesChanged && typeof StorageManager.saveNotes === 'function') {
          StorageManager.saveNotes(notes);
          if (typeof window !== 'undefined' && window.NotesManager) {
            if (typeof window.NotesManager.renderNotesList === 'function') window.NotesManager.renderNotesList();
            if (typeof window.NotesManager.renderEventSelector === 'function' && window.NotesManager.currentNoteId) {
              const cur = notes.find(n => n.id === window.NotesManager.currentNoteId);
              if (cur) window.NotesManager.renderEventSelector(cur);
            }
          }
        }
      } catch (err) {
        console.warn("Erreur nettoyage linkedEventId sur notes :", err);
      }
    }

    // 2. Si demandé et qu'aucun autre créneau ne reste lié à une tâche, nettoyer plannedDate/plannedTime (sans jamais supprimer la tâche)
    if (clearTaskSchedule && typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function') {
      try {
        const evts = Array.isArray(remainingEvents) ? remainingEvents : StorageManager.getEvents();
        const activeTaskLinks = new Set(evts.map(e => e && e.taskId).filter(Boolean));
        // Rempli par l'appelant si knownTaskIds fourni, ou vérification globale des orphelins
        if (this._pendingRemovedTaskIds && this._pendingRemovedTaskIds.size > 0) {
          const tasks = StorageManager.getTasks();
          let tasksChanged = false;
          const clearRecursive = (list) => {
            if (!Array.isArray(list)) return;
            for (const t of list) {
              if (!t) continue;
              if (this._pendingRemovedTaskIds.has(t.id) && !activeTaskLinks.has(t.id) && (t.plannedDate || t.plannedTime)) {
                t.plannedDate = null;
                t.plannedTime = null;
                t.updatedAt = new Date().toISOString();
                tasksChanged = true;
              }
              if (Array.isArray(t.subtasks)) clearRecursive(t.subtasks);
            }
          };
          clearRecursive(tasks);
          if (tasksChanged && typeof StorageManager.saveTasks === 'function') {
            StorageManager.saveTasks(tasks);
            if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.render === 'function') {
              window.TasksManager.render();
            }
          }
        }
      } catch (err) {
        console.warn("Erreur nettoyage horaire tâches liées :", err);
      }
    }
    this._pendingRemovedTaskIds = null;
  },

  mergeGoogleEvents(googleEvents, isIncremental = false) {
    const currentEvents = StorageManager.getEvents();
    if (isIncremental && (!googleEvents || googleEvents.length === 0)) {
      return currentEvents;
    }

    // Conserver tous les événements locaux purs
    const localEvents = currentEvents.filter(e => e.source !== 'google');

    // Indexer les événements Google déjà présents dans le cache local
    const existingGoogleMap = new Map();
    currentEvents.filter(e => e.source === 'google').forEach(e => {
      existingGoogleMap.set(e.googleId, e);
    });

    const updatedGoogleList = [];
    const returnedGoogleIds = new Set();
    const removedIds = new Set();
    const removedTaskIds = new Set();
    const rescheduledLinkedEvents = [];

    googleEvents.forEach(gEvt => {
      returnedGoogleIds.add(gEvt.googleId);

      // Si l'événement a été supprimé sur Google Calendar
      if (gEvt.status === 'cancelled') {
        const old = existingGoogleMap.get(gEvt.googleId);
        if (old) {
          removedIds.add(old.id);
          if (old.taskId) removedTaskIds.add(old.taskId);
        }
        return; // Retiré de la vue locale
      }

      const existing = existingGoogleMap.get(gEvt.googleId);
      if (existing) {
        // Conserver les métadonnées locales (ex: tâche, note ou projet Antigravité rattaché)
        gEvt.taskId = existing.taskId || gEvt.taskId || null;
        gEvt.noteId = existing.noteId || gEvt.noteId || null;
        if (existing.projectId && !gEvt.projectId) gEvt.projectId = existing.projectId;
        gEvt.id = existing.id;

        if (
          gEvt.taskId &&
          gEvt.start &&
          (existing.start !== gEvt.start || existing.end !== gEvt.end || !!existing.isAllDay !== !!gEvt.isAllDay)
        ) {
          rescheduledLinkedEvents.push(gEvt);
        }
      }

      updatedGoogleList.push(gEvt);
    });

    // En mode incrémental, préserver les événements existants non retournés ; en mode complet, détecter ceux disparus
    if (isIncremental) {
      existingGoogleMap.forEach((oldEvt, gId) => {
        if (!returnedGoogleIds.has(gId)) {
          updatedGoogleList.push(oldEvt);
        }
      });
    } else {
      existingGoogleMap.forEach((oldEvt, gId) => {
        if (!returnedGoogleIds.has(gId)) {
          removedIds.add(oldEvt.id);
          if (oldEvt.taskId) removedTaskIds.add(oldEvt.taskId);
        }
      });
    }

    const allMerged = [...localEvents, ...updatedGoogleList];
    StorageManager.saveEvents(allMerged);

    if (removedIds.size > 0) {
      this._pendingRemovedTaskIds = removedTaskIds;
      this._cleanupRemovedEventLinks(removedIds, { clearTaskSchedule: true, remainingEvents: allMerged });
    }

    // Répercuter sur les tâches liées les créneaux déplacés directement côté Google Calendar
    if (rescheduledLinkedEvents.length > 0 && typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.syncEventDateToTask === 'function') {
      rescheduledLinkedEvents.forEach(ev => {
        const startTime = !ev.isAllDay && ev.start && ev.start.length >= 16 ? ev.start.slice(11, 16) : null;
        window.AgendaManager.syncEventDateToTask(ev.taskId, ev.start.slice(0, 10), startTime);
      });
    }

    return allMerged;
  },

  // =========================================================================
  // GESTION HORS-LIGNE & ROBUSTESSE (PHASE 5)
  // =========================================================================

  QUEUE_KEY: 'antigravite_google_sync_queue',

  getOfflineQueue() {
    try {
      const raw = localStorage.getItem(this.QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveOfflineQueue(queue) {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      this.updateOfflineBadge();
    } catch (e) {
      console.warn("Échec sauvegarde file hors-ligne :", e);
    }
  },

  enqueueOfflineAction(action, payload) {
    const queue = this.getOfflineQueue();
    queue.push({
      id: 'qa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      action,
      payload,
      createdAt: new Date().toISOString()
    });
    this.saveOfflineQueue(queue);
  },

  updateOfflineBadge() {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('google-offline-queue-badge');
    const queue = this.getOfflineQueue();
    if (badge) {
      if (queue.length > 0) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<span>⏳</span> <span><strong>${queue.length}</strong> synchronisation${queue.length > 1 ? 's' : ''} différée${queue.length > 1 ? 's' : ''}</span>`;
      } else {
        badge.style.display = 'none';
      }
    }
  },

  isNetworkError(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    return err.name === 'TypeError' ||
           msg.includes('fetch failed') ||
           msg.includes('network') ||
           msg.includes('timeout') ||
           msg.includes('enotfound') ||
           msg.includes('econnrefused') ||
           msg.includes('etimedout') ||
           msg.includes('offline') ||
           msg.includes('connexion');
  },

  _isPermanentQueueError(err) {
    if (!err || this.isNetworkError(err)) return false;
    const status = Number(err.status);
    if (status === 404 || status === 410) return true;
    if (status === 401 || status === 403 || status === 429 || (status >= 500 && status < 600)) {
      return false;
    }
    const msg = (err.message || '').toLowerCase();
    if (err.code === 'INVALID_GRANT' || err.code === 'CONFLICT') return false;
    if (msg.includes('invalid_grant') || msg.includes('reconnecter') || msg.includes('non connecté') || msg.includes('session') || msg.includes('rate limit') || msg.includes('quota')) {
      return false;
    }
    return status === 400;
  },

  _relinkNoteEventId(oldEventId, newEventId) {
    if (!oldEventId || !newEventId || oldEventId === newEventId || typeof StorageManager === 'undefined') return;
    if (typeof StorageManager.getNotes !== 'function' || typeof StorageManager.saveNotes !== 'function') return;
    const notes = StorageManager.getNotes();
    let changed = false;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i] && notes[i].linkedEventId === oldEventId) {
        notes[i].linkedEventId = newEventId;
        changed = true;
      }
    }
    if (changed) {
      StorageManager.saveNotes(notes);
      if (window.NotesManager && typeof window.NotesManager.renderNotesList === 'function') {
        window.NotesManager.renderNotesList();
      }
    }
  },

  async processOfflineQueue() {
    if (this._queuePromise) {
      return this._queuePromise;
    }

    this._queuePromise = (async () => {
      const queue = this.getOfflineQueue();
      if (!queue || queue.length === 0) return 0;
      if (!this.status || !this.status.isConnected) return 0;
      if (!window.AntigraviteAPI?.google) return 0;

      const handledIds = new Set();
      const failedKeepMap = new Map();
      const createdIdMap = new Map();
      let processedCount = 0;

      for (const item of queue) {
        try {
          if (item.action === 'delete') {
            const targetGoogleId = item.payload.googleId || createdIdMap.get(item.payload.tempId);
            if (!targetGoogleId) {
              handledIds.add(item.id);
              continue;
            }
            await window.AntigraviteAPI.google.deleteEvent(targetGoogleId, item.payload.calendarId);
            handledIds.add(item.id);
            processedCount++;
          } else if (item.action === 'create') {
            const created = await window.AntigraviteAPI.google.createEvent({
              ...item.payload.eventData,
              calendarId: item.payload.calendarId || this.status.selectedCalendarId || 'primary'
            });
            created.taskId = created.taskId !== undefined ? created.taskId : (item.payload.eventData.taskId || null);
            created.noteId = created.noteId !== undefined ? created.noteId : (item.payload.eventData.noteId || null);
            if (item.payload.eventData && item.payload.eventData.recurrence && !created.recurrence) {
              created.recurrence = item.payload.eventData.recurrence;
              created.recurrenceEnd = item.payload.eventData.recurrenceEnd || null;
            }
            const events = StorageManager.getEvents();
            const idx = events.findIndex(e => e.id === item.payload.tempId);
            if (idx !== -1) {
              events[idx] = created;
            } else {
              events.push(created);
            }
            StorageManager.saveEvents(events);
            this._relinkNoteEventId(item.payload.tempId, created.id);
            if (item.payload.tempId && created.googleId) {
              createdIdMap.set(item.payload.tempId, created.googleId);
            }
            handledIds.add(item.id);
            processedCount++;
          } else if (item.action === 'update') {
            const targetGoogleId = item.payload.googleId || createdIdMap.get(item.payload.tempId);
            if (!targetGoogleId) {
              failedKeepMap.set(item.id, item);
              continue;
            }
            const updated = await window.AntigraviteAPI.google.updateEvent(
              targetGoogleId,
              item.payload.updatedData,
              item.payload.calendarId,
              null
            );
            const events = StorageManager.getEvents();
            const idx = events.findIndex(e => e.googleId === targetGoogleId || e.id === item.payload.tempId);
            if (idx !== -1) {
              events[idx] = { ...events[idx], ...updated, syncStatus: 'synced' };
              StorageManager.saveEvents(events);
            }
            handledIds.add(item.id);
            processedCount++;
          } else {
            handledIds.add(item.id);
          }
        } catch (err) {
          if (this._isPermanentQueueError(err)) {
            console.warn(`[GoogleSync] Action hors-ligne définitivement écartée (${item.action}) : ${err.message}`);
            handledIds.add(item.id);
          } else {
            console.warn(`[GoogleSync] Action conservée en file (${item.action}) : ${err.message}`);
            failedKeepMap.set(item.id, {
              ...item,
              lastError: err.message || String(err),
              retryCount: (item.retryCount || 0) + 1
            });
          }
        }
      }

      // Fusionner avec la file courante pour ne pas écraser d'actions ajoutées pendant les requêtes réseau
      const latestQueue = this.getOfflineQueue();
      const mergedQueue = [];
      for (const curItem of latestQueue) {
        if (handledIds.has(curItem.id)) continue;
        if (failedKeepMap.has(curItem.id)) {
          mergedQueue.push(failedKeepMap.get(curItem.id));
        } else {
          mergedQueue.push(curItem);
        }
      }

      this.saveOfflineQueue(mergedQueue);
      if (processedCount > 0) {
        if (window.AgendaManager) window.AgendaManager.render();
        if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`File hors-ligne : ${processedCount} modification${processedCount > 1 ? 's' : ''} envoyée${processedCount > 1 ? 's' : ''} à Google`, "success");
        }
      }
      return processedCount;
    })();

    try {
      return await this._queuePromise;
    } finally {
      this._queuePromise = null;
    }
  },

  // =========================================================================
  // CRÉATION, MODIFICATION & SUPPRESSION BIDIRECTIONNELLES (PHASES 4 & 5)
  // =========================================================================

  async createGoogleEvent(eventData) {
    if (!window.AntigraviteAPI || !window.AntigraviteAPI.google) {
      throw new Error("Moteur Electron requis pour la synchronisation Google.");
    }

    if (!this.status || !this.status.isConnected) {
      throw new Error("Compte Google non connecté. Veuillez vous connecter dans les Paramètres.");
    }

    const calendarId = this.status.selectedCalendarId || 'primary';

    try {
      const created = await window.AntigraviteAPI.google.createEvent({
        ...eventData,
        calendarId
      });

      // Insérer dans le stockage local
      const events = StorageManager.getEvents();
      events.push(created);
      StorageManager.saveEvents(events);

      if (window.AgendaManager) {
        window.AgendaManager.render();
      }
      if (window.App && typeof window.App.updateDashboard === 'function') {
        window.App.updateDashboard();
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Événement créé dans Google Agenda", "success");
      }

      return created;
    } catch (err) {
      if (this.isNetworkError(err)) {
        const tempEvt = {
          id: 'evt-g-pending-' + Date.now(),
          googleId: null,
          googleCalendarId: calendarId,
          title: eventData.title || '(Sans titre)',
          description: eventData.description || '',
          location: eventData.location || '',
          start: eventData.start,
          end: eventData.end,
          isAllDay: !!eventData.isAllDay,
          color: eventData.color || '#3b82f6',
          source: 'google',
          status: 'confirmed',
          syncStatus: 'pending_create',
          taskId: eventData.taskId || null,
          noteId: eventData.noteId || null,
          projectId: eventData.projectId || null,
          recurrence: eventData.recurrence || 'none',
          recurrenceEnd: eventData.recurrenceEnd || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const events = StorageManager.getEvents();
        events.push(tempEvt);
        StorageManager.saveEvents(events);

        this.enqueueOfflineAction('create', { tempId: tempEvt.id, eventData, calendarId });

        if (window.AgendaManager) window.AgendaManager.render();
        if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Créneau enregistré (synchronisation Google en attente de réseau)", "warning");
        }

        return tempEvt;
      } else {
        throw err;
      }
    }
  },

  async updateGoogleEvent(localEvt, updatedData) {
    if (!window.AntigraviteAPI || !window.AntigraviteAPI.google) {
      throw new Error("Moteur Electron requis pour la synchronisation Google.");
    }

    if (!this.status || !this.status.isConnected) {
      throw new Error("Compte Google non connecté. Veuillez vous connecter dans les Paramètres.");
    }

    const calendarId = localEvt.googleCalendarId || this.status.selectedCalendarId || 'primary';

    // Événement créé hors-ligne pas encore poussé vers Google : mettre à jour localement + la file 'create'
    if (!localEvt.googleId) {
      const events = StorageManager.getEvents();
      const idx = events.findIndex(e => e.id === localEvt.id);
      if (idx !== -1) {
        events[idx] = {
          ...events[idx],
          ...updatedData,
          syncStatus: 'pending_create',
          updatedAt: new Date().toISOString()
        };
        StorageManager.saveEvents(events);
      }
      const queue = this.getOfflineQueue();
      let patched = false;
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].action === 'create' && queue[i].payload && queue[i].payload.tempId === localEvt.id) {
          queue[i].payload.eventData = { ...queue[i].payload.eventData, ...updatedData };
          patched = true;
        }
      }
      if (patched) {
        this.saveOfflineQueue(queue);
      } else {
        this.enqueueOfflineAction('create', {
          tempId: localEvt.id,
          eventData: { ...localEvt, ...updatedData },
          calendarId
        });
      }
      if (window.AgendaManager) window.AgendaManager.render();
      if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        await this.processOfflineQueue();
      } else if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Modifications enregistrées localement (en attente de réseau)", "warning");
      }
      const latestEvents = StorageManager.getEvents();
      return latestEvents.find(e => e.id === localEvt.id || e.title === updatedData.title) || events[idx];
    }

    try {
      const updated = await window.AntigraviteAPI.google.updateEvent(
        localEvt.googleId,
        updatedData,
        calendarId,
        localEvt.googleEtag || null
      );

      // Mettre à jour l'événement local en mémoire et persistance
      const events = StorageManager.getEvents();
      const idx = events.findIndex(e => e.id === localEvt.id);
      if (idx !== -1) {
        events[idx] = {
          ...events[idx],
          ...updated,
          syncStatus: 'synced',
          taskId: updatedData.taskId !== undefined ? updatedData.taskId : events[idx].taskId,
          noteId: updatedData.noteId !== undefined ? updatedData.noteId : events[idx].noteId,
          projectId: updatedData.projectId !== undefined ? updatedData.projectId : (events[idx].projectId || null)
        };
      } else {
        events.push(updated);
      }
      StorageManager.saveEvents(events);

      if (window.AgendaManager) {
        window.AgendaManager.render();
      }
      if (window.App && typeof window.App.updateDashboard === 'function') {
        window.App.updateDashboard();
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Événement mis à jour dans Google Agenda", "success");
      }

      return updated;
    } catch (err) {
      // Gestion des conflits concurrents (ETag / Precondition Failed)
      const isConflict = err && (err.code === 'CONFLICT' || (typeof err.message === 'string' && err.message.includes('[CONFLICT]')));
      if (isConflict) {
        const conflictMsg =
          "Cet événement a été modifié directement sur Google Agenda depuis votre dernière synchronisation.\n\n" +
          "Voulez-vous écraser la version Google avec vos modifications locales ? Sinon, la version la plus récente de Google Agenda sera récupérée.";
        const force = (window.App && typeof window.App.confirm === 'function')
          ? await window.App.confirm({
              title: 'Conflit de synchronisation Google Agenda',
              message: conflictMsg,
              confirmText: 'Écraser par mes modifs',
              cancelText: 'Récupérer Google',
              danger: true
            })
          : (typeof confirm === 'function' ? confirm("⚠️ Conflit de synchronisation détecté !\n\n" + conflictMsg) : false);

        if (force) {
          const forced = await window.AntigraviteAPI.google.updateEvent(
            localEvt.googleId,
            updatedData,
            calendarId,
            null
          );
          const events = StorageManager.getEvents();
          const idx = events.findIndex(e => e.id === localEvt.id);
          if (idx !== -1) {
            events[idx] = { ...events[idx], ...forced, syncStatus: 'synced' };
            StorageManager.saveEvents(events);
          }
          if (window.AgendaManager) window.AgendaManager.render();
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Conflit résolu : version locale appliquée", "success");
          }
          return forced;
        } else {
          await this.syncCalendarNow(false);
          return null;
        }
      }

      if (this.isNetworkError(err)) {
        const events = StorageManager.getEvents();
        const idx = events.findIndex(e => e.id === localEvt.id);
        if (idx !== -1) {
          events[idx] = {
            ...events[idx],
            ...updatedData,
            syncStatus: 'pending_update',
            updatedAt: new Date().toISOString()
          };
          StorageManager.saveEvents(events);
        }

        this.enqueueOfflineAction('update', {
          googleId: localEvt.googleId,
          tempId: localEvt.id,
          updatedData,
          calendarId
        });

        if (window.AgendaManager) window.AgendaManager.render();
        if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Modifications enregistrées localement (synchronisation Google différée)", "warning");
        }

        return events[idx];
      } else {
        throw err;
      }
    }
  },

  async deleteGoogleEvent(localEvt) {
    if (!window.AntigraviteAPI || !window.AntigraviteAPI.google) {
      this.removeLocalEvent(localEvt.id);
      return;
    }

    if (!this.status || !this.status.isConnected) {
      this.removeLocalEvent(localEvt.id);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Compte Google non connecté : créneau supprimé localement.", "info");
      }
      return;
    }

    // Si l'événement n'a jamais atteint Google (création hors-ligne), annuler les actions locales en attente sans appel réseau
    if (!localEvt.googleId) {
      const queue = this.getOfflineQueue();
      const filteredQueue = queue.filter(item => !(item && item.payload && item.payload.tempId === localEvt.id));
      if (filteredQueue.length !== queue.length) {
        this.saveOfflineQueue(filteredQueue);
      }
      this.removeLocalEvent(localEvt.id);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Créneau Google non synchronisé supprimé.", "info");
      }
      return;
    }

    const calendarId = localEvt.googleCalendarId || this.status.selectedCalendarId || 'primary';
    let deletedRemotely = false;

    try {
      await window.AntigraviteAPI.google.deleteEvent(localEvt.googleId, calendarId);
      deletedRemotely = true;
    } catch (err) {
      if (this.isNetworkError(err) || !this._isPermanentQueueError(err)) {
        this.enqueueOfflineAction('delete', {
          googleId: localEvt.googleId,
          calendarId
        });
      } else {
        throw err;
      }
    }

    // Retirer l'événement du cache local d'Antigravité
    this.removeLocalEvent(localEvt.id);

    if (window.App && typeof window.App.showToast === 'function') {
      if (deletedRemotely) {
        window.App.showToast("Événement supprimé de Google Agenda", "info");
      } else {
        window.App.showToast("Événement supprimé localement (suppression Google différée)", "warning");
      }
    }
  },

  removeLocalEvent(id) {
    const events = StorageManager.getEvents();
    const target = events.find(e => e.id === id);
    const filtered = events.filter(e => e.id !== id);
    StorageManager.saveEvents(filtered);

    if (target) {
      this._pendingRemovedTaskIds = target.taskId ? new Set([target.taskId]) : null;
      this._cleanupRemovedEventLinks(new Set([id]), { clearTaskSchedule: true, remainingEvents: filtered });
    }

    if (window.AgendaManager) {
      window.AgendaManager.render();
    }
    if (window.App && typeof window.App.updateDashboard === 'function') {
      window.App.updateDashboard();
    }
  },

  // Test de lecture seule des événements (Phase 2)
  async testFetchEvents() {
    const btnTest = document.getElementById('btn-google-test-fetch');
    const resultBox = document.getElementById('google-test-fetch-results');
    if (!resultBox) return;

    if (!window.AntigraviteAPI?.google) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div style="background: var(--warning-light); border: 1px solid var(--warning); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 10px; color: var(--warning); font-size: 0.85rem;">
          <strong>ℹ️ Mode Navigateur :</strong> Veuillez ouvrir Antigravité avec Electron pour exécuter la lecture réelle de l'API Google Calendar.
        </div>
      `;
      return;
    }

    if (btnTest) {
      btnTest.disabled = true;
      btnTest.innerHTML = `<span>⏳</span> <span>Lecture Google Calendar API...</span>`;
    }

    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div style="padding: 12px; color: var(--text-dim); font-size: 0.84rem;">Récupération sécurisée des événements en cours...</div>`;

    try {
      const result = await window.AntigraviteAPI.google.fetchEvents({ maxResults: 100, persistSyncState: false });
      const count = result.totalCount;
      const previewList = result.events.slice(0, 6);

      let html = `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-top: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color: var(--success);">✅ Test de lecture réussi (${count} événement${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''})</strong>
            <span style="font-size:0.75rem; color:var(--text-dim);">Lecture seule stricte (Phase 2)</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom: 8px;">
            Calendrier cible : <code>${this.escapeHtml(result.calendarId)}</code> • Actualisé à : ${new Date().toLocaleTimeString()}
          </div>
      `;

      if (previewList.length > 0) {
        html += `<div style="font-size:0.8rem; font-weight:600; margin-bottom:6px; color:var(--text-main);">Exemples d'événements lus depuis Google Agenda :</div><ul style="margin:0; padding-left:18px; font-size:0.82rem; color:var(--text-muted); line-height: 1.5;">`;
        previewList.forEach(e => {
          const dateStr = e.start ? e.start.replace('T', ' à ') : 'Date non spécifiée';
          html += `<li style="margin-bottom:4px;"><strong>${this.escapeHtml(e.title)}</strong> (${dateStr}) ${e.isAllDay ? '<span class="badge badge-planned">Journée</span>' : ''}</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<div style="font-size:0.8rem; color:var(--text-dim); font-style:italic;">Aucun événement présent dans ce calendrier sur la période analysée.</div>`;
      }

      html += `</div>`;
      resultBox.innerHTML = html;
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Lecture réussie : ${count} événements récupérés`, "success");
      }
    } catch (err) {
      resultBox.innerHTML = `
        <div style="background: var(--danger-light); border: 1px solid var(--danger); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 10px; color: var(--danger); font-size: 0.85rem;">
          <strong>❌ Échec de lecture Google Calendar :</strong> ${this.escapeHtml(err.message)}
        </div>
      `;
    } finally {
      if (btnTest) {
        btnTest.disabled = false;
        btnTest.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> <span>Tester la lecture des événements (Lecture seule)</span>`;
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

// Exposer globalement pour inter-modules
if (typeof window !== 'undefined') {
  window.GoogleSyncManager = GoogleSyncManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSyncManager;
}

// Initialisation autonome uniquement si App ne pilote pas le démarrage
if (typeof document !== 'undefined') {
  const initIfStandalone = () => {
    if (typeof window === 'undefined' || !window.App) {
      GoogleSyncManager.init();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIfStandalone);
  } else {
    initIfStandalone();
  }
}
