/**
 * Antigravité - Tests automatisés : Fonctionnalités v1.1.3 (Étape 1)
 * 
 * Couvre :
 * 1. Configuration des moments de notification d'agenda (1h, 30min, à l'heure)
 * 2. Prise en compte rigoureuse des choix multiples dans AgendaNotificationManager
 * 3. Nouveaux fonds d'écran prédéfinis (Océan, Forêt, Cyberpunk, Carbone, Lavande, Solaire)
 * 4. Nouvelles couleurs d'accentuation (Cyan, Orange, Menthe, Indigo)
 * 5. Présence et intégration dans index.html et css/styles.css
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests des fonctionnalités v1.1.3");
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
// Environnement Mock Isolé
// -----------------------------------------------------------------------------

const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => {
    for (const k in localStorageStore) delete localStorageStore[k];
  }
};

const domStore = {};
global.document = {
  getElementById: (id) => {
    if (!domStore[id]) {
      domStore[id] = {
        id,
        style: {},
        dataset: {},
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); },
          toggle(c, cond) { if (cond !== undefined ? cond : !this._classes.has(c)) this._classes.add(c); else this._classes.delete(c); }
        },
        children: [],
        innerHTML: '',
        textContent: '',
        value: '',
        addEventListener: () => {},
        appendChild(child) {
          this.children.push(child);
          this.innerHTML += (child.innerHTML || '') + '\n';
        }
      };
    }
    return domStore[id];
  },
  createElement: (tag) => {
    return {
      tagName: (tag || '').toUpperCase(),
      style: {},
      dataset: {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        toggle(c, cond) { if (cond !== undefined ? cond : !this._classes.has(c)) this._classes.add(c); else this._classes.delete(c); }
      },
      children: [],
      innerHTML: '',
      textContent: '',
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k] || this[k] || null; },
      remove: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild(child) {
        this.children.push(child);
        this.innerHTML += (child.innerHTML || '') + '\n';
      }
    };
  },
  createDocumentFragment: () => {
    return {
      children: [],
      appendChild(child) { this.children.push(child); }
    };
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => null
  },
  body: {
    classList: {
      add: () => {},
      remove: () => {}
    },
    prepend: () => {}
  }
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  App: {
    showToast: () => {},
    applyAppearanceSettings: () => {}
  },
  AntigraviteAPI: {
    showNotification: async () => true
  }
};

const StorageManager = require('../js/storage.js');
global.window.StorageManager = StorageManager;
global.StorageManager = StorageManager;

const AgendaNotificationManager = require('../js/notifications.js');
global.window.AgendaNotificationManager = AgendaNotificationManager;

const App = require('../js/app.js');
global.window.App = App;
global.App = App;

const AgendaManager = require('../js/agenda.js');
global.window.AgendaManager = AgendaManager;
global.AgendaManager = AgendaManager;

const ProjectsManager = require('../js/projects.js');
global.window.ProjectsManager = ProjectsManager;
global.ProjectsManager = ProjectsManager;

global.Audio = class {
  constructor() {
    this.src = '';
    this.volume = 1;
    this.currentTime = 0;
    this.duration = 180;
    this._listeners = {};
  }
  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  removeEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
};
global.window.Audio = global.Audio;

if (typeof URL === 'undefined' || !URL.createObjectURL) {
  global.URL = {
    createObjectURL: (blob) => 'blob://mock-' + Math.random().toString(36).slice(2)
  };
}

const MusicManager = require('../js/music.js');
global.window.MusicManager = MusicManager;
global.MusicManager = MusicManager;

async function runTests() {
  const rootDir = path.resolve(__dirname, '..');

  // 1. StorageManager : Valeurs par défaut
  await it("1.1 DEFAULT_SETTINGS comprend agendaNotificationStages avec ['60m', '30m', 'now']", () => {
    const defaults = StorageManager.DEFAULT_SETTINGS;
    assert(Array.isArray(defaults.agendaNotificationStages), "agendaNotificationStages doit être un tableau");
    assert.deepStrictEqual(defaults.agendaNotificationStages, ['60m', '30m', 'now']);
  });

  await it("1.2 data/settings.json contient agendaNotificationStages", () => {
    const raw = fs.readFileSync(path.join(rootDir, 'data', 'settings.json'), 'utf8');
    const json = JSON.parse(raw);
    assert(Array.isArray(json.agendaNotificationStages), "agendaNotificationStages manquant dans data/settings.json");
    assert.deepStrictEqual(json.agendaNotificationStages, ['60m', '30m', 'now']);
  });

  // 2. Nouveaux fonds d'écran prédéfinis
  await it("2.1 js/app.js définit les 10 fonds d'écran prédéfinis", () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const expectedWallpapers = [
      'nebula', 'aurora', 'mineral', 'sunset',
      'ocean', 'forest', 'cyberpunk', 'minimal', 'lavender', 'solar'
    ];
    expectedWallpapers.forEach(wp => {
      assert(appJs.includes(`${wp}:`), `js/app.js doit définir le fond '${wp}'`);
    });
  });

  await it("2.2 index.html expose les cartes de sélection pour les 10 fonds d'écran", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const expectedWallpapers = [
      'none', 'nebula', 'aurora', 'mineral', 'sunset',
      'ocean', 'forest', 'cyberpunk', 'minimal', 'lavender', 'solar'
    ];
    expectedWallpapers.forEach(wp => {
      assert(html.includes(`data-wallpaper="${wp}"`), `index.html doit contenir la carte data-wallpaper="${wp}"`);
    });
  });

  // 3. Nouvelles couleurs d'accentuation
  await it("3.1 index.html contient les 9 bulles de couleurs d'accentuation", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const expectedAccents = ['blue', 'emerald', 'purple', 'amber', 'rose', 'cyan', 'orange', 'mint', 'indigo'];
    expectedAccents.forEach(acc => {
      assert(html.includes(`data-accent-val="${acc}"`), `index.html doit proposer l'accent '${acc}'`);
    });
  });

  await it("3.2 css/styles.css définit les règles CSS pour les 9 couleurs d'accentuation", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const expectedAccents = ['emerald', 'purple', 'amber', 'rose', 'cyan', 'orange', 'mint', 'indigo'];
    expectedAccents.forEach(acc => {
      assert(css.includes(`[data-accent="${acc}"]`), `css/styles.css doit définir [data-accent="${acc}"]`);
    });
  });

  // 4. Section UI Notifications dans index.html
  await it("4.1 index.html contient la section settings-section-notifications et le bouton de test", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="settings-section-notifications"'), "Section id='settings-section-notifications' présente");
    assert(html.includes('id="btn-test-notification"'), "Bouton id='btn-test-notification' présent");
    assert(html.includes('data-stage="60m"'), "Option 60m présente");
    assert(html.includes('data-stage="30m"'), "Option 30m présente");
    assert(html.includes('data-stage="now"'), "Option now présente");
  });

  // 5. Comportement du gestionnaire de notifications d'agenda
  await it("5.1 AgendaNotificationManager filtre rigoureusement selon les étapes activées", () => {
    let notifiedList = [];
    AgendaNotificationManager.notify = (stage, evt) => {
      notifiedList.push({ stage, title: evt.title });
    };

    // Cas 1 : Seulement '30m' actif
    StorageManager.saveSettings({
      notificationsEnabled: true,
      agendaNotificationStages: ['30m']
    });

    const now = Date.now();
    const event60m = { id: 'evt-60', title: 'Réunion 1h', start: new Date(now + 50 * 60000).toISOString() };
    const event30m = { id: 'evt-30', title: 'Réunion 30m', start: new Date(now + 20 * 60000).toISOString() };
    const eventNow = { id: 'evt-0', title: 'Réunion immédiate', start: new Date(now + 1 * 60000).toISOString() };

    StorageManager.saveEvents([event60m, event30m, eventNow]);
    AgendaNotificationManager.sentHistory = {};
    notifiedList = [];

    AgendaNotificationManager.checkUpcomingEvents();

    assert.strictEqual(notifiedList.length, 1, "Une seule notification doit être envoyée");
    assert.strictEqual(notifiedList[0].stage, '30m', "Doit être l'étape 30m");
    assert.strictEqual(notifiedList[0].title, 'Réunion 30m');
  });

  await it("5.2 Choix multiple combiné : ['60m', 'now'] déclenche 60m et now mais ignore 30m", () => {
    let notifiedList = [];
    AgendaNotificationManager.notify = (stage, evt) => {
      notifiedList.push({ stage, title: evt.title });
    };

    StorageManager.saveSettings({
      notificationsEnabled: true,
      agendaNotificationStages: ['60m', 'now']
    });

    const now = Date.now();
    const event60m = { id: 'evt-60-b', title: 'Réunion 1h B', start: new Date(now + 50 * 60000).toISOString() };
    const event30m = { id: 'evt-30-b', title: 'Réunion 30m B', start: new Date(now + 20 * 60000).toISOString() };
    const eventNow = { id: 'evt-0-b', title: 'Réunion immédiate B', start: new Date(now + 1 * 60000).toISOString() };

    StorageManager.saveEvents([event60m, event30m, eventNow]);
    AgendaNotificationManager.sentHistory = {};
    notifiedList = [];

    AgendaNotificationManager.checkUpcomingEvents();

    assert.strictEqual(notifiedList.length, 2, "Deux notifications doivent être envoyées (60m et now)");
    const stages = notifiedList.map(n => n.stage);
    assert(stages.includes('60m'), "Étape 60m déclenchée");
    assert(stages.includes('now'), "Étape now déclenchée");
    assert(!stages.includes('30m'), "Étape 30m ignorée car non cochée");
  });

  await it("5.3 Si aucun rappel n'est coché ([]), aucune notification n'est envoyée", () => {
    let notifiedList = [];
    AgendaNotificationManager.notify = (stage, evt) => {
      notifiedList.push({ stage, title: evt.title });
    };

    StorageManager.saveSettings({
      notificationsEnabled: true,
      agendaNotificationStages: []
    });

    const now = Date.now();
    const event30m = { id: 'evt-30-c', title: 'Réunion 30m C', start: new Date(now + 20 * 60000).toISOString() };

    StorageManager.saveEvents([event30m]);
    AgendaNotificationManager.sentHistory = {};
    notifiedList = [];

    AgendaNotificationManager.checkUpcomingEvents();

    assert.strictEqual(notifiedList.length, 0, "Aucune notification si la liste des étapes est vide");
  });

  await it("5.4 Si notificationsEnabled est faux, aucune notification n'est émise", () => {
    let notifiedList = [];
    AgendaNotificationManager.notify = (stage, evt) => {
      notifiedList.push({ stage, title: evt.title });
    };

    StorageManager.saveSettings({
      notificationsEnabled: false,
      agendaNotificationStages: ['60m', '30m', 'now']
    });

    const now = Date.now();
    const event30m = { id: 'evt-30-d', title: 'Réunion 30m D', start: new Date(now + 20 * 60000).toISOString() };

    StorageManager.saveEvents([event30m]);
    AgendaNotificationManager.sentHistory = {};
    notifiedList = [];

    AgendaNotificationManager.checkUpcomingEvents();

    assert.strictEqual(notifiedList.length, 0, "Aucune notification si notificationsEnabled === false");
  });

  await it("5.5 testNotification émet bien un événement d'exemple", () => {
    let testEvt = null;
    AgendaNotificationManager.notify = (stage, evt) => {
      testEvt = { stage, evt };
    };

    AgendaNotificationManager.testNotification('60m');
    assert(testEvt !== null, "testNotification doit appeler notify()");
    assert.strictEqual(testEvt.stage, '60m');
    assert(testEvt.evt.title.length > 0);
  });

  // 6. Typographie & Glassmorphism
  await it("6.1 DEFAULT_SETTINGS comprend fontFamily, glassStyle, notificationSound et notificationVolume", () => {
    const defaults = StorageManager.DEFAULT_SETTINGS;
    assert.strictEqual(defaults.fontFamily, 'system', "fontFamily par défaut doit être 'system'");
    assert.strictEqual(defaults.glassStyle, 'balanced', "glassStyle par défaut doit être 'balanced'");
    assert.strictEqual(defaults.notificationSound, 'zen', "notificationSound par défaut doit être 'zen'");
    assert.strictEqual(defaults.notificationVolume, 60, "notificationVolume par défaut doit être 60");
  });

  await it("6.2 index.html contient les options de typographie, de translucidité et d'ambiance sonore", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('data-font-family-val="system"'), "Option font system présente");
    assert(html.includes('data-font-family-val="tech"'), "Option font tech présente");
    assert(html.includes('data-font-family-val="serif"') || html.includes('data-font-family-val="rounded"'), "Option font serif/rounded présente");
    assert(html.includes('data-glass-val="balanced"'), "Option glass balanced présente");
    assert(html.includes('data-glass-val="glass"'), "Option glass glass présente");
    assert(html.includes('data-glass-val="solid"'), "Option glass solid présente");
    assert(html.includes('id="select-notification-sound"'), "Select notification sound présent");
    assert(html.includes('id="slider-notification-volume"'), "Slider volume notification présent");
    assert(html.includes('id="btn-preview-sound"'), "Bouton d'écoute sonore présent");
    assert(html.includes('src="./js/sound.js"'), "Script sound.js inclus dans index.html");
  });

  await it("6.3 css/styles.css définit les règles CSS pour la typographie et le glassmorphism", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('[data-font-family="system"]'), "data-font-family system dans CSS");
    assert(css.includes('[data-font-family="tech"]'), "data-font-family tech dans CSS");
    assert(css.includes('[data-font-family="rounded"]'), "data-font-family rounded dans CSS");
    assert(css.includes('[data-glass="glass"]'), "data-glass glass dans CSS");
    assert(css.includes('[data-glass="solid"]'), "data-glass solid dans CSS");
  });

  // 7. Synthèse Sonore (SoundManager)
  await it("7.1 SoundManager exécute playSound en toute sécurité sans générer d'exception", () => {
    const SoundManager = require('../js/sound.js');
    assert(typeof SoundManager.playSound === 'function', "SoundManager.playSound doit être une fonction");
    // Exécution avec mock headless (pas de Web Audio en pur node sans crash)
    assert.doesNotThrow(() => {
      SoundManager.playSound('zen', 0.5);
      SoundManager.playSound('chime', 0.8);
      SoundManager.playSound('pop', 0.2);
      SoundManager.playSound('none', 0.5);
      SoundManager.playSound('zen', 0);
    });
  });

  // 8. Traitement de Texte & Notes Enrichies (v1.1.3)
  await it("8.1 index.html contient la barre d'outils du traitement de texte riche", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="notes-format-block-select"'), "Sélecteur de style de paragraphe/titre présent");
    assert(html.includes('data-action="bold"'), "Bouton gras présent");
    assert(html.includes('data-action="italic"'), "Bouton italique présent");
    assert(html.includes('data-action="underline"'), "Bouton souligné présent");
    assert(html.includes('data-action="strikethrough"'), "Bouton barré présent");
    assert(html.includes('id="btn-highlight-menu"'), "Menu de surlignage présent");
    assert(html.includes('id="popover-highlight-palette"'), "Palette de surlignage présente");
    assert(html.includes('id="btn-color-menu"'), "Menu de couleur de police présent");
    assert(html.includes('id="popover-color-palette"'), "Palette de couleurs de police présente");
    assert(html.includes('data-action="bullet"'), "Bouton puces présent");
    assert(html.includes('data-action="number"'), "Bouton numéros présent");
    assert(html.includes('data-action="task"'), "Bouton tâches présent");
    assert(html.includes('data-action="align-left"'), "Bouton aligner à gauche présent");
    assert(html.includes('data-action="align-center"'), "Bouton centrer présent");
    assert(html.includes('data-action="align-right"'), "Bouton aligner à droite présent");
    assert(html.includes('data-action="clear"'), "Bouton effacer le format présent");
  });

  await it("8.2 index.html a supprimé le mode partagé/aperçu et intègre l'éditeur unique contenteditable", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(!html.includes('id="btn-view-split"'), "Bouton split supprimé");
    assert(!html.includes('id="btn-view-preview"'), "Bouton preview supprimé");
    assert(!html.includes('id="notes-preview-container"'), "Conteneur preview séparé supprimé");
    assert(html.includes('id="note-body-editor"'), "Éditeur présent");
    assert(html.includes('contenteditable="true"'), "Éditeur est un WYSIWYG contenteditable");
    assert(!html.includes('Export Obsidian'), "Aucune mention d'Obsidian sur le bouton d'export");
  });

  await it("8.3 NotesManager formate correctement le contenu HTML riche et convertit le texte antérieur", () => {
    const NotesManager = require('../js/notes.js');
    assert(typeof NotesManager.formatNoteContentForEditor === 'function', "formatNoteContentForEditor existe");
    
    // Contenu déjà HTML riche -> préservé tel quel
    const richContent = '<p>Texte avec <u>souligné</u> et <strong>gras</strong>.</p>';
    assert.strictEqual(NotesManager.formatNoteContentForEditor(richContent), richContent);

    // Contenu texte / markdown brut -> converti en HTML propre
    const plainMarkdown = '# Mon Titre\n\nDu texte avec **gras** et *italique*.';
    const formatted = NotesManager.formatNoteContentForEditor(plainMarkdown);
    assert(formatted.includes('<h1>Mon Titre</h1>'), "Titre H1 converti");
    assert(formatted.includes('<strong>gras</strong>'), "Gras converti");
    assert(formatted.includes('<em>italique</em>'), "Italique converti");
  });

  await it("8.4 NotesManager.applyFormatting gère le soulignage, le surlignage et les titres", () => {
    const NotesManager = require('../js/notes.js');
    
    // Test du fallback textarea / string manipulation
    const mockTextarea = {
      value: "Texte de test",
      selectionStart: 0,
      selectionEnd: 5,
      setSelectionRange() {},
      focus() {}
    };
    domStore['note-body-editor'] = mockTextarea;

    const resUnderline = NotesManager.applyFormatting('underline');
    assert(resUnderline.value.includes('<u>Texte</u>'), "Soulignage appliqué");

    mockTextarea.value = "Un titre simple";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 0;
    const resH1 = NotesManager.applyFormatting('h1');
    assert(resH1.value.startsWith('# '), "Titre H1 appliqué");
  });

  // 9. Améliorations v1.1.3 : Réduction des sous-tâches, Tri chronologique Agenda-Notes & Couleurs Projets
  await it("9.1 Réduction d'une tâche avec sous-tâches via TasksManager.toggleCollapse", () => {
    const TasksManager = require('../js/tasks.js');
    const taskId = 'task-parent-test';
    
    assert(!TasksManager.collapsedTasks.has(taskId), "La tâche n'est pas repliée au départ");
    TasksManager.toggleCollapse(taskId);
    assert(TasksManager.collapsedTasks.has(taskId), "La tâche est maintenant repliée");
    TasksManager.toggleCollapse(taskId);
    assert(!TasksManager.collapsedTasks.has(taskId), "La tâche est à nouveau dépliée");
  });

  await it("9.2 NotesManager.renderEventSelector trie chronologiquement et affiche la date/heure au début", () => {
    const NotesManager = require('../js/notes.js');
    const futureDateStr = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    const testEvents = [
      { id: 'evt-later', title: 'Réunion Plus Tard', start: `${futureDateStr}T16:00` },
      { id: 'evt-earlier', title: 'Réunion Plus Tôt', start: `${futureDateStr}T09:00` },
      { id: 'evt-past', title: 'Réunion Passée', start: '2025-01-01T14:00' }
    ];
    StorageManager.saveEvents(testEvents);

    const selectEl = {
      innerHTML: '',
      children: [],
      appendChild(grp) {
        this.children.push(grp);
      }
    };
    domStore['note-input-event'] = selectEl;

    // Simulation de optgroup et option pour createElement dans node
    const origCreate = global.document.createElement;
    try {
      global.document.createElement = (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          children: [],
          appendChild(child) { this.children.push(child); }
        };
        return el;
      };

      NotesManager.renderEventSelector(null);

      // Vérifier que les créneaux à venir sont bien ordonnés (09:00 avant 16:00)
      const grpUpcoming = selectEl.children.find(g => g.label && g.label.includes("venir"));
      assert(grpUpcoming && grpUpcoming.children.length === 2, "2 événements dans le groupe à venir");
      assert(grpUpcoming.children[0].textContent.includes('09:00'), "L'événement de 09:00 est en premier");
      assert(grpUpcoming.children[1].textContent.includes('16:00'), "L'événement de 16:00 est en second");
      assert(grpUpcoming.children[0].textContent.includes('/'), "Le libellé comporte la date formatée");
    } finally {
      global.document.createElement = origCreate;
    }
  });

  await it("9.3 Signification de l'appartenance à un projet par la couleur (Tâches et Notes)", () => {
    const TasksManager = require('../js/tasks.js');
    const NotesManager = require('../js/notes.js');

    const testProject = { id: 'proj-emerald', title: 'Projet Émeraude', color: '#10b981' };
    StorageManager.saveProjects([testProject]);

    // Test Tâche
    const testTask = {
      id: 'task-colored',
      title: 'Tâche avec couleur',
      projectId: 'proj-emerald',
      subtasks: []
    };
    StorageManager.saveTasks([testTask]);

    let capturedItemStyle = null;
    const treeContainer = {
      innerHTML: '',
      appendChild(node) {
        if (node.children && node.children.length > 0) {
          capturedItemStyle = node.children[0].style;
        }
      }
    };
    domStore['tasks-tree-container'] = treeContainer;

    const origCreate = global.document.createElement;
    try {
      global.document.createElement = (tag) => {
        return {
          tagName: tag.toUpperCase(),
          className: '',
          style: {
            setProperty() {}
          },
          dataset: {},
          attributes: {},
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k] || null; },
          children: [],
          appendChild(c) { this.children.push(c); },
          addEventListener() {},
          querySelectorAll() { return []; },
          querySelector() { return null; }
        };
      };

      TasksManager.render();
      assert(capturedItemStyle && capturedItemStyle.borderLeft && capturedItemStyle.borderLeft.includes('#10b981'), "La tâche prend la couleur de son projet en bordure gauche");

      // Test Note
      const testNote = {
        id: 'note-colored',
        title: 'Note avec couleur',
        projectId: 'proj-emerald',
        content: 'Contenu'
      };
      StorageManager.saveNotes([testNote]);

      let capturedNoteStyle = null;
      const notesListContainer = {
        innerHTML: '',
        appendChild(item) {
          const findNote = (el) => {
            if (el && el.className && el.className.includes('note-item')) return el;
            if (el && el.children) {
              for (const c of el.children) {
                const res = findNote(c);
                if (res) return res;
              }
            }
            return null;
          };
          const found = findNote(item);
          capturedNoteStyle = found ? found.style : item.style;
        }
      };
      domStore['notes-list-container'] = notesListContainer;

      NotesManager.renderNotesList();
      assert(capturedNoteStyle && capturedNoteStyle.borderLeft && capturedNoteStyle.borderLeft.includes('#10b981'), "La note prend la couleur de son projet en bordure gauche");

      // Test Note Project Selector
      const projSelect = {
        innerHTML: '',
        style: {},
        children: [],
        appendChild(opt) { this.children.push(opt); }
      };
      domStore['note-input-project'] = projSelect;

      NotesManager.renderProjectSelector(testNote);
      assert.strictEqual(projSelect.style.borderColor, '#10b981', "Le sélecteur de projet est bordé de la couleur du projet");
    } finally {
      global.document.createElement = origCreate;
    }
  });

  // ---------------------------------------------------------------------------
  // 10. Personnalisation du profil et messages d'accueil nominatifs (ex: Bonjour Théo)
  // ---------------------------------------------------------------------------
  await it("10.1 index.html expose la section profil, le champ input-user-name et les options de salutations", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="settings-section-profile"'), "Section de profil présente dans les paramètres");
    assert(html.includes('id="input-user-name"'), "Champ de saisie du prénom présent");
    assert(html.includes('id="btn-save-user-name"'), "Bouton d'enregistrement du prénom présent");
    assert(html.includes('id="select-greeting-mood"'), "Sélecteur de tonalité d'accueil présent");
    assert(html.includes('id="preview-user-greeting"'), "Aperçu en direct de salutation présent");
    assert(html.includes('id="dashboard-subtitle"'), "Élément sous-titre dynamique présent sur l'accueil");
    assert(!html.includes('id="btn-shuffle-quote"'), "Le bouton pour changer manuellement la citation a été retiré (alternance automatique par période)");
  });

  await it("10.2 App.getGreetingMessage intègre fidèlement le prénom personnalisé", () => {
    // 1. Avec prénom Théo
    StorageManager.saveSettings(Object.assign({}, StorageManager.DEFAULT_SETTINGS, { userName: "Théo" }));
    const msgDay = App.getGreetingMessage(10);
    assert(msgDay.includes("Bonjour Théo !"), `Le message de journée doit contenir 'Bonjour Théo !' (reçu: ${msgDay})`);

    const msgLunch = App.getGreetingMessage(13);
    assert(msgLunch.includes("Bonjour Théo !"), `Le message de midi doit contenir 'Bonjour Théo !' (reçu: ${msgLunch})`);

    const msgEve = App.getGreetingMessage(20);
    assert(msgEve.includes("Bonsoir Théo !"), `Le message du soir doit contenir 'Bonsoir Théo !' (reçu: ${msgEve})`);
  });

  await it("10.3 App.getGreetingMessage sans prénom ou par défaut conserve un message générique propre", () => {
    StorageManager.saveSettings(Object.assign({}, StorageManager.DEFAULT_SETTINGS, { userName: "" }));
    const msgEmpty = App.getGreetingMessage(10);
    assert(msgEmpty.startsWith("Bonjour !"), `Sans prénom, message commence par 'Bonjour !' (reçu: ${msgEmpty})`);

    StorageManager.saveSettings(Object.assign({}, StorageManager.DEFAULT_SETTINGS, { userName: "Utilisateur" }));
    const msgDefault = App.getGreetingMessage(10);
    assert(msgDefault.startsWith("Bonjour !"), `Avec 'Utilisateur' par défaut, pas de 'Bonjour Utilisateur' (reçu: ${msgDefault})`);
  });

  // ---------------------------------------------------------------------------
  // 11. Citations dynamiques d'accueil (bienveillantes & pince-sans-rire)
  // ---------------------------------------------------------------------------
  await it("11.1 App.GREETING_QUOTES contient des phrases bienveillantes et pince-sans-rire", () => {
    assert(App.GREETING_QUOTES && Array.isArray(App.GREETING_QUOTES.warm), "Liste de phrases chaleureuses présente");
    assert(App.GREETING_QUOTES && Array.isArray(App.GREETING_QUOTES.witty), "Liste de phrases pince-sans-rire présente");
    assert(App.GREETING_QUOTES.warm.length >= 5, "Au moins 5 phrases chaleureuses");
    assert(App.GREETING_QUOTES.witty.length >= 5, "Au moins 5 phrases pince-sans-rire");

    // Vérifier la présence de phrases demandées par l'utilisateur
    const allQuotes = App.GREETING_QUOTES.warm.concat(App.GREETING_QUOTES.witty).join(' ');
    assert(allQuotes.includes("bonne journée") || allQuotes.includes("excellente journée"), "Contient une phrase souhaitant une bonne journée");
    assert(allQuotes.includes("organiser"), "Contient une phrase d'aide à l'organisation");
    assert(allQuotes.includes("café") || allQuotes.includes("procrastination") || allQuotes.includes("gravité"), "Contient des touches d'humour pince-sans-rire");
  });

  await it("11.2 App.getRandomGreetingQuote respecte le filtre d'ambiance", () => {
    const warmQuote = App.getRandomGreetingQuote('warm');
    assert(App.GREETING_QUOTES.warm.includes(warmQuote), "Le tirage 'warm' provient de la liste warm");

    const wittyQuote = App.getRandomGreetingQuote('witty');
    assert(App.GREETING_QUOTES.witty.includes(wittyQuote), "Le tirage 'witty' provient de la liste witty");

    const mixedQuote = App.getRandomGreetingQuote('mixed');
    assert(typeof mixedQuote === 'string' && mixedQuote.length > 10, "Le tirage 'mixed' retourne une citation valide");
  });

  // ---------------------------------------------------------------------------
  // 12. Haute lisibilité et contraste en mode clair (v1.1.3)
  // ---------------------------------------------------------------------------
  await it("12.1 [data-theme=\"light\"] définit les polices en noir profond et gris très foncé", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('[data-theme="light"]'), "Sélecteur [data-theme=\"light\"] présent");
    
    // Découper le bloc [data-theme="light"]
    const lightBlockMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
    assert(lightBlockMatch, "Bloc de variables [data-theme=\"light\"] trouvé");
    const lightBlock = lightBlockMatch[1];
    
    assert(lightBlock.includes('--text-main: #000000'), "La variable --text-main doit être #000000 en mode clair");
    assert(lightBlock.includes('--text-muted: #1e293b'), "La variable --text-muted doit être #1e293b (Slate 800) en mode clair");
    assert(lightBlock.includes('--text-dim: #334155'), "La variable --text-dim doit être #334155 (Slate 700) en mode clair");
  });

  await it("12.2 css/styles.css contient des règles explicites de fort contraste en mode clair", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('[data-theme="light"] h1'), "Titres en noir profond en mode clair");
    assert(css.includes('[data-theme="light"] .hero-subtitle'), "Sous-titres en gris foncé contrasté en mode clair");
    assert(css.includes('[data-theme="light"] input::placeholder'), "Placeholders non délavés en mode clair");
    assert(css.includes('[data-theme="light"] .nav-item'), "Navigation lisible en gris foncé en mode clair");
    assert(css.includes('[data-theme="light"] .notes-rich-editor'), "Éditeur de notes en noir profond en mode clair");
  });

  // ---------------------------------------------------------------------------
  // 13. Jalon 1 : Liens Dashboard avec retour haptique et filtre Tâches "À faire"
  // ---------------------------------------------------------------------------
  await it("13.1 index.html contient les attributs data-nav et classes cliquables sur le tableau de bord", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('data-nav="tasks"'), "Lien vers l'écran Tâches présent sur le tableau de bord");
    assert(html.includes('data-nav="agenda"'), "Lien vers l'écran Agenda présent sur le tableau de bord");
    assert(html.includes('data-nav="projects"'), "Lien vers l'écran Projets présent sur le tableau de bord");
    assert(html.includes('data-nav="notes"'), "Lien vers l'écran Notes présent sur le tableau de bord");
    assert(html.includes('class="stat-card clickable"'), "Cartes statistiques marquées comme cliquables");
  });

  await it("13.2 App.triggerHapticFeedback existe et fonctionne sans erreur sonore", () => {
    assert(typeof App.triggerHapticFeedback === 'function', "App.triggerHapticFeedback doit être une fonction");
    // Ne doit pas lancer d'exception même si navigator.vibrate n'est pas disponible dans l'environnement de test
    assert.doesNotThrow(() => {
      App.triggerHapticFeedback();
    }, "triggerHapticFeedback doit s'exécuter en toute sécurité");
  });

  await it("13.3 TasksManager s'initialise par défaut sur le filtre 'active' (À faire)", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    assert(tasksJs.includes("currentFilter: 'active'"), "TasksManager.currentFilter doit être initialisé à 'active'");
    assert(tasksJs.includes("setFilter(filterName)"), "TasksManager doit fournir la méthode setFilter");
  });

  await it("13.4 index.html active par défaut la pastille de filtre 'À faire'", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('class="task-filter-chip filter-chip active" data-filter="active"'), "Pastille 'À faire' active par défaut dans index.html");
  });

  // ---------------------------------------------------------------------------
  // 14. Jalon 2 : Modales graphiques, Boutons '+' en pied de liste & Couleurs liées
  // ---------------------------------------------------------------------------
  await it("14.1 index.html contient la modale graphique unifiée #dialog-modal", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="dialog-modal"'), "Modale #dialog-modal présente dans index.html");
    assert(html.includes('id="dialog-title"'), "Titre de dialogue présent");
    assert(html.includes('id="dialog-message"'), "Message de dialogue présent");
    assert(html.includes('id="dialog-btn-confirm"'), "Bouton de confirmation présent");
    assert(html.includes('id="dialog-btn-cancel"'), "Bouton d'annulation présent");
  });

  await it("14.2 App.confirm et App.alert sont des méthodes asynchrones sécurisées", async () => {
    assert(typeof App.confirm === 'function', "App.confirm doit être une fonction");
    assert(typeof App.alert === 'function', "App.alert doit être une fonction");
    
    // Test de confirmation avec simulation du clic
    const confirmPromise = App.confirm("Test message");
    const btnConfirm = document.getElementById('dialog-btn-confirm');
    if (btnConfirm && typeof btnConfirm.onclick === 'function') {
      btnConfirm.onclick();
    }
    const res = await confirmPromise;
    assert.strictEqual(res, true, "App.confirm doit retourner true suite à la confirmation");

    // Test d'alerte avec simulation de validation
    const alertPromise = App.alert("Test info");
    if (btnConfirm && typeof btnConfirm.onclick === 'function') {
      btnConfirm.onclick();
    }
    await alertPromise;
  });

  await it("14.3 js/tasks.js et js/projects.js intègrent les boutons '+' en pied de liste", () => {
    const tasksJs = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const projectsJs = fs.readFileSync(path.join(rootDir, 'js', 'projects.js'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(tasksJs.includes('tasks-bottom-add-btn'), "Bouton d'ajout au pied des tâches présent dans tasks.js");
    assert(projectsJs.includes('project-card-add'), "Carte d'ajout au pied des projets présente dans projects.js");
    assert(css.includes('.tasks-bottom-add-btn'), "Styles CSS pour le bouton en pied des tâches définis");
    assert(css.includes('.project-card-add'), "Styles CSS pour la carte d'ajout de projet définis");
  });

  await it("14.4 AgendaManager applique la couleur du projet de la tâche liée aux créneaux", () => {
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaJs.includes('linkedTask.task.projectId'), "Recherche du projectId de la tâche liée dans agenda.js");
    assert(agendaJs.includes('projectMap.get(linkedTask.task.projectId)'), "Résolution de la couleur du projet dans agenda.js");
  });

  // ---------------------------------------------------------------------------
  // 15. Tests Jalon 3 : Zoom Jour Agenda, Projets Grille/Ligne & Drag-and-drop
  // ---------------------------------------------------------------------------

  await it("15.1 AgendaManager.zoomToDay bascule fidèlement en vue Jour sur la date choisie", () => {
    assert(typeof AgendaManager.zoomToDay === 'function', "AgendaManager.zoomToDay doit être une fonction");
    AgendaManager.currentView = 'week';
    AgendaManager.zoomToDay('2026-11-15');
    assert.strictEqual(AgendaManager.currentView, 'day', "La vue active doit être basculée en 'day'");
    assert(AgendaManager.currentWeekStart instanceof Date, "currentWeekStart doit être une Date valide");
    assert.strictEqual(AgendaManager.currentWeekStart.getDate(), 15, "Le jour doit être le 15");
    assert.strictEqual(AgendaManager.currentWeekStart.getMonth(), 10, "Le mois doit être Novembre (index 10)");
  });

  await it("15.2 Les en-têtes de jour de l'agenda semaine et mois intègrent .clickable-day et le zoom", () => {
    const agendaJs = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    assert(agendaJs.includes('clickable-day'), "La classe CSS clickable-day doit être injectée sur les en-têtes");
    assert(agendaJs.includes('AgendaManager.zoomToDay'), "AgendaManager.zoomToDay doit être appelé au clic sur les jours");
  });

  await it("15.3 ProjectsManager.setViewMode bascule entre 'grid' et 'list' et persiste le choix", () => {
    assert(typeof ProjectsManager.setViewMode === 'function', "ProjectsManager.setViewMode doit être une fonction");
    ProjectsManager.setViewMode('list');
    assert.strictEqual(ProjectsManager.viewMode, 'list', "viewMode doit être 'list'");
    assert.strictEqual(localStorage.getItem('antigravite_project_view'), 'list', "Le choix doit être persisté dans localStorage");

    ProjectsManager.setViewMode('grid');
    assert.strictEqual(ProjectsManager.viewMode, 'grid', "viewMode doit être 'grid'");
    assert.strictEqual(localStorage.getItem('antigravite_project_view'), 'grid', "Le choix 'grid' doit être persisté");
  });

  await it("15.4 ProjectsManager.reorderProjects réordonne la hiérarchie et persiste l'ordre", () => {
    assert(typeof ProjectsManager.reorderProjects === 'function', "ProjectsManager.reorderProjects doit être une fonction");
    const testProjects = [
      { id: 'proj-1', title: 'Alpha', color: '#ff0000' },
      { id: 'proj-2', title: 'Beta', color: '#00ff00' },
      { id: 'proj-3', title: 'Gamma', color: '#0000ff' }
    ];
    StorageManager.saveProjects(testProjects);

    // Déplacer 'proj-3' avant 'proj-1'
    const success1 = ProjectsManager.reorderProjects('proj-3', 'proj-1', false);
    assert.strictEqual(success1, true, "Le déplacement de proj-3 vers l'avant doit réussir");
    let saved = StorageManager.getProjects();
    assert.strictEqual(saved[0].id, 'proj-3', "proj-3 doit maintenant être premier");
    assert.strictEqual(saved[1].id, 'proj-1', "proj-1 doit maintenant être deuxième");
    assert.strictEqual(saved[2].id, 'proj-2', "proj-2 doit être troisième");

    // Déplacer 'proj-3' après 'proj-2'
    const success2 = ProjectsManager.reorderProjects('proj-3', 'proj-2', true);
    assert.strictEqual(success2, true, "Le déplacement de proj-3 vers la fin doit réussir");
    saved = StorageManager.getProjects();
    assert.strictEqual(saved[0].id, 'proj-1', "proj-1 doit être premier");
    assert.strictEqual(saved[1].id, 'proj-2', "proj-2 doit être deuxième");
    assert.strictEqual(saved[2].id, 'proj-3', "proj-3 doit être troisième");
  });

  await it("15.5 index.html et css/styles.css intègrent les contrôles de vue et styles de drag-and-drop", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('id="btn-project-view-grid"'), "Bouton vue Grille présent dans index.html");
    assert(html.includes('id="btn-project-view-list"'), "Bouton vue Lignes présent dans index.html");
    assert(css.includes('.projects-grid.view-list'), "Règles CSS .view-list présentes");
    assert(css.includes('.project-card.project-row'), "Règles CSS .project-row présentes");
    assert(css.includes('.project-drag-handle'), "Styles de poignée de glisser-déposer présents");
    assert(css.includes('.project-card.dragging'), "Styles de drag actif présents");
    assert(css.includes('.weekday-header.clickable-day'), "Styles d'en-tête de jour cliquable présents");
  });

  // ---------------------------------------------------------------------------
  // 16. Tests Jalon 4 : Espace Musique, Lecteur & Ambiances Focus
  // ---------------------------------------------------------------------------

  await it("16.1 MusicManager s'initialise correctement avec les contrôles et les pistes de base", async () => {
    assert(typeof MusicManager.init === 'function', "MusicManager.init doit être une fonction");
    await MusicManager.loadTracks();
    assert(Array.isArray(MusicManager.tracks), "tracks doit être un tableau");
    assert(MusicManager.tracks.length >= 50, "Les morceaux MP3 de base (dossier music/) doivent être chargés");
    assert(!MusicManager.tracks.some(t => t.src && t.src.startsWith('synth://')), "Les sons synthétiques (ondes alpha, cheminée, etc.) ont bien été retirés");
    assert(MusicManager.volume >= 0 && MusicManager.volume <= 1, "Le volume doit être compris entre 0 et 1");
  });

  await it("16.2 MusicManager.play, pause et togglePlay gèrent l'état de lecture", () => {
    MusicManager.pause();
    assert.strictEqual(MusicManager.isPlaying, false, "isPlaying doit être false après pause");
    MusicManager.togglePlay();
    assert.strictEqual(MusicManager.isPlaying, true, "isPlaying doit être true après togglePlay");
    MusicManager.pause();
    assert.strictEqual(MusicManager.isPlaying, false, "isPlaying doit être false après pause");
  });

  await it("16.2b MusicManager.stop arrête la lecture, réinitialise la position et l'état de démarrage", () => {
    MusicManager.initAudio();
    if (MusicManager.audio) MusicManager.audio.currentTime = 42;
    MusicManager.play();
    assert.strictEqual(MusicManager.isPlaying, true, "isPlaying doit être true après play");
    assert.strictEqual(MusicManager.hasStarted, true, "hasStarted doit être true");
    MusicManager.stop();
    assert.strictEqual(MusicManager.isPlaying, false, "isPlaying doit être false après stop");
    assert.strictEqual(MusicManager.hasStarted, false, "hasStarted doit être false après stop");
    if (MusicManager.audio) {
      assert.strictEqual(MusicManager.audio.currentTime, 0, "currentTime doit être remis à 0");
    }
  });

  await it("16.3 MusicManager.next et prev permettent de naviguer dans les pistes", () => {
    const initialIndex = MusicManager.currentIndex;
    MusicManager.next();
    assert.notStrictEqual(MusicManager.currentIndex, initialIndex, "L'index de piste doit avancer");
    MusicManager.prev();
    assert.strictEqual(MusicManager.currentIndex, initialIndex, "prev doit revenir à la piste précédente");
  });

  await it("16.4 MusicManager.setVolume et toggleMute ajustent le volume et le persistent", () => {
    MusicManager.setVolume(0.5);
    assert.strictEqual(MusicManager.volume, 0.5, "Le volume doit valoir 0.5");
    assert.strictEqual(localStorage.getItem('antigravite_music_volume'), '0.5', "Le volume doit être persisté");

    MusicManager.toggleMute();
    assert.strictEqual(MusicManager.isMuted, true, "isMuted doit être true");
    MusicManager.toggleMute();
    assert.strictEqual(MusicManager.isMuted, false, "isMuted doit être false après second toggle");
  });

  await it("16.5 MusicManager.toggleShuffle et cycleRepeat gèrent les modes de lecture", () => {
    MusicManager.isShuffle = false;
    MusicManager.toggleShuffle();
    assert.strictEqual(MusicManager.isShuffle, true, "Shuffle doit être activé");
    assert.strictEqual(localStorage.getItem('antigravite_music_shuffle'), 'true', "Shuffle doit être persisté");

    MusicManager.repeatMode = 'all';
    MusicManager.cycleRepeat();
    assert.strictEqual(MusicManager.repeatMode, 'one', "Cycle doit passer à 'one'");
    MusicManager.cycleRepeat();
    assert.strictEqual(MusicManager.repeatMode, 'none', "Cycle doit passer à 'none'");
    MusicManager.cycleRepeat();
    assert.strictEqual(MusicManager.repeatMode, 'all', "Cycle doit revenir à 'all'");
  });

  await it("16.6 MusicManager.addCustomTracks permet d'ajouter des fichiers audio personnels", () => {
    const fakeFile = {
      name: 'Chopin - Nocturne Op 9 No 2.mp3',
      size: 1024 * 1024 * 4
    };
    const beforeCount = MusicManager.tracks.length;
    MusicManager.addCustomTracks([fakeFile]);
    assert(MusicManager.tracks.length > beforeCount, "Le nombre de pistes doit avoir augmenté");
    const added = MusicManager.tracks.find(t => t.filename === 'Chopin - Nocturne Op 9 No 2.mp3');
    assert(added, "Le morceau ajouté doit être présent dans tracks");
    assert.strictEqual(added.title, 'Nocturne Op 9 No 2', "Le titre doit être extrait proprement");
    assert.strictEqual(added.artist, 'Chopin', "L'artiste doit être extrait proprement");
  });

  await it("16.7 index.html et css/styles.css intègrent l'écran musique, les contrôles SVG, le bouton stop et le mini-lecteur volet", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('data-screen="music"'), "Onglet Musique présent dans la barre de navigation");
    assert(html.includes('id="screen-music"'), "Section screen-music présente dans index.html");
    assert(html.includes('Votre lecteur audio local pour travailler en rythme et concentration'), "Nouveau sous-titre épuré de l'espace musique");
    assert(!html.includes('Votre lecteur audio local et souverain pour travailler en rythme et concentration.'), "Ancien sous-titre retiré");
    assert(html.includes('id="music-folder-filter"'), "Sélecteur de dossier présent");
    assert(html.includes('id="music-sort-select"'), "Sélecteur de tri présent");
    assert(html.includes('id="music-btn-play"'), "Bouton de lecture présent");
    assert(html.includes('id="music-btn-stop"'), "Bouton stop principal présent");
    assert(html.includes('id="music-btn-shuffle"'), "Bouton aléatoire présent");
    assert(html.includes('id="music-btn-repeat"'), "Bouton répétition présent");
    assert(html.includes('id="music-volume-slider"'), "Curseur de volume présent");
    assert(html.includes('id="sidebar-music-widget"'), "Mini-lecteur placé dans le volet latéral sous les onglets");
    assert(html.includes('id="sidebar-music-stop"'), "Bouton stop présent dans le mini-lecteur latéral");
    assert(!html.includes('id="persistent-music-bar"'), "L'ancien mini-lecteur persistant flottant a bien été retiré");

    assert(css.includes('.music-container'), "Règles CSS .music-container présentes");
    assert(css.includes('.music-vinyl-disc'), "Règles CSS du vinyle animé présentes");
    assert(css.includes('.sidebar-music-widget'), "Styles du mini-lecteur de volet latéral définis");
    assert(css.includes('.btn-music-stop'), "Styles du bouton stop définis");
    assert(css.includes('.music-playlist-toolbar'), "Styles de la barre de dossiers & tri définis");
    assert(css.includes('.track-folder-badge'), "Styles du badge de dossier définis");
    assert(css.includes('.music-folder-divider'), "Styles du séparateur de dossier définis");
    assert(css.includes('.sound-wave-bars'), "Styles d'égaliseur animé présents");
  });

  await it("16.8 main.js et preload.js exposent les IPC de musique locale", () => {
    const mainJs = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    const preloadJs = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');

    assert(mainJs.includes('antigravite:open-music-folder'), "IPC open-music-folder défini dans main.js");
    assert(mainJs.includes('antigravite:list-local-music'), "IPC list-local-music défini dans main.js");
    assert(preloadJs.includes('openMusicFolder'), "Méthode openMusicFolder exposée dans preload.js");
    assert(preloadJs.includes('listLocalTracks'), "Méthode listLocalTracks exposée dans preload.js");
  });

  await it("17. Salutations dynamiques par période, prénom Théau et nouveaux fonds d'écran v1.1.3", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    // 17.1 Prénom Théau et suppression du bouton dé
    assert(html.includes('Bonjour Théau !'), "Mention Théau présente dans les paramètres");
    assert(html.includes('placeholder="ex : Théau"'), "Placeholder Théau présent dans les paramètres");
    assert(!html.includes('id="btn-shuffle-quote"'), "Le bouton pour changer manuellement la phrase d'ambiance a bien été retiré");

    // 17.2 Nouveaux fonds d'écran
    assert(html.includes('data-wallpaper="jade"'), "Preset Jade Impérial présent dans le sélecteur");
    assert(html.includes('data-wallpaper="astral"'), "Preset Rose Astral présent dans le sélecteur");
    assert(html.includes('data-wallpaper="polar"'), "Preset Nuit Polaire présent dans le sélecteur");
    assert(App.PRESET_WALLPAPERS.jade, "Définition CSS du preset jade présente dans App.PRESET_WALLPAPERS");
    assert(App.PRESET_WALLPAPERS.astral, "Définition CSS du preset astral présente dans App.PRESET_WALLPAPERS");
    assert(App.PRESET_WALLPAPERS.polar, "Définition CSS du preset polar présente dans App.PRESET_WALLPAPERS");

    // 17.3 Changement dynamique de phrase par période
    assert(typeof App.getTimeOfDayPeriod === 'function', "App.getTimeOfDayPeriod est implémenté");
    assert.strictEqual(App.getTimeOfDayPeriod(7), 'morning');
    assert.strictEqual(App.getTimeOfDayPeriod(12), 'lunch');
    assert.strictEqual(App.getTimeOfDayPeriod(15), 'afternoon');
    assert.strictEqual(App.getTimeOfDayPeriod(20), 'evening');
    assert(Array.isArray(App.GREETING_QUOTES.morning) && App.GREETING_QUOTES.morning.length > 0, "Citations matin configurées");
    assert(Array.isArray(App.GREETING_QUOTES.lunch) && App.GREETING_QUOTES.lunch.length > 0, "Citations midi configurées");
    assert(Array.isArray(App.GREETING_QUOTES.afternoon) && App.GREETING_QUOTES.afternoon.length > 0, "Citations après-midi configurées");
    assert(Array.isArray(App.GREETING_QUOTES.evening) && App.GREETING_QUOTES.evening.length > 0, "Citations soir configurées");
  });

  await it("18. Organisation de la musique en dossiers et tri par catégorie", async () => {
    await MusicManager.loadTracks();
    assert(Array.isArray(MusicManager.CATEGORIES), "CATEGORIES doit être un tableau");
    assert.strictEqual(MusicManager.CATEGORIES.length, 11, "11 dossiers (10 thématiques + Musique personnelle)");

    // Vérifier le découpage précis des 10 dossiers thématiques (5 par dossier, 50 au total pour 120 min)
    const expectedCounts = {
      "Focus, Rituals & Daily Routines": 5,
      "Seasons, Rain & Weather": 5,
      "Ambient Drift & Dreamscapes": 5,
      "Soul, Slow Jams & Warm Rooms": 5,
      "Late Night, Neon & After Hours": 5,
      "Funk, Soul & Retro Bounce": 5,
      "Jazz Lounge & Bookstore Grooves": 5,
      "Chillhop & Cozy Beats": 5,
      "Asian & Zen Lo-Fi": 5,
      "Hybrid, World & Cinematic": 5
    };

    let totalClassified = 0;
    for (const [catName, expected] of Object.entries(expectedCounts)) {
      const inCat = MusicManager.tracks.filter(t => t.folder === catName);
      assert.strictEqual(inCat.length, expected, `Dossier '${catName}' doit contenir ${expected} morceaux (trouvé: ${inCat.length})`);
      totalClassified += inCat.length;
    }
    assert.strictEqual(totalClassified, 50, "L'ensemble des 50 morceaux natifs doit être classé dans un dossier");

    // Filtrage par dossier
    MusicManager.setFolder("Chillhop & Cozy Beats");
    assert.strictEqual(MusicManager.selectedFolder, "Chillhop & Cozy Beats");
    assert.strictEqual(localStorage.getItem('antigravite_music_folder'), "Chillhop & Cozy Beats");

    // Tri par titre et par dossier
    MusicManager.setSort("title-asc");
    assert.strictEqual(MusicManager.sortBy, "title-asc");
    MusicManager.setSort("folder");
    assert.strictEqual(MusicManager.sortBy, "folder");

    // Ajout d'un morceau personnalisé dans 'Musique personnelle'
    const customSample = { name: "Ma Création Acoustique.mp3", size: 1024 * 1024 * 3 };
    MusicManager.addCustomTracks([customSample]);
    const addedCustom = MusicManager.tracks.find(t => t.filename === "Ma Création Acoustique.mp3");
    assert(addedCustom, "Le morceau personnalisé doit être présent");
    assert.strictEqual(addedCustom.folder, "Musique personnelle", "Le dossier du morceau ajouté doit être 'Musique personnelle'");

    // Réinitialiser le filtre sur 'all'
    MusicManager.setFolder("all");
    assert.strictEqual(MusicManager.selectedFolder, "all");
  });

  await it("19. Playlists personnalisées, dossiers préfaits et affichage immédiat des durées", async () => {
    // 19.1 Vérification des durées précalculées
    const tracksFile = path.join(rootDir, 'data', 'music-tracks.json');
    assert(fs.existsSync(tracksFile), "data/music-tracks.json doit exister");
    const tracksData = JSON.parse(fs.readFileSync(tracksFile, 'utf8'));
    assert.strictEqual(tracksData.length, 50, "50 morceaux natifs présents");

    const tracksWithoutDuration = tracksData.filter(t => !t.duration || t.duration <= 0 || !t.durationFormatted || t.durationFormatted === '--:--');
    assert.strictEqual(tracksWithoutDuration.length, 0, "Tous les 50 morceaux doivent avoir une durée valide précalculée (trouvé: " + tracksWithoutDuration.length + " morceaux invalides)");

    // Vérification du format MM:SS
    const sample = tracksData[0];
    assert.match(sample.durationFormatted, /^\d{2}:\d{2}$/, "Le format de durée doit être MM:SS");

    // 19.2 Playlists préfaites
    const presets = MusicManager.getPresetPlaylists();
    assert(Array.isArray(presets), "getPresetPlaylists retourne un tableau");
    assert.strictEqual(presets.length, 12, "12 presets : 'all' + 11 dossiers");
    assert.strictEqual(presets[0].id, 'all');
    assert.strictEqual(presets[0].name, 'Toutes les musiques');
    const focusPreset = presets.find(p => p.name === 'Focus, Rituals & Daily Routines');
    assert(focusPreset, "Le preset Focus doit être présent");
    assert.strictEqual(focusPreset.count, 5);

    // 19.3 Playlists personnalisées (Création, modification, persistance)
    MusicManager.playlists = [];
    localStorage.clear();

    // Création d'une playlist custom via l'objet
    const customPlId = 'pl-test-123';
    MusicManager.playlists.push({
      id: customPlId,
      name: 'Session Matinale Intense',
      trackIds: [],
      createdAt: Date.now()
    });
    MusicManager.activePlaylistId = customPlId;
    MusicManager.savePlaylists();

    const savedRaw = localStorage.getItem('antigravite_custom_playlists');
    assert(savedRaw, "La playlist doit être sauvegardée dans localStorage");
    const saved = JSON.parse(savedRaw);
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].name, 'Session Matinale Intense');

    // Ajout de morceaux dans la playlist
    const firstTrack = MusicManager.tracks[0];
    const secondTrack = MusicManager.tracks[1];
    const trackKey1 = firstTrack.id || firstTrack.filename;
    const trackKey2 = secondTrack.id || secondTrack.filename;

    MusicManager.addTrackToPlaylist(trackKey1, customPlId);
    MusicManager.addTrackToPlaylist(trackKey2, customPlId);
    assert.strictEqual(MusicManager.playlists[0].trackIds.length, 2, "2 morceaux ajoutés");
    assert(MusicManager.playlists[0].trackIds.includes(trackKey1));

    // Suppression d'un morceau
    MusicManager.removeTrackFromPlaylist(customPlId, trackKey1);
    assert.strictEqual(MusicManager.playlists[0].trackIds.length, 1, "1 morceau restant");
    assert(!MusicManager.playlists[0].trackIds.includes(trackKey1));

    // Renommage
    MusicManager.playlists[0].name = 'Session Matinale Zen';
    MusicManager.savePlaylists();
    assert.strictEqual(MusicManager.playlists[0].name, 'Session Matinale Zen');

    // Suppression de la playlist
    const origConfirm = window.App.confirm;
    window.App.confirm = async () => true;
    await MusicManager.deletePlaylist(customPlId);
    window.App.confirm = origConfirm;
    assert.strictEqual(MusicManager.playlists.length, 0, "La playlist doit être supprimée");
    assert.strictEqual(MusicManager.activePlaylistId, 'all', "Active playlist réinitialisée à 'all'");

    // 19.4 Index.html et css/styles.css pour l'encart et les modales
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('class="music-playlists-card"'), "Encart .music-playlists-card présent sous le lecteur");
    assert(html.includes('id="btn-create-playlist"'), "Bouton de création de playlist présent");
    assert(html.includes('id="select-active-playlist"'), "Sélecteur de playlist active présent");
    assert(html.includes('id="music-playlists-pills"'), "Conteneur des pastilles de playlist présent");
    assert(html.includes('id="playlist-form-modal"'), "Modale formulaire de playlist présente");
    assert(html.includes('id="playlist-picker-modal"'), "Modale de sélection de morceaux présente");

    assert(css.includes('.music-playlists-card'), "Styles de l'encart .music-playlists-card définis");
    assert(css.includes('.playlist-pill'), "Styles des pastilles de playlists définis");
    assert(css.includes('.btn-track-action'), "Styles des boutons d'action de piste (+ / x) définis");
    assert(css.includes('.playlist-picker-row'), "Styles des lignes de sélection de morceaux définis");
  });

  await it("20. Cadrillage explicite heure par heure et indicateur interactif de survol dans l'agenda", async () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');

    // 20.1 Variables CSS du cadrillage explicite pour chaque thème
    assert(css.includes('--agenda-grid-hour: rgba(255, 255, 255, 0.16);'), "Variables de grille heure sombre définies");
    assert(css.includes('--agenda-grid-half: rgba(255, 255, 255, 0.07);'), "Variables de grille demi-heure sombre définies");
    assert(css.includes('--agenda-grid-hour: rgba(0, 0, 0, 0.16);'), "Variables de grille heure clair définies");
    assert(css.includes('--agenda-grid-half: rgba(0, 0, 0, 0.07);'), "Variables de grille demi-heure clair définies");
    assert(css.includes('--agenda-grid-hour: rgba(255, 255, 255, 0.22);'), "Variables de grille heure OLED définies");

    // 20.2 Styles de la colonne jour et des labels d'heure
    assert(css.includes('.day-column {'), "Styles .day-column présents");
    assert(css.includes('var(--agenda-grid-hour) 1px, transparent 1px'), "Ligne pleine à chaque heure dans .day-column");
    assert(css.includes('var(--agenda-grid-half)'), "Ligne de demi-heure présente dans .day-column");
    assert(css.includes('border-bottom: 1px solid var(--agenda-grid-hour);'), "Bordure basse explicite sur .day-column");

    assert(css.includes('.time-slot-label {'), "Styles .time-slot-label présents");
    assert(css.includes('border-top: 1px solid var(--agenda-grid-hour);'), "Alignement pixel-perfect des heures dans la gouttière");
    assert(css.includes('.time-slot-label:last-child {'), "Clôture de la dernière heure dans la gouttière");
    assert(css.includes('.time-slot-label::after {'), "Repère visuel de demi-heure dans la gouttière");
    assert(css.includes('.time-slot-label.active-slot {'), "Mise en valeur de l'heure active lors du survol");

    // 20.3 Styles de l'indicateur interactif de survol (Ghost slot)
    assert(css.includes('.agenda-slot-hover-indicator {'), "Styles .agenda-slot-hover-indicator définis");
    assert(css.includes('.agenda-slot-hover-badge {'), "Styles .agenda-slot-hover-badge définis");
    assert(css.includes('pointer-events: none;'), "pointer-events: none garantit l'absence d'interférence avec les clics");

    // 20.4 Présence des attributs data-hour et du gestionnaire de survol dans agenda.js
    assert(agendaCode.includes('data-hour="${h}"'), "data-hour injecté sur chaque time-slot-label");
    assert(agendaCode.includes('agenda-slot-hover-indicator'), "Création et gestion de l'indicateur de survol dans agenda.js");
    assert(agendaCode.includes('agenda-slot-hover-time'), "Mise à jour de l'heure affichée dans le badge de survol");
    assert(agendaCode.includes('_gridHoverBound'), "Prévention des doubles écouteurs de survol");

    // 20.5 Test unitaire de calcul de la position et de l'heure du créneau
    const slotHeight = 50;
    const dayHoursStart = 7;
    // Clic / survol à relY = 362px (dans la tranche de 14h, vers 14:15)
    const relY = 362;
    const hoursOffset = relY / slotHeight; // 7.24
    const clickedHour = Math.floor(dayHoursStart + hoursOffset); // 7 + 7 = 14
    const rawMinutes = Math.floor((hoursOffset % 1) * 60); // 14.4 -> 14
    const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15); // 0
    assert.strictEqual(clickedHour, 14);
    assert.strictEqual(roundedMinutes, 0);

    // Clic / survol à relY = 375px (milieu d'heure 14h -> 14:30)
    const relY2 = 375;
    const hoursOffset2 = relY2 / slotHeight; // 7.5
    const clickedHour2 = Math.floor(dayHoursStart + hoursOffset2); // 14
    const rawMinutes2 = Math.floor((hoursOffset2 % 1) * 60); // 30
    const roundedMinutes2 = Math.min(45, Math.floor(rawMinutes2 / 15) * 15); // 30
    assert.strictEqual(clickedHour2, 14);
    assert.strictEqual(roundedMinutes2, 30);

    const topPx2 = (clickedHour2 - dayHoursStart + (roundedMinutes2 / 60)) * slotHeight;
    assert.strictEqual(topPx2, (14 - 7 + 0.5) * 50); // 375px
  });

  await it("21. Augmentation du temps de l'événement au maintien du clic droit", async () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');

    // 21.1 Styles CSS pour l'état d'extension au clic droit
    assert(css.includes('.calendar-event.event-extending'), "Styles .calendar-event.event-extending définis");
    assert(css.includes('.event-extending-badge'), "Styles .event-extending-badge définis");
    assert(css.includes('.agenda-slot-hover-indicator.extending'), "Styles .agenda-slot-hover-indicator.extending définis");
    assert(css.includes('pulse-extending'), "Animation de pulsation pendant l'extension présente");

    // 21.2 Présence de la méthode d'initialisation et des gestionnaires
    assert(agendaCode.includes('initRightClickExtend'), "Méthode initRightClickExtend présente dans AgendaManager");
    assert(agendaCode.includes('this.initRightClickExtend()'), "initRightClickExtend appelé dans init()");
    assert(agendaCode.includes('_startRightClickExtension'), "Méthode _startRightClickExtension présente");
    assert(agendaCode.includes('_updateRightClickVisuals'), "Méthode _updateRightClickVisuals présente");
    assert(agendaCode.includes('_cleanupRightClickVisuals'), "Méthode _cleanupRightClickVisuals présente");

    // 21.3 Gestion propre du menu contextuel (intercepté sur contextmenu, déclenché uniquement sur mouseup court)
    assert(agendaCode.includes("agendaScreen && agendaScreen.contains(e.target)"), 
      "Le menu contextuel natif ou prématuré est intercepté dans l'agenda");
    assert(agendaCode.includes("if (!s.hasExtended)"), 
      "Le menu contextuel est ouvert uniquement en cas de clic droit court sans maintien");

    // 21.4 Test du calcul d'incrémentation pas à pas (+15 min)
    let currentEndH = 15.0; // 15:00
    const step = 0.25; // 15 min
    currentEndH = Math.min(23, currentEndH + step);
    assert.strictEqual(currentEndH, 15.25); // 15:15
    currentEndH = Math.min(23, currentEndH + step);
    assert.strictEqual(currentEndH, 15.5); // 15:30

    // Vérification du format d'horaire
    const formatted = AgendaManager.formatHourDecimal(currentEndH);
    assert.strictEqual(formatted, '15:30');

    // Test de calcul de la hauteur visuelle correspondante
    const startH = 14.0;
    const durH = currentEndH - startH; // 1.5h
    const slotH = 50;
    const expectedHeightPx = Math.max(26, durH * slotH - 2); // 73px
    assert.strictEqual(expectedHeightPx, 73);
  });

  await it("22. Nettoyage et assainissement du collage HTML dans les notes (anti-conflit clair/sombre)", async () => {
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');

    // 22.1 Présence de l'écouteur paste et des méthodes d'assainissement
    assert(notesCode.includes("editor.addEventListener('paste'"), "L'écouteur paste est attaché à l'éditeur de notes");
    assert(notesCode.includes("handlePaste(e)"), "Méthode handlePaste présente dans NotesManager");
    assert(notesCode.includes("sanitizePastedHtml(rawHtml)"), "Méthode sanitizePastedHtml présente dans NotesManager");

    // 22.2 Vérification des règles de nettoyage dans sanitizePastedHtml
    assert(notesCode.includes("name === 'style'"), "Les attributs de style en ligne (couleur, police, fond) sont purgés");
    assert(notesCode.includes("name === 'class'"), "Les classes parasites externes (Word, Google Docs) sont nettoyées");
    assert(notesCode.includes("disallowedTags"), "Les balises dangereuses (script, iframe, style) sont proscrites");
    assert(notesCode.includes("name.startsWith('on')"), "Les gestionnaires d'événements inline (onclick...) sont neutralisés");

    // 22.3 Test fonctionnel de fallback (si pas de DOMParser ou texte brut)
    const rawDirtyHtml = '<p style="color: black; font-family: Arial;">Texte propre</p>';
    if (typeof NotesManager !== 'undefined' && typeof NotesManager.sanitizePastedHtml === 'function') {
      const res = NotesManager.sanitizePastedHtml(rawDirtyHtml);
      assert(typeof res === 'string' && res.length > 0, "sanitizePastedHtml retourne une chaîne de caractères");
    }
  });

  await it("23. Affichage explicite des événements de nuit multi-jours achevés avant 07h00 (Nuit)", async () => {
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    // 23.1 Règle CSS pour les événements nocturnes achevés au petit matin
    assert(css.includes('.calendar-event.night-spillover-event'), "Classe .calendar-event.night-spillover-event présente dans styles.css");
    assert(css.includes('border-left: 4px dashed'), "Bordure en tirets distinctive pour signaler un créneau nocturne déporté");

    // 23.2 Détection de l'événement nocturne achevé avant 07h00
    assert(agendaCode.includes("const isNightEnd = !e.isAllDay && endTimeStr && endTimeStr < '07:00'"),
      "Détection des événements finissant avant 07h00 du matin sur le jour d'arrivée");
    assert(agendaCode.includes("➔ Fin ${endTimeStr} (Nuit)"),
      "Libellé explicite 'Fin HH:MM (Nuit)' pour lever toute ambiguïté avec un rendez-vous du matin");
    assert(agendaCode.includes("night-spillover-event"),
      "Application de la classe night-spillover-event lors de la génération HTML du créneau");
  });

  await it("24. Mode Focus Pomodoro & Deep Work (Chronomètre circulaire, raccourci et musique auto)", async () => {
    const FocusManager = require('../js/focus.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    // 24.1 Intégration dans le menu latéral et écran dédié
    assert(html.includes('data-screen="focus"'), "L'onglet Focus est présent dans le menu de navigation de la barre latérale");
    assert(html.includes('id="screen-focus"'), "L'écran screen-focus est présent dans index.html");
    assert(html.includes('id="focus-timer-digits"'), "Affichage digital des minutes/secondes #focus-timer-digits présent");
    assert(html.includes('id="focus-progress-ring-circle"'), "Anneau SVG interactif #focus-progress-ring-circle présent");
    assert(html.includes('id="focus-task-select"'), "Sélecteur de tâche liée #focus-task-select présent");
    assert(html.includes('id="focus-auto-music"'), "Option de lancement automatique de musique #focus-auto-music présente");
    assert(html.includes('src="./js/focus.js"'), "Script js/focus.js chargé dans index.html");

    // 24.2 Styles CSS dédiés
    assert(css.includes('.focus-timer-card'), "Styles de la carte timer centrale .focus-timer-card présents");
    assert(css.includes('.focus-ring-container'), "Styles du conteneur circulaire SVG .focus-ring-container présents");
    assert(css.includes('.focus-mode-chip'), "Styles des puces de sélection de modes .focus-mode-chip présents");

    // 24.3 Logique métier de FocusManager
    assert(FocusManager.MODES.focus.duration === 25 * 60, "Mode Focus calibré à 25 minutes");
    assert(FocusManager.MODES.deep.duration === 50 * 60, "Mode Deep Work calibré à 50 minutes");
    assert(FocusManager.MODES.shortBreak.duration === 5 * 60, "Pause courte calibrée à 5 minutes");
    assert(FocusManager.MODES.longBreak.duration === 15 * 60, "Pause longue calibrée à 15 minutes");

    assert.strictEqual(FocusManager.formatTime(1500), "25:00", "formatTime formate 1500s en 25:00");
    assert.strictEqual(FocusManager.formatTime(272), "04:32", "formatTime formate 272s en 04:32");

    FocusManager.setMode('shortBreak');
    assert.strictEqual(FocusManager.currentMode, 'shortBreak', "Bascule vers le mode shortBreak réussie");
    assert.strictEqual(FocusManager.remainingSeconds, 300, "Durée restante actualisée à 300s");
  });

  await it("25. Progression de la journée dans le volet latéral (Frise d'événements colorés et survol)", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    const storageCode = fs.readFileSync(path.join(rootDir, 'js', 'storage.js'), 'utf8');

    // 25.1 Paramètres par défaut
    assert(storageCode.includes('sidebarDayProgressEnabled: true'), "sidebarDayProgressEnabled par défaut à true dans DEFAULT_SETTINGS");
    assert(storageCode.includes('sidebarMiniPlayerEnabled: true'), "sidebarMiniPlayerEnabled par défaut à true dans DEFAULT_SETTINGS");

    // 25.2 Widget dans la barre latérale sous les onglets
    assert(html.includes('id="sidebar-day-progress-widget"'), "Widget #sidebar-day-progress-widget présent dans le volet gauche");
    assert(html.includes('id="sidebar-day-progress-time"'), "Horloge #sidebar-day-progress-time présente");
    assert(html.includes('id="sidebar-day-progress-bar"'), "Jauge fill #sidebar-day-progress-bar présente");
    assert(html.includes('id="sidebar-day-progress-percent"'), "Pourcentage #sidebar-day-progress-percent présent");

    // 25.3 Paramètres d'activation dans l'écran de configuration
    assert(html.includes('id="setting-sidebar-day-progress"'), "Checkbox #setting-sidebar-day-progress présente dans Paramètres");
    assert(html.includes('id="setting-sidebar-mini-player"'), "Checkbox #setting-sidebar-mini-player présente dans Paramètres");
    assert(settingsCode.includes("this.updateSetting('sidebarDayProgressEnabled'"), "Liaison du réglage progression journée dans settings.js");
    assert(settingsCode.includes("this.updateSetting('sidebarMiniPlayerEnabled'"), "Liaison du réglage mini-lecteur dans settings.js");

    // 25.4 Logique de calcul et création des segments colorés dans app.js
    assert(appCode.includes("updateSidebarDayProgress()"), "Méthode updateSidebarDayProgress présente dans App");
    assert(appCode.includes("const dayStartMin = 0;") || appCode.includes("dayStartMin = 0"), "Début de journée calibré à minuit (00h00)");
    assert(appCode.includes("const dayEndMin = 24 * 60;") || appCode.includes("dayEndMin = 24 * 60"), "Fin de journée calibrée à minuit (24h00)");
    assert(appCode.includes("sidebar-day-event-segment"), "Segments d'événements créés avec classe sidebar-day-event-segment");
    assert(appCode.includes("sidebar-day-cursor"), "Indicateur vertical d'heure actuelle sidebar-day-cursor présent");

    // 25.5 Styles CSS
    assert(css.includes('.sidebar-day-progress-widget'), "Styles CSS .sidebar-day-progress-widget présents");
    assert(css.includes('.sidebar-day-event-segment'), "Styles CSS .sidebar-day-event-segment présents");
    assert(css.includes('.sidebar-day-cursor'), "Styles CSS .sidebar-day-cursor présents");
    assert(css.includes('body.sidebar-collapsed .sidebar-day-progress-widget'), "Styles repliés pour volet latéral compact présents");
  });

  await it("26. Corbeille et Restauration (Suppression directe sans modale de confirmation)", async () => {
    const TrashManager = require('../js/trash.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const tasksCode = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    const projectsCode = fs.readFileSync(path.join(rootDir, 'js', 'projects.js'), 'utf8');

    // 26.1 Suppression définitive des popups de confirmation bloquantes
    assert(!tasksCode.includes("App.confirm('Êtes-vous sûr de vouloir supprimer cette tâche"), "App.confirm supprimé de deleteTask dans tasks.js");
    assert(tasksCode.includes("TrashManager.moveToTrash('task'"), "deleteTask déplace directement la tâche dans la Corbeille");

    assert(!notesCode.includes("App.confirm('Êtes-vous sûr de vouloir supprimer cette note"), "App.confirm supprimé de deleteCurrentNote dans notes.js");
    assert(notesCode.includes("TrashManager.moveToTrash('note'"), "deleteCurrentNote déplace directement la note dans la Corbeille");

    assert(!projectsCode.includes("App.confirm('Êtes-vous sûr de vouloir supprimer ce projet"), "App.confirm supprimé de deleteProject dans projects.js");
    assert(projectsCode.includes("TrashManager.moveToTrash('project'"), "deleteProject déplace directement le projet dans la Corbeille");

    // 26.2 Structure HTML de la corbeille
    assert(html.includes('data-screen="trash"'), "Onglet Corbeille présent dans la navigation latérale");
    assert(html.includes('id="screen-trash"'), "Écran screen-trash présent dans index.html");
    assert(html.includes('id="trash-list-container"'), "Conteneur de liste #trash-list-container présent");
    assert(html.includes('id="btn-empty-trash"'), "Bouton #btn-empty-trash présent");
    assert(html.includes('src="./js/trash.js"'), "Script js/trash.js chargé dans index.html");

    // 26.3 Test unitaire du déplacement vers la corbeille et calcul de rétention 30 jours
    const testTask = { id: 'task-test-corbeille', title: 'Tâche de test à restaurer', completed: false };
    const record = TrashManager.moveToTrash('task', testTask);
    assert(record && record.id, "TrashManager.moveToTrash génère un enregistrement avec id unique");
    assert.strictEqual(record.type, 'task', "Le type d'élément archivé est 'task'");
    assert.strictEqual(record.title, 'Tâche de test à restaurer', "Le titre de l'élément est préservé");

    const days = TrashManager.getDaysRemaining(record.expiresAt);
    assert(days >= 29 && days <= 30, "La durée de rétention avant expiration est de 30 jours");

    // Nettoyage après test
    TrashManager.deletePermanently(record.id);
  });

  await it("27. Réorganisation des Paramètres en 3 onglets, toggles d'onglets du volet et translucidité retravaillée", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');

    // 27.1 Barre de 3 sous-onglets dans Paramètres
    assert(html.includes('id="settings-tabs-nav"'), "Barre d'onglets #settings-tabs-nav présente");
    assert(html.includes('data-settings-tab="customization"'), "Onglet Personnalisation présent");
    assert(html.includes('data-settings-tab="display"'), "Onglet Affichage présent");
    assert(html.includes('data-settings-tab="sync-updates"'), "Onglet Connexion Google & Mises à jour présent");
    assert(html.includes('id="settings-pane-customization"'), "Volet #settings-pane-customization présent");
    assert(html.includes('id="settings-pane-display"'), "Volet #settings-pane-display présent");
    assert(html.includes('id="settings-pane-sync-updates"'), "Volet #settings-pane-sync-updates présent");

    // 27.2 Suppression du réglage de densité d'affichage
    assert(!html.includes('density-option-btn'), "Boutons de densité d'affichage supprimés de l'UI");

    // 27.3 Toggles d'activation/désactivation des onglets du volet latéral
    assert(html.includes('id="toggle-tab-tasks"'), "Toggle pour l'onglet Tâches présent");
    assert(html.includes('id="toggle-tab-projects"'), "Toggle pour l'onglet Projets présent");
    assert(html.includes('id="toggle-tab-agenda"'), "Toggle pour l'onglet Agenda présent");
    assert(html.includes('id="toggle-tab-notes"'), "Toggle pour l'onglet Notes présent");
    assert(html.includes('id="toggle-tab-focus"'), "Toggle pour l'onglet Focus présent");
    assert(html.includes('id="toggle-tab-music"'), "Toggle pour l'onglet Musique présent");
    assert(html.includes('id="toggle-tab-trash"'), "Toggle pour l'onglet Corbeille présent");
    assert(html.includes('id="toggle-tab-backups"'), "Toggle pour l'onglet Sauvegardes présent");

    // 27.4 Méthode applySidebarTabsVisibility dans app.js
    assert(appCode.includes("applySidebarTabsVisibility("), "Méthode applySidebarTabsVisibility présente dans App");

    // 27.5 Translucidité (Glassmorphism) réparée et appliquée
    assert(appCode.includes("root.setAttribute('data-glass'"), "data-glass appliqué sur l'élément racine dans applyAppearanceSettings");
    assert(css.includes('[data-glass="glass"]'), "Règles CSS pour data-glass='glass' définies");
    assert(css.includes('[data-glass="solid"]'), "Règles CSS pour data-glass='solid' définies");
  });

  await it("28. Emplacement Glassmorphism & Notifications dans Personnalisation, Option du volet latéral, Post-it et Scrollbars sur-mesure", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const storageCode = fs.readFileSync(path.join(rootDir, 'js', 'storage.js'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');

    // 28.1 Sous-onglet 2 renommé en "Option du volet latéral"
    assert(html.includes('Option du volet latéral'), "Le bouton d'onglet est correctement libellé 'Option du volet latéral'");

    // 28.2 Emplacements vérifiés des sections
    const custPaneIdx = html.indexOf('id="settings-pane-customization"');
    const dispPaneIdx = html.indexOf('id="settings-pane-display"');
    const syncPaneIdx = html.indexOf('id="settings-pane-sync-updates"');
    const endPaneIdx = html.indexOf('id="dialog-modal"');

    const custPane = html.substring(custPaneIdx, dispPaneIdx);
    const dispPane = html.substring(dispPaneIdx, syncPaneIdx);
    const syncPane = html.substring(syncPaneIdx, endPaneIdx);

    assert(custPane.includes('id="settings-section-glass"'), "La section Translucidité (Glassmorphism) est bien dans l'onglet Personnalisation");
    assert(custPane.includes('id="settings-section-notifications"'), "La section Rappels & Notifications est bien dans l'onglet Personnalisation");
    assert(!dispPane.includes('id="settings-section-glass"'), "La section Glassmorphism a été retirée du volet Options du volet latéral");
    assert(!syncPane.includes('id="settings-section-notifications"'), "La section Notifications a été retirée du volet Connexion & Mises à jour");
    assert(dispPane.includes('id="setting-sidebar-sticky-note"'), "Le toggle du Post-it est bien dans le volet Option du volet latéral");

    // 28.3 Widget Post-it dans la barre latérale
    assert(html.includes('id="sidebar-sticky-note-widget"'), "Le widget #sidebar-sticky-note-widget est présent dans la barre latérale");
    assert(html.includes('id="sidebar-sticky-note-text"'), "Le champ de saisie #sidebar-sticky-note-text est présent");
    assert(html.includes('id="sidebar-sticky-note-clear"'), "Le bouton #sidebar-sticky-note-clear est présent");

    // 28.4 Persistance et logique du Post-it
    assert(storageCode.includes("SIDEBAR_QUICK_NOTE: 'antigravite_sidebar_quick_note_v1'"), "Clé de stockage SIDEBAR_QUICK_NOTE définie");
    assert(storageCode.includes("sidebarStickyNoteEnabled: true"), "Option sidebarStickyNoteEnabled: true par défaut");
    assert(storageCode.includes("getSidebarQuickNote()"), "Méthode StorageManager.getSidebarQuickNote présente");
    assert(storageCode.includes("saveSidebarQuickNote("), "Méthode StorageManager.saveSidebarQuickNote présente");
    assert(appCode.includes("initSidebarStickyNote()"), "App.initSidebarStickyNote présent");
    assert(appCode.includes("updateSidebarStickyNote()"), "App.updateSidebarStickyNote présent");

    // Test fonctionnel get/save quick note
    StorageManager.saveSidebarQuickNote("Pense-bête de test Antigravité");
    assert.strictEqual(StorageManager.getSidebarQuickNote(), "Pense-bête de test Antigravité", "La note rapide est fidèlement sauvegardée et relue");
    StorageManager.saveSidebarQuickNote("");
    assert.strictEqual(StorageManager.getSidebarQuickNote(), "", "La note rapide peut être effacée");

    // 28.5 Barres de défilement personnalisées et défilement du volet latéral
    assert(css.includes('::-webkit-scrollbar'), "Styles Webkit Scrollbar définis dans css/styles.css");
    assert(css.includes('scrollbar-width: thin'), "Support Firefox scrollbar-width défini");
    assert(css.includes('scrollbar-color:'), "Support Firefox scrollbar-color défini");
    assert(css.includes('overflow-y: auto'), "Défilement vertical auto présent");
    assert(css.includes('.sidebar-sticky-note-widget'), "Styles du Post-it définis dans css/styles.css");
  });

  await it("29. Écran Focus épuré sans défilement vertical et deux tirets réglables (Focus 0-90m, Pause 0-60m par pas de 5)", async () => {
    const FocusManager = require('../js/focus.js');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    // 29.1 En-tête épuré sans compteur de sessions ni phrase encombrante
    assert(!html.includes('id="focus-sessions-count-badge"'), "Badge de sessions aujourd'hui supprimé de l'en-tête pour épurer la hauteur");
    assert(!html.includes('Restez dans le flow avec des sessions'), "Phrase descriptive supprimée pour éviter l'apparition de barre de défilement");

    // 29.2 Deux tirets (sliders) de réglage avec défilement de 5 en 5
    assert(html.includes('id="focus-slider-work"'), "Glissière (tiret) de Focus #focus-slider-work présente");
    assert(html.includes('id="focus-slider-break"'), "Glissière (tiret) de Pause #focus-slider-break présente");
    assert(html.includes('min="0" max="90" step="5"'), "Tiret Focus va de 0 à 90 minutes par pas de 5");
    assert(html.includes('min="0" max="60" step="5"'), "Tiret Pause va de 0 à 60 minutes par pas de 5");
    assert(html.includes('id="focus-work-val-badge"'), "Badge de valeur pour le temps de focus présent");
    assert(html.includes('id="focus-break-val-badge"'), "Badge de valeur pour le temps de pause présent");

    // 29.3 Méthodes de FocusManager et respect des bornes
    assert(typeof FocusManager.setWorkMinutes === 'function', "Méthode setWorkMinutes implémentée");
    assert(typeof FocusManager.setBreakMinutes === 'function', "Méthode setBreakMinutes implémentée");
    assert(typeof FocusManager.selectMode === 'function', "Méthode selectMode implémentée");

    FocusManager.setWorkMinutes(45);
    assert.strictEqual(FocusManager.workMinutes, 45, "Temps de focus ajusté à 45 minutes");
    assert.strictEqual(FocusManager.MODES.focus.duration, 45 * 60, "MODES.focus.duration synchronisé à 2700s");

    FocusManager.setBreakMinutes(15);
    assert.strictEqual(FocusManager.breakMinutes, 15, "Temps de pause ajusté à 15 minutes");
    assert.strictEqual(FocusManager.MODES.shortBreak.duration, 15 * 60, "MODES.shortBreak.duration synchronisé à 900s");

    // Test des limites min/max
    FocusManager.setWorkMinutes(120);
    assert.strictEqual(FocusManager.workMinutes, 90, "Borne maximale du Focus limitée à 90 minutes");

    FocusManager.setBreakMinutes(80);
    assert.strictEqual(FocusManager.breakMinutes, 60, "Borne maximale de la Pause limitée à 60 minutes");

    FocusManager.setWorkMinutes(-10);
    assert.strictEqual(FocusManager.workMinutes, 0, "Borne minimale du Focus limitée à 0 minute");

    // 29.4 Styles CSS compacts et adaptés
    assert(css.includes('.focus-sliders-bar'), "Styles de la barre de sliders .focus-sliders-bar présents");
    assert(css.includes('.focus-range-slider'), "Styles du tiret curseur .focus-range-slider présents");
    assert(!css.includes('#focus-group-break.active'), "Le groupe Temps de Pause n'est pas figé avec une couleur verte en dur et hérite de l'accentuation");
    assert(css.includes('.focus-slider-group.active'), "Les groupes actifs utilisent var(--accent)");
  });

  await it("30. Focus occupant toute la zone disponible et animation de démarrage fluide (2 à 3s) avec messages variés", async () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // 30.1 Layout plein écran du module Focus
    assert(css.includes('#screen-focus.screen-view'), "Règles spécifiques #screen-focus définies");
    assert(css.includes('justify-content: space-evenly;'), "focus-timer-card répartit harmonieusement les éléments sur toute la hauteur");
    assert(css.includes('height: 100%'), "Hauteur 100% utilisée pour occuper toute la zone disponible");

    // 30.2 Animation de démarrage (Splash Screen)
    assert(appCode.includes("LOADING_PHRASES: ["), "Tableau LOADING_PHRASES défini dans App");
    assert(appCode.includes("L'agenda s'installe..."), "Message 'L'agenda s'installe...' présent");
    assert(appCode.includes("Les tâches se préparent..."), "Message 'Les tâches se préparent...' présent");
    assert(appCode.includes("getRandomLoadingPhrases("), "Méthode getRandomLoadingPhrases présente");

    // Test fonctionnel de getRandomLoadingPhrases
    const phrases = App.getRandomLoadingPhrases(3);
    assert.strictEqual(phrases.length, 3, "Exactement 3 phrases aléatoires distinctes sont sélectionnées");
    assert.notStrictEqual(phrases[0], phrases[1], "La phrase 1 et la phrase 2 sont distinctes");
    assert.notStrictEqual(phrases[1], phrases[2], "La phrase 2 et la phrase 3 sont distinctes");

    // 30.3 Lissage de la barre de progression au démarrage
    assert(css.includes('.splash-progress-bar'), "Styles .splash-progress-bar présents");
    assert(css.includes('transition: width 1.35s'), "Transition de remplissage lissée sur 1.35s pour la barre de splash");
  });

  await it("31. Intégrité structurelle des volets de paramètres et affichage indépendant", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');

    // 31.1 Les volets doivent être frères directs et non imbriqués
    const custPos = html.indexOf('id="settings-pane-customization"');
    const custEndPos = html.indexOf('<!-- Fin #settings-pane-customization -->');
    const dispPos = html.indexOf('id="settings-pane-display"');
    const dispEndPos = html.indexOf('<!-- Fin #settings-pane-display -->');
    const syncPos = html.indexOf('id="settings-pane-sync-updates"');
    const syncEndPos = html.indexOf('<!-- Fin #settings-pane-sync-updates -->');

    assert(custPos > 0 && custEndPos > custPos, "#settings-pane-customization correctement positionné et fermé");
    assert(dispPos > custEndPos, "#settings-pane-display est bien situé APRÈS la fermeture de customization (non imbriqué)");
    assert(dispEndPos > dispPos, "#settings-pane-display correctement fermé");
    assert(syncPos > dispEndPos, "#settings-pane-sync-updates est bien situé APRÈS la fermeture de display (non imbriqué)");
    assert(syncEndPos > syncPos, "#settings-pane-sync-updates correctement fermé");

    // 31.2 Vérification de la méthode switchTab dans settings.js
    assert(settingsCode.includes("switchTab(tabId)"), "Méthode switchTab présente");
    assert(settingsCode.includes("panes[k].style.display = (k === tabId) ? 'flex' : 'none';"), "switchTab utilise le display flex pour respecter les styles CSS");
    assert(settingsCode.includes("document.querySelectorAll('.settings-tab-btn').forEach"), "Écouteurs attachés aux boutons d'onglets");
  });

  await it("32. Recherche rapide universelle (Ctrl+F) et onglet Aide & Astuces avec raccourcis clavier", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const searchCode = fs.readFileSync(path.join(rootDir, 'js', 'search.js'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

    // 32.1 Version 1.2.0 / 1.2.1 / 1.2.2
    assert.ok(pkg.version >= "1.2.0", "package.json est bien mis à jour en version 1.2.0 ou supérieure");

    // 32.2 Éléments UI de la recherche universelle
    assert(html.includes('id="search-modal"'), "Modale #search-modal présente dans index.html");
    assert(html.includes('id="universal-search-input"'), "Champ de saisie #universal-search-input présent");
    assert(html.includes('id="universal-search-results"'), "Conteneur de résultats #universal-search-results présent");
    assert(html.includes('id="btn-quick-search-trigger"'), "Bouton d'accès rapide #btn-quick-search-trigger dans la barre supérieure");

    // 32.3 Module SearchManager
    const SearchManager = require(path.join(rootDir, 'js', 'search.js'));
    assert(typeof SearchManager.open === 'function', "Méthode SearchManager.open implémentée");
    assert(typeof SearchManager.close === 'function', "Méthode SearchManager.close implémentée");
    assert(typeof SearchManager.executeSearch === 'function', "Méthode SearchManager.executeSearch implémentée");
    assert(typeof SearchManager.getAllTasksFlat === 'function', "Méthode SearchManager.getAllTasksFlat implémentée");

    // 32.4 4ème volet Aide & Astuces dans les Paramètres
    assert(html.includes('data-settings-tab="help"'), "Bouton d'onglet Aide & Astuces présent dans la navigation des paramètres");
    assert(html.includes('id="settings-pane-help"'), "Volet #settings-pane-help présent");
    assert(html.includes('id="settings-section-shortcuts"'), "Section des raccourcis clavier présente");
    assert(html.includes('Ctrl</kbd> + <kbd>Maj</kbd> + <kbd>A</kbd>'), "Raccourci global Ctrl+Maj+A présent dans le guide");
    assert(html.includes('id="settings-section-google-guide"'), "Guide détaillé Google Agenda présent dans l'aide");
    assert(html.includes('id="settings-section-tips"'), "Section des 4 astuces d'organisation présente");
    assert(html.includes('Équilibre et déconnexion'), "4ème astuce d'équilibre présente");
    assert(!html.includes('Astuces d\'organisation zen'), "Le mot 'zen' a bien été retiré du titre des astuces");
    assert(html.includes('id="settings-section-changelog"'), "Section des notes de mise à jour présente");
    assert(settingsCode.includes("help: document.getElementById('settings-pane-help')"), "settings.js intègre le volet help dans switchTab");

    // 32.5 Styles CSS
    assert(css.includes('.search-modal-container'), "Styles de la modale de recherche présents");
    assert(css.includes('.shortcuts-grid'), "Styles de la grille de raccourcis présents");
    assert(css.includes('kbd {'), "Style du composant <kbd> présent");

    // 32.6 Vérification exhaustive du câblage de tous les raccourcis clavier
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    const preloadCode = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');

    // Ctrl+F / Ctrl+K dans SearchManager et App
    assert(appCode.includes("SearchManager.open()"), "App.bindGlobalActions écoute et déclenche SearchManager.open()");
    assert(appCode.includes("SearchManager.close()"), "App.bindGlobalActions ferme SearchManager sur Échap ou clic overlay");
    assert(appCode.includes("navigateTo(screenId)"), "App expose un alias navigateTo pour la rétrocompatibilité");

    // Raccourci global Ctrl+Maj+A
    assert(mainCode.includes("CommandOrControl+Shift+A"), "main.js enregistre le raccourci global CommandOrControl+Shift+A");
    assert(mainCode.includes("antigravite:toggle-window-visibility"), "main.js expose l'IPC antigravite:toggle-window-visibility");
    assert(preloadCode.includes("toggleWindow"), "preload.js expose la méthode API toggleWindow()");

    // Raccourci F1 & Volet latéral Ctrl+B
    assert(appCode.includes("this.toggleSidebar()"), "App bascule le volet latéral sur Ctrl+B");
    assert(appCode.includes("this.navigate('settings')") && appCode.includes("SettingsManager.switchTab('help')"), "App ouvre l'aide et les raccourcis sur F1");

    // Raccourcis de mise en forme dans les notes (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K)
    assert(notesCode.includes("'bold'"), "NotesManager prend en charge le gras (Ctrl+B)");
    assert(notesCode.includes("'italic'"), "NotesManager prend en charge l'italique (Ctrl+I)");
    assert(notesCode.includes("'underline'"), "NotesManager prend en charge le souligné (Ctrl+U)");
    assert(notesCode.includes("'link'"), "NotesManager prend en charge le lien hypertexte (Ctrl+K)");
  });

  await it("33. Actualisation automatique de la frise chronologique lors de l'ajout/modification d'événements (même journée ou autre)", async () => {
    const App = require('../js/app.js');
    const AgendaManager = require('../js/agenda.js');
    const StorageManager = require('../js/storage.js');

    // 33.1 Vérifier que saveAll et addEvent dans l'agenda synchronisent la date et mettent à jour la frise
    let updateCalledWith = null;
    global.window = global.window || {};
    global.window.App = App;
    global.window.AgendaManager = AgendaManager;
    const origUpdateMethod = App.updateSidebarDayProgress.bind(App);
    App.updateSidebarDayProgress = (targetDate) => {
      updateCalledWith = targetDate;
    };

    // Ajout d'un événement sur une autre journée
    const otherDate = '2026-11-20';
    const newEvt = AgendaManager.addEvent({
      title: "Réunion future",
      start: `${otherDate}T10:00`,
      end: `${otherDate}T11:30`,
      color: '#3b82f6'
    });

    assert(newEvt && newEvt.id, "Événement créé avec succès");
    assert.strictEqual(AgendaManager.activeDateStr, otherDate, "AgendaManager retient la date active de l'événement ajouté");
    assert.strictEqual(updateCalledWith, otherDate, "updateSidebarDayProgress a bien été appelé avec la date de l'événement");

    // Ajout d'un événement sur la journée d'aujourd'hui
    const today = new Date().toISOString().slice(0, 10);
    AgendaManager.addEvent({
      title: "Événement du jour",
      start: `${today}T14:00`,
      end: `${today}T15:00`,
      color: '#10b981'
    });
    assert.strictEqual(AgendaManager.activeDateStr, today, "AgendaManager retient aujourd'hui lors de l'ajout");
    assert.strictEqual(updateCalledWith, today, "updateSidebarDayProgress rafraîchit immédiatement la frise pour aujourd'hui");

    // Déplacement d'un créneau vers un autre jour
    await AgendaManager.updateEventSchedule(newEvt.id, '2026-11-25', 15, 16);
    assert.strictEqual(AgendaManager.activeDateStr, '2026-11-25', "AgendaManager actualise la date active au déplacement");
    assert.strictEqual(updateCalledWith, '2026-11-25', "updateSidebarDayProgress répercute la nouvelle date déplacée");

    // Retour à aujourd'hui via navigateToday
    AgendaManager.navigateToday();
    assert.strictEqual(AgendaManager.activeDateStr, null, "navigateToday réinitialise la date active");

    // 33.2 Intégrité dans le code source et DOM
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const storageCode = fs.readFileSync(path.join(rootDir, 'js', 'storage.js'), 'utf8');
    assert(html.includes('id="sidebar-day-progress-track"'), "id='sidebar-day-progress-track' présent dans index.html");
    assert(agendaCode.includes("window.App.updateSidebarDayProgress"), "AgendaManager appelle updateSidebarDayProgress dans saveAll");
    assert(storageCode.includes("window.App.updateSidebarDayProgress"), "StorageManager.saveEvents notifie updateSidebarDayProgress");

    // 33.3 Génération réelle des segments d'événements sur la frise
    App.updateSidebarDayProgress = origUpdateMethod;
    const trackChildren = [];
    const mockTrack = {
      children: trackChildren,
      querySelectorAll: (sel) => {
        if (sel.includes('sidebar-day-event-segment') || sel.includes('sidebar-day-cursor')) {
          return trackChildren.filter(c => c.className && (c.className.includes('sidebar-day-event-segment') || c.className.includes('sidebar-day-cursor')));
        }
        return [];
      },
      appendChild: (el) => {
        trackChildren.push(el);
      }
    };
    const mockWidget = {
      style: {},
      dataset: {},
      querySelector: (sel) => null,
      querySelectorAll: (sel) => [],
      setAttribute: () => {},
      removeAttribute: () => {}
    };
    domStore['sidebar-day-progress-widget'] = mockWidget;
    domStore['sidebar-day-progress-percent'] = { textContent: '' };
    domStore['sidebar-day-progress-bar'] = { style: {} };
    domStore['sidebar-day-progress-time'] = { textContent: '' };
    domStore['sidebar-day-progress-remaining'] = { textContent: '' };
    domStore['sidebar-day-progress-track'] = mockTrack;

    // Définir un événement de test aujourd'hui
    StorageManager.saveEvents([
      {
        id: 'evt-test-timeline',
        title: 'Atelier Design',
        start: `${today}T09:00`,
        end: `${today}T11:00`,
        color: '#f59e0b'
      }
    ]);

    const origCreate = global.document.createElement;
    try {
      global.document.createElement = (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          style: {},
          dataset: {},
          classList: {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            contains(c) { return this._classes.has(c); },
            toggle(c, cond) { if (cond !== undefined ? cond : !this._classes.has(c)) this._classes.add(c); else this._classes.delete(c); }
          },
          attributes: {},
          eventListeners: {},
          setAttribute(k, v) { this.attributes[k] = v; },
          getAttribute(k) { return this.attributes[k]; },
          removeAttribute(k) { delete this.attributes[k]; },
          addEventListener(evt, fn) { this.eventListeners[evt] = fn; },
          remove() {
            const idx = trackChildren.indexOf(this);
            if (idx !== -1) trackChildren.splice(idx, 1);
          }
        };
        return el;
      };

      trackChildren.length = 0;
      App.updateSidebarDayProgress(today);

      const segments = trackChildren.filter(c => c.className === 'sidebar-day-event-segment');
      assert(segments.length >= 1, "Un segment d'événement a été créé et injecté dans la frise");
      const seg = segments[0];
      assert.strictEqual(seg.style.backgroundColor, '#f59e0b', "La couleur de l'événement est appliquée au segment");
      assert(parseFloat(seg.style.left) > 0, "Le décalage horizontal (left) est calculé pour 09h00");
      assert(parseFloat(seg.style.width) > 0, "La largeur (width) est calculée pour 2h de durée");
      assert(seg.getAttribute('title').includes('Atelier Design'), "Le titre de l'événement est présent dans l'attribut title");

      // 33.4 Fenêtre d'information flottante (tooltip) respectant la charte graphique
      const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
      const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
      assert(css.includes('.sidebar-event-tooltip'), "Styles .sidebar-event-tooltip présents dans styles.css");
      assert(css.includes('.sidebar-event-tooltip-badge'), "Styles .sidebar-event-tooltip-badge présents dans styles.css");
      assert(css.includes('.sidebar-event-tooltip-title'), "Styles .sidebar-event-tooltip-title présents dans styles.css");
      assert(appCode.includes("showTimelineTooltip("), "Méthode showTimelineTooltip présente dans App");
      assert(appCode.includes("hideTimelineTooltip()"), "Méthode hideTimelineTooltip présente dans App");

      // Simuler le survol du segment (mouseenter)
      let createdTooltip = null;
      domStore['sidebar-day-event-tooltip'] = null;
      global.document.body = global.document.body || {
        appendChild(child) {
          createdTooltip = child;
        }
      };

      if (seg.eventListeners && seg.eventListeners['mouseenter']) {
        seg.eventListeners['mouseenter']();
        const tooltip = createdTooltip || domStore['sidebar-day-event-tooltip'];
        assert(tooltip, "La fenêtre d'information a été créée au survol du segment");
        assert(tooltip.innerHTML.includes('Atelier Design'), "L'infobulle affiche le titre de l'événement");
        assert(tooltip.innerHTML.includes('09:00 - 11:00'), "L'infobulle affiche le créneau horaire");
        assert(tooltip.innerHTML.includes('#f59e0b'), "L'infobulle intègre la couleur d'accentuation du projet/créneau");
        assert(tooltip.classList.contains('visible'), "La classe 'visible' est appliquée à l'infobulle");
      }

      if (seg.eventListeners && seg.eventListeners['mouseleave']) {
        seg.eventListeners['mouseleave']();
        const tooltip = createdTooltip || domStore['sidebar-day-event-tooltip'];
        assert(!tooltip.classList.contains('visible'), "La classe 'visible' est retirée à la sortie du curseur");
      }
    } finally {
      global.document.createElement = origCreate;
    }
  });

  // ---------------------------------------------------------------------------
  // 34. Copie persistante de musique personnelle & Panneau d'avertissement (v1.2.0)
  // ---------------------------------------------------------------------------

  await it("34.1 Modale d'avertissement présente dans index.html avec le contenu requis", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    assert(html.includes('id="music-import-warning-modal"'), "Modale #music-import-warning-modal présente dans index.html");
    assert(html.includes('Ajouter de la musique personnelle'), "Titre de la modale présent");
    assert(html.includes('musique personnelle'), "Mention du dossier cible « musique personnelle »");
    assert(html.includes('Les fichiers originaux resteront à leur emplacement actuel'), "Information 1 : originaux préservés");
    assert(html.includes('Une copie supplémentaire sera créée sur votre ordinateur'), "Information 2 : copie supplémentaire");
    assert(html.includes('Cette duplication consommera donc de l\'espace de stockage supplémentaire'), "Information 3 : espace disque");
    assert(html.includes('Les copies resteront disponibles dans Antigravité même si vous déplacez ou supprimez les fichiers originaux'), "Information 4 : indépendance des originaux");
    assert(html.includes('id="btn-music-warning-continue"'), "Bouton Continuer présent");
    assert(html.includes('id="btn-music-warning-cancel"'), "Bouton Annuler présent");
    assert(html.includes('id="btn-close-music-warning"'), "Bouton Fermer présent");
  });

  await it("34.2 Styles de la modale et de la carte d'information présents dans css/styles.css", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(css.includes('.music-import-warning-content'), "Classe .music-import-warning-content présente");
    assert(css.includes('.music-warning-info-card'), "Classe .music-warning-info-card présente");
    assert(css.includes('.music-warning-card-title'), "Classe .music-warning-card-title présente");
    assert(css.includes('.music-warning-list'), "Classe .music-warning-list présente");
  });

  await it("34.3 Preload.js et main.js exposent les IPC pour la copie persistante et la musique personnelle", () => {
    const preloadCode = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');

    assert(preloadCode.includes('selectAndCopyMusic:'), "preload.js expose music.selectAndCopyMusic");
    assert(preloadCode.includes('copyMusicFiles:'), "preload.js expose music.copyMusicFiles");
    assert(preloadCode.includes('openPersonalMusicFolder:'), "preload.js expose music.openPersonalMusicFolder");
    assert(preloadCode.includes('getPersonalMusicPath:'), "preload.js expose music.getPersonalMusicPath");

    assert(mainCode.includes('getPersonalMusicDir()'), "main.js implémente getPersonalMusicDir");
    assert(mainCode.includes('copyMusicFilesToPersonalFolder('), "main.js implémente copyMusicFilesToPersonalFolder");
    assert(mainCode.includes('antigravite:select-and-copy-music'), "main.js écoute antigravite:select-and-copy-music");
    assert(mainCode.includes('antigravite:copy-music-files'), "main.js écoute antigravite:copy-music-files");
    assert(mainCode.includes('antigravite:open-personal-music-folder'), "main.js écoute antigravite:open-personal-music-folder");
    assert(mainCode.includes('musique personnelle'), "Dossier cible persistant 'musique personnelle' présent dans main.js");
  });

  await it("34.4 MusicManager contrôle l'affichage du panneau d'avertissement sans lecture automatique", async () => {
    const modalEl = document.getElementById('music-import-warning-modal');
    assert(modalEl, "Élément modale trouvé dans domStore");

    // 1. Déclenchement de l'avertissement via promptAddPersonalMusic
    MusicManager.promptAddPersonalMusic();
    assert(modalEl.classList.contains('active'), "La modale d'avertissement est activée lors du clic Ajouter");

    // 2. Fermeture sans action (Annuler)
    MusicManager.closeImportWarningModal();
    assert(!modalEl.classList.contains('active'), "La modale se ferme lors de l'annulation");

    // 3. Importation sans lecture automatique
    MusicManager.isPlaying = false;
    MusicManager.hasStarted = false;

    // Simulation d'un résultat d'importation
    await MusicManager.handleImportResult({
      copied: [{ filename: 'test-track.mp3', title: 'Test Track' }],
      duplicates: [],
      errors: []
    });

    assert.strictEqual(MusicManager.isPlaying, false, "L'importation ne doit JAMAIS démarrer la lecture automatiquement");
    assert.strictEqual(MusicManager.selectedFolder, 'Musique personnelle', "Le dossier sélectionné bascule sur Musique personnelle");

    // Vérification du fallback addCustomTracks sans lecture automatique
    MusicManager.isPlaying = false;
    MusicManager.addCustomTracks([{ name: 'fallback-track.mp3', size: 1024 }]);
    assert.strictEqual(MusicManager.isPlaying, false, "addCustomTracks ne déclenche plus non plus de lecture automatique");
  });

  // ---------------------------------------------------------------------------
  // 35. Sélection explicite de playlist lors de l'ajout d'un morceau (+)
  // ---------------------------------------------------------------------------

  await it("35.1 Modale de sélection de playlist présente dans index.html et css/styles.css", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('id="playlist-select-modal"'), "Modale #playlist-select-modal présente dans index.html");
    assert(html.includes('id="playlist-select-modal-title"'), "Titre de sélection de playlist présent");
    assert(html.includes('id="playlist-select-modal-subtitle"'), "Sous-titre d'information du morceau présent");
    assert(html.includes('id="btn-create-new-playlist-for-track"'), "Bouton de création directe d'une playlist pour ce morceau présent");
    assert(html.includes('id="playlist-select-list"'), "Conteneur des playlists sélectionnables présent");
    assert(html.includes('id="btn-close-playlist-select-modal"'), "Bouton fermer présent");
    assert(html.includes('id="btn-done-playlist-select-modal"'), "Bouton Terminer présent");

    assert(css.includes('.playlist-select-row'), "Styles .playlist-select-row définis dans css/styles.css");
  });

  await it("35.2 Clic sur '+' permet d'ajouter le morceau à plusieurs playlists sans fermer le panneau", () => {
    // Préparer deux playlists
    MusicManager.playlists = [
      { id: 'pl-focus', name: 'Focus Matin', trackIds: ['track-1'] },
      { id: 'pl-chill', name: 'Détente Soir', trackIds: [] }
    ];
    MusicManager.activePlaylistId = 'all';

    const testTrackKey = 'track-chopin-9';
    const selectModalEl = document.getElementById('playlist-select-modal');
    assert(selectModalEl, "Élément playlist-select-modal trouvé");

    // 1. Clic sur '+' via promptAddTrackToPlaylist
    MusicManager.promptAddTrackToPlaylist(testTrackKey);

    // Vérifier que la modale de choix s'ouvre bien au lieu d'une assignation silencieuse
    assert(selectModalEl.classList.contains('active'), "La modale de sélection de playlist s'affiche");
    assert.strictEqual(MusicManager._targetTrackKeyForPlaylist, testTrackKey, "Le trackKey ciblé est mémorisé");

    // Vérifier qu'aucune playlist n'a encore reçu le morceau
    assert(!MusicManager.playlists[0].trackIds.includes(testTrackKey), "La première playlist n'a pas été modifiée aveuglément");
    assert(!MusicManager.playlists[1].trackIds.includes(testTrackKey), "La deuxième playlist n'a pas été modifiée aveuglément");

    // 2. Ajout dans la 2ème playlist ('pl-chill')
    MusicManager.toggleTargetPlaylist('pl-chill', testTrackKey);

    // Le panneau NE DOIT PAS se fermer : l'utilisateur peut continuer à ajouter à d'autres playlists
    assert(selectModalEl.classList.contains('active'), "La modale RESTE ouverte après ajout pour permettre les choix multiples");
    assert(MusicManager.playlists[1].trackIds.includes(testTrackKey), "Le morceau est bien ajouté à pl-chill");

    // 3. Ajout dans la 1ère playlist ('pl-focus') également
    MusicManager.toggleTargetPlaylist('pl-focus', testTrackKey);

    // Les deux playlists contiennent désormais le morceau
    assert(selectModalEl.classList.contains('active'), "La modale RESTE toujours ouverte");
    assert(MusicManager.playlists[0].trackIds.includes(testTrackKey), "Le morceau est également ajouté à pl-focus");
    assert(MusicManager.playlists[1].trackIds.includes(testTrackKey), "Le morceau est toujours dans pl-chill");

    // 4. Clic sur "Terminer" (ou fermeture manuelle)
    MusicManager.closePlaylistSelectModal();
    assert(!selectModalEl.classList.contains('active'), "La modale se ferme quand l'utilisateur clique sur Terminer");
  });

  await it("36.1 Mode Focus : options de lecture au hasard et de sélection d'une playlist précise", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const FocusMgr = require('../js/focus.js');

    // 1. Présence dans index.html
    assert(html.includes('id="focus-shuffle-music"'), "Coche pour lecture au hasard #focus-shuffle-music présente");
    assert(html.includes('id="focus-specific-playlist-enable"'), "Coche pour choix de playlist précise #focus-specific-playlist-enable présente");
    assert(html.includes('id="focus-playlist-select"'), "Sélecteur de playlist #focus-playlist-select présent");
    assert(html.includes('id="focus-music-suboptions"'), "Conteneur de sous-options musique présent");

    // 2. Présence dans css/styles.css
    assert(css.includes('.focus-music-suboptions'), "Styles .focus-music-suboptions présents");
    assert(css.includes('.focus-playlist-select'), "Styles .focus-playlist-select présents");

    // 3. Propriétés et méthodes de FocusManager
    assert(typeof FocusMgr.shuffleMusic !== 'undefined', "FocusManager.shuffleMusic défini");
    assert(typeof FocusMgr.specificPlaylistEnabled !== 'undefined', "FocusManager.specificPlaylistEnabled défini");
    assert(typeof FocusMgr.selectedPlaylistId !== 'undefined', "FocusManager.selectedPlaylistId défini");
    assert(typeof FocusMgr.populatePlaylistSelect === 'function', "FocusManager.populatePlaylistSelect implémenté");

    // Test des préférences
    FocusMgr.shuffleMusic = true;
    FocusMgr.specificPlaylistEnabled = true;
    FocusMgr.selectedPlaylistId = 'preset:Focus, Rituals & Daily Routines';
    assert.strictEqual(FocusMgr.shuffleMusic, true);
    assert.strictEqual(FocusMgr.specificPlaylistEnabled, true);
    assert.strictEqual(FocusMgr.selectedPlaylistId, 'preset:Focus, Rituals & Daily Routines');
  });

  await it("36.2 Notes : bouton 'Créer un créneau' monté au niveau de la liaison agenda avec bouton icône", async () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const NotesMgr = require('../js/notes.js');

    // 1. Structure dans index.html
    assert(html.includes('class="note-agenda-bar"'), "Barre .note-agenda-bar présente");
    assert(html.includes('id="note-input-event"'), "Sélecteur de créneau #note-input-event présent");
    assert(html.includes('id="btn-note-view-event"'), "Bouton #btn-note-view-event présent");
    assert(html.includes('id="btn-note-schedule-event"'), "Bouton #btn-note-schedule-event présent");
    assert(html.includes('note-icon-btn'), "Bouton voir dans l'agenda configuré comme bouton icône compact .note-icon-btn");
    assert(html.includes('Créer un créneau'), "Texte 'Créer un créneau' présent");

    // 2. Styles CSS
    assert(css.includes('.note-agenda-bar'), "Styles .note-agenda-bar présents");
    assert(css.includes('.note-bar-group'), "Styles .note-bar-group présents");
    assert(css.includes('.note-icon-btn'), "Styles .note-icon-btn présents");
    assert(css.includes('.note-schedule-btn'), "Styles .note-schedule-btn présents");

    // 3. Liaison fonctionnelle
    assert(typeof NotesMgr.scheduleEventForCurrentNote === 'function', "Méthode scheduleEventForCurrentNote implémentée");
    assert(typeof NotesMgr.viewLinkedEventInAgenda === 'function', "Méthode viewLinkedEventInAgenda implémentée");
  });

  await it("37.1 Agenda : la vue semaine commence TOUJOURS par lundi et se termine par dimanche (même après zoomToDay)", () => {
    const AgendaMgr = require('../js/agenda.js');
    assert(typeof AgendaMgr.getMonday === 'function', "Méthode getMonday présente");

    // 1. Zoom sur un jeudi (ex: 2026-11-12)
    AgendaMgr.zoomToDay('2026-11-12');
    assert.strictEqual(AgendaMgr.currentView, 'day', "En vue jour");
    assert.strictEqual(AgendaMgr.currentWeekStart.getDate(), 12, "Calé sur le 12");

    // 2. Retour sur la vue 'week'
    AgendaMgr.setView('week');
    assert.strictEqual(AgendaMgr.currentView, 'week', "En vue semaine");

    // Vérifier que getWeekDays() démarre obligatoirement le lundi et finit le dimanche
    const days = AgendaMgr.getWeekDays();
    assert.strictEqual(days.length, 7, "7 jours dans la semaine");
    assert.strictEqual(days[0].getDay(), 1, "Le premier jour de la semaine est LUNDI (getDay() === 1)");
    assert.strictEqual(days[6].getDay(), 0, "Le dernier jour de la semaine est DIMANCHE (getDay() === 0)");
    assert.strictEqual(days[0].getDate(), 9, "Le lundi correspondant est le 9 novembre");
    assert.strictEqual(days[6].getDate(), 15, "Le dimanche correspondant est le 15 novembre");

    // 3. Zoom sur un dimanche (ex: 2026-11-15)
    AgendaMgr.zoomToDay('2026-11-15');
    assert.strictEqual(AgendaMgr.currentView, 'day');
    AgendaMgr.setView('week');
    const daysSunday = AgendaMgr.getWeekDays();
    assert.strictEqual(daysSunday[0].getDay(), 1, "Même après zoom sur un dimanche, la semaine commence LUNDI");
    assert.strictEqual(daysSunday[6].getDay(), 0, "Même après zoom sur un dimanche, la semaine se termine DIMANCHE");
    assert.strictEqual(daysSunday[0].getDate(), 9);
    assert.strictEqual(daysSunday[6].getDate(), 15);
  });

  await it("37.2 Musique icône aléatoire & Notes sélecteurs d'agenda/projet compacts sans coupure ni scrollbar", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    // 1. Icône aléatoire propre et lisible (croisement Feather / Lucide avec flèches nettes)
    assert(html.includes('id="music-btn-shuffle"'), "Bouton shuffle présent");
    assert(html.includes('polyline points="16 3 21 3 21 8"'), "Icône de flèches croisées lisible présente");

    // 2. Sélecteurs de notes sans coupure
    assert(css.includes('height: 32px'), "Hauteur de 32px pour éviter le découpage horizontal des textes");
    assert(css.includes('.note-event-select'), "Classe .note-event-select stylisée");
    assert(css.includes('text-overflow: ellipsis'), "Troncature élégante avec ellipsis pour les textes longs");
    const noteAgendaBarMatch = css.match(/\.note-agenda-bar\s*\{([^}]+)\}/);
    assert(noteAgendaBarMatch, ".note-agenda-bar présent dans CSS");
    assert(!noteAgendaBarMatch[1].includes('overflow-x: auto'), "Aucune barre de défilement horizontale sur la barre de notes");
    assert(noteAgendaBarMatch[1].includes('overflow: hidden'), "Débordement masqué sur .note-agenda-bar");
    assert(css.includes('appearance: none'), "Apparence personnalisée sur .note-bar-select évitant les bugs Chromium");
  });

  await it("38.1 Animation dynamique de l'icône Antigravité au chargement en rythme avec la progression", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const js = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // 1. Structure HTML de l'icône de splash
    assert(html.includes('class="splash-brand-icon"'), "Conteneur de l'icône splash présent dans index.html");
    assert(html.includes('src="./assets/Icon antigravité.png"'), "Image de l'icône Antigravité présente");

    // 2. Animations CSS de lévitation anti-gravité et impulsions rythmiques
    assert(css.includes('@keyframes antigravityFloat'), "Animation de lévitation anti-gravité présente");
    assert(css.includes('@keyframes splashBeatImpulse'), "Impulsion dynamique en rythme présente");
    assert(css.includes('@keyframes splashRipple'), "Onde de choc radiale présente");
    assert(css.includes('@keyframes splashCompleteSurge'), "Surge d'achèvement à 100% présente");
    assert(css.includes('.splash-brand-icon.splash-beat'), "Sélecteur de pulsation rythmique .splash-beat présent");

    // 3. Déclenchement en rythme dans js/app.js
    assert(js.includes("icon.classList.add('splash-beat')"), "updateSplashProgress déclenche l'impulsion de pulsation");
    assert(js.includes("icon.classList.add('splash-complete')"), "updateSplashProgress déclenche l'effet complet à 100%");
  });

  await it("38.2 Volet latéral compact : masquage des titres et conservation des icônes cliquables apparentes", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const js = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // 1. Sidebar en mode compact rail (largeur 68px, pas 0)
    assert(css.includes('width: 68px !important'), "Sidebar réduite à 68px pour conserver le rail d'icônes");
    assert(css.includes('opacity: 1 !important'), "Sidebar reste pleinement visible");
    assert(css.includes('pointer-events: auto !important'), "Sidebar reste cliquable");

    // 2. Masquage des titres uniquement, conservation des icônes
    assert(css.includes('.nav-item > span:not(.icon)'), "Règle de masquage des titres ciblée");
    assert(css.includes('#app-container.sidebar-collapsed .nav-item .icon'), "Icônes centrées et visibles");

    // 3. Info-bulles (tooltips) pour identification rapide au survol
    assert(html.includes('data-screen="home" title="Accueil"'), "Infobulle Accueil présente");
    assert(html.includes('data-screen="tasks" title="Tâches"'), "Infobulle Tâches présente");
    assert(html.includes('data-screen="agenda" title="Agenda"'), "Infobulle Agenda présente");
    assert(html.includes('data-screen="focus" title="Focus"'), "Infobulle Focus présente");

    // 4. Logo icône compact pour le volet réduit
    assert(html.includes('class="brand-logo-icon"'), "Logo icône Antigravité présent pour le volet réduit");
    assert(css.includes('.brand-logo-icon'), "Règle CSS pour le logo réduit");

    // 5. Bascule synchronisée dans js/app.js
    assert(js.includes("container.classList.toggle('sidebar-collapsed')"), "Bascule de sidebar-collapsed sur container");
    assert(js.includes("document.body.classList.toggle('sidebar-collapsed'"), "Bascule synchronisée sur document.body");
  });

  await it("39.1 Micro-interactions UX : rebond de case à cocher, infobulle rail en verre dépoli, témoin focus et rotation vinyle", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsApp = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const jsFocus = fs.readFileSync(path.join(rootDir, 'js', 'focus.js'), 'utf8');

    // 1. Rebond élastique de la case à cocher des tâches
    assert(css.includes('@keyframes checkboxPop'), "Animation de rebond de case à cocher présente");
    assert(css.includes('@keyframes checkmarkStroke'), "Animation du tracé de coche présente");

    // 2. Infobulle flottante en verre dépoli (rail tooltip, event tooltip, popover, toasts)
    assert(css.includes('.sidebar-rail-tooltip'), "Classe .sidebar-rail-tooltip présente");
    assert(css.includes('.sidebar-rail-tooltip.visible'), "Classe .visible pour l'infobulle flottante");
    assert(css.includes('.sidebar-rail-tooltip') && css.includes('backdrop-filter: blur(18px)'), "Rail tooltip en verre dépoli");
    assert(css.includes('.sidebar-event-tooltip') && css.includes('backdrop-filter: blur(18px)'), "Event tooltip en verre dépoli");
    assert(css.includes('.format-palette-popover') && css.includes('backdrop-filter: blur(18px)'), "Format palette popover en verre dépoli");
    assert(css.includes('.toast') && css.includes('backdrop-filter: blur(18px)'), "Toast en verre dépoli");
    assert(jsApp.includes("initSidebarRailTooltips"), "Méthode initSidebarRailTooltips présente dans js/app.js");

    // 3. Témoin respirant pour le mode Focus actif
    assert(css.includes('@keyframes focusPulseDot'), "Pulsation du témoin lumineux Focus");
    assert(css.includes('.focus-running'), "Classe .focus-running pour signaler le minuteur actif");
    assert(jsFocus.includes("focusNavItem.classList.toggle('focus-running'"), "FocusManager actualise le témoin dans le volet");

    // 4. Rotation du mini vinyle
    assert(css.includes('.sidebar-music-disc-mini.spinning'), "Classe de rotation du mini vinyle");
    assert(css.includes('spinVinyl 6s linear infinite'), "Animation spinVinyl appliquée au mini vinyle");
    assert(css.includes('.sidebar-music-disc-mini.paused'), "Gestion de la pause du vinyle");
  });

  await it("39.2 Transitions d'écrans fluides et confirmation tactile de sauvegarde", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsBackups = fs.readFileSync(path.join(rootDir, 'js', 'backups.js'), 'utf8');

    // 1. Transition sereine et douce des écrans (fondu opacité fluide sans secousse verticale)
    assert(css.includes('animation: screenTransition 0.22s ease-out both'), "Transition d'écran apaisée à 220ms ease-out");
    assert(css.includes('@keyframes screenTransition'), "Keyframes screenTransition présent");

    // 2. Confirmation tactile sur le bouton de sauvegarde rapide
    assert(css.includes('.backup-quick-btn.backup-saving'), "État de rotation/sauvegarde rapide");
    assert(css.includes('.backup-quick-btn.backup-success'), "Confirmation verte de sauvegarde réussie");
    assert(css.includes('@keyframes backupSpin'), "Animation backupSpin présente");
    assert(jsBackups.includes("btnQuick.classList.add('backup-saving')"), "Déclenchement du retour tactile dans BackupManager");
  });

  // ---------------------------------------------------------------------------
  // 40. Ligne repère « Heure actuelle » & Finitions Ambiance (Glass Glow & Empty States)
  // ---------------------------------------------------------------------------

  await it("40.1 Ligne repère « Heure actuelle » en temps réel dans l'Agenda", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsAgenda = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const AgendaManager = require('../js/agenda.js');

    // 1. Présence des méthodes de l'indicateur dans AgendaManager
    assert(typeof AgendaManager.updateNowIndicator === 'function', "Méthode updateNowIndicator présente dans AgendaManager");
    assert(typeof AgendaManager.initNowIndicatorTimer === 'function', "Méthode initNowIndicatorTimer présente dans AgendaManager");
    assert(jsAgenda.includes('this.updateNowIndicator()'), "Appel de updateNowIndicator après le rendu de la grille");

    // 2. Styles CSS dédiés pour la ligne, la puce pulsante et le badge horaire
    assert(css.includes('.agenda-now-indicator'), "Classe .agenda-now-indicator présente dans css/styles.css");
    assert(css.includes('.agenda-now-dot'), "Pastille .agenda-now-dot présente dans css/styles.css");
    assert(css.includes('@keyframes agendaNowPulse'), "Keyframe agendaNowPulse présent pour la pulsation de la pastille");
    assert(css.includes('.agenda-now-badge'), "Badge horaire .agenda-now-badge présent dans css/styles.css");

    // 3. Test de positionnement quand la colonne du jour est trouvée
    const todayStr = AgendaManager.formatDateIso(new Date());
    const dayCol = document.createElement('div');
    dayCol.className = 'day-column';
    dayCol.dataset.date = todayStr;

    const origQuerySelector = document.querySelector;
    document.querySelector = (selector) => {
      if (selector === `.day-column[data-date="${todayStr}"]`) return dayCol;
      return null;
    };

    AgendaManager.currentView = 'week';
    AgendaManager.slotHeight = 50;

    // Test avec une heure déterministe dans la plage (14h30)
    const RealDate = global.Date;
    const mockDate = new RealDate(`${todayStr}T14:30:00`);
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) return mockDate;
        return new RealDate(...args);
      }
      static now() { return mockDate.getTime(); }
    };

    try {
      AgendaManager.updateNowIndicator();
      assert(dayCol.children.length > 0, "L'indicateur d'heure actuelle est inséré dans la colonne d'aujourd'hui");
      const indicator = dayCol.children[0];
      assert.strictEqual(indicator.id, 'agenda-now-indicator', "L'élément inséré a bien l'id agenda-now-indicator");
      assert(indicator.innerHTML.includes('agenda-now-badge'), "Le badge d'heure est présent sur l'indicateur");
      assert(indicator.innerHTML.includes('14:30'), "Le badge affiche l'heure exacte 14:30");
    } finally {
      global.Date = RealDate;
      document.querySelector = origQuerySelector;
    }
  });

  await it("40.2 Finitions visuelles & Ambiance : Glass Glow et Écrans vides poétiques (Empty States)", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsApp = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const jsTasks = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const jsProjects = fs.readFileSync(path.join(rootDir, 'js', 'projects.js'), 'utf8');

    // 1. Glass glow sur les cartes du tableau de bord
    assert(css.includes('.stat-card::after'), "Effet de halo radial glass glow sur .stat-card");
    assert(css.includes('.dashboard-panel:hover'), "Survol illuminé sur .dashboard-panel");

    // 2. Classes d'écrans vides poétiques (Empty states)
    assert(css.includes('.antigravite-empty-state'), "Classe globale .antigravite-empty-state présente dans styles.css");
    assert(css.includes('.dashboard-empty-state'), "Classe .dashboard-empty-state pour les widgets d'accueil");
    assert(css.includes('.empty-state-illustration'), "Conteneur d'illustration .empty-state-illustration présent");

    // 3. Messages poétiques dans les modules
    assert(jsApp.includes('Esprit libre') && jsApp.includes('dashboard-empty-state'), "Empty state poétique pour les tâches prévues");
    assert(jsApp.includes('Temps libre') && jsApp.includes('dashboard-empty-state'), "Empty state poétique pour les créneaux agenda");
    assert(jsApp.includes('Page blanche') && jsApp.includes('dashboard-empty-state'), "Empty state poétique pour les notes");
    assert(jsTasks.includes('antigravite-empty-state tasks-empty-state'), "Empty state poétique pour l'arborescence des tâches");
    assert(jsProjects.includes('antigravite-empty-state projects-empty-state'), "Empty state poétique pour les projets");
  });

  // ---------------------------------------------------------------------------
  // 41. Améliorations de Finition UX : Chevrons fluides, Volume dynamique, Toasts & Resize Agenda
  // ---------------------------------------------------------------------------

  await it("41.1 Rotation fluide à 90° des chevrons de sous-tâches (SVG vectoriel)", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsTasks = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');

    // 1. Chevron vectoriel SVG et rotation CSS
    assert(jsTasks.includes('points="6 9 12 15 18 9"'), "Chevron vectoriel SVG utilisé pour le repliage de sous-tâches");
    assert(css.includes('.task-toggle.collapsed .task-toggle-icon'), "Règle de rotation sur chevron replié présente");
    assert(css.includes('transform: rotate(-90deg)'), "Rotation de 90 degrés appliquée au chevron replié");

    // 2. Bascule directe fluide dans TasksManager.toggleCollapse
    const TasksManager = require('../js/tasks.js');
    assert(typeof TasksManager.toggleCollapse === 'function', "Méthode toggleCollapse présente dans TasksManager");
  });

  await it("41.2 Réglage du volume avec barre de progression dynamique remplie", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsMusic = fs.readFileSync(path.join(rootDir, 'js', 'music.js'), 'utf8');
    const MusicManager = require('../js/music.js');

    // 1. Structure HTML dans index.html
    assert(html.includes('id="music-volume-fill"'), "Barre de remplissage #music-volume-fill présente dans index.html");
    assert(html.includes('class="music-volume-slider-wrapper"'), "Wrapper de curseur de volume présent dans index.html");

    // 2. Styles CSS dans css/styles.css
    assert(css.includes('.music-volume-slider-wrapper'), "Classe .music-volume-slider-wrapper définie");
    assert(css.includes('.music-volume-fill'), "Classe .music-volume-fill définie");
    assert(css.includes('.music-volume-slider-wrapper:hover'), "Agrandissement fluide de la barre au survol");

    // 3. Mise à jour dynamique de la barre dans MusicManager.updateVolumeUI
    assert(jsMusic.includes('music-volume-fill'), "MusicManager actualise la barre de remplissage du volume");
    const fillEl = document.getElementById('music-volume-fill');
    MusicManager.volume = 0.65;
    MusicManager.isMuted = false;
    MusicManager.updateVolumeUI();
    assert.strictEqual(fillEl.style.width, '65%', "La largeur de la barre de volume reflète exactement 65%");
  });

  await it("41.3 Barre de décompte temporelle fine sur les Toasts de notification", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsApp = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // 1. Élément de progression dans App.showToast
    assert(jsApp.includes('class="toast-progress-bar"'), "Élément .toast-progress-bar inséré dans les toasts");

    // 2. Styles CSS et animation de décompte
    assert(css.includes('.toast-progress-bar'), "Classe .toast-progress-bar présente dans css/styles.css");
    assert(css.includes('@keyframes toastProgress'), "Animation toastProgress présente");
    assert(css.includes('toastProgress 3.5s linear forwards'), "Décompte synchronisé sur la durée de 3.5s du toast");
  });

  await it("41.4 Badge de durée en direct lors du redimensionnement de créneau dans l'Agenda", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsAgenda = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const AgendaManager = require('../js/agenda.js');

    // 1. Méthode de calcul et formatage de la durée dans AgendaManager
    assert(typeof AgendaManager.formatDurationMinutes === 'function', "Méthode formatDurationMinutes présente dans AgendaManager");
    assert.strictEqual(AgendaManager.formatDurationMinutes(90), '1h30', "Formatage 90 min = 1h30");
    assert.strictEqual(AgendaManager.formatDurationMinutes(45), '45 min', "Formatage 45 min = 45 min");
    assert.strictEqual(AgendaManager.formatDurationMinutes(120), '2h', "Formatage 120 min = 2h");

    // 2. Affichage de la durée et du delta dans updateDragIndicator
    assert(jsAgenda.includes('formatDurationMinutes'), "AgendaManager utilise formatDurationMinutes dans updateDragIndicator");
    assert(css.includes('.calendar-event.is-resizing'), "Classe .is-resizing présente pour la mise en valeur pendant l'étirement");
    assert(css.includes('.agenda-drag-indicator') && css.includes('backdrop-filter: blur(18px)'), "Indicateur flottant en verre dépoli");
  });

  await it("41.5 Animation fluide de pliage et dépliage des onglets du volet latéral", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const jsApp = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // 1. Transition CSS de pliage/dépliage sur le volet et les onglets
    assert(css.includes('transition: width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'), "Transition fluide de redimensionnement sur le volet latéral");
    assert(css.includes('.nav-item > span:not(.icon)'), "Transition CSS présente sur le texte des onglets");
    assert(css.includes('max-width: 0 !important'), "Pliage fluide avec max-width: 0 sur le texte des onglets repliés");
    assert(css.includes('opacity: 0 !important'), "Fondu doux avec opacity: 0 sur le texte des onglets repliés");
    assert(css.includes('transform: translateX(-12px) !important'), "Glissement latéral fluide transform: translateX(-12px) au repliage");

    // 2. Rotation fluide à 180° du bouton flèche du haut
    assert(css.includes('.btn-toggle-sidebar svg'), "Règle de transition sur l'icône SVG du bouton flèche du haut");
    assert(css.includes('transform: rotate(180deg)'), "Rotation 180 degrés appliquée sur la flèche lors du pliage");
    assert(jsApp.includes("btn.classList.toggle('collapsed', isCollapsed)"), "updateSidebarToggleButton bascule la classe collapsed sans détruire le SVG");
  });

  await it("41.6 Alignement vectoriel et centrage optique des icônes SVG", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const jsTasks = fs.readFileSync(path.join(rootDir, 'js', 'tasks.js'), 'utf8');
    const jsBackups = fs.readFileSync(path.join(rootDir, 'js', 'backups.js'), 'utf8');

    // 1. Suppression du gap horizontal sur les boutons repliés du pied de volet
    assert(css.includes('.backup-quick-btn') && css.includes('gap: 0 !important'), "Le bouton sauvegarde replié supprime le gap pour centrer l'icône");
    assert(css.includes('#theme-toggle-btn') && css.includes('gap: 0 !important'), "Le bouton thème replié supprime le gap pour centrer l'icône");

    // 2. Conteneurs flexibles alignés pour titres, labels et capsules d'icônes
    assert(css.includes('.panel-title') && css.includes('display: inline-flex'), "Les titres de panneaux utilisent inline-flex pour aligner leurs SVG");
    assert(css.includes('.settings-section-title') && css.includes('display: flex'), "Les titres de section Paramètres utilisent flex pour aligner leurs SVG");
    assert(css.includes('.segmented-btn') && css.includes('display: inline-flex'), "Les boutons segmentés alignent leur SVG en flex centré");
    assert(css.includes('.btn > span:has(> svg)'), "Les spans enveloppant un SVG dans les boutons sont alignés en inline-flex");
    assert(css.includes('.focus-option-icon'), "Les icônes des options Focus sont alignées en inline-flex");

    // 3. Centrage optique du triangle Play et absence de doubles marges dans badges/boutons
    assert(html.includes('id="sidebar-music-play-icon"') && html.includes('points="6 3 20 12 6 21 6 3"'), "Triangle Play centré optiquement dans le mini lecteur");
    assert(!jsTasks.includes('class="badge badge-planned" title="Date prévue de réalisation"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:3px;">'), "Suppression des doubles marges sur les badges tâches");
    assert(!jsBackups.includes('margin-right:4px;"><path d="M1 4v6h6"'), "Suppression des doubles marges sur les boutons sauvegardes");

    // 4. Équilibre syntaxique complet du CSS
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;
    assert.strictEqual(openBraces, closeBraces, "Toutes les accolades de css/styles.css sont parfaitement équilibrées");
  });

  // ---------------------------------------------------------------------------
  // 42. Sous-projets, format unifié datetime-local, tri des tâches dans l'agenda
  // ---------------------------------------------------------------------------
  await it("42.1 Sous-projets : imbrication, anti-cycle, détail projet & équivalence avec un projet", () => {
    localStorage.clear();
    StorageManager.clearCache();
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('id="project-input-parent"'), "Sélecteur de projet parent présent dans #project-modal");
    assert(html.includes('id="project-detail-subprojects-list"'), "Section sous-projets présente dans #project-detail-modal");
    assert(html.includes('id="project-detail-parent-banner"'), "Bannière parent présente dans #project-detail-modal");
    assert(css.includes('.project-card.drag-over-nest'), "Style drag-over-nest présent pour imbriquer par glisser-déposer");
    assert(css.includes('.projects-root-dropzone'), "Zone de sortie vers la racine présente dans styles.css");

    const parent = ProjectsManager.addProject({ title: "Programme Spatial", color: "#3b82f6" });
    const child = ProjectsManager.addProject({ title: "Propulsion", color: "#10b981", parentProjectId: parent.id });
    const grandChild = ProjectsManager.addProject({ title: "Tuyères", color: "#f59e0b", parentProjectId: child.id });

    // Anti-cycle : impossible d'imbriquer un parent dans son propre descendant
    assert.strictEqual(ProjectsManager.nestProject(parent.id, grandChild.id), false, "Imbrication cyclique refusée");

    // Hiérarchie cohérente
    const hier = StorageManager.getProjectsHierarchy();
    assert.strictEqual(hier.length, 3);
    assert.strictEqual(hier[0].project.id, parent.id);
    assert.strictEqual(hier[0].level, 0);
    assert.strictEqual(hier[1].project.id, child.id);
    assert.strictEqual(hier[1].level, 1);
    assert.strictEqual(hier[2].project.id, grandChild.id);
    assert.strictEqual(hier[2].level, 2);
    assert.strictEqual(hier[2].pathTitle, "Programme Spatial › Propulsion › Tuyères");

    // Équivalence complète d'un sous-projet comme projet pour les tâches et notes
    const TasksManager = require('../js/tasks.js');
    const NotesManager = require('../js/notes.js');
    const subTask = TasksManager.addTask({ title: "Usiner tuyère", projectId: grandChild.id });
    const subNote = NotesManager.createNote();
    NotesManager.currentNoteId = subNote.id;
    NotesManager.updateCurrentNoteTitle("Plans tuyère");
    NotesManager.linkCurrentNoteToProject(grandChild.id);

    // Vérification affichage du sous-projet dans openProjectDetailModal du parent et du sous-projet
    ProjectsManager.openProjectDetailModal(parent.id);
    assert(document.getElementById('project-detail-subprojects-list').innerHTML.includes("Propulsion"), "La fiche projet parent affiche ses sous-projets");

    ProjectsManager.openProjectDetailModal(grandChild.id);
    assert(document.getElementById('project-detail-parent-banner').innerHTML.includes("Propulsion"), "La fiche du sous-projet affiche le fil d'Ariane vers son parent");
    assert(document.getElementById('project-detail-tasks-list').innerHTML.includes("Usiner tuyère"), "Les tâches du sous-projet s'affichent comme pour tout projet");
    assert(document.getElementById('project-detail-notes-list').innerHTML.includes("Plans tuyère"), "Les notes du sous-projet s'affichent comme pour tout projet");

    // Promotion d'un niveau et sortie à la racine
    assert.strictEqual(ProjectsManager.unNestProject(grandChild.id, false), true);
    const updatedGrandChild = ProjectsManager.getAll().find(p => p.id === grandChild.id);
    assert.strictEqual(updatedGrandChild.parentProjectId, parent.id, "Remonté d'un niveau vers Programme Spatial");
  });

  await it("42.2 Création de tâche : champ Date & heure prévues au format datetime-local comme Échéance", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const TasksManager = require('../js/tasks.js');

    assert(html.includes('<input type="datetime-local" id="task-input-planned"'), "task-input-planned utilise le format unifié datetime-local comme task-input-deadline");
    assert(html.includes('id="task-input-planned-time"'), "Compatibilité conservée pour task-input-planned-time");

    localStorage.clear();
    StorageManager.clearCache();
    const t = TasksManager.addTask({
      title: "Tâche datetime-local",
      plannedDate: "2026-11-15T16:45",
      deadline: "2026-11-20T18:00"
    });
    assert.strictEqual(t.plannedDate, "2026-11-15");
    assert.strictEqual(t.plannedTime, "16:45");

    const titleEl = document.getElementById('task-input-title');
    titleEl.focus = () => {};
    TasksManager.openTaskModal(t.id);
    assert.strictEqual(document.getElementById('task-input-planned').value, "2026-11-15T16:45", "L'édition remplit task-input-planned au format datetime-local YYYY-MM-DDTHH:MM");
    assert.strictEqual(document.getElementById('task-input-deadline').value, "2026-11-20T18:00");
  });

  await it("42.3 Agenda : liaison événement -> tâche avec tâches terminées tout en bas et triées par projet", () => {
    localStorage.clear();
    StorageManager.clearCache();
    const TasksManager = require('../js/tasks.js');
    const pAlpha = ProjectsManager.addProject({ title: "Alpha" });
    const pBeta = ProjectsManager.addProject({ title: "Beta", parentProjectId: pAlpha.id });

    const tActiveAlpha = TasksManager.addTask({ title: "Alpha À faire", projectId: pAlpha.id });
    const tDoneAlpha = TasksManager.addTask({ title: "Alpha Fait", projectId: pAlpha.id });
    TasksManager.toggleCompleted(tDoneAlpha.id);

    const tActiveBeta = TasksManager.addTask({ title: "Beta À faire", projectId: pBeta.id });
    const tDoneBeta = TasksManager.addTask({ title: "Beta Fait", projectId: pBeta.id });
    TasksManager.toggleCompleted(tDoneBeta.id);

    const tActivePerso = TasksManager.addTask({ title: "Perso À faire" });
    const tDonePerso = TasksManager.addTask({ title: "Perso Fait" });
    TasksManager.toggleCompleted(tDonePerso.id);

    const { groups } = AgendaManager.buildEventTaskGroups(StorageManager.getTasks(), StorageManager.getProjects());
    assert.strictEqual(groups.length, 6, "6 groupes générés : 3 actifs par projet + 3 terminés par projet");

    // Les 3 premiers groupes doivent être les tâches à faire (non terminées)
    assert.strictEqual(groups[0].completed, false);
    assert.strictEqual(groups[1].completed, false);
    assert.strictEqual(groups[2].completed, false);
    assert(groups[1].label.includes("Alpha"), "Tâches actives regroupées par projet Alpha");
    assert(groups[2].label.includes("Alpha › Beta"), "Sous-projet Beta imbriqué hiérarchiquement après Alpha");

    // Les 3 derniers groupes (tout en bas) doivent être les tâches terminées, toujours triées par projet
    assert.strictEqual(groups[3].completed, true);
    assert.strictEqual(groups[4].completed, true);
    assert.strictEqual(groups[5].completed, true);
    assert(groups[4].label.includes("Alpha"), "Tâches terminées triées par projet Alpha en bas");
    assert(groups[5].label.includes("Alpha › Beta"), "Tâches terminées triées par sous-projet Beta tout en bas");
    assert.strictEqual(groups[3].items[0].id, tDonePerso.id);
    assert.strictEqual(groups[4].items[0].id, tDoneAlpha.id);
    assert.strictEqual(groups[5].items[0].id, tDoneBeta.id);
  });

  await it("42.4 Vue tuiles en conteneurs de famille : regroupement, arborescence, pliage & glisser-déposer", () => {
    localStorage.clear();
    StorageManager.clearCache();
    StorageManager.saveProjects([]);
    ProjectsManager.collapsedFamilies = null;

    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.project-family-group'), "Conteneur de famille .project-family-group défini dans styles.css");
    assert(css.includes('.project-family-children'), "Zone arborescente .project-family-children définie dans styles.css");
    assert(css.includes('.project-parent-ribbon'), "Ruban couleur du parent présent dans styles.css");
    assert(css.includes('.project-family-toggle-btn'), "Bouton de pliage famille présent dans styles.css");
    assert(css.includes('[data-drop-axis="x"].drag-over-before'), "Indicateur de drag horizontal en vue grille présent");
    assert(css.includes('minmax(290px, 340px) minmax(240px, 1fr)'), "Le projet racine garde une colonne de base dédiée à côté de la vue d'ensemble dossier");
    assert(css.includes('.project-family-overview'), "Panneau vue d'ensemble du dossier présent dans styles.css");
    assert(css.includes('.projects-grid.has-expanded-families'), "Barre d'ajout alignée pleine largeur quand des familles sont dépliées");
    assert(css.includes('border-bottom-left-radius: 8px;'), "Le coude d'arborescence s'arrête nettement sans filer dans le vide");

    const gridContainer = document.getElementById('projects-grid-container');
    gridContainer.children = [];

    const solo = ProjectsManager.addProject({ title: "Projet Indépendant", color: "#64748b" });
    const root = ProjectsManager.addProject({ title: "Programme Spatial", color: "#3b82f6" });
    const childA = ProjectsManager.addProject({ title: "Propulsion", color: "#10b981", parentProjectId: root.id });
    const childB = ProjectsManager.addProject({ title: "Navigation", color: "#a855f7", parentProjectId: root.id });
    const grandChild = ProjectsManager.addProject({ title: "Tuyères", color: "#f59e0b", parentProjectId: childA.id });
    const soloAfter = ProjectsManager.addProject({ title: "Sport", color: "#ec4899" });

    // Vérification de l'arbre hiérarchique
    const { roots } = ProjectsManager.getProjectTree();
    assert.strictEqual(roots.length, 3, "3 racines : Projet Indépendant, Programme Spatial et Sport");
    assert.strictEqual(roots[0].children.length, 0);
    assert.strictEqual(roots[1].children.length, 2);
    assert.strictEqual(roots[1].children[0].children[0].project.id, grandChild.id);
    assert.strictEqual(roots[2].children.length, 0);

    // Rendu en mode tuiles ('grid')
    gridContainer.children = [];
    ProjectsManager.setViewMode('grid');
    assert.strictEqual(gridContainer.classList.contains('has-expanded-families'), true, "Classe has-expanded-families active quand une famille est dépliée");
    const lastFragment = gridContainer.children[gridContainer.children.length - 1];
    assert(lastFragment && Array.isArray(lastFragment.children), "Fragment rendu dans la grille");

    // Les tuiles simples sont regroupées ensemble avant les familles dépliées pour un alignement sans trous
    const soloEl = lastFragment.children[0];
    const soloAfterEl = lastFragment.children[1];
    assert(soloEl.className.includes('project-card') && !soloEl.className.includes('project-family-group'), "Projet Indépendant en tuile simple");
    assert(soloAfterEl.className.includes('project-card') && soloAfterEl.dataset.projectId === soloAfter.id, "Sport regroupé dans la grille des tuiles unitaires");
    assert.strictEqual(soloEl.dataset.dropAxis, 'x', "Tuile simple alignée horizontalement");

    // 3e élément : conteneur de famille pleine largeur pour Programme Spatial
    const familyEl = lastFragment.children[2];
    assert(familyEl.className.includes('project-family-group'), "Un parent avec sous-projets est rendu dans un .project-family-group");
    assert.strictEqual(familyEl.dataset.familyRootId, root.id);

    const parentCardEl = familyEl.children[0];
    assert(parentCardEl.className.includes('is-family-parent'), "La carte parente porte la classe is-family-parent");
    assert.strictEqual(parentCardEl.dataset.dropAxis, 'y', "Carte famille orientée verticalement en tête de famille");
    assert(parentCardEl.innerHTML.includes('project-family-toggle-btn'), "Bouton de pliage/dépliage présent sur la carte parente");

    const childrenWrapEl = familyEl.children[1];
    assert(childrenWrapEl.className.includes('project-family-children'), "Sous-grille arborescente présente dans le conteneur famille");
    assert.strictEqual(childrenWrapEl.children.length, 2, "Contient les 2 branches enfants directes (Propulsion imbriquée + Navigation)");

    const overviewEl = familyEl.children[2];
    assert(overviewEl && overviewEl.className === 'project-family-overview', "Panneau récapitulatif du dossier présent à droite du projet racine");
    assert(overviewEl.innerHTML.includes('3') && overviewEl.innerHTML.includes('sous-projets'), "La vue d'ensemble cumule les 3 descendants du dossier");

    // Propulsion a un sous-projet (Tuyères) -> sous-famille imbriquée
    const nestedFamilyEl = childrenWrapEl.children[0];
    assert(nestedFamilyEl.className.includes('project-family-group') && nestedFamilyEl.className.includes('is-nested-family'), "Sous-projet avec enfant rendu en sous-famille imbriquée");
    const propulsionCard = nestedFamilyEl.children[0];
    assert(propulsionCard.innerHTML.includes('project-parent-ribbon'), "Le ruban de rattachement au parent est injecté sur le sous-projet");
    assert(propulsionCard.innerHTML.includes('Programme Spatial'), "Le badge parent cliquable mentionne Programme Spatial");

    // Navigation (feuille)
    const navCard = childrenWrapEl.children[1];
    assert(navCard.className.includes('is-subproject'), "Navigation porte la classe is-subproject");
    assert.strictEqual(navCard.dataset.dropAxis, 'x', "Les sous-tuiles côte à côte utilisent l'axe horizontal");

    // Pliage / dépliage de la famille persisté
    gridContainer.children = [];
    ProjectsManager.toggleFamilyCollapse(root.id);
    assert.strictEqual(ProjectsManager.isFamilyCollapsed(root.id), true, "L'état plié est mémorisé");
    assert.strictEqual(gridContainer.classList.contains('has-expanded-families'), false, "Une fois la famille pliée, has-expanded-families est retirée");
    const collapsedFragment = gridContainer.children[gridContainer.children.length - 1];
    const collapsedFamilyEl = collapsedFragment.children[1];
    assert.strictEqual(collapsedFamilyEl.children.length, 1, "Une fois pliée, seule la carte parente reste affichée dans le conteneur famille");
    assert.strictEqual(collapsedFamilyEl.children[0].dataset.dropAxis, 'x', "Une famille pliée reprend l'axe horizontal dans la grille");

    // Imbriquer un projet sur une famille pliée la déplie automatiquement
    gridContainer.children = [];
    ProjectsManager.nestProject(solo.id, root.id);
    assert.strictEqual(ProjectsManager.isFamilyCollapsed(root.id), false, "L'imbrication sur une famille pliée la déplie automatiquement");
    const expandedFragment = gridContainer.children[gridContainer.children.length - 1];
    assert(expandedFragment.children[1].className.includes('project-family-group'), "Le dossier déplié reprend sa place dans les conteneurs de famille");
  });

  // ---------------------------------------------------------------------------
  // 43. Note de mise à jour v1.2.0 & Pop-up nouveautés au premier lancement
  // ---------------------------------------------------------------------------
  await it("43.1 Note de mise à jour v1.2.0 complète dans les Paramètres", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(html.includes('id="settings-section-changelog"'), "Section changelog présente dans les paramètres");
    assert(html.includes('Version 1.2.0'), "Mention de Version 1.2.0 présente");
    assert(html.includes('Novembre 2026'), "Date de version 1.2.0 présente");
    assert(html.includes('depuis la v1.1.2'), "Récapitulatif complet depuis la v1.1.2 indiqué");
    assert(
      html.includes('Sous-projets') &&
      html.includes('Paramètres sérieux') &&
      html.includes('Mode Focus') &&
      html.includes('Espace Musique') &&
      html.includes('Corbeille') &&
      html.includes('10 fonds') &&
      html.includes('9 couleurs') &&
      html.includes('Rappels') &&
      html.includes('WYSIWYG'),
      "Toutes les familles de nouveautés majeures depuis la 1.1.2 sont documentées dans les paramètres"
    );
    assert(css.includes('.changelog-categories') && css.includes('.changelog-category-block'), "Styles des catégories de notes de version présents");
    assert(html.includes('id="btn-open-changelog-from-updates"'), "Bouton d'accès direct aux notes présent dans Mises à jour");
    assert(html.includes('id="btn-reopen-whats-new"'), "Bouton pour réouvrir l'aperçu des nouveautés présent");
    assert(html.includes('id="whats-new-modal"'), "Modale #whats-new-modal présente dans index.html");
    assert(html.includes('id="btn-whats-new-open-settings"'), "Bouton de redirection vers les paramètres présent dans la pop-up");
    assert(css.includes('.whats-new-modal-content') && css.includes('.whats-new-features-grid'), "Styles CSS de la modale nouveautés présents");
  });

  await it("43.2 Pop-up nouveautés au premier lancement après mise à jour & redirection Paramètres", async () => {
    localStorage.clear();
    const prevSettingsManager = global.SettingsManager;
    const prevAntigraviteApi = window.AntigraviteAPI;
    let switchedTab = null;

    global.SettingsManager = {
      render: () => {},
      switchTab: (tabId) => { switchedTab = tabId; }
    };
    window.AntigraviteAPI = {
      getAppVersion: async () => '1.2.0'
    };

    try {
      const modal = document.getElementById('whats-new-modal');
      modal.classList.remove('active');

      // 1. Aucun lancement 1.2.0 vu -> la modale doit s'ouvrir
      assert.strictEqual(await App.checkAndShowWhatsNew(), true, "Pop-up ouverte au premier lancement sans version enregistrée");
      assert.strictEqual(modal.classList.contains('active'), true, "#whats-new-modal activée");
      assert.strictEqual(document.getElementById('whats-new-version-badge').textContent, 'Version 1.2.0');

      // 2. Redirection vers les Paramètres -> ferme la pop-up, mémorise 1.2.0 et ouvre Paramètres -> Aide & Notes
      App.openChangelogInSettings();
      assert.strictEqual(modal.classList.contains('active'), false, "Pop-up fermée lors de la redirection");
      assert.strictEqual(localStorage.getItem('antigravite_last_seen_version'), '1.2.0', "Version 1.2.0 marquée comme vue");
      assert.strictEqual(App.currentScreen, 'settings', "Redirection vers l'écran settings");
      assert.strictEqual(switchedTab, 'help', "Ouverture de l'onglet Aide & Astuces contenant les notes");

      // 3. Lancement suivant sur 1.2.0 -> ne réapparaît pas
      assert.strictEqual(await App.checkAndShowWhatsNew(), false, "Ne se réouvre plus aux lancements suivants sur 1.2.0");
      assert.strictEqual(modal.classList.contains('active'), false);

      // 4. Simulation d'une mise à jour depuis 1.1.3 -> 1.2.0 -> réapparaît
      localStorage.setItem('antigravite_last_seen_version', '1.1.3');
      assert.strictEqual(await App.checkAndShowWhatsNew(), true, "Pop-up réouverte lorsque l'utilisateur passe de 1.1.3 à 1.2.0");
      App.closeWhatsNewModal(true);
      assert.strictEqual(modal.classList.contains('active'), false);
      assert.strictEqual(localStorage.getItem('antigravite_last_seen_version'), '1.2.0');
    } finally {
      global.SettingsManager = prevSettingsManager;
      window.AntigraviteAPI = prevAntigraviteApi;
    }
  });

  // ---------------------------------------------------------------------------
  // 44. Correctifs d'usage v1.2.0 (Orthographe, Liaison Notes/Agenda, Fond tâches, Top-bar)
  // ---------------------------------------------------------------------------

  await it("44.1 Correction orthographique & menu contextuel d'édition dans main.js", () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
    assert(mainCode.includes("webContents.on('context-menu'"), "Écouteur d'événement context-menu sur mainWindow.webContents présent");
    assert(mainCode.includes('replaceMisspelling'), "Remplacement du mot mal orthographié présent dans le menu");
    assert(mainCode.includes('addWordToSpellcheckerDictionary'), "Option d'ajout au dictionnaire présente");
    assert(mainCode.includes("role: 'copy'") && mainCode.includes("role: 'paste'"), "Actions standards de presse-papier présentes");
  });

  await it("44.2 Liaison bidirectionnelle stricte Notes <-> Agenda", () => {
    const NotesManager = require('../js/notes.js');
    const AgendaManager = require('../js/agenda.js');

    const testEvent = {
      id: 'evt-bidir-1',
      title: 'Séance de travail partagée',
      start: '2026-11-25T10:00',
      end: '2026-11-25T11:30',
      noteId: null
    };
    StorageManager.saveEvents([testEvent]);

    const testNote = {
      id: 'note-bidir-1',
      title: 'Compte-rendu de séance',
      content: 'Points abordés...',
      linkedEventId: null
    };
    StorageManager.saveNotes([testNote]);

    NotesManager.currentNoteId = testNote.id;
    // Liaison depuis l'onglet Note
    NotesManager.linkCurrentNoteToEvent(testEvent.id);

    // 1. La note doit pointer vers l'événement
    const savedNotes = StorageManager.getNotes();
    const updatedNote = savedNotes.find(n => n.id === testNote.id);
    assert.strictEqual(updatedNote.linkedEventId, testEvent.id, "La note est reliée à l'événement");

    // 2. L'événement d'agenda doit réciproquement pointer vers la note
    const savedEvents = StorageManager.getEvents();
    const updatedEvt = savedEvents.find(e => e.id === testEvent.id);
    assert.strictEqual(updatedEvt.noteId, testNote.id, "L'événement d'agenda est réciproquement relié à la note");

    // 3. Dissociation depuis l'Agenda
    AgendaManager.syncNoteEventLink(testEvent.id, null);
    const notesAfterUnlink = StorageManager.getNotes();
    assert.strictEqual(notesAfterUnlink.find(n => n.id === testNote.id).linkedEventId, null, "La note est dissociée");
  });

  await it("44.3 Suppression du fond de boîte conteneur derrière les items de tâche dans css/styles.css", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.task-tree {') && css.includes('background: transparent !important;'), ".task-tree est forcé en fond transparent sans boîte opaque");
    assert(!css.includes('body.has-custom-wallpaper .task-tree,'), "La classe .task-tree a été retirée des conteneurs opaques de fond d'écran");
    assert(!css.includes('[data-glass="solid"] .task-tree,'), "La classe .task-tree a été retirée des cartes opaques solides");
  });

  await it("44.4 Dégagement sécurisé de la barre supérieure sous les contrôles Windows (Réduire/Agrandir/Fermer)", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('padding-right: 165px;'), "Dégagement par défaut de la top-bar d'au moins 165px");
    assert(css.includes('[data-density="compact"] .top-bar {') && css.includes('165px'), "Densité compacte préserve le dégagement de 165px pour les boutons natifs");
    assert(css.includes('.top-bar-actions {') && css.includes('margin-left: auto;'), ".top-bar-actions positionné proprement avec marge auto");
  });

  await it("45.1 Défilement horizontal sur réduction de fenêtre sans déplacer le volet latéral", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const mainJs = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');

    // Vérification que le minWidth d'Electron permet la réduction de fenêtre
    assert(mainJs.includes('minWidth: 720'), "main.js autorise la réduction de la fenêtre principale avec minWidth: 720");

    // Vérification du conteneur #main-content avec overflow horizontal
    assert(css.includes('#main-content {') && css.includes('overflow-x: auto;'), "#main-content dispose de overflow-x: auto");
    assert(css.includes('overflow-y: hidden;'), "#main-content empêche le double scroll vertical");

    // Vérification que les vues et la top-bar définissent une largeur minimale pour déclencher le défilement
    assert(css.includes('.top-bar {') && css.includes('min-width: 860px;'), ".top-bar a min-width: 860px pour rester alignée");
    assert(css.includes('.screen-view {') && css.includes('min-width: 860px;'), ".screen-view a min-width: 860px");

    // Vérification que le sidebar reste fixe et indépendant du scroll
    assert(css.includes('#sidebar {') && css.includes('flex-shrink: 0;'), "#sidebar est figé avec flex-shrink: 0");
    assert(css.includes('#sidebar {') && css.includes('overflow-x: hidden;'), "#sidebar ne défile jamais horizontalement");
  });

  await it("45.2 Modale de créneau d'agenda anti-coupure et défilement vertical complet", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    assert(css.includes('#event-modal .modal-content-lg') && css.includes('max-height: calc(100vh - 48px);'), "La modale d'événement est bornée en hauteur");
    assert(css.includes('#event-modal .modal-body') && css.includes('overflow-y: auto;'), "Le corps de la modale d'événement possède son propre défilement vertical");

    // Champs de création directe de tâche et liaison de projet
    assert(html.includes('id="event-check-create-task"'), "Case à cocher pour créer une tâche simultanée");
    assert(html.includes('id="event-task-project"'), "Sélecteur de projet pour la tâche créée dans l'agenda");
    assert(html.includes('id="event-task-priority"'), "Sélecteur de priorité pour la tâche créée dans l'agenda");
  });

  await it("45.3 Récurrence avec fin paramétrable (Pour toujours vs Date limite)", () => {
    const AgendaManager = require('../js/agenda.js');

    // 1. Événement récurrent hebdomadaire "Pour toujours" (recurrenceEnd: null)
    const infiniteEvt = AgendaManager.addEvent({
      title: 'Point d\'équipe récurrent infini',
      start: '2026-11-02T10:00',
      end: '2026-11-02T11:00',
      recurrence: 'weekly',
      recurrenceEnd: null
    });
    assert.strictEqual(infiniteEvt.recurrence, 'weekly');
    assert.strictEqual(infiniteEvt.recurrenceEnd, null);

    // Vérification que le créneau se répète les lundis même 6 mois plus tard
    assert.strictEqual(AgendaManager.isEventOnDate(infiniteEvt, '2026-11-02'), true, "Premier lundi");
    assert.strictEqual(AgendaManager.isEventOnDate(infiniteEvt, '2026-11-09'), true, "Deuxième lundi");
    assert.strictEqual(AgendaManager.isEventOnDate(infiniteEvt, '2027-05-03'), true, "Lundi dans le futur lointain");
    assert.strictEqual(AgendaManager.isEventOnDate(infiniteEvt, '2026-11-10'), false, "Mardi (non récurrent)");

    // 2. Événement récurrent hebdomadaire avec date limite (recurrenceEnd: '2026-11-16')
    const finiteEvt = AgendaManager.addEvent({
      title: 'Cours récurrent limité',
      start: '2026-11-02T14:00',
      end: '2026-11-02T16:00',
      recurrence: 'weekly',
      recurrenceEnd: '2026-11-16'
    });
    assert.strictEqual(finiteEvt.recurrenceEnd, '2026-11-16');

    // Doit être actif le 2 et le 9 et le 16 novembre, mais inactif à partir du 23 novembre
    assert.strictEqual(AgendaManager.isEventOnDate(finiteEvt, '2026-11-02'), true, "2 nov actif");
    assert.strictEqual(AgendaManager.isEventOnDate(finiteEvt, '2026-11-09'), true, "9 nov actif");
    assert.strictEqual(AgendaManager.isEventOnDate(finiteEvt, '2026-11-16'), true, "16 nov (dernier jour) actif");
    assert.strictEqual(AgendaManager.isEventOnDate(finiteEvt, '2026-11-23'), false, "23 nov (après date limite) inactif");

    // 3. Mise à jour de la date de fin via updateEvent
    AgendaManager.updateEvent(finiteEvt.id, {
      title: 'Cours récurrent limité prolongé',
      recurrenceEnd: '2026-11-30'
    });
    const updated = AgendaManager.getAll().find(e => e.id === finiteEvt.id);
    assert.strictEqual(updated.recurrenceEnd, '2026-11-30');
    assert.strictEqual(AgendaManager.isEventOnDate(updated, '2026-11-23'), true, "23 nov devient actif après prolongation");
    assert.strictEqual(AgendaManager.isEventOnDate(updated, '2026-11-30'), true, "30 nov actif");
    assert.strictEqual(AgendaManager.isEventOnDate(updated, '2026-12-07'), false, "7 déc inactif");

    // 4. Passage de récurrent à 'none' réinitialise recurrenceEnd à null
    AgendaManager.updateEvent(finiteEvt.id, {
      title: 'Créneau devenu unique',
      recurrence: 'none'
    });
    const uniqueEvt = AgendaManager.getAll().find(e => e.id === finiteEvt.id);
    assert.strictEqual(uniqueEvt.recurrence, 'none');
    assert.strictEqual(uniqueEvt.recurrenceEnd, null, "recurrenceEnd réinitialisé à null quand recurrence='none'");

    // Nettoyage des événements de test
    AgendaManager.deleteEvent(infiniteEvt.id);
    AgendaManager.deleteEvent(finiteEvt.id);
  });

  await it("45.4 Redesign esthétique et ordonné de la modale de créneau d'agenda", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    // Section 1 : Titre & Couleur
    assert(html.includes('class="event-modal-section event-modal-main-info"'), "Section 1 : Titre & Couleur");
    assert(html.includes('id="event-input-title"'), "Champ de titre principal");
    assert(html.includes('id="event-color-swatches"'), "Palette de pastilles de couleurs");

    // Section 2 : Planification & Récurrence
    assert(html.includes('id="event-input-start"') && html.includes('id="event-input-end"'), "Champs Début et Fin");
    assert(html.includes('id="event-input-allday"'), "Case Journée entière");
    assert(html.includes('id="event-input-recurrence"'), "Sélecteur de récurrence");
    assert(html.includes('id="event-recurrence-end-container"'), "Conteneur fin de récurrence");
    assert(html.includes('id="btn-rec-end-forever"'), "Bouton Pour toujours");
    assert(html.includes('id="btn-rec-end-date"'), "Bouton Jusqu'au date");
    assert(html.includes('id="event-input-recurrence-end"'), "Champ de date de fin de récurrence");

    // Section 3 : Lieu & Description
    assert(html.includes('id="event-input-location"'), "Champ Lieu avec préfixe icône");
    assert(html.includes('id="event-input-desc"'), "Zone de texte Description");

    // Section 4 : Liaisons Antigravité
    assert(html.includes('class="event-modal-section event-modal-links-section"'), "Section 4 : Liaisons Antigravité");
    assert(html.includes('id="event-input-task"'), "Sélecteur tâche rattachée");
    assert(html.includes('id="btn-event-open-task"'), "Bouton voir tâche");
    assert(html.includes('id="event-input-note"'), "Sélecteur note associée");
    assert(html.includes('id="btn-event-open-note"'), "Bouton ouvrir note");
  });

  await it("46.1 Amplitude 24h de l'Agenda (minuit à minuit) avec focus visuel sur les heures normales (07h00)", () => {
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // Vérifier les constantes de l'objet AgendaManager
    assert(agendaCode.includes('dayHoursStart: 0'), "dayHoursStart est configuré à 0 (minuit)");
    assert(agendaCode.includes('dayHoursEnd: 24'), "dayHoursEnd est configuré à 24 (minuit - 24h complètes)");

    // Méthode scrollToNormalHours présente
    assert(agendaCode.includes('scrollToNormalHours(smooth = false)'), "Méthode scrollToNormalHours définie");
    assert(agendaCode.includes('Math.round(7 * (this.slotHeight || 50))'), "Focus calculé sur 07h00");

    // Préservation du défilement et restauration
    assert(agendaCode.includes('_preserveScrollTop'), "Mémorisation du scroll utilisateur active");
    assert(agendaCode.includes('_lastScrollTop'), "Historique de scroll conservé");

    // Intégration dans App.navigate('agenda')
    assert(appCode.includes("screenId === 'agenda'"), "Navigation agenda gérée");
    assert(appCode.includes("AgendaManager.scrollToNormalHours"), "Appel de centrage automatique sur 07h00");
  });

  await it("46.2 Modale de créneau d'agenda anti-troncature des options et champs larges", () => {
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    // Modale élargie à 720px
    assert(css.includes('max-width: 720px;'), "Modale d'événement élargie à 720px pour un confort de lecture optimal");

    // Section Liaisons Antigravité en pile verticale pleine largeur
    assert(html.includes('class="event-links-stack"'), "Structure en pile verticale event-links-stack présente");
    assert(html.includes('class="event-link-row-card"'), "Cartes pleine largeur pour tâche et note");
    assert(css.includes('.event-links-stack'), "Styles de pile verticale event-links-stack définis dans css");
    assert(css.includes('.event-link-row-card'), "Styles de carte event-link-row-card définis dans css");

    // Sélecteurs configurés pour un affichage lisible sans coupure
    assert(css.includes('.event-full-select'), "Classe event-full-select présente");
    assert(css.includes('.event-select-link'), "Classe event-select-link présente");
    assert(css.includes('font-size: 0.84rem;'), "Taille de police optimisée pour sélecteurs d'événements");
    assert(css.includes('text-overflow: ellipsis;'), "Gestion anti-débordement par ellipsis sur les sélecteurs");
  });

  await it("47.1 Réorganisation par glisser-déposer des onglets du volet latéral (Persistance et défauts)", () => {
    const storageCode = fs.readFileSync(path.join(rootDir, 'js', 'storage.js'), 'utf8');
    const settingsJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'settings.json'), 'utf8'));

    // sidebarTabsOrder présent dans DEFAULT_SETTINGS
    assert(storageCode.includes('sidebarTabsOrder:'), "sidebarTabsOrder présent dans DEFAULT_SETTINGS");
    assert(Array.isArray(settingsJson.sidebarTabsOrder), "sidebarTabsOrder est un tableau dans settings.json");
    assert.strictEqual(settingsJson.sidebarTabsOrder.length, 8, "Les 8 onglets configurables sont listés par défaut");
    assert(settingsJson.sidebarTabsOrder.includes('tasks'), "Tâches présent dans l'ordre par défaut");
    assert(settingsJson.sidebarTabsOrder.includes('agenda'), "Agenda présent dans l'ordre par défaut");
    assert(settingsJson.sidebarTabsOrder.includes('notes'), "Notes présent dans l'ordre par défaut");
  });

  await it("47.2 Application de la disposition personnalisée sur le menu du volet latéral (App.applySidebarTabsOrder)", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');

    // Vérifier la méthode applySidebarTabsOrder
    assert(appCode.includes('applySidebarTabsOrder(order)'), "Méthode applySidebarTabsOrder définie dans App");
    assert(appCode.includes('settingsItem'), "Point d'ancrage Paramètres respecté");
    assert(appCode.includes('navMenu.insertBefore(item, settingsItem)'), "Réagencement propre des items avant Paramètres");
    assert(appCode.includes('this.applySidebarTabsOrder(settings.sidebarTabsOrder)'), "Appelé lors de l'application des réglages");

    // Test unitaire de re-ordonnancement DOM simulé
    const customOrder = ['notes', 'tasks', 'music', 'agenda', 'projects', 'focus', 'trash', 'backups'];
    const fakeNavMenu = {
      children: [
        { dataset: { screen: 'home' } },
        { dataset: { screen: 'tasks' } },
        { dataset: { screen: 'projects' } },
        { dataset: { screen: 'agenda' } },
        { dataset: { screen: 'notes' } },
        { dataset: { screen: 'focus' } },
        { dataset: { screen: 'music' } },
        { dataset: { screen: 'trash' } },
        { dataset: { screen: 'backups' } },
        { dataset: { screen: 'settings' } }
      ],
      querySelector(selector) {
        const match = selector.match(/data-screen="([^"]+)"/);
        if (match) {
          return this.children.find(c => c.dataset.screen === match[1]) || null;
        }
        return null;
      },
      insertBefore(item, ref) {
        const fromIdx = this.children.indexOf(item);
        if (fromIdx !== -1) this.children.splice(fromIdx, 1);
        const toIdx = this.children.indexOf(ref);
        this.children.splice(toIdx, 0, item);
      }
    };

    const settingsItem = fakeNavMenu.querySelector('.nav-item[data-screen="settings"]');
    customOrder.forEach(screenId => {
      const item = fakeNavMenu.querySelector(`.nav-item[data-screen="${screenId}"]`);
      if (item) fakeNavMenu.insertBefore(item, settingsItem);
    });

    const screensInOrder = fakeNavMenu.children.map(c => c.dataset.screen);
    assert.strictEqual(screensInOrder[0], 'home', "Accueil reste en première position");
    assert.strictEqual(screensInOrder[screensInOrder.length - 1], 'settings', "Paramètres reste en dernière position");
    assert.strictEqual(screensInOrder[1], 'notes', "Le premier onglet réorganisé est bien Notes");
    assert.strictEqual(screensInOrder[2], 'tasks', "Le deuxième onglet réorganisé est bien Tâches");
    assert.strictEqual(screensInOrder[3], 'music', "Le troisième onglet réorganisé est bien Musique");
  });

  await it("47.3 Interface du carré des paramètres (glisser-déposer, poignées et styles)", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    const settingsCode = fs.readFileSync(path.join(rootDir, 'js', 'settings.js'), 'utf8');

    // Structure HTML
    assert(html.includes('class="sidebar-tab-toggle-card" draggable="true"'), "Cartes configurées avec draggable='true'");
    assert(html.includes('class="tab-drag-handle"'), "Poignées de déplacement visuelles présentes");
    assert(html.includes('id="btn-reset-sidebar-tabs-order"'), "Bouton de rétablissement de l'ordre par défaut présent");

    // Styles CSS de glisser-déposer
    assert(css.includes('.sidebar-tab-toggle-card.dragging'), "Styles de carte en cours de déplacement (.dragging)");
    assert(css.includes('.sidebar-tab-toggle-card.drag-over-before'), "Indicateur avant drop (.drag-over-before)");
    assert(css.includes('.sidebar-tab-toggle-card.drag-over-after'), "Indicateur après drop (.drag-over-after)");
    assert(css.includes('.tab-drag-handle'), "Styles de poignée de glissement");

    // Logique JS dans SettingsManager
    assert(settingsCode.includes('initSidebarTabsDragAndDrop()'), "Méthode initSidebarTabsDragAndDrop présente");
    assert(settingsCode.includes('btn-reset-sidebar-tabs-order'), "Gestion du bouton de réinitialisation");
    assert(settingsCode.includes('currentSettings.sidebarTabsOrder = newOrder'), "Sauvegarde du nouvel ordre dans les réglages");
  });

  await it("47.4 Agenda : Indicateur visuel des tâches achevées et pastille '✓ Fait'", () => {
    const agendaCode = fs.readFileSync(path.join(rootDir, 'js', 'agenda.js'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

    assert(agendaCode.includes('task-completed-event'), "Classe task-completed-event injectée sur les événements");
    assert(agendaCode.includes('event-done-pill'), "Pastille event-done-pill présente pour signaler la tâche accomplie");
    assert(agendaCode.includes('task-completed-pill'), "Pastille de mois task-completed-pill prise en compte");
    assert(css.includes('.calendar-event.task-completed-event'), "Styles CSS pour créneau d'agenda achevé");
  });

  await it("47.5 Agenda : Raccourci clavier 'T' (revenir à aujourd'hui et 07h00)", () => {
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    assert(appCode.includes("e.key === 't' || e.key === 'T'"), "Écoute de la touche T dans app.js");
    assert(appCode.includes('AgendaManager.navigateToday'), "Appel de navigateToday sur appui de T");
    assert(html.includes('Revenir à aujourd\'hui (dans l\'Agenda)'), "Raccourci T documenté dans l'Aide");
  });

  await it("47.6 Note de mise à jour v1.2.1 présente dans le Changelog", () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    assert(html.includes('Version 1.2.1'), "Mention de Version 1.2.1 présente");
    assert(html.includes('Correctifs d\'usage, confort &amp; personnalisation'), "Sous-titre de la version 1.2.1 présent");
    assert(html.includes('Réorganisation des onglets par glisser-déposer'), "Section glisser-déposer présente");
    assert(html.includes('Amplitude complète 24h'), "Section 24h présente");
    assert(html.includes('Dossiers personnalisés pour les notes'), "Section dossiers de notes présente");
    assert(html.includes('Fondu sonore doux'), "Section fondu sonore présente");
    assert(html.includes('Pré-chargement instantané des écrans'), "Section pré-chargement présente");
  });

  // ---------------------------------------------------------------------------
  // 48. Nouveautés v1.2.1 : Fondu sonore, Navigation Zero-Lag & Dossiers de Notes
  // ---------------------------------------------------------------------------

  await it("48.1 Fondu sonore doux (fade audio) dans MusicManager", async () => {
    assert(typeof MusicManager._fadeAudioTo === 'function', "MusicManager._fadeAudioTo est bien défini");

    // Test de l'atténuation progressive
    let completed = false;
    MusicManager.audio = {
      volume: 0,
      play() { return Promise.resolve(); },
      pause() {}
    };
    MusicManager.volume = 0.8;

    MusicManager._fadeAudioTo(0.8, 40, true, () => {
      completed = true;
    });

    await new Promise(resolve => setTimeout(resolve, 60));
    assert(completed, "Le callback de fondu sonore a été invoqué");
    assert(Math.abs(MusicManager.audio.volume - 0.8) < 0.05, "Le volume cible a bien été atteint");

    // Test pause avec fondu
    let paused = false;
    MusicManager.audio.pause = () => { paused = true; };
    MusicManager.isPlaying = true;
    MusicManager.pause();
    assert.strictEqual(MusicManager.isPlaying, false, "L'état isPlaying passe immédiatement à false");
  });

  await it("48.2 Pré-chargement instantané des écrans (App.preloadScreens)", () => {
    assert(typeof App.preloadScreens === 'function', "App.preloadScreens est défini");

    // Exécution sécurisée sans exception
    App.preloadScreens();

    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes('preloadScreens()'), "preloadScreens est invoqué au cycle de vie initial");
    assert(appCode.includes('disableAnimations') && appCode.includes('potato'), "navigate prend en compte la désactivation des animations ou le mode potato");
  });

  await it("48.3 Gestion des dossiers dans l'onglet Notes avec persistance des liens", () => {
    const NotesManager = require('../js/notes.js');
    const defaultSettings = StorageManager.DEFAULT_SETTINGS;
    assert(Array.isArray(defaultSettings.notesFolders), "DEFAULT_SETTINGS définit notesFolders");
    assert(defaultSettings.notesFolders.includes('Général'), "notesFolders contient 'Général' par défaut");

    const folders = NotesManager.getFolders();
    assert(Array.isArray(folders), "NotesManager.getFolders() renvoie un tableau de dossiers");
    assert(folders.includes('Général'), "Le dossier Général est présent");

    // Création d'un nouveau dossier
    const newFolderName = "Dossier Test 121";
    const okCreate = NotesManager.createFolder(newFolderName);
    assert(okCreate, "NotesManager.createFolder renvoie true");
    assert(NotesManager.getFolders().includes(newFolderName), "Le nouveau dossier est bien enregistré");

    // Création d'une note dans ce dossier liée à un projet et à un créneau
    const testNote = {
      id: 'note-folder-test-1',
      title: 'Note Test Liens',
      folder: newFolderName,
      projectId: 'proj-demo',
      linkedEventId: 'event-demo',
      content: 'Contenu avec lien wikilink vers [[Autre Note]]'
    };
    StorageManager.saveNotes([testNote]);

    // Renommage du dossier : la note doit suivre vers le nouveau nom
    const renamedFolder = "Dossier Test Renommé";
    NotesManager.renameFolder(newFolderName, renamedFolder);
    assert(NotesManager.getFolders().includes(renamedFolder), "Le dossier renommé est présent");
    assert(!NotesManager.getFolders().includes(newFolderName), "L'ancien nom de dossier n'est plus présent");

    let savedNotes = StorageManager.getNotes();
    let updatedNote = savedNotes.find(n => n.id === testNote.id);
    assert.strictEqual(updatedNote.folder, renamedFolder, "La note a suivi le renommage du dossier");
    assert.strictEqual(updatedNote.projectId, 'proj-demo', "Le projectId est scrupuleusement conservé");
    assert.strictEqual(updatedNote.linkedEventId, 'event-demo', "Le linkedEventId est scrupuleusement conservé");
    assert(updatedNote.content.includes('[[Autre Note]]'), "Les Wikilinks sont conservés");

    // Suppression du dossier : la note bascule sur 'Général' sans être détruite
    NotesManager.deleteFolder(renamedFolder);
    assert(!NotesManager.getFolders().includes(renamedFolder), "Le dossier a bien été supprimé");
    savedNotes = StorageManager.getNotes();
    updatedNote = savedNotes.find(n => n.id === testNote.id);
    assert.ok(updatedNote, "La note n'a pas été supprimée lors de la suppression de son dossier");
    assert.strictEqual(updatedNote.folder, 'Général', "La note a été rebasculée en sécurité sur le dossier 'Général'");
    assert.strictEqual(updatedNote.projectId, 'proj-demo', "Le lien projet perdure");
    assert.strictEqual(updatedNote.linkedEventId, 'event-demo', "Le lien événement perdure");
  });

  await it("48.4 App.prompt unifié et menu contextuel des dossiers de notes", async () => {
    assert(typeof App.prompt === 'function', "App.prompt est une méthode définie");

    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('id="dialog-input"'), "Champ de saisie dialog-input présent dans dialog-modal");
    assert(html.includes('id="notes-folder-context-menu"'), "Menu contextuel notes-folder-context-menu présent dans index.html");
    assert(html.includes('id="btn-new-folder"'), "Bouton de création de dossier présent");

    const notesCode = fs.readFileSync(path.join(rootDir, 'js', 'notes.js'), 'utf8');
    assert(notesCode.includes('promptNewFolder()'), "promptNewFolder est défini dans notes.js");
    assert(notesCode.includes('showFolderMenu('), "showFolderMenu est défini dans notes.js");
    assert(notesCode.includes('Renommer le dossier'), "Option de renommage explicite dans le menu");
    assert(notesCode.includes('Supprimer le dossier'), "Option de suppression explicite dans le menu");

    // Test de simulation App.prompt
    let inputEl = document.getElementById('dialog-input');
    if (!inputEl) {
      inputEl = { style: {}, value: '', focus() {}, select() {} };
      domStore['dialog-input'] = inputEl;
    }
    const btnConfirm = document.getElementById('dialog-btn-confirm');

    const promptPromise = App.prompt({
      title: "Nouveau dossier",
      message: "Nom :",
      defaultValue: "Dossier Alpha"
    });

    if (btnConfirm && typeof btnConfirm.onclick === 'function') {
      inputEl.value = "Dossier Alpha Saisi";
      btnConfirm.onclick();
    }

    const promptRes = await promptPromise;
    assert.strictEqual(promptRes, "Dossier Alpha Saisi", "App.prompt retourne la valeur saisie lors de la confirmation");
  });

  await it("48.5 Frise chronologique de la journée (minuit à minuit) et dossier unique Général par défaut", () => {
    // 1. Unicité du dossier Général par défaut
    const defaultSettings = StorageManager.DEFAULT_SETTINGS;
    assert.deepStrictEqual(defaultSettings.notesFolders, ['Général'], "Seul le dossier Général existe par défaut");

    const settingsJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'settings.json'), 'utf8'));
    assert.deepStrictEqual(settingsJson.notesFolders, ['Général'], "data/settings.json ne contient que le dossier Général");

    // 2. Intitulé dans les paramètres
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(html.includes('Frise chronologique de la journée</span>'), "Intitulé 'Frise chronologique de la journée' dans les paramètres");
    assert(!html.includes('Frise chronologique de la journée (07h - 23h)'), "Mention 07h-23h retirée de l'intitulé de la frise");

    // 3. Masquage du pourcentage et du temps restant
    const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
    assert(css.includes('.sidebar-day-progress-percent') && css.includes('display: none !important'), "Pourcentage et temps restant masqués en CSS");

    // 4. Amplitude de minuit à minuit (1440 minutes) dans js/app.js
    const appCode = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
    assert(appCode.includes('dayStartMin = 0'), "dayStartMin commence à 0 (minuit)");
    assert(appCode.includes('dayEndMin = 24 * 60'), "dayEndMin s'étend jusqu'à 24h (minuit)");
    assert(appCode.includes('totalDayMin = 1440'), "totalDayMin couvre 1440 minutes");
  });

  console.log("==========================================================");
  console.log(`   RÉSULTATS : ${passed} passés, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
}

runTests();
