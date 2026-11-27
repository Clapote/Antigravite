/**
 * Antigravité - Module de Persistance et Stockage Local
 * Principe fondamental : Toutes les données restent locales sur le PC.
 */

const StorageManager = {
  KEYS: {
    TASKS: 'antigravite_tasks_v1',
    PROJECTS: 'antigravite_projects_v1',
    EVENTS: 'antigravite_events_v1',
    NOTES: 'antigravite_notes_v1',
    SETTINGS: 'antigravite_settings_v1',
    BACKUPS: 'antigravite_backups_metadata_v1',
    TRASH: 'antigravite_trash_v1',
    SIDEBAR_QUICK_NOTE: 'antigravite_sidebar_quick_note_v1'
  },

  SETTINGS_VERSION: 2,
  CUSTOM_WALLPAPER_TOKEN: '__custom_wallpaper__',
  _customWallpaperDataUrl: null,
  _quotaWarned: false,
  _lastQuotaCheckAt: 0,

  // Initialisation du stockage
  async init() {
    // Si des données existent déjà dans localStorage, on les garde
    if (!localStorage.getItem(this.KEYS.TASKS)) {
      await this.loadInitialData();
    }
    await this._initCustomWallpaperStorage();
  },

  async _initCustomWallpaperStorage() {
    if (typeof window === 'undefined' || !window.AntigraviteAPI || !window.AntigraviteAPI.wallpaper) return;
    try {
      const settings = this.getSettings();
      if (typeof settings.backgroundImage === 'string' && settings.backgroundImage.startsWith('data:image/')) {
        const res = await window.AntigraviteAPI.wallpaper.save(settings.backgroundImage);
        if (res && res.ok) {
          this._customWallpaperDataUrl = settings.backgroundImage;
          settings.backgroundImage = this.CUSTOM_WALLPAPER_TOKEN;
          this.saveSettings(settings);
          return;
        }
      }
      if (settings.backgroundImage === this.CUSTOM_WALLPAPER_TOKEN) {
        const loaded = await window.AntigraviteAPI.wallpaper.load();
        if (loaded) {
          this._customWallpaperDataUrl = loaded;
        }
      }
    } catch (err) {
      console.warn('[StorageManager] Migration/chargement du fond personnalisé impossible:', err && err.message ? err.message : err);
    }
  },

  getCustomWallpaperDataUrl() {
    return this._customWallpaperDataUrl || null;
  },

  async saveCustomWallpaperDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
    if (typeof window !== 'undefined' && window.AntigraviteAPI && window.AntigraviteAPI.wallpaper && typeof window.AntigraviteAPI.wallpaper.save === 'function') {
      try {
        const res = await window.AntigraviteAPI.wallpaper.save(dataUrl);
        if (res && res.ok) {
          this._customWallpaperDataUrl = dataUrl;
          return this.CUSTOM_WALLPAPER_TOKEN;
        }
      } catch (err) {
        console.warn('[StorageManager] Échec écriture disque du fond personnalisé, repli en mémoire locale:', err && err.message ? err.message : err);
      }
    }
    this._customWallpaperDataUrl = dataUrl;
    return dataUrl;
  },

  // Chargement des données par défaut fournies dans /data/
  async loadInitialData() {
    try {
      const [tasksRes, projRes, evtsRes, notesRes, setRes] = await Promise.all([
        fetch('./data/tasks.json').catch(() => null),
        fetch('./data/projects.json').catch(() => null),
        fetch('./data/events.json').catch(() => null),
        fetch('./data/notes.json').catch(() => null),
        fetch('./data/settings.json').catch(() => null)
      ]);

      let anyLoaded = false;
      if (tasksRes && tasksRes.ok) {
        const tasks = await tasksRes.json();
        this.saveTasks(tasks);
        anyLoaded = true;
      }
      if (projRes && projRes.ok) {
        const projects = await projRes.json();
        this.saveProjects(projects);
        anyLoaded = true;
      }
      if (evtsRes && evtsRes.ok) {
        const events = await evtsRes.json();
        this.saveEvents(events);
        anyLoaded = true;
      }
      if (notesRes && notesRes.ok) {
        const notes = await notesRes.json();
        this.saveNotes(notes);
        anyLoaded = true;
      }
      if (setRes && setRes.ok) {
        const settings = await setRes.json();
        this.saveSettings(settings);
      }
      if (!anyLoaded) {
        this.seedFallbackData();
      }
    } catch (err) {
      console.warn('Initialisation avec jeux de données de secours:', err);
      // Jeux de secours intégrés si fetch échoue (ex: exécution directe file://)
      this.seedFallbackData();
    }
  },

  seedFallbackData() {
    if (!this.getProjects().length) {
      this.saveProjects([]);
    }
    if (!this.getTasks().length) {
      this.saveTasks([]);
    }
    if (!this.getEvents().length) {
      this.saveEvents([]);
    }
    if (!this.getNotes().length) {
      this.saveNotes([]);
    }
  },

  // Cache en mémoire pour lectures ultra-rapides sans désérialisation JSON répétée
  _cache: {},
  _revisions: {
    tasks: 0,
    projects: 0,
    events: 0,
    notes: 0,
    settings: 0,
    backups: 0,
    trash: 0
  },

  getRevision(key) {
    if (!this._revisions || typeof this._revisions[key] !== 'number') return 0;
    return this._revisions[key];
  },

  _bumpRevision(key) {
    if (!this._revisions) {
      this._revisions = { tasks: 0, projects: 0, events: 0, notes: 0, settings: 0, backups: 0, trash: 0 };
    }
    this._revisions[key] = (this._revisions[key] || 0) + 1;
  },

  clearCache() {
    this._cache = {};
    if (this._revisions) {
      Object.keys(this._revisions).forEach((k) => {
        this._revisions[k] = (this._revisions[k] || 0) + 1;
      });
    }
  },

  _safeReadCollection(key, cacheProp) {
    if (this._cache[cacheProp]) return this._cache[cacheProp];
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) {
        this._cache[cacheProp] = [];
        return this._cache[cacheProp];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error(`Structure invalide pour ${key} (tableau attendu)`);
      }
      this._cache[cacheProp] = parsed;
    } catch (err) {
      console.warn(`[StorageManager] Donnée corrompue détectée dans ${key}:`, err && err.message ? err.message : err);
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(key);
          if (raw) localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw);
        } catch (_) {}
      }
      this._cache[cacheProp] = [];
    }
    return this._cache[cacheProp];
  },

  _isQuotaError(err) {
    return !!(err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014));
  },

  _handleStorageWriteError(err, keyLabel) {
    console.error(`[StorageManager] Échec d'écriture (${keyLabel}) :`, err);
    if (this._isQuotaError(err) && typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Stockage local saturé ! Videz la corbeille ou supprimez les données volumineuses puis sauvegardez.", "error");
    }
  },

  _safeWriteCollection(key, cacheProp, data) {
    if (typeof localStorage !== 'undefined') {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
      } catch (err) {
        this._handleStorageWriteError(err, key);
        throw err;
      }
    }
    this._cache[cacheProp] = data;
    this._bumpRevision(cacheProp);
    this.checkStorageQuotaHealth();
  },

  // Tâches
  getTasks() {
    return this._safeReadCollection(this.KEYS.TASKS, 'tasks');
  },
  saveTasks(tasks) {
    this._safeWriteCollection(this.KEYS.TASKS, 'tasks', tasks);
  },

  // Projets
  getProjects() {
    return this._safeReadCollection(this.KEYS.PROJECTS, 'projects');
  },
  saveProjects(projects) {
    this._safeWriteCollection(this.KEYS.PROJECTS, 'projects', projects);
  },

  /**
   * Retourne les projets ordonnés hiérarchiquement (racines puis sous-projets imbriqués),
   * avec protection anti-cycle et conservation des orphelins à la racine.
   */
  getProjectsHierarchy(projectsList = null) {
    const projects = Array.isArray(projectsList) ? projectsList : this.getProjects();
    if (!Array.isArray(projects) || projects.length === 0) return [];

    const byId = new Map();
    projects.forEach(p => {
      if (p && p.id) byId.set(p.id, p);
    });

    const childrenByParent = new Map();
    projects.forEach(p => {
      if (!p || !p.id) return;
      const parentId = (p.parentProjectId && p.parentProjectId !== p.id && byId.has(p.parentProjectId))
        ? p.parentProjectId
        : null;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(p);
    });

    const result = [];
    const visited = new Set();

    const walk = (parentId, level, parentProject, pathParts) => {
      const list = childrenByParent.get(parentId) || [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (visited.has(p.id)) continue;
        visited.add(p.id);

        const nextPathParts = pathParts.concat(p.title || 'Projet');
        const directChildren = childrenByParent.get(p.id) || [];
        result.push({
          project: p,
          level,
          parentProject,
          childrenCount: directChildren.length,
          displayTitle: level === 0 ? (p.title || 'Projet') : `${'  '.repeat(level)}└─ ${p.title || 'Sous-projet'}`,
          pathTitle: nextPathParts.join(' › ')
        });
        walk(p.id, level + 1, p, nextPathParts);
      }
    };

    walk(null, 0, null, []);

    // Récupérer d'éventuels cycles isolés pour ne perdre aucun projet
    projects.forEach(p => {
      if (p && p.id && !visited.has(p.id)) {
        visited.add(p.id);
        result.push({
          project: p,
          level: 0,
          parentProject: null,
          childrenCount: (childrenByParent.get(p.id) || []).length,
          displayTitle: p.title || 'Projet',
          pathTitle: p.title || 'Projet'
        });
      }
    });

    return result;
  },

  getProjectPathLabel(projectId, projectsList = null) {
    if (!projectId) return '';
    const hierarchy = this.getProjectsHierarchy(projectsList);
    const match = hierarchy.find(item => item.project.id === projectId);
    return match ? match.pathTitle : '';
  },

  // Agenda / Événements
  getEvents() {
    return this._safeReadCollection(this.KEYS.EVENTS, 'events');
  },
  saveEvents(events) {
    this._safeWriteCollection(this.KEYS.EVENTS, 'events', events);
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      const activeDate = (window.AgendaManager && window.AgendaManager.activeDateStr) ? window.AgendaManager.activeDateStr : null;
      window.App.updateSidebarDayProgress(activeDate);
    }
  },

  // Notes
  getNotes() {
    return this._safeReadCollection(this.KEYS.NOTES, 'notes');
  },
  saveNotes(notes) {
    this._safeWriteCollection(this.KEYS.NOTES, 'notes', notes);
  },

  DEFAULT_SETTINGS: {
    settingsVersion: 2,
    theme: 'dark',           // 'dark' | 'light' | 'oled'
    accentColor: 'blue',     // 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'cyan' | 'orange' | 'mint' | 'indigo'
    density: 'comfortable',  // 'comfortable' | 'compact'
    fontSize: 'normal',      // 'small' | 'normal' | 'large'
    fontFamily: 'system',    // 'system' | 'tech' | 'rounded'
    borderRadius: 'modern',  // 'minimal' | 'modern' | 'soft'
    glassStyle: 'balanced',  // 'balanced' | 'glass' | 'solid'
    customAccentColors: [],  // [{ id, name, hex, createdAt }] - Nuancier personnel
    customWallpapers: [],    // [{ id, name, type, css, patternSize, patternRepeat, config, createdAt }] - Fonds créés dans le studio
    backgroundImage: null,   // null | 'nebula' | 'aurora' | 'mineral' | 'sunset' | 'ocean' | 'forest' | 'cyberpunk' | 'minimal' | 'lavender' | 'solar' | 'data:image/...'
    backgroundOpacity: 25,   // 5 à 80 (%)
    backgroundBlur: 0,       // 0 à 20 (px)
    startOfWeek: 1,
    defaultView: 'home',
    autoBackupOnLaunch: true,
    backupRetentionDays: 30,
    notificationsEnabled: true,
    agendaNotificationStages: ['60m', '30m', 'now'], // Choix multiples : '60m', '30m', 'now'
    notificationSound: 'zen', // 'zen' | 'chime' | 'pop' | 'none'
    notificationVolume: 60,  // 0 à 100 (%)
    sidebarDayProgressEnabled: false, // Afficher la progression de la journée sous les onglets à gauche
    sidebarMiniPlayerEnabled: false,  // Afficher le mini-lecteur de musique dans le volet latéral
    sidebarStickyNoteEnabled: false,  // Afficher le module Post-it mémo dans le volet latéral
    sidebarVisibleScreens: {
      agenda: true,
      tasks: true,
      projects: true,
      notes: true,
      trash: true,
      constellation: false,
      focus: false,
      music: false,
      backups: false
    },
    sidebarTabsOrder: [
      'agenda',
      'tasks',
      'projects',
      'notes',
      'constellation',
      'focus',
      'music',
      'trash',
      'backups'
    ],
    notesFolders: [
      'Général'
    ],
    userName: '',            // Prénom ou nom d'usage de la personne
    greetingMood: 'mixed',   // 'mixed' | 'warm' | 'witty' | 'custom'
    customGreetingPhrase: '', // Phrase personnalisée sur-mesure (si mode custom)
    // Débriefing et bilan
    debriefEnabled: false,             // Activer le débriefing du jour et de la semaine
    debriefHour: '17:00',             // Heure d'apparition du bilan en semaine (défaut 17:00)
    debriefWeekendRange: 'mon-fri',   // Périmètre hebdo le week-end : 'mon-fri' | 'mon-sat' | 'mon-sun'
    debriefAlwaysShowTab: false,      // Garder l'onglet visible en permanence ou uniquement aux heures dédiées
    // Paramètres sérieux (réglages d'usine = comportement normal d'Antigravité)
    performanceMode: 'normal',        // 'normal' | 'economy' | 'potato'
    gpuCompatibilityMode: false,      // Désactive enable-zero-copy / flags GPU agressifs au prochain démarrage
    launchOnStartup: false,           // Lancement automatique au démarrage Windows
    runInBackgroundOnClose: true,     // Rester actif dans la zone de notification à la fermeture
    autoCheckUpdates: true,           // Vérifier automatiquement les mises à jour au lancement
    autoBackupFrequencyHours: 24,     // Intervalle en heures (0 = désactivé / manuel uniquement)
    backupRetentionCount: 20,         // Nombre maximal d'instantanés conservés
    backupDirectory: null,            // Dossier personnalisé (null = défaut AppData)
    disableAnimations: false,         // Indépendant des profils : désactive les animations CSS/JS
    disablePreviews: false,           // Indépendant des profils : désactive les aperçus dynamiques
    disableHoverEffects: false        // Indépendant des profils : désactive les effets au survol
  },

  SERIOUS_SETTING_KEYS: [
    'performanceMode',
    'gpuCompatibilityMode',
    'launchOnStartup',
    'runInBackgroundOnClose',
    'autoBackupFrequencyHours',
    'autoBackupOnLaunch',
    'backupRetentionCount',
    'backupDirectory',
    'disableAnimations',
    'disablePreviews',
    'disableHoverEffects'
  ],

  getSeriousDefaults() {
    const defaults = {};
    this.SERIOUS_SETTING_KEYS.forEach((k) => {
      defaults[k] = this.DEFAULT_SETTINGS[k];
    });
    return defaults;
  },

  resetSeriousSettings() {
    const current = this.getSettings();
    const updated = Object.assign({}, current, this.getSeriousDefaults());
    this.saveSettings(updated);
    return updated;
  },

  // Comptage exact de la taille UTF-8 sans allocation d'objet Blob
  _utf8ByteLength(str) {
    if (!str || typeof str !== 'string') return 0;
    let bytes = 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes += 1;
      } else if (code < 0x800) {
        bytes += 2;
      } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < len) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          bytes += 4;
          i++;
        } else {
          bytes += 3;
        }
      } else {
        bytes += 3;
      }
    }
    return bytes;
  },

  getStorageStats() {
    let localStorageBytes = 0;
    const breakdown = {};
    const byteLen = (str) => this._utf8ByteLength(str);

    if (typeof localStorage !== 'undefined') {
      const trackedKeys = new Set(Object.values(this.KEYS));
      Object.keys(this.KEYS).forEach((name) => {
        const key = this.KEYS[name];
        const raw = localStorage.getItem(key);
        const bytes = byteLen(raw);
        breakdown[name] = bytes;
        localStorageBytes += bytes;
      });
      if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
        let otherBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && !trackedKeys.has(k) && k.startsWith('antigravite_')) {
            otherBytes += byteLen(localStorage.getItem(k));
          }
        }
        if (otherBytes > 0) {
          breakdown.OTHER = otherBytes;
          localStorageBytes += otherBytes;
        }
      }
    }

    const estimatedQuotaBytes = 5 * 1024 * 1024;
    const usageRatio = Number((localStorageBytes / estimatedQuotaBytes).toFixed(4));

    return {
      localStorageBytes,
      estimatedQuotaBytes,
      usageRatio,
      breakdown,
      cachedCollections: Object.keys(this._cache || {}).length,
      counts: {
        tasks: (this.getTasks() || []).length,
        projects: (this.getProjects() || []).length,
        events: (this.getEvents() || []).length,
        notes: (this.getNotes() || []).length,
        backups: (this.getBackups() || []).length,
        trash: (this.getTrash() || []).length
      }
    };
  },

  checkStorageQuotaHealth(force = false) {
    if (typeof localStorage === 'undefined') return null;
    const now = Date.now();
    if (!force && this._lastQuotaCheckAt && (now - this._lastQuotaCheckAt < 15000)) {
      return null;
    }
    this._lastQuotaCheckAt = now;
    try {
      const stats = this.getStorageStats();
      if (stats.usageRatio >= 0.80 && !this._quotaWarned) {
        this._quotaWarned = true;
        console.warn(`[StorageManager] Occupation du stockage local élevée : ${Math.round(stats.usageRatio * 100)}% (${stats.localStorageBytes} octets)`);
        if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Stockage local à ${Math.round(stats.usageRatio * 100)} % : pensez à vider la corbeille ou exporter une sauvegarde.`, "warning");
        }
      }
      return stats;
    } catch (_) {
      return null;
    }
  },

  _cloneDefaultSettings() {
    const cloned = Object.assign({}, this.DEFAULT_SETTINGS);
    cloned.customAccentColors = Array.isArray(this.DEFAULT_SETTINGS.customAccentColors) ? [...this.DEFAULT_SETTINGS.customAccentColors] : [];
    cloned.customWallpapers = Array.isArray(this.DEFAULT_SETTINGS.customWallpapers) ? [...this.DEFAULT_SETTINGS.customWallpapers] : [];
    cloned.agendaNotificationStages = Array.isArray(this.DEFAULT_SETTINGS.agendaNotificationStages) ? [...this.DEFAULT_SETTINGS.agendaNotificationStages] : [];
    cloned.sidebarTabsOrder = Array.isArray(this.DEFAULT_SETTINGS.sidebarTabsOrder) ? [...this.DEFAULT_SETTINGS.sidebarTabsOrder] : [];
    cloned.notesFolders = Array.isArray(this.DEFAULT_SETTINGS.notesFolders) ? [...this.DEFAULT_SETTINGS.notesFolders] : ['Général'];
    cloned.sidebarVisibleScreens = Object.assign({}, this.DEFAULT_SETTINGS.sidebarVisibleScreens || {});
    return cloned;
  },

  migrateSettings(rawSettings) {
    const base = this._cloneDefaultSettings();
    if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
      base.settingsVersion = this.SETTINGS_VERSION;
      return base;
    }

    const defaultVisibleScreens = Object.assign({}, base.sidebarVisibleScreens);
    const merged = Object.assign({}, base, rawSettings);
    merged.sidebarVisibleScreens = Object.assign(
      defaultVisibleScreens,
      (rawSettings.sidebarVisibleScreens && typeof rawSettings.sidebarVisibleScreens === 'object' && !Array.isArray(rawSettings.sidebarVisibleScreens))
        ? rawSettings.sidebarVisibleScreens
        : {}
    );

    if (!Array.isArray(merged.notesFolders) || merged.notesFolders.length === 0) {
      merged.notesFolders = ['Général'];
    } else if (!merged.notesFolders.includes('Général')) {
      merged.notesFolders = ['Général', ...merged.notesFolders.filter(f => typeof f === 'string' && f.trim())];
    }

    if (Array.isArray(merged.sidebarTabsOrder)) {
      const cleanedOrder = merged.sidebarTabsOrder.filter(t => typeof t === 'string' && t.trim());
      if (!cleanedOrder.includes('constellation')) {
        const idx = cleanedOrder.indexOf('notes');
        if (idx !== -1) cleanedOrder.splice(idx + 1, 0, 'constellation');
        else cleanedOrder.push('constellation');
      }
      merged.sidebarTabsOrder = cleanedOrder;
    } else {
      merged.sidebarTabsOrder = [...base.sidebarTabsOrder];
    }

    if (!Array.isArray(merged.customAccentColors)) merged.customAccentColors = [];
    if (!Array.isArray(merged.customWallpapers)) merged.customWallpapers = [];
    if (!Array.isArray(merged.agendaNotificationStages)) merged.agendaNotificationStages = [...base.agendaNotificationStages];

    if (typeof merged.autoBackupFrequencyHours !== 'number' || !Number.isFinite(merged.autoBackupFrequencyHours) || merged.autoBackupFrequencyHours < 0) {
      merged.autoBackupFrequencyHours = base.autoBackupFrequencyHours;
    }
    if (typeof merged.backupRetentionCount !== 'number' || !Number.isFinite(merged.backupRetentionCount) || merged.backupRetentionCount < 1) {
      merged.backupRetentionCount = base.backupRetentionCount;
    }
    merged.autoCheckUpdates = merged.autoCheckUpdates !== false;
    merged.settingsVersion = this.SETTINGS_VERSION;
    return merged;
  },

  // Préférences
  getSettings() {
    if (this._cache.settings) return this._cache.settings;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.SETTINGS) : null;
      const parsed = raw ? JSON.parse(raw) : {};
      this._cache.settings = this.migrateSettings(parsed);
    } catch {
      this._cache.settings = this.migrateSettings(null);
    }
    return this._cache.settings;
  },
  saveSettings(settings) {
    this._safeWriteCollection(this.KEYS.SETTINGS, 'settings', settings);
  },

  // Note rapide / Post-it du volet latéral
  getSidebarQuickNote() {
    if (typeof localStorage === 'undefined') return '';
    try {
      return localStorage.getItem(this.KEYS.SIDEBAR_QUICK_NOTE) || '';
    } catch {
      return '';
    }
  },
  saveSidebarQuickNote(text) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.KEYS.SIDEBAR_QUICK_NOTE, text || '');
    } catch (e) {
      console.warn('[StorageManager] Erreur sauvegarde post-it latéral:', e);
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Impossible d'enregistrer le mémo rapide (stockage plein).", "warning");
      }
    }
  },

  // Sauvegardes
  getBackups() {
    if (this._cache.backups) return this._cache.backups;
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.KEYS.BACKUPS);
      this._cache.backups = raw ? JSON.parse(raw) : [];
    } catch { this._cache.backups = []; }
    return this._cache.backups;
  },
  saveBackups(backups) {
    this._cache.backups = backups;
    this._bumpRevision('backups');
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.KEYS.BACKUPS, JSON.stringify(backups));
    } catch (err) {
      if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
        console.warn("[StorageManager] Quota localStorage atteint dans saveBackups. Allègement des payloads...");
        const stripped = (backups || []).map(b => {
          if (b && (b.diskPath || b.hasPhysicalBackup)) {
            const copy = Object.assign({}, b);
            delete copy.payload;
            return copy;
          }
          return b;
        });
        try {
          localStorage.setItem(this.KEYS.BACKUPS, JSON.stringify(stripped));
          this._cache.backups = stripped;
          return;
        } catch (e2) {
          console.error("[StorageManager] Échec persistance après allègement :", e2);
          throw e2;
        }
      }
      throw err;
    }
  },

  // Corbeille
  getTrash() {
    if (this._cache.trash) return this._cache.trash;
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.KEYS.TRASH);
      this._cache.trash = raw ? JSON.parse(raw) : [];
    } catch { this._cache.trash = []; }
    return this._cache.trash;
  },
  saveTrash(trash) {
    this._safeWriteCollection(this.KEYS.TRASH, 'trash', trash);
  },

  // Export complet de toutes les données dans un seul objet (avec préférences annexes Focus/Musique/UI)
  EXPORT_EXTRA_PREFS_KEYS: [
    'antigravite_focus_daily',
    'antigravite_focus_history_v1',
    'antigravite_focus_target',
    'antigravite_focus_auto_music',
    'antigravite_focus_shuffle_music',
    'antigravite_focus_specific_playlist_enabled',
    'antigravite_focus_playlist_id',
    'antigravite_focus_work_minutes',
    'antigravite_focus_break_minutes',
    'antigravite_debrief_seen',
    'antigravite_debrief_snoozed_v1',
    'antigravite_custom_playlists',
    'antigravite_active_playlist_id',
    'antigravite_music_volume',
    'antigravite_music_shuffle',
    'antigravite_music_repeat',
    'antigravite_music_folder',
    'antigravite_music_sort',
    'antigravite_dashboard_agenda_view',
    'antigravite_notes_layout_mode',
    'antigravite_notes_view_mode',
    'antigravite_project_view',
    'antigravite_collapsed_project_families',
    'antigravite_task_sort_mode'
  ],

  getFullExport() {
    const extraPrefs = {};
    if (typeof localStorage !== 'undefined') {
      this.EXPORT_EXTRA_PREFS_KEYS.forEach((k) => {
        try {
          const val = localStorage.getItem(k);
          if (val !== null && val !== undefined) extraPrefs[k] = val;
        } catch (_) {}
      });
    }
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: this.getTasks(),
      projects: this.getProjects(),
      events: this.getEvents(),
      notes: this.getNotes(),
      settings: this.getSettings(),
      trash: this.getTrash(),
      sidebarQuickNote: this.getSidebarQuickNote(),
      extraPrefs
    };
  },

  // Restauration d'un export complet (atomique avec rollback sur erreur)
  restoreFullExport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error("Format de sauvegarde invalide.");
    }
    if (typeof window !== 'undefined' && window.NotesManager && typeof window.NotesManager.cancelPendingSave === 'function') {
      window.NotesManager.cancelPendingSave();
    }

    const rollbackKeys = [
      this.KEYS.TASKS,
      this.KEYS.PROJECTS,
      this.KEYS.EVENTS,
      this.KEYS.NOTES,
      this.KEYS.SETTINGS,
      this.KEYS.TRASH,
      this.KEYS.SIDEBAR_QUICK_NOTE,
      ...this.EXPORT_EXTRA_PREFS_KEYS
    ];
    const snapshot = new Map();
    if (typeof localStorage !== 'undefined') {
      rollbackKeys.forEach((k) => {
        try {
          snapshot.set(k, localStorage.getItem(k));
        } catch (_) {}
      });
    }

    this.clearCache();
    try {
      if (Array.isArray(data.tasks)) this.saveTasks(data.tasks);
      if (Array.isArray(data.projects)) this.saveProjects(data.projects);
      if (Array.isArray(data.events)) this.saveEvents(data.events);
      if (Array.isArray(data.notes)) this.saveNotes(data.notes);
      if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        const migrated = this.migrateSettings(data.settings);
        this.saveSettings(migrated);
      }
      if (Array.isArray(data.trash)) this.saveTrash(data.trash);
      if (typeof data.sidebarQuickNote === 'string') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.KEYS.SIDEBAR_QUICK_NOTE, data.sidebarQuickNote);
        }
      }
      if (data.extraPrefs && typeof data.extraPrefs === 'object' && !Array.isArray(data.extraPrefs) && typeof localStorage !== 'undefined') {
        const allowed = new Set(this.EXPORT_EXTRA_PREFS_KEYS);
        Object.keys(data.extraPrefs).forEach((k) => {
          if (allowed.has(k) && typeof data.extraPrefs[k] === 'string') {
            localStorage.setItem(k, data.extraPrefs[k]);
          }
        });
      }
      return true;
    } catch (err) {
      if (typeof localStorage !== 'undefined') {
        rollbackKeys.forEach((k) => {
          try {
            const prevVal = snapshot.get(k);
            if (prevVal === null || prevVal === undefined) {
              if (typeof localStorage.removeItem === 'function') localStorage.removeItem(k);
            } else {
              localStorage.setItem(k, prevVal);
            }
          } catch (_) {}
        });
      }
      this.clearCache();
      throw err;
    }
  }
};

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
