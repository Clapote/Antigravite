/**
 * Antigravité - Tests automatisés pour les correctifs prioritaires de l'audit :
 * 1. Intégration du packaging Windows (services/ dans build.files et app.asar)
 * 2. Allègement du localStorage pour les sauvegardes et prévention QuotaExceededError
 * 3. Lecture des sauvegardes physiques sur disque et rétrocompatibilité totale
 */

const assert = require('assert');
const path = require('node:path');
const fs = require('node:fs');

console.log("==========================================================");
console.log("   Antigravité - Tests des correctifs prioritaires");
console.log("   (Packaging Windows & Stockage des Sauvegardes)");
console.log("==========================================================");

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc} : ${err.stack || err.message}`);
    failed++;
  }
}

(async () => {
  const Storage = require('../js/storage.js');
  const BackupMgr = require('../js/backups.js');
  global.StorageManager = Storage;

  // ===========================================================================
  // SECTION 1 : VÉRIFICATION DU PACKAGING WINDOWS
  // ===========================================================================

  await it("1. package.json inclut bien 'services/**/*' dans 'build.files'", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(pkg.build, "Section build présente");
    assert.ok(Array.isArray(pkg.build.files), "build.files est un tableau");
    assert.ok(pkg.build.files.includes('services/**/*'), "services/**/* doit figurer dans build.files");
    assert.ok(pkg.build.files.includes('main.js'));
    assert.ok(pkg.build.files.includes('preload.js'));
    assert.ok(pkg.build.files.includes('index.html'));
    assert.ok(pkg.build.files.includes('js/**/*'));
    assert.ok(pkg.build.files.includes('css/**/*'));
    assert.ok(pkg.build.files.includes('data/**/*'));
  });

  await it("2. Les services Google requis par main.js existent et sont syntaxiquement valides", () => {
    const authServicePath = path.join(__dirname, '../services/google-auth-service.js');
    const calServicePath = path.join(__dirname, '../services/google-calendar-service.js');
    assert.ok(fs.existsSync(authServicePath), "google-auth-service.js existe");
    assert.ok(fs.existsSync(calServicePath), "google-calendar-service.js existe");

    const authModule = require('../services/google-auth-service.js');
    const calModule = require('../services/google-calendar-service.js');
    assert.strictEqual(typeof authModule.getStatus, 'function');
    assert.strictEqual(typeof calModule.fetchEvents, 'function');
  });

  await it("3. Le paquet compilé app.asar contient les services Google", () => {
    const asarPath = path.join(__dirname, '../dist/win-unpacked/resources/app.asar');
    if (!fs.existsSync(asarPath)) {
      console.warn("       (app.asar absent, test ignoré si environnement CI sans build)");
      return;
    }
    const asar = require('../node_modules/@electron/asar');
    const files = asar.listPackage(asarPath);
    const hasAuth = files.some(f => f.replace(/\\/g, '/').includes('services/google-auth-service.js'));
    const hasCal = files.some(f => f.replace(/\\/g, '/').includes('services/google-calendar-service.js'));
    assert.ok(hasAuth, "services/google-auth-service.js doit être dans app.asar");
    assert.ok(hasCal, "services/google-calendar-service.js doit être dans app.asar");
  });

  // ===========================================================================
  // SECTION 2 : ALLÈGEMENT DU LOCALSTORAGE ET GESTION DES SAUVEGARDES
  // ===========================================================================

  await it("4. Création de sauvegarde avec moteur physique : payload omis dans localStorage", async () => {
    let localBackupsStore = [];
    let savedToDisk = null;

    const origGetExport = Storage.getFullExport;
    const origGetBackups = Storage.getBackups;
    const origSaveBackups = Storage.saveBackups;

    Storage.getFullExport = () => ({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: [{ id: "t-1", title: "Test" }],
      projects: [],
      events: [],
      notes: [],
      settings: {}
    });

    Storage.getBackups = () => localBackupsStore;
    Storage.saveBackups = (b) => { localBackupsStore = b; };

    global.window = {
      StorageManager: Storage,
      AntigraviteAPI: {
        saveBackup: async (fullData) => {
          savedToDisk = fullData;
          return { filename: 'test_auto.json', path: 'C:\\fake\\userData\\backups\\test_auto.json' };
        }
      },
      App: { showToast: () => {} }
    };

    try {
      const record = await BackupMgr.createManualBackup("Test allègement");
      assert.strictEqual(record.hasPhysicalBackup, true, "Doit être marqué comme sauvegardé physiquement");
      assert.strictEqual(record.payload, null, "Le payload ne doit pas encombrer le localStorage");
      assert.ok(record.diskPath, "Le chemin disque doit être enregistré");
      assert.ok(savedToDisk, "Les données doivent avoir été transmises pour sauvegarde sur disque");
      assert.strictEqual(savedToDisk.tasks.length, 1);
    } finally {
      Storage.getFullExport = origGetExport;
      Storage.getBackups = origGetBackups;
      Storage.saveBackups = origSaveBackups;
    }
  });

  await it("5. Création de sauvegarde en mode secours (sans moteur physique) : payload préservé", async () => {
    let localBackupsStore = [];

    const origGetExport = Storage.getFullExport;
    const origGetBackups = Storage.getBackups;
    const origSaveBackups = Storage.saveBackups;

    Storage.getFullExport = () => ({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: [{ id: "t-2", title: "Test Sans Disque" }],
      projects: [],
      events: [],
      notes: [],
      settings: {}
    });

    Storage.getBackups = () => localBackupsStore;
    Storage.saveBackups = (b) => { localBackupsStore = b; };

    global.window = {
      StorageManager: Storage,
      AntigraviteAPI: null,
      App: { showToast: () => {} }
    };

    try {
      const record = await BackupMgr.createManualBackup("Test Fallback");
      assert.strictEqual(record.hasPhysicalBackup, false);
      assert.ok(record.payload, "En l'absence de disque, le payload DOIT être conservé en localStorage");
      assert.strictEqual(record.payload.tasks[0].title, "Test Sans Disque");
    } finally {
      Storage.getFullExport = origGetExport;
      Storage.getBackups = origGetBackups;
      Storage.saveBackups = origSaveBackups;
    }
  });

  await it("6. getBackupPayload lit le payload en mémoire ou sur disque selon disponibilité", async () => {
    // Cas A : Payload déjà en mémoire
    const memoryRecord = {
      id: 'b-mem',
      filename: 'mem.json',
      payload: { version: '1.0', fromMemory: true }
    };
    const payloadA = await BackupMgr.getBackupPayload(memoryRecord);
    assert.strictEqual(payloadA.fromMemory, true);

    // Cas B : Payload sur disque (payload en mémoire est null)
    let readTargetRequested = null;
    global.window = {
      StorageManager: Storage,
      AntigraviteAPI: {
        readBackup: async (target) => {
          readTargetRequested = target;
          return { version: '1.0', fromDisk: true };
        }
      }
    };

    const diskRecord = {
      id: 'b-disk',
      filename: 'disk_backup.json',
      diskPath: 'C:\\fake\\userData\\backups\\disk_backup.json',
      payload: null
    };

    const payloadB = await BackupMgr.getBackupPayload(diskRecord);
    assert.strictEqual(readTargetRequested, 'C:\\fake\\userData\\backups\\disk_backup.json');
    assert.strictEqual(payloadB.fromDisk, true);
  });

  await it("7. Restauration d'un instantané allégé (lecture disque transparente)", async () => {
    let restoredData = null;
    const origRestore = Storage.restoreFullExport;
    const origGetBackups = Storage.getBackups;

    Storage.restoreFullExport = (data) => {
      restoredData = data;
      return true;
    };

    const diskBackup = {
      id: 'b-restore-test',
      filename: 'antigravite_backup_restore.json',
      createdAt: new Date().toISOString(),
      diskPath: 'C:\\backups\\antigravite_backup_restore.json',
      payload: null
    };

    Storage.getBackups = () => [diskBackup];

    global.window = {
      StorageManager: Storage,
      confirm: () => true,
      AntigraviteAPI: {
        readBackup: async () => ({
          version: "1.0",
          tasks: [{ id: "t-restored", title: "Tâche restaurée" }]
        })
      },
      App: { updateDashboard: () => {}, showToast: () => {} }
    };

    try {
      await BackupMgr.restoreBackup('b-restore-test');
      assert.ok(restoredData, "Les données doivent avoir été restaurées");
      assert.strictEqual(restoredData.tasks[0].id, "t-restored");
    } finally {
      Storage.restoreFullExport = origRestore;
      Storage.getBackups = origGetBackups;
    }
  });

  await it("8. Migration douce des anciennes sauvegardes : libération du payload sans perte", async () => {
    let store = [
      {
        id: 'legacy-1',
        filename: 'backup_1.json',
        diskPath: 'C:\\backups\\backup_1.json',
        hasPhysicalBackup: true,
        payload: { bigData: "1000 items" }
      },
      {
        id: 'offline-2',
        filename: 'backup_2.json',
        diskPath: null,
        hasPhysicalBackup: false,
        payload: { keepMe: "do not delete" }
      }
    ];

    const origGetBackups = Storage.getBackups;
    const origSaveBackups = Storage.saveBackups;

    Storage.getBackups = () => store;
    Storage.saveBackups = (b) => { store = b; };

    global.window = {
      StorageManager: Storage,
      AntigraviteAPI: {
        listBackups: async () => [{ filename: 'backup_1.json' }]
      }
    };

    try {
      await BackupMgr.migrateLegacyBackups();
      assert.strictEqual(store[0].payload, undefined, "Le payload de la sauvegarde certifiée sur disque doit être purgé");
      assert.strictEqual(store[0].hasPhysicalBackup, true);
      assert.ok(store[1].payload, "La sauvegarde sans fichier physique DOIT conserver son payload");
      assert.strictEqual(store[1].payload.keepMe, "do not delete");
    } finally {
      Storage.getBackups = origGetBackups;
      Storage.saveBackups = origSaveBackups;
    }
  });

  await it("9. StorageManager.saveBackups gère proactivement QuotaExceededError", () => {
    let storageSetCallCount = 0;
    let savedString = null;

    global.localStorage = {
      setItem: (_key, val) => {
        storageSetCallCount++;
        if (storageSetCallCount === 1) {
          const quotaErr = new Error("Quota exceeded");
          quotaErr.name = "QuotaExceededError";
          throw quotaErr;
        }
        savedString = val;
      }
    };

    const backupsToSave = [
      { id: 'b1', filename: 'b1.json', diskPath: 'C:\\b1.json', payload: { data: 'heavy' } },
      { id: 'b2', filename: 'b2.json', diskPath: null, payload: { data: 'light' } }
    ];

    try {
      Storage.saveBackups(backupsToSave);
      assert.strictEqual(storageSetCallCount, 2, "Doit avoir réessayé après allègement des payloads");
      const parsedSaved = JSON.parse(savedString);
      assert.strictEqual(parsedSaved[0].payload, undefined, "b1 avec diskPath doit avoir son payload retiré");
      assert.ok(parsedSaved[1].payload, "b2 sans diskPath conserve son payload");
    } finally {
      delete global.localStorage;
    }
  });

  // Nettoyage global
  delete global.window;
  delete global.StorageManager;

  console.log("\n----------------------------------------------------------");
  console.log(`Résultats des tests des correctifs : ${passed} passés, ${failed} échoués`);
  console.log("----------------------------------------------------------\n");

  if (failed > 0) process.exit(1);
  else process.exit(0);

})();
