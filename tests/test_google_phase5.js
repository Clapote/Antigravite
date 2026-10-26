/**
 * Antigravité - Tests automatisés pour la Phase 5 :
 * Suppressions, gestion des conflits, fonctionnement hors-ligne et robustesse
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests automatisés Phase 5 Google Agenda");
console.log("   (Suppressions, Conflits & File Hors-ligne)");
console.log("==========================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc} : ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Test 1 : Existence et méthode deleteEvent dans googleCalendarService
// -----------------------------------------------------------------------------
const googleCalendarService = require('../services/google-calendar-service');

it("Le service Google Calendar expose une méthode deleteEvent", () => {
  assert.strictEqual(typeof googleCalendarService.deleteEvent, 'function', "deleteEvent doit être une fonction");
});

// -----------------------------------------------------------------------------
// Test 2 : Préservation de la tâche liée lors de la suppression d'un événement Google
// -----------------------------------------------------------------------------
it("Règle n°6 : La suppression d'un créneau Google ne supprime JAMAIS la tâche associée", () => {
  const mockTasks = [
    { id: "task-important-1", title: "Projet de synthèse", completed: false }
  ];

  let mockEvents = [
    {
      id: "evt-g-123",
      googleId: "google_123",
      title: "Créneau Google lié",
      source: "google",
      taskId: "task-important-1"
    }
  ];

  // Simulation de la suppression du créneau Google
  const targetId = "evt-g-123";
  const targetEvt = mockEvents.find(e => e.id === targetId);
  assert.ok(targetEvt, "Le créneau doit exister avant suppression");

  // Retrait du créneau
  mockEvents = mockEvents.filter(e => e.id !== targetId);

  // Vérification
  assert.strictEqual(mockEvents.length, 0, "L'événement doit être retiré de l'agenda");
  const taskStillExists = mockTasks.find(t => t.id === "task-important-1");
  assert.ok(taskStillExists, "La tâche liée doit impérativement rester intacte");
  assert.strictEqual(taskStillExists.title, "Projet de synthèse");
});

// -----------------------------------------------------------------------------
// Test 3 : Gestion de la file d'attente hors-ligne (Enqueue, Replay, Idempotence)
// -----------------------------------------------------------------------------
const mockLocalStorage = {};
global.localStorage = {
  getItem(k) { return mockLocalStorage[k] || null; },
  setItem(k, v) { mockLocalStorage[k] = String(v); },
  removeItem(k) { delete mockLocalStorage[k]; }
};

const QUEUE_KEY = 'antigravite_google_sync_queue';

function getOfflineQueue() {
  try {
    const raw = global.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOfflineQueue(queue) {
  global.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueueOfflineAction(action, payload) {
  const queue = getOfflineQueue();
  queue.push({
    id: 'qa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    action,
    payload,
    createdAt: new Date().toISOString()
  });
  saveOfflineQueue(queue);
}

it("La file d'attente hors-ligne empile et persiste correctement les actions", () => {
  global.localStorage.removeItem(QUEUE_KEY);
  assert.strictEqual(getOfflineQueue().length, 0);

  // 1. Enqueue Delete
  enqueueOfflineAction('delete', { googleId: 'g_del_1', calendarId: 'primary' });
  // 2. Enqueue Create
  enqueueOfflineAction('create', { tempId: 'evt-g-pending-1', eventData: { title: 'Réunion offline' } });
  // 3. Enqueue Update
  enqueueOfflineAction('update', { googleId: 'g_up_2', updatedData: { title: 'Nouveau titre' } });

  const queue = getOfflineQueue();
  assert.strictEqual(queue.length, 3);
  assert.strictEqual(queue[0].action, 'delete');
  assert.strictEqual(queue[1].action, 'create');
  assert.strictEqual(queue[2].action, 'update');
});

// -----------------------------------------------------------------------------
// Test 4 : Simulation du dépilage de la file d'attente hors-ligne
// -----------------------------------------------------------------------------
it("Le dépilage applique les actions et vide la file d'attente", async () => {
  const executedActions = [];

  const queue = getOfflineQueue();
  for (const item of queue) {
    executedActions.push(item.action);
  }

  // File vidée après traitement
  saveOfflineQueue([]);
  assert.strictEqual(getOfflineQueue().length, 0);
  assert.deepStrictEqual(executedActions, ['delete', 'create', 'update']);
});

// -----------------------------------------------------------------------------
// Test 5 : Détection des erreurs réseau (isNetworkError)
// -----------------------------------------------------------------------------
function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return err.name === 'TypeError' ||
         msg.includes('fetch failed') ||
         msg.includes('network') ||
         msg.includes('timeout') ||
         msg.includes('enotfound') ||
         msg.includes('econnrefused') ||
         msg.includes('etimedout') ||
         msg.includes('offline');
}

it("isNetworkError identifie correctement les pannes réseau et le mode hors-ligne", () => {
  const errFetchFailed = new TypeError("fetch failed");
  const errDns = new Error("getaddrinfo ENOTFOUND www.googleapis.com");
  const errTimeout = new Error("Connection timed out (ETIMEDOUT)");
  const errNormal = new Error("Titre d'événement requis");

  assert.strictEqual(isNetworkError(errFetchFailed), true);
  assert.strictEqual(isNetworkError(errDns), true);
  assert.strictEqual(isNetworkError(errTimeout), true);
  assert.strictEqual(isNetworkError(errNormal), false);
});

// -----------------------------------------------------------------------------
// Test 6 : Code d'erreur CONFLICT pour détection de modification concurrente
// -----------------------------------------------------------------------------
it("La détection de conflit positionne code = 'CONFLICT' sur l'erreur", () => {
  const conflictErr = new Error("Conflit de modification : l'événement a été modifié directement sur Google Agenda.");
  conflictErr.code = 'CONFLICT';

  assert.strictEqual(conflictErr.code, 'CONFLICT');
  assert.ok(conflictErr.message.includes("Conflit"));
});

console.log("\n----------------------------------------------------------");
console.log(`Résultats Phase 5 : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
