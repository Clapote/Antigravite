/**
 * Antigravité - Contrôleur Principal de l'Application
 */

const App = {
  currentScreen: 'home',
  APP_VERSION: '1.3.1',
  dashboardAgendaView: 'grid',
  WHATS_NEW_STORAGE_KEY: 'antigravite_last_seen_version',
  _activeWhatsNewVersion: null,
  // Versions majeures justifiant l'affichage automatique de la modale "Quoi de neuf" au premier démarrage
  // Les versions d'ajustements et de finitions (ex: 1.2.2) n'affichent pas de pop-up intrusif à l'ouverture
  MAJOR_ANNOUNCED_VERSIONS: ['1.2.0', '1.3.1'],

  // Messages de chargement variés affichés aléatoirement au démarrage
  LOADING_PHRASES: [
    "L'agenda s'installe...",
    "Les tâches se préparent...",
    "Organisation de vos projets...",
    "Harmonisation de votre journée...",
    "Accordage des ambiances musicales...",
    "Mise en place de votre espace zen...",
    "Synchronisation de vos pensées...",
    "Alignement des priorités du jour...",
    "Préparation de votre flux de travail...",
    "Décollage en douceur...",
    "Négociation diplomatique avec vos to-do lists récalcitrantes...",
    "Conviction du café qu'il est la pièce maîtresse de votre succès...",
    "Défiance polie mais ferme des lois universelles de la gravité...",
    "Recherche de la motivation (elle était cachée derrière un paquet de gâteaux)...",
    "Téléchargement d'une dose massive de volonté...",
    "Dépoussiérage bienveillant des projets commencés il y a trois mois...",
    "Alignement des chakras, des pixels et des priorités...",
    "Chauffage des neurones à température idéale de travail...",
    "Dissimulation stratégique des distractions d'Internet...",
    "Calcul de l'angle optimal pour dompter la journée...",
    "Rangement virtuel du bureau pour faire semblant d'être prêt...",
    "Vérification que votre boisson chaude est toujours à température...",
    "Polissage du bouton magique pour cocher les tâches...",
    "Brouillage des excuses bidons en cours...",
    "Calibrage du radar à productivité sereine...",
    "Promis, l'application tourne plus vite que l'envie de faire une pause...",
    "Injection d'ondes positives dans l'interface...",
    "Négociation avec le chat pour qu'il libère enfin le clavier...",
    "Vérification des stocks d'énergie et de caféine dans le secteur 4...",
    "Téléportation des bonnes idées directement vers vos neurones...",
    "Dissimulation des onglets de shopping avant que quiconque ne regarde...",
    "Ajustement de l'antigravité pour alléger instantanément vos to-do lists...",
    "Convocation du conseil des neurones pour valider le plan de vol...",
    "Enlèvement de la poussière cosmique sur vos meilleures résolutions...",
    "Injection d'une pincée d'optimisme déraisonnable dans le moteur...",
    "Synchronisation avec l'univers (qui prend parfois un peu de temps)...",
    "Activation du bouclier anti-flemme de niveau 5...",
    "Chargement de la bonne humeur... veuillez patienter pendant le dégel...",
    "Vérification que personne n'a osé voler votre stylo fétiche...",
    "Programmation d'une journée productive (ou au moins très honorable)...",
    "Étalonnage du détecteur de victoires quotidiennes...",
    "Calcul de la vitesse de fuite face aux corvées administratives...",
    "Domptage des notifications intempestives en cours...",
    "Recrutement de fées du logis virtuelles pour ranger vos idées..."
  ],

  getRandomLoadingPhrases(count = 3) {
    const list = [...this.LOADING_PHRASES];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, count);
  },

  _yieldFrame() {
    if (typeof requestAnimationFrame === 'function') {
      return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }
    return new Promise(resolve => setTimeout(resolve, 0));
  },

  async init() {
    this._bootStartTs = Date.now();
    this._preloadedScreens = false;
    this.removePendingUpdateIndicator();
    // 0. Configurer le message d'accueil dynamique sur l'écran de chargement
    this.initSplashScreen();
    this.checkForStartupUpdate();

    // Sélection aléatoire de 3 messages de chargement pour l'animation
    const loadingPhrases = this.getRandomLoadingPhrases(3);
    this.updateSplashProgress(20, loadingPhrases[0], "Initialisation du moteur local & catalogue musical...");

    const delayMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const waitUntilBootElapsed = async (targetMs) => {
      const remaining = targetMs - (Date.now() - this._bootStartTs);
      if (remaining > 0) await delayMs(remaining);
    };

    // 1. Phase 1 du Splash (0 -> 1400ms) : Stockage, thème/wallpaper Canvas, init légère des modules & scan musique asynchrone
    await StorageManager.init();
    const settings = StorageManager.getSettings();
    this.applyAppearanceSettings(settings);

    const musicInitPromise = (typeof MusicManager !== 'undefined')
      ? MusicManager.init({ deferRender: true })
      : Promise.resolve();

    TasksManager.init({ deferRender: true });
    ProjectsManager.init({ deferRender: true });
    AgendaManager.init({ deferRender: true });
    NotesManager.init({ deferRender: true });
    BackupManager.init({ deferStartupIO: true });
    if (typeof SettingsManager !== 'undefined') SettingsManager.init({ deferRender: true });
    if (typeof AgendaNotificationManager !== 'undefined') AgendaNotificationManager.init();
    if (typeof FocusManager !== 'undefined') FocusManager.init({ deferRender: true });
    if (typeof TrashManager !== 'undefined') TrashManager.init({ deferRender: true });
    if (typeof SearchManager !== 'undefined') SearchManager.init();
    if (typeof DebriefManager !== 'undefined') DebriefManager.init();

    this.bindNavigation();
    this.bindGlobalActions();
    this.updateAllSlidersFill();
    this.initSidebarState();
    this.initSidebarRailTooltips();
    this.initSidebarStickyNote();
    this.dashboardAgendaView = (typeof localStorage !== 'undefined' && localStorage.getItem('antigravite_dashboard_agenda_view')) || 'grid';
    this.initDashboardClock();
    this.bindDormancyListeners();
    this.updateDashboard();

    await waitUntilBootElapsed(1400);
    this.updateSplashProgress(55, loadingPhrases[1], "Indexation des notes, récurrences & synchronisation Google...");

    // 2. Phase 2 du Splash (1400ms -> 2800ms) : Sync Google silencieuse, indexation mémoire, récurrences, stats & sauvegarde
    await this._yieldFrame();
    if (typeof MusicManager !== 'undefined' && typeof MusicManager.warmUpCatalog === 'function') {
      await MusicManager.warmUpCatalog().catch(() => {});
    } else {
      await musicInitPromise.catch(() => {});
    }
    if (typeof StorageManager.checkStorageQuotaHealth === 'function') {
      StorageManager.checkStorageQuotaHealth(true);
    }
    if (typeof TrashManager !== 'undefined' && typeof TrashManager.cleanExpired === 'function') {
      TrashManager.cleanExpired();
    }
    if (typeof ProjectsManager !== 'undefined' && typeof ProjectsManager.getAllProjectsStats === 'function') {
      ProjectsManager.getAllProjectsStats();
    }

    await this._yieldFrame();
    if (typeof NotesManager !== 'undefined' && typeof NotesManager.warmUpIndex === 'function') {
      NotesManager.warmUpIndex();
    }
    await this._yieldFrame();
    if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.warmUpRecurrenceCache === 'function') {
      AgendaManager.warmUpRecurrenceCache();
    }
    await this._yieldFrame();
    if (typeof ConstellationManager !== 'undefined' && typeof ConstellationManager.warmUpTopology === 'function') {
      ConstellationManager.warmUpTopology();
    }

    if (typeof GoogleSyncManager !== 'undefined') {
      try {
        await GoogleSyncManager.init();
        if (GoogleSyncManager.status?.isConnected) {
          await GoogleSyncManager.syncCalendarNow(true);
          this._lastAgendaAutoSyncAt = Date.now();
          this.updateDashboard(true);
        }
      } catch (err) {
        console.warn("[App] Synchronisation initiale de l'agenda :", err);
      }
    }

    if (typeof BackupManager !== 'undefined' && typeof BackupManager.runStartupMaintenance === 'function') {
      await BackupManager.runStartupMaintenance().catch(() => {});
    }

    await waitUntilBootElapsed(2800);
    this.updateSplashProgress(85, loadingPhrases[2], "Préparation des vues & contrôle d'intégrité...");

    // 3. Phase 3 du Splash (2800ms -> 4200ms) : Pré-rendu étalé par trames pendant que le splash reste affiché
    await this.preloadScreens();
    this._initDurationMs = Date.now() - (this._bootStartTs || Date.now());

    await waitUntilBootElapsed(4200);

    // Étape finale : barre à 100% avec message de bienvenue
    const userName = this.getUserName();
    const readyMessage = userName ? `Prêt ${userName} ! Bonne journée !` : "Prêt ! Bonne journée !";
    this.updateSplashProgress(100, readyMessage, "Espace prêt !");

    // Temps de lecture de la validation finale et fermeture en douceur (4200ms -> 4800ms)
    await delayMs(600);
    this.hideSplashScreen();
    this._splashHidden = true;

    // Vérifier si une mise à jour est disponible pour l'afficher en douceur après le chargement
    if (this._availableUpdate && !this._updatePostponed) {
      setTimeout(() => {
        this.openUpdatePromptModal(this._availableUpdate);
      }, 350);
    }

    // 7. Afficher l'écran initial
    this.navigate('home');

    // 8. Afficher les nouveautés au premier lancement après une mise à jour
    this.scheduleWhatsNewCheck();
  },

  async preloadScreens() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._preloadedScreens) return;
    this._preloadedScreens = true;

    const currentSettings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    const perfMode = currentSettings.performanceMode || 'normal';

    // Sur PC modeste / mode économie, ne pas pré-rendre les DOM cachés (rendu paresseux à la demande)
    if (perfMode === 'potato' || perfMode === 'economy') {
      return;
    }

    const queue = [];
    if (typeof TasksManager !== 'undefined' && typeof TasksManager.renderIfNeeded === 'function') queue.push(() => TasksManager.renderIfNeeded());
    if (typeof ProjectsManager !== 'undefined' && typeof ProjectsManager.renderIfNeeded === 'function') queue.push(() => ProjectsManager.renderIfNeeded());
    if (typeof NotesManager !== 'undefined' && typeof NotesManager.renderIfNeeded === 'function') queue.push(() => NotesManager.renderIfNeeded());
    if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.renderIfNeeded === 'function') queue.push(() => AgendaManager.renderIfNeeded());
    if (typeof DebriefManager !== 'undefined' && typeof DebriefManager.renderIfNeeded === 'function' && currentSettings.debriefEnabled !== false) {
      queue.push(() => DebriefManager.renderIfNeeded());
    }

    for (let i = 0; i < queue.length; i++) {
      await this._yieldFrame();
      try {
        queue[i]();
      } catch (err) {
        console.warn("[App] Préchargement doux des écrans :", err);
      }
    }
  },

  async resolveAppVersion() {
    let ver = this.APP_VERSION || '1.2.0';
    try {
      if (typeof window !== 'undefined' && window.AntigraviteAPI) {
        if (typeof window.AntigraviteAPI.getAppVersion === 'function') {
          const apiVer = await window.AntigraviteAPI.getAppVersion();
          if (apiVer && typeof apiVer === 'string') ver = apiVer.trim();
        } else if (window.AntigraviteAPI.updater && typeof window.AntigraviteAPI.updater.getVersion === 'function') {
          const apiVer = await window.AntigraviteAPI.updater.getVersion();
          if (apiVer && typeof apiVer === 'string') ver = apiVer.trim();
        }
      }
    } catch (_e) {}
    return ver;
  },

  shouldShowWhatsNew(version = this.APP_VERSION) {
    if (!version) return false;
    // N'afficher le panneau de mise à jour au démarrage que pour les versions majeures annoncées
    if (!this.MAJOR_ANNOUNCED_VERSIONS.includes(String(version))) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(this.WHATS_NEW_STORAGE_KEY) !== String(version);
    } catch (_e) {
      return false;
    }
  },

  markWhatsNewAsSeen(version = null) {
    const targetVer = version || this._activeWhatsNewVersion || this.APP_VERSION || '1.2.0';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.WHATS_NEW_STORAGE_KEY, String(targetVer));
      }
    } catch (_e) {}
  },

  _bindWhatsNewModalButtons() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const btnClose = document.getElementById('btn-whats-new-close');
    const btnCloseX = document.getElementById('btn-whats-new-close-x');
    const btnOpenSettings = document.getElementById('btn-whats-new-open-settings');

    if (btnClose && !btnClose._whatsNewBound) {
      btnClose._whatsNewBound = true;
      btnClose.addEventListener('click', () => this.closeWhatsNewModal(true));
    }
    if (btnCloseX && !btnCloseX._whatsNewBound) {
      btnCloseX._whatsNewBound = true;
      btnCloseX.addEventListener('click', () => this.closeWhatsNewModal(true));
    }
    if (btnOpenSettings && !btnOpenSettings._whatsNewBound) {
      btnOpenSettings._whatsNewBound = true;
      btnOpenSettings.addEventListener('click', () => this.openChangelogInSettings());
    }
  },

  // Instancie à la demande une modale stockée dans un <template> pour alléger le DOM initial
  ensureTemplateElement(targetId, templateId) {
    if (typeof document === 'undefined') return null;
    const existing = document.getElementById(targetId);
    if (existing) return existing;
    const tpl = document.getElementById(templateId);
    if (!tpl) return null;
    const frag = (tpl.content && typeof tpl.content.cloneNode === 'function')
      ? tpl.content.cloneNode(true)
      : null;
    if (frag && document.body && typeof document.body.appendChild === 'function') {
      document.body.appendChild(frag);
    }
    return document.getElementById(targetId);
  },

  openWhatsNewModal(version = null) {
    if (typeof document === 'undefined') return false;
    const modal = this.ensureTemplateElement('whats-new-modal', 'tpl-whats-new-modal');
    if (!modal) return false;

    this._bindWhatsNewModalButtons();
    const ver = version || this.APP_VERSION || '1.2.0';
    this._activeWhatsNewVersion = ver;

    const verBadge = document.getElementById('whats-new-version-badge');
    if (verBadge) verBadge.textContent = `Version ${ver}`;

    modal.classList.add('active');
    const primaryBtn = document.getElementById('btn-whats-new-close');
    if (primaryBtn && typeof primaryBtn.focus === 'function') {
      primaryBtn.focus();
    }
    return true;
  },

  closeWhatsNewModal(markSeen = true) {
    if (markSeen) {
      this.markWhatsNewAsSeen();
    }
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const modal = document.getElementById('whats-new-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  openChangelogInSettings() {
    this.closeWhatsNewModal(true);
    this.navigate('settings');
    if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.switchTab === 'function') {
      SettingsManager.switchTab('help');
    }
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

    const focusChangelog = () => {
      const section = document.getElementById('settings-section-changelog');
      if (!section) return;
      const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
        ? StorageManager.getSettings()
        : {};
      const instant = settings.disableAnimations === true || settings.performanceMode === 'potato';
      if (typeof section.scrollIntoView === 'function') {
        section.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
      }
      if (!instant && section.classList) {
        section.classList.remove('changelog-highlight-flash');
        const activateFlash = () => section.classList.add('changelog-highlight-flash');
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(activateFlash);
        } else {
          activateFlash();
        }
        setTimeout(() => {
          section.classList.remove('changelog-highlight-flash');
        }, 1600);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusChangelog);
    } else {
      focusChangelog();
    }
  },

  async checkAndShowWhatsNew() {
    const version = await this.resolveAppVersion();
    if (!this.shouldShowWhatsNew(version)) return false;
    return this.openWhatsNewModal(version);
  },

  scheduleWhatsNewCheck() {
    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    const delayMs = (settings.disableAnimations === true || settings.performanceMode === 'potato') ? 50 : 350;
    setTimeout(() => {
      this.checkAndShowWhatsNew();
    }, delayMs);
  },

  // =========================================================================
  // GESTION PROACTIVE DES MISES À JOUR (Vérification au démarrage & Modale fluide)
  // =========================================================================

  isNewerVersion(remoteVer, currentVer) {
    if (!remoteVer || !currentVer) return false;
    const clean = (v) => String(v).trim().replace(/^v/i, '');
    const rParts = clean(remoteVer).split('.').map(n => parseInt(n, 10) || 0);
    const cParts = clean(currentVer).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(rParts.length, cParts.length);
    for (let i = 0; i < len; i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  },

  async checkForStartupUpdate() {
    if (typeof window === 'undefined' || !window.AntigraviteAPI || !window.AntigraviteAPI.updater) return;

    try {
      const runningVer = await this.resolveAppVersion();
      if (runningVer) {
        this.APP_VERSION = runningVer;
      }

      if (typeof window.AntigraviteAPI.updater.onTriggerMockUpdate === 'function') {
        window.AntigraviteAPI.updater.onTriggerMockUpdate(async () => {
          const res = await window.AntigraviteAPI.updater.checkForUpdates(true);
          if (res && res.updateInfo && this.isNewerVersion(res.updateInfo.version, this.APP_VERSION)) {
            this._availableUpdate = res.updateInfo;
            this._updatePostponed = false;
            this.openUpdatePromptModal(res.updateInfo);
          } else {
            this._availableUpdate = null;
            this.removePendingUpdateIndicator();
          }
        });
      }

      if (typeof window.AntigraviteAPI.updater.onStatusChanged === 'function') {
        window.AntigraviteAPI.updater.onStatusChanged((data) => {
          if (!data) return;
          if (data.status === 'available' && data.updateInfo) {
            if (this.isNewerVersion(data.updateInfo.version, this.APP_VERSION)) {
              this._availableUpdate = data.updateInfo;
              if (this._splashHidden && !this._updatePostponed) {
                setTimeout(() => {
                  this.openUpdatePromptModal(data.updateInfo);
                }, 250);
              }
            } else {
              this._availableUpdate = null;
              this.removePendingUpdateIndicator();
            }
          } else if (data.status === 'not-available') {
            this._availableUpdate = null;
            this.removePendingUpdateIndicator();
          }
          if (data.status === 'downloading' && data.progress && this._promptDownloadInProgress) {
            this.updatePromptDownloadProgress(data.progress);
          }
          if (data.status === 'downloaded' && this._promptDownloadInProgress) {
            this._promptDownloadInProgress = false;
            this.onPromptUpdateDownloaded();
          }
        });
      }

      const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
        ? StorageManager.getSettings()
        : {};
      if (settings && settings.autoCheckUpdates === false) {
        return;
      }

      // Requête non bloquante avec timeout strict de 2.5s maximum (rejet tardif capturé proprement)
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2500));
      const checkPromise = Promise.resolve(window.AntigraviteAPI.updater.checkForUpdates()).catch(() => null);
      const res = await Promise.race([checkPromise, timeoutPromise]);
      if (res && res.updateInfo && this.isNewerVersion(res.updateInfo.version, this.APP_VERSION)) {
        this._availableUpdate = res.updateInfo;
      } else {
        this._availableUpdate = null;
        this.removePendingUpdateIndicator();
      }
    } catch (_err) {
      // Ignorer silencieusement pour ne jamais bloquer le chargement
    }
  },

  postponeUpdatePromptModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-update-prompt');
    this._updatePostponed = true;
    this._promptDownloadInProgress = false;
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    this.showPendingUpdateIndicator();
  },

  openUpdatePromptModal(updateInfo) {
    if (typeof document === 'undefined') return;
    if (!updateInfo || !updateInfo.version || !this.isNewerVersion(updateInfo.version, this.APP_VERSION)) {
      this.removePendingUpdateIndicator();
      return;
    }
    const modal = this.ensureTemplateElement('modal-update-prompt', 'tpl-modal-update-prompt');
    if (!modal) return;

    const badge = document.getElementById('update-prompt-version-badge');
    if (badge && updateInfo && updateInfo.version) {
      badge.textContent = `Version ${updateInfo.version} disponible`;
    }

    const notes = document.getElementById('update-prompt-notes');
    if (notes && updateInfo && updateInfo.releaseNotes) {
      notes.textContent = updateInfo.releaseNotes;
    }

    const btnCloseX = document.getElementById('btn-update-prompt-close-x');
    const btnLater = document.getElementById('btn-update-prompt-later');
    const btnNow = document.getElementById('btn-update-prompt-now');

    const closeModal = () => this.postponeUpdatePromptModal();

    if (btnCloseX && !btnCloseX._promptBound) {
      btnCloseX._promptBound = true;
      btnCloseX.addEventListener('click', closeModal);
    }
    if (btnLater && !btnLater._promptBound) {
      btnLater._promptBound = true;
      btnLater.addEventListener('click', closeModal);
    }

    if (btnNow && !btnNow._promptBound) {
      btnNow._promptBound = true;
      btnNow.addEventListener('click', async () => {
        if (btnLater) btnLater.disabled = true;
        if (btnNow) btnNow.disabled = true;
        this._promptDownloadInProgress = true;
        const progressBox = document.getElementById('update-prompt-progress-box');
        if (progressBox) progressBox.style.display = 'block';
        const actionsBox = document.getElementById('update-prompt-actions');
        if (actionsBox) actionsBox.style.display = 'none';

        try {
          await window.AntigraviteAPI.updater.downloadUpdate();
        } catch (err) {
          this._promptDownloadInProgress = false;
          const label = document.getElementById('update-prompt-progress-label');
          if (label) label.textContent = "Erreur de téléchargement. Réessayez depuis les paramètres.";
          setTimeout(closeModal, 2500);
        }
      });
    }

    modal.style.display = 'flex';
    const activateModal = () => modal.classList.add('active');
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(activateModal);
    } else {
      activateModal();
    }
  },

  updatePromptDownloadProgress(progress) {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('update-prompt-progress-bar');
    const percentEl = document.getElementById('update-prompt-progress-percent');
    const labelEl = document.getElementById('update-prompt-progress-label');
    const pct = Math.round(progress && progress.percent !== undefined ? progress.percent : 0);

    if (bar) bar.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct} %`;
    if (labelEl) labelEl.textContent = `Téléchargement en cours... (${pct} %)`;
  },

  async onPromptUpdateDownloaded() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('update-prompt-progress-bar');
    const percentEl = document.getElementById('update-prompt-progress-percent');
    const labelEl = document.getElementById('update-prompt-progress-label');
    const sublabelEl = document.getElementById('update-prompt-progress-sublabel');

    if (bar) bar.style.width = '100%';
    if (percentEl) percentEl.textContent = '100 %';
    if (labelEl) labelEl.textContent = 'Téléchargement terminé !';
    if (sublabelEl) sublabelEl.textContent = 'Installation silencieuse et redémarrage automatique en cours...';

    await new Promise(r => setTimeout(r, 600));
    try {
      await window.AntigraviteAPI.updater.installUpdate();
    } catch (_err) {}
  },

  showPendingUpdateIndicator() {
    if (typeof document === 'undefined') return;
    if (!this._availableUpdate || !this.isNewerVersion(this._availableUpdate.version, this.APP_VERSION)) {
      this.removePendingUpdateIndicator();
      return;
    }
    const navSettings = document.querySelector('.nav-item[data-screen="settings"]');
    if (navSettings && !document.getElementById('nav-update-dot')) {
      const dot = document.createElement('span');
      dot.id = 'nav-update-dot';
      dot.className = 'nav-debrief-dot';
      dot.style.backgroundColor = 'var(--accent)';
      dot.style.boxShadow = '0 0 8px var(--accent)';
      dot.title = 'Mise à jour disponible';
      navSettings.appendChild(dot);
    }
  },

  removePendingUpdateIndicator() {
    if (typeof document === 'undefined') return;
    const dot = document.getElementById('nav-update-dot');
    if (dot && dot.parentNode) {
      dot.parentNode.removeChild(dot);
    }
  },

  getUserName() {
    try {
      if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
        const settings = StorageManager.getSettings();
        const raw = (settings.userName || '').trim();
        if (raw && raw.toLowerCase() !== 'utilisateur') {
          return raw;
        }
      }
    } catch (_e) {}
    return '';
  },

  // Table de correspondance vers le sprite SVG master (#antigravite-svg-sprite)
  _SVG_ICON_MAP: {
    pin: ['pin', 2], '📌': ['pin', 2],
    note: ['note', 2], '📝': ['note', 2],
    calendar: ['calendar', 2], '📅': ['calendar', 2],
    clock: ['clock', 2], '⏱️': ['clock', 2], '⏱': ['clock', 2],
    sun: ['sun', 2.5], '☀️': ['sun', 2.5],
    repeat: ['repeat', 2.5], '🔁': ['repeat', 2.5],
    location: ['location', 2], '📍': ['location', 2],
    folder: ['folder', 2], '📁': ['folder', 2], '📂': ['folder', 2],
    trash: ['trash', 2], '🗑️': ['trash', 2], '🗑': ['trash', 2],
    edit: ['edit', 2], '✏️': ['edit', 2], '✏': ['edit', 2],
    globe: ['globe', 2], '🌐': ['globe', 2],
    debrief: ['debrief', 2], sunset: ['debrief', 2],
    sparkles: ['sparkles', 2],
    check: ['check', 3], '✓': ['check', 3], '✅': ['check', 3], success: ['check', 3],
    palette: ['palette', 2], '🎨': ['palette', 2],
    restore: ['restore', 2], '📥': ['restore', 2],
    broom: ['broom', 2], '🧹': ['broom', 2],
    lock: ['lock', 2], '🔒': ['lock', 2],
    lightbulb: ['lightbulb', 2], tip: ['lightbulb', 2], '💡': ['lightbulb', 2],
    plus: ['plus', 2.5], '➕': ['plus', 2.5],
    zap: ['zap', 2], '⚡': ['zap', 2],
    infinity: ['infinity', 2], '♾️': ['infinity', 2], '♾': ['infinity', 2],
    target: ['target', 2], '🎯': ['target', 2],
    keyboard: ['keyboard', 2], '⌨️': ['keyboard', 2], '⌨': ['keyboard', 2],
    tag: ['tag', 2], '🏷️': ['tag', 2], '🏷': ['tag', 2],
    warning: ['warning', 2], caution: ['warning', 2], '⚠️': ['warning', 2],
    alert: ['alert', 2], danger: ['alert', 2], error: ['alert', 2], '🚨': ['alert', 2], '❌': ['alert', 2],
    important: ['important', 2], '❗': ['important', 2],
    info: ['info', 2], 'ℹ️': ['info', 2], 'ℹ': ['info', 2],
    shield: ['shield', 2], '🛡️': ['shield', 2], '🛡': ['shield', 2],
    book: ['book', 2], '📖': ['book', 2],
    refresh: ['refresh', 2], '🔄': ['refresh', 2],
    user: ['user', 2], '👤': ['user', 2],
    'chevron-down': ['chevron-down', 2.5],
    'chevron-up': ['chevron-up', 2.5],
    'chevron-left': ['chevron-left', 2],
    'chevron-right': ['chevron-right', 2],
    flame: ['flame', 2],
    task: ['task', 2],
    close: ['close', 2.2],
    hourglass: ['hourglass', 2],
    download: ['download', 2.2],
    shuffle: ['shuffle', 2],
    constellation: ['constellation', 2]
  },

  // Dictionnaire centralisé d'icônes vectorielles SVG via <use href="#ico-..."/> (zéro duplication DOM)
  getSvgIcon(name, size = 14, extraClass = '', strokeWidth = null) {
    const cls = extraClass ? `app-icon ${extraClass}` : 'app-icon';
    const entry = this._SVG_ICON_MAP[name];
    const sym = entry ? entry[0] : 'important';
    const sw = strokeWidth !== null ? strokeWidth : (entry ? entry[1] : 2);
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ico-${sym}"/></svg>`;
  },

  resolveDialogIcon(icon, defaultIcon) {
    if (!icon) return defaultIcon;
    if (typeof icon === 'string' && (icon.startsWith('<svg') || icon.startsWith('<img'))) return icon;
    return this.getSvgIcon(icon, 24);
  },

  getGreetingMessage(hours = new Date().getHours()) {
    const userName = this.getUserName();
    const namePart = userName ? ` ${userName}` : '';
    if (hours >= 18 || hours < 5) {
      return `Bonsoir${namePart} ! Passez une excellente soirée !`;
    } else if (hours >= 12 && hours < 14) {
      return `Bonjour${namePart} ! Bon appétit et très belle journée !`;
    }
    return `Bonjour${namePart} ! Passez une excellente journée !`;
  },

  initSplashScreen() {
    const greetingEl = document.getElementById('splash-greeting');
    if (!greetingEl) return;
    greetingEl.textContent = this.getGreetingMessage();
  },

  updateSplashProgress(percent, statusText, subStatusText = null) {
    const bar = document.getElementById('splash-progress-bar');
    const status = document.getElementById('splash-status');
    const subStatus = document.getElementById('splash-substatus');
    const icon = document.querySelector('.splash-brand-icon');
    if (bar) bar.style.width = `${percent}%`;
    if (status && statusText) status.textContent = statusText;
    if (subStatus && subStatusText) subStatus.textContent = subStatusText;
    if (icon) {
      icon.classList.remove('splash-beat');
      const applyBeat = () => {
        icon.classList.add('splash-beat');
        if (percent >= 100) {
          icon.classList.add('splash-complete');
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(applyBeat);
      } else {
        applyBeat();
      }
    }
  },

  hideSplashScreen() {
    const splash = document.getElementById('app-splash-screen');
    if (splash) {
      const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
        ? StorageManager.getSettings()
        : {};
      const instant = settings.disableAnimations === true || settings.performanceMode === 'potato';
      splash.classList.add('hidden');
      const cleanup = () => {
        if (typeof splash.remove === 'function') {
          splash.remove();
        } else {
          splash.style.display = 'none';
        }
      };
      if (instant) {
        cleanup();
      } else {
        setTimeout(cleanup, 500);
      }
    }
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = item.dataset.screen;
        if (target) {
          this.navigate(target);
        }
      });
    });
  },

  refreshAgenda(silent = false) {
    if (window.AgendaManager) {
      window.AgendaManager.render();
    }
    if (typeof GoogleSyncManager !== 'undefined') {
      GoogleSyncManager.refreshStatus();
      if (GoogleSyncManager.status && GoogleSyncManager.status.isConnected) {
        GoogleSyncManager.syncCalendarNow(silent);
      } else {
        if (!silent && typeof this.showToast === 'function') {
          this.showToast("Agenda actualisé", "info");
        }
      }
    } else {
      if (!silent && typeof this.showToast === 'function') {
        this.showToast("Agenda actualisé", "info");
      }
    }
  },

  navigateTo(screenId) {
    return this.navigate(screenId);
  },

  navigate(screenId) {
    if (typeof window !== 'undefined' && window.NotesManager && typeof window.NotesManager.flushPendingSave === 'function') {
      window.NotesManager.flushPendingSave();
    }
    this.currentScreen = screenId;

    // Mettre à jour la barre latérale
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === screenId);
    });

    // Mettre à jour les vues avec transition fluide sans latence (Zero-lag)
    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    const disableAnim = settings.disableAnimations === true || settings.performanceMode === 'potato';

    let pendingTargetView = null;
    document.querySelectorAll('.screen-view').forEach(view => {
      const isTarget = (view.id === `screen-${screenId}`);
      if (isTarget) {
        if (!disableAnim) {
          view.classList.remove('active');
          pendingTargetView = view;
        } else {
          view.classList.add('active');
        }
      } else {
        view.classList.remove('active');
      }
    });

    // Déclencher la ligne de transition lumineuse balayant le haut de page
    const transitionBar = document.getElementById('page-transition-bar');
    if (transitionBar && !disableAnim) {
      transitionBar.classList.remove('animating');
    }

    if (typeof this.hideTimelineTooltip === 'function') {
      this.hideTimelineTooltip();
    }

    // Titre de l'en-tête
    const titles = {
      home: 'Tableau de bord',
      tasks: 'Gestionnaire de tâches',
      projects: 'Gestion des projets',
      agenda: 'Agenda hebdomadaire',
      notes: 'Notes personnelles',
      constellation: 'Constellation & Mind Map',
      focus: 'Mode Focus & Pomodoro',
      music: 'Espace Musique & Ambiance',
      debrief: 'Bilan & Débriefing',
      trash: 'Corbeille',
      backups: 'Sauvegardes locales',
      settings: 'Paramètres & Apparence'
    };
    const titleEl = document.getElementById('current-screen-title');
    if (titleEl) {
      titleEl.textContent = titles[screenId] || 'Antigravité';
      if (!disableAnim) titleEl.classList.remove('title-screen-transition');
    }

    // Regrouper toutes les relances d'animation dans une seule rAF (zéro forced reflow synchrone)
    const runNavAnimations = () => {
      if (pendingTargetView) pendingTargetView.classList.add('active');
      if (transitionBar && !disableAnim) transitionBar.classList.add('animating');
      if (titleEl && !disableAnim) titleEl.classList.add('title-screen-transition');
    };
    if (pendingTargetView || (transitionBar && !disableAnim) || (titleEl && !disableAnim)) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(runNavAnimations);
      } else {
        runNavAnimations();
      }
    }

    // Rafraîchir uniquement les écrans dont les données ont évolué (dirty tracking par révision)
    if (screenId === 'home') {
      this.updateDashboard(true);
      if (typeof this.updateLiveClockNow === 'function') this.updateLiveClockNow();
    }
    if (screenId === 'tasks' && typeof TasksManager !== 'undefined') {
      if (typeof TasksManager.renderIfNeeded === 'function') TasksManager.renderIfNeeded();
      else TasksManager.render();
    }
    if (screenId === 'projects' && typeof ProjectsManager !== 'undefined') {
      if (typeof ProjectsManager.renderIfNeeded === 'function') ProjectsManager.renderIfNeeded();
      else ProjectsManager.render();
    }
    if (screenId === 'agenda') {
      if (typeof AgendaManager !== 'undefined') {
        if (typeof AgendaManager.resetToCurrentWeek === 'function') {
          AgendaManager.resetToCurrentWeek();
        } else if (typeof AgendaManager.renderIfNeeded === 'function') {
          AgendaManager.renderIfNeeded();
        } else {
          AgendaManager.render();
        }
        if ((AgendaManager._lastScrollTop === null || AgendaManager._lastScrollTop === undefined) && typeof AgendaManager.scrollToNormalHours === 'function') {
          AgendaManager.scrollToNormalHours(false);
        }
      }
      if (typeof GoogleSyncManager !== 'undefined') {
        GoogleSyncManager.refreshStatus();
        const nowTs = Date.now();
        if (!this._lastAgendaAutoSyncAt || (nowTs - this._lastAgendaAutoSyncAt) > 15000) {
          this._lastAgendaAutoSyncAt = nowTs;
          GoogleSyncManager.syncCalendarNow(true);
        }
      }
    } else {
      if (typeof AgendaManager !== 'undefined') {
        AgendaManager.activeDateStr = null;
      }
      this.updateSidebarDayProgress();
    }
    if (screenId === 'notes' && typeof NotesManager !== 'undefined') {
      if (typeof NotesManager.renderIfNeeded === 'function') NotesManager.renderIfNeeded();
      else NotesManager.render();
    }
    if (screenId === 'constellation' && typeof ConstellationManager !== 'undefined') {
      if (typeof ConstellationManager.renderIfNeeded === 'function') ConstellationManager.renderIfNeeded();
      else ConstellationManager.render();
    }
    if (screenId === 'focus' && typeof FocusManager !== 'undefined') {
      if (typeof FocusManager.renderIfNeeded === 'function') FocusManager.renderIfNeeded();
      else FocusManager.render();
    }
    if (screenId === 'music' && typeof MusicManager !== 'undefined') {
      if (typeof MusicManager.renderIfNeeded === 'function') MusicManager.renderIfNeeded();
      else MusicManager.render();
    }
    if (screenId === 'debrief' && typeof DebriefManager !== 'undefined') {
      if (typeof DebriefManager.renderIfNeeded === 'function') DebriefManager.renderIfNeeded();
      else DebriefManager.render();
    }
    if (screenId === 'trash' && typeof TrashManager !== 'undefined') {
      if (typeof TrashManager.renderIfNeeded === 'function') TrashManager.renderIfNeeded();
      else TrashManager.render();
    }
    if (screenId === 'backups' && typeof BackupManager !== 'undefined') {
      if (typeof BackupManager.renderIfNeeded === 'function') BackupManager.renderIfNeeded();
      else BackupManager.render();
    }
    if (screenId === 'settings') {
      if (typeof SettingsManager !== 'undefined') {
        if (typeof SettingsManager.renderIfNeeded === 'function') SettingsManager.renderIfNeeded();
        else SettingsManager.render();
      }
      if (typeof GoogleSyncManager !== 'undefined') GoogleSyncManager.refreshStatus();
    }
    if (typeof MusicManager !== 'undefined' && typeof MusicManager.updateMiniPlayer === 'function') {
      MusicManager.updateMiniPlayer();
    }
  },

  applyAppearanceSettings(settings) {
    if (!settings) settings = StorageManager.getSettings();
    const root = document.documentElement;
    const perfMode = settings.performanceMode || 'normal';

    const isHexAccent = typeof settings.accentColor === 'string' && settings.accentColor.startsWith('#');
    root.setAttribute('data-theme', settings.theme || 'dark');
    root.setAttribute('data-accent', isHexAccent ? 'custom' : (settings.accentColor || 'blue'));
    root.setAttribute('data-density', settings.density || 'comfortable');
    root.setAttribute('data-font-size', settings.fontSize || 'normal');
    root.setAttribute('data-font-family', settings.fontFamily || 'system');
    root.setAttribute('data-radius', settings.borderRadius || 'modern');
    root.setAttribute('data-glass', settings.glassStyle || 'balanced');
    root.setAttribute('data-perf-mode', perfMode);

    if (isHexAccent) {
      const rgb = this.hexToRgb(settings.accentColor);
      if (root.style && typeof root.style.setProperty === 'function') {
        root.style.setProperty('--accent', settings.accentColor);
        root.style.setProperty('--accent-hover', this.adjustColorBrightness(settings.accentColor, -10));
        root.style.setProperty('--accent-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
        root.style.setProperty('--accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
      }
    } else if (root.style && typeof root.style.removeProperty === 'function') {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-hover');
      root.style.removeProperty('--accent-light');
      root.style.removeProperty('--accent-glow');
    }

    const toggleRootFlag = (attr, enabled) => {
      if (enabled) root.setAttribute(attr, 'true');
      else if (typeof root.removeAttribute === 'function') root.removeAttribute(attr);
    };
    toggleRootFlag('data-disable-animations', settings.disableAnimations === true);
    toggleRootFlag('data-disable-previews', settings.disablePreviews === true);
    toggleRootFlag('data-disable-hover', settings.disableHoverEffects === true);

    if (settings.disablePreviews === true && typeof this.hideTimelineTooltip === 'function') {
      this.hideTimelineTooltip();
    }

    this.updateThemeButtonLabel(settings.theme || 'dark');
    const desiredOrderSig = Array.isArray(settings.sidebarTabsOrder) ? settings.sidebarTabsOrder.join(',') : '';
    if (desiredOrderSig !== this._lastSidebarOrderSig) {
      this._lastSidebarOrderSig = desiredOrderSig;
      this.applySidebarTabsOrder(settings.sidebarTabsOrder);
    }
    this.applySidebarTabsVisibility(settings, true);

    // Fond d'écran (Image derrière les panneaux — désactivé en Mode PC de merde pour épargner le GPU)
    const PRESET_WALLPAPERS = this.PRESET_WALLPAPERS || {};

    let wallpaperLayer = (typeof document !== 'undefined') ? document.getElementById('app-wallpaper-layer') : null;
    if (!wallpaperLayer && typeof document !== 'undefined' && document.body) {
      wallpaperLayer = document.createElement('div');
      wallpaperLayer.id = 'app-wallpaper-layer';
      wallpaperLayer.className = 'app-wallpaper-layer';
      document.body.prepend(wallpaperLayer);
    }

    if (wallpaperLayer) {
      let customWallpaper = null;
      if (Array.isArray(settings.customWallpapers)) {
        customWallpaper = settings.customWallpapers.find(w => w.id === settings.backgroundImage);
      }

      if (perfMode !== 'potato' && settings.backgroundImage && settings.backgroundImage !== 'none') {
        const opacity = (settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 25) / 100;
        const blurPx = (customWallpaper && settings.backgroundBlur === undefined)
          ? (customWallpaper.blur || 0)
          : (settings.backgroundBlur || 0);

        wallpaperLayer.style.opacity = opacity;

        if (customWallpaper) {
          wallpaperLayer.style.background = customWallpaper.css;
          wallpaperLayer.style.backgroundSize = customWallpaper.patternSize || 'cover';
          wallpaperLayer.style.backgroundPosition = 'center';
          wallpaperLayer.style.backgroundRepeat = customWallpaper.patternRepeat || 'no-repeat';
          wallpaperLayer.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
        } else {
          let resolvedWp = settings.backgroundImage;
          if (resolvedWp === '__custom_wallpaper__' && typeof StorageManager !== 'undefined' && typeof StorageManager.getCustomWallpaperDataUrl === 'function') {
            resolvedWp = StorageManager.getCustomWallpaperDataUrl() || '';
          }
          const presetBg = PRESET_WALLPAPERS[settings.backgroundImage];
          if (presetBg) {
            wallpaperLayer.style.background = presetBg;
            wallpaperLayer.style.backgroundSize = 'cover';
            wallpaperLayer.style.backgroundPosition = 'center';
            wallpaperLayer.style.backgroundRepeat = 'no-repeat';
            wallpaperLayer.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
          } else if (resolvedWp) {
            if (blurPx > 0 && typeof this._applyPreBlurredWallpaper === 'function') {
              this._applyPreBlurredWallpaper(wallpaperLayer, resolvedWp, blurPx);
            } else {
              wallpaperLayer.style.background = `url("${resolvedWp}")`;
              wallpaperLayer.style.backgroundSize = 'cover';
              wallpaperLayer.style.backgroundPosition = 'center';
              wallpaperLayer.style.backgroundRepeat = 'no-repeat';
              wallpaperLayer.style.filter = 'none';
            }
          } else {
            wallpaperLayer.style.background = 'none';
            wallpaperLayer.style.filter = 'none';
          }
        }
        wallpaperLayer.style.display = 'block';
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
          document.body.classList.add('has-custom-wallpaper');
        }
      } else {
        wallpaperLayer.style.display = 'none';
        wallpaperLayer.style.filter = 'none';
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
          document.body.classList.remove('has-custom-wallpaper');
        }
      }
    }

    // Mettre à jour la couleur de fenêtre intégrée uniquement si thème ou densité ont changé
    if (typeof window !== 'undefined' && window.AntigraviteAPI && typeof window.AntigraviteAPI.setTitleBarOverlay === 'function') {
      const isLight = settings.theme === 'light';
      const isOled = settings.theme === 'oled';
      const isCompact = settings.density === 'compact';
      const topBarColor = isLight ? '#ffffff' : (isOled ? '#08080c' : '#131926');
      const symbolColor = isLight ? '#334155' : '#94a3b8';
      const overlayHeight = isCompact ? 50 : 60;
      const tbSig = `${topBarColor}:${symbolColor}:${overlayHeight}:${isLight}`;
      if (this._lastTitleBarSig !== tbSig) {
        this._lastTitleBarSig = tbSig;
        window.AntigraviteAPI.setTitleBarOverlay({
          color: topBarColor,
          symbolColor: symbolColor,
          height: overlayHeight,
          theme: isLight ? 'light' : 'dark',
          backgroundColor: topBarColor
        }).catch(() => {});
      }
    }

    this.applyPerformanceTimers(perfMode);
    this.syncDesktopPrefs(settings);
    this.updateLiveClockNow();
    this.updateDashboardQuote();
    this.updateSidebarDayProgress();
    if (typeof MusicManager !== 'undefined' && typeof MusicManager.updateSidebarMiniPlayer === 'function') {
      MusicManager.updateSidebarMiniPlayer();
    }
    this.updateSidebarStickyNote();
  },

  // Pré-calcul unique du flou sur Canvas hors-écran à échelle 0.5x (évite le flou CSS continu sur GPU)
  _blurredWallpaperCache: null,
  _applyPreBlurredWallpaper(wallpaperLayer, imageSrc, blurPx) {
    if (!wallpaperLayer || !imageSrc) return;
    if (typeof Image !== 'function' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      wallpaperLayer.style.background = `url("${imageSrc}")`;
      wallpaperLayer.style.backgroundSize = 'cover';
      wallpaperLayer.style.backgroundPosition = 'center';
      wallpaperLayer.style.backgroundRepeat = 'no-repeat';
      wallpaperLayer.style.filter = `blur(${blurPx}px)`;
      return;
    }

    if (!this._blurredWallpaperCache) {
      this._blurredWallpaperCache = new Map();
    }
    const reqKey = `${imageSrc.length}:${imageSrc.slice(0, 64)}:${imageSrc.slice(-32)}:${blurPx}`;
    this._activeBlurredWpKey = reqKey;

    const cachedUrl = this._blurredWallpaperCache.get(reqKey);
    if (cachedUrl) {
      wallpaperLayer.style.background = `url("${cachedUrl}")`;
      wallpaperLayer.style.backgroundSize = 'cover';
      wallpaperLayer.style.backgroundPosition = 'center';
      wallpaperLayer.style.backgroundRepeat = 'no-repeat';
      wallpaperLayer.style.filter = 'none';
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (this._activeBlurredWpKey !== reqKey) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!ctx) {
          wallpaperLayer.style.background = `url("${imageSrc}")`;
          wallpaperLayer.style.filter = `blur(${blurPx}px)`;
          return;
        }
        const natW = img.naturalWidth || img.width || 1280;
        const natH = img.naturalHeight || img.height || 720;
        const maxW = Math.min(960, Math.max(320, Math.round(natW * 0.5)));
        const scale = maxW / Math.max(1, natW);
        const w = Math.max(160, Math.round(natW * scale));
        const h = Math.max(90, Math.round(natH * scale));
        canvas.width = w;
        canvas.height = h;

        const scaledBlur = Math.max(1, Math.round(blurPx * 0.55));
        const pad = scaledBlur * 2;
        ctx.filter = `blur(${scaledBlur}px)`;
        ctx.drawImage(img, -pad, -pad, w + pad * 2, h + pad * 2);

        const outUrl = canvas.toDataURL('image/jpeg', 0.88);
        if (this._blurredWallpaperCache.size > 4) {
          const firstKey = this._blurredWallpaperCache.keys().next().value;
          this._blurredWallpaperCache.delete(firstKey);
        }
        this._blurredWallpaperCache.set(reqKey, outUrl);

        if (this._activeBlurredWpKey === reqKey) {
          wallpaperLayer.style.background = `url("${outUrl}")`;
          wallpaperLayer.style.backgroundSize = 'cover';
          wallpaperLayer.style.backgroundPosition = 'center';
          wallpaperLayer.style.backgroundRepeat = 'no-repeat';
          wallpaperLayer.style.filter = 'none';
        }
      } catch (_err) {
        wallpaperLayer.style.background = `url("${imageSrc}")`;
        wallpaperLayer.style.filter = `blur(${blurPx}px)`;
      }
    };
    img.onerror = () => {
      if (this._activeBlurredWpKey === reqKey) {
        wallpaperLayer.style.background = `url("${imageSrc}")`;
        wallpaperLayer.style.filter = `blur(${blurPx}px)`;
      }
    };
    img.src = imageSrc;
  },

  // Application de la disposition personnalisée des onglets dans le volet latéral gauche
  applySidebarTabsOrder(order) {
    if (!order && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      const s = StorageManager.getSettings();
      order = s ? s.sidebarTabsOrder : null;
    }
    if (!Array.isArray(order) || order.length === 0) return;
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    const settingsItem = navMenu.querySelector('.nav-item[data-screen="settings"]');
    if (!settingsItem) return;

    const debriefItem = navMenu.querySelector('.nav-item[data-screen="debrief"]');

    let effectiveOrder = [...order];
    if (!effectiveOrder.includes('constellation')) {
      const notesIdx = effectiveOrder.indexOf('notes');
      if (notesIdx !== -1) {
        effectiveOrder.splice(notesIdx + 1, 0, 'constellation');
      } else {
        effectiveOrder.push('constellation');
      }
    }

    effectiveOrder.forEach(screenId => {
      const item = navMenu.querySelector(`.nav-item[data-screen="${screenId}"]`);
      if (item) {
        navMenu.insertBefore(item, settingsItem);
      }
    });

    if (debriefItem) {
      navMenu.insertBefore(debriefItem, settingsItem);
    }
  },

  // Gestion de la visibilité des onglets dans le panneau latéral
  applySidebarTabsVisibility(settings, skipOrderReorder = false) {
    if (!settings && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      settings = StorageManager.getSettings();
    }
    if (!settings) return;

    if (!skipOrderReorder && settings.sidebarTabsOrder && Array.isArray(settings.sidebarTabsOrder)) {
      this.applySidebarTabsOrder(settings.sidebarTabsOrder);
    }

    const visibleScreens = settings.sidebarVisibleScreens || {};
    const defaultVisible = {
      agenda: true,
      tasks: true,
      projects: true,
      notes: true,
      trash: true,
      constellation: false,
      focus: false,
      music: false,
      backups: false
    };

    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('.nav-item').forEach(item => {
      const screen = item.dataset.screen;
      if (!screen || screen === 'home' || screen === 'settings') {
        item.style.display = '';
        return;
      }
      if (screen === 'debrief') {
        const debriefVisible = (typeof DebriefManager !== 'undefined')
          ? DebriefManager.shouldShowTab(settings)
          : false;
        item.style.display = debriefVisible ? '' : 'none';
        if (!debriefVisible && this.currentScreen === 'debrief') {
          this.navigate('home');
        }
        return;
      }
      const isVisible = (visibleScreens[screen] !== undefined)
        ? visibleScreens[screen]
        : (defaultVisible[screen] !== false);

      item.style.display = isVisible ? '' : 'none';

      // Rediriger vers l'accueil si l'écran courant est masqué
      if (!isVisible && this.currentScreen === screen) {
        this.navigate('home');
      }
    });
  },

  formatLocalYMD(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // Mise à jour de la barre de progression de la journée (avec frise colorée des événements)
  updateSidebarDayProgress(targetDate = null) {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    if (document.hidden === true && !targetDate) return;
    const widget = document.getElementById('sidebar-day-progress-widget');
    if (!widget) return;

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    if (settings.sidebarDayProgressEnabled === false) {
      if (widget.style.display !== 'none') widget.style.display = 'none';
      return;
    }

    if (widget.style.display !== 'flex') widget.style.display = 'flex';

    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const todayStr = this.formatLocalYMD(now);

    // Plage horaire de la frise chronologique : Amplitude complète de minuit à minuit (24h = 1440 minutes)
    const dayStartMin = 0;
    const dayEndMin = 24 * 60; // 1440 min
    const totalDayMin = 1440;

    // Déterminer la date cible à afficher (aujourd'hui ou journée spécifique sélectionnée dans l'agenda)
    let activeDateStr = todayStr;
    if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      activeDateStr = targetDate;
    } else if (targetDate instanceof Date && !isNaN(targetDate.getTime())) {
      activeDateStr = this.formatLocalYMD(targetDate);
    } else if (typeof window !== 'undefined' && window.AgendaManager && this.currentScreen === 'agenda') {
      if (window.AgendaManager.activeDateStr) {
        activeDateStr = window.AgendaManager.activeDateStr;
      } else if (window.AgendaManager.currentView === 'day' && window.AgendaManager.currentWeekStart) {
        activeDateStr = this.formatLocalYMD(window.AgendaManager.currentWeekStart);
      }
    }

    const isToday = (activeDateStr === todayStr);
    const currentTotalMin = currentH * 60 + currentM;
    const pct = isToday ? Math.min(100, Math.max(0, Math.round((currentTotalMin / totalDayMin) * 100))) : 0;

    const percentEl = document.getElementById('sidebar-day-progress-percent');
    const barEl = document.getElementById('sidebar-day-progress-bar');
    const timeEl = document.getElementById('sidebar-day-progress-time');
    const remEl = document.getElementById('sidebar-day-progress-remaining');
    const trackEl = document.getElementById('sidebar-day-progress-track') || (widget && typeof widget.querySelector === 'function' ? widget.querySelector('.sidebar-day-progress-track') : null);
    const iconEl = (widget && typeof widget.querySelector === 'function') ? widget.querySelector('.sidebar-day-progress-icon') : null;

    if (percentEl) {
      percentEl.textContent = '';
      if (percentEl.style) percentEl.style.display = 'none';
    }
    if (remEl) {
      remEl.textContent = '';
      if (remEl.style) remEl.style.display = 'none';
    }

    // Récupération des événements pour créer la frise d'événements colorés
    const allEvents = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function')
      ? StorageManager.getEvents()
      : [];

    // Construction paresseuse des index tâches/projets uniquement si un événement du jour y est lié
    let taskMap = null;
    let projectMap = null;
    const ensureTaskAndProjectMaps = () => {
      if (taskMap) return;
      taskMap = new Map();
      projectMap = new Map();
      const allTasks = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function')
        ? StorageManager.getTasks()
        : [];
      const allProjects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
        ? StorageManager.getProjects()
        : [];
      allProjects.forEach(p => projectMap.set(p.id, p));
      const mapTasks = (list) => {
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          taskMap.set(t.id, t);
          if (t.subtasks && t.subtasks.length) mapTasks(t.subtasks);
        }
      };
      mapTasks(allTasks);
    };

    const formatHM = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Filtrer les événements de la journée active
    const todayEvents = [];
    let activeEventNow = null;

    for (let i = 0; i < allEvents.length; i++) {
      const evt = allEvents[i];
      if (!evt.start) continue;
      const startStr = String(evt.start);
      const endStr = evt.end ? String(evt.end) : startStr;

      const startDate = startStr.slice(0, 10);
      const endDate = endStr.slice(0, 10);

      // Vérifier si l'événement concerne la journée active (incluant récurrences)
      const isMatch = (typeof AgendaManager !== 'undefined' && typeof AgendaManager.isEventOnDate === 'function')
        ? AgendaManager.isEventOnDate(evt, activeDateStr)
        : (startDate <= activeDateStr && endDate >= activeDateStr);
      if (isMatch) {
        let startMin = 0;    // 00:00 (Minuit)
        let endMin = 1440;   // 24:00 (Minuit)
        const isAllDay = evt.allDay || evt.isAllDay || (!startStr.includes('T') && !endStr.includes('T'));
        const isRecurringOccurrence = !!(evt.recurrence && evt.recurrence !== 'none' && startDate !== activeDateStr);

        if (startStr.includes('T')) {
          const sDate = startStr.slice(0, 10);
          if (sDate === activeDateStr || isRecurringOccurrence) {
            const sTime = startStr.split('T')[1].slice(0, 5);
            const [sh, sm] = sTime.split(':').map(Number);
            if (!isNaN(sh)) startMin = sh * 60 + (sm || 0);
          } else if (sDate < activeDateStr) {
            startMin = 0;
          }
        }
        if (endStr.includes('T')) {
          const eDate = endStr.slice(0, 10);
          if (eDate === activeDateStr || isRecurringOccurrence) {
            const eTime = endStr.split('T')[1].slice(0, 5);
            const [eh, em] = eTime.split(':').map(Number);
            if (!isNaN(eh)) endMin = eh * 60 + (em || 0);
          } else if (eDate > activeDateStr) {
            endMin = 1440;
          }
        } else if (!isAllDay) {
          endMin = Math.max(endMin, startMin + 60);
        }

        // Si fin <= début, accorder au minimum 30 minutes pour la lisibilité
        if (endMin <= startMin) {
          endMin = Math.min(1440, startMin + 30);
        }

        // Déterminer la couleur de l'événement et les informations du projet / de la tâche
        let color = evt.color || '#38bdf8';
        let projectTitle = null;
        let projectColor = null;
        let taskTitle = null;
        let resolvedProjId = evt.projectId || null;

        if (evt.taskId) {
          ensureTaskAndProjectMaps();
          const linkedTask = taskMap.get(evt.taskId);
          if (linkedTask) {
            taskTitle = linkedTask.title;
            if (linkedTask.projectId) resolvedProjId = linkedTask.projectId;
          }
        }
        if (resolvedProjId) {
          ensureTaskAndProjectMaps();
          if (projectMap.has(resolvedProjId)) {
            const proj = projectMap.get(resolvedProjId);
            if (proj) {
              projectTitle = proj.title;
              if (proj.color) {
                projectColor = proj.color;
                color = proj.color;
              }
            }
          }
        }

        const timeLabel = isAllDay ? 'Journée entière' : `${formatHM(startMin)} - ${formatHM(endMin)}`;

        // Vérifier si cet événement est en cours (si aujourd'hui)
        if (isToday && currentTotalMin >= startMin && currentTotalMin < endMin) {
          activeEventNow = { evt, timeLabel };
        }

        // Vérifier si le créneau est dans la journée complète (00:00 - 24:00)
        if (endMin > 0 && startMin < 1440) {
          const visStart = Math.max(0, startMin);
          const visEnd = Math.min(1440, Math.max(visStart + 10, endMin));

          const leftPct = (visStart / 1440) * 100;
          const widthPct = Math.max(1.8, ((visEnd - visStart) / 1440) * 100);

          todayEvents.push({
            id: evt.id,
            title: evt.title || '(Sans titre)',
            description: evt.description || '',
            timeLabel: timeLabel,
            color: color,
            projectTitle: projectTitle,
            projectColor: projectColor,
            taskTitle: taskTitle,
            leftPct: leftPct,
            widthPct: widthPct,
            isAllDay: isAllDay,
            durationMin: Math.max(0, endMin - startMin)
          });
        }
      }
    }

    // Trier pour afficher les événements les plus larges en premier (les créneaux courts se superposent au premier plan)
    todayEvents.sort((a, b) => b.widthPct - a.widthPct);

    // Mettre à jour l'en-tête du widget selon si c'est aujourd'hui ou un autre jour (diff avant mutation DOM)
    if (isToday) {
      const curTimeText = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
      const curBarWidth = `${((currentTotalMin / totalDayMin) * 100).toFixed(2)}%`;
      if (iconEl && iconEl.textContent !== '⏱️') iconEl.textContent = '⏱️';
      if (timeEl && timeEl.textContent !== curTimeText) timeEl.textContent = curTimeText;
      if (percentEl) {
        percentEl.textContent = '';
        if (percentEl.style) percentEl.style.display = 'none';
      }
      if (barEl) {
        if (barEl.style && barEl.style.width !== curBarWidth) barEl.style.width = curBarWidth;
        if (barEl.style && barEl.style.display !== 'block') barEl.style.display = 'block';
      }
      if (widget.title !== 'Frise chronologique de la journée') widget.title = 'Frise chronologique de la journée';
      if (typeof widget.removeAttribute === 'function') widget.removeAttribute('data-viewing-other-day');
      if (widget.dataset) delete widget.dataset.viewingOtherDay;
      if (widget.style && widget.style.cursor !== 'default') widget.style.cursor = 'default';
    } else {
      if (iconEl && iconEl.textContent !== '📅') iconEl.textContent = '📅';
      const targetD = new Date(`${activeDateStr}T00:00:00`);
      const targetLabel = !isNaN(targetD.getTime())
        ? targetD.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        : activeDateStr;
      if (timeEl && timeEl.textContent !== targetLabel) timeEl.textContent = targetLabel;
      if (percentEl) {
        percentEl.textContent = '';
        if (percentEl.style) percentEl.style.display = 'none';
      }
      if (barEl) {
        if (barEl.style && barEl.style.width !== '0%') barEl.style.width = '0%';
        if (barEl.style && barEl.style.display !== 'none') barEl.style.display = 'none';
      }
      const otherTitle = `Frise du ${targetLabel} (Cliquer pour revenir à aujourd'hui)`;
      if (widget.title !== otherTitle) widget.title = otherTitle;
      if (typeof widget.setAttribute === 'function') widget.setAttribute('data-viewing-other-day', 'true');
      if (widget.dataset) widget.dataset.viewingOtherDay = 'true';
      if (widget.style.cursor !== 'pointer') widget.style.cursor = 'pointer';
    }

    // Gestion du clic sur le widget (liée une seule fois pour éviter les allocations répétées)
    if (!widget._dayClickBound) {
      widget._dayClickBound = true;
      widget.onclick = (e) => {
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('.sidebar-day-event-segment')) return;
        if (widget.dataset && widget.dataset.viewingOtherDay === 'true') {
          if (typeof window !== 'undefined' && window.AgendaManager) {
            window.AgendaManager.activeDateStr = null;
            if (window.AgendaManager.currentView === 'day') {
              window.AgendaManager.navigateToday();
            }
          }
          const n = new Date();
          const tStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
          this.updateSidebarDayProgress(tStr);
        }
      };
    }

    if (remEl) {
      remEl.textContent = '';
      if (remEl.style) remEl.style.display = 'none';
    }

    // Mettre à jour les segments d'événements dans le track uniquement si les événements ont changé
    if (trackEl && typeof trackEl.querySelectorAll === 'function') {
      const segmentsSig = activeDateStr + '|' + todayEvents.map(ev =>
        `${ev.id}:${ev.leftPct.toFixed(2)}:${ev.widthPct.toFixed(2)}:${ev.color}:${ev.title}:${ev.timeLabel}:${ev.description}:${ev.projectTitle || ''}:${ev.taskTitle || ''}:${ev.isAllDay ? 1 : 0}`
      ).join(';');
      const existingSegments = Array.from(trackEl.querySelectorAll('.sidebar-day-event-segment') || []).filter(
        el => !el || typeof el.className !== 'string' || el.className.includes('sidebar-day-event-segment')
      );
      const canReuseSegments = Boolean(
        trackEl.dataset &&
        trackEl.dataset.segmentsSig === segmentsSig &&
        this._lastDayProgressSegSig === segmentsSig &&
        existingSegments.length === todayEvents.length
      );

      if (!canReuseSegments) {
        this._lastDayProgressSegSig = segmentsSig;
        if (trackEl.dataset) trackEl.dataset.segmentsSig = segmentsSig;
        existingSegments.forEach(el => {
          if (el && typeof el.remove === 'function') el.remove();
        });

        const _frag = typeof document.createDocumentFragment === 'function' ? document.createDocumentFragment() : null;
        const useFrag = !!(_frag && (_frag.nodeType === 11 || typeof DocumentFragment !== 'undefined'));
        const segTarget = useFrag ? _frag : trackEl;

        todayEvents.forEach(item => {
          const seg = document.createElement('div');
          seg.className = 'sidebar-day-event-segment';
          seg.style.left = `${item.leftPct}%`;
          seg.style.width = `${item.widthPct}%`;
          seg.style.backgroundColor = item.color;
          if (item.isAllDay) {
            seg.style.opacity = '0.45';
          }
          if (typeof seg.setAttribute === 'function') {
            seg.setAttribute('title', `${item.title} (${item.timeLabel}) - Cliquer pour ouvrir dans l'agenda`);
          }

          // Au survol : afficher le nom et l'heure de l'événement et afficher l'infobulle personnalisée
          seg.addEventListener('mouseenter', () => {
            widget.dataset.hovering = 'true';
            if (remEl) {
              remEl.textContent = `${item.timeLabel} • ${item.title}`;
            }
            const nativeTitle = typeof seg.getAttribute === 'function' ? seg.getAttribute('title') : null;
            if (nativeTitle) {
              seg.dataset = seg.dataset || {};
              seg.dataset.nativeTitle = nativeTitle;
              if (typeof seg.removeAttribute === 'function') seg.removeAttribute('title');
            }
            this.showTimelineTooltip(item, seg);
          });

          seg.addEventListener('mouseleave', () => {
            delete widget.dataset.hovering;
            if (remEl) {
              remEl.textContent = (remEl.dataset && remEl.dataset.defaultText) || '';
            }
            if (seg.dataset && seg.dataset.nativeTitle) {
              if (typeof seg.setAttribute === 'function') seg.setAttribute('title', seg.dataset.nativeTitle);
              delete seg.dataset.nativeTitle;
            }
            this.hideTimelineTooltip();
          });

          // Clic sur le segment : masquer l'infobulle et ouvrir dans l'agenda
          seg.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideTimelineTooltip();
            if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.openEventModal === 'function') {
              if (window.App && typeof window.App.navigate === 'function') {
                window.App.navigate('agenda');
              }
              window.AgendaManager.openEventModal(item.id);
            }
          });

          segTarget.appendChild(seg);
        });
        if (useFrag) trackEl.appendChild(segTarget);
      }

      // Mettre à jour ou supprimer l'indicateur vertical de position actuelle en place sans reconstruire les segments
      const existingCursors = Array.from(trackEl.querySelectorAll('.sidebar-day-cursor') || []).filter(
        el => el && (el.id === 'sidebar-day-progress-cursor' || (typeof el.className === 'string' && el.className.includes('sidebar-day-cursor')))
      );
      const existingCursor = existingCursors.length > 0 ? existingCursors[0] : null;
      if (isToday && currentTotalMin >= dayStartMin && currentTotalMin <= dayEndMin) {
        const cursor = existingCursor || document.createElement('div');
        if (!existingCursor) {
          cursor.id = 'sidebar-day-progress-cursor';
          cursor.className = 'sidebar-day-cursor';
          trackEl.appendChild(cursor);
        }
        const leftVal = `${pct}%`;
        const titleVal = `Heure actuelle : ${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
        if (cursor.style.left !== leftVal) cursor.style.left = leftVal;
        if (typeof cursor.setAttribute === 'function' && (typeof cursor.getAttribute !== 'function' || cursor.getAttribute('title') !== titleVal)) {
          cursor.setAttribute('title', titleVal);
        }
      } else if (existingCursors.length > 0) {
        existingCursors.forEach(c => {
          if (c && typeof c.remove === 'function') c.remove();
        });
      }
    }
  },

  // Afficher la fenêtre d'information flottante (tooltip) respectant la charte graphique
  showTimelineTooltip(item, seg) {
    if (!item || !seg || typeof document === 'undefined') return;
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function' && StorageManager.getSettings().disablePreviews === true) {
      this.hideTimelineTooltip();
      return;
    }

    let tooltip = document.getElementById('sidebar-day-event-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'sidebar-day-event-tooltip';
      tooltip.className = 'sidebar-event-tooltip';
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(tooltip);
      }
    }

    // Calculer la durée formatée
    let durStr = '';
    if (item.isAllDay) {
      durStr = 'Journée entière';
    } else if (item.durationMin > 0) {
      const dh = Math.floor(item.durationMin / 60);
      const dm = item.durationMin % 60;
      durStr = dh > 0 ? (dm > 0 ? `${dh}h${String(dm).padStart(2, '0')}` : `${dh}h`) : `${dm}m`;
    }

    const accentColor = item.color || '#38bdf8';
    const projectName = item.projectTitle || 'Agenda';

    if (tooltip.style) {
      tooltip.style.borderLeftColor = accentColor;
    }
    const safeTitle = (this.escapeHtml ? this.escapeHtml(item.title) : item.title) || '(Sans titre)';
    const safeProject = this.escapeHtml ? this.escapeHtml(projectName) : projectName;
    const safeTask = item.taskTitle ? (this.escapeHtml ? this.escapeHtml(item.taskTitle) : item.taskTitle) : null;
    const safeDesc = item.description ? (this.escapeHtml ? this.escapeHtml(item.description.slice(0, 110)) : item.description.slice(0, 110)) : null;

    tooltip.innerHTML = `
      <div class="sidebar-event-tooltip-header">
        <span class="sidebar-event-tooltip-badge" style="background-color: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}44;">
          <span class="sidebar-event-tooltip-dot" style="background-color: ${accentColor};"></span>
          <span>${safeProject}</span>
        </span>
        ${durStr ? `<span class="sidebar-event-tooltip-duration">${durStr}</span>` : ''}
      </div>
      <div class="sidebar-event-tooltip-title">${safeTitle}</div>
      <div class="sidebar-event-tooltip-time">
        <span class="sidebar-event-tooltip-time-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
        <span>${item.timeLabel}</span>
      </div>
      ${safeTask ? `
        <div class="sidebar-event-tooltip-task">
          <span>✓</span>
          <span>${safeTask}</span>
        </div>` : ''}
      ${safeDesc ? `
        <div class="sidebar-event-tooltip-desc">${safeDesc}</div>` : ''}
      <div class="sidebar-event-tooltip-hint">
        <span>Cliquer pour ouvrir dans l'agenda</span>
      </div>
    `;

    const segRect = (typeof seg.getBoundingClientRect === 'function') ? seg.getBoundingClientRect() : null;
    const winW = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 0;

    if (tooltip.style) {
      tooltip.style.display = 'flex';
      tooltip.style.pointerEvents = 'none';
    }
    if (tooltip.classList && typeof tooltip.classList.remove === 'function') {
      tooltip.classList.remove('visible');
    }

    if (segRect) {
      const tooltipWidth = 240;

      let left = segRect.left + (segRect.width / 2) - (tooltipWidth / 2);
      if (left < 10) left = 10;
      if (winW && left + tooltipWidth > winW - 10) {
        left = winW - tooltipWidth - 10;
      }

      const tooltipHeight = tooltip.offsetHeight || 120;
      let top = segRect.top - tooltipHeight - 8;
      if (top < 10) {
        top = segRect.bottom + 8;
      }

      if (tooltip.style) {
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
      }
    }

    if (tooltip.classList && typeof tooltip.classList.add === 'function') {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          tooltip.classList.add('visible');
        });
      } else {
        tooltip.classList.add('visible');
      }
    }
  },

  // Masquer la fenêtre d'information flottante
  hideTimelineTooltip() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const tooltip = document.getElementById('sidebar-day-event-tooltip');
    if (tooltip) {
      if (tooltip.classList && typeof tooltip.classList.remove === 'function') {
        tooltip.classList.remove('visible');
      }
      setTimeout(() => {
        if (tooltip.classList && !tooltip.classList.contains('visible') && tooltip.style) {
          tooltip.style.display = 'none';
        }
      }, 160);
    }
  },

  // Post-it rapide dans le volet latéral
  initSidebarStickyNote() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const textarea = document.getElementById('sidebar-sticky-note-text');
    const clearBtn = document.getElementById('sidebar-sticky-note-clear');

    if (textarea) {
      if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSidebarQuickNote === 'function') {
        textarea.value = StorageManager.getSidebarQuickNote();
      }
      textarea.addEventListener('input', () => {
        if (typeof StorageManager !== 'undefined' && typeof StorageManager.saveSidebarQuickNote === 'function') {
          StorageManager.saveSidebarQuickNote(textarea.value);
        }
      });
    }

    if (clearBtn && textarea) {
      clearBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (textarea.value && textarea.value.trim().length > 0 && typeof this.confirm === 'function') {
          const confirmed = await this.confirm({
            title: 'Effacer le post-it rapide',
            message: 'Voulez-vous vraiment effacer le contenu de votre pense-bête ?',
            confirmText: 'Effacer',
            cancelText: 'Annuler',
            danger: true
          });
          if (!confirmed) return;
        }
        textarea.value = '';
        if (typeof StorageManager !== 'undefined' && typeof StorageManager.saveSidebarQuickNote === 'function') {
          StorageManager.saveSidebarQuickNote('');
        }
        textarea.focus();
      });
    }

    // Si aucune donnée sticky-note, ne rien toucher, sinon activer les boutons de conversion rapide
    const btnStickyToTask = document.getElementById('sidebar-sticky-to-task');
    if (btnStickyToTask && textarea) {
      btnStickyToTask.addEventListener('click', (e) => {
        e.preventDefault();
        const text = (textarea.value || '').trim();
        if (!text) {
          this.showToast("Le post-it est vide.", "info");
          return;
        }
        if (typeof TasksManager !== 'undefined' && typeof TasksManager.addTask === 'function') {
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const title = lines[0] || text.slice(0, 80);
          const desc = lines.length > 1 ? lines.slice(1).join('\n') : '';
          TasksManager.addTask({ title, description: desc, priority: 'medium' });
          textarea.value = '';
          if (typeof StorageManager !== 'undefined' && typeof StorageManager.saveSidebarQuickNote === 'function') {
            StorageManager.saveSidebarQuickNote('');
          }
          this.showToast(`Tâche « ${title} » créée depuis le post-it`, 'success');
        }
      });
    }

    const btnStickyToNote = document.getElementById('sidebar-sticky-to-note');
    if (btnStickyToNote && textarea) {
      btnStickyToNote.addEventListener('click', (e) => {
        e.preventDefault();
        const text = (textarea.value || '').trim();
        if (!text) {
          this.showToast("Le post-it est vide.", "info");
          return;
        }
        if (typeof NotesManager !== 'undefined' && typeof NotesManager.getAll === 'function') {
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const title = (lines[0] || 'Mémo rapide').slice(0, 80);
          const bodyHtml = text.split(/\r?\n/).map(l => `<div>${this.escapeHtml(l) || '<br>'}</div>`).join('');
          const allNotes = NotesManager.getAll();
          const newNote = {
            id: 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            title,
            folder: 'Général',
            tags: [],
            projectId: null,
            linkedEventId: null,
            linkedTaskId: null,
            content: bodyHtml,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          allNotes.unshift(newNote);
          NotesManager.saveAll(allNotes);
          textarea.value = '';
          if (typeof StorageManager !== 'undefined' && typeof StorageManager.saveSidebarQuickNote === 'function') {
            StorageManager.saveSidebarQuickNote('');
          }
          this.navigate('notes');
          if (typeof NotesManager.selectNote === 'function') NotesManager.selectNote(newNote.id);
          this.showToast(`Note « ${title} » enregistrée`, 'success');
        }
      });
    }

    this.updateSidebarStickyNote();
  },

  updateSidebarStickyNote() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const widget = document.getElementById('sidebar-sticky-note-widget');
    if (!widget) return;

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    const isEnabled = settings.sidebarStickyNoteEnabled !== false;
    widget.style.display = isEnabled ? 'flex' : 'none';
  },

  bindGlobalActions() {
    // Bouton thème rapide
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const settings = StorageManager.getSettings();
        const next = settings.theme === 'light' ? 'dark' : 'light';
        settings.theme = next;
        StorageManager.saveSettings(settings);
        this.applyAppearanceSettings(settings);
        if (typeof SettingsManager !== 'undefined') SettingsManager.render();
      });
    }

    // Bouton d'ajout rapide global
    const btnQuickAdd = document.getElementById('btn-global-quick-add');
    if (btnQuickAdd) {
      btnQuickAdd.addEventListener('click', () => {
        TasksManager.openTaskModal();
      });
    }

    // Bascule d'ouverture / fermeture du volet latéral
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    }

    this.initWindowControls();

    this._bindWhatsNewModalButtons();

    // Raccourcis clavier globaux (Échap, Entrée, Ctrl+F, Ctrl+B, Ctrl+Shift+A, F1)
    const getTopmostActiveModal = () => {
      if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
      const actives = Array.from(document.querySelectorAll('.modal-overlay.active'));
      if (actives.length === 0) return null;
      const dialog = actives.find(m => m.id === 'dialog-modal');
      if (dialog) return dialog;
      let top = actives[actives.length - 1];
      let topZ = -1;
      actives.forEach(m => {
        let z = 0;
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          z = parseInt(window.getComputedStyle(m).zIndex, 10) || 0;
        }
        if (z >= topZ) {
          topZ = z;
          top = m;
        }
      });
      return top;
    };

    const closeModalOverlay = (overlay) => {
      if (!overlay) return;
      if (overlay.id === 'dialog-modal') {
        if (typeof overlay._dialogCancelHandler === 'function') {
          overlay._dialogCancelHandler();
        } else {
          overlay.classList.remove('active');
        }
        return;
      }
      if (overlay.id === 'whats-new-modal') {
        this.closeWhatsNewModal(true);
        return;
      }
      if (overlay.id === 'wallpaper-studio-modal' && typeof SettingsManager !== 'undefined' && typeof SettingsManager.closeWallpaperStudioModal === 'function') {
        SettingsManager.closeWallpaperStudioModal();
        return;
      }
      if (overlay.id === 'modal-update-prompt') {
        this.postponeUpdatePromptModal();
        return;
      }
      if (overlay.id === 'search-modal' && typeof SearchManager !== 'undefined' && typeof SearchManager.close === 'function') {
        SearchManager.close();
        return;
      }
      overlay.classList.remove('active');
    };

    document.addEventListener('keydown', (e) => {
      // 1. Fermeture ordonnée couche par couche par Échap
      if (e.key === 'Escape') {
        const colorPopover = document.getElementById('custom-accent-color-popover');
        if (colorPopover && colorPopover.style.display !== 'none') {
          this.closeColorPicker(true);
          return;
        }

        const topModal = getTopmostActiveModal();
        if (topModal) {
          if (topModal.id === 'dialog-modal') {
            // Laisser le handler dédié du dialogue ou annuler proprement si absent
            if (typeof topModal._dialogCancelHandler === 'function') {
              e.preventDefault();
              topModal._dialogCancelHandler();
            }
            return;
          }
          e.preventDefault();
          closeModalOverlay(topModal);
          return;
        }

        if (typeof SearchManager !== 'undefined' && SearchManager.isOpen && typeof SearchManager.close === 'function') {
          SearchManager.close();
        }
      }

      // 2. Recherche universelle Ctrl+F ou Ctrl+K
      const isF = (e.code === 'KeyF') || (e.key && e.key.toLowerCase() === 'f');
      const isK = (e.code === 'KeyK') || (e.key && e.key.toLowerCase() === 'k');
      if ((e.ctrlKey || e.metaKey) && (isF || isK)) {
        const inNoteEditor = e.target && (e.target.id === 'note-body-editor' || (typeof e.target.closest === 'function' && e.target.closest('#note-body-editor')));
        if (isK && inNoteEditor) {
          return;
        }
        e.preventDefault();
        if (typeof SearchManager !== 'undefined' && typeof SearchManager.open === 'function') {
          SearchManager.open();
        }
      }

      // 3. Bascule Afficher / Masquer l'application Ctrl+Maj+A (CommandOrControl+Shift+A)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ((e.code === 'KeyA') || (e.key && e.key.toLowerCase() === 'a'))) {
        e.preventDefault();
        if (typeof window !== 'undefined' && window.AntigraviteAPI && typeof window.AntigraviteAPI.toggleWindow === 'function') {
          window.AntigraviteAPI.toggleWindow();
        }
      }

      // 4. Validation formulaire modale par Entrée ou Ctrl+Entrée (cible uniquement la modale au premier plan)
      const isEnter = (e.key === 'Enter' || e.code === 'Enter');
      if (isEnter) {
        const colorPopover = document.getElementById('custom-accent-color-popover');
        if (colorPopover && colorPopover.style.display !== 'none') {
          return;
        }

        const activeModal = getTopmostActiveModal();
        if (activeModal && activeModal.id !== 'dialog-modal') {
          const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toUpperCase() : '';

          // 4a. Ctrl+Entrée (ou Cmd+Entrée) : validation et fermeture universelle depuis n'importe où dans la modale
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const primaryBtn = activeModal.querySelector('#event-modal-save:not(:disabled), #task-modal-save:not(:disabled), #project-modal-save:not(:disabled), #btn-save-picker-modal:not(:disabled), #btn-done-playlist-select-modal:not(:disabled), .modal-footer .btn-primary:not(:disabled), .modal-actions .btn-primary:not(:disabled), button.btn-primary:not(:disabled)');
            if (primaryBtn) {
              primaryBtn.click();
            }
          }
          // 4b. Entrée simple (sans shift ni ctrl/meta) : validation depuis un champ INPUT standard
          else if (!e.shiftKey) {
            if (tag === 'INPUT' && activeModal.contains(document.activeElement)) {
              const primaryBtn = activeModal.querySelector('.modal-footer .btn-primary:not(:disabled), .modal-actions .btn-primary:not(:disabled), button.btn-primary:not(:disabled)');
              if (primaryBtn) {
                e.preventDefault();
                primaryBtn.click();
              }
            }
          }
        }
      }

      // 5. Bascule du volet latéral Ctrl+B
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ((e.code === 'KeyB') || (e.key && e.key.toLowerCase() === 'b'))) {
        // Ne pas intercepter si l'utilisateur est en train de taper dans un champ de saisie (ex: Ctrl+B = Gras dans les notes)
        const inNoteEditor = e.target && (e.target.id === 'note-body-editor' || (typeof e.target.closest === 'function' && e.target.closest('#note-body-editor')));
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (tag === 'TEXTAREA' || tag === 'INPUT' || (e.target && e.target.isContentEditable) || inNoteEditor) {
          return;
        }
        e.preventDefault();
        this.toggleSidebar();
      }

      // 6. Aide & Astuces F1
      if (e.key === 'F1') {
        e.preventDefault();
        this.navigate('settings');
        if (typeof SettingsManager !== 'undefined') {
          SettingsManager.switchTab('help');
        }
      }

      // 7. Raccourci Agenda 'T' pour revenir à Aujourd'hui (et 07h00)
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || (typeof e.target.closest === 'function' && e.target.closest('#note-body-editor')));
        const activeModal = (typeof document !== 'undefined' && typeof document.querySelector === 'function') ? document.querySelector('.modal-overlay.active') : null;
        if (!inInput && !activeModal && this.currentScreen === 'agenda') {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.navigateToday === 'function') {
            window.AgendaManager.navigateToday();
          }
        }
      }
    });

    // Sauvegarde immédiate lors de la fermeture ou du rechargement
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', () => {
        if (window.NotesManager && typeof window.NotesManager.flushPendingSave === 'function') {
          window.NotesManager.flushPendingSave();
        }
      });
    }

    // Fermeture des modales par clic sur le fond
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModalOverlay(overlay);
        }
      });
    });


    // Cartes statistiques et panneaux du tableau de bord cliquables (redirection avec retour haptique non sonore)
    document.querySelectorAll('.stat-card[data-nav], .panel-header[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Ne pas intercepter les clics sur les boutons internes (ex: "Voir tout" ou "➕")
        if (e.target.closest('button')) return;
        const targetScreen = el.dataset.nav;
        const statAction = el.dataset.statAction;
        if (targetScreen) {
          this.triggerHapticFeedback();
          el.classList.add('haptic-press');
          setTimeout(() => el.classList.remove('haptic-press'), 130);
          this.navigate(targetScreen);
          if (targetScreen === 'tasks' && statAction && typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.focusDashboardStat === 'function') {
            window.TasksManager.focusDashboardStat(statAction);
          }
        }
      });
    });

    // Remplissage dynamique en temps réel pour tous les curseurs / tirettes de réglage (.settings-slider, etc.)
    document.addEventListener('input', (e) => {
      if (e.target && (
        (e.target.classList && e.target.classList.contains('settings-slider')) ||
        e.target.id === 'wallpaper-opacity-slider' ||
        e.target.id === 'wallpaper-blur-slider' ||
        e.target.id === 'slider-notification-volume' ||
        e.target.id === 'studio-param-angle' ||
        e.target.id === 'studio-param-size' ||
        e.target.id === 'studio-param-intensity' ||
        e.target.id === 'studio-param-blur'
      )) {
        this.updateSliderFill(e.target);
      }
    });
  },

  // Met à jour le remplissage dynamique à gauche du curseur pour une glissière / tirette de réglage
  updateSliderFill(slider) {
    if (!slider) return;
    const min = (slider.min !== '' && !isNaN(parseFloat(slider.min))) ? parseFloat(slider.min) : 0;
    const max = (slider.max !== '' && !isNaN(parseFloat(slider.max))) ? parseFloat(slider.max) : 100;
    const val = (slider.value !== '' && !isNaN(parseFloat(slider.value))) ? parseFloat(slider.value) : min;
    const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
    slider.style.setProperty('--slider-percent', `${pct}%`);
  },

  // Met à jour le remplissage de toutes les glissières / tirettes des paramètres et du studio
  updateAllSlidersFill(container = (typeof document !== 'undefined' ? document : null)) {
    if (!container || typeof container.querySelectorAll !== 'function') return;
    const sliders = container.querySelectorAll('.settings-slider, #wallpaper-opacity-slider, #wallpaper-blur-slider, #slider-notification-volume, #studio-param-angle, #studio-param-size, #studio-param-intensity, #studio-param-blur');
    sliders.forEach(slider => this.updateSliderFill(slider));
  },

  triggerHapticFeedback() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch (_) {}
  },

  // Initialisation des boutons Réduire, Agrandir/Restaurer, Fermer intégrés dans le bandeau supérieur
  initWindowControls() {
    if (typeof document === 'undefined') return;

    const btnMin = document.getElementById('btn-win-minimize');
    const btnMax = document.getElementById('btn-win-maximize');
    const btnClose = document.getElementById('btn-win-close');
    const iconMax = document.getElementById('icon-win-maximize');
    const iconRestore = document.getElementById('icon-win-restore');

    const updateMaxIcon = (isMaximized) => {
      if (iconMax && iconRestore) {
        iconMax.style.display = isMaximized ? 'none' : 'block';
        iconRestore.style.display = isMaximized ? 'block' : 'none';
      }
      if (btnMax) {
        btnMax.title = isMaximized ? 'Restaurer' : 'Agrandir';
        btnMax.setAttribute('aria-label', isMaximized ? 'Restaurer' : 'Agrandir');
      }
    };

    if (btnMin) {
      btnMin.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.windowControls) {
          window.AntigraviteAPI.windowControls.minimize();
        }
      });
    }

    if (btnMax) {
      btnMax.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.windowControls) {
          const isMax = await window.AntigraviteAPI.windowControls.maximize();
          updateMaxIcon(isMax);
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.windowControls) {
          window.AntigraviteAPI.windowControls.close();
        }
      });
    }

    if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.windowControls) {
      if (typeof window.AntigraviteAPI.windowControls.onMaximizeChanged === 'function') {
        window.AntigraviteAPI.windowControls.onMaximizeChanged(updateMaxIcon);
      }
      if (typeof window.AntigraviteAPI.windowControls.isMaximized === 'function') {
        window.AntigraviteAPI.windowControls.isMaximized().then(updateMaxIcon).catch(() => {});
      }
    }
  },

  // Modale unifiée de confirmation selon la charte graphique
  confirm(options = {}) {
    const title = typeof options === 'string' ? 'Confirmation' : (options.title || 'Confirmation');
    const message = typeof options === 'string' ? options : (options.message || '');
    const confirmText = options.confirmText || 'Confirmer';
    const cancelText = options.cancelText || 'Annuler';
    const isDanger = options.danger !== false;
    const defaultIcon = isDanger
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    const icon = this.resolveDialogIcon(options.icon, defaultIcon);

    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        const fallback = typeof confirm === 'function' ? confirm(message) : true;
        return resolve(fallback);
      }
      const modal = document.getElementById('dialog-modal');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconEl = document.getElementById('dialog-icon');
      const btnConfirm = document.getElementById('dialog-btn-confirm');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const btnClose = document.getElementById('dialog-btn-close');

      if (!modal || !btnConfirm || !btnCancel) {
        const fallback = typeof confirm === 'function' ? confirm(message) : true;
        return resolve(fallback);
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (iconEl) iconEl.innerHTML = icon;
      const inputEl = document.getElementById('dialog-input');
      if (inputEl) inputEl.style.display = 'none';
      btnConfirm.textContent = confirmText;
      btnConfirm.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
      btnCancel.textContent = cancelText;
      btnCancel.style.display = 'inline-flex';

      const cleanup = (result) => {
        modal.classList.remove('active');
        modal._dialogCancelHandler = null;
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('keydown', onKeyDown);
        }
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        if (btnClose) btnClose.onclick = null;
        resolve(result);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          cleanup(true);
        }
      };

      modal._dialogCancelHandler = () => cleanup(false);
      btnConfirm.onclick = () => cleanup(true);
      btnCancel.onclick = () => cleanup(false);
      if (btnClose) btnClose.onclick = () => cleanup(false);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', onKeyDown);
      }

      modal.classList.add('active');
      if (typeof btnConfirm.focus === 'function') btnConfirm.focus();
    });
  },

  // Modale unifiée d'information / alerte selon la charte graphique
  alert(options = {}) {
    const title = typeof options === 'string' ? 'Information' : (options.title || 'Information');
    const message = typeof options === 'string' ? options : (options.message || '');
    const okText = options.okText || 'Compris';
    const type = options.type || 'info';
    const defaultAlertIcons = {
      error: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      success: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const defaultIcon = defaultAlertIcons[type] || defaultAlertIcons.info;
    const icon = this.resolveDialogIcon(options.icon, defaultIcon);

    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        if (typeof alert === 'function') alert(message);
        return resolve();
      }
      const modal = document.getElementById('dialog-modal');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconEl = document.getElementById('dialog-icon');
      const btnConfirm = document.getElementById('dialog-btn-confirm');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const btnClose = document.getElementById('dialog-btn-close');

      if (!modal || !btnConfirm) {
        if (typeof alert === 'function') alert(message);
        return resolve();
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (iconEl) iconEl.innerHTML = icon;
      const inputEl = document.getElementById('dialog-input');
      if (inputEl) inputEl.style.display = 'none';
      btnConfirm.textContent = okText;
      btnConfirm.className = (type === 'error') ? 'btn btn-danger' : 'btn btn-primary';
      if (btnCancel) btnCancel.style.display = 'none';

      const cleanup = () => {
        modal.classList.remove('active');
        modal._dialogCancelHandler = null;
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('keydown', onKeyDown);
        }
        btnConfirm.onclick = null;
        if (btnClose) btnClose.onclick = null;
        resolve();
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          cleanup();
        }
      };

      modal._dialogCancelHandler = () => cleanup();
      btnConfirm.onclick = () => cleanup();
      if (btnClose) btnClose.onclick = () => cleanup();
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', onKeyDown);
      }

      modal.classList.add('active');
      if (typeof btnConfirm.focus === 'function') btnConfirm.focus();
    });
  },

  // Modale unifiée de saisie textuelle (Prompt) selon la charte graphique
  prompt(options = {}) {
    const title = typeof options === 'string' ? 'Saisie' : (options.title || 'Saisie');
    const message = typeof options === 'string' ? options : (options.message || '');
    const defaultValue = (typeof options === 'object' && options.defaultValue !== undefined && options.defaultValue !== null) ? String(options.defaultValue) : '';
    const placeholder = (typeof options === 'object' && options.placeholder) ? options.placeholder : '';
    const confirmText = (typeof options === 'object' && options.confirmText) ? options.confirmText : 'Valider';
    const cancelText = (typeof options === 'object' && options.cancelText) ? options.cancelText : 'Annuler';
    const defaultIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    const icon = this.resolveDialogIcon(options.icon, defaultIcon);

    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        const fallback = typeof prompt === 'function' ? prompt(message, defaultValue) : defaultValue;
        return resolve(fallback);
      }
      const modal = document.getElementById('dialog-modal');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconEl = document.getElementById('dialog-icon');
      const btnConfirm = document.getElementById('dialog-btn-confirm');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const btnClose = document.getElementById('dialog-btn-close');
      let inputEl = document.getElementById('dialog-input');

      if (!modal || !btnConfirm || !btnCancel) {
        const fallback = typeof prompt === 'function' ? prompt(message, defaultValue) : defaultValue;
        return resolve(fallback);
      }

      if (!inputEl) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.id = 'dialog-input';
        inputEl.className = 'form-input';
        inputEl.style.width = '100%';
        inputEl.style.marginTop = '14px';
        const modalBody = modal.querySelector ? modal.querySelector('.modal-body') : null;
        if (modalBody && typeof modalBody.appendChild === 'function') {
          modalBody.appendChild(inputEl);
        }
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (iconEl) iconEl.innerHTML = icon;

      inputEl.style.display = 'block';
      inputEl.value = defaultValue;
      inputEl.placeholder = placeholder;

      btnConfirm.textContent = confirmText;
      btnConfirm.className = 'btn btn-primary';
      btnCancel.textContent = cancelText;
      btnCancel.style.display = 'inline-flex';

      const cleanup = (result) => {
        modal.classList.remove('active');
        modal._dialogCancelHandler = null;
        inputEl.style.display = 'none';
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('keydown', onKeyDown);
        }
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        if (btnClose) btnClose.onclick = null;
        resolve(result);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          cleanup(inputEl.value);
        }
      };

      modal._dialogCancelHandler = () => cleanup(null);
      btnConfirm.onclick = () => cleanup(inputEl.value);
      btnCancel.onclick = () => cleanup(null);
      if (btnClose) btnClose.onclick = () => cleanup(null);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', onKeyDown);
      }

      modal.classList.add('active');
      setTimeout(() => {
        if (typeof inputEl.focus === 'function') inputEl.focus();
        if (typeof inputEl.select === 'function') inputEl.select();
      }, 50);
    });
  },

  /* ==========================================================================
     Sélecteur Chromatique Universel Intégré (v1.3.0)
     Ouverture juste à côté à droite de l'élément cliqué
     ========================================================================== */
  _normalizeHexColor(hex, fallback = '#38BDF8') {
    if (typeof hex !== 'string') return fallback;
    let c = hex.trim().replace(/^#/, '');
    if (/^[0-9A-F]{3}$/i.test(c)) {
      c = c.split('').map(x => x + x).join('');
    }
    if (!/^[0-9A-F]{6}$/i.test(c)) return fallback;
    return `#${c.toUpperCase()}`;
  },

  _sanitizeCssColor(color, fallback = '#6366f1') {
    if (typeof color !== 'string') return fallback;
    const trimmed = color.trim();
    if (/^#([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(trimmed)) return trimmed;
    if (/^(?:rgb|hsl)a?\(\s*[0-9.%,\s/-]+\)$/i.test(trimmed)) return trimmed;
    if (/^var\(--[a-zA-Z0-9_-]+(?:\s*,\s*#[0-9A-F]{3,8})?\)$/.test(trimmed)) return trimmed;
    return fallback;
  },

  _escapeJsSingleQuote(val) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },

  hexToRgb(hex) {
    const clean = this._normalizeHexColor(hex, '#38BDF8').slice(1);
    const num = parseInt(clean, 16);
    if (!Number.isFinite(num)) return { r: 56, g: 189, b: 248 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  },

  adjustColorBrightness(hex, percent) {
    const rgb = this.hexToRgb(hex);
    const factor = (percent / 100);
    const r = Math.min(255, Math.max(0, Math.round(rgb.r + (percent > 0 ? (255 - rgb.r) * factor : rgb.r * factor))));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g + (percent > 0 ? (255 - rgb.g) * factor : rgb.g * factor))));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b + (percent > 0 ? (255 - rgb.b) * factor : rgb.b * factor))));
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  },

  hslToHex(h, s, l) {
    const safeH = Number.isFinite(Number(h)) ? ((Number(h) % 360) + 360) % 360 : 0;
    const safeS = Number.isFinite(Number(s)) ? Math.max(0, Math.min(100, Number(s))) : 92;
    const safeL = (Number.isFinite(Number(l)) ? Math.max(0, Math.min(100, Number(l))) : 50) / 100;
    const a = (safeS * Math.min(safeL, 1 - safeL)) / 100;
    const f = (n) => {
      const k = (n + safeH / 30) % 12;
      const color = safeL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0');
    };
    return (`#${f(0)}${f(8)}${f(4)}`).toUpperCase();
  },

  hexToHsl(hex) {
    const clean = this._normalizeHexColor(hex, '#38BDF8').slice(1);
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  },

  openColorPicker(options = {}) {
    if (typeof document === 'undefined') return;
    const popover = document.getElementById('custom-accent-color-popover');
    if (!popover) return;

    this.initColorPickerEvents();

    const targetElement = options.targetElement;
    const initialColor = this._normalizeHexColor(options.initialColor, '#38BDF8');
    const initialHsl = this.hexToHsl(initialColor);
    const showNameInput = !!options.showNameInput;
    const initialName = options.initialName || '';
    const title = options.title || 'Palette chromatique';
    const applyLabel = options.applyLabel || 'Appliquer';

    this._activeColorPicker = {
      initialColor: initialColor,
      currentColor: initialColor,
      currentSat: initialHsl.s,
      targetElement: targetElement,
      showNameInput: showNameInput,
      onColorChange: typeof options.onColorChange === 'function' ? options.onColorChange : null,
      onApply: typeof options.onApply === 'function' ? options.onApply : null,
      onCancel: typeof options.onCancel === 'function' ? options.onCancel : null
    };

    const titleEl = document.getElementById('popover-color-title');
    const applyBtn = document.getElementById('btn-apply-accent-popover');
    const nameGroup = document.getElementById('popover-name-group');
    const nameInput = document.getElementById('popover-input-name');

    if (titleEl) titleEl.textContent = title;
    if (applyBtn) applyBtn.textContent = applyLabel;
    if (nameGroup) nameGroup.style.display = showNameInput ? 'flex' : 'none';
    if (nameInput) {
      nameInput.value = initialName;
      if (options.namePlaceholder) nameInput.placeholder = options.namePlaceholder;
    }

    // Nuancier des favoris personnalisés de l'utilisateur
    const customSwatchesContainer = document.getElementById('popover-custom-swatches');
    if (customSwatchesContainer) {
      let customColors = [];
      try {
        const settings = (typeof StorageManager !== 'undefined' && StorageManager.getSettings) ? StorageManager.getSettings() : {};
        customColors = Array.isArray(settings.customAccentColors) ? settings.customAccentColors : [];
      } catch (_) {}

      if (customColors.length > 0) {
        customSwatchesContainer.style.display = 'flex';
        customSwatchesContainer.innerHTML = `
          <div class="popover-section-label">Couleurs favorites</div>
          <div class="popover-custom-grid">
            ${customColors.map(c => {
              const safeHex = this._normalizeHexColor(c && c.hex, '#38BDF8');
              const label = this.escapeHtml((c && c.name) || safeHex);
              return `<button type="button" class="popover-swatch" data-hex="${safeHex}" style="background: ${safeHex};" title="${label}"></button>`;
            }).join('')}
          </div>
        `;
      } else {
        customSwatchesContainer.style.display = 'none';
        customSwatchesContainer.innerHTML = '';
      }
    }

    // Lecture préalable du bouton cible et du viewport avant mutation de display sur le popover
    const winW = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1200;
    const winH = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 800;
    const margin = 14;

    let rect = null;
    if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
      const r = targetElement.getBoundingClientRect();
      if ((r.width > 0 || r.height > 0) && (r.top !== 0 || r.left !== 0 || r.bottom !== 0 || r.right !== 0)) {
        rect = r;
      }
    }

    // Initialisation des curseurs et badges sans déclencher onColorChange ('init')
    this.updateColorPickerValues(initialColor, 'init');

    // Rendre mesurable dans le flux sans afficher prématurément
    popover.style.display = 'block';
    popover.style.visibility = 'hidden';

    // Mesure réelle des dimensions rendues du popover
    const popoverRect = (typeof popover.getBoundingClientRect === 'function') ? popover.getBoundingClientRect() : null;
    const popoverWidth = Math.max(275, Math.ceil((popoverRect && popoverRect.width) || 275));
    const popoverHeight = Math.max(340, Math.ceil((popoverRect && popoverRect.height) || 385));

    let left = 0;
    let top = 0;

    if (rect) {
      // 1. Placement horizontal : priorité juste à côté à droite (+10px)
      left = rect.right + 10;

      // Si débordement sur la droite de l'écran, basculer à gauche du bouton cible
      if (left + popoverWidth > winW - margin) {
        const leftCandidate = rect.left - popoverWidth - 10;
        if (leftCandidate >= margin) {
          left = leftCandidate;
        } else {
          // Si ni droite ni gauche n'a 100% de place, caler dans la marge de droite
          left = Math.max(margin, winW - popoverWidth - margin);
        }
      }

      // 2. Placement vertical : centré ou aligné sur le haut du bouton
      top = rect.top + (rect.height / 2) - 40;

      // Ajustement vertical strict : tout le nuancier (notamment les boutons en bas) reste visible
      if (top + popoverHeight > winH - margin) {
        top = winH - popoverHeight - margin;
      }
      if (top < margin) {
        top = margin;
      }
    } else {
      // Fallback si pas de bouton ou bouton non positionné : centrage parfait dans la fenêtre
      left = Math.max(margin, Math.round((winW - popoverWidth) / 2));
      top = Math.max(margin, Math.round((winH - popoverHeight) / 2));
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.visibility = 'visible';
  },

  closeColorPicker(revert = false) {
    if (typeof document === 'undefined') return;
    const popover = document.getElementById('custom-accent-color-popover');
    if (popover) popover.style.display = 'none';

    if (this._activeColorPicker) {
      if (revert && typeof this._activeColorPicker.onCancel === 'function') {
        this._activeColorPicker.onCancel(this._activeColorPicker.initialColor);
      }
      this._activeColorPicker = null;
    }
  },

  updateColorPickerValues(hex, source = null) {
    if (typeof document === 'undefined') return;
    const cleanHex = this._normalizeHexColor(hex, '#38BDF8');
    const hsl = this.hexToHsl(cleanHex);

    if (this._activeColorPicker) {
      this._activeColorPicker.currentColor = cleanHex;
      if (source !== 'slider') {
        this._activeColorPicker.currentSat = hsl.s;
      }
      if (source !== 'init' && typeof this._activeColorPicker.onColorChange === 'function') {
        this._activeColorPicker.onColorChange(cleanHex);
      }
    }

    const popover = document.getElementById('custom-accent-color-popover');
    const badge = document.getElementById('popover-color-preview-badge') || document.getElementById('popover-color-swatch-badge');
    const hexSub = document.getElementById('popover-color-hex-sub');
    const hexInput = document.getElementById('popover-input-hex');
    const hueSlider = document.getElementById('popover-hue-slider');
    const hueVal = document.getElementById('popover-hue-val');
    const lightnessSlider = document.getElementById('popover-lightness-slider');
    const lightnessVal = document.getElementById('popover-lightness-val');

    if (source !== 'slider') {
      if (hueSlider) hueSlider.value = hsl.h;
      if (lightnessSlider) lightnessSlider.value = Math.max(0, Math.min(100, hsl.l));
    }
    if (hueVal) hueVal.textContent = `${hsl.h}°`;
    if (lightnessVal) lightnessVal.textContent = `${hsl.l}%`;

    if (source !== 'hexInput' && hexInput) {
      hexInput.value = cleanHex;
    }
    if (badge) badge.style.backgroundColor = cleanHex;
    if (hexSub) hexSub.textContent = cleanHex;

    if (popover && popover.style && typeof popover.style.setProperty === 'function') {
      const trackSat = (this._activeColorPicker && typeof this._activeColorPicker.currentSat === 'number')
        ? this._activeColorPicker.currentSat
        : hsl.s;
      popover.style.setProperty('--popover-cur-hue', `hsl(${hsl.h}, ${trackSat}%, 50%)`);
      if (typeof popover.querySelectorAll === 'function') {
        popover.querySelectorAll('.popover-swatch').forEach(sw => {
          const swHex = (sw.dataset.hex || '').toUpperCase();
          if (sw.classList && typeof sw.classList.toggle === 'function') {
            sw.classList.toggle('active', swHex === cleanHex);
          }
        });
      }
    }
  },

  initColorPickerEvents() {
    if (this._colorPickerEventsBound || typeof document === 'undefined') return;
    this._colorPickerEventsBound = true;

    const popover = document.getElementById('custom-accent-color-popover');
    if (!popover) return;

    const btnClose = document.getElementById('btn-close-accent-popover');
    const btnCancel = document.getElementById('btn-cancel-accent-popover');
    const btnApply = document.getElementById('btn-apply-accent-popover');

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeColorPicker(true);
      });
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeColorPicker(true);
      });
    }

    const handleApply = () => {
      const hexInput = document.getElementById('popover-input-hex');
      const nameInput = document.getElementById('popover-input-name');
      let rawHex = hexInput ? hexInput.value.trim().toUpperCase() : '';
      if (!rawHex.startsWith('#') && rawHex.length > 0) rawHex = '#' + rawHex;
      if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(rawHex)) {
        if (typeof this.showToast === 'function') {
          this.showToast("Format de couleur invalide (ex: #38BDF8)", "warning");
        }
        return;
      }
      const hex = this._normalizeHexColor(rawHex, '#38BDF8');
      const name = (nameInput && nameInput.value.trim()) || ('Teinte ' + hex);
      const active = this._activeColorPicker;
      this.closeColorPicker(false);
      if (active && typeof active.onApply === 'function') {
        active.onApply(hex, name);
      }
    };

    if (btnApply) {
      btnApply.addEventListener('click', (e) => {
        e.preventDefault();
        handleApply();
      });
    }

    if (popover && typeof popover.addEventListener === 'function') {
      popover.addEventListener('click', (e) => {
        const swatch = e.target.closest ? e.target.closest('.popover-swatch') : null;
        if (swatch && swatch.dataset && swatch.dataset.hex) {
          e.preventDefault();
          this.updateColorPickerValues(swatch.dataset.hex, 'swatch');
        }
      });
    }

    const hueSlider = document.getElementById('popover-hue-slider');
    const lightnessSlider = document.getElementById('popover-lightness-slider');

    const handleSlidersChange = (fromHueSlider = false) => {
      const h = hueSlider ? parseInt(hueSlider.value, 10) : 200;
      const l = lightnessSlider ? parseInt(lightnessSlider.value, 10) : 60;
      let sat = (this._activeColorPicker && typeof this._activeColorPicker.currentSat === 'number')
        ? this._activeColorPicker.currentSat
        : 92;
      if (fromHueSlider && sat === 0 && l > 0 && l < 100) {
        sat = 80;
        if (this._activeColorPicker) this._activeColorPicker.currentSat = sat;
      }
      const hex = this.hslToHex(h, sat, l);
      this.updateColorPickerValues(hex, 'slider');
    };

    if (hueSlider) hueSlider.addEventListener('input', () => handleSlidersChange(true));
    if (lightnessSlider) lightnessSlider.addEventListener('input', () => handleSlidersChange(false));

    const hexInput = document.getElementById('popover-input-hex');
    if (hexInput) {
      hexInput.addEventListener('input', () => {
        let val = hexInput.value.trim().toUpperCase();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(val)) {
          this.updateColorPickerValues(val, 'hexInput');
        }
      });
      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApply();
        }
      });
    }

    const nameInput = document.getElementById('popover-input-name');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApply();
        }
      });
    }

    document.addEventListener('pointerdown', (e) => {
      if (popover.style.display !== 'none' &&
          !popover.contains(e.target) &&
          (!this._activeColorPicker || !this._activeColorPicker.targetElement || !this._activeColorPicker.targetElement.contains(e.target))) {
        this.closeColorPicker(true);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover.style.display !== 'none') {
        this.closeColorPicker(true);
      }
    });
  },

  toggleSidebar() {
    const container = document.getElementById('app-container');
    if (!container) return;
    const isCollapsed = container.classList.toggle('sidebar-collapsed');
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    }
    try {
      localStorage.setItem('antigravite_sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch (_e) {}
    this.updateSidebarToggleButton(isCollapsed);
  },

  updateSidebarToggleButton(isCollapsed) {
    const btn = document.getElementById('btn-toggle-sidebar');
    if (btn) {
      btn.classList.toggle('collapsed', isCollapsed);
      btn.setAttribute('title', isCollapsed ? 'Développer le volet latéral (Ctrl+B)' : 'Réduire le volet latéral (Ctrl+B)');
      if (!btn.querySelector('svg')) {
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
      }
    }
  },

  initSidebarState() {
    let isCollapsed = false;
    try {
      const saved = localStorage.getItem('antigravite_sidebar_collapsed');
      isCollapsed = saved === '1';
    } catch (_e) {}
    if (isCollapsed) {
      const container = document.getElementById('app-container');
      if (container) container.classList.add('sidebar-collapsed');
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('sidebar-collapsed');
      }
    }
    this.updateSidebarToggleButton(isCollapsed);
  },

  initSidebarRailTooltips() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

    let tooltip = document.getElementById('sidebar-rail-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'sidebar-rail-tooltip';
      tooltip.className = 'sidebar-rail-tooltip';
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(tooltip);
      }
    }

    const items = document.querySelectorAll('#sidebar .nav-item, #sidebar-quick-backup, #theme-toggle-btn');
    items.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function' && StorageManager.getSettings().disablePreviews === true) {
          return;
        }
        const container = document.getElementById('app-container');
        if (!container || !container.classList.contains('sidebar-collapsed')) return;

        const titleText = el.getAttribute('title') || el.dataset.railTitle || (el.dataset && el.dataset.screen ? el.dataset.screen : '');
        if (!titleText) return;

        // Stocker pour restaurer et éviter l'infobulle jaune native de l'OS
        if (el.getAttribute('title')) {
          el.dataset.railTitle = el.getAttribute('title');
          el.removeAttribute('title');
        }

        const rect = el.getBoundingClientRect();
        const top = rect.top + (rect.height / 2);
        tooltip.textContent = titleText;
        tooltip.style.top = `${top}px`;
        tooltip.classList.add('visible');
      });

      const hide = () => {
        if (tooltip) tooltip.classList.remove('visible');
        if (el.dataset.railTitle && !el.getAttribute('title')) {
          el.setAttribute('title', el.dataset.railTitle);
        }
      };

      el.addEventListener('mouseleave', hide);
      el.addEventListener('click', hide);
    });
  },

  updateThemeButtonLabel(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      if (theme === 'dark' || theme === 'oled') {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span>Mode clair</span>';
      } else {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>Mode sombre</span>';
      }
    }
  },

  initDashboardClock() {
    const CLOCK_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const CLOCK_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    let elTime = null;
    let elSec = null;
    let elDate = null;
    let elGreet = null;
    let lastMinuteKey = '';
    let lastSecondStr = '';
    let lastDateKey = '';
    let lastGreetingStr = '';

    const resolveEl = (cached, id) => (cached && cached.isConnected !== false ? cached : document.getElementById(id));
    const getPerfMode = () => {
      if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
        return StorageManager.getSettings().performanceMode || 'normal';
      }
      return 'normal';
    };

    const update = (force = false) => {
      // Pause intelligente des mutations DOM si la fenêtre est masquée ou si l'utilisateur est sur un autre écran
      if (typeof document !== 'undefined' && document.hidden === true) return;
      if (this.currentScreen && this.currentScreen !== 'home') return;

      const now = new Date();
      const perfMode = getPerfMode();

      if (perfMode !== 'potato') {
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const secText = `:${seconds}`;
        elSec = resolveEl(elSec, 'dashboard-clock-seconds');
        if (elSec && (force || secText !== lastSecondStr)) {
          lastSecondStr = secText;
          elSec.textContent = secText;
        }
      }

      const hNum = now.getHours();
      const minKey = `${String(hNum).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!force && minKey === lastMinuteKey) return;
      lastMinuteKey = minKey;

      elTime = resolveEl(elTime, 'dashboard-clock-time');
      if (elTime && elTime.textContent !== minKey) {
        elTime.textContent = minKey;
      }

      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (force || dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        elDate = resolveEl(elDate, 'dashboard-clock-date');
        if (elDate) {
          const dateStr = `${CLOCK_DAYS[now.getDay()]} ${now.getDate()} ${CLOCK_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
          if (elDate.textContent !== dateStr) elDate.textContent = dateStr;
        }
      }

      elGreet = resolveEl(elGreet, 'dashboard-greeting');
      if (elGreet) {
        const greetStr = this.getGreetingMessage(hNum);
        if (force || greetStr !== lastGreetingStr) {
          lastGreetingStr = greetStr;
          elGreet.textContent = greetStr;
        }
      }
    };

    this._updateClockFn = update;
    update(true);
    const initialPerf = getPerfMode();
    this.applyPerformanceTimers(initialPerf);

    if (!this._visibilityBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && (!this.currentScreen || this.currentScreen === 'home')) {
          update(true);
        }
        if (!document.hidden) {
          this.updateSidebarDayProgress();
        }
      });
    }
  },

  _isDormant: false,

  bindDormancyListeners() {
    if (this._dormancyBound) return;
    this._dormancyBound = true;
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        this.setDormant(document.hidden === true);
      });
    }
    if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.windowControls && typeof window.AntigraviteAPI.windowControls.onVisibilityChanged === 'function') {
      window.AntigraviteAPI.windowControls.onVisibilityChanged((payload) => {
        if (payload && typeof payload.visible === 'boolean') {
          this.setDormant(!payload.visible);
        }
      });
    }
    if (!this._notifClickBound && typeof window !== 'undefined' && window.AntigraviteAPI && typeof window.AntigraviteAPI.onNotificationClicked === 'function') {
      this._notifClickBound = true;
      window.AntigraviteAPI.onNotificationClicked((action) => {
        this.handleNotificationAction(action);
      });
    }
  },

  handleNotificationAction(action) {
    if (!action || typeof action !== 'object') return;
    switch (action.type) {
      case 'open-event':
        if (action.eventId) this.openEventFromDashboard(action.eventId);
        break;
      case 'open-task':
        this.navigate('tasks');
        if (action.taskId && typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
          setTimeout(() => window.TasksManager.openTaskModal(action.taskId), 80);
        }
        break;
      case 'open-note':
        if (action.noteId) this.openNoteFromDashboard(action.noteId);
        break;
      case 'navigate':
        if (action.screen) this.navigate(action.screen);
        if (action.statAction && action.screen === 'tasks' && typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.focusDashboardStat === 'function') {
          setTimeout(() => window.TasksManager.focusDashboardStat(action.statAction), 60);
        }
        break;
      default:
        break;
    }
  },

  setDormant(isDormant) {
    const dormant = !!isDormant;
    if (this._isDormant === dormant) return;
    this._isDormant = dormant;

    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.toggle('app-dormant', dormant);
    }

    if (dormant) {
      if (this._clockTimer) {
        clearInterval(this._clockTimer);
        this._clockTimer = null;
      }
      if (this._dayProgressTimer) {
        clearInterval(this._dayProgressTimer);
        this._dayProgressTimer = null;
      }
      if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.setDormant === 'function') {
        AgendaManager.setDormant(true);
      }
      if (typeof ConstellationManager !== 'undefined' && typeof ConstellationManager.setDormant === 'function') {
        ConstellationManager.setDormant(true);
      }
      return;
    }

    // Réveil depuis la zone de notification / reprise de visibilité
    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    this.applyPerformanceTimers(settings.performanceMode || 'normal');
    if (this._updateClockFn && (!this.currentScreen || this.currentScreen === 'home')) {
      this._updateClockFn(true);
    }
    if (typeof this.updateSidebarDayProgress === 'function') {
      this.updateSidebarDayProgress();
    }
    if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.setDormant === 'function') {
      AgendaManager.setDormant(false);
    }
    if (typeof ConstellationManager !== 'undefined' && typeof ConstellationManager.setDormant === 'function') {
      ConstellationManager.setDormant(false);
    }
    if (typeof BackupManager !== 'undefined' && typeof BackupManager.onAppResume === 'function') {
      BackupManager.onAppResume();
    }
  },

  applyPerformanceTimers(perfMode = 'normal') {
    if (this._isDormant) return;
    // Horloge accueil : 1000ms pour que les secondes s'actualisent, espacé en mode potato (secondes masquées)
    const clockMs = 1000;
    const effectiveClockMs = perfMode === 'potato' ? 15000 : clockMs;
    const dayMs = perfMode === 'potato' ? 120000 : (perfMode === 'economy' ? 60000 : 30000);

    if (this._updateClockFn && (!this._clockTimer || this._clockIntervalMs !== effectiveClockMs)) {
      this._clockIntervalMs = effectiveClockMs;
      if (this._clockTimer) clearInterval(this._clockTimer);
      this._clockTimer = setInterval(() => this._updateClockFn(false), effectiveClockMs);
      if (this._clockTimer && typeof this._clockTimer.unref === 'function') {
        this._clockTimer.unref();
      }
      if (effectiveClockMs === clockMs) {
        this._updateClockFn(true);
      }
    }

    if (typeof window !== 'undefined' && (!this._dayProgressTimer || this._dayProgressIntervalMs !== dayMs)) {
      this._dayProgressIntervalMs = dayMs;
      if (this._dayProgressTimer) clearInterval(this._dayProgressTimer);
      this._dayProgressTimer = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          this.updateSidebarDayProgress();
          if (typeof DebriefManager !== 'undefined' && typeof DebriefManager.updateTabVisibility === 'function') {
            DebriefManager.updateTabVisibility();
          }
        }
      }, dayMs);
      if (this._dayProgressTimer && typeof this._dayProgressTimer.unref === 'function') {
        this._dayProgressTimer.unref();
      }
    }

    if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.applyPerformanceMode === 'function') {
      AgendaManager.applyPerformanceMode(perfMode);
    }
  },

  syncDesktopPrefs(settings) {
    if (!settings || typeof window === 'undefined' || !window.AntigraviteAPI || !window.AntigraviteAPI.system) return;
    if (typeof window.AntigraviteAPI.system.setDesktopPrefs === 'function') {
      // Ne pas écraser launchOnStartup ici : le démarrage automatique est géré explicitement par setStartupSetting
      // afin d'éviter qu'une synchronisation visuelle/boot ne réinitialise le raccourci Windows.
      window.AntigraviteAPI.system.setDesktopPrefs({
        runInBackgroundOnClose: settings.runInBackgroundOnClose !== false,
        backupDirectory: settings.backupDirectory || null,
        performanceMode: settings.performanceMode || 'normal',
        gpuCompatibilityMode: !!settings.gpuCompatibilityMode
      }).catch(() => {});
    }
  },

  updateLiveClockNow() {
    if (this._updateClockFn) this._updateClockFn(true);
  },

  // Fonds d'écran prédéfinis (Nuances immersives)
  PRESET_WALLPAPERS: {
    nebula: 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.6), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(56, 189, 248, 0.5), transparent 60%), radial-gradient(circle at 50% 50%, #0f172a, #020617 100%)',
    aurora: 'radial-gradient(ellipse at 30% 15%, rgba(16, 185, 129, 0.6), transparent 55%), radial-gradient(ellipse at 75% 35%, rgba(6, 182, 212, 0.5), transparent 55%), radial-gradient(circle at 50% 50%, #042f2e, #021a19 100%)',
    mineral: 'radial-gradient(circle at 80% 20%, rgba(148, 163, 184, 0.4), transparent 55%), radial-gradient(circle at 20% 80%, rgba(100, 116, 139, 0.35), transparent 55%), radial-gradient(circle at 50% 50%, #18181b, #09090b 100%)',
    sunset: 'radial-gradient(ellipse at 70% 20%, rgba(244, 63, 94, 0.55), transparent 55%), radial-gradient(ellipse at 30% 60%, rgba(245, 158, 11, 0.5), transparent 55%), radial-gradient(circle at 50% 50%, #1f1124, #0b060d 100%)',
    ocean: 'radial-gradient(ellipse at 25% 20%, rgba(14, 165, 233, 0.55), transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(20, 184, 166, 0.45), transparent 55%), radial-gradient(circle at 50% 50%, #031d33, #020c17 100%)',
    forest: 'radial-gradient(ellipse at 30% 25%, rgba(34, 197, 94, 0.45), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(16, 185, 129, 0.4), transparent 55%), radial-gradient(circle at 50% 50%, #06231a, #02120d 100%)',
    cyberpunk: 'radial-gradient(ellipse at 20% 30%, rgba(217, 70, 239, 0.55), transparent 55%), radial-gradient(ellipse at 80% 65%, rgba(6, 182, 212, 0.45), transparent 50%), radial-gradient(circle at 50% 50%, #170826, #090310 100%)',
    minimal: 'radial-gradient(circle at 75% 30%, rgba(255, 255, 255, 0.10), transparent 50%), radial-gradient(circle at 25% 70%, rgba(255, 255, 255, 0.06), transparent 50%), radial-gradient(circle at 50% 50%, #12151c, #07090d 100%)',
    lavender: 'radial-gradient(ellipse at 35% 20%, rgba(192, 132, 252, 0.45), transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(244, 114, 182, 0.35), transparent 55%), radial-gradient(circle at 50% 50%, #1c132b, #0c0814 100%)',
    solar: 'radial-gradient(ellipse at 25% 35%, rgba(249, 115, 22, 0.55), transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(234, 179, 8, 0.45), transparent 55%), radial-gradient(circle at 50% 50%, #261105, #100601 100%)',
    jade: 'radial-gradient(ellipse at 25% 25%, rgba(13, 148, 136, 0.55), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(5, 150, 105, 0.45), transparent 55%), radial-gradient(circle at 50% 50%, #04261f, #02120e 100%)',
    astral: 'radial-gradient(ellipse at 30% 20%, rgba(225, 29, 72, 0.5), transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(147, 51, 234, 0.45), transparent 55%), radial-gradient(circle at 50% 50%, #200619, #0d020a 100%)',
    polar: 'radial-gradient(ellipse at 20% 25%, rgba(2, 132, 199, 0.55), transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(99, 102, 241, 0.45), transparent 55%), radial-gradient(circle at 50% 50%, #061e38, #020b17 100%)'
  },

  // Période temporelle de la journée
  getTimeOfDayPeriod(hours = new Date().getHours()) {
    if (hours >= 5 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 14) return 'lunch';
    if (hours >= 14 && hours < 18) return 'afternoon';
    return 'evening';
  },

  // Citations & phrases d'ambiance d'accueil classées par moment de la journée
  GREETING_QUOTES: {
    morning: [
      "Un bon café, une vue claire sur votre journée : vous êtes prêt ☕.",
      "Le secret pour bien avancer, c'est simplement de commencer par la première tâche.",
      "Nouvelle matinée, belle opportunité de faire ce qui compte vraiment.",
      "Prenez une grande inspiration matinale : vous avez tout sous contrôle.",
      "Vos tâches n'ont qu'à bien se tenir : vous êtes aux commandes aujourd'hui.",
      "Défier les lois de la gravité dès le réveil, c'est un bel exploit.",
      "Le réveil a sonné, vos projets ont tremblé. Café d'abord, conquête du monde ensuite.",
      "Une journée commence toujours mieux quand on fait semblant de savoir exactement ce qu'on fait.",
      "Rappelez-vous : même les astronautes commencent leur journée en cherchant leurs chaussettes.",
      "Statistiquement, 90 % des grands projets commencent par un soupir et une bonne gorgée de café.",
      "La gravité essaie de vous clouer au lit : montrez-lui poliment qui est le chef ici.",
      "Règle numéro 1 du matin : adresser la parole au café avant d'adresser la parole aux humains ☕.",
      "Votre réveil a sonné, vous avez survécu. Étape 1 validée avec brio, le reste n'est qu'une formalité.",
      "Le matin, c'est ce moment magique où l'on est convaincu de pouvoir plier 14 projets avant midi.",
      "Mettez vos baskets mentales : le marathon des coches de cases est officiellement ouvert !",
      "Bonjour ! Vos objectifs du jour vous attendent avec impatience et une petite pancarte d'encouragement.",
      "Le secret d'un matin réussi ? Regarder sa to-do list avec l'assurance d'un grand chef étoilé."
    ],
    lunch: [
      "Prenez une vraie pause déjeuner : l'esprit a besoin de souffler pour rester vif 🍽️.",
      "Il paraît que les personnes les plus organisées savourent aussi leur pause midi.",
      "Faites le plein d'énergie, vos projets vous attendront sagement après le repas.",
      "Une petite pause bien méritée avant d'attaquer la deuxième partie de journée.",
      "Rassurez-vous, même Rome ne s'est pas organisée entre midi et deux.",
      "Manger devant son écran ne compte pas comme un gain de productivité, lâchez ce clavier !",
      "Votre estomac a voté à l'unanimité : arrêt temporaire des hostilités professionnelles.",
      "Règle d'or : les calories de la pause déjeuner n'ont aucun impact sur vos deadlines.",
      "Une légende urbaine raconte que quelqu'un a déjà trouvé une idée de génie en dégustant un dessert.",
      "Pause déjeuner : le seul moment où l'on a le droit légal de ne penser qu'à son assiette.",
      "Avis médical unanime : travailler en mâchant réduit le plaisir de 100 %. Bon appétit !",
      "La pause déjeuner n'est pas une perte de temps, c'est une recharge tactique en glucides.",
      "Si vous hésitez entre terminer une tâche et savourer un bon plat, votre assiette a toujours raison.",
      "Rappelez-vous : un estomac vide ne produit que des idées creuses. À table !",
      "Pause midi : moment officiel de dégustation et de non-assistance à projet en détresse.",
      "Le cerveau a besoin de calories pour être génial. Ne le faites pas attendre !"
    ],
    afternoon: [
      "Concentration et efficacité : chaque tâche cochée cet après-midi est une victoire.",
      "Une étape à la fois : avancez à votre rythme, avec constance et clarté.",
      "Cocher une tâche procure une dose de dopamine 100 % locale et garantie sans sucre.",
      "Moins de charge mentale, plus de sérénité (et zéro pub sur vos données personnelles).",
      "Si une tâche vous effraie, regardez-la droit dans les yeux et cochez-la.",
      "C'est l'heure fatidique où le canapé vous appelle par votre prénom. Résistez vaillamment !",
      "Si vous fixez votre écran avec un air très concentré, tout le monde croira à un coup de génie.",
      "La productivité de l'après-midi, c'est 20 % de caféine et 80 % de fierté personnelle.",
      "Le secret d'un grand projet ? Le découper en petites étapes jusqu'à ce que la première soit facile comme respirer.",
      "Respirez : chaque minute de travail maintenant vous rapproche d'une soirée sans remords.",
      "C'est l'heure du fameux coup de barre de 14h30. Un grand verre d'eau, un étirement et c'est reparti !",
      "L'après-midi : l'art subtil de fixer l'écran avec un air passionné pour masquer une envie de sieste.",
      "Ne comptez pas les heures, faites en sorte que chaque heure compte (et préparez un thé).",
      "Votre énergie est renouvelable : offrez-vous une mini-victoire dès maintenant !",
      "Une tâche cochée à 15h vaut deux soupirs de soulagement à 17h. Allez, on fonce !",
      "La concentration de l'après-midi, c'est comme le wifi : parfois il faut juste se reconnecter en douceur."
    ],
    evening: [
      "La journée touche à sa fin : bravo pour tout le travail accompli aujourd'hui !",
      "Déconnectez l'esprit en toute sérénité : tout est soigneusement sauvegardé en local.",
      "Le repos du soir est la clé d'une journée productive demain.",
      "Vos tâches sont au chaud pour la nuit, profitez d'une excellente soirée.",
      "Bilan de fin de journée : votre temps est précieux, savourez ce moment de calme.",
      "Rangez les crayons et fermez les onglets : le travail est fait, le canapé a gagné la manche.",
      "Votre lit vous envoie un signal urgent : votre présence est requise sous la couette.",
      "Félicitations, vous avez survécu à une journée entière de décisions d'adulte. C'est déjà admirable.",
      "Tout est soigneusement sauvegardé sur votre disque dur. Vous pouvez éteindre vos neurones en toute légalité.",
      "Si une idée brillante vous vient maintenant, notez-la dans le mémo rapide et filez vous reposer !",
      "Arrêt des machines ! Les projets sont sagement au lit, il ne manque plus que vous.",
      "Votre écran vous remercie pour votre charmante compagnie mais suggère poliment d'aller voir ailleurs.",
      "Vous avez fait ce que vous avez pu, demain fera ce qu'il voudra. Très belle soirée !",
      "La touche 'Éteindre' est la plus belle invention depuis le pain tranché. Savourez !",
      "Félicitations : vous avez officiellement le droit de vous transformer en loque sur le canapé sans remords.",
      "Déconnexion validée par les autorités du bien-être. Passez une soirée 100 % reposante !"
    ],
    warm: [
      "J'espère que vous passez une excellente journée.",
      "Je suis là pour vous aider à vous organiser sereinement.",
      "Une étape à la fois : chaque tâche cochée est une victoire.",
      "Prenez une grande inspiration : vous avez tout sous contrôle.",
      "Votre temps est précieux, savourez chaque moment aujourd'hui.",
      "Prenez soin de vous entre deux sessions de travail !",
      "Vous faites de votre mieux, et c'est amplement suffisant pour aujourd'hui.",
      "Une pensée bienveillante pour vous accompagner dans vos projets du jour.",
      "Un petit coucou amical pour vous rappeler que vous faites déjà un travail formidable.",
      "Rien ne presse : les plus belles constructions se tissent dans le calme et la patience.",
      "Prenez un instant pour respirer : vous êtes exactement là où vous devez être.",
      "Un sourire, une gorgée d'eau, et chaque tâche devient un jeu d'enfant.",
      "Votre motivation a le droit de respirer : avancez un pas après l'autre, avec le sourire.",
      "Chaque effort compte, même les plus discrets. Soyez fier de ce que vous entreprenez !"
    ],
    witty: [
      "Ne remettez pas à demain ce que vous pouvez faire... après un bon café ☕.",
      "Vos tâches n'ont qu'à bien se tenir : vous êtes aux commandes aujourd'hui.",
      "Défier les lois de la gravité, c'est bien. Vaincre la procrastination, c'est un exploit.",
      "Une to-do list bien remplie, c'est la preuve d'un optimisme sans limite.",
      "Rassurez-vous, même Rome ne s'est pas organisée en un jour.",
      "Moins de charge mentale, plus de sérénité (et zéro pub sur vos données).",
      "La to-do list est pleine, la tasse est vide : nous sommes exactement là où nous devions être.",
      "Procrastiner, c'est l'art subtil de garder son calme pendant que le futur s'inquiète pour nous.",
      "Ne remettez pas à demain ce que vous pouvez cocher en deux minutes chrono !",
      "Vos données restent 100 % sur votre machine : personne ne saura combien de fois vous avez décalé cette tâche.",
      "Faire semblant d'être débordé demande parfois plus d'énergie que de simplement faire la tâche.",
      "La perfection n'existe pas, sauf dans le doux son d'une case qu'on valide.",
      "Le travail d'équipe, c'est bien. Mais une to-do list où l'on est le seul chef à bord, c'est encore mieux !",
      "La to-do list est un pont entre vos rêves et votre envie furieuse de faire la sieste.",
      "La procrastination intelligente consiste à faire une autre tâche utile pour éviter la première.",
      "Si le plan A ne fonctionne pas, il reste encore 25 lettres dans l'alphabet (et l'alphabet grec si besoin).",
      "Une to-do list sans café, c'est comme une fusée sans carburant : joli sur le papier, mais cloué au sol.",
      "Ne dites pas 'je suis débordé', dites 'je vis une expérience de multitâche immersive à haute intensité'.",
      "Le meilleur moyen de ne rien oublier, c'est de le faire tout de suite... ou de le noter ici avec style !",
      "Travailler intelligemment, c'est aussi savoir quand fermer son ordinateur avec fierté.",
      "Il n'y a pas de problème que 15 minutes de marche ou un carré de chocolat ne puissent relativiser.",
      "Votre to-do list vous admire en secret : elle sait que vous finirez toujours par l'apprivoiser."
    ]
  },

  getRandomGreetingQuote(moodOrPeriod = 'auto') {
    let pool = [];
    if (['morning', 'lunch', 'afternoon', 'evening'].includes(moodOrPeriod)) {
      pool = this.GREETING_QUOTES[moodOrPeriod] || [];
    } else if (moodOrPeriod === 'warm') {
      pool = this.GREETING_QUOTES.warm || [];
    } else if (moodOrPeriod === 'witty') {
      pool = this.GREETING_QUOTES.witty || [];
    } else if (moodOrPeriod === 'mixed') {
      pool = (this.GREETING_QUOTES.warm || []).concat(this.GREETING_QUOTES.witty || []);
    } else {
      const period = this.getTimeOfDayPeriod();
      pool = this.GREETING_QUOTES[period] || [];
    }

    if (!pool || pool.length === 0) {
      pool = this.GREETING_QUOTES.morning || ["Je suis là pour vous aider à vous organiser sereinement."];
    }
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  },

  updateDashboardQuote(forceNew = false) {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (!subtitleEl) return;

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    // 1. Phrase personnalisée fixe sur-mesure
    if (settings.greetingMood === 'custom' && settings.customGreetingPhrase && settings.customGreetingPhrase.trim()) {
      subtitleEl.textContent = settings.customGreetingPhrase.trim();
      return;
    }

    // 2. Détecter l'humeur configurée et la période actuelle (matin, midi, après-midi, soir)
    const mood = settings.greetingMood || 'auto';
    const currentPeriod = this.getTimeOfDayPeriod();
    const quoteKey = (mood === 'warm' || mood === 'witty' || mood === 'mixed') ? mood : `${mood}:${currentPeriod}`;

    // 3. Si ni l'humeur ni la période n'ont changé et qu'on a déjà une phrase de session, la conserver
    if (this._currentQuote && this._currentQuoteKey === quoteKey && !forceNew) {
      subtitleEl.textContent = this._currentQuote;
      return;
    }

    // 4. Sélection de la phrase adaptée à l'humeur et/ou à la période
    const newQuote = this.getRandomGreetingQuote(mood);
    this._currentQuote = newQuote;
    this._currentQuoteKey = quoteKey;
    this._currentQuotePeriod = currentPeriod;
    subtitleEl.textContent = newQuote;
  },

  shuffleDashboardQuote() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (subtitleEl && subtitleEl.style) {
      subtitleEl.style.opacity = '0';
      subtitleEl.style.transform = 'translateY(-3px)';
      subtitleEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      setTimeout(() => {
        this.updateDashboardQuote(true);
        subtitleEl.style.opacity = '1';
        subtitleEl.style.transform = 'translateY(0)';
      }, 180);
    } else {
      this.updateDashboardQuote(true);
    }
  },

  openNoteFromDashboard(noteId) {
    this.navigate('notes');
    if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
      window.NotesManager.selectNote(noteId);
    }
  },

  openEventFromDashboard(eventId) {
    this.navigate('agenda');
    if (typeof window !== 'undefined' && window.AgendaManager && typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function') {
      const targetEvt = StorageManager.getEvents().find(e => e && e.id === eventId);
      if (targetEvt && targetEvt.start) {
        const isRecurring = !!(targetEvt.recurrence && targetEvt.recurrence !== 'none');
        const evtDateStr = targetEvt.start.slice(0, 10);
        const todayIso = this.formatLocalYMD(new Date());
        if (!isRecurring || evtDateStr >= todayIso) {
          const [y, m, d] = evtDateStr.split('-').map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1);
          if (!isNaN(dt.getTime()) && typeof window.AgendaManager.getMonday === 'function') {
            window.AgendaManager.currentWeekStart = window.AgendaManager.getMonday(dt);
            window.AgendaManager.render();
          }
        }
      }
      if (typeof window.AgendaManager.openEventModal === 'function') {
        setTimeout(() => window.AgendaManager.openEventModal(eventId), 80);
      }
    }
  },

  startFocusOn(type, id) {
    if (!type || !id) return;
    this.navigate('focus');
    if (typeof FocusManager !== 'undefined' && typeof FocusManager.startWithTarget === 'function') {
      FocusManager.startWithTarget(type, id, true);
    }
  },

  setDashboardAgendaView(view) {
    this.dashboardAgendaView = view === 'list' ? 'list' : 'grid';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravite_dashboard_agenda_view', this.dashboardAgendaView);
      }
    } catch (err) {
      console.warn('[App] Erreur stockage dashboardAgendaView:', err);
    }
    const btnGrid = document.getElementById('btn-dashboard-agenda-grid');
    const btnList = document.getElementById('btn-dashboard-agenda-list');
    if (btnGrid && btnList) {
      btnGrid.classList.toggle('active', this.dashboardAgendaView === 'grid');
      btnList.classList.toggle('active', this.dashboardAgendaView === 'list');
    }
    this.updateDashboard();
  },

  renderDashboardMiniAgenda(containerOrEvents, todayEventsArg, todayStrArg, tasksArg, projectsArg) {
    let container = null;
    let todayEvents = [];
    let todayStr = '';
    let tasks = [];
    let projects = [];

    if (containerOrEvents && ((typeof HTMLElement !== 'undefined' && containerOrEvents instanceof HTMLElement) || typeof containerOrEvents.innerHTML === 'string' || typeof containerOrEvents === 'string')) {
      container = typeof containerOrEvents === 'string' ? document.getElementById(containerOrEvents) : containerOrEvents;
      todayEvents = Array.isArray(todayEventsArg) ? todayEventsArg : [];
      todayStr = todayStrArg || this.formatLocalYMD(new Date());
      tasks = tasksArg || (typeof StorageManager !== 'undefined' ? StorageManager.getTasks() : []);
      projects = projectsArg || (typeof StorageManager !== 'undefined' ? StorageManager.getProjects() : []);
    } else {
      container = document.getElementById('dashboard-today-events');
      todayEvents = Array.isArray(containerOrEvents) ? containerOrEvents : [];
      todayStr = todayEventsArg || this.formatLocalYMD(new Date());
      tasks = tasksArg || (typeof StorageManager !== 'undefined' ? StorageManager.getTasks() : []);
      projects = projectsArg || (typeof StorageManager !== 'undefined' ? StorageManager.getProjects() : []);
    }

    if (!container) return;

    const alldayEvents = todayEvents.filter(e => e.isAllDay);
    const timedEvents = todayEvents.filter(e => !e.isAllDay);

    const taskById = new Map();
    if (Array.isArray(tasks)) {
      const mapTasks = (list) => {
        list.forEach(t => {
          if (!t || !t.id) return;
          taskById.set(t.id, t);
          if (t.subtasks && t.subtasks.length > 0) mapTasks(t.subtasks);
        });
      };
      mapTasks(tasks);
    }

    // 1. Bandeau supérieur pour les événements journée entière
    let alldayBarHtml = '';
    if (alldayEvents.length > 0) {
      const pills = alldayEvents.map(e => {
        const linkedTask = e.taskId ? taskById.get(e.taskId) : null;
        const isDone = !!(e.completed || (linkedTask && linkedTask.completed));
        let pillColor = '#6366f1';
        let linkedProj = null;
        if (e.color) {
          pillColor = e.color;
        } else {
          const resolvedProjId = e.projectId || (linkedTask && linkedTask.projectId);
          if (resolvedProjId && projects) {
            linkedProj = projects.find(p => p.id === resolvedProjId);
            if (linkedProj && linkedProj.color) pillColor = linkedProj.color;
          } else if (e.source === 'google') {
            pillColor = '#2563eb';
          }
        }

        pillColor = this._sanitizeCssColor(pillColor, '#6366f1');
        const safeIdJs = this.escapeHtml(this._escapeJsSingleQuote(e.id));

        return `
          <div class="mini-agenda-allday-pill" onclick="event.stopPropagation(); AgendaManager.openEventModal('${safeIdJs}')" title="${this.escapeHtml(e.title)}${linkedTask ? ' - Tâche : ' + this.escapeHtml(linkedTask.title) : ''}" style="background: linear-gradient(135deg, ${pillColor}ee, ${pillColor}cc); border-left: 3px solid ${pillColor};">
            ${isDone ? '<span class="mini-event-done-pill" title="Honoré">✓</span>' : ''}
            <span class="mini-allday-title mini-agenda-allday-pill-title">${this.escapeHtml(e.title)}</span>
          </div>
        `;
      }).join('');

      alldayBarHtml = `
        <div class="mini-agenda-allday-bar">
          <span class="mini-agenda-allday-tag">Toute la journée</span>
          <div class="mini-agenda-allday-pills">
            ${pills}
          </div>
        </div>
      `;
    }

    // 2. Calcul dynamique des bornes horaires de la journée (optimisé pour voir la journée d'un coup d'œil)
    const now = new Date();
    const isToday = this.formatLocalYMD(now) === todayStr;
    const currentHour = now.getHours();

    let earliestEventH = 24;
    let latestEventH = 0;

    timedEvents.forEach(e => {
      if (e.start && e.start.length >= 16) {
        const h = parseInt(e.start.slice(11, 13), 10);
        if (!isNaN(h) && h < earliestEventH) earliestEventH = h;
      }
      if (e.end && e.end.length >= 16) {
        const h = parseInt(e.end.slice(11, 13), 10);
        const m = parseInt(e.end.slice(14, 16), 10);
        const ceilH = m > 0 ? h + 1 : h;
        if (!isNaN(ceilH) && ceilH > latestEventH) latestEventH = ceilH;
      }
    });

    let startHour = 8;
    let endHour = 19;

    if (timedEvents.length > 0) {
      startHour = Math.min(8, earliestEventH);
      endHour = Math.max(18, latestEventH);
      if (isToday) {
        startHour = Math.min(startHour, currentHour);
        endHour = Math.max(endHour, currentHour + 1);
      }
    } else if (isToday) {
      startHour = Math.min(8, Math.max(7, currentHour - 1));
      endHour = Math.max(18, Math.min(22, currentHour + 4));
    }

    startHour = Math.max(0, startHour);
    endHour = Math.min(24, Math.max(startHour + 8, endHour));

    // Hauteur en pixels par heure confortable (28px) pour une excellente lisibilité des créneaux
    const hourHeight = 28;
    const totalHours = Math.max(1, endHour - startHour);
    const totalGridHeight = totalHours * hourHeight;

    // 3. Colonne des heures et lignes repères
    let timeColHtml = '';
    let gridLinesHtml = '';
    for (let h = startHour; h < endHour; h++) {
      timeColHtml += `<div class="mini-agenda-hour-cell" style="height: ${hourHeight}px;">${String(h).padStart(2, '0')}:00</div>`;
    }
    for (let i = 0; i <= totalHours; i++) {
      gridLinesHtml += `<div class="mini-agenda-grid-line" style="top: ${i * hourHeight}px;"></div>`;
    }

    // 4. Ligne temps réel "En ce moment"
    let nowLineHtml = '';
    let nowTopPx = -1;

    if (isToday) {
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentTotalMin = currentHour * 60 + currentMin;
      const startTotalMin = startHour * 60;
      const endTotalMin = endHour * 60;

      if (currentTotalMin >= startTotalMin && currentTotalMin <= endTotalMin) {
        nowTopPx = ((currentTotalMin - startTotalMin) / 60) * hourHeight;
        const nowTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        nowLineHtml = `
          <div class="mini-agenda-now-line" style="top: ${nowTopPx}px;" title="Heure actuelle : ${nowTimeStr}">
            <div class="mini-agenda-now-dot"></div>
            <div class="mini-agenda-now-time">${nowTimeStr}</div>
          </div>
        `;
      }
    }

    // 5. Calcul de l'agencement des créneaux (gestion des chevauchements)
    let layoutEvents = [];
    if (window.AgendaManager && typeof window.AgendaManager.computeOverlappingLayout === 'function') {
      layoutEvents = window.AgendaManager.computeOverlappingLayout(timedEvents, todayStr);
    } else {
      layoutEvents = timedEvents.map(evt => {
        let sMin = 8 * 60;
        let eMin = 9 * 60;
        if (evt.start && evt.start.length >= 16) {
          sMin = parseInt(evt.start.slice(11, 13), 10) * 60 + parseInt(evt.start.slice(14, 16), 10);
        }
        if (evt.end && evt.end.length >= 16) {
          eMin = parseInt(evt.end.slice(11, 13), 10) * 60 + parseInt(evt.end.slice(14, 16), 10);
        }
        return { event: evt, startMin: sMin, endMin: Math.max(sMin + 20, eMin), colIndex: 0, totalCols: 1 };
      });
    }

    let firstEventTopPx = -1;
    // taskById est construit plus haut pour alldayEvents et timedEvents

    const projectById = new Map();
    if (Array.isArray(projects)) {
      projects.forEach(p => projectById.set(p.id, p));
    }

    let eventsBlocksHtml = '';

    layoutEvents.forEach(item => {
      const e = item.event;
      const startMin = item.startMin;
      const endMin = item.endMin;

      const topMin = Math.max(0, startMin - (startHour * 60));
      const topPx = (topMin / 60) * hourHeight;
      if (firstEventTopPx === -1 || topPx < firstEventTopPx) {
        firstEventTopPx = topPx;
      }

      const durationMin = Math.max(15, endMin - startMin);
      const rawHeightPx = (durationMin / 60) * hourHeight;
      const heightPx = Math.max(16, rawHeightPx - 1);

      const totalCols = Math.max(1, item.totalCols || 1);
      const colIndex = item.colIndex || 0;
      const colWidthPct = 100 / totalCols;
      const leftPct = (colIndex * colWidthPct) + 0.3;
      const widthPct = totalCols > 1 ? colWidthPct - 1.2 : 98.8;

      const isGoogle = e.source === 'google';
      const linkedTask = e.taskId ? taskById.get(e.taskId) : null;
      const isDone = !!(e.completed || (linkedTask && linkedTask.completed));
      const projId = e.projectId || (linkedTask && linkedTask.projectId);
      const linkedProject = projId ? projectById.get(projId) : null;

      let eventColor = '#6366f1';
      if (e.color) {
        eventColor = e.color;
      } else if (linkedProject && linkedProject.color) {
        eventColor = linkedProject.color;
      } else if (isGoogle) {
        eventColor = '#2563eb';
      }
      eventColor = this._sanitizeCssColor(eventColor, '#6366f1');

      const startTime = e.start && e.start.length >= 16 ? e.start.slice(11, 16) : '';
      const endTime = e.end && e.end.length >= 16 ? e.end.slice(11, 16) : '';
      const timeStr = (startTime && endTime) ? `${startTime} - ${endTime}` : (startTime || 'Créneau');

      const isCompact = heightPx < 26;
      const tooltip = `${this.escapeHtml(e.title)} (${timeStr})${linkedTask ? ' - Tâche : ' + this.escapeHtml(linkedTask.title) : ''}${e.noteId ? ' • Note liée' : ''}`;

      let innerContent = '';
      if (isCompact) {
        innerContent = `
          <div class="mini-event-row compact">
            ${isDone ? '<span class="mini-event-done-pill" title="Honoré">✓</span>' : ''}
            <span class="mini-event-time-pill">${startTime}</span>
            <span class="mini-event-title compact">${this.escapeHtml(e.title)}</span>
          </div>
        `;
      } else {
        innerContent = `
          <div class="mini-event-row standard">
            <div class="mini-event-header">
              <span class="mini-event-time-pill">${timeStr}</span>
              ${isDone ? '<span class="mini-event-done-pill" title="Créneau honoré">✓</span>' : ''}
            </div>
            <div class="mini-event-title standard">${this.escapeHtml(e.title)}</div>
          </div>
        `;
      }

      const safeEventIdAttr = this.escapeHtml(e.id);
      const safeEventIdJs = this.escapeHtml(this._escapeJsSingleQuote(e.id));
      eventsBlocksHtml += `
        <div class="mini-agenda-event-block"
             data-event-id="${safeEventIdAttr}"
             onclick="event.stopPropagation(); AgendaManager.openEventModal('${safeEventIdJs}');"
             title="${tooltip}"
             style="top: ${topPx}px; height: ${heightPx}px; left: ${leftPct}%; width: ${widthPct}%; background: linear-gradient(135deg, ${eventColor}ee, ${eventColor}cc); border-left-color: ${eventColor};">
          ${innerContent}
        </div>
      `;
    });

    // 6. Injection dans le conteneur
    container.innerHTML = `
      <div class="dashboard-mini-agenda">
        ${alldayBarHtml}
        <div class="dashboard-mini-agenda-scroll">
          <div class="mini-agenda-grid-wrapper" style="height: ${totalGridHeight}px;">
            <div class="mini-agenda-time-col">
              ${timeColHtml}
            </div>
            <div class="mini-agenda-events-col" style="height: ${totalGridHeight}px;">
              ${gridLinesHtml}
              ${nowLineHtml}
              ${eventsBlocksHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    // 7. Auto-défilement vers l'heure courante ou le premier créneau si défilement nécessaire
    const scrollElem = (container && typeof container.querySelector === 'function') ? container.querySelector('.dashboard-mini-agenda-scroll') : null;
    if (scrollElem) {
      let targetScroll = 0;
      if (nowTopPx >= 0) {
        targetScroll = Math.max(0, nowTopPx - 40);
      } else if (firstEventTopPx >= 0) {
        targetScroll = Math.max(0, firstEventTopPx - 20);
      } else {
        targetScroll = 0;
      }
      scrollElem.scrollTop = targetScroll;
      if (typeof setTimeout === 'function') {
        setTimeout(() => {
          if (scrollElem) scrollElem.scrollTop = targetScroll;
        }, 20);
      }
    }
  },

  // Tableau de bord Accueil
  updateDashboard(force = false) {
    this.updateDashboardQuote();
    if (typeof this.updateSidebarDayProgress === 'function') {
      this.updateSidebarDayProgress();
    }
    if (!force && this.currentScreen && this.currentScreen !== 'home') {
      this._dashboardDirty = true;
      return;
    }
    this._dashboardDirty = false;

    if (!force && typeof requestAnimationFrame === 'function') {
      if (this._dashboardRaf) cancelAnimationFrame(this._dashboardRaf);
      this._dashboardRaf = requestAnimationFrame(() => {
        this._dashboardRaf = null;
        this._executeDashboardRender();
      });
      return;
    }
    this._executeDashboardRender();
  },

  _executeDashboardRender() {
    const tasks = StorageManager.getTasks();
    const projects = StorageManager.getProjects();
    const events = StorageManager.getEvents();
    const notes = StorageManager.getNotes();
    const projectById = new Map((projects || []).map(p => [p.id, p]));
    const archivedProjectIds = new Set((projects || []).filter(p => p.archived).map(p => p.id));

    const todayStr = this.formatLocalYMD(new Date());
    const now = new Date();

    // 1. Tâches prévues aujourd'hui
    let plannedTodayCount = 0;
    let upcomingDeadlinesCount = 0;
    const plannedTodayList = [];
    const upcomingDeadlinesList = [];

    const traverseTasks = (list) => {
      list.forEach(t => {
        if (!t.completed) {
          const isArchived = t.projectId ? archivedProjectIds.has(t.projectId) : false;
          if (!isArchived) {
            if (t.plannedDate === todayStr) {
              plannedTodayCount++;
              plannedTodayList.push(t);
            }
            if (t.deadline) {
              const d = new Date(t.deadline);
              const diffHours = (d - now) / 3600000;
              if (diffHours >= 0 && diffHours <= 72) { // Dans les 3 prochains jours
                upcomingDeadlinesCount++;
                upcomingDeadlinesList.push(t);
              }
            }
          }
        }
        if (t.subtasks && t.subtasks.length > 0) traverseTasks(t.subtasks);
      });
    };
    traverseTasks(tasks);

    // 2. Créneaux de travail aujourd'hui (incluant les événements multi-jours actifs ce jour)
    const todayEvents = events.filter(e => {
      if (window.AgendaManager && typeof window.AgendaManager.isEventOnDate === 'function') {
        return window.AgendaManager.isEventOnDate(e, todayStr);
      }
      return e.start && e.start.startsWith(todayStr);
    });

    // 3. Mettre à jour les compteurs
    const elPlanned = document.getElementById('stat-planned-today');
    const elDeadlines = document.getElementById('stat-deadlines-near');
    const elEvents = document.getElementById('stat-events-today');
    const elProjects = document.getElementById('stat-active-projects');

    if (elPlanned) elPlanned.textContent = plannedTodayCount;
    if (elDeadlines) elDeadlines.textContent = upcomingDeadlinesCount;
    if (elEvents) elEvents.textContent = todayEvents.length;
    if (elProjects) elProjects.textContent = (projects || []).filter(p => !p.archived).length;

    // 4. Remplir le panneau "Tâches prévues aujourd'hui"
    const panelPlanned = document.getElementById('dashboard-planned-tasks');
    if (panelPlanned) {
      if (plannedTodayList.length === 0) {
        panelPlanned.innerHTML = `
          <div class="dashboard-empty-hint dashboard-empty-state">
            <div class="dashboard-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div class="dashboard-empty-title">Esprit libre</div>
            <div class="dashboard-empty-text">Aucune tâche planifiée pour aujourd'hui. Profitez de votre journée.</div>
          </div>
        `;
      } else {
        panelPlanned.innerHTML = plannedTodayList.slice(0, 5).map(t => {
          const proj = t.projectId ? projectById.get(t.projectId) : null;
          const safeProjColor = (proj && proj.color) ? this._sanitizeCssColor(proj.color, '#6366f1') : '';
          const safeProjIdJs = proj ? this.escapeHtml(this._escapeJsSingleQuote(proj.id)) : '';
          const safeTaskIdJs = this.escapeHtml(this._escapeJsSingleQuote(t.id));
          const safeNoteIdJs = t.noteId ? this.escapeHtml(this._escapeJsSingleQuote(t.noteId)) : '';
          const projectBorder = safeProjColor ? `border-left: 3.5px solid ${safeProjColor};` : '';
          const projectBadge = (proj && safeProjColor) ? `<span class="badge" style="font-size:0.68rem; padding:1px 6px; border-radius:4px; border:1px solid ${safeProjColor}60; color:${safeProjColor}; background-color:${safeProjColor}1c; font-weight:600; cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('projects'); if (window.ProjectsManager) ProjectsManager.openProjectDetailModal('${safeProjIdJs}');" title="Ouvrir le projet : ${this.escapeHtml(proj.title)}"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${safeProjColor}; margin-right:4px;"></span>${this.escapeHtml(proj.title)}</span>` : '';
          return `
            <div class="dashboard-item dashboard-task-item" style="${projectBorder}">
              <div class="dashboard-item-main">
                <input type="checkbox" class="dashboard-task-checkbox" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation();" onchange="if (window.TasksManager) { TasksManager.toggleCompleted('${safeTaskIdJs}'); if (window.App && typeof window.App.renderDashboard === 'function') window.App.renderDashboard(); }" title="${t.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}" aria-label="Marquer cette tâche comme terminée">
                <span class="dashboard-item-title" onclick="TasksManager.openTaskModal('${safeTaskIdJs}')" title="${this.escapeHtml(t.title)}">${this.escapeHtml(t.title)}</span>
              </div>
              <div class="dashboard-item-meta" style="display:flex; align-items:center; gap:5px;">
                ${safeNoteIdJs ? `<button type="button" class="btn-icon-subtle dashboard-quick-btn" onclick="event.stopPropagation(); App.openNoteFromDashboard('${safeNoteIdJs}');" title="Ouvrir la note liée">📝</button>` : ''}
                <button type="button" class="btn-icon-subtle dashboard-quick-btn" onclick="event.stopPropagation(); App.startFocusOn('task', '${safeTaskIdJs}');" title="Démarrer une session Focus sur cette tâche">🎯</button>
                ${projectBadge}
                ${typeof TasksManager !== 'undefined' && typeof TasksManager.getPriorityBadge === 'function' ? TasksManager.getPriorityBadge(t.priority) : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4.5 Mettre à jour le badge de comptage et l'état des boutons de vue
    const badgeEventsCount = document.getElementById('dashboard-events-count-badge');
    if (badgeEventsCount) {
      badgeEventsCount.textContent = todayEvents.length;
      badgeEventsCount.style.display = todayEvents.length > 0 ? 'inline-flex' : 'none';
    }
    const btnGrid = document.getElementById('btn-dashboard-agenda-grid');
    const btnList = document.getElementById('btn-dashboard-agenda-list');
    if (btnGrid && btnList) {
      btnGrid.classList.toggle('active', this.dashboardAgendaView === 'grid');
      btnList.classList.toggle('active', this.dashboardAgendaView === 'list');
    }

    // 5. Remplir le panneau "Créneaux du jour (Agenda)"
    const panelEvents = document.getElementById('dashboard-today-events');
    if (panelEvents) {
      if (todayEvents.length === 0) {
        panelEvents.innerHTML = `
          <div class="dashboard-empty-hint dashboard-empty-state">
            <div class="dashboard-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="dashboard-empty-title">Temps libre</div>
            <div class="dashboard-empty-text">Aucun créneau réservé pour aujourd'hui. Votre journée respire.</div>
            <button class="btn btn-secondary btn-sm" style="margin-top: 8px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;" onclick="AgendaManager.openEventModal()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Planifier un créneau
            </button>
          </div>
        `;
      } else if (this.dashboardAgendaView === 'grid') {
        this.renderDashboardMiniAgenda(panelEvents, todayEvents, todayStr, tasks, projects);
      } else {
        const eventTaskById = new Map();
        if (Array.isArray(tasks)) {
          const indexEvtTasks = (list) => {
            list.forEach(t => {
              if (!t || !t.id) return;
              eventTaskById.set(t.id, t);
              if (t.subtasks && t.subtasks.length > 0) indexEvtTasks(t.subtasks);
            });
          };
          indexEvtTasks(tasks);
        }
        panelEvents.innerHTML = todayEvents.map(e => {
          const isGoogle = e.source === 'google';
          const linkedTask = e.taskId ? eventTaskById.get(e.taskId) : null;
          const isDone = !!(e.completed || (linkedTask && linkedTask.completed));
          const projId = e.projectId || (linkedTask && linkedTask.projectId);
          const linkedProj = projId ? projectById.get(projId) : null;
          const startDay = e.start ? e.start.slice(0, 10) : '';
          const endDay = e.end ? e.end.slice(0, 10) : startDay;
          const isMultiDay = startDay && endDay && endDay > startDay;
          const startTime = e.start && e.start.length >= 16 ? e.start.slice(11, 16) : '';
          const endTime = e.end && e.end.length >= 16 ? e.end.slice(11, 16) : '';

          let timeBadge = '';
          if (e.isAllDay) {
            timeBadge = isMultiDay ? 'Journée (multi-j)' : 'Journée';
          } else if (isMultiDay) {
            if (todayStr === startDay) {
              timeBadge = `${startTime} ➔`;
            } else if (todayStr === endDay) {
              timeBadge = `➔ ${endTime}`;
            } else {
              timeBadge = 'Journée cont.';
            }
          } else {
            timeBadge = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || 'Journée');
          }
          const rawDotColor = (linkedProj && linkedProj.color) ? linkedProj.color : (isGoogle ? '#3b82f6' : '#8b5cf6');
          const dotColor = this._sanitizeCssColor(rawDotColor, '#8b5cf6');
          const safeEventIdJs = this.escapeHtml(this._escapeJsSingleQuote(e.id));
          const safeNoteIdJs = e.noteId ? this.escapeHtml(this._escapeJsSingleQuote(e.noteId)) : '';
          const safeTaskIdJs = linkedTask ? this.escapeHtml(this._escapeJsSingleQuote(linkedTask.id)) : '';
          const safeTimeBadge = this.escapeHtml(timeBadge);

          return `
            <div class="dashboard-item dashboard-event-item${isDone ? ' is-done' : ''}">
              <div class="dashboard-item-main">
                <span class="dashboard-item-dot" style="background-color:${dotColor}; box-shadow:0 0 6px ${dotColor};"></span>
                <span class="dashboard-item-title" onclick="AgendaManager.openEventModal('${safeEventIdJs}')" title="${this.escapeHtml(e.title)}">${isDone ? '<span style="color:#10b981;font-weight:700;margin-right:4px;" title="Honoré / Terminé">✓</span>' : ''}${this.escapeHtml(e.title)}</span>
              </div>
              <div class="dashboard-item-meta" style="display:flex; align-items:center; gap:5px;">
                ${safeTaskIdJs ? `<button type="button" class="btn-icon-subtle dashboard-quick-btn" onclick="event.stopPropagation(); if (window.TasksManager) TasksManager.openTaskModal('${safeTaskIdJs}');" title="Ouvrir la tâche liée">✅</button>` : ''}
                ${safeNoteIdJs ? `<button type="button" class="btn-icon-subtle dashboard-quick-btn" onclick="event.stopPropagation(); App.openNoteFromDashboard('${safeNoteIdJs}');" title="Ouvrir la note liée">📝</button>` : ''}
                <button type="button" class="btn-icon-subtle dashboard-quick-btn" onclick="event.stopPropagation(); App.startFocusOn('event', '${safeEventIdJs}');" title="Lancer une session Focus sur ce créneau">🎯</button>
                <span class="dashboard-source-pill ${isGoogle ? 'pill-google' : 'pill-antigravite'}">
                  ${isGoogle ? '<span class="source-icon">' + this.getSvgIcon('globe', 12) + '</span> Google' : '<img src="./assets/icon.png" class="antigravite-symbol-icon" alt=""> Antigravité'}
                </span>
                <span class="dashboard-time-badge" title="Créneau horaire : ${safeTimeBadge}"><span class="badge-time-icon">${this.getSvgIcon('clock', 12)}</span> <span class="badge-time-text">${safeTimeBadge}</span></span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 6. Remplir le panneau "Dernières notes"
    const panelNotes = document.getElementById('dashboard-recent-notes');
    if (panelNotes) {
      if (!notes || notes.length === 0) {
        panelNotes.innerHTML = `
          <div class="dashboard-empty-hint dashboard-empty-state">
            <div class="dashboard-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
            </div>
            <div class="dashboard-empty-title">Page blanche</div>
            <div class="dashboard-empty-text">Aucune note enregistrée. Notez vos idées et inspirations quand vous le souhaitez.</div>
          </div>
        `;
      } else {
        // Trier par date de mise à jour (ou création) décroissante
        const sortedNotes = [...notes].sort((a, b) => {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });

        panelNotes.innerHTML = sortedNotes.slice(0, 5).map(n => {
          const rawContent = (n.content || '')
            .replace(/<[^>]*>?/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/[#*`_~>\-]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const preview = rawContent.length > 55 ? rawContent.slice(0, 55) + '…' : rawContent;
          const dateObj = new Date(n.updatedAt || n.createdAt);
          const isTodayNote = !isNaN(dateObj.getTime()) && this.formatLocalYMD(dateObj) === todayStr;
          const timeFormatted = !isNaN(dateObj.getTime()) 
            ? (isTodayNote ? `Aujourd'hui à ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}` : dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))
            : '';

          const proj = (n.projectId || n.linkedProjectId) ? projectById.get(n.projectId || n.linkedProjectId) : null;
          const safeProjColor = (proj && proj.color) ? this._sanitizeCssColor(proj.color, '#6366f1') : '';
          const safeProjIdJs = proj ? this.escapeHtml(this._escapeJsSingleQuote(proj.id)) : '';
          const safeNoteIdJs = this.escapeHtml(this._escapeJsSingleQuote(n.id));
          const linkedEvt = n.linkedEventId ? eventById.get(n.linkedEventId) : (events.find(e => e && e.noteId === n.id) || null);
          const effectiveEvtId = linkedEvt ? linkedEvt.id : (n.linkedEventId || '');
          const safeLinkedEventIdJs = effectiveEvtId ? this.escapeHtml(this._escapeJsSingleQuote(effectiveEvtId)) : '';
          const projectBorder = safeProjColor ? `border-left: 3.5px solid ${safeProjColor};` : '';
          const projectBadge = (proj && safeProjColor) ? `<span class="badge" style="font-size:0.68rem; padding:1px 6px; border-radius:4px; border:1px solid ${safeProjColor}60; color:${safeProjColor}; background-color:${safeProjColor}1c; font-weight:600; cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('projects'); if (window.ProjectsManager) ProjectsManager.openProjectDetailModal('${safeProjIdJs}');" title="Ouvrir le projet : ${this.escapeHtml(proj.title)}"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${safeProjColor}; margin-right:4px;"></span>${this.escapeHtml(proj.title)}</span>` : '';

          return `
            <div class="dashboard-item dashboard-note-item" style="${projectBorder}">
              <div class="dashboard-item-main" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <div style="display:flex; align-items:center; gap:6px; width:100%; min-width:0;">
                  <span class="dashboard-item-icon">${this.getSvgIcon('note', 14)}</span>
                  <span class="dashboard-item-title" onclick="App.openNoteFromDashboard('${safeNoteIdJs}')" title="${this.escapeHtml(n.title || 'Note sans titre')}">
                    ${this.escapeHtml(n.title || 'Note sans titre')}
                  </span>
                  ${safeLinkedEventIdJs ? '<span title="Liée à un créneau d\'agenda (cliquer pour voir)" style="color:var(--accent); display:inline-flex; align-items:center; flex-shrink:0; cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.openEventFromDashboard(\'' + safeLinkedEventIdJs + '\');">' + this.getSvgIcon('calendar', 12) + '</span>' : ''}
                </div>
                ${preview ? `<div class="dashboard-note-preview" style="font-size:0.76rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${this.escapeHtml(preview)}</div>` : ''}
              </div>
              <div class="dashboard-item-meta" style="display:flex; align-items:center; gap:5px;">
                ${projectBadge}
                <span class="dashboard-note-date">${this.escapeHtml(timeFormatted)}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  // Système de Toasts / Notifications Windows (avec bouton d'action facultatif)
  showToast(message, type = 'info', options = {}) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: this.getSvgIcon('check', 15, '', 2.2),
      info: this.getSvgIcon('info', 15, '', 2.2),
      error: this.getSvgIcon('warning', 15, '', 2.2)
    };
    const iconSvg = icons[type] || icons.info;
    const actionLabel = options && options.actionLabel ? String(options.actionLabel) : '';
    const hasAction = Boolean(actionLabel && typeof options.onAction === 'function');
    toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${iconSvg}</span> <span>${this.escapeHtml(message)}</span>${hasAction ? `<button type="button" class="toast-action-btn">${this.escapeHtml(actionLabel)}</button>` : ''}<div class="toast-progress-bar"></div>`;

    if (hasAction && typeof toast.querySelector === 'function') {
      const actBtn = toast.querySelector('.toast-action-btn');
      if (actBtn) {
        actBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            options.onAction();
          } catch (_) {}
          if (toast && typeof toast.remove === 'function') toast.remove();
        });
      }
    }

    const durationMs = hasAction ? 6500 : 3500;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(() => {
        if (toast && typeof toast.remove === 'function') toast.remove();
      }, 300);
    }, durationMs);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

// Exposer globalement pour inter-modules
if (typeof window !== 'undefined') {
  window.App = App;
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      App.init();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
