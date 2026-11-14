/**
 * Antigravité - Suite de tests automatisés :
 * Gestion et affichage des événements multi-jours et journées entières Google Calendar & Locaux
 */

const assert = require('assert');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests des événements multi-jours");
console.log("   (Google Calendar & Événements Locaux)");
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

// Charger les modules nécessaires
const calService = require('../services/google-calendar-service');
const AgendaManager = require('../js/agenda');

// =========================================================================
// 1. Événement sur une seule journée entière (all-day)
// =========================================================================
it("1.1 mapGoogleEventToAntigravite : Événement 1 jour avec end.date exclusive (+1j)", () => {
  const gEvt = {
    id: "g_1day_100",
    summary: "Séminaire d'une journée",
    start: { date: "2026-10-10" },
    end: { date: "2026-10-11" }, // Exclusive Google : couvre le 10 octobre uniquement
    status: "confirmed"
  };

  const mapped = calService.mapGoogleEventToAntigravite(gEvt, 'primary');
  assert.strictEqual(mapped.isAllDay, true, "isAllDay doit être vrai");
  assert.strictEqual(mapped.start, "2026-10-10T08:00", "Heure de début interne fixée à 08:00");
  assert.strictEqual(mapped.end, "2026-10-10T19:00", "Heure de fin interne fixée au même jour à 19:00");
  assert.strictEqual(mapped.source, 'google');
  assert.strictEqual(mapped.googleId, 'g_1day_100');
});

it("1.2 buildGooglePayload : Événement 1 jour exporté vers Google avec end.date (+1j)", () => {
  const localEvt = {
    title: "Journée de réflexion",
    start: "2026-10-10T08:00",
    end: "2026-10-10T19:00",
    isAllDay: true
  };

  const payload = calService.buildGooglePayload(localEvt);
  assert.strictEqual(payload.start.date, "2026-10-10", "start.date doit être le jour même");
  assert.strictEqual(payload.end.date, "2026-10-11", "end.date doit être le lendemain (borne exclusive)");
  assert.ok(!payload.start.dateTime, "start.dateTime ne doit pas être présent");
  assert.ok(!payload.end.dateTime, "end.dateTime ne doit pas être présent");
});

it("1.3 isEventOnDate : Présence exclusive sur la journée concernée pour un événement all-day mono-jour", () => {
  const evt = {
    id: "evt-1day",
    title: "Séminaire",
    start: "2026-10-10T08:00",
    end: "2026-10-10T19:00",
    isAllDay: true
  };

  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-09"), false, "Inactif la veille");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-10"), true, "Actif le jour J");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-11"), false, "Inactif le lendemain");
});

// =========================================================================
// 2. Événement sur plusieurs jours entiers (multi-day all-day)
// =========================================================================
it("2.1 mapGoogleEventToAntigravite : Événement multi-jours (10 au 12 inclus, end.date = 13)", () => {
  const gEvt = {
    id: "g_3days_200",
    summary: "Conférence Tech 3 jours",
    start: { date: "2026-10-10" },
    end: { date: "2026-10-13" }, // 3 jours complets : 10, 11 et 12 octobre
    status: "confirmed"
  };

  const mapped = calService.mapGoogleEventToAntigravite(gEvt, 'primary');
  assert.strictEqual(mapped.isAllDay, true);
  assert.strictEqual(mapped.start, "2026-10-10T08:00", "Début le 10 à 08:00");
  assert.strictEqual(mapped.end, "2026-10-12T19:00", "Fin inclusive le 12 à 19:00");
});

it("2.2 buildGooglePayload : Événement multi-jours converti avec end.date exclusive (+1j)", () => {
  const multiDayEvt = {
    title: "Congés d'automne",
    start: "2026-10-10T08:00",
    end: "2026-10-12T19:00",
    isAllDay: true
  };

  const payload = calService.buildGooglePayload(multiDayEvt);
  assert.strictEqual(payload.start.date, "2026-10-10");
  assert.strictEqual(payload.end.date, "2026-10-13", "end.date Google doit être le 13 (12 + 1j)");
});

it("2.3 isEventOnDate : Présence sur tous les jours d'un événement multi-jours", () => {
  const evt = {
    id: "evt-3days",
    title: "Conférence Tech",
    start: "2026-10-10T08:00",
    end: "2026-10-12T19:00",
    isAllDay: true
  };

  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-09"), false, "Inactif avant");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-10"), true, "Actif jour 1");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-11"), true, "Actif jour 2");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-12"), true, "Actif jour 3");
  assert.strictEqual(AgendaManager.isEventOnDate(evt, "2026-10-13"), false, "Inactif après la fin inclusive");
});

it("2.4 Franchissement de fin de mois et année sans décalage de fuseau horaire", () => {
  // Fin de mois
  const gEvtMonth = {
    id: "g_month_boundary",
    start: { date: "2026-10-30" },
    end: { date: "2026-11-03" } // 30, 31 oct + 01, 02 nov
  };
  const mappedMonth = calService.mapGoogleEventToAntigravite(gEvtMonth, 'primary');
  assert.strictEqual(mappedMonth.start, "2026-10-30T08:00");
  assert.strictEqual(mappedMonth.end, "2026-11-02T19:00");

  const payloadMonth = calService.buildGooglePayload({
    start: mappedMonth.start,
    end: mappedMonth.end,
    isAllDay: true
  });
  assert.strictEqual(payloadMonth.start.date, "2026-10-30");
  assert.strictEqual(payloadMonth.end.date, "2026-11-03");

  // Fin d'année
  const gEvtYear = {
    id: "g_year_boundary",
    start: { date: "2026-12-30" },
    end: { date: "2027-01-02" } // 30, 31 dec 2026 + 01 jan 2027
  };
  const mappedYear = calService.mapGoogleEventToAntigravite(gEvtYear, 'primary');
  assert.strictEqual(mappedYear.start, "2026-12-30T08:00");
  assert.strictEqual(mappedYear.end, "2027-01-01T19:00");

  const payloadYear = calService.buildGooglePayload({
    start: mappedYear.start,
    end: mappedYear.end,
    isAllDay: true
  });
  assert.strictEqual(payloadYear.start.date, "2026-12-30");
  assert.strictEqual(payloadYear.end.date, "2027-01-02");
});

// =========================================================================
// 3. Borne exclusive end.date et cas limites
// =========================================================================
it("3.1 Borne exclusive : Cas d'un événement Google avec end.date manquante ou invalide", () => {
  const gEvtMissingEnd = {
    id: "g_no_end",
    start: { date: "2026-10-10" }
  };
  const mapped = calService.mapGoogleEventToAntigravite(gEvtMissingEnd, 'primary');
  assert.strictEqual(mapped.start, "2026-10-10T08:00");
  assert.strictEqual(mapped.end, "2026-10-10T19:00", "Repli sur la même journée si end.date absente");

  const gEvtSameEnd = {
    id: "g_same_end",
    start: { date: "2026-10-10" },
    end: { date: "2026-10-10" }
  };
  const mappedSame = calService.mapGoogleEventToAntigravite(gEvtSameEnd, 'primary');
  assert.strictEqual(mappedSame.start, "2026-10-10T08:00");
  assert.strictEqual(mappedSame.end, "2026-10-10T19:00", "Repli sur la même journée si end.date <= start.date");
});

it("3.2 addDaysToIsoDate : Arithmétique calendaire UTC pure", () => {
  assert.strictEqual(calService.addDaysToIsoDate("2026-10-10", 1), "2026-10-11");
  assert.strictEqual(calService.addDaysToIsoDate("2026-10-11", -1), "2026-10-10");
  assert.strictEqual(calService.addDaysToIsoDate("2024-02-28", 1), "2024-02-29", "Année bissextile 2024");
  assert.strictEqual(calService.addDaysToIsoDate("2024-02-29", 1), "2024-03-01");
  assert.strictEqual(calService.addDaysToIsoDate("2024-03-01", -1), "2024-02-29");
  assert.strictEqual(calService.addDaysToIsoDate("2026-02-28", 1), "2026-03-01", "Année non-bissextile 2026");
});

// =========================================================================
// 4. Événement horaire (minuté) sur plusieurs jours
// =========================================================================
it("4.1 Événement minuté sur plusieurs jours (ex: 10 oct 22:00 -> 12 oct 04:00)", () => {
  const timedMultiEvt = {
    id: "evt-timed-multi",
    title: "Nuit du Code",
    start: "2026-10-10T22:00",
    end: "2026-10-12T04:00",
    isAllDay: false
  };

  assert.strictEqual(AgendaManager.isEventOnDate(timedMultiEvt, "2026-10-09"), false);
  assert.strictEqual(AgendaManager.isEventOnDate(timedMultiEvt, "2026-10-10"), true, "Actif le 10 à partir de 22:00");
  assert.strictEqual(AgendaManager.isEventOnDate(timedMultiEvt, "2026-10-11"), true, "Actif le 11 (journée entière)");
  assert.strictEqual(AgendaManager.isEventOnDate(timedMultiEvt, "2026-10-12"), true, "Actif le 12 jusqu'à 04:00");
  assert.strictEqual(AgendaManager.isEventOnDate(timedMultiEvt, "2026-10-13"), false);

  // Vérification de computeOverlappingLayout selon les jours
  const layoutDay1 = AgendaManager.computeOverlappingLayout([timedMultiEvt], "2026-10-10");
  assert.strictEqual(layoutDay1[0].startMin, 22 * 60, "Jour 1 : début à 22h00");
  assert.strictEqual(layoutDay1[0].endMin, AgendaManager.dayHoursEnd * 60, "Jour 1 : prolongé jusqu'à la fin de la grille (24h00)");

  const layoutDay2 = AgendaManager.computeOverlappingLayout([timedMultiEvt], "2026-10-11");
  assert.strictEqual(layoutDay2[0].startMin, AgendaManager.dayHoursStart * 60, "Jour 2 : commence dès le début de la grille (00h00)");
  assert.strictEqual(layoutDay2[0].endMin, AgendaManager.dayHoursEnd * 60, "Jour 2 : s'étend jusqu'à la fin de la grille (24h00)");

  const layoutDay3 = AgendaManager.computeOverlappingLayout([timedMultiEvt], "2026-10-12");
  assert.strictEqual(layoutDay3[0].startMin, AgendaManager.dayHoursStart * 60, "Jour 3 : commence à 00h00");
  // 4h00 est à 240 min -> Math.max(startMin + 20, 4*60) = 240 min car startMin est 00h00
  assert.strictEqual(layoutDay3[0].endMin, 240, "Jour 3 : se termine à 04h00 (240 min)");
});

it("4.2 Événement minuté se terminant exactement à 00:00 (minuit)", () => {
  const midnightEvt = {
    id: "evt-midnight",
    title: "Session du soir",
    start: "2026-10-10T20:00",
    end: "2026-10-11T00:00",
    isAllDay: false
  };

  assert.strictEqual(AgendaManager.isEventOnDate(midnightEvt, "2026-10-10"), true, "Actif le 10 de 20:00 à minuit");
  assert.strictEqual(AgendaManager.isEventOnDate(midnightEvt, "2026-10-11"), false, "Inactif le 11 car 0 minute écoulée");
  assert.strictEqual(AgendaManager.isEventOnDate(midnightEvt, "2026-10-12"), false);
});

// =========================================================================
// 5. Événements commençant ou finissant à la limite de la période affichée
// =========================================================================
it("5.1 Événements débordant avant ou après la semaine affichée", () => {
  // Semaine type : du Lundi 12 au Dimanche 18 Octobre 2026
  const weekDays = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

  // Événement A : commence la semaine précédente et se termine le Mercredi 14
  const evtBefore = {
    id: "evt-before",
    title: "Voyage pro partie 1",
    start: "2026-10-05T08:00",
    end: "2026-10-14T19:00",
    isAllDay: true
  };

  assert.strictEqual(AgendaManager.isEventOnDate(evtBefore, "2026-10-12"), true, "Lun 12 : actif");
  assert.strictEqual(AgendaManager.isEventOnDate(evtBefore, "2026-10-13"), true, "Mar 13 : actif");
  assert.strictEqual(AgendaManager.isEventOnDate(evtBefore, "2026-10-14"), true, "Mer 14 : actif (dernier jour)");
  assert.strictEqual(AgendaManager.isEventOnDate(evtBefore, "2026-10-15"), false, "Jeu 15 : inactif");
  assert.strictEqual(AgendaManager.isEventOnDate(evtBefore, "2026-10-16"), false, "Ven 16 : inactif");

  // Événement B : commence le Vendredi 16 et se termine la semaine suivante (22 oct)
  const evtAfter = {
    id: "evt-after",
    title: "Voyage pro partie 2",
    start: "2026-10-16T08:00",
    end: "2026-10-22T19:00",
    isAllDay: true
  };

  assert.strictEqual(AgendaManager.isEventOnDate(evtAfter, "2026-10-15"), false, "Jeu 15 : inactif");
  assert.strictEqual(AgendaManager.isEventOnDate(evtAfter, "2026-10-16"), true, "Ven 16 : actif (premier jour)");
  assert.strictEqual(AgendaManager.isEventOnDate(evtAfter, "2026-10-17"), true, "Sam 17 : actif");
  assert.strictEqual(AgendaManager.isEventOnDate(evtAfter, "2026-10-18"), true, "Dim 18 : actif");

  // Événement C : englobe toute la semaine (du 1er au 31 oct)
  const evtEncompassing = {
    id: "evt-all-month",
    title: "Mois Antigravité",
    start: "2026-10-01T08:00",
    end: "2026-10-31T19:00",
    isAllDay: true
  };
  weekDays.forEach(day => {
    assert.strictEqual(AgendaManager.isEventOnDate(evtEncompassing, day), true, `Actif sur ${day}`);
  });
});

// =========================================================================
// 6. Absence de régression sur les événements locaux
// =========================================================================
it("6.1 Événements locaux (mono-jour minuté) restent 100% compatibles", () => {
  const localEvt = {
    id: "evt-local-1",
    title: "Rédaction rapport",
    description: "Finir le livrable",
    start: "2026-10-15T14:00",
    end: "2026-10-15T16:00",
    isAllDay: false,
    source: "local",
    taskId: "task-999",
    noteId: "note-888"
  };

  assert.strictEqual(AgendaManager.isEventOnDate(localEvt, "2026-10-15"), true);
  assert.strictEqual(AgendaManager.isEventOnDate(localEvt, "2026-10-14"), false);
  assert.strictEqual(AgendaManager.isEventOnDate(localEvt, "2026-10-16"), false);

  const layout = AgendaManager.computeOverlappingLayout([localEvt], "2026-10-15");
  assert.strictEqual(layout.length, 1);
  assert.strictEqual(layout[0].startMin, 14 * 60);
  assert.strictEqual(layout[0].endMin, 16 * 60);
});

it("6.2 Événements locaux multi-jours créés directement dans Antigravité", () => {
  const localMulti = {
    id: "evt-local-multi",
    title: "Vacances en famille",
    start: "2026-10-20T08:00",
    end: "2026-10-25T19:00",
    isAllDay: true,
    source: "local"
  };

  assert.strictEqual(AgendaManager.isEventOnDate(localMulti, "2026-10-19"), false);
  assert.strictEqual(AgendaManager.isEventOnDate(localMulti, "2026-10-20"), true);
  assert.strictEqual(AgendaManager.isEventOnDate(localMulti, "2026-10-22"), true);
  assert.strictEqual(AgendaManager.isEventOnDate(localMulti, "2026-10-25"), true);
  assert.strictEqual(AgendaManager.isEventOnDate(localMulti, "2026-10-26"), false);
});

// =========================================================================
// Synthèse
// =========================================================================
console.log("----------------------------------------------------------");
console.log(`Résultats des tests multi-jours : ${passed} passés, ${failed} échoués`);
console.log("----------------------------------------------------------\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
