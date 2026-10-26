/**
 * Antigravité - Module de Gestion des Notes
 * Compatible avec la structure Markdown d'Obsidian.
 */

const NotesManager = {
  currentNoteId: null,
  searchQuery: '',
  _saveTimer: null,
  _pendingNotesToSave: null,

  init() {
    this.render();
    this.bindEvents();
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
    }

    const btnExport = document.getElementById('btn-export-note');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCurrentNote());
    }

    const btnDelete = document.getElementById('btn-delete-note');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => this.deleteCurrentNote());
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
    const notes = this.getAll();
    const newNote = {
      id: 'note-' + Date.now(),
      title: 'Nouvelle note',
      folder: 'Général',
      tags: [],
      linkedEventId: null,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    this.saveAll(notes);
    this.selectNote(newNote.id);
    if (window.App) window.App.showToast("Note créée", "success");
  },

  selectNote(id) {
    this.flushPendingSave();
    this.currentNoteId = id;
    const notes = this.getAll();
    const note = notes.find(n => n.id === id);
    if (!note) return;

    const titleInput = document.getElementById('note-title-editor');
    const textarea = document.getElementById('note-body-editor');
    if (titleInput) titleInput.value = note.title;
    if (textarea) textarea.value = note.content;

    this.updatePreview(note.content);
    this.renderEventSelector(note);
    this.renderNotesList();
  },

  renderEventSelector(note) {
    const select = document.getElementById('note-input-event');
    const btnView = document.getElementById('btn-note-view-event');
    if (!select) return;

    const events = StorageManager.getEvents();
    // Trier les créneaux chronologiquement
    events.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    select.innerHTML = '<option value="">(Aucun créneau d\'agenda associé)</option>';
    events.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      const datePart = e.start ? e.start.replace('T', ' à ') : 'Date non définie';
      opt.textContent = `${e.title} (${datePart})${e.source === 'google' ? ' [Google]' : ''}`;
      if (note && (note.linkedEventId === e.id || e.noteId === note.id)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

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
    if (window.AgendaManager) window.AgendaManager.render();
    if (window.App && typeof window.App.showToast === 'function') {
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
      if (window.App) window.App.showToast("Le créneau d'agenda lié est introuvable", "warning");
      return;
    }

    if (window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
    }

    if (window.AgendaManager && targetEvt.start) {
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

    if (window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
    }

    if (window.AgendaManager) {
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
    if (!confirm("Voulez-vous supprimer cette note ?")) return;
    let notes = this.getAll();
    notes = notes.filter(n => n.id !== this.currentNoteId);
    this.saveAll(notes);
    this.currentNoteId = notes.length > 0 ? notes[0].id : null;
    this.render();
    if (window.App) window.App.showToast("Note supprimée", "info");
  },

  exportCurrentNote() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;

    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.App) window.App.showToast("Fichier .md exporté pour Obsidian", "success");
  },

  renderNotesList() {
    const listEl = document.getElementById('notes-list-container');
    if (!listEl) return;

    const notes = this.getAll();
    const filtered = notes.filter(n => 
      !this.searchQuery || 
      n.title.toLowerCase().includes(this.searchQuery) || 
      n.content.toLowerCase().includes(this.searchQuery)
    );

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-dim); font-size: 0.82rem;">Aucune note trouvée.</div>`;
      return;
    }

    const allEvents = StorageManager.getEvents();
    // Indexation O(1) des événements liés aux notes pour éviter les doubles scans linéaires
    const eventByNoteOrId = new Map();
    for (let i = 0; i < allEvents.length; i++) {
      const e = allEvents[i];
      if (e.id) eventByNoteOrId.set(e.id, e);
      if (e.noteId) eventByNoteOrId.set(e.noteId, e);
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

      item.innerHTML = `
        <div class="note-item-title">${this.escapeHtml(note.title)}</div>
        <div class="note-item-meta" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>📁 ${this.escapeHtml(note.folder || 'Notes')}</span>
          <span>• ${updatedDate}</span>
          ${eventBadge}
        </div>
      `;
      listEl.appendChild(item);
    });
  },

  updatePreview(markdown) {
    const previewEl = document.getElementById('notes-preview-container');
    if (!previewEl) return;
    previewEl.innerHTML = this.simpleMarkdownToHtml(markdown);
  },

  // Parseur Markdown rapide et sécurisé (sans dépendance externe lourde)
  simpleMarkdownToHtml(md) {
    if (!md) return '';
    let html = this.escapeHtml(md);

    // Titres #, ##, ###
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Gras et Italique
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Checkboxes markdown
    html = html.replace(/- \[x\] (.*$)/gim, '<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="color:var(--success);">☑</span> <span style="text-decoration:line-through; color:var(--text-dim);">$1</span></div>');
    html = html.replace(/- \[ \] (.*$)/gim, '<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="color:var(--text-dim);">☐</span> <span>$1</span></div>');

    // Listes à puces simples
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

    // Blocs de code
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Paragraphes et retours à la ligne
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  },

  render() {
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
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.NotesManager = NotesManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotesManager;
}
