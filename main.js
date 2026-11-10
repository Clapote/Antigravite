const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, session, globalShortcut, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const googleAuth = require('./services/google-auth-service');
const googleCalendar = require('./services/google-calendar-service');
const updateService = require('./services/update-service');

app.setName('Antigravite');

// Définir l'AppUserModelId pour garantir la délivrance des notifications Windows et l'association de l'icône dans la barre des tâches
if (process.platform === 'win32') {
  app.setAppUserModelId('fr.antigravite.app');
}

// Optimisations matérielles GPU & moteur de rendu Chromium
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

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
let desktopPrefs = {
  runInBackgroundOnClose: true,
  backupDirectory: null,
  launchOnStartup: false
};

function getDesktopPrefsPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPrefsSync() {
  try {
    const fsSync = require('node:fs');
    const prefsPath = getDesktopPrefsPath();
    if (fsSync.existsSync(prefsPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(prefsPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        desktopPrefs = {
          runInBackgroundOnClose: parsed.runInBackgroundOnClose !== false,
          backupDirectory: (typeof parsed.backupDirectory === 'string' && parsed.backupDirectory.trim()) ? parsed.backupDirectory.trim() : null,
          launchOnStartup: !!parsed.launchOnStartup
        };
      }
    }
  } catch (err) {
    console.warn('[DesktopPrefs] Erreur lecture préférences bureau:', err.message);
  }
  return desktopPrefs;
}

async function saveDesktopPrefs(patch = {}) {
  desktopPrefs = {
    runInBackgroundOnClose: patch.runInBackgroundOnClose !== undefined ? (patch.runInBackgroundOnClose !== false) : (desktopPrefs.runInBackgroundOnClose !== false),
    backupDirectory: patch.backupDirectory !== undefined
      ? ((typeof patch.backupDirectory === 'string' && patch.backupDirectory.trim()) ? patch.backupDirectory.trim() : null)
      : desktopPrefs.backupDirectory,
    launchOnStartup: patch.launchOnStartup !== undefined ? !!patch.launchOnStartup : !!desktopPrefs.launchOnStartup
  };
  try {
    const prefsPath = getDesktopPrefsPath();
    await fs.mkdir(path.dirname(prefsPath), { recursive: true });
    await fs.writeFile(prefsPath, JSON.stringify(desktopPrefs, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DesktopPrefs] Erreur écriture préférences bureau:', err.message);
  }
  return desktopPrefs;
}

function getDefaultBackupDirectory() {
  return path.join(app.getPath('userData'), 'backups');
}

function getActiveBackupDirectory() {
  if (typeof desktopPrefs.backupDirectory === 'string' && desktopPrefs.backupDirectory.trim()) {
    return path.resolve(desktopPrefs.backupDirectory.trim());
  }
  return getDefaultBackupDirectory();
}

function isPathInsideDir(targetPath, rootDir) {
  const rel = path.relative(path.resolve(rootDir), path.resolve(targetPath));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function listBackupFilesInDir(backupDirectory) {
  await fs.mkdir(backupDirectory, { recursive: true });
  const files = await fs.readdir(backupDirectory, { withFileTypes: true });
  const backups = await Promise.all(
    files
      .filter(file => file.isFile() && /^antigravite_backup_.*\.json$/i.test(file.name))
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
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function applyWindowsLoginItem(enabled) {
  if (process.platform !== 'win32') {
    return { supported: false, enabled: false, isPackaged: app.isPackaged };
  }
  const settings = {
    openAtLogin: !!enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  };
  app.setLoginItemSettings(settings);
  const actual = app.getLoginItemSettings({
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  });
  return {
    supported: true,
    enabled: !!actual.openAtLogin,
    isPackaged: app.isPackaged
  };
}

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
    show: false, // Optimisation : affichage fluide sans flash blanc
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
      spellcheck: true,
      backgroundThrottling: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
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

  // Comportement à la fermeture de la fenêtre : soit rester actif dans le tray, soit quitter complètement
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      if (desktopPrefs.runInBackgroundOnClose !== false) {
        event.preventDefault();
        mainWindow.hide();
      } else {
        isQuitting = true;
      }
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

  const backupDirectory = getActiveBackupDirectory();
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
  return listBackupFilesInDir(getActiveBackupDirectory());
});

ipcMain.handle('antigravite:read-backup', async (_event, filenameOrPath) => {
  if (!filenameOrPath || typeof filenameOrPath !== 'string') {
    throw new Error('Nom de fichier ou chemin de sauvegarde invalide.');
  }

  const activeDir = getActiveBackupDirectory();
  const defaultDir = getDefaultBackupDirectory();
  let targetPath;
  if (path.isAbsolute(filenameOrPath)) {
    targetPath = path.resolve(filenameOrPath);
    if (!isPathInsideDir(targetPath, activeDir) && !isPathInsideDir(targetPath, defaultDir)) {
      throw new Error('Accès interdit en dehors du répertoire des sauvegardes.');
    }
  } else {
    const safeName = path.basename(filenameOrPath);
    targetPath = path.join(activeDir, safeName);
  }

  const content = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(content);
});

ipcMain.handle('antigravite:delete-backup-file', async (_event, filenameOrPath) => {
  if (!filenameOrPath || typeof filenameOrPath !== 'string') {
    return { deleted: false };
  }
  const activeDir = getActiveBackupDirectory();
  const defaultDir = getDefaultBackupDirectory();
  let targetPath;
  if (path.isAbsolute(filenameOrPath)) {
    targetPath = path.resolve(filenameOrPath);
    if (!isPathInsideDir(targetPath, activeDir) && !isPathInsideDir(targetPath, defaultDir)) {
      throw new Error('Accès interdit en dehors du répertoire des sauvegardes.');
    }
  } else {
    targetPath = path.join(activeDir, path.basename(filenameOrPath));
  }
  if (!/^antigravite_backup_.*\.json$/i.test(path.basename(targetPath))) {
    return { deleted: false };
  }
  try {
    await fs.unlink(targetPath);
    return { deleted: true, path: targetPath };
  } catch (err) {
    if (err && err.code === 'ENOENT') return { deleted: false };
    throw err;
  }
});

ipcMain.handle('antigravite:prune-backups', async (_event, maxCount) => {
  const limit = Math.max(1, parseInt(maxCount, 10) || 20);
  const activeDir = getActiveBackupDirectory();
  const backups = await listBackupFilesInDir(activeDir);
  const toDelete = backups.slice(limit);
  const removedFilenames = [];
  for (const item of toDelete) {
    try {
      await fs.unlink(item.path);
      removedFilenames.push(item.filename);
    } catch (err) {
      console.warn('[Backup] Impossible de supprimer ancienne sauvegarde:', item.filename, err.message);
    }
  }
  return {
    removedCount: removedFilenames.length,
    remainingCount: backups.length - removedFilenames.length,
    removedFilenames
  };
});

ipcMain.handle('antigravite:get-backup-directory', () => {
  const activeDir = getActiveBackupDirectory();
  const defaultDir = getDefaultBackupDirectory();
  return {
    activeDir,
    defaultDir,
    isCustom: path.resolve(activeDir) !== path.resolve(defaultDir)
  };
});

ipcMain.handle('antigravite:select-backup-directory', async () => {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow();
  const previousDir = getActiveBackupDirectory();
  const result = await dialog.showOpenDialog(win, {
    title: 'Choisir le dossier des sauvegardes Antigravité',
    defaultPath: previousDir,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return { canceled: true, activeDir: previousDir, defaultDir: getDefaultBackupDirectory() };
  }
  const chosenDir = path.resolve(result.filePaths[0]);
  await fs.mkdir(chosenDir, { recursive: true });
  await saveDesktopPrefs({ backupDirectory: chosenDir });
  return {
    canceled: false,
    previousDir,
    activeDir: chosenDir,
    defaultDir: getDefaultBackupDirectory()
  };
});

ipcMain.handle('antigravite:reset-backup-directory', async () => {
  const previousDir = getActiveBackupDirectory();
  await saveDesktopPrefs({ backupDirectory: null });
  const defaultDir = getDefaultBackupDirectory();
  return {
    previousDir,
    activeDir: defaultDir,
    defaultDir
  };
});

ipcMain.handle('antigravite:open-backup-directory', async () => {
  const dir = getActiveBackupDirectory();
  await fs.mkdir(dir, { recursive: true });
  const errMsg = await shell.openPath(dir);
  return { ok: !errMsg, path: dir, error: errMsg || null };
});

ipcMain.handle('antigravite:copy-backups-to-directory', async (_event, { fromDir, toDir } = {}) => {
  if (!fromDir || !toDir || typeof fromDir !== 'string' || typeof toDir !== 'string') {
    throw new Error('Chemins de sauvegarde invalides.');
  }
  const srcResolved = path.resolve(fromDir);
  const dstResolved = path.resolve(toDir);
  if (srcResolved === dstResolved) {
    return { copied: 0, skipped: 0 };
  }
  await fs.mkdir(dstResolved, { recursive: true });
  const sourceBackups = await listBackupFilesInDir(srcResolved);
  let copied = 0;
  let skipped = 0;
  for (const item of sourceBackups) {
    const destPath = path.join(dstResolved, item.filename);
    try {
      await fs.copyFile(item.path, destPath, fs.constants.COPYFILE_EXCL);
      copied++;
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        skipped++;
      } else {
        console.warn('[Backup] Erreur copie sauvegarde:', item.filename, err.message);
      }
    }
  }
  return { copied, skipped };
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

// =========================================================================
// IPC LECTEUR DE MUSIQUE & AMBIANCE LOCALE
// =========================================================================

/**
 * Retourne le chemin du dossier persistant « musique personnelle » situé dans userData.
 * Crée le dossier de manière synchrone et récursive s'il n'existe pas encore.
 */
function getPersonalMusicDir() {
  const dir = path.join(app.getPath('userData'), 'musique personnelle');
  const fsSync = require('node:fs');
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Copie de manière sécurisée et atomique une liste de fichiers audio vers le dossier « musique personnelle ».
 * Règles impératives :
 * 1. Les fichiers sources ne sont JAMAIS déplacés, modifiés ou supprimés (copie stricte en lecture seule).
 * 2. Détection des doublons : si un fichier du même nom et de taille identique existe déjà dans le dossier cible,
 *    il n'est pas recopié et est comptabilisé comme doublon.
 * 3. En cas de même nom mais de contenu différent (taille distincte), un nom unique est généré : nom (1).ext.
 * 4. Prévention des copies partielles : copie dans un fichier temporaire puis renommage atomique avec vérification de taille.
 * 5. Seuls les formats audio autorisés sont traités.
 */
function copyMusicFilesToPersonalFolder(filePaths) {
  const fsSync = require('node:fs');
  const allowedExts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.weba']);
  const personalDir = getPersonalMusicDir();

  const results = {
    copied: [],
    duplicates: [],
    errors: []
  };

  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return results;
  }

  for (const rawPath of filePaths) {
    const srcPath = typeof rawPath === 'string' ? rawPath.trim() : '';
    if (!srcPath) continue;

    try {
      if (!fsSync.existsSync(srcPath)) {
        results.errors.push({ file: srcPath, error: 'Fichier introuvable sur le disque.' });
        continue;
      }

      const srcStat = fsSync.statSync(srcPath);
      if (!srcStat.isFile()) {
        results.errors.push({ file: srcPath, error: 'Le chemin ne correspond pas à un fichier valide.' });
        continue;
      }

      const ext = path.extname(srcPath).toLowerCase();
      if (!allowedExts.has(ext)) {
        results.errors.push({ file: path.basename(srcPath), error: `Format audio non pris en charge (${ext || 'inconnu'}).` });
        continue;
      }

      const baseFileName = path.basename(srcPath);
      const nameWithoutExt = path.basename(srcPath, ext);

      // Vérification des collisions de nom et des doublons stricts
      let finalTargetName = baseFileName;
      let finalTargetPath = path.join(personalDir, finalTargetName);
      let isDuplicate = false;

      if (fsSync.existsSync(finalTargetPath)) {
        const existingStat = fsSync.statSync(finalTargetPath);
        if (existingStat.size === srcStat.size) {
          // Même nom et même taille : fichier déjà présent dans la bibliothèque
          results.duplicates.push({ filename: baseFileName, path: finalTargetPath, reason: 'identical_file' });
          continue;
        }

        // Même nom mais taille différente : générer un nom non-bloquant "nom (1).ext"
        let counter = 1;
        while (true) {
          const candidateName = `${nameWithoutExt} (${counter})${ext}`;
          const candidatePath = path.join(personalDir, candidateName);
          if (fsSync.existsSync(candidatePath)) {
            const candStat = fsSync.statSync(candidatePath);
            if (candStat.size === srcStat.size) {
              isDuplicate = true;
              results.duplicates.push({ filename: candidateName, path: candidatePath, reason: 'identical_file' });
              break;
            }
            counter++;
          } else {
            finalTargetName = candidateName;
            finalTargetPath = candidatePath;
            break;
          }
        }

        if (isDuplicate) continue;
      }

      // Copie atomique et sécurisée via un fichier temporaire
      const tempFileName = `.import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
      const tempFilePath = path.join(personalDir, tempFileName);

      try {
        fsSync.copyFileSync(srcPath, tempFilePath);
        const tempStat = fsSync.statSync(tempFilePath);
        if (tempStat.size !== srcStat.size) {
          try { fsSync.unlinkSync(tempFilePath); } catch (_) {}
          results.errors.push({ file: baseFileName, error: 'Copie incomplète : la taille sur disque ne correspond pas.' });
          continue;
        }
        // Renommage atomique vers le nom définitif
        fsSync.renameSync(tempFilePath, finalTargetPath);

        results.copied.push({
          filename: finalTargetName,
          title: nameWithoutExt,
          path: finalTargetPath,
          size: srcStat.size
        });
      } catch (copyErr) {
        try {
          if (fsSync.existsSync(tempFilePath)) fsSync.unlinkSync(tempFilePath);
        } catch (_) {}
        results.errors.push({ file: baseFileName, error: copyErr.message || 'Erreur lors de la copie physique du fichier.' });
      }
    } catch (err) {
      results.errors.push({ file: path.basename(srcPath), error: err.message || 'Erreur inattendue.' });
    }
  }

  return results;
}

ipcMain.handle('antigravite:open-music-folder', async () => {
  let musicDir = path.join(__dirname, 'music');
  const fsSync = require('node:fs');
  const unpackedDir = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'music');
  if (fsSync.existsSync(unpackedDir)) {
    musicDir = unpackedDir;
  }
  if (!fsSync.existsSync(musicDir)) {
    fsSync.mkdirSync(musicDir, { recursive: true });
  }
  await shell.openPath(musicDir);
  return musicDir;
});

ipcMain.handle('antigravite:open-personal-music-folder', async () => {
  const personalDir = getPersonalMusicDir();
  await shell.openPath(personalDir);
  return personalDir;
});

ipcMain.handle('antigravite:get-personal-music-path', () => {
  return getPersonalMusicDir();
});

ipcMain.handle('antigravite:select-and-copy-music', async () => {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Sélectionner des morceaux de musique',
    buttonLabel: 'Importer dans Antigravité',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Fichiers audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'weba'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true, copied: [], duplicates: [], errors: [] };
  }

  const copyResult = copyMusicFilesToPersonalFolder(result.filePaths);
  return { canceled: false, ...copyResult };
});

ipcMain.handle('antigravite:copy-music-files', async (_event, filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { canceled: false, copied: [], duplicates: [], errors: [] };
  }
  const copyResult = copyMusicFilesToPersonalFolder(filePaths);
  return { canceled: false, ...copyResult };
});

ipcMain.handle('antigravite:list-local-music', async () => {
  const fsSync = require('node:fs');
  const allowedExts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.weba']);
  const tracks = [];

  // Mappage des dossiers de catégories et métadonnées prédéfinis
  const tracksJsonPath = path.join(__dirname, 'data', 'music-tracks.json');
  const infoMap = {};
  if (fsSync.existsSync(tracksJsonPath)) {
    try {
      const savedTracks = JSON.parse(fsSync.readFileSync(tracksJsonPath, 'utf8'));
      if (Array.isArray(savedTracks)) {
        savedTracks.forEach(t => {
          if (t.filename) infoMap[t.filename] = t;
        });
      }
    } catch (_e) {}
  }

  const personalDir = getPersonalMusicDir();
  const unpackedDir = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'music');
  const bundledMusicDir = fsSync.existsSync(unpackedDir) ? unpackedDir : path.join(__dirname, 'music');

  const candidates = [
    { dir: bundledMusicDir, prefix: './music/', defaultFolder: 'Focus, Rituals & Daily Routines', type: 'local' },
    { dir: path.join(__dirname, 'assets', 'music'), prefix: './assets/music/', defaultFolder: 'Focus, Rituals & Daily Routines', type: 'local' },
    { dir: personalDir, prefix: null, defaultFolder: 'Musique personnelle', type: 'personal' }
  ];

  for (const item of candidates) {
    if (fsSync.existsSync(item.dir)) {
      try {
        const entries = fsSync.readdirSync(item.dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (allowedExts.has(ext)) {
              const baseName = path.basename(entry.name, ext);
              const parts = baseName.split(' - ');
              let artist = (item.type === 'personal') ? 'Musique personnelle' : 'Antigravité Lofi';
              let title = baseName;
              if (parts.length >= 2) {
                artist = parts[0].replace(/^\d+[\s._-]*/, '').trim() || ((item.type === 'personal') ? 'Musique personnelle' : 'Antigravité Lofi');
                title = parts.slice(1).join(' - ').trim();
              } else {
                title = baseName
                  .replace(/[-_]+/g, ' ')
                  .replace(/\b[a-z]/g, char => char.toUpperCase())
                  .trim();
              }
              const fullPath = path.join(item.dir, entry.name);
              const stats = fsSync.statSync(fullPath);
              const meta = infoMap[entry.name] || {};
              const fileUrl = pathToFileURL(fullPath).href;
              const idPrefix = (item.type === 'personal') ? 'personal-' : 'track-';
              tracks.push({
                id: idPrefix + Buffer.from(entry.name).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16),
                filename: entry.name,
                title: title || baseName,
                artist: meta.artist || artist,
                folder: meta.folder || item.defaultFolder || 'Focus, Rituals & Daily Routines',
                duration: meta.duration || 0,
                durationFormatted: meta.durationFormatted || '--:--',
                src: item.prefix ? (item.prefix + encodeURIComponent(entry.name)) : fileUrl,
                fileUrl: fileUrl,
                size: stats.size,
                ext: ext.slice(1).toUpperCase(),
                type: item.type
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Music] Erreur lecture dossier musical:', err.message);
      }
    }
  }
  return tracks;
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

ipcMain.handle('antigravite:toggle-window-visibility', () => {
  toggleAppVisibility();
  return true;
});

// =========================================================================
// IPC SYSTÈME, CACHE, DIAGNOSTIC & DÉMARRAGE (PARAMÈTRES SÉRIEUX)
// =========================================================================

ipcMain.handle('antigravite:get-desktop-prefs', () => {
  let actualLogin = !!desktopPrefs.launchOnStartup;
  const startupSupported = (process.platform === 'win32');
  if (startupSupported) {
    try {
      const loginInfo = app.getLoginItemSettings({
        path: process.execPath,
        args: app.isPackaged ? [] : [app.getAppPath()]
      });
      actualLogin = !!loginInfo.openAtLogin;
    } catch (_) {}
  }
  const activeDir = getActiveBackupDirectory();
  const defaultDir = getDefaultBackupDirectory();
  return {
    runInBackgroundOnClose: desktopPrefs.runInBackgroundOnClose !== false,
    launchOnStartup: actualLogin,
    startupSupported,
    isPackaged: app.isPackaged,
    backupDirectory: desktopPrefs.backupDirectory,
    activeBackupDir: activeDir,
    defaultBackupDir: defaultDir
  };
});

ipcMain.handle('antigravite:set-desktop-prefs', async (_event, prefs = {}) => {
  if (!prefs || typeof prefs !== 'object') return desktopPrefs;
  const updated = await saveDesktopPrefs(prefs);
  if (prefs.launchOnStartup !== undefined && process.platform === 'win32') {
    try {
      applyWindowsLoginItem(prefs.launchOnStartup);
    } catch (err) {
      console.warn('[Startup] Erreur configuration démarrage Windows:', err.message);
    }
  }
  return updated;
});

ipcMain.handle('antigravite:set-startup-setting', async (_event, enabled) => {
  const result = applyWindowsLoginItem(!!enabled);
  await saveDesktopPrefs({ launchOnStartup: result.enabled });
  return result;
});

ipcMain.handle('antigravite:get-cache-stats', async () => {
  let httpCacheBytes = 0;
  try {
    if (session && session.defaultSession && typeof session.defaultSession.getCacheSize === 'function') {
      httpCacheBytes = await session.defaultSession.getCacheSize();
    }
  } catch (err) {
    console.warn('[Cache] Erreur lecture taille cache HTTP:', err.message);
  }
  return {
    httpCacheBytes,
    userDataPath: app.getPath('userData')
  };
});

ipcMain.handle('antigravite:clear-cache', async () => {
  let previousHttpBytes = 0;
  let remainingHttpBytes = 0;
  try {
    if (session && session.defaultSession) {
      if (typeof session.defaultSession.getCacheSize === 'function') {
        previousHttpBytes = await session.defaultSession.getCacheSize();
      }
      if (typeof session.defaultSession.clearCache === 'function') {
        await session.defaultSession.clearCache();
      }
      // Purge cache HTTP / shaders / service workers sans toucher à localStorage ni IndexedDB
      if (typeof session.defaultSession.clearStorageData === 'function') {
        await session.defaultSession.clearStorageData({
          storages: ['cachestorage', 'shadercache', 'serviceworkers']
        });
      }
      if (typeof session.defaultSession.getCacheSize === 'function') {
        remainingHttpBytes = await session.defaultSession.getCacheSize();
      }
    }
  } catch (err) {
    console.warn('[Cache] Erreur vidage du cache:', err.message);
  }
  return {
    clearedBytes: Math.max(0, previousHttpBytes - remainingHttpBytes),
    previousHttpBytes,
    remainingHttpBytes
  };
});

ipcMain.handle('antigravite:get-perf-diagnostics', async () => {
  const metrics = typeof app.getAppMetrics === 'function' ? app.getAppMetrics() : [];
  let totalRamKb = 0;
  let totalCpuPct = 0;
  const processes = metrics.map((m) => {
    const wsKb = m.memory && typeof m.memory.workingSetSize === 'number' ? m.memory.workingSetSize : 0;
    const privKb = m.memory && typeof m.memory.privateBytes === 'number' ? m.memory.privateBytes : 0;
    const cpu = m.cpu && typeof m.cpu.percentCPUUsage === 'number' ? m.cpu.percentCPUUsage : 0;
    totalRamKb += wsKb;
    totalCpuPct += cpu;
    return {
      pid: m.pid,
      type: m.type || 'Process',
      workingSetMb: +(wsKb / 1024).toFixed(1),
      privateMb: +(privKb / 1024).toFixed(1),
      cpuPct: +cpu.toFixed(1)
    };
  });

  let gpuStatus = null;
  try {
    if (typeof app.getGPUFeatureStatus === 'function') {
      gpuStatus = app.getGPUFeatureStatus();
    }
  } catch (_) {}

  return {
    totalRamMb: +(totalRamKb / 1024).toFixed(1),
    totalCpuPct: +totalCpuPct.toFixed(1),
    processCount: processes.length,
    processes,
    uptimeSec: Math.round(process.uptime()),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    gpuCompositing: gpuStatus ? (gpuStatus.gpu_compositing || 'unknown') : 'unknown',
    runInBackgroundOnClose: desktopPrefs.runInBackgroundOnClose !== false
  };
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
  loadDesktopPrefsSync();

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
