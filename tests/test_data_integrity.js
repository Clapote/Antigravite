/**
 * Antigravité - Tests automatisés : Intégrité des données & Corrections critiques
 * 
 * Couvre :
 * 1. Sauvegarde automatique initiale & quotidienne (autoBackupOnLaunch)
 * 2. Gestion de l'échec de sauvegarde physique (avertissement explicite et préservation locale)
 * 3. Préservation des horaires et de la durée des événements liés lors de la modification de tâche
 * 4. Préservation de l'horaire personnalisé lors du changement de date de tâche (pas de 09:00 forcé)
 * 5. Synchronisation de la date de tâche lors du déplacement d'un créneau dans l'agenda
 * 6. Suppression propre de tâche : nettoyage des références orphelines sans supprimer les événements
 * 7. Suppression d'événement sans suppression de la tâche liée
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests Intégrité Données & Synchronisation");
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

// -----------------------------------------------------------------------------
// Environnement Mock Isolé
// -----------------------------------------------------------------------------

// Mock localStorage
const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => {
    for (const k in localStorageStore) delete localStorageStore[k];
  }
};

// Mock document basique
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } })
};

// Mock window et Toast notifications
const toastLogs = [];
global.window = {
  confirm: () => true,
  alert: () => {},
  App: {
    showToast: (msg, type) => {
      toastLogs.push({ msg, type });
    },
    updateDashboard: () => {}
  },
  AntigraviteAPI: null
};

// Charger les modules
const StorageManager = require('../js/storage.js');
global.StorageManager = StorageManager;
const BackupManager = require('../js/backups.js');
global.BackupManager = BackupManager;
const TasksManager = require('../js/tasks.js');
global.TasksManager = TasksManager;
const AgendaManager = require('../js/agenda.js');
global.AgendaManager = AgendaManager;

function resetStorage() {
  localStorage.clear();
  StorageManager.clearCache();
}

(async () => {
  // ---------------------------------------------------------------------------
  // SUITE 1 : Sauvegardes
  // ---------------------------------------------------------------------------

  await it("1.1 Déclenchement de la première sauvegarde physique quand aucun fichier n'existe sur le disque", async () => {
    resetStorage();
    toastLogs.length = 0;

    // Métadonnées locales présentes, mais AUCUN fichier sur le disque
    StorageManager.saveBackups([{ id: 'local-old', label: 'Ancienne', createdAt: '2026-01-01T00:00:00.000Z' }]);

    let saveBackupCalled = false;
    let savedBackupLabel = null;

    window.AntigraviteAPI = {
      listBackups: async () => [], // Disque vide !
      saveBackup: async (data) => {
        saveBackupCalled = true;
        return { filename: 'antigravite_backup_test.json', path: 'C:/fake/antigravite_backup_test.json' };
      }
    };

    // Remplacer temporairement createManualBackup pour vérifier l'argument label
    const origCreateManual = BackupManager.createManualBackup;
    BackupManager.createManualBackup = async function(label) {
      savedBackupLabel = label;
      return origCreateManual.call(this, label);
    };

    try {
      await BackupManager.checkAutoBackup();
      assert.strictEqual(saveBackupCalled, true, "La sauvegarde sur disque doit être appelée car le disque est vide");
      assert.strictEqual(savedBackupLabel, "Sauvegarde initiale automatique", "Le label doit être 'Sauvegarde initiale automatique'");
    } finally {
      BackupManager.createManualBackup = origCreateManual;
    }
  });

  await it("1.2 Échec d'écriture physique : avertissement explicite, pas de faux succès, et préservation locale", async () => {
    resetStorage();
    toastLogs.length = 0;

    // Simulation d'une défaillance d'écriture disque
    window.AntigraviteAPI = {
      saveBackup: async () => {
        throw new Error("EPERM: Operation not permitted");
      }
    };

    const record = await BackupManager.createManualBackup("Test échec physique");

    // 1. La sauvegarde ne doit PAS être marquée comme physique
    assert.strictEqual(record.hasPhysicalBackup, false, "hasPhysicalBackup doit être false");
    // 2. Le payload complet doit être préservé en mémoire locale pour éviter toute perte
    assert.notStrictEqual(record.payload, null, "Le payload doit être conservé dans l'enregistrement de secours");
    assert.strictEqual(Array.isArray(record.payload.tasks), true, "Le payload de secours contient les tâches");
    // 3. Aucun toast 'success' ne doit être émis
    const successToast = toastLogs.find(t => t.type === 'success');
    assert.strictEqual(successToast, undefined, "Aucun toast de succès ne doit être affiché lors d'un échec d'écriture");
    // 4. Un toast explicite 'warning' doit être émis
    const warningToast = toastLogs.find(t => t.type === 'warning');
    assert.notStrictEqual(warningToast, undefined, "Un toast d'avertissement doit être affiché");
    assert.strictEqual(warningToast.msg.includes("échec de l'écriture sur le disque") || warningToast.msg.includes("la sauvegarde physique sur le disque a échoué"), true, "Le toast doit expliquer l'échec");
  });

  await it("1.3 Sauvegarde physique réussie : confirmation d'écriture et toast succès", async () => {
    resetStorage();
    toastLogs.length = 0;

    window.AntigraviteAPI = {
      saveBackup: async () => ({
        filename: 'antigravite_backup_success.json',
        path: 'C:/fake/backups/antigravite_backup_success.json'
      })
    };

    const record = await BackupManager.createManualBackup("Sauvegarde réussie");

    assert.strictEqual(record.hasPhysicalBackup, true, "hasPhysicalBackup doit être true");
    assert.strictEqual(record.diskPath, 'C:/fake/backups/antigravite_backup_success.json');
    assert.strictEqual(record.payload, null, "Le payload localStorage doit être allégé");

    const successToast = toastLogs.find(t => t.type === 'success');
    assert.notStrictEqual(successToast, undefined, "Un toast de succès doit être affiché après confirmation d'écriture");
  });

  await it("1.4 autoBackupOnLaunch : déclenche une sauvegarde quotidienne si la dernière date d'un jour antérieur", async () => {
    resetStorage();
    toastLogs.length = 0;

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let dailyBackupTriggered = false;

    window.AntigraviteAPI = {
      listBackups: async () => [
        { filename: 'backup_yesterday.json', createdAt: yesterday, size: 1024 }
      ],
      saveBackup: async () => {
        dailyBackupTriggered = true;
        return { filename: 'daily.json', path: 'C:/fake/daily.json' };
      }
    };

    // Paramètre activé
    const settings = StorageManager.getSettings();
    settings.autoBackupOnLaunch = true;
    StorageManager.saveSettings(settings);

    const origCreate = BackupManager.createManualBackup;
    let labelUsed = null;
    BackupManager.createManualBackup = async function(label) {
      labelUsed = label;
      return origCreate.call(this, label);
    };

    try {
      await BackupManager.checkAutoBackup();
      assert.strictEqual(dailyBackupTriggered, true, "La sauvegarde quotidienne doit être déclenchée");
      assert.strictEqual(labelUsed, "Sauvegarde quotidienne automatique");
    } finally {
      BackupManager.createManualBackup = origCreate;
    }
  });

  await it("1.5 migrateLegacyBackups ne supprime pas le payload si le disque est vide", async () => {
    resetStorage();

    const legacy = [
      { id: 'b1', label: 'B1', payload: { tasks: [] }, diskPath: 'C:/fake/b1.json' }
    ];
    StorageManager.saveBackups(legacy);

    window.AntigraviteAPI = {
      listBackups: async () => [] // Disque vide
    };

    await BackupManager.migrateLegacyBackups();

    const after = StorageManager.getBackups();
    assert.strictEqual(after[0].payload !== undefined, true, "Le payload ne doit pas être supprimé quand le disque est vide");
  });

  // ---------------------------------------------------------------------------
  // SUITE 2 : Synchronisation Tâches / Événements & Préservation des Horaires
  // ---------------------------------------------------------------------------

  await it("2.1 Modifier le titre, la description ou la priorité d'une tâche préserve strictement l'horaire et la durée de l'événement lié", async () => {
    resetStorage();

    // 1. Créer une tâche avec plannedDate '2026-11-05'
    const task = TasksManager.addTask({
      title: "Rédiger spécification",
      description: "Détails initiaux",
      priority: "medium",
      plannedDate: "2026-11-05"
    });

    // 2. Vérifier que le créneau lié a été créé
    let events = StorageManager.getEvents();
    let linkedEvent = events.find(e => e.taskId === task.id);
    assert.notStrictEqual(linkedEvent, undefined, "Un événement lié doit exister");

    // 3. L'utilisateur personnalise le créneau dans l'agenda à 14:30 - 16:15 (durée 1h45)
    linkedEvent.start = "2026-11-05T14:30";
    linkedEvent.end = "2026-11-05T16:15";
    StorageManager.saveEvents(events);

    // 4. L'utilisateur modifie le titre et la priorité de la tâche via TasksManager.updateTask
    TasksManager.updateTask(task.id, {
      title: "Rédiger spécification V2",
      description: "Description enrichie",
      priority: "high",
      plannedDate: "2026-11-05" // Même date prévue
    });

    // 5. Vérifier que l'événement d'agenda a reçu le nouveau titre et description SANS écraser l'heure personnalisée
    events = StorageManager.getEvents();
    linkedEvent = events.find(e => e.taskId === task.id);

    assert.strictEqual(linkedEvent.title, "Rédiger spécification V2", "Le titre doit être mis à jour");
    assert.strictEqual(linkedEvent.description, "Description enrichie", "La description doit être mise à jour");
    assert.strictEqual(linkedEvent.start, "2026-11-05T14:30", "L'heure de début 14:30 DOIT être préservée (ne pas forcer 09:00)");
    assert.strictEqual(linkedEvent.end, "2026-11-05T16:15", "L'heure de fin 16:15 DOIT être préservée");
  });

  await it("2.2 Déplacer la date d'une tâche conserve l'horaire personnalisé et la durée sur le nouveau jour", async () => {
    resetStorage();

    const task = TasksManager.addTask({
      title: "Atelier architecture",
      plannedDate: "2026-11-05"
    });

    // L'utilisateur a fixé l'événement à 15:45 - 17:30 (105 minutes)
    let events = StorageManager.getEvents();
    let linkedEvent = events.find(e => e.taskId === task.id);
    linkedEvent.start = "2026-11-05T15:45";
    linkedEvent.end = "2026-11-05T17:30";
    StorageManager.saveEvents(events);

    // L'utilisateur change la date prévue au 2026-11-09 via la modale de tâche
    TasksManager.updateTask(task.id, {
      title: "Atelier architecture",
      plannedDate: "2026-11-09"
    });

    events = StorageManager.getEvents();
    linkedEvent = events.find(e => e.taskId === task.id);

    // Doit être déplacé au 2026-11-09 mais conserver 15:45 et 17:30
    assert.strictEqual(linkedEvent.start, "2026-11-09T15:45", "L'heure personnalisée 15:45 doit être préservée sur le nouveau jour");
    assert.strictEqual(linkedEvent.end, "2026-11-09T17:30", "La durée de 105 min et l'heure 17:30 doivent être préservées");
  });

  await it("2.3 Déplacer un créneau dans l'agenda synchronise la tâche associée", async () => {
    resetStorage();

    const task = TasksManager.addTask({
      title: "Mission audit",
      plannedDate: "2026-11-02"
    });

    let events = StorageManager.getEvents();
    const linkedEvent = events.find(e => e.taskId === task.id);

    // Déplacement via AgendaManager.updateEventSchedule du 2 au 12 novembre, de 10h à 12h
    await AgendaManager.updateEventSchedule(linkedEvent.id, "2026-11-12", 10.0, 12.0);

    // La date prévue de la tâche doit être mise à jour
    const updatedTasks = StorageManager.getTasks();
    const updatedTask = updatedTasks.find(t => t.id === task.id);
    assert.strictEqual(updatedTask.plannedDate, "2026-11-12", "La tâche liée doit avoir sa plannedDate synchronisée sur 2026-11-12");
  });

  // ---------------------------------------------------------------------------
  // SUITE 3 : Suppression Propre & Non-Régression
  // ---------------------------------------------------------------------------

  await it("3.1 Supprimer une tâche nettoie les références orphelines (taskId = null) sans supprimer l'événement", async () => {
    resetStorage();

    const task = TasksManager.addTask({
      title: "Tâche à supprimer",
      plannedDate: "2026-11-05"
    });

    let events = StorageManager.getEvents();
    assert.strictEqual(events.length, 1, "Un événement existe");
    assert.strictEqual(events[0].taskId, task.id);

    // Supprimer la tâche
    TasksManager.deleteTask(task.id);

    // 1. La tâche est bien supprimée
    const tasks = StorageManager.getTasks();
    assert.strictEqual(tasks.length, 0, "La tâche doit être supprimée");

    // 2. L'événement est TOUJOURS présent dans l'agenda
    events = StorageManager.getEvents();
    assert.strictEqual(events.length, 1, "L'événement ne doit JAMAIS être supprimé");
    // 3. La référence orpheline est nettoyée
    assert.strictEqual(events[0].taskId, null, "La référence taskId doit être nettoyée à null");
  });

  await it("3.2 Supprimer une tâche parente nettoie également les liaisons de ses sous-tâches", async () => {
    resetStorage();

    const parent = TasksManager.addTask({
      title: "Tâche parent",
      plannedDate: "2026-11-01"
    });

    const sub = TasksManager.addTask({
      title: "Sous-tâche",
      plannedDate: "2026-11-02"
    }, parent.id);

    let events = StorageManager.getEvents();
    assert.strictEqual(events.length, 2, "Deux événements existent");

    // Supprimer le parent
    TasksManager.deleteTask(parent.id);

    // Les deux événements doivent subsister avec taskId nettoyé à null
    events = StorageManager.getEvents();
    assert.strictEqual(events.length, 2, "Les 2 événements subsistent");
    assert.strictEqual(events.every(e => e.taskId === null), true, "Toutes les liaisons taskId orphelines sont nettoyées à null");
  });

  await it("3.3 Supprimer un événement d'agenda ne supprime JAMAIS la tâche associée", async () => {
    resetStorage();

    const task = TasksManager.addTask({
      title: "Tâche protégée",
      plannedDate: "2026-11-05"
    });

    let events = StorageManager.getEvents();
    const eventId = events[0].id;

    // Supprimer le créneau d'agenda
    AgendaManager.deleteEvent(eventId);

    // 1. L'événement est supprimé
    events = StorageManager.getEvents();
    assert.strictEqual(events.length, 0, "L'événement est supprimé");

    // 2. La tâche associée reste intacte !
    const tasks = StorageManager.getTasks();
    assert.strictEqual(tasks.length, 1, "La tâche reste intacte");
    assert.strictEqual(tasks[0].id, task.id);
    assert.strictEqual(tasks[0].title, "Tâche protégée");
  });

  // ---------------------------------------------------------------------------
  // BILAN
  // ---------------------------------------------------------------------------
  console.log("==========================================================");
  console.log(`   RÉSULTATS DES TESTS INTÉGRITÉ : ${passed} réussis, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
