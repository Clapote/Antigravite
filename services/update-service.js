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
    this.onBeforeQuitInstall = options.onBeforeQuitInstall || null;
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
        this.updateInfo = info;
        this._setStatus('available', { updateInfo: info });
        this.emit('update-available', info);
      });

      updater.on('update-not-available', (info) => {
        this.updateInfo = info;
        this._setStatus('not-available', { updateInfo: info });
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
      return {
        success: true,
        updateInfo: result ? result.updateInfo : null
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
  quitAndInstall(isSilent = false, isForceRunAfter = true) {
    if (this.status !== 'downloaded') {
      throw new Error("Aucune mise à jour téléchargée n'est prête à être installée.");
    }

    this.emit('before-quit-and-install');
    if (typeof this.onBeforeQuitInstall === 'function') {
      try {
        this.onBeforeQuitInstall();
      } catch (_) {}
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
    const app = this._resolveApp();
    const currentVersion = app && typeof app.getVersion === 'function' ? app.getVersion() : '1.0.0';
    const isPackaged = app ? !!app.isPackaged : false;

    return {
      currentVersion,
      isPackaged,
      status: this.status,
      feed: {
        provider: this.feedConfig.provider,
        owner: this.feedConfig.owner,
        repo: this.feedConfig.repo,
        private: this.feedConfig.private
      },
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      lastError: this.lastError ? this.lastError.message : null
    };
  }
}

const defaultInstance = new UpdateService();
defaultInstance.UpdateService = UpdateService;

module.exports = defaultInstance;
