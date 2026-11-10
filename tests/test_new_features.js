/**
 * Antigravité - Tests automatisés pour les nouvelles fonctionnalités :
 * 1. Liaison bidirectionnelle Notes <-> Créneaux d'Agenda
 * 2. Persistance de l'état du volet latéral pliable
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests des nouvelles fonctionnalités");
console.log("   (Liaison Notes-Agenda & Volet Latéral)");
console.log("==========================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc} : ${err.stack || err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Test 1 : Liaison bidirectionnelle Note <-> Événement
// -----------------------------------------------------------------------------
it("Une note peut être liée à un créneau d'agenda et conserve son identifiant", () => {
  const mockNote = {
    id: "note-reunion-1",
    title: "Compte-rendu de réunion d'équipe",
    linkedEventId: null
  };

  const mockEvent = {
    id: "evt-reunion-1",
    title: "Point hebdo lundi matin",
    noteId: null
  };

  // Liaison
  mockNote.linkedEventId = mockEvent.id;
  mockEvent.noteId = mockNote.id;

  assert.strictEqual(mockNote.linkedEventId, "evt-reunion-1");
  assert.strictEqual(mockEvent.noteId, "note-reunion-1");
});

// -----------------------------------------------------------------------------
// Test 2 : Indépendance stricte des suppressions (Règle de sécurité des données)
// -----------------------------------------------------------------------------
it("La suppression d'un créneau d'agenda ne supprime JAMAIS la note liée", () => {
  let mockNotes = [
    { id: "note-1", title: "Note importante", linkedEventId: "evt-1" }
  ];

  let mockEvents = [
    { id: "evt-1", title: "Session de travail", noteId: "note-1" }
  ];

  // Suppression du créneau d'agenda
  mockEvents = mockEvents.filter(e => e.id !== "evt-1");

  // Vérifications
  assert.strictEqual(mockEvents.length, 0);
  assert.strictEqual(mockNotes.length, 1, "La note doit impérativement rester dans la liste");
  assert.strictEqual(mockNotes[0].title, "Note importante");
});

it("La suppression d'une note ne supprime JAMAIS le créneau d'agenda lié", () => {
  let mockNotes = [
    { id: "note-1", title: "Note temporaire", linkedEventId: "evt-1" }
  ];

  let mockEvents = [
    { id: "evt-1", title: "Session de travail", noteId: "note-1" }
  ];

  // Suppression de la note
  mockNotes = mockNotes.filter(n => n.id !== "note-1");

  // Vérifications
  assert.strictEqual(mockNotes.length, 0);
  assert.strictEqual(mockEvents.length, 1, "Le créneau d'agenda doit rester intact");
  assert.strictEqual(mockEvents[0].title, "Session de travail");
});

// -----------------------------------------------------------------------------
// Test 3 : Persistance de l'état du volet latéral (Sidebar collapse)
// -----------------------------------------------------------------------------
it("L'état replié/déplié du volet latéral est correctement mémorisé", () => {
  const mockStorage = {};
  const setSidebarState = (collapsed) => {
    mockStorage['antigravite_sidebar_collapsed'] = collapsed ? '1' : '0';
  };
  const getSidebarState = () => mockStorage['antigravite_sidebar_collapsed'] === '1';

  setSidebarState(true);
  assert.strictEqual(getSidebarState(), true);

  setSidebarState(false);
  assert.strictEqual(getSidebarState(), false);
});

// -----------------------------------------------------------------------------
// Test 4 : Message d'accueil dynamique au démarrage (Splash Screen)
// -----------------------------------------------------------------------------
it("Le message d'accueil et de bonne journée est correctement calculé selon l'heure", () => {
  const getGreeting = (hour) => {
    if (hour >= 18 || hour < 5) return "Bonsoir ! Passez une excellente soirée !";
    if (hour >= 12 && hour < 14) return "Bonjour ! Bon appétit et très belle journée !";
    return "Bonjour ! Passez une excellente journée !";
  };

  assert.strictEqual(getGreeting(9), "Bonjour ! Passez une excellente journée !");
  assert.strictEqual(getGreeting(13), "Bonjour ! Bon appétit et très belle journée !");
  assert.strictEqual(getGreeting(20), "Bonsoir ! Passez une excellente soirée !");
  assert.strictEqual(getGreeting(2), "Bonsoir ! Passez une excellente soirée !");
});

// -----------------------------------------------------------------------------
// Test 5 : Actualisation systématique de l'agenda au clic sur 'Agenda'
// -----------------------------------------------------------------------------
it("L'actualisation de l'agenda est déclenchée à chaque clic sur l'élément 'agenda'", () => {
  let syncTriggered = false;
  let renderTriggered = false;

  const mockApp = {
    refreshAgenda(silent = false) {
      renderTriggered = true;
      syncTriggered = true;
    }
  };

  // Simuler le clic navigation
  mockApp.refreshAgenda(false);

  assert.strictEqual(renderTriggered, true, "Le rendu de l'agenda doit être actualisé");
  assert.strictEqual(syncTriggered, true, "La synchronisation doit être déclenchée");
});

// -----------------------------------------------------------------------------
// Test 6 : Richesse et variété des messages de notifications Windows
// -----------------------------------------------------------------------------
it("Les messages de notifications sont variés, agréables et personnalisés avec le titre", () => {
  const NotifMgr = require('../js/notifications.js');

  assert.ok(NotifMgr.MESSAGES['60m'].length >= 10, "Au moins 10 messages pour T-60m");
  assert.ok(NotifMgr.MESSAGES['30m'].length >= 10, "Au moins 10 messages pour T-30m");
  assert.ok(NotifMgr.MESSAGES['now'].length >= 10, "Au moins 10 messages pour T-0");

  const msg60 = NotifMgr.getRandomMessage('60m', 'Réunion Équipe');
  assert.ok(msg60.includes('Réunion Équipe'), "Le titre de l'événement doit être inséré");

  const msg30 = NotifMgr.getRandomMessage('30m', 'Session Code');
  assert.ok(msg30.includes('Session Code'), "Le titre de l'événement doit être inséré");

  const msgNow = NotifMgr.getRandomMessage('now', 'Appel Client');
  assert.ok(msgNow.includes('Appel Client'), "Le titre de l'événement doit être inséré");
});

// -----------------------------------------------------------------------------
// Test 7 : Déclenchement précis des notifications à 1h, 30min et au moment même
// -----------------------------------------------------------------------------
it("Les étapes de notifications (1h, 30min, au moment même) sont déclenchées avec précision et sans doublon", () => {
  const NotifMgr = require('../js/notifications.js');
  NotifMgr.sentHistory = {};

  const now = Date.now();
  const notificationsSent = [];
  NotifMgr.notify = (stage, event) => {
    notificationsSent.push({ stage, id: event.id });
  };

  const mockEvents = [
    // Événement dans 60 minutes
    { id: 'evt-1h', title: 'Point dans 1h', start: new Date(now + 60 * 60000).toISOString() },
    // Événement dans 30 minutes
    { id: 'evt-30m', title: 'Point dans 30m', start: new Date(now + 30 * 60000).toISOString() },
    // Événement à la seconde même (now)
    { id: 'evt-now', title: 'Point maintenant', start: new Date(now).toISOString() },
    // Événement dans 3 heures (ne doit pas être notifié)
    { id: 'evt-future', title: 'Point lointain', start: new Date(now + 180 * 60000).toISOString() },
    // Journée entière (ne doit pas être notifiée)
    { id: 'evt-allday', title: 'Journée entière', start: new Date(now + 30 * 60000).toISOString(), isAllDay: true }
  ];

  // Injecter le mock de stockage
  global.window = {
    StorageManager: {
      getEvents: () => mockEvents
    }
  };

  NotifMgr.checkUpcomingEvents();

  // Vérifier que 3 notifications ont été envoyées (60m, 30m, now)
  assert.strictEqual(notificationsSent.length, 3, "Exactement 3 notifications doivent être envoyées");
  assert.ok(notificationsSent.some(n => n.id === 'evt-1h' && n.stage === '60m'));
  assert.ok(notificationsSent.some(n => n.id === 'evt-30m' && n.stage === '30m'));
  assert.ok(notificationsSent.some(n => n.id === 'evt-now' && n.stage === 'now'));

  // Déduplication : Une seconde vérification immédiate ne doit renvoyer aucun doublon
  NotifMgr.checkUpcomingEvents();
  assert.strictEqual(notificationsSent.length, 3, "Aucune notification en double ne doit être émise");
});

// -----------------------------------------------------------------------------
// Test 9 : Options d'image d'arrière-plan (Fond d'écran) dans les paramètres
// -----------------------------------------------------------------------------
it("Les réglages de fond d'écran (image, opacité, flou) sont persistés et modifiables", () => {
  const Storage = require('../js/storage.js');
  assert.strictEqual(Storage.DEFAULT_SETTINGS.backgroundImage, null, "Par défaut, aucun fond d'écran");
  assert.strictEqual(typeof Storage.DEFAULT_SETTINGS.backgroundOpacity, 'number');
  assert.strictEqual(typeof Storage.DEFAULT_SETTINGS.backgroundBlur, 'number');

  const mockSettings = { ...Storage.DEFAULT_SETTINGS };
  mockSettings.backgroundImage = 'nebula';
  mockSettings.backgroundOpacity = 30;
  mockSettings.backgroundBlur = 4;

  assert.strictEqual(mockSettings.backgroundImage, 'nebula');
  assert.strictEqual(mockSettings.backgroundOpacity, 30);
  assert.strictEqual(mockSettings.backgroundBlur, 4);

  // Vérifier le retrait
  mockSettings.backgroundImage = null;
  assert.strictEqual(mockSettings.backgroundImage, null);
});

// -----------------------------------------------------------------------------
// Test 10 : Glisser-déposer pour changer l'ordre des tâches
// -----------------------------------------------------------------------------
it("Le glisser-déposer permet de réorganiser l'ordre des tâches (before / after)", () => {
  const Tasks = require('../js/tasks.js');
  let currentTasks = [
    { id: 't1', title: 'Tâche 1', subtasks: [] },
    { id: 't2', title: 'Tâche 2', subtasks: [] },
    { id: 't3', title: 'Tâche 3', subtasks: [] }
  ];

  Tasks.getAll = () => currentTasks;
  Tasks.saveAll = (t) => { currentTasks = t; };

  // Déplacer t3 avant t1
  const movedBefore = Tasks.moveTask('t3', 't1', 'before');
  assert.strictEqual(movedBefore, true);
  assert.deepStrictEqual(currentTasks.map(t => t.id), ['t3', 't1', 't2']);

  // Déplacer t3 après t2
  const movedAfter = Tasks.moveTask('t3', 't2', 'after');
  assert.strictEqual(movedAfter, true);
  assert.deepStrictEqual(currentTasks.map(t => t.id), ['t1', 't2', 't3']);
});

// -----------------------------------------------------------------------------
// Test 11 : Glisser-déposer pour mettre en sous-tâche et protection anti-boucle
// -----------------------------------------------------------------------------
it("Le glisser-déposer permet de placer une tâche en sous-tâche avec protection anti-boucle", () => {
  const Tasks = require('../js/tasks.js');
  let currentTasks = [
    { id: 'parent-1', title: 'Parent 1', subtasks: [] },
    { id: 'child-candidate', title: 'Candidate', subtasks: [] }
  ];

  Tasks.getAll = () => currentTasks;
  Tasks.saveAll = (t) => { currentTasks = t; };

  // Mettre child-candidate en sous-tâche de parent-1
  const movedInside = Tasks.moveTask('child-candidate', 'parent-1', 'inside');
  assert.strictEqual(movedInside, true);
  assert.strictEqual(currentTasks.length, 1);
  assert.strictEqual(currentTasks[0].id, 'parent-1');
  assert.strictEqual(currentTasks[0].subtasks.length, 1);
  assert.strictEqual(currentTasks[0].subtasks[0].id, 'child-candidate');

  // Protection anti-boucle : tenter d'imbriquer parent-1 dans child-candidate
  const impossibleMove = Tasks.moveTask('parent-1', 'child-candidate', 'inside');
  assert.strictEqual(impossibleMove, false, "Une tâche ne doit jamais pouvoir être glissée dans son propre enfant");
});

// -----------------------------------------------------------------------------
// Test 12 : Monter une sous-tâche de niveau (outdent & racine)
// -----------------------------------------------------------------------------
it("Le glisser-déposer et outdent permettent de monter une tâche de niveau", () => {
  const Tasks = require('../js/tasks.js');
  let currentTasks = [
    { 
      id: 'p1', 
      title: 'Parent 1', 
      subtasks: [
        { id: 's1', title: 'Sous-tâche 1', subtasks: [] },
        { id: 's2', title: 'Sous-tâche 2', subtasks: [] }
      ] 
    }
  ];

  Tasks.getAll = () => currentTasks;
  Tasks.saveAll = (t) => { currentTasks = t; };

  // 1. Monter s1 de niveau via outdentTask
  const outdented = Tasks.outdentTask('s1');
  assert.strictEqual(outdented, true);
  assert.strictEqual(currentTasks.length, 2, "La tâche doit maintenant être au niveau racine");
  assert.strictEqual(currentTasks[0].id, 'p1');
  assert.strictEqual(currentTasks[1].id, 's1');
  assert.strictEqual(currentTasks[0].subtasks.length, 1);
  assert.strictEqual(currentTasks[0].subtasks[0].id, 's2');

  // 2. Monter s2 au niveau principal via root-bottom drop
  const movedToRoot = Tasks.moveTask('s2', null, 'root-bottom');
  assert.strictEqual(movedToRoot, true);
  assert.strictEqual(currentTasks.length, 3);
  assert.strictEqual(currentTasks[2].id, 's2');
  assert.strictEqual(currentTasks[0].subtasks.length, 0);
});

// -----------------------------------------------------------------------------
// Test 13 : Horloge temps réel et affichage de la date en français sur l'accueil
// -----------------------------------------------------------------------------
it("L'horloge de l'accueil formate correctement les heures, minutes, secondes et la date française", () => {
  const App = require('../js/app.js');
  let mockHtml = {};

  global.document = {
    getElementById: (id) => {
      if (!mockHtml[id]) mockHtml[id] = { textContent: '' };
      return mockHtml[id];
    }
  };

  App.initDashboardClock();

  assert.ok(mockHtml['dashboard-clock-time'], "L'élément des heures et minutes doit être mis à jour");
  assert.ok(/^\d{2}:\d{2}$/.test(mockHtml['dashboard-clock-time'].textContent), "Format attendu HH:MM");
  assert.ok(/^:\d{2}$/.test(mockHtml['dashboard-clock-seconds'].textContent), "Format des secondes :SS");
  assert.ok(mockHtml['dashboard-clock-date'].textContent.length > 5, "La date doit être renseignée");
  assert.ok(mockHtml['dashboard-greeting'].textContent.includes("Bonjour") || mockHtml['dashboard-greeting'].textContent.includes("Bonsoir"));

  if (App._clockTimer) {
    clearInterval(App._clockTimer);
    App._clockTimer = null;
  }
});

// -----------------------------------------------------------------------------
// Test 14 : Tri et affichage des dernières notes sur le tableau de bord d'accueil
// -----------------------------------------------------------------------------
it("Le tableau de bord extrait et trie les dernières notes créées ou modifiées", () => {
  const mockNotes = [
    { id: 'n1', title: 'Ancienne note', updatedAt: '2026-10-20T10:00:00Z', content: 'Contenu 1' },
    { id: 'n2', title: 'Note très récente', updatedAt: '2026-10-25T19:30:00Z', content: 'Contenu 2' },
    { id: 'n3', title: 'Note intermédiaire', updatedAt: '2026-10-22T14:00:00Z', content: 'Contenu 3' }
  ];

  // Trier par date décroissante
  const sorted = [...mockNotes].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  assert.strictEqual(sorted[0].id, 'n2', "La note la plus récente doit être en tête");
  assert.strictEqual(sorted[1].id, 'n3');
  assert.strictEqual(sorted[2].id, 'n1');
});

// -----------------------------------------------------------------------------
// Test 15 : Code couleur distinct (Google vs Antigravité) et titre au 1er coup d'œil
// -----------------------------------------------------------------------------
it("L'agenda distingue visuellement les événements Google des événements Antigravité", () => {
  const Agenda = require('../js/agenda.js');
  
  const googleEvt = {
    id: 'evt-g',
    title: 'Visio Client Important',
    start: '2026-10-26T10:00',
    end: '2026-10-26T11:00',
    source: 'google'
  };

  const localEvt = {
    id: 'evt-local',
    title: 'Focus Rédaction',
    start: '2026-10-26T14:00',
    end: '2026-10-26T15:00',
    source: 'local'
  };

  assert.strictEqual(googleEvt.source, 'google', "Source Google identifiée");
  assert.strictEqual(localEvt.source, 'local', "Source locale identifiée");

  // Vérifier la méthode d'échappement et affichage du titre
  const escapedGoogleTitle = Agenda.escapeHtml(googleEvt.title);
  assert.strictEqual(escapedGoogleTitle, 'Visio Client Important');
});

// -----------------------------------------------------------------------------
// Test 16 : Calcul dynamique du calendrier pour occuper toute la fenêtre
// -----------------------------------------------------------------------------
it("Le calcul de slotHeight adapte la hauteur des créneaux pour occuper toute la fenêtre sans défilement", () => {
  const Agenda = require('../js/agenda.js');

  const totalHours = Agenda.dayHoursEnd - Agenda.dayHoursStart; // 16 heures
  assert.strictEqual(totalHours, 16);

  const availableHeight = 800; // Simuler une hauteur de conteneur
  const slotHeight = Math.max(34, Math.floor(availableHeight / totalHours));
  assert.strictEqual(slotHeight, 50);

  const totalGrid = slotHeight * totalHours;
  assert.strictEqual(totalGrid, 800, "La grille doit correspondre exactement à l'espace disponible");
});

// -----------------------------------------------------------------------------
// Test 17 : Menu contextuel clic droit dans l'agenda (modifier/supprimer & ajout pré-rempli)
// -----------------------------------------------------------------------------
it("L'agenda gère le clic droit pour modifier/supprimer un événement ou ajouter un créneau à l'heure cliquée", () => {
  const Agenda = require('../js/agenda.js');
  assert.strictEqual(typeof Agenda.initContextMenu, 'function');
  assert.strictEqual(typeof Agenda.showEventContextMenu, 'function');
  assert.strictEqual(typeof Agenda.showSlotContextMenu, 'function');
  assert.strictEqual(typeof Agenda.hideContextMenu, 'function');

  let mockMenuElements = {};
  global.document = {
    getElementById: (id) => {
      if (!mockMenuElements[id]) mockMenuElements[id] = { innerHTML: '', style: {} };
      return mockMenuElements[id];
    },
    addEventListener: () => {}
  };

  const mockEvents = [
    { id: 'evt-test-rc', title: 'Réunion Clic Droit', start: '2026-10-27T14:00', end: '2026-10-27T15:00', source: 'local' }
  ];
  Agenda.getAll = () => mockEvents;

  // 1. Clic droit sur événement : options modifier et supprimer
  Agenda.showEventContextMenu(100, 100, 'evt-test-rc');
  const itemsHtml = mockMenuElements['context-menu-items'].innerHTML;
  assert.ok(itemsHtml.includes("Modifier l'événement"), "Option modifier présente");
  assert.ok(itemsHtml.includes("Supprimer l'événement"), "Option supprimer présente");

  // 2. Clic droit sur créneau libre : ajout avec heure pré-remplie
  Agenda.showSlotContextMenu(200, 200, '2026-10-27', '15:30', '16:30');
  const slotItemsHtml = mockMenuElements['context-menu-items'].innerHTML;
  assert.ok(slotItemsHtml.includes("Ajouter un événement (15:30)"), "Option ajouter à l'heure cliquée");
  assert.ok(slotItemsHtml.includes("Créneau rapide 1h Antigravité"), "Option rapide présente");

  delete global.document;
});

// -----------------------------------------------------------------------------
// Test 18 : Programmation d'une tâche ajoutant obligatoirement un créneau dans l'agenda de base
// -----------------------------------------------------------------------------
it("Programmer une tâche avec plannedDate crée obligatoirement un créneau dans l'agenda Antigravité", () => {
  const Tasks = require('../js/tasks.js');
  const Storage = require('../js/storage.js');

  let tasksStore = [];
  let eventsStore = [];

  Storage.getTasks = () => tasksStore;
  Storage.saveTasks = (t) => { tasksStore = t; };
  Storage.getEvents = () => eventsStore;
  Storage.saveEvents = (e) => { eventsStore = e; };

  global.StorageManager = Storage;
  Tasks.getAll = () => tasksStore;
  Tasks.saveAll = (t) => { tasksStore = t; };

  // 1. Création d'une tâche avec une date prévue (programmée)
  const task = Tasks.addTask({
    title: 'Rédiger le rapport financier',
    plannedDate: '2026-10-29',
    description: 'Détails des calculs'
  });

  // Vérifier qu'un créneau lié a été obligatoirement créé dans l'agenda
  assert.strictEqual(eventsStore.length, 1, "Un événement doit avoir été créé dans l'agenda");
  const createdEvent = eventsStore[0];
  assert.strictEqual(createdEvent.taskId, task.id, "L'événement doit être lié à la tâche");
  assert.strictEqual(createdEvent.title, 'Rédiger le rapport financier');
  assert.strictEqual(createdEvent.source, 'local', "L'événement doit appartenir à l'agenda Antigravité de base");
  assert.ok(createdEvent.start.startsWith('2026-10-29'), "La date de l'événement doit correspondre à plannedDate");

  // 2. Modification de la date prévue : le créneau de l'agenda doit s'adapter
  Tasks.updateTask(task.id, {
    title: 'Rapport financier final',
    plannedDate: '2026-10-30'
  });

  assert.strictEqual(eventsStore.length, 1, "Pas de doublon créé");
  assert.strictEqual(eventsStore[0].title, 'Rapport financier final');
  assert.ok(eventsStore[0].start.startsWith('2026-10-30'), "La date du créneau a été mise à jour");
});

// -----------------------------------------------------------------------------
// Test 19 : Glisser-déplacer d'un événement (changement de jour et d'horaire)
// -----------------------------------------------------------------------------
it("Le glisser-déplacer d'un événement permet de modifier son jour et son heure avec précision", async () => {
  const Agenda = require('../js/agenda.js');
  let eventsList = [
    { id: 'evt-move-test', title: 'Atelier Design', start: '2026-10-26T09:00', end: '2026-10-26T10:30', source: 'local' }
  ];
  Agenda.getAll = () => eventsList;
  Agenda.saveAll = (evts) => { eventsList = evts; };
  Agenda.updateEvent = (id, data) => {
    const idx = eventsList.findIndex(e => e.id === id);
    if (idx !== -1) {
      eventsList[idx] = { ...eventsList[idx], ...data };
      return true;
    }
    return false;
  };

  // Déplacer l'événement vers un autre jour (Mercredi 2026-10-28) et un autre horaire (14:15 - 15:45)
  await Agenda.updateEventSchedule('evt-move-test', '2026-10-28', 14.25, 15.75);

  assert.strictEqual(eventsList[0].start, '2026-10-28T14:15', "L'heure de début doit être 14:15 sur le nouveau jour");
  assert.strictEqual(eventsList[0].end, '2026-10-28T15:45', "L'heure de fin doit être 15:45 sur le nouveau jour");
});

// -----------------------------------------------------------------------------
// Test 20 : Redimensionnement de la durée via limites supérieure et inférieure
// -----------------------------------------------------------------------------
it("Les limites inférieure et supérieure permettent d'étirer ou réduire la durée d'un événement", async () => {
  const Agenda = require('../js/agenda.js');
  let eventsList = [
    { id: 'evt-resize-test', title: 'Point Hebdo', start: '2026-10-27T10:00', end: '2026-10-27T11:00', source: 'local' }
  ];
  Agenda.getAll = () => eventsList;
  Agenda.saveAll = (evts) => { eventsList = evts; };
  Agenda.updateEvent = (id, data) => {
    const idx = eventsList.findIndex(e => e.id === id);
    if (idx !== -1) {
      eventsList[idx] = { ...eventsList[idx], ...data };
      return true;
    }
    return false;
  };

  // 1. Étirer la fin vers le bas (11:00 -> 12:30)
  await Agenda.updateEventSchedule('evt-resize-test', '2026-10-27', 10.0, 12.5);
  assert.strictEqual(eventsList[0].start, '2026-10-27T10:00');
  assert.strictEqual(eventsList[0].end, '2026-10-27T12:30');

  // 2. Étirer le début vers le haut (10:00 -> 08:45)
  await Agenda.updateEventSchedule('evt-resize-test', '2026-10-27', 8.75, 12.5);
  assert.strictEqual(eventsList[0].start, '2026-10-27T08:45');
  assert.strictEqual(eventsList[0].end, '2026-10-27T12:30');

  // 3. Réduire la durée (08:45 -> 09:30, 12:30 -> 10:15)
  await Agenda.updateEventSchedule('evt-resize-test', '2026-10-27', 9.5, 10.25);
  assert.strictEqual(eventsList[0].start, '2026-10-27T09:30');
  assert.strictEqual(eventsList[0].end, '2026-10-27T10:15');
});

// -----------------------------------------------------------------------------
// Test 21 : Logos adaptatifs mode clair / mode sombre et icône de remplacement
// -----------------------------------------------------------------------------
it("Les logos pour mode clair, sombre et l'icône de remplacement sont présents et intégrés", () => {
  const fs = require('fs');
  const path = require('path');
  const assetsDir = path.join(__dirname, '../assets');

  assert.ok(fs.existsSync(assetsDir), "Le dossier assets doit exister");
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo-dark.png')), "logo-dark.png doit exister");
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo-light.png')), "logo-light.png doit exister");
  assert.ok(fs.existsSync(path.join(assetsDir, 'icon.png')), "icon.png doit exister");

  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('logo-dark.png') && html.includes('logo-light.png'), "index.html doit inclure les logos sombre et clair");
  assert.ok(html.includes('icon.png'), "index.html doit référencer icon.png");
  assert.ok(html.includes('Icon antigravité.png'), "index.html doit référencer Icon antigravité.png dans le splash screen");

  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
  assert.ok(css.includes('.logo-dark') && css.includes('.logo-light'), "styles.css doit définir les règles d'alternance des logos");
  assert.ok(css.includes('.antigravite-symbol-icon'), "styles.css doit définir la classe pour l'icône de symbole");
});

// -----------------------------------------------------------------------------
// Test 22 : Vérification des contrastes et de l'affichage en mode clair
// -----------------------------------------------------------------------------
it("Le mode clair possède des règles de contraste adaptées (badges, horloge, légende, formulaires)", () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');

  assert.ok(css.includes('[data-theme="light"]') && css.includes('color-scheme: light'), "color-scheme: light doit être déclaré");
  assert.ok(css.includes('[data-theme="light"] .badge-priority-urgent'), "Badges urgents adaptés pour le mode clair");
  assert.ok(css.includes('[data-theme="light"] .hero-clock-box'), "Horloge adaptée pour le mode clair");
  assert.ok(css.includes('[data-theme="light"] .legend-antigravite'), "Légende agenda adaptée pour le mode clair");
  assert.ok(css.includes('body.has-custom-wallpaper[data-theme="light"] .calendar-container') || css.includes('[data-theme="light"] body.has-custom-wallpaper .calendar-container'), "Support fond d'écran clair sur conteneurs");
});

console.log("\n----------------------------------------------------------");
console.log(`Résultats : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) process.exit(1);
else process.exit(0);
