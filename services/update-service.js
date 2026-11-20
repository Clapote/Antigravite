/**
 * =============================================================================
 * services/update-service.js - Service de mise à jour automatique Antigravité
 * =============================================================================
 * 
 * Rôles et garanties de sécurité :
 * - Initialise electron-updater pour le dépôt public GitHub : Clapote/Antigravite-releases
 * - Téléchargements anonymes HTTPS publics : ZÉRO jeton secret ou clé dans l'application cliente
 * - Mode développement protégé : aucune requête réseau bloquante ou intempestive au démarrage
 * - Contrôle utilisateur explicite : autoDownload = false (l'utilisateur valide le téléchargement)
 * - Cycle de vie sécurisé : coordination avec isQuitting pour éviter que l'interception de close
 *   ne bloque le redémarrage d'installation de la mise à jour (type ChatGPT / Tray)
 */

const { EventEmitter } = require('node:events');

class UpdateService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.app = options.app || null;
    this.autoUpdater = options.autoUpdater || null;
    this.currentVersionOverride = options.currentVersion || null;
    this.mockVersion = options.mockVersion || '1.2.3';
    this.feedConfig = Object.assign({
      provider: 'github',
      owner: 'Clapote',
      repo: 'Antigravite-releases',
      private: false
    }, options.feedConfig || {});

    this.status = 'idle'; // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
    this.updateInfo = null;
    this.downloadProgress = null;
    this.lastError = null;
    this.isInitialized = false;
    this.isMockMode = !!options.mock;
    this.onBeforeQuitInstall = options.onBeforeQuitInstall || null;
  }

  /**
   * Compare deux versions semver (ex: '1.2.3' vs '1.2.2').
   * Retourne true UNIQUEMENT si remoteVer est strictement supérieure à currentVer.
   */
  isNewerVersion(remoteVer, currentVer) {
    if (!remoteVer || !currentVer) return false;
    const clean = (v) => String(v).trim().replace(/^v/i, '');
    const rParts = clean(remoteVer).split('.').map(n => parseInt(n, 10) || 0);
    const cParts = clean(currentVer).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(rParts.length, cParts.length);
    for (let i = 0; i < len; i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  }

  _getCurrentVersion() {
    if (this.currentVersionOverride) {
      return String(this.currentVersionOverride).trim();
    }
    const app = this._resolveApp();
    if (app && typeof app.getVersion === 'function') {
      try {
        const v = app.getVersion();
        if (v) return String(v).trim();
      } catch (_) {}
    }
    return '1.0.0';
  }

  _resolveApp() {
    if (this.app) return this.app;
    try {
      const { app } = require('electron');
      return app;
    } catch (_) {
      return null;
    }
  }

  _resolveAutoUpdater() {
    if (this.autoUpdater) return this.autoUpdater;
    try {
      const { autoUpdater } = require('electron-updater');
      return autoUpdater;
    } catch (_) {
      return null;
    }
  }

  _setStatus(status, payload = {}) {
    this.status = status;
    this.emit('status-changed', { status, ...payload });
  }

  /**
   * Initialise le service et configure les options d'electron-updater.
   * Aucune requête réseau n'est exécutée lors de cette méthode.
   */
  init(options = {}) {
    if (options.app) this.app = options.app;
    if (options.autoUpdater) this.autoUpdater = options.autoUpdater;
    if (options.onBeforeQuitInstall) this.onBeforeQuitInstall = options.onBeforeQuitInstall;
    if (options.mock !== undefined) this.isMockMode = !!options.mock;

    const app = this._resolveApp();
    const isPackaged = options.forcePackaged !== undefined
      ? options.forcePackaged
      : (app ? !!app.isPackaged : false);

    const updater = this._resolveAutoUpdater();
    if (!updater) {
      return { initialized: false, reason: 'electron-updater-not-found' };
    }

    // 1. Contrôle utilisateur absolu : pas de téléchargement automatique en arrière-plan
    updater.autoDownload = false;
    // 2. Pas d'installation forcée et silencieuse à la fermeture
    updater.autoInstallOnAppQuit = false;

    // 3. Configuration de la source publique GitHub (aucun jeton requis)
    try {
      if (typeof updater.setFeedURL === 'function') {
        updater.setFeedURL(this.feedConfig);
      }
    } catch (err) {
      this.lastError = err;
    }

    // 4. Enregistrement des événements sur autoUpdater
    if (!this.isInitialized && typeof updater.on === 'function') {
      updater.on('checking-for-update', () => {
        this._setStatus('checking');
        this.emit('checking-for-update');
      });

      updater.on('update-available', (info) => {
        const currentVersion = this._getCurrentVersion();
        const isActuallyNewer = info && info.version && this.isNewerVersion(info.version, currentVersion);
        if (!isActuallyNewer) {
          // Version identique ou inférieure : ne JAMAIS notifier comme mise à jour disponible
          this.updateInfo = info;
          this._setStatus('not-available', { updateInfo: info, isUpdateAvailable: false });
          this.emit('update-not-available', info);
          return;
        }
        this.updateInfo = info;
        this._setStatus('available', { updateInfo: info, isUpdateAvailable: true });
        this.emit('update-available', info);
      });

      updater.on('update-not-available', (info) => {
        this.updateInfo = info;
        this._setStatus('not-available', { updateInfo: info, isUpdateAvailable: false });
        this.emit('update-not-available', info);
      });

      updater.on('download-progress', (progressObj) => {
        this.downloadProgress = progressObj;
        this._setStatus('downloading', { progress: progressObj });
        this.emit('download-progress', progressObj);
      });

      updater.on('update-downloaded', (info) => {
        this.updateInfo = info;
        this._setStatus('downloaded', { updateInfo: info });
        this.emit('update-downloaded', info);
      });

      updater.on('error', (err) => {
        this.lastError = err;
        this._setStatus('error', { error: err ? err.message : 'Erreur inconnue' });
        if (this.listenerCount('error') > 0) {
          this.emit('error', err);
        }
      });

      // Événement interne d'electron-updater déclenché juste avant la fermeture pour mise à jour
      if (typeof updater.on === 'function') {
        updater.on('before-quit-for-update', () => {
          this.emit('before-quit-and-install');
          if (typeof this.onBeforeQuitInstall === 'function') {
            try { this.onBeforeQuitInstall(); } catch (_) {}
          }
        });
      }

      this.isInitialized = true;
    }

    return {
      initialized: true,
      isPackaged,
      feed: {
        provider: this.feedConfig.provider,
        owner: this.feedConfig.owner,
        repo: this.feedConfig.repo,
        private: this.feedConfig.private
      }
    };
  }

  /**
   * Vérifie la disponibilité d'une mise à jour.
   * En mode développement (non empaqueté), la requête réseau est ignorée par sécurité
   * sauf si force = true.
   */
  async checkForUpdates(force = false) {
    if (this.isMockMode) {
      this._setStatus('checking');
      await new Promise(r => setTimeout(r, 400));
      const currentVer = this._getCurrentVersion();
      const mockInfo = {
        version: this.mockVersion || '1.2.4',
        releaseDate: new Date().toISOString(),
        releaseNotes: "Améliorations de la fluidité, téléchargement transparent et installation sans fenêtre d'assistant.",
        files: [{ url: `Antigravite.Setup.${this.mockVersion || '1.2.4'}.exe`, size: 84500000 }]
      };
      const isNewer = this.isNewerVersion(mockInfo.version, currentVer);
      if (!isNewer) {
        this.updateInfo = mockInfo;
        this._setStatus('not-available', { updateInfo: mockInfo, isUpdateAvailable: false });
        return { success: true, updateInfo: null, isUpdateAvailable: false };
      }
      this.updateInfo = mockInfo;
      this._setStatus('available', { updateInfo: mockInfo, isUpdateAvailable: true });
      return { success: true, updateInfo: mockInfo, isUpdateAvailable: true };
    }

    const app = this._resolveApp();
    const isPackaged = app ? !!app.isPackaged : false;

    if (!isPackaged && !force) {
      this._setStatus('idle');
      return {
        success: false,
        reason: 'dev-mode',
        message: 'La recherche automatique de mises à jour est désactivée en mode développement.'
      };
    }

    const updater = this._resolveAutoUpdater();
    if (!updater || typeof updater.checkForUpdates !== 'function') {
      throw new Error("electron-updater n'est pas disponible.");
    }

    this._setStatus('checking');
    try {
      const result = await updater.checkForUpdates();
      const rawInfo = result ? result.updateInfo : null;
      const currentVersion = this._getCurrentVersion();
      const isAvailable = !!(rawInfo && rawInfo.version && this.isNewerVersion(rawInfo.version, currentVersion));

      if (!isAvailable) {
        this.updateInfo = rawInfo;
        this._setStatus('not-available', { updateInfo: rawInfo, isUpdateAvailable: false });
        return {
          success: true,
          updateInfo: null,
          isUpdateAvailable: false
        };
      }

      this.updateInfo = rawInfo;
      this._setStatus('available', { updateInfo: rawInfo, isUpdateAvailable: true });
      return {
        success: true,
        updateInfo: rawInfo,
        isUpdateAvailable: true
      };
    } catch (err) {
      this.lastError = err;
      this._setStatus('error', { error: err ? err.message : 'Erreur inconnue' });
      throw err;
    }
  }

  /**
   * Déclenche le téléchargement explicite de la mise à jour par l'utilisateur.
   */
  async downloadUpdate() {
    const currentVersion = this._getCurrentVersion();
    if (this.status === 'not-available' || (this.updateInfo && this.updateInfo.version && !this.isNewerVersion(this.updateInfo.version, currentVersion))) {
      throw new Error(`Aucune mise à jour plus récente disponible (version actuelle : ${currentVersion}).`);
    }

    if (this.isMockMode) {
      this._setStatus('downloading');
      for (let p = 15; p <= 100; p += 15) {
        await new Promise(r => setTimeout(r, 160));
        const progressObj = {
          percent: Math.min(100, p),
          transferred: Math.round(84500000 * (p / 100)),
          total: 84500000,
          bytesPerSecond: 18000000
        };
        this.downloadProgress = progressObj;
        this._setStatus('downloading', { progress: progressObj });
      }
      this._setStatus('downloaded', { updateInfo: this.updateInfo });
      return { success: true };
    }

    const updater = this._resolveAutoUpdater();
    if (!updater || typeof updater.downloadUpdate !== 'function') {
      throw new Error("electron-updater n'est pas disponible.");
    }

    if (this.status !== 'available' && this.status !== 'error') {
      throw new Error(`Téléchargement impossible dans l'état actuel : ${this.status}`);
    }

    this._setStatus('downloading');
    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (err) {
      this.lastError = err;
      this._setStatus('error', { error: err ? err.message : 'Erreur inconnue' });
      throw err;
    }
  }

  /**
   * Quitte l'application et installe la mise à jour téléchargée.
   * Déclenche la notification de fermeture préalable pour que main.js désactive
   * l'interception de l'événement 'close' (isQuitting = true) et détruise le Tray.
   */
  quitAndInstall(isSilent = true, isForceRunAfter = true) {
    if (this.status !== 'downloaded') {
      throw new Error("Aucune mise à jour téléchargée n'est prête à être installée.");
    }

    this.emit('before-quit-and-install');
    if (typeof this.onBeforeQuitInstall === 'function') {
      try {
        this.onBeforeQuitInstall();
      } catch (_) {}
    }

    if (this.isMockMode) {
      const app = this._resolveApp();
      if (app) {
        if (typeof app.relaunch === 'function') app.relaunch();
        if (typeof app.quit === 'function') app.quit();
      }
      return;
    }

    const updater = this._resolveAutoUpdater();
    if (updater && typeof updater.quitAndInstall === 'function') {
      updater.quitAndInstall(isSilent, isForceRunAfter);
    }
  }

  /**
   * Retourne l'état courant complet du service de mise à jour.
   */
  getStatus() {
    const currentVersion = this._getCurrentVersion();
    const app = this._resolveApp();
    const isPackaged = app ? !!app.isPackaged : false;

    // Protection stricte : si le statut enregistré est 'available' mais que la version n'est pas strictement plus récente
    let effectiveStatus = this.status;
    let effectiveUpdateInfo = this.updateInfo;
    if (effectiveStatus === 'available') {
      if (!this.updateInfo || !this.updateInfo.version || !this.isNewerVersion(this.updateInfo.version, currentVersion)) {
        effectiveStatus = 'not-available';
        effectiveUpdateInfo = null;
      }
    }

    return {
      currentVersion,
      isPackaged,
      status: effectiveStatus,
      feed: {
        provider: this.feedConfig.provider,
        owner: this.feedConfig.owner,
        repo: this.feedConfig.repo,
        private: this.feedConfig.private
      },
      updateInfo: effectiveUpdateInfo,
      downloadProgress: this.downloadProgress,
      lastError: this.lastError ? this.lastError.message : null
    };
  }
}

const defaultInstance = new UpdateService();
defaultInstance.UpdateService = UpdateService;

module.exports = defaultInstance;
