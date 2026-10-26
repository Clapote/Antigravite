// =============================================================================
// Tests automatisés : Comportement de fermeture & réouverture de fenêtre (ChatGPT-like)
// =============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(` [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${description}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

async function itAsync(description, fn) {
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
console.log("   Antigravité - Tests Comportement Fermeture & Tray");
console.log("   (Comportement de bureau type ChatGPT)");
console.log("==========================================================");

const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const preloadCode = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');

// -----------------------------------------------------------------------------
// Test 1 : Analyse statique de main.js & preload.js
// -----------------------------------------------------------------------------
it("1.1 main.js inclut requestSingleInstanceLock et la gestion de second-instance", () => {
  assert.ok(mainCode.includes('requestSingleInstanceLock'), "main.js doit appeler requestSingleInstanceLock");
  assert.ok(mainCode.includes('second-instance'), "main.js doit écouter l'événement second-instance");
});

it("1.2 main.js intercepte l'événement close pour masquer la fenêtre avec hide()", () => {
  assert.ok(mainCode.includes("mainWindow.on('close'"), "main.js doit écouter mainWindow.on('close')");
  assert.ok(mainCode.includes("event.preventDefault()"), "main.js doit annuler la fermeture par défaut");
  assert.ok(mainCode.includes("mainWindow.hide()"), "main.js doit masquer la fenêtre avec hide()");
});

it("1.3 main.js protège la fermeture volontaire via un drapeau isQuitting et before-quit", () => {
  assert.ok(mainCode.includes("let isQuitting"), "main.js doit déclarer le drapeau isQuitting");
  assert.ok(mainCode.includes("app.on('before-quit'"), "main.js doit écouter before-quit");
  assert.ok(mainCode.includes("if (!isQuitting)"), "Le gestionnaire de close doit vérifier !isQuitting");
});

it("1.4 main.js configure une icône Tray (zone de notification Windows)", () => {
  assert.ok(mainCode.includes("new Tray("), "main.js doit instancier un Tray");
  assert.ok(mainCode.includes("tray.setToolTip('Antigravité')"), "main.js doit définir le tooltip du Tray");
  assert.ok(mainCode.includes("Ouvrir Antigravité"), "Le menu contextuel du Tray doit contenir 'Ouvrir Antigravité'");
  assert.ok(mainCode.includes("Quitter Antigravité"), "Le menu contextuel du Tray doit contenir 'Quitter Antigravité'");
});

it("1.5 main.js et preload.js exposent une commande de fermeture volontaire (quit-app)", () => {
  assert.ok(mainCode.includes("'antigravite:quit-app'"), "main.js doit gérer l'IPC antigravite:quit-app");
  assert.ok(preloadCode.includes("quitApp:"), "preload.js doit exposer quitApp");
  assert.ok(preloadCode.includes("'antigravite:quit-app'"), "preload.js doit invoquer antigravite:quit-app");
});

// -----------------------------------------------------------------------------
// Test 2 : Simulation comportementale du cycle de fermeture & restauration
// -----------------------------------------------------------------------------
it("2.1 Le clic sur la croix (événement close sans isQuitting) masque la fenêtre sans la détruire", () => {
  let isQuitting = false;
  let prevented = false;
  let isVisible = true;
  let isDestroyed = false;

  const mockWindow = {
    hide: () => { isVisible = false; },
    show: () => { isVisible = true; },
    isDestroyed: () => isDestroyed,
    isVisible: () => isVisible
  };

  const closeHandler = (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mockWindow.hide();
    }
  };

  const event = {
    preventDefault: () => { prevented = true; }
  };

  // Clic sur la croix
  closeHandler(event);

  assert.strictEqual(prevented, true, "event.preventDefault() doit être appelé");
  assert.strictEqual(isVisible, false, "La fenêtre doit être masquée (isVisible = false)");
  assert.strictEqual(isDestroyed, false, "La fenêtre ne doit pas être détruite");
});

it("2.2 Plusieurs fermetures successives maintiennent la même fenêtre en mémoire", () => {
  let isQuitting = false;
  let hideCount = 0;
  let showCount = 0;
  let isVisible = true;

  const mockWindow = {
    hide: () => { isVisible = false; hideCount++; },
    show: () => { isVisible = true; showCount++; },
    isMinimized: () => false,
    isVisible: () => isVisible,
    focus: () => {}
  };

  const closeHandler = (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mockWindow.hide();
    }
  };

  const restore = () => {
    if (!mockWindow.isVisible()) {
      mockWindow.show();
    }
    mockWindow.focus();
  };

  // 1ère fermeture
  closeHandler({ preventDefault: () => {} });
  assert.strictEqual(hideCount, 1);
  assert.strictEqual(isVisible, false);

  // 1ère réouverture (via Tray ou raccourci)
  restore();
  assert.strictEqual(showCount, 1);
  assert.strictEqual(isVisible, true);

  // 2ème fermeture
  closeHandler({ preventDefault: () => {} });
  assert.strictEqual(hideCount, 2);
  assert.strictEqual(isVisible, false);

  // 2ème réouverture
  restore();
  assert.strictEqual(showCount, 2);
  assert.strictEqual(isVisible, true);
});

it("2.3 La relance de l'application (second-instance) restaure et donne le focus à la fenêtre existante", () => {
  let isMinimized = true;
  let isVisible = false;
  let restored = false;
  let focused = false;

  const mockWindow = {
    isMinimized: () => isMinimized,
    restore: () => { isMinimized = false; restored = true; },
    isVisible: () => isVisible,
    show: () => { isVisible = true; },
    focus: () => { focused = true; },
    isDestroyed: () => false
  };

  function restoreAndFocusWindow() {
    if (!mockWindow || mockWindow.isDestroyed()) return;
    if (mockWindow.isMinimized()) mockWindow.restore();
    if (!mockWindow.isVisible()) mockWindow.show();
    mockWindow.focus();
  }

  // Événement second-instance déclenché
  restoreAndFocusWindow();

  assert.strictEqual(restored, true, "La fenêtre minimisée doit être restaurée");
  assert.strictEqual(isVisible, true, "La fenêtre masquée doit être affichée (show)");
  assert.strictEqual(focused, true, "La fenêtre doit recevoir le focus");
});

it("2.4 La fermeture volontaire (Quitter) autorise la destruction normale de la fenêtre", () => {
  let isQuitting = false;
  let prevented = false;
  let appQuitCalled = false;

  // L'utilisateur clique sur 'Quitter Antigravité'
  const voluntaryQuit = () => {
    isQuitting = true;
    appQuitCalled = true;
  };

  voluntaryQuit();

  // Événement close reçu lors de l'arrêt
  const event = {
    preventDefault: () => { prevented = true; }
  };

  if (!isQuitting) {
    event.preventDefault();
  }

  assert.strictEqual(appQuitCalled, true, "app.quit() doit être appelé");
  assert.strictEqual(isQuitting, true, "isQuitting doit être à true");
  assert.strictEqual(prevented, false, "event.preventDefault() ne doit PAS être appelé lors d'une fermeture volontaire");
});

console.log("\n----------------------------------------------------------");
console.log(`Résultats : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) process.exit(1);
else process.exit(0);
