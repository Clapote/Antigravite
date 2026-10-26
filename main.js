const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const googleAuth = require('./services/google-auth-service');
const googleCalendar = require('./services/google-calendar-service');

app.setName('Antigravite');

// Définir l'AppUserModelId pour garantir la délivrance des notifications Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.antigravite.app');
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
 * Crée l'icône dans la zone de notification Windows (System Tray)
 * avec raccourci d'ouverture et commande de fermeture définitive.
 */
function createTray() {
  if (tray) return;

  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
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

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'Antigravité',
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
      sandbox: true
    }
  });

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

  try {
    await googleAuth.init();
  } catch (err) {
    console.error("Erreur initialisation Google Auth:", err);
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    restoreAndFocusWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
