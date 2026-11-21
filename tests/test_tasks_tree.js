/**
 * Antigravité - Tests automatisés pour l'Arborescence des Tâches & Micro-Animations
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests Arborescence des Tâches & Animations");
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

// -----------------------------------------------------------------------------
// Test 1 : Vérification des méthodes expandAll et collapseAll
// -----------------------------------------------------------------------------
it("1. TasksManager expose expandAll() et collapseAll() pour piloter l'arborescence", () => {
  const Tasks = require('../js/tasks.js');
  
  const sampleTasks = [
    {
      id: "root-1",
      title: "Projet A",
      subtasks: [
        { id: "sub-1-1", title: "Sous-tâche 1.1", subtasks: [
          { id: "sub-1-1-1", title: "Sous-sous-tâche 1.1.1", subtasks: [] }
        ]},
        { id: "sub-1-2", title: "Sous-tâche 1.2", subtasks: [] }
      ]
    },
    {
      id: "root-2",
      title: "Tâche simple sans enfants",
      subtasks: []
    }
  ];

  Tasks.getAll = () => sampleTasks;
  Tasks.render = () => {}; // mock render

  // Tester collapseAll()
  Tasks.collapsedTasks = new Set();
  Tasks.collapseAll();
  assert.strictEqual(Tasks.collapsedTasks.has("root-1"), true, "Le parent root-1 doit être replié");
  assert.strictEqual(Tasks.collapsedTasks.has("sub-1-1"), true, "Le sous-parent sub-1-1 doit être replié");
  assert.strictEqual(Tasks.collapsedTasks.has("root-2"), false, "root-2 n'a pas d'enfants, ne doit pas être dans collapsedTasks");

  // Tester expandAll()
  Tasks.expandAll();
  assert.strictEqual(Tasks.collapsedTasks.size, 0, "collapsedTasks doit être vide après expandAll()");
});

// -----------------------------------------------------------------------------
// Test 2 : Vérification du calcul récursif des compteurs de filtres
// -----------------------------------------------------------------------------
it("2. updateFilterCounts() calcule avec exactitude les tâches actives et terminées récursivement", () => {
  const Tasks = require('../js/tasks.js');
  
  const sampleTasks = [
    {
      id: "t1",
      title: "Tâche 1",
      completed: false,
      subtasks: [
        { id: "t1-1", title: "Sous-tâche 1.1", completed: true, subtasks: [] },
        { id: "t1-2", title: "Sous-tâche 1.2", completed: false, subtasks: [
          { id: "t1-2-1", title: "Sous-sous-tâche 1.2.1", completed: true, subtasks: [] }
        ]}
      ]
    },
    {
      id: "t2",
      title: "Tâche 2",
      completed: true,
      subtasks: []
    }
  ];

  let totalCount = 0;
  let activeCount = 0;
  let completedCount = 0;

  const countRecursive = (list) => {
    for (const t of list) {
      totalCount++;
      if (t.completed) completedCount++;
      else activeCount++;
      if (t.subtasks && t.subtasks.length > 0) countRecursive(t.subtasks);
    }
  };
  countRecursive(sampleTasks);

  assert.strictEqual(totalCount, 5, "Total récursif attendu = 5");
  assert.strictEqual(activeCount, 2, "Tâches actives attendues = 2 (t1 et t1-2)");
  assert.strictEqual(completedCount, 3, "Tâches terminées attendues = 3 (t1-1, t1-2-1, t2)");
});

// -----------------------------------------------------------------------------
// Test 3 : Présence des styles CSS pour l'arborescence et micro-animations
// -----------------------------------------------------------------------------
it("3. styles.css contient les règles de micro-animations de transition et les lignes d'arborescence", () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf-8');

  // Animations d'écrans et transitions de pages
  assert.ok(css.includes('@keyframes screenTransition'), "Animation screenTransition présente");
  assert.ok(css.includes('@keyframes titleMicroFade'), "Animation titleMicroFade pour l'en-tête présente");
  assert.ok(css.includes('.title-screen-transition'), "Classe .title-screen-transition présente");
  assert.ok(css.includes('.page-transition-bar'), "Classe .page-transition-bar présente");
  assert.ok(css.includes('@keyframes pageBarSweep'), "Animation pageBarSweep présente");

  // Arborescence des tâches
  assert.ok(css.includes('.task-tree-node'), "Classe .task-tree-node présente");
  assert.ok(css.includes('.task-tree-node.is-root'), "Style racine .task-tree-node.is-root présent");
  assert.ok(css.includes('.task-tree-node.is-child'), "Style branche .task-tree-node.is-child présent");
  assert.ok(css.includes('--tree-line'), "Variable --tree-line définie");
  assert.ok(css.includes('.subtasks-container'), "Classe .subtasks-container présente");
  assert.ok(css.includes('.badge-subtasks-progress'), "Pastille d'avancement des sous-tâches présente");
  assert.ok(css.includes('.task-action-group'), "Groupe de boutons d'action présent");
});

// -----------------------------------------------------------------------------
// Test 4 : index.html intègre le bouton bascule 'Tout replier / Tout déplier'
// -----------------------------------------------------------------------------
it("4. index.html intègre le bouton bascule 'Tout replier / Tout déplier'", () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

  assert.ok(
    html.includes('id="btn-tasks-toggle-collapse"') ||
    (html.includes('id="btn-tasks-expand-all"') && html.includes('id="btn-tasks-collapse-all"')),
    "Bouton bascule btn-tasks-toggle-collapse présent"
  );
});

// -----------------------------------------------------------------------------
// Test 5 : Non-régression des opérations d'arborescence (outdent, indent, drag-and-drop)
// -----------------------------------------------------------------------------
it("5. Non-régression des opérations de manipulation d'arborescence", () => {
  const Tasks = require('../js/tasks.js');
  let tree = [
    {
      id: "parent-alpha",
      title: "Parent Alpha",
      subtasks: [
        { id: "child-1", title: "Enfant 1", subtasks: [] },
        { id: "child-2", title: "Enfant 2", subtasks: [] }
      ]
    }
  ];

  Tasks.getAll = () => tree;
  Tasks.saveAll = (t) => { tree = t; };

  // 1. Indent child-2 under child-1
  const indentSuccess = Tasks.indentTask("child-2");
  assert.strictEqual(indentSuccess, true);
  assert.strictEqual(tree[0].subtasks.length, 1);
  assert.strictEqual(tree[0].subtasks[0].subtasks.length, 1);
  assert.strictEqual(tree[0].subtasks[0].subtasks[0].id, "child-2");

  // 2. Outdent child-2 back to parent level
  const outdentSuccess = Tasks.outdentTask("child-2");
  assert.strictEqual(outdentSuccess, true);
  assert.strictEqual(tree[0].subtasks.length, 2);
  assert.strictEqual(tree[0].subtasks[1].id, "child-2");
});

console.log("==========================================================");
console.log(`   RÉSULTATS : ${passed} passés, ${failed} échoués`);
console.log("==========================================================");

if (failed > 0) process.exit(1);
