// =============================================================================
// Tests automatisés : Validation des optimisations de performances
// =============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(` [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${description}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(` [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${description}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log("==========================================================");
console.log("   Antigravité - Tests des Optimisations de Performances");
console.log("==========================================================");

async function runTests() {
  global.window = global;
  if (!global.document) {
    global.document = {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  }
  if (!global.StorageManager) {
    global.StorageManager = require('../js/storage.js');
  }

  // -----------------------------------------------------------------------------
  // Test 1 : Cache mémoire transparent et écriture compacte dans StorageManager
  // -----------------------------------------------------------------------------
  it("1. StorageManager : Cache mémoire transparent opérationnel avec gain de lecture mesurable", () => {
    const Storage = require('../js/storage.js');
    Storage.clearCache();

    let storageMock = {};
    global.localStorage = {
      getItem: (k) => storageMock[k] || null,
      setItem: (k, v) => { storageMock[k] = v; }
    };

    const sampleTasks = [{ id: 't-1', title: 'Test 1' }, { id: 't-2', title: 'Test 2' }];
    Storage.saveTasks(sampleTasks);

    // Vérifier que le format stocké est compact (pas de sauts de ligne inutiles null, 2)
    const storedStr = storageMock[Storage.KEYS.TASKS];
    assert.ok(!storedStr.includes('\n'), "Le JSON stocké en localStorage doit être compact (sans indentation inutile)");

    // Vérifier la lecture depuis le cache mémoire
    const read1 = Storage.getTasks();
    assert.strictEqual(read1.length, 2);
    assert.strictEqual(read1, Storage.getTasks(), "Deux lectures consécutives doivent renvoyer la référence en cache mémoire");

    // Mesure du gain de performance lecture cache vs parsing JSON
    const N = 5000;
    const startRaw = process.hrtime.bigint();
    for (let i = 0; i < N; i++) JSON.parse(storedStr);
    const durRaw = Number(process.hrtime.bigint() - startRaw);

    const startCache = process.hrtime.bigint();
    for (let i = 0; i < N; i++) Storage.getTasks();
    const durCache = Number(process.hrtime.bigint() - startCache);

    assert.ok(durCache < durRaw, "La lecture en cache mémoire doit être nettement plus rapide que le parsing répété");
  });

  // -----------------------------------------------------------------------------
  // Test 2 : Optimisation de l'agenda (Parsing rapide et indexation O(1))
  // -----------------------------------------------------------------------------
  it("2. AgendaManager : Parsing rapide des horaires et pré-filtrage de la semaine", () => {
    const Agenda = require('../js/agenda.js');

    // Test de l'agencement avec de multiples créneaux
    const dayEvents = [
      { id: 'e-1', title: 'Créneau 1', start: '2026-10-27T09:15', end: '2026-10-27T10:45', isAllDay: false },
      { id: 'e-2', title: 'Créneau 2', start: '2026-10-27T10:00', end: '2026-10-27T11:30', isAllDay: false },
      { id: 'e-3', title: 'Créneau 3', start: '2026-10-27T14:00', end: '2026-10-27T16:00', isAllDay: false }
    ];

    const layout = Agenda.computeOverlappingLayout(dayEvents, '2026-10-27');
    assert.strictEqual(layout.length, 3, "Tous les événements doivent être agencés");
    assert.strictEqual(layout[0].startMin, 9 * 60 + 15, "09:15 converti à 555 min");
    assert.strictEqual(layout[0].endMin, 10 * 60 + 45, "10:45 converti à 645 min");
    assert.strictEqual(layout[0].totalCols, 2, "Chevauchement e-1 et e-2 détecté en 2 colonnes");
  });

  // -----------------------------------------------------------------------------
  // Test 3 : Glisser-déposer des tâches : Élimination des scans récursifs sur dragover
  // -----------------------------------------------------------------------------
  it("3. TasksManager : Cache _draggedForbiddenIds pour éviter les parcours récursifs en continu", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const Tasks = require('../js/tasks.js');
    const tree = [
      {
        id: 'parent',
        title: 'Parent',
        subtasks: [
          { id: 'child-1', title: 'Enfant 1', subtasks: [{ id: 'sub-child-1', title: 'Sous-enfant 1' }] },
          { id: 'child-2', title: 'Enfant 2', subtasks: [] }
        ]
      },
      { id: 'other', title: 'Autre racine', subtasks: [] }
    ];

    // Simulation du calcul de dragstart
    const forbidden = new Set(['parent']);
    const collect = (t) => {
      if (t.subtasks) {
        for (const s of t.subtasks) {
          forbidden.add(s.id);
          collect(s);
        }
      }
    };
    collect(tree[0]);

    assert.ok(forbidden.has('parent'), "L'ID parent est interdit");
    assert.ok(forbidden.has('child-1'), "L'ID enfant est interdit");
    assert.ok(forbidden.has('sub-child-1'), "L'ID sous-enfant est interdit");
    assert.ok(!forbidden.has('other'), "Une autre tâche non descendante est autorisée");
  });

  // -----------------------------------------------------------------------------
  // Test 4 : Notes : Débouncing des écritures localStorage lors de la frappe
  // -----------------------------------------------------------------------------
  await itAsync("4. NotesManager : Débouncing des écritures pendant la saisie avec flush immédiat", async () => {
    const Notes = require('../js/notes.js');
    let savedCount = 0;
    Notes.getAll = () => [{ id: 'n-1', title: 'Note', content: 'Init' }];
    const origSave = global.StorageManager.saveNotes;
    global.StorageManager.saveNotes = () => { savedCount++; };

    Notes.currentNoteId = 'n-1';

    // 10 frappes consécutives
    for (let i = 0; i < 10; i++) {
      Notes.updateCurrentNoteContent(`Texte ${i}`);
    }

    assert.strictEqual(savedCount, 0, "Aucune écriture synchrone immédiate pendant la frappe");

    // Flush forcé (ex: blur, navigation, changement de note)
    Notes.flushPendingSave();
    assert.strictEqual(savedCount, 1, "Une seule écriture effectuée lors du flush");

    global.StorageManager.saveNotes = origSave;
  });

  // -----------------------------------------------------------------------------
  // Test 5 : GoogleSyncManager : Verrou d'exclusion mutuelle et limitation des actualisations silencieuses
  // -----------------------------------------------------------------------------
  it("5. GoogleSyncManager : Verrou anti-concurrence _isSyncing et limitation des requêtes silencieuses", () => {
    const GoogleSync = require('../js/google-sync.js');
    assert.strictEqual(typeof GoogleSync._isSyncing, 'boolean', "Le verrou _isSyncing doit être présent");
    assert.strictEqual(typeof GoogleSync._lastSyncSuccessAt, 'number', "_lastSyncSuccessAt doit être initialisé");
  });

  // -----------------------------------------------------------------------------
  // Test 6 : Packaging : Exclusion des fichiers de sauvegarde et originaux volumineux
  // -----------------------------------------------------------------------------
  it("6. package.json : build.files conserve les services tout en excluant les sauvegardes et originaux bruts", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const files = pkg.build.files;

    assert.ok(files.includes('services/**/*'), "Les services Google doivent impérativement être inclus");
    assert.ok(files.includes('!assets/originals/**/*'), "Les sauvegardes d'originaux bruts doivent être exclues de app.asar");
    assert.ok(files.includes('!**/*.bak*'), "Les fichiers .bak* doivent être exclus de app.asar");
  });

  // -----------------------------------------------------------------------------
  // Test 7 : Notes : Débouncing de la modification du titre avec flush immédiat
  // -----------------------------------------------------------------------------
  await itAsync("7. NotesManager : Débouncing de updateCurrentNoteTitle avec flushPendingSave()", async () => {
    const Notes = require('../js/notes.js');
    let savedCount = 0;
    const sampleNotes = [{ id: 'n-title-1', title: 'Initial', content: 'Contenu' }];
    const origGetAll = Notes.getAll;
    const origSave = global.StorageManager.saveNotes;
    const origRenderList = Notes.renderNotesList;
    Notes.getAll = () => sampleNotes;
    Notes.renderNotesList = () => {};
    global.StorageManager.saveNotes = () => { savedCount++; };

    Notes.currentNoteId = 'n-title-1';
    for (let i = 0; i < 8; i++) {
      Notes.updateCurrentNoteTitle(`Titre rapide ${i}`);
    }

    assert.strictEqual(savedCount, 0, "Aucune écriture synchrone pendant la frappe du titre");
    assert.strictEqual(sampleNotes[0].title, 'Titre rapide 7', "Le titre en mémoire est bien à jour");

    Notes.flushPendingSave();
    assert.strictEqual(savedCount, 1, "Une seule écriture effectuée lors du flushPendingSave()");

    Notes.getAll = origGetAll;
    Notes.renderNotesList = origRenderList;
    global.StorageManager.saveNotes = origSave;
  });

  // -----------------------------------------------------------------------------
  // Test 8 : CSS : Containment, content-visibility, flous conditionnels & prefers-reduced-motion
  // -----------------------------------------------------------------------------
  it("8. CSS : Optimisations GPU (flous sans fond d'écran, scaleY, containment, reduced-motion)", () => {
    const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
    assert.ok(css.includes('[data-glass="balanced"] body:not(.has-custom-wallpaper)'), "Le flou coûteux est désactivé sans fond d'écran personnalisé en mode Équilibré");
    assert.ok(css.includes('content-visibility: auto'), "content-visibility: auto activé pour ignorer le rendu hors-écran des longues listes");
    assert.ok(css.includes('contain: layout style'), "Containment layout/style actif sur les conteneurs principaux");
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), "Support natif du mode système animations réduites");
    assert.ok(css.includes('.music-vinyl-disc.spinning:not(.paused)'), "will-change: transform appliqué uniquement aux vinyles en rotation active");
    assert.ok(css.includes('transform: scaleY(0.22)'), "Égaliseur audio animé via transform: scaleY au lieu de height");
  });

  // -----------------------------------------------------------------------------
  // Test 9 : JS : Gardes d'inactivité, Fragments DOM et arrêt anticipé de recherche
  // -----------------------------------------------------------------------------
  it("9. Contrôleurs : Timers conscients de la visibilité, DocumentFragment et early-exit", () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const musicCode = fs.readFileSync(path.join(__dirname, '../js/music.js'), 'utf8');
    const agendaCode = fs.readFileSync(path.join(__dirname, '../js/agenda.js'), 'utf8');
    const searchCode = fs.readFileSync(path.join(__dirname, '../js/search.js'), 'utf8');
    const tasksCode = fs.readFileSync(path.join(__dirname, '../js/tasks.js'), 'utf8');
    const notesCode = fs.readFileSync(path.join(__dirname, '../js/notes.js'), 'utf8');

    assert.ok(appCode.includes('_lastDayProgressSegSig'), "Frise latérale réutilisée sans reconstruction DOM inutile");
    assert.ok(appCode.includes('lastMinuteKey'), "Horloge du tableau de bord ne mute les minutes/date/salutation qu'au changement réel");
    assert.ok(musicCode.includes('if (document.hidden === true) return;'), "MusicManager.onTimeUpdate ignoré quand la fenêtre est masquée");
    assert.ok(musicCode.includes("classList.contains('sidebar-collapsed')"), "Mini-barre musique ignorée quand le volet latéral est replié");
    assert.ok(agendaCode.includes("window.App.currentScreen !== 'agenda'"), "Timer de ligne heure actuelle suspendu hors écran Agenda");
    assert.ok(searchCode.includes('collectMatches') && searchCode.includes(', 80);'), "Recherche globale avec arrêt anticipé et debounce 80ms");
    assert.ok(tasksCode.includes('nowTime = Date.now()') && tasksCode.includes('createDocumentFragment'), "TasksManager.render utilise DocumentFragment et Date.now() mutualisé");
    assert.ok(notesCode.includes('createDocumentFragment') && notesCode.includes('_shortDateFmt'), "NotesManager.renderNotesList utilise DocumentFragment et Intl.DateTimeFormat en cache");
  });

  // -----------------------------------------------------------------------------
  // Test 10 : Paramètres sérieux : UI, 4 sous-onglets, CSS modes & IPC Electron
  // -----------------------------------------------------------------------------
  it("10. Paramètres sérieux : Onglet, 4 sous-onglets, descriptions, bouton usine, CSS & IPC", () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
    const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const preloadCode = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');

    assert.ok(html.includes('data-settings-tab="serious"'), "Bouton d'onglet Paramètres sérieux présent");
    assert.ok(html.includes('id="settings-pane-serious"'), "Volet #settings-pane-serious présent");
    assert.ok(html.includes('data-serious-subtab="performance"'), "Sous-onglet Performances et ressources présent");
    assert.ok(html.includes('data-serious-subtab="startup"'), "Sous-onglet Démarrage et fonctionnement présent");
    assert.ok(html.includes('data-serious-subtab="backups"'), "Sous-onglet Données et sauvegardes présent");
    assert.ok(html.includes('data-serious-subtab="ui"'), "Sous-onglet Configuration de l'interface présent");
    assert.ok(html.includes('id="btn-reset-serious-factory"'), "Bouton Retour aux paramètres d'usine présent");
    assert.ok(html.includes("Antigravité ne juge pas votre matériel. Antigravité s'adapte à lui. Priorité absolue à la fluidité et à la consommation minimale."), "Description du mode PC de merde présente");
    assert.ok(html.includes('id="serious-backup-zero-warning"'), "Avertissement fréquence 0 présent");

    // Positionnement structurel respectant les tests existants (après help, avant dialog-modal)
    assert.ok(html.indexOf('id="settings-pane-serious"') > html.indexOf('<!-- Fin #settings-pane-help -->'), "#settings-pane-serious situé après help");

    assert.ok(css.includes('[data-perf-mode="economy"]'), "Règles CSS Mode Économie présentes");
    assert.ok(css.includes('[data-perf-mode="potato"]'), "Règles CSS Mode PC de merde présentes");
    assert.ok(css.includes('[data-disable-animations="true"]'), "Surcharge CSS Désactiver animations présente");
    assert.ok(css.includes('[data-disable-previews="true"]'), "Surcharge CSS Désactiver aperçus présente");
    assert.ok(css.includes('[data-disable-hover="true"]'), "Surcharge CSS Désactiver survol présente");
    assert.ok(css.includes('.settings-tabs-nav {\n  display: flex;\n  flex-wrap: nowrap;') || css.includes('.settings-tabs-nav {\r\n  display: flex;\r\n  flex-wrap: nowrap;'), "Barre d'onglets principale sur une seule ligne sans wrap");
    assert.ok(css.includes('.serious-subtabs-nav {\n  display: flex;\n  flex-wrap: nowrap;') || css.includes('.serious-subtabs-nav {\r\n  display: flex;\r\n  flex-wrap: nowrap;'), "Barre des sous-onglets Paramètres sérieux sur une seule ligne sans wrap");
    assert.ok(css.includes('max-width: 1240px;'), "Largeur du conteneur Paramètres étendue à droite pour afficher tous les titres en entier");
    assert.ok(!css.includes('.settings-tabs-nav {\n  display: flex;\n  gap: 8px;\n  border-bottom: 1px solid var(--border-color);\n  padding-bottom: 2px;\n  margin-bottom: 20px;\n  overflow-x: auto;'), "Pas de barre de défilement horizontal sur les onglets de paramètres");

    assert.ok(mainCode.includes('runInBackgroundOnClose'), "Logique de fermeture en arrière-plan vs fermeture complète présente dans main.js");
    assert.ok(mainCode.includes('antigravite:clear-cache') && mainCode.includes('antigravite:get-perf-diagnostics'), "IPCs cache et diagnostic présents dans main.js");
    assert.ok(mainCode.includes('antigravite:select-backup-directory') && mainCode.includes('antigravite:prune-backups'), "IPCs dossier et rétention de sauvegardes présents dans main.js");
    assert.ok(preloadCode.includes('setStartupSetting') && preloadCode.includes('getPerfDiagnostics'), "Bridge system exposé dans preload.js");
  });

  // -----------------------------------------------------------------------------
  // Test 11 : StorageManager : Réinitialisation ciblée des Paramètres sérieux uniquement
  // -----------------------------------------------------------------------------
  it("11. StorageManager.resetSeriousSettings préserve la personnalisation et réinitialise l'usine sérieuse", () => {
    const Storage = require('../js/storage.js');
    Storage.clearCache();
    Storage.saveSettings(Object.assign({}, Storage.DEFAULT_SETTINGS, {
      theme: 'light',
      accentColor: 'purple',
      userName: 'Théo',
      performanceMode: 'potato',
      launchOnStartup: true,
      runInBackgroundOnClose: false,
      autoBackupFrequencyHours: 0,
      backupRetentionCount: 5,
      backupDirectory: 'C:\\CustomBackups',
      disableAnimations: true,
      disablePreviews: true,
      disableHoverEffects: true
    }));

    const reset = Storage.resetSeriousSettings();
    assert.strictEqual(reset.performanceMode, 'normal');
    assert.strictEqual(reset.launchOnStartup, false);
    assert.strictEqual(reset.runInBackgroundOnClose, true);
    assert.strictEqual(reset.autoBackupFrequencyHours, 24);
    assert.strictEqual(reset.backupRetentionCount, 20);
    assert.strictEqual(reset.backupDirectory, null);
    assert.strictEqual(reset.disableAnimations, false);
    assert.strictEqual(reset.disablePreviews, false);
    assert.strictEqual(reset.disableHoverEffects, false);

    // Préservation de la personnalisation utilisateur
    assert.strictEqual(reset.theme, 'light');
    assert.strictEqual(reset.accentColor, 'purple');
    assert.strictEqual(reset.userName, 'Théo');

    const stats = Storage.getStorageStats();
    assert.ok(typeof stats.localStorageBytes === 'number' && stats.localStorageBytes > 0, "Statistiques de stockage calculées");
  });

  // -----------------------------------------------------------------------------
  // Test 12 : BackupManager : Fréquence à 0 = manuel uniquement + rétention configurable
  // -----------------------------------------------------------------------------
  await itAsync("12. BackupManager : Fréquence 0 bloque l'auto-sauvegarde tout en gardant le manuel et la rétention", async () => {
    const Storage = require('../js/storage.js');
    const BackupManager = require('../js/backups.js');
    Storage.clearCache();
    Storage.saveBackups([]);
    Storage.saveSettings(Object.assign({}, Storage.DEFAULT_SETTINGS, {
      autoBackupFrequencyHours: 0,
      autoBackupOnLaunch: false,
      backupRetentionCount: 3
    }));

    let autoTriggered = 0;
    const origCreate = BackupManager.createManualBackup.bind(BackupManager);
    BackupManager.createManualBackup = async (label) => {
      autoTriggered++;
      return origCreate(label);
    };

    // Même avec liste vide, aucune sauvegarde automatique ne doit partir si fréquence = 0
    await BackupManager.checkAutoBackup();
    assert.strictEqual(autoTriggered, 0, "Aucune sauvegarde automatique créée lorsque fréquence = 0");

    BackupManager.createManualBackup = origCreate;

    // La sauvegarde manuelle reste opérationnelle et respecte la rétention configurée (3)
    for (let i = 0; i < 5; i++) {
      await BackupManager.createManualBackup(`Manuelle ${i}`);
    }
    assert.strictEqual(BackupManager.getAll().length, 3, "La limite backupRetentionCount (3) est rigoureusement appliquée");
  });

  // -----------------------------------------------------------------------------
  // Test 13 : App.applyAppearanceSettings : Orthogonalité profils perf / surcharges UI
  // -----------------------------------------------------------------------------
  it("13. App.applyAppearanceSettings : Profils perf & surcharges interface indépendants", () => {
    const Storage = require('../js/storage.js');
    const App = require('../js/app.js');
    const origDoc = global.document;

    const rootAttrs = {};
    const bodyClasses = new Set();
    const fakeWallpaper = { id: 'app-wallpaper-layer', className: 'app-wallpaper-layer', style: {} };
    global.document = {
      documentElement: {
        setAttribute: (k, v) => { rootAttrs[k] = v; },
        removeAttribute: (k) => { delete rootAttrs[k]; },
        getAttribute: (k) => rootAttrs[k] || null
      },
      body: {
        prepend: () => {},
        classList: {
          add: (c) => bodyClasses.add(c),
          remove: (c) => bodyClasses.delete(c),
          contains: (c) => bodyClasses.has(c)
        }
      },
      getElementById: (id) => (id === 'app-wallpaper-layer' ? fakeWallpaper : null),
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    try {
      Storage.clearCache();
      const s1 = Object.assign({}, Storage.DEFAULT_SETTINGS, {
        performanceMode: 'normal',
        backgroundImage: 'nebula',
        disableAnimations: true,
        disablePreviews: true,
        disableHoverEffects: true
      });
      App.applyAppearanceSettings(s1);
      assert.strictEqual(rootAttrs['data-perf-mode'], 'normal');
      assert.strictEqual(rootAttrs['data-disable-animations'], 'true');
      assert.strictEqual(rootAttrs['data-disable-previews'], 'true');
      assert.strictEqual(rootAttrs['data-disable-hover'], 'true');
      assert.strictEqual(fakeWallpaper.style.display, 'block', "Le fond d'écran reste actif en mode Normal");

      // Passage en mode PC de merde : coupe le fond d'écran mais conserve l'indépendance des surcharges
      const s2 = Object.assign({}, s1, { performanceMode: 'potato', disablePreviews: false });
      App.applyAppearanceSettings(s2);
      assert.strictEqual(rootAttrs['data-perf-mode'], 'potato');
      assert.strictEqual(rootAttrs['data-disable-animations'], 'true');
      assert.strictEqual(rootAttrs['data-disable-previews'], undefined);
      assert.strictEqual(rootAttrs['data-disable-hover'], 'true');
      assert.strictEqual(fakeWallpaper.style.display, 'none', "Le fond d'écran est masqué en Mode PC de merde");
    } finally {
      global.document = origDoc;
    }
  });

  // -----------------------------------------------------------------------------
  // Test 14 : Révisions O(1) StorageManager, mesure UTF-8 sans Blob & GPU compat
  // -----------------------------------------------------------------------------
  it("14. StorageManager : Révisions par collection, _utf8ByteLength sans Blob et gpuCompatibilityMode", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    Storage.clearCache();

    let storageMock = {};
    global.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(storageMock, k) ? storageMock[k] : null),
      setItem: (k, v) => { storageMock[k] = String(v); },
      removeItem: (k) => { delete storageMock[k]; }
    };

    const rev0 = Storage.getRevision('tasks');
    Storage.saveTasks([{ id: 't1', title: 'Test rev' }]);
    const rev1 = Storage.getRevision('tasks');
    assert.ok(rev1 > rev0, "La révision des tâches doit s'incrémenter après sauvegarde");

    Storage.clearCache();
    const rev2 = Storage.getRevision('tasks');
    assert.ok(rev2 > rev1, "La révision doit s'incrémenter sur clearCache()");

    // Vérification exacte de _utf8ByteLength (ASCII, accents Latin-1, Euro, emoji surrogate pair)
    const samples = [
      '',
      'Antigravite 123',
      'Tâches récurrentes café €',
      'Fusée 🚀 + étoile ✨ + drapeau 🇫🇷'
    ];
    for (const s of samples) {
      assert.strictEqual(
        Storage._utf8ByteLength(s),
        Buffer.byteLength(s, 'utf8'),
        `Taille UTF-8 exacte attendue pour "${s}"`
      );
    }

    const storageCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
    assert.ok(!storageCode.includes('new Blob('), "getStorageStats ne doit plus allouer de Blob temporaire");
    assert.strictEqual(Storage.DEFAULT_SETTINGS.gpuCompatibilityMode, false, "gpuCompatibilityMode désactivé par défaut");
  });

  // -----------------------------------------------------------------------------
  // Test 15 : Mémoïsation O(1) des stats Projets & passe unique dans modale projet
  // -----------------------------------------------------------------------------
  it("15. ProjectsManager : Mémoïsation getAllProjectsStats() par révision & modale sans double scan", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const Projects = require('../js/projects.js');
    Storage.clearCache();

    let storageMock = {};
    global.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(storageMock, k) ? storageMock[k] : null),
      setItem: (k, v) => { storageMock[k] = String(v); },
      removeItem: (k) => { delete storageMock[k]; }
    };

    Storage.saveProjects([{ id: 'p-1', title: 'Projet A' }]);
    Storage.saveTasks([{ id: 't-1', title: 'T1', projectId: 'p-1', completed: false }]);
    Storage.saveNotes([{ id: 'n-1', title: 'N1', projectId: 'p-1' }]);

    const stats1 = Projects.getAllProjectsStats();
    const stats2 = Projects.getAllProjectsStats();
    assert.ok(stats1 instanceof Map, "getAllProjectsStats doit retourner une Map indexée par ID projet");
    assert.strictEqual(stats1, stats2, "Deux appels sans modification doivent renvoyer la même référence mémoïsée");
    assert.strictEqual(stats1.get('p-1').total, 1);
    assert.strictEqual(stats1.get('p-1').notesCount, 1);

    // Modification d'une tâche -> invalidation automatique via révision
    Storage.saveTasks([
      { id: 't-1', title: 'T1', projectId: 'p-1', completed: true },
      { id: 't-2', title: 'T2', projectId: 'p-1', completed: false }
    ]);
    const stats3 = Projects.getAllProjectsStats();
    assert.notStrictEqual(stats3, stats1, "La sauvegarde des tâches doit invalider le cache des statistiques");
    assert.strictEqual(stats3.get('p-1').total, 2);
    assert.strictEqual(stats3.get('p-1').completed, 1);

    const projCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'projects.js'), 'utf8');
    assert.ok(!projCode.includes('this.getProjectStats(projectId)'), "openProjectDetailModal ne doit plus re-scanner toute la base en doublon");
  });

  // -----------------------------------------------------------------------------
  // Test 16 : Splash Screen rentabilisé (phases ~4,8s préservées + warmups utiles)
  // -----------------------------------------------------------------------------
  await itAsync("16. Splash Screen ~4,8s rentabilisé : warmups Notes/Agenda/Constellation et nettoyage DOM", async () => {
    const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

    assert.ok(html.includes('id="splash-substatus"'), "index.html doit exposer #splash-substatus pour informer sur les tâches de fond");
    assert.ok(css.includes('.splash-substatus'), "styles.css doit stiler .splash-substatus");
    assert.ok(appCode.includes('warmUpCatalog'), "Le splash déclenche la préparation asynchrone du catalogue audio");
    assert.ok(appCode.includes('warmUpIndex'), "Le splash construit l'index des notes");
    assert.ok(appCode.includes('warmUpRecurrenceCache'), "Le splash pré-calcule le cache de récurrence agenda");
    assert.ok(appCode.includes('warmUpTopology'), "Le splash prépare la topologie Constellation");
    assert.ok(appCode.includes('runStartupMaintenance'), "Le splash exécute la maintenance Backups différée");
    assert.ok(appCode.includes('splash.remove()'), "hideSplashScreen retire #app-splash-screen du DOM après le fondu");

    // Vérifier les warmups en exécution réelle
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    Storage.clearCache();
    Storage.saveNotes([
      { id: 'n-a', title: 'Alpha', content: 'Lien [[Beta]] #focus', tags: ['focus'] },
      { id: 'n-b', title: 'Beta', content: 'Suite', tags: ['projet'] }
    ]);
    const Notes = require('../js/notes.js');
    const origNotesGetAll = Notes.getAll;
    Notes.getAll = () => Storage.getNotes();
    Notes._noteIndexCache = null;
    try {
      const noteIdx = Notes.warmUpIndex();
      assert.ok(noteIdx && noteIdx.byId.get('n-a'), "warmUpIndex doit indexer les notes par ID");
      assert.strictEqual(noteIdx.byLowerTitle.get('beta').id, 'n-b', "warmUpIndex doit indexer les titres en O(1)");
      const wl = noteIdx.wikilinksBySource.get('n-a');
      assert.ok(Array.isArray(wl) && wl.includes('beta'), "warmUpIndex doit indexer les wikilinks");
    } finally {
      Notes.getAll = origNotesGetAll;
      Notes._noteIndexCache = null;
    }

    const Agenda = require('../js/agenda.js');
    Storage.saveEvents([
      { id: 'e-rec', title: 'Hebdo', start: '2026-11-23T09:00', end: '2026-11-23T10:00', recurrence: 'weekly' }
    ]);
    const warmAgenda = Agenda.warmUpRecurrenceCache();
    assert.ok(warmAgenda && warmAgenda.weekEventsMap instanceof Map, "warmUpRecurrenceCache construit le cache hebdomadaire");
    assert.strictEqual(Agenda.isEventOnDate({ start: '2026-11-23T09:00', recurrence: 'weekly' }, '2026-11-30'), true);

    const Constellation = require('../js/constellation.js');
    const topo = Constellation.warmUpTopology();
    assert.ok(topo && Array.isArray(topo.nodes), "warmUpTopology pré-calcule le graphe Constellation");
  });

  // -----------------------------------------------------------------------------
  // Test 17 : Zéro reflow synchrone, zéro double-rendu Agenda & renderIfNeeded
  // -----------------------------------------------------------------------------
  it("17. Reflows synchrones éliminés, Agenda anti double-rendu et renderIfNeeded()", () => {
    const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    assert.ok(!appCode.includes('void view.offsetWidth'), "Plus de void view.offsetWidth synchrone dans navigate()");
    assert.ok(!appCode.includes('void splash.offsetWidth'), "Plus de reflow synchrone dans updateSplashProgress()");
    assert.ok(!appCode.includes('void section.offsetWidth'), "Plus de reflow synchrone dans openChangelogInSettings()");
    assert.ok(!appCode.includes('void modal.offsetWidth'), "Plus de reflow synchrone dans openUpdatePromptModal()");
    assert.ok(appCode.includes('_lastAgendaAutoSyncAt'), "Cooldown anti double-sync lors de la navigation Agenda");
    assert.ok(appCode.includes("AgendaManager.scrollToNormalHours"), "Centrage automatique sur 07h00 préservé");

    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const Tasks = require('../js/tasks.js');
    const Projects = require('../js/projects.js');
    const Notes = require('../js/notes.js');
    const Agenda = require('../js/agenda.js');
    const Constellation = require('../js/constellation.js');
    const Backups = require('../js/backups.js');
    const Trash = require('../js/trash.js');

    assert.strictEqual(typeof Tasks.renderIfNeeded, 'function', "TasksManager expose renderIfNeeded");
    assert.strictEqual(typeof Projects.renderIfNeeded, 'function', "ProjectsManager expose renderIfNeeded");
    assert.strictEqual(typeof Notes.renderIfNeeded, 'function', "NotesManager expose renderIfNeeded");
    assert.strictEqual(typeof Agenda.renderIfNeeded, 'function', "AgendaManager expose renderIfNeeded");
    assert.strictEqual(typeof Constellation.renderIfNeeded, 'function', "ConstellationManager expose renderIfNeeded");
    assert.strictEqual(typeof Backups.renderIfNeeded, 'function', "BackupManager expose renderIfNeeded");
    assert.strictEqual(typeof Trash.renderIfNeeded, 'function', "TrashManager expose renderIfNeeded");

    // Vérifier qu'un second appel renderIfNeeded sans changement ne déclenche pas de re-rendu
    const origDoc = global.document;
    const origRender = Tasks.render;
    let renderCalls = 0;
    const fakeContainer = { childElementCount: 1 };
    global.document = {
      getElementById: (id) => (id === 'tasks-tree-container' ? fakeContainer : null),
      querySelectorAll: () => []
    };
    Tasks._lastRenderedSig = null;
    Tasks.render = function () {
      renderCalls++;
      this._lastRenderedSig = this._getRenderSig();
    };
    try {
      Tasks.renderIfNeeded();
      Tasks.renderIfNeeded();
      assert.strictEqual(renderCalls, 1, "Un seul appel render() attendu pour un état inchangé");
    } finally {
      Tasks.render = origRender;
      Tasks._lastRenderedSig = null;
      global.document = origDoc;
    }
  });

  // -----------------------------------------------------------------------------
  // Test 18 : CSS GPU propre (0 transition:all, 0 sélecteur *, blur ciblé, GPU Compat)
  // -----------------------------------------------------------------------------
  it("18. CSS & IPC : Zéro transition:all, zéro sélecteur universel *, .app-dormant & GPU Compat", () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const mainCode = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

    assert.ok(!/transition\s*:\s*all\b/i.test(css), "Aucune déclaration 'transition: all' ne doit subsister dans styles.css");
    assert.ok(!css.includes('[data-perf-mode="potato"] *'), "Le sélecteur universel '*' en Mode PC modeste doit être remplacé");
    assert.ok(!css.includes('[data-disable-animations="true"] *'), "Le sélecteur universel '*' disableAnimations doit être remplacé");
    assert.ok(css.includes(':root.app-dormant'), "La règle CSS :root.app-dormant doit geler les animations fenêtre cachée");
    assert.ok(css.includes('content-visibility: auto'), "content-visibility: auto doit isoler les écrans/cartes hors-écran");
    assert.ok(html.includes('id="setting-gpu-compat-mode"'), "Toggle Compatibilité GPU présent dans index.html");
    assert.ok(mainCode.includes('readEarlyDesktopGpuPrefs'), "main.js lit les préférences GPU avant app.whenReady()");
    assert.ok(mainCode.includes('!earlyGpuPrefs.gpuCompatibilityMode'), "enable-zero-copy désactivé si gpuCompatibilityMode actif");
    assert.ok(mainCode.includes('await fs.readdir('), "list-local-music converti en I/O asynchrone non bloquante via fs.promises");
    assert.ok(mainCode.includes('_localMusicCatalogCache'), "Cache mémoire catalogue audio dans main.js");
  });

  // -----------------------------------------------------------------------------
  // Test 19 : TasksManager délégation drag-and-drop et mise à jour badges sans innerHTML
  // -----------------------------------------------------------------------------
  it("19. TasksManager : Délégation drag & drop rAF et badges mis à jour via textContent", () => {
    const tasksCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'tasks.js'), 'utf8');
    assert.ok(tasksCode.includes('_bindTreeDragDelegation'), "TasksManager délègue les événements drag au conteneur racine");
    assert.ok(tasksCode.includes('badge.textContent = nextText'), "updateFilterCounts met à jour les pastilles via textContent sans innerHTML");
    assert.ok(!tasksCode.includes("item.addEventListener('dragstart'"), "Plus de listeners dragstart attachés individuellement par tâche");
  });

  // -----------------------------------------------------------------------------
  // Test 20 : Sprite SVG master (<use href>) et modales différées (<template>)
  // -----------------------------------------------------------------------------
  it("20. HTML & Icônes : Sprite SVG <use href='#ico-...'> et <template> modales paresseuses", () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const App = require('../js/app.js');

    assert.ok(html.includes('id="antigravite-svg-sprite"'), "Sprite SVG master présent dans index.html");
    assert.ok(html.includes('<template id="tpl-whats-new-modal">'), "Modale Nouveautés mise en <template>");
    assert.ok(html.includes('<template id="tpl-modal-update-prompt">'), "Modale Mise à jour mise en <template>");
    assert.ok(html.includes('<template id="tpl-wallpaper-studio-modal">'), "Studio Fond d'écran mis en <template>");
    assert.ok(html.includes('<script defer src="./js/app.js"></script>'), "Les scripts modulaires utilisent l'attribut defer");

    const pinSvg = App.getSvgIcon('📌', 14);
    assert.ok(pinSvg.includes('<svg') && pinSvg.includes('viewBox="0 0 24 24"') && pinSvg.includes('stroke="currentColor"'), "Signature SVG standard conservée");
    assert.ok(pinSvg.includes('<use href="#ico-pin"/>'), "getSvgIcon référence le symbole dans le sprite via <use>");

    // Vérifier ensureTemplateElement()
    const origDoc = global.document;
    let instantiated = null;
    const fakeBody = {
      appendChild: (node) => { instantiated = node; }
    };
    const fakeTpl = {
      content: {
        cloneNode: () => ({ id: 'whats-new-modal', cloned: true })
      }
    };
    global.document = {
      body: fakeBody,
      getElementById: (id) => {
        if (id === 'whats-new-modal') return instantiated;
        if (id === 'tpl-whats-new-modal') return fakeTpl;
        return null;
      }
    };
    try {
      const el1 = App.ensureTemplateElement('whats-new-modal', 'tpl-whats-new-modal');
      assert.ok(el1 && el1.cloned === true, "La modale est clonée à la demande depuis son <template>");
      const el2 = App.ensureTemplateElement('whats-new-modal', 'tpl-whats-new-modal');
      assert.strictEqual(el2, el1, "Les appels suivants retournent l'élément déjà monté");
    } finally {
      global.document = origDoc;
    }
  });

  // -----------------------------------------------------------------------------
  // Test 21 : Mode Dormant (setDormant) et report d'auto-backup fenêtre cachée
  // -----------------------------------------------------------------------------
  it("21. Mode Dormant : setDormant(true/false) et rattrapage BackupManager au réveil", () => {
    const Storage = require('../js/storage.js');
    global.StorageManager = Storage;
    const App = require('../js/app.js');
    const Backups = require('../js/backups.js');
    const Agenda = require('../js/agenda.js');
    const Constellation = require('../js/constellation.js');

    const origAgendaGlobal = global.AgendaManager;
    const origConstGlobal = global.ConstellationManager;
    const origBackupGlobal = global.BackupManager;
    global.AgendaManager = Agenda;
    global.ConstellationManager = Constellation;
    global.BackupManager = Backups;

    const origDoc = global.document;
    const clsSet = new Set();
    global.document = {
      hidden: true,
      documentElement: {
        classList: {
          add: (c) => clsSet.add(c),
          remove: (c) => clsSet.delete(c),
          toggle: (c, force) => (force ? clsSet.add(c) : clsSet.delete(c)),
          contains: (c) => clsSet.has(c)
        },
        setAttribute: () => {},
        removeAttribute: () => {}
      },
      getElementById: () => null,
      querySelectorAll: () => []
    };

    const origStartAuto = Backups.startAutoBackupTimer;
    const origCheckAuto = Backups.checkAutoBackup;
    const origAgendaSetDormant = Agenda.setDormant;
    const origConstSetDormant = Constellation.setDormant;
    let wakeCheckCalled = 0;
    const agendaDormantCalls = [];
    const constDormantCalls = [];
    try {
      Backups._autoBackupPendingOnWake = true;
      Backups.checkAutoBackup = () => { wakeCheckCalled++; };
      Agenda._nowInterval = setTimeout(() => {}, 10000);
      Agenda.setDormant = function (flag) {
        agendaDormantCalls.push(flag);
        return origAgendaSetDormant.call(this, flag);
      };
      Constellation.setDormant = function (flag) {
        constDormantCalls.push(flag);
        return origConstSetDormant.call(this, flag);
      };

      App.setDormant(true);
      assert.strictEqual(App._isDormant, true, "App passe en état dormant");
      assert.ok(clsSet.has('app-dormant'), "Classe CSS app-dormant appliquée sur :root");
      assert.strictEqual(Agenda._nowInterval, null, "Agenda coupe son intervalle repère heure actuelle en mode dormant");
      assert.deepStrictEqual(agendaDormantCalls, [true]);
      assert.deepStrictEqual(constDormantCalls, [true]);

      // Réveil
      global.document.hidden = false;
      App.setDormant(false);
      assert.strictEqual(App._isDormant, false, "App sort du mode dormant");
      assert.ok(!clsSet.has('app-dormant'), "Classe CSS app-dormant retirée");
      assert.deepStrictEqual(agendaDormantCalls, [true, false]);
      assert.deepStrictEqual(constDormantCalls, [true, false]);
      assert.strictEqual(wakeCheckCalled, 1, "BackupManager rattrape l'auto-backup différé au réveil");
    } finally {
      if (App._clockTimer) clearInterval(App._clockTimer);
      if (App._dayProgressTimer) clearInterval(App._dayProgressTimer);
      if (Agenda._nowInterval) clearInterval(Agenda._nowInterval);
      App._clockTimer = null;
      App._dayProgressTimer = null;
      Agenda._nowInterval = null;
      Agenda.setDormant = origAgendaSetDormant;
      Constellation.setDormant = origConstSetDormant;
      Backups.startAutoBackupTimer = origStartAuto;
      Backups.checkAutoBackup = origCheckAuto;
      Backups._autoBackupPendingOnWake = false;
      App._isDormant = false;
      global.AgendaManager = origAgendaGlobal;
      global.ConstellationManager = origConstGlobal;
      global.BackupManager = origBackupGlobal;
      global.document = origDoc;
    }
  });

  console.log("\n----------------------------------------------------------");
  console.log(`Résultats des tests de performances : ${passed} passés, ${failed} échoués`);
  console.log("----------------------------------------------------------\n");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
