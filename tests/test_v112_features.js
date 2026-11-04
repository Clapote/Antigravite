/**
 * Antigravité - Tests automatisés : Fonctionnalités v1.1.2
 * 
 * Couvre :
 * 1. Intégration Barre des tâches Windows & AppUserModelId ('fr.antigravite.app')
 * 2. Raccourci global de visibilité de l'application (Ctrl + Shift + A)
 * 3. Bouton unique de réduction de la barre latérale (◀ / ▶) et suppression du doublon
 * 4. Planification horaire des tâches (plannedTime), suppression de "(Deadline)"
 * 5. Non-duplication des créneaux lors de la création d'une tâche depuis l'agenda
 * 6. Vues Agenda (Jour / Semaine / Mois) et saut direct de date
 * 7. Prise en compte de la couleur personnalisée d'événement et suppression des logos encombrants
 * 8. Interconnexion du module Projets (Modale de détail avec tâches et notes liées)
 * 9. Filtrage des notes personnelles vs projets et sélecteur chronologique d'événements
 * 10. Alignement des versions v1.1.2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests des fonctionnalités v1.1.2");
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

const domStore = {};
global.document = {
  getElementById: (id) => {
    if (!domStore[id]) {
      domStore[id] = {
        id,
        style: {},
        dataset: {},
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); },
          toggle(c, cond) { if (cond !== undefined ? cond : !this._classes.has(c)) this._classes.add(c); else this._classes.delete(c); }
        },
        children: [],
        innerHTML: '',
        textContent: '',
        value: '',
        addEventListener: () => {},
        appendChild(child) {
          this.children.push(child);
          this.innerHTML += (child.innerHTML || '') + '\n';
        }
      };
    }
    return domStore[id];
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    dataset: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); }
    },
    children: [],
    innerHTML: '',
    textContent: '',
    value: '',
    addEventListener: () => {},
    setAttribute: () => {},
    appendChild(child) {
      this.children.push(child);
      this.innerHTML += (child.innerHTML || '') + '\n';
    }
  })
};

global.window = {
  confirm: () => true,
  alert: () => {},
  addEventListener: () => {},
  innerHeight: 900,
  innerWidth: 1200
};

// Charger les modules
const StorageManager = require('../js/storage.js');
global.StorageManager = StorageManager;

const TasksManager = require('../js/tasks.js');
global.TasksManager = TasksManager;

const ProjectsManager = require('../js/projects.js');
global.ProjectsManager = ProjectsManager;

const AgendaManager = require('../js/agenda.js');
global.AgendaManager = AgendaManager;

const NotesManager = require('../js/notes.js');
global.NotesManager = NotesManager;

async function runTests() {
  const rootDir = path.join(__dirname, '..');

  // ---------------------------------------------------------------------------
  // 1. Barre des tâches Windows & Cohérence AppUserModelId
  // ---------------------------------------------------------------------------
  await it("1.1 main.js configure app.setAppUserModelId('fr.antigravite.app')", async () => {
    const mainContent = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainContent.includes("app.setAppUserModelId('fr.antigravite.app')"), "L'AppUserModelId doit être fr.antigravite.app pour s'aligner sur package.json");
  });

  await it("1.2 package.json définit appId 'fr.antigravite.app' et l'icône Windows", async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.build.appId, 'fr.antigravite.app', "package.json doit avoir fr.antigravite.app");
    assert.ok(pkg.build.win.icon === 'assets/icon.ico' || pkg.build.win.icon === 'assets/icon.png', "package.json doit référencer assets/icon.ico ou assets/icon.png");
    assert.strictEqual(pkg.version, '1.1.2', "package.json doit être en version 1.1.2");
  });

  // ---------------------------------------------------------------------------
  // 2. Raccourci global de visibilité
  // ---------------------------------------------------------------------------
  await it("2.1 main.js enregistre le raccourci global CommandOrControl+Shift+A", async () => {
    const mainContent = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainContent.includes("globalShortcut.register('CommandOrControl+Shift+A'"), "Le raccourci CommandOrControl+Shift+A doit être enregistré");
    assert(mainContent.includes("function toggleAppVisibility("), "La fonction toggleAppVisibility doit exister");
    assert(mainContent.includes("globalShortcut.unregisterAll()"), "Les raccourcis doivent être libérés sur will-quit");
  });

  // ---------------------------------------------------------------------------
  // 3. Ergonomie Sidebar & Bouton unique
  // ---------------------------------------------------------------------------
  await it("3.1 index.html ne contient plus #btn-collapse-sidebar et utilise ◀", async () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(!indexHtml.includes('id="btn-collapse-sidebar"'), "Le bouton doublon #btn-collapse-sidebar doit être supprimé");
    assert(indexHtml.includes('id="btn-toggle-sidebar"'), "Le bouton unique #btn-toggle-sidebar doit exister");
    assert(indexHtml.includes('>◀<'), "Le bouton toggle doit afficher ◀");
  });

  // ---------------------------------------------------------------------------
  // 4. Tâches : Horaire précis et suppression "(Deadline)"
  // ---------------------------------------------------------------------------
  await it("4.1 index.html supprime (Deadline) et inclut task-input-planned-time", async () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(!indexHtml.includes('(Deadline)'), "Le texte (Deadline) doit être retiré");
    assert(indexHtml.includes('id="task-input-planned-time"'), "Le champ task-input-planned-time doit être présent");
  });

  await it("4.2 TasksManager gère plannedTime et préserve l'horaire choisi", async () => {
    localStorage.clear();
    const task = TasksManager.addTask({
      title: "Tâche avec horaire spécifique",
      plannedDate: "2026-11-10",
      plannedTime: "14:30"
    });
    assert.strictEqual(task.plannedDate, "2026-11-10");
    assert.strictEqual(task.plannedTime, "14:30");

    const events = StorageManager.getEvents();
    const linked = events.find(e => e.taskId === task.id);
    assert(linked, "Un créneau doit être synchronisé dans l'agenda");
    assert.strictEqual(linked.start, "2026-11-10T14:30");
  });

  await it("4.3 TasksManager respecte skipEventCreation pour éviter les doublons", async () => {
    const initialCount = StorageManager.getEvents().length;
    const task = TasksManager.addTask({
      title: "Tâche créée depuis l'agenda",
      plannedDate: "2026-11-12",
      plannedTime: "10:00",
      skipEventCreation: true
    });
    const afterCount = StorageManager.getEvents().length;
    assert.strictEqual(afterCount, initialCount, "Aucun créneau d'agenda supplémentaire ne doit être créé avec skipEventCreation");
  });

  // ---------------------------------------------------------------------------
  // 5. Vues Agenda (Jour / Semaine / Mois)
  // ---------------------------------------------------------------------------
  await it("5.1 AgendaManager permet de basculer entre vues Jour, Semaine et Mois", async () => {
    AgendaManager.setView('day');
    assert.strictEqual(AgendaManager.currentView, 'day');
    AgendaManager.setView('month');
    assert.strictEqual(AgendaManager.currentView, 'month');
    AgendaManager.setView('week');
    assert.strictEqual(AgendaManager.currentView, 'week');
  });

  await it("5.2 AgendaManager.renderMonthView génère une grille de cellules cohérente", async () => {
    const gridEl = document.getElementById('calendar-month-grid');
    AgendaManager.renderMonthView([], new Map(), new Map(), new Map());
    assert(gridEl.innerHTML.includes('month-day-cell'), "La grille doit contenir des cellules month-day-cell");
    assert(gridEl.innerHTML.includes('month-day-number'), "La grille doit afficher les numéros des jours");
  });

  // ---------------------------------------------------------------------------
  // 6. Couleur personnalisée & Absence de logos encombrants
  // ---------------------------------------------------------------------------
  await it("6.1 Le rendu d'événement injecte dynamiquement sa couleur en style inline", async () => {
    localStorage.clear();
    const customColor = "#10b981";
    AgendaManager.addEvent({
      title: "Événement Vert Émeraude",
      start: "2026-11-04T10:00",
      end: "2026-11-04T11:00",
      color: customColor
    });

    AgendaManager.currentWeekStart = new Date("2026-11-02T00:00:00");
    AgendaManager.currentView = 'week';
    AgendaManager.render();

    const bodyEl = document.getElementById('calendar-body-container');
    assert(bodyEl.innerHTML.includes(customColor), "Le rendu HTML doit contenir la couleur personnalisée (#10b981)");
    assert(!bodyEl.innerHTML.includes('<img src="./assets/icon.png"'), "Aucun logo Antigravité encombrant ne doit figurer sur les cartes");
  });

  // ---------------------------------------------------------------------------
  // 7. Modale de détail du Projet (Interconnexion)
  // ---------------------------------------------------------------------------
  await it("7.1 ProjectsManager.openProjectDetailModal présente les tâches et notes interconnectées", async () => {
    localStorage.clear();
    const proj = ProjectsManager.addProject({
      title: "Projet Fusée",
      description: "Construction d'une fusée",
      color: "#ec4899"
    });

    const task1 = TasksManager.addTask({
      title: "Assembler le moteur",
      projectId: proj.id,
      priority: "urgent"
    });

    const note1 = NotesManager.createNote();
    NotesManager.updateCurrentNoteTitle("Spécifications Moteur");
    NotesManager.linkCurrentNoteToProject(proj.id);

    ProjectsManager.openProjectDetailModal(proj.id);

    const titleEl = document.getElementById('project-detail-title');
    const tasksListEl = document.getElementById('project-detail-tasks-list');
    const notesListEl = document.getElementById('project-detail-notes-list');

    assert.strictEqual(titleEl.textContent, "Projet Fusée");
    assert(tasksListEl.innerHTML.includes("Assembler le moteur"), "La tâche doit apparaître dans la modale");
    assert(notesListEl.innerHTML.includes("Spécifications Moteur"), "La note doit apparaître dans la modale");
  });

  await it("7.2 toggleTaskFromDetail bascule l'état d'achèvement de la tâche", async () => {
    const projects = StorageManager.getProjects();
    const proj = projects[0];
    const tasks = StorageManager.getTasks().filter(t => t.projectId === proj.id);
    const targetTask = tasks[0];

    assert.strictEqual(targetTask.completed, false);
    ProjectsManager.toggleTaskFromDetail(proj.id, targetTask.id);

    const updated = StorageManager.getTasks().find(t => t.id === targetTask.id);
    assert.strictEqual(updated.completed, true, "La tâche doit être marquée terminée");
  });

  // ---------------------------------------------------------------------------
  // 8. Filtrage des notes personnelles vs projets & Sélecteur d'agenda
  // ---------------------------------------------------------------------------
  await it("8.1 NotesManager filtre les notes personnelles sans projet", async () => {
    localStorage.clear();
    const proj = ProjectsManager.addProject({ title: "Projet A" });

    // Note 1 : rattachée au projet
    const n1 = NotesManager.createNote();
    NotesManager.updateCurrentNoteTitle("Note de Projet");
    NotesManager.linkCurrentNoteToProject(proj.id);

    // Note 2 : personnelle (aucun projet)
    const n2 = NotesManager.createNote();
    NotesManager.updateCurrentNoteTitle("Note Personnelle Seule");

    // Filtre 'personal'
    NotesManager.currentProjectFilter = 'personal';
    NotesManager.renderNotesList();

    const listEl = document.getElementById('notes-list-container');
    assert(listEl.innerHTML.includes("Note Personnelle Seule"), "La note personnelle doit apparaître");
    assert(!listEl.innerHTML.includes("Note de Projet"), "La note liée au projet ne doit pas apparaître dans les notes personnelles");

    // Filtre 'all'
    NotesManager.currentProjectFilter = 'all';
    NotesManager.renderNotesList();
    assert(listEl.innerHTML.includes("Note de Projet"), "Toutes les notes doivent apparaître en mode 'all'");
  });

  await it("8.2 NotesManager.renderEventSelector regroupe les créneaux par horizon temporel", async () => {
    localStorage.clear();
    AgendaManager.addEvent({
      title: "Créneau Semaine Courante",
      start: new Date().toISOString().slice(0, 10) + "T10:00"
    });
    AgendaManager.addEvent({
      title: "Créneau Passé",
      start: "2020-01-01T10:00"
    });

    const selectEl = document.getElementById('note-input-event');
    NotesManager.renderEventSelector(null);

    assert(selectEl.children.length >= 2, "Le sélecteur doit contenir des groupes optgroup");
    const groupLabels = selectEl.children.map(c => c.label).filter(Boolean);
    assert(groupLabels.some(l => l.includes("Cette semaine")), "Un groupe 'Cette semaine' doit être présent");
    assert(groupLabels.some(l => l.includes("passés")), "Un groupe 'Créneaux passés' doit être présent");
  });

  // ---------------------------------------------------------------------------
  // 9. Alignement de Version
  // ---------------------------------------------------------------------------
  await it("9.1 Version 1.1.2 cohérente dans package.json, index.html et settings.js", async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '1.1.2');

    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(indexHtml.includes('id="updater-current-version-label">1.1.2</strong>'), "index.html doit afficher la version 1.1.2");

    const settingsJs = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsJs.includes("this.currentVersion = '1.1.2'"), "settings.js doit être initialisé à la version 1.1.2");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
