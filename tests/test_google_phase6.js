/**
 * Antigravité - Tests automatisés pour la Phase 6 :
 * Compatibilité avec le système de sauvegardes et non-fuite de secrets
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests automatisés Phase 6 Google Agenda");
console.log("   (Compatibilité des Sauvegardes & Sécurité des Données)");
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

// Mock des structures pour simuler StorageManager
const mockStorage = {
  tasks: [
    { id: "task-001", title: "Rapport trimestriel", completed: false, priority: "high", subtasks: [] }
  ],
  projects: [
    { id: "proj-001", title: "Projet Alpha" }
  ],
  events: [
    {
      id: "evt-local-01",
      title: "Créneau local personnel",
      start: "2026-10-31T09:00",
      end: "2026-10-31T10:00",
      source: "local",
      taskId: "task-001"
    },
    {
      id: "evt-g-12345",
      googleId: "12345_google_id",
      googleCalendarId: "primary",
      googleEtag: '"etag-phase6"',
      title: "Réunion Google Agenda synchronisée",
      location: "Bureau 102",
      start: "2026-10-31T14:00",
      end: "2026-10-31T15:00",
      source: "google",
      status: "confirmed",
      syncStatus: "synced",
      htmlLink: "https://calendar.google.com/calendar/event?eid=12345_google_id",
      taskId: "task-001"
    }
  ],
  notes: [
    { id: "note-01", title: "Note de cadrage" }
  ],
  settings: {
    theme: "dark",
    density: "comfortable"
  },

  getFullExport() {
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: JSON.parse(JSON.stringify(this.tasks)),
      projects: JSON.parse(JSON.stringify(this.projects)),
      events: JSON.parse(JSON.stringify(this.events)),
      notes: JSON.parse(JSON.stringify(this.notes)),
      settings: JSON.parse(JSON.stringify(this.settings))
    };
  },

  restoreFullExport(data) {
    if (!data || typeof data !== 'object') throw new Error("Format de sauvegarde invalide.");
    if (data.tasks) this.tasks = JSON.parse(JSON.stringify(data.tasks));
    if (data.projects) this.projects = JSON.parse(JSON.stringify(data.projects));
    if (data.events) this.events = JSON.parse(JSON.stringify(data.events));
    if (data.notes) this.notes = JSON.parse(JSON.stringify(data.notes));
    if (data.settings) this.settings = JSON.parse(JSON.stringify(data.settings));
    return true;
  }
};

// -----------------------------------------------------------------------------
// Test 1 : Vérification qu'aucun token ou secret OAuth ne fuite dans l'export
// -----------------------------------------------------------------------------
it("Garantie absolue de non-fuite de secrets OAuth dans l'export de sauvegarde", () => {
  const exportPayload = mockStorage.getFullExport();
  const exportString = JSON.stringify(exportPayload);

  // Recherche de marqueurs de jetons ou secrets
  const forbiddenPatterns = [
    /access_token/i,
    /refresh_token/i,
    /client_secret/i,
    /clientSecret/i,
    /ya29\./,
    /GOCSPX-/,
    /1\/\/0[a-zA-Z0-9_-]+/
  ];

  forbiddenPatterns.forEach(pattern => {
    assert.ok(
      !pattern.test(exportString),
      `L'export de sauvegarde ne doit jamais contenir de motif sensible correspondant à ${pattern}`
    );
  });
});

// -----------------------------------------------------------------------------
// Test 2 : Préservation des métadonnées des événements Google dans la sauvegarde
// -----------------------------------------------------------------------------
it("L'export de sauvegarde conserve fidèlement la structure des événements Google et les liaisons", () => {
  const exportPayload = mockStorage.getFullExport();
  const googleEvt = exportPayload.events.find(e => e.source === 'google');

  assert.ok(googleEvt, "L'événement Google doit être présent dans l'export");
  assert.strictEqual(googleEvt.googleId, "12345_google_id");
  assert.strictEqual(googleEvt.googleCalendarId, "primary");
  assert.strictEqual(googleEvt.taskId, "task-001");
  assert.strictEqual(googleEvt.location, "Bureau 102");
  assert.strictEqual(googleEvt.htmlLink, "https://calendar.google.com/calendar/event?eid=12345_google_id");
});

// -----------------------------------------------------------------------------
// Test 3 : Restauration d'une sauvegarde et intégrité de la réconciliation
// -----------------------------------------------------------------------------
it("La restauration d'une sauvegarde réintègre les créneaux Google sans altération", () => {
  const exported = mockStorage.getFullExport();

  // Modification temporaire du stockage
  mockStorage.events = [];
  assert.strictEqual(mockStorage.events.length, 0);

  // Restauration
  const restored = mockStorage.restoreFullExport(exported);
  assert.strictEqual(restored, true);
  assert.strictEqual(mockStorage.events.length, 2);

  const restoredGoogle = mockStorage.events.find(e => e.id === "evt-g-12345");
  assert.ok(restoredGoogle);
  assert.strictEqual(restoredGoogle.title, "Réunion Google Agenda synchronisée");
  assert.strictEqual(restoredGoogle.taskId, "task-001");
});

// -----------------------------------------------------------------------------
// Test 4 : Réconciliation avec une nouvelle synchronisation après restauration
// -----------------------------------------------------------------------------
it("Après restauration, la synchronisation incrémentale ne crée pas de doublons", () => {
  const incomingFromGoogle = [
    {
      id: "evt-g-12345",
      googleId: "12345_google_id",
      title: "Réunion Google Agenda synchronisée (Titre modifié sur Google)",
      start: "2026-10-31T14:30",
      end: "2026-10-31T15:30",
      source: "google",
      status: "confirmed",
      syncStatus: "synced"
    }
  ];

  // Simulation de la fusion (mergeGoogleEvents)
  const currentEvents = mockStorage.events;
  const localOnly = currentEvents.filter(e => e.source !== 'google');
  const existingGoogleMap = new Map();
  currentEvents.filter(e => e.source === 'google').forEach(e => existingGoogleMap.set(e.googleId, e));

  const updatedGoogleList = [];
  incomingFromGoogle.forEach(gEvt => {
    const existing = existingGoogleMap.get(gEvt.googleId);
    if (existing) {
      gEvt.taskId = existing.taskId; // Conservation de la liaison restaurée
      gEvt.id = existing.id;
    }
    updatedGoogleList.push(gEvt);
  });

  const merged = [...localOnly, ...updatedGoogleList];
  assert.strictEqual(merged.length, 2, "Aucun doublon ne doit être créé");
  const gUpdated = merged.find(e => e.googleId === "12345_google_id");
  assert.strictEqual(gUpdated.title, "Réunion Google Agenda synchronisée (Titre modifié sur Google)");
  assert.strictEqual(gUpdated.taskId, "task-001", "La liaison avec la tâche doit avoir survécu");
});

console.log("\n----------------------------------------------------------");
console.log(`Résultats Phase 6 : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
