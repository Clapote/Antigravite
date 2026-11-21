/**
 * Antigravité - Tests automatisés des fonctionnalités v1.2.5
 * 
 * Vérifications couvertes :
 * 1. Synchronisation de la version 1.2.5 (package.json, index.html, app.js, settings.js).
 * 2. Présence de l'encart Changelog Version 1.2.5 dans les paramètres.
 * 3. Existence et structure de Tester-Antigravite-1.2.5.bat et Push_Vers_GitHub.bat.
 * 4. Notes : Les dossiers vides ne sont plus ignorés dans renderNotesList (absence de `if (folderNotes.length === 0) return;`).
 * 5. Notes : Présence de la méthode createNoteInFolder et du placeholder .note-folder-empty-placeholder.
 * 6. Notes : promptNewFolder ne filtre plus brutalement sur le dossier créé et préserve l'arborescence.
 * 7. Agenda : Présence du bouton #btn-event-create-note et option __new__ dans #event-input-note.
 * 8. Agenda : Création et liaison d'une note attachée depuis l'agenda (syncNoteEventLink).
 * 9. Agenda : Menu contextuel créneau (clic droit) intègre l'action d'ajout de note.
 * 10. Horloge accueil : applyPerformanceTimers fixe clockMs = 1000 (actualisation à chaque seconde).
 * 11. Fiabilisation icônes : createDesktopShortcut = 'always' dans package.json et icon.png dans index.html.
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
    console.error(`        ${err.message}\n`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("   Antigravité - Tests des fonctionnalités v1.2.5");
  console.log("   (Dossiers Notes, Note Agenda, Horloge 1s & Icônes)");
  console.log("==========================================================");

  // 1. Version 1.2.5 ou supérieure synchronisée
  await it("1.1 Version 1.2.5 ou supérieure synchronisée (package.json, index.html, app.js, settings.js)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert(pkg.version >= '1.2.5', "package.json doit être en version 1.2.5 ou supérieure");

    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes(`id="updater-current-version-label">${pkg.version}</strong>`), "index.html affiche la version courante");

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes(`APP_VERSION: '${pkg.version}'`), "app.js est configuré sur la version courante");

    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    assert(settingsCode.includes(`currentVersion: '${pkg.version}'`), "settings.js est initialisé avec la version courante");
  });

  // 2. Changelog 1.2.5
  await it("1.2 Changelog officiel de la Version 1.2.5 présent dans les paramètres", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('Version 1.2.5'), "Encart Version 1.2.5 présent dans le Changelog");
    assert(htmlContent.includes('Notes : Visibilité immédiate &amp; Gestion des dossiers'), "Section dossiers notes");
    assert(htmlContent.includes('Agenda : Création de note attachée en 1 clic'), "Section note agenda");
    assert(htmlContent.includes('Accueil &amp; Système : Horloge temps réel &amp; Icônes'), "Section horloge et icônes");
  });

  // 3. Scripts .bat
  await it("1.3 Scripts .bat de test et de release présents", () => {
    const batPath = fs.existsSync(path.join(rootDir, 'Tester-Antigravite-1.2.5.bat'))
      ? path.join(rootDir, 'Tester-Antigravite-1.2.5.bat')
      : path.join(rootDir, 'Tester-Antigravite-1.3.0.bat');
    assert(fs.existsSync(batPath), "Tester-Antigravite présent");

    const pushBatPath = path.join(rootDir, 'Push_Vers_GitHub.bat');
    const pushBatContent = fs.readFileSync(pushBatPath, 'utf8');
    assert(pushBatContent.includes("v1.2.5") || pushBatContent.includes("v1.2.6") || pushBatContent.includes("v1.3.0"), "Push_Vers_GitHub.bat mentionne la version");
  });

  // 4. Notes : Dossiers vides visibles
  await it("1.4 Notes : Les dossiers vides ne sont plus masqués dans renderNotesList", () => {
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(!notesJs.includes("if (folderNotes.length === 0) return; // Ne pas encombrer avec des dossiers vides sans note"),
      "La règle supprimant les dossiers vides doit être retirée");
    assert(notesJs.includes("note-folder-empty-placeholder"), "Placeholder dossier vide présent");
  });

  // 5. Notes : Méthode createNoteInFolder et zone d'ajout
  await it("1.5 Notes : NotesManager expose createNoteInFolder et gère le classement direct", () => {
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesJs.includes("createNoteInFolder(folderName)"), "Méthode createNoteInFolder déclarée");
    assert(notesJs.includes("createNote(folderOverride = null)"), "createNote accepte un dossier cible");

    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes(".note-folder-empty-placeholder"), "Styles CSS pour note-folder-empty-placeholder présents");
  });

  // 6. Notes : Sélecteur de dossier préserve la note active
  await it("1.6 Notes : Le sélecteur de dossier préserve la note en cours lors de la création d'un dossier", () => {
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesJs.includes("const targetNoteId = this.currentNoteId;"), "targetNoteId mémorisé avant promptNewFolder");
  });

  // 7. Agenda : Bouton et option création de note dans la modale
  await it("1.7 Agenda : Modale d'événement intègre le bouton ＋ Nouvelle note et option __new__", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="btn-event-create-note"'), "Bouton #btn-event-create-note présent dans index.html");

    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaJs.includes("btnCreateNote = document.getElementById('btn-event-create-note')"), "btnCreateNote résolu dans agenda.js");
    assert(agendaJs.includes('handleCreateAttachedNote'), "handleCreateAttachedNote présent dans agenda.js");
    assert(agendaJs.includes('value="__new__"'), "Option __new__ intégrée dans le sélecteur de notes");
  });

  // 8. Agenda : Menu contextuel créneau (clic droit) intègre ＋ Rédiger une note
  await it("1.8 Agenda : Menu contextuel d'un créneau propose de rédiger une note associée", () => {
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaJs.includes('id="cmenu-create-attached-note"'), "Option cmenu-create-attached-note présente");
    assert(agendaJs.includes("Rédiger une note pour ce créneau"), "Texte d'action de création de note présent");
  });

  // 9. Horloge de l'accueil cadencée à 1000ms
  await it("1.9 Accueil : Horloge cadencée à 1000ms avec défilement fluide des secondes", () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appJs.includes("const clockMs = 1000;"), "clockMs configuré à 1000ms dans applyPerformanceTimers");
    assert(appJs.includes("dashboard-clock-seconds"), "Sélecteur des secondes présent");
  });

  // 10. Fiabilisation des icônes sous Windows
  await it("1.10 Système : Raccourci Bureau 'always' et icônes fiabilisées", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.build.nsis.createDesktopShortcut, 'always', "createDesktopShortcut doit valoir 'always'");

    assert(fs.existsSync(path.join(rootDir, 'assets', 'icon.ico')), "assets/icon.ico doit exister");
    assert(fs.existsSync(path.join(rootDir, 'assets', 'icon.png')), "assets/icon.png doit exister");

    const mainJs = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainJs.includes("nativeImage.createFromPath(appIconPath)"), "main.js instancie nativeImage pour l'icône de fenêtre");
  });

  // 11. Accueil : Badge de comptage des créneaux protégé contre le rognage
  await it("1.11 Accueil : Badge #dashboard-events-count-badge protégé contre le rognage", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="dashboard-events-count-badge" class="badge dashboard-events-count-badge"'),
      "index.html contient le badge avec sa classe dédiée");
    assert(htmlContent.includes('<span class="panel-title-text">Créneaux du jour</span>'),
      "Le texte du titre est isolé dans panel-title-text pour absorber la troncature sans écraser le badge");

    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('#dashboard-events-count-badge'), "Styles dédiés au badge dans css/styles.css");
    assert(cssContent.includes('flex-shrink: 0 !important;'), "Badge protégé avec flex-shrink: 0");

    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appJs.includes("badgeEventsCount.style.display = todayEvents.length > 0 ? 'inline-flex' : 'none';"),
      "app.js active le badge en inline-flex centré");
  });

  // 12. Notes : Vue globale des dossiers & Organiseur façon Projets
  await it("1.12 Notes : Vue globale des dossiers (boutons, conteneur plein format et méthodes)", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="btn-toggle-notes-view"'), "Bouton #btn-toggle-notes-view dans la toolbar de notes");
    assert(htmlContent.includes('id="btn-sidebar-toggle-folders"'), "Bouton #btn-sidebar-toggle-folders dans la sidebar");
    assert(htmlContent.includes('id="notes-folders-overview"'), "Conteneur #notes-folders-overview présent dans index.html");
    assert(htmlContent.includes('id="notes-folders-grid"'), "Grille #notes-folders-grid présente dans index.html");

    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesJs.includes('setLayoutMode(mode)'), "Méthode setLayoutMode déclarée dans notes.js");
    assert(notesJs.includes('renderFoldersOverview()'), "Méthode renderFoldersOverview déclarée dans notes.js");
    assert(notesJs.includes('_bindFoldersOverviewDragAndDrop(grid)'), "Méthode de drag & drop déclarée dans notes.js");

    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('.notes-folders-overview'), "Styles .notes-folders-overview présents dans css/styles.css");
    assert(cssContent.includes('.notes-folders-grid'), "Styles .notes-folders-grid présents dans css/styles.css");
    assert(cssContent.includes('.notes-folder-card'), "Styles .notes-folder-card présents dans css/styles.css");
  });

  // 13. Notes : Bouton "Créer un créneau" protégé contre le rognage
  await it("1.13 Notes : Bouton #btn-note-schedule-event et barre responsive anti-coupure", () => {
    const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(htmlContent.includes('id="btn-note-schedule-event" class="btn btn-secondary btn-sm note-schedule-btn"'),
      "Bouton #btn-note-schedule-event présent avec classe note-schedule-btn");
    assert(htmlContent.includes('<span>Agenda :</span>'),
      "Label Agenda raccourci pour préserver l'espace et éviter toute coupure");

    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(cssContent.includes('flex-shrink: 0 !important;'), "Bouton protégé contre l'écrasement");
    assert(cssContent.includes('.note-agenda-bar {'), "Styles .note-agenda-bar déclarés");
    assert(cssContent.includes('flex-wrap: wrap;'), "Barre fluide autorisant le retour à la ligne sans rognage");
  });

  // 14. Notes : Numérotation continue et puces automatiques
  await it("1.14 Notes : Numérotation continue et auto-enchaînement après un paragraphe", () => {
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesJs.includes('_handleOrderedListCreation(editor)'), "_handleOrderedListCreation présent dans notes.js");
    assert(notesJs.includes('syncOrderedListsNumbering(editor)'), "syncOrderedListsNumbering présent dans notes.js");
    assert(notesJs.includes('parentOl.setAttribute(\'start\', startNum)'), "Attribution de start sur saisie directe");

    const NotesManager = require(path.join(rootDir, 'js', 'notes.js'));
    const md = '1. Premier\n\nUn paragraphe\n\n2. Deuxième';
    const html = NotesManager.simpleMarkdownToHtml(md);
    assert(html.includes('<ol class="obsidian-list" start="2">'), "simpleMarkdownToHtml conserve la continuité start='2'");
  });

  // 15. Check-up complet de tous les liens et de l'interconnexion (Tâches, Agenda, Notes, Projets)
  await it("1.15 Check-up global : intégrité des liens inter-modules et passerelles sans bug", () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const notesJs = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const searchJs = fs.readFileSync(path.join(rootDir, 'js', 'search.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    // Passerelle Accueil -> Agenda, Tâches, Notes, Projets
    assert(indexHtml.includes('id="dashboard-panel-agenda"'), "Panneau Agenda identifié");
    assert(indexHtml.includes('data-nav="agenda"'), "En-tête de l'Agenda cliquable avec data-nav");
    assert(appJs.includes("openNoteFromDashboard"), "Méthode openNoteFromDashboard présente");
    assert(appJs.includes("openProjectDetailModal"), "Badge projet cliquable depuis le tableau de bord");

    // Passerelle Tâches -> Projets et Agenda
    assert(tasksJs.includes("ProjectsManager.openProjectDetailModal"), "Badge projet dans les tâches permet d'ouvrir le projet");
    assert(tasksJs.includes("AgendaManager.zoomToDay"), "Badge date prévue dans les tâches permet d'ouvrir l'agenda");

    // Passerelle Agenda -> Tâches et Notes
    assert(agendaJs.includes("btnOpenTask.onclick"), "Bouton tâche liée présent dans la modale d'événement");
    assert(agendaJs.includes("btnOpenNote.onclick"), "Bouton note liée présent dans la modale d'événement");
    assert(agendaJs.includes("cmenu-task"), "Accès direct à la tâche liée dans le menu contextuel de l'agenda");
    assert(agendaJs.includes("cmenu-note"), "Accès direct à la note liée dans le menu contextuel de l'agenda");

    // Intégrité bidirectionnelle lors de la suppression
    assert(agendaJs.includes("n.linkedEventId = null;"), "Suppression d'un événement détache proprement la note liée sans orphelin");
    assert(notesJs.includes("e.noteId = null;"), "Suppression d'une note détache proprement l'événement lié sans orphelin");

    // Passerelle Notes -> Vue éditeur automatique lors d'une sélection
    assert(notesJs.includes("if (forceEditor && this.layoutMode === 'folders')"), "selectNote bascule automatiquement vers l'éditeur si appelée depuis un lien externe");

    // Recherche universelle : passerelles complètes
    assert(searchJs.includes("ProjectsManager.openProjectDetailModal"), "Recherche universelle ouvre directement le détail du projet");
    assert(searchJs.includes("AgendaManager.openEventModal"), "Recherche universelle ouvre directement la modale de l'événement");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS v1.2.5 : ${passedTests} passés, ${failedTests} échoués`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
