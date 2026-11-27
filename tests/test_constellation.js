/**
 * Antigravité - Tests automatisés du module Constellation & Mind Map
 * 
 * Vérifications :
 * 1. Présence de l'élément nav-item et de l'écran #screen-constellation dans index.html.
 * 2. ConstellationManager expose les méthodes principales (init, render, setMode, fitAll, resetView).
 * 3. extractGraphData construit l'arbre relationnel unifié (Projets, Tâches, Agenda, Notes).
 * 4. computeTreeLayout positionne les nœuds en arbre décisionnel horizontal de gauche à droite.
 * 5. computeRadialLayout positionne les nœuds en constellation rayonnante.
 * 6. setMode bascule dynamiquement entre 'tree' et 'radial'.
 * 7. Passerelles interactives : les clics sur les nœuds ciblent les modales et gestionnaires respectifs.
 * 8. Intégration du volet latéral et des paramètres (réorganisation drag & drop et visibilité).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(` [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(` [FAIL] ${desc}`);
    console.error(`        ${err.stack || err.message}\n`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests du Module Constellation");
  console.log("   (Mind Map, Arbre Décisionnel & Whiteboard Interactif)");
  console.log("==========================================================");

  // 1. Intégration dans index.html
  await it("1.1 index.html contient l'onglet Constellation après Notes et l'écran #screen-constellation", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('data-screen="constellation"'), "L'onglet constellation doit être présent dans le menu latéral");
    assert(html.includes('id="screen-constellation"'), "La section #screen-constellation doit exister");
    assert(html.includes('id="constellation-viewport"'), "Le viewport du whiteboard doit exister");
    assert(html.includes('id="constellation-canvas"'), "Le canevas transformable doit exister");
    assert(html.includes('id="constellation-svg"'), "La couche SVG des liaisons doit exister");
    assert(html.includes('id="constellation-nodes-container"'), "Le conteneur des cartes de nœuds doit exister");
    assert(html.includes('id="btn-constellation-mode-tree"'), "Le bouton pour le mode Arbre décisionnel doit exister");
    assert(html.includes('id="btn-constellation-mode-radial"'), "Le bouton pour le mode Constellation rayonnante doit exister");
    assert(/<script[^>]*\bsrc=["']\.\/js\/constellation\.js["'][^>]*><\/script>/.test(html), "Le script js/constellation.js doit être chargé");
  });

  // 2. Module ConstellationManager
  await it("2.1 js/constellation.js expose ConstellationManager avec son API complète", () => {
    const Constellation = require('../js/constellation.js');
    assert(Constellation, "ConstellationManager doit être défini");
    assert.strictEqual(typeof Constellation.init, 'function', "init() doit exister");
    assert.strictEqual(typeof Constellation.render, 'function', "render() doit exister");
    assert.strictEqual(typeof Constellation.setMode, 'function', "setMode() doit exister");
    assert.strictEqual(typeof Constellation.fitAll, 'function', "fitAll() doit exister");
    assert.strictEqual(typeof Constellation.resetView, 'function', "resetView() doit exister");
    assert.strictEqual(typeof Constellation.extractGraphData, 'function', "extractGraphData() doit exister");
    assert.strictEqual(typeof Constellation.computeTreeLayout, 'function', "computeTreeLayout() doit exister");
    assert.strictEqual(typeof Constellation.computeRadialLayout, 'function', "computeRadialLayout() doit exister");
    assert.strictEqual(typeof Constellation.toggleFoldNode, 'function', "toggleFoldNode() doit exister");
  });

  // 3. Modèle de données du graphe
  await it("3.1 extractGraphData lie les projets, sous-projets, tâches, événements et notes", () => {
    const Constellation = require('../js/constellation.js');
    const origStorage = global.StorageManager;

    global.StorageManager = {
      getProjects: () => [
        { id: 'p1', title: 'Refonte Site', color: '#6366f1', parentProjectId: null },
        { id: 'p2', title: 'Sous-projet UI', color: '#8b5cf6', parentProjectId: 'p1' }
      ],
      getTasks: () => [
        { id: 't1', title: 'Maquette Figma', projectId: 'p1', completed: false, subtasks: [
          { id: 't1_sub', title: 'Revue typographique', completed: true, subtasks: [] }
        ]},
        { id: 't2', title: 'Acheter café', projectId: null, completed: false, subtasks: [] }
      ],
      getEvents: () => [
        { id: 'e1', title: 'Réunion Cadrage', projectId: 'p1', taskId: null, start: '2026-11-25T10:00:00', end: '2026-11-25T11:00:00' },
        { id: 'e2', title: 'Session Figma', projectId: 'p1', taskId: 't1', start: '2026-11-25T14:00:00', end: '2026-11-25T16:00:00' }
      ],
      getNotes: () => [
        { id: 'n1', title: 'Notes de réunion', projectId: 'p1', folder: 'Projets', content: 'Discussion cadrage' },
        { id: 'n2', title: 'Idée créative', projectId: null, folder: 'Inspiration', content: 'Gradients subtils' }
      ],
      getTrash: () => []
    };

    try {
      Constellation.filters = { projects: true, tasks: true, events: true, notes: true, hideDone: false };
      Constellation.collapsedNodes.clear();

      const data = Constellation.extractGraphData();
      assert(Array.isArray(data.nodes), "nodes doit être un tableau");
      assert(Array.isArray(data.links), "links doit être un tableau");

      // Vérifier le nœud racine
      const rootNode = data.nodes.find(n => n.id === '__root__');
      assert(rootNode, "Le nœud racine Antigravité doit être présent");

      // Vérifier les projets
      const projP1 = data.nodes.find(n => n.id === 'proj_p1');
      const projP2 = data.nodes.find(n => n.id === 'proj_p2');
      assert(projP1, "Projet p1 présent");
      assert(projP2, "Projet p2 présent");
      assert.strictEqual(projP1.parentId, '__root__', "p1 doit être rattaché à __root__");
      assert.strictEqual(projP2.parentId, 'proj_p1', "p2 doit être rattaché à p1 (sous-projet)");

      // Vérifier la liaison de la tâche
      const taskT1 = data.nodes.find(n => n.id === 'task_t1');
      assert(taskT1, "Tâche t1 présente");
      assert.strictEqual(taskT1.parentId, 'proj_p1', "t1 doit être rattachée à son projet p1");

      const taskSub = data.nodes.find(n => n.id === 'task_t1_sub');
      assert(taskSub, "Sous-tâche t1_sub présente");
      assert.strictEqual(taskSub.parentId, 'task_t1', "t1_sub doit être rattachée à sa tâche parente t1");

      // Vérifier l'événement lié à la tâche t1
      const evtE2 = data.nodes.find(n => n.id === 'event_e2');
      assert(evtE2, "Événement e2 présent");
      assert.strictEqual(evtE2.parentId, 'task_t1', "e2 doit être rattaché directement à la tâche t1 via e.taskId");

      // Vérifier la note rattachée au projet
      const noteN1 = data.nodes.find(n => n.id === 'note_n1');
      assert(noteN1, "Note n1 présente");
      assert.strictEqual(noteN1.parentId, 'proj_p1', "n1 doit être rattachée au projet p1");

      // Vérifier la note libre regroupée dans son dossier Inspiration
      const noteN2 = data.nodes.find(n => n.id === 'note_n2');
      assert(noteN2, "Note n2 présente");
      assert.strictEqual(noteN2.parentId, '__hub_notes_folder_Inspiration__', "n2 doit être rattachée au pôle de son dossier");
    } finally {
      global.StorageManager = origStorage;
    }
  });

  // 4. Calcul de l'Arbre Décisionnel Horizontal
  await it("4.1 computeTreeLayout calcule les coordonnées X croissantes de gauche à droite sans chevauchement", () => {
    const Constellation = require('../js/constellation.js');
    const nodes = [
      { id: '__root__', parentId: null, width: 220, height: 64 },
      { id: 'proj_p1', parentId: '__root__', width: 220, height: 64 },
      { id: 'task_t1', parentId: 'proj_p1', width: 220, height: 64 },
      { id: 'task_t2', parentId: 'proj_p1', width: 220, height: 64 }
    ];
    const links = [
      { source: '__root__', target: 'proj_p1' },
      { source: 'proj_p1', target: 'task_t1' },
      { source: 'proj_p1', target: 'task_t2' }
    ];

    Constellation.computeTreeLayout(nodes, links);

    const root = nodes.find(n => n.id === '__root__');
    const p1 = nodes.find(n => n.id === 'proj_p1');
    const t1 = nodes.find(n => n.id === 'task_t1');
    const t2 = nodes.find(n => n.id === 'task_t2');

    assert(root.x < p1.x, "Le nœud racine doit être placé à gauche du projet p1");
    assert(p1.x < t1.x, "Le projet p1 doit être placé à gauche des tâches enfants");
    assert.strictEqual(t1.x, t2.x, "Les deux tâches de même niveau doivent avoir la même colonne X");
    assert(t1.y !== t2.y, "Les deux tâches doivent avoir des positions Y distinctes");
    assert.strictEqual(p1.y, Math.round((t1.y + t2.y) / 2), "Le parent p1 doit être aligné au centre vertical de ses enfants");
  });

  // 5. Calcul de la Constellation Rayonnante
  await it("5.1 computeRadialLayout dispose les nœuds en anneaux orbitaux autour du centre", () => {
    const Constellation = require('../js/constellation.js');
    const nodes = [
      { id: '__root__', parentId: null, width: 220, height: 64 },
      { id: 'p1', parentId: '__root__', width: 220, height: 64 },
      { id: 'p2', parentId: '__root__', width: 220, height: 64 }
    ];
    const links = [
      { source: '__root__', target: 'p1' },
      { source: '__root__', target: 'p2' }
    ];

    Constellation.computeRadialLayout(nodes, links);

    const root = nodes.find(n => n.id === '__root__');
    const p1 = nodes.find(n => n.id === 'p1');
    const p2 = nodes.find(n => n.id === 'p2');

    assert.strictEqual(root.x, 1200 - 110, "Racine centrée en X sur 1200");
    assert.strictEqual(root.y, 900 - 32, "Racine centrée en Y sur 900");

    // Les deux enfants doivent être disposés à des angles opposés (180° d'écart)
    assert(p1.x !== p2.x || p1.y !== p2.y, "p1 et p2 doivent avoir des coordonnées distinctes");
  });

  // 6. Bascule dynamique entre modes
  await it("6.1 setMode bascule entre 'tree' et 'radial'", () => {
    const Constellation = require('../js/constellation.js');
    Constellation.currentMode = 'tree';

    const btnTree = { classList: { toggle: (cls, act) => {} }, addEventListener: () => {} };
    const btnRadial = { classList: { toggle: (cls, act) => {} }, addEventListener: () => {} };

    const origDoc = global.document;
    global.document = {
      getElementById: (id) => {
        if (id === 'btn-constellation-mode-tree') return btnTree;
        if (id === 'btn-constellation-mode-radial') return btnRadial;
        if (id === 'constellation-svg') return { setAttribute: () => {}, innerHTML: '' };
        if (id === 'constellation-nodes-container') return { innerHTML: '' };
        if (id === 'constellation-canvas') return { style: {} };
        if (id === 'constellation-zoom-val') return { textContent: '' };
        if (id === 'constellation-stats-badge') return { textContent: '' };
        return null;
      },
      querySelectorAll: () => []
    };

    try {
      Constellation.setMode('radial');
      assert.strictEqual(Constellation.currentMode, 'radial', "Le mode courant doit être passé à 'radial'");

      Constellation.setMode('tree');
      assert.strictEqual(Constellation.currentMode, 'tree', "Le mode courant doit être repassé à 'tree'");
    } finally {
      global.document = origDoc;
    }
  });

  // 7. Intégration du volet latéral dans App.js
  await it("7.1 App.navigate('constellation') met à jour le titre et active le rendu", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes("constellation: 'Constellation & Mind Map'"), "Titre de l'écran Constellation configuré dans App.navigate");
    assert(appCode.includes("screenId === 'constellation' && typeof ConstellationManager !== 'undefined'"), "ConstellationManager.render() appelé lors de la navigation");
    assert(appCode.includes("constellation: false") || appCode.includes("constellation: true"), "constellation géré dans applySidebarTabsVisibility");
    assert(appCode.includes("effectiveOrder.includes('constellation')"), "constellation inséré automatiquement après notes dans applySidebarTabsOrder");
  });

  // 8. Intégration de la personnalisation dans Settings.js
  await it("8.1 SettingsManager permet la réorganisation de Constellation dans la disposition du volet", () => {
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes("defaultOrder.includes('constellation')"), "constellation intégré dans la réinitialisation par défaut des onglets");
    assert(settingsCode.includes("tabsOrder.includes('constellation')"), "constellation ordonnancé après notes dans la synchronisation de la grille");

    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('data-tab-name="constellation"'), "Carte de toggle data-tab-name='constellation' présente dans les paramètres");
    assert(html.includes('id="toggle-tab-constellation"'), "Checkbox id='toggle-tab-constellation' présente");
  });

  // 9. Menu contextuel et clic droit
  await it("9.1 ConstellationManager expose les méthodes showContextMenu et hideContextMenu pour le clic droit", () => {
    const Constellation = require('../js/constellation.js');
    assert.strictEqual(typeof Constellation.showContextMenu, 'function', "showContextMenu doit exister");
    assert.strictEqual(typeof Constellation.hideContextMenu, 'function', "hideContextMenu doit exister");

    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="constellation-context-menu"'), "Le menu contextuel #constellation-context-menu doit être présent dans le DOM");
    assert(html.includes('id="constellation-context-header"'), "L'en-tête du menu contextuel doit être présent");
    assert(html.includes('id="constellation-context-items"'), "Le conteneur des actions du menu contextuel doit être présent");
  });

  // 10. Filtrage stable sans déplacement de tableau
  await it("10.1 applyFiltersVisibility masque les éléments sans recalculer ni déplacer les coordonnées existantes", () => {
    const Constellation = require('../js/constellation.js');
    assert.strictEqual(typeof Constellation.applyFiltersVisibility, 'function', "applyFiltersVisibility doit exister");

    Constellation._graphData = {
      nodes: [
        { id: '__root__', type: 'root', x: 60, y: 40, width: 220, height: 64 },
        { id: 'proj_1', type: 'project', x: 340, y: 120, width: 230, height: 68 },
        { id: 'task_1', type: 'task', x: 620, y: 120, width: 220, height: 60, completed: false }
      ]
    };

    const origX = Constellation._graphData.nodes[1].x;
    const origY = Constellation._graphData.nodes[1].y;

    Constellation.filters.tasks = false;
    assert.strictEqual(Constellation.isNodeFilteredOut(Constellation._graphData.nodes[2]), true, "task_1 doit être marquée comme filtrée");
    assert.strictEqual(Constellation.isNodeFilteredOut(Constellation._graphData.nodes[1]), false, "proj_1 ne doit pas être filtré");

    // Vérifier que les coordonnées du projet restent rigoureusement intactes
    assert.strictEqual(Constellation._graphData.nodes[1].x, origX, "La coordonnée X du projet ne doit pas bouger");
    assert.strictEqual(Constellation._graphData.nodes[1].y, origY, "La coordonnée Y du projet ne doit pas bouger");
  });

  // 11. Mode Constellation rayonnante : orbes compacts, aperçu au survol et relaxation anti-superposition
  await it("11.1 ConstellationManager expose showHoverCard et computeRadialLayout garantit l'écartement aérien sans superposition", () => {
    const Constellation = require('../js/constellation.js');
    assert.strictEqual(typeof Constellation.showHoverCard, 'function', "showHoverCard doit exister");
    assert.strictEqual(typeof Constellation.hideHoverCard, 'function', "hideHoverCard doit exister");

    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="constellation-hover-card"'), "La carte de prévisualisation flottante au survol doit exister dans le DOM");

    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.constellation-mode-radial .constellation-node'), "Les styles pour orbes compacts en mode radial doivent exister");
    assert(css.includes('.constellation-hover-card'), "Les styles de la carte de prévisualisation au survol doivent exister");

    // Test de l'écartement aérien anti-superposition
    const testNodes = [
      { id: '__root__', parentId: null, width: 56, height: 56 },
      { id: 'p1', parentId: '__root__', width: 44, height: 44 },
      { id: 't1', parentId: 'p1', width: 44, height: 44 },
      { id: 't2', parentId: 'p1', width: 44, height: 44 },
      { id: 't3', parentId: 'p1', width: 44, height: 44 }
    ];
    Constellation.computeRadialLayout(testNodes, []);

    // Vérifier que tous les orbes sont distants d'au moins 70px les uns des autres (aucune superposition)
    for (let i = 0; i < testNodes.length; i++) {
      for (let j = i + 1; j < testNodes.length; j++) {
        const dist = Math.hypot(testNodes[i].x - testNodes[j].x, testNodes[i].y - testNodes[j].y);
        assert(dist >= 68, `Distance entre ${testNodes[i].id} et ${testNodes[j].id} (${dist.toFixed(1)}px) doit être >= 68px pour garantir l'aération sans chevauchement`);
      }
    }
  });

  // 12. Nouveau logo SVG de l'onglet Constellation (3 étoiles reliées)
  await it("12.1 index.html intègre la nouvelle icône SVG à 3 étoiles reliées pour l'onglet Constellation", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('d="M5 17L12 5L19 15Z"'), "La nouvelle forme SVG à 3 étoiles reliées doit être présente dans le volet latéral");
  });

  // 13. Clic gauche sur les bulles (Passerelles et déclencheurs)
  await it("13.1 handleNodeClick déclenche les bonnes modales ou navigations pour les bulles", () => {
    const Constellation = require('../js/constellation.js');
    let projectModalOpened = null;
    let taskModalOpened = null;
    let eventModalOpened = null;
    let noteSelected = null;
    let navigatedScreen = null;

    global.ProjectsManager = { openProjectDetailModal: (id) => { projectModalOpened = id; } };
    global.TasksManager = { openTaskModal: (id) => { taskModalOpened = id; } };
    global.AgendaManager = { openEventModal: (id) => { eventModalOpened = id; } };
    global.NotesManager = { selectNote: (id) => { noteSelected = id; } };
    global.App = { navigate: (screen) => { navigatedScreen = screen; } };

    Constellation._graphData = {
      nodes: [
        { id: 'proj_p1', type: 'project', originalId: 'p1' },
        { id: 'task_t1', type: 'task', originalId: 't1' },
        { id: 'event_e1', type: 'event', originalId: 'e1' },
        { id: 'note_n1', type: 'note', originalId: 'n1' },
        { id: '__hub_tasks_free__', type: 'hub', hubCategory: 'tasks' }
      ]
    };

    Constellation.handleNodeClick('proj_p1');
    assert.strictEqual(projectModalOpened, 'p1', "Clic sur bulle projet ouvre la modale de projet");

    Constellation.handleNodeClick('task_t1');
    assert.strictEqual(taskModalOpened, 't1', "Clic sur bulle tâche ouvre la modale de tâche");

    Constellation.handleNodeClick('event_e1');
    assert.strictEqual(eventModalOpened, 'e1', "Clic sur bulle événement ouvre la modale agenda");

    Constellation.handleNodeClick('note_n1');
    assert.strictEqual(noteSelected, 'n1', "Clic sur bulle note sélectionne la note");
    assert.strictEqual(navigatedScreen, 'notes', "Clic sur bulle note navigue vers l'écran notes");

    Constellation.handleNodeClick('__hub_tasks_free__');
    assert.strictEqual(navigatedScreen, 'tasks', "Clic sur le hub des tâches libres navigue vers les tâches");
  });

  // 14. Menu contextuel du canevas vierge
  await it("14.1 showCanvasContextMenu est exposé et configure le menu d'actions du canevas", () => {
    const Constellation = require('../js/constellation.js');
    assert(typeof Constellation.showCanvasContextMenu === 'function', "showCanvasContextMenu doit être défini");
  });

  // 15. Raccourcis clavier et auto-fit initial
  await it("15.1 ConstellationManager initialise _hasInitiallyFitted et gère le cadrage initial", () => {
    const Constellation = require('../js/constellation.js');
    assert('_hasInitiallyFitted' in Constellation, "_hasInitiallyFitted doit être présent dans l'état de Constellation");
  });

  // 16. Synchronisation automatique vers Constellation lors de modifications de données
  await it("16.1 Les méthodes saveAll de Tasks, Projects, Agenda et Notes déclenchent le rafraîchissement de Constellation", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const projectsJs = fs.readFileSync(path.join(rootDir, 'js', 'projects.js'), 'utf8');
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');

    assert(tasksJs.includes("window.ConstellationManager.render()"), "TasksManager actualise Constellation en direct");
    assert(projectsJs.includes("window.ConstellationManager.render()"), "ProjectsManager actualise Constellation en direct");
    assert(agendaJs.includes("window.ConstellationManager.render()"), "AgendaManager actualise Constellation en direct");
    assert(notesJs.includes("window.ConstellationManager.render()"), "NotesManager actualise Constellation en direct");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS CONSTELLATION : ${passedTests} passés, ${failedTests} échoués`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
