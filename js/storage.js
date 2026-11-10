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

  // Initialisation du stockage
  async init() {
    // Si des données existent déjà dans localStorage, on les garde
    if (!localStorage.getItem(this.KEYS.TASKS)) {
      await this.loadInitialData();
    }
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

      if (tasksRes && tasksRes.ok) {
        const tasks = await tasksRes.json();
        this.saveTasks(tasks);
      }
      if (projRes && projRes.ok) {
        const projects = await projRes.json();
        this.saveProjects(projects);
      }
      if (evtsRes && evtsRes.ok) {
        const events = await evtsRes.json();
        this.saveEvents(events);
      }
      if (notesRes && notesRes.ok) {
        const notes = await notesRes.json();
        this.saveNotes(notes);
      }
      if (setRes && setRes.ok) {
        const settings = await setRes.json();
        this.saveSettings(settings);
      }
    } catch (err) {
      console.warn('Initialisation avec jeux de données de secours:', err);
      // Jeux de secours intégrés si fetch échoue (ex: exécution directe file://)
      this.seedFallbackData();
    }
  },

  seedFallbackData() {
    if (!this.getProjects().length) {
      this.saveProjects([
        { id: "proj-1", title: "Développement Antigravité", description: "Prototype local de l'application", color: "#3b82f6", status: "in_progress", createdAt: new Date().toISOString() },
        { id: "proj-2", title: "Organisation Personnelle", description: "Gestion du temps et révisions", color: "#10b981", status: "in_progress", createdAt: new Date().toISOString() }
      ]);
    }
    if (!this.getTasks().length) {
      this.saveTasks([
        {
          id: "task-1",
          title: "Découvrir l'application Antigravité",
          description: "Créer une première sous-tâche et vérifier le calendrier hebdomadaire.",
          projectId: "proj-1",
          priority: "high",
          completed: false,
          deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
          plannedDate: new Date().toISOString().slice(0, 10),
          order: 1,
          createdAt: new Date().toISOString(),
          subtasks: [
            {
              id: "task-1-1",
              title: "Sous-tâche de niveau 1 : Observer l'arborescence",
              description: "Les sous-tâches peuvent avoir leurs propres sous-tâches sans limite de profondeur.",
              projectId: "proj-1",
              priority: "medium",
              completed: false,
              deadline: null,
              plannedDate: new Date().toISOString().slice(0, 10),
              order: 1,
              createdAt: new Date().toISOString(),
              subtasks: [
                {
                  id: "task-1-1-1",
                  title: "Sous-sous-tâche de niveau 2 : Vérifier la persistance",
                  description: "Toutes les modifications sont enregistrées immédiatement.",
                  projectId: "proj-1",
                  priority: "low",
                  completed: true,
                  deadline: null,
                  plannedDate: null,
                  order: 1,
                  createdAt: new Date().toISOString(),
                  subtasks: []
                }
              ]
            }
          ]
        }
      ]);
    }
    if (!this.getEvents().length) {
      const today = new Date().toISOString().slice(0, 10);
      this.saveEvents([
        { id: "evt-1", title: "Prise en main d'Antigravité", start: `${today}T14:00`, end: `${today}T15:30`, color: "#3b82f6", taskId: "task-1", source: "local" },
        { id: "evt-2", title: "Événement chevauchant (Test de non-blocage)", start: `${today}T14:45`, end: `${today}T16:15`, color: "#8b5cf6", taskId: null, source: "local" }
      ]);
    }
  },

  // Cache en mémoire pour lectures ultra-rapides sans désérialisation JSON répétée
  _cache: {},

  clearCache() {
    this._cache = {};
  },

  // Tâches
  getTasks() {
    if (this._cache.tasks) return this._cache.tasks;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.TASKS) : null;
      this._cache.tasks = raw ? JSON.parse(raw) : [];
    } catch { this._cache.tasks = []; }
    return this._cache.tasks;
  },
  saveTasks(tasks) {
    this._cache.tasks = tasks;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.TASKS, JSON.stringify(tasks));
    }
  },

  // Projets
  getProjects() {
    if (this._cache.projects) return this._cache.projects;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.PROJECTS) : null;
      this._cache.projects = raw ? JSON.parse(raw) : [];
    } catch { this._cache.projects = []; }
    return this._cache.projects;
  },
  saveProjects(projects) {
    this._cache.projects = projects;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
    }
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
    if (this._cache.events) return this._cache.events;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.EVENTS) : null;
      this._cache.events = raw ? JSON.parse(raw) : [];
    } catch { this._cache.events = []; }
    return this._cache.events;
  },
  saveEvents(events) {
    this._cache.events = events;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.EVENTS, JSON.stringify(events));
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      const activeDate = (window.AgendaManager && window.AgendaManager.activeDateStr) ? window.AgendaManager.activeDateStr : null;
      window.App.updateSidebarDayProgress(activeDate);
    }
  },

  // Notes
  getNotes() {
    if (this._cache.notes) return this._cache.notes;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.NOTES) : null;
      this._cache.notes = raw ? JSON.parse(raw) : [];
    } catch { this._cache.notes = []; }
    return this._cache.notes;
  },
  saveNotes(notes) {
    this._cache.notes = notes;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.NOTES, JSON.stringify(notes));
    }
  },

  DEFAULT_SETTINGS: {
    theme: 'dark',           // 'dark' | 'light' | 'oled'
    accentColor: 'blue',     // 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'cyan' | 'orange' | 'mint' | 'indigo'
    density: 'comfortable',  // 'comfortable' | 'compact'
    fontSize: 'normal',      // 'small' | 'normal' | 'large'
    fontFamily: 'system',    // 'system' | 'tech' | 'rounded'
    borderRadius: 'modern',  // 'minimal' | 'modern' | 'soft'
    glassStyle: 'balanced',  // 'balanced' | 'glass' | 'solid'
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
    sidebarDayProgressEnabled: true, // Afficher la progression de la journée sous les onglets à gauche
    sidebarMiniPlayerEnabled: true,  // Afficher le mini-lecteur de musique dans le volet latéral
    sidebarStickyNoteEnabled: true,  // Afficher le module Post-it mémo dans le volet latéral
    sidebarVisibleScreens: {
      tasks: true,
      projects: true,
      agenda: true,
      notes: true,
      focus: true,
      music: true,
      trash: true,
      backups: true
    },
    userName: '',            // Prénom ou nom d'usage de la personne
    greetingMood: 'mixed',   // 'mixed' | 'warm' | 'witty' | 'custom'
    customGreetingPhrase: '', // Phrase personnalisée sur-mesure (si mode custom)
    // Paramètres sérieux (réglages d'usine = comportement normal d'Antigravité)
    performanceMode: 'normal',        // 'normal' | 'economy' | 'potato'
    launchOnStartup: false,           // Lancement automatique au démarrage Windows
    runInBackgroundOnClose: true,     // Rester actif dans la zone de notification à la fermeture
    autoBackupFrequencyHours: 24,     // Intervalle en heures (0 = désactivé / manuel uniquement)
    backupRetentionCount: 20,         // Nombre maximal d'instantanés conservés
    backupDirectory: null,            // Dossier personnalisé (null = défaut AppData)
    disableAnimations: false,         // Indépendant des profils : désactive les animations CSS/JS
    disablePreviews: false,           // Indépendant des profils : désactive les aperçus dynamiques
    disableHoverEffects: false        // Indépendant des profils : désactive les effets au survol
  },

  SERIOUS_SETTING_KEYS: [
    'performanceMode',
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

  getStorageStats() {
    let localStorageBytes = 0;
    const breakdown = {};
    const byteLen = (str) => {
      if (!str) return 0;
      if (typeof Blob !== 'undefined') return new Blob([str]).size;
      if (typeof Buffer !== 'undefined') return Buffer.byteLength(str, 'utf8');
      return str.length * 2;
    };

    if (typeof localStorage !== 'undefined') {
      Object.keys(this.KEYS).forEach((name) => {
        const key = this.KEYS[name];
        const raw = localStorage.getItem(key);
        const bytes = byteLen(raw);
        breakdown[name] = bytes;
        localStorageBytes += bytes;
      });
    }

    return {
      localStorageBytes,
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

  // Préférences
  getSettings() {
    if (this._cache.settings) return this._cache.settings;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.KEYS.SETTINGS) : null;
      const parsed = raw ? JSON.parse(raw) : {};
      this._cache.settings = Object.assign({}, this.DEFAULT_SETTINGS, parsed);
    } catch {
      this._cache.settings = Object.assign({}, this.DEFAULT_SETTINGS);
    }
    return this._cache.settings;
  },
  saveSettings(settings) {
    this._cache.settings = settings;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    }
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
    this._cache.trash = trash;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.KEYS.TRASH, JSON.stringify(trash));
    }
  },

  // Export complet de toutes les données dans un seul objet
  getFullExport() {
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: this.getTasks(),
      projects: this.getProjects(),
      events: this.getEvents(),
      notes: this.getNotes(),
      settings: this.getSettings(),
      trash: this.getTrash()
    };
  },

  // Restauration d'un export complet
  restoreFullExport(data) {
    if (!data || typeof data !== 'object') throw new Error("Format de sauvegarde invalide.");
    this.clearCache();
    if (data.tasks) this.saveTasks(data.tasks);
    if (data.projects) this.saveProjects(data.projects);
    if (data.events) this.saveEvents(data.events);
    if (data.notes) this.saveNotes(data.notes);
    if (data.settings) this.saveSettings(data.settings);
    if (data.trash) this.saveTrash(data.trash);
    return true;
  }
};

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
