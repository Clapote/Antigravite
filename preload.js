const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AntigraviteAPI', Object.freeze({
  getAppVersion: () => ipcRenderer.invoke('antigravite:get-app-version'),

  // Mises à jour automatiques (Services / electron-updater)
  updater: Object.freeze({
    getVersion: () => ipcRenderer.invoke('antigravite:get-app-version'),
    getStatus: () => ipcRenderer.invoke('antigravite:updater-get-status'),
    checkForUpdates: (force) => ipcRenderer.invoke('antigravite:updater-check', !!force),
    downloadUpdate: () => ipcRenderer.invoke('antigravite:updater-download'),
    installUpdate: () => ipcRenderer.invoke('antigravite:updater-install'),
    enableMockMode: () => ipcRenderer.invoke('antigravite:updater-enable-mock'),
    onStatusChanged: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('antigravite:updater-status-changed', handler);
      return () => {
        ipcRenderer.removeListener('antigravite:updater-status-changed', handler);
      };
    },
    onTriggerMockUpdate: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = () => callback();
      ipcRenderer.on('antigravite:trigger-mock-update', handler);
      return () => {
        ipcRenderer.removeListener('antigravite:trigger-mock-update', handler);
      };
    }
  }),

  // Sauvegardes locales physiques
  saveBackup: (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return Promise.reject(new Error('Les données de sauvegarde sont invalides.'));
    }
    return ipcRenderer.invoke('antigravite:save-backup', data);
  },

  readBackup: (filenameOrPath) => {
    if (!filenameOrPath || typeof filenameOrPath !== 'string') {
      return Promise.reject(new Error('Nom de fichier ou chemin de sauvegarde invalide.'));
    }
    return ipcRenderer.invoke('antigravite:read-backup', filenameOrPath);
  },

  listBackups: () => {
    return ipcRenderer.invoke('antigravite:list-backups');
  },

  deleteBackupFile: (filenameOrPath) => {
    if (!filenameOrPath || typeof filenameOrPath !== 'string') {
      return Promise.resolve({ deleted: false });
    }
    return ipcRenderer.invoke('antigravite:delete-backup-file', filenameOrPath);
  },

  pruneBackups: (maxCount) => {
    return ipcRenderer.invoke('antigravite:prune-backups', Number(maxCount));
  },

  getBackupDirectory: () => {
    return ipcRenderer.invoke('antigravite:get-backup-directory');
  },

  selectBackupDirectory: () => {
    return ipcRenderer.invoke('antigravite:select-backup-directory');
  },

  resetBackupDirectory: () => {
    return ipcRenderer.invoke('antigravite:reset-backup-directory');
  },

  openBackupDirectory: () => {
    return ipcRenderer.invoke('antigravite:open-backup-directory');
  },

  copyBackupsToDirectory: (fromDir, toDir) => {
    return ipcRenderer.invoke('antigravite:copy-backups-to-directory', { fromDir, toDir });
  },

  system: Object.freeze({
    getDesktopPrefs: () => ipcRenderer.invoke('antigravite:get-desktop-prefs'),
    setDesktopPrefs: (prefs) => ipcRenderer.invoke('antigravite:set-desktop-prefs', prefs || {}),
    setStartupSetting: (enabled) => ipcRenderer.invoke('antigravite:set-startup-setting', !!enabled),
    getCacheStats: () => ipcRenderer.invoke('antigravite:get-cache-stats'),
    clearCache: () => ipcRenderer.invoke('antigravite:clear-cache'),
    getPerfDiagnostics: () => ipcRenderer.invoke('antigravite:get-perf-diagnostics')
  }),

  openExternal: (url) => {
    return ipcRenderer.invoke('antigravite:open-external', url);
  },

  quitApp: () => {
    return ipcRenderer.invoke('antigravite:quit-app');
  },

  toggleWindow: () => {
    return ipcRenderer.invoke('antigravite:toggle-window-visibility');
  },

  setTitleBarOverlay: (options) => {
    return ipcRenderer.invoke('antigravite:set-title-bar-overlay', options);
  },

  // Notifications Windows
  showNotification: (options) => {
    if (!options || typeof options !== 'object') {
      return Promise.resolve(false);
    }
    return ipcRenderer.invoke('antigravite:show-notification', options);
  },

  // Gestionnaire de Musique & Ambiance
  music: Object.freeze({
    listLocalTracks: () => ipcRenderer.invoke('antigravite:list-local-music'),
    openMusicFolder: () => ipcRenderer.invoke('antigravite:open-music-folder'),
    selectAndCopyMusic: () => ipcRenderer.invoke('antigravite:select-and-copy-music'),
    copyMusicFiles: (filePaths) => ipcRenderer.invoke('antigravite:copy-music-files', filePaths),
    openPersonalMusicFolder: () => ipcRenderer.invoke('antigravite:open-personal-music-folder'),
    getPersonalMusicPath: () => ipcRenderer.invoke('antigravite:get-personal-music-path')
  }),

  // Intégration Google Agenda sécurisée (Phase 2)
  google: Object.freeze({
    getStatus: () => ipcRenderer.invoke('antigravite:google-get-status'),
    saveCredentials: (clientId, clientSecret) => {
      if (!clientId || !clientSecret) return Promise.reject(new Error('Identifiants requis.'));
      return ipcRenderer.invoke('antigravite:google-save-credentials', { clientId, clientSecret });
    },
    startLogin: () => ipcRenderer.invoke('antigravite:google-start-login'),
    disconnect: () => ipcRenderer.invoke('antigravite:google-disconnect'),
    listCalendars: () => ipcRenderer.invoke('antigravite:google-list-calendars'),
    selectCalendar: (calendarId, calendarSummary) => {
      if (!calendarId) return Promise.reject(new Error('ID calendrier requis.'));
      return ipcRenderer.invoke('antigravite:google-select-calendar', { calendarId, calendarSummary });
    },
    fetchEvents: (options) => ipcRenderer.invoke('antigravite:google-fetch-events', options || {}),
    createEvent: (eventData) => ipcRenderer.invoke('antigravite:google-create-event', eventData),
    updateEvent: (googleId, eventData, calendarId, expectedEtag) => ipcRenderer.invoke('antigravite:google-update-event', { googleId, eventData, calendarId, expectedEtag }),
    deleteEvent: (googleId, calendarId) => ipcRenderer.invoke('antigravite:google-delete-event', { googleId, calendarId })
  })
}));
