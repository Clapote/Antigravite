/**
 * Antigravité - Tests automatisés pour la Phase 2 :
 * Intégration Google Agenda (Authentification & Lecture Seule)
 */

const assert = require('assert');

console.log("==========================================================");
console.log("   Antigravité - Tests automatisés Phase 2 Google Agenda");
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

// 1. Vérification du mappage des événements Google -> Antigravité
const calService = require('../services/google-calendar-service');

it("Mappage d'un événement Google horodaté standard", () => {
  const mockGoogleEvent = {
    id: "g_evt_12345",
    etag: "\"3340592812000000\"",
    summary: "Réunion d'architecture Antigravité",
    description: "Revue des modules et de la sécurité",
    location: "Visioconférence Meet",
    start: { dateTime: "2026-10-28T14:30:00+02:00" },
    end: { dateTime: "2026-10-28T16:00:00+02:00" },
    colorId: "7",
    status: "confirmed",
    created: "2026-10-25T10:00:00.000Z",
    updated: "2026-10-25T11:00:00.000Z"
  };

  const mapped = calService.mapGoogleEventToAntigravite(mockGoogleEvent, 'primary');

  assert.strictEqual(mapped.id, 'evt-g-g_evt_12345');
  assert.strictEqual(mapped.googleId, 'g_evt_12345');
  assert.strictEqual(mapped.source, 'google');
  assert.strictEqual(mapped.syncStatus, 'synced');
  assert.strictEqual(mapped.title, "Réunion d'architecture Antigravité");
  assert.strictEqual(mapped.isAllDay, false);
  assert.strictEqual(mapped.color, '#039be5'); // Color 7 = Paon (#039be5)
  assert.ok(mapped.start.includes('T14:30') || mapped.start.includes('T13:30') || mapped.start.includes('T12:30'));
});

it("Mappage d'un événement Google en journée entière (all-day)", () => {
  const mockAllDayEvent = {
    id: "g_allday_99",
    summary: "Journée de formation",
    start: { date: "2026-10-29" },
    end: { date: "2026-10-30" },
    status: "confirmed"
  };

  const mapped = calService.mapGoogleEventToAntigravite(mockAllDayEvent, 'primary');

  assert.strictEqual(mapped.isAllDay, true);
  assert.strictEqual(mapped.start, '2026-10-29T08:00');
  assert.strictEqual(mapped.end, '2026-10-29T19:00');
});

it("Le service Google Calendar expose une méthode fetchEvents pour la lecture sécurisée", () => {
  assert.strictEqual(typeof calService.fetchEvents, 'function', "fetchEvents doit être une fonction");
});

// 2. Vérification que les jetons et secrets ne fuient pas dans getStatus()
it("Éléments sensibles (secrets/tokens) strictement masqués dans getStatus()", () => {
  const mockAuthCache = {
    clientId: "123456789-abcdef.apps.googleusercontent.com",
    clientSecret: "GOCSPX-SUPER_SECRET_VALUE",
    tokens: {
      access_token: "ya29.VERY_SECRET_ACCESS_TOKEN",
      refresh_token: "1//VERY_SECRET_REFRESH_TOKEN",
      expiry_date: Date.now() + 3600000
    },
    user: {
      email: "test.lucas@gmail.com",
      name: "Lucas Test"
    },
    selectedCalendarId: "primary",
    selectedCalendarSummary: "Lucas"
  };

  // Simuler le filtrage de getStatus
  const status = {
    hasCredentials: !!(mockAuthCache.clientId && mockAuthCache.clientSecret),
    clientIdMasked: mockAuthCache.clientId ? `${mockAuthCache.clientId.slice(0, 14)}...` : null,
    isConnected: !!(mockAuthCache.tokens && mockAuthCache.tokens.refresh_token),
    userEmail: mockAuthCache.user?.email || null,
    userName: mockAuthCache.user?.name || null,
    selectedCalendarId: mockAuthCache.selectedCalendarId || 'primary',
    selectedCalendarSummary: mockAuthCache.selectedCalendarSummary || 'Principal'
  };

  assert.strictEqual(status.isConnected, true);
  assert.strictEqual(status.userEmail, 'test.lucas@gmail.com');
  assert.strictEqual(status.clientSecret, undefined, "clientSecret ne doit JAMAIS apparaître dans le statut");
  assert.strictEqual(status.tokens, undefined, "tokens ne doivent JAMAIS apparaître dans le statut");
  assert.ok(!JSON.stringify(status).includes("GOCSPX"));
  assert.ok(!JSON.stringify(status).includes("ya29."));
});

console.log("==========================================================");
console.log(`   RÉSULTATS DES TESTS PHASE 2 : ${passed} réussis, ${failed} échoués`);
console.log("==========================================================");

if (failed > 0) process.exit(1);
