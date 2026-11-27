const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, session, globalShortcut, dialog, shell, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

// Définir immédiatement le nom d'application et l'isolation éventuelle AVANT l'import des services qui lisent userData
app.setName('Antigravite');

// Mode isolé pour les tests de développement sans conflit avec l'application installée
if (process.argv.includes('--isolated') || process.env.ANTIGRAVITE_ISOLATED) {
  const isolatedDir = path.join(app.getPath('temp'), 'antigravite-test-profile');
  app.setPath('userData', isolatedDir);
}

const googleAuth = require('./services/google-auth-service');
const googleCalendar = require('./services/google-calendar-service');
const updateService = require('./services/update-service');

// Définir l'AppUserModelId pour garantir la délivrance des notifications Windows et l'association de l'icône dans la barre des tâches
if (process.platform === 'win32') {
  app.setAppUserModelId('fr.antigravite.app');
}

// Optimisations matérielles GPU adaptatives selon le matériel et les préférences utilisateur
function readEarlyDesktopGpuPrefs() {
  try {
    const prefsPath = path.join(app.getPath('userData'), 'desktop-preferences.json');
    if (fsSync.existsSync(prefsPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(prefsPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          performanceMode: parsed.performanceMode || 'normal',
          gpuCompatibilityMode: !!parsed.gpuCompatibilityMode
        };
      }
    }
  } catch (_) {}
  return { performanceMode: 'normal', gpuCompatibilityMode: false };
}

const earlyGpuPrefs = readEarlyDesktopGpuPrefs();
if (earlyGpuPrefs.performanceMode !== 'potato' && !earlyGpuPrefs.gpuCompatibilityMode) {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
} else if (earlyGpuPrefs.performanceMode !== 'potato') {
  // Mode compatibilité GPU : évite enable-zero-copy sur certains chipsets Intel/AMD ou VM
  app.commandLine.appendSwitch('enable-gpu-rasterization');
}
app.commandLine.appendSwitch('lang', 'fr-FR');

// Protection globale contre les interruptions inattendues du processus principal
process.on('uncaughtException', (err) => {
  console.error('[Main] Exception non interceptée :', err && (err.stack || err.message || err));
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Main] Rejet de promesse non intercepté :', reason && (reason.stack || reason.message || reason));
});

// Instance unique (Single Instance Lock)
// Évite les doublons de processus et réaffiche la fenêtre existante si l'utilisateur
// relance Antigravité depuis le menu Démarrer ou un raccourci de bureau.
function handleSecondInstance(commandLine) {
  restoreAndFocusWindow();
  if (commandLine && Array.isArray(commandLine) && commandLine.some(arg => typeof arg === 'string' && arg.includes('--mock-update-available'))) {
    if (updateService) {
      updateService.isMockMode = true;
    }
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:trigger-mock-update');
    }
  }
}

let gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // En cas de mise à jour automatique récente, l'ancien processus peut mettre quelques
  // centaines de millisecondes à se terminer complètement. Une brève re-tentative évite
  // que l'utilisateur ne voie l'application se fermer immédiatement.
  setTimeout(() => {
    const retryLock = app.requestSingleInstanceLock();
    if (!retryLock) {
      app.quit();
    } else {
      gotSingleInstanceLock = true;
      app.on('second-instance', (_event, commandLine) => {
        handleSecondInstance(commandLine);
      });
      if (app.isReady()) {
        bootApplication();
      } else {
        app.whenReady().then(bootApplication);
      }
    }
  }, 650);
} else {
  app.on('second-instance', (_event, commandLine) => {
    handleSecondInstance(commandLine);
  });
}

let hasBooted = false;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let desktopPrefs = {
  runInBackgroundOnClose: true,
  backupDirectory: null,
  launchOnStartup: false,
  performanceMode: 'normal',
  gpuCompatibilityMode: false
};

function getDesktopPrefsPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPrefsSync() {
  try {
    const prefsPath = getDesktopPrefsPath();
    if (fsSync.existsSync(prefsPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(prefsPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        desktopPrefs = {
          runInBackgroundOnClose: parsed.runInBackgroundOnClose !== false,
          backupDirectory: (typeof parsed.backupDirectory === 'string' && parsed.backupDirectory.trim()) ? parsed.backupDirectory.trim() : null,
          launchOnStartup: !!parsed.launchOnStartup,
          performanceMode: parsed.performanceMode || 'normal',
          gpuCompatibilityMode: !!parsed.gpuCompatibilityMode
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
    launchOnStartup: patch.launchOnStartup !== undefined ? !!patch.launchOnStartup : !!desktopPrefs.launchOnStartup,
    performanceMode: patch.performanceMode !== undefined ? (patch.performanceMode || 'normal') : (desktopPrefs.performanceMode || 'normal'),
    gpuCompatibilityMode: patch.gpuCompatibilityMode !== undefined ? !!patch.gpuCompatibilityMode : !!desktopPrefs.gpuCompatibilityMode
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

function parseBackupFilenameTimestamp(filename) {
  if (typeof filename !== 'string') return NaN;
  const match = filename.match(/antigravite_backup_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?(Z)?/i);
  if (!match) return NaN;
  const isoStr = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5] || '000'}${match[6] || 'Z'}`;
  return new Date(isoStr).getTime();
}

async function listBackupFilesInDir(backupDirectory) {
  await fs.mkdir(backupDirectory, { recursive: true });
  const files = await fs.readdir(backupDirectory, { withFileTypes: true });
  const matching = files.filter(file => file.isFile() && /^antigravite_backup_.*\.json$/i.test(file.name));
  const settled = await Promise.allSettled(
    matching.map(async file => {
      const fullPath = path.join(backupDirectory, file.name);
      const stats = await fs.stat(fullPath);
      const parsedMs = parseBackupFilenameTimestamp(file.name);
      const createdAt = Number.isFinite(parsedMs)
        ? new Date(parsedMs).toISOString()
        : stats.mtime.toISOString();
      return {
        filename: file.name,
        path: fullPath,
        size: stats.size,
        createdAt
      };
    })
  );
  const backups = settled
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getWindowsStartupShortcutPath() {
  if (process.platform !== 'win32') return null;
  try {
    const appDataDir = app.getPath('appData') || process.env.APPDATA || '';
    if (!appDataDir) return null;
    const startupDir = path.join(appDataDir, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    return path.join(startupDir, 'Antigravite.lnk');
  } catch (_) {
    if (process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Antigravite.lnk');
    }
    return null;
  }
}

/**
 * Résout l'exécutable cible, les arguments et le dossier de travail
 * de manière strictement cohérente pour le raccourci Startup et le registre.
 */
function resolveWindowsStartupTarget() {
  let targetExe = process.execPath;
  let targetArgs = '';
  let regArgs = [];
  let targetCwd = path.dirname(process.execPath);

  if (!app.isPackaged) {
    const installedExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravite', 'Antigravite.exe');
    if (fsSync.existsSync(installedExe)) {
      targetExe = installedExe;
      targetCwd = path.dirname(installedExe);
    } else {
      const appPath = app.getAppPath();
      targetArgs = `"${appPath}"`;
      regArgs = [targetArgs];
      targetCwd = appPath;
    }
  }

  return { targetExe, targetArgs, regArgs, targetCwd };
}

/**
 * Garantit l'inscription/suppression directe dans HKCU\Run et le déblocage
 * StartupApproved (Gestionnaire des tâches Windows) pour le raccourci et le registre.
 */
function syncWindowsRegistryStartup(enabled, targetExe, targetArgs) {
  const REG_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  const REG_APPROVED_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
  const REG_APPROVED_FOLDER_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder';
  let regSuccess = false;

  try {
    if (enabled) {
      const regValueData = targetArgs ? `"${targetExe}" ${targetArgs}` : `"${targetExe}"`;
      execFileSync('reg.exe', ['add', REG_RUN_KEY, '/v', 'Antigravite', '/t', 'REG_SZ', '/d', regValueData, '/f'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 2500
      });
      // Nettoyer une éventuelle ancienne entrée sous AppUserModelId
      try {
        execFileSync('reg.exe', ['delete', REG_RUN_KEY, '/v', 'fr.antigravite.app', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (_) {}
      // Approuver explicitement dans Task Manager / Windows Settings (octet 02 = Activé)
      try {
        execFileSync('reg.exe', ['add', REG_APPROVED_RUN_KEY, '/v', 'Antigravite', '/t', 'REG_BINARY', '/d', '020000000000000000000000', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (_) {}
      try {
        execFileSync('reg.exe', ['add', REG_APPROVED_FOLDER_KEY, '/v', 'Antigravite.lnk', '/t', 'REG_BINARY', '/d', '020000000000000000000000', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (_) {}

      const queryOut = execFileSync('reg.exe', ['query', REG_RUN_KEY, '/v', 'Antigravite'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2000
      });
      regSuccess = Boolean(queryOut && queryOut.includes('Antigravite'));
    } else {
      for (const valueName of ['Antigravite', 'fr.antigravite.app']) {
        try {
          execFileSync('reg.exe', ['delete', REG_RUN_KEY, '/v', valueName, '/f'], {
            windowsHide: true,
            stdio: 'ignore',
            timeout: 2000
          });
        } catch (_) {}
        try {
          execFileSync('reg.exe', ['delete', REG_APPROVED_RUN_KEY, '/v', valueName, '/f'], {
            windowsHide: true,
            stdio: 'ignore',
            timeout: 2000
          });
        } catch (_) {}
      }
      try {
        execFileSync('reg.exe', ['delete', REG_APPROVED_FOLDER_KEY, '/v', 'Antigravite.lnk', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 2000
        });
      } catch (_) {}
      regSuccess = true;
    }
  } catch (err) {
    console.warn('[Startup] Erreur synchronisation reg.exe HKCU\\Run:', err.message);
  }

  return regSuccess;
}

function applyWindowsLoginItem(enabled) {
  if (process.platform !== 'win32') {
    return { supported: false, enabled: false, isPackaged: app.isPackaged };
  }

  const { targetExe, targetArgs, regArgs, targetCwd } = resolveWindowsStartupTarget();
  const shortcutPath = getWindowsStartupShortcutPath();
  let shortcutSuccess = false;

  // 1. Raccourci natif dans le dossier Démarrage Windows (shell:startup)
  // Méthode la plus robuste sur Windows 10 & 11 (insensible aux blocages UAC/SmartScreen sur la base de registre)
  if (shortcutPath) {
    try {
      if (enabled) {
        const appIconPath = getAppIconPath();
        const details = {
          target: targetExe,
          cwd: targetCwd,
          description: 'Antigravité - Application personnelle de gestion locale',
          appUserModelId: 'fr.antigravite.app'
        };
        if (targetArgs) {
          details.args = targetArgs;
        }
        // Windows Explorer ne peut pas lire une icône empaquetée dans app.asar : privilégier un .ico hors asar ou l'exécutable .exe
        if (appIconPath && !appIconPath.includes('.asar') && fsSync.existsSync(appIconPath)) {
          details.icon = appIconPath;
          details.iconIndex = 0;
        } else if (fsSync.existsSync(targetExe)) {
          details.icon = targetExe;
          details.iconIndex = 0;
        }

        const dir = path.dirname(shortcutPath);
        if (!fsSync.existsSync(dir)) {
          fsSync.mkdirSync(dir, { recursive: true });
        }
        const written = shell.writeShortcutLink(shortcutPath, 'create', details);
        shortcutSuccess = Boolean(written && fsSync.existsSync(shortcutPath));
      } else {
        if (fsSync.existsSync(shortcutPath)) {
          fsSync.unlinkSync(shortcutPath);
        }
        shortcutSuccess = !fsSync.existsSync(shortcutPath);
      }
    } catch (err) {
      console.warn('[Startup] Erreur raccourci dossier Démarrage Windows:', err.message);
    }
  }

  // 2. Double sécurité : synchronisation avec l'API Electron native et reg.exe (Registre HKCU\Run + StartupApproved)
  let registrySuccess = false;
  try {
    const settings = {
      openAtLogin: !!enabled,
      enabled: !!enabled,
      path: targetExe,
      name: 'Antigravite',
      args: regArgs
    };
    app.setLoginItemSettings(settings);
    if (!enabled) {
      try {
        app.setLoginItemSettings({
          openAtLogin: false,
          path: targetExe,
          args: regArgs
        });
      } catch (_) {}
    }
    const actual = app.getLoginItemSettings({
      path: targetExe,
      args: regArgs
    });
    registrySuccess = !!(actual && (actual.openAtLogin || actual.executableWillLaunchAtLogin));
  } catch (err) {
    console.warn('[Startup] Erreur app.setLoginItemSettings:', err.message);
  }

  const directRegOk = syncWindowsRegistryStartup(!!enabled, targetExe, targetArgs);
  if (enabled) {
    registrySuccess = registrySuccess || directRegOk;
  }

  const isNowActive = enabled ? (shortcutSuccess || registrySuccess) : false;

  return {
    supported: true,
    enabled: isNowActive,
    shortcutActive: shortcutSuccess,
    registryActive: registrySuccess,
    isPackaged: app.isPackaged
  };
}

/**
 * Réaffiche et donne le focus à la fenêtre principale existante sans la recréer,
 * préservant ainsi l'intégralité de son état (navigation, saisies, formulaires).
 */
function restoreAndFocusWindow() {
  if (!app.isReady()) {
    app.whenReady().then(() => restoreAndFocusWindow());
    return;
  }
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

function getInitialAppearance() {
  try {
    const fsSync = require('node:fs');
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    if (fsSync.existsSync(settingsPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(settingsPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        const theme = parsed.theme || 'dark';
        const density = parsed.density || 'comfortable';
        const isLight = theme === 'light';
        const isOled = theme === 'oled';
        const isCompact = density === 'compact';
        const topBarColor = isLight ? '#ffffff' : (isOled ? '#08080c' : '#131926');
        const symbolColor = isLight ? '#334155' : '#94a3b8';
        const height = isCompact ? 50 : 60;
        return { theme, density, topBarColor, symbolColor, height, isLight };
      }
    }
  } catch (err) {
    console.warn('[Main] Erreur lecture apparence initiale:', err.message);
  }
  return {
    theme: 'dark',
    density: 'comfortable',
    topBarColor: '#131926',
    symbolColor: '#94a3b8',
    height: 60,
    isLight: false
  };
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  // Supprimer définitivement la barre de menus par défaut (File, Edit, View...)
  Menu.setApplicationMenu(null);

  const appIconPath = getAppIconPath();
  const appearance = getInitialAppearance();

  if (nativeTheme) {
    nativeTheme.themeSource = appearance.isLight ? 'light' : 'dark';
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 520,
    show: false, // Optimisation : affichage fluide sans flash blanc
    title: 'Antigravité',
    icon: appIconPath,
    backgroundColor: appearance.topBarColor,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: true
    }
  });

  try {
    if (mainWindow.webContents && mainWindow.webContents.session && typeof mainWindow.webContents.session.setSpellCheckerLanguages === 'function') {
      mainWindow.webContents.session.setSpellCheckerLanguages(['fr-FR', 'fr']);
    }
  } catch (e) {
    console.warn('[Spellcheck] Erreur configuration langue window session:', e.message);
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Sécurité d'affichage : garantit que la fenêtre s'affiche même si ready-to-show tarde
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1500);

  if (process.platform === 'win32') {
    try {
      const iconImg = nativeImage.createFromPath(appIconPath);
      if (iconImg && !iconImg.isEmpty()) {
        mainWindow.setIcon(iconImg);
      } else {
        mainWindow.setIcon(appIconPath);
      }
    } catch (e) {
      console.warn('[Window] setIcon fallback:', e.message);
    }
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (mainWindow.webContents && typeof mainWindow.webContents.setWindowOpenHandler === 'function') {
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });
  }

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:window-maximize-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:window-maximize-changed', false);
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:window-maximize-changed', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:window-maximize-changed', mainWindow.isMaximized());
    }
  });

  const emitWindowVisibility = (visible) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('antigravite:window-visibility', { visible: !!visible });
    }
  };
  mainWindow.on('hide', () => emitWindowVisibility(false));
  mainWindow.on('minimize', () => emitWindowVisibility(false));
  mainWindow.on('show', () => emitWindowVisibility(true));
  mainWindow.on('restore', () => emitWindowVisibility(true));

  // Menu contextuel natif pour la correction orthographique des notes et les actions d'édition
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const template = [];

    // 1. Suggestions orthographiques si un mot est souligné / mal orthographié
    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
          template.push({
            label: suggestion,
            click: () => mainWindow.webContents.replaceMisspelling(suggestion)
          });
        });
      } else {
        template.push({
          label: 'Aucune suggestion',
          enabled: false
        });
      }

      template.push({ type: 'separator' });
      template.push({
        label: `Ajouter « ${params.misspelledWord} » au dictionnaire`,
        click: () => mainWindow.webContents.session.addWordToSpellcheckerDictionary(params.misspelledWord)
      });
      template.push({ type: 'separator' });
    }

    // 2. Actions standards d'édition de texte (si zone éditable ou sélection présente)
    if (params.isEditable) {
      template.push({ role: 'undo', label: 'Annuler' });
      template.push({ role: 'redo', label: 'Rétablir' });
      template.push({ type: 'separator' });
      template.push({ role: 'cut', label: 'Couper' });
      template.push({ role: 'copy', label: 'Copier' });
      template.push({ role: 'paste', label: 'Coller' });
      template.push({ type: 'separator' });
      template.push({ role: 'selectAll', label: 'Tout sélectionner' });
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      template.push({ role: 'copy', label: 'Copier' });
      template.push({ role: 'selectAll', label: 'Tout sélectionner' });
    }

    // N'afficher le menu contextuel que s'il contient au moins une action pertinente
    if (template.length > 0) {
      const contextMenu = Menu.buildFromTemplate(template);
      contextMenu.popup({ window: mainWindow });
    }
  });

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
  const uniqueSuffix = Math.random().toString(36).slice(2, 6);
  const filename = `antigravite_backup_${timestamp}_${uniqueSuffix}.json`;
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

async function invokeWithStructuredError(fn) {
  try {
    return await fn();
  } catch (err) {
    return {
      __ipcError: true,
      code: err && err.code ? err.code : null,
      status: err && err.status ? err.status : null,
      message: err && err.message ? err.message : String(err)
    };
  }
}

ipcMain.handle('antigravite:google-create-event', async (_event, eventData) => {
  return invokeWithStructuredError(() => googleCalendar.createEvent(eventData));
});

ipcMain.handle('antigravite:google-update-event', async (_event, { googleId, eventData, calendarId, expectedEtag }) => {
  return invokeWithStructuredError(() => googleCalendar.updateEvent(googleId, eventData, calendarId, expectedEtag));
});

ipcMain.handle('antigravite:google-delete-event', async (_event, { googleId, calendarId }) => {
  return invokeWithStructuredError(() => googleCalendar.deleteEvent(googleId, calendarId));
});

ipcMain.handle('antigravite:open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

function getCustomWallpaperFilePath() {
  return path.join(app.getPath('userData'), 'custom-wallpaper.dat');
}

ipcMain.handle('antigravite:save-custom-wallpaper', async (_event, dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 10 * 1024 * 1024) {
    throw new Error('Image de fond d\'écran invalide ou trop volumineuse.');
  }
  const target = getCustomWallpaperFilePath();
  const tmp = `${target}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(tmp, dataUrl, 'utf8');
  await fs.rename(tmp, target);
  return { ok: true, token: '__custom_wallpaper__' };
});

ipcMain.handle('antigravite:load-custom-wallpaper', async () => {
  try {
    const content = await fs.readFile(getCustomWallpaperFilePath(), 'utf8');
    return (typeof content === 'string' && content.startsWith('data:image/')) ? content : null;
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    return null;
  }
});

ipcMain.handle('antigravite:clear-custom-wallpaper', async () => {
  try {
    await fs.unlink(getCustomWallpaperFilePath());
  } catch (err) {
    if (!err || err.code !== 'ENOENT') {
      console.warn('[Wallpaper] Impossible de supprimer custom-wallpaper.dat:', err && err.message);
    }
  }
  return { ok: true };
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
async function copyMusicFilesToPersonalFolder(filePaths) {
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
        await fs.copyFile(srcPath, tempFilePath);
        const tempStat = await fs.stat(tempFilePath);
        if (tempStat.size !== srcStat.size) {
          await fs.unlink(tempFilePath).catch(() => {});
          results.errors.push({ file: baseFileName, error: 'Copie incomplète : la taille sur disque ne correspond pas.' });
          continue;
        }
        // Renommage atomique vers le nom définitif
        await fs.rename(tempFilePath, finalTargetPath);

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

let _localMusicCatalogCache = null;

async function _safeStatMtime(targetPath) {
  try {
    const st = await fs.stat(targetPath);
    return `${Math.round(st.mtimeMs || 0)}:${st.size || 0}`;
  } catch (_) {
    return 'missing';
  }
}

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

  const copyResult = await copyMusicFilesToPersonalFolder(result.filePaths);
  _localMusicCatalogCache = null;
  return { canceled: false, ...copyResult };
});

ipcMain.handle('antigravite:copy-music-files', async (_event, filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { canceled: false, copied: [], duplicates: [], errors: [] };
  }
  const copyResult = await copyMusicFilesToPersonalFolder(filePaths);
  _localMusicCatalogCache = null;
  return { canceled: false, ...copyResult };
});

ipcMain.handle('antigravite:list-local-music', async (_event, options = {}) => {
  const forceRefresh = !!(options && options.forceRefresh);
  const allowedExts = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.weba']);

  const tracksJsonPath = path.join(__dirname, 'data', 'music-tracks.json');
  const personalDir = getPersonalMusicDir();
  const unpackedDir = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'music');
  let bundledMusicDir = path.join(__dirname, 'music');
  try {
    await fs.access(unpackedDir);
    bundledMusicDir = unpackedDir;
  } catch (_) {}

  const candidates = [
    { dir: bundledMusicDir, prefix: './music/', defaultFolder: 'Focus, Rituals & Daily Routines', type: 'local' },
    { dir: path.join(__dirname, 'assets', 'music'), prefix: './assets/music/', defaultFolder: 'Focus, Rituals & Daily Routines', type: 'local' },
    { dir: personalDir, prefix: null, defaultFolder: 'Musique personnelle', type: 'personal' }
  ];

  // Signature légère basée uniquement sur mtimeMs des dossiers et du manifest JSON
  const sigParts = await Promise.all([
    _safeStatMtime(tracksJsonPath),
    ...candidates.map(c => _safeStatMtime(c.dir))
  ]);
  const cacheSig = sigParts.join('|');
  if (!forceRefresh && _localMusicCatalogCache && _localMusicCatalogCache.sig === cacheSig) {
    return _localMusicCatalogCache.tracks;
  }

  // Mappage des dossiers de catégories et métadonnées prédéfinis (asynchrone)
  const infoMap = {};
  try {
    const rawJson = await fs.readFile(tracksJsonPath, 'utf8');
    const savedTracks = JSON.parse(rawJson);
    if (Array.isArray(savedTracks)) {
      savedTracks.forEach(t => {
        if (t && t.filename) infoMap[t.filename] = t;
      });
    }
  } catch (_e) {}

  const perFolderResults = await Promise.all(
    candidates.map(async (item) => {
      const folderTracks = [];
      try {
        const entries = await fs.readdir(item.dir, { withFileTypes: true });
        const audioEntries = entries.filter((entry) => {
          if (!entry.isFile()) return false;
          return allowedExts.has(path.extname(entry.name).toLowerCase());
        });

        const settled = await Promise.allSettled(
          audioEntries.map(async (entry) => {
            const ext = path.extname(entry.name).toLowerCase();
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
            const stats = await fs.stat(fullPath);
            const meta = infoMap[entry.name] || {};
            const fileUrl = pathToFileURL(fullPath).href;
            const idPrefix = (item.type === 'personal') ? 'personal-' : 'track-';
            const idHash = crypto.createHash('sha1').update(`${item.type}:${entry.name}`).digest('hex').slice(0, 16);
            return {
              id: idPrefix + idHash,
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
            };
          })
        );

        settled.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            folderTracks.push(res.value);
          } else if (res.status === 'rejected') {
            const name = audioEntries[idx] ? audioEntries[idx].name : 'inconnu';
            console.warn('[Music] Fichier ignoré (inaccessible):', name, res.reason && res.reason.message);
          }
        });
      } catch (err) {
        if (!err || err.code !== 'ENOENT') {
          console.warn('[Music] Erreur lecture dossier musical:', err && err.message ? err.message : err);
        }
      }
      return folderTracks;
    })
  );

  const tracks = perFolderResults.flat();
  _localMusicCatalogCache = { sig: cacheSig, tracks };
  return tracks;
});

ipcMain.handle('antigravite:set-title-bar-overlay', async (_event, options) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (options && typeof options === 'object') {
        if (options.theme && nativeTheme) {
          nativeTheme.themeSource = options.theme === 'light' ? 'light' : 'dark';
        }
        if (options.backgroundColor && typeof mainWindow.setBackgroundColor === 'function') {
          mainWindow.setBackgroundColor(options.backgroundColor);
        }
        // Note: mainWindow utilise titleBarStyle: 'hidden' avec des contrôles HTML personnalisés (#window-controls-container)
        // sans titleBarOverlay natif ; éviter l'appel systématique à setTitleBarOverlay() qui échoue sans overlay natif.
      }
      return true;
    } catch (e) {
      console.warn("Échec setTitleBarOverlay:", e.message);
      return false;
    }
  }
  return false;
});

ipcMain.handle('antigravite:window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('antigravite:window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (typeof mainWindow.isFullScreen === 'function' && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized() || (typeof mainWindow.isFullScreen === 'function' && mainWindow.isFullScreen());
  }
  return false;
});

ipcMain.handle('antigravite:window-is-maximized', () => {
  return !!(mainWindow && !mainWindow.isDestroyed() && (mainWindow.isMaximized() || (typeof mainWindow.isFullScreen === 'function' && mainWindow.isFullScreen())));
});

ipcMain.handle('antigravite:window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
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
      if (options.action && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        try {
          mainWindow.webContents.send('antigravite:notification-clicked', options.action);
        } catch (_) {}
      }
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
      const shortcutPath = getWindowsStartupShortcutPath();
      const shortcutExists = shortcutPath && fsSync.existsSync(shortcutPath);
      const { targetExe, regArgs } = resolveWindowsStartupTarget();
      const loginInfo = app.getLoginItemSettings({
        path: targetExe,
        args: regArgs
      });
      actualLogin = !!(shortcutExists || loginInfo.openAtLogin || desktopPrefs.launchOnStartup);
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
  const nextPatch = { ...prefs };
  if (prefs.launchOnStartup !== undefined && process.platform === 'win32') {
    try {
      const res = applyWindowsLoginItem(prefs.launchOnStartup);
      nextPatch.launchOnStartup = !!res.enabled;
    } catch (err) {
      console.warn('[Startup] Erreur configuration démarrage Windows:', err.message);
    }
  }
  return saveDesktopPrefs(nextPatch);
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

ipcMain.handle('antigravite:updater-enable-mock', () => {
  updateService.isMockMode = true;
  return true;
});

ipcMain.handle('antigravite:updater-install', async () => {
  isQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    try {
      await Promise.race([
        mainWindow.webContents.executeJavaScript('if (window.NotesManager && typeof window.NotesManager.flushPendingSave === "function") window.NotesManager.flushPendingSave();', true),
        new Promise(resolve => setTimeout(resolve, 350))
      ]);
    } catch (_) {}
  }
  updateService.quitAndInstall(true, true);
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

async function bootApplication() {
  if (!gotSingleInstanceLock || hasBooted) return;
  hasBooted = true;
  loadDesktopPrefsSync();

  // Si le lancement au démarrage est activé dans les préférences, synchroniser le raccourci et le registre
  if (process.platform === 'win32' && desktopPrefs.launchOnStartup) {
    try {
      applyWindowsLoginItem(true);
    } catch (err) {
      console.warn('[Startup] Erreur synchronisation démarrage Windows au lancement:', err.message);
    }
  }

  // Configuration du correcteur orthographique pour les saisies (Français uniquement)
  try {
    if (session && session.defaultSession && typeof session.defaultSession.setSpellCheckerLanguages === 'function') {
      session.defaultSession.setSpellCheckerLanguages(['fr-FR', 'fr']);
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
    const isMockUpdate = process.argv.includes('--mock-update-available');
    updateService.init({
      app,
      mock: isMockUpdate,
      onBeforeQuitInstall: () => {
        isQuitting = true;
        if (tray && !tray.isDestroyed()) {
          try { tray.destroy(); } catch (_) {}
          tray = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          try { mainWindow.destroy(); } catch (_) {}
          mainWindow = null;
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
}

app.whenReady().then(bootApplication);

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getWindowsStartupShortcutPath,
    resolveWindowsStartupTarget,
    syncWindowsRegistryStartup,
    applyWindowsLoginItem
  };
}
