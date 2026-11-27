/**
 * Antigravité - Module de Gestion des Paramètres et de l'Apparence
 */

const SettingsManager = {
  initialized: false,
  currentTab: 'customization',
  currentSeriousSubtab: 'performance',

  init(options = {}) {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    if (!options || !options.deferRender) {
      this.render();
      this.refreshDesktopPrefsUI();
    }
    if (this.updater && typeof this.updater.init === 'function') {
      this.updater.init();
    }
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const rev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function')
      ? StorageManager.getRevision('settings')
      : -1;
    if (rev !== -1 && this._lastRenderedRev === rev) {
      if (this.currentTab === 'serious') this.refreshSeriousTabLiveData();
      return;
    }
    this.render();
    this.refreshDesktopPrefsUI();
  },

  switchTab(tabId) {
    if (!tabId) return;
    this.currentTab = tabId;

    if (typeof document === 'undefined') return;
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsTab === tabId);
    });

    const panes = {
      customization: document.getElementById('settings-pane-customization'),
      display: document.getElementById('settings-pane-display'),
      'sync-updates': document.getElementById('settings-pane-sync-updates'),
      help: document.getElementById('settings-pane-help'),
      serious: document.getElementById('settings-pane-serious'),
      contact: document.getElementById('settings-pane-contact')
    };

    Object.keys(panes).forEach(k => {
      if (panes[k]) {
        panes[k].style.display = (k === tabId) ? 'flex' : 'none';
        panes[k].classList.toggle('active', k === tabId);
      }
    });

    // Actualiser les informations temps réel si l'onglet Connexion Google & Mises à jour est sélectionné
    if (tabId === 'sync-updates') {
      if (typeof GoogleSyncManager !== 'undefined' && typeof GoogleSyncManager.refreshStatus === 'function') {
        GoogleSyncManager.refreshStatus();
      }
      if (this.updater && typeof this.updater.render === 'function') {
        this.updater.render();
      }
    } else if (tabId === 'serious' && !this._renderingInProgress) {
      this.refreshSeriousTabLiveData();
    }
  },

  _applySeriousSubtabDOM(subtabId) {
    if (typeof document === 'undefined' || !subtabId) return;
    document.querySelectorAll('.serious-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.seriousSubtab === subtabId);
    });

    const subPanes = {
      performance: document.getElementById('serious-pane-performance'),
      startup: document.getElementById('serious-pane-startup'),
      backups: document.getElementById('serious-pane-backups'),
      ui: document.getElementById('serious-pane-ui')
    };

    Object.keys(subPanes).forEach(k => {
      if (subPanes[k]) {
        const isActive = (k === subtabId);
        subPanes[k].style.display = isActive ? 'flex' : 'none';
        subPanes[k].classList.toggle('active', isActive);
      }
    });
  },

  switchSeriousSubtab(subtabId) {
    if (!subtabId) return;
    this.currentSeriousSubtab = subtabId;
    this._applySeriousSubtabDOM(subtabId);

    if (subtabId === 'performance') {
      this.refreshCacheStats();
      this.refreshDiagnostics();
    } else if (subtabId === 'startup' || subtabId === 'backups') {
      this.refreshDesktopPrefsUI();
    }
  },

  bindEvents() {
    // 0. Écouteurs directs sur les boutons d'onglets de paramètres
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.settingsTab;
        if (tab) this.switchTab(tab);
      });
    });

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
        // Navigation sous-onglets
        const tabBtn = e.target.closest('.settings-tab-btn');
        if (tabBtn && tabBtn.dataset.settingsTab) {
          e.preventDefault();
          this.switchTab(tabBtn.dataset.settingsTab);
          return;
        }

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
          const customId = accentBubble.dataset.customAccentId;
          const editBtn = e.target.closest('.bubble-edit-btn');
          if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (customId) this.openCustomAccentPopover(customId, editBtn);
            return;
          }
          if (e.target.closest('.bubble-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            if (customId) this.deleteCustomAccentColor(customId);
            return;
          }
          e.preventDefault();
          this.updateSetting('accentColor', accentBubble.dataset.accentVal);
          return;
        }

        // C. Taille de police
        const fontBtn = e.target.closest('.font-size-option-btn');
        if (fontBtn && fontBtn.dataset.sizeVal) {
          e.preventDefault();
          this.updateSetting('fontSize', fontBtn.dataset.sizeVal);
          return;
        }

        // D-bis. Famille typographique (Police d'écriture)
        const fontFamBtn = e.target.closest('.font-family-option-btn');
        if (fontFamBtn && fontFamBtn.dataset.fontFamilyVal) {
          e.preventDefault();
          this.updateSetting('fontFamily', fontFamBtn.dataset.fontFamilyVal);
          return;
        }

        // E. Arrondis des angles
        const radiusBtn = e.target.closest('.radius-option-btn');
        if (radiusBtn && radiusBtn.dataset.radiusVal) {
          e.preventDefault();
          this.updateSetting('borderRadius', radiusBtn.dataset.radiusVal);
          return;
        }

        // E-bis. Translucidité des panneaux (Glassmorphism)
        const glassBtn = e.target.closest('.glass-option-btn');
        if (glassBtn && glassBtn.dataset.glassVal) {
          e.preventDefault();
          this.updateSetting('glassStyle', glassBtn.dataset.glassVal);
          return;
        }

        // F. Fond d'écran prédéfini ou retrait
        const wpCard = e.target.closest('.wallpaper-card');
        if (wpCard && wpCard.dataset.wallpaper) {
          const customId = wpCard.dataset.customWpId;
          if (e.target.closest('.wallpaper-edit-btn')) {
            e.preventDefault();
            e.stopPropagation();
            if (customId) this.editCustomWallpaper(customId);
            return;
          }
          if (e.target.closest('.wallpaper-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            if (customId) this.deleteCustomWallpaper(customId);
            return;
          }
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

        // G. Choix des moments de notification pour l'agenda (Choix multiples)
        const notifCard = e.target.closest('.agenda-notif-option-card');
        if (notifCard && notifCard.dataset.stage) {
          e.preventDefault();
          const stage = notifCard.dataset.stage;
          const currentSettings = StorageManager.getSettings();
          const currentStages = Array.isArray(currentSettings.agendaNotificationStages)
            ? [...currentSettings.agendaNotificationStages]
            : ['60m', '30m', 'now'];

          const idx = currentStages.indexOf(stage);
          if (idx >= 0) {
            currentStages.splice(idx, 1);
          } else {
            currentStages.push(stage);
          }

          this.updateSetting('agendaNotificationStages', currentStages, true);

          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            const labels = {
              '60m': '1 heure avant',
              '30m': '30 minutes avant',
              'now': 'À l\'heure précise'
            };
            const isActive = currentStages.includes(stage);
            App.showToast(`Rappel ${labels[stage] || stage} ${isActive ? 'activé' : 'désactivé'}`, 'info');
          }
          return;
        }

        // H. Bouton de test de notification d'agenda
        const btnTestNotif = e.target.closest('#btn-test-notification');
        if (btnTestNotif) {
          e.preventDefault();
          if (typeof AgendaNotificationManager !== 'undefined' && typeof AgendaNotificationManager.testNotification === 'function') {
            AgendaNotificationManager.testNotification('30m');
          } else if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("🔔 Antigravité • Exemple de notification test !", "info");
          }
          return;
        }

        // H-bis. Bouton d'écoute du carillon sonore
        const btnPrevSound = e.target.closest('#btn-preview-sound');
        if (btnPrevSound) {
          e.preventDefault();
          const curSettings = StorageManager.getSettings();
          const soundType = curSettings.notificationSound || 'zen';
          const volume = (curSettings.notificationVolume !== undefined ? curSettings.notificationVolume : 60) / 100;
          if (typeof SoundManager !== 'undefined' && typeof SoundManager.playSound === 'function') {
            SoundManager.playSound(soundType, volume);
          }
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            const soundNames = {
              zen: 'Tintement Zen',
              chime: 'Carillon Mélodieux',
              pop: 'Goutte d\'eau',
              none: 'Silencieux (aucun son)'
            };
            App.showToast(`Écoute : ${soundNames[soundType] || soundType}`, 'info');
          }
          return;
        }

        // I. Clics dans la prévisualisation (démonstration interactive)
        const demoBtn = e.target.closest('#appearance-live-preview .btn');
        if (demoBtn) {
          e.preventDefault();
          const label = demoBtn.textContent.trim();
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast(`Aperçu : bouton "${label}"`, 'info');
          }
          return;
        }

        // J. Paramètres sérieux : sous-onglets, profils de performance, comportement fermeture, presets rétention
        const seriousSubBtn = e.target.closest('.serious-subtab-btn');
        if (seriousSubBtn && seriousSubBtn.dataset.seriousSubtab) {
          e.preventDefault();
          this.switchSeriousSubtab(seriousSubBtn.dataset.seriousSubtab);
          return;
        }

        const perfCard = e.target.closest('.perf-mode-card');
        if (perfCard && perfCard.dataset.perfMode) {
          e.preventDefault();
          this.updateSetting('performanceMode', perfCard.dataset.perfMode);
          return;
        }

        const bgCloseCard = e.target.closest('.serious-choice-card');
        if (bgCloseCard && bgCloseCard.dataset.bgClose !== undefined) {
          e.preventDefault();
          const runBg = bgCloseCard.dataset.bgClose === 'true';
          this.updateSetting('runInBackgroundOnClose', runBg);
          return;
        }

        const retPresetBtn = e.target.closest('.backup-retention-preset');
        if (retPresetBtn && retPresetBtn.dataset.retention) {
          e.preventDefault();
          const val = parseInt(retPresetBtn.dataset.retention, 10);
          const inputRet = document.getElementById('input-backup-retention-count');
          if (inputRet) inputRet.value = val;
          this.applyBackupRetentionSetting(val);
          return;
        }
      });
    }

    // 2-bis. Ouverture du Studio de Création de Fond d'Écran
    const btnOpenStudio = document.getElementById('btn-open-wallpaper-studio');
    if (btnOpenStudio) {
      btnOpenStudio.addEventListener('click', (e) => {
        e.preventDefault();
        this.openWallpaperStudioModal();
      });
    }

    // 2-ter. Événements des couleurs d'accentuation personnalisées
    this.bindCustomAccentEvents();

    // 3. Import d'image personnalisée de fond d'écran
    const fileInput = document.getElementById('wallpaper-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await this.processImageFile(file);
          const bgValue = (typeof StorageManager !== 'undefined' && typeof StorageManager.saveCustomWallpaperDataUrl === 'function')
            ? await StorageManager.saveCustomWallpaperDataUrl(dataUrl)
            : dataUrl;
          this.updateSetting('backgroundImage', bgValue || dataUrl);
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Image de fond d'écran appliquée", "success");
          }
        } catch (err) {
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Impossible de charger l'image : " + err.message, "error");
          }
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
        this.updateSliderFill(e.target);
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
        this.updateSliderFill(e.target);
        this.updateSetting('backgroundBlur', val, true);
      });
    }

    // 6. Choix de la tonalité audio des rappels
    const soundSelect = document.getElementById('select-notification-sound');
    if (soundSelect) {
      soundSelect.addEventListener('change', (e) => {
        const soundVal = e.target.value;
        this.updateSetting('notificationSound', soundVal);
        if (soundVal !== 'none' && typeof SoundManager !== 'undefined' && typeof SoundManager.playSound === 'function') {
          const curSettings = StorageManager.getSettings();
          const volume = (curSettings.notificationVolume !== undefined ? curSettings.notificationVolume : 60) / 100;
          SoundManager.playSound(soundVal, volume);
        }
      });
    }

    // 7. Curseur de volume sonore des rappels
    const volumeSlider = document.getElementById('slider-notification-volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        const volumeVal = document.getElementById('label-notification-volume');
        if (volumeVal) volumeVal.textContent = `${val}%`;
        this.updateSliderFill(e.target);
        this.updateSetting('notificationVolume', val, true);
      });
    }

    // 8. Message personnalisé & Profil (Nom / Prénom d'usage)
    const inputUserName = document.getElementById('input-user-name');
    const btnSaveUserName = document.getElementById('btn-save-user-name');
    const saveName = (silentToast = false) => {
      if (!inputUserName) return;
      const val = inputUserName.value.trim();
      const prev = ((StorageManager.getSettings && StorageManager.getSettings().userName) || '').trim();
      if (silentToast && val === prev) return;
      this.updateSetting('userName', val, true);
      if (typeof App !== 'undefined' && typeof App.updateLiveClockNow === 'function') {
        App.updateLiveClockNow();
      }
      this.updateGreetingPreview();
      if (!silentToast && typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast(val ? `Prénom enregistré : ${val}` : "Prénom réinitialisé", "success");
      }
    };
    if (btnSaveUserName) {
      btnSaveUserName.addEventListener('click', (e) => {
        e.preventDefault();
        saveName(false);
      });
    }
    if (inputUserName) {
      inputUserName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveName(false);
        }
      });
      inputUserName.addEventListener('input', () => {
        this.updateGreetingPreview();
      });
      inputUserName.addEventListener('change', () => {
        saveName(true);
      });
    }

    // 9. Tonalité des phrases d'accueil
    const selectMood = document.getElementById('select-greeting-mood');
    if (selectMood) {
      selectMood.addEventListener('change', (e) => {
        const val = e.target.value;
        this.updateSetting('greetingMood', val);
        const groupCustom = document.getElementById('group-custom-greeting');
        if (groupCustom) {
          groupCustom.style.display = val === 'custom' ? 'block' : 'none';
        }
        if (typeof App !== 'undefined' && typeof App.updateDashboardQuote === 'function') {
          App.updateDashboardQuote(true);
        }
        this.updateGreetingPreview();
      });
    }

    // 10. Phrase personnalisée sur-mesure
    const inputCustomPhrase = document.getElementById('input-custom-phrase');
    const btnSaveCustomPhrase = document.getElementById('btn-save-custom-phrase');
    const saveCustomPhrase = (silentToast = false) => {
      if (!inputCustomPhrase) return;
      const val = inputCustomPhrase.value.trim();
      const prev = ((StorageManager.getSettings && StorageManager.getSettings().customGreetingPhrase) || '').trim();
      if (silentToast && val === prev) return;
      this.updateSetting('customGreetingPhrase', val, true);
      if (typeof App !== 'undefined' && typeof App.updateDashboardQuote === 'function') {
        App.updateDashboardQuote(true);
      }
      this.updateGreetingPreview();
      if (!silentToast && typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast("Phrase personnalisée enregistrée", "success");
      }
    };
    if (btnSaveCustomPhrase) {
      btnSaveCustomPhrase.addEventListener('click', (e) => {
        e.preventDefault();
        saveCustomPhrase(false);
      });
    }
    if (inputCustomPhrase) {
      inputCustomPhrase.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveCustomPhrase(false);
        }
      });
      inputCustomPhrase.addEventListener('input', () => {
        this.updateGreetingPreview();
      });
      inputCustomPhrase.addEventListener('change', () => {
        saveCustomPhrase(true);
      });
    }

    // 11. Options du volet latéral (Progression de la journée & Mini-lecteur de musique)
    const chkDayProgress = document.getElementById('setting-sidebar-day-progress');
    if (chkDayProgress) {
      chkDayProgress.addEventListener('change', (e) => {
        this.updateSetting('sidebarDayProgressEnabled', e.target.checked);
        if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
          App.applyAppearanceSettings();
        }
      });
    }

    const chkMiniPlayer = document.getElementById('setting-sidebar-mini-player');
    if (chkMiniPlayer) {
      chkMiniPlayer.addEventListener('change', (e) => {
        this.updateSetting('sidebarMiniPlayerEnabled', e.target.checked);
        if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
          App.applyAppearanceSettings();
        }
      });
    }

    const chkStickyNote = document.getElementById('setting-sidebar-sticky-note');
    if (chkStickyNote) {
      chkStickyNote.addEventListener('change', (e) => {
        this.updateSetting('sidebarStickyNoteEnabled', e.target.checked);
        if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
          App.applyAppearanceSettings();
        }
      });
    }

    // 11-quater. Contrôles du Débriefing positif
    const chkDebriefEnabled = document.getElementById('setting-debrief-enabled');
    if (chkDebriefEnabled) {
      chkDebriefEnabled.addEventListener('change', (e) => {
        this.updateSetting('debriefEnabled', e.target.checked);
        if (typeof DebriefManager !== 'undefined') DebriefManager.updateTabVisibility();
      });
    }

    const selDebriefHour = document.getElementById('setting-debrief-hour');
    if (selDebriefHour) {
      selDebriefHour.addEventListener('change', (e) => {
        this.updateSetting('debriefHour', e.target.value);
        if (typeof DebriefManager !== 'undefined') DebriefManager.updateTabVisibility();
      });
    }

    const selDebriefRange = document.getElementById('setting-debrief-weekend-range');
    if (selDebriefRange) {
      selDebriefRange.addEventListener('change', (e) => {
        this.updateSetting('debriefWeekendRange', e.target.value);
      });
    }

    const chkDebriefAlways = document.getElementById('setting-debrief-always-show');
    if (chkDebriefAlways) {
      chkDebriefAlways.addEventListener('change', (e) => {
        this.updateSetting('debriefAlwaysShowTab', e.target.checked);
        if (typeof DebriefManager !== 'undefined') DebriefManager.updateTabVisibility();
      });
    }

    // 12. Toggles d'activation / désactivation des onglets du volet latéral
    document.querySelectorAll('.sidebar-tabs-toggle-grid input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const tabName = e.target.dataset.tabName;
        if (!tabName) return;
        const currentSettings = StorageManager.getSettings();
        if (!currentSettings.sidebarVisibleScreens) {
          currentSettings.sidebarVisibleScreens = {};
        }
        currentSettings.sidebarVisibleScreens[tabName] = e.target.checked;
        StorageManager.saveSettings(currentSettings);
        if (typeof App !== 'undefined' && typeof App.applySidebarTabsVisibility === 'function') {
          App.applySidebarTabsVisibility(currentSettings);
        }
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
          App.showToast(`Onglet « ${tabName} » ${e.target.checked ? 'activé' : 'masqué'}`, 'info');
        }
      });
    });

    // 12-bis. Glisser-déposer pour réorganiser la disposition des onglets du volet latéral
    this.initSidebarTabsDragAndDrop();

    // 13. Paramètres sérieux — Bouton Retour aux paramètres d'usine & contrôles dédiés
    const btnSeriousFactory = document.getElementById('btn-reset-serious-factory');
    if (btnSeriousFactory) {
      btnSeriousFactory.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetSeriousFactoryDefaults();
      });
    }

    const btnRefreshCache = document.getElementById('btn-refresh-cache-stats');
    if (btnRefreshCache) {
      btnRefreshCache.addEventListener('click', (e) => {
        e.preventDefault();
        this.refreshCacheStats(true);
      });
    }

    const btnClearCache = document.getElementById('btn-clear-app-cache');
    if (btnClearCache) {
      btnClearCache.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAppCache();
      });
    }

    const btnRefreshDiag = document.getElementById('btn-refresh-diagnostics');
    if (btnRefreshDiag) {
      btnRefreshDiag.addEventListener('click', (e) => {
        e.preventDefault();
        this.refreshDiagnostics(true);
      });
    }

    const chkLaunchStartup = document.getElementById('setting-launch-on-startup');
    if (chkLaunchStartup) {
      chkLaunchStartup.addEventListener('change', (e) => {
        this.toggleLaunchOnStartup(e.target.checked);
      });
    }

    const selectBackupFreq = document.getElementById('select-backup-frequency');
    if (selectBackupFreq) {
      selectBackupFreq.addEventListener('change', (e) => {
        const val = e.target.value;
        const customWrap = document.getElementById('serious-backup-freq-custom-wrap');
        if (val === 'custom') {
          if (customWrap) customWrap.style.display = 'inline-flex';
          const inputCustomFreq = document.getElementById('input-backup-frequency-hours');
          if (inputCustomFreq) inputCustomFreq.focus();
          return;
        }
        if (customWrap) customWrap.style.display = 'none';
        this.applyBackupFrequencySetting(Number(val));
      });
    }

    const btnApplyCustomFreq = document.getElementById('btn-apply-backup-freq-custom');
    if (btnApplyCustomFreq) {
      btnApplyCustomFreq.addEventListener('click', (e) => {
        e.preventDefault();
        const inputFreq = document.getElementById('input-backup-frequency-hours');
        const hours = inputFreq ? parseInt(inputFreq.value, 10) : 24;
        this.applyBackupFrequencySetting(isNaN(hours) ? 24 : hours);
      });
    }

    const btnApplyRetention = document.getElementById('btn-apply-backup-retention');
    if (btnApplyRetention) {
      btnApplyRetention.addEventListener('click', (e) => {
        e.preventDefault();
        const inputRet = document.getElementById('input-backup-retention-count');
        const count = inputRet ? parseInt(inputRet.value, 10) : 20;
        this.applyBackupRetentionSetting(isNaN(count) ? 20 : count);
      });
    }

    const btnChooseBackupDir = document.getElementById('btn-choose-backup-dir');
    if (btnChooseBackupDir) {
      btnChooseBackupDir.addEventListener('click', (e) => {
        e.preventDefault();
        this.chooseBackupDirectory();
      });
    }

    const btnOpenBackupDir = document.getElementById('btn-open-backup-dir');
    if (btnOpenBackupDir) {
      btnOpenBackupDir.addEventListener('click', (e) => {
        e.preventDefault();
        this.openBackupDirectory();
      });
    }

    const btnResetBackupDir = document.getElementById('btn-reset-backup-dir');
    if (btnResetBackupDir) {
      btnResetBackupDir.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetBackupDirectory();
      });
    }

    const bindUiOverrideToggle = (id, settingKey) => {
      const chk = document.getElementById(id);
      if (chk) {
        chk.addEventListener('change', (e) => {
          this.updateSetting(settingKey, !!e.target.checked);
        });
      }
    };
    bindUiOverrideToggle('setting-disable-animations', 'disableAnimations');
    bindUiOverrideToggle('setting-disable-previews', 'disablePreviews');
    bindUiOverrideToggle('setting-disable-hover-effects', 'disableHoverEffects');
    const chkGpuCompat = document.getElementById('setting-gpu-compat-mode');
    if (chkGpuCompat) {
      chkGpuCompat.addEventListener('change', (e) => {
        this.updateSetting('gpuCompatibilityMode', !!e.target.checked);
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
          App.showToast(
            e.target.checked
              ? "Mode compatibilité GPU activé (appliqué complètement au prochain redémarrage)"
              : "Accélération matérielle GPU standard restaurée (au prochain redémarrage)",
            'info'
          );
        }
      });
    }

    // 17. Historique pliable des versions antérieures du changelog
    this.bindChangelogHistoryEvents();
  },

  bindChangelogHistoryEvents() {
    if (typeof document === 'undefined') return;

    const btnToggle = document.getElementById('btn-toggle-changelog-history');
    const wrapper = document.getElementById('changelog-history-wrapper');
    const chevron = document.getElementById('changelog-history-chevron');
    const btnClose = document.getElementById('btn-close-changelog-history');
    const pills = document.querySelectorAll('.changelog-history-pill');
    const archivedCards = document.querySelectorAll('.changelog-archived-card');

    const showCard = (targetVersion) => {
      archivedCards.forEach(card => {
        if (card.dataset.version === targetVersion) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
      pills.forEach(pill => {
        if (pill.dataset.version === targetVersion) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    };

    if (btnToggle && wrapper && !btnToggle._hasChangelogHistoryListener) {
      btnToggle._hasChangelogHistoryListener = true;
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = (wrapper.style.display === 'none' || !wrapper.style.display);
        if (isHidden) {
          wrapper.style.display = 'block';
          if (chevron) chevron.textContent = '▴';
          const activePill = document.querySelector('.changelog-history-pill.active') || pills[0];
          if (activePill && activePill.dataset.version) {
            showCard(activePill.dataset.version);
          }
        } else {
          wrapper.style.display = 'none';
          if (chevron) chevron.textContent = '▾';
        }
      });
    }

    if (btnClose && wrapper && !btnClose._hasChangelogHistoryListener) {
      btnClose._hasChangelogHistoryListener = true;
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        wrapper.style.display = 'none';
        if (chevron) chevron.textContent = '▾';
      });
    }

    pills.forEach(pill => {
      if (!pill._hasChangelogHistoryListener) {
        pill._hasChangelogHistoryListener = true;
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          const version = pill.dataset.version;
          if (version) {
            showCard(version);
          }
        });
      }
    });
  },

  updateGreetingPreview() {
    if (typeof document === 'undefined') return;
    const previewGreeting = document.getElementById('preview-user-greeting');
    const previewPhrase = document.getElementById('preview-user-phrase');
    const inputUserName = document.getElementById('input-user-name');
    const selectMood = document.getElementById('select-greeting-mood');
    const inputCustomPhrase = document.getElementById('input-custom-phrase');

    const name = inputUserName ? inputUserName.value.trim() : '';
    const namePart = name ? ` ${name}` : '';
    const h = new Date().getHours();
    let greetText = `Bonjour${namePart} ! Passez une excellente journée !`;
    if (h >= 18 || h < 5) {
      greetText = `Bonsoir${namePart} ! Passez une excellente soirée !`;
    } else if (h >= 12 && h < 14) {
      greetText = `Bonjour${namePart} ! Bon appétit et très belle journée !`;
    }
    if (previewGreeting) previewGreeting.textContent = greetText;

    const mood = selectMood ? selectMood.value : 'mixed';
    let phraseText = "Ne remettez pas à demain ce que vous pouvez faire... après un bon café ☕.";
    if (mood === 'custom') {
      phraseText = (inputCustomPhrase && inputCustomPhrase.value.trim()) 
        ? inputCustomPhrase.value.trim() 
        : "Votre phrase personnalisée s'affichera ici...";
    } else if (mood === 'warm') {
      phraseText = "J'espère que vous passez une excellente journée.";
    } else if (mood === 'witty') {
      phraseText = "Vos tâches n'ont qu'à bien se tenir : vous êtes aux commandes aujourd'hui.";
    }
    if (previewPhrase) previewPhrase.textContent = phraseText;
  },

  // Initialisation du Glisser-Déposer pour réorganiser la disposition des onglets du volet latéral
  initSidebarTabsDragAndDrop() {
    const grid = document.querySelector('.sidebar-tabs-toggle-grid');
    if (!grid || grid._dndInitialized) return;
    grid._dndInitialized = true;

    let draggedCard = null;
    let isDragging = false;

    // Bouton de réinitialisation de l'ordre par défaut
    const btnResetOrder = document.getElementById('btn-reset-sidebar-tabs-order');
    if (btnResetOrder && !btnResetOrder._listenerBound) {
      btnResetOrder._listenerBound = true;
      btnResetOrder.addEventListener('click', (e) => {
        e.preventDefault();
        let defaultOrder = (StorageManager.DEFAULT_SETTINGS && StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder)
          ? [...StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder]
          : ['tasks', 'projects', 'agenda', 'notes', 'constellation', 'focus', 'music', 'trash', 'backups'];

        if (!defaultOrder.includes('constellation')) {
          const notesIdx = defaultOrder.indexOf('notes');
          if (notesIdx !== -1) defaultOrder.splice(notesIdx + 1, 0, 'constellation');
          else defaultOrder.push('constellation');
        }

        defaultOrder.forEach(tabName => {
          const card = grid.querySelector(`.sidebar-tab-toggle-card[data-tab-name="${tabName}"]`);
          if (card) grid.appendChild(card);
        });

        const currentSettings = StorageManager.getSettings();
        currentSettings.sidebarTabsOrder = [...defaultOrder];
        StorageManager.saveSettings(currentSettings);

        if (typeof App !== 'undefined') {
          if (typeof App.applySidebarTabsOrder === 'function') {
            App.applySidebarTabsOrder(currentSettings.sidebarTabsOrder);
          }
          if (typeof App.triggerHapticFeedback === 'function') {
            App.triggerHapticFeedback();
          }
          if (typeof App.showToast === 'function') {
            App.showToast("Disposition d'origine du volet latéral rétablie", "info");
          }
        }
      });
    }

    const cards = grid.querySelectorAll('.sidebar-tab-toggle-card');
    cards.forEach(card => {
      // Clic sur la carte (hors case à cocher et poignée) pour cocher/décocher confortablement
      card.addEventListener('click', (e) => {
        if (isDragging) return;
        if (e.target && (e.target.closest('input[type="checkbox"]') || e.target.closest('.tab-toggle-checkbox-wrapper') || e.target.closest('.tab-drag-handle'))) {
          return;
        }
        const chk = card.querySelector('input[type="checkbox"]');
        if (chk) {
          chk.checked = !chk.checked;
          chk.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Événements Glisser-Déposer
      card.addEventListener('dragstart', (e) => {
        if (e.target && e.target.closest('input[type="checkbox"]')) {
          e.preventDefault();
          return;
        }
        draggedCard = card;
        isDragging = true;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', card.dataset.tabName || '');
          e.dataTransfer.effectAllowed = 'move';
        }
        setTimeout(() => {
          if (draggedCard) draggedCard.classList.add('dragging');
        }, 0);
      });

      card.addEventListener('dragend', () => {
        if (draggedCard) draggedCard.classList.remove('dragging');
        grid.querySelectorAll('.sidebar-tab-toggle-card').forEach(c => c.classList.remove('drag-over-before', 'drag-over-after'));
        draggedCard = null;
        setTimeout(() => {
          isDragging = false;
        }, 150);
      });

      card.addEventListener('dragover', (e) => {
        if (!draggedCard || draggedCard === card) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

        const rect = card.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = rect.top + rect.height / 2;
        const isAfter = (e.clientX > midX) || (e.clientY > midY && Math.abs(e.clientX - midX) < 40);

        card.classList.toggle('drag-over-before', !isAfter);
        card.classList.toggle('drag-over-after', isAfter);
      });

      card.addEventListener('dragleave', (e) => {
        if (card.contains(e.relatedTarget)) return;
        card.classList.remove('drag-over-before', 'drag-over-after');
      });

      card.addEventListener('drop', (e) => {
        if (!draggedCard || draggedCard === card) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = card.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = rect.top + rect.height / 2;
        const isAfter = (e.clientX > midX) || (e.clientY > midY && Math.abs(e.clientX - midX) < 40);

        grid.querySelectorAll('.sidebar-tab-toggle-card').forEach(c => c.classList.remove('drag-over-before', 'drag-over-after'));

        if (isAfter) {
          card.after(draggedCard);
        } else {
          card.before(draggedCard);
        }

        // Calculer le nouvel ordre des onglets
        const newOrder = Array.from(grid.querySelectorAll('.sidebar-tab-toggle-card'))
          .map(c => c.dataset.tabName)
          .filter(Boolean);

        const currentSettings = StorageManager.getSettings();
        currentSettings.sidebarTabsOrder = newOrder;
        StorageManager.saveSettings(currentSettings);

        // Répercuter immédiatement sur le volet des onglets en direct
        if (typeof App !== 'undefined') {
          if (typeof App.applySidebarTabsOrder === 'function') {
            App.applySidebarTabsOrder(newOrder);
          }
          if (typeof App.triggerHapticFeedback === 'function') {
            App.triggerHapticFeedback();
          }
          if (typeof App.showToast === 'function') {
            const movedName = draggedCard.querySelector('.tab-toggle-name')?.textContent || draggedCard.dataset.tabName;
            App.showToast(`Disposition du volet mise à jour (${movedName})`, 'info');
          }
        }
      });
    });
  },

  // Traitement et optimisation locale d'une image choisie par l'utilisateur
  processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 900;
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
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
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') {
      this._lastRenderedRev = StorageManager.getRevision('settings');
    }
    const settings = StorageManager.getSettings();

    // 1. Thème
    document.querySelectorAll('.theme-option-card').forEach(card => {
      card.classList.toggle('active', card.dataset.themeVal === settings.theme);
    });

    // 2. Couleur d'accentuation
    this.renderCustomAccentColors(settings);

    document.querySelectorAll('.accent-option-bubble').forEach(bubble => {
      bubble.classList.toggle('active', bubble.dataset.accentVal === settings.accentColor);
    });

    const isCustomAccent = typeof settings.accentColor === 'string' && settings.accentColor.startsWith('#');
    const hexInput = document.getElementById('accent-color-hex-input');
    const pickerInput = document.getElementById('accent-color-picker-input');
    const pickerPreview = document.getElementById('custom-accent-picker-preview');
    if (isCustomAccent) {
      if (hexInput && document.activeElement !== hexInput) hexInput.value = settings.accentColor.toUpperCase();
      if (pickerInput) pickerInput.value = settings.accentColor;
      if (pickerPreview) pickerPreview.style.background = settings.accentColor;
    } else {
      if (hexInput && document.activeElement !== hexInput) hexInput.value = '';
      if (pickerInput) pickerInput.value = '';
      if (pickerPreview) pickerPreview.style.background = '';
    }

    // 3. Taille de police
    document.querySelectorAll('.font-size-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sizeVal === settings.fontSize);
    });

    // 4-bis. Police d'écriture (Typographie)
    document.querySelectorAll('.font-family-option-btn').forEach(btn => {
      const activeFamily = (settings.fontFamily === 'rounded') ? 'serif' : (settings.fontFamily || 'system');
      btn.classList.toggle('active', btn.dataset.fontFamilyVal === activeFamily || btn.dataset.fontFamilyVal === settings.fontFamily);
    });

    // 5. Arrondis des angles
    document.querySelectorAll('.radius-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.radiusVal === settings.borderRadius);
    });

    // 5-bis. Translucidité des panneaux (Glassmorphism)
    document.querySelectorAll('.glass-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.glassVal === (settings.glassStyle || 'balanced'));
    });

    // 6. Fond d'écran (Image derrière les panneaux)
    const PRESET_NAMES = ['nebula', 'aurora', 'mineral', 'sunset', 'ocean', 'forest', 'cyberpunk', 'minimal', 'lavender', 'solar', 'jade', 'astral', 'polar', 'none'];
    const currentWp = settings.backgroundImage;
    const isStudioWp = Array.isArray(settings.customWallpapers) && settings.customWallpapers.some(w => w.id === currentWp);

    this.renderCustomWallpapers(settings);

    document.querySelectorAll('.wallpaper-card').forEach(card => {
      const wpVal = card.dataset.wallpaper;
      if (!currentWp || currentWp === 'none') {
        card.classList.toggle('active', wpVal === 'none');
      } else if (wpVal) {
        card.classList.toggle('active', wpVal === currentWp);
      } else if (card.classList.contains('wallpaper-card-upload')) {
        const isCustomFile = currentWp && !PRESET_NAMES.includes(currentWp) && !isStudioWp;
        card.classList.toggle('active', !!isCustomFile);
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
    if (opacitySlider) {
      opacitySlider.value = curOpacity;
      this.updateSliderFill(opacitySlider);
    }
    if (opacityVal) opacityVal.textContent = `${curOpacity}%`;

    const blurSlider = document.getElementById('wallpaper-blur-slider');
    const blurVal = document.getElementById('wallpaper-blur-val');
    const curBlur = settings.backgroundBlur !== undefined ? settings.backgroundBlur : 0;
    if (blurSlider) {
      blurSlider.value = curBlur;
      this.updateSliderFill(blurSlider);
    }
    if (blurVal) blurVal.textContent = `${curBlur} px`;

    const customThumb = document.getElementById('wallpaper-custom-thumb');
    if (customThumb) {
      const isCustomFile = currentWp && !PRESET_NAMES.includes(currentWp) && !isStudioWp;
      const thumbSrc = (currentWp === '__custom_wallpaper__' && typeof StorageManager !== 'undefined' && typeof StorageManager.getCustomWallpaperDataUrl === 'function')
        ? StorageManager.getCustomWallpaperDataUrl()
        : currentWp;
      if (isCustomFile && thumbSrc) {
        customThumb.style.backgroundImage = `url("${thumbSrc}")`;
        customThumb.innerHTML = '';
      } else {
        customThumb.style.backgroundImage = 'none';
        customThumb.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>';
      }
    }

    // 7. Choix des moments de notification de l'Agenda (Choix Multiples)
    const activeStages = Array.isArray(settings.agendaNotificationStages)
      ? settings.agendaNotificationStages
      : ['60m', '30m', 'now'];

    document.querySelectorAll('.agenda-notif-option-card').forEach(card => {
      const stage = card.dataset.stage;
      const isSelected = activeStages.includes(stage);
      card.classList.toggle('active', isSelected);
      const checkEl = card.querySelector('.agenda-notif-check');
      if (checkEl) {
        checkEl.textContent = isSelected ? '✓' : '';
      }
    });

    const disabledNotice = document.getElementById('agenda-notif-disabled-notice');
    if (disabledNotice) {
      disabledNotice.style.display = (activeStages.length === 0) ? 'block' : 'none';
    }

    // 7-bis. Tonalité audio & volume des rappels
    const soundSelect = document.getElementById('select-notification-sound');
    if (soundSelect) {
      soundSelect.value = settings.notificationSound || 'zen';
    }

    const volumeSlider = document.getElementById('slider-notification-volume');
    const volumeVal = document.getElementById('label-notification-volume');
    const curVol = settings.notificationVolume !== undefined ? settings.notificationVolume : 60;
    if (volumeSlider) {
      volumeSlider.value = curVol;
      this.updateSliderFill(volumeSlider);
    }
    if (volumeVal) volumeVal.textContent = `${curVol}%`;

    // 8. Message personnalisé & Profil
    const inputUserName = document.getElementById('input-user-name');
    if (inputUserName && document.activeElement !== inputUserName) {
      const curName = (settings.userName && settings.userName.toLowerCase() !== 'utilisateur') ? settings.userName : '';
      inputUserName.value = curName;
    }
    const selectMood = document.getElementById('select-greeting-mood');
    if (selectMood) {
      selectMood.value = settings.greetingMood || 'mixed';
    }
    const groupCustom = document.getElementById('group-custom-greeting');
    if (groupCustom) {
      groupCustom.style.display = (settings.greetingMood === 'custom') ? 'block' : 'none';
    }
    const inputCustomPhrase = document.getElementById('input-custom-phrase');
    if (inputCustomPhrase && document.activeElement !== inputCustomPhrase) {
      inputCustomPhrase.value = settings.customGreetingPhrase || '';
    }
    this.updateGreetingPreview();

    // 9. Mise à jour de l'aperçu en direct
    this.updatePreviewBox(settings);

    // 11. Options du volet latéral (Progression de la journée & Mini-lecteur)
    const chkDayProgress = document.getElementById('setting-sidebar-day-progress');
    if (chkDayProgress) {
      chkDayProgress.checked = settings.sidebarDayProgressEnabled !== false;
    }
    const chkMiniPlayer = document.getElementById('setting-sidebar-mini-player');
    if (chkMiniPlayer) {
      chkMiniPlayer.checked = settings.sidebarMiniPlayerEnabled !== false;
    }
    const chkStickyNote = document.getElementById('setting-sidebar-sticky-note');
    if (chkStickyNote) {
      chkStickyNote.checked = settings.sidebarStickyNoteEnabled !== false;
    }

    // 11-quater. Débriefing et bilan
    const chkDebriefEnabled = document.getElementById('setting-debrief-enabled');
    if (chkDebriefEnabled) {
      chkDebriefEnabled.checked = settings.debriefEnabled !== false;
    }
    const selDebriefHour = document.getElementById('setting-debrief-hour');
    if (selDebriefHour) {
      selDebriefHour.value = settings.debriefHour || '17:00';
    }
    const selDebriefRange = document.getElementById('setting-debrief-weekend-range');
    if (selDebriefRange) {
      selDebriefRange.value = settings.debriefWeekendRange || 'mon-fri';
    }
    const chkDebriefAlways = document.getElementById('setting-debrief-always-show');
    if (chkDebriefAlways) {
      chkDebriefAlways.checked = !!settings.debriefAlwaysShowTab;
    }

    // 11-bis. Synchroniser l'état des toggles d'onglets du volet latéral
    const visibleScreens = settings.sidebarVisibleScreens || {};
    const defaultVisible = {
      agenda: true,
      tasks: true,
      projects: true,
      notes: true,
      trash: true,
      constellation: false,
      focus: false,
      music: false,
      backups: false
    };
    document.querySelectorAll('.sidebar-tabs-toggle-grid input[type="checkbox"]').forEach(chk => {
      const tabName = chk.dataset.tabName;
      if (tabName) {
        chk.checked = (visibleScreens[tabName] !== undefined)
          ? visibleScreens[tabName]
          : (defaultVisible[tabName] !== false);
      }
    });

    // 11-ter. Synchroniser la disposition des cartes d'onglets du volet latéral
    const grid = document.querySelector('.sidebar-tabs-toggle-grid');
    let tabsOrder = (settings && Array.isArray(settings.sidebarTabsOrder))
      ? [...settings.sidebarTabsOrder]
      : (StorageManager.DEFAULT_SETTINGS ? [...StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder] : null);
    if (grid && Array.isArray(tabsOrder)) {
      if (!tabsOrder.includes('constellation')) {
        const notesIdx = tabsOrder.indexOf('notes');
        if (notesIdx !== -1) tabsOrder.splice(notesIdx + 1, 0, 'constellation');
        else tabsOrder.push('constellation');
      }
      tabsOrder.forEach(tabName => {
        const card = grid.querySelector(`.sidebar-tab-toggle-card[data-tab-name="${tabName}"]`);
        if (card) {
          grid.appendChild(card);
        }
      });
    }

    // 12. Mise à jour de la section Mises à jour
    if (this.updater && typeof this.updater.render === 'function') {
      this.updater.render();
    }

    // 12-bis. Mise à jour des contrôles Paramètres sérieux
    this.renderSeriousSettings(settings);

    // 13. Maintenir l'affichage du sous-onglet sélectionné
    this._renderingInProgress = true;
    try {
      this.switchTab(this.currentTab || 'customization');
    } finally {
      this._renderingInProgress = false;
    }

    if (typeof App !== 'undefined' && typeof App.updateAllSlidersFill === 'function') {
      App.updateAllSlidersFill();
    } else {
      this.updateAllSlidersFill();
    }
  },

  // Met à jour le remplissage dynamique à gauche du curseur pour une glissière / tirette de réglage
  updateSliderFill(slider) {
    if (typeof App !== 'undefined' && typeof App.updateSliderFill === 'function') {
      App.updateSliderFill(slider);
    } else if (slider) {
      const min = (slider.min !== '' && !isNaN(parseFloat(slider.min))) ? parseFloat(slider.min) : 0;
      const max = (slider.max !== '' && !isNaN(parseFloat(slider.max))) ? parseFloat(slider.max) : 100;
      const val = (slider.value !== '' && !isNaN(parseFloat(slider.value))) ? parseFloat(slider.value) : min;
      const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
      if (slider.style && typeof slider.style.setProperty === 'function') {
        slider.style.setProperty('--slider-percent', `${pct}%`);
      }
    }
  },

  // Met à jour le remplissage de toutes les glissières / tirettes des paramètres et du studio
  updateAllSlidersFill(container = (typeof document !== 'undefined' ? document : null)) {
    if (typeof App !== 'undefined' && typeof App.updateAllSlidersFill === 'function') {
      App.updateAllSlidersFill(container);
    } else if (container && typeof container.querySelectorAll === 'function') {
      const sliders = container.querySelectorAll('.settings-slider, #wallpaper-opacity-slider, #wallpaper-blur-slider, #slider-notification-volume, #studio-param-angle, #studio-param-size, #studio-param-intensity, #studio-param-blur');
      sliders.forEach(slider => this.updateSliderFill(slider));
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

    if (!silent) {
      this.render();
    } else {
      this.updatePreviewBox(settings);
    }

    if (!silent && typeof App !== 'undefined' && typeof App.showToast === 'function') {
      const labels = {
        theme: 'Thème appliqué',
        accentColor: 'Couleur d\'accentuation mise à jour',
        density: 'Densité mise à jour',
        fontSize: 'Taille du texte ajustée',
        borderRadius: 'Style des angles appliqué',
        backgroundImage: 'Fond d\'écran mis à jour',
        backgroundOpacity: 'Opacité ajustée',
        backgroundBlur: 'Flou d\'arrière-plan ajusté',
        agendaNotificationStages: 'Moments des rappels mis à jour',
        fontFamily: 'Police d\'écriture appliquée',
        glassStyle: 'Translucidité des panneaux mise à jour',
        notificationSound: 'Tonalité de rappel enregistrée',
        notificationVolume: 'Volume sonore ajusté',
        userName: 'Prénom enregistré',
        greetingMood: 'Tonalité des salutations mise à jour',
        customGreetingPhrase: 'Phrase personnalisée enregistrée',
        sidebarDayProgressEnabled: 'Affichage de la progression mis à jour',
        sidebarMiniPlayerEnabled: 'Affichage du mini-lecteur mis à jour',
        performanceMode: value === 'potato'
          ? 'Mode économie extrême activé : priorité absolue à la fluidité'
          : (value === 'economy' ? 'Mode Économie activé' : 'Mode Normal restauré'),
        launchOnStartup: value ? 'Démarrage Windows activé' : 'Démarrage Windows désactivé',
        runInBackgroundOnClose: value ? 'Veille en arrière-plan activée à la fermeture' : 'Fermeture complète activée',
        autoBackupFrequencyHours: value === 0 ? 'Sauvegardes automatiques désactivées (manuel uniquement)' : `Fréquence de sauvegarde fixée à ${value} h`,
        backupRetentionCount: `Conservation limitée aux ${value} dernières sauvegardes`,
        backupDirectory: value ? 'Dossier de sauvegarde personnalisé enregistré' : 'Dossier de sauvegarde par défaut rétabli',
        disableAnimations: value ? 'Animations désactivées' : 'Animations réactivées',
        disablePreviews: value ? 'Aperçus dynamiques désactivés' : 'Aperçus dynamiques réactivés',
        disableHoverEffects: value ? 'Effets de survol désactivés' : 'Effets de survol réactivés'
      };
      App.showToast(labels[key] || "Paramètre mis à jour", "info");
    }
  },

  // Réinitialiser les paramètres d'apparence par défaut
  async resetDefaults() {
    let shouldReset = true;
    if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
      shouldReset = await App.confirm({
        title: "Rétablir l'apparence par défaut",
        message: "Rétablir les paramètres d'apparence par défaut d'Antigravité ?\n(Vos données de tâches, notes et projets restent intactes).",
        confirmText: "Rétablir l'apparence",
        danger: false,
        icon: "🎨"
      });
    } else if (typeof confirm === 'function') {
      shouldReset = confirm("Rétablir les paramètres d'apparence par défaut d'Antigravité ?");
    }
    if (!shouldReset) return;

    const defaults = Object.assign({}, StorageManager.DEFAULT_SETTINGS);
    StorageManager.saveSettings(defaults);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(defaults);
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Paramètres d'apparence réinitialisés", "success");
    }
  },

  // =========================================================================
  // PARAMÈTRES SÉRIEUX : LOGIQUE UI, CACHE, DIAGNOSTIC, DÉMARRAGE & SAUVEGARDES
  // =========================================================================

  renderSeriousSettings(settings) {
    if (typeof document === 'undefined' || !settings) return;

    // 1. Profils de performance
    const activePerf = settings.performanceMode || 'normal';
    document.querySelectorAll('.perf-mode-card').forEach(card => {
      card.classList.toggle('active', card.dataset.perfMode === activePerf);
    });

    // 2. Comportement à la fermeture & Démarrage
    const runInBg = settings.runInBackgroundOnClose !== false;
    document.querySelectorAll('.serious-choice-card').forEach(card => {
      if (card.dataset.bgClose !== undefined) {
        card.classList.toggle('active', (card.dataset.bgClose === 'true') === runInBg);
      }
    });

    const chkStartup = document.getElementById('setting-launch-on-startup');
    if (chkStartup) chkStartup.checked = settings.launchOnStartup === true;

    // 3. Fréquence des sauvegardes, rétention et dossier
    const freqHours = (typeof BackupManager !== 'undefined' && typeof BackupManager.getConfiguredFrequencyHours === 'function')
      ? BackupManager.getConfiguredFrequencyHours(settings)
      : (settings.autoBackupFrequencyHours !== undefined ? Number(settings.autoBackupFrequencyHours) : 24);

    const selectFreq = document.getElementById('select-backup-frequency');
    const customWrap = document.getElementById('serious-backup-freq-custom-wrap');
    const inputFreq = document.getElementById('input-backup-frequency-hours');
    const zeroWarn = document.getElementById('serious-backup-zero-warning');
    const standardFreqs = ['0', '1', '6', '12', '24', '72', '168'];

    if (selectFreq) {
      const freqStr = String(freqHours);
      if (standardFreqs.includes(freqStr)) {
        selectFreq.value = freqStr;
        if (customWrap) customWrap.style.display = 'none';
      } else {
        selectFreq.value = 'custom';
        if (customWrap) customWrap.style.display = 'inline-flex';
      }
    }
    if (inputFreq && document.activeElement !== inputFreq) inputFreq.value = String(freqHours);
    if (zeroWarn) zeroWarn.style.display = (freqHours === 0) ? 'flex' : 'none';

    const retention = (typeof BackupManager !== 'undefined' && typeof BackupManager.getConfiguredRetentionCount === 'function')
      ? BackupManager.getConfiguredRetentionCount(settings)
      : Math.max(1, parseInt(settings.backupRetentionCount, 10) || 20);
    const inputRet = document.getElementById('input-backup-retention-count');
    if (inputRet && document.activeElement !== inputRet) {
      inputRet.value = String(retention);
    }
    document.querySelectorAll('.backup-retention-preset').forEach(btn => {
      btn.classList.toggle('btn-primary', Number(btn.dataset.retention) === retention);
      btn.classList.toggle('btn-secondary', Number(btn.dataset.retention) !== retention);
    });

    // 4. Overrides interface indépendants & GPU
    const chkAnim = document.getElementById('setting-disable-animations');
    const chkPrev = document.getElementById('setting-disable-previews');
    const chkHover = document.getElementById('setting-disable-hover-effects');
    const chkGpuCompat = document.getElementById('setting-gpu-compat-mode');
    if (chkAnim) chkAnim.checked = settings.disableAnimations === true;
    if (chkPrev) chkPrev.checked = settings.disablePreviews === true;
    if (chkHover) chkHover.checked = settings.disableHoverEffects === true;
    if (chkGpuCompat) chkGpuCompat.checked = settings.gpuCompatibilityMode === true;

    // 5. Maintenir le sous-onglet sélectionné
    this._applySeriousSubtabDOM(this.currentSeriousSubtab || 'performance');
  },

  formatBytes(bytes) {
    const val = Math.max(0, Number(bytes) || 0);
    if (val < 1024) return `${val} o`;
    if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} Ko`;
    return `${(val / (1024 * 1024)).toFixed(2)} Mo`;
  },

  refreshSeriousTabLiveData() {
    this.refreshCacheStats();
    this.refreshDiagnostics();
    this.refreshDesktopPrefsUI();
  },

  async refreshDesktopPrefsUI() {
    if (typeof document === 'undefined') return;
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    const pathEl = document.getElementById('serious-backup-dir-path');
    const badgeEl = document.getElementById('serious-backup-dir-badge');
    const startupNote = document.getElementById('serious-startup-status-note');
    const chkStartup = document.getElementById('setting-launch-on-startup');

    if (api && api.system && typeof api.system.getDesktopPrefs === 'function') {
      try {
        const prefs = await api.system.getDesktopPrefs();
        if (prefs) {
          if (chkStartup && typeof prefs.launchOnStartup === 'boolean') {
            chkStartup.checked = prefs.launchOnStartup;
            if (typeof StorageManager !== 'undefined') {
              const currentSettings = StorageManager.getSettings();
              if (currentSettings.launchOnStartup !== prefs.launchOnStartup) {
                currentSettings.launchOnStartup = prefs.launchOnStartup;
                StorageManager.saveSettings(currentSettings);
              }
            }
          }
          if (startupNote) {
            if (!prefs.startupSupported) {
              startupNote.textContent = "Cette option est réservée aux ordinateurs sous Windows.";
              if (chkStartup) chkStartup.disabled = true;
            } else if (!prefs.isPackaged) {
              startupNote.textContent = "Mode développement détecté : le raccourci pointe vers cette session locale (en version installée, il pointera directement vers Antigravité).";
            } else {
              startupNote.textContent = "Démarre Antigravité avec la fenêtre ouverte normalement à l'ouverture de session Windows (dossier Démarrage et registre).";
            }
          }
          if (pathEl && prefs.activeBackupDir) {
            pathEl.textContent = prefs.activeBackupDir;
          }
          if (badgeEl) {
            const isCustom = !!(prefs.backupDirectory && prefs.activeBackupDir !== prefs.defaultBackupDir);
            badgeEl.textContent = isCustom ? 'Personnalisé' : 'Usine';
            badgeEl.style.backgroundColor = isCustom ? 'rgba(56, 189, 248, 0.14)' : 'rgba(16, 185, 129, 0.14)';
            badgeEl.style.color = isCustom ? 'var(--accent)' : '#10b981';
          }
        }
      } catch (err) {
        console.warn('[Settings] Impossible de lire les préférences bureau:', err);
      }
    } else {
      if (pathEl) pathEl.textContent = "Mode navigateur autonome (métadonnées locales)";
      if (startupNote) startupNote.textContent = "Disponible dans l'application bureau Windows.";
    }
  },

  async toggleLaunchOnStartup(enabled) {
    const wantEnabled = !!enabled;
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.setStartupSetting === 'function') {
      try {
        const res = await api.system.setStartupSetting(wantEnabled);
        const actualEnabled = !!(res && res.enabled);
        if (wantEnabled && !actualEnabled) {
          const chkStartup = typeof document !== 'undefined' ? document.getElementById('setting-launch-on-startup') : null;
          if (chkStartup) chkStartup.checked = false;
          this.updateSetting('launchOnStartup', false, true);
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Impossible d'activer le démarrage automatique Windows (vérifiez les autorisations).", "error");
          }
          return;
        }
        this.updateSetting('launchOnStartup', actualEnabled);
        return;
      } catch (err) {
        console.warn('[Settings] Erreur toggleLaunchOnStartup:', err);
        if (wantEnabled) {
          const chkStartup = typeof document !== 'undefined' ? document.getElementById('setting-launch-on-startup') : null;
          if (chkStartup) chkStartup.checked = false;
          this.updateSetting('launchOnStartup', false, true);
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Erreur lors de la configuration du démarrage automatique Windows.", "error");
          }
          return;
        }
      }
    }
    this.updateSetting('launchOnStartup', wantEnabled);
  },

  applyBackupFrequencySetting(hours) {
    const clamped = Math.max(0, Math.min(8760, Math.round(Number(hours) || 0)));
    const settings = StorageManager.getSettings();
    settings.autoBackupFrequencyHours = clamped;
    settings.autoBackupOnLaunch = clamped > 0;
    StorageManager.saveSettings(settings);

    if (typeof BackupManager !== 'undefined' && typeof BackupManager.setupAutoBackupScheduler === 'function') {
      BackupManager.setupAutoBackupScheduler();
    }
    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(
        clamped === 0
          ? "Sauvegardes automatiques désactivées (mode manuel uniquement)"
          : `Fréquence des sauvegardes automatiques réglée sur ${clamped} h`,
        clamped === 0 ? "warning" : "info"
      );
    }
  },

  async applyBackupRetentionSetting(count) {
    const limit = Math.max(1, Math.min(500, Math.round(Number(count) || 20)));
    const current = StorageManager.getSettings();
    const prevLimit = (typeof BackupManager !== 'undefined' && typeof BackupManager.getConfiguredRetentionCount === 'function')
      ? BackupManager.getConfiguredRetentionCount(current)
      : 20;

    let existingCount = (typeof BackupManager !== 'undefined') ? BackupManager.getAll().length : 0;
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && typeof api.listBackups === 'function') {
      try {
        const disk = await api.listBackups();
        if (Array.isArray(disk)) existingCount = Math.max(existingCount, disk.length);
      } catch (_) {}
    }

    if (existingCount > limit) {
      const excess = existingCount - limit;
      let ok = true;
      if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
        ok = await App.confirm({
          title: 'Réduire le nombre de sauvegardes conservées',
          message: `Vous avez actuellement ${existingCount} sauvegardes. Passer la limite à ${limit} supprimera définitivement les ${excess} plus ancienne(s) sur votre disque.\n\nContinuer ?`,
          confirmText: `Supprimer les ${excess} plus ancienne(s)`,
          danger: true,
          icon: '🗑️'
        });
      }
      if (!ok) {
        const inputRet = document.getElementById('input-backup-retention-count');
        if (inputRet) inputRet.value = String(prevLimit);
        return;
      }
    }

    current.backupRetentionCount = limit;
    StorageManager.saveSettings(current);

    let removedDisk = 0;
    if (typeof BackupManager !== 'undefined' && typeof BackupManager.applyRetentionCount === 'function') {
      const res = await BackupManager.applyRetentionCount(limit, true);
      removedDisk = (res && res.removedCount) || 0;
      if (typeof BackupManager.render === 'function') BackupManager.render();
    }

    this.render();
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      const suffix = removedDisk > 0 ? ` (${removedDisk} ancienne(s) purgée(s) sur disque)` : '';
      App.showToast(`Rétention réglée sur ${limit} sauvegarde(s)${suffix}`, "success");
    }
  },

  async chooseBackupDirectory() {
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (!api || typeof api.selectBackupDirectory !== 'function') {
      if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast("Le choix de dossier physique nécessite l'application bureau.", "warning");
      }
      return;
    }

    const res = await api.selectBackupDirectory();
    if (!res || res.canceled || !res.activeDir) return;

    const settings = StorageManager.getSettings();
    settings.backupDirectory = res.activeDir;
    StorageManager.saveSettings(settings);
    this.render();
    await this.refreshDesktopPrefsUI();

    if (res.previousDir && res.previousDir !== res.activeDir && typeof api.copyBackupsToDirectory === 'function') {
      let shouldCopy = false;
      if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
        shouldCopy = await App.confirm({
          title: 'Copier les sauvegardes existantes ?',
          message: `Nouveau dossier sélectionné :\n${res.activeDir}\n\nSouhaitez-vous y copier vos sauvegardes déjà présentes dans l'ancien dossier ? (Les originaux restent intacts par sécurité.)`,
          confirmText: 'Copier les sauvegardes',
          danger: false,
          icon: '📁'
        });
      }
      if (shouldCopy) {
        const copyRes = await api.copyBackupsToDirectory(res.previousDir, res.activeDir);
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
          App.showToast(`${copyRes.copied || 0} sauvegarde(s) copiée(s) vers le nouveau dossier.`, "success");
        }
        return;
      }
    }

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Emplacement des sauvegardes mis à jour", "success");
    }
  },

  async resetBackupDirectory() {
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && typeof api.resetBackupDirectory === 'function') {
      await api.resetBackupDirectory();
    }
    this.updateSetting('backupDirectory', null);
    await this.refreshDesktopPrefsUI();
  },

  async openBackupDirectory() {
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && typeof api.openBackupDirectory === 'function') {
      await api.openBackupDirectory();
    }
  },

  async refreshCacheStats(showToast = false) {
    if (typeof document === 'undefined') return;
    const httpEl = document.getElementById('serious-cache-http-size');
    const localEl = document.getElementById('serious-cache-local-size');
    const memEl = document.getElementById('serious-cache-memory-count');

    const storageStats = (typeof StorageManager !== 'undefined' && typeof StorageManager.getStorageStats === 'function')
      ? StorageManager.getStorageStats()
      : { localStorageBytes: 0, cachedCollections: 0 };

    if (localEl) localEl.textContent = this.formatBytes(storageStats.localStorageBytes);
    if (memEl) memEl.textContent = `${storageStats.cachedCollections} collection(s)`;

    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.getCacheStats === 'function') {
      try {
        const stats = await api.system.getCacheStats();
        if (httpEl) httpEl.textContent = this.formatBytes((stats && stats.httpCacheBytes) || 0);
      } catch (_) {
        if (httpEl) httpEl.textContent = 'Indisponible';
      }
    } else if (httpEl) {
      httpEl.textContent = 'Mode web (0 o)';
    }

    if (showToast && typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Mesures du cache actualisées", "info");
    }
  },

  async clearAppCache() {
    let ok = true;
    if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
      ok = await App.confirm({
        title: 'Vider le cache d\'Antigravité',
        message: "Supprimer les fichiers temporaires (cache HTTP, shaders et cache mémoire) ?\n\nVos tâches, projets, événements d'agenda, notes et sauvegardes restent 100 % préservés.",
        confirmText: 'Vider le cache',
        danger: false,
        icon: '🧹'
      });
    }
    if (!ok) return;

    if (typeof NotesManager !== 'undefined' && typeof NotesManager.flushPendingSave === 'function') {
      NotesManager.flushPendingSave();
    }

    let freedBytes = 0;
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.clearCache === 'function') {
      try {
        const res = await api.system.clearCache();
        freedBytes = (res && res.clearedBytes) || 0;
      } catch (err) {
        console.warn('[Settings] Erreur vidage cache Electron:', err);
      }
    }

    if (typeof StorageManager !== 'undefined' && typeof StorageManager.clearCache === 'function') {
      StorageManager.clearCache();
    }

    await this.refreshCacheStats(false);
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Cache vidé proprement (${this.formatBytes(freedBytes)} libérés). Données intactes !`, "success");
    }
  },

  async refreshDiagnostics(showToast = false) {
    if (typeof document === 'undefined') return;
    const ramEl = document.getElementById('diag-ram-total');
    const heapEl = document.getElementById('diag-heap-sub');
    const cpuEl = document.getElementById('diag-cpu-total');
    const uptimeEl = document.getElementById('diag-uptime-sub');
    const procEl = document.getElementById('diag-process-count');
    const gpuEl = document.getElementById('diag-gpu-status');
    const domEl = document.getElementById('diag-dom-nodes');
    const dataEl = document.getElementById('diag-data-items');
    const breakdownEl = document.getElementById('diag-process-breakdown');

    const domNodes = document.querySelectorAll('*').length;
    const initMs = (typeof App !== 'undefined' && App._initDurationMs !== undefined) ? `${App._initDurationMs} ms` : '—';
    if (domEl) domEl.textContent = `${domNodes} nœuds`;

    const st = (typeof StorageManager !== 'undefined' && typeof StorageManager.getStorageStats === 'function')
      ? StorageManager.getStorageStats()
      : null;
    if (dataEl && st && st.counts) {
      const c = st.counts;
      dataEl.textContent = `${c.tasks} tâches • ${c.events} créneaux • ${c.notes} notes (init ${initMs})`;
    }

    if (heapEl && typeof performance !== 'undefined' && performance.memory) {
      const usedMb = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      heapEl.textContent = `JS Heap : ${usedMb} Mo`;
    }

    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.getPerfDiagnostics === 'function') {
      try {
        const diag = await api.system.getPerfDiagnostics();
        if (diag) {
          if (ramEl) ramEl.textContent = `${diag.totalRamMb} Mo`;
          if (cpuEl) cpuEl.textContent = `${diag.totalCpuPct}%`;
          if (uptimeEl) {
            const mins = Math.floor((diag.uptimeSec || 0) / 60);
            const secs = (diag.uptimeSec || 0) % 60;
            uptimeEl.textContent = `Actif depuis ${mins}m ${secs}s`;
          }
          if (procEl) procEl.textContent = `${diag.processCount} processus`;
          if (gpuEl) gpuEl.textContent = `GPU : ${diag.gpuCompositing || 'inconnu'}`;
          if (breakdownEl && Array.isArray(diag.processes)) {
            breakdownEl.textContent = 'Détail processus : ' + diag.processes
              .map(p => `${p.type} (${p.workingSetMb} Mo, ${p.cpuPct}% CPU)`)
              .join(' • ');
          }
        }
      } catch (err) {
        if (ramEl) ramEl.textContent = 'Erreur';
        console.warn('[Diagnostics] Erreur lecture métriques Electron:', err);
      }
    } else {
      if (ramEl) ramEl.textContent = (typeof performance !== 'undefined' && performance.memory)
        ? `${(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} Mo`
        : 'N/D (web)';
      if (cpuEl) cpuEl.textContent = 'N/D (web)';
      if (procEl) procEl.textContent = 'Navigateur';
      if (gpuEl) gpuEl.textContent = `Mode : ${(StorageManager.getSettings().performanceMode || 'normal')}`;
      if (breakdownEl) breakdownEl.textContent = 'Les métriques multi-processus complètes sont disponibles dans Antigravité Desktop.';
    }

    if (showToast && typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Diagnostic actualisé", "info");
    }
  },

  async resetSeriousFactoryDefaults() {
    let ok = true;
    if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
      ok = await App.confirm({
        title: "Retour aux réglages d'origine",
        message: "Rétablir uniquement les réglages de l'onglet « Système & Performances » à leur comportement d'origine (Mode Normal, veille en arrière-plan, sauvegardes 24 h / 20 versions, dossier par défaut, animations/aperçus/survols actifs) ?\n\nVos tâches, projets, agenda, notes, sauvegardes et votre personnalisation visuelle restent intacts.",
        confirmText: "Rétablir les réglages",
        danger: true,
        icon: "↺"
      });
    } else if (typeof confirm === 'function') {
      ok = confirm("Rétablir les réglages système à leur valeur d'origine ?");
    }
    if (!ok) return;

    const updated = StorageManager.resetSeriousSettings();
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.setStartupSetting === 'function') {
      await api.system.setStartupSetting(false).catch(() => {});
    }
    if (api && typeof api.resetBackupDirectory === 'function') {
      await api.resetBackupDirectory().catch(() => {});
    }
    if (typeof BackupManager !== 'undefined' && typeof BackupManager.setupAutoBackupScheduler === 'function') {
      BackupManager.setupAutoBackupScheduler();
    }
    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(updated);
    }

    this.render();
    this.refreshSeriousTabLiveData();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Réglages système rétablis aux valeurs d'origine", "success");
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
      rose: 'Rose Framboise',
      cyan: 'Cyan Glacier',
      orange: 'Orange Solaire',
      mint: 'Menthe Douce',
      indigo: 'Indigo Profond'
    };

    const themeNames = {
      dark: 'Sombre Élégant',
      oled: 'Sombre Profond (OLED)',
      light: 'Clair Épuré'
    };

    const isHexAccent = typeof settings.accentColor === 'string' && settings.accentColor.startsWith('#');
    let customAccentName = null;
    if (isHexAccent && Array.isArray(settings.customAccentColors)) {
      const found = settings.customAccentColors.find(c => c.hex.toLowerCase() === settings.accentColor.toLowerCase());
      if (found) customAccentName = found.name;
    }
    const accentDisplayName = customAccentName || accentNames[settings.accentColor] || settings.accentColor;

    const descEl = document.getElementById('preview-summary-desc');
    if (descEl) {
      descEl.textContent = `Thème : ${themeNames[settings.theme] || settings.theme} • Accent : ${accentDisplayName} • Densité : ${settings.density === 'compact' ? 'Compacte' : 'Confortable'} • Texte : ${settings.fontSize === 'small' ? 'Compact (90%)' : settings.fontSize === 'large' ? 'Grand (110%)' : 'Normal (100%)'}`;
    }
  },

  /* ==========================================================================
     Personnalisation Chromatique Libre & Nuancier Favori (v1.3.0)
     ========================================================================== */

  bindCustomAccentEvents() {
    const hexInput = document.getElementById('accent-color-hex-input');
    const nameInput = document.getElementById('accent-color-name-input');
    const btnSave = document.getElementById('btn-save-custom-accent');
    const btnOpenPalette = document.getElementById('btn-open-custom-accent-palette');

    // Bouton d'ouverture de la palette intégrée juste à côté
    if (btnOpenPalette) {
      btnOpenPalette.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openCustomAccentPopover(null, btnOpenPalette);
      });
    }

    if (hexInput) {
      const handleHexChange = () => {
        let val = hexInput.value.trim().toUpperCase();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
          hexInput.value = val;
          const preview = document.getElementById('custom-accent-picker-preview');
          if (preview) preview.style.background = val;
          this.updateSetting('accentColor', val, true);
        }
      };
      hexInput.addEventListener('input', handleHexChange);
      hexInput.addEventListener('change', handleHexChange);
      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (btnSave) btnSave.click();
        }
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (btnSave) btnSave.click();
        }
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        let hex = hexInput ? hexInput.value.trim().toUpperCase() : '';
        if (!hex.startsWith('#') && hex.length > 0) hex = '#' + hex;
        if (!/^#[0-9A-F]{6}$/i.test(hex)) {
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast("Format de couleur invalide (ex: #38BDF8)", "warning");
          }
          return;
        }

        const name = (nameInput && nameInput.value.trim()) || ('Teinte ' + hex);
        this.addCustomAccentColor(hex, name, this.editingCustomAccentId);
        this.editingCustomAccentId = null;
        if (nameInput) nameInput.value = '';
        const btnText = btnSave.querySelector('span');
        if (btnText) btnText.textContent = 'Enregistrer';
      });
    }

    this.initCustomAccentPopoverEvents();
  },

  hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return (`#${f(0)}${f(8)}${f(4)}`).toUpperCase();
  },

  hexToHsl(hex) {
    let c = (hex || '#38BDF8').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  },

  _getApp() {
    if (typeof App !== 'undefined') return App;
    if (typeof window !== 'undefined' && window.App) return window.App;
    if (typeof global !== 'undefined' && global.App) return global.App;
    try {
      if (typeof require === 'function') {
        return require('./app.js');
      }
    } catch (e) {}
    return null;
  },

  openCustomAccentPopover(customId = null, targetElement = null) {
    const settings = StorageManager.getSettings();
    this.popoverEditingId = customId || null;
    this.popoverOriginalAccent = settings.accentColor || '#38BDF8';

    let currentColor = '#38BDF8';
    let currentName = '';

    if (customId && Array.isArray(settings.customAccentColors)) {
      const found = settings.customAccentColors.find(c => c.id === customId);
      if (found) {
        currentColor = found.hex;
        currentName = found.name || '';
      }
    } else if (settings.accentColor && settings.accentColor.startsWith('#')) {
      currentColor = settings.accentColor;
    }

    // Résolution sécurisée de l'élément cible s'il est manquant ou non attaché
    if (!targetElement || (typeof targetElement.getBoundingClientRect === 'function' && targetElement.getBoundingClientRect().width === 0 && targetElement.getBoundingClientRect().height === 0)) {
      if (customId && typeof document !== 'undefined') {
        const bubble = document.querySelector(`.accent-option-bubble[data-custom-accent-id="${customId}"]`);
        if (bubble) {
          targetElement = bubble.querySelector('.bubble-edit-btn') || bubble;
        }
      }
      if (!targetElement && typeof document !== 'undefined') {
        targetElement = document.getElementById('btn-open-custom-accent-palette');
      }
    }

    const app = this._getApp();
    if (app && typeof app.openColorPicker === 'function') {
      app.openColorPicker({
        targetElement: targetElement,
        initialColor: currentColor,
        title: customId ? 'Modifier la teinte' : 'Couleur personnalisée',
        applyLabel: customId ? 'Mettre à jour' : 'Enregistrer',
        showNameInput: true,
        initialName: currentName,
        namePlaceholder: 'Nom de la teinte',
        onColorChange: (val) => {
          const mainHexInput = (typeof document !== 'undefined') ? document.getElementById('accent-color-hex-input') : null;
          const mainPreview = (typeof document !== 'undefined') ? document.getElementById('custom-accent-picker-preview') : null;
          if (mainHexInput) mainHexInput.value = val;
          if (mainPreview) mainPreview.style.background = val;
          // Prévisualisation en direct sans détruire le DOM
          const s = StorageManager.getSettings();
          s.accentColor = val;
          if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
            App.applyAppearanceSettings(s);
          }
        },
        onApply: (hex, name) => {
          this.addCustomAccentColor(hex, name, customId);
        },
        onCancel: (initialVal) => {
          if (this.popoverOriginalAccent) {
            this.updateSetting('accentColor', this.popoverOriginalAccent, true);
          }
        }
      });
    }
  },

  closeCustomAccentPopover(revert = false) {
    const app = this._getApp();
    if (app && typeof app.closeColorPicker === 'function') {
      app.closeColorPicker(revert);
    }
    this.popoverEditingId = null;
  },

  updatePopoverColor(hex, source = null) {
    const app = this._getApp();
    if (app && typeof app.updateColorPickerValues === 'function') {
      app.updateColorPickerValues(hex, source);
    }
  },

  initCustomAccentPopoverEvents() {
    const app = this._getApp();
    if (app && typeof app.initColorPickerEvents === 'function') {
      app.initColorPickerEvents();
    }
  },

  addCustomAccentColor(hex, name, editingId = null) {
    if (!hex) return;
    const cleanHex = hex.trim().toUpperCase();
    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customAccentColors)) {
      settings.customAccentColors = [];
    }

    let existing = null;
    if (editingId) {
      existing = settings.customAccentColors.find(c => c.id === editingId);
    }
    if (!existing) {
      existing = settings.customAccentColors.find(c => c.hex === cleanHex);
    }

    let id;
    if (existing) {
      existing.hex = cleanHex;
      existing.name = name || existing.name || cleanHex;
      id = existing.id;
    } else {
      id = 'cac_' + Date.now();
      settings.customAccentColors.push({
        id: id,
        hex: cleanHex,
        name: name || cleanHex
      });
    }

    settings.accentColor = cleanHex;
    StorageManager.saveSettings(settings);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    if (typeof document !== 'undefined') {
      const btnSave = document.getElementById('btn-save-custom-accent');
      if (btnSave) {
        const btnText = btnSave.querySelector('span');
        if (btnText) btnText.textContent = 'Enregistrer';
      }
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Teinte "${name || cleanHex}" enregistrée`, 'success');
    }
  },

  editCustomAccentColor(id, targetElement = null) {
    if (!id) return;
    const bubble = targetElement || (typeof document !== 'undefined' ? (document.querySelector(`.accent-option-bubble[data-custom-accent-id="${id}"] .bubble-edit-btn`) || document.querySelector(`.accent-option-bubble[data-custom-accent-id="${id}"]`)) : null);
    this.openCustomAccentPopover(id, bubble);
  },

  updateCustomAccentColorHex(id, newHex) {
    if (!id || !newHex) return;
    const cleanHex = newHex.trim().toUpperCase();
    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customAccentColors)) return;
    const found = settings.customAccentColors.find(c => c.id === id);
    if (!found) return;

    found.hex = cleanHex;
    settings.accentColor = cleanHex;
    StorageManager.saveSettings(settings);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    this.editingCustomAccentId = null;
    if (typeof document !== 'undefined') {
      const btnSave = document.getElementById('btn-save-custom-accent');
      if (btnSave) {
        const btnText = btnSave.querySelector('span');
        if (btnText) btnText.textContent = 'Enregistrer';
      }
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Teinte "${found.name || cleanHex}" mise à jour`, 'success');
    }
  },

  deleteCustomAccentColor(id) {
    if (!id) return;
    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customAccentColors)) return;

    const idx = settings.customAccentColors.findIndex(c => c.id === id);
    if (idx === -1) return;

    const removed = settings.customAccentColors.splice(idx, 1)[0];

    if (settings.accentColor === removed.hex) {
      settings.accentColor = 'blue';
    }

    StorageManager.saveSettings(settings);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Teinte "${removed.name || removed.hex}" supprimée`, 'info');
    }
  },

  _esc(str) {
    if (typeof App !== 'undefined' && typeof App.escapeHtml === 'function') {
      return App.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  _safeCssColor(val, fallback = '#38BDF8') {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim();
    if (/^#([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(trimmed)) return trimmed;
    if (/^(?:rgb|hsl)a?\(\s*[0-9.%,\s/-]+\)$/i.test(trimmed)) return trimmed;
    return fallback;
  },

  _safeCssBgValue(val) {
    if (typeof val !== 'string') return '';
    return val.replace(/["<>;{}]/g, '');
  },

  renderCustomAccentColors(settings) {
    const section = document.getElementById('custom-accent-colors-section');
    const list = document.getElementById('custom-accent-colors-list');
    const countEl = document.getElementById('custom-accent-colors-count');
    if (!section || !list) return;

    const colors = Array.isArray(settings.customAccentColors) ? settings.customAccentColors : [];
    if (colors.length === 0) {
      section.style.display = 'none';
      list.innerHTML = '';
      if (countEl) countEl.textContent = '';
      return;
    }

    section.style.display = 'block';
    if (countEl) countEl.textContent = `(${colors.length})`;

    list.innerHTML = colors.map(c => {
      const safeHex = this._safeCssColor(c && c.hex, '#38BDF8');
      const safeId = this._esc(c && c.id);
      const safeName = this._esc((c && c.name) || safeHex);
      const isActive = settings.accentColor === (c && c.hex);
      return `
        <div class="accent-option-bubble is-custom ${isActive ? 'active' : ''}"
             data-accent-val="${this._esc(c && c.hex)}"
             data-custom-accent-id="${safeId}"
             style="--bubble-color: ${safeHex};"
             title="${safeName}">
          <span class="bubble-dot"></span>
          <span class="bubble-label">${safeName}</span>
          <span class="bubble-check">✓</span>
          <button type="button" class="bubble-edit-btn" data-custom-id="${safeId}" title="Modifier cette teinte" aria-label="Modifier">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button type="button" class="bubble-delete-btn" title="Supprimer cette teinte" aria-label="Supprimer">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    }).join('');
  },

  /* ==========================================================================
     Studio de Création de Fond d'Écran Génératif CSS (v1.3.0)
     ========================================================================== */

  studioConfig: {
    type: 'mesh',
    colorBase: '#070b14',
    color1: '#6366f1',
    color2: '#38bdf8',
    color3: '#ec4899',
    angle: 135,
    size: 24,
    intensity: 80,
    blur: 0,
    vignette: false,
    name: 'Ambiance Nébuleuse'
  },
  _studioEventsBound: false,

  hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(56, 189, 248, ${alpha})`;
    let clean = hex.trim().replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean.split('').map(ch => ch + ch).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num) || clean.length !== 6) return `rgba(56, 189, 248, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  openWallpaperStudioModal() {
    const app = this._getApp();
    const modal = (app && typeof app.ensureTemplateElement === 'function')
      ? app.ensureTemplateElement('wallpaper-studio-modal', 'tpl-wallpaper-studio-modal')
      : document.getElementById('wallpaper-studio-modal');
    if (!modal) return;
    this.bindStudioEventsOnce();
    this.syncStudioInputsWithConfig();
    this.updateStudioPreview();
    modal.classList.add('active');
    modal.style.display = 'flex';
    if (typeof App !== 'undefined' && typeof App.updateAllSlidersFill === 'function') {
      App.updateAllSlidersFill(modal);
    } else {
      this.updateAllSlidersFill(modal);
    }
  },

  closeWallpaperStudioModal() {
    const modal = document.getElementById('wallpaper-studio-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    this.studioConfig.editingId = null;
    const app = this._getApp();
    if (app && typeof app.closeColorPicker === 'function') {
      app.closeColorPicker(true);
    }
    if (app && typeof app.applyAppearanceSettings === 'function') {
      app.applyAppearanceSettings();
    }
  },

  syncStudioInputsWithConfig() {
    const cfg = this.studioConfig;

    document.querySelectorAll('.studio-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === cfg.type);
    });

    const baseInput = document.getElementById('studio-color-base');
    if (baseInput) {
      baseInput.value = cfg.colorBase;
      baseInput.style.background = cfg.colorBase;
    }
    document.querySelectorAll('.studio-base-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color.toLowerCase() === cfg.colorBase.toLowerCase());
    });

    const c1Input = document.getElementById('studio-color-1');
    const h1Input = document.getElementById('studio-hex-1');
    if (c1Input) {
      c1Input.value = cfg.color1;
      c1Input.style.background = cfg.color1;
    }
    if (h1Input) h1Input.value = cfg.color1.toUpperCase();

    const c2Input = document.getElementById('studio-color-2');
    const h2Input = document.getElementById('studio-hex-2');
    if (c2Input) {
      c2Input.value = cfg.color2;
      c2Input.style.background = cfg.color2;
    }
    if (h2Input) h2Input.value = cfg.color2.toUpperCase();

    const c3Input = document.getElementById('studio-color-3');
    const h3Input = document.getElementById('studio-hex-3');
    if (c3Input) {
      c3Input.value = cfg.color3;
      c3Input.style.background = cfg.color3;
    }
    if (h3Input) h3Input.value = cfg.color3.toUpperCase();

    const angleSlider = document.getElementById('studio-param-angle');
    const angleVal = document.getElementById('studio-param-angle-val');
    if (angleSlider) angleSlider.value = cfg.angle;
    if (angleVal) angleVal.textContent = `${cfg.angle}°`;

    const sizeSlider = document.getElementById('studio-param-size');
    const sizeVal = document.getElementById('studio-param-size-val');
    if (sizeSlider) sizeSlider.value = cfg.size;
    if (sizeVal) sizeVal.textContent = `${cfg.size} px`;

    const intensitySlider = document.getElementById('studio-param-intensity');
    const intensityVal = document.getElementById('studio-param-intensity-val');
    if (intensitySlider) intensitySlider.value = cfg.intensity !== undefined ? cfg.intensity : 80;
    if (intensityVal) intensityVal.textContent = `${intensitySlider ? intensitySlider.value : 80}%`;

    const blurSlider = document.getElementById('studio-param-blur');
    const blurVal = document.getElementById('studio-param-blur-val');
    if (blurSlider) blurSlider.value = cfg.blur || 0;
    if (blurVal) blurVal.textContent = `${cfg.blur || 0} px`;

    if (angleSlider) this.updateSliderFill(angleSlider);
    if (sizeSlider) this.updateSliderFill(sizeSlider);
    if (intensitySlider) this.updateSliderFill(intensitySlider);
    if (blurSlider) this.updateSliderFill(blurSlider);

    const vignetteToggle = document.getElementById('studio-toggle-vignette');
    if (vignetteToggle) vignetteToggle.checked = cfg.vignette === true;

    const angleRow = document.getElementById('studio-param-angle-row');
    const sizeRow = document.getElementById('studio-param-size-row');
    const c2Group = document.getElementById('studio-color-2-group');
    const c3Group = document.getElementById('studio-color-3-group');

    if (angleRow) {
      angleRow.style.display = (cfg.type === 'linear' || cfg.type === 'aurora' || cfg.type === 'stripes') ? 'block' : 'none';
    }
    if (sizeRow) {
      sizeRow.style.display = (cfg.type === 'dots' || cfg.type === 'grid' || cfg.type === 'stripes' || cfg.type === 'waves' || cfg.type === 'particles') ? 'block' : 'none';
    }
    if (c3Group) {
      c3Group.style.display = (cfg.type === 'dots' || cfg.type === 'grid' || cfg.type === 'waves') ? 'none' : 'block';
    }

    const nameInput = document.getElementById('studio-wallpaper-name-input');
    if (nameInput) nameInput.value = cfg.name || 'Ambiance Personnalisée';
  },

  generateStudioCss(cfg) {
    const type = cfg.type || 'mesh';
    const cBase = cfg.colorBase || '#070b14';
    const c1 = cfg.color1 || '#6366f1';
    const c2 = cfg.color2 || '#38bdf8';
    const c3 = cfg.color3 || '#ec4899';
    const angle = cfg.angle !== undefined ? cfg.angle : 135;
    const size = cfg.size !== undefined ? cfg.size : 24;
    const intensity = cfg.intensity !== undefined ? (Number(cfg.intensity) / 100) : 0.8;
    const vignette = cfg.vignette === true;

    let css = '';
    let patternSize = 'cover';
    let patternRepeat = 'no-repeat';

    switch (type) {
      case 'mesh': {
        const a1 = this.hexToRgba(c1, Math.min(1, 0.75 * (intensity / 0.8)));
        const a2 = this.hexToRgba(c2, Math.min(1, 0.65 * (intensity / 0.8)));
        const a3 = this.hexToRgba(c3, Math.min(1, 0.60 * (intensity / 0.8)));
        css = `radial-gradient(circle at 18% 22%, ${a1} 0%, transparent 48%), ` +
              `radial-gradient(circle at 82% 28%, ${a2} 0%, transparent 45%), ` +
              `radial-gradient(circle at 50% 82%, ${a3} 0%, transparent 52%), ` +
              `${cBase}`;
        break;
      }
      case 'linear': {
        css = `linear-gradient(${angle}deg, ${cBase} 0%, ${c1} 40%, ${c2} 75%, ${c3} 100%)`;
        break;
      }
      case 'radial': {
        const a1 = this.hexToRgba(c1, Math.min(1, 0.90 * (intensity / 0.8)));
        const a2 = this.hexToRgba(c2, Math.min(1, 0.45 * (intensity / 0.8)));
        css = `radial-gradient(circle at 50% 40%, ${a1} 0%, ${a2} 45%, ${cBase} 85%)`;
        break;
      }
      case 'aurora': {
        const a1 = this.hexToRgba(c1, Math.min(1, 0.70 * (intensity / 0.8)));
        const a2 = this.hexToRgba(c2, Math.min(1, 0.65 * (intensity / 0.8)));
        const a3 = this.hexToRgba(c3, Math.min(1, 0.55 * (intensity / 0.8)));
        css = `linear-gradient(${angle}deg, transparent 15%, ${a1} 42%, ${a2} 58%, transparent 80%), ` +
              `linear-gradient(${angle + 35}deg, transparent 10%, ${a3} 40%, transparent 68%), ` +
              `radial-gradient(ellipse at 50% 0%, ${a2} 0%, transparent 60%), ` +
              `${cBase}`;
        break;
      }
      case 'waves': {
        const waveCol = this.hexToRgba(c1, Math.min(1, 0.32 * (intensity / 0.8)));
        const glow = this.hexToRgba(c2, Math.min(1, 0.30 * (intensity / 0.8)));
        css = `repeating-radial-gradient(circle at 50% 50%, transparent, transparent ${size}px, ${waveCol} ${size}px, ${waveCol} ${size + 2}px), ` +
              `radial-gradient(circle at 50% 50%, ${glow} 0%, transparent 70%), ` +
              `${cBase}`;
        break;
      }
      case 'particles': {
        const star1 = this.hexToRgba(c1, Math.min(1, 0.85 * (intensity / 0.8)));
        const star2 = this.hexToRgba(c2, Math.min(1, 0.75 * (intensity / 0.8)));
        const neb = this.hexToRgba(c3, Math.min(1, 0.40 * (intensity / 0.8)));
        css = `radial-gradient(1px 1px at 20px 30px, ${star1}, transparent), ` +
              `radial-gradient(1.5px 1.5px at 70px 90px, ${star2}, transparent), ` +
              `radial-gradient(1px 1px at 130px 45px, rgba(255,255,255,0.85), transparent), ` +
              `radial-gradient(1.5px 1.5px at 170px 140px, ${star1}, transparent), ` +
              `radial-gradient(circle at 75% 25%, ${neb} 0%, transparent 55%), ` +
              `${cBase}`;
        patternSize = `${Math.max(80, size * 4)}px ${Math.max(80, size * 4)}px, ${Math.max(80, size * 4)}px ${Math.max(80, size * 4)}px, ${Math.max(80, size * 4)}px ${Math.max(80, size * 4)}px, ${Math.max(80, size * 4)}px ${Math.max(80, size * 4)}px, 100% 100%, 100% 100%`;
        patternRepeat = 'repeat, repeat, repeat, repeat, no-repeat, no-repeat';
        break;
      }
      case 'dots': {
        const dotColor = this.hexToRgba(c1, Math.min(1, 0.45 * (intensity / 0.8)));
        const glow = this.hexToRgba(c2, Math.min(1, 0.25 * (intensity / 0.8)));
        css = `radial-gradient(${dotColor} 1.5px, transparent 1.5px), radial-gradient(circle at 80% 20%, ${glow} 0%, transparent 60%), ${cBase}`;
        patternSize = `${size}px ${size}px, 100% 100%, 100% 100%`;
        patternRepeat = 'repeat, no-repeat, no-repeat';
        break;
      }
      case 'grid': {
        const lineCol = this.hexToRgba(c1, Math.min(1, 0.22 * (intensity / 0.8)));
        const glow = this.hexToRgba(c2, Math.min(1, 0.20 * (intensity / 0.8)));
        css = `linear-gradient(${lineCol} 1px, transparent 1px), linear-gradient(90deg, ${lineCol} 1px, transparent 1px), radial-gradient(circle at 50% 50%, ${glow} 0%, transparent 70%), ${cBase}`;
        patternSize = `${size}px ${size}px, ${size}px ${size}px, 100% 100%, 100% 100%`;
        patternRepeat = 'repeat, repeat, no-repeat, no-repeat';
        break;
      }
      case 'stripes': {
        const stripeCol = this.hexToRgba(c1, Math.min(1, 0.25 * (intensity / 0.8)));
        css = `repeating-linear-gradient(${angle}deg, ${cBase}, ${cBase} 10px, ${stripeCol} 10px, ${stripeCol} ${size}px), ${cBase}`;
        break;
      }
      default:
        css = `linear-gradient(135deg, ${cBase}, ${c1})`;
    }

    if (vignette) {
      css = `radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.70) 100%), ` + css;
      if (patternSize !== 'cover') {
        patternSize = '100% 100%, ' + patternSize;
        patternRepeat = 'no-repeat, ' + patternRepeat;
      }
    }

    return { css, patternSize, patternRepeat };
  },

  updateStudioPreview() {
    const gen = this.generateStudioCss(this.studioConfig);
    const box = document.getElementById('studio-live-preview-box');
    const canvas = document.getElementById('studio-preview-canvas');
    if (canvas) {
      canvas.style.background = gen.css;
      canvas.style.backgroundSize = gen.patternSize;
      canvas.style.backgroundRepeat = gen.patternRepeat;
      canvas.style.backgroundPosition = 'center';
      canvas.style.filter = this.studioConfig.blur > 0 ? `blur(${this.studioConfig.blur}px)` : 'none';
      if (box) box.style.background = '#070b14';
    } else if (box) {
      box.style.background = gen.css;
      box.style.backgroundSize = gen.patternSize;
      box.style.backgroundRepeat = gen.patternRepeat;
      box.style.backgroundPosition = 'center';
    }
  },

  applyStudioPreviewToApp() {
    const gen = this.generateStudioCss(this.studioConfig);
    let wallpaperLayer = document.getElementById('app-wallpaper-layer');
    if (!wallpaperLayer) {
      wallpaperLayer = document.createElement('div');
      wallpaperLayer.id = 'app-wallpaper-layer';
      wallpaperLayer.className = 'app-wallpaper-layer';
      document.body.prepend(wallpaperLayer);
    }
    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    const opacity = (settings.backgroundOpacity !== undefined ? settings.backgroundOpacity : 35) / 100;
    wallpaperLayer.style.background = gen.css;
    wallpaperLayer.style.backgroundSize = gen.patternSize;
    wallpaperLayer.style.backgroundRepeat = gen.patternRepeat;
    wallpaperLayer.style.backgroundPosition = 'center';
    wallpaperLayer.style.opacity = opacity;
    wallpaperLayer.style.filter = this.studioConfig.blur > 0 ? `blur(${this.studioConfig.blur}px)` : 'none';
    wallpaperLayer.style.display = 'block';
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.add('has-custom-wallpaper');
    }

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Aperçu en plein écran appliqué", "info");
    }
  },

  applyStudioPalette(presetKey) {
    const PALETTES = {
      cosmos: { base: '#070b14', c1: '#6366f1', c2: '#38bdf8', c3: '#ec4899', name: 'Cosmos' },
      aurora: { base: '#031713', c1: '#10b981', c2: '#06b6d4', c3: '#84cc16', name: 'Boréale' },
      sunset: { base: '#120914', c1: '#f59e0b', c2: '#ef4444', c3: '#8b5cf6', name: 'Crépuscule' },
      ocean: { base: '#040d1a', c1: '#3b82f6', c2: '#06b6d4', c3: '#6366f1', name: 'Abysses' },
      cyber: { base: '#10051a', c1: '#a855f7', c2: '#ec4899', c3: '#38bdf8', name: 'Cyberpunk' },
      obsidian: { base: '#0b0f17', c1: '#94a3b8', c2: '#64748b', c3: '#475569', name: 'Anthracite' },
      anthracite: { base: '#0b0f17', c1: '#94a3b8', c2: '#64748b', c3: '#475569', name: 'Anthracite' }
    };

    const p = PALETTES[presetKey];
    if (!p) return;

    this.studioConfig.colorBase = p.base;
    this.studioConfig.color1 = p.c1;
    this.studioConfig.color2 = p.c2;
    this.studioConfig.color3 = p.c3;

    document.querySelectorAll('.studio-palette-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.preset === presetKey);
    });

    this.syncStudioInputsWithConfig();
    this.updateStudioPreview();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Harmonie "${p.name}" appliquée`, 'info');
    }
  },

  swapStudioColors() {
    const tmp = this.studioConfig.color1;
    this.studioConfig.color1 = this.studioConfig.color2;
    this.studioConfig.color2 = tmp;

    this.syncStudioInputsWithConfig();
    this.updateStudioPreview();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Teintes 1 et 2 inversées", "info");
    }
  },

  randomizeStudioColors() {
    const HARMONIES = [
      { c1: '#6366f1', c2: '#38bdf8', c3: '#ec4899' },
      { c1: '#10b981', c2: '#06b6d4', c3: '#3b82f6' },
      { c1: '#f59e0b', c2: '#ef4444', c3: '#8b5cf6' },
      { c1: '#8b5cf6', c2: '#d946ef', c3: '#06b6d4' },
      { c1: '#14b8a6', c2: '#10b981', c3: '#84cc16' },
      { c1: '#ec4899', c2: '#f43f5e', c3: '#fb923c' },
      { c1: '#3b82f6', c2: '#8b5cf6', c3: '#6366f1' },
      { c1: '#a855f7', c2: '#ec4899', c3: '#38bdf8' }
    ];

    const pick = HARMONIES[Math.floor(Math.random() * HARMONIES.length)];
    this.studioConfig.color1 = pick.c1;
    this.studioConfig.color2 = pick.c2;
    this.studioConfig.color3 = pick.c3;

    document.querySelectorAll('.studio-palette-chip').forEach(chip => chip.classList.remove('active'));

    this.syncStudioInputsWithConfig();
    this.updateStudioPreview();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast("Harmonie aléatoire générée", "info");
    }
  },

  bindStudioEventsOnce() {
    if (this._studioEventsBound) return;
    this._studioEventsBound = true;

    const modal = document.getElementById('wallpaper-studio-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeWallpaperStudioModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        this.closeWallpaperStudioModal();
      }
    });

    const typeNames = {
      mesh: 'Ambiance Nébuleuse',
      linear: 'Dégradé Linéaire',
      radial: 'Aura Radiale',
      aurora: 'Aurore Boréale',
      waves: 'Ondes Sonores',
      particles: 'Poussière Stellaire',
      dots: 'Dots Matrix',
      grid: 'Grille Blueprint',
      stripes: 'Lignes Fines'
    };

    modal.querySelectorAll('.studio-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.dataset.type;
        if (!type) return;
        this.studioConfig.type = type;

        const nameInput = document.getElementById('studio-wallpaper-name-input');
        if (nameInput && Object.values(typeNames).includes(nameInput.value.trim())) {
          nameInput.value = typeNames[type] || 'Ambiance Personnalisée';
          this.studioConfig.name = nameInput.value;
        }

        this.syncStudioInputsWithConfig();
        this.updateStudioPreview();
      });
    });

    modal.querySelectorAll('.studio-palette-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const pKey = chip.dataset.preset;
        if (pKey) this.applyStudioPalette(pKey);
      });
    });

    const btnSwap = document.getElementById('btn-studio-swap-colors');
    if (btnSwap) {
      btnSwap.addEventListener('click', (e) => {
        e.preventDefault();
        this.swapStudioColors();
      });
    }

    modal.querySelectorAll('.studio-base-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const color = chip.dataset.color;
        if (!color) return;
        this.studioConfig.colorBase = color;
        this.syncStudioInputsWithConfig();
        this.updateStudioPreview();
      });
    });

    const basePicker = document.getElementById('studio-color-base');
    if (basePicker) {
      basePicker.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const app = this._getApp();
        if (app && typeof app.openColorPicker === 'function') {
          app.openColorPicker({
            targetElement: basePicker,
            initialColor: this.studioConfig.colorBase || '#070b14',
            title: 'Fond de base (profondeur)',
            applyLabel: 'Appliquer',
            showNameInput: false,
            onColorChange: (val) => {
              this.studioConfig.colorBase = val;
              basePicker.style.background = val;
              modal.querySelectorAll('.studio-base-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.color.toLowerCase() === val.toLowerCase());
              });
              this.updateStudioPreview();
            },
            onApply: (val) => {
              this.studioConfig.colorBase = val;
              basePicker.style.background = val;
              modal.querySelectorAll('.studio-base-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.color.toLowerCase() === val.toLowerCase());
              });
              this.updateStudioPreview();
            },
            onCancel: (initialVal) => {
              this.studioConfig.colorBase = initialVal;
              basePicker.style.background = initialVal;
              modal.querySelectorAll('.studio-base-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.color.toLowerCase() === initialVal.toLowerCase());
              });
              this.updateStudioPreview();
            }
          });
        }
      });
    }

    const bindColorPair = (pickerId, hexId, key, label) => {
      const picker = document.getElementById(pickerId);
      const hexInput = document.getElementById(hexId);
      if (picker) {
        picker.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const app = this._getApp();
          if (app && typeof app.openColorPicker === 'function') {
            app.openColorPicker({
              targetElement: picker,
              initialColor: this.studioConfig[key] || '#6366f1',
              title: label || 'Teinte de composition',
              applyLabel: 'Appliquer',
              showNameInput: false,
              onColorChange: (val) => {
                this.studioConfig[key] = val;
                picker.style.background = val;
                if (hexInput) hexInput.value = val;
                this.updateStudioPreview();
              },
              onApply: (val) => {
                this.studioConfig[key] = val;
                picker.style.background = val;
                if (hexInput) hexInput.value = val;
                this.updateStudioPreview();
              },
              onCancel: (initialVal) => {
                this.studioConfig[key] = initialVal;
                picker.style.background = initialVal;
                if (hexInput) hexInput.value = initialVal;
                this.updateStudioPreview();
              }
            });
          }
        });
      }
      if (hexInput) {
        const onHexChange = () => {
          let val = hexInput.value.trim().toUpperCase();
          if (!val.startsWith('#') && val.length > 0) val = '#' + val;
          if (/^#[0-9A-F]{6}$/i.test(val)) {
            hexInput.value = val;
            this.studioConfig[key] = val;
            if (picker) {
              picker.value = val;
              picker.style.background = val;
            }
            this.updateStudioPreview();
          }
        };
        hexInput.addEventListener('input', onHexChange);
        hexInput.addEventListener('change', onHexChange);
      }
    };

    bindColorPair('studio-color-1', 'studio-hex-1', 'color1', 'Couleur 1');
    bindColorPair('studio-color-2', 'studio-hex-2', 'color2', 'Couleur 2');
    bindColorPair('studio-color-3', 'studio-hex-3', 'color3', 'Couleur 3');

    const angleSlider = document.getElementById('studio-param-angle');
    if (angleSlider) {
      angleSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.studioConfig.angle = val;
        const valLabel = document.getElementById('studio-param-angle-val');
        if (valLabel) valLabel.textContent = `${val}°`;
        this.updateSliderFill(e.target);
        this.updateStudioPreview();
      });
    }

    const sizeSlider = document.getElementById('studio-param-size');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.studioConfig.size = val;
        const valLabel = document.getElementById('studio-param-size-val');
        if (valLabel) valLabel.textContent = `${val} px`;
        this.updateSliderFill(e.target);
        this.updateStudioPreview();
      });
    }

    const intensitySlider = document.getElementById('studio-param-intensity');
    if (intensitySlider) {
      intensitySlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.studioConfig.intensity = val;
        const valLabel = document.getElementById('studio-param-intensity-val');
        if (valLabel) valLabel.textContent = `${val}%`;
        this.updateSliderFill(e.target);
        this.updateStudioPreview();
      });
    }

    const blurSlider = document.getElementById('studio-param-blur');
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.studioConfig.blur = val;
        const valLabel = document.getElementById('studio-param-blur-val');
        if (valLabel) valLabel.textContent = `${val} px`;
        this.updateSliderFill(e.target);
        this.updateStudioPreview();
      });
    }

    const vignetteToggle = document.getElementById('studio-toggle-vignette');
    if (vignetteToggle) {
      vignetteToggle.addEventListener('change', (e) => {
        this.studioConfig.vignette = e.target.checked;
        this.updateStudioPreview();
      });
    }

    const btnRandom = document.getElementById('btn-studio-randomize');
    if (btnRandom) {
      btnRandom.addEventListener('click', (e) => {
        e.preventDefault();
        this.randomizeStudioColors();
      });
    }

    const btnApplyPreview = document.getElementById('btn-studio-apply-preview');
    if (btnApplyPreview) {
      btnApplyPreview.addEventListener('click', (e) => {
        e.preventDefault();
        this.applyStudioPreviewToApp();
      });
    }

    const btnSave = document.getElementById('btn-studio-save-wallpaper');
    if (btnSave) {
      btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveStudioWallpaper();
      });
    }

    const nameInput = document.getElementById('studio-wallpaper-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.studioConfig.name = e.target.value;
      });
    }
  },

  saveStudioWallpaper() {
    const nameInput = document.getElementById('studio-wallpaper-name-input');
    const name = (nameInput && nameInput.value.trim()) || 'Ambiance Personnalisée';
    const gen = this.generateStudioCss(this.studioConfig);
    const editingId = this.studioConfig.editingId;
    const wpId = editingId || ('cwp_' + Date.now());

    const wallpaperData = {
      id: wpId,
      name: name,
      type: this.studioConfig.type,
      colorBase: this.studioConfig.colorBase,
      color1: this.studioConfig.color1,
      color2: this.studioConfig.color2,
      color3: this.studioConfig.color3,
      angle: this.studioConfig.angle,
      size: this.studioConfig.size,
      intensity: this.studioConfig.intensity,
      blur: this.studioConfig.blur,
      vignette: this.studioConfig.vignette,
      css: gen.css,
      patternSize: gen.patternSize,
      patternRepeat: gen.patternRepeat,
      createdAt: this.studioConfig.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customWallpapers)) {
      settings.customWallpapers = [];
    }

    if (editingId) {
      const idx = settings.customWallpapers.findIndex(w => w.id === editingId);
      if (idx !== -1) {
        settings.customWallpapers[idx] = wallpaperData;
      } else {
        settings.customWallpapers.unshift(wallpaperData);
      }
    } else {
      settings.customWallpapers.unshift(wallpaperData);
    }

    settings.backgroundImage = wpId;
    settings.backgroundBlur = Number(this.studioConfig.blur) || 0;
    StorageManager.saveSettings(settings);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    this.studioConfig.editingId = null;
    this.closeWallpaperStudioModal();
    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Fond d'écran "${name}" ${editingId ? 'mis à jour' : 'enregistré et appliqué'} !`, 'success');
    }
  },

  editCustomWallpaper(id) {
    if (!id) return;
    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customWallpapers)) return;
    const wp = settings.customWallpapers.find(w => w.id === id);
    if (!wp) return;

    this.studioConfig = {
      type: wp.type || 'mesh',
      colorBase: wp.colorBase || '#070b14',
      color1: wp.color1 || '#6366f1',
      color2: wp.color2 || '#38bdf8',
      color3: wp.color3 || '#ec4899',
      angle: wp.angle !== undefined ? wp.angle : 135,
      size: wp.size !== undefined ? wp.size : 24,
      intensity: wp.intensity !== undefined ? wp.intensity : 80,
      blur: wp.blur || 0,
      vignette: wp.vignette === true,
      name: wp.name || 'Ambiance Personnalisée',
      createdAt: wp.createdAt,
      editingId: wp.id
    };

    this.openWallpaperStudioModal();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Modification du fond "${wp.name}"`, 'info');
    }
  },

  deleteCustomWallpaper(id) {
    if (!id) return;
    const settings = StorageManager.getSettings();
    if (!Array.isArray(settings.customWallpapers)) return;

    const idx = settings.customWallpapers.findIndex(w => w.id === id);
    if (idx === -1) return;

    const removed = settings.customWallpapers.splice(idx, 1)[0];

    if (settings.backgroundImage === id) {
      settings.backgroundImage = 'none';
    }

    StorageManager.saveSettings(settings);

    if (typeof App !== 'undefined' && typeof App.applyAppearanceSettings === 'function') {
      App.applyAppearanceSettings(settings);
    }

    this.render();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Fond d'écran "${removed.name}" supprimé`, 'info');
    }
  },

  renderCustomWallpapers(settings) {
    const section = document.getElementById('custom-wallpapers-section');
    const grid = document.getElementById('custom-wallpapers-grid');
    const countEl = document.getElementById('custom-wallpapers-count');
    if (!section || !grid) return;

    const list = Array.isArray(settings.customWallpapers) ? settings.customWallpapers : [];
    if (list.length === 0) {
      section.style.display = 'none';
      grid.innerHTML = '';
      if (countEl) countEl.textContent = '';
      return;
    }

    section.style.display = 'block';
    if (countEl) countEl.textContent = `(${list.length})`;

    grid.innerHTML = list.map(w => {
      const isActive = settings.backgroundImage === w.id;
      const safeId = this._esc(w && w.id);
      const safeName = this._esc((w && w.name) || 'Fond personnalisé');
      const safeCss = this._safeCssBgValue(w && w.css);
      const safeSize = this._safeCssBgValue((w && w.patternSize) || 'cover');
      const safeRepeat = this._safeCssBgValue((w && w.patternRepeat) || 'no-repeat');
      return `
        <div class="wallpaper-card is-custom ${isActive ? 'active' : ''}" data-wallpaper="${safeId}" data-custom-wp-id="${safeId}" title="${safeName}">
          <div class="wallpaper-thumb" style="background: ${safeCss}; background-size: ${safeSize}; background-repeat: ${safeRepeat}; background-position: center;"></div>
          <span class="wallpaper-name">${safeName}</span>
          <button type="button" class="wallpaper-delete-btn" title="Supprimer ce fond d'écran" aria-label="Supprimer">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button type="button" class="wallpaper-edit-btn" title="Modifier ce fond d'écran dans le studio" aria-label="Modifier">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }
};

/**
 * Gestionnaire d'Interface pour les Mises à Jour Automatiques (Settings)
 */
const UpdateManager = {
  initialized: false,
  isBusy: false,
  currentVersion: '1.3.1',
  isPackaged: false,
  status: 'idle',
  updateInfo: null,
  downloadProgress: null,
  lastError: null,
  _unsubscribe: null,

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
  },

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

    // Case à cocher d'activation/désactivation de la vérification automatique au démarrage
    const chkAutoUpdates = document.getElementById('setting-auto-check-updates');
    if (chkAutoUpdates && !chkAutoUpdates._hasUpdaterAutoListener) {
      chkAutoUpdates.addEventListener('change', (e) => {
        const enabled = !!e.target.checked;
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.updateSetting === 'function') {
          SettingsManager.updateSetting('autoCheckUpdates', enabled, true);
        } else if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
          const s = StorageManager.getSettings();
          s.autoCheckUpdates = enabled;
          StorageManager.saveSettings(s);
        }
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
          App.showToast(
            enabled
              ? "Vérification automatique des mises à jour activée au lancement"
              : "Vérification automatique désactivée : Antigravité démarre 100 % hors ligne",
            "info"
          );
        }
      });
      chkAutoUpdates._hasUpdaterAutoListener = true;
    }

    // Écoute des événements IPC temps réel (via preload.js)
    const updaterApi = typeof window !== 'undefined' ? window.AntigraviteAPI?.updater : null;
    if (updaterApi && typeof updaterApi.onStatusChanged === 'function') {
      if (typeof this._unsubscribe === 'function') {
        this._unsubscribe();
      }
      this._unsubscribe = updaterApi.onStatusChanged((data) => {
        if (!data) return;
        const prevStatus = this.status;
        let newStatus = data.status || this.status;
        let newInfo = data.updateInfo !== undefined ? data.updateInfo : this.updateInfo;

        if (newStatus === 'available') {
          const availVer = newInfo?.version;
          if (!availVer || !this.isNewerVersion(availVer, this.currentVersion)) {
            newStatus = 'not-available';
            newInfo = null;
            if (typeof App !== 'undefined' && typeof App.removePendingUpdateIndicator === 'function') {
              App.removePendingUpdateIndicator();
            }
          }
        } else if (newStatus === 'not-available') {
          newInfo = null;
          if (typeof App !== 'undefined' && typeof App.removePendingUpdateIndicator === 'function') {
            App.removePendingUpdateIndicator();
          }
        }

        this.status = newStatus;
        this.updateInfo = newInfo;
        if (data.progress) this.downloadProgress = data.progress;
        if (data.error) this.lastError = data.error;
        this.render();

        if (prevStatus !== 'downloaded' && this.status === 'downloaded') {
          this.promptRestartChoice();
        }
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
      this.currentVersion = '1.3.1';
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

    // Protection stricte : si le statut retourné est 'available' mais sans version plus récente
    if (this.status === 'available') {
      const availVer = this.updateInfo?.version;
      if (!availVer || !this.isNewerVersion(availVer, this.currentVersion)) {
        this.status = 'not-available';
        this.updateInfo = null;
        if (typeof App !== 'undefined' && typeof App.removePendingUpdateIndicator === 'function') {
          App.removePendingUpdateIndicator();
        }
      }
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
      } else if (res && (!res.isUpdateAvailable || !res.updateInfo || !this.isNewerVersion(res.updateInfo.version, this.currentVersion))) {
        this.status = 'not-available';
        this.updateInfo = null;
        if (typeof App !== 'undefined' && typeof App.removePendingUpdateIndicator === 'function') {
          App.removePendingUpdateIndicator();
        }
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
    if (!this.updateInfo?.version || !this.isNewerVersion(this.updateInfo.version, this.currentVersion)) {
      this.status = 'not-available';
      this.updateInfo = null;
      if (typeof App !== 'undefined' && typeof App.removePendingUpdateIndicator === 'function') {
        App.removePendingUpdateIndicator();
      }
      this.render();
      return;
    }

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
      if (this.status === 'downloaded') {
        this.promptRestartChoice();
      }
    }
  },

  async promptRestartChoice() {
    if (this._promptActive) return;
    this._promptActive = true;
    try {
      if (typeof window === 'undefined') return;
      const versionStr = this.updateInfo?.version ? ` (v${this.updateInfo.version})` : '';
      const message = `La mise à jour${versionStr} a été téléchargée avec succès !\n\nSouhaitez-vous redémarrer Antigravité maintenant pour l'installer en toute discrétion en arrière-plan, ou préférez-vous continuer à travailler ?`;

      if (window.App && typeof window.App.confirm === 'function') {
        const shouldRestart = await window.App.confirm({
          title: "Mise à jour prête à installer",
          message,
          confirmText: "Redémarrer maintenant",
          cancelText: "Continuer à travailler",
          danger: false,
          icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
        });

        if (shouldRestart) {
          this.installUpdate();
        } else {
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Mise à jour prête. Vous pouvez redémarrer à tout moment depuis les Paramètres.", "info", 6000);
          }
        }
      }
    } finally {
      this._promptActive = false;
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
      if (typeof document !== 'undefined') {
        const desc = document.getElementById('updater-status-desc');
        const btnInstall = document.getElementById('btn-install-update');
        if (desc) desc.textContent = "Installation silencieuse en arrière-plan et redémarrage automatique en cours...";
        if (btnInstall) {
          btnInstall.disabled = true;
          btnInstall.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Redémarrage en cours...</span>';
        }
      }
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

    // 1. Version courante & préférence autoCheckUpdates
    const versionLabel = document.getElementById('updater-current-version-label');
    if (versionLabel) {
      versionLabel.textContent = this.currentVersion || '1.0.0';
    }
    const chkAutoUpdates = document.getElementById('setting-auto-check-updates');
    if (chkAutoUpdates && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      const s = StorageManager.getSettings();
      chkAutoUpdates.checked = s.autoCheckUpdates !== false;
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

    const refreshSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    const hourglassSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>';
    const downloadSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    switch (this.status) {
      case 'checking':
        if (icon) icon.innerHTML = hourglassSvg;
        title.textContent = 'Recherche en cours...';
        desc.textContent = 'Vérification des versions disponibles sur GitHub Releases...';
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = true;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Recherche en cours...';
        if (btnCheckIcon) btnCheckIcon.innerHTML = hourglassSvg;
        break;

      case 'available':
        if (!availableVersion || !this.isNewerVersion(availableVersion, this.currentVersion)) {
          if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
          title.textContent = 'Aucune mise à jour disponible';
          desc.textContent = `Votre application est à jour (la version ${this.currentVersion} est la plus récente).`;
          if (chip) chip.classList.add('status-connected');
          if (dot) dot.style.backgroundColor = '#10b981';

          btnCheck.disabled = false;
          btnCheck.style.display = 'inline-flex';
          if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
          if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;
          break;
        }

        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>';
        title.textContent = availableVersion
          ? `Nouvelle version disponible : v${availableVersion}`
          : 'Nouvelle version disponible !';
        desc.textContent = 'Une mise à jour est prête à être téléchargée. Vous pouvez lancer le téléchargement dès maintenant.';
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = this.isBusy;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Vérifier à nouveau';
        if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;

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

        if (icon) icon.innerHTML = downloadSvg;
        title.textContent = 'Téléchargement en cours...';
        desc.textContent = `Téléchargement du paquet de mise à jour (${percentNum}%). Veuillez patienter...`;
        if (chip) chip.classList.add('status-configured');
        if (dot) dot.style.backgroundColor = '#f59e0b';

        btnCheck.disabled = true;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Téléchargement...';
        if (btnCheckIcon) btnCheckIcon.innerHTML = downloadSvg;

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
        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
        title.textContent = 'Téléchargement terminé !';
        desc.textContent = 'La mise à jour a été téléchargée avec succès. Vous pouvez redémarrer pour l\'installer en arrière-plan, ou continuer à travailler normalement.';
        if (chip) chip.classList.add('status-connected');
        if (dot) dot.style.backgroundColor = '#10b981';

        btnCheck.style.display = 'none';
        if (btnInstall) {
          btnInstall.style.display = 'inline-flex';
          btnInstall.disabled = this.isBusy;
          btnInstall.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Redémarrer et installer</span>';
        }
        break;

      case 'not-available':
        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
        title.textContent = 'Aucune mise à jour disponible';
        desc.textContent = `Votre application est à jour (la version ${this.currentVersion} est la plus récente).`;
        if (chip) chip.classList.add('status-connected');
        if (dot) dot.style.backgroundColor = '#10b981';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;
        break;

      case 'dev-mode':
        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
        title.textContent = 'Mode développement';
        desc.textContent = 'L\'application s\'exécute en mode développement (non empaquetée). La recherche automatique de mises à jour est désactivée.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#94a3b8';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;
        break;

      case 'error':
        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        title.textContent = 'Erreur lors de la mise à jour';
        desc.textContent = this.lastError
          ? `Détail : ${this.lastError}`
          : 'Impossible de contacter le serveur de mise à jour. Vérifiez votre connexion Internet.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#ef4444';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Réessayer';
        if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;
        break;

      case 'idle':
      default:
        if (icon) icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';
        title.textContent = 'Prêt à vérifier';
        desc.textContent = 'Cliquez sur le bouton pour rechercher une nouvelle version sur GitHub Releases.';
        if (chip) chip.classList.add('status-disconnected');
        if (dot) dot.style.backgroundColor = '#94a3b8';

        btnCheck.disabled = false;
        btnCheck.style.display = 'inline-flex';
        if (btnCheckText) btnCheckText.textContent = 'Rechercher une mise à jour';
        if (btnCheckIcon) btnCheckIcon.innerHTML = refreshSvg;
        break;
    }
  }
};

SettingsManager.updater = UpdateManager;

// Exposer globalement pour compatibilité (initialisé par App.init() après StorageManager.init())
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
  window.UpdateManager = UpdateManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SettingsManager, UpdateManager };
}
