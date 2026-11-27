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

    if (!this._noteTextCache) this._noteTextCache = new Map();
    const stripHtmlText = (rawHtml, noteObj = null) => {
      if (!rawHtml) return '';
      const cacheKey = noteObj && noteObj.id ? String(noteObj.id) : null;
      const sig = `${(noteObj && (noteObj.updatedAt || noteObj.createdAt)) || ''}:${rawHtml.length}`;
      if (cacheKey) {
        const hit = this._noteTextCache.get(cacheKey);
        if (hit && hit.sig === sig) return hit.clean;
      }
      const clean = String(rawHtml)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (cacheKey) {
        if (this._noteTextCache.size > 2500) this._noteTextCache.clear();
        this._noteTextCache.set(cacheKey, { sig, clean });
      }
      return clean;
    };

    const projects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
    const projectMap = new Map();
    const archivedProjectIds = new Set();
    projects.forEach(p => {
      if (p && p.id) {
        projectMap.set(p.id, p);
        if (p.archived) archivedProjectIds.add(p.id);
      }
    });

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

    // 1. Recherche dans les Tâches (prioriser les tâches actives non archivées avant l'historique terminé)
    const allTasks = this.getAllTasksFlat();
    const taskMatches = [];
    const secondaryTaskMatches = [];
    for (let i = 0; i < allTasks.length; i++) {
      const t = allTasks[i];
      if (!matchesTokens(`${t.title || ''} ${t.description || ''} ${t.parentTitle || ''}`)) continue;
      const isSecondary = !!t.completed || (t.projectId && archivedProjectIds.has(t.projectId));
      if (!isSecondary) {
        taskMatches.push(t);
        if (taskMatches.length >= 8) break;
      } else if (secondaryTaskMatches.length < 8) {
        secondaryTaskMatches.push(t);
      }
    }
    if (taskMatches.length < 8 && secondaryTaskMatches.length > 0) {
      for (let i = 0; i < secondaryTaskMatches.length && taskMatches.length < 8; i++) {
        taskMatches.push(secondaryTaskMatches[i]);
      }
    }

    const taskProjMap = new Map();
    for (let i = 0; i < allTasks.length; i++) {
      if (allTasks[i] && allTasks[i].id && allTasks[i].projectId) {
        taskProjMap.set(allTasks[i].id, allTasks[i].projectId);
      }
    }

    // 2. Recherche dans les Projets (prioriser les projets actifs avant les projets archivés)
    const activeProjectMatches = [];
    const archivedProjectMatches = [];
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (!p || !matchesTokens(`${p.title || ''} ${p.description || ''}`)) continue;
      if (!p.archived) {
        activeProjectMatches.push(p);
        if (activeProjectMatches.length >= 4) break;
      } else if (archivedProjectMatches.length < 4) {
        archivedProjectMatches.push(p);
      }
    }
    const projectMatches = activeProjectMatches.length >= 4
      ? activeProjectMatches
      : activeProjectMatches.concat(archivedProjectMatches).slice(0, 4);

    // 3. Recherche dans l'Agenda (titre, description, lieu ; prioriser actifs)
    const events = (typeof StorageManager !== 'undefined') ? StorageManager.getEvents() : [];
    const activeEventMatches = [];
    const secondaryEventMatches = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e || !matchesTokens(`${e.title || ''} ${e.description || ''} ${e.location || ''}`)) continue;
      const eProjId = e.projectId || (e.taskId ? taskProjMap.get(e.taskId) : null);
      if (eProjId && archivedProjectIds.has(eProjId)) {
        if (secondaryEventMatches.length < 6) secondaryEventMatches.push(e);
      } else {
        activeEventMatches.push(e);
        if (activeEventMatches.length >= 6) break;
      }
    }
    const eventMatches = activeEventMatches.length >= 6
      ? activeEventMatches
      : activeEventMatches.concat(secondaryEventMatches).slice(0, 6);

    // 4. Recherche dans les Notes (titre, dossier, tags #tag, contenu nettoyé ; prioriser actives)
    const notes = (typeof StorageManager !== 'undefined') ? StorageManager.getNotes() : [];
    const activeNoteMatches = [];
    const secondaryNoteMatches = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n) continue;
      const tagsText = Array.isArray(n.tags) ? n.tags.map(tg => `#${tg} ${tg}`).join(' ') : '';
      const metaText = `${n.title || ''} ${n.folder || ''} ${tagsText}`;
      const matchedMeta = matchesTokens(metaText);
      if (!matchedMeta) {
        if (!n.content) continue;
        const cleanBody = stripHtmlText(n.content, n);
        if (!matchesTokens(`${metaText} ${cleanBody}`)) continue;
      }
      const nProjId = n.projectId || n.linkedProjectId || null;
      if (nProjId && archivedProjectIds.has(nProjId)) {
        if (secondaryNoteMatches.length < 6) secondaryNoteMatches.push(n);
      } else {
        activeNoteMatches.push(n);
        if (activeNoteMatches.length >= 6) break;
      }
    }
    const noteMatches = activeNoteMatches.length >= 6
      ? activeNoteMatches
      : activeNoteMatches.concat(secondaryNoteMatches).slice(0, 6);

    const flatList = [];

    taskMatches.forEach(t => {
      const proj = t.projectId ? projectMap.get(t.projectId) : null;
      const statusText = t.completed ? 'Terminée' : 'À faire';
      const parentInfo = t.parentTitle ? ` (dans : ${t.parentTitle})` : '';
      const projInfo = proj ? ` • ${proj.title}${proj.archived ? ' (Archivé)' : ''}` : '';
      flatList.push({
        type: 'task',
        id: t.id,
        title: t.title,
        subtitle: `${statusText}${parentInfo}${projInfo}`,
        icon: t.completed
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        color: proj ? proj.color : '',
        data: t
      });
    });

    projectMatches.forEach(p => {
      const archTag = p.archived ? ' • Archivé' : '';
      flatList.push({
        type: 'project',
        id: p.id,
        title: p.title,
        subtitle: `${p.description ? p.description : 'Projet'}${archTag}`,
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
        color: p.color,
        data: p
      });
    });

    eventMatches.forEach(e => {
      const eProjId = e.projectId || (e.taskId ? taskProjMap.get(e.taskId) : null);
      const proj = eProjId ? projectMap.get(eProjId) : null;
      const startDate = e.date || (typeof e.start === 'string' && e.start.length >= 10 ? e.start.slice(0, 10) : '');
      const startTime = e.startTime || (typeof e.start === 'string' && e.start.length >= 16 ? e.start.slice(11, 16) : '');
      const endTime = e.endTime || (typeof e.end === 'string' && e.end.length >= 16 ? e.end.slice(11, 16) : '');
      const timeStr = e.isAllDay
        ? 'Journée entière'
        : ((startTime || endTime) ? `${startTime} - ${endTime}`.trim() : 'Horaire libre');
      const dateStr = startDate ? `le ${startDate}` : '';
      const locInfo = e.location ? ` • ${e.location}` : '';
      const projInfo = proj ? ` • ${proj.title}` : '';
      flatList.push({
        type: 'event',
        id: e.id,
        title: e.title || '(Sans titre)',
        subtitle: `${dateStr ? `${dateStr} • ${timeStr}` : timeStr}${locInfo}${projInfo}`,
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        color: (proj && proj.color) ? proj.color : (e.color || ''),
        data: e
      });
    });

    noteMatches.forEach(n => {
      const nProjId = n.projectId || n.linkedProjectId || null;
      const proj = nProjId ? projectMap.get(nProjId) : null;
      const stripped = stripHtmlText(n.content || '');
      let snippet = stripped.substring(0, 75);
      if (stripped.length > 75) snippet += '...';
      const folderTag = n.folder && n.folder !== 'Général' ? `[${n.folder}] ` : '';
      const projInfo = proj ? ` • ${proj.title}` : '';
      flatList.push({
        type: 'note',
        id: n.id,
        title: n.title || '(Sans titre)',
        subtitle: `${folderTag}${snippet || 'Note personnelle'}${projInfo}`,
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        color: proj ? proj.color : '',
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

    const cleanTokens = Array.from(new Set((tokens || []).filter(Boolean)))
      .sort((a, b) => b.length - a.length);
    const escapedTokens = cleanTokens.map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const highlightRe = escapedTokens.length > 0 ? new RegExp(`(${escapedTokens.join('|')})`, 'gi') : null;

    const highlight = (text) => {
      if (text === null || text === undefined) return '';
      const raw = String(text);
      if (!highlightRe) return this.escapeHtml(raw);
      let out = '';
      let lastIdx = 0;
      highlightRe.lastIndex = 0;
      let match;
      while ((match = highlightRe.exec(raw)) !== null) {
        if (match.index > lastIdx) {
          out += this.escapeHtml(raw.slice(lastIdx, match.index));
        }
        out += `<mark class="search-highlight">${this.escapeHtml(match[0])}</mark>`;
        lastIdx = highlightRe.lastIndex;
        if (match[0].length === 0) break;
      }
      if (lastIdx < raw.length) {
        out += this.escapeHtml(raw.slice(lastIdx));
      }
      return out;
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
          const safeColor = (typeof item.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(item.color.trim()))
            ? item.color.trim()
            : '';
          const dotStyle = safeColor ? `style="color: ${safeColor};"` : '';
          const itemAccentStyle = safeColor ? `style="border-left: 3px solid ${safeColor};"` : '';
          html += `
            <div class="search-result-item ${isSelected ? 'selected' : ''}" data-index="${idx}" ${itemAccentStyle}>
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
        if (item.id && typeof ProjectsManager !== 'undefined' && typeof ProjectsManager.openProjectDetailModal === 'function') {
          setTimeout(() => {
            ProjectsManager.openProjectDetailModal(item.id);
          }, 100);
        }
        break;

      case 'event':
        navigateApp('agenda');
        if (typeof AgendaManager !== 'undefined') {
          setTimeout(() => {
            const targetDate = item.data && (item.data.date || (typeof item.data.start === 'string' && item.data.start.length >= 10 ? item.data.start.slice(0, 10) : null));
            if (targetDate && typeof AgendaManager.zoomToDay === 'function') {
              AgendaManager.zoomToDay(targetDate);
            }
            if (item.id && typeof AgendaManager.openEventModal === 'function') {
              AgendaManager.openEventModal(item.id);
            }
          }, 100);
        }
        break;

      case 'note':
        if (typeof NotesManager !== 'undefined' && item.data) {
          let filterReset = false;
          const noteFolder = item.data.folder || 'Général';
          if (NotesManager.currentFolderFilter && NotesManager.currentFolderFilter !== 'all' && NotesManager.currentFolderFilter !== noteFolder) {
            NotesManager.currentFolderFilter = 'all';
            filterReset = true;
          }
          const noteProjId = item.data.projectId || item.data.linkedProjectId || null;
          if (NotesManager.currentProjectFilter && NotesManager.currentProjectFilter !== 'all' && NotesManager.currentProjectFilter !== noteProjId) {
            NotesManager.currentProjectFilter = 'all';
            const projSel = typeof document !== 'undefined' ? document.getElementById('notes-filter-project') : null;
            if (projSel) projSel.value = 'all';
            filterReset = true;
          }
          if (NotesManager.searchQuery) {
            NotesManager.searchQuery = '';
            const nSearch = typeof document !== 'undefined' ? document.getElementById('notes-search-input') : null;
            if (nSearch) nSearch.value = '';
            filterReset = true;
          }
          if (filterReset) {
            if (typeof NotesManager.renderFolderFilter === 'function') NotesManager.renderFolderFilter();
            if (typeof NotesManager.renderNotesList === 'function') NotesManager.renderNotesList();
          }
        }
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
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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
