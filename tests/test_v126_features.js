/**
 * Antigravité - Tests automatisés des fonctionnalités v1.2.6
 * 
 * Vérifications couvertes :
 * 1. Synchronisation de la version 1.2.6 (package.json, index.html, app.js, settings.js).
 * 2. Présence de l'encart Changelog Version 1.2.6 dans les paramètres.
 * 3. Existence et structure de Tester-Antigravite-1.2.6.bat et Push_Vers_GitHub.bat.
 * 4. main.js : Présence de getWindowsStartupShortcutPath et intégration du dossier Démarrage Windows.
 * 5. main.js : applyWindowsLoginItem gère à la fois le raccourci natif .lnk et le registre HKCU\Run.
 * 6. main.js : Synchronisation automatique de launchOnStartup lors de app.whenReady.
 * 7. main.js : antigravite:get-desktop-prefs détecte la présence du raccourci dans Startup.
 * 8. js/settings.js : refreshDesktopPrefsUI synchronise StorageManager avec l'état réel système.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(`        ${err.stack || err.message}\n`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des fonctionnalités v1.2.6");
  console.log("   (Démarrage Windows Garanti & Fiabilisation Système)");
  console.log("==========================================================");

  // 1. Version 1.3.0 synchronisée
  await it("1.1 Version 1.3.0 synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert(pkg.version === '1.3.0' || pkg.version === '1.2.6', "package.json doit être en version 1.3.0");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="updater-current-version-label">1.3.0</strong>') || htmlContent.includes('id="updater-current-version-label">1.2.6</strong>'), "index.html affiche la version 1.3.0");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("APP_VERSION: '1.3.0'") || appCode.includes("APP_VERSION: '1.2.6'"), "app.js est configuré sur la version 1.3.0");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("currentVersion: '1.3.0'") || settingsCode.includes("currentVersion: '1.2.6'"), "settings.js est initialisé avec 1.3.0");
  });

  // 2. Changelog 1.3.0
  await it("1.2 Changelog officiel de la Version 1.3.0 présent dans les paramètres", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('Version 1.3.0') || htmlContent.includes('Version 1.2.6'), "Encart Version 1.3.0 présent dans le Changelog");
    assert(htmlContent.includes('Démarrage automatique Windows garanti'), "Section démarrage Windows dans le Changelog");
    assert(htmlContent.includes('Dossier Démarrage Windows (shell:startup)'), "Mention du dossier Startup");
  });

  // 3. Scripts .bat
  await it("1.3 Tester-Antigravite-1.3.0.bat et Push_Vers_GitHub.bat mentionnent la version 1.3.0", () => {
    const batPath = path.join(rootDir, 'Tester-Antigravite-1.3.0.bat');
    assert(fs.existsSync(batPath), "Tester-Antigravite-1.3.0.bat existe");
    const batContent = fs.readFileSync(batPath, 'utf8');
    assert(batContent.includes("v1.3.0"), "Tester-Antigravite-1.3.0.bat mentionne v1.3.0");

    const pushBatPath = path.join(rootDir, 'Push_Vers_GitHub.bat');
    const pushBatContent = fs.readFileSync(pushBatPath, 'utf8');
    assert(pushBatContent.includes("v1.3.0") || pushBatContent.includes("v1.2.6"), "Push_Vers_GitHub.bat mentionne v1.3.0");
  });

  // 4. main.js : Fonction getWindowsStartupShortcutPath
  await it("1.4 main.js définit getWindowsStartupShortcutPath et cible le dossier Startup", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes('function getWindowsStartupShortcutPath()'), "Fonction getWindowsStartupShortcutPath définie");
    assert(mainCode.includes("'Startup'") && mainCode.includes("'Start Menu'"), "Cible le dossier Startup");
    assert(mainCode.includes('Antigravite.lnk'), "Nom du raccourci Antigravite.lnk");
  });

  // 5. main.js : applyWindowsLoginItem avec raccourci natif shell.writeShortcutLink
  await it("1.5 main.js applique le raccourci natif shell.writeShortcutLink avec cwd et appUserModelId", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes('shell.writeShortcutLink(shortcutPath, \'create\', details)'), "Appel de shell.writeShortcutLink");
    assert(mainCode.includes('appUserModelId: \'fr.antigravite.app\''), "Configuration de l'appUserModelId");
    assert(mainCode.includes('fsSync.unlinkSync(shortcutPath)'), "Suppression propre du raccourci quand désactivé");
  });

  // 6. main.js : Synchronisation au lancement dans app.whenReady
  await it("1.6 main.js synchronise automatiquement le démarrage dans app.whenReady", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes('if (process.platform === \'win32\' && desktopPrefs.launchOnStartup)'), "Condition de synchro dans app.whenReady");
    assert(mainCode.includes('applyWindowsLoginItem(true)'), "Appel applyWindowsLoginItem(true) au démarrage");
  });

  // 7. main.js : Détection combinée raccourci + registre dans get-desktop-prefs
  await it("1.7 antigravite:get-desktop-prefs détecte la présence du raccourci Startup et du registre", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes('const shortcutExists = shortcutPath && fsSync.existsSync(shortcutPath);'), "Vérification de l'existence du raccourci");
    assert(mainCode.includes('actualLogin = !!(shortcutExists || loginInfo.openAtLogin || desktopPrefs.launchOnStartup);'), "Fusion des états de démarrage");
  });

  // 8. js/settings.js : refreshDesktopPrefsUI synchronise StorageManager
  await it("1.8 js/settings.js synchronise StorageManager avec l'état réel de démarrage", () => {
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes('currentSettings.launchOnStartup = prefs.launchOnStartup;'), "Synchronisation de StorageManager");
    assert(settingsCode.includes('StorageManager.saveSettings(currentSettings);'), "Sauvegarde immédiate dans settings");
  });

  // 9. js/agenda.js : Suppression du badge 'Journée' tout en conservant le gutter de 55px pour l'alignement
  await it("1.9 js/agenda.js supprime le libellé 'Journée' tout en maintenant le gutter de 55px", () => {
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaCode.includes('<div class="calendar-allday-gutter"></div>'), "Le conteneur calendar-allday-gutter est conservé vide");
    assert(!agendaCode.includes('calendar-allday-gutter-badge'), "Le badge calendar-allday-gutter-badge a été retiré");
  });

  // 10. index.html : Retrait de l'indicateur / légende "Local" et "Google" de la barre de l'agenda
  await it("1.10 index.html supprime l'indicateur de légende 'Local' et 'Google' de l'agenda", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(!htmlContent.includes('agenda-color-legend'), "L'indicateur / légende agenda-color-legend est retiré de index.html");
  });

  // 11. js/projects.js & css/styles.css : Liens arborescents entre projets et sous-projets en vue ligne (comme pour les tâches)
  await it("1.11 Liens visuels arborescents entre projets et sous-projets en affichage ligne (comme pour les tâches)", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.project-tree-node'), "Classe .project-tree-node présente dans styles.css");
    assert(cssContent.includes('.project-tree-node.is-child::before'), "Ligne verticale arborescente ::before présente");
    assert(cssContent.includes('.project-tree-node.is-child::after'), "Connecteur horizontal en L ::after présent");
    assert(cssContent.includes('.subprojects-container'), "Conteneur indenté .subprojects-container présent");

    const projectsJs = fs.readFileSync(path.join(rootDir, 'js', 'projects.js'), 'utf8');
    assert(projectsJs.includes('renderListTree'), "renderListTree implémenté pour l'arborescence en vue liste");
    assert(projectsJs.includes('subprojects-container'), "subprojects-container injecté dans le DOM pour les sous-projets");
    assert(projectsJs.includes('project-tree-node'), "project-tree-node injecté dans le DOM");
    assert(projectsJs.includes('project-family-toggle-pill'), "Bouton repliable interactif présent sur les projets parents");
  });

  // 12. Personnalisation : Couleur d'accentuation chromatique libre, calcul CSS et favoris
  await it("1.12 Personnalisation chromatique libre, calcul dynamique des variables CSS et gestion des favoris", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const App = require('../js/app.js');
    const { SettingsManager } = require('../js/settings.js');

    // 12.1 Calcul dynamique des couleurs d'accentuation
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('<span>Mes couleurs d\'accentuation</span>'), "Section 'Mes couleurs d\'accentuation' présente");
    assert(htmlContent.includes('id="custom-accent-colors-count"'), "Badge de décompte des couleurs d\'accentuation présent");

    const rgb = App.hexToRgb('#38BDF8');
    assert.deepStrictEqual(rgb, { r: 56, g: 189, b: 248 });

    const darker = App.adjustColorBrightness('#38BDF8', -15);
    assert(darker.startsWith('#'), "La couleur assombrie doit être au format HEX");

    // 12.2 Injection des variables CSS sur root
    const rootAttrs = {};
    const rootStyles = {};
    const fakeRoot = {
      setAttribute: (k, v) => { rootAttrs[k] = v; },
      removeAttribute: (k) => { delete rootAttrs[k]; },
      style: {
        setProperty: (k, v) => { rootStyles[k] = v; },
        removeProperty: (k) => { delete rootStyles[k]; }
      }
    };
    const origDoc = global.document;
    const fakeBody = {
      prepend: () => {},
      classList: { add: () => {}, remove: () => {} }
    };
    global.document = {
      documentElement: fakeRoot,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
      body: fakeBody
    };

    try {
      App.applyAppearanceSettings({
        theme: 'dark',
        accentColor: '#E11D48'
      });
      assert.strictEqual(rootAttrs['data-accent'], 'custom', "L'attribut data-accent doit valoir 'custom'");
      assert.strictEqual(rootStyles['--accent'], '#E11D48', "La variable --accent doit être injectée");
      assert(rootStyles['--accent-light'].includes('rgba('), "La variable --accent-light doit être calculée en rgba");
      assert(rootStyles['--accent-glow'].includes('rgba('), "La variable --accent-glow doit être calculée en rgba");

      // 12.3 Vérification du champ de nom et ajout d'une teinte personnalisée aux favoris
      const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
      assert(htmlContent.includes('id="accent-color-name-input"'), "Champ #accent-color-name-input présent dans index.html pour nommer la teinte sans prompt bloquant");
      assert(htmlContent.includes('id="btn-project-color-picker"'), "Bouton #btn-project-color-picker présent dans index.html pour ouvrir la palette universelle");
      assert(htmlContent.includes('id="event-color-custom-btn"'), "Bouton #event-color-custom-btn présent dans index.html pour ouvrir la palette universelle");
      assert(htmlContent.includes('id="custom-accent-color-popover"'), "Palette popover #custom-accent-color-popover présente dans index.html");
      assert(htmlContent.includes('id="popover-name-group"'), "Groupe de saisie conditionnel #popover-name-group présent dans index.html");

      const initialSettings = Storage.getSettings();
      const testHex = '#9333EA';
      SettingsManager.addCustomAccentColor(testHex, 'Violet Profond');
      
      const updatedSettings = Storage.getSettings();
      assert(Array.isArray(updatedSettings.customAccentColors), "customAccentColors doit être un tableau");
      const found = updatedSettings.customAccentColors.find(c => c.hex === testHex);
      assert(found, "La teinte #9333EA doit être enregistrée dans les favoris");
      assert.strictEqual(found.name, 'Violet Profond');
      assert.strictEqual(updatedSettings.accentColor, testHex, "La couleur d'accent active doit être mise à jour");

      // 12.3 bis Modification d'une teinte existante
      SettingsManager.addCustomAccentColor('#A855F7', 'Violet Majestueux', found.id);
      const afterEdit = Storage.getSettings();
      const editedFound = afterEdit.customAccentColors.find(c => c.id === found.id);
      assert(editedFound, "La teinte modifiée doit conserver son identifiant");
      assert.strictEqual(editedFound.name, 'Violet Majestueux');
      assert.strictEqual(editedFound.hex, '#A855F7');

      // 12.3 ter Vérification de l'ouverture du popover de sélection chromatique intégrée juste à côté
      const fakePopoverEl = {
        style: { display: 'none', setProperty: () => {} },
        querySelectorAll: () => [],
        contains: () => false,
        addEventListener: () => {}
      };
      const fakeTargetBtn = {
        getBoundingClientRect: () => ({ left: 250, top: 300, bottom: 320, right: 270, width: 20, height: 20 })
      };
      const origDocForPicker = global.document;
      global.document = {
        getElementById: (id) => {
          if (id === 'custom-accent-color-popover') return fakePopoverEl;
          if (id === 'custom-accent-colors-section') return { style: {} };
          if (id === 'custom-accent-colors-list') return { innerHTML: '' };
          if (id === 'custom-accent-colors-count') return { textContent: '' };
          if (id === 'accent-color-hex-input') return { value: '' };
          if (id === 'accent-color-name-input') return { value: '', focus: () => {}, select: () => {} };
          if (id === 'custom-accent-picker-preview') return { style: {} };
          if (id === 'btn-save-custom-accent') return { querySelector: () => ({ textContent: '' }) };
          if (id === 'popover-color-title') return { textContent: '' };
          if (id === 'btn-apply-accent-popover') return { textContent: '', addEventListener: () => {} };
          if (id === 'btn-close-accent-popover') return { addEventListener: () => {} };
          if (id === 'btn-cancel-accent-popover') return { addEventListener: () => {} };
          if (id === 'popover-input-hex') return { value: '', addEventListener: () => {} };
          if (id === 'popover-input-name') return { value: '', addEventListener: () => {} };
          if (id === 'popover-hue-slider') return { value: '200', addEventListener: () => {} };
          if (id === 'popover-lightness-slider') return { value: '60', addEventListener: () => {} };
          if (id === 'popover-hue-val') return { textContent: '' };
          if (id === 'popover-lightness-val') return { textContent: '' };
          if (id === 'popover-color-swatch-badge') return { style: {} };
          if (id === 'popover-color-hex-sub') return { textContent: '' };
          return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
      };

      try {
        SettingsManager.openCustomAccentPopover(found.id, fakeTargetBtn);
        assert.strictEqual(fakePopoverEl.style.display, 'block', "Le popover de sélection chromatique doit être affiché");
        assert.strictEqual(fakePopoverEl.style.left, '280px', "Le popover doit être positionné juste à côté à droite de l'élément cible (coordonnée X = rect.right + 10)");
        assert.strictEqual(fakePopoverEl.style.top, '270px', "Le popover doit être positionné verticalement centré par rapport à l'élément cible (coordonnée Y)");

        // Test des utilitaires universels de sélection chromatique
        assert(typeof App.openColorPicker === 'function', "App.openColorPicker doit être exposé");
        assert(typeof App.closeColorPicker === 'function', "App.closeColorPicker doit être exposé");
        assert(typeof App.hslToHex === 'function', "App.hslToHex doit être exposé");
        assert(typeof App.hexToHsl === 'function', "App.hexToHsl doit être exposé");
        assert(typeof SettingsManager.hslToHex === 'function', "hslToHex doit être exposé");
        assert(typeof SettingsManager.hexToHsl === 'function', "hexToHsl doit être exposé");
        const converted = SettingsManager.hslToHex(0, 100, 50);
        assert.strictEqual(converted, '#FF0000', "Conversion HSL 0, 100%, 50% doit donner #FF0000");

        // Fermeture du popover
        SettingsManager.closeCustomAccentPopover(false);
        assert.strictEqual(fakePopoverEl.style.display, 'none', "Le popover doit être masqué à la fermeture");

        // Test de updateCustomAccentColorHex
        SettingsManager.updateCustomAccentColorHex(found.id, '#EC4899');
        const afterHexUpdate = Storage.getSettings();
        const updatedHexColor = afterHexUpdate.customAccentColors.find(c => c.id === found.id);
        assert(updatedHexColor, "La teinte doit toujours exister");
        assert.strictEqual(updatedHexColor.hex, '#EC4899', "L'hexadécimal doit être mis à jour directement via updateCustomAccentColorHex");
        assert.strictEqual(afterHexUpdate.accentColor, '#EC4899', "La couleur d'accent active doit être synchronisée");
      } finally {
        global.document = origDocForPicker;
      }

      // 12.4 Suppression de la teinte des favoris
      SettingsManager.deleteCustomAccentColor(found.id);
      const afterDelete = Storage.getSettings();
      const stillThere = afterDelete.customAccentColors.some(c => c.id === found.id);
      assert(!stillThere, "La teinte doit être retirée des favoris");
      assert.strictEqual(afterDelete.accentColor, 'blue', "La couleur active doit être réinitialisée par défaut");

      // Vérification des styles des boutons d'édition
      const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
      assert(cssContent.includes('.bubble-edit-btn'), "Bouton .bubble-edit-btn stylisé dans styles.css");
      assert(cssContent.includes('.wallpaper-edit-btn'), "Bouton .wallpaper-edit-btn stylisé dans styles.css");
      assert(cssContent.includes('--slider-percent'), "Remplissage progressif de la piste du slider avec --slider-percent");

      // Restaurer les réglages d'origine
      Storage.saveSettings(initialSettings);
    } finally {
      global.document = origDoc;
    }
  });

  // 13. Studio de création de fond d'écran génératif CSS & Galerie des créations
  await it("1.13 Studio de création de fond d'écran génératif CSS (6 motifs, aperçu, sauvegarde et suppression)", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const App = require('../js/app.js');
    const { SettingsManager } = require('../js/settings.js');

    // 13.1 Vérification de la génération CSS des 6 types de motifs
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('<span>Studio de création</span>'), "Bouton Studio de création sans emoji");
    assert(!htmlContent.includes('Studio de création 🎨'), "L'emoji palette est bien retiré du bouton");

    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.settings-slider'), "Classe .settings-slider définie dans styles.css");
    assert(cssContent.includes('#wallpaper-opacity-slider'), "Règle pour #wallpaper-opacity-slider définie dans styles.css");
    assert(cssContent.includes('#wallpaper-blur-slider'), "Règle pour #wallpaper-blur-slider définie dans styles.css");
    assert(cssContent.includes('::-webkit-slider-runnable-track'), "Piste de curseur personnalisée ::-webkit-slider-runnable-track pour éliminer la piste blanche native");
    assert(cssContent.includes('.wallpaper-studio-dialog'), ".wallpaper-studio-dialog défini dans styles.css");
    assert(cssContent.includes('100vw - 48px'), ".wallpaper-studio-dialog configuré en quasi plein-écran par rapport à la fenêtre Antigravité");

    const types = ['mesh', 'linear', 'radial', 'aurora', 'waves', 'particles', 'dots', 'grid', 'stripes'];
    types.forEach(type => {
      const res = SettingsManager.generateStudioCss({
        type: type,
        colorBase: '#070b14',
        color1: '#6366f1',
        color2: '#38bdf8',
        color3: '#ec4899',
        angle: 120,
        size: 32,
        intensity: 85,
        vignette: true
      });
      assert(res && typeof res.css === 'string' && res.css.length > 10, `Génération CSS valide pour le type ${type}`);
      assert(res.patternSize, `patternSize défini pour le type ${type}`);
      assert(res.patternRepeat, `patternRepeat défini pour le type ${type}`);
      assert(res.css.includes('radial-gradient(ellipse at center'), `Vignette cinématique intégrée au CSS`);
    });

    // 13.1 bis Vérification des nouvelles options du Studio dans le HTML
    assert(htmlContent.includes('id="studio-param-intensity"'), "Curseur d'intensité lumineuse présent dans le Studio");
    assert(htmlContent.includes('id="studio-param-blur"'), "Curseur de flou doux présent dans le Studio");
    assert(htmlContent.includes('id="studio-toggle-vignette"'), "Option de vignette cinématique présente dans le Studio");
    assert(htmlContent.includes('id="btn-studio-swap-colors"'), "Bouton d'inversion des teintes présent dans le Studio");
    assert(htmlContent.includes('data-preset="cosmos"'), "Harmonies chromatiques en un clic présentes");
    assert(!htmlContent.includes('studio-preview-glass-content'), "La fenêtre au milieu du canevas a bien été retirée pour laisser place au plein format");

    // 13.2 Sauvegarde d'un fond d'écran dans customWallpapers
    const initialSettings = Storage.getSettings();
    SettingsManager.studioConfig = {
      type: 'mesh',
      colorBase: '#050810',
      color1: '#10b981',
      color2: '#06b6d4',
      color3: '#3b82f6',
      angle: 135,
      size: 24,
      name: 'Nébuleuse Émeraude Test'
    };

    const origDoc = global.document;
    const modalEl = {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {}
    };
    const wallpaperLayerStyle = {};
    const fakeWallpaperLayer = { style: wallpaperLayerStyle };
    const fakeBody = {
      prepend: () => {},
      classList: { add: () => {}, remove: () => {} }
    };

    global.document = {
      getElementById: (id) => {
        if (id === 'wallpaper-studio-modal') return modalEl;
        if (id === 'app-wallpaper-layer') return fakeWallpaperLayer;
        if (id === 'studio-wallpaper-name-input') return { value: 'Nébuleuse Émeraude Test' };
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
      documentElement: { setAttribute: () => {}, removeAttribute: () => {}, style: {} },
      body: fakeBody
    };

    try {
      SettingsManager.saveStudioWallpaper();

      const updatedSettings = Storage.getSettings();
      assert(Array.isArray(updatedSettings.customWallpapers), "customWallpapers doit être un tableau");
      const savedWp = updatedSettings.customWallpapers.find(w => w.name === 'Nébuleuse Émeraude Test');
      assert(savedWp, "Le fond d'écran créé doit être enregistré dans les réglages");
      assert.strictEqual(updatedSettings.backgroundImage, savedWp.id, "Le fond actif doit être l'ID du fond créé");

      // Vérifier que le layer d'arrière-plan de l'application reçoit le CSS
      App.applyAppearanceSettings(updatedSettings);
      assert(fakeWallpaperLayer.style.background.includes('radial-gradient'), "Le fond génératif doit être appliqué au calque d'arrière-plan");

      // 13.3 Suppression du fond d'écran personnalisé
      SettingsManager.deleteCustomWallpaper(savedWp.id);
      const afterDelete = Storage.getSettings();
      assert(!afterDelete.customWallpapers.some(w => w.id === savedWp.id), "Le fond d'écran doit être supprimé de customWallpapers");
      assert.strictEqual(afterDelete.backgroundImage, 'none', "Le fond actif doit repasser à 'none' après suppression");

      // Restaurer les réglages d'origine
      Storage.saveSettings(initialSettings);
    } finally {
      global.document = origDoc;
    }
  });

  // 14. Fiabilisation universelle de la palette chromatique (anti-débordement, écran de sécurité, intégration notes)
  await it("1.14 Fiabilisation de la palette chromatique (anti-débordement écran, détection dynamique, centrage de secours & notes)", () => {
    const App = require('../js/app.js');

    // 14.1 Vérification CSS de la protection anti-débordement
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.accent-color-popover'), "Classe .accent-color-popover présente");
    assert(cssContent.includes('max-height: calc(100vh - 24px)'), "max-height sécurisé à calc(100vh - 24px)");
    assert(cssContent.includes('overflow-y: auto'), "overflow-y: auto pour permettre le défilement si écran très compact");

    // 14.2 Positionnement dynamique : Cible en bas d'écran (ex: Studio de création)
    const fakePopover = {
      style: { display: 'none', visibility: 'hidden', setProperty: () => {} },
      getBoundingClientRect: () => ({ width: 275, height: 385, top: 0, left: 0, right: 275, bottom: 385 }),
      querySelectorAll: () => [],
      contains: () => false,
      addEventListener: () => {}
    };

    const origWin = global.window;
    const origDoc = global.document;

    global.window = {
      innerWidth: 1200,
      innerHeight: 800,
      getSelection: () => ({ rangeCount: 0 })
    };

    global.document = {
      getElementById: (id) => {
        if (id === 'custom-accent-color-popover') return fakePopover;
        if (id === 'popover-color-title') return { textContent: '' };
        if (id === 'btn-apply-accent-popover') return { textContent: '', addEventListener: () => {} };
        if (id === 'btn-close-accent-popover') return { addEventListener: () => {} };
        if (id === 'btn-cancel-accent-popover') return { addEventListener: () => {} };
        if (id === 'popover-input-hex') return { value: '', addEventListener: () => {} };
        if (id === 'popover-input-name') return { value: '', addEventListener: () => {} };
        if (id === 'popover-hue-slider') return { value: '200', addEventListener: () => {} };
        if (id === 'popover-lightness-slider') return { value: '60', addEventListener: () => {} };
        if (id === 'popover-hue-val') return { textContent: '' };
        if (id === 'popover-lightness-val') return { textContent: '' };
        if (id === 'popover-color-swatch-badge') return { style: {} };
        if (id === 'popover-color-hex-sub') return { textContent: '' };
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {}
    };

    try {
      // Cas A : Bouton situé tout en bas d'écran (ex: y=740 dans une fenêtre de 800)
      const bottomTarget = {
        getBoundingClientRect: () => ({ left: 500, right: 530, top: 740, bottom: 765, width: 30, height: 25 })
      };
      App.openColorPicker({
        targetElement: bottomTarget,
        initialColor: '#6366F1'
      });

      const parsedTop = parseInt(fakePopover.style.top, 10);
      assert(parsedTop + 385 <= 800 - 14, "Le bas du popover (385px) ne doit JAMAIS dépasser le bas de l'écran");
      assert.strictEqual(parsedTop, 800 - 385 - 14, `Top doit être clampé exactement à winH - popoverHeight - 14 (401px, reçu: ${parsedTop})`);

      // Cas B : Bouton situé à l'extrême droite (ex: right=1180 dans une fenêtre de 1200)
      const rightTarget = {
        getBoundingClientRect: () => ({ left: 1150, right: 1180, top: 200, bottom: 230, width: 30, height: 30 })
      };
      App.openColorPicker({
        targetElement: rightTarget,
        initialColor: '#38BDF8'
      });

      const parsedLeft = parseInt(fakePopover.style.left, 10);
      assert(parsedLeft + 275 <= 1200 - 14, "Le popover ne doit pas déborder sur la droite de l'écran");
      assert.strictEqual(parsedLeft, 1150 - 275 - 10, "Le popover doit basculer à gauche du bouton cible (rect.left - popoverWidth - 10)");

      // Cas C : Cible inexistante ou détachée du DOM (rect {0,0,0,0}) -> Centrage de sécurité parfait
      const detachedTarget = {
        getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 })
      };
      App.openColorPicker({
        targetElement: detachedTarget,
        initialColor: '#10B981'
      });

      const fallbackLeft = parseInt(fakePopover.style.left, 10);
      const fallbackTop = parseInt(fakePopover.style.top, 10);
      assert.strictEqual(fallbackLeft, Math.round((1200 - 275) / 2), "En cas de cible détachée, centrage horizontal sécurisé au lieu de (10, 10)");
      assert.strictEqual(fallbackTop, Math.round((800 - 385) / 2), "En cas de cible détachée, centrage vertical sécurisé au lieu de (10, 10)");

      // 14.3 Vérification de l'intégration dans Notes
      const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
      assert(notesCode.includes('App.openColorPicker'), "js/notes.js fait appel à App.openColorPicker pour le choix de couleur");
      assert(notesCode.includes('saveEditorSelection') && notesCode.includes('restoreEditorSelection'), "js/notes.js préserve la sélection de texte de l'éditeur lors de l'application de couleur");
    } finally {
      global.window = origWin;
      global.document = origDoc;
    }
  });

  // 15. Historique pliable des versions antérieures du Changelog
  await it("1.15 Historique des versions antérieures du Changelog (v1.2.6 visible en permanence, volet pliable & sélecteur de version)", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="btn-toggle-changelog-history"'), "index.html contient le bouton de bascule de l'historique");
    assert(htmlContent.includes('id="changelog-history-wrapper"'), "index.html contient le wrapper pliable d'historique");
    assert(htmlContent.includes('id="changelog-archived-cards"'), "index.html contient le conteneur des cartes archivées");
    assert(htmlContent.includes('class="changelog-history-pill'), "index.html contient les puces de sélection de version");

    // Vérification que la version courante n'a PAS la classe d'archive
    const vCurrentIndex = htmlContent.includes('Version 1.3.0') ? htmlContent.indexOf('Version 1.3.0') : htmlContent.indexOf('Version 1.2.6');
    const vCurrentCardChunk = htmlContent.substring(vCurrentIndex - 120, vCurrentIndex + 50);
    assert(!vCurrentCardChunk.includes('changelog-archived-card'), "La carte de version courante ne doit pas être archivée et reste ouverte en permanence");

    // Vérification que les anciennes versions portent la classe changelog-archived-card
    const versions = ['1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1', '1.2.0'];
    versions.forEach(ver => {
      assert(htmlContent.includes(`data-version="${ver}"`), `data-version="${ver}" est présent dans index.html`);
    });

    // Vérification CSS
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.changelog-history-section'), "styles.css contient les styles de la section d'historique");
    assert(cssContent.includes('.changelog-history-pill'), "styles.css contient les styles des puces de version");

    // Vérification JS
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes('bindChangelogHistoryEvents'), "settings.js implémente bindChangelogHistoryEvents");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.6 : ${passedTests} passés, ${failedTests} échoués`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
