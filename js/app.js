/**
 * Antigravité - Contrôleur Principal de l'Application
 */

const App = {
  currentScreen: 'home',
  APP_VERSION: '1.2.0',
  WHATS_NEW_STORAGE_KEY: 'antigravite_last_seen_version',
  _activeWhatsNewVersion: null,

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
    "Décollage en douceur..."
  ],

  getRandomLoadingPhrases(count = 3) {
    const list = [...this.LOADING_PHRASES];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, count);
  },

  async init() {
    this._bootStartTs = Date.now();
    // 0. Configurer le message d'accueil dynamique sur l'écran de chargement
    this.initSplashScreen();

    // Sélection aléatoire de 3 messages de chargement pour l'animation
    const loadingPhrases = this.getRandomLoadingPhrases(3);
    this.updateSplashProgress(20, loadingPhrases[0]);

    // 1. Initialiser le stockage local et les modules en arrière-plan
    const initTask = (async () => {
      await StorageManager.init();
      const settings = StorageManager.getSettings();
      this.applyAppearanceSettings(settings);

      TasksManager.init();
      ProjectsManager.init();
      AgendaManager.init();
      NotesManager.init();
      BackupManager.init();
      if (typeof SettingsManager !== 'undefined') SettingsManager.init();
      if (typeof AgendaNotificationManager !== 'undefined') AgendaNotificationManager.init();
      if (typeof MusicManager !== 'undefined') MusicManager.init();
      if (typeof FocusManager !== 'undefined') FocusManager.init();
      if (typeof TrashManager !== 'undefined') TrashManager.init();
      if (typeof SearchManager !== 'undefined') SearchManager.init();

      this.bindNavigation();
      this.bindGlobalActions();
      this.initSidebarState();
      this.initSidebarRailTooltips();
      this.initSidebarStickyNote();
      this.initDashboardClock();
      this.updateDashboard();
      this._initDurationMs = Date.now() - (this._bootStartTs || Date.now());

      if (typeof GoogleSyncManager !== 'undefined') {
        try {
          await GoogleSyncManager.init();
          if (GoogleSyncManager.status?.isConnected) {
            await GoogleSyncManager.syncCalendarNow(true);
          }
        } catch (err) {
          console.warn("[App] Synchronisation initiale de l'agenda :", err);
        }
      }
    })();

    // Animation cadencée sur ~4.8 secondes (+2s supplémentaires) permettant un temps de lecture confortable
    // 1ère phrase (0 -> 1400ms)
    await new Promise(resolve => setTimeout(resolve, 1400));
    this.updateSplashProgress(55, loadingPhrases[1]);

    // 2ème phrase (1400ms -> 2800ms)
    await new Promise(resolve => setTimeout(resolve, 1400));
    this.updateSplashProgress(85, loadingPhrases[2]);

    // 3ème phrase (2800ms -> 4200ms)
    await new Promise(resolve => setTimeout(resolve, 1400));
    await initTask;

    // Étape finale : barre à 100% avec message de bienvenue
    const userName = this.getUserName();
    const readyMessage = userName ? `Prêt ${userName} ! Bonne journée !` : "Prêt ! Bonne journée !";
    this.updateSplashProgress(100, readyMessage);

    // Temps de lecture de la validation finale et fermeture en douceur (4200ms -> 4800ms)
    await new Promise(resolve => setTimeout(resolve, 600));
    this.hideSplashScreen();

    // 7. Afficher l'écran initial
    this.navigate('home');

    // 8. Afficher les nouveautés au premier lancement après une mise à jour
    this.scheduleWhatsNewCheck();
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
    if (typeof document === 'undefined') return;
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

  openWhatsNewModal(version = null) {
    if (typeof document === 'undefined') return false;
    const modal = document.getElementById('whats-new-modal');
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
    if (typeof document === 'undefined') return;
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
    if (typeof document === 'undefined') return;

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
        void section.offsetWidth;
        section.classList.add('changelog-highlight-flash');
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

  updateSplashProgress(percent, statusText) {
    const bar = document.getElementById('splash-progress-bar');
    const status = document.getElementById('splash-status');
    const icon = document.querySelector('.splash-brand-icon');
    if (bar) bar.style.width = `${percent}%`;
    if (status && statusText) status.textContent = statusText;
    if (icon) {
      icon.classList.remove('splash-beat');
      // Forcer le reflow du DOM pour déclencher l'impulsion rythmique
      void icon.offsetWidth;
      icon.classList.add('splash-beat');
      if (percent >= 100) {
        icon.classList.add('splash-complete');
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
      if (instant) {
        splash.style.display = 'none';
      } else {
        setTimeout(() => {
          splash.style.display = 'none';
        }, 500);
      }
    }
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = item.dataset.screen;
        if (target === 'agenda') {
          // Actualisation systématique à chaque clic sur l'agenda
          this.navigate('agenda');
          this.refreshAgenda(false);
        } else if (target) {
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

    // Mettre à jour les vues avec redéclenchement systématique de l'animation de transition
    document.querySelectorAll('.screen-view').forEach(view => {
      const isTarget = (view.id === `screen-${screenId}`);
      if (isTarget) {
        view.classList.remove('active');
        void view.offsetWidth; // Déclencher le reflow pour relancer l'animation de transition de page
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Déclencher la ligne de transition lumineuse balayant le haut de page
    const transitionBar = document.getElementById('page-transition-bar');
    if (transitionBar) {
      transitionBar.classList.remove('animating');
      void transitionBar.offsetWidth;
      transitionBar.classList.add('animating');
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
      focus: 'Mode Focus & Pomodoro',
      music: 'Espace Musique & Ambiance',
      trash: 'Corbeille',
      backups: 'Sauvegardes locales',
      settings: 'Paramètres & Apparence'
    };
    const titleEl = document.getElementById('current-screen-title');
    if (titleEl) {
      titleEl.textContent = titles[screenId] || 'Antigravité';
      titleEl.classList.remove('title-screen-transition');
      void titleEl.offsetWidth; // Déclencher le reflow pour relancer la micro-animation
      titleEl.classList.add('title-screen-transition');
    }

    // Rafraîchir les données de l'écran affiché
    if (screenId === 'home') {
      this.updateDashboard(true);
      if (typeof this.updateLiveClockNow === 'function') this.updateLiveClockNow();
    }
    if (screenId === 'tasks') TasksManager.render();
    if (screenId === 'projects') ProjectsManager.render();
    if (screenId === 'agenda') {
      AgendaManager.render();
      if (typeof GoogleSyncManager !== 'undefined') {
        GoogleSyncManager.refreshStatus();
        GoogleSyncManager.syncCalendarNow(true);
      }
    } else {
      if (typeof AgendaManager !== 'undefined') {
        AgendaManager.activeDateStr = null;
      }
      this.updateSidebarDayProgress();
    }
    if (screenId === 'notes') NotesManager.render();
    if (screenId === 'focus' && typeof FocusManager !== 'undefined') FocusManager.render();
    if (screenId === 'music' && typeof MusicManager !== 'undefined') MusicManager.render();
    if (screenId === 'trash' && typeof TrashManager !== 'undefined') TrashManager.render();
    if (screenId === 'backups') BackupManager.render();
    if (screenId === 'settings') {
      if (typeof SettingsManager !== 'undefined') SettingsManager.render();
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

    root.setAttribute('data-theme', settings.theme || 'dark');
    root.setAttribute('data-accent', settings.accentColor || 'blue');
    root.setAttribute('data-density', settings.density || 'comfortable');
    root.setAttribute('data-font-size', settings.fontSize || 'normal');
    root.setAttribute('data-font-family', settings.fontFamily || 'system');
    root.setAttribute('data-radius', settings.borderRadius || 'modern');
    root.setAttribute('data-glass', settings.glassStyle || 'balanced');
    root.setAttribute('data-perf-mode', perfMode);

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
    this.applySidebarTabsVisibility(settings);

    // Fond d'écran (Image derrière les panneaux — désactivé en Mode PC de merde pour épargner le GPU)
    const PRESET_WALLPAPERS = this.PRESET_WALLPAPERS;

    let wallpaperLayer = document.getElementById('app-wallpaper-layer');
    if (!wallpaperLayer) {
      wallpaperLayer = document.createElement('div');
      wallpaperLayer.id = 'app-wallpaper-layer';
      wallpaperLayer.className = 'app-wallpaper-layer';
      document.body.prepend(wallpaperLayer);
    }

    if (perfMode !== 'potato' && settings.backgroundImage && settings.backgroundImage !== 'none') {
      const bgVal = PRESET_WALLPAPERS[settings.backgroundImage] || `url("${settings.backgroundImage}")`;
      wallpaperLayer.style.background = bgVal;
      wallpaperLayer.style.backgroundSize = 'cover';
      wallpaperLayer.style.backgroundPosition = 'center';
      wallpaperLayer.style.backgroundRepeat = 'no-repeat';
      const opacity = (settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 25) / 100;
      wallpaperLayer.style.opacity = opacity;
      const blurPx = settings.backgroundBlur || 0;
      wallpaperLayer.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
      wallpaperLayer.style.display = 'block';
      document.body.classList.add('has-custom-wallpaper');
    } else {
      wallpaperLayer.style.display = 'none';
      document.body.classList.remove('has-custom-wallpaper');
    }

    // Mettre à jour la couleur du bandeau de fenêtre intégré (Boutons Réduire, Agrandir, Fermer)
    if (window.AntigraviteAPI && typeof window.AntigraviteAPI.setTitleBarOverlay === 'function') {
      const isLight = settings.theme === 'light';
      const isOled = settings.theme === 'oled';
      const overlayColor = isLight ? '#ffffff' : (isOled ? '#09090b' : '#131926');
      const symbolColor = isLight ? '#475569' : '#94a3b8';
      window.AntigraviteAPI.setTitleBarOverlay({
        color: overlayColor,
        symbolColor: symbolColor,
        height: 48
      }).catch(() => {});
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

  // Gestion de la visibilité des onglets dans le panneau latéral
  applySidebarTabsVisibility(settings) {
    if (!settings && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      settings = StorageManager.getSettings();
    }
    if (!settings) return;

    const visibleScreens = settings.sidebarVisibleScreens || {};
    const defaultVisible = {
      tasks: true,
      projects: true,
      agenda: true,
      notes: true,
      focus: true,
      music: true,
      trash: true,
      backups: true
    };

    if (typeof document === 'undefined') return;
    document.querySelectorAll('.nav-item').forEach(item => {
      const screen = item.dataset.screen;
      if (!screen || screen === 'home' || screen === 'settings') {
        item.style.display = '';
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

  // Mise à jour de la barre de progression de la journée (avec frise colorée des événements)
  updateSidebarDayProgress(targetDate = null) {
    if (typeof document === 'undefined') return;
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
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Plage horaire de la journée active : 07h00 à 23h00 (16h = 960 minutes)
    const dayStartMin = 7 * 60; // 420 min
    const dayEndMin = 23 * 60;   // 1380 min
    const totalDayMin = dayEndMin - dayStartMin; // 960 min

    // Déterminer la date cible à afficher (aujourd'hui ou journée spécifique sélectionnée dans l'agenda)
    let activeDateStr = todayStr;
    if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      activeDateStr = targetDate;
    } else if (targetDate instanceof Date && !isNaN(targetDate.getTime())) {
      activeDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    } else if (typeof window !== 'undefined' && window.AgendaManager && this.currentScreen === 'agenda') {
      if (window.AgendaManager.activeDateStr) {
        activeDateStr = window.AgendaManager.activeDateStr;
      } else if (window.AgendaManager.currentView === 'day' && window.AgendaManager.currentWeekStart) {
        const d = window.AgendaManager.currentWeekStart;
        activeDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    const isToday = (activeDateStr === todayStr);

    const currentTotalMin = currentH * 60 + currentM;
    let pct = 0;
    let remainingText = '';

    if (isToday) {
      if (currentTotalMin < dayStartMin) {
        pct = 0;
        const minsUntilStart = dayStartMin - currentTotalMin;
        const h = Math.floor(minsUntilStart / 60);
        const m = minsUntilStart % 60;
        remainingText = `Débute dans ${h > 0 ? h + 'h' : ''}${m}m`;
      } else if (currentTotalMin >= dayEndMin) {
        pct = 100;
        remainingText = 'Journée terminée';
      } else {
        const elapsed = currentTotalMin - dayStartMin;
        pct = Math.round((elapsed / totalDayMin) * 100);
        const remainingMin = dayEndMin - currentTotalMin;
        const h = Math.floor(remainingMin / 60);
        const m = remainingMin % 60;
        remainingText = `Reste ${h}h${String(m).padStart(2, '0')}`;
      }
    } else {
      pct = 0;
    }

    const percentEl = document.getElementById('sidebar-day-progress-percent');
    const barEl = document.getElementById('sidebar-day-progress-bar');
    const timeEl = document.getElementById('sidebar-day-progress-time');
    const remEl = document.getElementById('sidebar-day-progress-remaining');
    const trackEl = document.getElementById('sidebar-day-progress-track') || (widget && typeof widget.querySelector === 'function' ? widget.querySelector('.sidebar-day-progress-track') : null);
    const iconEl = (widget && typeof widget.querySelector === 'function') ? widget.querySelector('.sidebar-day-progress-icon') : null;

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

      // Vérifier si l'événement concerne la journée active
      if (startDate <= activeDateStr && endDate >= activeDateStr) {
        let startMin = 420; // 07:00
        let endMin = 1380;   // 23:00
        const isAllDay = evt.allDay || (!startStr.includes('T') && !endStr.includes('T'));

        if (startStr.includes('T')) {
          const sDate = startStr.slice(0, 10);
          if (sDate === activeDateStr) {
            const sTime = startStr.split('T')[1].slice(0, 5);
            const [sh, sm] = sTime.split(':').map(Number);
            if (!isNaN(sh)) startMin = sh * 60 + (sm || 0);
          } else if (sDate < activeDateStr) {
            startMin = 420;
          }
        }
        if (endStr.includes('T')) {
          const eDate = endStr.slice(0, 10);
          if (eDate === activeDateStr) {
            const eTime = endStr.split('T')[1].slice(0, 5);
            const [eh, em] = eTime.split(':').map(Number);
            if (!isNaN(eh)) endMin = eh * 60 + (em || 0);
          } else if (eDate > activeDateStr) {
            endMin = 1380;
          }
        } else if (!isAllDay) {
          endMin = Math.max(endMin, startMin + 60);
        }

        // Si fin <= début, accorder au minimum 45 minutes pour la lisibilité
        if (endMin <= startMin) {
          endMin = startMin + 45;
        }

        // Déterminer la couleur de l'événement et les informations du projet / de la tâche
        let color = evt.color || '#38bdf8';
        let projectTitle = null;
        let projectColor = null;
        let taskTitle = null;

        if (evt.taskId) {
          ensureTaskAndProjectMaps();
          const linkedTask = taskMap.get(evt.taskId);
          if (linkedTask) {
            taskTitle = linkedTask.title;
            if (linkedTask.projectId && projectMap.has(linkedTask.projectId)) {
              const proj = projectMap.get(linkedTask.projectId);
              if (proj) {
                projectTitle = proj.title;
                if (proj.color) {
                  projectColor = proj.color;
                  color = proj.color;
                }
              }
            }
          }
        }

        const timeLabel = isAllDay ? 'Journée entière' : `${formatHM(startMin)} - ${formatHM(endMin)}`;

        // Vérifier si cet événement est en cours (si aujourd'hui)
        if (isToday && currentTotalMin >= startMin && currentTotalMin < endMin) {
          activeEventNow = { evt, timeLabel };
        }

        // Vérifier si le créneau est dans la plage active 07h00 - 23h00
        if (endMin > dayStartMin && startMin < dayEndMin) {
          const visStart = Math.max(dayStartMin, startMin);
          const visEnd = Math.min(dayEndMin, Math.max(visStart + 12, endMin));

          const leftPct = ((visStart - dayStartMin) / totalDayMin) * 100;
          const widthPct = Math.max(2.5, ((visEnd - visStart) / totalDayMin) * 100);

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
      const curPctText = `${pct}%`;
      const curBarWidth = `${pct}%`;
      if (iconEl && iconEl.textContent !== '⏱️') iconEl.textContent = '⏱️';
      if (timeEl && timeEl.textContent !== curTimeText) timeEl.textContent = curTimeText;
      if (percentEl && percentEl.textContent !== curPctText) percentEl.textContent = curPctText;
      if (barEl) {
        if (barEl.style.width !== curBarWidth) barEl.style.width = curBarWidth;
        if (barEl.style.display !== 'block') barEl.style.display = 'block';
      }
      if (widget.title !== 'Progression de la journée en cours') widget.title = 'Progression de la journée en cours';
      if (typeof widget.removeAttribute === 'function') widget.removeAttribute('data-viewing-other-day');
      if (widget.dataset) delete widget.dataset.viewingOtherDay;
      if (widget.style.cursor !== 'default') widget.style.cursor = 'default';
    } else {
      if (iconEl && iconEl.textContent !== '📅') iconEl.textContent = '📅';
      const targetD = new Date(`${activeDateStr}T00:00:00`);
      const targetLabel = !isNaN(targetD.getTime())
        ? targetD.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        : activeDateStr;
      const evtCountText = `${todayEvents.length} évt${todayEvents.length > 1 ? 's' : ''}`;
      if (timeEl && timeEl.textContent !== targetLabel) timeEl.textContent = targetLabel;
      if (percentEl && percentEl.textContent !== evtCountText) percentEl.textContent = evtCountText;
      if (barEl) {
        if (barEl.style.width !== '0%') barEl.style.width = '0%';
        if (barEl.style.display !== 'none') barEl.style.display = 'none';
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

    // Mettre à jour le texte par défaut
    let defaultText = '';
    if (isToday) {
      defaultText = activeEventNow
        ? `En cours : ${activeEventNow.evt.title || 'Événement'}`
        : remainingText;
    } else {
      if (todayEvents.length === 0) {
        defaultText = 'Aucun créneau prévu (07h-23h)';
      } else {
        const totalDurMin = todayEvents.reduce((acc, ev) => acc + (ev.durationMin || 0), 0);
        const dh = Math.floor(totalDurMin / 60);
        const dm = totalDurMin % 60;
        const durStr = dh > 0 ? (dm > 0 ? `${dh}h${String(dm).padStart(2, '0')}` : `${dh}h`) : `${dm}m`;
        defaultText = `${todayEvents.length} événement${todayEvents.length > 1 ? 's' : ''} (${durStr})`;
      }
    }

    if (remEl) {
      if (remEl.dataset) remEl.dataset.defaultText = defaultText;
      if (!widget.dataset || !widget.dataset.hovering) {
        if (remEl.textContent !== defaultText) remEl.textContent = defaultText;
      }
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
              remEl.textContent = (remEl.dataset && remEl.dataset.defaultText) || defaultText;
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

    if (tooltip.style) {
      tooltip.style.display = 'flex';
      tooltip.style.pointerEvents = 'none';
    }
    if (tooltip.classList && typeof tooltip.classList.remove === 'function') {
      tooltip.classList.remove('visible');
    }

    if (typeof seg.getBoundingClientRect === 'function') {
      const rect = seg.getBoundingClientRect();
      const tooltipWidth = 240;

      let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      if (left < 10) left = 10;
      if (typeof window !== 'undefined' && window.innerWidth && left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      const tooltipHeight = tooltip.offsetHeight || 120;
      let top = rect.top - tooltipHeight - 8;
      if (top < 10) {
        top = rect.bottom + 8;
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
    if (typeof document === 'undefined') return;
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
    if (typeof document === 'undefined') return;
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
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        textarea.value = '';
        if (typeof StorageManager !== 'undefined' && typeof StorageManager.saveSidebarQuickNote === 'function') {
          StorageManager.saveSidebarQuickNote('');
        }
        textarea.focus();
      });
    }

    this.updateSidebarStickyNote();
  },

  updateSidebarStickyNote() {
    if (typeof document === 'undefined') return;
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

    this._bindWhatsNewModalButtons();

    // Raccourcis clavier globaux (Échap, Entrée, Ctrl+F, Ctrl+B, Ctrl+Shift+A, F1)
    document.addEventListener('keydown', (e) => {
      // 1. Fermeture des modales et de la recherche rapide universelle par Échap
      if (e.key === 'Escape') {
        if (typeof SearchManager !== 'undefined' && typeof SearchManager.close === 'function') {
          SearchManager.close();
        }
        const whatsNew = document.getElementById('whats-new-modal');
        if (whatsNew && whatsNew.classList.contains('active')) {
          this.closeWhatsNewModal(true);
        }
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
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

      // 4. Validation formulaire modale par Entrée
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toUpperCase() : '';
          // Ne soumettre que depuis un champ INPUT (laissant libre saisie aux TEXTAREA multilignes)
          if (tag === 'INPUT' && activeModal.contains(document.activeElement)) {
            const primaryBtn = activeModal.querySelector('.modal-footer .btn-primary:not(:disabled)');
            if (primaryBtn) {
              e.preventDefault();
              primaryBtn.click();
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
          if (overlay.id === 'whats-new-modal') {
            this.closeWhatsNewModal(true);
            return;
          }
          overlay.classList.remove('active');
          if (overlay.id === 'search-modal' && typeof SearchManager !== 'undefined' && typeof SearchManager.close === 'function') {
            SearchManager.close();
          }
        }
      });
    });

    // Phrase d'ambiance synchronisée avec le moment de la journée (matin, midi, soir)
    const btnShuffleQuote = document.getElementById('btn-shuffle-quote');
    if (btnShuffleQuote) {
      btnShuffleQuote.addEventListener('click', () => this.shuffleDashboardQuote());
    }

    // Cartes statistiques et panneaux du tableau de bord cliquables (redirection avec retour haptique non sonore)
    document.querySelectorAll('.stat-card[data-nav], .panel-header[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Ne pas intercepter les clics sur les boutons internes (ex: "Voir tout" ou "➕")
        if (e.target.closest('button')) return;
        const targetScreen = el.dataset.nav;
        if (targetScreen) {
          this.triggerHapticFeedback();
          el.classList.add('haptic-press');
          setTimeout(() => el.classList.remove('haptic-press'), 130);
          this.navigate(targetScreen);
        }
      });
    });
  },

  triggerHapticFeedback() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch (_) {}
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
    const icon = options.icon || defaultIcon;

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
      btnConfirm.textContent = confirmText;
      btnConfirm.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
      btnCancel.textContent = cancelText;
      btnCancel.style.display = 'inline-flex';

      const cleanup = (result) => {
        modal.classList.remove('active');
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
    const icon = options.icon || defaultAlertIcons[type] || defaultAlertIcons.info;

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
      btnConfirm.textContent = okText;
      btnConfirm.className = (type === 'error') ? 'btn btn-danger' : 'btn btn-primary';
      if (btnCancel) btnCancel.style.display = 'none';

      const cleanup = () => {
        modal.classList.remove('active');
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

      btnConfirm.onclick = () => cleanup();
      if (btnClose) btnClose.onclick = () => cleanup();
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', onKeyDown);
      }

      modal.classList.add('active');
      if (typeof btnConfirm.focus === 'function') btnConfirm.focus();
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
    if (typeof document === 'undefined') return;

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

  applyPerformanceTimers(perfMode = 'normal') {
    const clockMs = perfMode === 'potato' ? 15000 : (perfMode === 'economy' ? 5000 : 1000);
    const dayMs = perfMode === 'potato' ? 120000 : (perfMode === 'economy' ? 60000 : 30000);

    if (this._updateClockFn && (!this._clockTimer || this._clockIntervalMs !== clockMs)) {
      this._clockIntervalMs = clockMs;
      if (this._clockTimer) clearInterval(this._clockTimer);
      this._clockTimer = setInterval(() => this._updateClockFn(false), clockMs);
    }

    if (typeof window !== 'undefined' && (!this._dayProgressTimer || this._dayProgressIntervalMs !== dayMs)) {
      this._dayProgressIntervalMs = dayMs;
      if (this._dayProgressTimer) clearInterval(this._dayProgressTimer);
      this._dayProgressTimer = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          this.updateSidebarDayProgress();
        }
      }, dayMs);
    }

    if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.applyPerformanceMode === 'function') {
      AgendaManager.applyPerformanceMode(perfMode);
    }
  },

  syncDesktopPrefs(settings) {
    if (!settings || typeof window === 'undefined' || !window.AntigraviteAPI || !window.AntigraviteAPI.system) return;
    if (typeof window.AntigraviteAPI.system.setDesktopPrefs === 'function') {
      window.AntigraviteAPI.system.setDesktopPrefs({
        runInBackgroundOnClose: settings.runInBackgroundOnClose !== false,
        backupDirectory: settings.backupDirectory || null,
        launchOnStartup: settings.launchOnStartup === true
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
      "Défier les lois de la gravité dès le réveil, c'est un bel exploit."
    ],
    lunch: [
      "Prenez une vraie pause déjeuner : l'esprit a besoin de souffler pour rester vif 🍽️.",
      "Il paraît que les personnes les plus organisées savourent aussi leur pause midi.",
      "Faites le plein d'énergie, vos projets vous attendront sagement après le repas.",
      "Une petite pause bien méritée avant d'attaquer la deuxième partie de journée.",
      "Rassurez-vous, même Rome ne s'est pas organisée entre midi et deux."
    ],
    afternoon: [
      "Concentration et efficacité : chaque tâche cochée cet après-midi est une victoire.",
      "Une étape à la fois : avancez à votre rythme, avec constance et clarté.",
      "Cocher une tâche procure une dose de dopamine 100 % locale et garantie sans sucre.",
      "Moins de charge mentale, plus de sérénité (et zéro pub sur vos données personnelles).",
      "Si une tâche vous effraie, regardez-la droit dans les yeux et cochez-la."
    ],
    evening: [
      "La journée touche à sa fin : bravo pour tout le travail accompli aujourd'hui !",
      "Déconnectez l'esprit en toute sérénité : tout est soigneusement sauvegardé en local.",
      "Le repos du soir est la clé d'une journée productive demain.",
      "Vos tâches sont au chaud pour la nuit, profitez d'une excellente soirée.",
      "Bilan de fin de journée : votre temps est précieux, savourez ce moment de calme."
    ],
    warm: [
      "J'espère que vous passez une excellente journée.",
      "Je suis là pour vous aider à vous organiser sereinement.",
      "Une étape à la fois : chaque tâche cochée est une victoire.",
      "Prenez une grande inspiration : vous avez tout sous contrôle.",
      "Votre temps est précieux, savourez chaque moment aujourd'hui.",
      "Prenez soin de vous entre deux sessions de travail !"
    ],
    witty: [
      "Ne remettez pas à demain ce que vous pouvez faire... après un bon café ☕.",
      "Vos tâches n'ont qu'à bien se tenir : vous êtes aux commandes aujourd'hui.",
      "Défier les lois de la gravité, c'est bien. Vaincre la procrastination, c'est un exploit.",
      "Une to-do list bien remplie, c'est la preuve d'un optimisme sans limite.",
      "Rassurez-vous, même Rome ne s'est pas organisée en un jour.",
      "Moins de charge mentale, plus de sérénité (et zéro pub sur vos données)."
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
    if (typeof document === 'undefined') return;
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

    // 2. Détecter la période actuelle (matin, midi, après-midi, soir)
    const currentPeriod = this.getTimeOfDayPeriod();

    // 3. Si la période n'a pas changé et qu'on a déjà une phrase de session, la conserver
    if (this._currentQuote && this._currentQuotePeriod === currentPeriod && !forceNew) {
      subtitleEl.textContent = this._currentQuote;
      return;
    }

    // 4. Sélection de la phrase adaptée à la période (matin, midi, après-midi, soir)
    const newQuote = this.getRandomGreetingQuote(currentPeriod);
    this._currentQuote = newQuote;
    this._currentQuotePeriod = currentPeriod;
    subtitleEl.textContent = newQuote;
  },

  shuffleDashboardQuote() {
    if (typeof document === 'undefined') return;
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (subtitleEl && subtitleEl.style) {
      subtitleEl.style.opacity = '0';
      subtitleEl.style.transform = 'translateY(-3px)';
      subtitleEl.style.transition = 'all 0.18s ease';
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

    const tasks = StorageManager.getTasks();
    const projects = StorageManager.getProjects();
    const events = StorageManager.getEvents();
    const notes = StorageManager.getNotes();
    const projectById = new Map((projects || []).map(p => [p.id, p]));

    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // 1. Tâches prévues aujourd'hui
    let plannedTodayCount = 0;
    let upcomingDeadlinesCount = 0;
    const plannedTodayList = [];
    const upcomingDeadlinesList = [];

    const traverseTasks = (list) => {
      list.forEach(t => {
        if (!t.completed) {
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
    if (elProjects) elProjects.textContent = projects.length;

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
          const projectBorder = proj && proj.color ? `border-left: 3.5px solid ${proj.color};` : '';
          const projectBadge = proj && proj.color ? `<span class="badge" style="font-size:0.68rem; padding:1px 6px; border-radius:4px; border:1px solid ${proj.color}60; color:${proj.color}; background-color:${proj.color}1c; font-weight:600;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${proj.color}; margin-right:4px;"></span>${this.escapeHtml(proj.title)}</span>` : '';
          return `
            <div class="dashboard-item dashboard-task-item" style="${projectBorder}">
              <div class="dashboard-item-main">
                <span class="dashboard-item-icon">📌</span>
                <span class="dashboard-item-title" onclick="TasksManager.openTaskModal('${t.id}')" title="${this.escapeHtml(t.title)}">${this.escapeHtml(t.title)}</span>
              </div>
              <div class="dashboard-item-meta" style="display:flex; align-items:center; gap:5px;">
                ${projectBadge}
                ${TasksManager.getPriorityBadge(t.priority)}
              </div>
            </div>
          `;
        }).join('');
      }
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
          </div>
        `;
      } else {
        panelEvents.innerHTML = todayEvents.map(e => {
          const isGoogle = e.source === 'google';
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
          const dotColor = isGoogle ? '#3b82f6' : '#8b5cf6';

          return `
            <div class="dashboard-item dashboard-event-item">
              <div class="dashboard-item-main">
                <span class="dashboard-item-dot" style="background-color:${dotColor}; box-shadow:0 0 6px ${dotColor};"></span>
                <span class="dashboard-item-title" onclick="AgendaManager.openEventModal('${e.id}')" title="${this.escapeHtml(e.title)}">${this.escapeHtml(e.title)}</span>
              </div>
              <div class="dashboard-item-meta">
                <span class="dashboard-source-pill ${isGoogle ? 'pill-google' : 'pill-antigravite'}">
                  ${isGoogle ? '🌐 Google' : '<img src="./assets/icon.png" class="antigravite-symbol-icon" alt=""> Antigravité'}
                </span>
                <span class="dashboard-time-badge" title="Créneau horaire : ${timeBadge}">⏱️ ${timeBadge}</span>
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
          const rawContent = (n.content || '').replace(/[#*`_~>\-]/g, '').trim();
          const preview = rawContent.length > 55 ? rawContent.slice(0, 55) + '…' : rawContent;
          const dateObj = new Date(n.updatedAt || n.createdAt);
          const isTodayNote = !isNaN(dateObj.getTime()) && dateObj.toISOString().slice(0, 10) === todayStr;
          const timeFormatted = !isNaN(dateObj.getTime()) 
            ? (isTodayNote ? `Aujourd'hui à ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}` : dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))
            : '';

          const proj = (n.projectId || n.linkedProjectId) ? projectById.get(n.projectId || n.linkedProjectId) : null;
          const projectBorder = proj && proj.color ? `border-left: 3.5px solid ${proj.color};` : '';
          const projectBadge = proj && proj.color ? `<span class="badge" style="font-size:0.68rem; padding:1px 6px; border-radius:4px; border:1px solid ${proj.color}60; color:${proj.color}; background-color:${proj.color}1c; font-weight:600;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${proj.color}; margin-right:4px;"></span>${this.escapeHtml(proj.title)}</span>` : '';

          return `
            <div class="dashboard-item dashboard-note-item" style="${projectBorder}">
              <div class="dashboard-item-main" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <div style="display:flex; align-items:center; gap:6px; width:100%; min-width:0;">
                  <span class="dashboard-item-icon">📝</span>
                  <span class="dashboard-item-title" onclick="App.openNoteFromDashboard('${n.id}')" title="${this.escapeHtml(n.title || 'Note sans titre')}">
                    ${this.escapeHtml(n.title || 'Note sans titre')}
                  </span>
                  ${n.linkedEventId ? '<span title="Liée à un créneau d\'agenda" style="font-size:0.7rem; color:var(--accent); flex-shrink:0;">📅</span>' : ''}
                </div>
                ${preview ? `<div class="dashboard-note-preview" style="font-size:0.76rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${this.escapeHtml(preview)}</div>` : ''}
              </div>
              <div class="dashboard-item-meta" style="display:flex; align-items:center; gap:5px;">
                ${projectBadge}
                <span class="dashboard-note-date">${timeFormatted}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  // Système de Toasts / Notifications Windows
  showToast(message, type = 'info') {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; flex-shrink:0;"><path d="M20 6L9 17l-5-5"/></svg>',
      info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      error: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    const iconSvg = icons[type] || icons.info;
    toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${iconSvg}</span> <span>${this.escapeHtml(message)}</span><div class="toast-progress-bar"></div>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast && typeof toast.remove === 'function') toast.remove();
      }, 300);
    }, 3500);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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
