/**
 * Antigravité - Tests des fonctionnalités v1.2.2
 * Vérification des événements "Journée entière" au niveau de l'en-tête du jour (All-Day Row)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

async function it(name, fn) {
  try {
    await fn();
    console.log(` [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(` [FAIL] ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des fonctionnalités v1.2.2");
  console.log("==========================================================");

  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
  const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');

  // ---------------------------------------------------------------------------
  // 1. Structure HTML & Emplacement de l'En-tête "Journée Entière"
  // ---------------------------------------------------------------------------
  await it("1.1 index.html contient le conteneur #calendar-allday-container au-dessus de la grille horaire", () => {
    assert(html.includes('id="calendar-allday-container"'), "Conteneur #calendar-allday-container présent dans index.html");
    assert(html.includes('class="calendar-allday-row"'), "Classe .calendar-allday-row présente");
    
    // Vérifier l'ordre des éléments : header des jours -> all-day container -> grille horaire
    const idxWeekdays = html.indexOf('id="calendar-weekdays-container"');
    const idxAllDay = html.indexOf('id="calendar-allday-container"');
    const idxBody = html.indexOf('id="calendar-body-container"');

    assert(idxWeekdays !== -1 && idxAllDay !== -1 && idxBody !== -1, "Les 3 conteneurs sont présents");
    assert(idxWeekdays < idxAllDay, "calendar-weekdays-container est au-dessus de calendar-allday-container");
    assert(idxAllDay < idxBody, "calendar-allday-container est au-dessus de calendar-body-container");
  });

  // ---------------------------------------------------------------------------
  // 2. Styles CSS de l'apparence reconnaissable
  // ---------------------------------------------------------------------------
  await it("2.1 css/styles.css définit les styles pour le bandeau et les pastilles journée entière", () => {
    assert(css.includes('.calendar-allday-row'), "Styles .calendar-allday-row présents");
    assert(css.includes('.calendar-allday-gutter'), "Styles .calendar-allday-gutter présents");
    assert(css.includes('.calendar-allday-cell'), "Styles .calendar-allday-cell présents");
    assert(css.includes('.allday-event-pill'), "Styles .allday-event-pill présents");
    assert(css.includes('.allday-pill-tag'), "Styles .allday-pill-tag présents");
    assert(css.includes('.allday-pill-title'), "Styles .allday-pill-title présents");
    assert(css.includes('border-left: 4px solid #ffffff'), "Liseré distinctif blanc présent sur la pastille");
  });

  // ---------------------------------------------------------------------------
  // 3. Logique de rendu dans AgendaManager (js/agenda.js)
  // ---------------------------------------------------------------------------
  await it("3.1 js/agenda.js sépare les événements journée entière de la grille horaire", () => {
    assert(agendaCode.includes("rangeEvents.filter(e => !!e.isAllDay"), "Filtrage des événements journée entière");
    assert(agendaCode.includes("const timedEvents = dayEvents.filter(e => !e.isAllDay)"), "Exclusion des événements journée entière de la grille horaire");
    assert(agendaCode.includes("computeOverlappingLayout(timedEvents"), "La grille horaire ne calcule que les créneaux minutés");
    assert(agendaCode.includes("allday-event-pill"), "Création de la pastille .allday-event-pill");
    assert(agendaCode.includes("allday-pill-tag") && agendaCode.includes("24h"), "Badge reconnaissable 24h présent");
  });

  await it("3.2 openEventModal initialise automatiquement la case journée entière", () => {
    assert(agendaCode.includes("inputAllDay.checked = !!(defaultValues && defaultValues.isAllDay)"), "openEventModal initialise inputAllDay selon defaultValues.isAllDay");
  });

  await it("3.3 Tester-Antigravite-1.2.2.bat existe et propose le mode de test adapté", () => {
    const batPath = path.join(rootDir, 'Tester-Antigravite-1.2.2.bat');
    assert(fs.existsSync(batPath), "Fichier Tester-Antigravite-1.2.2.bat présent à la racine");
    const batContent = fs.readFileSync(batPath, 'utf8');
    assert(batContent.includes("v1.2.2"), "Titre de version v1.2.2 présent dans le .bat");
    assert(batContent.includes("JOURNEE ENTIERE"), "Explication de la fonctionnalité journée entière présente");
    assert(batContent.includes("--isolated"), "Mode isolé supporté");
  });

  // ---------------------------------------------------------------------------
  // 4. Test unitaire en simulation DOM
  // ---------------------------------------------------------------------------
  await it("4.1 AgendaManager.render() affiche les événements all-day dans le bandeau supérieur", () => {
    const StorageManager = require('../js/storage.js');
    global.StorageManager = StorageManager;
    const AgendaManager = require('../js/agenda.js');

    // Sauvegarde et mocks DOM
    const mockStorage = {
      events: [
        {
          id: 'evt-allday-test-1',
          title: 'Congés / Formation Antigravité',
          start: '2026-11-16T08:00',
          end: '2026-11-16T19:00',
          isAllDay: true,
          color: '#3b82f6'
        },
        {
          id: 'evt-timed-test-1',
          title: 'Point d\'équipe',
          start: '2026-11-16T10:00',
          end: '2026-11-16T11:00',
          isAllDay: false,
          color: '#10b981'
        }
      ],
      tasks: [],
      notes: [],
      projects: []
    };

    const origGetEvents = StorageManager.getEvents;
    const origGetTasks = StorageManager.getTasks;
    const origGetNotes = StorageManager.getNotes;
    const origGetProjects = StorageManager.getProjects;

    StorageManager.getEvents = () => mockStorage.events;
    StorageManager.getTasks = () => mockStorage.tasks;
    StorageManager.getNotes = () => mockStorage.notes;
    StorageManager.getProjects = () => mockStorage.projects;

    const mockElements = {
      'calendar-weekdays-container': { style: {}, innerHTML: '', parentNode: { insertBefore: () => {} } },
      'calendar-allday-container': { style: { display: 'none' }, innerHTML: '' },
      'calendar-body-container': { style: {}, innerHTML: '', clientHeight: 800, scrollTop: 0, addEventListener: () => {} },
      'calendar-week-label': { textContent: '' },
      'calendar-week-view': { style: {} },
      'calendar-month-view': { style: {} }
    };

    global.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: (tag) => ({
        id: '',
        className: '',
        style: {},
        setAttribute: () => {},
        appendChild: () => {}
      })
    };

    try {
      AgendaManager.currentWeekStart = new Date('2026-11-16T00:00:00');
      AgendaManager.currentView = 'week';
      AgendaManager.render();

      const alldayEl = mockElements['calendar-allday-container'];
      const bodyEl = mockElements['calendar-body-container'];

      assert.strictEqual(alldayEl.style.display, 'grid', "Le conteneur allday est affiché en grille (grid)");
      assert(alldayEl.innerHTML.includes('Congés / Formation Antigravité'), "L'événement journée entière est injecté dans le bandeau supérieur");
      assert(alldayEl.innerHTML.includes('allday-event-pill'), "La classe .allday-event-pill est utilisée");
      assert(alldayEl.innerHTML.includes('24h') && (alldayEl.innerHTML.includes('<svg') || alldayEl.innerHTML.includes('☀️')), "Le badge 24h est présent");

      // Vérifier que le créneau minuté est dans la grille horaire, mais PAS l'événement journée entière
      assert(bodyEl.innerHTML.includes('evt-timed-test-1') && bodyEl.innerHTML.includes('Point d'), "Le créneau minuté est présent dans la grille horaire");
      assert(!bodyEl.innerHTML.includes('evt-allday-test-1'), "L'événement journée entière n'est PLUS présent dans la grille horaire");

    } finally {
      StorageManager.getEvents = origGetEvents;
      StorageManager.getTasks = origGetTasks;
      StorageManager.getNotes = origGetNotes;
      StorageManager.getProjects = origGetProjects;
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Test quand aucun événement all-day n'existe
  // ---------------------------------------------------------------------------
  await it("4.2 AgendaManager.render() masque le bandeau s'il n'y a aucun événement journée entière", () => {
    const AgendaManager = require('../js/agenda.js');
    const StorageManager = require('../js/storage.js');

    const origGetEvents = StorageManager.getEvents;
    StorageManager.getEvents = () => [
      {
        id: 'evt-timed-only',
        title: 'Réunion matinale',
        start: '2026-11-16T09:00',
        end: '2026-11-16T10:00',
        isAllDay: false
      }
    ];

    const mockElements = {
      'calendar-weekdays-container': { style: {}, innerHTML: '', parentNode: { insertBefore: () => {} } },
      'calendar-allday-container': { style: { display: 'grid' }, innerHTML: '<div>Previous content</div>' },
      'calendar-body-container': { style: {}, innerHTML: '', clientHeight: 800, scrollTop: 0, addEventListener: () => {} },
      'calendar-week-label': { textContent: '' },
      'calendar-week-view': { style: {} },
      'calendar-month-view': { style: {} }
    };

    global.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: () => ({ id: '', className: '', style: {} })
    };

    try {
      AgendaManager.currentWeekStart = new Date('2026-11-16T00:00:00');
      AgendaManager.currentView = 'week';
      AgendaManager.render();

      const alldayEl = mockElements['calendar-allday-container'];
      assert.strictEqual(alldayEl.style.display, 'none', "Le bandeau allday est masqué s'il n'y a aucun créneau journée entière");
      assert.strictEqual(alldayEl.innerHTML, '', "Le contenu allday est vidé");
    } finally {
      StorageManager.getEvents = origGetEvents;
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Identité Visuelle Qualitative & Remplacement par des Icônes Vectorielles SVG
  // ---------------------------------------------------------------------------
  await it("5.1 App.getSvgIcon génère des icônes SVG qualitatives et résout les émojis", () => {
    const App = require('../js/app.js');
    assert(typeof App.getSvgIcon === 'function', "App.getSvgIcon est défini");
    
    // Noms sémantiques et émojis
    const pinSvg = App.getSvgIcon('pin', 14);
    assert(pinSvg.includes('<svg') && pinSvg.includes('class="app-icon"'), "Génération SVG pour 'pin'");
    
    const noteSvg = App.getSvgIcon('📝', 14);
    assert(noteSvg.includes('<svg') && noteSvg.includes('viewBox="0 0 24 24"'), "Résolution automatique de l'émoji '📝'");
    
    const sunSvg = App.getSvgIcon('☀️', 14);
    assert(sunSvg.includes('<svg') && sunSvg.includes('stroke="currentColor"'), "Génération SVG pour '☀️'");

    const repeatSvg = App.getSvgIcon('🔁', 14);
    assert(repeatSvg.includes('<svg'), "Génération SVG pour '🔁'");

    const dialogIcon = App.resolveDialogIcon('📌', '<svg></svg>');
    assert(dialogIcon.includes('<svg') && dialogIcon.includes('width="24"'), "App.resolveDialogIcon convertit l'icône de modale en 24px");
  });

  await it("5.2 css/styles.css intègre les règles d'alignement parfait pour les icônes SVG", () => {
    assert(css.includes('.app-icon'), "Classe .app-icon présente dans css/styles.css");
    assert(css.includes('vertical-align: -0.125em') || css.includes('vertical-align: -0.1'), "Alignement vertical optique défini");
    assert(css.includes('stroke: currentColor'), "stroke currentColor défini pour héritage harmonieux");
    assert(css.includes('.allday-pill-tag .app-icon'), "Alignement des icônes de bandeau journée entière défini");
  });

  await it("5.3 AgendaManager et NotesManager utilisent des icônes vectorielles SVG intégrées", () => {
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');

    assert(agendaCode.includes('getSvgIcon'), "AgendaManager intègre getSvgIcon pour son rendu");
    assert(agendaCode.includes("this.getSvgIcon('sun'"), "Icône soleil vectorielle dans les pastilles all-day");
    assert(agendaCode.includes("this.getSvgIcon('repeat'"), "Icône récurrence vectorielle dans l'agenda");

    assert(notesCode.includes('getSvgIcon'), "NotesManager intègre getSvgIcon");
    assert(notesCode.includes("this.getSvgIcon('folder'"), "Icône dossier vectorielle dans les badges et dossiers");
    assert(notesCode.includes('obsidian-callout-icon'), "Classe callout icon vectorielle présente");
  });

  // ---------------------------------------------------------------------------
  // 6. Finitions Esthétiques Haut de Gamme & Désactivation des Animations
  // ---------------------------------------------------------------------------
  await it("6.1 ::selection harmonise la sélection de texte avec la couleur d'accent", () => {
    assert(css.includes('::selection'), "Pseudo-élément ::selection présent dans styles.css");
    assert(css.includes('background-color: var(--accent)'), "Couleur de sélection calée sur var(--accent)");
  });

  await it("6.2 Micro-reflets de bordure supérieure et style Glass Pills sur les badges", () => {
    assert(css.includes('inset 0 1px 0 rgba(255, 255, 255'), "Micro-reflets lumineux inset présents sur les cartes");
    assert(css.includes('.badge {') && css.includes('border-radius: 999px'), "Badges en style Glass Pills arrondis");
  });

  await it("6.3 Respect absolu de l'option de désactivation des animations et des effets tactiles", () => {
    assert(css.includes('[data-disable-animations="true"] .btn:active'), "Désactivation des effets tactiles :active quand animations désactivées");
    assert(css.includes('[data-disable-hover="true"] .btn:active'), "Désactivation des effets tactiles :active quand survols désactivés");
    assert(css.includes('@media (prefers-reduced-motion: reduce)'), "Support natif de l'accessibilité prefers-reduced-motion");
  });

  await it("6.4 NotesManager intègre un empty-state soigné et poétique avec illustration vectorielle", () => {
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesCode.includes('antigravite-empty-state notes-empty-state'), "Empty-state Notes harmonisé avec Tasks et Projects");
    assert(notesCode.includes('empty-state-illustration'), "Illustration vectorielle présente dans l'empty state Notes");
  });

  // ---------------------------------------------------------------------------
  // 7. Version 1.2.2, Changelog & Suppression du Pop-up au Démarrage
  // ---------------------------------------------------------------------------
  await it("7.1 Version 1.2.2 synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '1.2.2', "package.json doit être en version 1.2.2");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="updater-current-version-label">1.2.2</strong>'), "index.html affiche la version 1.2.2");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("APP_VERSION: '1.2.2'"), "app.js est configuré sur la version 1.2.2");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("currentVersion: '1.2.2'"), "settings.js est initialisé avec 1.2.2");
  });

  await it("7.2 Changelog officiel de la Version 1.2.2 présent dans les paramètres", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('Version 1.2.2'), "Encart Version 1.2.2 présent dans le Changelog");
    assert(htmlContent.includes('Agenda : Bandeau « Journée entière » (All-Day)'), "Section Journée entière dans le Changelog");
    assert(htmlContent.includes('Identité Visuelle 100% Vectorielle (SVG)'), "Section SVG dans le Changelog");
    assert(htmlContent.includes('Finitions Esthétiques &amp; Ergonomie Tactile'), "Section Finitions dans le Changelog");
  });

  await it("7.3 Suppression du panneau de mise à jour au démarrage pour la v1.2.2", () => {
    delete require.cache[require.resolve('../js/app.js')];
    global.window = {};
    global.document = { querySelector: () => null, getElementById: () => null };
    global.localStorage = { getItem: () => '1.2.1', setItem: () => {} };
    const App = require('../js/app.js');

    assert.strictEqual(typeof App.shouldShowWhatsNew, 'function', "App.shouldShowWhatsNew existe");
    // Pour la version 1.2.2, shouldShowWhatsNew doit retourner false
    assert.strictEqual(App.shouldShowWhatsNew('1.2.2'), false, "La version 1.2.2 ne doit pas afficher le pop-up au démarrage");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.2 : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
})();
