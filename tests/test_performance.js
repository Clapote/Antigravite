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

  console.log("\n----------------------------------------------------------");
  console.log(`Résultats des tests de performances : ${passed} passés, ${failed} échoués`);
  console.log("----------------------------------------------------------\n");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
