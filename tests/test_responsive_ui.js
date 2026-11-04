/**
 * Antigravité - Tests automatisés pour le Responsive des Titres de Tâches & Horaires d'Accueil
 * Phase 2 : Responsive, lisibilité, prévention des chevauchements et formatage des horaires.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests Responsive Tâches & Horaires");
console.log("   (Accueil, Événements, Titres Longs & Règles CSS)");
console.log("==========================================================");

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc} : ${err.stack || err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Environnement simulé pour Node.js
// -----------------------------------------------------------------------------
const storageBacking = {};
global.localStorage = {
  getItem: (key) => (key in storageBacking ? storageBacking[key] : null),
  setItem: (key, val) => { storageBacking[key] = String(val); },
  removeItem: (key) => { delete storageBacking[key]; },
  clear: () => { Object.keys(storageBacking).forEach(k => delete storageBacking[k]); }
};

const StorageManager = require('../js/storage.js');
global.StorageManager = StorageManager;

const mockDom = {
  'stat-planned-today': { textContent: '' },
  'stat-deadlines-near': { textContent: '' },
  'stat-events-today': { textContent: '' },
  'stat-active-projects': { textContent: '' },
  'dashboard-planned-tasks': { innerHTML: '' },
  'dashboard-today-events': { innerHTML: '' },
  'dashboard-recent-notes': { innerHTML: '' },
  'current-screen-title': { textContent: '', classList: { remove: () => {}, add: () => {} } },
  'page-transition-bar': { classList: { remove: () => {}, add: () => {} } },
  'app-container': { classList: { toggle: () => false, add: () => {} } }
};

global.document = {
  getElementById: (id) => mockDom[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  AgendaManager: {
    isEventOnDate: (e, dateStr) => e.start && e.start.startsWith(dateStr)
  },
  TasksManager: {
    getPriorityBadge: (priority) => `<span class="badge badge-priority-${priority}">${priority}</span>`
  }
};
global.TasksManager = global.window.TasksManager;
global.AgendaManager = global.window.AgendaManager;

const App = require('../js/app.js');

(async () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');

  // ---------------------------------------------------------------------------
  // Test 1 : Règles CSS pour l'affichage responsive sur le Dashboard
  // ---------------------------------------------------------------------------
  await it("1. styles.css contient les règles d'ellipse, d'invariance d'horaires et de min-width sur le dashboard", () => {
    assert.ok(css.includes('.dashboard-item-title'), "Classe .dashboard-item-title définie");
    assert.ok(css.includes('text-overflow: ellipsis'), "Propriété text-overflow: ellipsis présente pour les titres");
    assert.ok(css.includes('white-space: nowrap'), "white-space: nowrap présent pour éviter les retours à la ligne parasites");
    assert.ok(css.includes('.dashboard-time-badge'), "Classe .dashboard-time-badge définie");
    assert.ok(css.includes('font-variant-numeric: tabular-nums'), "Alignement tabulaire des chiffres d'horaires");
    assert.ok(css.includes('.dashboard-sections'), "Classe .dashboard-sections définie");
    assert.ok(css.includes('@media (max-width: 1380px)'), "Media query 2 colonnes pour écrans intermédiaires présente");
    assert.ok(css.includes('@media (max-width: 880px)'), "Media query 1 colonne pour petits écrans présente");
    assert.ok(css.includes('@media (max-width: 1024px)'), "Media query 2 colonnes pour stat-cards présente");
  });

  // ---------------------------------------------------------------------------
  // Test 2 : Règles CSS pour les lignes et titres de tâches
  // ---------------------------------------------------------------------------
  await it("2. styles.css assure la fluidité des titres de tâches et le repli propre des badges", () => {
    assert.ok(css.includes('.task-title'), "Classe .task-title définie");
    assert.ok(css.includes('min-width: 120px'), "Titre de tâche garanti à au moins 120px de largeur minimale");
    assert.ok(css.includes('word-break: break-word'), "Césure propre des mots longs autorisée");
    assert.ok(css.includes('.task-badges'), "Classe .task-badges définie");
    assert.ok(css.includes('flex-shrink: 1'), "Les badges de tâches peuvent s'adapter sans écraser le titre");
    assert.ok(css.includes('@media (max-width: 768px)'), "Media query mobile/tablette présente pour .task-row");
    assert.ok(css.includes('flex-wrap: wrap'), "Autorisation de passage à la ligne propre sur écran étroit");
  });

  // ---------------------------------------------------------------------------
  // Test 3 : Rendu des tâches prévues sur le Dashboard avec titre long
  // ---------------------------------------------------------------------------
  await it("3. updateDashboard formate les tâches avec classes adaptatives et infobulle title complète", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const longTitle = "Rédiger le dossier de spécifications techniques détaillées pour l'architecture souveraine Antigravité v2.0";
    
    StorageManager.saveTasks([
      {
        id: "t-long",
        title: longTitle,
        priority: "urgent",
        plannedDate: todayStr,
        completed: false
      }
    ]);
    StorageManager.saveEvents([]);
    StorageManager.saveProjects([]);
    StorageManager.saveNotes([]);

    App.updateDashboard(true);

    const html = mockDom['dashboard-planned-tasks'].innerHTML;
    assert.ok(html.includes('class="dashboard-item dashboard-task-item"'), "Conteneur adaptatif présent");
    assert.ok(html.includes('class="dashboard-item-title"'), "Titre encapsulé dans .dashboard-item-title");
    assert.ok(html.includes(`title="${App.escapeHtml(longTitle)}"`), "Attribut title présent pour lecture au survol");
    assert.ok(html.includes('badge-priority-urgent'), "Badge de priorité conservé à droite");
  });

  // ---------------------------------------------------------------------------
  // Test 4 : Formatage et robustesse des horaires sur le Dashboard
  // ---------------------------------------------------------------------------
  await it("4. updateDashboard formate avec exactitude les créneaux minutés, journées et multi-jours", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    StorageManager.saveTasks([]);
    StorageManager.saveEvents([
      {
        id: "e-timed",
        title: "Session de travail minutée",
        start: `${todayStr}T09:30:00`,
        end: `${todayStr}T11:00:00`,
        source: "local"
      },
      {
        id: "e-allday",
        title: "Séminaire de rentrée",
        start: `${todayStr}`,
        end: `${todayStr}`,
        isAllDay: true,
        source: "google"
      }
    ]);

    App.updateDashboard(true);

    const html = mockDom['dashboard-today-events'].innerHTML;
    assert.ok(html.includes('class="dashboard-item dashboard-event-item"'), "Conteneur d'événement adaptatif");
    assert.ok(html.includes('class="dashboard-time-badge"'), "Badge d'horaire présent");
    assert.ok(html.includes('09:30 - 11:00'), "Plage horaire minutée formatée");
    assert.ok(html.includes('Journée'), "Événement toute la journée formaté");
    assert.ok(html.includes('pill-google'), "Pastille Google présente");
    assert.ok(html.includes('pill-antigravite'), "Pastille Antigravité présente");
    assert.ok(html.includes('⏱️'), "Icône de créneau horaire intégrée");
  });

  // ---------------------------------------------------------------------------
  // Test 5 : Rendu des dernières notes sur le Dashboard
  // ---------------------------------------------------------------------------
  await it("5. updateDashboard formate les notes avec troncature d'aperçu et date responsive", () => {
    StorageManager.saveTasks([]);
    StorageManager.saveEvents([]);
    StorageManager.saveNotes([
      {
        id: "n-dash-1",
        title: "Compte-rendu de réunion d'architecture et décisions produit",
        content: "Voici les notes détaillées de la réunion du comité technique avec l'ensemble des points d'action.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    App.updateDashboard(true);

    const html = mockDom['dashboard-recent-notes'].innerHTML;
    assert.ok(html.includes('class="dashboard-item dashboard-note-item"'), "Conteneur de note adaptatif");
    assert.ok(html.includes('class="dashboard-item-title"'), "Titre de note stylisé");
    assert.ok(html.includes('class="dashboard-note-preview"'), "Aperçu de note stylisé");
    assert.ok(html.includes('class="dashboard-note-date"'), "Date formatée en badge");
  });

  // ---------------------------------------------------------------------------
  // BILAN DES TESTS
  // ---------------------------------------------------------------------------
  console.log("==========================================================");
  console.log(`   RÉSULTATS DES TESTS RESPONSIVE UI : ${passed} réussis, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
