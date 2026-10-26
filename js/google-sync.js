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

  async init() {
    if (this.initialized) {
      await this.refreshStatus();
      return;
    }
    this.initialized = true;
    this.bindEvents();
    this.bindOnlineEvents();
    await this.refreshStatus();
    // Traiter la file d'attente hors-ligne au démarrage
    await this.processOfflineQueue();
  },

  bindOnlineEvents() {
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
        toggleSecret.textContent = isPass ? '🙈' : '👁️';
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
        badge.innerHTML = `<span>🟢</span> <span>Connecté : <strong>${status.userEmail || 'Compte Google'}</strong></span>`;
      } else if (status.hasCredentials) {
        badge.className = 'status-chip status-configured';
        badge.innerHTML = `<span>🟡</span> <span>Identifiants configurés • Prêt à connecter</span>`;
      } else {
        badge.className = 'status-chip status-disconnected';
        badge.innerHTML = `<span>⚪</span> <span>Non connecté</span>`;
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
        btnLogin.innerHTML = `<span>🌐</span> <span>Se connecter avec Google</span>`;
      }
    }
  },

  async disconnect() {
    if (!confirm("Déconnecter votre compte Google Agenda d'Antigravité ?\n(Vos événements créés localement resteront intacts).")) return;

    // Retirer les événements Google du calendrier actif d'Antigravité
    const currentEvents = StorageManager.getEvents();
    const localEventsOnly = currentEvents.filter(e => e.source !== 'google');
    StorageManager.saveEvents(localEventsOnly);
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

      if (result && result.events) {
        if (result.events.length === 0) {
          // Aucun changement côté Google : éviter toute écriture disque inutile
          if (!silent && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Agenda déjà à jour", "info");
          }
          return;
        }

        this.mergeGoogleEvents(result.events, true);

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
        syncBtn.innerHTML = `<span>🔄</span> <span>Actualiser</span>`;
      }
    }
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

    googleEvents.forEach(gEvt => {
      returnedGoogleIds.add(gEvt.googleId);

      // Si l'événement a été supprimé sur Google Calendar
      if (gEvt.status === 'cancelled') {
        return; // Retiré de la vue locale
      }

      const existing = existingGoogleMap.get(gEvt.googleId);
      if (existing) {
        // Conserver les métadonnées locales (ex: tâche ou note Antigravité rattachée)
        gEvt.taskId = existing.taskId || gEvt.taskId || null;
        gEvt.noteId = existing.noteId || gEvt.noteId || null;
        gEvt.id = existing.id;
      }

      updatedGoogleList.push(gEvt);
    });

    // En mode incrémental, préserver les événements existants non retournés
    if (isIncremental) {
      existingGoogleMap.forEach((oldEvt, gId) => {
        if (!returnedGoogleIds.has(gId)) {
          updatedGoogleList.push(oldEvt);
        }
      });
    }

    const allMerged = [...localEvents, ...updatedGoogleList];
    StorageManager.saveEvents(allMerged);
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
    if (!navigator.onLine) return true;
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

  async processOfflineQueue() {
    const queue = this.getOfflineQueue();
    if (!queue || queue.length === 0) return 0;
    if (!this.status || !this.status.isConnected) return 0;
    if (!window.AntigraviteAPI?.google) return 0;

    const remainingQueue = [];
    let processedCount = 0;

    for (const item of queue) {
      try {
        if (item.action === 'delete') {
          await window.AntigraviteAPI.google.deleteEvent(item.payload.googleId, item.payload.calendarId);
          processedCount++;
        } else if (item.action === 'create') {
          const created = await window.AntigraviteAPI.google.createEvent({
            ...item.payload.eventData,
            calendarId: item.payload.calendarId || this.status.selectedCalendarId || 'primary'
          });
          const events = StorageManager.getEvents();
          const idx = events.findIndex(e => e.id === item.payload.tempId);
          if (idx !== -1) {
            events[idx] = created;
          } else {
            events.push(created);
          }
          StorageManager.saveEvents(events);
          processedCount++;
        } else if (item.action === 'update') {
          const updated = await window.AntigraviteAPI.google.updateEvent(
            item.payload.googleId,
            item.payload.updatedData,
            item.payload.calendarId,
            null
          );
          const events = StorageManager.getEvents();
          const idx = events.findIndex(e => e.googleId === item.payload.googleId || e.id === item.payload.tempId);
          if (idx !== -1) {
            events[idx] = { ...events[idx], ...updated, syncStatus: 'synced' };
            StorageManager.saveEvents(events);
          }
          processedCount++;
        }
      } catch (err) {
        if (this.isNetworkError(err)) {
          remainingQueue.push(item);
        } else {
          console.warn(`[GoogleSync] Action ignorée (${item.action}) : ${err.message}`);
        }
      }
    }

    this.saveOfflineQueue(remainingQueue);
    if (processedCount > 0) {
      if (window.AgendaManager) window.AgendaManager.render();
      if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`File hors-ligne : ${processedCount} modification${processedCount > 1 ? 's' : ''} envoyée${processedCount > 1 ? 's' : ''} à Google`, "success");
      }
    }
    return processedCount;
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
          noteId: updatedData.noteId !== undefined ? updatedData.noteId : events[idx].noteId
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
      if (err.code === 'CONFLICT') {
        const force = confirm(
          "⚠️ Conflit de synchronisation détecté !\n\n" +
          "Cet événement a été modifié directement sur Google Agenda depuis votre dernière synchronisation.\n\n" +
          "• Cliquez sur 'OK' pour écraser avec vos modifications locales.\n" +
          "• Cliquez sur 'Annuler' pour récupérer la version la plus récente de Google Agenda."
        );

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

    const calendarId = localEvt.googleCalendarId || this.status.selectedCalendarId || 'primary';
    let deletedRemotely = false;

    try {
      if (localEvt.googleId) {
        await window.AntigraviteAPI.google.deleteEvent(localEvt.googleId, calendarId);
        deletedRemotely = true;
      }
    } catch (err) {
      if (this.isNetworkError(err)) {
        if (localEvt.googleId) {
          this.enqueueOfflineAction('delete', {
            googleId: localEvt.googleId,
            calendarId
          });
        }
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
    const filtered = events.filter(e => e.id !== id);
    StorageManager.saveEvents(filtered);

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
        <div style="background: rgba(245,158,11,0.1); border: 1px solid #f59e0b; border-radius: var(--radius-md); padding: 12px 16px; margin-top: 10px; color: #f59e0b; font-size: 0.85rem;">
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
      const result = await window.AntigraviteAPI.google.fetchEvents({ maxResults: 100 });
      const count = result.totalCount;
      const previewList = result.events.slice(0, 6);

      let html = `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-top: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color: #10b981;">✅ Test de lecture réussi (${count} événement${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''})</strong>
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
        <div style="background: rgba(244,63,94,0.1); border: 1px solid #f43f5e; border-radius: var(--radius-md); padding: 12px 16px; margin-top: 10px; color: #f43f5e; font-size: 0.85rem;">
          <strong>❌ Échec de lecture Google Calendar :</strong> ${this.escapeHtml(err.message)}
        </div>
      `;
    } finally {
      if (btnTest) {
        btnTest.disabled = false;
        btnTest.innerHTML = `<span>🔍</span> <span>Tester la lecture des événements (Lecture seule)</span>`;
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

// Initialisation dès que le DOM est prêt
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      GoogleSyncManager.init();
    });
  } else {
    GoogleSyncManager.init();
  }
}
