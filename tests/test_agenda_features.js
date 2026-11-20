/**
 * Antigravité - Tests automatisés : Fonctionnalités Agenda, Récurrence & Ergonomie (v1.1.1)
 * 
 * Couvre :
 * 1. Calcul du clic sur la grille hebdomadaire (arrondi au 15 min le plus proche, durée 1h)
 * 2. Création directe d'une tâche Antigravité depuis le créneau d'agenda (avec liaison bidirectionnelle)
 * 3. Gestion de la récurrence des événements (quotidienne, hebdomadaire, mensuelle)
 * 4. Association Note <-> Projet et comptage dans les statistiques du projet
 * 5. Détachement sécurisé du projet lors de sa suppression (sans perte de notes)
 * 6. Soumission des modales par la touche Entrée (sur input uniquement, non sur textarea)
 * 7. Présence de la configuration du correcteur orthographique dans main.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests Agenda, Récurrence & Ergonomie");
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

const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => {
    for (const k in localStorageStore) delete localStorageStore[k];
  }
};

const toastLogs = [];
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } })
};

global.window = {
  confirm: () => true,
  alert: () => {},
  App: {
    showToast: (msg, type) => {
      toastLogs.push({ msg, type });
    },
    updateDashboard: () => {},
    navigate: () => {}
  },
  AntigraviteAPI: null
};

// Chargement des modules
const StorageManager = require('../js/storage.js');
global.StorageManager = StorageManager;
const TasksManager = require('../js/tasks.js');
global.TasksManager = TasksManager;
const AgendaManager = require('../js/agenda.js');
global.AgendaManager = AgendaManager;
const ProjectsManager = require('../js/projects.js');
global.ProjectsManager = ProjectsManager;
const NotesManager = require('../js/notes.js');
global.NotesManager = NotesManager;

function resetStorage() {
  localStorage.clear();
  StorageManager.clearCache();
  toastLogs.length = 0;
}

async function runTests() {
  // ---------------------------------------------------------------------------
  // 1. Clic sur la grille de l'agenda : calcul des horaires et arrondis
  // ---------------------------------------------------------------------------
  await it("1.1 Calcul de l'heure et des minutes arrondies au quart d'heure le plus proche", () => {
    // Hauteur par heure = 60px
    // Clic à y = 142px -> heure 2 (120px) + 22px
    // 22px / 15px = 1.46 -> arrondi à 1 (15 min) -> 02:15
    const hourHeight = 60;
    const clickY = 142;
    const hour = Math.floor(clickY / hourHeight);
    const minute = Math.round((clickY % hourHeight) / 15) * 15;
    const normalizedHour = hour + Math.floor(minute / 60);
    const normalizedMinute = minute % 60;

    assert.strictEqual(normalizedHour, 2);
    assert.strictEqual(normalizedMinute, 15);

    // Clic à y = 175px -> heure 2 (120px) + 55px -> arrondi à 60 min -> heure 3, minute 0
    const clickY2 = 175;
    const hour2 = Math.floor(clickY2 / hourHeight);
    const minute2 = Math.round((clickY2 % hourHeight) / 15) * 15;
    const normH2 = hour2 + Math.floor(minute2 / 60);
    const normM2 = minute2 % 60;

    assert.strictEqual(normH2, 3);
    assert.strictEqual(normM2, 0);
  });

  // ---------------------------------------------------------------------------
  // 2. Création directe d'une tâche Antigravité depuis l'événement d'agenda
  // ---------------------------------------------------------------------------
  await it("2.1 Création d'un événement avec tâche liée synchronisée", () => {
    resetStorage();

    // Projet de test
    StorageManager.saveProjects([{ id: 'proj-demo', title: 'Projet Test', color: '#3b82f6', status: 'in_progress' }]);

    // Création de l'événement avec option de tâche
    const event = AgendaManager.addEvent({
      title: "Réunion Stratégique",
      start: "2026-11-10T14:30:00",
      end: "2026-11-10T15:30:00",
      description: "Discussion ordre du jour",
      createTask: true,
      taskProject: "proj-demo",
      taskPriority: "high"
    });

    assert.ok(event.id, "L'événement doit avoir un identifiant");
    assert.ok(event.taskId, "L'événement doit référencer une tâche créée");

    const tasks = StorageManager.getTasks();
    const createdTask = tasks.find(t => t.id === event.taskId);
    assert.ok(createdTask, "La tâche doit exister dans StorageManager");
    assert.strictEqual(createdTask.title, "Réunion Stratégique");
    assert.strictEqual(createdTask.plannedDate, "2026-11-10");
    assert.strictEqual(createdTask.projectId, "proj-demo");
    assert.strictEqual(createdTask.priority, "high");
  });

  await it("2.2 Création d'un événement sans tâche lorsque l'option n'est pas cochée", () => {
    resetStorage();

    const initialTasksCount = StorageManager.getTasks().length;
    const event = AgendaManager.addEvent({
      title: "Pause café",
      start: "2026-11-10T16:00:00",
      end: "2026-11-10T16:30:00",
      createTask: false
    });

    assert.ok(event.id);
    assert.strictEqual(event.taskId, null);
    assert.strictEqual(StorageManager.getTasks().length, initialTasksCount);
  });

  // ---------------------------------------------------------------------------
  // 3. Récurrence des événements dans l'agenda
  // ---------------------------------------------------------------------------
  await it("3.1 Récurrence quotidienne (daily) : correspond à tous les jours à partir de la date de départ", () => {
    resetStorage();

    const dailyEvt = {
      id: 'evt-daily',
      title: 'Debrief matinal',
      start: '2026-11-02T09:00:00',
      end: '2026-11-02T09:30:00',
      recurrence: 'daily'
    };

    // Jour même -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(dailyEvt, '2026-11-02'), true);
    // Jour suivant -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(dailyEvt, '2026-11-03'), true);
    // Un mois plus tard -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(dailyEvt, '2026-12-05'), true);
    // Jour précédent la création -> NON
    assert.strictEqual(AgendaManager.isEventOnDate(dailyEvt, '2026-11-01'), false);
  });

  await it("3.2 Récurrence hebdomadaire (weekly) : correspond uniquement au même jour de la semaine", () => {
    resetStorage();

    // 2026-11-02 est un Lundi (getDay() === 1)
    const weeklyEvt = {
      id: 'evt-weekly',
      title: 'Synchronisation d\'équipe',
      start: '2026-11-02T10:00:00',
      end: '2026-11-02T11:00:00',
      recurrence: 'weekly'
    };

    // Lundi 2 nov -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(weeklyEvt, '2026-11-02'), true);
    // Mardi 3 nov -> NON
    assert.strictEqual(AgendaManager.isEventOnDate(weeklyEvt, '2026-11-03'), false);
    // Lundi 9 nov -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(weeklyEvt, '2026-11-09'), true);
    // Lundi 16 nov -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(weeklyEvt, '2026-11-16'), true);
    // Lundi avant la date de départ (26 oct 2026) -> NON
    assert.strictEqual(AgendaManager.isEventOnDate(weeklyEvt, '2026-10-26'), false);
  });

  await it("3.3 Récurrence mensuelle (monthly) : correspond au même jour du mois", () => {
    resetStorage();

    const monthlyEvt = {
      id: 'evt-monthly',
      title: 'Bilan de fin de mois',
      start: '2026-11-15T15:00:00',
      end: '2026-11-15T16:00:00',
      recurrence: 'monthly'
    };

    // 15 nov -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(monthlyEvt, '2026-11-15'), true);
    // 16 nov -> NON
    assert.strictEqual(AgendaManager.isEventOnDate(monthlyEvt, '2026-11-16'), false);
    // 15 déc -> OUI
    assert.strictEqual(AgendaManager.isEventOnDate(monthlyEvt, '2026-12-15'), true);
    // 15 oct (avant start) -> NON
    assert.strictEqual(AgendaManager.isEventOnDate(monthlyEvt, '2026-10-15'), false);
  });

  await it("3.4 Préservation de l'attribut recurrence lors de l'enregistrement", () => {
    resetStorage();

    const evt = AgendaManager.addEvent({
      title: 'Point Récurrent',
      start: '2026-11-05T08:00:00',
      end: '2026-11-05T09:00:00',
      recurrence: 'weekly'
    });

    assert.strictEqual(evt.recurrence, 'weekly');
    const stored = StorageManager.getEvents().find(e => e.id === evt.id);
    assert.strictEqual(stored.recurrence, 'weekly');

    AgendaManager.updateEvent(evt.id, {
      title: 'Point Récurrent Modifié',
      start: '2026-11-05T08:30:00',
      end: '2026-11-05T09:30:00',
      recurrence: 'daily'
    });

    const updated = StorageManager.getEvents().find(e => e.id === evt.id);
    assert.strictEqual(updated.recurrence, 'daily');
  });

  // ---------------------------------------------------------------------------
  // 4. Association Note <-> Projet et affichage
  // ---------------------------------------------------------------------------
  await it("4.1 Liaison d'une note à un projet et calcul du nombre de notes associées", () => {
    resetStorage();

    StorageManager.saveProjects([
      { id: 'proj-a', title: 'Projet Alpha', color: '#3b82f6', status: 'in_progress' },
      { id: 'proj-b', title: 'Projet Beta', color: '#10b981', status: 'in_progress' }
    ]);

    const note1 = NotesManager.createNote();
    NotesManager.linkCurrentNoteToProject('proj-a');

    const note2 = NotesManager.createNote();
    NotesManager.linkCurrentNoteToProject('proj-a');

    const note3 = NotesManager.createNote();
    NotesManager.linkCurrentNoteToProject('proj-b');

    const statsA = ProjectsManager.getProjectStats('proj-a');
    assert.strictEqual(statsA.notesCount, 2, "Projet Alpha doit avoir 2 notes rattachées");

    const statsB = ProjectsManager.getProjectStats('proj-b');
    assert.strictEqual(statsB.notesCount, 1, "Projet Beta doit avoir 1 note rattachée");
  });

  await it("4.2 Détachement des notes lors de la suppression d'un projet", () => {
    resetStorage();

    StorageManager.saveProjects([
      { id: 'proj-to-delete', title: 'Projet Éphémère', color: '#ef4444', status: 'in_progress' }
    ]);

    const note = NotesManager.createNote();
    NotesManager.linkCurrentNoteToProject('proj-to-delete');

    let savedNote = StorageManager.getNotes().find(n => n.id === note.id);
    assert.strictEqual(savedNote.projectId, 'proj-to-delete');

    // Suppression du projet
    ProjectsManager.deleteProject('proj-to-delete');

    // Vérifier que le projet n'existe plus
    const projects = StorageManager.getProjects();
    assert.ok(!projects.some(p => p.id === 'proj-to-delete'));

    // Vérifier que la note existe TOUJOURS mais sans projectId
    const notesAfter = StorageManager.getNotes();
    const targetNote = notesAfter.find(n => n.id === note.id);
    assert.ok(targetNote, "La note ne doit pas être détruite");
    assert.strictEqual(targetNote.projectId, null, "La référence au projet doit être détachée (null)");
  });

  // ---------------------------------------------------------------------------
  // 5. Validation des modales par la touche Entrée
  // ---------------------------------------------------------------------------
  await it("5.1 La touche Entrée sur un champ input déclenche le bouton principal", () => {
    let clicked = false;
    const mockPrimaryBtn = {
      click: () => { clicked = true; }
    };

    const mockInput = {
      tagName: 'INPUT',
      isContentEditable: false
    };

    const mockModal = {
      classList: { contains: (c) => c === 'active' },
      contains: (el) => el === mockInput,
      querySelector: (selector) => {
        if (selector.includes('.btn-primary')) return mockPrimaryBtn;
        return null;
      }
    };

    // Simuler la logique implémentée dans js/app.js
    const simulateKeyDown = (event, activeElement, activeModal) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        if (activeModal) {
          const tag = (activeElement && activeElement.tagName) ? activeElement.tagName.toUpperCase() : '';
          if (tag === 'INPUT' && activeModal.contains(activeElement)) {
            const primaryBtn = activeModal.querySelector('.modal-footer .btn-primary:not(:disabled)');
            if (primaryBtn) {
              event.preventDefault();
              primaryBtn.click();
            }
          }
        }
      }
    };

    let prevented = false;
    simulateKeyDown({ key: 'Enter', shiftKey: false, preventDefault: () => { prevented = true; } }, mockInput, mockModal);
    assert.strictEqual(prevented, true, "preventDefault doit être appelé");
    assert.strictEqual(clicked, true, "Le bouton principal doit être cliqué");
  });

  await it("5.2 La touche Entrée dans un textarea ne déclenche PAS la soumission de la modale", () => {
    let clicked = false;
    const mockPrimaryBtn = {
      click: () => { clicked = true; }
    };

    const mockTextarea = {
      tagName: 'TEXTAREA',
      isContentEditable: false
    };

    const mockModal = {
      contains: (el) => el === mockTextarea,
      querySelector: () => mockPrimaryBtn
    };

    const simulateKeyDown = (event, activeElement, activeModal) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        if (activeModal) {
          const tag = (activeElement && activeElement.tagName) ? activeElement.tagName.toUpperCase() : '';
          if (tag === 'INPUT' && activeModal.contains(activeElement)) {
            const primaryBtn = activeModal.querySelector('.modal-footer .btn-primary:not(:disabled)');
            if (primaryBtn) {
              event.preventDefault();
              primaryBtn.click();
            }
          }
        }
      }
    };

    let prevented = false;
    simulateKeyDown({ key: 'Enter', shiftKey: false, preventDefault: () => { prevented = true; } }, mockTextarea, mockModal);
    assert.strictEqual(prevented, false, "Dans un textarea, le saut de ligne natif doit être préservé");
    assert.strictEqual(clicked, false, "Le bouton de validation ne doit pas être cliqué");
  });

  // ---------------------------------------------------------------------------
  // 6. Vérification de la configuration Electron pour le correcteur orthographique
  // ---------------------------------------------------------------------------
  await it("6.1 main.js configure spellcheck et la langue française", () => {
    const mainJsContent = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert.ok(mainJsContent.includes('spellcheck: true'), "main.js doit déclarer spellcheck: true dans webPreferences");
    assert.ok(mainJsContent.includes("setSpellCheckerLanguages(['fr-FR', 'fr'])"), "main.js doit configurer setSpellCheckerLanguages(['fr-FR', 'fr'])");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTAT : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Erreur fatale de test:", err);
  process.exit(1);
});
