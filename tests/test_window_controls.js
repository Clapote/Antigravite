/**
 * Antigravité - Tests automatisés des contrôles de fenêtre (Réduire, Grand écran, Fermer)
 * Vérifie l'intégration HTML/CSS dans le bandeau supérieur pour une harmonie chromatique absolue (zéro démarcation).
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
    console.error(`        ${err.stack || err.message}\n`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des Contrôles de Fenêtre");
  console.log("   (Bandeau Supérieur, Boutons Intégrés & Harmonie Chromatique)");
  console.log("==========================================================");

  // 1. index.html intègre les boutons Réduire, Agrandir/Restaurer, Fermer
  await it("1.1 index.html contient #window-controls-container avec #btn-win-minimize, #btn-win-maximize, #btn-win-close", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="window-controls-container"'), "index.html doit contenir #window-controls-container");
    assert(htmlContent.includes('id="btn-win-minimize"'), "index.html doit contenir #btn-win-minimize");
    assert(htmlContent.includes('id="btn-win-maximize"'), "index.html doit contenir #btn-win-maximize");
    assert(htmlContent.includes('id="btn-win-close"'), "index.html doit contenir #btn-win-close");
    assert(htmlContent.includes('id="icon-win-maximize"'), "index.html doit contenir #icon-win-maximize");
    assert(htmlContent.includes('id="icon-win-restore"'), "index.html doit contenir #icon-win-restore");
  });

  // 2. preload.js expose windowControls
  await it("1.2 preload.js expose windowControls avec minimize, maximize, close, isMaximized et onMaximizeChanged", () => {
    const preloadCode = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
    assert(preloadCode.includes('windowControls:'), "preload.js doit exposer windowControls");
    assert(preloadCode.includes('antigravite:window-minimize'), "windowControls doit invoquer antigravite:window-minimize");
    assert(preloadCode.includes('antigravite:window-maximize'), "windowControls doit invoquer antigravite:window-maximize");
    assert(preloadCode.includes('antigravite:window-close'), "windowControls doit invoquer antigravite:window-close");
    assert(preloadCode.includes('antigravite:window-is-maximized'), "windowControls doit invoquer antigravite:window-is-maximized");
    assert(preloadCode.includes('antigravite:window-maximize-changed'), "windowControls doit écouter antigravite:window-maximize-changed");
  });

  // 3. main.js gère les IPC de gestion de fenêtre
  await it("1.3 main.js gère les handlers IPC antigravite:window-* et émet maximize/unmaximize", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes("ipcMain.handle('antigravite:window-minimize'"), "main.js doit gérer window-minimize");
    assert(mainCode.includes("ipcMain.handle('antigravite:window-maximize'"), "main.js doit gérer window-maximize");
    assert(mainCode.includes("ipcMain.handle('antigravite:window-close'"), "main.js doit gérer window-close");
    assert(mainCode.includes("ipcMain.handle('antigravite:window-is-maximized'"), "main.js doit gérer window-is-maximized");
    assert(mainCode.includes("mainWindow.on('maximize'"), "main.js écoute maximize");
    assert(mainCode.includes("mainWindow.on('unmaximize'"), "main.js écoute unmaximize");
  });

  // 4. css/styles.css garantit le fond transparent des boutons pour un raccord absolu
  await it("1.4 styles.css applique background: transparent sur .btn-win-control et rouge officiel sur close hover", () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.window-controls-container'), "styles.css contient les styles du conteneur");
    assert(cssContent.includes('.btn-win-control'), "styles.css contient les styles des boutons");
    assert(cssContent.includes('background: transparent;'), "Les boutons de fenêtre ont un fond transparent");
    assert(cssContent.includes('#e81123'), "Le bouton fermer s'illumine en rouge au survol");
  });

  // 5. js/app.js initialise les boutons et met à jour l'icône agrandir/restaurer
  await it("1.5 js/app.js intègre initWindowControls() et gère le basculement d'icône agrandir/restaurer", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes('initWindowControls()'), "app.js doit contenir initWindowControls");
    assert(appCode.includes('this.initWindowControls()'), "app.js appelle initWindowControls au démarrage");
    assert(appCode.includes('updateMaxIcon'), "app.js gère updateMaxIcon pour l'état agrandi/restauré");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS : ${passedTests} passés, ${failedTests} échoués`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
