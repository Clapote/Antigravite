/**
 * Antigravité - Tests automatisés des fonctionnalités v1.2.4
 * 
 * Vérifications couvertes :
 * 1. Synchronisation de la version 1.2.4 (package.json, index.html, app.js, settings.js).
 * 2. Présence de l'encart Changelog Version 1.2.4 dans les paramètres.
 * 3. Existence et structure du script Tester-Antigravite-1.2.4.bat.
 * 4. Gestionnaire de Tâches : barre d'onglets de tri/regroupement (Mon ordre, Date de création, Priorité, Par projet).
 * 5. Gestionnaire de Tâches : Algorithme de tri par date de création (_sortTasksByCreated, récursif avec sous-tâches).
 * 6. Gestionnaire de Tâches : Algorithme de tri par priorité (_sortTasksByPriority, récursif urgent > high > medium > low).
 * 7. Gestionnaire de Tâches : Regroupement par projet (.tasks-project-group, sans altération de l'ordre manuel).
 * 8. Agenda : Détection des créneaux d'une heure (isOneHour, height <= 58) et classe .slot-1h.
 * 9. Agenda : Priorisation du nom de l'événement et badge de tâche compact sans coupure de mots.
 * 10. Styles CSS v1.2.4 : word-break normal, overflow-wrap, et règles dédiées aux créneaux 1h.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(`        ${err.message}\n`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des fonctionnalités v1.2.4");
  console.log("   (Tri/Regroupement des Tâches & Confort Agenda 1h)");
  console.log("==========================================================");

  // 1. Version 1.2.4 ou supérieure synchronisée
  await it("1.1 Version 1.2.4 ou supérieure synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert(pkg.version === '1.2.4' || pkg.version === '1.2.5', "package.json doit être en version 1.2.4 ou supérieure");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes(`id="updater-current-version-label">${pkg.version}</strong>`), "index.html affiche la version courante");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes(`APP_VERSION: '${pkg.version}'`), "app.js est configuré sur la version courante");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes(`currentVersion: '${pkg.version}'`), "settings.js est initialisé avec la version courante");
  });

  // 2. Changelog 1.2.4
  await it("1.2 Changelog officiel de la Version 1.2.4 présent dans les paramètres", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('Version 1.2.4'), "Encart Version 1.2.4 présent dans le Changelog");
    assert(htmlContent.includes('Gestionnaire de Tâches : Barre de tri &amp; regroupement'), "Section tri des tâches dans le Changelog");
    assert(htmlContent.includes('Agenda : Rendu optimisé des créneaux d\'une heure'), "Section créneaux 1h dans le Changelog");
    assert(htmlContent.includes('Priorisation du titre de l\'événement'), "Mention priorisation du titre");
  });

  // 3. Script Tester-Antigravite-1.2.4.bat
  await it("1.3 Tester-Antigravite-1.2.4.bat existe et mentionne la version 1.2.4", () => {
    const batPath = path.join(rootDir, 'Tester-Antigravite-1.2.4.bat');
    assert(fs.existsSync(batPath), "Fichier Tester-Antigravite-1.2.4.bat présent à la racine");
    const batContent = fs.readFileSync(batPath, 'utf8');
    assert(batContent.includes("v1.2.4"), "Mention v1.2.4 présente dans le script batch");
  });

  // 4. Barre d'onglets de tri dans index.html et tasks.js
  await it("1.4 Barre d'onglets de tri des tâches présente dans index.html", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('class="tasks-sort-bar"'), "Conteneur tasks-sort-bar présent");
    assert(htmlContent.includes('data-sort="manual"'), "Onglet Mon ordre présent");
    assert(htmlContent.includes('data-sort="created"'), "Onglet Date de création présent");
    assert(htmlContent.includes('data-sort="priority"'), "Onglet Priorité présent");
    assert(htmlContent.includes('data-sort="project"'), "Onglet Par projet présent");
  });

  // 5. TasksManager expose les méthodes et propriétés de tri
  await it("1.5 TasksManager intègre currentSortMode, setSortMode et getSortModeLabel", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    assert(tasksJs.includes("currentSortMode: 'manual'"), "currentSortMode initialisé à manual");
    assert(tasksJs.includes("setSortMode(mode)"), "Méthode setSortMode présente");
    assert(tasksJs.includes("getSortModeLabel()"), "Méthode getSortModeLabel présente");
    assert(tasksJs.includes("_sortTasksByCreated(list)"), "Méthode _sortTasksByCreated présente");
    assert(tasksJs.includes("_sortTasksByPriority(list)"), "Méthode _sortTasksByPriority présente");
  });

  // 6. Algorithme de tri par date de création (récursif)
  await it("1.6 Tri par date de création classe les tâches de la plus récente à la plus ancienne (récursif)", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    // Évaluer la fonction de tri dans un contexte isolé
    const vm = require('vm');
    const sandbox = { module: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(`
      ${tasksJs}
      var tm = TasksManager;
    `, sandbox);

    const testTasks = [
      { id: '1', title: 'Ancienne', createdAt: '2026-11-01T10:00:00Z', subtasks: [] },
      { id: '2', title: 'Récente', createdAt: '2026-11-19T10:00:00Z', subtasks: [
        { id: '2.1', title: 'Sous-ancienne', createdAt: '2026-11-05T10:00:00Z' },
        { id: '2.2', title: 'Sous-récente', createdAt: '2026-11-18T10:00:00Z' }
      ] },
      { id: '3', title: 'Moyenne', createdAt: '2026-11-10T10:00:00Z', subtasks: [] }
    ];

    const sorted = sandbox.tm._sortTasksByCreated(testTasks);
    assert.strictEqual(sorted[0].id, '2', "La tâche la plus récente (2) doit être première");
    assert.strictEqual(sorted[1].id, '3', "La tâche moyenne (3) doit être deuxième");
    assert.strictEqual(sorted[2].id, '1', "La tâche ancienne (1) doit être troisième");

    // Sous-tâches
    assert.strictEqual(sorted[0].subtasks[0].id, '2.2', "La sous-tâche la plus récente (2.2) doit être première");
    assert.strictEqual(sorted[0].subtasks[1].id, '2.1', "La sous-tâche ancienne (2.1) doit être deuxième");
  });

  // 7. Algorithme de tri par priorité (urgent > high > medium > low)
  await it("1.7 Tri par priorité classe rigoureusement urgent > high > medium > low (récursif)", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const vm = require('vm');
    const sandbox = { module: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(`
      ${tasksJs}
      var tm = TasksManager;
    `, sandbox);

    const testTasks = [
      { id: 't-low', title: 'Basse', priority: 'low', createdAt: '2026-11-10T10:00:00Z' },
      { id: 't-urgent', title: 'Urgente', priority: 'urgent', createdAt: '2026-11-01T10:00:00Z' },
      { id: 't-med', title: 'Normale', priority: 'medium', createdAt: '2026-11-15T10:00:00Z' },
      { id: 't-high', title: 'Élevée', priority: 'high', createdAt: '2026-11-05T10:00:00Z', subtasks: [
        { id: 'sub-low', title: 'Sous basse', priority: 'low' },
        { id: 'sub-urg', title: 'Sous urgente', priority: 'urgent' }
      ] }
    ];

    const sorted = sandbox.tm._sortTasksByPriority(testTasks);
    assert.strictEqual(sorted[0].id, 't-urgent', "Urgent en premier");
    assert.strictEqual(sorted[1].id, 't-high', "High en deuxième");
    assert.strictEqual(sorted[2].id, 't-med', "Medium en troisième");
    assert.strictEqual(sorted[3].id, 't-low', "Low en dernier");

    assert.strictEqual(sorted[1].subtasks[0].id, 'sub-urg', "Sous-tâche urgente première");
    assert.strictEqual(sorted[1].subtasks[1].id, 'sub-low', "Sous-tâche basse deuxième");
  });

  // 8. Regroupement par projet dans render()
  await it("1.8 TasksManager.render intègre la logique de groupement par projet .tasks-project-group", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    assert(tasksJs.includes("this.currentSortMode === 'project'"), "Cas project géré dans render");
    assert(tasksJs.includes("tasks-project-group"), "Classe tasks-project-group générée");
    assert(tasksJs.includes("tasks-project-group-header"), "Classe tasks-project-group-header générée");
    assert(tasksJs.includes("Sans projet"), "Section Sans projet prise en compte");
  });

  // 9. Agenda : Détection isOneHour et priorisation du titre de l'événement
  await it("1.9 Agenda détecte les créneaux 1h (isOneHour) et injecte la classe slot-1h", () => {
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaJs.includes("const isOneHour = !isCompact && height <= 58;"), "Détection isOneHour présente");
    assert(agendaJs.includes("${isOneHour ? 'slot-1h' : ''}"), "Classe slot-1h appliquée sur calendar-event");
    assert(agendaJs.includes("event-title slot-1h-title"), "Titre optimisé slot-1h-title");
    assert(agendaJs.includes("event-linked-info slot-1h-linked"), "Badge tâche lié slot-1h-linked");
  });

  // 10. Styles CSS pour le tri des tâches et créneaux 1h
  await it("1.10 css/styles.css définit les styles pour tasks-sort-bar et .calendar-event.slot-1h sans coupure de mots", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.tasks-sort-bar'), "Styles .tasks-sort-bar présents");
    assert(cssContent.includes('.tasks-sort-tab'), "Styles .tasks-sort-tab présents");
    assert(cssContent.includes('.tasks-project-group'), "Styles .tasks-project-group présents");
    assert(cssContent.includes('.calendar-event.slot-1h'), "Styles .calendar-event.slot-1h présents");
    assert(cssContent.includes('word-break: normal;'), "word-break: normal garantit la non coupure des mots");
    assert(cssContent.includes('overflow-wrap: break-word;'), "overflow-wrap: break-word garantit la propreté du texte");
  });

  // 11. Mini-Agenda Accueil : Présence des éléments HTML (badges et bascule)
  await it("1.11 index.html intègre le badge de comptage et les boutons de bascule de vue Mini-Agenda / Liste", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="dashboard-events-count-badge"'), "Badge de décompte des créneaux présent");
    assert(htmlContent.includes('id="btn-dashboard-agenda-grid"'), "Bouton vue Mini-Agenda présent");
    assert(htmlContent.includes('id="btn-dashboard-agenda-list"'), "Bouton vue Liste présent");
    assert(htmlContent.includes("App.setDashboardAgendaView('grid')"), "Appel setDashboardAgendaView('grid') présent");
    assert(htmlContent.includes("App.setDashboardAgendaView('list')"), "Appel setDashboardAgendaView('list') présent");
  });

  // 12. Mini-Agenda Accueil : App expose dashboardAgendaView, setDashboardAgendaView et renderDashboardMiniAgenda
  await it("1.12 App expose dashboardAgendaView, setDashboardAgendaView et renderDashboardMiniAgenda", () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appJs.includes("dashboardAgendaView: 'grid'"), "dashboardAgendaView initialisé par défaut à grid");
    assert(appJs.includes("setDashboardAgendaView(view)"), "Méthode setDashboardAgendaView présente");
    assert(appJs.includes("renderDashboardMiniAgenda("), "Méthode renderDashboardMiniAgenda présente");
    assert(appJs.includes("antigravite_dashboard_agenda_view"), "Clé de persistance localStorage présente");
  });

  // 13. Mini-Agenda Accueil : Test fonctionnel de renderDashboardMiniAgenda
  await it("1.13 renderDashboardMiniAgenda génère la timeline, les créneaux, les barres toute la journée et l'indicateur temps réel", () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const vm = require('vm');
    const sandbox = {
      module: {},
      console,
      window: {},
      document: {
        getElementById: () => null
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {}
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(`
      ${appJs}
      var testApp = App;
    `, sandbox);

    const containerMock = { innerHTML: '', querySelector: () => ({ scrollTop: 0 }) };
    const todayStr = '2026-11-19';
    const mockEvents = [
      { id: 'ev-all', title: 'Séminaire Annuel', isAllDay: true, completed: false },
      { id: 'ev-1', title: 'Atelier Design UX & Recherche Utilisateur Approfondie', start: `${todayStr}T09:00:00`, end: `${todayStr}T10:30:00`, completed: true },
      { id: 'ev-2', title: 'Point Synchronisation', start: `${todayStr}T14:00:00`, end: `${todayStr}T14:30:00`, completed: false, taskId: 'task-1' }
    ];
    const mockTasks = [
      { id: 'task-1', title: 'Préparer la roadmap v1.2.4', completed: false }
    ];
    const mockProjects = [
      { id: 'p1', title: 'Projet Principal', color: '#8b5cf6' }
    ];

    sandbox.testApp.renderDashboardMiniAgenda(containerMock, mockEvents, todayStr, mockTasks, mockProjects);

    assert(containerMock.innerHTML.includes('dashboard-mini-agenda'), "Conteneur dashboard-mini-agenda généré");
    assert(containerMock.innerHTML.includes('mini-agenda-allday-bar'), "Bandeau événements toute la journée généré");
    assert(containerMock.innerHTML.includes('Séminaire Annuel'), "Titre événement journée entière affiché");
    assert(containerMock.innerHTML.includes('mini-agenda-hour-cell'), "Cellules horaires de la journée générées");
    assert(containerMock.innerHTML.includes('09:00 - 10:30'), "Plage horaire formatée pour le créneau standard");
    assert(containerMock.innerHTML.includes('Atelier Design UX'), "Titre de l'événement présent");
    assert(containerMock.innerHTML.includes('mini-agenda-event-block'), "Blocs de créneaux positionnés dans la grille");
  });

  // 14. Styles CSS du Mini-Agenda dans styles.css
  await it("1.14 css/styles.css intègre les styles visuels complets pour le Mini-Agenda et la lisibilité", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.dashboard-mini-agenda'), "Styles .dashboard-mini-agenda présents");
    assert(cssContent.includes('.dashboard-mini-agenda-scroll'), "Styles .dashboard-mini-agenda-scroll avec overflow-y présents");
    assert(cssContent.includes('.mini-agenda-grid-wrapper'), "Styles .mini-agenda-grid-wrapper présents");
    assert(cssContent.includes('.mini-agenda-time-col'), "Styles .mini-agenda-time-col présents");
    assert(cssContent.includes('.mini-agenda-now-line'), "Styles .mini-agenda-now-line présents");
    assert(cssContent.includes('.mini-agenda-event-block'), "Styles .mini-agenda-event-block présents");
    assert(cssContent.includes('.mini-event-title.standard'), "Styles .mini-event-title.standard présents");
    assert(cssContent.includes('text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);'), "text-shadow pour garantir la lisibilité optimale");
    assert(cssContent.includes('.btn-dashboard-agenda-view'), "Styles boutons de bascule de vue .btn-dashboard-agenda-view présents");
  });

  // 15. Confort de l'Accueil : Agencement aéré d'avant avec défilement vertical naturel
  await it("1.15 css/styles.css et app.js restaurent l'agencement aéré de l'accueil avec défilement vertical naturel", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('#screen-home.screen-view'), "Règle dédiée #screen-home.screen-view présente");
    assert(cssContent.includes('padding: 24px 28px;'), "Padding aéré et confortable restauré sur l'écran d'accueil");
    assert(cssContent.includes('overflow-y: auto;'), "Défilement vertical naturel restauré sur l'accueil si nécessaire");
    assert(cssContent.includes('min-height: 340px;'), "Taille généreuse et harmonieuse pour les modules .dashboard-panel");
    assert(cssContent.includes('#dashboard-planned-tasks,'), "Règle de scroll interne dédiée pour les tâches du dashboard");
    assert(cssContent.includes('#dashboard-today-events,'), "Règle de scroll interne dédiée pour les événements du dashboard");
    assert(cssContent.includes('#dashboard-recent-notes'), "Règle de scroll interne dédiée pour les notes du dashboard");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes('hourHeight = 28;'), "Hauteur confortable de 28px par heure pour une excellente lisibilité");
  });

  // 16. Agenda Journée Entière : Intégrité des fenêtres et troncature des titres longs
  await it("1.16 Agenda : Préservation stricte de l'alignement des 7 colonnes et troncature des titres longs en journée entière", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('grid-template-columns: 55px repeat(7, minmax(0, 1fr));'), "CSS Grid utilise repeat(7, minmax(0, 1fr)) pour empêcher tout décalage");
    assert(cssContent.includes('.calendar-allday-cell') && cssContent.includes('min-width: 0;'), "Cellule all-day a min-width: 0 pour ne pas étirer la colonne");
    assert(cssContent.includes('.allday-event-pill') && cssContent.includes('min-width: 0;'), "Pastille all-day a min-width: 0");
    assert(cssContent.includes('.allday-pill-title') && cssContent.includes('text-overflow: ellipsis;'), "Titre de la pastille tronqué avec ellipse (...)");

    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaCode.includes("alldayEl.style.gridTemplateColumns = '55px repeat(7, minmax(0, 1fr))';"), "AgendaManager applique minmax(0, 1fr) dynamiquement au bandeau journée entière");
  });

  // 17. Navigation Agenda : Retour automatique sur la semaine courante
  await it("1.17 AgendaManager.resetToCurrentWeek réinitialise la vue sur la semaine courante", () => {
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaCode.includes('resetToCurrentWeek()'), "Méthode resetToCurrentWeek définie sur AgendaManager");
    assert(agendaCode.includes("this.currentView = 'week';"), "resetToCurrentWeek remet la vue en mode semaine");
    assert(agendaCode.includes("this.currentWeekStart = this.getMonday(now);"), "resetToCurrentWeek réinitialise le début de semaine au lundi actuel");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("AgendaManager.resetToCurrentWeek()"), "App.navigate('agenda') appelle resetToCurrentWeek pour toujours revenir à la semaine en cours");
  });

  // 18. Correcteur orthographique Electron en français
  await it("1.18 main.js configure le correcteur orthographique en français exclusivement", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes("app.commandLine.appendSwitch('lang', 'fr-FR');"), "Switch Chromium lang=fr-FR configuré au démarrage");
    assert(mainCode.includes("setSpellCheckerLanguages(['fr-FR', 'fr'])"), "Langue du correcteur orthographique configurée en français ['fr-FR', 'fr']");
    assert(!mainCode.includes("setSpellCheckerLanguages(['fr', 'en-US'])"), "L'anglais n'est plus prioritaire ou injecté dans le dictionnaire");
  });

  // 19. Alignement parfait des colonnes de jours, de la colonne des heures et de la ligne journée entière
  await it("1.19 css/styles.css garantit l'alignement strict des lignes des heures, des jours et du bandeau journée entière", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.calendar-weekdays') && cssContent.includes('overflow-y: scroll;'), "En-tête semaine réserve le même gutter de scroll");
    assert(cssContent.includes('.calendar-allday-row') && cssContent.includes('overflow-y: scroll;'), "Ligne journée réserve le même gutter de scroll");
    assert(cssContent.includes('.calendar-body') && cssContent.includes('overflow-y: scroll;'), "Corps agenda utilise overflow-y: scroll");
    assert(cssContent.includes('.calendar-allday-gutter') && cssContent.includes('width: 55px;'), "Gutter journée calibré à 55px strict");
    assert(cssContent.includes('.time-gutter') && cssContent.includes('width: 55px;'), "Gutter horaire calibré à 55px strict");
    assert(cssContent.includes('.calendar-allday-row') && cssContent.includes('border-bottom: 1px solid var(--border-color);'), "Bordure inférieure unifiée à 1px sous la ligne journée");
  });

  // 20. Validation universelle des modales par Ctrl+Entrée / Cmd+Entrée
  await it("1.20 js/app.js prend en charge la validation et fermeture des modales par Ctrl+Entrée", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes('e.ctrlKey || e.metaKey') && appCode.includes("e.key === 'Enter' || e.code === 'Enter'"), "Détection de Ctrl+Entrée et Cmd+Entrée présente");
    assert(appCode.includes('#event-modal-save:not(:disabled)') && appCode.includes('#task-modal-save:not(:disabled)'), "Validation automatique pour Agenda et Tâches par Ctrl+Entrée");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="task-modal-save" class="btn btn-primary" title="Enregistrer (Ctrl+Entrée)"'), "Indicateur Ctrl+Entrée sur le bouton de tâche");
    assert(htmlContent.includes('id="event-modal-save" class="btn btn-primary" style="min-width: 170px;" title="Enregistrer le créneau (Ctrl+Entrée)"'), "Indicateur Ctrl+Entrée sur le bouton de créneau agenda");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.4 : ${passedTests} passés, ${failedTests} échoués`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erreur inattendue dans la suite de tests v1.2.4:", err);
  process.exit(1);
});
