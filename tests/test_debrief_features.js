/**
 * Antigravité - Tests automatisés du Débriefing Positif & Bilan Bienveillant
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const DebriefManager = require('../js/debrief.js');

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log("==========================================================");
  console.log("   Antigravité - Tests du Débriefing Positif & Bilan");
  console.log("==========================================================");

  // ---------------------------------------------------------------------------
  // 1. Structure HTML & Interface
  // ---------------------------------------------------------------------------
  await it("1.1 index.html contient l'écran #screen-debrief et ses conteneurs clés", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="screen-debrief"'), "Écran #screen-debrief présent");
    assert(html.includes('id="debrief-content-area"'), "Zone #debrief-content-area présente");
    assert(html.includes('id="debrief-hero-title"'), "Titre héro présent");
    assert(html.includes('id="debrief-hero-phrase"'), "Phrase d'encouragement présente");
    assert(html.includes('id="btn-debrief-dismiss-today"'), "Bouton Terminer ma journée présent");
  });

  await it("1.2 index.html contient l'élément de menu #nav-item-debrief dans le volet", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="nav-item-debrief"'), "Élément #nav-item-debrief présent dans le volet");
    assert(html.includes('data-screen="debrief"'), "Attribut data-screen='debrief' présent");
    assert(html.includes('id="nav-debrief-dot"'), "Pastille lumineuse #nav-debrief-dot présente");
  });

  await it("1.3 index.html contient les paramètres dédiés au débriefing", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="setting-debrief-enabled"'), "Checkbox #setting-debrief-enabled présente");
    assert(html.includes('id="setting-debrief-hour"'), "Sélecteur d'heure #setting-debrief-hour présent");
    assert(html.includes('id="setting-debrief-weekend-range"'), "Sélecteur de plage #setting-debrief-weekend-range présent");
    assert(html.includes('id="setting-debrief-always-show"'), "Checkbox #setting-debrief-always-show présente");
  });

  // ---------------------------------------------------------------------------
  // 2. Styles CSS & Accessibilité
  // ---------------------------------------------------------------------------
  await it("2.1 css/styles.css intègre les styles du débriefing, des cartes et de la pastille", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.debrief-container'), "Styles .debrief-container présents");
    assert(css.includes('.debrief-hero-card'), "Styles .debrief-hero-card présents");
    assert(css.includes('.debrief-project-card'), "Styles .debrief-project-card présents");
    assert(css.includes('.debrief-zen-card'), "Styles .debrief-zen-card présents");
    assert(css.includes('.nav-debrief-dot'), "Styles .nav-debrief-dot présents");
  });

  // ---------------------------------------------------------------------------
  // 3. Déclenchement temporel & Disponibilité
  // ---------------------------------------------------------------------------
  await it("3.1 isDebriefAvailable respecte la désactivation globale", () => {
    const settings = { debriefEnabled: false, debriefHour: '17:00' };
    const res = DebriefManager.isDebriefAvailable(settings);
    assert.strictEqual(res.available, false, "Le bilan ne doit pas être disponible si désactivé");
  });

  await it("3.2 isDebriefAvailable s'active en semaine à l'heure configurée (ou supérieure)", () => {
    const settings = { debriefEnabled: true, debriefHour: '17:00' };
    const now = new Date();
    const day = now.getDay();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const res = DebriefManager.isDebriefAvailable(settings);
    if (day === 0 || day === 6) {
      assert.strictEqual(res.available, true, "Disponible le week-end en mode weekly");
      assert.strictEqual(res.mode, 'weekly', "Mode weekly le week-end");
    } else {
      const expected = (currentMins >= 17 * 60);
      assert.strictEqual(res.available, expected, "Doit être disponible si heure >= 17h");
    }
  });

  await it("3.3 shouldShowTab honore l'option debriefAlwaysShowTab", () => {
    const settings = { debriefEnabled: true, debriefHour: '23:59', debriefAlwaysShowTab: true };
    assert.strictEqual(DebriefManager.shouldShowTab(settings), true, "Doit être visible si debriefAlwaysShowTab est actif");
  });

  // ---------------------------------------------------------------------------
  // 4. Collecte des Accomplissements Réels
  // ---------------------------------------------------------------------------
  await it("4.1 getDailyAccomplishments extrait fidèlement les tâches terminées à la date cible", () => {
    global.StorageManager = {
      getTasks: () => [
        { id: 't1', title: 'Tâche A', completed: true, completedAt: '2026-11-15T10:00:00Z', projectId: 'p1', subtasks: [] },
        { id: 't2', title: 'Tâche B (Non terminée)', completed: false, completedAt: null, projectId: 'p1', subtasks: [] },
        { id: 't3', title: 'Tâche C d\'un autre jour', completed: true, completedAt: '2026-11-10T10:00:00Z', projectId: 'p1', subtasks: [] }
      ],
      getProjects: () => [{ id: 'p1', title: 'Projet Alpha', color: '#3b82f6' }],
      getTrash: () => [],
      getEvents: () => [],
      getNotes: () => []
    };

    const res = DebriefManager.getDailyAccomplishments('2026-11-15');
    assert.strictEqual(res.completedTasks.length, 1, "Une seule tâche complétée le 15");
    assert.strictEqual(res.completedTasks[0].id, 't1', "La tâche A est bien identifiée");
    assert.strictEqual(res.byProject.length, 1, "Regroupement sous Projet Alpha");
    assert.strictEqual(res.byProject[0].project.title, 'Projet Alpha');
  });

  await it("4.2 getDailyAccomplishments inclut les sous-tâches récursives terminées", () => {
    global.StorageManager = {
      getTasks: () => [
        {
          id: 'root-1',
          title: 'Parent',
          completed: false,
          projectId: 'p1',
          subtasks: [
            { id: 'sub-1', title: 'Sous-tâche 1', completed: true, completedAt: '2026-11-15T14:30:00Z', projectId: 'p1', subtasks: [] }
          ]
        }
      ],
      getProjects: () => [{ id: 'p1', title: 'Projet Alpha', color: '#3b82f6' }],
      getTrash: () => [],
      getEvents: () => [],
      getNotes: () => []
    };

    const res = DebriefManager.getDailyAccomplishments('2026-11-15');
    assert.strictEqual(res.completedTasks.length, 1, "La sous-tâche validée est comptabilisée");
    assert.strictEqual(res.completedTasks[0].id, 'sub-1');
  });

  await it("4.3 getDailyAccomplishments exclut les tâches présentes dans la corbeille", () => {
    global.StorageManager = {
      getTasks: () => [
        { id: 't-deleted', title: 'Tâche supprimée', completed: true, completedAt: '2026-11-15T10:00:00Z', subtasks: [] }
      ],
      getProjects: () => [],
      getTrash: () => [{ id: 'trash-1', originalId: 't-deleted', type: 'task' }],
      getEvents: () => [],
      getNotes: () => []
    };

    const res = DebriefManager.getDailyAccomplishments('2026-11-15');
    assert.strictEqual(res.completedTasks.length, 0, "La tâche mise en corbeille est exclue du bilan");
  });

  // ---------------------------------------------------------------------------
  // 5. Règle Zéro Culpabilité & Zéro Score
  // ---------------------------------------------------------------------------
  await it("5.1 Les phrases de débriefing ne contiennent aucun score ni mot culpabilisant", () => {
    const allPhrases = [
      ...DebriefManager.DAILY_PHRASES,
      ...DebriefManager.WEEKLY_PHRASES,
      ...DebriefManager.CALM_PHRASES
    ];

    const forbiddenWords = ['retard', 'incomplet', 'échec', 'mauvais', 'score', '%', 'note', 'culpabilité', 'insuffisant'];
    allPhrases.forEach(phrase => {
      const lower = phrase.toLowerCase();
      forbiddenWords.forEach(badWord => {
        assert(!lower.includes(badWord), `La phrase "${phrase}" ne doit pas contenir "${badWord}"`);
      });
    });
  });

  await it("5.2 En l'absence de tâches accomplies, une phrase apaisante est retournée", () => {
    const phrase = DebriefManager.getRandomDebriefPhrase('daily', false);
    assert(DebriefManager.CALM_PHRASES.includes(phrase), "La phrase de repos fait bien partie de CALM_PHRASES");
  });

  // ---------------------------------------------------------------------------
  // 6. Plage Hebdomadaire & Week-end
  // ---------------------------------------------------------------------------
  await it("6.1 getWeeklyAccomplishments applique la plage configurée (mon-fri vs mon-sun)", () => {
    global.StorageManager = {
      getTasks: () => [],
      getProjects: () => [],
      getTrash: () => [],
      getNotes: () => []
    };

    const resFri = DebriefManager.getWeeklyAccomplishments({ debriefWeekendRange: 'mon-fri' });
    assert.strictEqual(resFri.rangeSetting, 'mon-fri');

    const resSun = DebriefManager.getWeeklyAccomplishments({ debriefWeekendRange: 'mon-sun' });
    assert.strictEqual(resSun.rangeSetting, 'mon-sun');
  });

  // ---------------------------------------------------------------------------
  // 7. Validation & Mémorisation
  // ---------------------------------------------------------------------------
  await it("7.1 markAsSeenToday enregistre la date du jour", () => {
    let stored = null;
    global.localStorage = {
      setItem: (_k, v) => { stored = v; },
      getItem: () => stored
    };

    DebriefManager.markAsSeenToday();
    assert.strictEqual(DebriefManager.hasSeenToday(), true, "Le bilan est reconnu comme validé pour aujourd'hui");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS DÉBRIEFING : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
})();
