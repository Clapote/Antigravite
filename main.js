const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, session, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const googleAuth = require('./services/google-auth-service');
const googleCalendar = require('./services/google-calendar-service');
const updateService = require('./services/update-service');

app.setName('Antigravite');

// Définir l'AppUserModelId pour garantir la délivrance des notifications Windows et l'association de l'icône dans la barre des tâches
if (process.platform === 'win32') {
  app.setAppUserModelId('fr.antigravite.app');
}

// Mode isolé pour les tests de développement sans conflit avec l'application installée
if (process.argv.includes('--isolated') || process.env.ANTIGRAVITE_ISOLATED) {
  const isolatedDir = path.join(app.getPath('temp'), 'antigravite-test-profile');
  app.setPath('userData', isolatedDir);
}

// Instance unique (Single Instance Lock)
// Évite les doublons de processus et réaffiche la fenêtre existante si l'utilisateur
// relance Antigravité depuis le menu Démarrer ou un raccourci de bureau.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    restoreAndFocusWindow();
  });
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

/**
 * Réaffiche et donne le focus à la fenêtre principale existante sans la recréer,
 * préservant ainsi l'intégralité de son état (navigation, saisies, formulaires).
 */
function restoreAndFocusWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

/**
 * Bascule l'affichage de l'application (Masquer / Afficher et focus)
 * Déclenché notamment par le raccourci global Ctrl+Shift+A.
 */
function toggleAppVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    restoreAndFocusWindow();
  } else if (mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.focus();
  }
}

function getAppIconPath() {
  const fsSync = require('node:fs');
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  if (process.platform === 'win32' && fsSync.existsSync(icoPath)) {
    return icoPath;
  }
  return path.join(__dirname, 'assets', 'icon.png');
}

/**
 * Crée l'icône dans la zone de notification Windows (System Tray)
 * avec raccourci d'ouverture et commande de fermeture définitive.
 */
function createTray() {
  if (tray) return;

  try {
    const iconPath = getAppIconPath();
    const trayImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayImage);
    tray.setToolTip('Antigravité');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ouvrir Antigravité',
        click: () => restoreAndFocusWindow()
      },
      { type: 'separator' },
      {
        label: 'Quitter Antigravité',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      restoreAndFocusWindow();
    });

    tray.on('double-click', () => {
      restoreAndFocusWindow();
    });
  } catch (err) {
    console.warn('[Tray] Erreur création icône de notification Windows:', err.message);
  }
}

function createWindow() {
  // Supprimer définitivement la barre de menus par défaut (File, Edit, View...)
  Menu.setApplicationMenu(null);

  const appIconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'Antigravité',
    icon: appIconPath,
    backgroundColor: '#0b0f17',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#131926',
      symbolColor: '#94a3b8',
      height: 48
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true
    }
  });

  if (process.platform === 'win32') {
    try {
      mainWindow.setIcon(appIconPath);
    } catch (e) {
      console.warn('[Window] setIcon fallback:', e.message);
    }
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Intercepter l'événement 'close' pour masquer la fenêtre au lieu de détruire le processus
  // Comportement similaire à ChatGPT Desktop : l'application reste active en tâche de fond.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =========================================================================
// IPC SAUVEGARDES LOCALES PHYSIQUES
// =========================================================================

ipcMain.handle('antigravite:save-backup', async (_event, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Les données de sauvegarde sont invalides.');
  }

  const backupDirectory = path.join(app.getPath('userData'), 'backups');
  await fs.mkdir(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `antigravite_backup_${timestamp}.json`;
  const destination = path.join(backupDirectory, filename);

  await fs.writeFile(destination, JSON.stringify(data, null, 2), {
    encoding: 'utf8',
    flag: 'wx'
  });

  return {
    filename,
    path: destination
  };
});

ipcMain.handle('antigravite:list-backups', async () => {
  const backupDirectory = path.join(app.getPath('userData'), 'backups');

  await fs.mkdir(backupDirectory, { recursive: true });

  const files = await fs.readdir(backupDirectory, {
    withFileTypes: true
  });

  const backups = await Promise.all(
    files
      .filter(file =>
        file.isFile() &&
        /^antigravite_backup_.*\.json$/i.test(file.name)
      )
      .map(async file => {
        const fullPath = path.join(backupDirectory, file.name);
        const stats = await fs.stat(fullPath);

        return {
          filename: file.name,
          path: fullPath,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
  );

  return backups.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
});

ipcMain.handle('antigravite:read-backup', async (_event, filenameOrPath) => {
  if (!filenameOrPath || typeof filenameOrPath !== 'string') {
    throw new Error('Nom de fichier ou chemin de sauvegarde invalide.');
  }

  const backupDirectory = path.join(app.getPath('userData'), 'backups');
  let targetPath;
  if (path.isAbsolute(filenameOrPath)) {
    targetPath = path.resolve(filenameOrPath);
    const resolvedBackupDir = path.resolve(backupDirectory);
    if (!targetPath.startsWith(resolvedBackupDir)) {
      throw new Error('Accès interdit en dehors du répertoire des sauvegardes.');
    }
  } else {
    const safeName = path.basename(filenameOrPath);
    targetPath = path.join(backupDirectory, safeName);
  }

  const content = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(content);
});

// =========================================================================
// IPC GOOGLE AGENDA (PHASE 2 - AUTHENTIFICATION ET LECTURE SEULE)
// =========================================================================

ipcMain.handle('antigravite:google-get-status', async () => {
  return googleAuth.getStatus();
});

ipcMain.handle('antigravite:google-save-credentials', async (_event, { clientId, clientSecret }) => {
  return googleAuth.saveCredentials(clientId, clientSecret);
});

ipcMain.handle('antigravite:google-start-login', async () => {
  return googleAuth.startLogin();
});

ipcMain.handle('antigravite:google-disconnect', async () => {
  return googleAuth.disconnect();
});

ipcMain.handle('antigravite:google-list-calendars', async () => {
  return googleAuth.listCalendars();
});

ipcMain.handle('antigravite:google-select-calendar', async (_event, { calendarId, calendarSummary }) => {
  return googleAuth.selectCalendar(calendarId, calendarSummary);
});

ipcMain.handle('antigravite:google-fetch-events', async (_event, options) => {
  return googleCalendar.fetchEvents(options || {});
});

ipcMain.handle('antigravite:google-create-event', async (_event, eventData) => {
  return googleCalendar.createEvent(eventData);
});

ipcMain.handle('antigravite:google-update-event', async (_event, { googleId, eventData, calendarId, expectedEtag }) => {
  return googleCalendar.updateEvent(googleId, eventData, calendarId, expectedEtag);
});

ipcMain.handle('antigravite:google-delete-event', async (_event, { googleId, calendarId }) => {
  return googleCalendar.deleteEvent(googleId, calendarId);
});

ipcMain.handle('antigravite:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('antigravite:set-title-bar-overlay', async (_event, options) => {
  if (mainWindow && typeof mainWindow.setTitleBarOverlay === 'function') {
    try {
      mainWindow.setTitleBarOverlay(options);
      return true;
    } catch (e) {
      console.warn("Échec setTitleBarOverlay:", e.message);
      return false;
    }
  }
  return false;
});

// Fermeture volontaire via IPC
ipcMain.handle('antigravite:quit-app', async () => {
  isQuitting = true;
  app.quit();
  return true;
});

// Notifications Windows natives
ipcMain.handle('antigravite:show-notification', async (_event, options) => {
  if (!options || typeof options !== 'object') return false;
  if (!Notification.isSupported()) return false;

  try {
    const notif = new Notification({
      title: options.title || 'Antigravité - Agenda',
      body: options.body || '',
      urgency: 'normal',
      silent: false
    });

    notif.on('click', () => {
      restoreAndFocusWindow();
    });

    notif.show();
    return true;
  } catch (err) {
    console.warn("[Notification] Erreur affichage notification Windows :", err.message);
    return false;
  }
});

// =========================================================================
// IPC MISES À JOUR AUTOMATIQUES (SERVICES/UPDATE-SERVICE)
// =========================================================================

ipcMain.handle('antigravite:get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('antigravite:updater-get-status', () => {
  return updateService.getStatus();
});

ipcMain.handle('antigravite:updater-check', async (_event, force = false) => {
  return updateService.checkForUpdates(force);
});

ipcMain.handle('antigravite:updater-download', async () => {
  return updateService.downloadUpdate();
});

ipcMain.handle('antigravite:updater-install', async () => {
  isQuitting = true;
  updateService.quitAndInstall(false, true);
  return true;
});

// =========================================================================
// CYCLE DE VIE DE L'APPLICATION
// =========================================================================

app.on('before-quit', () => {
  isQuitting = true;
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy();
    } catch (_) {}
    tray = null;
  }
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  // Configuration du correcteur orthographique pour les saisies (Français et Anglais)
  try {
    if (session && session.defaultSession && typeof session.defaultSession.setSpellCheckerLanguages === 'function') {
      session.defaultSession.setSpellCheckerLanguages(['fr', 'en-US']);
    }
  } catch (err) {
    console.warn('[Spellcheck] Erreur de configuration de la langue orthographique:', err.message);
  }

  try {
    await googleAuth.init();
  } catch (err) {
    console.error("Erreur initialisation Google Auth:", err);
  }

  // Initialisation du service de mise à jour automatique sans blocage réseau au démarrage
  try {
    updateService.init({
      app,
      onBeforeQuitInstall: () => {
        isQuitting = true;
        if (tray && !tray.isDestroyed()) {
          try { tray.destroy(); } catch (_) {}
          tray = null;
        }
      }
    });

    updateService.on('status-changed', (data) => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('antigravite:updater-status-changed', data);
      }
    });
  } catch (err) {
    console.error("Erreur initialisation UpdateService:", err);
  }

  createWindow();
  createTray();

  // Enregistrement du raccourci global Ctrl+Shift+A pour afficher/masquer l'application
  try {
    if (globalShortcut && typeof globalShortcut.register === 'function') {
      const registered = globalShortcut.register('CommandOrControl+Shift+A', () => {
        toggleAppVisibility();
      });
      if (!registered) {
        console.warn('[Shortcut] Impossible d\'enregistrer CommandOrControl+Shift+A');
      }
    }
  } catch (err) {
    console.warn('[Shortcut] Erreur configuration raccourci global :', err.message);
  }

  app.on('activate', () => {
    restoreAndFocusWindow();
  });
});

app.on('will-quit', () => {
  try {
    if (globalShortcut && typeof globalShortcut.unregisterAll === 'function') {
      globalShortcut.unregisterAll();
    }
  } catch (_) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
