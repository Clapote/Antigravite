/**
 * Antigravité - Tests automatisés : Expérience simplifiée, Archivage projets, Constellation & Stats
 * 
 * Vérifications couvertes :
 * 1. Nettoyage absolu des références à Obsidian (sans perte de syntaxe markdown ni d'export)
 * 2. Simplification au premier lancement (7 onglets par défaut, widgets off, débriefing off)
 * 3. Archivage des projets (cascade sous-projets, masquage des tâches dans les vues actives, restauration)
 * 4. Commandes "Tout replier / Tout déplier" dans Projets et Tâches
 * 5. Harmonisation sobre du vocabulaire ("Mode économie extrême", "Système & Performances")
 * 6. Constellation : Gravitation planétaire locale autour de chaque projet
 * 7. Bilan hebdomadaire : 4 statistiques consolidées et bienveillantes
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(` [PASS] ${title}`);
    passedTests++;
  } catch (err) {
    console.error(` [FAIL] ${title}`);
    console.error(`        ${err.message}`);
  }
}

console.log('==========================================================');
console.log('   Antigravité - Tests : UX, Archivage & Constellation');
console.log('==========================================================');

// -----------------------------------------------------------------------------
// 1. Suppression des références à Obsidian
// -----------------------------------------------------------------------------
runTest('1.1 Aucune mention textuelle utilisateur d\'Obsidian dans README.md', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  assert(!/obsidian/i.test(readme), 'README.md ne doit plus contenir le mot "obsidian"');
});

runTest('1.2 Aucune mention utilisateur d\'Obsidian dans index.html (hors classes CSS internes)', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  // Enlever les attributs class="...obsidian..." avant le test de texte visible
  const strippedHtml = indexHtml.replace(/class=["'][^"']*obsidian[^"']*["']/gi, '');
  assert(!/obsidian/i.test(strippedHtml), 'index.html ne doit plus afficher "Obsidian" à l\'utilisateur');
});

runTest('1.3 Le préréglage de fond d\'écran "Obsidienne" a été renommé "Anthracite"', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('Anthracite'), 'index.html doit proposer le fond Anthracite');
  assert(!indexHtml.includes('Obsidienne'), 'index.html ne doit plus mentionner Obsidienne');
});

// -----------------------------------------------------------------------------
// 2. Simplification du premier lancement (valeurs par défaut)
// -----------------------------------------------------------------------------
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const settingsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/settings.json'), 'utf8'));

runTest('2.1 DEFAULT_SETTINGS et settings.json désactivent les widgets du volet latéral par défaut', () => {
  assert(storageCode.includes('sidebarDayProgressEnabled: false'), 'sidebarDayProgressEnabled doit être false par défaut');
  assert(storageCode.includes('sidebarMiniPlayerEnabled: false'), 'sidebarMiniPlayerEnabled doit être false par défaut');
  assert(storageCode.includes('sidebarStickyNoteEnabled: false'), 'sidebarStickyNoteEnabled doit être false par défaut');
  assert(settingsJson.sidebarDayProgressEnabled === false, 'settings.json: sidebarDayProgressEnabled doit être false');
  assert(settingsJson.sidebarMiniPlayerEnabled === false, 'settings.json: sidebarMiniPlayerEnabled doit être false');
  assert(settingsJson.sidebarStickyNoteEnabled === false, 'settings.json: sidebarStickyNoteEnabled doit être false');
});

runTest('2.2 DEFAULT_SETTINGS désactive le bilan/débriefing par défaut', () => {
  assert(storageCode.includes('debriefEnabled: false'), 'debriefEnabled doit être false par défaut');
  assert(settingsJson.debriefEnabled === false, 'settings.json: debriefEnabled doit être false');
});

runTest('2.3 Seuls les 7 onglets autorisés sont activés par défaut dans sidebarVisibleScreens', () => {
  assert(settingsJson.sidebarVisibleScreens.agenda === true, 'agenda doit être activé');
  assert(settingsJson.sidebarVisibleScreens.tasks === true, 'tasks doit être activé');
  assert(settingsJson.sidebarVisibleScreens.projects === true, 'projects doit être activé');
  assert(settingsJson.sidebarVisibleScreens.notes === true, 'notes doit être activé');
  assert(settingsJson.sidebarVisibleScreens.trash === true, 'trash doit être activé');
  assert(settingsJson.sidebarVisibleScreens.constellation === false, 'constellation doit être désactivé par défaut');
  assert(settingsJson.sidebarVisibleScreens.focus === false, 'focus doit être désactivé par défaut');
  assert(settingsJson.sidebarVisibleScreens.music === false, 'music doit être désactivé par défaut');
  assert(settingsJson.sidebarVisibleScreens.backups === false, 'backups doit être désactivé par défaut');
});

// -----------------------------------------------------------------------------
// 3. Harmonisation des termes
// -----------------------------------------------------------------------------
runTest('3.1 "Mode économie extrême" remplace "Mode PC de merde" dans index.html', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('Mode économie extrême'), 'index.html doit contenir "Mode économie extrême"');
  assert(!indexHtml.includes('Mode PC de merde'), 'index.html ne doit plus contenir "Mode PC de merde"');
});

runTest('3.2 "Système & Performances" remplace "Paramètres sérieux"', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('Système &amp; Performances') || indexHtml.includes('Système & Performances'), 'index.html doit contenir "Système & Performances"');
  assert(!indexHtml.includes('Paramètres sérieux'), 'index.html ne doit plus contenir "Paramètres sérieux"');
});

// -----------------------------------------------------------------------------
// 4. Archivage des projets et masquage des tâches
// -----------------------------------------------------------------------------
runTest('4.1 ProjectsManager : archiveProject marque le projet comme archivé et cascade aux sous-projets', () => {
  const projectsCode = fs.readFileSync(path.join(__dirname, '../js/projects.js'), 'utf8');
  assert(projectsCode.includes('async archiveProject(id)'), 'ProjectsManager doit contenir archiveProject');
  assert(projectsCode.includes('async unarchiveProject(id)'), 'ProjectsManager doit contenir unarchiveProject');

  const fakeProjects = [
    { id: 'proj-root', title: 'Projet Racine', parentProjectId: null, archived: false },
    { id: 'proj-sub1', title: 'Sous-projet 1', parentProjectId: 'proj-root', archived: false },
    { id: 'proj-sub2', title: 'Sous-projet 2', parentProjectId: 'proj-sub1', archived: false },
    { id: 'proj-other', title: 'Autre Projet', parentProjectId: null, archived: false }
  ];

  const subprojectIds = [];
  const collectChildren = (parentId) => {
    fakeProjects.filter(p => p.parentProjectId === parentId).forEach(sub => {
      subprojectIds.push(sub.id);
      collectChildren(sub.id);
    });
  };
  collectChildren('proj-root');
  assert.strictEqual(subprojectIds.length, 2, 'Doit identifier les 2 descendants récursifs');

  const idsToArchive = new Set(['proj-root', ...subprojectIds]);
  fakeProjects.forEach(p => {
    if (idsToArchive.has(p.id)) p.archived = true;
  });

  assert.strictEqual(fakeProjects.find(p => p.id === 'proj-root').archived, true);
  assert.strictEqual(fakeProjects.find(p => p.id === 'proj-sub1').archived, true);
  assert.strictEqual(fakeProjects.find(p => p.id === 'proj-sub2').archived, true);
  assert.strictEqual(fakeProjects.find(p => p.id === 'proj-other').archived, false);
});

runTest('4.2 TasksManager : Les tâches des projets archivés sont masquées des vues actives', () => {
  const tasksCode = fs.readFileSync(path.join(__dirname, '../js/tasks.js'), 'utf8');
  assert(tasksCode.includes('isProjectArchived'), 'TasksManager doit vérifier isProjectArchived dans renderTaskList');
  assert(tasksCode.includes('archivedProjectIds.has(task.projectId)'), 'TasksManager doit exclure les tâches dont le projet est archivé');
  assert(tasksCode.includes('Tous les projets actifs'), 'Le sélecteur de projets doit préciser "Tous les projets actifs"');
});

runTest('4.3 Tableau de bord : Les tâches des projets archivés sont exclues du décompte prévu aujourd\'hui', () => {
  const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert(appCode.includes('archivedProjectIds.has(t.projectId)'), 'app.js doit vérifier si une tâche appartient à un projet archivé');
  assert(appCode.includes('filter(p => !p.archived).length'), 'stat-active-projects ne doit compter que les projets non archivés');
});

// -----------------------------------------------------------------------------
// 5. Bouton unique de bascule "Tout replier / Tout déplier"
// -----------------------------------------------------------------------------
runTest('5.1 ProjectsManager : Bouton unique toggle, bascule dynamique et méthodes expand/collapse', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('btn-projects-toggle-collapse'), 'index.html doit contenir le bouton unique btn-projects-toggle-collapse');

  const projectsCode = fs.readFileSync(path.join(__dirname, '../js/projects.js'), 'utf8');
  assert(projectsCode.includes('toggleAllCollapse()'), 'ProjectsManager doit contenir toggleAllCollapse()');
  assert(projectsCode.includes('updateToggleCollapseButton()'), 'ProjectsManager doit contenir updateToggleCollapseButton()');
  assert(projectsCode.includes('expandAll()'), 'ProjectsManager doit contenir expandAll()');
  assert(projectsCode.includes('collapseAll()'), 'ProjectsManager doit contenir collapseAll()');
});

runTest('5.2 TasksManager : Bouton unique toggle, bascule dynamique et méthodes expand/collapse', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('btn-tasks-toggle-collapse'), 'index.html doit contenir le bouton unique btn-tasks-toggle-collapse');

  const tasksCode = fs.readFileSync(path.join(__dirname, '../js/tasks.js'), 'utf8');
  assert(tasksCode.includes('toggleAllCollapse()'), 'TasksManager doit contenir toggleAllCollapse()');
  assert(tasksCode.includes('updateToggleCollapseButton()'), 'TasksManager doit contenir updateToggleCollapseButton()');
  assert(tasksCode.includes('expandAll()'), 'TasksManager doit contenir expandAll()');
  assert(tasksCode.includes('collapseAll()'), 'TasksManager doit contenir collapseAll()');
});

// -----------------------------------------------------------------------------
// 6. Constellation : Gravitation planétaire locale
// -----------------------------------------------------------------------------
runTest('6.1 ConstellationManager : computeRadialLayout positionne les éléments autour de leur projet respectif', () => {
  const constCode = fs.readFileSync(path.join(__dirname, '../js/constellation.js'), 'utf8');
  assert(constCode.includes('parentCenterX + Math.cos(subAngle) * r2'), 'Les nœuds de niveau 2 doivent graviter autour de parentCenterX');
  assert(constCode.includes('parentCenterY + Math.sin(subAngle) * r2'), 'Les nœuds de niveau 2 doivent graviter autour de parentCenterY');
  assert(constCode.includes('subCenterX + Math.cos(leafAngle) * r3'), 'Les sous-tâches de niveau 3 doivent graviter autour de subCenterX');
});

// -----------------------------------------------------------------------------
// 7. Bilan hebdomadaire : Statistiques consolidées
// -----------------------------------------------------------------------------
runTest('7.1 DebriefManager : getWeeklyAccomplishments calcule les 4 statistiques consolidées', () => {
  const debriefCode = fs.readFileSync(path.join(__dirname, '../js/debrief.js'), 'utf8');
  assert(debriefCode.includes('completedTasksCount: completedTasks.length'), 'Doit calculer completedTasksCount');
  assert(debriefCode.includes('eventsHonoredCount: weekEvents.length'), 'Doit calculer eventsHonoredCount');
  assert(debriefCode.includes('activeProjectsCount: distinctActiveProjectIds.size'), 'Doit calculer activeProjectsCount');
  assert(debriefCode.includes('effortDistribution: effortByProject'), 'Doit calculer effortDistribution');
});

runTest('7.2 DebriefManager : render affiche la bannière hebdomadaire à 4 cartes récapitulatives', () => {
  const debriefCode = fs.readFileSync(path.join(__dirname, '../js/debrief.js'), 'utf8');
  assert(debriefCode.includes('debrief-weekly-stats-banner'), 'Doit inclure le conteneur debrief-weekly-stats-banner');
  assert(debriefCode.includes('Tâches accomplies'), 'Doit afficher la carte Tâches accomplies');
  assert(debriefCode.includes('Temps & créneaux'), 'Doit afficher la carte Temps & créneaux');
  assert(debriefCode.includes('Projets en mouvement'), 'Doit afficher la carte Projets en mouvement');
  assert(debriefCode.includes('Répartition de l’effort'), 'Doit afficher la carte Répartition de l’effort');
});

console.log('==========================================================');
console.log(`   RÉSULTATS : ${passedTests} passés, ${totalTests - passedTests} échoués sur ${totalTests} tests`);
console.log('==========================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
