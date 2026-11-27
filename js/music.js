/**
 * Antigravité - Module Lecteur de Musique & Ambiances Focus
 * 
 * Principes impératifs :
 * - 100% Souverain & Local : lit les musiques locales fournies dans le dossier music/.
 * - Le mini-lecteur est placé dans le volet latéral sous la liste des onglets
 *   SEULEMENT lorsqu'il y a de la musique.
 * - Bouton Stop intégré dans le lecteur et le mini-lecteur pour arrêter complètement la lecture.
 * - Design élégant avec icônes vectorielles SVG intégrées à la charte graphique Antigravité.
 */

const MusicManager = {
  tracks: [],
  customTracks: [],
  currentIndex: -1,
  isPlaying: false,
  hasStarted: false,
  isShuffle: false,
  repeatMode: 'all', // 'all' (boucle playlist), 'one' (boucle morceau), 'none' (s'arrête à la fin)
  volume: 0.8,
  isMuted: false,
  searchQuery: '',
  selectedFolder: 'all', // 'all' ou nom de dossier
  sortBy: 'folder', // 'folder' | 'default' | 'title-asc' | 'artist-asc'
  playlists: [], // [{ id, name, trackIds: [], createdAt }]
  activePlaylistId: 'all', // 'all' | 'preset:...' | 'pl-...'
  CATEGORIES: [
    "Focus, Rituals & Daily Routines",
    "Seasons, Rain & Weather",
    "Ambient Drift & Dreamscapes",
    "Soul, Slow Jams & Warm Rooms",
    "Late Night, Neon & After Hours",
    "Funk, Soul & Retro Bounce",
    "Jazz Lounge & Bookstore Grooves",
    "Chillhop & Cozy Beats",
    "Asian & Zen Lo-Fi",
    "Hybrid, World & Cinematic",
    "Musique personnelle"
  ],
  audio: null,
  initialized: false,
  shuffledIndices: [],
  shuffledPointer: 0,
  _playRequestId: 0,
  _loadedTrackKey: null,

  init(options = {}) {
    if (this.initialized) {
      if (!options || !options.deferRender) this.render();
      return this._initPromise || Promise.resolve();
    }
    this.initialized = true;
    const deferRender = !!(options && options.deferRender);

    // 1. Restaurer les préférences utilisateur
    if (typeof localStorage !== 'undefined') {
      const savedVol = localStorage.getItem('antigravite_music_volume');
      if (savedVol !== null) {
        const parsedVol = parseFloat(savedVol);
        this.volume = Number.isFinite(parsedVol) ? Math.max(0, Math.min(1, parsedVol)) : 0.8;
      }

      const savedShuffle = localStorage.getItem('antigravite_music_shuffle');
      if (savedShuffle !== null) this.isShuffle = (savedShuffle === 'true');

      const savedRepeat = localStorage.getItem('antigravite_music_repeat');
      if (savedRepeat && ['all', 'one', 'none'].includes(savedRepeat)) this.repeatMode = savedRepeat;

      const savedFolder = localStorage.getItem('antigravite_music_folder');
      if (savedFolder) this.selectedFolder = savedFolder;

      const savedSort = localStorage.getItem('antigravite_music_sort');
      if (savedSort && ['folder', 'default', 'title-asc', 'artist-asc'].includes(savedSort)) {
        this.sortBy = savedSort;
      }
    }

    // Charger les playlists personnalisées
    this.loadPlaylists();

    // 2. Initialiser l'élément Audio HTML5
    this.initAudio();

    if (!this._unloadCleanupBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._unloadCleanupBound = true;
      window.addEventListener('beforeunload', () => {
        this.revokeCustomBlobUrls();
      });
    }

    // 3. Charger les morceaux du logiciel en asynchrone (cache RAM dans main.js)
    this._initPromise = this.loadTracks().then(() => {
      if (!deferRender) {
        this.render();
      } else {
        this.updateVolumeUI();
        this.updateShuffleUI();
        this.updateRepeatUI();
        this.updateSidebarMiniPlayer();
      }
      this.bindEvents();
      return this.tracks;
    });
    return this._initPromise;
  },

  async warmUpCatalog() {
    if (this._initPromise) {
      await this._initPromise;
    } else if (!this.tracks || this.tracks.length === 0) {
      await this.loadTracks();
    }
    return this.tracks;
  },

  initAudio() {
    if (typeof Audio === 'undefined') return;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.volume = this.volume;

      this.audio.addEventListener('play', () => {
        this.isPlaying = true;
        this.hasStarted = true;
        this.updatePlayerUI();
        this.updateSidebarMiniPlayer();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this.updatePlayerUI();
        this.updateSidebarMiniPlayer();
      });

      this.audio.addEventListener('timeupdate', () => {
        this.onTimeUpdate();
      });

      this.audio.addEventListener('loadedmetadata', () => {
        this.onLoadedMetadata();
      });

      this.audio.addEventListener('ended', () => {
        this.onTrackEnded();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn("[MusicManager] Erreur lecture audio :", e);
        if (this.isPlaying) {
          this.isPlaying = false;
          this.updatePlayerUI();
          this.updateSidebarMiniPlayer();
          if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Fichier audio non accessible", "error");
          }
        }
      });
    }

    // Support des touches multimédias matérielles (Clavier / Casque)
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('stop', () => this.stop());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      } catch (_e) {}
    }
  },

  async loadTracks() {
    let baseTracks = [];
    const currentTrack = this.getCurrentTrack();

    // 1. Charger depuis le manifest local JSON
    try {
      if (typeof require !== 'undefined') {
        baseTracks = require('../data/music-tracks.json');
      } else if (typeof fetch !== 'undefined') {
        const res = await fetch('./data/music-tracks.json');
        if (res.ok) {
          baseTracks = await res.json();
        }
      }
    } catch (_e) {}

    // 2. Détection en temps réel des morceaux des dossiers music/ et musique personnelle/ via IPC Electron si disponible
    if (typeof window !== 'undefined' && window.AntigraviteAPI?.music?.listLocalTracks) {
      try {
        const liveTracks = await window.AntigraviteAPI.music.listLocalTracks();
        if (liveTracks && liveTracks.length > 0) {
          baseTracks = liveTracks;
        }
      } catch (err) {
        console.warn("[MusicManager] Erreur chargement local IPC :", err);
      }
    }

    // 3. Morceaux personnalisés importés en mémoire (fallback)
    const customList = this.customTracks || [];

    // Combiner les morceaux : uniquement les vraies musiques locales
    this.tracks = [...baseTracks, ...customList];

    // S'assurer que chaque piste a un dossier attribué
    this.tracks.forEach(t => {
      if (!t.folder) {
        t.folder = (t.type === 'custom' || t.type === 'personal') ? 'Musique personnelle' : 'Focus, Rituals & Daily Routines';
      }
    });

    this.rebuildShuffleOrder();

    if (currentTrack) {
      const foundIdx = this.tracks.findIndex(t => (t.id && t.id === currentTrack.id) || (t.filename && t.filename === currentTrack.filename));
      if (foundIdx !== -1) {
        this.currentIndex = foundIdx;
      }
    } else if (this.currentIndex === -1 && this.tracks.length > 0) {
      this.currentIndex = 0;
    }
  },

  _getTrackKey(track) {
    if (!track) return '';
    return String(track.id || track.filename || track.fileUrl || track.src || track.title || '');
  },

  getActivePlaybackIndices() {
    if (!Array.isArray(this.tracks) || this.tracks.length === 0) return [];
    const activePl = (Array.isArray(this.playlists))
      ? this.playlists.find(p => p && p.id === this.activePlaylistId)
      : null;

    if (activePl) {
      const idSet = new Set(Array.isArray(activePl.trackIds) ? activePl.trackIds : []);
      const indices = [];
      for (let i = 0; i < this.tracks.length; i++) {
        const t = this.tracks[i];
        if ((t.id && idSet.has(t.id)) || (t.filename && idSet.has(t.filename))) {
          indices.push(i);
        }
      }
      return indices;
    }

    const folderCat = (this.activePlaylistId && this.activePlaylistId.startsWith('preset:'))
      ? this.activePlaylistId.replace('preset:', '')
      : this.selectedFolder;

    if (folderCat && folderCat !== 'all') {
      const indices = [];
      for (let i = 0; i < this.tracks.length; i++) {
        const tFolder = this.tracks[i].folder || 'Focus, Rituals & Daily Routines';
        if (tFolder === folderCat) indices.push(i);
      }
      return indices;
    }

    return this.tracks.map((_, i) => i);
  },

  rebuildShuffleOrder() {
    const indices = this.getActivePlaybackIndices().slice();
    // Algorithme de mélange Fisher-Yates
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    if (this.currentIndex >= 0) {
      const curPos = indices.indexOf(this.currentIndex);
      if (curPos > 0) {
        [indices[0], indices[curPos]] = [indices[curPos], indices[0]];
      }
    }
    this.shuffledIndices = indices;
    this.shuffledPointer = 0;
  },

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.tracks.length) {
      return this.tracks[this.currentIndex];
    }
    return null;
  },

  _fadeTimer: null,

  _clearFadeTimer() {
    if (this._fadeTimer) {
      clearInterval(this._fadeTimer);
      this._fadeTimer = null;
    }
  },

  _isTestOrHeadless() {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return true;
    if (typeof window === 'undefined') return true;
    if (!window.document || typeof window.document.querySelector !== 'function') return true;
    return false;
  },

  _fadeAudioTo(targetVolume, durationMs = 450, startFromZero = false, onComplete = null) {
    this._clearFadeTimer();
    if (!this.audio) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const safeTarget = Math.max(0, Math.min(1, Number(targetVolume)));
    if (this._isTestOrHeadless() || durationMs <= 20) {
      this.audio.volume = safeTarget;
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    if (settings.disableAnimations === true || settings.performanceMode === 'potato') {
      this.audio.volume = safeTarget;
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const startVol = startFromZero ? 0 : (typeof this.audio.volume === 'number' ? this.audio.volume : safeTarget);
    if (startFromZero) {
      this.audio.volume = 0;
    }
    const delta = safeTarget - startVol;
    if (Math.abs(delta) < 0.01) {
      this.audio.volume = safeTarget;
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const intervalMs = 25;
    const steps = Math.max(1, Math.floor(durationMs / intervalMs));
    let step = 0;

    this._fadeTimer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / steps);
      // Interpolation sinusoidale douce (ease-in-out)
      const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      const cur = Math.max(0, Math.min(1, startVol + delta * ease));
      if (this.audio) {
        this.audio.volume = cur;
      }
      if (progress >= 1) {
        this._clearFadeTimer();
        if (this.audio) this.audio.volume = safeTarget;
        if (typeof onComplete === 'function') onComplete();
      }
    }, intervalMs);
  },

  play(index = null) {
    if (index !== null && index >= 0 && index < this.tracks.length) {
      if (this.currentIndex !== index) {
        this.currentIndex = index;
        const track = this.tracks[this.currentIndex];
        this.loadTrackSource(track);
      }
    } else if (this.currentIndex === -1 && this.tracks.length > 0) {
      const activeIndices = this.getActivePlaybackIndices();
      this.currentIndex = activeIndices.length > 0 ? activeIndices[0] : 0;
      this.loadTrackSource(this.tracks[this.currentIndex]);
    }

    const current = this.getCurrentTrack();
    if (!current) return;

    const reqId = ++this._playRequestId;
    this.hasStarted = true;
    this.isPlaying = true;
    this.updatePlayerUI();
    this.updateSidebarMiniPlayer();

    if (this.audio) {
      const expectedKey = this._getTrackKey(current);
      if (!this.audio.src || this._loadedTrackKey !== expectedKey) {
        this.loadTrackSource(current);
      }
      try {
        const targetVol = this.isMuted ? 0 : (this.volume !== undefined ? this.volume : 0.7);
        // Fondu sonore doux à l'entrée
        this._fadeAudioTo(targetVol, 450, true);
        const playPromise = this.audio.play();
        if (playPromise !== undefined && typeof playPromise.then === 'function') {
          playPromise.catch(err => {
            if (reqId !== this._playRequestId) return;
            console.warn("[MusicManager] Lecture différée ou bloquée :", err);
            this._clearFadeTimer();
            this.isPlaying = false;
            this.updatePlayerUI();
            this.updateSidebarMiniPlayer();
          });
        }
      } catch (err) {
        console.warn("[MusicManager] Erreur appel audio.play() :", err);
      }
    }

    this.updateMediaSessionMetadata(current);
  },

  pause(instant = false) {
    this._playRequestId++;
    this.isPlaying = false;
    this.updatePlayerUI();
    this.updateSidebarMiniPlayer();

    if (this.audio) {
      const normalVol = this.isMuted ? 0 : (this.volume !== undefined ? this.volume : 0.7);
      if (instant || this._isTestOrHeadless() || this.audio.paused || this.isMuted || this.audio.volume <= 0.05) {
        this._clearFadeTimer();
        this.audio.pause();
        this.audio.volume = normalVol;
      } else {
        // Fondu sonore doux à la pause
        this._fadeAudioTo(0, 380, false, () => {
          if (this.audio && !this.isPlaying) {
            this.audio.pause();
            this.audio.volume = normalVol;
          }
        });
      }
    }
  },

  stop(instant = false) {
    this._playRequestId++;
    this.isPlaying = false;
    this.hasStarted = false;

    if (this.audio) {
      const normalVol = this.isMuted ? 0 : (this.volume !== undefined ? this.volume : 0.7);
      if (instant || this._isTestOrHeadless() || this.audio.paused || this.isMuted || this.audio.volume <= 0.05) {
        this._clearFadeTimer();
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = normalVol;
        this.onTimeUpdate();
      } else {
        // Fondu sonore doux à l'arrêt
        this._fadeAudioTo(0, 300, false, () => {
          if (this.audio && !this.isPlaying) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio.volume = normalVol;
            this.onTimeUpdate();
          }
        });
      }
    } else {
      this.onTimeUpdate();
    }

    this.updatePlayerUI();
    this.updateSidebarMiniPlayer();

    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Lecture arrêtée", "info");
    }
  },

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  next(userInitiated = true) {
    const activeIndices = this.getActivePlaybackIndices();
    if (activeIndices.length === 0) return;

    let nextIdx = this.currentIndex;

    if (this.isShuffle) {
      const activeSet = new Set(activeIndices);
      const validShuffle = Array.isArray(this.shuffledIndices) &&
        this.shuffledIndices.length === activeIndices.length &&
        this.shuffledIndices.every(i => activeSet.has(i));
      if (!validShuffle) {
        this.rebuildShuffleOrder();
      }
      this.shuffledPointer++;
      if (this.shuffledPointer >= this.shuffledIndices.length) {
        if (this.repeatMode !== 'all' && !userInitiated) {
          this.stop();
          return;
        }
        this.rebuildShuffleOrder();
        if (this.shuffledIndices.length > 1 && this.shuffledIndices[0] === this.currentIndex) {
          this.shuffledPointer = 1;
        }
      }
      nextIdx = this.shuffledIndices[this.shuffledPointer];
    } else {
      const pos = activeIndices.indexOf(this.currentIndex);
      if (pos === -1) {
        nextIdx = activeIndices[0];
      } else if (pos + 1 < activeIndices.length) {
        nextIdx = activeIndices[pos + 1];
      } else if (this.repeatMode === 'all' || userInitiated) {
        nextIdx = activeIndices[0];
      } else {
        // Mode 'none' et fin de playlist atteinte
        this.stop();
        return;
      }
    }

    this.play(nextIdx);
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  prev() {
    const activeIndices = this.getActivePlaybackIndices();
    if (activeIndices.length === 0) return;

    // Si plus de 3 secondes déjà écoutées, recommencer au début
    if (this.audio && this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    const pos = activeIndices.indexOf(this.currentIndex);
    const prevIdx = (pos <= 0) ? activeIndices[activeIndices.length - 1] : activeIndices[pos - 1];

    this.play(prevIdx);
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  loadTrackSource(track) {
    if (!track) return;
    this._loadedTrackKey = this._getTrackKey(track);
    if (this.audio) {
      this.audio.src = track.fileUrl || track.src;
      this.audio.load();
    }
  },

  onTrackEnded() {
    if (this.repeatMode === 'one') {
      if (this.audio) {
        this.audio.currentTime = 0;
        this.audio.play();
      }
    } else {
      this.next(false);
    }
  },

  onTimeUpdate() {
    if (!this.audio || typeof document === 'undefined') return;
    if (document.hidden === true) return;
    const current = this.audio.currentTime || 0;
    const total = this.audio.duration || 0;

    // Throttling adaptatif selon le profil de performance (économie / PC de merde)
    const perfMode = (typeof document.documentElement !== 'undefined' && document.documentElement && typeof document.documentElement.getAttribute === 'function')
      ? (document.documentElement.getAttribute('data-perf-mode') || 'normal')
      : 'normal';
    const minDeltaMs = perfMode === 'potato' ? 500 : (perfMode === 'economy' ? 250 : 0);
    if (minDeltaMs > 0 && current > 0 && current < total) {
      const nowTs = Date.now();
      if (this._lastTimeUpdateTs && (nowTs - this._lastTimeUpdateTs) < minDeltaMs) return;
      this._lastTimeUpdateTs = nowTs;
    }

    const pct = (total > 0) ? (current / total) * 100 : 0;
    const pctRounded = Math.round(pct * 10) / 10;
    const pctStr = `${pctRounded}%`;

    // Optimisation CPU : mise à jour des éléments de l'écran principal Musique uniquement s'il est actif
    const isMusicScreen = (typeof window !== 'undefined' && window.App && window.App.currentScreen === 'music');
    if (isMusicScreen) {
      const curSec = Math.floor(current);
      if (this._lastCurSec !== curSec || !this._cachedCurStr) {
        this._lastCurSec = curSec;
        this._cachedCurStr = this.formatTime(current);
      }
      const curLabel = document.getElementById('music-time-current');
      if (curLabel && curLabel.textContent !== this._cachedCurStr) {
        curLabel.textContent = this._cachedCurStr;
      }

      if (!isNaN(total) && total > 0) {
        const totSec = Math.floor(total);
        if (this._lastTotSec !== totSec || !this._cachedTotStr) {
          this._lastTotSec = totSec;
          this._cachedTotStr = this.formatTime(total);
        }
        const totLabel = document.getElementById('music-time-total');
        if (totLabel && totLabel.textContent !== this._cachedTotStr) {
          totLabel.textContent = this._cachedTotStr;
        }
      }

      const fill = document.getElementById('music-progress-fill');
      const slider = document.getElementById('music-progress-slider');
      const isDragging = Boolean(slider && slider._dragging);
      if (fill && !isDragging && fill.style.width !== pctStr) fill.style.width = pctStr;
      if (slider && !isDragging && this._lastSliderPct !== pctRounded) {
        this._lastSliderPct = pctRounded;
        slider.value = pct;
      }
    }

    // Mini-barre de progression dans le volet latéral (uniquement si le volet est visible et déplié)
    const isSidebarCollapsed = Boolean(
      document.body &&
      document.body.classList &&
      typeof document.body.classList.contains === 'function' &&
      document.body.classList.contains('sidebar-collapsed')
    );
    if (!isSidebarCollapsed) {
      const miniWidget = document.getElementById('sidebar-music-widget');
      if (!miniWidget || miniWidget.style.display !== 'none') {
        const sidebarFill = document.getElementById('sidebar-music-progress-fill');
        if (sidebarFill && sidebarFill.style.width !== pctStr) {
          sidebarFill.style.width = pctStr;
        }
      }
    }
  },

  onLoadedMetadata() {
    if (!this.audio || typeof document === 'undefined') return;
    const total = this.audio.duration;
    const totLabel = document.getElementById('music-time-total');
    if (totLabel && !isNaN(total) && total > 0) {
      totLabel.textContent = this.formatTime(total);
    }
    const current = this.getCurrentTrack();
    if (current && !current.durationFormatted && !isNaN(total)) {
      current.durationFormatted = this.formatTime(total);
      this.renderPlaylist();
    }
  },

  seek(percent) {
    if (this.audio && !isNaN(this.audio.duration)) {
      const targetTime = (percent / 100) * this.audio.duration;
      this.audio.currentTime = targetTime;
    }
  },

  setVolume(val) {
    this._clearFadeTimer();
    this.volume = Math.max(0, Math.min(1, Number(val)));
    if (this.audio) {
      this.audio.volume = this.isMuted ? 0 : this.volume;
    }
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('antigravite_music_volume', this.volume); } catch (_) {}
    }
    this.updateVolumeUI();
  },

  toggleMute() {
    this._clearFadeTimer();
    this.isMuted = !this.isMuted;
    if (this.audio) {
      this.audio.volume = this.isMuted ? 0 : this.volume;
    }
    this.updateVolumeUI();
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    if (this.isShuffle) {
      this.rebuildShuffleOrder();
    }
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('antigravite_music_shuffle', this.isShuffle); } catch (_) {}
    }
    this.updateShuffleUI();
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(this.isShuffle ? "Mode aléatoire activé" : "Mode séquentiel activé", "info");
    }
  },

  cycleRepeat() {
    const modes = ['all', 'one', 'none'];
    const nextIdx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
    this.repeatMode = modes[nextIdx];

    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('antigravite_music_repeat', this.repeatMode); } catch (_) {}
    }
    this.updateRepeatUI();
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      const labels = {
        all: "Répétition : Toute la playlist en boucle 🔁",
        one: "Répétition : Morceau unique en boucle 🔂",
        none: "Répétition désactivée ➡️"
      };
      window.App.showToast(labels[this.repeatMode], "info");
    }
  },

  // -------------------------------------------------------------------------
  // Gestion & Importation Sécurisée de Musique Personnelle (v1.2.0)
  // -------------------------------------------------------------------------

  /**
   * Ouvre la modale d'avertissement avant d'importer de la musique personnelle.
   * L'utilisateur est informé que les originaux sont préservés et qu'une copie locale
   * persistante est créée dans le dossier « musique personnelle ».
   * @param {FileList|Array|null} stagedFiles - Fichiers optionnels déposés par drag & drop
   */
  promptAddPersonalMusic(stagedFiles = null) {
    this.openImportWarningModal(stagedFiles);
  },

  openImportWarningModal(stagedFiles = null) {
    if (typeof document === 'undefined') return;
    this._stagedImportFiles = stagedFiles;
    const modal = document.getElementById('music-import-warning-modal');
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeImportWarningModal() {
    if (typeof document === 'undefined') return;
    this._stagedImportFiles = null;
    const modal = document.getElementById('music-import-warning-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  /**
   * Action déclenchée par le bouton « Continuer » du panneau d'avertissement.
   * Procède à la sélection (ou copie des fichiers déposés) vers « musique personnelle ».
   */
  async proceedWithMusicImport() {
    const staged = this._stagedImportFiles;
    this.closeImportWarningModal();

    // Cas 1 : Fichiers glissés-déposés sur la zone de playlist (Dropzone)
    if (staged && staged.length > 0) {
      const filePaths = [];
      for (let i = 0; i < staged.length; i++) {
        const f = staged[i];
        if (f && typeof f.path === 'string' && f.path) {
          filePaths.push(f.path);
        }
      }

      if (filePaths.length > 0 && typeof window !== 'undefined' && window.AntigraviteAPI?.music?.copyMusicFiles) {
        try {
          const res = await window.AntigraviteAPI.music.copyMusicFiles(filePaths);
          await this.handleImportResult(res);
        } catch (err) {
          console.warn("[MusicManager] Erreur lors de la copie des fichiers déposés :", err);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Erreur lors de la copie des fichiers musicaux.", "error");
          }
        }
        return;
      }

      // Fallback mémoire / navigateur si pas d'accès direct au chemin de fichier (mock/web)
      this.addCustomTracks(staged);
      return;
    }

    // Cas 2 : Clic « Ajouter des morceaux » -> Sélecteur de fichiers natif Electron
    if (typeof window !== 'undefined' && window.AntigraviteAPI?.music?.selectAndCopyMusic) {
      try {
        const res = await window.AntigraviteAPI.music.selectAndCopyMusic();
        if (res && res.canceled) {
          return;
        }
        await this.handleImportResult(res);
      } catch (err) {
        console.warn("[MusicManager] Erreur sélection de fichiers audio :", err);
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Erreur lors de l'importation de musique.", "error");
        }
      }
      return;
    }

    // Fallback environnement web / test sans API Electron
    const fileInput = document.getElementById('music-file-input');
    if (fileInput) {
      fileInput.click();
    }
  },

  /**
   * Traite le résultat de la copie dans « musique personnelle ».
   * Affiche des messages clairs (succès, doublons ignorés, erreurs) et actualise la bibliothèque
   * SANS JAMAIS lancer la lecture automatique.
   */
  async handleImportResult(res) {
    if (!res) return;

    const copiedCount = (res.copied || []).length;
    const dupsCount = (res.duplicates || []).length;
    const errorsCount = (res.errors || []).length;

    if (copiedCount > 0) {
      let msg = `${copiedCount} morceau(x) copié(s) dans « musique personnelle » !`;
      if (dupsCount > 0) {
        msg += ` (${dupsCount} doublon(s) déjà présent(s) ignoré(s))`;
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(msg, "success");
      }
    } else if (dupsCount > 0 && errorsCount === 0) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Ce(s) morceau(x) est/sont déjà présent(s) dans votre musique personnelle.", "info");
      }
    }

    if (errorsCount > 0) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`${errorsCount} fichier(s) n'ont pas pu être copiés.`, "error");
      }
    }

    // Actualiser la bibliothèque et afficher la catégorie « Musique personnelle »
    await this.loadTracks();
    this.setFolder('Musique personnelle');
    this.render();
  },

  // Import de musiques personnelles en mémoire (fallback navigateur / test unitaire)
  addCustomTracks(fileList) {
    if (!fileList || fileList.length === 0) return;

    if (!this.customTracks) this.customTracks = [];
    let addedCount = 0;

    Array.from(fileList).forEach(file => {
      const ext = (file.name.split('.').pop() || 'MP3').toUpperCase();
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const parts = baseName.split(' - ');
      let artist = 'Mes morceaux';
      let title = baseName;
      if (parts.length >= 2) {
        artist = parts[0].replace(/^\d+[\s._-]*/, '').trim() || 'Mes morceaux';
        title = parts.slice(1).join(' - ').trim();
      }

      let blobUrl = '';
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          blobUrl = URL.createObjectURL(file);
          if (blobUrl && blobUrl.startsWith('blob:')) {
            if (!this._createdBlobUrls) this._createdBlobUrls = new Set();
            this._createdBlobUrls.add(blobUrl);
          }
        }
      } catch (_e) {
        blobUrl = 'file://local/' + encodeURIComponent(file.name || 'track.mp3');
      }
      if (!blobUrl) blobUrl = 'file://local/' + encodeURIComponent(file.name || 'track.mp3');

      const newTrack = {
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        filename: file.name,
        title: title || baseName,
        artist: artist,
        src: blobUrl,
        fileUrl: blobUrl,
        ext: ext,
        type: 'custom',
        folder: 'Musique personnelle',
        durationFormatted: '--:--'
      };

      this.customTracks.push(newTrack);
      this.tracks.unshift(newTrack);
      addedCount++;
    });

    this.rebuildShuffleOrder();
    this.setFolder('Musique personnelle');
    this.render();

    if (addedCount > 0) {
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`${addedCount} morceau(x) ajouté(s) à la liste !`, "success");
      }
      // Règle absolue v1.2.0 : L'importation ne doit JAMAIS déclencher automatiquement la lecture
    }
  },

  revokeCustomBlobUrls() {
    if (!this._createdBlobUrls || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    this._createdBlobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    });
    this._createdBlobUrls.clear();
  },

  async openMusicFolder() {
    // Si l'utilisateur consulte la musique personnelle, ouvrir le dossier musique personnelle persistant
    if (this.selectedFolder === 'Musique personnelle' && typeof window !== 'undefined' && window.AntigraviteAPI?.music?.openPersonalMusicFolder) {
      try {
        await window.AntigraviteAPI.music.openPersonalMusicFolder();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Dossier « musique personnelle » ouvert dans l'explorateur", "info");
        }
        return;
      } catch (e) {
        console.warn("Échec ouverture dossier musique personnelle:", e);
      }
    }

    // Sinon ouvrir le dossier music/ standard de l'application
    if (typeof window !== 'undefined' && window.AntigraviteAPI?.music?.openMusicFolder) {
      try {
        await window.AntigraviteAPI.music.openMusicFolder();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast("Dossier music/ ouvert dans l'explorateur", "info");
        }
      } catch (e) {
        console.warn("Échec ouverture dossier:", e);
      }
    } else {
      if (typeof window !== 'undefined' && window.App && typeof window.App.alert === 'function') {
        window.App.alert({
          title: "Emplacement du dossier musique",
          message: "Déposez vos musiques dans le dossier :\nAntigravité/music/\n\nFormats pris en charge : MP3, FLAC, WAV, M4A, OGG, AAC.",
          icon: "📁"
        });
      }
    }
  },

  async refresh() {
    await this.loadTracks();
    this.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Liste des morceaux actualisée", "info");
    }
  },

  updateMediaSessionMetadata(track) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && track) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist || 'Antigravité Musique',
          album: 'Productivité Locale',
          artwork: [
            { src: './assets/icon-256.png', sizes: '256x256', type: 'image/png' }
          ]
        });
      } catch (_e) {}
    }
  },

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // -------------------------------------------------------------------------
  // Rendu de l'Interface Utilisateur (UI)
  // -------------------------------------------------------------------------

  setFolder(folder) {
    this.selectedFolder = folder || 'all';
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('antigravite_music_folder', this.selectedFolder); } catch (_) {}
    }
    if (typeof document !== 'undefined') {
      const filterSelect = document.getElementById('music-folder-filter');
      if (filterSelect && filterSelect.value !== this.selectedFolder) {
        filterSelect.value = this.selectedFolder;
      }
    }
    this.renderPlaylist();
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  setSort(sortBy) {
    this.sortBy = sortBy || 'folder';
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('antigravite_music_sort', this.sortBy); } catch (_) {}
    }
    if (typeof document !== 'undefined') {
      const sortSelect = document.getElementById('music-sort-select');
      if (sortSelect && sortSelect.value !== this.sortBy) {
        sortSelect.value = this.sortBy;
      }
    }
    this.renderPlaylist();
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  updateFolderFilterCounts() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('music-folder-filter');
    if (!select) return;

    const counts = { all: this.tracks.length };
    this.CATEGORIES.forEach(cat => { counts[cat] = 0; });
    this.tracks.forEach(t => {
      const f = t.folder || 'Focus, Rituals & Daily Routines';
      counts[f] = (counts[f] || 0) + 1;
    });

    const icons = {
      "all": "📁",
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

    let optionsHtml = `<option value="all">${icons.all} Tous les dossiers (${counts.all || 0})</option>`;
    this.CATEGORIES.forEach(cat => {
      const cnt = counts[cat] || 0;
      const ic = icons[cat] || '📁';
      optionsHtml += `<option value="${this.escapeHtml(cat)}"${this.selectedFolder === cat ? ' selected' : ''}>${ic} ${this.escapeHtml(cat)} (${cnt})</option>`;
    });

    select.innerHTML = optionsHtml;
    select.value = this.selectedFolder;

    const sortSelect = document.getElementById('music-sort-select');
    if (sortSelect) {
      sortSelect.value = this.sortBy;
    }
  },

  // -------------------------------------------------------------------------
  // Gestion des Playlists (Préfaites & Personnalisées)
  // -------------------------------------------------------------------------

  loadPlaylists() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('antigravite_custom_playlists');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.playlists = Array.isArray(parsed)
            ? parsed.filter(pl => pl && typeof pl === 'object').map(pl => ({
                ...pl,
                trackIds: Array.isArray(pl.trackIds) ? pl.trackIds : []
              }))
            : [];
        } catch (_e) {
          this.playlists = [];
        }
      }
      const savedActive = localStorage.getItem('antigravite_active_playlist_id');
      if (savedActive) {
        this.activePlaylistId = savedActive;
      }
    }
  },

  savePlaylists() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_custom_playlists', JSON.stringify(this.playlists));
        localStorage.setItem('antigravite_active_playlist_id', this.activePlaylistId);
      } catch (_) {}
    }
    this.renderPlaylistsPanel();
  },

  getPresetPlaylists() {
    const list = [
      { id: 'all', name: 'Toutes les musiques', icon: '📁', isPreset: true, count: this.tracks.length }
    ];
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

    this.CATEGORIES.forEach(cat => {
      const count = this.tracks.filter(t => (t.folder || 'Focus, Rituals & Daily Routines') === cat).length;
      list.push({
        id: 'preset:' + cat,
        name: cat,
        folder: cat,
        icon: icons[cat] || '📁',
        isPreset: true,
        count: count
      });
    });
    return list;
  },

  selectPlaylist(playlistId) {
    this.activePlaylistId = playlistId || 'all';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('antigravite_active_playlist_id', this.activePlaylistId);
    }

    if (playlistId === 'all') {
      this.selectedFolder = 'all';
      const folderSelect = document.getElementById('music-folder-filter');
      if (folderSelect) folderSelect.value = 'all';
    } else if (playlistId.startsWith('preset:')) {
      const cat = playlistId.replace('preset:', '');
      this.selectedFolder = cat;
      const folderSelect = document.getElementById('music-folder-filter');
      if (folderSelect) folderSelect.value = cat;
    }

    this.rebuildShuffleOrder();
    this.renderPlaylist();
    this.renderPlaylistsPanel();

    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
  },

  openCreatePlaylistModal(defaultTrackKey = null) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('playlist-form-modal');
    const titleEl = document.getElementById('playlist-form-title');
    const inputName = document.getElementById('input-playlist-name');
    const inputId = document.getElementById('input-playlist-id');

    if (titleEl) titleEl.textContent = 'Nouvelle Playlist';
    if (inputName) {
      inputName.value = '';
      inputName.placeholder = 'ex : Ma Sélection Focus, Nuit Calme...';
    }
    if (inputId) inputId.value = '';
    this._stagedTrackKey = defaultTrackKey;

    if (modal) {
      modal.classList.add('active');
      setTimeout(() => inputName && inputName.focus(), 60);
    }
  },

  openRenamePlaylistModal(playlistId) {
    if (typeof document === 'undefined') return;
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    const modal = document.getElementById('playlist-form-modal');
    const titleEl = document.getElementById('playlist-form-title');
    const inputName = document.getElementById('input-playlist-name');
    const inputId = document.getElementById('input-playlist-id');

    if (titleEl) titleEl.textContent = 'Renommer la Playlist';
    if (inputName) inputName.value = pl.name;
    if (inputId) inputId.value = pl.id;

    if (modal) {
      modal.classList.add('active');
      setTimeout(() => inputName && inputName.focus(), 60);
    }
  },

  closePlaylistFormModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('playlist-form-modal');
    if (modal) modal.classList.remove('active');
  },

  submitPlaylistForm() {
    const inputName = document.getElementById('input-playlist-name');
    const inputId = document.getElementById('input-playlist-id');
    const name = (inputName?.value || '').trim();
    const id = inputId?.value || '';

    if (!name) return;

    if (id) {
      // Renommer
      const pl = this.playlists.find(p => p.id === id);
      if (pl) {
        pl.name = name;
        this.savePlaylists();
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Playlist renommée en « ${name} »`, "success");
        }
      }
    } else {
      // Créer une nouvelle playlist
      const newId = 'pl-' + Date.now();
      const trackKeys = this._stagedTrackKey ? [this._stagedTrackKey] : [];
      this._stagedTrackKey = null;

      const newPl = {
        id: newId,
        name: name,
        trackIds: trackKeys,
        createdAt: Date.now()
      };
      this.playlists.push(newPl);
      this.activePlaylistId = newId;
      this.savePlaylists();

      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Playlist « ${name} » créée avec succès !`, "success");
      }
    }

    this.closePlaylistFormModal();
    this.render();
  },

  async deletePlaylist(playlistId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    let confirmed = false;
    if (window.App && typeof window.App.confirm === 'function') {
      confirmed = await window.App.confirm({
        title: "Supprimer la playlist",
        message: `Voulez-vous vraiment supprimer la playlist « ${pl.name} » ?\n(Vos fichiers audio restent bien évidemment conservés dans votre bibliothèque locale).`,
        confirmText: "Supprimer la playlist",
        danger: true,
        icon: "🗑️"
      });
    } else {
      confirmed = typeof confirm === 'function' ? confirm(`Supprimer la playlist ${pl.name} ?`) : true;
    }

    if (!confirmed) return;

    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    if (this.activePlaylistId === playlistId) {
      this.activePlaylistId = 'all';
    }
    this.savePlaylists();
    this.render();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Playlist supprimée`, "info");
    }
  },

  promptAddTrackToPlaylist(trackKey) {
    if (!this.playlists || this.playlists.length === 0) {
      this.openCreatePlaylistModal(trackKey);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Créez votre première playlist pour y ajouter ce morceau !", "info");
      }
      return;
    }

    // Afficher la modale demandant dans quelle playlist ajouter le morceau
    this.openPlaylistSelectModal(trackKey);
  },

  openPlaylistSelectModal(trackKey) {
    if (typeof document === 'undefined') return;
    this._targetTrackKeyForPlaylist = trackKey;

    const modal = document.getElementById('playlist-select-modal');
    const titleEl = document.getElementById('playlist-select-modal-title');
    const subtitleEl = document.getElementById('playlist-select-modal-subtitle');

    const track = this.tracks.find(t => (t.id && t.id === trackKey) || (t.filename && t.filename === trackKey));

    if (titleEl) titleEl.textContent = 'Ajouter à des playlists';
    if (subtitleEl) {
      subtitleEl.textContent = track 
        ? `« ${track.title} » • ${track.artist}`
        : 'Sélectionnez une ou plusieurs playlists';
    }

    this.renderPlaylistSelectList(trackKey);

    if (modal) {
      modal.classList.add('active');
    }
  },

  renderPlaylistSelectList(trackKey) {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('playlist-select-list');
    if (!listEl) return;

    const track = this.tracks.find(t => (t.id && t.id === trackKey) || (t.filename && t.filename === trackKey));

    if (!this.playlists || this.playlists.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 0.85rem;">
          Aucune playlist personnalisée existante.
        </div>
      `;
      return;
    }

    let html = '';
    this.playlists.forEach(pl => {
      const trackIds = pl.trackIds || [];
      const isAlreadyIn = trackIds.includes(trackKey) || 
                          (track && track.id && trackIds.includes(track.id)) || 
                          (track && track.filename && trackIds.includes(track.filename));

      html += `
        <div class="playlist-select-row ${isAlreadyIn ? 'already-added' : ''}" 
             onclick="MusicManager.toggleTargetPlaylist('${pl.id}', '${trackKey}')"
             title="${isAlreadyIn ? 'Cliquer pour retirer de « ' + this.escapeHtml(pl.name) + ' »' : 'Cliquer pour ajouter à « ' + this.escapeHtml(pl.name) + ' »'}">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <span style="font-size: 1.15rem; line-height: 1;">${isAlreadyIn ? '⭐' : '📁'}</span>
            <div style="min-width: 0;">
              <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${this.escapeHtml(pl.name)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${trackIds.length} morceau${trackIds.length > 1 ? 'x' : ''}
              </div>
            </div>
          </div>
          <div style="flex-shrink: 0; margin-left: 10px;">
            ${isAlreadyIn 
              ? `<span class="badge" style="background: rgba(16, 185, 129, 0.18); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 600; font-size: 0.74rem;">✓ Ajouté</span>`
              : `<span class="btn btn-secondary btn-xs" style="pointer-events: none; opacity: 0.8;">Ajouter ➕</span>`
            }
          </div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  },

  /**
   * Ajoute ou retire le morceau d'une playlist sans fermer la modale,
   * permettant d'ajouter un morceau à plusieurs playlists successivement.
   */
  toggleTargetPlaylist(playlistId, trackKey) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    pl.trackIds = pl.trackIds || [];
    const track = this.tracks.find(t => (t.id && t.id === trackKey) || (t.filename && t.filename === trackKey));
    const effectiveKey = (track && track.id) ? track.id : trackKey;

    const idx = pl.trackIds.findIndex(k => k === trackKey || (track && track.id && k === track.id) || (track && track.filename && k === track.filename));

    if (idx === -1) {
      // Ajouter à la playlist
      pl.trackIds.push(effectiveKey);
      this.savePlaylists();
      this.render();
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Morceau ajouté à « ${pl.name} » !`, "success");
      }
    } else {
      // Retirer de la playlist
      pl.trackIds.splice(idx, 1);
      this.savePlaylists();
      this.render();
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Morceau retiré de « ${pl.name} »`, "info");
      }
    }

    // Réactualiser visuellement les badges et compteurs dans la modale sans la fermer
    this.renderPlaylistSelectList(trackKey);
  },

  selectTargetPlaylist(playlistId, trackKey) {
    return this.toggleTargetPlaylist(playlistId, trackKey);
  },

  closePlaylistSelectModal() {
    if (typeof document === 'undefined') return;
    this._targetTrackKeyForPlaylist = null;
    const modal = document.getElementById('playlist-select-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  addTrackToPlaylist(trackKey, playlistId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    pl.trackIds = pl.trackIds || [];
    if (!pl.trackIds.includes(trackKey)) {
      pl.trackIds.push(trackKey);
      this.savePlaylists();
      this.render();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Morceau ajouté à « ${pl.name} » !`, "success");
      }
    } else {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Ce morceau est déjà présent dans « ${pl.name} »`, "info");
      }
    }
  },

  removeTrackFromPlaylist(playlistId, trackKey) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    pl.trackIds = (pl.trackIds || []).filter(k => k !== trackKey);
    this.savePlaylists();
    this.render();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Morceau retiré de « ${pl.name} »`, "info");
    }
  },

  openPlaylistPickerModal(playlistId) {
    if (typeof document === 'undefined') return;
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;

    this._editingPlaylistId = playlistId;
    this._pickerSelectedTrackIds = new Set(pl.trackIds || []);

    const modal = document.getElementById('playlist-picker-modal');
    const titleEl = document.getElementById('playlist-picker-title');
    const subtitleEl = document.getElementById('playlist-picker-subtitle');
    const searchInput = document.getElementById('playlist-picker-search');

    if (titleEl) titleEl.textContent = `Morceaux de « ${pl.name} »`;
    if (subtitleEl) subtitleEl.textContent = `Cochez ou décochez les morceaux pour personnaliser cette playlist.`;
    if (searchInput) searchInput.value = '';

    this.renderPickerTracksList('');

    if (modal) modal.classList.add('active');
  },

  closePlaylistPickerModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('playlist-picker-modal');
    if (modal) modal.classList.remove('active');
    this._editingPlaylistId = null;
  },

  savePlaylistPicker() {
    if (!this._editingPlaylistId) return;
    const pl = this.playlists.find(p => p.id === this._editingPlaylistId);
    if (pl) {
      pl.trackIds = Array.from(this._pickerSelectedTrackIds);
      this.savePlaylists();
      this.render();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`${pl.trackIds.length} morceau(x) enregistrés dans « ${pl.name} »`, "success");
      }
    }
    this.closePlaylistPickerModal();
  },

  renderPickerTracksList(searchFilter = '') {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('playlist-picker-list');
    const countBadge = document.getElementById('playlist-picker-selected-count');
    if (!container) return;

    const query = (searchFilter || '').toLowerCase().trim();
    const visibleTracks = this.tracks.filter(t => {
      if (!query) return true;
      return (t.title && t.title.toLowerCase().includes(query)) ||
             (t.artist && t.artist.toLowerCase().includes(query)) ||
             (t.folder && t.folder.toLowerCase().includes(query));
    });

    if (countBadge) {
      countBadge.textContent = `${this._pickerSelectedTrackIds.size} sélectionné${this._pickerSelectedTrackIds.size > 1 ? 's' : ''}`;
    }

    let html = '';
    visibleTracks.forEach(t => {
      const trackKey = t.id || t.filename;
      const isChecked = this._pickerSelectedTrackIds.has(trackKey);
      html += `
        <div class="playlist-picker-row ${isChecked ? 'selected' : ''}" onclick="MusicManager.togglePickerTrack('${trackKey}')">
          <input type="checkbox" class="playlist-picker-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); MusicManager.togglePickerTrack('${trackKey}')">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 0.86rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(t.title)}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${this.escapeHtml(t.artist)} • <span style="color: var(--accent);">${this.escapeHtml(t.folder || 'Général')}</span></div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim); font-variant-numeric: tabular-nums;">${t.durationFormatted || '--:--'}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  togglePickerTrack(trackKey) {
    if (!this._pickerSelectedTrackIds) return;
    if (this._pickerSelectedTrackIds.has(trackKey)) {
      this._pickerSelectedTrackIds.delete(trackKey);
    } else {
      this._pickerSelectedTrackIds.add(trackKey);
    }
    const searchInput = document.getElementById('playlist-picker-search');
    this.renderPickerTracksList(searchInput?.value || '');
  },

  pickerSelectAll() {
    const searchInput = document.getElementById('playlist-picker-search');
    const query = (searchInput?.value || '').toLowerCase().trim();
    this.tracks.forEach(t => {
      if (!query || (t.title && t.title.toLowerCase().includes(query)) || (t.artist && t.artist.toLowerCase().includes(query))) {
        this._pickerSelectedTrackIds.add(t.id || t.filename);
      }
    });
    this.renderPickerTracksList(query);
  },

  pickerDeselectAll() {
    const searchInput = document.getElementById('playlist-picker-search');
    const query = (searchInput?.value || '').toLowerCase().trim();
    if (!query) {
      this._pickerSelectedTrackIds.clear();
    } else {
      this.tracks.forEach(t => {
        if ((t.title && t.title.toLowerCase().includes(query)) || (t.artist && t.artist.toLowerCase().includes(query))) {
          this._pickerSelectedTrackIds.delete(t.id || t.filename);
        }
      });
    }
    this.renderPickerTracksList(query);
  },

  renderPlaylistsPanel() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('select-active-playlist');
    const pillsContainer = document.getElementById('music-playlists-pills');
    const infoCountEl = document.getElementById('active-playlist-track-count');
    const customActions = document.getElementById('custom-playlist-actions');

    const presets = this.getPresetPlaylists();
    const allPlaylists = [...presets, ...this.playlists];

    // Mettre à jour le select
    if (select) {
      let optHtml = `<optgroup label="Playlists Préfaites (Dossiers)">`;
      presets.forEach(p => {
        const isSel = (this.activePlaylistId === p.id);
        optHtml += `<option value="${p.id}"${isSel ? ' selected' : ''}>${p.icon || '📁'} ${this.escapeHtml(p.name)} (${p.count})</option>`;
      });
      optHtml += `</optgroup>`;

      if (this.playlists.length > 0) {
        optHtml += `<optgroup label="Mes Playlists Personnalisées">`;
        this.playlists.forEach(pl => {
          const isSel = (this.activePlaylistId === pl.id);
          const count = (pl.trackIds || []).length;
          optHtml += `<option value="${pl.id}"${isSel ? ' selected' : ''}>⭐ ${this.escapeHtml(pl.name)} (${count})</option>`;
        });
        optHtml += `</optgroup>`;
      }
      select.innerHTML = optHtml;
      select.value = this.activePlaylistId;
    }

    // Mettre à jour les pills rapides
    if (pillsContainer) {
      let pillsHtml = '';
      allPlaylists.forEach(pl => {
        const isActive = (this.activePlaylistId === pl.id);
        const icon = pl.icon || (pl.isPreset ? '📁' : '⭐');
        const count = pl.isPreset ? pl.count : (pl.trackIds || []).length;
        pillsHtml += `
          <div class="playlist-pill ${isActive ? 'active' : ''} ${pl.isPreset ? 'is-preset' : 'is-custom'}"
               onclick="MusicManager.selectPlaylist('${pl.id}')"
               title="${this.escapeHtml(pl.name)} (${count} morceaux)">
            <span>${icon}</span>
            <span>${this.escapeHtml(pl.name)}</span>
            <span style="opacity: 0.8; font-size: 0.65rem;">(${count})</span>
          </div>
        `;
      });
      pillsContainer.innerHTML = pillsHtml;
    }

    // Mettre à jour le résumé et boutons d'action
    const activePl = this.playlists.find(p => p.id === this.activePlaylistId);
    if (activePl) {
      const count = (activePl.trackIds || []).length;
      if (infoCountEl) infoCountEl.textContent = `${count} morceau${count > 1 ? 'x' : ''} • Personnalisée`;
      if (customActions) customActions.style.display = 'flex';
    } else {
      const activePreset = presets.find(p => p.id === this.activePlaylistId) || presets[0];
      if (infoCountEl) infoCountEl.textContent = `${activePreset.count || 0} morceau${(activePreset.count || 0) > 1 ? 'x' : ''} • Préfaite`;
      if (customActions) customActions.style.display = 'none';
    }
  },

  _getRenderSig() {
    const tCount = Array.isArray(this.tracks) ? this.tracks.length : 0;
    const pCount = Array.isArray(this.playlists) ? this.playlists.length : 0;
    return `${tCount}:${pCount}:${this.currentIndex}:${this.selectedFolder}:${this.activePlaylistId}:${this.sortBy}:${this.searchQuery}`;
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('music-playlist-list');
    if (!container) return;
    const sig = this._getRenderSig();
    if (this._lastRenderedSig === sig && container.childElementCount > 0) {
      this.updatePlayerUI();
      this.updateSidebarMiniPlayer();
      return;
    }
    this.render();
  },

  render() {
    if (typeof document === 'undefined') return;
    this._lastRenderedSig = this._getRenderSig();
    this.updateFolderFilterCounts();
    this.renderPlaylistsPanel();
    this.renderPlaylist();
    this.updatePlayerUI();
    this.updateVolumeUI();
    this.updateShuffleUI();
    this.updateRepeatUI();
    this.updateSidebarMiniPlayer();
    if (this.audio && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      this.onTimeUpdate();
    }
  },

  renderPlaylist() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('music-playlist-list');
    const countEl = document.getElementById('music-track-count');
    if (!container) return;

    const activePl = this.playlists.find(p => p.id === this.activePlaylistId);
    const selectedCat = this.selectedFolder;
    const query = (this.searchQuery || '').toLowerCase().trim();

    // 1. Filtrer par playlist active (personnalisée) OU par dossier puis par texte de recherche
    const filtered = this.tracks.filter(t => {
      if (activePl) {
        const matches = (t.id && activePl.trackIds.includes(t.id)) || 
                        (t.filename && activePl.trackIds.includes(t.filename));
        if (!matches) return false;
      } else if (selectedCat && selectedCat !== 'all') {
        const trackFolder = t.folder || 'Focus, Rituals & Daily Routines';
        if (trackFolder !== selectedCat) return false;
      }
      if (!query) return true;
      const trackFolder = t.folder || 'Focus, Rituals & Daily Routines';
      return (t.title && t.title.toLowerCase().includes(query)) ||
             (t.artist && t.artist.toLowerCase().includes(query)) ||
             (trackFolder && trackFolder.toLowerCase().includes(query)) ||
             (t.ext && t.ext.toLowerCase().includes(query));
    });

    // 2. Trier selon le mode choisi
    const sorted = filtered.slice();
    if (this.sortBy === 'folder') {
      sorted.sort((a, b) => {
        const catA = this.CATEGORIES.indexOf(a.folder || '');
        const catB = this.CATEGORIES.indexOf(b.folder || '');
        const idxA = (catA === -1 ? 999 : catA);
        const idxB = (catB === -1 ? 999 : catB);
        if (idxA !== idxB) return idxA - idxB;
        return (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
      });
    } else if (this.sortBy === 'title-asc') {
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }));
    } else if (this.sortBy === 'artist-asc') {
      sorted.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'fr', { sensitivity: 'base' }));
    }

    // 3. Mise à jour du compteur
    if (countEl) {
      if (activePl) {
        countEl.textContent = `${sorted.length} morceau${sorted.length > 1 ? 'x' : ''} (Playlist : ${activePl.name})`;
      } else if (this.selectedFolder !== 'all') {
        countEl.textContent = `${sorted.length} / ${this.tracks.length} morceau${this.tracks.length > 1 ? 'x' : ''}`;
      } else {
        countEl.textContent = `${this.tracks.length} morceau${this.tracks.length > 1 ? 'x' : ''}`;
      }
    }

    if (sorted.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-dim);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📑</div>
          <p style="margin: 0; font-size: 0.92rem;">Aucun morceau trouvé ${activePl ? 'dans cette playlist' : 'dans ce dossier'}.</p>
          <p style="margin-top: 6px; font-size: 0.8rem; color: var(--text-muted);">
            ${activePl ? 'Cliquez sur « ➕ Morceaux » pour composer votre playlist.' : 'Sélectionnez un autre dossier ou ajoutez de nouvelles musiques.'}
          </p>
        </div>
      `;
      return;
    }

    let html = '';
    let currentFolderGroup = null;

    sorted.forEach((track) => {
      const globalIndex = this.tracks.indexOf(track);
      const isCurrent = (globalIndex === this.currentIndex);
      const isPlayingCurrent = isCurrent && this.isPlaying;
      const trackFolder = track.folder || 'Focus, Rituals & Daily Routines';
      const trackKey = track.id || track.filename;

      // Afficher un séparateur de dossier si tri par dossier et vue globale "Tous les dossiers" (hors playlist custom)
      if (!activePl && this.sortBy === 'folder' && this.selectedFolder === 'all' && trackFolder !== currentFolderGroup) {
        currentFolderGroup = trackFolder;
        const countInGroup = sorted.filter(x => (x.folder || 'Focus, Rituals & Daily Routines') === currentFolderGroup).length;
        html += `
          <div class="music-folder-divider">
            <span>📁</span>
            <span>${this.escapeHtml(currentFolderGroup)}</span>
            <span style="font-size: 0.72rem; color: var(--text-dim); font-weight: normal; margin-left: 6px;">(${countInGroup})</span>
          </div>
        `;
      }

      const badgeType = track.ext || 'MP3';
      const durationDisplay = track.durationFormatted || '--:--';

      html += `
        <div class="music-track-item ${isCurrent ? 'active' : ''} ${isPlayingCurrent ? 'playing' : ''}" 
             data-track-index="${globalIndex}"
             onclick="MusicManager.play(${globalIndex})"
             title="${this.escapeHtml(track.title)} - ${this.escapeHtml(track.artist)} [Dossier: ${this.escapeHtml(trackFolder)}]">
          <div class="track-number-col">
            ${isPlayingCurrent 
              ? `<div class="sound-wave-bars"><span></span><span></span><span></span></div>` 
              : `<span class="track-num">${isCurrent ? '▶' : globalIndex + 1}</span>`}
          </div>
          <div class="track-info-col">
            <span class="track-title">${this.escapeHtml(track.title)}</span>
            <span class="track-artist">${this.escapeHtml(track.artist)}</span>
          </div>
          <div class="track-meta-col">
            <span class="badge track-folder-badge" title="Dossier : ${this.escapeHtml(trackFolder)}">${this.escapeHtml(trackFolder)}</span>
            <span class="badge track-ext-badge">${badgeType}</span>
            <span class="track-duration">${durationDisplay}</span>
            ${activePl 
              ? `<button type="button" class="btn-track-action remove" onclick="event.stopPropagation(); MusicManager.removeTrackFromPlaylist('${activePl.id}', '${trackKey}')" title="Retirer de « ${this.escapeHtml(activePl.name)} »">✕</button>`
              : `<button type="button" class="btn-track-action add" onclick="event.stopPropagation(); MusicManager.promptAddTrackToPlaylist('${trackKey}')" title="Ajouter à une playlist personnalisée">➕</button>`
            }
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  updatePlayerUI() {
    if (typeof document === 'undefined') return;
    const current = this.getCurrentTrack();

    const titleEl = document.getElementById('music-track-title');
    const artistEl = document.getElementById('music-track-artist');
    const badgeEl = document.getElementById('music-track-badge');
    const vinylEl = document.getElementById('music-vinyl-disc');
    const playBtn = document.getElementById('music-btn-play');

    if (current) {
      if (titleEl) titleEl.textContent = current.title;
      if (artistEl) artistEl.textContent = current.artist || 'Antigravité Lofi';
      if (badgeEl) badgeEl.textContent = current.ext || 'MP3';
    } else {
      if (titleEl) titleEl.textContent = 'Aucun morceau sélectionné';
      if (artistEl) artistEl.textContent = 'Choisissez un titre dans la playlist';
      if (badgeEl) badgeEl.textContent = 'LOCAL';
    }

    if (vinylEl) {
      vinylEl.classList.toggle('spinning', this.isPlaying);
      vinylEl.classList.toggle('paused', !this.isPlaying);
    }

    if (playBtn) {
      playBtn.innerHTML = this.isPlaying 
        ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
        : `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
      playBtn.title = this.isPlaying ? 'Mettre en pause (Espace)' : 'Reprendre la lecture (Espace)';
      playBtn.classList.toggle('is-playing', this.isPlaying);
    }

    // Actualiser surbrillance active dans la liste
    const items = document.querySelectorAll('.music-track-item');
    items.forEach(item => {
      const idx = parseInt(item.dataset.trackIndex, 10);
      const isCur = (idx === this.currentIndex);
      item.classList.toggle('active', isCur);
      item.classList.toggle('playing', isCur && this.isPlaying);
      const numCol = item.querySelector('.track-number-col');
      if (numCol) {
        if (isCur && this.isPlaying) {
          numCol.innerHTML = `<div class="sound-wave-bars"><span></span><span></span><span></span></div>`;
        } else {
          numCol.innerHTML = `<span class="track-num">${isCur ? '▶' : idx + 1}</span>`;
        }
      }
    });

    this.updateSidebarMiniPlayer();
    if (this.audio && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      this.onTimeUpdate();
    }
  },

  updateVolumeUI() {
    if (typeof document === 'undefined') return;
    const slider = document.getElementById('music-volume-slider');
    const label = document.getElementById('music-volume-label');
    const muteBtn = document.getElementById('music-btn-mute');

    const effectiveVol = this.isMuted ? 0 : Math.round(this.volume * 100);

    if (slider) slider.value = effectiveVol;
    if (label) label.textContent = `${effectiveVol}%`;
    const fill = document.getElementById('music-volume-fill');
    if (fill) fill.style.width = `${effectiveVol}%`;

    if (muteBtn) {
      if (effectiveVol === 0 || this.isMuted) {
        muteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/></svg>`;
        muteBtn.title = "Rétablir le son";
      } else if (effectiveVol < 50) {
        muteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        muteBtn.title = "Couper le son";
      } else {
        muteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
        muteBtn.title = "Couper le son";
      }
    }
  },

  updateShuffleUI() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('music-btn-shuffle');
    if (btn) {
      btn.classList.toggle('active', this.isShuffle);
      btn.style.color = this.isShuffle ? 'var(--accent)' : 'var(--text-main)';
      btn.style.borderColor = this.isShuffle ? 'var(--accent)' : 'var(--border-color)';
      btn.style.background = this.isShuffle ? 'var(--accent-light)' : 'transparent';
      btn.title = this.isShuffle ? 'Mode aléatoire : Activé 🔀' : 'Mode aléatoire : Désactivé';
    }
  },

  updateRepeatUI() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('music-btn-repeat');
    if (btn) {
      const isLoop = (this.repeatMode !== 'none');
      btn.classList.toggle('active', isLoop);
      btn.style.color = isLoop ? 'var(--accent)' : 'var(--text-muted)';
      btn.style.borderColor = isLoop ? 'var(--accent)' : 'var(--border-color)';
      btn.style.background = isLoop ? 'var(--accent-light)' : 'transparent';

      if (this.repeatMode === 'one') {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="10" y="15" font-size="8" font-family="sans-serif" font-weight="700" fill="currentColor">1</text></svg>`;
        btn.title = 'Répétition : Morceau en boucle 🔂';
      } else if (this.repeatMode === 'all') {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
        btn.title = 'Répétition : Toute la playlist 🔁';
      } else {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
        btn.title = 'Répétition : Désactivée ➡️';
      }
    }
  },

  updateMiniPlayer() {
    return this.updateSidebarMiniPlayer();
  },

  updateSidebarMiniPlayer() {
    if (typeof document === 'undefined') return;
    const widget = document.getElementById('sidebar-music-widget');
    if (!widget) return;

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    if (settings.sidebarMiniPlayerEnabled === false) {
      widget.style.display = 'none';
      return;
    }

    const current = this.getCurrentTrack();

    // SEULEMENT lorsqu'il y a de la musique lancée
    if (!this.hasStarted || !current) {
      widget.style.display = 'none';
      return;
    }

    widget.style.display = 'flex';

    const titleEl = document.getElementById('sidebar-music-title');
    const artistEl = document.getElementById('sidebar-music-artist');
    const playIcon = document.getElementById('sidebar-music-play-icon');
    const discEl = (widget && typeof widget.querySelector === 'function') 
      ? widget.querySelector('.sidebar-music-disc-mini') 
      : null;

    if (titleEl) titleEl.textContent = current.title;
    if (artistEl) artistEl.textContent = current.artist || 'Antigravité Lofi';

    if (playIcon) {
      if (this.isPlaying) {
        playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>`;
      } else {
        playIcon.innerHTML = `<polygon points="6 3 20 12 6 21 6 3"/>`;
      }
    }

    if (discEl) {
      discEl.classList.toggle('spinning', this.isPlaying);
      discEl.classList.toggle('paused', !this.isPlaying);
    }
  },

  bindEvents() {
    if (typeof document === 'undefined' || this._eventsBound) return;
    this._eventsBound = true;

    // 1. Bouton Lecture / Pause
    const playBtn = document.getElementById('music-btn-play');
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());

    // 2. Bouton Stop
    const stopBtn = document.getElementById('music-btn-stop');
    if (stopBtn) stopBtn.addEventListener('click', () => this.stop());

    // 3. Suivant / Précédent
    const nextBtn = document.getElementById('music-btn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());

    const prevBtn = document.getElementById('music-btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

    // 4. Aléatoire / Répétition
    const shuffleBtn = document.getElementById('music-btn-shuffle');
    if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());

    const repeatBtn = document.getElementById('music-btn-repeat');
    if (repeatBtn) repeatBtn.addEventListener('click', () => this.cycleRepeat());

    // 5. Volume & Mute
    const volSlider = document.getElementById('music-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const fill = document.getElementById('music-volume-fill');
        if (fill) fill.style.width = `${e.target.value}%`;
        this.setVolume(e.target.value / 100);
      });
    }

    const muteBtn = document.getElementById('music-btn-mute');
    if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());

    // 6. Barre de progression temporelle (Seek)
    const progSlider = document.getElementById('music-progress-slider');
    if (progSlider) {
      const clearDragging = () => { progSlider._dragging = false; };
      progSlider.addEventListener('pointerdown', () => { progSlider._dragging = true; });
      progSlider.addEventListener('mousedown', () => { progSlider._dragging = true; });
      progSlider.addEventListener('touchstart', () => { progSlider._dragging = true; }, { passive: true });
      progSlider.addEventListener('pointerup', clearDragging);
      progSlider.addEventListener('mouseup', clearDragging);
      progSlider.addEventListener('touchend', clearDragging);
      progSlider.addEventListener('blur', clearDragging);
      progSlider.addEventListener('input', (e) => {
        const fill = document.getElementById('music-progress-fill');
        if (fill) fill.style.width = `${e.target.value}%`;
      });
      progSlider.addEventListener('change', (e) => {
        progSlider._dragging = false;
        this.seek(parseFloat(e.target.value));
      });
    }

    // 7. Recherche dans la playlist
    const searchInput = document.getElementById('music-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderPlaylist();
      });
    }

    // 7b. Filtrage par dossier & Options de tri
    const folderFilter = document.getElementById('music-folder-filter');
    if (folderFilter) {
      folderFilter.addEventListener('change', (e) => {
        this.setFolder(e.target.value);
      });
    }

    const sortSelect = document.getElementById('music-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.setSort(e.target.value);
      });
    }

    // 8. Actions d'ajout et d'ouverture de dossier
    const openFolderBtn = document.getElementById('music-btn-open-folder');
    if (openFolderBtn) openFolderBtn.addEventListener('click', () => this.openMusicFolder());

    const addFilesBtn = document.getElementById('music-btn-add-files');
    const fileInput = document.getElementById('music-file-input');
    if (addFilesBtn) {
      addFilesBtn.addEventListener('click', () => this.promptAddPersonalMusic());
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addCustomTracks(e.target.files);
          fileInput.value = '';
        }
      });
    }

    // Événements de la modale d'avertissement d'importation
    const warningContinueBtn = document.getElementById('btn-music-warning-continue');
    if (warningContinueBtn) {
      warningContinueBtn.addEventListener('click', () => this.proceedWithMusicImport());
    }

    const warningCancelBtn = document.getElementById('btn-music-warning-cancel');
    if (warningCancelBtn) {
      warningCancelBtn.addEventListener('click', () => this.closeImportWarningModal());
    }

    const warningCloseBtn = document.getElementById('btn-close-music-warning');
    if (warningCloseBtn) {
      warningCloseBtn.addEventListener('click', () => this.closeImportWarningModal());
    }

    const warningModal = document.getElementById('music-import-warning-modal');
    if (warningModal) {
      warningModal.addEventListener('click', (e) => {
        if (e.target === warningModal) this.closeImportWarningModal();
      });
    }

    const refreshBtn = document.getElementById('music-btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh());

    // 9. Glisser-déposer de fichiers audio directement sur la zone de playlist
    const dropzone = document.getElementById('music-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.promptAddPersonalMusic(e.dataTransfer.files);
        }
      });
    }

    // 10. Événements du Mini-Lecteur dans la barre latérale
    const sidePlayBtn = document.getElementById('sidebar-music-play');
    if (sidePlayBtn) sidePlayBtn.addEventListener('click', () => this.togglePlay());

    const sideStopBtn = document.getElementById('sidebar-music-stop');
    if (sideStopBtn) sideStopBtn.addEventListener('click', () => this.stop());

    const sideNextBtn = document.getElementById('sidebar-music-next');
    if (sideNextBtn) sideNextBtn.addEventListener('click', () => this.next());

    const sidePrevBtn = document.getElementById('sidebar-music-prev');
    if (sidePrevBtn) sidePrevBtn.addEventListener('click', () => this.prev());

    const sideOpenMusic = document.getElementById('sidebar-music-open-tab');
    if (sideOpenMusic) {
      sideOpenMusic.addEventListener('click', () => {
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('music');
        }
      });
    }

    // 11. Raccourcis clavier universels (Espace pour Play/Pause, Échap pour modale)
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const selectModalEl = document.getElementById('playlist-select-modal');
          if (selectModalEl && selectModalEl.classList.contains('active')) {
            this.closePlaylistSelectModal();
          }
          const warningModalEl = document.getElementById('music-import-warning-modal');
          if (warningModalEl && warningModalEl.classList.contains('active')) {
            this.closeImportWarningModal();
          }
        }
        if (e.code === 'Space') {
          if (typeof document !== 'undefined' && document.querySelector('.modal-overlay.active')) return;
          if (typeof window !== 'undefined' && window.App && window.App.currentScreen === 'focus') return;
          const activeEl = document.activeElement;
          const activeTag = (activeEl?.tagName || '').toLowerCase();
          const isEditable = activeEl?.isContentEditable;
          if (['input', 'textarea', 'select', 'button', 'a'].includes(activeTag) || isEditable) {
            return;
          }
          if (activeEl && typeof activeEl.closest === 'function' && activeEl.closest('button, a, [role="button"], .task-checkbox, [contenteditable]')) {
            return;
          }
          e.preventDefault();
          this.togglePlay();
        }
      });
    }

    // 12. Événements des Playlists (Préfaites & Personnalisées)
    const btnCreatePl = document.getElementById('btn-create-playlist');
    if (btnCreatePl) btnCreatePl.addEventListener('click', () => this.openCreatePlaylistModal());

    const selectActivePl = document.getElementById('select-active-playlist');
    if (selectActivePl) {
      selectActivePl.addEventListener('change', (e) => this.selectPlaylist(e.target.value));
    }

    const btnAddTracksPl = document.getElementById('btn-add-tracks-to-playlist');
    if (btnAddTracksPl) {
      btnAddTracksPl.addEventListener('click', () => this.openPlaylistPickerModal(this.activePlaylistId));
    }

    const btnRenamePl = document.getElementById('btn-rename-playlist');
    if (btnRenamePl) {
      btnRenamePl.addEventListener('click', () => this.openRenamePlaylistModal(this.activePlaylistId));
    }

    const btnDeletePl = document.getElementById('btn-delete-playlist');
    if (btnDeletePl) {
      btnDeletePl.addEventListener('click', () => this.deletePlaylist(this.activePlaylistId));
    }

    // Modale de création / renommage de playlist
    const btnClosePlModal = document.getElementById('btn-close-playlist-modal');
    if (btnClosePlModal) btnClosePlModal.addEventListener('click', () => this.closePlaylistFormModal());

    const btnCancelPlModal = document.getElementById('btn-cancel-playlist-modal');
    if (btnCancelPlModal) btnCancelPlModal.addEventListener('click', () => this.closePlaylistFormModal());

    const plForm = document.getElementById('playlist-form');
    if (plForm) {
      plForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitPlaylistForm();
      });
    }

    // Modale de sélection des morceaux (Picker)
    const btnClosePicker = document.getElementById('btn-close-picker-modal');
    if (btnClosePicker) btnClosePicker.addEventListener('click', () => this.closePlaylistPickerModal());

    const btnCancelPicker = document.getElementById('btn-cancel-picker-modal');
    if (btnCancelPicker) btnCancelPicker.addEventListener('click', () => this.closePlaylistPickerModal());

    const btnSavePicker = document.getElementById('btn-save-picker-modal');
    if (btnSavePicker) btnSavePicker.addEventListener('click', () => this.savePlaylistPicker());

    const btnPickerSelectAll = document.getElementById('btn-picker-select-all');
    if (btnPickerSelectAll) btnPickerSelectAll.addEventListener('click', () => this.pickerSelectAll());

    const btnPickerDeselectAll = document.getElementById('btn-picker-deselect-all');
    if (btnPickerDeselectAll) btnPickerDeselectAll.addEventListener('click', () => this.pickerDeselectAll());

    const pickerSearch = document.getElementById('playlist-picker-search');
    if (pickerSearch) {
      pickerSearch.addEventListener('input', (e) => this.renderPickerTracksList(e.target.value));
    }

    // Modale de sélection de playlist pour un morceau (Ajouter ➕)
    const btnCloseSelectModal = document.getElementById('btn-close-playlist-select-modal');
    if (btnCloseSelectModal) {
      btnCloseSelectModal.addEventListener('click', () => this.closePlaylistSelectModal());
    }

    const btnCancelSelectModal = document.getElementById('btn-cancel-playlist-select-modal');
    if (btnCancelSelectModal) {
      btnCancelSelectModal.addEventListener('click', () => this.closePlaylistSelectModal());
    }

    const btnDoneSelectModal = document.getElementById('btn-done-playlist-select-modal');
    if (btnDoneSelectModal) {
      btnDoneSelectModal.addEventListener('click', () => this.closePlaylistSelectModal());
    }

    const selectModal = document.getElementById('playlist-select-modal');
    if (selectModal) {
      selectModal.addEventListener('click', (e) => {
        if (e.target === selectModal) this.closePlaylistSelectModal();
      });
    }

    const btnCreateNewPlForTrack = document.getElementById('btn-create-new-playlist-for-track');
    if (btnCreateNewPlForTrack) {
      btnCreateNewPlForTrack.addEventListener('click', () => {
        const stagedTrackKey = this._targetTrackKeyForPlaylist;
        this.closePlaylistSelectModal();
        this.openCreatePlaylistModal(stagedTrackKey);
      });
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.MusicManager = MusicManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MusicManager;
}
