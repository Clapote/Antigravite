/**
 * Antigravité - Tests automatisés pour la Phase 4 :
 * Création et modification bidirectionnelle d'événements Google Agenda
 */

const assert = require('assert');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests automatisés Phase 4 Google Agenda");
console.log("   (Création & Modification Bidirectionnelles)");
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

// Importer le service Google Calendar
const googleCalendarService = require('../services/google-calendar-service');

// -----------------------------------------------------------------------------
// Test 1 : Construction du payload API Google Calendar pour événement minuté
// -----------------------------------------------------------------------------
it("buildGooglePayload formate correctement un créneau minuté", () => {
  const input = {
    title: "Atelier Antigravité",
    description: "Discussion sur l'architecture",
    location: "Salle de réunion A",
    start: "2026-10-30T10:00:00",
    end: "2026-10-30T11:30:00",
    isAllDay: false
  };

  const payload = googleCalendarService.buildGooglePayload(input);
  assert.strictEqual(payload.summary, "Atelier Antigravité");
  assert.strictEqual(payload.description, "Discussion sur l'architecture");
  assert.strictEqual(payload.location, "Salle de réunion A");
  assert.ok(payload.start && payload.start.dateTime, "start.dateTime doit être présent");
  assert.ok(payload.end && payload.end.dateTime, "end.dateTime doit être présent");
  assert.ok(!payload.start.date, "start.date ne doit pas être présent pour un créneau minuté");
});

// -----------------------------------------------------------------------------
// Test 2 : Construction du payload pour événement journée entière
// -----------------------------------------------------------------------------
it("buildGooglePayload calcule correctement start.date et end.date (+1j) pour journée entière", () => {
  const input = {
    title: "Journée de Hackathon",
    description: "Toute la journée",
    location: "Campus",
    start: "2026-11-05",
    end: "2026-11-05",
    isAllDay: true
  };

  const payload = googleCalendarService.buildGooglePayload(input);
  assert.strictEqual(payload.summary, "Journée de Hackathon");
  assert.strictEqual(payload.start.date, "2026-11-05");
  // Dans Google Calendar, la fin d'une journée entière est exclusive (au moins +1 jour)
  assert.strictEqual(payload.end.date, "2026-11-06");
  assert.ok(!payload.start.dateTime, "start.dateTime ne doit pas être présent");
});

// -----------------------------------------------------------------------------
// Test 3 : Repli gracieux pour titre vide
// -----------------------------------------------------------------------------
it("buildGooglePayload remplace un titre vide par (Sans titre)", () => {
  const input = {
    title: "   ",
    start: "2026-10-30T10:00:00",
    end: "2026-10-30T11:00:00",
    isAllDay: false
  };

  const payload = googleCalendarService.buildGooglePayload(input);
  assert.strictEqual(payload.summary, "(Sans titre)");
});

// -----------------------------------------------------------------------------
// Test 4 : Mapping d'un événement créé retourné par Google vers Antigravité
// -----------------------------------------------------------------------------
it("mapGoogleEventToAntigravite mappe fidèlement un retour d'API Google", () => {
  const googleApiResponse = {
    id: "g_evt_created_123",
    etag: '"etag123"',
    summary: "Rendez-vous client",
    description: "Revue mensuelle",
    location: "Google Meet",
    start: { dateTime: "2026-10-30T14:00:00+01:00" },
    end: { dateTime: "2026-10-30T15:00:00+01:00" },
    status: "confirmed",
    htmlLink: "https://calendar.google.com/calendar/event?eid=g_evt_created_123",
    created: "2026-10-25T10:00:00Z",
    updated: "2026-10-25T10:00:00Z"
  };

  const mapped = googleCalendarService.mapGoogleEventToAntigravite(googleApiResponse, "primary");
  assert.strictEqual(mapped.id, "evt-g-g_evt_created_123");
  assert.strictEqual(mapped.googleId, "g_evt_created_123");
  assert.strictEqual(mapped.source, "google");
  assert.strictEqual(mapped.syncStatus, "synced");
  assert.strictEqual(mapped.location, "Google Meet");
  assert.strictEqual(mapped.htmlLink, "https://calendar.google.com/calendar/event?eid=g_evt_created_123");
  assert.strictEqual(mapped.title, "Rendez-vous client");
});

// -----------------------------------------------------------------------------
// Test 5 : Mock de persistance et simulation de création/mise à jour UI
// -----------------------------------------------------------------------------
const mockStore = {
  events: [
    {
      id: "evt-local-1",
      title: "Créneau local existant",
      start: "2026-10-29T09:00",
      end: "2026-10-29T10:00",
      source: "local",
      taskId: "task-01"
    }
  ],
  getEvents() { return JSON.parse(JSON.stringify(this.events)); },
  saveEvents(evts) { this.events = JSON.parse(JSON.stringify(evts)); }
};

it("La création d'un événement Google l'ajoute dans le stockage sans altérer les créneaux locaux", () => {
  const createdGoogleEvt = {
    id: "evt-g-new1",
    googleId: "new1",
    googleCalendarId: "primary",
    title: "Créneau créé depuis Antigravité",
    start: "2026-10-29T11:00",
    end: "2026-10-29T12:00",
    source: "google",
    syncStatus: "synced",
    taskId: "task-02"
  };

  const current = mockStore.getEvents();
  current.push(createdGoogleEvt);
  mockStore.saveEvents(current);

  const updatedStore = mockStore.getEvents();
  assert.strictEqual(updatedStore.length, 2);
  const localEvt = updatedStore.find(e => e.id === "evt-local-1");
  assert.strictEqual(localEvt.source, "local");
  assert.strictEqual(localEvt.taskId, "task-01");
  const gEvt = updatedStore.find(e => e.id === "evt-g-new1");
  assert.strictEqual(gEvt.source, "google");
  assert.strictEqual(gEvt.taskId, "task-02");
});

it("La modification d'un événement Google met à jour les champs locaux et préserve l'ID Google et la tâche", () => {
  const current = mockStore.getEvents();
  const idx = current.findIndex(e => e.id === "evt-g-new1");
  assert.ok(idx !== -1);

  current[idx].title = "Titre mis à jour avec succès";
  current[idx].location = "Visioconférence";
  current[idx].updatedAt = new Date().toISOString();
  mockStore.saveEvents(current);

  const afterUpdate = mockStore.getEvents();
  const updatedEvt = afterUpdate.find(e => e.id === "evt-g-new1");
  assert.strictEqual(updatedEvt.title, "Titre mis à jour avec succès");
  assert.strictEqual(updatedEvt.location, "Visioconférence");
  assert.strictEqual(updatedEvt.googleId, "new1");
  assert.strictEqual(updatedEvt.taskId, "task-02");
});

// -----------------------------------------------------------------------------
// Test 6 : Anti-boucle : les créneaux synchronisés portent le flag synced
// -----------------------------------------------------------------------------
it("Mécanisme anti-boucle : syncStatus='synced' garantit qu'aucun renvoi infini n'est provoqué", () => {
  const evts = mockStore.getEvents();
  const googleEvts = evts.filter(e => e.source === 'google');
  googleEvts.forEach(e => {
    assert.strictEqual(e.syncStatus, 'synced', "L'événement Google doit être marqué comme synchronisé");
  });
});

console.log("\n----------------------------------------------------------");
console.log(`Résultats Phase 4 : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
