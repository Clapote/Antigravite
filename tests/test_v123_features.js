/**
 * Antigravité - Tests automatisés des fonctionnalités et correctifs v1.2.3
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const DebriefManager = require('../js/debrief.js');

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des fonctionnalités v1.2.3");
  console.log("   (Correctifs Débriefing, Créativité & Notes du jour)");
  console.log("==========================================================");

  // 1. Version 1.2.3 synchronisée
  await it("1.1 Version 1.2.3 synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '1.2.3', "package.json doit être en version 1.2.3");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="updater-current-version-label">1.2.3</strong>'), "index.html affiche la version 1.2.3");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("APP_VERSION: '1.2.3'"), "app.js est configuré sur la version 1.2.3");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("currentVersion: '1.2.3'"), "settings.js est initialisé avec 1.2.3");
  });

  // 2. Changelog 1.2.3
  await it("1.2 Changelog officiel de la Version 1.2.3 présent dans les paramètres", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('Version 1.2.3'), "Encart Version 1.2.3 présent dans le Changelog");
    assert(htmlContent.includes('Correctifs Débriefing : Boutons &amp; Validation'), "Section boutons dans le Changelog");
    assert(htmlContent.includes('Section « Temps dédié à la créativité »'), "Section Créativité dans le Changelog");
    assert(htmlContent.includes('Pensées, Écrits &amp; Notes du jour'), "Section Notes dans le Changelog");
  });

  // 3. Script Tester-Antigravite-1.2.3.bat
  await it("1.3 Tester-Antigravite-1.2.3.bat existe et mentionne la version 1.2.3", () => {
    const batPath = path.join(rootDir, 'Tester-Antigravite-1.2.3.bat');
    assert(fs.existsSync(batPath), "Fichier Tester-Antigravite-1.2.3.bat présent à la racine");
    const batContent = fs.readFileSync(batPath, 'utf8');
    assert(batContent.includes("v1.2.3"), "Mention v1.2.3 présente dans le script batch");
  });

  // 4. Exposition globale de DebriefManager
  await it("1.4 js/debrief.js expose DebriefManager sur window.DebriefManager", () => {
    const debriefCode = fs.readFileSync(path.join(rootDir, 'js', 'debrief.js'), 'utf8');
    assert(debriefCode.includes("window.DebriefManager = DebriefManager"), "DebriefManager doit être assigné à window.DebriefManager");
  });

  // 5. Section Temps dédié à la créativité
  await it("1.5 getDailyAccomplishments extrait les créneaux détaillés avec horaires et projets", () => {
    global.StorageManager = {
      getTasks: () => [],
      getProjects: () => [{ id: 'p-crea', title: 'Design & Création', color: '#f59e0b' }],
      getTrash: () => [],
      getEvents: () => [
        {
          id: 'evt-1',
          title: 'Session Conception Créative',
          start: '2026-11-16T09:30:00',
          end: '2026-11-16T11:00:00',
          isAllDay: false,
          projectId: 'p-crea'
        },
        {
          id: 'evt-2',
          title: 'Journée Recherche Graphique',
          start: '2026-11-16T00:00:00',
          end: '2026-11-16T23:59:59',
          isAllDay: true,
          projectId: 'p-crea'
        }
      ],
      getNotes: () => []
    };

    const res = DebriefManager.getDailyAccomplishments('2026-11-16');
    assert.strictEqual(res.eventsCount, 2, "2 créneaux d'agenda comptabilisés");
    assert.strictEqual(res.events.length, 2, "2 créneaux formatés retournés");
    
    // Événement All-day
    const allDayEvt = res.events.find(e => e.id === 'evt-2');
    assert(allDayEvt, "Événement all-day trouvé");
    assert.strictEqual(allDayEvt.isAllDay, true);
    assert.strictEqual(allDayEvt.timeLabel, 'Journée entière');
    assert.strictEqual(allDayEvt.project.title, 'Design & Création');

    // Événement minuté
    const timedEvt = res.events.find(e => e.id === 'evt-1');
    assert(timedEvt, "Événement minuté trouvé");
    assert.strictEqual(timedEvt.timeLabel, '09:30 - 11:00');
    assert.strictEqual(timedEvt.durationStr, '1h30');
    assert.strictEqual(timedEvt.project.title, 'Design & Création');
  });

  // 6. Section Pensées & Notes du jour
  await it("1.6 getDailyAccomplishments extrait les notes rédigées avec leur dossier et extrait", () => {
    global.StorageManager = {
      getTasks: () => [],
      getProjects: () => [],
      getTrash: () => [],
      getEvents: () => [],
      getNotes: () => [
        {
          id: 'note-1',
          title: 'Idées pour la prochaine version',
          content: '<p>Voici quelques réflexions sur la fluidité et le confort d\'usage d\'Antigravité...</p>',
          folder: 'Idées',
          createdAt: '2026-11-16T14:15:00',
          updatedAt: '2026-11-16T15:20:00'
        }
      ]
    };

    const res = DebriefManager.getDailyAccomplishments('2026-11-16');
    assert.strictEqual(res.notesCount, 1, "1 note comptabilisée");
    assert.strictEqual(res.notes.length, 1, "1 note formatée retournée");
    assert.strictEqual(res.notes[0].title, 'Idées pour la prochaine version');
    assert.strictEqual(res.notes[0].folder, 'Idées');
    assert(res.notes[0].snippet.includes('Voici quelques réflexions'), "Snippet de note extrait proprement sans balises HTML");
  });

  // 7. Actions Terminer ma journée et Plus tard ce soir
  await it("1.7 completeForToday marque le bilan comme vu et snooze navigue vers home", () => {
    let seenSaved = false;
    global.localStorage = {
      setItem: (k, v) => {
        if (k === DebriefManager.STORAGE_KEY_SEEN) seenSaved = true;
      },
      getItem: () => null
    };

    let navigatedScreen = null;
    let toastShown = false;
    global.App = {
      navigate: (screen) => { navigatedScreen = screen; },
      showToast: () => { toastShown = true; }
    };

    // Test completeForToday
    DebriefManager.completeForToday();
    assert.strictEqual(seenSaved, true, "completeForToday marque le bilan comme vu");
    assert.strictEqual(navigatedScreen, 'home', "completeForToday ramène vers home");
    assert.strictEqual(toastShown, true, "Un toast bienveillant est affiché");

    // Test snooze
    navigatedScreen = null;
    DebriefManager.snooze();
    assert.strictEqual(navigatedScreen, 'home', "snooze ramène vers home sans marquer comme vu définitivement");
  });

  // 8. Rendu HTML complet intégrant les 3 sections
  await it("1.8 DebriefManager.render injecte les sections Tâches, Temps dédié à la créativité et Notes", () => {
    let injectedHtml = '';
    const mockContainer = {
      set innerHTML(val) { injectedHtml = val; }
    };

    global.StorageManager = {
      getTasks: () => [{ id: 't1', title: 'Tâche Test', completed: true, completedAt: '2026-11-16T10:00:00', projectId: 'p1', subtasks: [] }],
      getProjects: () => [{ id: 'p1', title: 'Projet Test', color: '#3b82f6' }],
      getTrash: () => [],
      getEvents: () => [{ id: 'e1', title: 'Créneau Créatif', start: '2026-11-16T10:00:00', end: '2026-11-16T11:00:00', isAllDay: false, projectId: 'p1' }],
      getNotes: () => [{ id: 'n1', title: 'Note du jour', content: 'Contenu créatif', folder: 'Général', createdAt: '2026-11-16T11:00:00' }],
      getSettings: () => ({ debriefEnabled: true, debriefHour: '17:00' })
    };

    global.document = {
      getElementById: (id) => {
        if (id === 'debrief-content-area') return mockContainer;
        return { textContent: '', style: {}, addEventListener: () => {} };
      },
      querySelector: () => ({ style: {} })
    };

    DebriefManager.render();
    assert(injectedHtml.includes('Temps dédié à la créativité'), "Le titre 'Temps dédié à la créativité' est bien généré");
    assert(injectedHtml.includes('Pensées, Écrits &amp; Notes'), "La section des notes est bien générée");
    assert(injectedHtml.includes('Ce qui a avancé avec succès'), "La section des tâches est bien générée");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.3 : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
})();
