/**
 * Antigravité - Module de Traitement de Texte & Notes Personnelles
 * 
 * Principes fondamentaux :
 * 1. Éditeur de traitement de texte riche WYSIWYG direct (sans mode aperçu / partagé).
 * 2. Formatage complet : Niveaux de titres (H1, H2, H3, P), Gras, Italique, Souligné, Barré,
 *    Surlignage feutre multi-couleurs, Couleurs de police, Listes, Tâches/Checklists, Alignement.
 * 3. Sauvegarde automatique avec débouncing de 300 ms et flush immédiat (changement de note, blur, navigation, fermeture).
 * 4. Rétro-compatibilité intégrale avec les notes créées dans les versions antérieures.
 */

const NotesManager = {
  currentNoteId: null,
  searchQuery: '',
  currentProjectFilter: 'all',
  currentViewMode: 'edit', // Conservé pour rétro-compatibilité
  _saveTimer: null,
  _pendingNotesToSave: null,

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;

    this.render();
    this.bindEvents();
  },

  setViewMode(mode) {
    // Méthode de compatibilité
    this.currentViewMode = mode || 'edit';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('antigravite_notes_view_mode', this.currentViewMode);
    }
    if (typeof document !== 'undefined') {
      const panes = document.getElementById('notes-panes');
      if (panes && panes.classList) {
        panes.classList.remove('mode-edit', 'mode-split', 'mode-preview');
        panes.classList.add('mode-' + this.currentViewMode);
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
      let searchDebounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.renderNotesList();
        }, 80);
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

    const editor = document.getElementById('note-body-editor');
    if (editor) {
      editor.addEventListener('input', () => {
        if (!this.currentNoteId) return;
        const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
        const content = isRich
          ? editor.innerHTML
          : (editor.value !== undefined ? editor.value : editor.innerHTML);
        this.updateCurrentNoteContent(content);
        this.updatePreview(content);
      });

      editor.addEventListener('blur', () => this.flushPendingSave());
      editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
      editor.addEventListener('paste', (e) => this.handlePaste(e));

      // Gestion des cases à cocher interactives dans les notes
      editor.addEventListener('change', (e) => {
        if (e.target && e.target.type === 'checkbox') {
          if (e.target.checked) {
            e.target.setAttribute('checked', 'checked');
          } else {
            e.target.removeAttribute('checked');
          }
          const item = e.target.closest('.note-task-item');
          if (item) {
            item.classList.toggle('checked', e.target.checked);
          }
          const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
          const content = isRich
            ? editor.innerHTML
            : (editor.value !== undefined ? editor.value : editor.innerHTML);
          this.updateCurrentNoteContent(content);
          this.flushPendingSave();
        }
      });

      // Clics sécurisés sur les liens dans les notes
      editor.addEventListener('click', (e) => this.handleLinkClick(e));
    }

    // Sélecteur de style de paragraphe / titre
    const blockSelect = document.getElementById('notes-format-block-select');
    if (blockSelect) {
      blockSelect.addEventListener('change', (e) => {
        this.applyFormatting(e.target.value);
      });
    }

    // Menus déroulants de palettes (Surlignage & Couleur de texte)
    const btnHighlightMenu = document.getElementById('btn-highlight-menu');
    const popoverHighlight = document.getElementById('popover-highlight-palette');
    const btnColorMenu = document.getElementById('btn-color-menu');
    const popoverColor = document.getElementById('popover-color-palette');

    if (btnHighlightMenu && popoverHighlight) {
      btnHighlightMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = popoverHighlight.style.display !== 'none';
        if (popoverColor) popoverColor.style.display = 'none';
        popoverHighlight.style.display = isVisible ? 'none' : 'block';
      });
    }

    if (btnColorMenu && popoverColor) {
      btnColorMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = popoverColor.style.display !== 'none';
        if (popoverHighlight) popoverHighlight.style.display = 'none';
        popoverColor.style.display = isVisible ? 'none' : 'block';
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        if (popoverHighlight && !e.target.closest('#btn-highlight-menu') && !e.target.closest('#popover-highlight-palette')) {
          popoverHighlight.style.display = 'none';
        }
        if (popoverColor && !e.target.closest('#btn-color-menu') && !e.target.closest('#popover-color-palette')) {
          popoverColor.style.display = 'none';
        }
      });
    }

    // Barre d'outils de formatage
    const formatBar = document.getElementById('notes-format-bar');
    if (formatBar) {
      formatBar.addEventListener('click', (e) => {
        const swatch = e.target.closest('.swatch-btn');
        if (swatch && swatch.dataset.action) {
          e.preventDefault();
          this.applyFormatting(swatch.dataset.action, swatch.dataset.value);
          if (popoverHighlight) popoverHighlight.style.display = 'none';
          if (popoverColor) popoverColor.style.display = 'none';
          return;
        }

        const btn = e.target.closest('.btn-format');
        if (btn && btn.dataset.action) {
          e.preventDefault();
          this.applyFormatting(btn.dataset.action, btn.dataset.value);
        }
      });
    }

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
        const opt = (projectSelect.options && projectSelect.selectedIndex >= 0) ? projectSelect.options[projectSelect.selectedIndex] : null;
        projectSelect.title = opt && projectSelect.value ? (opt.textContent || '') : "Associer à un projet";
        this.linkCurrentNoteToProject(e.target.value || null);
      });
    }

    // Liaison avec les créneaux d'Agenda
    const eventSelect = document.getElementById('note-input-event');
    if (eventSelect) {
      eventSelect.addEventListener('change', (e) => {
        const opt = (eventSelect.options && eventSelect.selectedIndex >= 0) ? eventSelect.options[eventSelect.selectedIndex] : null;
        eventSelect.title = opt && eventSelect.value ? (opt.textContent || '') : "Lier cette note à un créneau d'agenda";
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
      const editor = document.getElementById('note-body-editor');
      if (titleInput) titleInput.value = note.title;
      if (editor) {
        const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
        if (isRich) {
          editor.innerHTML = this.formatNoteContentForEditor(note.content);
        } else {
          editor.value = note.content;
          editor.innerHTML = note.content;
        }
      }

      const blockSelect = document.getElementById('notes-format-block-select');
      if (blockSelect) blockSelect.value = 'p';

      this.updatePreview(note.content);
      this.renderProjectSelector(note);
      this.renderEventSelector(note);
      this.renderNotesList();
    }
  },

  formatNoteContentForEditor(raw) {
    if (!raw) return '';
    if (typeof raw !== 'string') raw = String(raw);
    // Si la note contient déjà du HTML riche
    if (/<(?:p|div|b|strong|i|em|u|s|mark|h1|h2|h3|h4|ul|ol|li|blockquote|code|table|br)[\s\S]*>/i.test(raw)) {
      return raw;
    }
    // Rétro-compatibilité : conversion douce des notes textuelles/markdown antérieures
    return this.simpleMarkdownToHtml(raw);
  },

  renderProjectSelector(note) {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('note-input-project');
    if (!select) return;

    const projects = StorageManager.getProjects();
    const hierProjects = (typeof StorageManager.getProjectsHierarchy === 'function')
      ? StorageManager.getProjectsHierarchy(projects)
      : projects.map(p => ({ project: p, displayTitle: p.title || p.name || 'Projet sans nom' }));
    select.innerHTML = '<option value="">(Aucun projet)</option>';
    let selectedProj = null;
    hierProjects.forEach(({ project: p, displayTitle }) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = displayTitle || p.title || p.name || 'Projet sans nom';
      if (note && note.projectId === p.id) {
        opt.selected = true;
        selectedProj = p;
      }
      select.appendChild(opt);
    });

    // Colorer le sélecteur selon la couleur du projet associé
    if (selectedProj && selectedProj.color) {
      select.style.borderColor = selectedProj.color;
      select.style.color = selectedProj.color;
      select.style.fontWeight = '600';
    } else {
      select.style.borderColor = '';
      select.style.color = '';
      select.style.fontWeight = '';
    }

    // Infobulle native pour voir l'intitulé complet au survol
    select.title = selectedProj ? (selectedProj.title || selectedProj.name || 'Projet') : "Associer à un projet";
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
    this.renderProjectSelector(note);
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
    select.innerHTML = '<option value="">(Aucun créneau lié)</option>';

    const todayIso = new Date().toISOString().slice(0, 10);
    const in7DaysIso = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const getEventTimestamp = (e) => {
      if (!e || !e.start) return 0;
      const iso = e.start.length === 10 ? `${e.start}T00:00:00` : e.start;
      const t = new Date(iso).getTime();
      return isNaN(t) ? 0 : t;
    };

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

    // Tri chronologique strict à l'intérieur de chaque groupe
    groupThisWeek.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
    groupUpcoming.sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
    groupPast.sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a)); // Plus récents passés en premier pour se repérer immédiatement

    const formatEventOptionLabel = (e) => {
      if (!e || !e.start) return `${e.title || 'Sans titre'} (Date indéfinie)`;
      const rawDate = e.start.slice(0, 10);
      const isAllDay = !e.start.includes('T') || e.allDay || e.isAllDay;
      const timeStr = !isAllDay && e.start.length >= 16 ? e.start.slice(11, 16) : '';

      let datePrefix = rawDate;
      try {
        const [y, m, d] = rawDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (!isNaN(dateObj.getTime())) {
          const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
          const dayName = dayNames[dateObj.getDay()];
          const dd = String(d).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          datePrefix = `${dayName} ${dd}/${mm}`;
        }
      } catch (_) {}

      const timeLabel = isAllDay ? 'Journée entière' : timeStr;
      const googleTag = e.source === 'google' ? ' [Google]' : '';
      const timePartFormatted = timeLabel ? `à ${timeLabel}` : '';
      return `${datePrefix} ${timePartFormatted} — ${e.title || 'Sans titre'}${googleTag}`;
    };

    const appendGroup = (label, list) => {
      if (list.length === 0) return;
      const grp = document.createElement('optgroup');
      grp.label = label;
      list.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = formatEventOptionLabel(e);
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

    // Infobulle native pour consulter l'intitulé complet au survol (même si tronqué avec ellipsis)
    const selectedOpt = (select.options && select.selectedIndex >= 0) ? select.options[select.selectedIndex] : null;
    if (selectedOpt && select.value) {
      select.title = selectedOpt.textContent || '';
    } else {
      select.title = "Lier cette note à un créneau d'agenda";
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
    if (!this.currentNoteId) {
      const notes = this.getAll();
      if (notes.length > 0) {
        this.selectNote(notes[0].id);
      } else {
        const newNote = this.createNote();
        if (newNote) this.selectNote(newNote.id);
      }
    }
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    if (typeof window !== 'undefined' && window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
    }

    if (typeof window !== 'undefined' && window.AgendaManager) {
      let eventColor = null;
      if (note.projectId && typeof StorageManager !== 'undefined') {
        const projects = StorageManager.getProjects();
        const p = projects.find(pr => pr.id === note.projectId);
        if (p && p.color) eventColor = p.color;
      }

      window.AgendaManager.openEventModal(null, {
        title: `Note: ${note.title}`,
        noteId: note.id,
        color: eventColor || '#8b5cf6'
      });
    }
  },

  _scheduleSave(notes) {
    this._pendingNotesToSave = notes;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._pendingNotesToSave = null;
      StorageManager.saveNotes(notes);
    }, 300);
  },

  updateCurrentNoteTitle(title) {
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    note.title = title.trim() || 'Sans titre';
    note.updatedAt = new Date().toISOString();
    this._scheduleSave(notes);

    // Mise à jour DOM ciblée du titre actif sans reconstruire toute la liste des notes
    if (!this.searchQuery && typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const activeTitleEl = document.querySelector('#notes-list-container .note-item.active .note-item-title');
      if (activeTitleEl) {
        if (activeTitleEl.textContent !== note.title) activeTitleEl.textContent = note.title;
        return;
      }
    }
    this.renderNotesList();
  },

  updateCurrentNoteContent(content) {
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;
    note.content = content;
    note.updatedAt = new Date().toISOString();
    this._scheduleSave(notes);
  },

  async deleteCurrentNote() {
    this.flushPendingSave();
    if (!this.currentNoteId) return;

    let notes = this.getAll();
    const noteToDelete = notes.find(n => n.id === this.currentNoteId);
    if (noteToDelete && typeof TrashManager !== 'undefined' && typeof TrashManager.moveToTrash === 'function') {
      TrashManager.moveToTrash('note', noteToDelete);
    }

    notes = notes.filter(n => n.id !== this.currentNoteId);
    this.saveAll(notes);
    this.currentNoteId = notes.length > 0 ? notes[0].id : null;
    this.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Note déplacée dans la corbeille", "info");
    }
  },

  exportCurrentNote() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      const isHtml = /<[a-z][\s\S]*>/i.test(note.content);
      const ext = isHtml ? 'html' : 'txt';
      const mime = isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
      let exportBody = note.content;
      if (isHtml) {
        exportBody = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${this.escapeHtml(note.title)}</title>\n<style>body{font-family:sans-serif;max-width:820px;margin:40px auto;line-height:1.7;padding:0 20px;}h1,h2,h3{color:#1e293b;}blockquote{border-left:4px solid #38bdf8;margin:1em 0;padding:8px 16px;background:#f8fafc;color:#64748b;}</style>\n</head>\n<body>\n<h1>${this.escapeHtml(note.title)}</h1>\n${note.content}\n</body>\n</html>`;
      }
      const blob = new Blob([exportBody], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-')}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Note exportée (${ext})`, "success");
      }
    }
  },

  renderNotesList() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('notes-list-container');
    if (!listEl) return;

    const notes = this.getAll();
    const filteredByProject = notes.filter(n => {
      const pId = n.projectId || n.linkedProjectId;
      if (!this.currentProjectFilter || this.currentProjectFilter === 'all') return true;
      if (this.currentProjectFilter === 'personal') return !pId;
      return pId === this.currentProjectFilter;
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

    if (!this._shortDateFmt && typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      this._shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
    }
    const _frag = typeof document.createDocumentFragment === 'function' ? document.createDocumentFragment() : null;
    const useFrag = !!(_frag && (_frag.nodeType === 11 || typeof DocumentFragment !== 'undefined'));
    const frag = useFrag ? _frag : listEl;
    if (!useFrag) listEl.innerHTML = '';

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === this.currentNoteId ? 'active' : ''}`;
      if (item.dataset) item.dataset.noteId = note.id;
      item.onclick = () => this.selectNote(note.id);

      const noteProjId = note.projectId || note.linkedProjectId;
      const proj = noteProjId ? projectById.get(noteProjId) : null;
      let projectBadge = '';
      if (proj) {
        const projColor = proj.color || '#6366f1';
        item.style.borderLeft = `4px solid ${projColor}`;
        item.dataset.hasProject = 'true';
        if (item.style && typeof item.style.setProperty === 'function') {
          item.style.setProperty('--note-project-color', projColor);
        }
        if (note.id === this.currentNoteId) {
          item.style.backgroundColor = `${projColor}16`;
        }
        projectBadge = `<span class="badge badge-project" style="background:${projColor}20; color:${projColor}; border:1px solid ${projColor}60; font-size:0.72rem; padding:1px 7px; border-radius:4px; font-weight:600;" title="Projet : ${this.escapeHtml(proj.title)}"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${projColor}; margin-right:4px; vertical-align:middle;"></span>📁 ${this.escapeHtml(proj.title)}</span>`;
      }

      const rawDate = note.updatedAt || note.createdAt;
      const dObj = rawDate ? new Date(rawDate) : null;
      const updatedDate = (dObj && !isNaN(dObj.getTime()))
        ? (this._shortDateFmt ? this._shortDateFmt.format(dObj) : dObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))
        : '';
      const linkedEvt = (note.linkedEventId ? eventByNoteOrId.get(note.linkedEventId) : null) || eventByNoteOrId.get(note.id);
      let eventBadge = '';
      if (linkedEvt) {
        const timeStr = linkedEvt.start ? linkedEvt.start.slice(5, 10).replace('-', '/') : '';
        eventBadge = `<span class="badge" style="background:rgba(56,189,248,0.15); color:var(--accent); font-size:0.7rem; padding:1px 6px; border-radius:4px;" title="Lié à : ${this.escapeHtml(linkedEvt.title)}">📅 ${timeStr || 'Agenda'}</span>`;
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
      frag.appendChild(item);
    });

    if (useFrag) {
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }
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

  // Gestionnaire de collage avec nettoyage et assainissement automatique
  handlePaste(e) {
    if (!e || !e.clipboardData) return;
    
    // Si l'éditeur n'est pas actif ou qu'aucune note n'est sélectionnée, laisser le comportement par défaut
    if (!this.currentNoteId) return;

    const clipboardData = e.clipboardData;
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    // Si aucun contenu exploitable
    if (!html && !text) return;

    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    let sanitizedHtml = '';

    if (html && html.trim()) {
      sanitizedHtml = this.sanitizePastedHtml(html);
    } else if (text) {
      // Pour du texte brut : échapper les caractères spéciaux HTML et transformer les sauts de ligne en <br>
      sanitizedHtml = this.escapeHtml(text)
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, '<br>');
    }

    if (sanitizedHtml && typeof document !== 'undefined') {
      const editor = document.getElementById('note-body-editor');
      let inserted = false;
      if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
        try {
          inserted = document.execCommand('insertHTML', false, sanitizedHtml);
        } catch (_cmdErr) {
          inserted = false;
        }
      }
      
      if (!inserted && typeof window !== 'undefined' && window.getSelection) {
        // Fallback d'insertion par Selection / Range API
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = sanitizedHtml;
          const frag = document.createDocumentFragment();
          let node;
          while ((node = tempDiv.firstChild)) {
            frag.appendChild(node);
          }
          range.insertNode(frag);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          inserted = true;
        } else if (editor) {
          editor.innerHTML += sanitizedHtml;
          inserted = true;
        }
      }

      if (editor) {
        const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
        const content = isRich
          ? editor.innerHTML
          : (editor.value !== undefined ? editor.value : editor.innerHTML);
        this.updateCurrentNoteContent(content);
        this.updatePreview(content);
      }
    }
  },

  // Nettoyage rigoureux du code HTML externe collé (Word, sites Web, Google Docs)
  // Supprime tous les styles inline (color, font, size, bg) incompatibles avec les modes clair/sombre,
  // tout en préservant le balisage sémantique riche (gras, italique, titres, listes, liens, etc.)
  sanitizePastedHtml(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    try {
      if (typeof DOMParser === 'undefined') return this.escapeHtml(rawHtml);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      const body = doc.body;
      if (!body) return this.escapeHtml(rawHtml);

      // 1. Supprimer les éléments potentiellement dangereux, invisibles ou parasites
      const disallowedTags = [
        'script', 'style', 'iframe', 'object', 'embed', 'applet',
        'form', 'input', 'button', 'select', 'textarea', 'meta',
        'link', 'head', 'title', 'base', 'svg', 'canvas', 'xml'
      ];
      disallowedTags.forEach(tag => {
        body.querySelectorAll(tag).forEach(el => el.remove());
      });

      // 2. Supprimer les commentaires HTML (<!-- ... --> souvent injectés par Word)
      const removeComments = (node) => {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          const child = node.childNodes[i];
          if (child.nodeType === 8) {
            child.remove();
          } else if (child.nodeType === 1) {
            removeComments(child);
          }
        }
      };
      removeComments(body);

      // 3. Nettoyer les attributs de tous les éléments restants
      const allElements = body.querySelectorAll('*');
      allElements.forEach(el => {
        const tag = el.tagName.toLowerCase();
        const attrs = Array.from(el.attributes);

        for (const attr of attrs) {
          const name = attr.name.toLowerCase();

          // Supprimer systématiquement les gestionnaires d'événements JavaScript (onclick, onmouseover, onload, etc.)
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            continue;
          }

          // Supprimer tous les styles inline (color, background, font-family, font-size, etc.)
          // qui provoquent des conflits de contraste avec le mode sombre/clair
          if (name === 'style') {
            el.removeAttribute(attr.name);
            continue;
          }

          // Supprimer les classes et identifiants parasites (Word MsoNormal, Google Docs spans, etc.)
          if (name === 'class' || name === 'id') {
            // Conserver uniquement les classes internes à Antigravité (si copié d'une autre note)
            if (name === 'class' && (attr.value.includes('note-') || attr.value.includes('obsidian-'))) {
              continue;
            }
            el.removeAttribute(attr.name);
            continue;
          }

          // Nettoyage spécifique des liens <a>
          if (tag === 'a') {
            if (name === 'href') {
              const href = attr.value.trim();
              if (href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:')) {
                el.removeAttribute(attr.name);
              }
            } else if (name !== 'target' && name !== 'rel' && name !== 'title') {
              el.removeAttribute(attr.name);
            }
          } else if (name !== 'title') {
            // Supprimer tous les attributs non essentiels
            el.removeAttribute(attr.name);
          }
        }

        // Pour les liens restants valides, assurer target="_blank" et rel="noopener noreferrer"
        if (tag === 'a' && el.hasAttribute('href')) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }

        // Épurer les spans vides ou inutiles n'ayant aucun attribut
        if (tag === 'span' && el.attributes.length === 0) {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        }
      });

      return body.innerHTML.trim();
    } catch (err) {
      console.warn('[NotesManager] Erreur assainissement HTML collé :', err);
      return this.escapeHtml(rawHtml);
    }
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
      if (textarea) {
        const isRich = textarea.isContentEditable || (typeof textarea.getAttribute === 'function' && textarea.getAttribute('contenteditable') === 'true');
        if (isRich) {
          textarea.innerHTML = this.formatNoteContentForEditor(newContent);
        } else {
          textarea.value = newContent;
        }
      }
    }

    this.updateCurrentNoteContent(newContent);
    this.updatePreview(newContent);
  },

  // Gestion du curseur et de la sélection pour la barre d'outils
  applyFormatting(action, value) {
    if (typeof document === 'undefined') return;
    const editor = document.getElementById('note-body-editor');
    if (!editor) return;

    const isContentEditable = editor.isContentEditable || 
      (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');

    if (isContentEditable && typeof document.execCommand === 'function') {
      if (typeof editor.focus === 'function') {
        editor.focus();
      }
      switch (action) {
        case 'bold':
          document.execCommand('bold', false, null);
          break;
        case 'italic':
          document.execCommand('italic', false, null);
          break;
        case 'underline':
          document.execCommand('underline', false, null);
          break;
        case 'strikethrough':
          document.execCommand('strikeThrough', false, null);
          break;
        case 'highlight': {
          const color = value || '#fef08a';
          if (color === 'transparent' || color === 'remove') {
            document.execCommand('removeFormat', false, null);
          } else {
            if (!document.execCommand('hiliteColor', false, color)) {
              document.execCommand('backColor', false, color);
            }
          }
          break;
        }
        case 'color': {
          const color = value || '#1e293b';
          document.execCommand('foreColor', false, color);
          break;
        }
        case 'h1':
          document.execCommand('formatBlock', false, '<h1>');
          break;
        case 'h2':
          document.execCommand('formatBlock', false, '<h2>');
          break;
        case 'h3':
          document.execCommand('formatBlock', false, '<h3>');
          break;
        case 'p':
          document.execCommand('formatBlock', false, '<p>');
          break;
        case 'quote':
          document.execCommand('formatBlock', false, '<blockquote>');
          break;
        case 'bullet':
          document.execCommand('insertUnorderedList', false, null);
          break;
        case 'number':
          document.execCommand('insertOrderedList', false, null);
          break;
        case 'task': {
          const taskHtml = '<div class="note-task-item"><input type="checkbox"> <span class="task-text">&nbsp;</span></div>';
          document.execCommand('insertHTML', false, taskHtml);
          break;
        }
        case 'align-left':
          document.execCommand('justifyLeft', false, null);
          break;
        case 'align-center':
          document.execCommand('justifyCenter', false, null);
          break;
        case 'align-right':
          document.execCommand('justifyRight', false, null);
          break;
        case 'hr':
          document.execCommand('insertHorizontalRule', false, null);
          break;
        case 'code': {
          const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection().toString() : '';
          document.execCommand('insertHTML', false, `<code>${sel || 'code'}</code>`);
          break;
        }
        case 'link': {
          let url = value;
          if (!url && typeof window !== 'undefined' && typeof window.prompt === 'function') {
            url = window.prompt("Entrez l'URL du lien :", "https://");
          }
          if (url) {
            document.execCommand('createLink', false, url);
          }
          break;
        }
        case 'clear':
          document.execCommand('removeFormat', false, null);
          break;
      }
      const newHtml = editor.innerHTML;
      this.updateCurrentNoteContent(newHtml);
      return { value: newHtml };
    }

    // Mode fallback pour textarea / mock headless (compatible tests unitaires Node.js)
    const textarea = editor;
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
      case 'underline': {
        const prefix = '<u>';
        const suffix = '</u>';
        if (hasSelection) {
          newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
          newStart = start + prefix.length;
          newEnd = end + prefix.length;
        } else {
          const placeholder = 'texte souligné';
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
      case 'p':
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
          p: '',
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
          } else if (action === 'p') {
            return line.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/^[\*\-]\s+/, '').replace(/^\d+\.\s+/, '');
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
      } else if (key === 'u' && !e.shiftKey) {
        e.preventDefault();
        this.applyFormatting('underline');
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
    const hierProjects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
      ? StorageManager.getProjectsHierarchy(projects)
      : projects.map(p => ({ project: p, pathTitle: p.title }));

    let optionsHtml = `
      <option value="all">📂 Toutes les notes</option>
      <option value="personal">👤 Notes personnelles (sans projet)</option>
    `;

    hierProjects.forEach(({ project: p, displayTitle }) => {
      optionsHtml += `<option value="${p.id}">📁 Projet : ${this.escapeHtml(displayTitle || p.title)}</option>`;
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
