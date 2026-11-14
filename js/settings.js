/**
 * Antigravité - Module de Gestion des Paramètres et de l'Apparence
 */

const SettingsManager = {
  initialized: false,
  currentTab: 'customization',
  currentSeriousSubtab: 'performance',

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
      serious: document.getElementById('settings-pane-serious')
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
        this.updateSetting('notificationVolume', val, true);
      });
    }

    // 8. Message personnalisé & Profil (Nom / Prénom d'usage)
    const inputUserName = document.getElementById('input-user-name');
    const btnSaveUserName = document.getElementById('btn-save-user-name');
    const saveName = () => {
      if (!inputUserName) return;
      const val = inputUserName.value.trim();
      this.updateSetting('userName', val);
      if (typeof App !== 'undefined' && typeof App.updateLiveClockNow === 'function') {
        App.updateLiveClockNow();
      }
      this.updateGreetingPreview();
      if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast(val ? `Prénom enregistré : ${val}` : "Prénom réinitialisé", "success");
      }
    };
    if (btnSaveUserName) {
      btnSaveUserName.addEventListener('click', (e) => {
        e.preventDefault();
        saveName();
      });
    }
    if (inputUserName) {
      inputUserName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveName();
        }
      });
      inputUserName.addEventListener('input', () => {
        this.updateGreetingPreview();
      });
      inputUserName.addEventListener('change', () => {
        saveName();
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
    const saveCustomPhrase = () => {
      if (!inputCustomPhrase) return;
      const val = inputCustomPhrase.value.trim();
      this.updateSetting('customGreetingPhrase', val);
      if (typeof App !== 'undefined' && typeof App.updateDashboardQuote === 'function') {
        App.updateDashboardQuote(true);
      }
      this.updateGreetingPreview();
      if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
        App.showToast("Phrase personnalisée enregistrée", "success");
      }
    };
    if (btnSaveCustomPhrase) {
      btnSaveCustomPhrase.addEventListener('click', (e) => {
        e.preventDefault();
        saveCustomPhrase();
      });
    }
    if (inputCustomPhrase) {
      inputCustomPhrase.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveCustomPhrase();
        }
      });
      inputCustomPhrase.addEventListener('input', () => {
        this.updateGreetingPreview();
      });
      inputCustomPhrase.addEventListener('change', () => {
        saveCustomPhrase();
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
        const defaultOrder = (StorageManager.DEFAULT_SETTINGS && StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder)
          ? StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder
          : ['tasks', 'projects', 'agenda', 'notes', 'focus', 'music', 'trash', 'backups'];

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
        if (e.target && (e.target.closest('input[type="checkbox"]') || e.target.closest('.tab-drag-handle'))) {
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
    const PRESET_NAMES = ['nebula', 'aurora', 'mineral', 'sunset', 'ocean', 'forest', 'cyberpunk', 'minimal', 'lavender', 'solar', 'none'];
    const currentWp = settings.backgroundImage;
    document.querySelectorAll('.wallpaper-card').forEach(card => {
      const wpVal = card.dataset.wallpaper;
      if (!currentWp || currentWp === 'none') {
        card.classList.toggle('active', wpVal === 'none');
      } else if (wpVal) {
        card.classList.toggle('active', wpVal === currentWp);
      } else if (card.classList.contains('wallpaper-card-upload')) {
        const isCustom = currentWp && !PRESET_NAMES.includes(currentWp);
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
      const isCustom = currentWp && !PRESET_NAMES.includes(currentWp);
      if (isCustom) {
        customThumb.style.backgroundImage = `url("${currentWp}")`;
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
    if (volumeSlider) volumeSlider.value = curVol;
    if (volumeVal) volumeVal.textContent = `${curVol}%`;

    // 8. Message personnalisé & Profil
    const inputUserName = document.getElementById('input-user-name');
    if (inputUserName) {
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
    if (inputCustomPhrase) {
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

    // 11-bis. Synchroniser l'état des toggles d'onglets du volet latéral
    const visibleScreens = settings.sidebarVisibleScreens || {};
    document.querySelectorAll('.sidebar-tabs-toggle-grid input[type="checkbox"]').forEach(chk => {
      const tabName = chk.dataset.tabName;
      if (tabName) {
        chk.checked = (visibleScreens[tabName] !== undefined) ? visibleScreens[tabName] : true;
      }
    });

    // 11-ter. Synchroniser la disposition des cartes d'onglets du volet latéral
    const grid = document.querySelector('.sidebar-tabs-toggle-grid');
    const tabsOrder = (settings && Array.isArray(settings.sidebarTabsOrder))
      ? settings.sidebarTabsOrder
      : (StorageManager.DEFAULT_SETTINGS ? StorageManager.DEFAULT_SETTINGS.sidebarTabsOrder : null);
    if (grid && Array.isArray(tabsOrder)) {
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
          ? 'Mode PC de merde activé : priorité absolue à la fluidité'
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
    if (inputFreq) inputFreq.value = String(freqHours);
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

    // 4. Overrides interface indépendants
    const chkAnim = document.getElementById('setting-disable-animations');
    const chkPrev = document.getElementById('setting-disable-previews');
    const chkHover = document.getElementById('setting-disable-hover-effects');
    if (chkAnim) chkAnim.checked = settings.disableAnimations === true;
    if (chkPrev) chkPrev.checked = settings.disablePreviews === true;
    if (chkHover) chkHover.checked = settings.disableHoverEffects === true;

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
          }
          if (startupNote) {
            if (!prefs.startupSupported) {
              startupNote.textContent = "Cette option est réservée aux ordinateurs sous Windows.";
              if (chkStartup) chkStartup.disabled = true;
            } else if (!prefs.isPackaged) {
              startupNote.textContent = "Mode développement détecté : l'entrée Windows pointe vers cette session locale (en version installée, elle pointera directement vers Antigravité).";
            } else {
              startupNote.textContent = "Démarre Antigravité avec la fenêtre ouverte normalement à l'ouverture de session Windows.";
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
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && api.system && typeof api.system.setStartupSetting === 'function') {
      try {
        const res = await api.system.setStartupSetting(!!enabled);
        this.updateSetting('launchOnStartup', !!(res && res.enabled));
        return;
      } catch (err) {
        console.warn('[Settings] Erreur toggleLaunchOnStartup:', err);
      }
    }
    this.updateSetting('launchOnStartup', !!enabled);
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
        title: "Retour aux paramètres d'usine",
        message: "Rétablir uniquement les réglages de l'onglet « Paramètres sérieux » à leur comportement d'origine (Mode Normal, veille en arrière-plan, sauvegardes 24 h / 20 versions, dossier par défaut, animations/aperçus/survols actifs) ?\n\nVos tâches, projets, agenda, notes, sauvegardes et votre personnalisation visuelle restent intacts.",
        confirmText: "Rétablir l'usine",
        danger: true,
        icon: "↺"
      });
    } else if (typeof confirm === 'function') {
      ok = confirm("Rétablir les paramètres sérieux à leur valeur d'usine ?");
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
      App.showToast("Paramètres sérieux rétablis aux valeurs d'usine", "success");
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
  currentVersion: '1.2.0',
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
      this.currentVersion = '1.2.0';
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
