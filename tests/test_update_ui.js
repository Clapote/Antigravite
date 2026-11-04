// =============================================================================
// tests/test_update_ui.js - Tests automatisés de l'interface des Mises à Jour
// =============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

console.log("==========================================================");
console.log("   Antigravité - Tests de l'Interface des Mises à Jour");
console.log("   (Onglet Paramètres, États, Progression & Sécurité)");
console.log("==========================================================");

// Créer un environnement DOM simulé léger pour tester UpdateManager
function createMockDOM() {
  const elements = {};

  function makeElement(id) {
    const classList = new Set();
    const listeners = {};
    return {
      id,
      textContent: '',
      innerHTML: '',
      disabled: false,
      style: {
        display: '',
        width: '',
        backgroundColor: ''
      },
      classList: {
        add: (...cls) => cls.forEach(c => classList.add(c)),
        remove: (...cls) => cls.forEach(c => classList.delete(c)),
        contains: (c) => classList.has(c)
      },
      addEventListener: (evt, handler) => {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(handler);
      },
      click: () => {
        if (listeners['click']) {
          listeners['click'].forEach(h => h({ preventDefault: () => {} }));
        }
      }
    };
  }

  const ids = [
    'updater-current-version-label',
    'updater-version-chip',
    'updater-version-dot',
    'updater-status-icon',
    'updater-status-title',
    'updater-status-desc',
    'btn-check-updates',
    'btn-check-updates-text',
    'btn-check-updates-icon',
    'btn-download-update',
    'btn-download-update-text',
    'btn-install-update',
    'updater-progress-container',
    'updater-progress-bar',
    'updater-progress-percent',
    'updater-progress-label'
  ];

  ids.forEach(id => {
    elements[id] = makeElement(id);
  });

  return {
    getElementById: (id) => elements[id] || null,
    elements
  };
}

(async () => {
  const { UpdateManager } = require('../js/settings.js');

  // -----------------------------------------------------------------------------
  // Test 1 : Intégrité du balisage dans index.html
  // -----------------------------------------------------------------------------
  await it("1. index.html contient la section 'settings-section-updates' avec tous les composants requis", () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('id="settings-section-updates"'), "Section updates présente");
    assert.ok(html.includes('id="updater-current-version-label"'), "Label version présent");
    assert.ok(html.includes('id="btn-check-updates"'), "Bouton check présent");
    assert.ok(html.includes('id="btn-download-update"'), "Bouton download présent");
    assert.ok(html.includes('id="btn-install-update"'), "Bouton install présent");
    assert.ok(html.includes('id="updater-progress-container"'), "Conteneur progress présent");
    assert.ok(html.includes('id="updater-progress-bar"'), "Barre progress présente");
  });

  // -----------------------------------------------------------------------------
  // Test 2 : Récupération et affichage dynamique de la version
  // -----------------------------------------------------------------------------
  await it("2. refreshStatus() met à jour dynamiquement le label de version sans valeur en dur", async () => {
    const dom = createMockDOM();
    global.document = dom;

    let getVersionCalled = false;
    global.window = {
      AntigraviteAPI: {
        updater: {
          getVersion: async () => { getVersionCalled = true; return '1.2.3'; },
          getStatus: async () => ({ status: 'idle', currentVersion: '1.2.3', isPackaged: true }),
          onStatusChanged: () => () => {}
        }
      }
    };

    UpdateManager.initialized = false;
    await UpdateManager.refreshStatus();

    assert.strictEqual(getVersionCalled, true);
    assert.strictEqual(UpdateManager.currentVersion, '1.2.3');
    assert.strictEqual(dom.elements['updater-current-version-label'].textContent, '1.2.3');
  });

  // -----------------------------------------------------------------------------
  // Test 3 : États de l'interface utilisateur
  // -----------------------------------------------------------------------------
  await it("3.1 État 'idle' : prêt à vérifier avec bouton de recherche actif", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'idle';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Prêt à vérifier');
    assert.strictEqual(dom.elements['btn-check-updates'].style.display, 'inline-flex');
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, false);
    assert.strictEqual(dom.elements['btn-download-update'].style.display, 'none');
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
    assert.strictEqual(dom.elements['updater-progress-container'].style.display, 'none');
  });

  await it("3.2 État 'checking' : recherche en cours et bouton désactivé", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'checking';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Recherche en cours...');
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, true);
    assert.strictEqual(dom.elements['btn-download-update'].style.display, 'none');
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
  });

  await it("3.3 État 'not-available' : application à jour", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'not-available';
    UpdateManager.currentVersion = '1.0.0';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Aucune mise à jour disponible');
    assert.ok(dom.elements['updater-status-desc'].textContent.includes('1.0.0'));
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, false);
    assert.strictEqual(dom.elements['btn-download-update'].style.display, 'none');
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
  });

  await it("3.4 État 'available' : nouvelle version proposée au téléchargement", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'available';
    UpdateManager.updateInfo = { version: '1.1.0' };
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Nouvelle version disponible : v1.1.0');
    assert.strictEqual(dom.elements['btn-download-update'].style.display, 'inline-flex');
    assert.strictEqual(dom.elements['btn-download-update'].disabled, false);
    assert.ok(dom.elements['btn-download-update-text'].textContent.includes('1.1.0'));
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
  });

  await it("3.5 État 'downloading' : jauge de progression active et boutons désactivés", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'downloading';
    UpdateManager.downloadProgress = { percent: 68.4 };
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Téléchargement en cours...');
    assert.strictEqual(dom.elements['updater-progress-container'].style.display, 'block');
    assert.strictEqual(dom.elements['updater-progress-percent'].textContent, '68 %');
    assert.strictEqual(dom.elements['updater-progress-bar'].style.width, '68%');
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, true);
    assert.strictEqual(dom.elements['btn-download-update'].disabled, true);
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
  });

  await it("3.6 État 'downloaded' : bouton 'Redémarrer et installer' visible et actif", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'downloaded';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Téléchargement terminé !');
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'inline-flex');
    assert.strictEqual(dom.elements['btn-install-update'].disabled, false);
    assert.strictEqual(dom.elements['btn-check-updates'].style.display, 'none');
    assert.strictEqual(dom.elements['btn-download-update'].style.display, 'none');
  });

  await it("3.7 État 'error' : message compréhensible et possibilité de réessayer", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'error';
    UpdateManager.lastError = 'Échec de connexion réseau (ERR_INTERNET_DISCONNECTED)';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Erreur lors de la mise à jour');
    assert.ok(dom.elements['updater-status-desc'].textContent.includes('ERR_INTERNET_DISCONNECTED'));
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, false);
    assert.strictEqual(dom.elements['btn-check-updates-text'].textContent, 'Réessayer');
    assert.strictEqual(dom.elements['btn-install-update'].style.display, 'none');
  });

  await it("3.8 État 'dev-mode' : indication claire sans erreur non gérée", () => {
    const dom = createMockDOM();
    global.document = dom;

    UpdateManager.status = 'dev-mode';
    UpdateManager.render();

    assert.strictEqual(dom.elements['updater-status-title'].textContent, 'Mode développement');
    assert.ok(dom.elements['updater-status-desc'].textContent.includes('mode développement'));
    assert.strictEqual(dom.elements['btn-check-updates'].disabled, false);
  });

  // -----------------------------------------------------------------------------
  // Test 4 : Interactions Boutons et Pont IPC
  // -----------------------------------------------------------------------------
  await it("4.1 Le clic sur 'btn-check-updates' invoque checkForUpdates()", async () => {
    const dom = createMockDOM();
    global.document = dom;

    let checkCalled = false;
    global.window = {
      AntigraviteAPI: {
        updater: {
          checkForUpdates: async () => { checkCalled = true; return { success: true }; },
          getVersion: async () => '1.0.0',
          getStatus: async () => ({ status: 'idle' })
        }
      }
    };

    UpdateManager.isBusy = false;
    UpdateManager.bindEvents();
    dom.elements['btn-check-updates'].click();

    // Attendre la résolution asynchrone
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(checkCalled, true);
  });

  await it("4.2 Le clic sur 'btn-download-update' invoque downloadUpdate()", async () => {
    const dom = createMockDOM();
    global.document = dom;

    let downloadCalled = false;
    global.window = {
      AntigraviteAPI: {
        updater: {
          downloadUpdate: async () => { downloadCalled = true; return { success: true }; }
        }
      }
    };

    UpdateManager.isBusy = false;
    UpdateManager.bindEvents();
    dom.elements['btn-download-update'].click();

    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(downloadCalled, true);
  });

  await it("4.3 Le clic sur 'btn-install-update' invoque installUpdate()", async () => {
    const dom = createMockDOM();
    global.document = dom;

    let installCalled = false;
    global.window = {
      AntigraviteAPI: {
        updater: {
          installUpdate: async () => { installCalled = true; return true; }
        }
      }
    };

    UpdateManager.isBusy = false;
    UpdateManager.bindEvents();
    dom.elements['btn-install-update'].click();

    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(installCalled, true);
  });

  // -----------------------------------------------------------------------------
  // Test 5 : Protection contre les actions concurrentes
  // -----------------------------------------------------------------------------
  await it("5. Des clics simultanés ne déclenchent pas d'appels concurrents (isBusy lock)", async () => {
    let callCount = 0;
    global.window = {
      AntigraviteAPI: {
        updater: {
          checkForUpdates: async () => {
            callCount++;
            await new Promise(r => setTimeout(r, 50));
            return { success: true };
          }
        }
      }
    };

    UpdateManager.isBusy = false;
    const p1 = UpdateManager.checkForUpdates();
    const p2 = UpdateManager.checkForUpdates();
    const p3 = UpdateManager.checkForUpdates();

    await Promise.all([p1, p2, p3]);
    assert.strictEqual(callCount, 1, "Un seul appel réseau doit être émis");
  });

  // -----------------------------------------------------------------------------
  // Test 6 : Nettoyage propre des abonnements (cleanup)
  // -----------------------------------------------------------------------------
  await it("6. cleanup() désabonne l'écouteur IPC sans fuite mémoire", () => {
    let unsubscribed = false;
    UpdateManager._unsubscribe = () => { unsubscribed = true; };

    UpdateManager.cleanup();
    assert.strictEqual(unsubscribed, true);
    assert.strictEqual(UpdateManager._unsubscribe, null);
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS DES TESTS UI UPDATER : ${passed} réussis, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
})();
