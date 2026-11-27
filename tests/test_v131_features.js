/**
 * Antigravité - Tests automatisés v1.3.1
 * Vérification du remplissage dynamique de la piste des glissières / tirettes
 * de réglage (Paramètres & Studio de création)
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const rootDir = path.resolve(__dirname, '..');

async function it(desc, fn) {
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests Fonctionnalités v1.3.1");
  console.log("   (Remplissage dynamique des tirettes Paramètres & Studio)");
  console.log("==========================================================");

  // 1. Vérification CSS des règles de remplissage
  await it("1.1 styles.css définit le dégradé dynamique avec --slider-percent pour la piste des sliders", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.settings-slider::-webkit-slider-runnable-track'), "Piste WebKit définie pour .settings-slider");
    assert(css.includes('--slider-percent'), "Variable CSS --slider-percent utilisée");
    assert(css.includes('[data-theme="light"] .settings-slider::-webkit-slider-runnable-track'), "Piste en mode clair définie");
    assert(css.includes('.settings-slider::-moz-range-progress'), "Progression Firefox définie");
  });

  // 2. Vérification de la présence des sliders dans index.html
  await it("1.2 index.html contient l'ensemble des 7 glissières de réglage avec .settings-slider", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const expectedSliders = [
      'wallpaper-opacity-slider',
      'wallpaper-blur-slider',
      'slider-notification-volume',
      'studio-param-angle',
      'studio-param-intensity',
      'studio-param-blur',
      'studio-param-size'
    ];

    expectedSliders.forEach(id => {
      assert(html.includes(`id="${id}"`), `Slider #${id} présent dans index.html`);
      const regex = new RegExp(`id=["']${id}["'][^>]*class=["'][^"']*settings-slider[^"']*["']|class=["'][^"']*settings-slider[^"']*["'][^>]*id=["']${id}["']`);
      assert(regex.test(html), `Slider #${id} possède bien la classe .settings-slider`);
    });
  });

  // 3. Calcul exact du pourcentage de progression
  await it("1.3 App.updateSliderFill calcule fidèlement le pourcentage selon min, max et value", () => {
    const App = require('../js/app.js');

    function createMockSlider(min, max, value) {
      const styleProps = {};
      return {
        min: String(min),
        max: String(max),
        value: String(value),
        style: {
          setProperty(k, v) { styleProps[k] = v; },
          getProperty(k) { return styleProps[k]; }
        },
        _props: styleProps
      };
    }

    // Cas standard (0 à 100, val=50) -> 50%
    const s1 = createMockSlider(0, 100, 50);
    App.updateSliderFill(s1);
    assert.strictEqual(s1._props['--slider-percent'], '50%');

    // Cas Opacité (5 à 80, val=25) -> (20 / 75) * 100 = 26.666666666666668%
    const sOpacity = createMockSlider(5, 80, 25);
    App.updateSliderFill(sOpacity);
    const pctOpacity = parseFloat(sOpacity._props['--slider-percent']);
    assert(Math.abs(pctOpacity - 26.6667) < 0.01, `Pourcentage opacité attendu ~26.67%, reçu: ${pctOpacity}%`);

    // Cas Intensité (20 à 100, val=80) -> (60 / 80) * 100 = 75%
    const sIntensity = createMockSlider(20, 100, 80);
    App.updateSliderFill(sIntensity);
    assert.strictEqual(sIntensity._props['--slider-percent'], '75%');

    // Cas Taille (12 à 64, val=24) -> (12 / 52) * 100 = 23.0769%
    const sSize = createMockSlider(12, 64, 24);
    App.updateSliderFill(sSize);
    const pctSize = parseFloat(sSize._props['--slider-percent']);
    assert(Math.abs(pctSize - 23.0769) < 0.01, `Pourcentage taille attendu ~23.08%, reçu: ${pctSize}%`);

    // Cas Angle (0 à 360, val=135) -> 37.5%
    const sAngle = createMockSlider(0, 360, 135);
    App.updateSliderFill(sAngle);
    assert.strictEqual(sAngle._props['--slider-percent'], '37.5%');

    // Cas Clamping min/max
    const sUnder = createMockSlider(10, 50, 0);
    App.updateSliderFill(sUnder);
    assert.strictEqual(sUnder._props['--slider-percent'], '0%');

    const sOver = createMockSlider(10, 50, 100);
    App.updateSliderFill(sOver);
    assert.strictEqual(sOver._props['--slider-percent'], '100%');
  });

  // 4. App.updateAllSlidersFill met à jour l'ensemble des curseurs d'un conteneur
  await it("1.4 App.updateAllSlidersFill parcourt et met à jour tous les sliders ciblés", () => {
    const App = require('../js/app.js');

    const sliderMap = {};
    const mockSliders = [
      { id: 'wallpaper-opacity-slider', min: '5', max: '80', value: '25', style: { setProperty(k, v) { sliderMap['opacity'] = v; } } },
      { id: 'wallpaper-blur-slider', min: '0', max: '20', value: '10', style: { setProperty(k, v) { sliderMap['blur'] = v; } } },
      { id: 'slider-notification-volume', min: '0', max: '100', value: '60', style: { setProperty(k, v) { sliderMap['vol'] = v; } } }
    ];

    const mockContainer = {
      querySelectorAll(selector) {
        assert(selector.includes('.settings-slider'), "Le sélecteur interroge .settings-slider");
        return mockSliders;
      }
    };

    App.updateAllSlidersFill(mockContainer);
    assert(sliderMap['opacity'], "Opacité mise à jour");
    assert.strictEqual(sliderMap['blur'], '50%');
    assert.strictEqual(sliderMap['vol'], '60%');
  });

  // 5. SettingsManager synchronise le remplissage lors de l'actualisation des paramètres et du Studio
  await it("1.5 SettingsManager expose updateSliderFill et updateAllSlidersFill et les invoque sur les événements", () => {
    const { SettingsManager } = require('../js/settings.js');
    assert(typeof SettingsManager.updateSliderFill === 'function', "SettingsManager.updateSliderFill est une fonction");
    assert(typeof SettingsManager.updateAllSlidersFill === 'function', "SettingsManager.updateAllSlidersFill est une fonction");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("this.updateSliderFill(opacitySlider)"), "Rendu d'opacité appelle updateSliderFill");
    assert(settingsCode.includes("this.updateSliderFill(blurSlider)"), "Rendu de flou appelle updateSliderFill");
    assert(settingsCode.includes("this.updateSliderFill(volumeSlider)"), "Rendu de volume appelle updateSliderFill");
    assert(settingsCode.includes("this.updateSliderFill(angleSlider)"), "Studio syncConfig appelle updateSliderFill pour angle");
    assert(settingsCode.includes("this.updateSliderFill(sizeSlider)"), "Studio syncConfig appelle updateSliderFill pour taille");
    assert(settingsCode.includes("this.updateSliderFill(intensitySlider)"), "Studio syncConfig appelle updateSliderFill pour intensité");
    assert(settingsCode.includes("this.updateSliderFill(blurSlider)"), "Studio syncConfig appelle updateSliderFill pour flou");
  });

  // 6. Vérification runtime du démarrage automatique Windows dans main.js (sans aucune ReferenceError)
  await it("2.1 main.js importe fsSync au niveau module et applique/supprime réellement le démarrage Windows", async () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes("const fsSync = require('node:fs');"), "fsSync importé globalement en haut de main.js");

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravite-startup-test-'));
    const fakeExeDir = path.join(tmpRoot, 'Programs', 'Antigravite');
    fs.mkdirSync(fakeExeDir, { recursive: true });
    const fakeExePath = path.join(fakeExeDir, 'Antigravite.exe');
    fs.writeFileSync(fakeExePath, 'MZ');

    const ipcHandlers = {};
    const shortcutCalls = [];
    const loginItemCalls = [];
    const regCalls = [];
    let regRunActive = false;

    const fakeElectron = {
      app: {
        isPackaged: true,
        setName: () => {},
        setAppUserModelId: () => {},
        commandLine: { appendSwitch: () => {} },
        requestSingleInstanceLock: () => true,
        on: () => {},
        whenReady: () => ({ then: () => {} }),
        isReady: () => false,
        getPath: (name) => {
          if (name === 'appData') return tmpRoot;
          if (name === 'userData') return path.join(tmpRoot, 'userData');
          if (name === 'temp') return tmpRoot;
          return tmpRoot;
        },
        getAppPath: () => rootDir,
        setLoginItemSettings: (opts) => {
          loginItemCalls.push(opts);
        },
        getLoginItemSettings: () => ({
          openAtLogin: regRunActive,
          executableWillLaunchAtLogin: regRunActive
        })
      },
      BrowserWindow: class {},
      Menu: { setApplicationMenu: () => {}, buildFromTemplate: () => ({ popup: () => {} }) },
      Tray: class {},
      nativeImage: { createFromPath: () => ({ resize: () => ({}), isEmpty: () => false }) },
      ipcMain: {
        handle: (channel, fn) => {
          ipcHandlers[channel] = fn;
        }
      },
      Notification: { isSupported: () => false },
      session: { defaultSession: {} },
      globalShortcut: { register: () => true, unregisterAll: () => {} },
      dialog: {},
      shell: {
        writeShortcutLink: (lnkPath, op, details) => {
          shortcutCalls.push({ lnkPath, op, details });
          if (op === 'create') {
            fs.mkdirSync(path.dirname(lnkPath), { recursive: true });
            fs.writeFileSync(lnkPath, 'FAKE_LNK_CONTENT');
            return true;
          }
          return false;
        }
      },
      nativeTheme: {},
      safeStorage: { isEncryptionAvailable: () => false }
    };

    const origLoad = Module._load;
    const origExecPath = process.execPath;
    const fakeChildProcess = {
      ...require('node:child_process'),
      execFileSync: (bin, args) => {
        regCalls.push({ bin, args });
        if (bin === 'reg.exe' && args[0] === 'add' && args[1].endsWith('\\Run')) {
          regRunActive = true;
          return 'The operation completed successfully.';
        }
        if (bin === 'reg.exe' && args[0] === 'query' && args[1].endsWith('\\Run')) {
          if (regRunActive) return '    Antigravite    REG_SZ    "' + fakeExePath + '"';
          throw new Error('Not found');
        }
        if (bin === 'reg.exe' && args[0] === 'delete' && args[1].endsWith('\\Run')) {
          regRunActive = false;
          return 'The operation completed successfully.';
        }
        return '';
      }
    };

    try {
      Object.defineProperty(process, 'execPath', { value: fakeExePath, configurable: true });
      Module._load = function (request, parent, isMain) {
        if (request === 'electron') return fakeElectron;
        if (request === 'node:child_process' || request === 'child_process') return fakeChildProcess;
        return origLoad.call(this, request, parent, isMain);
      };
      delete require.cache[require.resolve('../main.js')];
      const mainExports = require('../main.js');

      const lnkPath = mainExports.getWindowsStartupShortcutPath();
      assert(lnkPath && lnkPath.endsWith(path.join('Programs', 'Startup', 'Antigravite.lnk')), `Chemin raccourci valide: ${lnkPath}`);

      if (process.platform === 'win32') {
        // Activation
        const enableRes = mainExports.applyWindowsLoginItem(true);
        assert.strictEqual(enableRes.supported, true);
        assert.strictEqual(enableRes.enabled, true, "applyWindowsLoginItem(true) doit retourner enabled: true");
        assert.strictEqual(enableRes.shortcutActive, true, "Le raccourci Startup doit être créé physiquement");
        assert.strictEqual(enableRes.registryActive, true, "L'entrée registre HKCU\\Run doit être active");
        assert.strictEqual(fs.existsSync(lnkPath), true, "Le fichier Antigravite.lnk existe physiquement dans Startup");

        // Vérification icône non-asar
        const createdShortcut = shortcutCalls[0];
        assert(createdShortcut && !createdShortcut.details.icon.includes('.asar'), "L'icône du raccourci ne doit pas pointer dans app.asar");

        // Vérification écriture HKCU\Run et StartupApproved
        const addRunCall = regCalls.find(c => c.args[0] === 'add' && c.args[1].endsWith('\\Run'));
        assert(addRunCall && addRunCall.args.includes(`"${fakeExePath}"`), "Le chemin HKCU\\Run est correctement entouré de guillemets");
        const approvedRunCall = regCalls.find(c => c.args[0] === 'add' && c.args[1].endsWith('StartupApproved\\Run'));
        const approvedFolderCall = regCalls.find(c => c.args[0] === 'add' && c.args[1].endsWith('StartupApproved\\StartupFolder'));
        assert(approvedRunCall && approvedFolderCall, "StartupApproved Run et StartupFolder sont activés");

        // Vérification antigravite:get-desktop-prefs sans erreur ReferenceError
        const prefsAfterEnable = ipcHandlers['antigravite:get-desktop-prefs']();
        assert.strictEqual(prefsAfterEnable.launchOnStartup, true, "get-desktop-prefs détecte le démarrage actif");

        // Vérification antigravite:set-startup-setting
        const setRes = await ipcHandlers['antigravite:set-startup-setting'](null, true);
        assert.strictEqual(setRes.enabled, true);

        // Désactivation
        const disableRes = mainExports.applyWindowsLoginItem(false);
        assert.strictEqual(disableRes.enabled, false, "applyWindowsLoginItem(false) désactive bien le démarrage");
        assert.strictEqual(fs.existsSync(lnkPath), false, "Le raccourci Antigravite.lnk est supprimé du dossier Startup");

        const setOffRes = await ipcHandlers['antigravite:set-startup-setting'](null, false);
        assert.strictEqual(setOffRes.enabled, false);
        const prefsAfterDisable = ipcHandlers['antigravite:get-desktop-prefs']();
        assert.strictEqual(prefsAfterDisable.launchOnStartup, false, "get-desktop-prefs détecte le démarrage désactivé");
      }
    } finally {
      Module._load = origLoad;
      Object.defineProperty(process, 'execPath', { value: origExecPath, configurable: true });
      delete require.cache[require.resolve('../main.js')];
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  // 7. Synchronisation front-end sans écrasement de launchOnStartup
  await it("2.2 App.syncDesktopPrefs n'écrase pas launchOnStartup et SettingsManager synchronise à l'init", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const syncMatch = appCode.match(/syncDesktopPrefs\(settings\)\s*\{[\s\S]*?\n  \},/);
    assert(syncMatch, "Méthode syncDesktopPrefs trouvée dans js/app.js");
    assert(!syncMatch[0].includes('launchOnStartup:'), "syncDesktopPrefs ne doit pas renvoyer launchOnStartup à chaque rendu d'apparence");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes('this.refreshDesktopPrefsUI();'), "SettingsManager.init() appelle refreshDesktopPrefsUI()");
  });

  // 8. Constellation : Exclusion par défaut de l'Agenda, projets archivés, LOD Canvas, virtualisation & stress test 5 ans
  await it("3.1 Constellation exclut les créneaux d'agenda par défaut et les projets archivés", () => {
    const Constellation = require('../js/constellation.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert.strictEqual(Constellation.filters.events, false, "Le filtre events doit être désactivé par défaut");
    assert(html.includes('id="constellation-edges-canvas"'), "La couche Canvas 2D #constellation-edges-canvas existe dans index.html");
    assert(html.includes('id="btn-constellation-toggle-collapse"'), "Bouton Tout replier / déplier présent dans la toolbar");

    // Vérifier suppression de backdrop-filter GPU sur les nœuds individuels
    const nodeCssMatch = css.match(/\.constellation-node\s*\{[\s\S]*?\}/);
    assert(nodeCssMatch, "Règle .constellation-node trouvée dans styles.css");
    assert(!nodeCssMatch[0].includes('backdrop-filter'), ".constellation-node ne doit plus appliquer backdrop-filter (tueur GPU)");
    assert(nodeCssMatch[0].includes('contain: layout style paint'), ".constellation-node doit activer contain: layout style paint");

    const origStorage = global.StorageManager;
    global.StorageManager = {
      getProjects: () => [
        { id: 'p_active', title: 'Projet Actif', color: '#6366f1', archived: false },
        { id: 'p_arch', title: 'Projet Archivé Ancien', color: '#999', archived: true },
        { id: 'p_arch_child', title: 'Sous-projet archivé', parentProjectId: 'p_arch', color: '#999', archived: false }
      ],
      getTasks: () => [
        { id: 't_act', title: 'Tâche active', projectId: 'p_active', completed: false, subtasks: [] },
        { id: 't_arch', title: 'Vieille tâche archivée', projectId: 'p_arch', completed: true, subtasks: [] },
        { id: 't_arch_child', title: 'Vieille sous-branche archivée', projectId: 'p_arch_child', completed: false, subtasks: [] }
      ],
      getEvents: () => [
        { id: 'e1', title: 'Réunion 1', projectId: 'p_active', start: '2026-11-26T10:00:00' },
        { id: 'e2', title: 'Réunion 2', projectId: null, start: '2026-11-26T14:00:00' }
      ],
      getNotes: () => [
        { id: 'n_act', title: 'Note active', projectId: 'p_active', content: 'Contenu utile' },
        { id: 'n_arch', title: 'Note archivée', projectId: 'p_arch', content: 'Ancienne archive' }
      ],
      getTrash: () => []
    };

    try {
      Constellation.filters = { projects: true, tasks: true, events: false, notes: true, hideDone: false };
      Constellation.collapsedNodes.clear();
      const data = Constellation.extractGraphData();

      assert(!data.nodes.some(n => n.type === 'event'), "Aucun événement d'agenda ne doit être extrait quand filters.events === false");
      assert(!data.nodes.some(n => n.id === 'proj_p_arch'), "Les projets archivés doivent être exclus");
      assert(!data.nodes.some(n => n.id === 'proj_p_arch_child'), "Les sous-projets de projets archivés doivent être exclus en cascade");
      assert(!data.nodes.some(n => n.id === 'task_t_arch'), "Les tâches des projets archivés doivent être exclues");
      assert(!data.nodes.some(n => n.id === 'task_t_arch_child'), "Les tâches des sous-projets archivés doivent être exclues");
      assert(!data.nodes.some(n => n.id === 'note_n_arch'), "Les notes des projets archivés doivent être exclues");
      assert(data.nodes.some(n => n.id === 'proj_p_active') && data.nodes.some(n => n.id === 'task_t_act'), "Les éléments actifs restent présents");
    } finally {
      global.StorageManager = origStorage;
    }
  });

  await it("3.2 Constellation tient un volume massif (simulation 5 ans : ~2830 nœuds + 5000 événements exclus) rapidement", () => {
    const Constellation = require('../js/constellation.js');
    const origStorage = global.StorageManager;

    const projects = [];
    const tasks = [];
    const notes = [];
    const events = [];

    for (let p = 0; p < 30; p++) {
      projects.push({ id: `p_${p}`, title: `Projet ${p}`, color: '#6366f1', archived: false });
    }
    for (let t = 0; t < 2000; t++) {
      tasks.push({ id: `t_${t}`, title: `Tâche ${t}`, projectId: `p_${t % 30}`, completed: (t % 2 === 0), subtasks: [] });
    }
    for (let n = 0; n < 800; n++) {
      notes.push({ id: `n_${n}`, title: `Note ${n}`, projectId: `p_${n % 30}`, content: '<p>' + 'Texte long '.repeat(40) + '</p>' });
    }
    for (let e = 0; e < 5000; e++) {
      events.push({ id: `e_${e}`, title: `Événement ${e}`, start: '2024-05-01T09:00:00' });
    }

    global.StorageManager = {
      getProjects: () => projects,
      getTasks: () => tasks,
      getNotes: () => notes,
      getEvents: () => events,
      getTrash: () => []
    };

    try {
      Constellation.filters = { projects: true, tasks: true, events: false, notes: true, hideDone: false };
      Constellation.collapsedNodes.clear();

      const t0 = Date.now();
      const data = Constellation.extractGraphData();
      Constellation.computeRadialLayout(data.nodes, data.links);
      Constellation.prepareGraphCaches(data.nodes, data.links);
      const elapsedMs = Date.now() - t0;

      assert(data.nodes.length > 2800, `Le graphe simulé doit traiter > 2800 nœuds (reçu: ${data.nodes.length})`);
      assert(elapsedMs < 800, `Extraction + layout spatial hash O(N) sur ~2830 nœuds doit rester rapide (< 800ms, mesuré: ${elapsedMs}ms)`);
      console.log(`        [PERF] Extraction + Layout Radial Spatial Hash pour ${data.nodes.length} nœuds : ${elapsedMs} ms`);
    } finally {
      global.StorageManager = origStorage;
    }
  });

  // 9. UpdateService : préversions semver et protection d'état
  await it("4.1 UpdateService gère les préversions semver (1.4.0-beta.1 < 1.4.0) et protège les téléchargements", async () => {
    const { UpdateService } = require('../services/update-service.js');
    const svc = new UpdateService({ mock: true, currentVersion: '1.3.1' });

    assert.strictEqual(svc.isNewerVersion('1.4.0-beta.1', '1.4.0'), false, "Une préversion ne doit pas remplacer une finale");
    assert.strictEqual(svc.isNewerVersion('1.4.0', '1.4.0-beta.1'), true, "La finale doit remplacer sa préversion");
    assert.strictEqual(svc.isNewerVersion('1.4.0-beta.2', '1.4.0-beta.1'), true, "beta.2 > beta.1");
    assert.strictEqual(svc.isNewerVersion('v1.3.2', '1.3.1'), true, "Préfixe v géré correctement");

    const realSvc = new UpdateService({
      mock: false,
      currentVersion: '1.3.1',
      app: { isPackaged: true, getVersion: () => '1.3.1' },
      autoUpdater: { downloadUpdate: async () => {}, checkForUpdates: async () => { throw new Error('Network error'); } }
    });
    realSvc.status = 'error';
    realSvc.updateInfo = null;
    await assert.rejects(() => realSvc.downloadUpdate(), /Téléchargement impossible/, "downloadUpdate rejette en état error sans updateInfo");

    realSvc.status = 'downloaded';
    realSvc.updateInfo = { version: '1.4.0' };
    await assert.rejects(() => realSvc.checkForUpdates(true), /Network error/);
    assert.strictEqual(realSvc.status, 'downloaded', "checkForUpdates en erreur conserve l'état 'downloaded' prêt à installer");
  });

  // 10. main.js : Ordre --isolated avant google-auth et flush notes avant quitAndInstall
  await it("4.2 main.js configure --isolated avant google-auth-service et flush les notes avant install", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    const idxIso = mainCode.indexOf("app.setPath('userData', isolatedDir)");
    const idxGoogleAuth = mainCode.indexOf("require('./services/google-auth-service')");
    assert(idxIso !== -1 && idxGoogleAuth !== -1 && idxIso < idxGoogleAuth, "--isolated doit configurer userData avant require('./services/google-auth-service')");
    assert(mainCode.includes('NotesManager.flushPendingSave'), "antigravite:updater-install flush les notes avant quitAndInstall");
  });

  // 11. App : Sélecteur chromatique (hex 3 car., 0-100%, NaN, XSS, Potato timer)
  await it("4.3 App valide les hex 3/6 caractères, sécurise escapeHtml(0) et espace le timer Potato", () => {
    const App = require('../js/app.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    assert.strictEqual(App._normalizeHexColor('#F0A'), '#FF00AA', "Hex 3 caractères normalisé en 6 caractères");
    assert.strictEqual(App._normalizeHexColor('bad-hex', '#38BDF8'), '#38BDF8', "Hex invalide replié sur fallback");
    assert.deepStrictEqual(App.hexToRgb('#F0A'), { r: 255, g: 0, b: 170 }, "hexToRgb accepte #F0A");
    assert.deepStrictEqual(App.hexToRgb('xyz'), { r: 56, g: 189, b: 248 }, "hexToRgb évite NaN/noir sur hex invalide");

    const clampedHex = App.hslToHex(400, 150, 120);
    assert.match(clampedHex, /^#[0-9A-F]{6}$/, `hslToHex doit toujours produire un hex valide (reçu: ${clampedHex})`);

    assert.strictEqual(App.escapeHtml(0), '0', "escapeHtml(0) conserve '0'");
    assert.strictEqual(App.escapeHtml(null), '', "escapeHtml(null) retourne ''");
    assert.strictEqual(App._sanitizeCssColor('red; background:url(x)', '#6366f1'), '#6366f1', "Injection CSS bloquée");

    assert(html.includes('id="popover-lightness-slider" min="0" max="100"'), "Slider de luminosité étendu de 0 à 100%");
    assert(appCode.includes('const clockMs = 1000;'), "const clockMs = 1000; conservé dans app.js");
    assert(appCode.includes("perfMode === 'potato' ? 15000 : clockMs"), "Mode potato espace la minuterie horloge");
  });

  // 12. SettingsManager : Init non dupliqué, silent skip render, 9 presets et dead code nettoyé
  await it("4.4 SettingsManager n'auto-init pas au require, skip render(silent) et liste tous les accents", () => {
    const settingsPath = require.resolve('../js/settings.js');
    const origDoc = global.document;
    const origWin = global.window;
    let autoInitTouched = false;

    global.document = {
      readyState: 'complete',
      getElementById: () => { autoInitTouched = true; return null; },
      querySelectorAll: () => [],
      querySelector: () => null
    };
    global.window = {};
    delete require.cache[settingsPath];

    try {
      const { SettingsManager } = require('../js/settings.js');
      assert.strictEqual(SettingsManager.initialized, false, "SettingsManager ne doit pas s'auto-initialiser au chargement avant StorageManager.init()");
      assert.strictEqual(autoInitTouched, false, "Aucun accès DOM d'init lors du require()");

      const origStorage = global.StorageManager;
      let renderCalls = 0;
      let previewCalls = 0;
      const origRender = SettingsManager.render;
      const origPreview = SettingsManager.updatePreviewBox;

      const memSettings = { accentColor: 'blue', backgroundOpacity: 100 };
      global.StorageManager = {
        getSettings: () => memSettings,
        saveSettings: (s) => Object.assign(memSettings, s)
      };
      SettingsManager.render = () => { renderCalls++; };
      SettingsManager.updatePreviewBox = () => { previewCalls++; };

      try {
        SettingsManager.updateSetting('backgroundOpacity', 42, true);
        assert.strictEqual(renderCalls, 0, "updateSetting(..., true) ne doit pas relancer render()");
        assert.strictEqual(previewCalls, 1, "updateSetting(..., true) met à jour previewBox");

        SettingsManager.updateSetting('accentColor', 'cyan', false);
        assert.strictEqual(renderCalls, 1, "updateSetting(..., false) relance render()");
      } finally {
        SettingsManager.render = origRender;
        SettingsManager.updatePreviewBox = origPreview;
        global.StorageManager = origStorage;
      }

      const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
      assert(!settingsCode.includes('density-option-btn'), "Code mort .density-option-btn supprimé de settings.js");
      ['cyan', 'orange', 'mint', 'indigo'].forEach(k => {
        assert(settingsCode.includes(`${k}:`), `accentNames contient '${k}'`);
      });
    } finally {
      delete require.cache[settingsPath];
      global.document = origDoc;
      global.window = origWin;
    }
  });

  // 13. CSS : .dashboard-panel/.dashboard-hero-card & OLED custom-wallpaper
  await it("4.5 styles.css remplace .dashboard-card et couvre le thème OLED avec fond personnalisé", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(!css.includes('.dashboard-card'), "Sélecteur obsolète .dashboard-card remplacé dans styles.css");
    assert(css.includes('[data-theme="oled"] body.has-custom-wallpaper .project-card'), "Règle OLED custom wallpaper couvre .project-card");
    assert(css.includes('[data-theme="light"] .popover-swatch'), "Bordures des pastilles adaptées au thème clair");
  });

  // 14. Constellation : IDs avec apostrophes, couleur sûre & raccourcis clavier gardés
  await it("4.6 ConstellationManager gère les dossiers avec apostrophes sans inline onclick et bloque les raccourcis en modale", () => {
    const Constellation = require('../js/constellation.js');
    assert.strictEqual(Constellation.escapeHtml(0), '0', "Constellation.escapeHtml(0) retourne '0'");
    assert.strictEqual(Constellation._safeColor('javascript:alert(1)', '#38bdf8'), '#38bdf8', "_safeColor rejette URLs dangereuses");

    const origDoc = global.document;
    const origWin = global.window;
    const origApp = global.App;
    let foldedTarget = null;
    const origToggleFold = Constellation.toggleFoldNode;
    const origHideMenu = Constellation.hideContextMenu;
    const origHideHover = Constellation.hideHoverCard;
    const origCenter = Constellation.centerOnNode;

    const menuEl = { style: {}, getBoundingClientRect: () => ({ width: 180, height: 140 }) };
    const headerEl = { innerHTML: '' };
    const itemsEl = {
      innerHTML: '',
      _hasContextActionHandler: false,
      onclick: null
    };
    const keyListeners = [];

    global.window = { innerWidth: 1200, innerHeight: 800, addEventListener: () => {} };
    global.document = {
      getElementById: (id) => {
        if (id === 'constellation-context-menu') return menuEl;
        if (id === 'constellation-context-header') return headerEl;
        if (id === 'constellation-context-items') return itemsEl;
        return null;
      },
      querySelector: (sel) => sel.includes('.modal-overlay.active') ? { className: 'modal-overlay active' } : null,
      addEventListener: (evt, fn) => { if (evt === 'keydown') keyListeners.push(fn); }
    };
    global.App = { currentScreen: 'constellation' };

    try {
      const folderHubId = "__hub_notes_folder_Idées d'app__";
      Constellation._graphData = {
        nodes: [{ id: folderHubId, type: 'hub', title: "Notes · Idées d'app", color: '#10b981', _hasChildren: true, _isCollapsed: false }],
        links: []
      };
      Constellation._nodeById = new Map(Constellation._graphData.nodes.map(n => [n.id, n]));
      Constellation.hideHoverCard = () => {};
      Constellation.hideContextMenu = () => {};
      Constellation.toggleFoldNode = (id) => { foldedTarget = id; };
      Constellation.centerOnNode = () => {};

      Constellation.showContextMenu(folderHubId, 100, 100);
      assert(!itemsEl.innerHTML.includes('onclick='), "Aucun inline onclick vulnérable aux apostrophes dans le menu contextuel");
      assert(itemsEl.innerHTML.includes('data-cm-action="toggle-fold"'), "Action déléguée data-cm-action présente");

      // Simuler clic sur l'élément Replier la branche
      itemsEl.onclick({
        target: {
          closest: () => ({ dataset: { cmAction: 'toggle-fold', targetId: folderHubId } })
        }
      });
      assert.strictEqual(foldedTarget, folderHubId, "toggleFoldNode reçoit exactement l'ID avec apostrophe");

      // Vérifier garde raccourcis clavier en modale active / Ctrl+0 / <select>
      Constellation.bindGlobalEvents();
      let zoomCalled = false;
      const origZoom = Constellation.applyZoomDelta;
      Constellation.applyZoomDelta = () => { zoomCalled = true; };
      try {
        const kd = keyListeners[keyListeners.length - 1];
        kd({ key: '+', ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'DIV' }, preventDefault: () => {} });
        assert.strictEqual(zoomCalled, false, "Raccourci + ignoré quand .modal-overlay.active est ouvert");
      } finally {
        Constellation.applyZoomDelta = origZoom;
      }
    } finally {
      Constellation.toggleFoldNode = origToggleFold;
      Constellation.hideContextMenu = origHideMenu;
      Constellation.hideHoverCard = origHideHover;
      Constellation.centerOnNode = origCenter;
      global.document = origDoc;
      global.window = origWin;
      global.App = origApp;
    }
  });

  // 15. SearchManager : Entités HTML, multi-mots, highlight passe unique & couleur sûre
  await it("4.7 SearchManager décode les entités HTML en recherche note et protège highlight/color", () => {
    const SearchManager = require('../js/search.js');
    const origStorage = global.StorageManager;

    const resultsEl = { innerHTML: '', querySelectorAll: () => [] };
    SearchManager.resultsEl = resultsEl;

    global.StorageManager = {
      getProjects: () => [{ id: 'p1', title: 'Projet Alpha', description: '', color: 'red;position:fixed' }],
      getTasks: () => [],
      getEvents: () => [],
      getNotes: () => [{ id: 'n1', title: 'Note & Idées', content: '<p>L&#039;oiseau&nbsp;chante &amp; vole</p>' }]
    };

    try {
      SearchManager.executeSearch("oiseau chante");
      assert.strictEqual(SearchManager.currentResults.length, 1, "Recherche multi-mots trouve la note malgré &nbsp; et &#039;");

      SearchManager.executeSearch("mark");
      assert.strictEqual(SearchManager.currentResults.length, 0);

      // Recherche qui matche 'Projet' + 'Alpha' avec couleur malveillante
      SearchManager.executeSearch("Projet Alpha");
      assert.strictEqual(SearchManager.currentResults.length, 1);
      assert(!resultsEl.innerHTML.includes('position:fixed'), "Une couleur non hex est ignorée dans SearchManager");
      assert(resultsEl.innerHTML.includes('<mark class="search-highlight">Projet</mark>'), "Surlignage passe unique appliqué sans casser les balises");
    } finally {
      global.StorageManager = origStorage;
    }
  });

  // 16. TrashManager : Validation de restauration et confirmation sur vider la corbeille
  await it("4.8 TrashManager confirme avant emptyTrash et valide item.data dans restore()", async () => {
    const TrashManager = require('../js/trash.js');
    const origStorage = global.StorageManager;
    const origWin = global.window;

    let trashItems = [
      { id: 'tr_bad', type: 'task', title: 'Corrompu', data: null },
      { id: 'tr_ok', type: 'note', title: 'Note & Test', data: { id: 'n_ok', title: 'Note & Test', folder: 'DossierSupprimé', projectId: 'missing_proj' } }
    ];
    let savedNotes = [];
    let confirmCalls = 0;

    global.StorageManager = {
      getTrash: () => trashItems.map(x => ({ ...x })),
      saveTrash: (arr) => { trashItems = arr; },
      getNotes: () => savedNotes,
      saveNotes: (arr) => { savedNotes = arr; },
      getProjects: () => [],
      getSettings: () => ({ notesFolders: ['Général'] })
    };
    global.window = {
      App: {
        confirm: async () => { confirmCalls++; return false; },
        showToast: () => {},
        updateDashboard: () => {}
      }
    };

    try {
      assert.strictEqual(TrashManager.restore('tr_bad'), false, "restore() refuse un élément sans objet data valide");
      assert.strictEqual(trashItems.some(x => x.id === 'tr_bad'), true, "L'élément invalide n'est pas supprimé silencieusement");

      assert.strictEqual(TrashManager.restore('tr_ok'), true, "restore() restaure une note valide");
      assert.strictEqual(savedNotes[0].folder, 'Général', "Dossier inexistant ramené à 'Général'");
      assert.strictEqual(savedNotes[0].projectId, null, "projectId orphelin nettoyé");

      trashItems = [{ id: 'tr_1', type: 'task', title: 'T1', data: { id: 't1' } }];
      const emptied = await TrashManager.emptyTrash();
      assert.strictEqual(confirmCalls, 1, "emptyTrash demande confirmation");
      assert.strictEqual(emptied, false, "Annulation préserve la corbeille");
      assert.strictEqual(trashItems.length, 1);
    } finally {
      global.StorageManager = origStorage;
      global.window = origWin;
    }
  });

  // 17. MusicManager : Volume 0 préservé et playlists invalides tolérées
  await it("4.9 MusicManager conserve le volume à 0 et tolère les playlists JSON corrompues", () => {
    const musicPath = require.resolve('../js/music.js');
    const origStorage = global.localStorage;
    const origWin = global.window;

    const store = {
      antigravite_music_volume: '0',
      antigravite_custom_playlists: '{bad json'
    };
    global.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    };
    delete require.cache[musicPath];
    const MusicManager = require('../js/music.js');

    const origLoadTracks = MusicManager.loadTracks;
    MusicManager.loadTracks = () => Promise.resolve();
    try {
      MusicManager.initialized = false;
      MusicManager.init();
      assert.strictEqual(MusicManager.volume, 0, "Le volume à 0 doit être restauré sans basculer à 0.8");
      assert.deepStrictEqual(MusicManager.playlists, [], "JSON playlist corrompu retourne un tableau vide sans crash");

      store.antigravite_custom_playlists = JSON.stringify([null, { id: 'pl1', name: 'Mix', trackIds: 'not-an-array' }]);
      MusicManager.loadPlaylists();
      assert.strictEqual(MusicManager.playlists.length, 1);
      assert.deepStrictEqual(MusicManager.playlists[0].trackIds, [], "trackIds non-tableau normalisé en []");
    } finally {
      MusicManager.loadTracks = origLoadTracks;
      global.localStorage = origStorage;
      global.window = origWin;
    }
  });

  // =========================================================================
  // 5. PÉRENNITÉ 1–5 ANS SANS MAINTENANCE
  // =========================================================================

  await it("5.1 StorageManager : migrateSettings(), quota safe writes et rollback atomique restoreFullExport()", async () => {
    const storagePath = require.resolve('../js/storage.js');
    const origLS = global.localStorage;
    const origWin = global.window;

    let throwOnKey = null;
    const store = new Map();
    global.localStorage = {
      get length() { return store.size; },
      key: (i) => Array.from(store.keys())[i] || null,
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        if (throwOnKey && k === throwOnKey) {
          const e = new Error('QuotaExceededError');
          e.name = 'QuotaExceededError';
          throw e;
        }
        store.set(k, String(v));
      },
      removeItem: (k) => { store.delete(k); }
    };

    let wallpaperSaved = null;
    global.window = {
      AntigraviteAPI: {
        wallpaper: {
          save: async (dataUrl) => { wallpaperSaved = dataUrl; return { ok: true, token: '__custom_wallpaper__' }; },
          load: async () => wallpaperSaved,
          clear: async () => { wallpaperSaved = null; return { ok: true }; }
        }
      }
    };

    delete require.cache[storagePath];
    const StorageManager = require('../js/storage.js');

    try {
      // Migration des réglages hérités
      const migrated = StorageManager.migrateSettings({
        sidebarVisibleScreens: { focus: true },
        notesFolders: ['Perso'],
        autoBackupFrequencyHours: -5,
        sidebarTabsOrder: ['agenda', 'tasks']
      });
      assert.strictEqual(migrated.settingsVersion, StorageManager.SETTINGS_VERSION);
      assert.strictEqual(migrated.sidebarVisibleScreens.agenda, true, "Clés par défaut conservées");
      assert.strictEqual(migrated.sidebarVisibleScreens.focus, true, "Clés utilisateur conservées");
      assert(migrated.notesFolders.includes('Général'), "Général toujours présent");
      assert(migrated.sidebarTabsOrder.includes('constellation'), "constellation réinjecté dans sidebarTabsOrder");
      assert.strictEqual(migrated.autoBackupFrequencyHours, StorageManager.DEFAULT_SETTINGS.autoBackupFrequencyHours);
      assert.strictEqual(migrated.autoCheckUpdates, true);

      // Écriture sécurisée contre QuotaExceededError sans empoisonner _cache
      StorageManager.saveTasks([{ id: 't_ok', title: 'Valide' }]);
      throwOnKey = StorageManager.KEYS.TASKS;
      assert.throws(() => StorageManager.saveTasks([{ id: 't_fail', title: 'Perdu' }]), /QuotaExceededError/);
      throwOnKey = null;
      assert.strictEqual(StorageManager.getTasks().length, 1);
      assert.strictEqual(StorageManager.getTasks()[0].id, 't_ok', "_cache ne doit pas conserver les données non persistées");

      // Rollback atomique de restoreFullExport
      StorageManager.saveNotes([{ id: 'n_before', title: 'Avant' }]);
      throwOnKey = StorageManager.KEYS.NOTES;
      assert.throws(() => StorageManager.restoreFullExport({
        tasks: [{ id: 't_new', title: 'Nouveau' }],
        notes: [{ id: 'n_new', title: 'Échec' }]
      }), /QuotaExceededError/);
      throwOnKey = null;
      assert.strictEqual(StorageManager.getTasks()[0].id, 't_ok', "restoreFullExport restaure l'état initial si un lot échoue");

      // Fond personnalisé stocké hors localStorage via IPC
      const wpToken = await StorageManager.saveCustomWallpaperDataUrl('data:image/jpeg;base64,AAAA');
      assert.strictEqual(wpToken, '__custom_wallpaper__');
      assert.strictEqual(StorageManager.getCustomWallpaperDataUrl(), 'data:image/jpeg;base64,AAAA');

      const stats = StorageManager.getStorageStats();
      assert(stats.estimatedQuotaBytes > 0 && typeof stats.usageRatio === 'number');
    } finally {
      delete require.cache[storagePath];
      global.localStorage = origLS;
      global.window = origWin;
    }
  });

  await it("5.2 NotesManager & TrashManager : blocage images Base64 et nettoyage périodique 24/7", () => {
    const NotesManager = require('../js/notes.js');
    const TrashManager = require('../js/trash.js');

    let preventCalled = false;
    NotesManager.currentNoteId = 'note_1';
    NotesManager.handlePaste({
      clipboardData: {
        getData: () => '',
        files: [{ type: 'image/png' }]
      },
      preventDefault: () => { preventCalled = true; }
    });
    assert.strictEqual(preventCalled, true, "handlePaste bloque le collage direct de capture binaire");

    assert.strictEqual(
      NotesManager._hasTransferImage({ items: [{ kind: 'file', type: 'image/jpeg' }] }),
      true,
      "_hasTransferImage détecte les images dans items"
    );

    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesCode.includes("'img'") && notesCode.includes('handleEditorDrop'), "sanitizePastedHtml exclut <img> et drop d'image est intercepté");

    const origStorage = global.StorageManager;
    let trashData = [
      { id: 'old', expiresAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'fresh', expiresAt: new Date(Date.now() + 86400000).toISOString() }
    ];
    global.StorageManager = {
      getTrash: () => trashData,
      saveTrash: (arr) => { trashData = arr; }
    };
    try {
      TrashManager.cleanExpired();
      assert.strictEqual(trashData.length, 1);
      assert.strictEqual(trashData[0].id, 'fresh', "Seuls les éléments expirés sont purgés");
      assert(typeof TrashManager._lastExpiredCheckAt === 'number');
    } finally {
      global.StorageManager = origStorage;
    }
  });

  await it("5.3 GoogleCalendarService : jamais orderBy+syncToken (400), pagination nextPageToken, repli 400/410 et refresh glissant 7j", async () => {
    const googleAuth = require('../services/google-auth-service.js');
    const googleCal = require('../services/google-calendar-service.js');

    const origFetch = global.fetch;
    const origGetValidToken = googleAuth.getValidAccessToken;
    const origGetStatus = googleAuth.getStatus;
    const origSaveAuthData = googleAuth.saveAuthData;
    const origAuthCache = googleAuth.authCache;

    googleAuth.getValidAccessToken = async () => 'fake-access-token';
    googleAuth.getStatus = () => ({ selectedCalendarId: 'primary' });
    googleAuth.saveAuthData = async () => {};

    const seenUrls = [];
    try {
      // Cas A : synchro incrémentale récente -> utilise syncToken SANS orderBy et pagine nextPageToken
      googleAuth.authCache = {
        syncToken: 'tok_1',
        lastFullRefreshAt: new Date().toISOString(),
        lastSyncAt: null
      };
      let callNum = 0;
      global.fetch = async (urlStr) => {
        seenUrls.push(urlStr);
        callNum++;
        if (callNum === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: 'g1', summary: 'P1', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } }],
              nextPageToken: 'page_2'
            })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 'g2', summary: 'P2', start: { date: '2026-11-27' }, end: { date: '2026-11-28' } }],
            nextSyncToken: 'tok_2'
          })
        };
      };

      const resA = await googleCal.fetchEvents({ useSyncToken: true });
      assert.strictEqual(resA.totalCount, 2, "Pagination nextPageToken fusionne toutes les pages");
      assert.strictEqual(resA.isIncremental, true);
      assert.strictEqual(googleAuth.authCache.syncToken, 'tok_2');
      assert(!seenUrls[0].includes('orderBy='), "orderBy ne doit jamais accompagner syncToken");
      assert(seenUrls[1].includes('pageToken=page_2'), "pageToken transmis sur la page suivante");

      // Cas B : lastFullRefreshAt > 7 jours -> refresh complet glissant (horizon 180j) pour récurrences
      seenUrls.length = 0;
      googleAuth.authCache = {
        syncToken: 'old_tok',
        lastFullRefreshAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        lastSyncAt: null
      };
      global.fetch = async (urlStr) => {
        seenUrls.push(urlStr);
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], nextSyncToken: 'tok_fresh' })
        };
      };

      const resB = await googleCal.fetchEvents({ useSyncToken: true });
      assert.strictEqual(resB.isRollingRefresh, true, "Rafraîchissement glissant déclenché après 7 jours");
      assert.strictEqual(resB.isIncremental, false, "Le rafraîchissement glissant marque isIncremental = false");
      assert(!seenUrls[0].includes('syncToken='), "Aucun syncToken envoyé lors du rafraîchissement glissant");
      assert(seenUrls[0].includes('orderBy=startTime'), "orderBy présent lors d'une synchro complète");

      // Cas C : HTTP 400 sur syncToken -> reset et bascule auto sur full sync
      seenUrls.length = 0;
      googleAuth.authCache = {
        syncToken: 'bad_tok',
        lastFullRefreshAt: new Date().toISOString(),
        lastSyncAt: null
      };
      let cCalls = 0;
      global.fetch = async (urlStr) => {
        seenUrls.push(urlStr);
        cCalls++;
        if (cCalls === 1) {
          return { ok: false, status: 400, text: async () => 'Invalid sync token' };
        }
        return { ok: true, status: 200, json: async () => ({ items: [], nextSyncToken: 'recovered_tok' }) };
      };
      const resC = await googleCal.fetchEvents({ useSyncToken: true });
      assert.strictEqual(cCalls, 2, "Relance automatique en synchro complète après HTTP 400");
      assert.strictEqual(resC.isIncremental, false);
      assert.strictEqual(googleAuth.authCache.syncToken, 'recovered_tok');
    } finally {
      global.fetch = origFetch;
      googleAuth.getValidAccessToken = origGetValidToken;
      googleAuth.getStatus = origGetStatus;
      googleAuth.saveAuthData = origSaveAuthData;
      googleAuth.authCache = origAuthCache;
    }
  });

  await it("5.4 Autonomie Updater : opt-out autoCheckUpdates === false & capture de rejet tardif", async () => {
    const App = require('../js/app.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="setting-auto-check-updates"'), "Case à cocher #setting-auto-check-updates présente dans index.html");

    const origWin = global.window;
    const origStorage = global.StorageManager;
    let checkCalled = 0;

    global.StorageManager = {
      getSettings: () => ({ autoCheckUpdates: false })
    };
    global.window = {
      AntigraviteAPI: {
        getAppVersion: async () => '1.3.1',
        updater: {
          getVersion: async () => '1.3.1',
          checkForUpdates: async () => { checkCalled++; return null; }
        }
      }
    };
    try {
      await App.checkForStartupUpdate();
      assert.strictEqual(checkCalled, 0, "checkForUpdates ignoré au démarrage si autoCheckUpdates === false");
    } finally {
      global.window = origWin;
      global.StorageManager = origStorage;
    }
  });

  await it("5.5 Notifications, Recherche, Constellation (profondeur >=4 & ResizeObserver), Audio & Musique 24/7", async () => {
    // 1. AgendaNotificationManager : pas d'écriture localStorage sur historique ancien
    const NotifMgr = require('../js/notifications.js');
    const origLS = global.localStorage;
    const origWin = global.window;
    let saveWrites = 0;
    global.localStorage = {
      getItem: () => null,
      setItem: () => { saveWrites++; }
    };
    const oldEvents = [];
    for (let i = 0; i < 1500; i++) {
      oldEvents.push({ id: `old_${i}`, title: `Ancien ${i}`, start: new Date(Date.now() - 86400000 * 30).toISOString() });
    }
    global.window = {
      StorageManager: {
        getSettings: () => ({ notificationsEnabled: true, agendaNotificationStages: ['60m', '30m', 'now'] }),
        getEvents: () => oldEvents
      }
    };
    try {
      NotifMgr.sentHistory = {};
      NotifMgr.checkUpcomingEvents();
      assert.strictEqual(saveWrites, 0, "Aucune écriture localStorage inutile pour 1500 événements passés");
      assert.strictEqual(Object.keys(NotifMgr.sentHistory).length, 0, "Aucune allocation sentHistory inutile");
    } finally {
      global.localStorage = origLS;
      global.window = origWin;
    }

    // 2. SearchManager : priorise les tâches actives devant les tâches terminées
    const SearchManager = require('../js/search.js');
    const origSearchStorage = global.StorageManager;
    const dummyTasks = [];
    for (let i = 0; i < 12; i++) {
      dummyTasks.push({ id: `done_${i}`, title: `Audit passé ${i}`, completed: true, subtasks: [] });
    }
    dummyTasks.push({ id: 'active_1', title: 'Audit prioritaire actif', completed: false, subtasks: [] });
    global.StorageManager = {
      getProjects: () => [],
      getTasks: () => dummyTasks,
      getEvents: () => [],
      getNotes: () => []
    };
    SearchManager.resultsEl = { innerHTML: '', querySelectorAll: () => [] };
    try {
      SearchManager.executeSearch('audit');
      assert.strictEqual(SearchManager.currentResults[0].id, 'active_1', "Les tâches actives passent avant l'historique terminé");
    } finally {
      global.StorageManager = origSearchStorage;
    }

    // 3. Constellation : profondeur >= 4 positionnée hors centre & cache métriques viewport
    const Constellation = require('../js/constellation.js');
    const deepNodes = [
      { id: '__root__', type: 'root', parentId: null, width: 56, height: 56 },
      { id: 'l1', type: 'project', parentId: '__root__', width: 44, height: 44 },
      { id: 'l2', type: 'task', parentId: 'l1', width: 44, height: 44 },
      { id: 'l3', type: 'task', parentId: 'l2', width: 44, height: 44 },
      { id: 'l4', type: 'note', parentId: 'l3', width: 44, height: 44 }
    ];
    Constellation.collapsedNodes.clear();
    Constellation.computeRadialLayout(deepNodes, []);
    const l3 = deepNodes.find(n => n.id === 'l3');
    const l4 = deepNodes.find(n => n.id === 'l4');
    assert(l4.x !== 1200 && l4.y !== 900, "Un nœud de profondeur >= 4 ne s'effondre pas au centre");
    assert(Math.hypot(l4.x - l3.x, l4.y - l3.y) > 30, "Le nœud niveau 4 gravite autour de son parent niveau 3");

    // 4. SoundManager recrée les contextes 'closed' & MusicManager révoque ses blob URLs
    const SoundManager = require('../js/sound.js');
    const MusicManager = require('../js/music.js');
    let createdCtxCount = 0;
    const origWin2 = global.window;
    global.window = {
      AudioContext: class {
        constructor() {
          createdCtxCount++;
          this.state = 'running';
          this.currentTime = 0;
          this.destination = {};
        }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
        createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
        suspend() { return Promise.resolve(); }
      }
    };
    try {
      SoundManager.ctx = { state: 'closed' };
      SoundManager.playSound('pop', 0.3);
      if (SoundManager._suspendTimer) clearTimeout(SoundManager._suspendTimer);
      assert.strictEqual(createdCtxCount, 1, "Un AudioContext 'closed' est recréé proprement");
    } finally {
      SoundManager.ctx = null;
      global.window = origWin2;
    }

    const revoked = [];
    const origURL = global.URL;
    global.URL = {
      createObjectURL: (f) => `blob:test/${f.name}`,
      revokeObjectURL: (u) => revoked.push(u)
    };
    try {
      MusicManager._createdBlobUrls = new Set();
      MusicManager.tracks = [];
      MusicManager.customTracks = [];
      MusicManager.selectedFolder = 'all';
      MusicManager.addCustomTracks([{ name: 'Artist - Track.mp3' }]);
      assert.strictEqual(MusicManager._createdBlobUrls.has('blob:test/Artist - Track.mp3'), true);
      MusicManager.revokeCustomBlobUrls();
      assert.deepStrictEqual(revoked, ['blob:test/Artist - Track.mp3'], "revokeCustomBlobUrls libère les URLs blob");
    } finally {
      global.URL = origURL;
    }
  });

  await it("5.6 TasksManager & AgendaManager : zéro DOM caché sur tâches terminées et vue Mois O(N) DST-safe", () => {
    const TasksManager = require('../js/tasks.js');
    const AgendaManager = require('../js/agenda.js');
    const origDoc = global.document;
    const origStorage = global.StorageManager;

    let createdTaskNodes = 0;
    const treeEl = {
      innerHTML: '',
      appendChild: () => {},
      querySelectorAll: () => []
    };
    const makeFakeEl = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {},
        style: { setProperty() {} },
        children: [],
        innerHTML: '',
        addEventListener() {},
        appendChild(c) { this.children.push(c); }
      };
      const origClassDesc = Object.getOwnPropertyDescriptor(el, 'className');
      let _cls = '';
      Object.defineProperty(el, 'className', {
        get: () => _cls,
        set: (v) => {
          _cls = v;
          if (typeof v === 'string' && v.includes('task-tree-node')) createdTaskNodes++;
        }
      });
      return el;
    };

    const gridEl = { innerHTML: '' };
    global.document = {
      getElementById: (id) => {
        if (id === 'tasks-tree-container') return treeEl;
        if (id === 'calendar-month-grid') return gridEl;
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => makeFakeEl(tag)
    };

    const sampleTasks = [{ id: 'act_1', title: 'Tâche active', completed: false, subtasks: [] }];
    for (let i = 0; i < 50; i++) {
      sampleTasks.push({ id: `done_${i}`, title: `Tâche passée ${i}`, completed: true, subtasks: [] });
    }
    global.StorageManager = {
      getTasks: () => sampleTasks,
      getProjects: () => []
    };

    try {
      TasksManager.currentFilter = 'active';
      TasksManager.currentProjectFilter = 'all';
      TasksManager.currentSortMode = 'manual';
      TasksManager.render();
      assert.strictEqual(createdTaskNodes, 1, "Seules les tâches actives génèrent du DOM (0 nœud caché construit)");

      // Vue Mois DST mars 2026 : le 31 mars doit figurer et 3000 événements historiques s'indexent en O(N)
      const histEvents = [];
      for (let i = 0; i < 3000; i++) {
        histEvents.push({ id: `h_${i}`, title: `Passé ${i}`, start: '2022-05-10T09:00:00', end: '2022-05-10T10:00:00' });
      }
      histEvents.push({ id: 'mar_31', title: 'Fin Mars', start: '2026-03-31T10:00:00', end: '2026-03-31T11:00:00' });

      AgendaManager.currentWeekStart = new Date(2026, 2, 1); // Mars 2026
      const t0 = Date.now();
      AgendaManager.renderMonthView(histEvents, new Map(), new Map(), new Map(), new Map());
      const elapsed = Date.now() - t0;

      assert(gridEl.innerHTML.includes('data-date="2026-03-31"'), "Le 31 mars est présent malgré le changement d'heure DST");
      assert(gridEl.innerHTML.includes('Fin Mars'), "L'événement du 31 mars est rendu");
      assert(elapsed < 250, `renderMonthView O(N) sur 3001 événements reste rapide (${elapsed}ms)`);
    } finally {
      global.document = origDoc;
      global.StorageManager = origStorage;
    }
  });

  await it("5.7 Google OAuth & Sync (#3, #4, #5) : Conflits 412 IPC, Mutex hors-ligne, invalid_grant & XSS OAuth", async () => {
    // 1. Vérifier GoogleAuthService : authCache initialisé, trim credentials, mutex refresh_token + invalid_grant
    const origLoad = Module._load;
    const origFetch = global.fetch;
    const mockElectron = {
      app: { getPath: () => os.tmpdir() },
      shell: { openExternal: () => {} },
      safeStorage: { isEncryptionAvailable: () => false }
    };
    Module._load = function (request, parent, isMain) {
      if (request === 'electron') return mockElectron;
      return origLoad.apply(this, arguments);
    };
    try {
      delete require.cache[require.resolve('../services/google-auth-service.js')];
      delete require.cache[require.resolve('../services/google-calendar-service.js')];
      const auth = require('../services/google-auth-service.js');
      const cal = require('../services/google-calendar-service.js');

      assert(auth.authCache && typeof auth.authCache === 'object', "authCache est initialisé par défaut dans le constructeur");
      await assert.rejects(() => auth.saveCredentials('   ', '   '), /requis/, "saveCredentials valide après .trim()");
      assert(auth._escapeHtml('<script>x</script>').includes('&lt;script&gt;'), "OAuth échappe les erreurs HTML");

      // Mutex refresh + purge tokens sur invalid_grant
      auth.saveAuthData = async () => {};
      auth.authCache.clientId = 'cid';
      auth.authCache.clientSecret = 'csec';
      auth.authCache.tokens = { access_token: 'old', refresh_token: 'rtok', expiry_date: Date.now() - 1000 };
      let refreshCalls = 0;
      global.fetch = async () => {
        refreshCalls++;
        await new Promise(r => setTimeout(r, 15));
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'new_tok', expires_in: 3600 })
        };
      };
      const [t1, t2] = await Promise.all([auth.getValidAccessToken(), auth.getValidAccessToken()]);
      assert.strictEqual(refreshCalls, 1, "getValidAccessToken mutualise les renouvellements concurrents via _refreshPromise");
      assert.strictEqual(t1, 'new_tok');
      assert.strictEqual(t2, 'new_tok');

      // Sur invalid_grant, tokens est vidé et isConnected repasse à false
      auth.authCache.tokens = { access_token: 'old2', refresh_token: 'bad_rtok', expiry_date: Date.now() - 1000 };
      global.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'invalid_grant' })
      });
      await assert.rejects(() => auth.getValidAccessToken(), /renouvellement/);
      assert.strictEqual(auth.getStatus().isConnected, false, "invalid_grant réinitialise tokens et passe isConnected à false");

      // 412 Conflict expose code='CONFLICT', status=412 et marqueur [CONFLICT]
      auth.getValidAccessToken = async () => 'valid_tok';
      global.fetch = async () => ({ ok: false, status: 412, text: async () => 'Precondition Failed' });
      let conflictCaught = null;
      try {
        await cal.updateEvent('g123', { title: 'Test' }, 'primary', 'etag1');
      } catch (e) {
        conflictCaught = e;
      }
      assert(conflictCaught && conflictCaught.code === 'CONFLICT' && conflictCaught.status === 412, "412 Conflict expose code='CONFLICT' et status=412");
      assert(conflictCaught.message.includes('[CONFLICT]'), "412 Conflict inclut le marqueur [CONFLICT] traversant IPC");
    } finally {
      Module._load = origLoad;
      global.fetch = origFetch;
    }

    // 2. GoogleSyncManager : rétention 429/503, pas de résurrection googleId=null, relink noteId, mutex
    const GoogleSync = require('../js/google-sync.js');
    const origWin = global.window;
    const origStorage = global.StorageManager;
    const origLS = global.localStorage;
    const storeMap = {};
    let mockEvents = [];
    let mockNotes = [{ id: 'note-link-1', title: 'Ma Note', linkedEventId: 'temp-off-1' }];
    global.localStorage = {
      getItem: (k) => (k in storeMap ? storeMap[k] : null),
      setItem: (k, v) => { storeMap[k] = String(v); },
      removeItem: (k) => { delete storeMap[k]; }
    };
    global.StorageManager = {
      getEvents: () => mockEvents,
      saveEvents: (arr) => { mockEvents = arr; },
      getNotes: () => mockNotes,
      saveNotes: (arr) => { mockNotes = arr; }
    };
    let createdRemoteCount = 0;
    let updatedOfflinePayloadTitle = null;
    global.window = {
      App: { showToast() {}, updateDashboard() {} },
      AntigraviteAPI: {
        google: {
          createEvent: async (evData) => {
            createdRemoteCount++;
            updatedOfflinePayloadTitle = evData.title;
            await new Promise(r => setTimeout(r, 15));
            return { id: 'evt-g-real-99', googleId: 'real_99', title: evData.title, source: 'google' };
          },
          updateEvent: async () => { const err = new Error('Too Many Requests'); err.status = 429; throw err; },
          deleteEvent: async () => ({ success: true })
        }
      }
    };
    try {
      GoogleSync.status = { isConnected: true, selectedCalendarId: 'primary' };
      // Erreur 429/500 conservée vs 410 permanente
      assert.strictEqual(GoogleSync._isPermanentQueueError({ status: 429, message: 'Rate limit' }), false, "HTTP 429 conservé en file");
      assert.strictEqual(GoogleSync._isPermanentQueueError({ status: 503, message: 'Unavailable' }), false, "HTTP 503 conservé en file");
      assert.strictEqual(GoogleSync._isPermanentQueueError({ status: 401, message: 'Unauthorized' }), false, "HTTP 401 conservé en file");
      assert.strictEqual(GoogleSync._isPermanentQueueError({ status: 410, message: 'Gone' }), true, "HTTP 410 retiré proprement");

      // Événement offline (googleId: null) modifié puis envoyé via mutex unique sans double création
      mockEvents = [{ id: 'temp-off-1', googleId: null, title: 'Init offline', source: 'google', noteId: 'note-link-1' }];
      GoogleSync.saveOfflineQueue([{ id: 'qa-1', action: 'create', payload: { tempId: 'temp-off-1', eventData: { title: 'Init offline', noteId: 'note-link-1' }, calendarId: 'primary' } }]);
      await GoogleSync.updateGoogleEvent(mockEvents[0], { title: 'Modif offline' });
      assert.strictEqual(updatedOfflinePayloadTitle, 'Modif offline', "La modification d'un événement pending_create met à jour le payload create");
      assert.strictEqual(mockNotes[0].linkedEventId, 'evt-g-real-99', "L'ID réel créé remplace le tempId dans note.linkedEventId");

      // Mutex concurrent sur processOfflineQueue
      createdRemoteCount = 0;
      GoogleSync.saveOfflineQueue([{ id: 'qa-2', action: 'create', payload: { tempId: 'temp-off-2', eventData: { title: 'Mutex test' }, calendarId: 'primary' } }]);
      await Promise.all([GoogleSync.processOfflineQueue(), GoogleSync.processOfflineQueue()]);
      assert.strictEqual(createdRemoteCount, 1, "Un seul appel réseau grâce au mutex _queuePromise");

      // Suppression d'un événement offline googleId:null purge l'action create (aucune résurrection)
      mockEvents = [{ id: 'temp-off-del', googleId: null, title: 'À annuler', source: 'google' }];
      GoogleSync.saveOfflineQueue([{ id: 'qa-del-create', action: 'create', payload: { tempId: 'temp-off-del', eventData: { title: 'À annuler' }, calendarId: 'primary' } }]);
      await GoogleSync.deleteGoogleEvent(mockEvents[0]);
      assert.strictEqual(GoogleSync.getOfflineQueue().length, 0, "Supprimer un événement googleId:null purge son action 'create' de la file");
    } finally {
      global.window = origWin;
      global.StorageManager = origStorage;
      global.localStorage = origLS;
    }
  });

  await it("5.8 Backups (#7), Projets (#11) & Constellation (#29) : Sync nom backup + rollback, désarchivage ancêtres, LOD sans flip-flop", async () => {
    const BackupMgr = require('../js/backups.js');
    const origWin = global.window;
    const origDoc = global.document;
    const origLS = global.localStorage;
    const origStorage = global.StorageManager;

    let deletedRollbackPath = null;
    const store = {};
    global.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    };
    global.document = { getElementById: () => null };
    global.window = {
      App: { showToast() {} },
      AntigraviteAPI: {
        saveBackup: async () => ({ filename: 'antigravite_backup_real_99.json', path: 'C:/tmp/antigravite_backup_real_99.json' }),
        deleteBackupFile: async (p) => { deletedRollbackPath = p; return { deleted: true }; },
        pruneBackups: async () => {}
      }
    };
    global.StorageManager = {
      getFullExport: () => ({ tasks: [], projects: [], events: [], notes: [], settings: {} }),
      getSettings: () => ({ backupRetentionCount: 10 }),
      getBackups: () => [],
      saveBackups: () => { throw new Error('Simulated QuotaExceeded'); }
    };
    try {
      await assert.rejects(() => BackupMgr.createManualBackup('Test rollback'), /QuotaExceeded/);
      assert.strictEqual(deletedRollbackPath, 'C:/tmp/antigravite_backup_real_99.json', "Si saveAll échoue, le fichier physique orphelin est nettoyé");

      global.StorageManager.saveBackups = (b) => { store.backups = JSON.stringify(b); };
      const rec = await BackupMgr.createManualBackup('Test filename sync');
      assert.strictEqual(rec.filename, 'antigravite_backup_real_99.json', "backupRecord.filename reflète le nom réel retourné par IPC");
    } finally {
      global.window = origWin;
      global.document = origDoc;
      global.localStorage = origLS;
      global.StorageManager = origStorage;
    }

    // Projets #11 : unarchiveProject réactive aussi l'ancêtre archivé + _pruneCollapsedFamilies
    const prevSM = global.StorageManager;
    if (!global.StorageManager) global.StorageManager = require('../js/storage.js');
    const ProjectsMgr = require('../js/projects.js');
    let savedProjects = [
      { id: 'p_root', title: 'Racine', archived: true, archivedAt: '2026-01-01', parentProjectId: null },
      { id: 'p_child', title: 'Enfant', archived: true, archivedAt: '2026-01-01', parentProjectId: 'p_root' }
    ];
    const origProjSave = StorageManager.saveProjects;
    const origProjGet = StorageManager.getProjects;
    const origProjRender = ProjectsMgr.render;
    try {
      StorageManager.getProjects = () => savedProjects;
      StorageManager.saveProjects = (p) => { savedProjects = p; };
      ProjectsMgr.render = () => {};
      ProjectsMgr.collapsedFamilies = new Set(['p_deleted_ghost', 'p_root']);
      await ProjectsMgr.unarchiveProject('p_child');
      assert.strictEqual(savedProjects.find(p => p.id === 'p_root').archived, false, "Désarchiver un enfant désarchive aussi son parent archivé");
      assert.strictEqual(ProjectsMgr.collapsedFamilies.has('p_deleted_ghost'), false, "_pruneCollapsedFamilies purge les IDs supprimés");
    } finally {
      StorageManager.saveProjects = origProjSave;
      StorageManager.getProjects = origProjGet;
      ProjectsMgr.render = origProjRender;
      global.StorageManager = prevSM;
    }

    // Constellation #29 : toggleCompleted appelé, LOD hover ne promeut pas en DOM, ancêtres visibles conservés
    const Constellation = require('../js/constellation.js');
    const origTasksMgr = global.TasksManager;
    let toggledId = null;
    global.TasksManager = { toggleCompleted: (id) => { toggledId = id; } };
    try {
      Constellation.hideContextMenu = () => {};
      const origConRender = Constellation.render;
      Constellation.render = () => {};
      Constellation.toggleTaskCompleteFromMenu('task_99');
      Constellation.render = origConRender;
      assert.strictEqual(toggledId, 'task_99', "toggleTaskCompleteFromMenu invoque TasksManager.toggleCompleted");

      Constellation._hoveredCanvasNodeId = 'task_lod_1';
      Constellation.filters = { projects: false, tasks: true, events: true, notes: true, hideDone: false };
      Constellation._mountedNodes = new Map();
      Constellation._graphData = {
        nodes: [
          { id: '__root__', type: 'root', parentId: null },
          { id: 'proj_1', type: 'project', parentId: '__root__' },
          { id: 'task_1', type: 'task', parentId: 'proj_1', completed: false }
        ]
      };
      Constellation._nodeById = new Map(Constellation._graphData.nodes.map(n => [n.id, n]));
      Constellation.applyFiltersVisibility(false);
      assert.strictEqual(Constellation._nodeById.get('proj_1')._filteredOut, false, "Le projet ancêtre d'une tâche visible reste visible pour éviter des arêtes coupées");

      const cCode = fs.readFileSync(path.join(rootDir, 'js', 'constellation.js'), 'utf8');
      assert(!cCode.includes('(this._hoveredCanvasNodeId === n.id)'), "Le nœud LOD survolé n'est pas promu en DOM (suppression de l'oscillation hover)");
    } finally {
      global.TasksManager = origTasksMgr;
    }
  });

  await it("5.9 Agenda & Notifications (#12, #13, #14, #15, #16) : Journée entière, mois sans saut, 23:59, récurrents & replanification", () => {
    const AgendaMgr = require('../js/agenda.js');
    const NotifMgr = require('../js/notifications.js');

    // #13 Navigation mensuelle sans saut depuis le 31
    AgendaMgr.currentView = 'month';
    AgendaMgr.currentWeekStart = new Date(2026, 0, 31); // 31 janvier 2026
    const origAgendaRender = AgendaMgr.render;
    AgendaMgr.render = () => {};
    try {
      AgendaMgr.navigateNext();
      assert.strictEqual(AgendaMgr.currentWeekStart.getMonth(), 1, "Janvier 31 -> +1 mois donne bien Février (index 1) sans sauter à Mars");
      AgendaMgr.currentWeekStart = new Date(2026, 2, 31); // 31 mars 2026
      AgendaMgr.navigatePrev();
      assert.strictEqual(AgendaMgr.currentWeekStart.getMonth(), 1, "Mars 31 -> -1 mois donne bien Février (index 1)");
    } finally {
      AgendaMgr.render = origAgendaRender;
    }

    // #14 formatHourDecimal(24) => 23:59
    assert.strictEqual(AgendaMgr.formatHourDecimal(24), '23:59', "formatHourDecimal(24) retourne '23:59' au lieu de '23:00'");
    assert.strictEqual(AgendaMgr.formatHourDecimal(0), '00:00', "formatHourDecimal(0) retourne '00:00'");

    // #12 All-Day clic + normalisation champs date dans agenda.js
    const agendaSrc = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaSrc.includes("isAllDay: true") && !agendaSrc.includes("start: '${dateStr}T09:00', end: '${dateStr}T10:00', isAllDay: true"), "La cellule Journée entière transmet des dates ISO sans T09:00");
    assert(agendaSrc.includes("isAllDayMode ? rawDefStart.slice(0, 10)"), "openEventModal normalise YYYY-MM-DD en mode all-day");

    // #16 Notifications sur événements récurrents + reset quand l'horaire change
    const origLS = global.localStorage;
    const origWin = global.window;
    let notified = [];
    const lsData = {};
    global.localStorage = {
      getItem: (k) => lsData[k] || null,
      setItem: (k, v) => { lsData[k] = String(v); }
    };
    const plus30 = new Date(Date.now() + 28 * 60000);
    const pad = n => String(n).padStart(2, '0');
    const hhmm = `${pad(plus30.getHours())}:${pad(plus30.getMinutes())}`;
    const ymdToday = `${plus30.getFullYear()}-${pad(plus30.getMonth() + 1)}-${pad(plus30.getDate())}`;
    const recurringEvt = {
      id: 'evt-rec-daily',
      title: 'Standup quotidien',
      start: `2026-01-01T${hhmm}`,
      end: `2026-01-01T23:59`,
      recurrence: 'daily',
      isAllDay: false
    };
    const origNotify = NotifMgr.notify;
    NotifMgr.notify = (stage, evt) => { notified.push({ stage, title: evt.title }); };
    global.window = {
      StorageManager: {
        getSettings: () => ({ notificationsEnabled: true, agendaNotificationStages: ['60m', '30m', 'now'] }),
        getEvents: () => [recurringEvt]
      }
    };
    try {
      NotifMgr.sentHistory = {};
      NotifMgr.checkUpcomingEvents();
      assert(notified.some(n => n.stage === '30m' && n.title === 'Standup quotidien'), "Un événement récurrent quotidien créé dans le passé notifie bien à +28 min aujourd'hui");

      // Test reset après replanification d'un événement ponctuel
      notified = [];
      const singleEvt = { id: 'evt-resched', title: 'Rendez-vous', start: `${ymdToday}T${hhmm}`, isAllDay: false };
      NotifMgr.sentHistory = { 'evt-resched': { stages: ['60m', '30m'], startSig: '2026-01-01T08:00' } };
      global.window.StorageManager.getEvents = () => [singleEvt];
      NotifMgr.checkUpcomingEvents();
      assert(notified.some(n => n.stage === '30m' && n.title === 'Rendez-vous'), "Un événement replanifié réinitialise son historique et re-notifie");
    } finally {
      NotifMgr.notify = origNotify;
      global.localStorage = origLS;
      global.window = origWin;
    }
  });

  await it("5.10 Notes (#21, #22) : Dossiers orphelins, ordre Markdown sans corruption de liens/tags", () => {
    const NotesMgr = require('../js/notes.js');
    const origStorage = global.StorageManager;
    global.StorageManager = {
      getSettings: () => ({ notesFolders: ['Général'] }),
      getNotes: () => [{ id: 'n_arch', title: 'Orpheline', folder: 'Archives Secrets', content: '' }]
    };
    try {
      const folders = NotesMgr.getFolders();
      assert(folders.includes('Archives Secrets'), "getFolders() inclut aussi les dossiers présents uniquement sur d'anciennes notes");
    } finally {
      global.StorageManager = origStorage;
    }

    const html = NotesMgr.simpleMarkdownToHtml(
      "Voir [[mon_doc_interne|Doc_Test]], [Lien **gras**](https://ex.com/a_b_c#ancre) et #mon_tag_v2 !"
    );
    assert(html.includes('data-target="mon_doc_interne"'), "L'attribut data-target n'est pas corrompu par _ -> <em>");
    assert(html.includes('href="https://ex.com/a_b_c#ancre"'), "L'URL n'est pas corrompue par _ ou #tag");
    assert(html.includes('<strong>gras</strong>'), "Le gras à l'intérieur du libellé de lien Markdown reste supporté");
    assert(html.includes('<span class="obsidian-tag">#mon_tag_v2</span>'), "Les tags contenant des underscores ne sont pas brisés en <em>");
  });

  await it("5.11 Focus (#23) & Musique (#24, #25) : Horodatage anti-throttling, playlists actives et race playPromise", async () => {
    const FocusMgr = require('../js/focus.js');
    const MusicMgr = require('../js/music.js');

    // Focus #23 : dérive horodatée
    FocusMgr.isRunning = true;
    FocusMgr.remainingSeconds = 1500;
    FocusMgr._endTimestamp = Date.now() + 900 * 1000; // 15 min exactement restantes malgré un gel simulateur
    const origUpdDisp = FocusMgr.updateDisplay;
    const origUpdTitle = FocusMgr.updateDocumentTitle;
    FocusMgr.updateDisplay = () => {};
    FocusMgr.updateDocumentTitle = () => {};
    try {
      FocusMgr.tick();
      assert(FocusMgr.remainingSeconds >= 899 && FocusMgr.remainingSeconds <= 901, `tick() recalcule depuis _endTimestamp (reçu ${FocusMgr.remainingSeconds}s)`);
    } finally {
      FocusMgr.updateDisplay = origUpdDisp;
      FocusMgr.updateDocumentTitle = origUpdTitle;
      FocusMgr.isRunning = false;
      FocusMgr._endTimestamp = null;
    }

    // Musique #24 & #25 : restriction playlist/dossier dans next/prev/shuffle + abort sans couper nouvelle piste + stop reset
    MusicMgr.tracks = [
      { id: 't0', filename: 'a.mp3', folder: 'Jazz', src: 'blob:1' },
      { id: 't1', filename: 'b.mp3', folder: 'Zen', src: 'blob:2' },
      { id: 't2', filename: 'c.mp3', folder: 'Jazz', src: 'blob:3' }
    ];
    MusicMgr.playlists = [{ id: 'pl-custom', name: 'Focus Jazz', trackIds: ['t0', 't2'] }];
    MusicMgr.activePlaylistId = 'pl-custom';
    MusicMgr.selectedFolder = 'all';
    MusicMgr.isShuffle = false;
    MusicMgr.repeatMode = 'all';
    MusicMgr.currentIndex = 0;

    let playedIndices = [];
    const origPlay = MusicMgr.play;
    const origUi = MusicMgr.updatePlayerUI;
    const origMini = MusicMgr.updateSidebarMiniPlayer;
    const origTimeUpd = MusicMgr.onTimeUpdate;
    MusicMgr.updatePlayerUI = () => {};
    MusicMgr.updateSidebarMiniPlayer = () => {};
    try {
      MusicMgr.play = (idx) => { playedIndices.push(idx); MusicMgr.currentIndex = idx; };
      MusicMgr.next(true);
      assert.strictEqual(playedIndices[0], 2, "next() saute t1 hors playlist et passe directement à t2");
      MusicMgr.next(true);
      assert.strictEqual(playedIndices[1], 0, "next() boucle uniquement dans la playlist active");
      MusicMgr.prev();
      assert.strictEqual(playedIndices[2], 2, "prev() revient à t2 dans la playlist active");

      MusicMgr.play = origPlay;
      let loadCount = 0;
      let seenTimeAtUiUpdate = -1;
      MusicMgr.onTimeUpdate = () => { if (MusicMgr.audio) seenTimeAtUiUpdate = MusicMgr.audio.currentTime; };
      MusicMgr.audio = {
        src: '',
        volume: 0.8,
        currentTime: 42,
        paused: true,
        load() { loadCount++; },
        pause() { this.paused = true; },
        play() { return Promise.reject(new Error('Aborted by quick switch')); }
      };
      // #25a : Reprise sur piste déjà chargée (ex. blob) sans recharger à 00:00
      MusicMgr.currentIndex = 0;
      MusicMgr._loadedTrackKey = MusicMgr._getTrackKey(MusicMgr.tracks[0]);
      MusicMgr.audio.src = 'blob:1';
      MusicMgr.play();
      assert.strictEqual(loadCount, 0, "Reprise sur URL blob déjà chargée ne recharge pas la source");

      // #25b : Avancer l'ID de requête simulant une piste suivante -> ancien rejet ignoré
      const firstReq = MusicMgr._playRequestId;
      MusicMgr.isPlaying = true;
      MusicMgr._playRequestId = firstReq + 1;
      await new Promise(r => setTimeout(r, 15));
      assert.strictEqual(MusicMgr.isPlaying, true, "Le rejet obsolète d'une promesse play() n'éteint pas la nouvelle lecture");

      // #25c : stop() remet currentTime = 0 avant onTimeUpdate()
      MusicMgr.audio.currentTime = 42;
      MusicMgr.stop(true);
      assert.strictEqual(seenTimeAtUiUpdate, 0, "stop() remet currentTime à 0 avant de rafraîchir l'affichage");
    } finally {
      MusicMgr.play = origPlay;
      MusicMgr.updatePlayerUI = origUi;
      MusicMgr.updateSidebarMiniPlayer = origMini;
      MusicMgr.onTimeUpdate = origTimeUpd;
      MusicMgr.audio = null;
    }
  });

  await it("5.12 Cohérence finale Version 1.3.1 (#38) : package.json, App, UpdateManager, Changelog, UpdateService mock", async () => {
    const { UpdateService } = require('../services/update-service.js');
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    assert.strictEqual(pkg.version, '1.3.1', "package.json en version 1.3.1");
    assert(appCode.includes("APP_VERSION: '1.3.1'"), "App.APP_VERSION à 1.3.1");
    assert(html.includes('Version 1.3.1'), "Changelog / Nouveautés mentionnent Version 1.3.1");

    const svc = new UpdateService({ mock: true, currentVersion: '1.3.1' });
    const mockCheck = await svc.checkForUpdates();
    assert.strictEqual(mockCheck.isUpdateAvailable, true, "Le mode mock trouve une version plus récente même en v1.3.1");
    assert(svc.isNewerVersion(mockCheck.updateInfo.version, '1.3.1'), "mockVersion dynamique > 1.3.1");
  });

  console.log("==========================================================");
  console.log("   TOUS LES TESTS v1.3.1 ONT RÉUSSI AVEC SUCCÈS !");
  console.log("==========================================================");
}

runTests();
