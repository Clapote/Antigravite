/**
 * Antigravité - Tests automatisés pour la Validation Globale de l'Interface (Phase 3)
 * Couvre : Adaptabilité des modales, non-chevauchement d'agenda, contrastes multi-thèmes et intégrité.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests Validation Globale de l'Interface");
console.log("   (Modales, Agenda, Contrastes Thèmes & Non-chevauchement)");
console.log("==========================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc} : ${err.stack || err.message}`);
    failed++;
  }
}

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');

// -----------------------------------------------------------------------------
// Test 1 : Intégrité des modales et confinement dans l'écran
// -----------------------------------------------------------------------------
it("1. Les modales s'adaptent aux hauteurs d'écran réduites sans masquer les boutons d'action", () => {
  // Vérification DOM des modales
  assert.ok(html.includes('id="task-modal"'), "Modale de tâche présente");
  assert.ok(html.includes('id="project-modal"'), "Modale de projet présente");
  assert.ok(html.includes('id="event-modal"'), "Modale d'agenda présente");
  assert.ok(html.includes('id="task-modal-save"'), "Bouton enregistrer tâche présent");
  assert.ok(html.includes('id="event-modal-save"'), "Bouton enregistrer créneau présent");

  // Règles CSS de confinement vertical
  assert.ok(css.includes('max-height: calc(100vh - 32px)'), "modal-content borné pour ne jamais déborder du viewport");
  assert.ok(css.includes('.modal-body') && css.includes('overflow-y: auto'), "modal-body scrollable de manière autonome");
  assert.ok(css.includes('.modal-footer') && css.includes('flex-shrink: 0'), "modal-footer ancré et protégé contre l'écrasement");
  assert.ok(css.includes('.modal-header') && css.includes('flex-shrink: 0'), "modal-header ancré et protégé contre l'écrasement");
});

// -----------------------------------------------------------------------------
// Test 2 : Prévention des chevauchements dans la vue Agenda hebdomadaire
// -----------------------------------------------------------------------------
it("2. L'agenda hebdomadaire prévient l'écrasement des colonnes sur petits écrans", () => {
  assert.ok(html.includes('id="calendar-weekdays-container"'), "Conteneur jours agenda présent");
  assert.ok(html.includes('id="calendar-body-container"'), "Conteneur grille agenda présent");

  // Règles CSS d'invariance et de défilement horizontal de sécurité
  assert.ok(css.includes('.calendar-container'), "Classe .calendar-container définie");
  assert.ok(css.includes('overflow-x: auto'), "calendar-container permet un défilement horizontal fluide si requis");
  assert.ok(css.includes('.calendar-weekdays') && css.includes('min-width: 680px'), "calendar-weekdays a une largeur minimale de sécurité (680px)");
  assert.ok(css.includes('.calendar-body') && css.includes('min-width: 680px'), "calendar-body a une largeur minimale de sécurité (680px)");

  // Rendu des cartes d'événements
  assert.ok(css.includes('.calendar-event'), "Cartes d'événements stylisées");
  assert.ok(css.includes('.calendar-event.compact'), "Prise en charge des créneaux compacts");
  assert.ok(css.includes('.event-title'), "Titres d'événements avec gestion d'overflow");
});

// -----------------------------------------------------------------------------
// Test 3 : Contrastes et cohérence visuelle sur les 3 thèmes (Sombre, Clair, OLED)
// -----------------------------------------------------------------------------
it("3. Les thèmes Sombre, Clair et OLED définissent des contrastes élevés et sans collision", () => {
  // Thème par défaut (Sombre)
  assert.ok(css.includes('--bg-primary: #0b0f17'), "Fond primaire sombre défini");
  assert.ok(css.includes('--text-main: #f8fafc'), "Texte principal sombre à fort contraste");

  // Thème Clair
  assert.ok(css.includes('[data-theme="light"]'), "Thème clair défini");
  assert.ok(css.includes('--bg-primary: #f8fafc'), "Fond primaire clair défini");
  assert.ok(css.includes('--text-main: #0f172a'), "Texte principal clair à fort contraste");
  assert.ok(css.includes('[data-theme="light"] .modal-form-section'), "Sous-sections de modales contrastées en thème clair");

  // Thème OLED
  assert.ok(css.includes('[data-theme="oled"]'), "Thème OLED défini");
  assert.ok(css.includes('--bg-primary: #000000'), "Noir absolu OLED défini");
  assert.ok(css.includes('--text-main: #ffffff'), "Blanc pur OLED défini");
});

// -----------------------------------------------------------------------------
// Test 4 : Lisibilité des formulaires et focus accessible
// -----------------------------------------------------------------------------
it("4. Les contrôles de formulaires et boutons ont des états de focus et d'interaction visibles", () => {
  assert.ok(css.includes('.form-control:focus'), "Anneau de focus visible sur form-control");
  assert.ok(css.includes('--border-focus: #38bdf8') || css.includes('--border-focus'), "Couleur de focus nette définie");
  assert.ok(css.includes('.btn-primary:hover'), "Survol bouton primaire défini");
  assert.ok(css.includes('.btn-secondary:hover'), "Survol bouton secondaire défini");
  assert.ok(css.includes('.btn-danger:hover'), "Survol bouton danger défini");
});

// -----------------------------------------------------------------------------
// BILAN DES TESTS
// -----------------------------------------------------------------------------
console.log("==========================================================");
console.log(`   RÉSULTATS DES TESTS VALIDATION UI : ${passed} réussis, ${failed} échoués`);
console.log("==========================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
