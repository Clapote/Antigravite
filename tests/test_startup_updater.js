// =============================================================================
// tests/test_startup_updater.js - Tests du système de mise à jour au démarrage
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
    console.error(` [FAIL] ${desc} : ${err.message}`);
    failed++;
  }
}

console.log("==========================================================");
console.log("   Antigravité - Tests de Mise à Jour au Démarrage");
console.log("   (Recherche Arrière-Plan, Pop-up & Mode Silencieux)");
console.log("==========================================================");

(async () => {
  const rootDir = path.join(__dirname, '..');

  await it("1.1 index.html contient la modale #modal-update-prompt et ses éléments clés", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert.ok(html.includes('id="modal-update-prompt"'), "Modale #modal-update-prompt présente");
    assert.ok(html.includes('id="update-prompt-version-badge"'), "Badge de version présent");
    assert.ok(html.includes('id="update-prompt-notes"'), "Zone de notes présent");
    assert.ok(html.includes('id="update-prompt-progress-box"'), "Boîte de progression présente");
    assert.ok(html.includes('id="update-prompt-progress-bar"'), "Barre de progression présente");
    assert.ok(html.includes('id="btn-update-prompt-later"'), "Bouton Plus tard présent");
    assert.ok(html.includes('id="btn-update-prompt-now"'), "Bouton Mettre à jour présent");
  });

  await it("1.2 main.js configure l'installation silencieuse sans fenêtre d'assistant NSIS", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert.ok(mainCode.includes("updateService.quitAndInstall(true, true)"), "Installation configurée avec isSilent=true");
    assert.ok(mainCode.includes("--mock-update-available"), "Support du mode de test mock-update présent dans main.js");
  });

  await it("1.3 services/update-service.js supporte la simulation de mise à jour fluide", async () => {
    const updateService = require('../services/update-service');
    const { UpdateService } = updateService;
    const mockService = new UpdateService({ mock: true });
    mockService.init();

    const checkRes = await mockService.checkForUpdates();
    assert.strictEqual(checkRes.success, true);
    assert.strictEqual(checkRes.updateInfo.version, '1.2.3');

    let progressSeen = false;
    mockService.on('status-changed', (data) => {
      if (data.status === 'downloading' && data.progress) progressSeen = true;
    });

    const downloadRes = await mockService.downloadUpdate();
    assert.strictEqual(downloadRes.success, true);
    assert.strictEqual(progressSeen, true, "Événements de progression émis");
    assert.strictEqual(mockService.status, 'downloaded');
  });

  await it("1.4 js/app.js intègre la vérification au démarrage et la gestion du pop-up", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');
    assert.ok(appCode.includes("this.checkForStartupUpdate()"), "App.init invoque checkForStartupUpdate()");
    assert.ok(appCode.includes("openUpdatePromptModal"), "openUpdatePromptModal présent");
    assert.ok(appCode.includes("updatePromptDownloadProgress"), "updatePromptDownloadProgress présent");
    assert.ok(appCode.includes("onPromptUpdateDownloaded"), "onPromptUpdateDownloaded présent");
    assert.ok(appCode.includes("showPendingUpdateIndicator"), "showPendingUpdateIndicator présent");
  });

  await it("1.5 Tester-Antigravite-1.2.2.bat propose l'option [4] de simulation de mise à jour", () => {
    const batContent = fs.readFileSync(path.join(rootDir, 'Tester-Antigravite-1.2.2.bat'), 'utf8');
    assert.ok(batContent.includes("--mock-update-available"), "Option --mock-update-available présente dans le .bat");
    assert.ok(batContent.includes("[4] Tester le pop-up et l'installation de mise a jour"), "Libellé de test présent");
  });

  await it("1.6 js/settings.js harmonise le téléchargement et la proposition non-bloquante de redémarrage", () => {
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js/settings.js'), 'utf8');
    assert.ok(settingsCode.includes("promptRestartChoice"), "Méthode promptRestartChoice présente dans UpdateManager");
    assert.ok(settingsCode.includes("Installation silencieuse"), "Message d'installation silencieuse présent");
    assert.ok(settingsCode.includes("Continuer à travailler"), "Option Continuer à travailler présente");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS TESTS DÉMARRAGE UPDATER : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
})();
