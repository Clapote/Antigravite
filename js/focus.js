/**
 * Antigravité - Module Focus Pomodoro & Deep Work
 * Minuteur immersif de concentration lié à la musique d'ambiance et aux tâches.
 */

const FocusManager = {
  MODES: {
    focus: { name: 'Focus (25m)', duration: 25 * 60, type: 'work' },
    deep: { name: 'Deep Work (50m)', duration: 50 * 60, type: 'work' },
    shortBreak: { name: 'Pause courte (5m)', duration: 5 * 60, type: 'break' },
    longBreak: { name: 'Pause longue (15m)', duration: 15 * 60, type: 'break' },
    custom: { name: 'Personnalisé', duration: 30 * 60, type: 'work' }
  },

  HISTORY_KEY: 'antigravite_focus_history_v1',
  TARGET_KEY: 'antigravite_focus_target',

  currentMode: 'focus',
  workMinutes: 25,
  breakMinutes: 5,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  timerId: null,
  linkedTaskId: null,
  focusTarget: null, // { type: 'task' | 'project' | 'event' | 'note', id: string }
  autoMusic: true,
  shuffleMusic: false,
  specificPlaylistEnabled: false,
  selectedPlaylistId: 'all',
  sessionsToday: 0,
  minutesToday: 0,
  cycleCount: 0,
  initialized: false,

  init(options = {}) {
    if (this.initialized) {
      if (!options || !options.deferRender) this.render();
      return;
    }
    this.initialized = true;
    this.loadTodaySessions();
    this.loadDurations();
    this.loadMusicPreferences();
    this.loadSavedTarget();
    this.bindEvents();
    if (!options || !options.deferRender) {
      this.render();
    }
  },

  loadSavedTarget() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(this.TARGET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.type && parsed.id) {
          this.focusTarget = { type: parsed.type, id: parsed.id };
          this.linkedTaskId = parsed.type === 'task' ? parsed.id : null;
        }
      }
    } catch (_) {}
  },

  setTarget(type, id) {
    if (!type || !id) {
      this.focusTarget = null;
      this.linkedTaskId = null;
      try {
        if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
          localStorage.removeItem(this.TARGET_KEY);
        }
      } catch (_) {}
      return;
    }
    this.focusTarget = { type, id };
    this.linkedTaskId = type === 'task' ? id : null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.TARGET_KEY, JSON.stringify(this.focusTarget));
      }
    } catch (_) {}
  },

  startWithTarget(type, id, autoStart = true) {
    this.init({ deferRender: true });
    this.setTarget(type, id);
    if (!this.isWorkSession()) {
      this.selectMode('focus');
    }
    this.render();
    if (autoStart && !this.isRunning) {
      this.start();
    }
  },

  loadMusicPreferences() {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedAuto = localStorage.getItem('antigravite_focus_auto_music');
        if (savedAuto !== null) this.autoMusic = (savedAuto === 'true');

        const savedShuffle = localStorage.getItem('antigravite_focus_shuffle_music');
        if (savedShuffle !== null) this.shuffleMusic = (savedShuffle === 'true');

        const savedSpecific = localStorage.getItem('antigravite_focus_specific_playlist_enabled');
        if (savedSpecific !== null) this.specificPlaylistEnabled = (savedSpecific === 'true');

        const savedPl = localStorage.getItem('antigravite_focus_playlist_id');
        if (savedPl) this.selectedPlaylistId = savedPl;
      }
    } catch (_) {}
  },

  loadDurations() {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedWork = localStorage.getItem('antigravite_focus_work_minutes');
        if (savedWork !== null) {
          const w = parseInt(savedWork, 10);
          if (!isNaN(w) && w >= 0 && w <= 90) this.workMinutes = w;
        }
        const savedBreak = localStorage.getItem('antigravite_focus_break_minutes');
        if (savedBreak !== null) {
          const b = parseInt(savedBreak, 10);
          if (!isNaN(b) && b >= 0 && b <= 60) this.breakMinutes = b;
        }
      }
    } catch (_) {}
    this.MODES.focus.duration = this.workMinutes * 60;
    this.MODES.focus.name = `Focus (${this.workMinutes}m)`;
    this.MODES.shortBreak.duration = this.breakMinutes * 60;
    this.MODES.shortBreak.name = `Pause (${this.breakMinutes}m)`;
    this.totalSeconds = this.isWorkSession() ? (this.workMinutes * 60) : (this.breakMinutes * 60);
    this.remainingSeconds = this.totalSeconds;
  },

  _getLocalTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  loadTodaySessions() {
    try {
      const today = this._getLocalTodayStr();
      const history = this._loadHistoryMap();
      const todayHist = history[today];
      const raw = localStorage.getItem('antigravite_focus_daily');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.date === today) {
          const parsedCount = Number(parsed.count);
          const parsedCycle = Number(parsed.cycle);
          const parsedMin = Number(parsed.minutes);
          this.sessionsToday = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0;
          this.cycleCount = Number.isFinite(parsedCycle) && parsedCycle >= 0 ? parsedCycle : 0;
          this.minutesToday = Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : (todayHist ? (todayHist.minutes || 0) : 0);
          return;
        }
      }
      // Nouveau jour
      this.sessionsToday = todayHist ? (todayHist.count || 0) : 0;
      this.minutesToday = todayHist ? (todayHist.minutes || 0) : 0;
      this.cycleCount = 0;
      this.saveTodaySessions();
    } catch (_) {
      this.sessionsToday = 0;
      this.minutesToday = 0;
      this.cycleCount = 0;
    }
  },

  _loadHistoryMap() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(this.HISTORY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (_) {
      return {};
    }
  },

  _recordSessionToHistory(minutesSpent) {
    try {
      if (typeof localStorage === 'undefined') return;
      const today = this._getLocalTodayStr();
      const history = this._loadHistoryMap();
      if (!history[today]) history[today] = { count: 0, minutes: 0, byTarget: {} };
      history[today].count = Math.max(history[today].count + 1, this.sessionsToday);
      history[today].minutes = (history[today].minutes || 0) + minutesSpent;

      const targetKey = this.focusTarget
        ? `${this.focusTarget.type}:${this.focusTarget.id}`
        : (this.linkedTaskId ? `task:${this.linkedTaskId}` : null);
      if (targetKey) {
        if (!history[today].byTarget) history[today].byTarget = {};
        const prev = history[today].byTarget[targetKey] || { count: 0, minutes: 0 };
        history[today].byTarget[targetKey] = {
          count: prev.count + 1,
          minutes: prev.minutes + minutesSpent
        };
      }

      // Conserver jusqu'à 180 jours glissants
      const keys = Object.keys(history).sort();
      if (keys.length > 180) {
        keys.slice(0, keys.length - 180).forEach(k => delete history[k]);
      }
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (_) {}
  },

  getHistoryStats(startIso, endIso) {
    const history = this._loadHistoryMap();
    let count = 0;
    let minutes = 0;
    Object.keys(history).forEach(dateKey => {
      if ((!startIso || dateKey >= startIso) && (!endIso || dateKey <= endIso)) {
        const entry = history[dateKey];
        if (entry) {
          count += Number(entry.count) || 0;
          minutes += Number(entry.minutes) || 0;
        }
      }
    });
    // Compléter avec le compteur quotidien courant si non déjà inclus
    const today = this._getLocalTodayStr();
    if ((!startIso || today >= startIso) && (!endIso || today <= endIso) && !history[today]) {
      try {
        const rawDaily = typeof localStorage !== 'undefined' ? localStorage.getItem('antigravite_focus_daily') : null;
        if (rawDaily) {
          const parsed = JSON.parse(rawDaily);
          if (parsed && parsed.date === today) {
            count += Number(parsed.count) || 0;
            minutes += Number(parsed.minutes) || 0;
          }
        }
      } catch (_) {}
    }
    return { count, minutes };
  },

  saveTodaySessions() {
    try {
      const today = this._getLocalTodayStr();
      localStorage.setItem('antigravite_focus_daily', JSON.stringify({
        date: today,
        count: this.sessionsToday,
        minutes: this.minutesToday || 0,
        cycle: this.cycleCount
      }));
    } catch (_) {}
  },

  bindEvents() {
    if (!this._visibilityBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isRunning) {
          this.tick();
        }
      });
    }

    // Bouton Démarrer / Pause
    const btnToggle = document.getElementById('btn-focus-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => this.toggle());
    }

    // Bouton Réinitialiser
    const btnReset = document.getElementById('btn-focus-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.reset());
    }

    // Bouton Passer (Skip)
    const btnSkip = document.getElementById('btn-focus-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => this.skip());
    }

    // Glissière (tiret) Temps de Focus (0 à 90m, pas de 5)
    const sliderWork = document.getElementById('focus-slider-work');
    if (sliderWork) {
      sliderWork.value = this.workMinutes;
      sliderWork.addEventListener('input', (e) => {
        this.setWorkMinutes(e.target.value);
      });
      sliderWork.addEventListener('change', (e) => {
        this.setWorkMinutes(e.target.value);
      });
      sliderWork.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        this.setWorkMinutes(this.workMinutes + delta);
      }, { passive: false });
    }

    // Glissière (tiret) Temps de Pause (0 à 60m, pas de 5)
    const sliderBreak = document.getElementById('focus-slider-break');
    if (sliderBreak) {
      sliderBreak.value = this.breakMinutes;
      sliderBreak.addEventListener('input', (e) => {
        this.setBreakMinutes(e.target.value);
      });
      sliderBreak.addEventListener('change', (e) => {
        this.setBreakMinutes(e.target.value);
      });
      sliderBreak.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        this.setBreakMinutes(this.breakMinutes + delta);
      }, { passive: false });
    }

    // Boutons de bascule Focus / Pause
    const btnModeWork = document.getElementById('focus-btn-mode-work');
    if (btnModeWork) {
      btnModeWork.addEventListener('click', () => {
        this.selectMode('focus');
      });
    }

    const btnModeBreak = document.getElementById('focus-btn-mode-break');
    if (btnModeBreak) {
      btnModeBreak.addEventListener('click', () => {
        this.selectMode('shortBreak');
      });
    }

    // Puces de modes (rétrocompatibilité)
    const modeChips = document.querySelectorAll('.focus-mode-chip');
    modeChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (mode && this.MODES[mode]) {
          this.setMode(mode);
        }
      });
    });

    // Sélecteur de cible liée (tâche, projet, créneau ou note)
    const taskSelect = document.getElementById('focus-task-select');
    if (taskSelect) {
      taskSelect.addEventListener('change', (e) => {
        const val = e.target.value || '';
        if (!val) {
          this.setTarget(null, null);
        } else if (val.startsWith('proj::')) {
          this.setTarget('project', val.slice(6));
        } else if (val.startsWith('evt::')) {
          this.setTarget('event', val.slice(5));
        } else if (val.startsWith('note::')) {
          this.setTarget('note', val.slice(6));
        } else {
          this.setTarget('task', val);
        }
        this._updateOpenTargetButton();
      });
    }

    const openTargetBtn = document.getElementById('focus-target-open-btn');
    if (openTargetBtn) {
      openTargetBtn.addEventListener('click', () => {
        const target = this.focusTarget || (this.linkedTaskId ? { type: 'task', id: this.linkedTaskId } : null);
        if (!target || typeof window === 'undefined' || !window.App) return;
        if (target.type === 'task' && window.TasksManager) {
          window.App.navigate('tasks');
          window.TasksManager.openTaskModal(target.id);
        } else if (target.type === 'project' && window.ProjectsManager) {
          window.App.navigate('projects');
          window.ProjectsManager.openProjectDetailModal(target.id);
        } else if (target.type === 'event' && window.App.openEventFromDashboard) {
          window.App.openEventFromDashboard(target.id);
        } else if (target.type === 'note' && window.NotesManager) {
          window.App.navigate('notes');
          window.NotesManager.selectNote(target.id);
        }
      });
    }

    // Case à cocher : Musique d'ambiance automatique
    const chkMusic = document.getElementById('focus-auto-music');
    const suboptionsContainer = document.getElementById('focus-music-suboptions');
    if (chkMusic) {
      chkMusic.checked = this.autoMusic;
      if (suboptionsContainer) {
        suboptionsContainer.style.display = this.autoMusic ? 'flex' : 'none';
      }
      chkMusic.addEventListener('change', (e) => {
        this.autoMusic = e.target.checked;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('antigravite_focus_auto_music', String(this.autoMusic));
          }
        } catch (_) {}
        if (suboptionsContainer) {
          suboptionsContainer.style.display = this.autoMusic ? 'flex' : 'none';
        }
      });
    }

    // Coche : Démarrer une lecture au hasard
    const chkShuffle = document.getElementById('focus-shuffle-music');
    if (chkShuffle) {
      chkShuffle.checked = this.shuffleMusic;
      chkShuffle.addEventListener('change', (e) => {
        this.shuffleMusic = e.target.checked;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('antigravite_focus_shuffle_music', String(this.shuffleMusic));
          }
        } catch (_) {}
      });
    }

    // Coche : Choisir une playlist précise
    const chkSpecificPl = document.getElementById('focus-specific-playlist-enable');
    const selectPlaylist = document.getElementById('focus-playlist-select');
    if (chkSpecificPl) {
      chkSpecificPl.checked = this.specificPlaylistEnabled;
      if (selectPlaylist) {
        selectPlaylist.style.display = this.specificPlaylistEnabled ? 'inline-block' : 'none';
      }
      chkSpecificPl.addEventListener('change', (e) => {
        this.specificPlaylistEnabled = e.target.checked;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('antigravite_focus_specific_playlist_enabled', String(this.specificPlaylistEnabled));
          }
        } catch (_) {}
        if (selectPlaylist) {
          selectPlaylist.style.display = this.specificPlaylistEnabled ? 'inline-block' : 'none';
        }
      });
    }

    // Sélecteur de playlist précise
    if (selectPlaylist) {
      selectPlaylist.addEventListener('change', (e) => {
        this.selectedPlaylistId = e.target.value || 'all';
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('antigravite_focus_playlist_id', this.selectedPlaylistId);
          }
        } catch (_) {}
      });
    }

    // Raccourci Espace pour démarrer/mettre en pause le chrono si l'écran Focus est actif
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && typeof window !== 'undefined' && window.App && window.App.currentScreen === 'focus') {
        if (document.querySelector('.modal-overlay.active')) return;
        const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (['input', 'textarea', 'select', 'button', 'a'].includes(tag)) return;
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, a, [role="button"]')) return;
        if (e.target && e.target.isContentEditable) return;
        e.preventDefault();
        this.toggle();
      }
    });
  },

  setWorkMinutes(mins) {
    mins = Math.max(0, Math.min(90, parseInt(mins, 10) || 0));
    mins = Math.round(mins / 5) * 5;
    this.workMinutes = mins;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravite_focus_work_minutes', String(mins));
      }
    } catch (_) {}

    this.MODES.focus.duration = mins * 60;
    this.MODES.focus.name = `Focus (${mins}m)`;

    const badge = document.getElementById('focus-work-val-badge');
    if (badge) badge.textContent = `${mins} min`;

    const slider = document.getElementById('focus-slider-work');
    if (slider && parseInt(slider.value, 10) !== mins) slider.value = mins;

    if (this.isWorkSession() && !this.isRunning) {
      this.totalSeconds = mins * 60;
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
    }
  },

  setBreakMinutes(mins) {
    mins = Math.max(0, Math.min(60, parseInt(mins, 10) || 0));
    mins = Math.round(mins / 5) * 5;
    this.breakMinutes = mins;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravite_focus_break_minutes', String(mins));
      }
    } catch (_) {}

    this.MODES.shortBreak.duration = mins * 60;
    this.MODES.shortBreak.name = `Pause (${mins}m)`;

    const badge = document.getElementById('focus-break-val-badge');
    if (badge) badge.textContent = `${mins} min`;

    const slider = document.getElementById('focus-slider-break');
    if (slider && parseInt(slider.value, 10) !== mins) slider.value = mins;

    if (!this.isWorkSession() && !this.isRunning) {
      this.totalSeconds = mins * 60;
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
    }
  },

  selectMode(mode) {
    this.pause();
    this.currentMode = mode;
    if (this.isWorkSession()) {
      this.totalSeconds = this.workMinutes * 60;
    } else {
      this.totalSeconds = this.breakMinutes * 60;
    }
    this.remainingSeconds = this.totalSeconds;
    this.render();
  },

  setMode(mode, customMinutes = null) {
    if (!this.MODES[mode]) return;
    this.pause();
    this.currentMode = mode;

    if (mode === 'focus') {
      if (customMinutes !== null) this.setWorkMinutes(customMinutes);
      this.totalSeconds = this.workMinutes * 60;
    } else if (mode === 'shortBreak') {
      if (customMinutes !== null) this.setBreakMinutes(customMinutes);
      this.totalSeconds = this.breakMinutes * 60;
    } else if (mode === 'longBreak') {
      this.totalSeconds = customMinutes !== null ? Math.max(0, customMinutes * 60) : this.MODES.longBreak.duration;
    } else if (mode === 'custom' && customMinutes) {
      this.totalSeconds = Math.max(0, customMinutes * 60);
    } else {
      this.totalSeconds = this.MODES[mode].duration;
    }
    this.remainingSeconds = this.totalSeconds;
    this.render();
  },

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    if (this.isRunning) return;
    if (this.totalSeconds <= 0 || this.remainingSeconds <= 0) {
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Choisissez une durée supérieure à 0 minute pour démarrer.", "warning");
      }
      return;
    }
    this.isRunning = true;

    // Musique automatique lors du démarrage d'une session de travail
    // 1. Lancement / reprise musique automatique selon le profil choisi
    if (this.autoMusic && this.isWorkSession() && typeof MusicManager !== 'undefined') {
      const playlistChanged = !this._lastMusicPlaylistSig || this._lastMusicPlaylistSig !== (this.specificPlaylistEnabled ? this.selectedPlaylistId : 'all');
      this._lastMusicPlaylistSig = this.specificPlaylistEnabled ? this.selectedPlaylistId : 'all';

      // Si déjà en pause au milieu d'une piste (sans changement de playlist), reprendre au même endroit
      const canResumeMidTrack = !playlistChanged && MusicManager.audio && MusicManager.currentIndex >= 0 && MusicManager.audio.currentTime > 0 && !MusicManager.audio.ended;
      if (canResumeMidTrack) {
        if (!MusicManager.isPlaying) {
          MusicManager.play();
        }
      } else {
        if (this.specificPlaylistEnabled && this.selectedPlaylistId) {
          if (typeof MusicManager.selectPlaylist === 'function') {
            MusicManager.selectPlaylist(this.selectedPlaylistId);
          }
        }

        if (this.shuffleMusic) {
          MusicManager.isShuffle = true;
          if (typeof MusicManager.rebuildShuffleOrder === 'function') {
            MusicManager.rebuildShuffleOrder();
          }
          if (typeof MusicManager.updateShuffleUI === 'function') {
            MusicManager.updateShuffleUI();
          }

          let candidateIndices = [];
          if (this.specificPlaylistEnabled && this.selectedPlaylistId && this.selectedPlaylistId !== 'all') {
            const plId = this.selectedPlaylistId;
            if (plId.startsWith('preset:')) {
              const cat = plId.replace('preset:', '');
              MusicManager.tracks.forEach((t, i) => {
                if ((t.folder || 'Focus, Rituals & Daily Routines') === cat) candidateIndices.push(i);
              });
            } else {
              const customPl = (MusicManager.playlists || []).find(p => p.id === plId);
              if (customPl && customPl.trackIds) {
                MusicManager.tracks.forEach((t, i) => {
                  if (customPl.trackIds.includes(t.id) || customPl.trackIds.includes(t.filename)) candidateIndices.push(i);
                });
              }
            }
          }
          if (candidateIndices.length === 0) {
            candidateIndices = MusicManager.tracks.map((_, i) => i);
          }

          if (candidateIndices.length > 0) {
            const randPick = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
            MusicManager.play(randPick);
          } else {
            MusicManager.play();
          }
        } else {
          if (this.specificPlaylistEnabled && this.selectedPlaylistId && this.selectedPlaylistId !== 'all') {
            const plId = this.selectedPlaylistId;
            let firstIdx = -1;
            if (plId.startsWith('preset:')) {
              const cat = plId.replace('preset:', '');
              firstIdx = MusicManager.tracks.findIndex(t => (t.folder || 'Focus, Rituals & Daily Routines') === cat);
            } else {
              const customPl = (MusicManager.playlists || []).find(p => p.id === plId);
              if (customPl && customPl.trackIds) {
                firstIdx = MusicManager.tracks.findIndex(t => customPl.trackIds.includes(t.id) || customPl.trackIds.includes(t.filename));
              }
            }
            if (firstIdx !== -1) {
              MusicManager.play(firstIdx);
            } else if (!MusicManager.isPlaying) {
              MusicManager.play();
            }
          } else if (!MusicManager.isPlaying) {
            MusicManager.play();
          }
        }
      }
    }

    this._endTimestamp = Date.now() + (this.remainingSeconds * 1000);
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this.tick(), 500);
    this.updateControlsUI();
    this.updateDisplay();
  },

  pause() {
    if (!this.isRunning) return;
    if (this._endTimestamp) {
      this.remainingSeconds = Math.max(0, Math.ceil((this._endTimestamp - Date.now()) / 1000));
      this._endTimestamp = null;
    }
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Pause de la musique si configuré
    if (this.autoMusic && typeof MusicManager !== 'undefined' && MusicManager.isPlaying) {
      MusicManager.pause();
    }

    this.restoreDocumentTitle();
    this.updateControlsUI();
    this.updateDisplay();
  },

  reset() {
    this._endTimestamp = null;
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    this.restoreDocumentTitle();
    this.updateDisplay();
    this.updateControlsUI();
  },

  skip() {
    this._endTimestamp = null;
    this.pause();
    if (this.isWorkSession()) {
      this.cycleCount++;
      this.selectMode('shortBreak');
    } else {
      this.selectMode('focus');
    }
  },

  tick() {
    if (this._endTimestamp) {
      const rem = Math.max(0, Math.ceil((this._endTimestamp - Date.now()) / 1000));
      if (rem > 0) {
        if (rem !== this.remainingSeconds) {
          this.remainingSeconds = rem;
          this.updateDisplay();
          this.updateDocumentTitle();
        }
      } else {
        this.remainingSeconds = 0;
        this.onComplete();
      }
      return;
    }

    if (this.remainingSeconds > 0) {
      this.remainingSeconds--;
      this.updateDisplay();
      this.updateDocumentTitle();
    } else {
      this.onComplete();
    }
  },

  isWorkSession() {
    return this.MODES[this.currentMode] && this.MODES[this.currentMode].type === 'work';
  },

  onComplete() {
    this.pause();

    let appSettings = {};
    try {
      if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
        appSettings = StorageManager.getSettings() || {};
      }
    } catch (_) {}

    // 1. Synthèse sonore respectant les préférences utilisateur (repli sur zen / 0.85)
    const notifEnabled = appSettings.notificationsEnabled !== false;
    const soundType = appSettings.notificationSound || 'zen';
    const soundVol = typeof appSettings.notificationVolume === 'number' ? appSettings.notificationVolume : 0.85;
    if (notifEnabled && typeof SoundManager !== 'undefined' && typeof SoundManager.playSound === 'function') {
      SoundManager.playSound(soundType, soundVol);
    }

    const wasWork = this.isWorkSession();
    const completedTaskId = (wasWork && (this.linkedTaskId || (this.focusTarget && this.focusTarget.type === 'task' ? this.focusTarget.id : null))) || null;

    if (wasWork) {
      const minutesCompleted = Math.max(1, Math.round((this.totalSeconds || (this.workMinutes * 60)) / 60));
      this.sessionsToday++;
      this.minutesToday = (this.minutesToday || 0) + minutesCompleted;
      this.cycleCount++;
      this.saveTodaySessions();
      this._recordSessionToHistory(minutesCompleted);
    }

    // 2. Notification système (avec deep-link vers Focus)
    const userName = String(appSettings.userName || '').trim();
    const congratsPrefix = userName ? `Bravo ${userName} !` : 'Bravo !';
    const notifTitle = wasWork ? "Session Focus terminée ! 🎯" : "Pause terminée ! ☕";
    const notifBody = wasWork
      ? `${congratsPrefix} Prenez une courte pause bien méritée.`
      : "Prêt(e) à démarrer un nouveau sprint de concentration ?";

    if (notifEnabled && window.AntigraviteAPI && typeof window.AntigraviteAPI.showNotification === 'function') {
      window.AntigraviteAPI.showNotification({
        title: notifTitle,
        body: notifBody,
        action: { screen: 'focus' }
      });
    }

    if (window.App && typeof window.App.showToast === 'function') {
      if (completedTaskId && typeof TasksManager !== 'undefined' && typeof TasksManager.toggleCompleted === 'function') {
        const foundTask = TasksManager.findTaskRecursive ? TasksManager.findTaskRecursive(TasksManager.getAll(), completedTaskId) : null;
        if (foundTask && foundTask.task && !foundTask.task.completed) {
          window.App.showToast(`${notifTitle} Terminer « ${foundTask.task.title} » ?`, 'success', {
            actionLabel: '✓ Marquer fait',
            onAction: () => {
              TasksManager.toggleCompleted(completedTaskId);
              this.setTarget(null, null);
              this.render();
            }
          });
        } else {
          window.App.showToast(notifTitle + ' ' + notifBody, 'success');
        }
      } else {
        window.App.showToast(notifTitle + ' ' + notifBody, 'success');
      }
    }

    // 3. Bascule automatique vers le mode suivant
    if (wasWork) {
      this.selectMode('shortBreak');
    } else {
      this.selectMode('focus');
    }

    this.render();
  },

  formatTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  updateDocumentTitle() {
    if (typeof document === 'undefined') return;
    const modeLabel = this.isWorkSession() ? 'Focus' : 'Pause';
    document.title = `(${this.formatTime(this.remainingSeconds)}) ${modeLabel} • Antigravité`;
  },

  restoreDocumentTitle() {
    if (typeof document === 'undefined') return;
    document.title = 'Antigravité';
  },

  updateDisplay() {
    if (typeof document === 'undefined') return;
    const timeEl = document.getElementById('focus-timer-digits');
    const ringEl = document.getElementById('focus-progress-ring-circle');
    const modeLabelEl = document.getElementById('focus-current-mode-label');

    const formatted = this.formatTime(this.remainingSeconds);
    if (timeEl) timeEl.textContent = formatted;

    if (modeLabelEl) {
      const modeObj = this.MODES[this.currentMode];
      modeLabelEl.textContent = modeObj ? modeObj.name : 'Focus';
    }

    if (ringEl) {
      // SVG progress ring (rayon r=130 -> périmètre = 2 * PI * 130 = 816.8)
      const circumference = 2 * Math.PI * 130;
      const progress = this.totalSeconds > 0 ? (this.remainingSeconds / this.totalSeconds) : 0;
      const offset = circumference * (1 - progress);
      ringEl.style.strokeDashoffset = offset;
    }
  },

  updateControlsUI() {
    if (typeof document === 'undefined') return;

    // Témoin dynamique sur l'onglet Focus dans la barre latérale
    const focusNavItem = document.querySelector('.nav-item[data-screen="focus"]');
    if (focusNavItem) {
      focusNavItem.classList.toggle('focus-running', this.isRunning);
    }

    const btnToggle = document.getElementById('btn-focus-toggle');
    if (!btnToggle) return;

    if (this.isRunning) {
      btnToggle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        <span>Mettre en pause</span>
      `;
      btnToggle.classList.add('btn-focus-running');
    } else {
      btnToggle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Démarrer la session</span>
      `;
      btnToggle.classList.remove('btn-focus-running');
    }
  },

  _updateOpenTargetButton() {
    const btn = document.getElementById('focus-target-open-btn');
    if (!btn) return;
    const hasTarget = !!(this.focusTarget || this.linkedTaskId);
    btn.style.display = hasTarget ? 'inline-flex' : 'none';
  },

  populateTaskSelector() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('focus-task-select');
    if (!select) return;

    const currentVal = this.focusTarget
      ? (this.focusTarget.type === 'task'
        ? this.focusTarget.id
        : (this.focusTarget.type === 'project' ? `proj::${this.focusTarget.id}` : `${this.focusTarget.type === 'event' ? 'evt' : 'note'}::${this.focusTarget.id}`))
      : (this.linkedTaskId || '');

    const tasks = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function') ? StorageManager.getTasks() : [];
    const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function') ? StorageManager.getProjects() : [];
    const archivedProjectIds = new Set(projects.filter(p => p && p.archived).map(p => p.id));

    let html = '<option value="">(Aucune cible liée - Focus libre)</option>';

    let tasksOptions = '';
    const appendTasksRecursive = (list, prefix = '') => {
      list.forEach(t => {
        if (!t) return;
        const isArch = t.projectId && archivedProjectIds.has(t.projectId);
        if (!t.completed && !isArch) {
          const selected = t.id === currentVal ? 'selected' : '';
          tasksOptions += `<option value="${t.id}" ${selected}>${prefix}📋 ${this.escapeHtml(t.title)}</option>`;
        }
        if (t.subtasks && t.subtasks.length > 0 && !isArch) {
          appendTasksRecursive(t.subtasks, prefix + '　└ ');
        }
      });
    };
    appendTasksRecursive(tasks);
    if (tasksOptions) {
      html += `<optgroup label="Tâches actives">${tasksOptions}</optgroup>`;
    }

    const activeProjects = projects.filter(p => p && !p.archived);
    if (activeProjects.length > 0) {
      html += '<optgroup label="Projets actifs">';
      activeProjects.forEach(p => {
        const val = `proj::${p.id}`;
        html += `<option value="${val}" ${val === currentVal ? 'selected' : ''}>📁 ${this.escapeHtml(p.title)}</option>`;
      });
      html += '</optgroup>';
    }

    const events = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function') ? StorageManager.getEvents() : [];
    const todayIso = this._getLocalTodayStr();
    const todayEvents = events.filter(ev => {
      if (!ev || !ev.start) return false;
      if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.isEventOnDate === 'function') {
        return AgendaManager.isEventOnDate(ev, todayIso);
      }
      return ev.start.slice(0, 10) <= todayIso && (ev.end ? ev.end.slice(0, 10) >= todayIso : ev.start.slice(0, 10) >= todayIso);
    });
    if (todayEvents.length > 0) {
      html += '<optgroup label="Créneaux d\'aujourd\'hui">';
      todayEvents.forEach(ev => {
        const val = `evt::${ev.id}`;
        const t = !ev.isAllDay && ev.start.length >= 16 ? ev.start.slice(11, 16) + ' ' : '';
        html += `<option value="${val}" ${val === currentVal ? 'selected' : ''}>📅 ${t}${this.escapeHtml(ev.title || '(Sans titre)')}</option>`;
      });
      html += '</optgroup>';
    }

    const notes = (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function') ? StorageManager.getNotes() : [];
    const recentNotes = [...notes]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 12);
    if (recentNotes.length > 0) {
      html += '<optgroup label="Notes récentes">';
      recentNotes.forEach(n => {
        const val = `note::${n.id}`;
        html += `<option value="${val}" ${val === currentVal ? 'selected' : ''}>📝 ${this.escapeHtml(n.title || 'Sans titre')}</option>`;
      });
      html += '</optgroup>';
    }

    select.innerHTML = html;
    if (currentVal && select.value !== currentVal) {
      this.setTarget(null, null);
      select.value = '';
    }
    this._updateOpenTargetButton();
  },

  populatePlaylistSelect() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('focus-playlist-select');
    if (!select || typeof MusicManager === 'undefined') return;

    const currentVal = this.selectedPlaylistId || 'all';
    select.innerHTML = '<option value="all">📁 Toutes les musiques</option>';

    if (Array.isArray(MusicManager.CATEGORIES)) {
      const icons = {
        "Focus, Rituals & Daily Routines": "☕",
        "Seasons, Rain & Weather": "🌧️",
        "Ambient Drift & Dreamscapes": "🌌",
        "Soul, Slow Jams & Warm Rooms": "🛋️",
        "Late Night, Neon & After Hours": "🌃",
        "Funk, Soul & Retro Bounce": "🕺",
        "Jazz Lounge & Bookstore Grooves": "🎷",
        "Chillhop & Cozy Beats": "🎧",
        "Asian & Zen Lo-Fi": "🎋",
        "Hybrid, World & Cinematic": "🎬",
        "Musique personnelle": "🎵"
      };

      const grp = document.createElement('optgroup');
      grp.label = "Ambiances par genre";
      MusicManager.CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = 'preset:' + cat;
        opt.textContent = `${icons[cat] || '📁'} ${cat}`;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    }

    if (Array.isArray(MusicManager.playlists) && MusicManager.playlists.length > 0) {
      const grpPl = document.createElement('optgroup');
      grpPl.label = "Playlists personnalisées";
      MusicManager.playlists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = `⭐ ${pl.name} (${(pl.trackIds || []).length} morceaux)`;
        grpPl.appendChild(opt);
      });
      select.appendChild(grpPl);
    }

    select.value = currentVal;
    if (select.value !== currentVal) {
      select.value = 'all';
      this.selectedPlaylistId = 'all';
    }
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const tRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('tasks') : -1;
    const pRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('projects') : -1;
    const eRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('events') : -1;
    const nRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('notes') : -1;
    const plCount = (typeof MusicManager !== 'undefined' && Array.isArray(MusicManager.playlists)) ? MusicManager.playlists.length : 0;
    const targetSig = this.focusTarget ? `${this.focusTarget.type}:${this.focusTarget.id}` : (this.linkedTaskId || '');
    const sig = `${tRev}:${pRev}:${eRev}:${nRev}:${plCount}:${this.currentMode}:${this.workMinutes}:${this.breakMinutes}:${this.sessionsToday}:${this.minutesToday || 0}:${this.autoMusic}:${this.shuffleMusic}:${this.specificPlaylistEnabled}:${this.selectedPlaylistId}:${targetSig}`;
    if (tRev !== -1 && this._lastRenderedSig === sig) return;
    this.render();
  },

  render() {
    if (typeof document === 'undefined') return;
    const tRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('tasks') : -1;
    const pRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('projects') : -1;
    const eRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('events') : -1;
    const nRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('notes') : -1;
    const plCount = (typeof MusicManager !== 'undefined' && Array.isArray(MusicManager.playlists)) ? MusicManager.playlists.length : 0;
    const targetSig = this.focusTarget ? `${this.focusTarget.type}:${this.focusTarget.id}` : (this.linkedTaskId || '');
    this._lastRenderedSig = `${tRev}:${pRev}:${eRev}:${nRev}:${plCount}:${this.currentMode}:${this.workMinutes}:${this.breakMinutes}:${this.sessionsToday}:${this.minutesToday || 0}:${this.autoMusic}:${this.shuffleMusic}:${this.specificPlaylistEnabled}:${this.selectedPlaylistId}:${targetSig}`;

    // Mise à jour de l'état actif des groupes et boutons de tiret
    const isWork = this.isWorkSession();
    const groupWork = document.getElementById('focus-group-work');
    const groupBreak = document.getElementById('focus-group-break');
    const btnWork = document.getElementById('focus-btn-mode-work');
    const btnBreak = document.getElementById('focus-btn-mode-break');

    if (groupWork) groupWork.classList.toggle('active', isWork);
    if (groupBreak) groupBreak.classList.toggle('active', !isWork);
    if (btnWork) btnWork.classList.toggle('active', isWork);
    if (btnBreak) btnBreak.classList.toggle('active', !isWork);

    const sliderWork = document.getElementById('focus-slider-work');
    if (sliderWork && parseInt(sliderWork.value, 10) !== this.workMinutes) {
      sliderWork.value = this.workMinutes;
    }
    const badgeWork = document.getElementById('focus-work-val-badge');
    if (badgeWork) badgeWork.textContent = `${this.workMinutes} min`;

    const sliderBreak = document.getElementById('focus-slider-break');
    if (sliderBreak && parseInt(sliderBreak.value, 10) !== this.breakMinutes) {
      sliderBreak.value = this.breakMinutes;
    }
    const badgeBreak = document.getElementById('focus-break-val-badge');
    if (badgeBreak) badgeBreak.textContent = `${this.breakMinutes} min`;

    // Puces rétrocompatibles
    document.querySelectorAll('.focus-mode-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.mode === this.currentMode);
    });

    // Compteur de sessions & minutes dans la carte options + compatibilité si badge présent
    const sessionsBadge = document.getElementById('focus-sessions-count-badge');
    if (sessionsBadge) {
      sessionsBadge.textContent = `${this.sessionsToday} session${this.sessionsToday > 1 ? 's' : ''} aujourd'hui`;
    }
    const summaryText = document.getElementById('focus-daily-summary-text');
    const summaryMin = document.getElementById('focus-daily-minutes-text');
    if (summaryText) {
      summaryText.textContent = `🎯 ${this.sessionsToday} session${this.sessionsToday > 1 ? 's' : ''} terminée${this.sessionsToday > 1 ? 's' : ''} aujourd'hui`;
    }
    if (summaryMin) {
      summaryMin.textContent = `${this.minutesToday || 0} min cumulées`;
    }

    this.populateTaskSelector();
    this.populatePlaylistSelect();

    const chkMusic = document.getElementById('focus-auto-music');
    if (chkMusic) chkMusic.checked = this.autoMusic;

    const suboptionsContainer = document.getElementById('focus-music-suboptions');
    if (suboptionsContainer) suboptionsContainer.style.display = this.autoMusic ? 'flex' : 'none';

    const chkShuffle = document.getElementById('focus-shuffle-music');
    if (chkShuffle) chkShuffle.checked = this.shuffleMusic;

    const chkSpecificPl = document.getElementById('focus-specific-playlist-enable');
    if (chkSpecificPl) chkSpecificPl.checked = this.specificPlaylistEnabled;

    const selectPlaylist = document.getElementById('focus-playlist-select');
    if (selectPlaylist) {
      selectPlaylist.style.display = this.specificPlaylistEnabled ? 'inline-block' : 'none';
      selectPlaylist.value = this.selectedPlaylistId || 'all';
    }

    this.updateDisplay();
    this.updateControlsUI();
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.FocusManager = FocusManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FocusManager;
}
