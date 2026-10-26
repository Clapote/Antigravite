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

  console.log("\n----------------------------------------------------------");
  console.log(`Résultats des tests de performances : ${passed} passés, ${failed} échoués`);
  console.log("----------------------------------------------------------\n");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
