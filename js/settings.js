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

// Exposer globalement pour compatibilité
window.SettingsManager = SettingsManager;

// Auto-initialisation au chargement du DOM si disponible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SettingsManager.init();
  });
} else {
  SettingsManager.init();
}
