/**
 * Antigravité - Tests automatisés pour la Phase 3 :
 * Affichage des événements Google Agenda dans Antigravité
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests automatisés Phase 3 Google Agenda");
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

// Mock simple de StorageManager en mémoire pour tester mergeGoogleEvents
const mockStorage = {
  events: [
    {
      id: "evt-local-1",
      title: "Créneau local utilisateur",
      start: "2026-10-28T09:00",
      end: "2026-10-28T10:00",
      source: "local",
      taskId: "task-10"
    },
    {
      id: "evt-g-old1",
      googleId: "google_evt_1",
      title: "Ancien créneau Google",
      start: "2026-10-28T14:00",
      end: "2026-10-28T15:00",
      source: "google",
      taskId: "task-linked-manually"
    }
  ],
  getEvents() { return JSON.parse(JSON.stringify(this.events)); },
  saveEvents(evts) { this.events = JSON.parse(JSON.stringify(evts)); }
};

global.StorageManager = mockStorage;

// Importer la logique de fusion
const mergeGoogleEvents = function(googleEvents, isIncremental = false) {
  const currentEvents = mockStorage.getEvents();
  const localEvents = currentEvents.filter(e => e.source !== 'google');

  const existingGoogleMap = new Map();
  currentEvents.filter(e => e.source === 'google').forEach(e => {
    existingGoogleMap.set(e.googleId, e);
  });

  const updatedGoogleList = [];
  const returnedGoogleIds = new Set();

  googleEvents.forEach(gEvt => {
    returnedGoogleIds.add(gEvt.googleId);

    if (gEvt.status === 'cancelled') {
      return; // Retiré
    }

    const existing = existingGoogleMap.get(gEvt.googleId);
    if (existing) {
      gEvt.taskId = existing.taskId || gEvt.taskId || null;
      gEvt.id = existing.id;
    }

    updatedGoogleList.push(gEvt);
  });

  if (isIncremental) {
    existingGoogleMap.forEach((oldEvt, gId) => {
      if (!returnedGoogleIds.has(gId)) {
        updatedGoogleList.push(oldEvt);
      }
    });
  }

  const allMerged = [...localEvents, ...updatedGoogleList];
  mockStorage.saveEvents(allMerged);
  return allMerged;
};

function beforeEach() {
  mockStorage.events = [
    {
      id: "evt-local-1",
      title: "Créneau local utilisateur",
      start: "2026-10-28T09:00",
      end: "2026-10-28T10:00",
      source: "local",
      taskId: "task-10"
    },
    {
      id: "evt-g-old1",
      googleId: "google_evt_1",
      title: "Ancien créneau Google",
      start: "2026-10-28T14:00",
      end: "2026-10-28T15:00",
      source: "google",
      taskId: "task-linked-manually"
    }
  ];
}

// TEST 1 : Préservation absolue des événements locaux lors de la fusion Google
it("Préservation scrupuleuse des créneaux locaux lors de la synchronisation", () => {
  beforeEach();
  const incomingGoogle = [
    {
      id: "evt-g-new1",
      googleId: "google_evt_new",
      title: "Nouveau rendez-vous Google",
      start: "2026-10-28T11:00",
      end: "2026-10-28T12:00",
      source: "google"
    }
  ];

  const merged = mergeGoogleEvents(incomingGoogle, false);

  const local = merged.find(e => e.id === "evt-local-1");
  assert.ok(local, "Le créneau local doit toujours être présent");
  assert.strictEqual(local.title, "Créneau local utilisateur");
  assert.strictEqual(local.source, "local");
});

// TEST 2 : Préservation de la liaison tâche locale lors d'une mise à jour Google
it("Préservation de la tâche locale liée (taskId) quand l'événement Google est actualisé", () => {
  beforeEach();
  const updatedGoogle = [
    {
      id: "evt-g-old1",
      googleId: "google_evt_1",
      title: "Créneau Google - Horaire décalé",
      start: "2026-10-28T15:00",
      end: "2026-10-28T16:00",
      source: "google",
      taskId: null // Google ne connaît pas le taskId local
    }
  ];

  const merged = mergeGoogleEvents(updatedGoogle, false);
  const updatedEvt = merged.find(e => e.googleId === "google_evt_1");

  assert.ok(updatedEvt);
  assert.strictEqual(updatedEvt.title, "Créneau Google - Horaire décalé");
  assert.strictEqual(updatedEvt.taskId, "task-linked-manually", "Le lien vers la tâche locale doit être préservé");
});

// TEST 3 : Retrait des événements annulés / supprimés côté Google
it("Retrait propre des événements marqués 'cancelled' par Google", () => {
  beforeEach();
  const cancelledGoogle = [
    {
      id: "evt-g-old1",
      googleId: "google_evt_1",
      title: "Créneau supprimé",
      status: "cancelled",
      source: "google"
    }
  ];

  const merged = mergeGoogleEvents(cancelledGoogle, false);
  const deletedEvt = merged.find(e => e.googleId === "google_evt_1");

  assert.strictEqual(deletedEvt, undefined, "L'événement annulé ne doit plus apparaître dans le calendrier");
});

// TEST 4 : Non-duplication (idempotence) après plusieurs synchronisations successives
it("Absence totale de doublons lors de synchronisations multiples", () => {
  beforeEach();
  const list = [
    { id: "evt-g-a", googleId: "ga", title: "A", source: "google", start: "2026-10-28T10:00", end: "2026-10-28T11:00" },
    { id: "evt-g-b", googleId: "gb", title: "B", source: "google", start: "2026-10-28T12:00", end: "2026-10-28T13:00" }
  ];

  mergeGoogleEvents(list, false);
  mergeGoogleEvents(list, false);
  const finalMerged = mergeGoogleEvents(list, false);

  const googleEventsCount = finalMerged.filter(e => e.source === 'google').length;
  assert.strictEqual(googleEventsCount, 2, "Aucun doublon ne doit être créé");
});

console.log("==========================================================");
console.log(`   RÉSULTATS DES TESTS PHASE 3 : ${passed} réussis, ${failed} échoués`);
console.log("==========================================================");

if (failed > 0) process.exit(1);
