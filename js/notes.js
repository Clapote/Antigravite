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
  currentFolderFilter: 'all',
  currentViewMode: 'edit', // Conservé pour rétro-compatibilité
  layoutMode: (typeof localStorage !== 'undefined' && localStorage.getItem('antigravite_notes_layout_mode')) || 'editor',
  overviewSearchQuery: '',
  _collapsedFolders: new Set(),
  _saveTimer: null,
  _pendingNotesToSave: null,

  getSvgIcon(name, size = 14, extraClass = '') {
    if (typeof App !== 'undefined' && typeof App.getSvgIcon === 'function') {
      return App.getSvgIcon(name, size, extraClass);
    }
    const cls = extraClass ? `app-icon ${extraClass}` : 'app-icon';
    const map = {
      pin: ['pin', 2], '📌': ['pin', 2],
      folder: ['folder', 2], '📁': ['folder', 2], '📂': ['folder', 2],
      calendar: ['calendar', 2], '📅': ['calendar', 2],
      edit: ['edit', 2], '✏️': ['edit', 2],
      trash: ['trash', 2], '🗑️': ['trash', 2],
      lock: ['lock', 2], '🔒': ['lock', 2],
      lightbulb: ['lightbulb', 2], tip: ['lightbulb', 2], '💡': ['lightbulb', 2],
      info: ['info', 2], 'ℹ️': ['info', 2], 'ℹ': ['info', 2],
      warning: ['warning', 2], caution: ['warning', 2], '⚠️': ['warning', 2],
      alert: ['alert', 2], danger: ['alert', 2], '🚨': ['alert', 2], error: ['alert', 2], '❌': ['alert', 2],
      success: ['check', 3], check: ['check', 3], '✅': ['check', 3], '✓': ['check', 3],
      important: ['important', 2], '❗': ['important', 2]
    };
    const [sym, sw] = map[name] || ['important', 2];
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ico-${sym}"/></svg>`;
  },

  _savedEditorRange: null,
  _currentTextColor: '#f43f5e',
  _currentHighlightColor: '#fef08a',

  _isLightCssColor(cssColor) {
    if (!cssColor || typeof cssColor !== 'string') return false;
    const raw = cssColor.trim().toLowerCase();
    if (raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return false;
    let r = 0, g = 0, b = 0;
    const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let h = hexMatch[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      const rgbMatch = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
      if (!rgbMatch) return false;
      if (rgbMatch[4] !== undefined && parseFloat(rgbMatch[4]) === 0) return false;
      r = parseInt(rgbMatch[1], 10);
      g = parseInt(rgbMatch[2], 10);
      b = parseInt(rgbMatch[3], 10);
    }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum >= 135;
  },

  _annotateHighlightContrast(editor) {
    if (!editor || typeof editor.querySelectorAll !== 'function') return;
    editor.querySelectorAll('span, mark').forEach(el => {
      const bg = el.style && el.style.backgroundColor ? el.style.backgroundColor : '';
      const hasExplicitColor = !!(el.style && el.style.color);
      if (bg && !hasExplicitColor && this._isLightCssColor(bg)) {
        el.setAttribute('data-hl-light', 'true');
      } else if (el.hasAttribute('data-hl-light')) {
        el.removeAttribute('data-hl-light');
      }
    });
  },

  _normalizeColorElements(editor) {
    if (!editor || typeof editor.querySelectorAll !== 'function' || typeof document === 'undefined') return;
    editor.querySelectorAll('font').forEach(fontEl => {
      const span = document.createElement('span');
      const col = fontEl.getAttribute('color');
      if (col) span.style.color = col;
      if (fontEl.getAttribute('style')) {
        span.style.cssText += ';' + fontEl.getAttribute('style');
      }
      while (fontEl.firstChild) {
        span.appendChild(fontEl.firstChild);
      }
      if (fontEl.parentNode) {
        fontEl.parentNode.replaceChild(span, fontEl);
      }
    });
    this._annotateHighlightContrast(editor);
  },

  _updateWordColorIndicators() {
    if (typeof document === 'undefined') return;
    const textBar = document.getElementById('notes-color-indicator');
    if (textBar) textBar.style.backgroundColor = this._currentTextColor;
    const hlBar = document.getElementById('notes-highlight-indicator');
    if (hlBar) hlBar.style.backgroundColor = this._currentHighlightColor;

    const popColor = document.getElementById('popover-color-palette');
    if (popColor && typeof popColor.querySelectorAll === 'function') {
      const targetC = (this._currentTextColor || '').toLowerCase();
      popColor.querySelectorAll('.swatch-btn[data-value]').forEach(sw => {
        sw.classList.toggle('active', (sw.dataset.value || '').toLowerCase() === targetC);
      });
    }
    const popHl = document.getElementById('popover-highlight-palette');
    if (popHl && typeof popHl.querySelectorAll === 'function') {
      const targetH = (this._currentHighlightColor || '').toLowerCase();
      popHl.querySelectorAll('.swatch-btn[data-value]').forEach(sw => {
        sw.classList.toggle('active', (sw.dataset.value || '').toLowerCase() === targetH);
      });
    }
  },

  _updateFormatToolbarState() {
    if (typeof document === 'undefined' || typeof document.queryCommandState !== 'function') return;
    const editor = document.getElementById('note-body-editor');
    const formatBar = document.getElementById('notes-format-bar');
    if (!editor || !formatBar) return;
    const active = document.activeElement;
    if (active !== editor && !(editor.contains && editor.contains(active))) return;

    const cmdMap = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strikethrough: 'strikeThrough',
      bullet: 'insertUnorderedList',
      number: 'insertOrderedList',
      'align-left': 'justifyLeft',
      'align-center': 'justifyCenter',
      'align-right': 'justifyRight'
    };
    Object.keys(cmdMap).forEach(action => {
      const btn = formatBar.querySelector(`.btn-format[data-action="${action}"]`);
      if (btn) {
        let state = false;
        try { state = !!document.queryCommandState(cmdMap[action]); } catch (_) {}
        btn.classList.toggle('is-active', state);
      }
    });

    const blockSelect = document.getElementById('notes-format-block-select');
    if (blockSelect && typeof document.queryCommandValue === 'function') {
      try {
        const val = String(document.queryCommandValue('formatBlock') || '').replace(/[<>]/g, '').toLowerCase();
        if (['h1', 'h2', 'h3', 'p'].includes(val)) {
          blockSelect.value = val;
        } else {
          blockSelect.value = 'p';
        }
      } catch (_) {}
    }
  },

  saveEditorSelection() {
    if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return;
    const editor = typeof document !== 'undefined' ? document.getElementById('note-body-editor') : null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor && typeof editor.contains === 'function' && range.commonAncestorContainer && !editor.contains(range.commonAncestorContainer)) {
      return;
    }
    if (typeof range.cloneRange === 'function') {
      this._savedEditorRange = range.cloneRange();
    }
  },

  restoreEditorSelection(editorEl = null) {
    if (!this._savedEditorRange || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
    const editor = editorEl || (typeof document !== 'undefined' ? document.getElementById('note-body-editor') : null);
    const range = this._savedEditorRange;
    if (editor && typeof editor.contains === 'function' && range.commonAncestorContainer && !editor.contains(range.commonAncestorContainer)) {
      return false;
    }
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (_) {
      return false;
    }
  },

  _normalizeSafeLinkUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return null;
    // Supprimer les caractères de contrôle / espaces invisibles utilisés en obfuscation
    const stripped = rawUrl.replace(/[\u0000-\u0020\u007f]/g, '').trim();
    if (!stripped) return null;
    let candidate = rawUrl.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
      candidate = 'https://' + candidate;
    }
    const cleanSchemeCheck = candidate.replace(/[\u0000-\u0020\u007f]/g, '');
    if (!/^(https?:|mailto:|note:\/\/)/i.test(cleanSchemeCheck)) {
      return null;
    }
    return candidate;
  },

  init(options = {}) {
    if (this.initialized) {
      if (!options || !options.deferRender) {
        this.render();
        if (this.layoutMode === 'folders') {
          this.setLayoutMode('folders');
        }
      }
      return;
    }
    this.initialized = true;

    if (!options || !options.deferRender) {
      this.render();
    }
    this.bindEvents();
    if (!options || !options.deferRender) {
      if (this.layoutMode === 'folders') {
        this.setLayoutMode('folders');
      }
    }
  },

  warmUpIndex() {
    const rev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function')
      ? `${StorageManager.getRevision('notes')}:${StorageManager.getRevision('settings')}`
      : null;
    if (rev !== null && this._noteIndexCache && this._noteIndexCache.rev === rev) {
      return this._noteIndexCache;
    }
    const notes = this.getAll();
    const folders = this.getFolders();
    const byId = new Map();
    const byLowerTitle = new Map();
    const tagsCount = new Map();
    const wikilinksBySource = new Map();

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n || !n.id) continue;
      byId.set(n.id, n);
      if (n.title) {
        byLowerTitle.set(String(n.title).trim().toLowerCase(), n);
      }
      const raw = `${n.title || ''} ${n.content || ''}`;
      const tagMatches = raw.match(/#([a-zA-Z0-9_\u00C0-\u017F-]+)/g);
      if (tagMatches) {
        for (let j = 0; j < tagMatches.length; j++) {
          const t = tagMatches[j].toLowerCase();
          tagsCount.set(t, (tagsCount.get(t) || 0) + 1);
        }
      }
      const wlMatches = raw.match(/\[\[([^\]]+)\]\]/g);
      if (wlMatches) {
        wikilinksBySource.set(n.id, wlMatches.map(m => m.slice(2, -2).split('|')[0].trim().toLowerCase()));
      }
    }

    this._noteIndexCache = { rev, folders, byId, byLowerTitle, tagsCount, wikilinksBySource };
    return this._noteIndexCache;
  },

  getFolders() {
    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};
    const base = Array.isArray(settings.notesFolders) && settings.notesFolders.length > 0
      ? [...settings.notesFolders]
      : ['Général'];
    const set = new Set();
    set.add('Général');
    base.forEach(f => {
      const trimmed = (f || '').trim();
      if (trimmed) set.add(trimmed);
    });
    // Inclure les dossiers portés par d'éventuelles notes restaurées ou importées absentes des paramètres
    const notes = this.getAll();
    if (Array.isArray(notes)) {
      for (let i = 0; i < notes.length; i++) {
        const f = notes[i] && typeof notes[i].folder === 'string' ? notes[i].folder.trim() : '';
        if (f) set.add(f);
      }
    }
    return Array.from(set);
  },

  createFolder(name) {
    if (!name || typeof name !== 'string') return null;
    const cleanName = name.trim();
    if (!cleanName) return null;

    const folders = this.getFolders();
    const existing = folders.find(f => f.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    folders.push(cleanName);
    this._persistFolders(folders);
    this.renderFolderFilter();
    if (this.currentNoteId) {
      const note = this.getCurrentNote();
      if (note) this.renderFolderSelector(note);
    }
    if (this.layoutMode === 'folders') {
      this.renderFoldersOverview();
    }
    return cleanName;
  },

  renameFolder(oldName, newName) {
    if (!oldName || !newName) return false;
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) return false;

    // 1. Mettre à jour toutes les notes du dossier : préserve à 100% les identifiants, liens et dates
    const notes = this.getAll();
    let modified = false;
    notes.forEach(n => {
      if ((n.folder || 'Général').trim().toLowerCase() === cleanOld.toLowerCase()) {
        n.folder = cleanNew;
        modified = true;
      }
    });
    if (modified) {
      StorageManager.saveNotes(notes);
    }

    // 2. Mettre à jour la liste des dossiers
    const folders = this.getFolders().map(f => f.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : f);
    this._persistFolders(folders);

    if (this.currentFolderFilter && this.currentFolderFilter.toLowerCase() === cleanOld.toLowerCase()) {
      this.currentFolderFilter = cleanNew;
    }

    this.renderFolderFilter();
    this.renderNotesList();
    if (this.currentNoteId) {
      const note = this.getCurrentNote();
      if (note) this.renderFolderSelector(note);
    }
    if (this.layoutMode === 'folders') {
      this.renderFoldersOverview();
    }
    return true;
  },

  deleteFolder(folderName) {
    if (!folderName) return false;
    const clean = folderName.trim();
    // Les notes ne sont JAMAIS supprimées : elles sont reclassées en 'Général' pour préserver l'historique et les liens
    const notes = this.getAll();
    let modified = false;
    notes.forEach(n => {
      if ((n.folder || 'Général').trim().toLowerCase() === clean.toLowerCase()) {
        n.folder = 'Général';
        modified = true;
      }
    });
    if (modified) {
      StorageManager.saveNotes(notes);
    }

    const folders = this.getFolders().filter(f => f.toLowerCase() !== clean.toLowerCase());
    if (!folders.includes('Général')) folders.unshift('Général');
    this._persistFolders(folders);

    if (this.currentFolderFilter && this.currentFolderFilter.toLowerCase() === clean.toLowerCase()) {
      this.currentFolderFilter = 'all';
    }

    this.renderFolderFilter();
    this.renderNotesList();
    if (this.currentNoteId) {
      const note = this.getCurrentNote();
      if (note) this.renderFolderSelector(note);
    }
    if (this.layoutMode === 'folders') {
      this.renderFoldersOverview();
    }
    return true;
  },

  _persistFolders(folders) {
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getSettings !== 'function') return;
    const settings = StorageManager.getSettings();
    settings.notesFolders = Array.from(new Set(folders));
    StorageManager.saveSettings(settings);
  },

  async promptNewFolder() {
    let name = '';
    if (typeof window !== 'undefined' && window.App && typeof window.App.prompt === 'function') {
      name = await window.App.prompt({
        title: 'Nouveau dossier de notes',
        message: 'Entrez le nom du nouveau dossier :',
        placeholder: 'Ex: Personnel, Idées, Travail...',
        confirmText: 'Créer',
        cancelText: 'Annuler'
      });
    } else if (typeof prompt === 'function') {
      name = prompt('Nom du nouveau dossier de notes :', '');
    }
    if (!name || !name.trim()) return null;
    const created = this.createFolder(name.trim());
    if (created) {
      if (this._collapsedFolders) this._collapsedFolders.delete(created);
      this.renderFolderFilter();
      this.renderNotesList();
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Dossier « ${created} » créé`, 'success');
      }
    }
    return created;
  },

  showFolderMenu(e, folderName) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof document === 'undefined') return;

    const menu = document.getElementById('notes-folder-context-menu');
    const headerEl = document.getElementById('notes-folder-menu-header');
    const itemsEl = document.getElementById('notes-folder-menu-items');
    if (!menu || !headerEl || !itemsEl) return;

    const cleanFolder = (folderName || 'Général').trim();
    const isGeneral = cleanFolder.toLowerCase() === 'général';
    const notesCount = this.getAll().filter(n => (n.folder || 'Général').trim().toLowerCase() === cleanFolder.toLowerCase()).length;

    headerEl.innerHTML = `
      <div style="font-weight:700; color:var(--text-main); font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:5px;">
        <span style="color:var(--accent); display:inline-flex; align-items:center;">${this.getSvgIcon('folder', 14)}</span>
        <span>${this.escapeHtml(cleanFolder)}</span>
      </div>
      <div style="font-size:0.72rem; color:var(--text-dim); margin-top:2px;">
        ${notesCount} note${notesCount > 1 ? 's' : ''} ${isGeneral ? '• Dossier principal' : ''}
      </div>
    `;

    let html = `
      <div class="context-menu-item" id="cmenu-folder-rename">
        <span class="item-icon">${this.getSvgIcon('edit', 15)}</span>
        <span>Renommer le dossier</span>
      </div>
    `;

    if (!isGeneral) {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" id="cmenu-folder-delete">
          <span class="item-icon">${this.getSvgIcon('trash', 15)}</span>
          <span>Supprimer le dossier</span>
        </div>
      `;
    } else {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" style="opacity: 0.55; cursor: default;" title="Le dossier Général est le dossier de repli de l'application et ne peut pas être supprimé.">
          <span class="item-icon">${this.getSvgIcon('lock', 15)}</span>
          <span style="font-size:0.8rem;">Dossier par défaut non supprimable</span>
        </div>
      `;
    }

    itemsEl.innerHTML = html;

    // Positionnement sous le bouton ou à la position de la souris
    let posX = 100;
    let posY = 100;

    const rect = e && e.currentTarget && typeof e.currentTarget.getBoundingClientRect === 'function'
      ? e.currentTarget.getBoundingClientRect()
      : null;

    if (rect) {
      posX = rect.left;
      posY = rect.bottom + 4;
    } else if (e && (e.clientX || e.clientY)) {
      posX = e.clientX;
      posY = e.clientY + 4;
    }

    menu.style.display = 'block';
    menu.style.visibility = 'hidden';

    // Empêcher tout débordement en dehors de la fenêtre
    setTimeout(() => {
      const menuWidth = menu.offsetWidth || 220;
      const menuHeight = menu.offsetHeight || 110;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

      if (posX + menuWidth > winW - 10) {
        posX = winW - menuWidth - 10;
      }
      if (posY + menuHeight > winH - 10) {
        posY = rect ? Math.max(10, rect.top - menuHeight - 4) : (winH - menuHeight - 10);
      }

      menu.style.left = `${Math.max(10, posX)}px`;
      menu.style.top = `${Math.max(10, posY)}px`;
      menu.style.visibility = 'visible';
    }, 0);

    // Clic sur "Renommer"
    const btnRename = document.getElementById('cmenu-folder-rename');
    if (btnRename) {
      btnRename.onclick = async (ev) => {
        if (ev) ev.stopPropagation();
        this.hideFolderMenu();
        const newName = await (window.App && typeof window.App.prompt === 'function'
          ? window.App.prompt({
              title: 'Renommer le dossier',
              message: `Entrez le nouveau nom pour le dossier « ${cleanFolder} » :`,
              defaultValue: cleanFolder,
              placeholder: 'Nouveau nom...',
              confirmText: 'Renommer',
              cancelText: 'Annuler'
            })
          : null);
        if (newName && newName.trim() && newName.trim() !== cleanFolder) {
          const ok = this.renameFolder(cleanFolder, newName.trim());
          if (ok && typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Dossier renommé en « ${newName.trim()} »`, 'success');
          }
        }
      };
    }

    // Clic sur "Supprimer"
    const btnDelete = document.getElementById('cmenu-folder-delete');
    if (btnDelete) {
      btnDelete.onclick = async (ev) => {
        if (ev) ev.stopPropagation();
        this.hideFolderMenu();
        const confirmed = await (window.App && typeof window.App.confirm === 'function'
          ? window.App.confirm({
              title: 'Supprimer le dossier',
              message: `Supprimer le dossier « ${cleanFolder} » ?\n\nToutes les notes qu'il contient (${notesCount}) seront conservées et déplacées dans le dossier « Général ».\nAucun lien ne sera perdu.`,
              confirmText: 'Supprimer le dossier',
              cancelText: 'Annuler',
              danger: true,
              icon: '🗑️'
            })
          : true);
        if (confirmed) {
          this.deleteFolder(cleanFolder);
          if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast(`Dossier « ${cleanFolder} » supprimé`, 'info');
          }
        }
      };
    }
  },

  hideFolderMenu() {
    if (typeof document === 'undefined') return;
    const menu = document.getElementById('notes-folder-context-menu');
    if (menu) menu.style.display = 'none';
  },

  toggleFolderCollapse(folderName) {
    if (!this._collapsedFolders) this._collapsedFolders = new Set();
    if (this._collapsedFolders.has(folderName)) {
      this._collapsedFolders.delete(folderName);
    } else {
      this._collapsedFolders.add(folderName);
    }
    this.renderNotesList();
  },

  moveNoteToFolder(noteId, targetFolder) {
    if (!noteId || !targetFolder) return;
    const notes = this.getAll();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const oldFolder = note.folder || 'Général';
    if (oldFolder.toLowerCase() === targetFolder.toLowerCase()) return;

    note.folder = targetFolder.trim();
    note.updatedAt = new Date().toISOString();
    this.saveAll(notes);
    this.renderFolderFilter();
    if (this.currentNoteId === note.id) {
      this.renderFolderSelector(note);
    }
    this.renderNotesList();
    if (this.layoutMode === 'folders') {
      this.renderFoldersOverview();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Note déplacée vers « ${targetFolder} »`, 'info');
    }
  },

  getCurrentNote() {
    if (!this.currentNoteId) return null;
    return this.getAll().find(n => n.id === this.currentNoteId) || null;
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

  setLayoutMode(mode) {
    this.flushPendingSave();
    this.layoutMode = mode === 'folders' ? 'folders' : 'editor';
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_notes_layout_mode', this.layoutMode);
      } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      const standardLayout = document.getElementById('notes-standard-layout');
      const overview = document.getElementById('notes-folders-overview');
      const btnToggle = document.getElementById('btn-toggle-notes-view');
      const btnSidebarToggle = document.getElementById('btn-sidebar-toggle-folders');

      if (this.layoutMode === 'folders') {
        if (standardLayout) standardLayout.style.display = 'none';
        if (overview) overview.style.display = 'flex';
        if (btnToggle) btnToggle.classList.add('active');
        if (btnSidebarToggle) btnSidebarToggle.classList.add('active');
        this.renderFoldersOverview();
      } else {
        if (standardLayout) standardLayout.style.display = 'grid';
        if (overview) overview.style.display = 'none';
        if (btnToggle) btnToggle.classList.remove('active');
        if (btnSidebarToggle) btnSidebarToggle.classList.remove('active');
        this.render();
      }
    }
  },

  filterOverviewNotes(query) {
    this.overviewSearchQuery = (query || '').toLowerCase().trim();
    this.renderFoldersOverview();
  },

  formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `Aujourd'hui ${h}:${m}`;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString('fr-FR', { month: 'short' });
      return `${day} ${month}`;
    } catch (e) {
      return '';
    }
  },

  renderFoldersOverview() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('notes-folders-grid');
    if (!grid) return;

    const folders = this.getFolders();
    const notes = this.getAll();
    const allProjects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
      ? StorageManager.getProjects()
      : [];
    const allEvents = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function')
      ? StorageManager.getEvents()
      : [];

    const projectMap = new Map();
    allProjects.forEach(p => { if (p && p.id) projectMap.set(p.id, p); });
    const eventMap = new Map();
    allEvents.forEach(e => { if (e && e.id) eventMap.set(e.id, e); });

    let html = '';

    folders.forEach(folder => {
      // Filtrer les notes du dossier
      let folderNotes = notes.filter(n => (n.folder || 'Général').trim().toLowerCase() === folder.toLowerCase());

      // Filtrer par recherche rapide si active
      if (this.overviewSearchQuery) {
        folderNotes = folderNotes.filter(n => {
          const title = (n.title || '').toLowerCase();
          const content = (n.content || '').toLowerCase();
          return title.includes(this.overviewSearchQuery) || content.includes(this.overviewSearchQuery);
        });
      }

      // Trier les notes : épinglées en premier, puis date décroissante
      folderNotes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });

      const count = folderNotes.length;
      const countLabel = count === 1 ? '1 note' : `${count} notes`;

      html += `
        <div class="notes-folder-card" data-folder="${this.escapeHtml(folder)}">
          <div class="notes-folder-color-bar"></div>
          <div class="notes-folder-card-header">
            <div class="notes-folder-title-area" title="Dossier : ${this.escapeHtml(folder)}">
              <span class="notes-folder-icon">${this.getSvgIcon('folder', 16)}</span>
              <span class="notes-folder-name">${this.escapeHtml(folder)}</span>
              <span class="notes-folder-count-badge">${countLabel}</span>
            </div>
            <div class="notes-folder-card-actions">
              <button type="button" class="btn btn-secondary btn-sm notes-folder-add-btn" data-folder-action="new-note" title="Créer une nouvelle note dans ce dossier">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Note</span>
              </button>
              <button type="button" class="btn-icon notes-folder-menu-btn" data-folder-action="menu" title="Options du dossier">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
          </div>
          <div class="notes-folder-card-body">
      `;

      if (folderNotes.length === 0) {
        html += `
          <div class="notes-folder-empty-state" data-folder-action="new-note">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4; margin-bottom:6px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <div style="font-weight: 600; font-size: 0.82rem; margin-bottom: 2px;">Dossier vide</div>
            <div style="font-size: 0.74rem; opacity: 0.7;">Glissez une note ici ou cliquez pour en créer une.</div>
          </div>
        `;
      } else {
        folderNotes.forEach(note => {
          const title = note.title ? this.escapeHtml(note.title) : '<em>Note sans titre</em>';
          const dateStr = note.updatedAt ? this.formatDate(note.updatedAt) : '';
          const project = note.projectId ? projectMap.get(note.projectId) : null;
          const linkedEvent = note.linkedEventId ? eventMap.get(note.linkedEventId) : null;
          const isPinned = Boolean(note.pinned);

          let badgesHtml = '';
          if (isPinned) {
            badgesHtml += `<span class="note-overview-badge badge-pinned" title="Note épinglée">${this.getSvgIcon('pin', 10)}</span>`;
          }
          if (project) {
            const pColor = project.color || 'var(--accent)';
            badgesHtml += `<span class="note-overview-badge badge-project badge-clickable" style="border-left: 2px solid ${pColor}; cursor: pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('projects'); if (window.ProjectsManager) ProjectsManager.openProjectDetailModal('${project.id}');" title="Ouvrir le projet : ${this.escapeHtml(project.title)}">${this.escapeHtml(project.title)}</span>`;
          }
          if (linkedEvent) {
            badgesHtml += `<span class="note-overview-badge badge-event badge-clickable" style="cursor: pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('agenda'); if (window.AgendaManager) AgendaManager.openEventModal('${linkedEvent.id}');" title="Ouvrir le créneau lié : ${this.escapeHtml(linkedEvent.title)}">${this.getSvgIcon('calendar', 10)} ${this.escapeHtml(linkedEvent.title)}</span>`;
          }

          html += `
            <div class="notes-folder-note-item" draggable="true" data-note-id="${note.id}" onclick="NotesManager.selectNote('${note.id}'); NotesManager.setLayoutMode('editor');" title="Ouvrir cette note dans l'éditeur">
              <div class="notes-folder-note-header">
                <span class="notes-folder-note-title">${title}</span>
                <span class="notes-folder-note-date">${dateStr}</span>
              </div>
              ${badgesHtml ? `<div class="notes-folder-note-badges">${badgesHtml}</div>` : ''}
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    // Carte "+" pour ajouter un nouveau dossier (style project-card-add)
    html += `
      <div class="notes-folder-card notes-folder-card-add" onclick="NotesManager.promptNewFolder();" title="Créer un nouveau dossier de notes">
        <div class="notes-folder-add-content">
          <div class="notes-folder-add-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          </div>
          <div style="font-weight: 600; font-size: 0.95rem; margin-top: 6px;">Nouveau dossier</div>
          <div style="font-size: 0.78rem; color: var(--text-dim);">Créer un espace pour vos notes</div>
        </div>
      </div>
    `;

    grid.innerHTML = html;

    if (!grid._overviewClickBound && typeof grid.addEventListener === 'function') {
      grid._overviewClickBound = true;
      grid.addEventListener('click', (e) => {
        const actionEl = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-folder-action]') : null;
        if (!actionEl) return;
        const card = actionEl.closest('.notes-folder-card');
        const folder = card && card.dataset ? card.dataset.folder : null;
        if (!folder) return;
        e.stopPropagation();
        if (actionEl.dataset.folderAction === 'new-note') {
          this.createNoteInFolder(folder);
          this.setLayoutMode('editor');
        } else if (actionEl.dataset.folderAction === 'menu') {
          this.showFolderMenu(e, folder);
        }
      });
    }

    // Activer les écouteurs de Drag & Drop sur les cartes de dossier et notes
    this._bindFoldersOverviewDragAndDrop(grid);
  },

  _bindFoldersOverviewDragAndDrop(grid) {
    if (!grid) return;
    const noteItems = grid.querySelectorAll('.notes-folder-note-item');
    noteItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const noteId = item.dataset.noteId;
        if (!noteId) return;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', noteId);
          e.dataTransfer.effectAllowed = 'move';
        }
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
    });

    const folderCards = grid.querySelectorAll('.notes-folder-card:not(.notes-folder-card-add)');
    folderCards.forEach(card => {
      const folder = card.dataset.folder;
      if (!folder) return;

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('drag-over');
        const noteId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
        if (noteId) {
          NotesManager.moveNoteToFolder(noteId, folder);
          NotesManager.renderFoldersOverview();
        }
      });
    });
  },

  cancelPendingSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._pendingNotesToSave = null;
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

    const filterFolderSelect = document.getElementById('notes-filter-folder');
    if (filterFolderSelect) {
      filterFolderSelect.addEventListener('change', async (e) => {
        if (e.target.value === '__new__') {
          await this.promptNewFolder();
          this.renderFolderFilter();
        } else {
          this.currentFolderFilter = e.target.value;
          this.renderNotesList();
        }
      });
    }

    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
      btnNewFolder.addEventListener('click', () => this.promptNewFolder());
    }

    const inputFolderSelect = document.getElementById('note-input-folder');
    if (inputFolderSelect) {
      inputFolderSelect.addEventListener('change', async (e) => {
        if (!this.currentNoteId) return;
        const targetNoteId = this.currentNoteId;
        let val = e.target.value;
        if (val === '__new__') {
          const created = await this.promptNewFolder();
          if (created) {
            val = created;
          } else {
            const cur = this.getCurrentNote();
            e.target.value = cur ? (cur.folder || 'Général') : 'Général';
            return;
          }
        }
        if (targetNoteId) this.currentNoteId = targetNoteId;
        this.updateCurrentNoteFolder(val);
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
        if (isRich) {
          this.syncOrderedListsNumbering(editor);
        }
        const content = isRich
          ? editor.innerHTML
          : (editor.value !== undefined ? editor.value : editor.innerHTML);
        this.updateCurrentNoteContent(content);
        this.updatePreview(content);
      });

      editor.addEventListener('blur', () => {
        const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
        if (isRich) {
          this._linkifyWikilinksInEditor(editor);
        }
        this.saveEditorSelection();
        this.flushPendingSave();
      });
      editor.addEventListener('keyup', () => {
        this.saveEditorSelection();
        this._updateFormatToolbarState();
      });
      editor.addEventListener('mouseup', () => {
        this.saveEditorSelection();
        this._updateFormatToolbarState();
      });
      editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
      editor.addEventListener('paste', (e) => this.handlePaste(e));
      editor.addEventListener('drop', (e) => this.handleEditorDrop(e));

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

    if (typeof document !== 'undefined') {
      document.addEventListener('selectionchange', () => {
        const active = document.activeElement;
        if (active && active.id === 'note-body-editor') {
          this.saveEditorSelection();
          this._updateFormatToolbarState();
        }
      });
    }

    // Sélecteur de style de paragraphe / titre
    const blockSelect = document.getElementById('notes-format-block-select');
    if (blockSelect) {
      blockSelect.addEventListener('mousedown', () => this.saveEditorSelection());
      blockSelect.addEventListener('change', (e) => {
        this.restoreEditorSelection();
        this.applyFormatting(e.target.value);
      });
    }

    // Boutons doubles façon Word (Surlignage & Couleur de police)
    const btnHighlightApply = document.getElementById('btn-highlight-apply');
    const btnHighlightMenu = document.getElementById('btn-highlight-menu');
    const popoverHighlight = document.getElementById('popover-highlight-palette');
    const btnColorApply = document.getElementById('btn-color-apply');
    const btnColorMenu = document.getElementById('btn-color-menu');
    const popoverColor = document.getElementById('popover-color-palette');
    const btnColorMore = document.getElementById('btn-color-more-picker');

    if (btnHighlightApply) {
      btnHighlightApply.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (popoverHighlight) popoverHighlight.style.display = 'none';
        if (popoverColor) popoverColor.style.display = 'none';
        if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
          App.closeColorPicker(false);
        }
        const ed = document.getElementById('note-body-editor');
        this.restoreEditorSelection(ed);
        const alreadyHl = ed && this._isSelectionHasHighlight(ed, this._currentHighlightColor);
        this.applyFormatting('highlight', alreadyHl ? 'transparent' : this._currentHighlightColor);
      });
    }

    if (btnHighlightMenu && popoverHighlight) {
      btnHighlightMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.saveEditorSelection();
        const isVisible = popoverHighlight.style.display !== 'none';
        if (popoverColor) popoverColor.style.display = 'none';
        if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
          App.closeColorPicker(false);
        }
        popoverHighlight.style.display = isVisible ? 'none' : 'block';
        this._updateWordColorIndicators();
      });
    }

    if (btnColorApply) {
      btnColorApply.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (popoverHighlight) popoverHighlight.style.display = 'none';
        if (popoverColor) popoverColor.style.display = 'none';
        if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
          App.closeColorPicker(false);
        }
        const ed = document.getElementById('note-body-editor');
        this.restoreEditorSelection(ed);
        this.applyFormatting('color', this._currentTextColor);
      });
    }

    if (btnColorMenu) {
      btnColorMenu.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.saveEditorSelection();
        if (popoverHighlight) popoverHighlight.style.display = 'none';
        if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
          App.closeColorPicker(false);
        }
        if (popoverColor) {
          const isVisible = popoverColor.style.display !== 'none';
          popoverColor.style.display = isVisible ? 'none' : 'block';
          this._updateWordColorIndicators();
        }
      });
    }

    if (btnColorMore) {
      btnColorMore.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (popoverColor) popoverColor.style.display = 'none';
        if (popoverHighlight) popoverHighlight.style.display = 'none';
        if (typeof App !== 'undefined' && typeof App.openColorPicker === 'function') {
          App.openColorPicker({
            targetElement: btnColorApply || btnColorMenu,
            initialColor: this._currentTextColor || '#38BDF8',
            title: 'Couleur du texte',
            applyLabel: 'Appliquer',
            showNameInput: false,
            onApply: (hex) => {
              this._currentTextColor = hex;
              this._updateWordColorIndicators();
              this.applyFormatting('color', hex);
            }
          });
        }
      });
    }

    this._updateWordColorIndicators();

    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        if (popoverHighlight && !e.target.closest('#btn-highlight-menu') && !e.target.closest('#btn-highlight-apply') && !e.target.closest('#popover-highlight-palette')) {
          popoverHighlight.style.display = 'none';
        }
        if (popoverColor && !e.target.closest('#btn-color-menu') && !e.target.closest('#btn-color-apply') && !e.target.closest('#popover-color-palette')) {
          popoverColor.style.display = 'none';
        }
      });
    }

    // Barre d'outils de formatage : empêcher le vol de focus au mousedown sur les boutons
    const formatBar = document.getElementById('notes-format-bar');
    if (formatBar) {
      formatBar.addEventListener('mousedown', (e) => {
        const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
        if (tag === 'SELECT' || tag === 'OPTION' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.target.closest('button')) {
          this.saveEditorSelection();
          e.preventDefault();
        }
      });

      formatBar.addEventListener('click', (e) => {
        const swatch = e.target.closest('.swatch-btn, .word-palette-reset-btn');
        if (swatch && swatch.dataset && swatch.dataset.action) {
          e.preventDefault();
          this.applyFormatting(swatch.dataset.action, swatch.dataset.value);
          if (popoverHighlight) popoverHighlight.style.display = 'none';
          if (popoverColor) popoverColor.style.display = 'none';
          return;
        }

        const btn = e.target.closest('.btn-format');
        if (btn && btn.dataset && btn.dataset.action) {
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

    // Liaison bidirectionnelle Note <-> Tâches & extraction checklist
    const taskSelect = document.getElementById('note-input-task');
    if (taskSelect) {
      taskSelect.addEventListener('change', (e) => {
        this.linkCurrentNoteToTask(e.target.value || null);
      });
    }
    const btnViewTask = document.getElementById('btn-note-view-task');
    if (btnViewTask) {
      btnViewTask.addEventListener('click', () => this.viewLinkedTaskInTasks());
    }
    const btnCreateTask = document.getElementById('btn-note-create-task');
    if (btnCreateTask) {
      btnCreateTask.addEventListener('click', () => this.createTaskFromCurrentNote());
    }

    // Fermeture du menu contextuel des dossiers lors d'un clic extérieur ou appui sur Échap
    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        const menu = document.getElementById('notes-folder-context-menu');
        if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
          this.hideFolderMenu();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.hideFolderMenu();
      });
    }
  },

  getAll() {
    return StorageManager.getNotes();
  },

  saveAll(notes) {
    StorageManager.saveNotes(notes);
    this.renderNotesList();
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') {
      window.App.updateDashboard();
    }
    if (typeof window !== 'undefined' && window.ConstellationManager && typeof window.App !== 'undefined' && window.App.currentScreen === 'constellation') {
      window.ConstellationManager.render();
    }
  },

  createNote(folderOverride = null) {
    this.flushPendingSave();
    const notes = this.getAll();
    const activeFolder = (folderOverride && typeof folderOverride === 'string')
      ? folderOverride.trim()
      : ((this.currentFolderFilter && this.currentFolderFilter !== 'all')
        ? this.currentFolderFilter
        : 'Général');
    const newNote = {
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: 'Nouvelle note',
      folder: activeFolder,
      tags: [],
      projectId: null,
      linkedEventId: null,
      linkedTaskId: null,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    this.saveAll(notes);
    this.renderFolderFilter();
    this.selectNote(newNote.id);
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(folderOverride ? `Note créée dans « ${activeFolder} »` : "Note créée", "success");
    }
    return newNote;
  },

  createNoteInFolder(folderName) {
    return this.createNote(folderName);
  },

  // Alias pour rétro-compatibilité
  createNewNote() {
    return this.createNote();
  },

  selectNote(id, forceEditor = true) {
    this.flushPendingSave();
    if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
      App.closeColorPicker(false);
    }
    if (forceEditor && this.layoutMode === 'folders') {
      this.setLayoutMode('editor');
    }
    const notes = this.getAll();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    this.currentNoteId = id;

    if (typeof document !== 'undefined') {
      const titleInput = document.getElementById('note-title-editor');
      const editor = document.getElementById('note-body-editor');
      if (titleInput) titleInput.value = note.title;
      if (editor) {
        const isRich = editor.isContentEditable || (typeof editor.getAttribute === 'function' && editor.getAttribute('contenteditable') === 'true');
        if (isRich) {
          editor.innerHTML = this.formatNoteContentForEditor(note.content);
          this._normalizeColorElements(editor);
        } else {
          editor.value = note.content;
          editor.innerHTML = note.content;
        }
      }

      const blockSelect = document.getElementById('notes-format-block-select');
      if (blockSelect) blockSelect.value = 'p';

      this.updatePreview(note.content, true);
      this.renderFolderSelector(note);
      this.renderProjectSelector(note);
      this.renderEventSelector(note);
      if (typeof this.renderTaskSelector === 'function') this.renderTaskSelector(note);
      this.renderNotesList();
    }
  },

  renderFolderFilter() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('notes-filter-folder');
    if (!select) return;

    const notes = this.getAll();
    const folders = this.getFolders();
    const counts = {};
    notes.forEach(n => {
      const f = (n.folder || 'Général').trim();
      counts[f] = (counts[f] || 0) + 1;
    });

    let html = `<option value="all">📁 Tous les dossiers (${notes.length})</option>`;
    folders.forEach(f => {
      const c = counts[f] || 0;
      const selected = (this.currentFolderFilter === f) ? 'selected' : '';
      html += `<option value="${this.escapeHtml(f)}" ${selected}>📁 ${this.escapeHtml(f)} (${c})</option>`;
    });
    html += '<option value="__new__">➕ Nouveau dossier...</option>';
    select.innerHTML = html;
  },

  renderFolderSelector(note) {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('note-input-folder');
    if (!select) return;

    const folders = this.getFolders();
    const currentFolder = (note && note.folder) ? note.folder.trim() : 'Général';
    if (!folders.includes(currentFolder)) {
      folders.unshift(currentFolder);
    }

    let html = '';
    folders.forEach(f => {
      const selected = (f === currentFolder) ? 'selected' : '';
      html += `<option value="${this.escapeHtml(f)}" ${selected}>📁 ${this.escapeHtml(f)}</option>`;
    });
    html += '<option value="__new__">➕ Nouveau dossier...</option>';
    select.innerHTML = html;
  },

  updateCurrentNoteFolder(folderName) {
    if (!this.currentNoteId) return;
    const clean = (folderName || 'Général').trim();
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    note.folder = clean;
    note.updatedAt = new Date().toISOString();
    this.saveAll(notes);
    this.renderFolderFilter();
    this.renderFolderSelector(note);
    this.renderNotesList();

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Note classée dans « ${clean} »`, 'info');
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
      opt.textContent = (displayTitle || p.title || p.name || 'Projet sans nom') + (p.archived ? ' (Archivé)' : '');
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
    this.flushPendingSave();
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
      const isRecurring = !!(e.recurrence && e.recurrence !== 'none' && (!e.recurrenceEnd || e.recurrenceEnd >= todayIso));
      const eDate = e.start ? e.start.slice(0, 10) : '';
      if (isRecurring || (eDate >= todayIso && eDate <= in7DaysIso)) {
        groupThisWeek.push(e);
      } else if (eDate < todayIso) {
        groupPast.push(e);
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
    this.flushPendingSave();
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    const oldEventId = note.linkedEventId;
    note.linkedEventId = eventId || null;
    note.updatedAt = new Date().toISOString();

    // Si une autre note était liée à ce même événement, la dissocier pour maintenir une cohérence 1-à-1
    if (eventId) {
      notes.forEach(n => {
        if (n.id !== note.id && n.linkedEventId === eventId) {
          n.linkedEventId = null;
        }
      });
    }

    StorageManager.saveNotes(notes);

    // Mettre à jour la liaison réciproque sur tous les événements d'agenda (éviter les doublons anciens)
    const events = StorageManager.getEvents();
    events.forEach(e => {
      if (e && e.noteId === note.id && e.id !== eventId) {
        e.noteId = null;
      }
    });
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
    if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
      window.AgendaManager.render();
    }
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
      const isRecurring = !!(targetEvt.recurrence && targetEvt.recurrence !== 'none');
      const evtDate = new Date(targetEvt.start.slice(0, 10));
      const todayIso = new Date().toISOString().slice(0, 10);
      if (!isNaN(evtDate.getTime()) && (!isRecurring || targetEvt.start.slice(0, 10) >= todayIso)) {
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
        projectId: note.projectId || note.linkedProjectId || null,
        color: eventColor || '#8b5cf6'
      });
    }
  },

  renderTaskSelector(note) {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('note-input-task');
    const btnView = document.getElementById('btn-note-view-task');
    if (!select) return;

    const allTasks = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function')
      ? StorageManager.getTasks()
      : [];
    const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
      ? StorageManager.getProjects()
      : [];
    const archivedProj = new Set(projects.filter(p => p && p.archived).map(p => p.id));

    select.innerHTML = '<option value="">(Aucune tâche liée)</option>';
    let resolvedLinkedId = note && note.linkedTaskId ? note.linkedTaskId : null;

    const activeOpts = [];
    const doneOpts = [];
    const flatten = (list, prefix = '') => {
      for (const t of list || []) {
        if (!t) continue;
        if (!resolvedLinkedId && note && t.noteId === note.id) resolvedLinkedId = t.id;
        const isArch = t.projectId && archivedProj.has(t.projectId);
        if (!isArch) {
          const item = { id: t.id, title: `${prefix}${t.title}`, completed: !!t.completed };
          if (t.completed) doneOpts.push(item);
          else activeOpts.push(item);
        }
        if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          flatten(t.subtasks, prefix + '└ ');
        }
      }
    };
    flatten(allTasks);

    const addGrp = (label, arr) => {
      if (arr.length === 0) return;
      const grp = document.createElement('optgroup');
      grp.label = label;
      arr.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = (item.completed ? '✓ ' : '') + item.title;
        if (resolvedLinkedId && item.id === resolvedLinkedId) opt.selected = true;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    };
    addGrp('📋 À faire', activeOpts);
    addGrp('✓ Terminées', doneOpts);

    if (resolvedLinkedId && select.value !== resolvedLinkedId) {
      resolvedLinkedId = '';
    }
    if (btnView) {
      btnView.style.display = resolvedLinkedId ? 'inline-flex' : 'none';
    }
  },

  linkCurrentNoteToTask(taskId) {
    if (!this.currentNoteId) return;
    this.flushPendingSave();
    const notes = this.getAll();
    const note = notes.find(n => n.id === this.currentNoteId);
    if (!note) return;

    const cleanTaskId = taskId || null;
    note.linkedTaskId = cleanTaskId;
    note.updatedAt = new Date().toISOString();
    StorageManager.saveNotes(notes);

    if (typeof StorageManager.getTasks === 'function' && typeof StorageManager.saveTasks === 'function') {
      const tasks = StorageManager.getTasks();
      let tChanged = false;
      const syncRec = (list) => {
        for (const t of list || []) {
          if (!t) continue;
          if (t.noteId === note.id && t.id !== cleanTaskId) {
            t.noteId = null;
            tChanged = true;
          }
          if (cleanTaskId && t.id === cleanTaskId && t.noteId !== note.id) {
            t.noteId = note.id;
            tChanged = true;
          }
          if (Array.isArray(t.subtasks)) syncRec(t.subtasks);
        }
      };
      syncRec(tasks);
      if (tChanged) {
        StorageManager.saveTasks(tasks);
        if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.render === 'function') {
          window.TasksManager.render();
        }
      }
    }

    const btnView = document.getElementById('btn-note-view-task');
    if (btnView) btnView.style.display = cleanTaskId ? 'inline-flex' : 'none';
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(cleanTaskId ? "Note liée à la tâche" : "Liaison tâche retirée", "info");
    }
  },

  viewLinkedTaskInTasks() {
    if (!this.currentNoteId) return;
    const note = this.getAll().find(n => n.id === this.currentNoteId);
    if (!note) return;
    const taskId = note.linkedTaskId || null;
    if (!taskId) return;
    if (typeof window !== 'undefined' && window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('tasks');
    }
    if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
      window.TasksManager.openTaskModal(taskId);
    }
  },

  createTaskFromCurrentNote() {
    this.flushPendingSave();
    const note = this.getCurrentNote();
    if (!note) return;
    if (typeof TasksManager === 'undefined' || typeof TasksManager.addTask !== 'function') return;

    const created = TasksManager.addTask({
      title: note.title && note.title.trim() ? note.title.trim() : 'Action depuis note',
      description: `Liée à la note : ${note.title || 'Sans titre'}`,
      projectId: note.projectId || note.linkedProjectId || null,
      priority: 'medium',
      noteId: note.id
    });
    if (created && created.id) {
      this.renderTaskSelector(this.getCurrentNote());
    }
    return created || null;
  },

  _scheduleSave(notes) {
    this._pendingNotesToSave = notes;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._pendingNotesToSave = null;
      StorageManager.saveNotes(notes);
      if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') {
        window.App.updateDashboard();
      }
      if (typeof window !== 'undefined' && window.ConstellationManager && typeof window.App !== 'undefined' && window.App.currentScreen === 'constellation') {
        window.ConstellationManager.render();
      }
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
    note.content = typeof content === 'string' ? content.replace(/\u200B/g, '') : content;
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

    // Détacher la note des événements d'agenda liés
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function') {
      try {
        const events = StorageManager.getEvents();
        let eventsChanged = false;
        events.forEach(e => {
          if (e.noteId === this.currentNoteId) {
            e.noteId = null;
            e.updatedAt = new Date().toISOString();
            eventsChanged = true;
          }
        });
        if (eventsChanged) {
          StorageManager.saveEvents(events);
          if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
            window.AgendaManager.render();
          }
        }
      } catch (err) {
        console.warn("[NotesManager] Erreur lors du nettoyage des liaisons d'agenda :", err);
      }
    }

    // Détacher la note des tâches liées
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function') {
      try {
        const tasks = StorageManager.getTasks();
        let tChanged = false;
        const clearTaskNoteRec = (list) => {
          for (const t of list || []) {
            if (!t) continue;
            if (t.noteId === this.currentNoteId) {
              t.noteId = null;
              tChanged = true;
            }
            if (Array.isArray(t.subtasks)) clearTaskNoteRec(t.subtasks);
          }
        };
        clearTaskNoteRec(tasks);
        if (tChanged && typeof StorageManager.saveTasks === 'function') {
          StorageManager.saveTasks(tasks);
          if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.render === 'function') {
            window.TasksManager.render();
          }
        }
      } catch (_) {}
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
      const safeTitle = note.title || 'Note sans titre';
      const rawContent = note.content || '';
      const isHtml = /<[a-z][\s\S]*>/i.test(rawContent);
      const ext = isHtml ? 'html' : 'txt';
      const mime = isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
      let exportBody = rawContent;
      if (isHtml) {
        exportBody = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${this.escapeHtml(safeTitle)}</title>\n<style>body{font-family:sans-serif;max-width:820px;margin:40px auto;line-height:1.7;padding:0 20px;}h1,h2,h3{color:#1e293b;}blockquote{border-left:4px solid #38bdf8;margin:1em 0;padding:8px 16px;background:#f8fafc;color:#64748b;}</style>\n</head>\n<body>\n<h1>${this.escapeHtml(safeTitle)}</h1>\n${rawContent}\n</body>\n</html>`;
      }
      const blob = new Blob([exportBody], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle.replace(/[/\\?%*:|"<>]/g, '-')}.${ext}`;
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

    const filteredByFolder = filteredByProject.filter(n => {
      if (!this.currentFolderFilter || this.currentFolderFilter === 'all') return true;
      const f = (n.folder || 'Général').trim().toLowerCase();
      return f === this.currentFolderFilter.trim().toLowerCase();
    });

    const filtered = filteredByFolder.filter(n => 
      !this.searchQuery || 
      (n.title || '').toLowerCase().includes(this.searchQuery) || 
      (n.content || '').toLowerCase().includes(this.searchQuery)
    );

    const isSpecificFolder = (this.currentFolderFilter && this.currentFolderFilter !== 'all');
    if (filtered.length === 0 && (this.searchQuery || isSpecificFolder)) {
      const targetFolder = isSpecificFolder ? this.currentFolderFilter : 'Général';
      listEl.innerHTML = `
        <div class="antigravite-empty-state notes-empty-state" style="margin: 16px 10px; padding: 26px 14px;">
          <div class="empty-state-illustration" style="margin-bottom: 8px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="empty-state-title" style="font-size: 0.92rem;">${this.searchQuery ? 'Aucun résultat' : 'Dossier « ' + this.escapeHtml(targetFolder) + ' » vide'}</div>
          <p class="empty-state-text" style="font-size: 0.76rem; margin: 0 0 10px 0;">${this.searchQuery ? 'Aucune note ne correspond à votre recherche.' : 'Ce dossier ne contient encore aucune note. Créez-en une en un clic :'}</p>
          ${!this.searchQuery ? `<button type="button" class="btn btn-primary btn-sm" onclick="NotesManager.createNoteInFolder('${this.escapeHtml(targetFolder).replace(/'/g, "\\'")}')" style="font-size: 0.74rem; padding: 4px 10px;"><svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> <span>Nouvelle note dans ce dossier</span></button>` : ''}
        </div>
      `;
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

    const buildNoteItem = (note) => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === this.currentNoteId ? 'active' : ''}`;
      if (item.dataset) item.dataset.noteId = note.id;
      item.draggable = true;
      item.ondragstart = (e) => {
        if (e && e.dataTransfer && typeof e.dataTransfer.setData === 'function') {
          e.dataTransfer.setData('text/plain', note.id);
        }
      };
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
        projectBadge = `<span class="badge badge-project badge-clickable" style="background:${projColor}20; color:${projColor}; border:1px solid ${projColor}60; font-size:0.72rem; padding:1px 7px; border-radius:4px; font-weight:600; display:inline-flex; align-items:center; cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('projects'); if (window.ProjectsManager) ProjectsManager.openProjectDetailModal('${proj.id}');" title="Ouvrir le projet : ${this.escapeHtml(proj.title)}"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${projColor}; margin-right:4px;"></span>${this.getSvgIcon('folder', 11)}<span style="margin-left:3px;">${this.escapeHtml(proj.title)}</span></span>`;
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
        eventBadge = `<span class="badge badge-clickable" style="background:rgba(56,189,248,0.15); color:var(--accent); font-size:0.7rem; padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px; cursor:pointer;" onclick="event.stopPropagation(); NotesManager.selectNote('${note.id}'); NotesManager.viewLinkedEventInAgenda();" title="Créneau lié : ${this.escapeHtml(linkedEvt.title)} (cliquer pour voir dans l'agenda)">${this.getSvgIcon('calendar', 11)} <span>${timeStr || 'Agenda'}</span></span>`;
      }

      item.innerHTML = `
        <div class="note-item-title">${this.escapeHtml(note.title)}</div>
        <div class="note-item-meta" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="display:inline-flex; align-items:center; gap:3px;">${this.getSvgIcon('folder', 12)} ${this.escapeHtml(note.folder || 'Général')}</span>
          <span>• ${updatedDate}</span>
          ${projectBadge}
          ${eventBadge}
        </div>
      `;
      return item;
    };

    if (this.currentFolderFilter === 'all' && !this.searchQuery) {
      // Regroupement par dossier avec arborescence et pliage/dépliage
      const notesByFolder = new Map();
      const allKnownFolders = this.getFolders();
      allKnownFolders.forEach(f => notesByFolder.set(f, []));

      filtered.forEach(note => {
        const f = (note.folder || 'Général').trim();
        if (!notesByFolder.has(f)) notesByFolder.set(f, []);
        notesByFolder.get(f).push(note);
      });

      notesByFolder.forEach((folderNotes, folderName) => {
        const isCollapsed = this._collapsedFolders && this._collapsedFolders.has(folderName);
        const groupEl = document.createElement('div');
        groupEl.className = 'note-folder-group';
        if (groupEl.dataset) groupEl.dataset.folder = folderName;

        const headerEl = document.createElement('div');
        headerEl.className = 'note-folder-header';
        headerEl.title = `Dossier « ${folderName} » (${folderNotes.length} note${folderNotes.length > 1 ? 's' : ''}) - Glissez une note pour la ranger ici`;

        headerEl.onclick = () => {
          this.toggleFolderCollapse(folderName);
        };

        // Zone de dépôt pour ranger une note dans ce dossier
        headerEl.ondragover = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          headerEl.classList.add('drag-over');
        };
        headerEl.ondragleave = () => {
          headerEl.classList.remove('drag-over');
        };
        headerEl.ondrop = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          headerEl.classList.remove('drag-over');
          const noteId = e && e.dataTransfer && typeof e.dataTransfer.getData === 'function' ? e.dataTransfer.getData('text/plain') : null;
          if (noteId) {
            this.moveNoteToFolder(noteId, folderName);
          }
        };

        headerEl.innerHTML = `
          <span class="note-folder-chevron">${isCollapsed ? '▸' : '▾'}</span>
          <span class="note-folder-title">${this.getSvgIcon('folder', 14)} ${this.escapeHtml(folderName)}</span>
          <span class="note-folder-count">${folderNotes.length}</span>
          <button type="button" class="note-folder-actions-btn" title="Options du dossier (Renommer / Supprimer)">⋯</button>
        `;
        const btnActions = headerEl.querySelector ? headerEl.querySelector('.note-folder-actions-btn') : null;
        if (btnActions) {
          btnActions.onclick = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            this.showFolderMenu(e, folderName);
          };
        }
        headerEl.oncontextmenu = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          this.showFolderMenu(e, folderName);
        };
        groupEl.appendChild(headerEl);

        if (!isCollapsed) {
          const itemsContainer = document.createElement('div');
          itemsContainer.className = 'note-folder-items';
          if (folderNotes.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'note-folder-empty-placeholder';
            emptyEl.title = `Créer une première note dans « ${folderName} » ou glissez-y une note existante`;
            emptyEl.innerHTML = `<span style="font-weight:600; opacity:0.8;">＋</span> <span>Nouvelle note dans ce dossier</span>`;
            emptyEl.onclick = (e) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
              this.createNoteInFolder(folderName);
            };
            emptyEl.ondragover = headerEl.ondragover;
            emptyEl.ondragleave = headerEl.ondragleave;
            emptyEl.ondrop = headerEl.ondrop;
            itemsContainer.appendChild(emptyEl);
          } else {
            folderNotes.forEach(note => {
              itemsContainer.appendChild(buildNoteItem(note));
            });
          }
          groupEl.appendChild(itemsContainer);
        }

        frag.appendChild(groupEl);
      });
    } else {
      // Affichage direct (dossier filtré spécifique ou recherche textuelle active)
      filtered.forEach(note => {
        frag.appendChild(buildNoteItem(note));
      });
    }

    if (useFrag) {
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }
  },

  updatePreview(markdown, immediate = false) {
    if (typeof document === 'undefined') return;
    const previewEl = document.getElementById('notes-preview-container');
    if (!previewEl) return;
    if (previewEl.style && previewEl.style.display === 'none') return;

    if (immediate) {
      if (this._previewDebounceTimer) {
        clearTimeout(this._previewDebounceTimer);
        this._previewDebounceTimer = null;
      }
      previewEl.innerHTML = this.simpleMarkdownToHtml(markdown);
      return;
    }

    if (this._previewDebounceTimer) clearTimeout(this._previewDebounceTimer);
    this._previewDebounceTimer = setTimeout(() => {
      this._previewDebounceTimer = null;
      previewEl.innerHTML = this.simpleMarkdownToHtml(markdown);
    }, 40);
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
      // Liens internes de notes persistants (note://id)
      if (href.startsWith('note://')) {
        const noteId = href.replace('note://', '').trim();
        if (noteId) {
          this.selectNote(noteId);
          return true;
        }
      }
      // Seuls les protocoles HTTP et HTTPS sont autorisés à ouvrir le navigateur externe
      if (/^https?:\/\//i.test(href)) {
        if (typeof window !== 'undefined' && window.AntigraviteAPI && typeof window.AntigraviteAPI.openExternal === 'function') {
          window.AntigraviteAPI.openExternal(href);
          return true;
        }
      }
      return false;
    }

    // Prise en charge des Wikilinks et liens internes ([[Titre]] ou [[Titre|Alias]])
    let targetWikiRaw = null;
    const wikilink = (target && typeof target.closest === 'function') ? target.closest('.obsidian-wikilink') : null;
    if (wikilink && wikilink.dataset && wikilink.dataset.target) {
      targetWikiRaw = wikilink.dataset.target;
    } else if (typeof document !== 'undefined' && e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      targetWikiRaw = this._extractRawWikilinkAtPoint(e.clientX, e.clientY);
    }

    if (targetWikiRaw) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      const targetName = targetWikiRaw.trim().toLowerCase();
      const allNotes = this.getAll();
      const match = allNotes.find(n => (n.title || '').trim().toLowerCase() === targetName || (n.id || '').toLowerCase() === targetName);
      if (match) {
        this.selectNote(match.id);
        if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Ouverture : ${match.title}`, 'info');
        }
        return true;
      }
    }

    return undefined;
  },

  _extractRawWikilinkAtPoint(clientX, clientY) {
    if (typeof document === 'undefined') return null;
    let node = null;
    let offset = 0;
    if (typeof document.caretPositionFromPoint === 'function') {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        node = pos.offsetNode;
        offset = pos.offset;
      }
    } else if (typeof document.caretRangeFromPoint === 'function') {
      const rng = document.caretRangeFromPoint(clientX, clientY);
      if (rng) {
        node = rng.startContainer;
        offset = rng.startOffset;
      }
    }
    if (!node || node.nodeType !== 3 || !node.textContent || !node.textContent.includes('[[')) return null;
    const text = node.textContent;
    const regex = /\[\[([^\]\|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (offset >= m.index && offset <= m.index + m[0].length) {
        return m[1];
      }
    }
    return null;
  },

  _linkifyWikilinksInEditor(editor) {
    if (!editor || typeof document === 'undefined' || !editor.innerHTML || !editor.innerHTML.includes('[[')) return;
    const walker = (typeof document.createTreeWalker === 'function')
      ? document.createTreeWalker(editor, 4) // NodeFilter.SHOW_TEXT = 4
      : null;
    if (!walker) return;
    const textNodes = [];
    let cur;
    while ((cur = walker.nextNode())) {
      if (cur.parentElement && cur.parentElement.closest('.obsidian-wikilink, code, pre, a')) continue;
      if (cur.nodeValue && cur.nodeValue.includes('[[')) textNodes.push(cur);
    }
    if (textNodes.length === 0) return;
    let modified = false;
    textNodes.forEach(txtNode => {
      const val = txtNode.nodeValue;
      const regex = /\[\[([^\]\|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g;
      if (!regex.test(val)) return;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      while ((match = regex.exec(val)) !== null) {
        if (match.index > lastIdx) {
          frag.appendChild(document.createTextNode(val.slice(lastIdx, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'obsidian-wikilink';
        span.dataset.target = match[1].trim();
        span.title = `Ouvrir : ${match[1].trim()}`;
        span.textContent = match[0];
        frag.appendChild(span);
        lastIdx = match.index + match[0].length;
        modified = true;
      }
      if (lastIdx < val.length) {
        frag.appendChild(document.createTextNode(val.slice(lastIdx)));
      }
      if (txtNode.parentNode) {
        txtNode.parentNode.replaceChild(frag, txtNode);
      }
    });
    if (modified && this.currentNoteId) {
      this.updateCurrentNoteContent(editor.innerHTML);
      this.updatePreview(editor.innerHTML);
    }
  },

  _hasTransferImage(dataTransfer) {
    if (!dataTransfer) return false;
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const f = dataTransfer.files[i];
        if (f && typeof f.type === 'string' && f.type.startsWith('image/')) return true;
      }
    }
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const it = dataTransfer.items[i];
        if (it && it.kind === 'file' && typeof it.type === 'string' && it.type.startsWith('image/')) return true;
      }
    }
    return false;
  },

  handleEditorDrop(e) {
    if (!e || !e.dataTransfer || !this.currentNoteId) return;
    const hasImage = this._hasTransferImage(e.dataTransfer);
    const html = e.dataTransfer.getData ? e.dataTransfer.getData('text/html') : '';
    if (hasImage || (html && /data:image\//i.test(html))) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Les images lourdes ne peuvent pas être intégrées directement dans les notes (protection du stockage local).", "warning");
      }
    }
  },

  // Gestionnaire de collage avec nettoyage et assainissement automatique
  handlePaste(e) {
    if (!e || !e.clipboardData) return;
    
    // Si l'éditeur n'est pas actif ou qu'aucune note n'est sélectionnée, laisser le comportement par défaut
    if (!this.currentNoteId) return;

    const clipboardData = e.clipboardData;
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');
    const hasImageFile = this._hasTransferImage(clipboardData);

    // Bloquer les captures / images binaires brutes collées (évite les images Base64 multi-Mo dans localStorage)
    if (hasImageFile && (!text || !text.trim()) && (!html || /<img\b/i.test(html))) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Collage d'image directe désactivé pour préserver le stockage local sur le long terme.", "warning");
      }
      return;
    }

    // Si aucun contenu exploitable
    if (!html && !text) return;

    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    let sanitizedHtml = '';

    if (html && html.trim()) {
      sanitizedHtml = this.sanitizePastedHtml(html);
    } else if (text) {
      const normalizedText = text.replace(/\r\n/g, '\n');
      const lines = normalizedText.split('\n');
      if (lines.length > 1) {
        const nonEmpty = lines.filter(l => l.trim().length > 0);
        const allBullets = nonEmpty.length > 0 && nonEmpty.every(l => /^\s*[-*•]\s+/.test(l) && !/^\s*[-*]\s+\[[ xX]\]/.test(l));
        if (allBullets) {
          sanitizedHtml = '<ul>' + nonEmpty.map(l => `<li>${this.escapeHtml(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('') + '</ul>';
        } else {
          sanitizedHtml = lines.map(l => l.trim() ? `<p>${this.escapeHtml(l)}</p>` : '<p><br></p>').join('');
        }
      } else {
        sanitizedHtml = this.escapeHtml(normalizedText);
      }
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

      // 1. Supprimer les éléments potentiellement dangereux, invisibles ou parasites (dont <img> base64 lourdes)
      const disallowedTags = [
        'script', 'style', 'iframe', 'object', 'embed', 'applet',
        'form', 'input', 'button', 'select', 'textarea', 'meta',
        'link', 'head', 'title', 'base', 'svg', 'canvas', 'xml', 'img'
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
      const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function' ? window.getSelection() : null;
      const selectionInsideEditor = !!(
        sel &&
        sel.rangeCount > 0 &&
        editor.contains &&
        editor.contains(sel.getRangeAt(0).commonAncestorContainer)
      );

      if (action === 'link' && !value) {
        this.saveEditorSelection();
        if (typeof App !== 'undefined' && typeof App.prompt === 'function') {
          App.prompt({
            title: 'Insérer un lien',
            message: "Entrez l'URL de destination (http(s)://, mailto: ou note://) :",
            defaultValue: 'https://',
            placeholder: 'https://...',
            confirmText: 'Insérer'
          }).then((rawUrl) => {
            if (!rawUrl) return;
            const safeUrl = this._normalizeSafeLinkUrl(rawUrl);
            if (!safeUrl) {
              if (typeof App.showToast === 'function') {
                App.showToast("URL invalide ou protocole non autorisé.", "warning");
              }
              return;
            }
            if (typeof editor.focus === 'function') editor.focus();
            this.restoreEditorSelection(editor);
            document.execCommand('createLink', false, safeUrl);
            const newHtml = editor.innerHTML;
            this.updateCurrentNoteContent(newHtml);
            this.saveEditorSelection();
          }).catch(() => {});
          return { pending: true };
        }
      }

      if (typeof document.activeElement !== 'undefined' && document.activeElement !== editor && typeof editor.focus === 'function') {
        editor.focus();
      }
      if (!selectionInsideEditor) {
        this.restoreEditorSelection(editor);
      }
      try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
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
        case 'highlight':
          this._applyHighlightWord(editor, value);
          break;
        case 'color':
          this._applyTextColorWord(editor, value);
          break;
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
          this._splitLineBreaksBeforeList(editor);
          document.execCommand('insertUnorderedList', false, null);
          this._normalizeEditorLists(editor);
          break;
        case 'number':
          this._splitLineBreaksBeforeList(editor);
          document.execCommand('insertOrderedList', false, null);
          this._normalizeEditorLists(editor);
          this._handleOrderedListCreation(editor);
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
          const selText = typeof window !== 'undefined' && window.getSelection ? window.getSelection().toString() : '';
          const escaped = selText ? this.escapeHtml(selText) : 'code';
          document.execCommand('insertHTML', false, `<code>${escaped}</code>`);
          break;
        }
        case 'link': {
          let rawUrl = value;
          if (!rawUrl && typeof window !== 'undefined' && typeof window.prompt === 'function') {
            rawUrl = window.prompt("Entrez l'URL du lien :", "https://");
          }
          const safeUrl = this._normalizeSafeLinkUrl(rawUrl);
          if (safeUrl) {
            document.execCommand('createLink', false, safeUrl);
          }
          break;
        }
        case 'clear':
          document.execCommand('removeFormat', false, null);
          this._clearInlineStyleOnSelection(editor, 'color');
          this._clearInlineStyleOnSelection(editor, 'backgroundColor');
          break;
      }
      const newHtml = (editor.innerHTML || '').replace(/\u200B/g, '');
      this.updateCurrentNoteContent(newHtml);
      this.saveEditorSelection();
      this._updateFormatToolbarState();
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

  // --- Couleurs texte & surlignage façon Word ---

  _isSelectionHasHighlight(editor, _targetColor = null) {
    if (!editor || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== editor) {
      if (node.tagName === 'MARK' || (node.style && node.style.backgroundColor && node.style.backgroundColor !== 'transparent' && node.style.backgroundColor !== 'rgba(0, 0, 0, 0)')) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  },

  _breakOutOfStyleAtCaret(editor, sel, styleProp) {
    if (!editor || !sel || sel.rangeCount === 0 || typeof document === 'undefined') return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const isStyledMatch = (el) => {
      if (!el || el.nodeType !== 1 || el === editor) return false;
      if (styleProp === 'color') {
        return !!((el.style && el.style.color) || (el.tagName === 'FONT' && el.hasAttribute('color')));
      }
      return !!(el.tagName === 'MARK' || (el.style && el.style.backgroundColor && el.style.backgroundColor !== 'transparent'));
    };

    let styledAncestor = null;
    let cur = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
    while (cur && cur !== editor) {
      if (isStyledMatch(cur)) styledAncestor = cur;
      cur = cur.parentNode;
    }
    if (!styledAncestor || !styledAncestor.parentNode) return false;

    const afterRange = document.createRange();
    afterRange.setStart(range.startContainer, range.startOffset);
    afterRange.setEnd(styledAncestor, styledAncestor.childNodes.length);
    const tailFrag = afterRange.extractContents();

    const parent = styledAncestor.parentNode;
    const nextSibling = styledAncestor.nextSibling;

    const zwsNode = document.createTextNode('\u200B');
    parent.insertBefore(zwsNode, nextSibling);

    if (tailFrag && ((tailFrag.textContent && tailFrag.textContent.length > 0) || (tailFrag.querySelector && tailFrag.querySelector('*')))) {
      const tailWrapper = styledAncestor.cloneNode(false);
      tailWrapper.appendChild(tailFrag);
      parent.insertBefore(tailWrapper, zwsNode.nextSibling);
    }

    if (!styledAncestor.textContent && (!styledAncestor.querySelector || !styledAncestor.querySelector('br, img, input'))) {
      parent.removeChild(styledAncestor);
    }

    const nextRange = document.createRange();
    nextRange.setStart(zwsNode, 1);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    return true;
  },

  _clearInlineStyleOnSelection(editor, styleProp) {
    if (!editor || typeof document === 'undefined' || typeof window === 'undefined' || typeof window.getSelection !== 'function') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      this._breakOutOfStyleAtCaret(editor, sel, styleProp);
      return;
    }

    const sentinel = 'rgb(1, 2, 3)';
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    if (styleProp === 'color') {
      document.execCommand('foreColor', false, sentinel);
    } else {
      if (!document.execCommand('hiliteColor', false, sentinel)) {
        document.execCommand('backColor', false, sentinel);
      }
    }

    const isSentinel = (val) => {
      if (!val || typeof val !== 'string') return false;
      const norm = val.replace(/\s+/g, '').toLowerCase();
      return norm === 'rgb(1,2,3)' || norm === '#010203';
    };

    const unwrapIfPlain = (el) => {
      if (!el || !el.parentNode || el === editor) return;
      if ((el.tagName === 'SPAN' || el.tagName === 'FONT' || el.tagName === 'MARK') && (!el.getAttribute('style') || !el.getAttribute('style').trim()) && el.attributes.length === 0) {
        const p = el.parentNode;
        while (el.firstChild) p.insertBefore(el.firstChild, el);
        p.removeChild(el);
      }
    };

    if (typeof editor.querySelectorAll === 'function') {
      Array.from(editor.querySelectorAll('span, font, mark')).forEach(el => {
        const val = styleProp === 'color'
          ? (el.style.color || el.getAttribute('color') || '')
          : (el.style.backgroundColor || '');
        if (isSentinel(val) || (styleProp === 'backgroundColor' && el.tagName === 'MARK' && sel.containsNode && sel.containsNode(el, true))) {
          if (styleProp === 'color') {
            el.style.color = '';
            el.removeAttribute('color');
          } else {
            el.style.backgroundColor = '';
            el.style.background = '';
            el.removeAttribute('data-hl-light');
          }
          if (el.getAttribute('style') === '') el.removeAttribute('style');
          if (styleProp === 'backgroundColor' && el.tagName === 'MARK') {
            el.removeAttribute('class');
          }
          unwrapIfPlain(el);
        }
      });
    }
    this._annotateHighlightContrast(editor);
  },

  _applyTextColorWord(editor, value) {
    if (!value || value === 'inherit' || value === 'default' || value === 'auto') {
      this._clearInlineStyleOnSelection(editor, 'color');
      this._updateWordColorIndicators();
      return;
    }
    this._currentTextColor = value;
    this._updateWordColorIndicators();
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    document.execCommand('foreColor', false, value);
    this._normalizeColorElements(editor);
  },

  _applyHighlightWord(editor, value) {
    if (value === 'transparent' || value === 'remove' || value === 'none') {
      this._clearInlineStyleOnSelection(editor, 'backgroundColor');
      this._updateWordColorIndicators();
      return;
    }
    const color = value || this._currentHighlightColor || '#fef08a';
    this._currentHighlightColor = color;
    this._updateWordColorIndicators();
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    if (!document.execCommand('hiliteColor', false, color)) {
      document.execCommand('backColor', false, color);
    }
    this._annotateHighlightContrast(editor);
  },

  // --- Gestion fiable des listes à puces & numérotées façon Word ---

  _splitLineBreaksBeforeList(editor) {
    if (!editor || typeof window === 'undefined' || typeof window.getSelection !== 'function' || typeof document === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container && container.nodeType === 3) container = container.parentNode;
    if (!container || (container.closest && container.closest('ul, ol'))) return;

    const blocks = [];
    if (container === editor) {
      Array.from(editor.children).forEach(ch => {
        if ((ch.tagName === 'P' || ch.tagName === 'DIV') && sel.containsNode && sel.containsNode(ch, true)) {
          blocks.push(ch);
        }
      });
    } else if (container.closest) {
      const blk = container.closest('p, div');
      if (blk && blk !== editor) blocks.push(blk);
    }

    blocks.forEach(blk => {
      if (!blk.querySelector || !blk.querySelector('br')) return;
      const parts = [];
      let cur = [];
      Array.from(blk.childNodes).forEach(ch => {
        if (ch.nodeType === 1 && ch.tagName === 'BR') {
          parts.push(cur);
          cur = [];
        } else {
          cur.push(ch);
        }
      });
      parts.push(cur);
      if (parts.length <= 1) return;

      const frag = document.createDocumentFragment();
      const newBlocks = [];
      parts.forEach(nodes => {
        const p = document.createElement('p');
        nodes.forEach(n => p.appendChild(n));
        if (!p.textContent && (!p.querySelector || !p.querySelector('*'))) {
          p.innerHTML = '<br>';
        }
        newBlocks.push(p);
        frag.appendChild(p);
      });
      if (blk.parentNode) {
        blk.parentNode.replaceChild(frag, blk);
        if (range.collapsed && newBlocks.length > 0) {
          // Garde le curseur actif dans le nouveau paragraphe splité
          const activeP = newBlocks.find(p => sel.containsNode && sel.containsNode(p, true)) || newBlocks[0];
          try {
            const nr = document.createRange();
            nr.selectNodeContents(activeP);
            nr.collapse(false);
            sel.removeAllRanges();
            sel.addRange(nr);
          } catch (_) {}
        }
      }
    });
  },

  _normalizeEditorLists(editor) {
    if (!editor || typeof editor.querySelectorAll !== 'function') return;
    // Supprimer les wrapper <div><ul>...</ul></div> créés par Chromium autour des listes
    Array.from(editor.querySelectorAll('div')).forEach(div => {
      if (div.children.length === 1 && (div.firstElementChild.tagName === 'UL' || div.firstElementChild.tagName === 'OL') && !(div.className || '').includes('note-')) {
        const listEl = div.firstElementChild;
        if (div.parentNode) div.parentNode.replaceChild(listEl, div);
      }
    });
    // Supprimer d'éventuelles listes totalement vides et styles parasites sur <ul>/<ol>/<li>
    Array.from(editor.querySelectorAll('ul, ol')).forEach(listEl => {
      if (listEl.children.length === 0 && listEl.parentNode) {
        listEl.parentNode.removeChild(listEl);
      }
    });
  },

  _getSelectedListItems(sel, editor) {
    if (!sel || sel.rangeCount === 0 || !editor) return [];
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      let node = sel.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      const li = node && node.closest ? node.closest('li') : null;
      return (li && editor.contains(li)) ? [li] : [];
    }
    const allLis = Array.from(editor.querySelectorAll('li'));
    const matched = allLis.filter(li => sel.containsNode ? sel.containsNode(li, true) : false);
    // Filtrer les parents <li> qui englobent uniquement un <li> enfant déjà sélectionné
    return matched.filter(li => !matched.some(other => other !== li && li.contains(other)));
  },

  _indentListItems(editor, sel) {
    const lis = this._getSelectedListItems(sel, editor);
    if (lis.length === 0) return false;
    const savedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    let changed = false;

    lis.forEach(li => {
      const parentList = li.parentElement;
      if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return;
      const prevLi = li.previousElementSibling;
      if (!prevLi || prevLi.tagName !== 'LI') return;

      const listTag = parentList.tagName.toLowerCase();
      const lastChild = prevLi.lastElementChild;
      let subList = (lastChild && lastChild.tagName === parentList.tagName) ? lastChild : null;
      if (!subList) {
        subList = document.createElement(listTag);
        prevLi.appendChild(subList);
      }
      subList.appendChild(li);
      changed = true;
    });

    if (changed && savedRange) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch (_) {}
    }
    this._normalizeEditorLists(editor);
    return changed;
  },

  _outdentSingleListItem(li, editor) {
    if (!li || !editor || typeof document === 'undefined') return false;
    const parentList = li.parentElement;
    if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return false;

    const sel = (typeof window !== 'undefined' && typeof window.getSelection === 'function') ? window.getSelection() : null;
    const savedAnchor = (sel && sel.rangeCount > 0) ? sel.anchorNode : null;
    const savedOffset = (sel && sel.rangeCount > 0) ? sel.anchorOffset : 0;

    const followingLis = [];
    let sib = li.nextElementSibling;
    while (sib) {
      const next = sib.nextElementSibling;
      if (sib.tagName === 'LI') followingLis.push(sib);
      sib = next;
    }

    const outerLi = (parentList.parentElement && parentList.parentElement.closest) ? parentList.parentElement.closest('li') : null;
    const outerList = (outerLi && outerLi.parentElement) ? outerLi.parentElement : null;

    if (outerLi && outerList) {
      if (followingLis.length > 0) {
        const listTag = parentList.tagName.toLowerCase();
        const lastEl = li.lastElementChild;
        const sub = (lastEl && lastEl.tagName === parentList.tagName) ? lastEl : document.createElement(listTag);
        if (!sub.parentNode) li.appendChild(sub);
        followingLis.forEach(f => sub.appendChild(f));
      }
      outerList.insertBefore(li, outerLi.nextSibling);
      if (parentList.children.length === 0 && parentList.parentNode) {
        parentList.parentNode.removeChild(parentList);
      }
      if (sel && savedAnchor && li.contains(savedAnchor)) {
        try { sel.collapse(savedAnchor, savedOffset); } catch (_) {}
      } else if (sel) {
        try {
          const r = document.createRange();
          r.setStart(li, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        } catch (_) {}
      }
      return true;
    }

    // Niveau racine : convertir le <li> en paragraphe propre sans blockquote
    const p = document.createElement('p');
    const nestedLists = [];
    Array.from(li.childNodes).forEach(ch => {
      if (ch.nodeType === 1 && (ch.tagName === 'UL' || ch.tagName === 'OL')) {
        nestedLists.push(ch);
      } else {
        p.appendChild(ch);
      }
    });
    if (!p.textContent && (!p.querySelector || !p.querySelector('*'))) {
      p.innerHTML = '<br>';
    }

    const containerParent = parentList.parentNode;
    let insertBeforeTarget = parentList.nextSibling;

    if (followingLis.length > 0) {
      const afterList = document.createElement(parentList.tagName.toLowerCase());
      if (parentList.tagName === 'OL') {
        const origStart = parseInt(parentList.getAttribute('start') || '1', 10);
        const precedingCount = parentList.querySelectorAll(':scope > li').length - followingLis.length - 1;
        afterList.setAttribute('start', origStart + Math.max(0, precedingCount) + 1);
      }
      followingLis.forEach(f => afterList.appendChild(f));
      containerParent.insertBefore(afterList, insertBeforeTarget);
      insertBeforeTarget = afterList;
    }

    containerParent.insertBefore(p, insertBeforeTarget);
    nestedLists.forEach(nl => containerParent.insertBefore(nl, insertBeforeTarget));
    parentList.removeChild(li);
    if (parentList.children.length === 0) {
      containerParent.removeChild(parentList);
    }

    if (sel) {
      try {
        if (savedAnchor && p.contains(savedAnchor)) {
          sel.collapse(savedAnchor, savedOffset);
        } else {
          const nr = document.createRange();
          nr.setStart(p, 0);
          nr.collapse(true);
          sel.removeAllRanges();
          sel.addRange(nr);
        }
      } catch (_) {}
    }
    this._normalizeEditorLists(editor);
    return true;
  },

  _isListItemEmpty(li) {
    if (!li) return false;
    if (li.querySelector && li.querySelector('ul, ol')) return false;
    return (li.textContent || '').replace(/[\u200B\u00a0\s]/g, '') === '';
  },

  _isCaretAtStartOfElement(sel, el) {
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el || typeof document === 'undefined') return false;
    try {
      const testRange = document.createRange();
      testRange.setStart(el, 0);
      testRange.setEnd(sel.anchorNode, sel.anchorOffset);
      if (testRange.toString().length > 0) return false;
      const frag = testRange.cloneContents();
      return !frag.querySelector || !frag.querySelector('input, hr, img');
    } catch (_) {
      return false;
    }
  },

  _convertCurrentBlockToList(editor, sel, listTagName, startNum = 1, markerLen = 0) {
    if (!editor || !sel || sel.rangeCount === 0 || typeof document === 'undefined') return false;
    const range = sel.getRangeAt(0);
    let cur = range.startContainer;
    if (cur.nodeType === 3) cur = cur.parentNode;

    // Retirer le préfixe tapé (- / * / 1.) sans casser les balises autour
    let blockEl = (cur && cur.closest) ? cur.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote') : null;
    if (blockEl === editor) blockEl = null;

    const listEl = document.createElement(listTagName);
    if (listTagName === 'ol') {
      const parentOl = listEl;
      parentOl.setAttribute('start', startNum);
      if (startNum > 1) {
        parentOl.setAttribute('data-auto-start', 'true');
      }
    }
    const li = document.createElement('li');

    if (blockEl && blockEl.parentNode) {
      const prefixRange = document.createRange();
      prefixRange.setStart(blockEl, 0);
      prefixRange.setEnd(range.startContainer, range.startOffset);
      prefixRange.deleteContents();

      while (blockEl.firstChild) {
        li.appendChild(blockEl.firstChild);
      }
      // Retirer d'éventuels espaces résiduels tout au début
      if (li.firstChild && li.firstChild.nodeType === 3) {
        li.firstChild.textContent = li.firstChild.textContent.replace(/^[\u00a0 ]+/, '');
      }
      if (!li.textContent && (!li.querySelector || !li.querySelector('br, *'))) {
        li.innerHTML = '<br>';
      }

      const prevEl = blockEl.previousElementSibling;
      if (prevEl && prevEl.tagName.toLowerCase() === listTagName && !(listTagName === 'ol' && startNum > 1)) {
        prevEl.appendChild(li);
        blockEl.parentNode.removeChild(blockEl);
      } else {
        listEl.appendChild(li);
        blockEl.parentNode.replaceChild(listEl, blockEl);
      }
    } else {
      // Texte directement enfant de #note-body-editor (note neuve)
      const anchorNode = range.startContainer;
      if (anchorNode.nodeType === 3) {
        anchorNode.textContent = (anchorNode.textContent || '').slice(range.startOffset).replace(/^[\u00a0 ]+/, '');
      } else if (markerLen > 0) {
        const prefixRange = document.createRange();
        prefixRange.setStart(editor, 0);
        prefixRange.setEnd(range.startContainer, range.startOffset);
        prefixRange.deleteContents();
      }
      // Collecter la ligne inline courante entourée de blocs ou <br>
      const isLineBoundary = (n) => {
        if (!n) return true;
        if (n.nodeType !== 1) return false;
        return /^(P|DIV|UL|OL|H[1-6]|BLOCKQUOTE|HR|PRE|BR)$/i.test(n.tagName);
      };
      let firstInline = (anchorNode.nodeType === 3 && anchorNode.parentNode === editor) ? anchorNode : range.startContainer;
      while (firstInline && firstInline.parentNode !== editor) firstInline = firstInline.parentNode;

      let startNode = firstInline;
      while (startNode && startNode.previousSibling && !isLineBoundary(startNode.previousSibling)) {
        startNode = startNode.previousSibling;
      }
      const collected = [];
      let ptr = startNode;
      let trailingBr = null;
      while (ptr) {
        const nxt = ptr.nextSibling;
        if (ptr.nodeType === 1 && ptr.tagName === 'BR') {
          trailingBr = ptr;
          break;
        }
        if (isLineBoundary(ptr)) break;
        collected.push(ptr);
        ptr = nxt;
      }
      const insertPoint = trailingBr ? trailingBr.nextSibling : ptr;
      if (trailingBr && trailingBr.parentNode) trailingBr.parentNode.removeChild(trailingBr);
      collected.forEach(n => li.appendChild(n));
      if (!li.textContent && (!li.querySelector || !li.querySelector('br, *'))) {
        li.innerHTML = '<br>';
      }
      const prevEl = insertPoint ? insertPoint.previousElementSibling : editor.lastElementChild;
      if (prevEl && prevEl.tagName.toLowerCase() === listTagName && !(listTagName === 'ol' && startNum > 1)) {
        prevEl.appendChild(li);
      } else {
        listEl.appendChild(li);
        editor.insertBefore(listEl, insertPoint);
      }
    }

    // Placer le curseur proprement tout au début du contenu de <li>
    try {
      const r = document.createRange();
      if (li.firstChild && li.firstChild.nodeType === 3) {
        r.setStart(li.firstChild, 0);
      } else {
        r.setStart(li, 0);
      }
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (_) {}

    this._normalizeEditorLists(editor);
    this.updateCurrentNoteContent((editor.innerHTML || '').replace(/\u200B/g, ''));
    this.saveEditorSelection();
    this._updateFormatToolbarState();
    return true;
  },

  _handleOrderedListCreation(editor) {
    if (!editor) return;
    const sel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
    let currentOl = null;
    if (sel && sel.anchorNode) {
      let node = sel.anchorNode;
      if (node.nodeType === 3) node = node.parentNode;
      currentOl = (node && typeof node.closest === 'function') ? node.closest('ol') : null;
    }
    if (!currentOl && typeof editor.querySelectorAll === 'function') {
      const allOls = Array.from(editor.querySelectorAll('ol'));
      if (allOls.length > 0) {
        currentOl = allOls[allOls.length - 1];
      }
    }
    if (!currentOl) return;

    // Déterminer s'il y a un <ol> précédent dans le document
    const allOls = Array.from(editor.querySelectorAll('ol'));
    const currentIndex = allOls.indexOf(currentOl);
    if (currentIndex > 0) {
      const prevOl = allOls[currentIndex - 1];
      const prevStart = parseInt(prevOl.getAttribute('start') || '1', 10);
      const prevLiCount = Array.from(prevOl.children).filter(el => el.tagName === 'LI').length;
      const nextStart = prevStart + Math.max(1, prevLiCount);
      currentOl.setAttribute('start', nextStart);
      currentOl.setAttribute('data-auto-start', 'true');
    }
  },

  syncOrderedListsNumbering(editor) {
    if (!editor || typeof editor.querySelectorAll !== 'function') return;
    const allOls = Array.from(editor.querySelectorAll('ol'));
    if (allOls.length <= 1) return;

    for (let i = 1; i < allOls.length; i++) {
      const currentOl = allOls[i];
      const prevOl = allOls[i - 1];
      if (currentOl.getAttribute('data-auto-start') === 'true' || currentOl.hasAttribute('start')) {
        const prevStart = parseInt(prevOl.getAttribute('start') || '1', 10);
        const prevLiCount = Array.from(prevOl.children).filter(el => el.tagName === 'LI').length;
        const expectedStart = prevStart + Math.max(1, prevLiCount);
        if (parseInt(currentOl.getAttribute('start'), 10) !== expectedStart) {
          currentOl.setAttribute('start', expectedStart);
        }
      }
    }
  },

  handleKeyDown(e) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    const editor = typeof document !== 'undefined' ? document.getElementById('note-body-editor') : null;

    if (e.key === 'Tab') {
      this.handleTab(e);
      return;
    }

    // Raccourcis Markdown au clavier : transformation automatique de "1. " ou "- " / "* "
    if (e.key === ' ' && typeof window !== 'undefined' && window.getSelection && editor) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode && editor.contains(sel.anchorNode)) {
        let anchorEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        const alreadyInLi = !!(anchorEl && anchorEl.closest && anchorEl.closest('li'));
        if (!alreadyInLi) {
          let blockEl = (anchorEl && anchorEl.closest) ? anchorEl.closest('p, div, h1, h2, h3, h4, h5, h6') : null;
          if (blockEl === editor) blockEl = null;
          let textBefore = '';
          if (blockEl) {
            try {
              const pre = document.createRange();
              pre.setStart(blockEl, 0);
              pre.setEnd(sel.anchorNode, sel.anchorOffset);
              textBefore = pre.toString();
            } catch (_) {}
          } else if (sel.anchorNode.nodeType === 3) {
            textBefore = sel.anchorNode.textContent.substring(0, sel.anchorOffset);
          }

          const matchOl = textBefore.match(/^(\d+)\.$/);
          if (matchOl) {
            e.preventDefault();
            const startNum = parseInt(matchOl[1], 10);
            this._convertCurrentBlockToList(editor, sel, 'ol', startNum, matchOl[0].length);
            return;
          }
          const matchUl = textBefore.match(/^[-*+]$/);
          if (matchUl) {
            e.preventDefault();
            this._convertCurrentBlockToList(editor, sel, 'ul', 1, 1);
            return;
          }
        }
      }
    }

    // Entrée sur une puce vide : remonter d'un niveau ou quitter la liste proprement façon Word
    if (e.key === 'Enter' && !e.shiftKey && editor && typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode) {
        const anchorEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        const li = (anchorEl && anchorEl.closest) ? anchorEl.closest('li') : null;
        if (li && editor.contains(li) && this._isListItemEmpty(li)) {
          e.preventDefault();
          this._outdentSingleListItem(li, editor);
          this.updateCurrentNoteContent((editor.innerHTML || '').replace(/\u200B/g, ''));
          this.saveEditorSelection();
          this._updateFormatToolbarState();
          return;
        }
      }
      setTimeout(() => this.syncOrderedListsNumbering(editor), 10);
    }

    // Retour arrière tout au début d'une puce : désindenter ou sortir de la puce façon Word
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey && editor && typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode) {
        const anchorEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        const li = (anchorEl && anchorEl.closest) ? anchorEl.closest('li') : null;
        if (li && editor.contains(li) && this._isCaretAtStartOfElement(sel, li)) {
          e.preventDefault();
          this._outdentSingleListItem(li, editor);
          this.updateCurrentNoteContent((editor.innerHTML || '').replace(/\u200B/g, ''));
          this.saveEditorSelection();
          this._updateFormatToolbarState();
          return;
        }
      }
    }

    // Raccourcis clavier Word FR (Ctrl+G Gras, Ctrl+I Italique, Ctrl+S Souligné) + alias Ctrl+B/U/K
    if (modKey && !e.altKey) {
      const key = (e.key || '').toLowerCase();
      if ((key === 'g' || key === 'b') && !e.shiftKey) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        this.applyFormatting('bold');
      } else if (key === 'i' && !e.shiftKey) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        this.applyFormatting('italic');
      } else if ((key === 's' || key === 'u') && !e.shiftKey) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
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
    const target = (e && e.target) || (typeof document !== 'undefined' ? document.getElementById('note-body-editor') : null);
    if (!target) return;

    const isContentEditable = !!(
      target.isContentEditable ||
      (typeof target.getAttribute === 'function' && target.getAttribute('contenteditable') === 'true')
    );

    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (isContentEditable) {
      const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function' ? window.getSelection() : null;
      let anchorEl = sel && sel.anchorNode ? sel.anchorNode : null;
      if (anchorEl && anchorEl.nodeType === 3) anchorEl = anchorEl.parentNode;
      const inListItem = !!(anchorEl && typeof anchorEl.closest === 'function' && anchorEl.closest('li'));

      if (inListItem && sel) {
        if (e.shiftKey) {
          const lis = this._getSelectedListItems(sel, target);
          lis.forEach(li => this._outdentSingleListItem(li, target));
        } else {
          this._indentListItems(target, sel);
        }
      } else if (e.shiftKey) {
        // Désindentation sûre en WYSIWYG (retirer jusqu'à 2 espaces / espaces insécables avant le curseur)
        if (sel && sel.rangeCount > 0 && sel.anchorNode && sel.anchorNode.nodeType === 3) {
          const textNode = sel.anchorNode;
          const offset = sel.anchorOffset;
          const content = textNode.textContent || '';
          const before = content.slice(0, offset);
          const matchTrail = before.match(/(?:\u00a0| ){1,2}$/);
          const removeCount = matchTrail ? matchTrail[0].length : 0;
          if (removeCount > 0) {
            textNode.textContent = before.slice(0, offset - removeCount) + content.slice(offset);
            if (typeof sel.collapse === 'function') {
              sel.collapse(textNode, offset - removeCount);
            }
          }
        }
      } else {
        if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
          if (!document.execCommand('insertText', false, '\u00a0\u00a0')) {
            document.execCommand('insertHTML', false, '&nbsp;&nbsp;');
          }
        } else if (sel && sel.rangeCount > 0 && typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const nbspNode = document.createTextNode('\u00a0\u00a0');
          range.insertNode(nbspNode);
          range.setStartAfter(nbspNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      const newHtml = (target.innerHTML || '').replace(/\u200B/g, '');
      this.updateCurrentNoteContent(newHtml);
      this.updatePreview(newHtml);
      this.saveEditorSelection();
      this._updateFormatToolbarState();
      return;
    }

    // Mode fallback pour textarea / tests unitaires sans DOM riche
    const textarea = target;
    const start = textarea.selectionStart !== undefined ? textarea.selectionStart : 0;
    const end = textarea.selectionEnd !== undefined ? textarea.selectionEnd : 0;
    const text = textarea.value || '';

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

  // Parseur Markdown complet, sécurisé et standardisé
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
      return `\uE000CODEBLOCK:${idx}\uE001`;
    });

    // 2. Protection du code inline (`code`)
    const inlineCodes = [];
    raw = raw.replace(/`([^`\r\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(code);
      return `\uE000INLINECODE:${idx}\uE001`;
    });

    // 3. Échappement HTML strict de tout le contenu restant (sécurité XSS absolue)
    raw = this.escapeHtml(raw);

    // 4. Frontmatter YAML au début du document (^---\n...\n---)
    raw = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/, (match, frontmatter) => {
      return `<div class="obsidian-frontmatter"><div class="obsidian-frontmatter-title">Métadonnées YAML</div><pre style="margin:0; font-family:monospace; font-size:0.8rem;">${frontmatter}</pre></div>\n\n`;
    });

    // 5. Callouts et encadrés (> [!NOTE] / > [!WARNING] etc.) et Citations Markdown standard (> )
    const lines = raw.split(/\r?\n/);
    const processedLines = [];
    let inBlockquote = false;
    let blockquoteLines = [];
    let calloutType = null;
    let calloutTitle = null;

    const flushBlockquote = () => {
      if (!inBlockquote) return;
      if (calloutType) {
        const iconSvg = this.getSvgIcon(calloutType, 16);
        const bodyHtml = blockquoteLines.join('<br>');
        processedLines.push(`<div class="obsidian-callout obsidian-callout-${calloutType}"><div class="obsidian-callout-title"><span class="callout-icon obsidian-callout-icon">${iconSvg}</span> ${calloutTitle}</div><div class="obsidian-callout-body">${bodyHtml}</div></div>`);
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

    const applyInlineStyles = (str) => {
      let out = str;
      out = out.replace(/==(.+?)==/g, '<mark class="obsidian-highlight">$1</mark>');
      out = out.replace(/~~(.+?)~~/g, '<del class="obsidian-del">$1</del>');
      out = out.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/(?<!\*)\*([^\*\r\n]+)\*(?!\*)/g, '<em>$1</em>');
      out = out.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
      out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
      out = out.replace(/(?<!_)_([^_\r\n]+)_(?!_)/g, '<em>$1</em>');
      return out;
    };

    // 7. Protéger les Wikilinks, liens Markdown et Tags AVANT gras/italique pour éviter toute altération d'URL ou d'attribut
    const wikilinkTokens = [];
    raw = raw.replace(/\[\[([^\]\|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g, (match, target, alias) => {
      const displayText = alias || target;
      const idx = wikilinkTokens.length;
      wikilinkTokens.push(`<span class="obsidian-wikilink" data-target="${target}" title="${target}">[[${displayText}]]</span>`);
      return `\uE000WIKILINK:${idx}\uE001`;
    });

    const mdlinkTokens = [];
    raw = raw.replace(/\[([^\]\r\n]+)\]\(\s*((?:[^\s()]|\((?:[^\s()]|\([^\s()]*\))*\))+)\s*\)/g, (match, text, url) => {
      const cleanUrl = url.trim();
      const idx = mdlinkTokens.length;
      // Bloquer strictement les pseudo-protocoles dangereux (y compris avec entités/contrôles)
      const decodedUrlCheck = cleanUrl.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_m, hx, dc) => {
        const code = hx ? parseInt(hx, 16) : parseInt(dc, 10);
        return Number.isFinite(code) ? String.fromCharCode(code) : '';
      }).replace(/[\u0000-\u0020\u007f]/g, '');
      const styledText = applyInlineStyles(text);
      if (/^(?:javascript|data|vbscript|file):/i.test(decodedUrlCheck)) {
        mdlinkTokens.push(`<span>${styledText}</span>`);
      } else {
        mdlinkTokens.push(`<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${styledText}</a>`);
      }
      return `\uE000MDLINK:${idx}\uE001`;
    });

    const tagTokens = [];
    raw = raw.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)(?=\s|$)/g, (match, prefix, tagName) => {
      const idx = tagTokens.length;
      tagTokens.push(`<span class="obsidian-tag">#${tagName}</span>`);
      return `${prefix}\uE000TAG:${idx}\uE001`;
    });

    // 8. Styles inline Markdown (Surlignage, Barré, Gras, Italique)
    raw = applyInlineStyles(raw);

    // 9. Restauration des Wikilinks, liens Markdown et Tags protégés
    raw = raw.replace(/\uE000WIKILINK:(\d+)\uE001/g, (_m, idx) => wikilinkTokens[Number(idx)] || '');
    raw = raw.replace(/\uE000MDLINK:(\d+)\uE001/g, (_m, idx) => mdlinkTokens[Number(idx)] || '');
    raw = raw.replace(/\uE000TAG:(\d+)\uE001/g, (_m, idx) => tagTokens[Number(idx)] || '');

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
    raw = raw.replace(/\uE000CODEBLOCK:(\d+)\uE001/g, (match, idx) => {
      const cb = codeBlocks[Number(idx)];
      if (!cb) return '';
      const safeCode = this.escapeHtml(cb.code);
      const langLabel = cb.lang ? `<div class="code-header"><span class="code-lang">${this.escapeHtml(cb.lang)}</span></div>` : '';
      return `<pre class="obsidian-code-block">${langLabel}<code>${safeCode}</code></pre>`;
    });

    // 16. Restauration du code inline
    raw = raw.replace(/\uE000INLINECODE:(\d+)\uE001/g, (match, idx) => {
      const code = inlineCodes[Number(idx)];
      if (code === undefined) return '';
      return `<code class="obsidian-inline-code">${this.escapeHtml(code)}</code>`;
    });

    // 17. Structuration des paragraphes, regroupement propre des listes mixtes et retours à la ligne
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
      if (block.startsWith('<li class="obsidian-bullet-item"') && !block.includes('\n<li class="obsidian-number-item"') && /^((<li class="obsidian-bullet-item"[^\n]*<\/li>)(\n|$))+$/.test(block)) {
        return `<ul class="obsidian-list">${block.split(/\n/).join('')}</ul>`;
      }
      if (block.startsWith('<li class="obsidian-number-item"') && /^((<li class="obsidian-number-item"[^\n]*<\/li>)(\n|$))+$/.test(block)) {
        const matchVal = block.match(/value="(\d+)"/);
        const startAttr = (matchVal && matchVal[1] !== '1') ? ` start="${matchVal[1]}"` : '';
        return `<ol class="obsidian-list"${startAttr}>${block.split(/\n/).join('')}</ol>`;
      }
      const subLines = block.split(/\n/);
      const outParts = [];
      let textBuf = [];
      let ulBuf = [];
      let olBuf = [];
      const flushText = () => {
        if (textBuf.length > 0) {
          outParts.push(`<p>${textBuf.join('<br>')}</p>`);
          textBuf = [];
        }
      };
      const flushUl = () => {
        if (ulBuf.length > 0) {
          outParts.push(`<ul class="obsidian-list">${ulBuf.join('')}</ul>`);
          ulBuf = [];
        }
      };
      const flushOl = () => {
        if (olBuf.length > 0) {
          const matchVal = olBuf[0].match(/value="(\d+)"/);
          const startAttr = (matchVal && matchVal[1] !== '1') ? ` start="${matchVal[1]}"` : '';
          outParts.push(`<ol class="obsidian-list"${startAttr}>${olBuf.join('')}</ol>`);
          olBuf = [];
        }
      };
      subLines.forEach(line => {
        if (line.startsWith('<li class="obsidian-bullet-item"')) {
          flushText();
          flushOl();
          ulBuf.push(line);
        } else if (line.startsWith('<li class="obsidian-number-item"')) {
          flushText();
          flushUl();
          olBuf.push(line);
        } else if (/^<(?:h[1-6]|pre|div|blockquote|hr)\b/i.test(line)) {
          flushText();
          flushUl();
          flushOl();
          outParts.push(line);
        } else {
          flushUl();
          flushOl();
          textBuf.push(line);
        }
      });
      flushText();
      flushUl();
      flushOl();
      return outParts.join('\n');
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
      const archSuffix = p.archived ? ' (Archivé)' : '';
      optionsHtml += `<option value="${p.id}">📁 Projet : ${this.escapeHtml((displayTitle || p.title) + archSuffix)}</option>`;
    });

    filterSelect.innerHTML = optionsHtml;
    const hasCurrentVal = Array.from(filterSelect.options || []).some(opt => opt.value === currentVal);
    if (!hasCurrentVal && currentVal !== 'all' && currentVal !== 'personal') {
      this.currentProjectFilter = 'all';
      filterSelect.value = 'all';
    } else {
      filterSelect.value = currentVal;
    }
  },

  _getRenderSig() {
    const nRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('notes') : -1;
    const pRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('projects') : -1;
    const sRev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') ? StorageManager.getRevision('settings') : -1;
    return `${nRev}:${pRev}:${sRev}:${this.layoutMode}:${this.currentProjectFilter}:${this.currentFolderFilter}:${this.searchQuery}:${this.currentNoteId || ''}:${this._collapsedFolders ? this._collapsedFolders.size : 0}`;
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('notes-list-container');
    if (!listEl) return;
    const sig = this._getRenderSig();
    if (!sig.startsWith('-1:') && this._lastRenderedSig === sig && listEl.childElementCount > 0) return;
    this.render();
    if (this.layoutMode === 'folders' && typeof this.setLayoutMode === 'function') {
      this.setLayoutMode('folders');
    }
  },

  render() {
    this._lastRenderedSig = this._getRenderSig();
    this.populateProjectFilter();
    this.renderFolderFilter();
    const notes = this.getAll();
    if (!this.currentNoteId && notes.length > 0) {
      this.currentNoteId = notes[0].id;
    }
    this.renderNotesList();
    if (this.currentNoteId && notes.some(n => n.id === this.currentNoteId)) {
      this.selectNote(this.currentNoteId, false);
    } else {
      this.currentNoteId = notes.length > 0 ? notes[0].id : null;
      if (this.currentNoteId) {
        this.selectNote(this.currentNoteId, false);
      } else if (typeof document !== 'undefined') {
        const titleInput = document.getElementById('note-title-editor');
        const editor = document.getElementById('note-body-editor');
        if (titleInput) titleInput.value = '';
        if (editor) {
          editor.innerHTML = '';
          if (editor.value !== undefined) editor.value = '';
        }
      }
    }
    if (this.layoutMode === 'folders') {
      this.renderFoldersOverview();
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
