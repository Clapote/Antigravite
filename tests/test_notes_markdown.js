/**
 * Antigravité - Tests automatisés pour le Système de Notes & Rendu Markdown Obsidian
 * Phase 1 : Éditeur enrichi, barre d'outils, compatibilité Obsidian et sécurité XSS.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("==========================================================");
console.log("   Antigravité - Tests du Système de Notes Markdown");
console.log("   (Compatibilité Obsidian, Rendu, Sécurité & Curseur)");
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

function createMockTextarea(initialValue = '') {
  let val = initialValue;
  let selStart = 0;
  let selEnd = 0;
  return {
    get value() { return val; },
    set value(v) { val = v; },
    get selectionStart() { return selStart; },
    set selectionStart(s) { selStart = s; },
    get selectionEnd() { return selEnd; },
    set selectionEnd(e) { selEnd = e; },
    setSelectionRange(s, e) {
      selStart = s;
      selEnd = e;
    },
    focus() {}
  };
}

const mockElements = {
  'note-title-editor': { value: '', addEventListener: () => {} },
  'note-body-editor': createMockTextarea(''),
  'notes-preview-container': { innerHTML: '', addEventListener: () => {} },
  'notes-list-container': { innerHTML: '', appendChild: () => {} },
  'notes-panes': {
    classList: {
      classes: new Set(['mode-split']),
      add: function(c) { this.classes.add(c); },
      remove: function(...cls) { cls.forEach(c => this.classes.delete(c)); },
      contains: function(c) { return this.classes.has(c); }
    }
  },
  'notes-format-bar': { addEventListener: () => {} },
  'note-input-event': { innerHTML: '', appendChild: () => {}, addEventListener: () => {} },
  'btn-note-view-event': { style: { display: 'none' }, addEventListener: () => {} },
  'btn-note-schedule-event': { addEventListener: () => {} },
  'btn-new-note': { addEventListener: () => {} },
  'notes-search-input': { addEventListener: () => {} },
  'btn-export-note': { addEventListener: () => {} },
  'btn-delete-note': { addEventListener: () => {} }
};

global.document = {
  getElementById: (id) => mockElements[id] || null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    appendChild: () => {},
    onclick: null,
    setAttribute: () => {}
  }),
  querySelectorAll: (sel) => {
    if (sel === '.btn-view-mode') {
      return [
        { dataset: { mode: 'edit' }, classList: { toggle: () => {} }, addEventListener: () => {} },
        { dataset: { mode: 'split' }, classList: { toggle: () => {} }, addEventListener: () => {} },
        { dataset: { mode: 'preview' }, classList: { toggle: () => {} }, addEventListener: () => {} }
      ];
    }
    return [];
  }
};

global.window = {
  NotesManager: null,
  App: {
    showToast: () => {},
    navigate: () => {}
  }
};

const NotesManager = require('../js/notes.js');

(async () => {
  // Initialiser des données propres
  localStorage.clear();
  const initialNotes = [
    {
      id: "note-init-1",
      title: "Note de référence",
      folder: "Général",
      tags: ["test"],
      linkedEventId: null,
      content: "# Titre Initial\n\nTexte de référence brut.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  StorageManager.saveNotes(initialNotes);

  // ---------------------------------------------------------------------------
  // Critère 1 : Préservation exacte de la source Markdown quand non modifiée
  // ---------------------------------------------------------------------------
  await it("1. Préservation exacte de la source Markdown stockée sans altération", () => {
    const rawMarkdown = "# Mon Titre\n\nTexte avec [[wikilink]] et **gras** sans altération.\n\n```js\nconsole.log(42);\n```";
    const testNotes = [{
      id: "note-preserve",
      title: "Note Préservée",
      folder: "Général",
      tags: [],
      linkedEventId: null,
      content: rawMarkdown,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    StorageManager.saveNotes(testNotes);

    NotesManager.selectNote("note-preserve");
    const retrieved = NotesManager.getAll().find(n => n.id === "note-preserve");

    assert.strictEqual(retrieved.content, rawMarkdown, "Le contenu brut Markdown doit être préservé au caractère près");
    assert.strictEqual(mockElements['note-body-editor'].value, rawMarkdown, "Le textarea doit recevoir le contenu brut intact");
  });

  // ---------------------------------------------------------------------------
  // Critère 2 : Gras, italique, barré, et surlignage Obsidian (==texte==)
  // ---------------------------------------------------------------------------
  await it("2. Rendu des styles : gras (**), italique (*), barré (~~) et surlignage Obsidian (==)", () => {
    const md = "Texte avec du **gras**, de l'*italique*, du ~~texte barré~~ et du ==surligné Obsidian==.";
    const html = NotesManager.simpleMarkdownToHtml(md);

    assert.ok(html.includes('<strong>gras</strong>'), "Le gras ** doit générer <strong>gras</strong>");
    assert.ok(html.includes('<em>italique</em>'), "L'italique * doit générer <em>italique</em>");
    assert.ok(html.includes('<del class="obsidian-del">texte barré</del>'), "Le barré ~~ doit générer <del class=\"obsidian-del\">");
    assert.ok(html.includes('<mark class="obsidian-highlight">surligné Obsidian</mark>'), "Le surligné == doit générer <mark class=\"obsidian-highlight\">");
  });

  // ---------------------------------------------------------------------------
  // Critère 3 : Titres H1 à H6, listes à puces, listes numérotées, tâches, liens
  // ---------------------------------------------------------------------------
  await it("3. Rendu des titres H1-H6, listes à puces, listes numérotées, cases à cocher et liens", () => {
    const md = [
      "# Titre 1",
      "## Titre 2",
      "### Titre 3",
      "#### Titre 4",
      "##### Titre 5",
      "###### Titre 6",
      "",
      "- Puce Alpha",
      "- Puce Bêta",
      "",
      "1. Première étape",
      "2. Deuxième étape",
      "",
      "- [ ] Tâche à faire",
      "- [x] Tâche complétée",
      "",
      "[Documentation](https://antigravite.local)"
    ].join('\n');

    const html = NotesManager.simpleMarkdownToHtml(md);

    assert.ok(html.includes('<h1>Titre 1</h1>'), "H1 rendu");
    assert.ok(html.includes('<h2>Titre 2</h2>'), "H2 rendu");
    assert.ok(html.includes('<h3>Titre 3</h3>'), "H3 rendu");
    assert.ok(html.includes('<h4>Titre 4</h4>'), "H4 rendu");
    assert.ok(html.includes('<h5>Titre 5</h5>'), "H5 rendu");
    assert.ok(html.includes('<h6>Titre 6</h6>'), "H6 rendu");

    assert.ok(html.includes('<ul class="obsidian-list">'), "Conteneur de liste à puces présent");
    assert.ok(html.includes('<li class="obsidian-bullet-item">Puce Alpha</li>'), "Item liste à puces rendu");

    assert.ok(html.includes('<ol class="obsidian-list">'), "Conteneur de liste numérotée présent");
    assert.ok(html.includes('<li class="obsidian-number-item" value="1">Première étape</li>'), "Item liste numérotée rendu");

    assert.ok(html.includes('<div class="obsidian-task-item"'), "Item de tâche présent");
    assert.ok(html.includes('<input type="checkbox" class="obsidian-task-checkbox" data-line="13">'), "Checkbox non cochée présente");
    assert.ok(html.includes('<input type="checkbox" class="obsidian-task-checkbox" checked data-line="14">'), "Checkbox cochée présente");
    assert.ok(html.includes('class="task-text task-completed">Tâche complétée</span>'), "Texte de tâche complétée barré");

    assert.ok(html.includes('<a href="https://antigravite.local" target="_blank" rel="noopener noreferrer">Documentation</a>'), "Lien externe sécurisé rendu");

    // URLs avec parenthèses équilibrées (ex: Wikipédia)
    const wikiMd = "[Wikipédia](https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie))";
    const wikiHtml = NotesManager.simpleMarkdownToHtml(wikiMd);
    assert.ok(wikiHtml.includes('<a href="https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie)" target="_blank" rel="noopener noreferrer">Wikipédia</a>'), "Lien avec parenthèses Wikipédia rendu sans troncature");

    const wikiAnchorMd = "[Wikipédia Ancre](https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie)#Histoire)";
    const wikiAnchorHtml = NotesManager.simpleMarkdownToHtml(wikiAnchorMd);
    assert.ok(wikiAnchorHtml.includes('<a href="https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie)#Histoire" target="_blank" rel="noopener noreferrer">Wikipédia Ancre</a>'), "Lien avec parenthèses et ancre rendu proprement");

    const proseParensMd = "(voir [Wikipédia](https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie)))";
    const proseParensHtml = NotesManager.simpleMarkdownToHtml(proseParensMd);
    assert.ok(proseParensHtml.includes('(voir <a href="https://fr.wikipedia.org/wiki/Antigravit%C3%A9_(homonymie)" target="_blank" rel="noopener noreferrer">Wikipédia</a>)'), "Lien avec parenthèses au sein de parenthèses en prose rendu proprement");
  });

  // ---------------------------------------------------------------------------
  // Critère 4 : Combinaisons de syntaxes multiples
  // ---------------------------------------------------------------------------
  await it("4. Prise en charge des combinaisons de syntaxes imbriquées", () => {
    const md = "Voici du **gras avec de l'*italique* imbriqué**, du ==**gras surligné**== et un [**lien en gras**](https://example.com).";
    const html = NotesManager.simpleMarkdownToHtml(md);

    assert.ok(html.includes('<strong>gras avec de l&#039;<em>italique</em> imbriqué</strong>'), "Gras et italique combinés");
    assert.ok(html.includes('<mark class="obsidian-highlight"><strong>gras surligné</strong></mark>'), "Gras surligné combiné");
    assert.ok(html.includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>lien en gras</strong></a>'), "Lien contenant du gras combiné");
  });

  // ---------------------------------------------------------------------------
  // Critère 5 : Préservation des wikilinks [[...]] et syntaxes Obsidian
  // ---------------------------------------------------------------------------
  await it("5. Préservation des wikilinks [[...]], callouts et frontmatter Obsidian", () => {
    const md = [
      "---",
      "title: Fiche Projet",
      "tags: [projet, antigravite]",
      "---",
      "",
      "> [!NOTE] Note Importante",
      "> Ceci est le corps du callout Obsidian.",
      "",
      "Lien interne vers [[Planification Annuelle]] et avec alias [[Projets/Web|Portail Web]].",
      "Tag libre #antigravite/test dans le paragraphe."
    ].join('\n');

    const html = NotesManager.simpleMarkdownToHtml(md);

    assert.ok(html.includes('obsidian-frontmatter'), "Frontmatter YAML converti en bloc de métadonnées visuel");
    assert.ok(html.includes('obsidian-callout-note'), "Callout Obsidian rendu avec classe obsidian-callout-note");
    assert.ok(html.includes('Note Importante'), "Titre du callout Obsidian affiché");
    assert.ok(html.includes('<span class="obsidian-wikilink" data-target="Planification Annuelle" title="Planification Annuelle">[[Planification Annuelle]]</span>'), "Wikilink standard rendu");
    assert.ok(html.includes('<span class="obsidian-wikilink" data-target="Projets/Web" title="Projets/Web">[[Portail Web]]</span>'), "Wikilink avec alias rendu");
    assert.ok(html.includes('<span class="obsidian-tag">#antigravite/test</span>'), "Tag Obsidian rendu");
  });

  // ---------------------------------------------------------------------------
  // Critère 6 : Blocs de code contenant des caractères de syntaxe Markdown
  // ---------------------------------------------------------------------------
  await it("6. Les marqueurs Markdown dans les blocs de code et code inline ne sont PAS interprétés", () => {
    const md = [
      "```javascript",
      "// Ceci n'est pas du # Titre ni du **gras**",
      "const str = `==non surligné== et ~~non barré~~`;",
      "```",
      "",
      "Un peu de code inline : `**pas gras** et # pas titre` dans une phrase."
    ].join('\n');

    const html = NotesManager.simpleMarkdownToHtml(md);

    assert.ok(html.includes('<pre class="obsidian-code-block">'), "Bloc de code présent");
    assert.ok(html.includes('// Ceci n&#039;est pas du # Titre ni du **gras**'), "Les symboles ** et # sont préservés littéralement dans le code block");
    assert.ok(!html.includes('<strong>pas du # Titre'), "Aucune balise strong dans le bloc de code");
    assert.ok(!html.includes('<h1>Titre'), "Aucune balise h1 dans le bloc de code");

    assert.ok(html.includes('<code class="obsidian-inline-code">**pas gras** et # pas titre</code>'), "Code inline préservé sans transformation Markdown");
    assert.ok(!html.includes('<strong>pas gras</strong>'), "Le code inline ne doit pas créer de balise strong");
  });

  // ---------------------------------------------------------------------------
  // Critère 7 : Caractères spéciaux et accentués (UTF-8)
  // ---------------------------------------------------------------------------
  await it("7. Préservation fidèle des caractères spéciaux, accentués et émojis", () => {
    const utf8Text = "Éléphants à l'orée du bois : « Ça coûte 42 € ! » — Événement ✨ 🚀 📅";
    const testNotes = [{
      id: "note-utf8",
      title: "Note Accentuée",
      folder: "Général",
      tags: [],
      linkedEventId: null,
      content: utf8Text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    StorageManager.saveNotes(testNotes);

    NotesManager.selectNote("note-utf8");
    const retrieved = NotesManager.getAll().find(n => n.id === "note-utf8");
    assert.strictEqual(retrieved.content, utf8Text, "Le texte UTF-8 en stockage est intact");

    const html = NotesManager.simpleMarkdownToHtml(utf8Text);
    assert.ok(html.includes("Éléphants"), "Accents majuscules préservés dans le rendu");
    assert.ok(html.includes("Ça coûte 42 €"), "Symboles et cédilles préservés");
    assert.ok(html.includes("✨ 🚀 📅"), "Émojis préservés");
  });

  // ---------------------------------------------------------------------------
  // Critère 8 : Éditions successives et sauvegarde debouncée (300 ms)
  // ---------------------------------------------------------------------------
  await it("8. Débouncing de 300 ms sur les modifications successives", async () => {
    const testNotes = [{
      id: "note-init-1",
      title: "Note Debounce",
      folder: "Général",
      tags: [],
      linkedEventId: null,
      content: "Contenu avant modif",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    StorageManager.saveNotes(testNotes);
    NotesManager.currentNoteId = "note-init-1";

    let saveCount = 0;
    const originalSaveNotes = StorageManager.saveNotes.bind(StorageManager);
    StorageManager.saveNotes = (notes) => {
      saveCount++;
      return originalSaveNotes(notes);
    };

    // 5 modifications rapides consécutives
    NotesManager.updateCurrentNoteContent("Modif 1");
    NotesManager.updateCurrentNoteContent("Modif 2");
    NotesManager.updateCurrentNoteContent("Modif 3");
    NotesManager.updateCurrentNoteContent("Modif 4");
    NotesManager.updateCurrentNoteContent("Modif 5 finale");

    assert.strictEqual(saveCount, 0, "Aucune écriture synchrone avant expiration du délai de 300 ms");

    // Attendre 350 ms pour laisser le debounce se déclencher
    await new Promise(resolve => setTimeout(resolve, 350));

    assert.strictEqual(saveCount, 1, "Une seule écriture finale en stockage après le délai de 300 ms");
    const notes = StorageManager.getNotes();
    const target = notes.find(n => n.id === "note-init-1");
    assert.strictEqual(target.content, "Modif 5 finale", "La dernière valeur a été persistée");

    StorageManager.saveNotes = originalSaveNotes;
  });

  // ---------------------------------------------------------------------------
  // Critère 9 : Changement de note et flush immédiat (flushPendingSave)
  // ---------------------------------------------------------------------------
  await it("9. flushPendingSave() persiste immédiatement sans attendre le timer lors d'un changement de note", () => {
    const testNotes = [{
      id: "note-init-1",
      title: "Note Flush",
      folder: "Général",
      tags: [],
      linkedEventId: null,
      content: "Contenu initial",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    StorageManager.saveNotes(testNotes);
    NotesManager.currentNoteId = "note-init-1";

    let writtenNotes = null;
    const originalSaveNotes = StorageManager.saveNotes.bind(StorageManager);
    StorageManager.saveNotes = (notes) => {
      writtenNotes = notes;
      return originalSaveNotes(notes);
    };

    NotesManager.updateCurrentNoteContent("Modification non encore temporisée");
    assert.strictEqual(writtenNotes, null, "La sauvegarde n'a pas encore eu lieu");

    // Déclencher le flush immédiat
    NotesManager.flushPendingSave();

    assert.ok(writtenNotes !== null, "flushPendingSave a forcé l'écriture immédiate");
    const n = writtenNotes.find(item => item.id === "note-init-1");
    assert.strictEqual(n.content, "Modification non encore temporisée", "Le contenu a été immédiatement écrit");
    assert.strictEqual(NotesManager._saveTimer, null, "Le timer a été réinitialisé à null");
    assert.strictEqual(NotesManager._pendingNotesToSave, null, "Le buffer en attente a été vidé");

    StorageManager.saveNotes = originalSaveNotes;
  });

  // ---------------------------------------------------------------------------
  // Critère 10 : Sécurité et protection contre les injections XSS
  // ---------------------------------------------------------------------------
  await it("10. Protection absolue contre les injections XSS dans le Markdown", () => {
    const maliciousScript = "<script>alert('xss')</script>";
    const maliciousImg = '<img src="x" onerror="alert(1)">';
    const maliciousLink = '[Danger](javascript:alert(1))';
    const maliciousIframe = '<iframe src="evil.com"></iframe>';

    const input = `${maliciousScript}\n\n${maliciousImg}\n\n${maliciousLink}\n\n${maliciousIframe}`;
    const output = NotesManager.simpleMarkdownToHtml(input);

    assert.ok(!output.includes('<script>'), "Balise <script> interdite");
    assert.ok(output.includes('&lt;script&gt;'), "Balise <script> échappée en entités HTML");

    assert.ok(!output.includes('<img src="x" onerror="alert(1)">'), "Attribut onerror interdit");
    assert.ok(output.includes('&lt;img'), "Balise <img> échappée");

    assert.ok(!output.includes('href="javascript:'), "Protocole javascript: formellement bloqué");
    assert.ok(output.includes('<span>Danger</span>'), "Lien malveillant désactivé en texte inoffensif");

    assert.ok(!output.includes('<iframe'), "Balise <iframe> interdite");
    assert.ok(output.includes('&lt;iframe'), "Balise <iframe> échappée");

    // Protocoles arbitraires et injections
    const maliciousFile = '[Fichier Local](file:///C:/Windows/System32/calc.exe)';
    const maliciousJsParens = '[Danger Parens](javascript:alert((1)))';
    const maliciousAttr = '[Injection](https://example.com" onclick="alert(1))';

    const input2 = `${maliciousFile}\n\n${maliciousJsParens}\n\n${maliciousAttr}`;
    const output2 = NotesManager.simpleMarkdownToHtml(input2);

    assert.ok(!output2.includes('href="file:'), "Protocole file: formellement interdit");
    assert.ok(output2.includes('<span>Fichier Local</span>'), "Lien file: désactivé en texte inoffensif");
    assert.ok(!output2.includes('href="javascript:'), "Protocole javascript avec parenthèses imbriquées interdit");
    assert.ok(output2.includes('<span>Danger Parens</span>'), "Lien javascript avec parenthèses désactivé");
    assert.ok(!/<[a-z]+[^>]*\sonclick=/i.test(output2), "Aucun attribut d'événement injecté dans les balises DOM");
  });

  // ---------------------------------------------------------------------------
  // Critère 11 : Gestion du curseur et de la sélection (Toolbar applyFormatting)
  // ---------------------------------------------------------------------------
  await it("11. Gestion intelligente du curseur et de la sélection (applyFormatting)", () => {
    NotesManager.flushPendingSave();
    const testNoteTask = {
      id: "note-task-test",
      title: "Note Tâche",
      folder: "Général",
      tags: [],
      linkedEventId: null,
      content: "# Liste\n- [ ] Première tâche\n- [x] Deuxième tâche",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    StorageManager.saveNotes([testNoteTask]);
    NotesManager.selectNote("note-task-test");

    const textarea = mockElements['note-body-editor'];

    // 11.a Enrobage d'une sélection en gras
    textarea.value = "Bonjour tout le monde";
    textarea.selectionStart = 8;
    textarea.selectionEnd = 12; // "tout"
    let res = NotesManager.applyFormatting('bold');
    assert.strictEqual(res.value, "Bonjour **tout** le monde", "Le mot sélectionné doit être entouré de **");
    assert.strictEqual(res.selectionStart, 10, "Curseur repositionné après le préfixe");
    assert.strictEqual(res.selectionEnd, 14, "Sélection conservée sur le texte enrobé");

    // 11.b Insertion de placeholder quand aucune sélection
    textarea.value = "Début ";
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;
    res = NotesManager.applyFormatting('italic');
    assert.strictEqual(res.value, "Début *texte en italique*", "Placeholder d'italique inséré");
    assert.strictEqual(res.selectionStart, 7, "Curseur au début du placeholder");
    assert.strictEqual(res.selectionEnd, 24, "Placeholder sélectionné pour saisie immédiate");

    // 11.c Surlignage Obsidian (==)
    textarea.value = "Point clé";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 9;
    res = NotesManager.applyFormatting('highlight');
    assert.strictEqual(res.value, "==Point clé==", "Texte enrobé avec == pour Obsidian");

    // 11.d Titre H1 sur la ligne courante
    textarea.value = "Mon grand titre";
    textarea.selectionStart = 4;
    textarea.selectionEnd = 4;
    res = NotesManager.applyFormatting('h1');
    assert.strictEqual(res.value, "# Mon grand titre", "La ligne courante reçoit le préfixe # ");

    // 11.e Bascule H1 -> retrait (toggle)
    res = NotesManager.applyFormatting('h1');
    assert.strictEqual(res.value, "Mon grand titre", "Un deuxième appel à H1 retire le préfixe");

    // 11.f Remplacement d'un titre existant par H2
    textarea.value = "# Mon titre";
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;
    res = NotesManager.applyFormatting('h2');
    assert.strictEqual(res.value, "## Mon titre", "H1 est remplacé par ## pour H2");

    // 11.g Insertion de tâche checkbox (- [ ] )
    textarea.value = "Acheter du pain";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    res = NotesManager.applyFormatting('task');
    assert.strictEqual(res.value, "- [ ] Acheter du pain", "Préfixe de case à cocher inséré");

    // 11.h Toggle d'une checkbox interactive (toggleTaskCheckbox)
    // Réinitialiser le contenu du document pour tester la bascule de ligne
    textarea.value = "# Liste\n- [ ] Première tâche\n- [x] Deuxième tâche";
    NotesManager.updateCurrentNoteContent(textarea.value);
    NotesManager.flushPendingSave();

    // Basculer la ligne 1 (index 1) : '- [ ] Première tâche' -> '- [x] Première tâche'
    NotesManager.toggleTaskCheckbox(1);
    NotesManager.flushPendingSave();
    let noteUpdated = StorageManager.getNotes().find(n => n.id === "note-task-test");
    assert.ok(noteUpdated && noteUpdated.content.includes('- [x] Première tâche'), "La tâche 1 doit être cochée");

    // Basculer à nouveau pour décocher
    NotesManager.toggleTaskCheckbox(1);
    NotesManager.flushPendingSave();
    noteUpdated = StorageManager.getNotes().find(n => n.id === "note-task-test");
    assert.ok(noteUpdated && noteUpdated.content.includes('- [ ] Première tâche'), "La tâche 1 doit être décochée");
  });

  // ---------------------------------------------------------------------------
  // Critère 12 : Bascule des modes d'affichage (Édition / Split / Aperçu)
  // ---------------------------------------------------------------------------
  await it("12. Gestion des modes d'affichage (Édition seule, Split partagé, Aperçu seul)", () => {
    NotesManager.setViewMode('edit');
    assert.strictEqual(NotesManager.currentViewMode, 'edit');
    assert.strictEqual(localStorage.getItem('antigravite_notes_view_mode'), 'edit');
    assert.strictEqual(mockElements['notes-panes'].classList.contains('mode-edit'), true);

    NotesManager.setViewMode('preview');
    assert.strictEqual(NotesManager.currentViewMode, 'preview');
    assert.strictEqual(localStorage.getItem('antigravite_notes_view_mode'), 'preview');
    assert.strictEqual(mockElements['notes-panes'].classList.contains('mode-preview'), true);

    NotesManager.setViewMode('split');
    assert.strictEqual(NotesManager.currentViewMode, 'split');
    assert.strictEqual(localStorage.getItem('antigravite_notes_view_mode'), 'split');
    assert.strictEqual(mockElements['notes-panes'].classList.contains('mode-split'), true);
  });

  // ---------------------------------------------------------------------------
  // Critère 13 : Ouverture sécurisée des liens externes et interception des protocoles
  // ---------------------------------------------------------------------------
  await it("13. Ouverture sécurisée des liens externes et interception des protocoles", () => {
    let openedUrl = null;
    let defaultPrevented = false;

    global.window.AntigraviteAPI = {
      openExternal: (url) => {
        openedUrl = url;
        return Promise.resolve(true);
      }
    };

    function createMockLinkEvent(href, tagName = 'A') {
      defaultPrevented = false;
      openedUrl = null;
      const mockLink = {
        tagName: tagName,
        getAttribute: (attr) => (attr === 'href' ? href : null),
        href: href
      };
      mockLink.closest = (selector) => (selector === 'a' ? (tagName === 'A' ? mockLink : null) : null);

      return {
        target: mockLink,
        preventDefault: () => { defaultPrevented = true; }
      };
    }

    // 1. Lien HTTPS valide
    const httpsEvent = createMockLinkEvent('https://antigravite.local/docs');
    const resHttps = NotesManager.handleLinkClick(httpsEvent);
    assert.strictEqual(resHttps, true, "Lien HTTPS autorisé");
    assert.strictEqual(defaultPrevented, true, "preventDefault appelé sur lien HTTPS");
    assert.strictEqual(openedUrl, 'https://antigravite.local/docs', "openExternal appelé avec l'URL HTTPS");

    // 2. Lien HTTP valide
    const httpEvent = createMockLinkEvent('http://example.com');
    const resHttp = NotesManager.handleLinkClick(httpEvent);
    assert.strictEqual(resHttp, true, "Lien HTTP autorisé");
    assert.strictEqual(defaultPrevented, true, "preventDefault appelé sur lien HTTP");
    assert.strictEqual(openedUrl, 'http://example.com', "openExternal appelé avec l'URL HTTP");

    // 3. Lien file: interdit
    const fileEvent = createMockLinkEvent('file:///C:/Windows/System32/cmd.exe');
    const resFile = NotesManager.handleLinkClick(fileEvent);
    assert.strictEqual(resFile, false, "Lien file: refusé");
    assert.strictEqual(defaultPrevented, true, "preventDefault appelé pour bloquer navigation file:");
    assert.strictEqual(openedUrl, null, "openExternal JAMAIS appelé pour lien file:");

    // 4. Lien javascript: interdit
    const jsEvent = createMockLinkEvent('javascript:alert(1)');
    const resJs = NotesManager.handleLinkClick(jsEvent);
    assert.strictEqual(resJs, false, "Lien javascript: refusé");
    assert.strictEqual(defaultPrevented, true, "preventDefault appelé pour bloquer navigation javascript:");
    assert.strictEqual(openedUrl, null, "openExternal JAMAIS appelé pour lien javascript:");

    // 5. Clic sur un élément qui n'est pas un lien (ex: wikilink span)
    const spanEvent = {
      target: {
        tagName: 'SPAN',
        closest: () => null
      },
      preventDefault: () => { defaultPrevented = true; }
    };
    defaultPrevented = false;
    const resSpan = NotesManager.handleLinkClick(spanEvent);
    assert.strictEqual(resSpan, undefined, "Élément non-lien ignoré");
    assert.strictEqual(defaultPrevented, false, "preventDefault non appelé sur élément non-lien");
    assert.strictEqual(openedUrl, null, "openExternal non appelé");
  });

  // ---------------------------------------------------------------------------
  // BILAN DES TESTS
  // ---------------------------------------------------------------------------
  console.log("==========================================================");
  console.log(`   RÉSULTATS DES TESTS NOTES MARKDOWN : ${passed} réussis, ${failed} échoués`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
