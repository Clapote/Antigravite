/**
 * Antigravité - Module de Gestion des Notes
 * Compatible avec la structure Markdown d'Obsidian.
 * 
 * Principes fondamentaux :
 * 1. Markdown brut comme unique source de vérité (aucune altération destructive).
 * 2. Rendu en temps réel avec support complet des spécificités Obsidian (==surligné==, callouts, wikilinks [[...]], checkboxes interactives).
 * 3. Sauvegarde automatique avec débouncing de 300 ms et flush immédiat (changement de note, blur, navigation, fermeture).
 * 4. Protection XSS absolue (échappement HTML strict avant rendu Markdown).
 */

const NotesManager = {
  currentNoteId: null,
  searchQuery: '',
  currentProjectFilter: 'all',
  currentViewMode: 'split', // 'split', 'edit', 'preview'
  _saveTimer: null,
  _pendingNotesToSave: null,
  _isSyncingScroll: false,

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;

    try {
      if (typeof localStorage !== 'undefined') {
        const savedMode = localStorage.getItem('antigravite_notes_view_mode');
        if (savedMode && ['split', 'edit', 'preview'].includes(savedMode)) {
          this.currentViewMode = savedMode;
        }
      }
    } catch (e) {
      this.currentViewMode = 'split';
    }

    this.setViewMode(this.currentViewMode);
    this.render();
    this.bindEvents();
  },

  setViewMode(mode) {
    if (!['split', 'edit', 'preview'].includes(mode)) {
      mode = 'split';
    }
    this.currentViewMode = mode;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravite_notes_view_mode', mode);
      }
    } catch (e) {}

    if (typeof document !== 'undefined') {
      const panes = document.getElementById('notes-panes');
      if (panes) {
        panes.classList.remove('mode-split', 'mode-edit', 'mode-preview');
        panes.classList.add(`mode-${mode}`);
      }

      const buttons = document.querySelectorAll('.btn-view-mode');
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      if (mode !== 'edit' && this.currentNoteId) {
        const note = this.getAll().find(n => n.id === this.currentNoteId);
        if (note) this.updatePreview(note.content);
      }
    }
  },

  flushPendingSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._pendingNotesToSave) {
      StorageManager.saveNotes(this._pendingNotesToSave);
      this._pendingNotesToSave = null;
    }
  },

  bindEvents() {
    const btnNew = document.getElementById('btn-new-note');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.createNote());
    }

    const searchInput = document.getElementById('notes-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderNotesList();
      });
    }

    const filterProjectSelect = document.getElementById('notes-filter-project');
    if (filterProjectSelect) {
      filterProjectSelect.addEventListener('change', (e) => {
        this.currentProjectFilter = e.target.value;
        this.renderNotesList();
      });
    }

    const titleInput = document.getElementById('note-title-editor');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        if (!this.currentNoteId) return;
        this.updateCurrentNoteTitle(e.target.value);
      });
      titleInput.addEventListener('blur', () => this.flushPendingSave());
    }

    const textarea = document.getElementById('note-body-editor');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        if (!this.currentNoteId) return;
        this.updateCurrentNoteContent(e.target.value);
        this.updatePreview(e.target.value);
      });
      textarea.addEventListener('blur', () => this.flushPendingSave());
      textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
      textarea.addEventListener('scroll', () => this.syncScroll('editor'));
    }

    const previewEl = document.getElementById('notes-preview-container');
    if (previewEl) {
      previewEl.addEventListener('scroll', () => this.syncScroll('preview'));
      previewEl.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('obsidian-task-checkbox')) {
          const lineIdx = parseInt(e.target.dataset.line, 10);
          if (!isNaN(lineIdx)) {
            this.toggleTaskCheckbox(lineIdx);
          }
        }
      });
      // Gestionnaire de clics sur les liens dans l'aperçu (ouverture dans le navigateur externe par défaut)
      previewEl.addEventListener('click', (e) => this.handleLinkClick(e));
      previewEl.addEventListener('auxclick', (e) => this.handleLinkClick(e));
    }

    // Barre d'outils de formatage Markdown
    const formatBar = document.getElementById('notes-format-bar');
    if (formatBar) {
      formatBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-format');
        if (btn && btn.dataset.action) {
          e.preventDefault();
          this.applyFormatting(btn.dataset.action);
        }
      });
    }

    // Boutons de bascule de mode d'affichage (Édition / Split / Aperçu)
    const viewButtons = document.querySelectorAll('.btn-view-mode');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode) {
          this.setViewMode(btn.dataset.mode);
        }
      });
    });

    const btnExport = document.getElementById('btn-export-note');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCurrentNote());
    }

    const btnDelete = document.getElementById('btn-delete-note');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => this.deleteCurrentNote());
    }

    // Liaison avec les projets
    const projectSelect = document.getElementById('note-input-project');
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        this.linkCurrentNoteToProject(e.target.value || null);
      });
    }

    // Liaison avec les créneaux d'Agenda
    const eventSelect = document.getElementById('note-input-event');
    if (eventSelect) {
      eventSelect.addEventListener('change', (e) => {
        this.linkCurrentNoteToEvent(e.target.value || null);
      });
    }

    const btnViewEvent = document.getElementById('btn-note-view-event');
    if (btnViewEvent) {
      btnViewEvent.addEventListener('click', () => this.viewLinkedEventInAgenda());
    }

    const btnScheduleEvent = document.getElementById('btn-note-schedule-event');
    if (btnScheduleEvent) {
      btnScheduleEvent.addEventListener('click', () => this.scheduleEventForCurrentNote());
    }
  },

  getAll() {
    return StorageManager.getNotes();
  },

  saveAll(notes) {
    StorageManager.saveNotes(notes);
    this.renderNotesList();
  },

  createNote() {
    this.flushPendingSave();
    const notes = this.getAll();
    const newNote = {
      id: 'note-' + Date.now(),
      title: 'Nouvelle note',
      folder: 'Général',
      tags: [],
      projectId: null,
      linkedEventId: null,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    this.saveAll(notes);
    this.selectNote(newNote.id);
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Note créée", "success");
    }
    return newNote;
  },

  // Alias pour rétro-compatibilité
  createNewNote() {
    return this.createNote();
  },

  selectNote(id) {
    this.flushPendingSave();
    this.currentNoteId = id;
    const notes = this.getAll();
    const note = notes.find(n => n.id === id);
    if (!note) return;

    if (typeof document !== 'undefined') {
      const titleInput = document.getElementById('note-title-editor');
      const textarea = document.getElementById('note-body-editor');
      if (titleInput) titleInput.value = note.title;
      if (textarea) textarea.value = note.content;

      this.updatePreview(note.content);
      this.renderProjectSelector(note);
      this.renderEventSelector(note);
      this.renderNotesList();
    }
  },

  renderProjectSelector(note) {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('note-input-project');
    if (!select) return;

    const projects = StorageManager.getProjects();
    select.innerHTML = '<option value="">(Aucun projet)</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title || p.name || 'Projet sans nom';
      if (note && note.projectId === p.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  },

  linkCurrentNoteToProject(projectId) {
    if (!this.currentNoteId) return;
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    note.projectId = projectId || null;
    note.updatedAt = new Date().toISOString();
    StorageManager.saveNotes(notes);

    this.renderNotesList();
    if (typeof window !== 'undefined' && window.ProjectsManager && typeof window.ProjectsManager.render === 'function') {
      window.ProjectsManager.render();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(projectId ? "Note associée au projet" : "Projet dissocié de la note", "info");
    }
  },

  renderEventSelector(note) {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('note-input-event');
    const btnView = document.getElementById('btn-note-view-event');
    if (!select) return;

    const events = StorageManager.getEvents();
    events.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    select.innerHTML = '<option value="">(Aucun créneau d\'agenda associé)</option>';

    const todayIso = new Date().toISOString().slice(0, 10);
    const in7DaysIso = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const groupThisWeek = [];
    const groupUpcoming = [];
    const groupPast = [];

    events.forEach(e => {
      const eDate = e.start ? e.start.slice(0, 10) : '';
      if (eDate < todayIso) {
        groupPast.push(e);
      } else if (eDate <= in7DaysIso) {
        groupThisWeek.push(e);
      } else {
        groupUpcoming.push(e);
      }
    });

    const appendGroup = (label, list) => {
      if (list.length === 0) return;
      const grp = document.createElement('optgroup');
      grp.label = label;
      list.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        const datePart = e.start ? e.start.replace('T', ' à ') : 'Date indéfinie';
        opt.textContent = `${e.title} (${datePart})${e.source === 'google' ? ' [Google]' : ''}`;
        if (note && (note.linkedEventId === e.id || e.noteId === note.id)) {
          opt.selected = true;
        }
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    };

    appendGroup("📅 Cette semaine & Prochains jours", groupThisWeek);
    appendGroup("⏳ Créneaux à venir (Plus tard)", groupUpcoming);
    appendGroup("📜 Créneaux passés", groupPast);

    const isLinked = !!(note && (note.linkedEventId || events.some(e => e.noteId === note.id)));
    if (btnView) {
      btnView.style.display = isLinked ? 'inline-flex' : 'none';
    }
  },

  linkCurrentNoteToEvent(eventId) {
    if (!this.currentNoteId) return;
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    const oldEventId = note.linkedEventId;
    note.linkedEventId = eventId || null;
    note.updatedAt = new Date().toISOString();
    StorageManager.saveNotes(notes);

    // Mettre à jour la liaison réciproque sur l'événement d'agenda
    const events = StorageManager.getEvents();
    if (oldEventId && oldEventId !== eventId) {
      const oldEvt = events.find(e => e.id === oldEventId);
      if (oldEvt && oldEvt.noteId === note.id) {
        oldEvt.noteId = null;
      }
    }
    if (eventId) {
      const newEvt = events.find(e => e.id === eventId);
      if (newEvt) {
        newEvt.noteId = note.id;
      }
    }
    StorageManager.saveEvents(events);

    const btnView = document.getElementById('btn-note-view-event');
    if (btnView) btnView.style.display = eventId ? 'inline-flex' : 'none';

    this.renderNotesList();
    if (typeof window !== 'undefined' && window.AgendaManager) window.AgendaManager.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(eventId ? "Note liée au créneau d'agenda" : "Liaison retirée", "info");
    }
  },

  viewLinkedEventInAgenda() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    const events = StorageManager.getEvents();
    const targetEvt = events.find(e => e.id === note.linkedEventId || e.noteId === note.id);
    if (!targetEvt) {
      if (typeof window !== 'undefined' && window.App) window.App.showToast("Le créneau d'agenda lié est introuvable", "warning");
      return;
    }

    if (typeof window !== 'undefined' && window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
    }

    if (typeof window !== 'undefined' && window.AgendaManager && targetEvt.start) {
      const evtDate = new Date(targetEvt.start.slice(0, 10));
      if (!isNaN(evtDate.getTime())) {
        const day = evtDate.getDay();
        const diff = evtDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(evtDate.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        window.AgendaManager.currentWeekStart = monday;
        window.AgendaManager.render();
      }
      setTimeout(() => {
        window.AgendaManager.openEventModal(targetEvt.id);
      }, 100);
    }
  },

  scheduleEventForCurrentNote() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    if (typeof window !== 'undefined' && window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
    }

    if (typeof window !== 'undefined' && window.AgendaManager) {
      window.AgendaManager.openEventModal(null, {
        title: `Note: ${note.title}`,
        noteId: note.id
      });
    }
  },

  updateCurrentNoteTitle(title) {
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    note.title = title.trim() || 'Sans titre';
    note.updatedAt = new Date().toISOString();
    StorageManager.saveNotes(notes);
    this.renderNotesList();
  },

  updateCurrentNoteContent(content) {
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    note.content = content;
    note.updatedAt = new Date().toISOString();
    this._pendingNotesToSave = notes;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._pendingNotesToSave = null;
      StorageManager.saveNotes(notes);
    }, 300);
  },

  deleteCurrentNote() {
    this.flushPendingSave();
    if (!this.currentNoteId) return;
    if (typeof confirm === 'function' && !confirm("Voulez-vous supprimer cette note ?")) return;
    let notes = this.getAll();
    notes = notes.filter(n => n.id !== this.currentNoteId);
    this.saveAll(notes);
    this.currentNoteId = notes.length > 0 ? notes[0].id : null;
    this.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Note supprimée", "info");
    }
  },

  exportCurrentNote() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Fichier .md exporté pour Obsidian", "success");
      }
    }
  },

  renderNotesList() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('notes-list-container');
    if (!listEl) return;

    const notes = this.getAll();
    const filteredByProject = notes.filter(n => {
      if (!this.currentProjectFilter || this.currentProjectFilter === 'all') return true;
      if (this.currentProjectFilter === 'personal') return !n.projectId;
      return n.projectId === this.currentProjectFilter;
    });

    const filtered = filteredByProject.filter(n => 
      !this.searchQuery || 
      n.title.toLowerCase().includes(this.searchQuery) || 
      n.content.toLowerCase().includes(this.searchQuery)
    );

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-dim); font-size: 0.82rem;">Aucune note trouvée.</div>`;
      return;
    }

    const allEvents = StorageManager.getEvents();
    const eventByNoteOrId = new Map();
    for (let i = 0; i < allEvents.length; i++) {
      const e = allEvents[i];
      if (e.id) eventByNoteOrId.set(e.id, e);
      if (e.noteId) eventByNoteOrId.set(e.noteId, e);
    }

    const allProjects = StorageManager.getProjects();
    const projectById = new Map();
    for (let i = 0; i < allProjects.length; i++) {
      const p = allProjects[i];
      if (p.id) projectById.set(p.id, p);
    }

    listEl.innerHTML = '';
    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === this.currentNoteId ? 'active' : ''}`;
      item.onclick = () => this.selectNote(note.id);

      const updatedDate = new Date(note.updatedAt || note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const linkedEvt = (note.linkedEventId ? eventByNoteOrId.get(note.linkedEventId) : null) || eventByNoteOrId.get(note.id);
      let eventBadge = '';
      if (linkedEvt) {
        const timeStr = linkedEvt.start ? linkedEvt.start.slice(5, 10).replace('-', '/') : '';
        eventBadge = `<span class="badge" style="background:rgba(56,189,248,0.15); color:var(--accent); font-size:0.7rem; padding:1px 6px; border-radius:4px;" title="Lié à : ${this.escapeHtml(linkedEvt.title)}">📅 ${timeStr || 'Agenda'}</span>`;
      }

      let projectBadge = '';
      if (note.projectId && projectById.has(note.projectId)) {
        const proj = projectById.get(note.projectId);
        projectBadge = `<span class="badge" style="background:rgba(99,102,241,0.15); color:var(--primary, #6366f1); font-size:0.7rem; padding:1px 6px; border-radius:4px;" title="Projet : ${this.escapeHtml(proj.title)}">📁 ${this.escapeHtml(proj.title)}</span>`;
      }

      item.innerHTML = `
        <div class="note-item-title">${this.escapeHtml(note.title)}</div>
        <div class="note-item-meta" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>📁 ${this.escapeHtml(note.folder || 'Notes')}</span>
          <span>• ${updatedDate}</span>
          ${projectBadge}
          ${eventBadge}
        </div>
      `;
      listEl.appendChild(item);
    });
  },

  updatePreview(markdown) {
    if (typeof document === 'undefined') return;
    const previewEl = document.getElementById('notes-preview-container');
    if (!previewEl) return;
    previewEl.innerHTML = this.simpleMarkdownToHtml(markdown);
  },

  // Gestionnaire sécurisé de navigation pour les liens cliqués dans l'aperçu
  handleLinkClick(e) {
    if (!e) return false;
    const target = e.target;
    const link = (target && typeof target.closest === 'function') ? target.closest('a') : null;
    if (link) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      const href = (typeof link.getAttribute === 'function' ? link.getAttribute('href') : link.href) || '';
      // Seuls les protocoles HTTP et HTTPS sont autorisés à ouvrir le navigateur externe
      if (/^https?:\/\//i.test(href)) {
        if (typeof window !== 'undefined' && window.AntigraviteAPI && typeof window.AntigraviteAPI.openExternal === 'function') {
          window.AntigraviteAPI.openExternal(href);
          return true;
        }
      }
      return false;
    }
    return undefined;
  },

  // Basculer une checkbox de tâche interactive dans l'aperçu
  toggleTaskCheckbox(lineIndex) {
    if (!this.currentNoteId) return;
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    const lines = note.content.split(/\r?\n/);
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const targetLine = lines[lineIndex];
    if (/^- \[ \] /.test(targetLine)) {
      lines[lineIndex] = targetLine.replace(/^- \[ \] /, '- [x] ');
    } else if (/^- \[(?:x|X)\] /.test(targetLine)) {
      lines[lineIndex] = targetLine.replace(/^- \[(?:x|X)\] /, '- [ ] ');
    } else {
      return;
    }

    const newContent = lines.join('\n');
    note.content = newContent;
    note.updatedAt = new Date().toISOString();

    if (typeof document !== 'undefined') {
      const textarea = document.getElementById('note-body-editor');
      if (textarea) textarea.value = newContent;
    }

    this.updateCurrentNoteContent(newContent);
    this.updatePreview(newContent);
  },

  // Gestion du curseur et de la sélection pour la barre d'outils
  applyFormatting(action) {
    if (typeof document === 'undefined') return;
    const textarea = document.getElementById('note-body-editor');
    if (!textarea) return;

    const start = textarea.selectionStart !== undefined ? textarea.selectionStart : 0;
    const end = textarea.selectionEnd !== undefined ? textarea.selectionEnd : 0;
    const text = textarea.value || '';
    const hasSelection = start !== end;
    const selectedText = text.substring(start, end);

    let newText = text;
    let newStart = start;
    let newEnd = end;

    switch (action) {
      case 'bold': {
        const prefix = '**';
        const suffix = '**';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'texte en gras';
          newText = text.substring(0, start) + prefix + placeholder + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'italic': {
        const prefix = '*';
        const suffix = '*';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'texte en italique';
          newText = text.substring(0, start) + prefix + placeholder + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'strikethrough': {
        const prefix = '~~';
        const suffix = '~~';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'texte barré';
          newText = text.substring(0, start) + prefix + placeholder + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'highlight': {
        const prefix = '==';
        const suffix = '==';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'texte surligné';
          newText = text.substring(0, start) + prefix + placeholder + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'code': {
        const prefix = '`';
        const suffix = '`';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'code';
          newText = text.substring(0, start) + prefix + placeholder + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'code-block': {
        if (hasSelection) {
          const insertion = `\n\`\`\`javascript\n${selectedText}\n\`\`\`\n`;
          newText = text.substring(0, start) + insertion + text.substring(end);
          newStart = start + 14;
          newEnd = newStart + selectedText.length;
        } else {
          const placeholder = '// Votre code ici';
          const insertion = `\n\`\`\`javascript\n${placeholder}\n\`\`\`\n`;
          newText = text.substring(0, start) + insertion + text.substring(end);
          newStart = start + 15;
          newEnd = newStart + placeholder.length;
        }
        break;
      }
      case 'link': {
        if (hasSelection) {
          if (/^https?:\/\//i.test(selectedText.trim())) {
            const insertion = `[titre](${selectedText.trim()})`;
            newText = text.substring(0, start) + insertion + text.substring(end);
            newStart = start + 1;
            newEnd = start + 6;
          } else {
            const placeholderUrl = 'https://';
            const insertion = `[${selectedText}](${placeholderUrl})`;
            newText = text.substring(0, start) + insertion + text.substring(end);
            newStart = start + selectedText.length + 3;
            newEnd = newStart + placeholderUrl.length;
          }
        } else {
          const placeholderTitle = 'titre';
          const placeholderUrl = 'https://';
          const insertion = `[${placeholderTitle}](${placeholderUrl})`;
          newText = text.substring(0, start) + insertion + text.substring(end);
          newStart = start + 1;
          newEnd = start + 1 + placeholderTitle.length;
        }
        break;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'bullet':
      case 'number':
      case 'task':
      case 'quote': {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = text.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = text.length;

        const lines = text.substring(lineStart, lineEnd).split('\n');
        const prefixMap = {
          h1: '# ',
          h2: '## ',
          h3: '### ',
          bullet: '- ',
          number: '1. ',
          task: '- [ ] ',
          quote: '> '
        };

        const desiredPrefix = prefixMap[action];

        const modifiedLines = lines.map((line, idx) => {
          if (action === 'h1' || action === 'h2' || action === 'h3') {
            if (line.startsWith(desiredPrefix)) {
              return line.substring(desiredPrefix.length);
            }
            const hMatch = line.match(/^#{1,6}\s+/);
            if (hMatch) {
              return desiredPrefix + line.substring(hMatch[0].length);
            }
            return desiredPrefix + line;
          } else if (action === 'task') {
            if (/^- \[(?: |x|X)\]\s+/.test(line)) {
              return line.replace(/^- \[(?: |x|X)\]\s+/, '');
            } else if (/^[\*\-]\s+/.test(line)) {
              return line.replace(/^[\*\-]\s+/, desiredPrefix);
            }
            return desiredPrefix + line;
          } else if (action === 'bullet') {
            if (/^[\*\-]\s+/.test(line)) {
              return line.replace(/^[\*\-]\s+/, '');
            }
            return desiredPrefix + line;
          } else if (action === 'number') {
            if (/^\d+\.\s+/.test(line)) {
              return line.replace(/^\d+\.\s+/, '');
            }
            return `${idx + 1}. ` + line;
          } else if (action === 'quote') {
            if (/^>\s?/.test(line)) {
              return line.replace(/^>\s?/, '');
            }
            return desiredPrefix + line;
          }
          return line;
        });

        const joined = modifiedLines.join('\n');
        newText = text.substring(0, lineStart) + joined + text.substring(lineEnd);
        newStart = lineStart;
        newEnd = lineStart + joined.length;
        break;
      }
    }

    textarea.value = newText;
    this.updateCurrentNoteContent(newText);
    this.updatePreview(newText);

    if (typeof textarea.focus === 'function') {
      textarea.focus();
    }
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(newStart, newEnd);
    }

    return { value: newText, selectionStart: newStart, selectionEnd: newEnd };
  },

  handleKeyDown(e) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (e.key === 'Tab') {
      this.handleTab(e);
      return;
    }

    if (modKey) {
      const key = (e.key || '').toLowerCase();
      if (key === 'b' && !e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('bold');
      } else if (key === 'i' && !e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('italic');
      } else if (key === 'h' && e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('highlight');
      } else if (key === 'x' && e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('strikethrough');
      } else if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('link');
      }
    }
  },

  handleTab(e) {
    const textarea = e.target;
    if (!textarea) return;
    const start = textarea.selectionStart !== undefined ? textarea.selectionStart : 0;
    const end = textarea.selectionEnd !== undefined ? textarea.selectionEnd : 0;
    const text = textarea.value || '';

    e.preventDefault();

    if (e.shiftKey) {
      // Désindentation (retirer jusqu'à 2 espaces en début de ligne)
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = text.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = text.length;

      const lines = text.substring(lineStart, lineEnd).split('\n');
      let removedCharsTotal = 0;
      const modifiedLines = lines.map(line => {
        if (line.startsWith('  ')) {
          removedCharsTotal += 2;
          return line.substring(2);
        } else if (line.startsWith(' ') || line.startsWith('\t')) {
          removedCharsTotal += 1;
          return line.substring(1);
        }
        return line;
      });

      const joined = modifiedLines.join('\n');
      textarea.value = text.substring(0, lineStart) + joined + text.substring(lineEnd);
      if (typeof textarea.setSelectionRange === 'function') {
        textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - removedCharsTotal));
      }
    } else {
      if (start !== end && text.substring(start, end).includes('\n')) {
        // Multiligne : indenter chaque ligne de 2 espaces
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = text.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = text.length;

        const lines = text.substring(lineStart, lineEnd).split('\n');
        const modifiedLines = lines.map(line => '  ' + line);
        const joined = modifiedLines.join('\n');
        textarea.value = text.substring(0, lineStart) + joined + text.substring(lineEnd);
        if (typeof textarea.setSelectionRange === 'function') {
          textarea.setSelectionRange(start + 2, end + (lines.length * 2));
        }
      } else {
        // Simple insertion de 2 espaces
        textarea.value = text.substring(0, start) + '  ' + text.substring(end);
        if (typeof textarea.setSelectionRange === 'function') {
          textarea.setSelectionRange(start + 2, start + 2);
        }
      }
    }

    this.updateCurrentNoteContent(textarea.value);
    this.updatePreview(textarea.value);
  },

  syncScroll(source) {
    if (this._isSyncingScroll || typeof document === 'undefined') return;
    const textarea = document.getElementById('note-body-editor');
    const preview = document.getElementById('notes-preview-container');
    if (!textarea || !preview) return;

    this._isSyncingScroll = true;
    if (source === 'editor') {
      const maxScroll = textarea.scrollHeight - textarea.clientHeight;
      if (maxScroll > 0) {
        const ratio = textarea.scrollTop / maxScroll;
        preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      }
    } else if (source === 'preview') {
      const maxScroll = preview.scrollHeight - preview.clientHeight;
      if (maxScroll > 0) {
        const ratio = preview.scrollTop / maxScroll;
        textarea.scrollTop = ratio * (textarea.scrollHeight - textarea.clientHeight);
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this._isSyncingScroll = false;
      });
    } else {
      setTimeout(() => {
        this._isSyncingScroll = false;
      }, 50);
    }
  },

  // Parseur Markdown complet, sécurisé et compatible Obsidian
  simpleMarkdownToHtml(md) {
    if (md === null || md === undefined) return '';
    if (typeof md !== 'string') md = String(md);
    if (!md.trim()) {
      return '<div class="notes-preview-empty">Rédigez votre note en Markdown pour voir l\'aperçu instantané.</div>';
    }

    let raw = md;

    // 1. Protection des blocs de code clôturés (```lang\n...\n```)
    const codeBlocks = [];
    raw = raw.replace(/```([a-zA-Z0-9_\-\+]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim(), code: code });
      return `%%CODEBLOCK_${idx}%%`;
    });

    // 2. Protection du code inline (`code`)
    const inlineCodes = [];
    raw = raw.replace(/`([^`\r\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(code);
      return `%%INLINECODE_${idx}%%`;
    });

    // 3. Échappement HTML strict de tout le contenu restant (sécurité XSS absolue)
    raw = this.escapeHtml(raw);

    // 4. Frontmatter YAML Obsidian au début du document (^---\n...\n---)
    raw = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/, (match, frontmatter) => {
      return `<div class="obsidian-frontmatter"><div class="obsidian-frontmatter-title">Metadata YAML (Obsidian)</div><pre style="margin:0; font-family:monospace; font-size:0.8rem;">${frontmatter}</pre></div>\n\n`;
    });

    // 5. Callouts Obsidian (> [!NOTE] / > [!WARNING] etc.) et Citations Markdown standard (> )
    const lines = raw.split(/\r?\n/);
    const processedLines = [];
    let inBlockquote = false;
    let blockquoteLines = [];
    let calloutType = null;
    let calloutTitle = null;

    const flushBlockquote = () => {
      if (!inBlockquote) return;
      if (calloutType) {
        const iconMap = {
          note: '📌',
          info: 'ℹ️',
          tip: '💡',
          warning: '⚠️',
          caution: '⚠️',
          danger: '🚨',
          error: '❌',
          success: '✅',
          important: '❗'
        };
        const icon = iconMap[calloutType] || '📌';
        const bodyHtml = blockquoteLines.join('<br>');
        processedLines.push(`<div class="obsidian-callout obsidian-callout-${calloutType}"><div class="obsidian-callout-title"><span class="callout-icon">${icon}</span> ${calloutTitle}</div><div class="obsidian-callout-body">${bodyHtml}</div></div>`);
      } else {
        processedLines.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`);
      }
      inBlockquote = false;
      blockquoteLines = [];
      calloutType = null;
      calloutTitle = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bqMatch = line.match(/^(?:>|&gt;)\s?(.*)$/);
      if (bqMatch) {
        const content = bqMatch[1];
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteLines = [];
          const calloutMatch = content.match(/^\[!([a-zA-Z0-9_\-]+)\]\s*(.*)$/);
          if (calloutMatch) {
            calloutType = calloutMatch[1].toLowerCase();
            calloutTitle = calloutMatch[2] || calloutMatch[1].toUpperCase();
          } else {
            calloutType = null;
            calloutTitle = null;
            blockquoteLines.push(content);
          }
        } else {
          blockquoteLines.push(content);
        }
      } else {
        flushBlockquote();
        processedLines.push(line);
      }
    }
    flushBlockquote();
    raw = processedLines.join('\n');

    // 6. Titres Markdown (# à ######)
    raw = raw.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    raw = raw.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    raw = raw.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    raw = raw.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    raw = raw.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    raw = raw.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 7. Surlignage Obsidian (==texte==)
    raw = raw.replace(/==(.+?)==/g, '<mark class="obsidian-highlight">$1</mark>');

    // 8. Barré Markdown (~~texte~~)
    raw = raw.replace(/~~(.+?)~~/g, '<del class="obsidian-del">$1</del>');

    // 9. Gras et Italique
    raw = raw.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    raw = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    raw = raw.replace(/(?<!\*)\*([^\*\r\n]+)\*(?!\*)/g, '<em>$1</em>');
    raw = raw.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    raw = raw.replace(/__(.+?)__/g, '<strong>$1</strong>');
    raw = raw.replace(/(?<!_)_([^_\r\n]+)_(?!_)/g, '<em>$1</em>');

    // 10. Liens internes Obsidian / Wikilinks ([[Document]] ou [[Document|Alias]])
    raw = raw.replace(/\[\[([^\]\|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g, (match, target, alias) => {
      const displayText = alias || target;
      return `<span class="obsidian-wikilink" data-target="${target}" title="${target}">[[${displayText}]]</span>`;
    });

    // 11. Liens Markdown ([texte](url)) sécurisés avec prise en charge des parenthèses équilibrées (ex: Wikipédia)
    raw = raw.replace(/\[([^\]\r\n]+)\]\(\s*((?:[^\s()]|\((?:[^\s()]|\([^\s()]*\))*\))+)\s*\)/g, (match, text, url) => {
      const cleanUrl = url.trim();
      // Bloquer strictement les pseudo-protocoles dangereux
      if (/^(?:javascript|data|vbscript|file):/i.test(cleanUrl)) {
        return `<span>${text}</span>`;
      }
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // 12. Tags Obsidian (#tag)
    raw = raw.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)(?=\s|$)/g, '$1<span class="obsidian-tag">#$2</span>');

    // 13. Checkboxes de tâches interactives (- [ ] et - [x]) et Listes
    const linesForTasks = raw.split(/\r?\n/);
    for (let l = 0; l < linesForTasks.length; l++) {
      const cur = linesForTasks[l];
      if (/^- \[ \] (.*)$/.test(cur)) {
        linesForTasks[l] = cur.replace(/^- \[ \] (.*)$/, (m, taskText) => {
          return `<div class="obsidian-task-item" data-line="${l}"><input type="checkbox" class="obsidian-task-checkbox" data-line="${l}"> <span class="task-text">${taskText}</span></div>`;
        });
      } else if (/^- \[(?:x|X)\] (.*)$/.test(cur)) {
        linesForTasks[l] = cur.replace(/^- \[(?:x|X)\] (.*)$/, (m, taskText) => {
          return `<div class="obsidian-task-item" data-line="${l}"><input type="checkbox" class="obsidian-task-checkbox" checked data-line="${l}"> <span class="task-text task-completed">${taskText}</span></div>`;
        });
      } else if (/^[\*\-] (.*)$/.test(cur) && !cur.startsWith('<div class="obsidian-task-item"') && !cur.startsWith('<li')) {
        linesForTasks[l] = cur.replace(/^[\*\-] (.*)$/, '<li class="obsidian-bullet-item">$1</li>');
      } else if (/^(\d+)\. (.*)$/.test(cur)) {
        linesForTasks[l] = cur.replace(/^(\d+)\. (.*)$/, '<li class="obsidian-number-item" value="$1">$2</li>');
      }
    }
    raw = linesForTasks.join('\n');

    // 14. Ligne horizontale
    raw = raw.replace(/^---$/gm, '<hr class="obsidian-hr">');

    // 15. Restauration des blocs de code clôturés
    raw = raw.replace(/%%CODEBLOCK_(\d+)%%/g, (match, idx) => {
      const cb = codeBlocks[Number(idx)];
      if (!cb) return '';
      const safeCode = this.escapeHtml(cb.code);
      const langLabel = cb.lang ? `<div class="code-header"><span class="code-lang">${this.escapeHtml(cb.lang)}</span></div>` : '';
      return `<pre class="obsidian-code-block">${langLabel}<code>${safeCode}</code></pre>`;
    });

    // 16. Restauration du code inline
    raw = raw.replace(/%%INLINECODE_(\d+)%%/g, (match, idx) => {
      const code = inlineCodes[Number(idx)];
      if (code === undefined) return '';
      return `<code class="obsidian-inline-code">${this.escapeHtml(code)}</code>`;
    });

    // 17. Structuration des paragraphes et retours à la ligne
    const blocks = raw.split(/\n\n+/);
    const htmlBlocks = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      if (
        block.startsWith('<h1') || block.startsWith('<h2') || block.startsWith('<h3') ||
        block.startsWith('<h4') || block.startsWith('<h5') || block.startsWith('<h6') ||
        block.startsWith('<pre') || block.startsWith('<div') || block.startsWith('<blockquote') ||
        block.startsWith('<hr')
      ) {
        return block;
      }
      if (block.startsWith('<li class="obsidian-bullet-item"')) {
        return `<ul class="obsidian-list">${block.split(/\n/).join('')}</ul>`;
      }
      if (block.startsWith('<li class="obsidian-number-item"')) {
        return `<ol class="obsidian-list">${block.split(/\n/).join('')}</ol>`;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n');
  },

  renderMarkdown(md) {
    return this.simpleMarkdownToHtml(md);
  },

  populateProjectFilter() {
    if (typeof document === 'undefined') return;
    const filterSelect = document.getElementById('notes-filter-project');
    if (!filterSelect) return;

    const currentVal = this.currentProjectFilter || 'all';
    const projects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];

    let optionsHtml = `
      <option value="all">📂 Toutes les notes</option>
      <option value="personal">👤 Notes personnelles (sans projet)</option>
    `;

    projects.forEach(p => {
      optionsHtml += `<option value="${p.id}">📁 Projet : ${this.escapeHtml(p.title)}</option>`;
    });

    filterSelect.innerHTML = optionsHtml;
    filterSelect.value = currentVal;
  },

  render() {
    this.populateProjectFilter();
    const notes = this.getAll();
    if (!this.currentNoteId && notes.length > 0) {
      this.currentNoteId = notes[0].id;
    }
    this.renderNotesList();
    if (this.currentNoteId) {
      this.selectNote(this.currentNoteId);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.NotesManager = NotesManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotesManager;
}
