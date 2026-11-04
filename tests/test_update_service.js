// =============================================================================
// tests/test_update_service.js - Tests automatisés du service de mise à jour
// =============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { EventEmitter } = require('events');

let passed = 0;
let failed = 0;

async function it(description, fn) {
  try {
    await fn();
    console.log(` [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${description}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log("==========================================================");
console.log("   Antigravité - Tests du Service de Mise à Jour");
console.log("   (electron-updater & Dépôt Public de Releases)");
console.log("==========================================================");

const updateServiceModule = require('../services/update-service');
const { UpdateService } = updateServiceModule;

// Simuler autoUpdater pour isoler les tests sans réseau réel
class MockAutoUpdater extends EventEmitter {
  constructor() {
    super();
    this.autoDownload = null;
    this.autoInstallOnAppQuit = null;
    this.feedConfig = null;
    this.checkForUpdatesCalled = false;
    this.downloadUpdateCalled = false;
    this.quitAndInstallCalled = false;
    this.quitAndInstallArgs = null;
  }

  setFeedURL(config) {
    this.feedConfig = config;
  }

  async checkForUpdates() {
    this.checkForUpdatesCalled = true;
    return {
      updateInfo: {
        version: '1.1.0',
        releaseDate: '2026-10-30T10:00:00Z',
        files: [{ url: 'Antigravite-Setup-1.1.0.exe' }]
      }
    };
  }

  async downloadUpdate() {
    this.downloadUpdateCalled = true;
    return ['Antigravite-Setup-1.1.0.exe'];
  }

  quitAndInstall(isSilent, isForceRunAfter) {
    this.quitAndInstallCalled = true;
    this.quitAndInstallArgs = { isSilent, isForceRunAfter };
  }
}

(async () => {
  // -----------------------------------------------------------------------------
  // Test 1 : Configuration et Source de Publication
  // -----------------------------------------------------------------------------
  await it("1.1 package.json configure le publish vers Clapote/Antigravite-releases (public)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(pkg.build, "Section build requise");
    assert.ok(pkg.build.publish, "Section build.publish requise");
    assert.strictEqual(pkg.build.publish.provider, 'github');
    assert.strictEqual(pkg.build.publish.owner, 'Clapote');
    assert.strictEqual(pkg.build.publish.repo, 'Antigravite-releases');
    assert.strictEqual(pkg.build.publish.private, false, "Le dépôt de releases doit être public");
  });

  await it("1.2 package.json inclut electron-updater dans les dependencies de production", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(pkg.dependencies && pkg.dependencies['electron-updater'], "electron-updater doit être en production");
  });

  await it("1.3 UpdateService configure par défaut le dépôt public sans secret ni jeton", () => {
    const service = new UpdateService();
    assert.strictEqual(service.feedConfig.provider, 'github');
    assert.strictEqual(service.feedConfig.owner, 'Clapote');
    assert.strictEqual(service.feedConfig.repo, 'Antigravite-releases');
    assert.strictEqual(service.feedConfig.private, false);
    assert.strictEqual(service.feedConfig.token, undefined, "Aucun token ne doit exister dans la config");
  });

  // -----------------------------------------------------------------------------
  // Test 2 : Protection en mode Développement et Initialisation
  // -----------------------------------------------------------------------------
  await it("2.1 init() configure autoDownload=false et autoInstallOnAppQuit=false", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: false, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });

    const res = service.init();
    assert.strictEqual(res.initialized, true);
    assert.strictEqual(mockUpdater.autoDownload, false, "autoDownload doit être désactivé");
    assert.strictEqual(mockUpdater.autoInstallOnAppQuit, false, "autoInstallOnAppQuit doit être désactivé");
    assert.deepStrictEqual(mockUpdater.feedConfig, service.feedConfig);
  });

  await it("2.2 En mode non-empaqueté (dev), checkForUpdates() ne lance aucune requête réseau", async () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: false, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    const result = await service.checkForUpdates(false);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'dev-mode');
    assert.strictEqual(mockUpdater.checkForUpdatesCalled, false, "checkForUpdates ne doit pas être appelé en dev");
  });

  // -----------------------------------------------------------------------------
  // Test 3 : Gestion du cycle des événements et erreurs
  // -----------------------------------------------------------------------------
  await it("3.1 Événements checking-for-update et update-available mettent à jour le statut", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    let checkingEmitted = false;
    let availableEmitted = null;

    service.on('checking-for-update', () => { checkingEmitted = true; });
    service.on('update-available', (info) => { availableEmitted = info; });

    mockUpdater.emit('checking-for-update');
    assert.strictEqual(checkingEmitted, true);
    assert.strictEqual(service.getStatus().status, 'checking');

    mockUpdater.emit('update-available', { version: '1.0.5' });
    assert.deepStrictEqual(availableEmitted, { version: '1.0.5' });
    assert.strictEqual(service.getStatus().status, 'available');
    assert.strictEqual(service.getStatus().updateInfo.version, '1.0.5');
  });

  await it("3.2 Événements download-progress et update-downloaded", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    mockUpdater.emit('download-progress', { percent: 45.2, bytesPerSecond: 1048576 });
    assert.strictEqual(service.getStatus().status, 'downloading');
    assert.strictEqual(service.getStatus().downloadProgress.percent, 45.2);

    mockUpdater.emit('update-downloaded', { version: '1.0.5' });
    assert.strictEqual(service.getStatus().status, 'downloaded');
  });

  await it("3.3 Événement error met à jour le statut et conserve le message d'erreur", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    mockUpdater.emit('error', new Error("Connexion interrompue"));
    assert.strictEqual(service.getStatus().status, 'error');
    assert.strictEqual(service.getStatus().lastError, "Connexion interrompue");
  });

  // -----------------------------------------------------------------------------
  // Test 4 : Contrôle explicite du téléchargement et de l'installation
  // -----------------------------------------------------------------------------
  await it("4.1 downloadUpdate() refuse de s'exécuter si aucune mise à jour n'est disponible", async () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    await assert.rejects(
      async () => { await service.downloadUpdate(); },
      /Téléchargement impossible/
    );
    assert.strictEqual(mockUpdater.downloadUpdateCalled, false);
  });

  await it("4.2 downloadUpdate() déclenche autoUpdater.downloadUpdate() si disponible", async () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    mockUpdater.emit('update-available', { version: '1.1.0' });
    const res = await service.downloadUpdate();

    assert.strictEqual(res.success, true);
    assert.strictEqual(mockUpdater.downloadUpdateCalled, true);
  });

  await it("4.3 quitAndInstall() refuse de s'exécuter si la mise à jour n'est pas téléchargée", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    const service = new UpdateService({ autoUpdater: mockUpdater, app: mockApp });
    service.init();

    assert.throws(
      () => { service.quitAndInstall(); },
      /Aucune mise à jour téléchargée/
    );
    assert.strictEqual(mockUpdater.quitAndInstallCalled, false);
  });

  // -----------------------------------------------------------------------------
  // Test 5 : Fermeture sécurisée lors de l'installation
  // -----------------------------------------------------------------------------
  await it("5.1 quitAndInstall() déclenche onBeforeQuitInstall et passe les arguments attendus", () => {
    const mockUpdater = new MockAutoUpdater();
    const mockApp = { isPackaged: true, getVersion: () => '1.0.0' };
    let beforeQuitCalled = false;

    const service = new UpdateService({
      autoUpdater: mockUpdater,
      app: mockApp,
      onBeforeQuitInstall: () => { beforeQuitCalled = true; }
    });
    service.init();

    // Simuler le téléchargement terminé
    mockUpdater.emit('update-downloaded', { version: '1.1.0' });

    service.quitAndInstall(false, true);

    assert.strictEqual(beforeQuitCalled, true, "onBeforeQuitInstall doit être appelé");
    assert.strictEqual(mockUpdater.quitAndInstallCalled, true);
    assert.deepStrictEqual(mockUpdater.quitAndInstallArgs, { isSilent: false, isForceRunAfter: true });
  });

  await it("5.2 main.js intègre updateService et configure isQuitting=true pour l'installation", () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    assert.ok(mainCode.includes("require('./services/update-service')"), "main.js doit importer updateService");
    assert.ok(mainCode.includes("updateService.init"), "main.js doit initialiser updateService");
    assert.ok(mainCode.includes("isQuitting = true"), "isQuitting doit être forcé à true lors de l'installation");
    assert.ok(mainCode.includes("antigravite:updater-check"), "Canal IPC check présent");
    assert.ok(mainCode.includes("antigravite:updater-download"), "Canal IPC download présent");
    assert.ok(mainCode.includes("antigravite:updater-install"), "Canal IPC install présent");
  });

  await it("5.3 preload.js expose l'API updater de manière sécurisée et dynamique", () => {
    const preloadCode = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
    assert.ok(preloadCode.includes("updater: Object.freeze"), "preload.js doit exposer AntigraviteAPI.updater");
    assert.ok(preloadCode.includes("antigravite:get-app-version"), "preload.js doit requêter la version dynamique");
    assert.ok(preloadCode.includes("antigravite:updater-check"), "preload.js doit exposer checkForUpdates");
    assert.ok(preloadCode.includes("antigravite:updater-download"), "preload.js doit exposer downloadUpdate");
    assert.ok(preloadCode.includes("antigravite:updater-install"), "preload.js doit exposer installUpdate");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS DES TESTS UPDATER : ${passed} réussis, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
})();
