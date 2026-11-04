/**
 * Antigravité - Module de Gestion des Paramètres et de l'Apparence
 */

const SettingsManager = {
  initialized: false,

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.render();
    if (this.updater && typeof this.updater.init === 'function') {
      this.updater.init();
    }
  },

  bindEvents() {
    // 1. Bouton de réinitialisation de l'apparence
    const btnReset = document.getElementById('btn-reset-appearance');
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetDefaults();
      });
    }

    // 2. Écouteur par délégation d'événements sur le panneau Paramètres
    const screenSettings = document.getElementById('screen-settings');
    if (screenSettings) {
      screenSettings.addEventListener('click', (e) => {
        // A. Thème d'affichage
        const themeCard = e.target.closest('.theme-option-card');
        if (themeCard && themeCard.dataset.themeVal) {
          e.preventDefault();
          this.updateSetting('theme', themeCard.dataset.themeVal);
          return;
        }

        // B. Couleur d'accentuation
        const accentBubble = e.target.closest('.accent-option-bubble');
        if (accentBubble && accentBubble.dataset.accentVal) {
          e.preventDefault();
          this.updateSetting('accentColor', accentBubble.dataset.accentVal);
          return;
        }

        // C. Densité d'affichage
        const densityBtn = e.target.closest('.density-option-btn');
        if (densityBtn && densityBtn.dataset.densityVal) {
          e.preventDefault();
          this.updateSetting('density', densityBtn.dataset.densityVal);
          return;
        }

        // D. Taille de police
        const fontBtn = e.target.closest('.font-size-option-btn');
        if (fontBtn && fontBtn.dataset.sizeVal) {
          e.preventDefault();
          this.updateSetting('fontSize', fontBtn.dataset.sizeVal);
          return;
        }

        // E. Arrondis des angles
        const radiusBtn = e.target.closest('.radius-option-btn');
        if (radiusBtn && radiusBtn.dataset.radiusVal) {
          e.preventDefault();
          this.updateSetting('borderRadius', radiusBtn.dataset.radiusVal);
          return;
        }

        // F. Fond d'écran prédéfini ou retrait
        const wpCard = e.target.closest('.wallpaper-card');
        if (wpCard && wpCard.dataset.wallpaper) {
          e.preventDefault();
          const val = wpCard.dataset.wallpaper;
          this.updateSetting('backgroundImage', val === 'none' ? null : val);
          return;
        }

        const btnRemoveWp = e.target.closest('#btn-remove-wallpaper');
        if (btnRemoveWp) {
          e.preventDefault();
          this.updateSetting('backgroundImage', null);
          return;
        }

        // G. Clics dans la prévisualisation (démonstration interactive)
        const demoBtn = e.target.closest('#appearance-live-preview .btn');
        if (demoBtn) {
          e.preventDefault();
          const label = demoBtn.textContent.trim();
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast(`Aperçu : bouton "${label}"`, 'info');
          }
          return;
        }
      });
    }

    // 3. Import d'image personnalisée de fond d'écran
    const fileInput = document.getElementById('wallpaper-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await this.processImageFile(file);
          this.updateSetting('backgroundImage', dataUrl);
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Image de fond d'écran appliquée", "success");
          }
        } catch (err) {
          alert("Impossible de charger l'image : " + err.message);
        } finally {
          fileInput.value = '';
        }
      });
    }

    // 4. Curseur d'opacité du fond d'écran
    const opacitySlider = document.getElementById('wallpaper-opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        const opacityVal = document.getElementById('wallpaper-opacity-val');
        if (opacityVal) opacityVal.textContent = `${val}%`;
        this.updateSetting('backgroundOpacity', val, true);
      });
    }

    // 5. Curseur de flou du fond d'écran
    const blurSlider = document.getElementById('wallpaper-blur-slider');
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        const blurVal = document.getElementById('wallpaper-blur-val');
        if (blurVal) blurVal.textContent = `${val} px`;
        this.updateSetting('backgroundBlur', val, true);
      });
    }
  },

  // Traitement et optimisation locale d'une image choisie par l'utilisateur
  processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Format d'image non reconnu ou corrompu"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsDataURL(file);
    });
  },

  // Rendu de l'écran des paramètres d'apparence
  render() {
    const settings = StorageManager.getSettings();

    // 1. Thème
    document.querySelectorAll('.theme-option-card').forEach(card => {
      card.classList.toggle('active', card.dataset.themeVal === settings.theme);
    });

    // 2. Couleur d'accentuation
    document.querySelectorAll('.accent-option-bubble').forEach(bubble => {
      bubble.classList.toggle('active', bubble.dataset.accentVal === settings.accentColor);
    });

    // 3. Densité d'affichage
    document.querySelectorAll('.density-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.densityVal === settings.density);
    });

    // 4. Taille de police
    document.querySelectorAll('.font-size-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sizeVal === settings.fontSize);
    });

    // 5. Arrondis des angles
    document.querySelectorAll('.radius-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.radiusVal === settings.borderRadius);
    });

    // 6. Fond d'écran (Image derrière les panneaux)
    const currentWp = settings.backgroundImage;
    document.querySelectorAll('.wallpaper-card').forEach(card => {
      const wpVal = card.dataset.wallpaper;
      if (!currentWp || currentWp === 'none') {
        card.classList.toggle('active', wpVal === 'none');
      } else if (wpVal) {
        card.classList.toggle('active', wpVal === currentWp);
      } else if (card.classList.contains('wallpaper-card-upload')) {
        const isCustom = currentWp && !['nebula', 'aurora', 'mineral', 'sunset', 'none'].includes(currentWp);
        card.classList.toggle('active', !!isCustom);
      }
    });

    const wpControls = document.getElementById('wallpaper-controls');
    const btnRemoveWp = document.getElementById('btn-remove-wallpaper');
    const hasWp = currentWp && currentWp !== 'none';
    if (wpControls) wpControls.style.display = hasWp ? 'block' : 'none';
    if (btnRemoveWp) btnRemoveWp.style.display = hasWp ? 'inline-flex' : 'none';

    const opacitySlider = document.getElementById('wallpaper-opacity-slider');
    const opacityVal = document.getElementById('wallpaper-opacity-val');
    const curOpacity = settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 25;
    if (opacitySlider) opacitySlider.value = curOpacity;
    if (opacityVal) opacityVal.textContent = `${curOpacity}%`;

    const blurSlider = document.getElementById('wallpaper-blur-slider');
    const blurVal = document.getElementById('wallpaper-blur-val');
    const curBlur = settings.backgroundBlur !== undefined ? settings.backgroundBlur : 0;
    if (blurSlider) blurSlider.value = curBlur;
    if (blurVal) blurVal.textContent = `${curBlur} px`;

    const customThumb = document.getElementById('wallpaper-custom-thumb');
    if (customThumb) {
      const isCustom = currentWp && !['nebula', 'aurora', 'mineral', 'sunset', 'none'].includes(currentWp);
      if (isCustom) {
        customThumb.style.backgroundImage = `url("${currentWp}")`;
        customThumb.innerHTML = '';
      } else {
        customThumb.style.backgroundImage = 'none';
        customThumb.innerHTML = '<span>🖼️ ➕</span>';
      }
    }

    // 7. Mise à jour de l'aperçu en direct
    this.updatePreviewBox(settings);

    // 8. Mise à jour de la section Mises à jour
    if (this.updater && typeof this.updater.render === 'function') {
      this.updater.render();
    }
  },

  // Mettre à jour un paramètre et l'appliquer immédiatement
  updateSetting(key, value, silent = false) {
    const settings = StorageManager.getSettings();
    settings[key] = value;
    StorageManager.saveSettings(settings);

    // Appliquer instantanément les styles à toute l'application
    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    this.render();

    if (!silent && typeof App !== 'undefined' && typeof App.showToast === 'function') {
      const labels = {
        theme: 'Thème appliqué',
        accentColor: 'Couleur d\'accentuation mise à jour',
        density: 'Densité mise à jour',
        fontSize: 'Taille du texte ajustée',
        borderRadius: 'Style des angles appliqué',
        backgroundImage: 'Fond d\'écran mis à jour',
        backgroundOpacity: 'Opacité ajustée',
        backgroundBlur: 'Flou d\'arrière-plan ajusté'
      };
      App.showToast(labels[key] || "Apparence mise à jour", "info");
    }
  },

  // Réinitialiser les paramètres d'apparence par défaut
  resetDefaults() {
    if (!confirm("Rétablir les paramètres d'apparence par défaut d'Antigravité ?")) return;

    const defaults = StorageManager.DEFAULT_SETTINGS;
    StorageManager.saveSettings(defaults);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(defaults);
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Paramètres d'apparence réinitialisés", "success");
    }
  },

  // Mettre à jour la boîte d'aperçu interactive
  updatePreviewBox(settings) {
    const previewEl = document.getElementById('appearance-live-preview');
    if (!previewEl) return;

    const accentNames = {
      blue: 'Bleu Ciel',
      emerald: 'Émeraude',
      purple: 'Violet Astral',
      amber: 'Ambre Chaud',
      rose: 'Rose Framboise'
    };

    const themeNames = {
      dark: 'Sombre Élégant',
      oled: 'Sombre Profond (OLED)',
      light: 'Clair Épuré'
    };

    const descEl = document.getElementById('preview-summary-desc');
    if (descEl) {
      descEl.textContent = `Thème : ${themeNames[settings.theme] || settings.theme} • Accent : ${accentNames[settings.accentColor] || settings.accentColor} • Densité : ${settings.density === 'compact' ? 'Compacte' : 'Confortable'} • Texte : ${settings.fontSize === 'small' ? 'Compact (90%)' : settings.fontSize === 'large' ? 'Grand (110%)' : 'Normal (100%)'}`;
    }
  }
};

/**
 * Gestionnaire d'Interface pour les Mises à Jour Automatiques (Settings)
 */
const UpdateManager = {
  initialized: false,
  isBusy: false,
  currentVersion: '1.0.0',
  isPackaged: false,
  status: 'idle',
  updateInfo: null,
  downloadProgress: null,
  lastError: null,
  _unsubscribe: null,

  async init() {
    this.bindEvents();
    await this.refreshStatus();
    this.initialized = true;
  },

  bindEvents() {
    if (typeof document === 'undefined') return;

    // Bouton de recherche manuelle
    const btnCheck = document.getElementById('btn-check-updates');
    if (btnCheck && !btnCheck._hasUpdaterListener) {
      btnCheck.addEventListener('click', (e) => {
        e.preventDefault();
        this.checkForUpdates();
      });
      btnCheck._hasUpdaterListener = true;
    }

    // Bouton de téléchargement
    const btnDownload = document.getElementById('btn-download-update');
    if (btnDownload && !btnDownload._hasUpdaterListener) {
      btnDownload.addEventListener('click', (e) => {
        e.preventDefault();
        this.downloadUpdate();
      });
      btnDownload._hasUpdaterListener = true;
    }

    // Bouton d'installation
    const btnInstall = document.getElementById('btn-install-update');
    if (btnInstall && !btnInstall._hasUpdaterListener) {
      btnInstall.addEventListener('click', (e) => {
        e.preventDefault();
        this.installUpdate();
      });
      btnInstall._hasUpdaterListener = true;
    }

    // Écoute des événements IPC temps réel (via preload.js)
    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (updaterApi && typeof updaterApi.onStatusChanged === 'function') {
      if (typeof this._unsubscribe === 'function') {
        this._unsubscribe();
      }
      this._unsubscribe = updaterApi.onStatusChanged((data) => {
        if (!data) return;
        this.status = data.status || this.status;
        if (data.updateInfo) this.updateInfo = data.updateInfo;
        if (data.progress) this.downloadProgress = data.progress;
        if (data.error) this.lastError = data.error;
        this.render();
      });
    }
  },

  cleanup() {
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },

  async refreshStatus() {
    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (!updaterApi) {
      this.currentVersion = '1.1.2';
      this.isPackaged = false;
      this.render();
      return;
    }

    try {
      if (typeof updaterApi.getVersion === 'function') {
        const ver = await updaterApi.getVersion();
        if (ver) this.currentVersion = ver;
      }

      if (typeof updaterApi.getStatus === 'function') {
        const statusObj = await updaterApi.getStatus();
        if (statusObj) {
          this.status = statusObj.status || 'idle';
          this.isPackaged = !!statusObj.isPackaged;
          this.updateInfo = statusObj.updateInfo || null;
          this.downloadProgress = statusObj.downloadProgress || null;
          this.lastError = statusObj.lastError || null;
          if (statusObj.currentVersion) this.currentVersion = statusObj.currentVersion;
        }
      }
    } catch (err) {
      console.warn("[UpdateManager] Erreur récupération statut:", err);
    }

    this.render();
  },

  async checkForUpdates() {
    if (this.isBusy) return;
    this.isBusy = true;
    this.lastError = null;
    this.status = 'checking';
    this.render();

    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (!updaterApi) {
      this.isBusy = false;
      this.status = 'dev-mode';
      this.render();
      return;
    }

    try {
      const res = await updaterApi.checkForUpdates(false);
      if (res && res.reason === 'dev-mode') {
        this.status = 'dev-mode';
      }
    } catch (err) {
      this.status = 'error';
      this.lastError = err ? err.message : 'Erreur inconnue';
    } finally {
      this.isBusy = false;
      this.render();
    }
  },

  async downloadUpdate() {
    if (this.isBusy) return;
    this.isBusy = true;
    this.lastError = null;
    this.status = 'downloading';
    this.render();

    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (!updaterApi) {
      this.isBusy = false;
      this.status = 'error';
      this.lastError = "API de mise à jour indisponible.";
      this.render();
      return;
    }

    try {
      await updaterApi.downloadUpdate();
    } catch (err) {
      this.status = 'error';
      this.lastError = err ? err.message : 'Erreur inconnue';
    } finally {
      this.isBusy = false;
      this.render();
    }
  },

  async installUpdate() {
    if (this.isBusy) return;
    this.isBusy = true;

    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (!updaterApi) {
      this.isBusy = false;
      return;
    }

    try {
      await updaterApi.installUpdate();
    } catch (err) {
      this.status = 'error';
      this.lastError = err ? err.message : 'Erreur inconnue';
      this.isBusy = false;
      this.render();
    }
  },

  render() {
    if (typeof document === 'undefined') return;

    // 1. Version courante
    const versionLabel = document.getElementById('updater-current-version-label');
    if (versionLabel) {
      versionLabel.textContent = this.currentVersion || '1.0.0';
    }

    // 2. Éléments DOM
    const chip = document.getElementById('updater-version-chip');
    const dot = document.getElementById('updater-version-dot');
    const icon = document.getElementById('updater-status-icon');
    const title = document.getElementById('updater-status-title');
    const desc = document.getElementById('updater-status-desc');

    const btnCheck = document.getElementById('btn-check-updates');
    const btnCheckText = document.getElementById('btn-check-updates-text');
    const btnCheckIcon = document.getElementById('btn-check-updates-icon');
    const btnDownload = document.getElementById('btn-download-update');
    const btnDownloadText = document.getElementById('btn-download-update-text');
    const btnInstall = document.getElementById('btn-install-update');

    const progressContainer = document.getElementById('updater-progress-container');
    const progressBar = document.getElementById('updater-progress-bar');
    const progressPercent = document.getElementById('updater-progress-percent');
    const progressLabel = document.getElementById('updater-progress-label');

    if (!title || !desc || !btnCheck) return;

    // Masquage initial des boutons contextuels et conteneurs
    if (btnDownload) btnDownload.style.display = 'none';
    if (btnInstall) btnInstall.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'none';

    // Réinitialisation des styles de puce
    if (chip) {
      chip.classList.remove('status-connected', 'status-configured', 'status-disconnected');
    }

    const availableVersion = this.updateInfo?.version || '';

    switch (this.status) {
      case 'checking':
        if (icon) icon.textContent = '⏳';
        title.textContent = 'Recherche en cours...';
        desc.textContent = 'Vérification des versions disponibles sur GitHub Releases...';
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = true;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Recherche en cours...';
        if (btnCheckIcon) btnCheckIcon.textContent = '⏳';
        break;

      case 'available':
        if (icon) icon.textContent = '🎁';
        title.textContent = availableVersion
          ? `Nouvelle version disponible : v${availableVersion}`
          : 'Nouvelle version disponible !';
        desc.textContent = 'Une mise à jour est prête à être téléchargée. Vous pouvez lancer le téléchargement dès maintenant.';
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = this.isBusy;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Vérifier à nouveau';
        if (btnCheckIcon) btnCheckIcon.textContent = '🔄';

        if (btnDownload) {
          btnDownload.style.display = 'inline-flex';
          btnDownload.disabled = this.isBusy;
          if (btnDownloadText) {
            btnDownloadText.textContent = availableVersion
              ? `Télécharger la version ${availableVersion}`
              : 'Télécharger la mise à jour';
          }
        }
        break;

      case 'downloading':
        const percentNum = this.downloadProgress && typeof this.downloadProgress.percent === 'number'
          ? Math.round(this.downloadProgress.percent)
          : 0;

        if (icon) icon.textContent = '📥';
        title.textContent = 'Téléchargement en cours...';
        desc.textContent = `Téléchargement du paquet de mise à jour (${percentNum}%). Veuillez patienter...`;
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = true;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Téléchargement...';
        if (btnCheckIcon) btnCheckIcon.textContent = '📥';

        if (btnDownload) {
          btnDownload.style.display = 'inline-flex';
          btnDownload.disabled = true;
          if (btnDownloadText) btnDownloadText.textContent = `Téléchargement (${percentNum} %)`;
        }

        if (progressContainer) {
          progressContainer.style.display = 'block';
          if (progressBar) progressBar.style.width = `${percentNum}%`;
          if (progressPercent) progressPercent.textContent = `${percentNum} %`;
          if (progressLabel) progressLabel.textContent = `Téléchargement du paquet v${availableVersion || ''}...`;
        }
        break;

      case 'downloaded':
        if (icon) icon.textContent = '🎉';
        title.textContent = 'Téléchargement terminé !';
        desc.textContent = 'La mise à jour a été téléchargée avec succès. Cliquez sur Redémarrer pour finaliser l\'installation.';
        if (chip) chip.classList.add('status-connected');
        if (dot) dot.style.backgroundColor = '#10b981';

        btnCheck.style.display = 'none';
        if (btnInstall) {
          btnInstall.style.display = 'inline-flex';
          btnInstall.disabled = this.isBusy;
        }
        break;

      case 'not-available':
        if (icon) icon.textContent = '✅';
        title.textContent = 'Aucune mise à jour disponible';
        desc.textContent = `Votre application est à jour (la version ${this.currentVersion} est la plus récente).`;
        if (chip) chip.classList.add('status-connected');
        if (dot) dot.style.backgroundColor = '#10b981';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.textContent = '🔄';
        break;

      case 'dev-mode':
        if (icon) icon.textContent = '🛠️';
        title.textContent = 'Mode développement';
        desc.textContent = 'L\'application s\'exécute en mode développement (non empaquetée). La recherche automatique de mises à jour est désactivée.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#94a3b8';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.textContent = '🔄';
        break;

      case 'error':
        if (icon) icon.textContent = '⚠️';
        title.textContent = 'Erreur lors de la mise à jour';
        desc.textContent = this.lastError
          ? `Détail : ${this.lastError}`
          : 'Impossible de contacter le serveur de mise à jour. Vérifiez votre connexion Internet.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#ef4444';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Réessayer';
        if (btnCheckIcon) btnCheckIcon.textContent = '🔄';
        break;

      case 'idle':
      default:
        if (icon) icon.textContent = '✨';
        title.textContent = 'Prêt à vérifier';
        desc.textContent = 'Cliquez sur le bouton pour rechercher une nouvelle version sur GitHub Releases.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#94a3b8';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.textContent = '🔄';
        break;
    }
  }
};

SettingsManager.updater = UpdateManager;

// Exposer globalement pour compatibilité
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
  window.UpdateManager = UpdateManager;
}

// Auto-initialisation au chargement du DOM si disponible
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      SettingsManager.init();
    });
  } else {
    SettingsManager.init();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SettingsManager, UpdateManager };
}
