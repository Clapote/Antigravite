/**
 * Antigravité - Suite de Tests Liens Inter-Onglets & Automatisations (Lot A + Lot B v1.3.1)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function createStorageMock() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    key(i) { return Array.from(store.keys())[i] || null; },
    get length() { return store.size; }
  };
}

function makeFakeElement(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    children: [],
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach(c => this._set.add(c)); },
      remove(...cls) { cls.forEach(c => this._set.delete(c)); },
      toggle(c, force) {
        if (force === true) this._set.add(c);
        else if (force === false) this._set.delete(c);
        else if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
      },
      contains(c) { return this._set.has(c); }
    },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getAttribute() { return null; },
    setAttribute() {},
    remove() {},
    get childElementCount() { return this.children.length; }
  };
  return el;
}

function setupGlobals() {
  global.localStorage = createStorageMock();
  const docElements = new Map();
  global._docElements = docElements;
  global.document = {
    readyState: 'complete',
    documentElement: makeFakeElement('html'),
    getElementById(id) { return docElements.get(id) || null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement(tag) { return makeFakeElement(tag); },
    createDocumentFragment() {
      const f = makeFakeElement('fragment');
      f.nodeType = 11;
      return f;
    },
    addEventListener() {}
  };
  global.window = global;
  global.AntigraviteAPI = {
    showNotification: async (opts) => {
      global._lastNativeNotifs = global._lastNativeNotifs || [];
      global._lastNativeNotifs.push(opts);
      return true;
    },
    onNotificationClicked: () => () => {}
  };
  global.App = {
    currentScreen: 'home',
    toasts: [],
    navigate(scr) { this.currentScreen = scr; },
    showToast(msg, type, opts) { this.toasts.push({ msg, type, opts }); },
    formatLocalYMD(d) {
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    renderDashboard() {},
    renderCurrentScreen() {},
    scheduleDashboardRefresh() {},
    openEventFromDashboard() {},
    openNoteFromDashboard() {},
    handleNotificationAction(a) { this._lastAction = a; }
  };
  global.SoundManager = { playSound() {}, play() {}, stop() {} };
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests Liens Inter-Onglets & Automatisations");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;
  async function it(name, fn) {
    try {
      setupGlobals();
      await fn();
      console.log(` [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(` [FAIL] ${name} :`, err);
      failed++;
    }
  }

  // Charger les modules dans un ordre sain
  setupGlobals();
  const StorageManager = require('../js/storage.js');
  global.StorageManager = StorageManager;
  const TasksManager = require('../js/tasks.js');
  global.TasksManager = TasksManager;
  const AgendaManager = require('../js/agenda.js');
  global.AgendaManager = AgendaManager;
  const NotesManager = require('../js/notes.js');
  global.NotesManager = NotesManager;
  const ProjectsManager = require('../js/projects.js');
  global.ProjectsManager = ProjectsManager;
  const TrashManager = require('../js/trash.js');
  global.TrashManager = TrashManager;
  const FocusManager = require('../js/focus.js');
  global.FocusManager = FocusManager;
  const DebriefManager = require('../js/debrief.js');
  global.DebriefManager = DebriefManager;
  const SearchManager = require('../js/search.js');
  global.SearchManager = SearchManager;
  const ConstellationManager = require('../js/constellation.js');
  global.ConstellationManager = ConstellationManager;
  const GoogleSyncManager = require('../js/google-sync.js');
  global.GoogleSyncManager = GoogleSyncManager;
  const AgendaNotificationManager = require('../js/notifications.js');
  global.AgendaNotificationManager = AgendaNotificationManager;

  await it("1. DebriefManager._getRenderSig() fonctionne sans erreur et suit Focus", () => {
    StorageManager.init();
    const sig1 = DebriefManager._getRenderSig();
    assert(typeof sig1 === 'string' && sig1.length > 0, "Signature valide générée");
    localStorage.setItem('antigravite_focus_daily', JSON.stringify({ date: DebriefManager.toLocalDateStr(), count: 2 }));
    const sig2 = DebriefManager._getRenderSig();
    assert.notStrictEqual(sig1, sig2, "Signature mise à jour après session Focus");
  });

  await it("2. GoogleSyncManager.mergeGoogleEvents() préserve projectId, resynchronise la tâche et nettoie sur 'cancelled'", () => {
    StorageManager.init();
    const proj = { id: 'p-1', title: 'Projet Sync', color: '#3b82f6' };
    StorageManager.saveProjects([proj]);
    StorageManager.saveTasks([{
      id: 't-1', title: 'Rédiger dossier', completed: false,
      plannedDate: '2026-11-27', plannedTime: '10:00', projectId: 'p-1', subtasks: []
    }]);
    StorageManager.saveNotes([{
      id: 'n-1', title: 'Compte rendu', content: '', linkedEventId: 'google_g-cancel', folder: 'Général'
    }]);
    StorageManager.saveEvents([
      {
        id: 'google_g-keep', googleId: 'g-keep', source: 'google',
        title: 'Point client', start: '2026-11-27T10:00', end: '2026-11-27T11:00',
        taskId: 't-1', projectId: 'p-1', syncStatus: 'synced'
      },
      {
        id: 'google_g-cancel', googleId: 'g-cancel', source: 'google',
        title: 'Créneau annulé', start: '2026-11-28T09:00', end: '2026-11-28T10:00',
        noteId: 'n-1', syncStatus: 'synced'
      }
    ]);

    GoogleSyncManager.mergeGoogleEvents([
      {
        id: 'google_g-keep', googleId: 'g-keep', source: 'google',
        title: 'Point client déplacé', start: '2026-11-29T14:30', end: '2026-11-29T15:30'
      },
      {
        id: 'google_g-cancel', googleId: 'g-cancel', source: 'google', status: 'cancelled'
      }
    ]);

    const updatedEvents = StorageManager.getEvents();
    assert.strictEqual(updatedEvents.length, 1, "L'événement cancelled doit être retiré");
    assert.strictEqual(updatedEvents[0].projectId, 'p-1', "Le projectId local est préservé");
    const updatedTask = StorageManager.getTasks().find(t => t.id === 't-1');
    assert(updatedTask, "Règle #6 : la tâche est toujours conservée");
    assert.strictEqual(updatedTask.plannedDate, '2026-11-29', "La date de la tâche est resynchronisée depuis Google");
    assert.strictEqual(updatedTask.plannedTime, '14:30', "L'heure de la tâche est resynchronisée depuis Google");
    const updatedNote = StorageManager.getNotes().find(n => n.id === 'n-1');
    assert.strictEqual(updatedNote.linkedEventId, null, "Le lien note.linkedEventId orphelin est nettoyé");
  });

  await it("3. TrashManager.restore() réattache les liens tâche/note/projet et supprime les orphelins", () => {
    StorageManager.init();
    const p = { id: 'p-res', title: 'Projet Corbeille', color: '#10b981', archived: false };
    const n = { id: 'n-res', title: 'Note associée', content: '', folder: 'Général', projectId: null, linkedTaskId: null };
    const t = { id: 't-res', title: 'Tâche associée', projectId: 'p-res', noteId: 'n-res', completed: false, subtasks: [] };
    StorageManager.saveProjects([p]);
    StorageManager.saveNotes([n]);
    StorageManager.saveTasks([t]);

    TasksManager.deleteTask('t-res');
    assert.strictEqual(StorageManager.getTasks().length, 0, "Tâche supprimée vers corbeille");
    const trashList = StorageManager.getTrash();
    assert.strictEqual(trashList.length, 1, "Une entrée corbeille");
    TrashManager.restore(trashList[0].id);

    const restoredTask = StorageManager.getTasks().find(x => x.id === 't-res');
    const relinkedNote = StorageManager.getNotes().find(x => x.id === 'n-res');
    assert(restoredTask, "Tâche restaurée");
    assert.strictEqual(restoredTask.noteId, 'n-res', "noteId conservé si la note existe encore");
    assert.strictEqual(relinkedNote.linkedTaskId, 't-res', "linkedTaskId réattaché sur la note");

    // Suppression complète du projet -> suppression en corbeille -> restauration
    ProjectsManager.deleteProject('p-res');
    assert.strictEqual(StorageManager.getProjects().length, 0, "Projet mis en corbeille");
    const pTrash = StorageManager.getTrash().find(x => x.type === 'project');
    TrashManager.restore(pTrash.id);
    const restoredProj = StorageManager.getProjects().find(x => x.id === 'p-res');
    const restoredTaskAfterProj = StorageManager.getTasks().find(x => x.id === 't-res');
    assert(restoredProj, "Projet restauré");
    assert.strictEqual(restoredTaskAfterProj.projectId, 'p-res', "projectId de la tâche réassocié après restauration projet");
  });

  await it("4. StorageManager.getFullExport / restoreFullExport inclut les préférences Focus & Debrief", () => {
    StorageManager.init();
    localStorage.setItem('antigravite_focus_history_v1', JSON.stringify({ '2026-11-27': { count: 3, minutes: 75 } }));
    localStorage.setItem('antigravite_debrief_seen', '2026-11-27');

    const dump = StorageManager.getFullExport();
    assert(dump.extraPrefs && dump.extraPrefs.antigravite_focus_history_v1, "Historique Focus présent dans l'export");

    localStorage.clear();
    const ok = StorageManager.restoreFullExport(dump);
    assert.strictEqual(ok, true, "Restauration réussie");
    const histRestored = JSON.parse(localStorage.getItem('antigravite_focus_history_v1'));
    assert.strictEqual(histRestored['2026-11-27'].minutes, 75, "Minutes Focus restaurées");
    assert.strictEqual(localStorage.getItem('antigravite_debrief_seen'), '2026-11-27', "Date Débrief restaurée");
  });

  await it("5. Notes <-> Tasks : création depuis note, liaison bidirectionnelle et suppression propre", () => {
    StorageManager.init();
    StorageManager.saveProjects([{ id: 'p-nt', title: 'Carnet', color: '#8b5cf6' }]);
    const note = {
      id: 'n-check',
      title: 'Réunion produit',
      folder: 'Travail',
      projectId: 'p-nt',
      linkedEventId: null,
      linkedTaskId: null,
      content: '<p>Notes de préparation</p>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    StorageManager.saveNotes([note]);
    NotesManager.currentNoteId = 'n-check';

    const singleTask = NotesManager.createTaskFromCurrentNote();
    assert(singleTask && singleTask.noteId === 'n-check', "Tâche créée liée à la note");
    assert.strictEqual(singleTask.projectId, 'p-nt', "Hérite du projet de la note");
    const updatedNote = NotesManager.getAll().find(x => x.id === 'n-check');
    assert.strictEqual(updatedNote.linkedTaskId, singleTask.id, "Note liée bidirectionnellement à la tâche");

    NotesManager.deleteCurrentNote();
    const taskAfterDel = TasksManager.findTaskRecursive(StorageManager.getTasks(), singleTask.id);
    assert.strictEqual(taskAfterDel.task.noteId, null, "Suppression de la note nettoie noteId sur la tâche");
  });

  await it("6. Focus multi-cible, historique multi-jours & remontée automatique vers Debrief hebdomadaire", () => {
    StorageManager.init();
    const todayStr = DebriefManager.toLocalDateStr(new Date());
    StorageManager.saveProjects([{ id: 'p-f', title: 'Rédaction', color: '#10b981' }]);
    StorageManager.saveNotes([{
      id: 'n-f', title: 'Plan de rédaction', folder: 'Pro', linkedProjectId: 'p-f',
      content: '<p>Contenu</p>', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }]);

    FocusManager.selectedTarget = { type: 'project', id: 'p-f' };
    FocusManager.onComplete();
    const statsToday = FocusManager.getHistoryStats(todayStr, todayStr);
    assert(statsToday.count >= 1 && statsToday.minutes >= 1, "Session enregistrée dans FocusManager.getHistoryStats");

    const now = new Date();
    const diffToMon = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    const monStr = DebriefManager.toLocalDateStr(monday);

    // Vérifier aussi que Debrief weekly lit Focus et linkedProjectId sur Notes
    const weekly = DebriefManager.getWeeklyAccomplishments({ debriefWeekendRange: 'mon-sun' });
    assert(weekly.focusCount >= 1, `Debrief hebdo doit comptabiliser Focus (${weekly.focusCount})`);
    assert(weekly.focusMinutes >= 1, `Debrief hebdo doit exposer focusMinutes (${weekly.focusMinutes})`);
    assert(weekly.stats.activeProjectsCount >= 1, "linkedProjectId reconnu dans Projets en mouvement");
    assert(weekly.notes.some(n => n.project && n.project.id === 'p-f'), "Badge projet résolu via linkedProjectId");
    assert(monStr <= weekly.endDate, "Plage hebdo cohérente");
  });

  await it("7. Debrief actif : pendingTodayTasks, reporter à demain & créer une note bilan", () => {
    StorageManager.init();
    const todayStr = DebriefManager.toLocalDateStr(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = DebriefManager.toLocalDateStr(tomorrow);

    StorageManager.saveProjects([{ id: 'p-arch', title: 'Archive', archived: true }]);
    StorageManager.saveTasks([
      { id: 't-pend', title: 'Finir maquette', completed: false, plannedDate: todayStr, projectId: null, subtasks: [] },
      { id: 't-arch', title: 'Vieille tâche archivée', completed: false, plannedDate: todayStr, projectId: 'p-arch', subtasks: [] }
    ]);

    const daily = DebriefManager.getDailyAccomplishments(todayStr);
    assert.strictEqual(daily.pendingTodayTasks.length, 1, "Exclut les projets archivés de pendingTodayTasks");
    assert.strictEqual(daily.pendingTodayTasks[0].id, 't-pend');

    DebriefManager.postponeTaskToTomorrow('t-pend');
    const updated = StorageManager.getTasks().find(t => t.id === 't-pend');
    assert.strictEqual(updated.plannedDate, tomorrowStr, "postponeTaskToTomorrow met bien la tâche à demain");

    const bilanNote = DebriefManager.createDebriefNote();
    assert(bilanNote && bilanNote.folder === 'Bilans', "Note bilan créée dans le dossier Bilans");
    assert(Array.isArray(bilanNote.tags) && bilanNote.tags.includes('bilan'), "Tag 'bilan' ajouté");
  });

  await it("8. SearchManager : indexation tags/lieu/dossier, couleur projet & reset filtres Notes", () => {
    StorageManager.init();
    SearchManager.resultsEl = makeFakeElement('div');
    StorageManager.saveProjects([{ id: 'p-s', title: 'Alpha', color: '#ef4444', archived: false }]);
    StorageManager.saveEvents([{ id: 'e-s', title: 'Atelier', location: 'Salle Orion', start: '2026-11-27T10:00', projectId: 'p-s' }]);
    const targetNote = { id: 'n-s', title: 'Spécifications', folder: 'Architecture', tags: ['urgent-tag'], projectId: 'p-s', content: '<p>Texte</p>' };
    StorageManager.saveNotes([targetNote]);

    SearchManager.executeSearch('orion');
    assert(SearchManager.currentResults.some(r => r.type === 'event' && r.id === 'e-s' && r.color === '#ef4444'), "Lieu indexé + couleur projet sur Event");

    SearchManager.executeSearch('#urgent-tag');
    assert(SearchManager.currentResults.some(r => r.type === 'note' && r.id === 'n-s' && r.color === '#ef4444'), "Tag indexé + couleur projet sur Note");

    NotesManager.currentFolderFilter = 'Personnel';
    NotesManager.currentProjectFilter = 'other-proj';
    SearchManager.selectResult(0);
    assert.strictEqual(NotesManager.currentFolderFilter, 'all', "Réinitialise le filtre dossier qui masquerait la note");
    assert.strictEqual(NotesManager.currentProjectFilter, 'all', "Réinitialise le filtre projet qui masquerait la note");
  });

  await it("9. Constellation : trashIds data.id, freeRootTasksCount projet orphelin & liens transverses", () => {
    StorageManager.init();
    StorageManager.saveProjects([{ id: 'p-ok', title: 'Actif', color: '#38bdf8' }]);
    StorageManager.saveTasks([
      { id: 't-orph', title: 'Tâche projet supprimé', projectId: 'p-missing', noteId: 'n-a', completed: false, subtasks: [] },
      { id: 't-trash', title: 'Tâche en corbeille', projectId: 'p-ok', completed: false, subtasks: [] }
    ]);
    StorageManager.saveTrash([
      { id: 'tr-1', type: 'task', data: { id: 't-trash', title: 'Tâche en corbeille' } }
    ]);
    StorageManager.saveNotes([
      { id: 'n-a', title: 'Note Alpha', content: '<p>Voir [[Note Beta]]</p>', folder: 'Général' },
      { id: 'n-b', title: 'Note Beta', content: '<p>Suite</p>', folder: 'Général' }
    ]);

    ConstellationManager.filters.events = false;
    ConstellationManager.filters.crossLinks = true;
    const graph = ConstellationManager.extractGraphData();
    assert(!graph.nodes.some(n => n.originalId === 't-trash'), "Exclut t-trash identifié via item.data.id");
    assert(graph.nodes.some(n => n.id === '__hub_tasks_free__'), "Crée le hub Tâches Libres même si projectId est orphelin");

    const hasWikiEdge = graph.links.some(l => l.dashed && l.source === 'note_n-a' && l.target === 'note_n-b');
    const hasTaskNoteEdge = graph.links.some(l => l.dashed && l.source === 'task_t-orph' && l.target === 'note_n-a');
    assert(hasWikiEdge, "Lien transverse [[wikilink]] créé lorsque crossLinks=true");
    assert(hasTaskNoteEdge, "Lien transverse Task <-> Note créé lorsque crossLinks=true");
    ConstellationManager.filters.crossLinks = false;
  });

  await it("10. Notifications deep-link IPC & alerte échéances sans doublon", async () => {
    StorageManager.init();
    const todayStr = AgendaNotificationManager._formatLocalYMD(new Date());
    StorageManager.saveProjects([{ id: 'p-arch2', title: 'Archivé', archived: true }]);
    StorageManager.saveTasks([
      { id: 't-due', title: 'Rendre dossier', deadline: todayStr, completed: false, projectId: null, subtasks: [] },
      { id: 't-due-arch', title: 'Archivé', deadline: todayStr, completed: false, projectId: 'p-arch2', subtasks: [] }
    ]);

    AgendaNotificationManager._lastDeadlineCheckSig = null;
    global._lastNativeNotifs = [];
    AgendaNotificationManager.checkDueTaskDeadlines({ notificationsEnabled: true });

    assert.strictEqual(global._lastNativeNotifs.length, 1, "Envoie une notification pour l'échéance active du jour");
    assert.strictEqual(global._lastNativeNotifs[0].action.type, 'open-task', "Action deep-link open-task attachée");
    assert.strictEqual(global._lastNativeNotifs[0].action.taskId, 't-due', "ID exact de la tâche attaché");

    // Deuxième appel le même jour (même après changement de révision) : pas de doublon !
    StorageManager.saveTasks(StorageManager.getTasks());
    AgendaNotificationManager.checkDueTaskDeadlines({ notificationsEnabled: true });
    assert.strictEqual(global._lastNativeNotifs.length, 1, "Aucune notification dupliquée le même jour");

    // Vérifier aussi câblage main.js & preload.js
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    const preloadCode = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
    assert(mainCode.includes('antigravite:notification-clicked'), "main.js émet antigravite:notification-clicked au clic");
    assert(preloadCode.includes('onNotificationClicked'), "preload.js expose onNotificationClicked");
  });

  await it("11. Notes éditeur : suppression extraction, Ctrl+G/I/S, puces propres & couleurs façon Word", () => {
    const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    const cssCode = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    // Extraction supprimée
    assert(!htmlCode.includes('btn-note-extract-tasks'), "Bouton Extraire actions retiré de index.html");
    assert(typeof NotesManager.extractChecklistToTasks === 'undefined', "extractChecklistToTasks retiré de NotesManager");

    // Boutons doubles & palette Word
    assert(htmlCode.includes('id="btn-color-apply"') && htmlCode.includes('id="btn-color-menu"'), "Split button couleur présent");
    assert(htmlCode.includes('id="btn-highlight-apply"') && htmlCode.includes('id="btn-highlight-menu"'), "Split button surlignage présent");
    assert(htmlCode.includes('id="btn-color-more-picker"'), "Option Autres couleurs présente dans le popover");
    assert(notesCode.includes('_applyTextColorWord') && notesCode.includes('_applyHighlightWord'), "Gestion couleur & surlignage façon Word présente");
    assert(notesCode.includes('_clearInlineStyleOnSelection') && notesCode.includes('_breakOutOfStyleAtCaret'), "Réinitialisation ciblée sans removeFormat destructif");
    assert(cssCode.includes('[data-hl-light="true"]'), "Contraste lisible sur surlignage en thème sombre");
    assert(NotesManager._isLightCssColor('#fef08a') === true && NotesManager._isLightCssColor('#0f172a') === false, "Détection de luminosité précise");

    // Raccourcis Ctrl+G (gras), Ctrl+I (italique), Ctrl+S (souligné)
    const actionsTriggered = [];
    const origApply = NotesManager.applyFormatting;
    NotesManager.applyFormatting = (action) => actionsTriggered.push(action);
    const origNav = global.navigator;
    global.navigator = { platform: 'Win32' };
    try {
      const makeKeyEvt = (key) => ({
        key,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }
      });
      const eg = makeKeyEvt('g');
      const ei = makeKeyEvt('i');
      const es = makeKeyEvt('s');
      NotesManager.handleKeyDown(eg);
      NotesManager.handleKeyDown(ei);
      NotesManager.handleKeyDown(es);
      assert.deepStrictEqual(actionsTriggered, ['bold', 'italic', 'underline'], "Ctrl+G, Ctrl+I, Ctrl+S déclenchent bold, italic, underline");
      assert(eg.prevented && ei.prevented && es.prevented && es.stopped, "Ctrl+G/I/S empêchent les comportements navigateur");
    } finally {
      NotesManager.applyFormatting = origApply;
      global.navigator = origNav;
    }

    // Puces & listes mixtes dans simpleMarkdownToHtml + CSS multi-niveaux
    const mixedMdHtml = NotesManager.simpleMarkdownToHtml("Intro:\n- Premier point\n- Second point");
    assert(mixedMdHtml.includes('<p>Intro:</p>') && mixedMdHtml.includes('<ul class="obsidian-list">'), "Listes à puces après ligne simple regroupées dans <ul>");
    assert(cssCode.includes('.notes-rich-editor ul ul'), "Puces hiérarchiques multi-niveaux stylées en CSS");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS LIENS & AUTOMATISATIONS : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");
  if (failed > 0) process.exit(1);
}

runTests();
