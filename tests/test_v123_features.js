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

  // 1. Version 1.2.3 ou supérieure synchronisée
  await it("1.1 Version 1.2.3 ou supérieure synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(pkg.version >= '1.2.3', "package.json doit être en version 1.2.3 ou supérieure");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes(`id="updater-current-version-label">${pkg.version}</strong>`), "index.html affiche la version courante");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes(`APP_VERSION: '${pkg.version}'`), "app.js est configuré sur la version courante");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes(`currentVersion: '${pkg.version}'`), "settings.js est initialisé avec la version courante");
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

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    global.StorageManager = {
      getTasks: () => [{ id: 't1', title: 'Tâche Test', completed: true, completedAt: `${todayKey}T10:00:00`, projectId: 'p1', subtasks: [] }],
      getProjects: () => [{ id: 'p1', title: 'Projet Test', color: '#3b82f6' }],
      getTrash: () => [],
      getEvents: () => [{ id: 'e1', title: 'Créneau Créatif', start: `${todayKey}T10:00:00`, end: `${todayKey}T11:00:00`, isAllDay: false, projectId: 'p1' }],
      getNotes: () => [{ id: 'n1', title: 'Note du jour', content: 'Contenu créatif', folder: 'Général', createdAt: `${todayKey}T11:00:00` }],
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

  // 9. Comparaison stricte des versions (Anti-boucle de mise à jour)
  await it("1.9 Comparaison sémantique stricte isNewerVersion dans update-service, app.js et settings.js", () => {
    const updateService = require('../services/update-service');
    assert.strictEqual(typeof updateService.isNewerVersion, 'function', "updateService possède isNewerVersion");

    // Tests unitaires de comparaison
    assert.strictEqual(updateService.isNewerVersion('1.2.3', '1.2.2'), true, "1.2.3 est plus récent que 1.2.2");
    assert.strictEqual(updateService.isNewerVersion('v1.2.3', '1.2.2'), true, "v1.2.3 avec préfixe 'v' est plus récent que 1.2.2");
    assert.strictEqual(updateService.isNewerVersion('1.3.0', '1.2.9'), true, "1.3.0 est plus récent que 1.2.9");
    assert.strictEqual(updateService.isNewerVersion('2.0.0', '1.9.9'), true, "2.0.0 est plus récent que 1.9.9");
    
    // Versions identiques : DOIT retourner false
    assert.strictEqual(updateService.isNewerVersion('1.2.2', '1.2.2'), false, "1.2.2 n'est pas plus récent que 1.2.2");
    assert.strictEqual(updateService.isNewerVersion('v1.2.2', '1.2.2'), false, "v1.2.2 n'est pas plus récent que 1.2.2");
    assert.strictEqual(updateService.isNewerVersion('1.2.3', '1.2.3'), false, "1.2.3 n'est pas plus récent que 1.2.3");

    // Versions antérieures : DOIT retourner false
    assert.strictEqual(updateService.isNewerVersion('1.2.1', '1.2.2'), false, "1.2.1 n'est pas plus récent que 1.2.2");
    assert.strictEqual(updateService.isNewerVersion('1.1.9', '1.2.0'), false, "1.1.9 n'est pas plus récent que 1.2.0");

    // Valeurs nulles ou invalides
    assert.strictEqual(updateService.isNewerVersion(null, '1.2.2'), false, "null n'est pas plus récent");
    assert.strictEqual(updateService.isNewerVersion('1.2.3', null), false, "courant null retourne false");

    // Vérifier la présence dans app.js et settings.js
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("isNewerVersion(remoteVer, currentVer)"), "app.js intègre isNewerVersion");
    assert(appCode.includes("removePendingUpdateIndicator()"), "app.js intègre removePendingUpdateIndicator()");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("isNewerVersion(remoteVer, currentVer)"), "settings.js intègre isNewerVersion");
  });

  // 10. UpdateService n'émet PAS update-available si la version est déjà à jour (1.2.2 -> 1.2.2)
  await it("1.10 UpdateService bloque update-available et signale not-available si remote <= current", async () => {
    const { UpdateService } = require('../services/update-service');
    
    // Simuler un autoUpdater retournant la version 1.2.2 alors que l'app est en 1.2.2
    const fakeEvents = {};
    const fakeAutoUpdater = {
      on: (ev, handler) => { fakeEvents[ev] = handler; },
      setFeedURL: () => {},
      checkForUpdates: async () => ({
        updateInfo: { version: '1.2.2', releaseNotes: 'Notes 1.2.2' }
      })
    };

    const service = new UpdateService({
      autoUpdater: fakeAutoUpdater,
      currentVersion: '1.2.2'
    });
    service.init();

    let availableEmitted = false;
    let notAvailableEmitted = false;
    service.on('update-available', () => { availableEmitted = true; });
    service.on('update-not-available', () => { notAvailableEmitted = true; });

    // Déclencher l'événement 'update-available' brut d'electron-updater
    if (fakeEvents['update-available']) {
      fakeEvents['update-available']({ version: '1.2.2' });
    }

    assert.strictEqual(availableEmitted, false, "update-available NE DOIT PAS être émis si la version est identique");
    assert.strictEqual(notAvailableEmitted, true, "update-not-available DOIT être émis");
    assert.strictEqual(service.status, 'not-available', "Le statut doit être not-available");

    // Vérifier checkForUpdates
    const res = await service.checkForUpdates(true);
    assert.strictEqual(res.isUpdateAvailable, false, "isUpdateAvailable doit être faux");
    assert.strictEqual(res.updateInfo, null, "updateInfo retourné doit être null");
    assert.strictEqual(service.getStatus().status, 'not-available', "getStatus() retourne not-available");
  });

  // 11. Refus de téléchargement sécurisé si pas de nouvelle version
  await it("1.11 downloadUpdate rejette l'opération en sécurité si aucune version plus récente n'existe", async () => {
    const { UpdateService } = require('../services/update-service');
    const service = new UpdateService({
      currentVersion: '1.2.2'
    });
    service.init();
    service.status = 'not-available';
    service.updateInfo = { version: '1.2.2' };

    let threw = false;
    try {
      await service.downloadUpdate();
    } catch (err) {
      threw = true;
      assert(err.message.includes('plus récente') || err.message.includes('impossible'), "Message d'erreur explicite");
    }
    assert.strictEqual(threw, true, "downloadUpdate doit rejeter si la version n'est pas plus récente");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.3 : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
})();
