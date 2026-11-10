/**
 * Antigravité - Module de Recherche Rapide Universelle (Spotlight / Ctrl+F)
 */

const SearchManager = {
  initialized: false,
  _isOpen: false,
  selectedIndex: 0,
  currentResults: [],
  debounceTimer: null,

  get isOpen() {
    return !!(this.modalEl && this.modalEl.classList.contains('active'));
  },
  set isOpen(val) {
    this._isOpen = !!val;
  },

  init() {
    if (this.initialized) return;

    this.modalEl = document.getElementById('search-modal');
    this.inputEl = document.getElementById('universal-search-input');
    this.resultsEl = document.getElementById('universal-search-results');
    this.triggerBtn = document.getElementById('btn-quick-search-trigger');

    if (!this.modalEl || !this.inputEl || !this.resultsEl) return;
    this.initialized = true;

    // 1. Bouton déclencheur dans la barre supérieure
    if (this.triggerBtn) {
      this.triggerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    // 2. Saisie dans le champ de recherche (debounce 80 ms pour préserver les CPU modestes)
    this.inputEl.addEventListener('input', (e) => {
      const q = e.target.value;
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.executeSearch(q);
      }, 80);
    });

    // 3. Navigation au clavier dans les résultats
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.currentResults.length > 0 && this.selectedIndex >= 0) {
          this.selectResult(this.selectedIndex);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    // 4. Fermeture par clic sur le fond de la modale
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // 5. Raccourci clavier global Ctrl+F / Ctrl+K en phase de capture
    const handleShortcut = (e) => {
      const isF = (e.code === 'KeyF') || (e.key && e.key.toLowerCase() === 'f');
      const isK = (e.code === 'KeyK') || (e.key && e.key.toLowerCase() === 'k');

      if ((e.ctrlKey || e.metaKey) && (isF || isK)) {
        // Laisser l'insertion de lien Markdown dans l'éditeur de notes pour Ctrl+K
        const inNoteEditor = e.target && (e.target.id === 'note-body-editor' || (typeof e.target.closest === 'function' && e.target.closest('#note-body-editor')));
        if (isK && inNoteEditor) {
          return;
        }
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        this.open();
      }
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', handleShortcut, true);
    } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', handleShortcut, true);
    }
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    if (!this.modalEl || !this.inputEl) {
      this.modalEl = document.getElementById('search-modal');
      this.inputEl = document.getElementById('universal-search-input');
      this.resultsEl = document.getElementById('universal-search-results');
    }
    if (!this.modalEl || !this.inputEl) return;

    this._isOpen = true;
    this.modalEl.classList.add('active');
    this.inputEl.value = '';
    this.executeSearch('');

    this.inputEl.focus();
    setTimeout(() => {
      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.select();
      }
    }, 40);
  },

  close() {
    this._isOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
    if (this.inputEl) {
      this.inputEl.blur();
    }
  },

  getAllTasksFlat() {
    const raw = (typeof StorageManager !== 'undefined') ? StorageManager.getTasks() : [];
    const flat = [];
    const recurse = (list, parentTitle = '') => {
      if (!Array.isArray(list)) return;
      for (const t of list) {
        flat.push({ ...t, parentTitle });
        if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          recurse(t.subtasks, t.title);
        }
      }
    };
    recurse(raw);
    return flat;
  },

  executeSearch(query) {
    if (!this.resultsEl) return;
    const q = (query || '').trim().toLowerCase();

    if (!q) {
      this.currentResults = [];
      this.selectedIndex = -1;
      this.resultsEl.innerHTML = `
        <div class="search-empty-state">
          <div style="display: flex; justify-content: center; margin-bottom: 8px; color: var(--text-dim);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div style="font-weight: 500; color: var(--text-main); margin-bottom: 4px;">Recherche rapide universelle</div>
          <div>Tapez un mot-clé pour chercher dans vos tâches, projets, agenda et notes.</div>
          <div style="display: flex; justify-content: center; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
            <span class="badge" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>Tâches &amp; Sous-tâches</span></span>
            <span class="badge" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Projets</span></span>
            <span class="badge" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Agenda</span></span>
            <span class="badge" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>Notes</span></span>
          </div>
        </div>
      `;
      return;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matchesTokens = (text) => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return tokens.every(tok => lower.includes(tok));
    };

    const projects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
    const projectMap = new Map();
    projects.forEach(p => projectMap.set(p.id, p));

    const collectMatches = (list, limit, predicate) => {
      const res = [];
      for (let i = 0; i < list.length; i++) {
        if (predicate(list[i])) {
          res.push(list[i]);
          if (res.length >= limit) break;
        }
      }
      return res;
    };

    // 1. Recherche dans les Tâches (arrêt anticipé dès 8 résultats)
    const allTasks = this.getAllTasksFlat();
    const taskMatches = collectMatches(allTasks, 8, (t) =>
      matchesTokens(t.title) || matchesTokens(t.description) || matchesTokens(t.parentTitle)
    );

    // 2. Recherche dans les Projets (arrêt anticipé dès 4 résultats)
    const projectMatches = collectMatches(projects, 4, (p) =>
      matchesTokens(p.title) || matchesTokens(p.description)
    );

    // 3. Recherche dans l'Agenda (arrêt anticipé dès 6 résultats)
    const events = (typeof StorageManager !== 'undefined') ? StorageManager.getEvents() : [];
    const eventMatches = collectMatches(events, 6, (e) =>
      matchesTokens(e.title) || matchesTokens(e.description)
    );

    // 4. Recherche dans les Notes (titre testé avant le stripping HTML, arrêt anticipé dès 6 résultats)
    const notes = (typeof StorageManager !== 'undefined') ? StorageManager.getNotes() : [];
    const noteMatches = collectMatches(notes, 6, (n) => {
      if (matchesTokens(n.title)) return true;
      if (!n.content) return false;
      const stripped = n.content.replace(/<[^>]*>/g, ' ');
      return matchesTokens(stripped);
    });

    const flatList = [];

    taskMatches.forEach(t => {
      const proj = projectMap.get(t.projectId);
      const statusText = t.completed ? 'Terminée' : 'À faire';
      const parentInfo = t.parentTitle ? ` (dans : ${t.parentTitle})` : '';
      const projInfo = proj ? ` • ${proj.title}` : '';
      flatList.push({
        type: 'task',
        id: t.id,
        title: t.title,
        subtitle: `${statusText}${parentInfo}${projInfo}`,
        icon: t.completed
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        data: t
      });
    });

    projectMatches.forEach(p => {
      flatList.push({
        type: 'project',
        id: p.id,
        title: p.title,
        subtitle: p.description ? p.description : 'Projet',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
        color: p.color,
        data: p
      });
    });

    eventMatches.forEach(e => {
      const timeStr = e.isAllDay ? 'Journée entière' : `${e.startTime || ''} - ${e.endTime || ''}`;
      const dateStr = e.date ? `le ${e.date}` : '';
      flatList.push({
        type: 'event',
        id: e.id,
        title: e.title || '(Sans titre)',
        subtitle: `${dateStr} • ${timeStr}`,
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        data: e
      });
    });

    noteMatches.forEach(n => {
      const stripped = (n.content || '').replace(/<[^>]*>/g, ' ').trim();
      let snippet = stripped.substring(0, 80);
      if (stripped.length > 80) snippet += '...';
      flatList.push({
        type: 'note',
        id: n.id,
        title: n.title || '(Sans titre)',
        subtitle: snippet || 'Note personnelle',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        data: n
      });
    });

    this.currentResults = flatList;

    if (flatList.length === 0) {
      this.selectedIndex = -1;
      this.resultsEl.innerHTML = `
        <div class="search-empty-state">
          <div style="display:flex; justify-content:center; margin-bottom: 8px; color: var(--text-dim);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div style="font-weight: 500; color: var(--text-main); margin-bottom: 4px;">Aucun résultat pour « ${this.escapeHtml(q)} »</div>
          <div>Vérifiez l'orthographe ou essayez avec un autre mot-clé.</div>
        </div>
      `;
      return;
    }

    this.selectedIndex = 0;
    this.renderResults(tokens);
  },

  renderResults(tokens) {
    if (!this.resultsEl) return;

    const highlight = (text) => {
      if (!text) return '';
      let safe = this.escapeHtml(text);
      tokens.forEach(tok => {
        if (!tok) return;
        const escTok = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${escTok})`, 'gi');
        safe = safe.replace(re, '<mark class="search-highlight">$1</mark>');
      });
      return safe;
    };

    // Grouper par catégorie pour un affichage soigné
    const categories = [
      { type: 'task', label: 'Tâches', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' },
      { type: 'project', label: 'Projets', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' },
      { type: 'event', label: 'Agenda & Créneaux', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
      { type: 'note', label: 'Notes & Carnets', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' }
    ];

    let html = '';
    categories.forEach(cat => {
      const items = this.currentResults
        .map((item, idx) => ({ item, idx }))
        .filter(obj => obj.item.type === cat.type);

      if (items.length > 0) {
        html += `<div class="search-group-title">${cat.icon} <span>${cat.label}</span> (${items.length})</div>`;
        items.forEach(({ item, idx }) => {
          const isSelected = idx === this.selectedIndex;
          const dotStyle = item.color ? `style="color: ${item.color};"` : '';
          html += `
            <div class="search-result-item ${isSelected ? 'selected' : ''}" data-index="${idx}">
              <div class="search-result-main">
                <span class="search-result-icon" ${dotStyle}>${item.icon}</span>
                <div class="search-result-text">
                  <div class="search-result-title">${highlight(item.title)}</div>
                  <div class="search-result-subtitle">${highlight(item.subtitle)}</div>
                </div>
              </div>
              <span class="search-result-action">↵ Ouvrir</span>
            </div>
          `;
        });
      }
    });

    this.resultsEl.innerHTML = html;

    // Écouteurs de clic sur chaque résultat
    this.resultsEl.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.index);
        this.selectResult(idx);
      });
      el.addEventListener('mouseenter', () => {
        const idx = Number(el.dataset.index);
        this.selectedIndex = idx;
        this.updateSelection();
      });
    });
  },

  navigateResults(direction) {
    if (this.currentResults.length === 0) return;
    this.selectedIndex += direction;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.currentResults.length - 1;
    } else if (this.selectedIndex >= this.currentResults.length) {
      this.selectedIndex = 0;
    }
    this.updateSelection();
  },

  updateSelection() {
    if (!this.resultsEl) return;
    const items = this.resultsEl.querySelectorAll('.search-result-item');
    items.forEach(el => {
      const idx = Number(el.dataset.index);
      el.classList.toggle('selected', idx === this.selectedIndex);
      if (idx === this.selectedIndex) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  },

  selectResult(index) {
    const item = this.currentResults[index];
    if (!item) return;

    this.close();

    const navigateApp = (screen) => {
      if (typeof App !== 'undefined') {
        if (typeof App.navigate === 'function') {
          App.navigate(screen);
        } else if (typeof App.navigateTo === 'function') {
          App.navigateTo(screen);
        }
      }
    };

    switch (item.type) {
      case 'task':
        navigateApp('tasks');
        if (typeof TasksManager !== 'undefined' && typeof TasksManager.openTaskModal === 'function') {
          setTimeout(() => {
            TasksManager.openTaskModal(item.id);
          }, 100);
        }
        break;

      case 'project':
        navigateApp('projects');
        break;

      case 'event':
        navigateApp('agenda');
        if (item.data && item.data.date && typeof AgendaManager !== 'undefined' && typeof AgendaManager.zoomToDay === 'function') {
          setTimeout(() => {
            AgendaManager.zoomToDay(item.data.date);
          }, 100);
        }
        break;

      case 'note':
        navigateApp('notes');
        if (typeof NotesManager !== 'undefined' && typeof NotesManager.selectNote === 'function') {
          setTimeout(() => {
            NotesManager.selectNote(item.id);
          }, 100);
        }
        break;
    }

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(`Ouverture : ${item.title}`, 'info');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

// Auto-initialisation au chargement du DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SearchManager.init());
  } else {
    SearchManager.init();
  }
}

if (typeof window !== 'undefined') {
  window.SearchManager = SearchManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchManager;
}
