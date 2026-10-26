/**
 * Antigravité - Contrôleur Principal de l'Application
 */

const App = {
  currentScreen: 'home',

  async init() {
    // 0. Configurer le message d'accueil dynamique sur l'écran de chargement
    this.initSplashScreen();

    // 1. Initialiser le stockage local
    this.updateSplashProgress(20, "Chargement de vos données locales...");
    await StorageManager.init();

    // 2. Appliquer les réglages (thème, accent, densité, etc.)
    const settings = StorageManager.getSettings();
    this.applyAppearanceSettings(settings);

    // 3. Initialiser les modules
    this.updateSplashProgress(45, "Initialisation des modules...");
    TasksManager.init();
    ProjectsManager.init();
    AgendaManager.init();
    NotesManager.init();
    BackupManager.init();
    if (typeof SettingsManager !== 'undefined') SettingsManager.init();
    if (typeof AgendaNotificationManager !== 'undefined') AgendaNotificationManager.init();

    // 4. Configurer les écouteurs de navigation
    this.bindNavigation();
    this.bindGlobalActions();
    this.initSidebarState();
    this.initDashboardClock();
    this.updateDashboard();

    // 5. Pendant le chargement : actualiser l'agenda en arrière-plan
    this.updateSplashProgress(70, "Actualisation de l'agenda...");
    const syncPromise = (async () => {
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

    // Temps d'affichage allongé d'une seconde supplémentaire (2.3s) pour permettre la lecture confortable
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 2300));
    await Promise.all([syncPromise, minTimePromise]);

    this.updateSplashProgress(100, "Prêt ! Bonne journée ✨");

    // 6. Masquer en douceur le splash screen
    await new Promise(resolve => setTimeout(resolve, 250));
    this.hideSplashScreen();

    // 7. Afficher l'écran initial
    this.navigate('home');
  },

  initSplashScreen() {
    const greetingEl = document.getElementById('splash-greeting');
    if (!greetingEl) return;
    const now = new Date();
    const hour = now.getHours();
    let message = "Bonjour ! Passez une excellente journée ✨";
    if (hour >= 18 || hour < 5) {
      message = "Bonsoir ! Passez une excellente soirée ✨";
    } else if (hour >= 12 && hour < 14) {
      message = "Bonjour ! Bon appétit et très belle journée ✨";
    }
    greetingEl.textContent = message;
  },

  updateSplashProgress(percent, statusText) {
    const bar = document.getElementById('splash-progress-bar');
    const status = document.getElementById('splash-status');
    if (bar) bar.style.width = `${percent}%`;
    if (status && statusText) status.textContent = statusText;
  },

  hideSplashScreen() {
    const splash = document.getElementById('app-splash-screen');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 500);
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

  navigate(screenId) {
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

    // Titre de l'en-tête
    const titles = {
      home: 'Tableau de bord',
      tasks: 'Gestionnaire de tâches',
      projects: 'Gestion des projets',
      agenda: 'Agenda hebdomadaire',
      notes: 'Notes personnelles',
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
    }
    if (screenId === 'notes') NotesManager.render();
    if (screenId === 'backups') BackupManager.render();
    if (screenId === 'settings') {
      if (typeof SettingsManager !== 'undefined') SettingsManager.render();
      if (typeof GoogleSyncManager !== 'undefined') GoogleSyncManager.refreshStatus();
    }
  },

  applyAppearanceSettings(settings) {
    if (!settings) settings = StorageManager.getSettings();
    const root = document.documentElement;

    root.setAttribute('data-theme', settings.theme || 'dark');
    root.setAttribute('data-accent', settings.accentColor || 'blue');
    root.setAttribute('data-density', settings.density || 'comfortable');
    root.setAttribute('data-font-size', settings.fontSize || 'normal');
    root.setAttribute('data-radius', settings.borderRadius || 'modern');

    this.updateThemeButtonLabel(settings.theme || 'dark');

    // Fond d'écran (Image derrière les panneaux)
    const PRESET_WALLPAPERS = {
      nebula: 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.6), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(56, 189, 248, 0.5), transparent 60%), radial-gradient(circle at 50% 50%, #0f172a, #020617 100%)',
      aurora: 'radial-gradient(ellipse at 30% 15%, rgba(16, 185, 129, 0.6), transparent 55%), radial-gradient(ellipse at 75% 35%, rgba(6, 182, 212, 0.5), transparent 55%), radial-gradient(circle at 50% 50%, #042f2e, #021a19 100%)',
      mineral: 'radial-gradient(circle at 80% 20%, rgba(148, 163, 184, 0.4), transparent 55%), radial-gradient(circle at 20% 80%, rgba(100, 116, 139, 0.35), transparent 55%), radial-gradient(circle at 50% 50%, #18181b, #09090b 100%)',
      sunset: 'radial-gradient(ellipse at 70% 20%, rgba(244, 63, 94, 0.55), transparent 55%), radial-gradient(ellipse at 30% 60%, rgba(245, 158, 11, 0.5), transparent 55%), radial-gradient(circle at 50% 50%, #1f1124, #0b060d 100%)'
    };

    let wallpaperLayer = document.getElementById('app-wallpaper-layer');
    if (!wallpaperLayer) {
      wallpaperLayer = document.createElement('div');
      wallpaperLayer.id = 'app-wallpaper-layer';
      wallpaperLayer.className = 'app-wallpaper-layer';
      document.body.prepend(wallpaperLayer);
    }

    if (settings.backgroundImage && settings.backgroundImage !== 'none') {
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
    const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
    if (btnCollapseSidebar) {
      btnCollapseSidebar.addEventListener('click', () => this.toggleSidebar());
    }

    // Raccourcis clavier globaux (Échap pour modales, Ctrl+B pour volet latéral)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });

    // Fermeture des modales par clic sur le fond
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
  },

  toggleSidebar() {
    const container = document.getElementById('app-container');
    if (!container) return;
    const isCollapsed = container.classList.toggle('sidebar-collapsed');
    localStorage.setItem('antigravite_sidebar_collapsed', isCollapsed ? '1' : '0');
  },

  initSidebarState() {
    const saved = localStorage.getItem('antigravite_sidebar_collapsed');
    if (saved === '1') {
      const container = document.getElementById('app-container');
      if (container) container.classList.add('sidebar-collapsed');
    }
  },

  updateThemeButtonLabel(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Mode clair' : '🌙 Mode sombre';
  },

  initDashboardClock() {
    const update = () => {
      // Pause intelligente des mutations DOM si la fenêtre est masquée ou si l'utilisateur est sur un autre écran
      if (typeof document !== 'undefined' && document.hidden === true) return;
      if (this.currentScreen && this.currentScreen !== 'home') return;

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const elTime = document.getElementById('dashboard-clock-time');
      const elSec = document.getElementById('dashboard-clock-seconds');
      const elDate = document.getElementById('dashboard-clock-date');
      const elGreet = document.getElementById('dashboard-greeting');

      if (elTime) elTime.textContent = `${hours}:${minutes}`;
      if (elSec) elSec.textContent = `:${seconds}`;

      if (elDate) {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        elDate.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
      }

      if (elGreet) {
        const h = now.getHours();
        let message = "Bonjour ! Passez une excellente journée ✨";
        if (h >= 18 || h < 5) {
          message = "Bonsoir ! Passez une excellente soirée ✨";
        } else if (h >= 12 && h < 14) {
          message = "Bonjour ! Bon appétit et très belle journée ✨";
        }
        elGreet.textContent = message;
      }
    };

    this._updateClockFn = update;
    update();
    if (!this._clockTimer) {
      this._clockTimer = setInterval(update, 1000);
    }

    if (!this._visibilityBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && (!this.currentScreen || this.currentScreen === 'home')) {
          update();
        }
      });
    }
  },

  updateLiveClockNow() {
    if (this._updateClockFn) this._updateClockFn();
  },

  openNoteFromDashboard(noteId) {
    this.navigate('notes');
    if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
      window.NotesManager.selectNote(noteId);
    }
  },

  // Tableau de bord Accueil
  updateDashboard(force = false) {
    if (!force && this.currentScreen && this.currentScreen !== 'home') {
      this._dashboardDirty = true;
      return;
    }
    this._dashboardDirty = false;

    const tasks = StorageManager.getTasks();
    const projects = StorageManager.getProjects();
    const events = StorageManager.getEvents();
    const notes = StorageManager.getNotes();

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
        panelPlanned.innerHTML = `<div style="color:var(--text-dim); font-size:0.86rem; padding:10px 0;">Aucune tâche planifiée pour aujourd'hui.</div>`;
      } else {
        panelPlanned.innerHTML = plannedTodayList.slice(0, 5).map(t => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.88rem;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--accent);">📌</span>
              <span style="cursor:pointer;" onclick="TasksManager.openTaskModal('${t.id}')">${this.escapeHtml(t.title)}</span>
            </div>
            ${TasksManager.getPriorityBadge(t.priority)}
          </div>
        `).join('');
      }
    }

    // 5. Remplir le panneau "Créneaux du jour (Agenda)"
    const panelEvents = document.getElementById('dashboard-today-events');
    if (panelEvents) {
      if (todayEvents.length === 0) {
        panelEvents.innerHTML = `<div style="color:var(--text-dim); font-size:0.86rem; padding:10px 0;">Aucun créneau réservé pour aujourd'hui.</div>`;
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
            timeBadge = isMultiDay ? 'Journée (multi-jours)' : 'Journée';
          } else if (isMultiDay) {
            if (todayStr === startDay) {
              timeBadge = `${startTime} ➔`;
            } else if (todayStr === endDay) {
              timeBadge = `➔ ${endTime}`;
            } else {
              timeBadge = 'Journée continue';
            }
          } else {
            timeBadge = `${startTime} - ${endTime}`;
          }
          const dotColor = isGoogle ? '#3b82f6' : '#8b5cf6';

          return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.88rem;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:10px; height:10px; border-radius:50%; background-color:${dotColor}; box-shadow:0 0 6px ${dotColor};"></span>
                <span style="cursor:pointer; font-weight:500;" onclick="AgendaManager.openEventModal('${e.id}')">${this.escapeHtml(e.title)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="dashboard-source-pill ${isGoogle ? 'pill-google' : 'pill-antigravite'}">
                  ${isGoogle ? '🌐 Google' : '<img src="./assets/icon.png" class="antigravite-symbol-icon" alt=""> Antigravité'}
                </span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${timeBadge}</span>
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
        panelNotes.innerHTML = `<div style="color:var(--text-dim); font-size:0.86rem; padding:10px 0;">Aucune note enregistrée pour le moment.</div>`;
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

          return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.88rem;">
              <div style="display:flex; flex-direction:column; gap:2px; overflow:hidden; padding-right:8px;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="color:var(--accent); font-size:0.85rem;">📝</span>
                  <span style="cursor:pointer; font-weight:600; color:var(--text-main);" onclick="App.openNoteFromDashboard('${n.id}')">
                    ${this.escapeHtml(n.title || 'Note sans titre')}
                  </span>
                  ${n.linkedEventId ? '<span title="Liée à un créneau d\'agenda" style="font-size:0.7rem; color:var(--accent);">📅</span>' : ''}
                </div>
                ${preview ? `<div style="font-size:0.76rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(preview)}</div>` : ''}
              </div>
              <span style="font-size:0.72rem; color:var(--text-muted); flex-shrink:0;">${timeFormatted}</span>
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
    const icons = { success: '✅', info: 'ℹ️', error: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
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
