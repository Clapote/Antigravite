/**
 * Antigravité - Module de Gestion des Projets
 * Gestion simple, épurée et visuelle des projets personnels.
 */

const ProjectsManager = {
  viewMode: (typeof localStorage !== 'undefined' && localStorage.getItem('antigravite_project_view')) || 'grid',
  draggedProjectId: null,
  collapsedFamilies: null,
  _activeDropFamilyGroup: null,

  _ensureCollapsedFamiliesLoaded() {
    if (this.collapsedFamilies instanceof Set) return;
    this.collapsedFamilies = new Set();
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('antigravite_collapsed_project_families');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => {
              if (id) this.collapsedFamilies.add(String(id));
            });
          }
        }
      } catch (e) {
        this.collapsedFamilies = new Set();
      }
    }
  },

  isFamilyCollapsed(projectId) {
    this._ensureCollapsedFamiliesLoaded();
    return Boolean(projectId && this.collapsedFamilies.has(String(projectId)));
  },

  toggleFamilyCollapse(projectId) {
    if (!projectId) return;
    this._ensureCollapsedFamiliesLoaded();
    const key = String(projectId);
    if (this.collapsedFamilies.has(key)) {
      this.collapsedFamilies.delete(key);
    } else {
      this.collapsedFamilies.add(key);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_collapsed_project_families', JSON.stringify(Array.from(this.collapsedFamilies)));
      } catch (e) { /* quota ignore */ }
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    this.render();
  },

  _colorWithAlpha(color, alpha, fallback = 'rgba(56, 189, 248, 0.2)') {
    if (typeof color !== 'string') return fallback;
    const hex = color.trim();
    const m3 = /^#([0-9a-f]{3})$/i.exec(hex);
    if (m3) {
      const r = parseInt(m3[1][0] + m3[1][0], 16);
      const g = parseInt(m3[1][1] + m3[1][1], 16);
      const b = parseInt(m3[1][2] + m3[1][2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const m6 = /^#([0-9a-f]{6})$/i.exec(hex);
    if (m6) {
      const r = parseInt(m6[1].slice(0, 2), 16);
      const g = parseInt(m6[1].slice(2, 4), 16);
      const b = parseInt(m6[1].slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return fallback;
  },

  _setCssVar(el, name, value) {
    if (el && el.style && typeof el.style.setProperty === 'function' && value != null) {
      el.style.setProperty(name, String(value));
    }
  },

  _clearFamilyDragHighlight() {
    if (this._activeDropFamilyGroup && this._activeDropFamilyGroup.classList) {
      this._activeDropFamilyGroup.classList.remove('drag-over-family');
    }
    this._activeDropFamilyGroup = null;
  },

  getProjectTree(projectsList = null) {
    const projects = Array.isArray(projectsList) ? projectsList : this.getAll();
    const byId = new Map();
    const childrenByParent = new Map();

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p && p.id) byId.set(p.id, p);
    }

    const roots = [];
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (!p || !p.id) continue;
      const pid = p.parentProjectId;
      if (pid && pid !== p.id && byId.has(pid)) {
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(p);
      } else {
        roots.push(p);
      }
    }

    const visited = new Set();
    const buildNode = (proj, level, parentProject) => {
      if (!proj || visited.has(proj.id)) return null;
      visited.add(proj.id);
      const rawChildren = childrenByParent.get(proj.id) || [];
      const childNodes = [];
      for (let i = 0; i < rawChildren.length; i++) {
        const childNode = buildNode(rawChildren[i], level + 1, proj);
        if (childNode) childNodes.push(childNode);
      }
      return {
        project: proj,
        level,
        parentProject: parentProject || null,
        children: childNodes
      };
    };

    const rootNodes = [];
    for (let i = 0; i < roots.length; i++) {
      const node = buildNode(roots[i], 0, null);
      if (node) rootNodes.push(node);
    }

    // Sécurité anti-cycle orphelin
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p && p.id && !visited.has(p.id)) {
        const node = buildNode(p, 0, null);
        if (node) rootNodes.push(node);
      }
    }

    return { roots: rootNodes, byId };
  },

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    if (typeof localStorage !== 'undefined') {
      const savedMode = localStorage.getItem('antigravite_project_view');
      if (savedMode === 'grid' || savedMode === 'list') {
        this.viewMode = savedMode;
      }
    }
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    const btnNew = document.getElementById('btn-new-project');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openProjectModal());
    }

    const btnGrid = document.getElementById('btn-project-view-grid');
    if (btnGrid) {
      btnGrid.addEventListener('click', () => this.setViewMode('grid'));
    }

    const btnList = document.getElementById('btn-project-view-list');
    if (btnList) {
      btnList.addEventListener('click', () => this.setViewMode('list'));
    }
  },

  setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') mode = 'grid';
    this.viewMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('antigravite_project_view', mode);
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    this.render();
  },

  getChildProjects(parentId, projectsList = null) {
    const projects = Array.isArray(projectsList) ? projectsList : this.getAll();
    const targetParent = parentId || null;
    return projects.filter(p => (p.parentProjectId || null) === targetParent);
  },

  getDescendantIds(projectId, projectsList = null) {
    const projects = Array.isArray(projectsList) ? projectsList : this.getAll();
    const descendants = new Set();
    const queue = [projectId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        if (p && p.parentProjectId === current && !descendants.has(p.id) && p.id !== projectId) {
          descendants.add(p.id);
          queue.push(p.id);
        }
      }
    }
    return descendants;
  },

  isDescendant(potentialDescendantId, ancestorId, projectsList = null) {
    if (!potentialDescendantId || !ancestorId) return false;
    if (potentialDescendantId === ancestorId) return true;
    return this.getDescendantIds(ancestorId, projectsList).has(potentialDescendantId);
  },

  nestProject(sourceId, targetParentId) {
    if (!sourceId || !targetParentId || sourceId === targetParentId) return false;
    const projects = this.getAll();
    const source = projects.find(p => p.id === sourceId);
    const target = projects.find(p => p.id === targetParentId);
    if (!source || !target) return false;
    if (this.isDescendant(targetParentId, sourceId, projects)) return false;

    source.parentProjectId = targetParentId;
    source.updatedAt = new Date().toISOString();
    this._ensureCollapsedFamiliesLoaded();
    if (this.collapsedFamilies.has(String(targetParentId))) {
      this.collapsedFamilies.delete(String(targetParentId));
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('antigravite_collapsed_project_families', JSON.stringify(Array.from(this.collapsedFamilies)));
        } catch (e) { /* quota ignore */ }
      }
    }
    this.saveAll(projects);

    if (typeof window !== 'undefined' && window.App) {
      if (typeof window.App.triggerHapticFeedback === 'function') window.App.triggerHapticFeedback();
      if (typeof window.App.showToast === 'function') {
        window.App.showToast(`« ${source.title} » imbriqué dans « ${target.title} »`, "success");
      }
    }
    return true;
  },

  unNestProject(projectId, toRoot = false) {
    if (!projectId) return false;
    const projects = this.getAll();
    const proj = projects.find(p => p.id === projectId);
    if (!proj || !proj.parentProjectId) return false;

    if (toRoot) {
      proj.parentProjectId = null;
    } else {
      const parent = projects.find(p => p.id === proj.parentProjectId);
      proj.parentProjectId = parent && parent.parentProjectId ? parent.parentProjectId : null;
    }
    proj.updatedAt = new Date().toISOString();
    this.saveAll(projects);

    if (typeof window !== 'undefined' && window.App) {
      if (typeof window.App.triggerHapticFeedback === 'function') window.App.triggerHapticFeedback();
      if (typeof window.App.showToast === 'function') {
        window.App.showToast(
          proj.parentProjectId ? "Sous-projet remonté d'un niveau" : "Projet placé au niveau principal (racine)",
          "info"
        );
      }
    }
    return true;
  },

  reorderProjects(sourceId, targetId, insertAfter = false) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const projects = this.getAll();
    if (this.isDescendant(targetId, sourceId, projects)) return false;

    const fromIdx = projects.findIndex(p => p.id === sourceId);
    const target = projects.find(p => p.id === targetId);
    if (fromIdx === -1 || !target) return false;

    const [moved] = projects.splice(fromIdx, 1);
    if (target.parentProjectId !== undefined) {
      moved.parentProjectId = target.parentProjectId || null;
    } else if (moved.parentProjectId) {
      moved.parentProjectId = null;
    }

    let newIdx = projects.findIndex(p => p.id === targetId);
    if (insertAfter) {
      newIdx += 1;
    }
    projects.splice(newIdx, 0, moved);
    this.saveAll(projects);

    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Ordre des projets mis à jour", "info");
    }
    return true;
  },

  getAll() {
    return StorageManager.getProjects();
  },

  saveAll(projects) {
    StorageManager.saveProjects(projects);
    this.render();
    if (typeof TasksManager !== 'undefined' && typeof TasksManager.render === 'function') TasksManager.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
  },

  addProject(projectData) {
    const projects = this.getAll();
    const parentId = projectData.parentProjectId ? String(projectData.parentProjectId) : null;
    const validParent = parentId && projects.some(p => p.id === parentId) ? parentId : null;
    const newProj = {
      id: 'proj-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: projectData.title.trim(),
      description: projectData.description ? projectData.description.trim() : '',
      color: projectData.color || '#3b82f6',
      status: projectData.status || 'in_progress',
      parentProjectId: validParent,
      createdAt: new Date().toISOString()
    };
    projects.push(newProj);
    this.saveAll(projects);
    if (window.App) window.App.showToast(validParent ? "Sous-projet créé avec succès" : "Projet créé avec succès", "success");
    return newProj;
  },

  updateProject(id, updatedData) {
    const projects = this.getAll();
    const p = projects.find(item => item.id === id);
    if (!p) return false;

    p.title = updatedData.title.trim();
    p.description = updatedData.description ? updatedData.description.trim() : '';
    p.color = updatedData.color || p.color;
    p.status = updatedData.status || p.status;
    if (updatedData.parentProjectId !== undefined) {
      const nextParent = updatedData.parentProjectId || null;
      if (!nextParent || !this.isDescendant(nextParent, id, projects)) {
        p.parentProjectId = nextParent;
      }
    }
    p.updatedAt = new Date().toISOString();

    this.saveAll(projects);
    if (window.App) window.App.showToast("Projet mis à jour", "info");
    return true;
  },

  async deleteProject(id) {
    let projects = this.getAll();
    const projectToDelete = projects.find(p => p.id === id);
    if (projectToDelete && typeof TrashManager !== 'undefined' && typeof TrashManager.moveToTrash === 'function') {
      TrashManager.moveToTrash('project', projectToDelete);
    }
    const fallbackParentId = projectToDelete ? (projectToDelete.parentProjectId || null) : null;
    projects = projects
      .filter(p => p.id !== id)
      .map(p => (p.parentProjectId === id ? Object.assign({}, p, { parentProjectId: fallbackParentId }) : p));

    // Détacher le projet des tâches
    const tasks = StorageManager.getTasks();
    const detachRecursive = (list) => {
      list.forEach(t => {
        if (t.projectId === id) t.projectId = null;
        if (t.subtasks && t.subtasks.length > 0) detachRecursive(t.subtasks);
      });
    };
    detachRecursive(tasks);
    StorageManager.saveTasks(tasks);

    // Détacher le projet des notes associées
    const notes = StorageManager.getNotes();
    let notesChanged = false;
    notes.forEach(n => {
      if (n.projectId === id) {
        n.projectId = null;
        notesChanged = true;
      }
    });
    if (notesChanged) {
      StorageManager.saveNotes(notes);
      if (window.NotesManager && typeof window.NotesManager.renderNotesList === 'function') {
        window.NotesManager.renderNotesList();
      }
    }

    this.saveAll(projects);
    if (window.App) window.App.showToast("Projet déplacé dans la corbeille", "info");
  },

  // Calcul du taux d'avancement pour un projet
  getProjectStats(projectId) {
    const tasks = StorageManager.getTasks();
    let total = 0;
    let completed = 0;

    const countRecursive = (list) => {
      list.forEach(t => {
        if (t.projectId === projectId) {
          total++;
          if (t.completed) completed++;
        }
        if (t.subtasks && t.subtasks.length > 0) countRecursive(t.subtasks);
      });
    };

    countRecursive(tasks);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const notes = StorageManager.getNotes();
    const notesCount = notes.filter(n => n.projectId === projectId).length;

    return { total, completed, percent, notesCount };
  },

  // Calcul groupé ultra-rapide des statistiques de tous les projets en une seule passe
  getAllProjectsStats() {
    const tasks = StorageManager.getTasks();
    const notes = StorageManager.getNotes();
    const statsMap = new Map();

    const countTasks = (list) => {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.projectId) {
          let s = statsMap.get(t.projectId);
          if (!s) {
            s = { total: 0, completed: 0, percent: 0, notesCount: 0 };
            statsMap.set(t.projectId, s);
          }
          s.total++;
          if (t.completed) s.completed++;
        }
        if (t.subtasks && t.subtasks.length > 0) countTasks(t.subtasks);
      }
    };
    countTasks(tasks);

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.projectId) {
        let s = statsMap.get(n.projectId);
        if (!s) {
          s = { total: 0, completed: 0, percent: 0, notesCount: 0 };
          statsMap.set(n.projectId, s);
        }
        s.notesCount++;
      }
    }

    statsMap.forEach(s => {
      s.percent = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    });

    return statsMap;
  },

  _bindCardDragEvents(card, p, projects) {
    card.addEventListener('dragstart', (e) => {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, input, select')) {
        e.preventDefault();
        return;
      }
      this.draggedProjectId = p.id;
      this._draggedForbiddenIds = new Set([p.id, ...this.getDescendantIds(p.id, projects)]);
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
      }
      setTimeout(() => card.classList.add('dragging'), 0);
      if (p.parentProjectId && typeof document !== 'undefined') {
        const rootZone = document.getElementById('projects-root-dropzone');
        if (rootZone) rootZone.classList.add('drag-active');
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this._clearFamilyDragHighlight();
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.project-card').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-nest');
        });
        document.querySelectorAll('.project-family-group.drag-over-family').forEach(el => {
          el.classList.remove('drag-over-family');
        });
        const rootZone = document.getElementById('projects-root-dropzone');
        if (rootZone) rootZone.classList.remove('drag-active', 'drag-over');
      }
      this.draggedProjectId = null;
      this._draggedForbiddenIds = null;
    });

    card.addEventListener('dragover', (e) => {
      if (!this.draggedProjectId || this.draggedProjectId === p.id) return;
      if (this._draggedForbiddenIds && this._draggedForbiddenIds.has(p.id)) return;
      e.preventDefault();
      e.stopPropagation();
      this._clearFamilyDragHighlight();

      const rect = card.getBoundingClientRect();
      const useVerticalAxis = (this.viewMode === 'list') || (card.dataset && card.dataset.dropAxis === 'y');
      const ratio = useVerticalAxis
        ? ((e.clientY - rect.top) / Math.max(1, rect.height))
        : ((e.clientX - rect.left) / Math.max(1, rect.width));

      let pos = 'nest';
      if (ratio < 0.25) pos = 'before';
      else if (ratio > 0.75) pos = 'after';

      card.classList.toggle('drag-over-before', pos === 'before');
      card.classList.toggle('drag-over-after', pos === 'after');
      card.classList.toggle('drag-over-nest', pos === 'nest');
      card.dataset.dropPos = pos;
      card.dataset.dropAfter = (pos === 'after') ? 'true' : 'false';
    });

    card.addEventListener('dragleave', (e) => {
      if (card.contains && e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-nest');
    });

    card.addEventListener('drop', (e) => {
      if (!this.draggedProjectId || this.draggedProjectId === p.id) return;
      if (this._draggedForbiddenIds && this._draggedForbiddenIds.has(p.id)) return;
      e.preventDefault();
      e.stopPropagation();
      this._clearFamilyDragHighlight();

      const pos = card.dataset.dropPos || (card.dataset.dropAfter === 'true' ? 'after' : 'before');
      card.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-nest');

      const sourceId = this.draggedProjectId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (pos === 'nest') {
        this.nestProject(sourceId, p.id);
      } else {
        this.reorderProjects(sourceId, p.id, pos === 'after');
      }
    });

    // Support du clic long (long-press) pour feedback tactile et visuel
    let longPressTimer = null;
    const startLongPress = () => {
      longPressTimer = setTimeout(() => {
        card.classList.add('drag-ready');
        if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
          window.App.triggerHapticFeedback();
        }
      }, 280);
    };
    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      card.classList.remove('drag-ready');
    };
    card.addEventListener('mousedown', startLongPress);
    card.addEventListener('mouseup', clearLongPress);
    card.addEventListener('mouseleave', clearLongPress);
    card.addEventListener('touchstart', startLongPress, { passive: true });
    card.addEventListener('touchend', clearLongPress);
    card.addEventListener('touchcancel', clearLongPress);
  },

  _createProjectCardElement(node, allStats, projects, options = {}) {
    const { project: p, level = 0, parentProject = null } = node;
    const childrenCount = Array.isArray(node.children) ? node.children.length : (node.childrenCount || 0);
    const stats = allStats.get(p.id) || { total: 0, completed: 0, percent: 0, notesCount: 0 };
    const isList = Boolean(options.isList);
    const isFamilyParent = Boolean(options.isFamilyParent);
    const isCollapsedFamily = Boolean(options.isCollapsedFamily);

    const card = document.createElement('div');
    card.setAttribute('draggable', 'true');
    card.dataset.projectId = p.id;
    card.dataset.level = String(level);
    card.style.cursor = 'pointer';

    card.onclick = (e) => {
      if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('button, .project-drag-handle')) return;
      ProjectsManager.openProjectDetailModal(p.id);
    };

    const parentColor = (parentProject && parentProject.color) ? parentProject.color : 'var(--accent)';
    const subBadgeHtml = parentProject
      ? `<button type="button" class="project-parent-pill" style="border-color: ${this._colorWithAlpha(parentColor, 0.35, 'var(--border-color)')};" title="Sous-projet de ${this.escapeHtml(parentProject.title)} — Cliquer pour ouvrir le parent" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${parentProject.id}')"><span class="project-parent-dot" style="background-color: ${parentColor};"></span><span>${this.escapeHtml(parentProject.title)}</span></button>`
      : '';
    const childrenBadgeHtml = childrenCount > 0
      ? `<span class="project-subcount-pill" title="${childrenCount} sous-projet(s) imbriqué(s)">↳ ${childrenCount} sous-projet${childrenCount > 1 ? 's' : ''}</span>`
      : '';
    const familyToggleBtnHtml = (isFamilyParent && childrenCount > 0)
      ? `<button type="button" class="project-family-toggle-btn ${isCollapsedFamily ? 'is-collapsed' : ''}" title="${isCollapsedFamily ? 'Afficher' : 'Masquer'} les sous-projets" aria-expanded="${!isCollapsedFamily}" onclick="event.stopPropagation(); ProjectsManager.toggleFamilyCollapse('${p.id}')"><svg class="project-family-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg><span>${childrenCount} sous-projet${childrenCount > 1 ? 's' : ''}</span></button>`
      : '';
    const promoteBtnHtml = level > 0
      ? `<button class="btn-icon btn-action-promote" title="Remonter d'un niveau" onclick="event.stopPropagation(); ProjectsManager.unNestProject('${p.id}', false)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>`
      : '';
    const addSubBtnHtml = `<button class="btn-icon btn-action-add" title="Ajouter un sous-projet" onclick="event.stopPropagation(); ProjectsManager.openProjectModal(null, '${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;
    const parentRibbonHtml = (level > 0 && parentProject)
      ? `<div class="project-parent-ribbon" style="background-color: ${parentColor};" title="Rattaché à ${this.escapeHtml(parentProject.title)}"></div>`
      : '';

    const notesIconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const editBtnHtml = `<button class="btn-icon" title="Modifier" onclick="event.stopPropagation(); ProjectsManager.openProjectModal('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`;
    const deleteBtnHtml = `<button class="btn-icon" title="Supprimer" onclick="event.stopPropagation(); ProjectsManager.deleteProject('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;

    if (isList) {
      card.className = `project-card project-row draggable-item ${level > 0 ? 'is-subproject' : ''}`;
      card.dataset.dropAxis = 'y';
      if (level > 0) {
        card.style.marginLeft = `${Math.min(level, 4) * 28}px`;
      }
      card.innerHTML = `
        <div class="project-drag-handle" title="Glisser sur le centre d'un projet pour imbriquer, ou sur les bords pour réordonner">⠿</div>
        <div class="project-color-bar" style="background-color: ${p.color};"></div>
        <div class="project-row-main">
          <span class="project-title">${this.escapeHtml(p.title)}</span>
          ${subBadgeHtml}
          ${childrenBadgeHtml}
          <span class="project-desc">${this.escapeHtml(p.description || 'Aucune description')}</span>
        </div>
        <div class="progress-container">
          <div class="progress-labels">
            <span>${stats.completed}/${stats.total} tâche(s)</span>
            <span><strong>${stats.percent}%</strong></span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${stats.percent}%; background-color: ${p.color};"></div>
          </div>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">${notesIconHtml}<span>${stats.notesCount} note(s)</span></span>
        <div class="project-row-actions">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${p.id}');">Consulter ↗</button>
          ${addSubBtnHtml}
          ${promoteBtnHtml}
          ${editBtnHtml}
          ${deleteBtnHtml}
        </div>
      `;
    } else {
      const badgesHtml = `${subBadgeHtml}${familyToggleBtnHtml}`;
      card.className = `project-card draggable-item${isFamilyParent ? ' is-family-parent' : ''}${level > 0 ? ' is-subproject' : ''}`;
      card.dataset.dropAxis = (isFamilyParent && !isCollapsedFamily) ? 'y' : 'x';
      card.innerHTML = `
        ${parentRibbonHtml}
        <div class="project-color-bar" style="background-color: ${p.color};"></div>
        <div class="project-header">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
            <span class="project-drag-handle" title="Glisser sur le centre d'un projet pour imbriquer, ou sur les bords pour réordonner">⠿</span>
            <div class="project-title" style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(p.title)}</div>
          </div>
          <div style="display: flex; gap: 2px; flex-shrink: 0;">
            ${addSubBtnHtml}
            ${promoteBtnHtml}
            ${editBtnHtml}
            ${deleteBtnHtml}
          </div>
        </div>
        ${badgesHtml ? `<div class="project-subbadges-row">${badgesHtml}</div>` : ''}
        <div class="project-desc">${this.escapeHtml(p.description || 'Aucune description')}</div>
        <div class="progress-container">
          <div class="progress-labels">
            <span>Progression : ${stats.completed} / ${stats.total} tâche(s)</span>
            <span><strong>${stats.percent}%</strong></span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${stats.percent}%; background-color: ${p.color};"></div>
          </div>
        </div>
        <div style="margin-top: auto; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">${notesIconHtml}<span>${stats.notesCount} note(s)</span></span>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${p.id}');">Consulter le projet ↗</button>
        </div>
      `;
    }

    this._bindCardDragEvents(card, p, projects);
    return card;
  },

  _renderGridNode(node, allStats, projects, targetContainer) {
    if (!node.children || node.children.length === 0) {
      const leafCard = this._createProjectCardElement(node, allStats, projects, { isList: false, isFamilyParent: false });
      targetContainer.appendChild(leafCard);
      return;
    }

    const p = node.project;
    const isCollapsed = this.isFamilyCollapsed(p.id);
    const familyColor = p.color || '#38bdf8';

    const familyGroup = document.createElement('div');
    familyGroup.className = `project-family-group${node.level > 0 ? ' is-nested-family' : ''}${isCollapsed ? ' is-collapsed' : ''}`;
    familyGroup.dataset.familyRootId = p.id;
    this._setCssVar(familyGroup, '--family-color', familyColor);
    this._setCssVar(familyGroup, '--family-line-color', this._colorWithAlpha(familyColor, 0.58, 'var(--border-strong)'));
    this._setCssVar(familyGroup, '--family-border-color', this._colorWithAlpha(familyColor, 0.30, 'var(--border-color)'));
    this._setCssVar(familyGroup, '--family-bg-tint', this._colorWithAlpha(familyColor, 0.045, 'rgba(56, 189, 248, 0.04)'));

    const parentCard = this._createProjectCardElement(node, allStats, projects, {
      isList: false,
      isFamilyParent: true,
      isCollapsedFamily: isCollapsed
    });
    familyGroup.appendChild(parentCard);

    if (!isCollapsed) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'project-family-children';
      childrenWrap.dataset.parentProjectId = p.id;

      // Zone de dépôt souple dans l'espace libre de la famille pour rattacher directement au parent
      childrenWrap.addEventListener('dragover', (e) => {
        if (!this.draggedProjectId || this.draggedProjectId === p.id) return;
        if (this._draggedForbiddenIds && this._draggedForbiddenIds.has(p.id)) return;
        e.preventDefault();
        e.stopPropagation();
        if (this._activeDropFamilyGroup !== familyGroup) {
          this._clearFamilyDragHighlight();
          familyGroup.classList.add('drag-over-family');
          this._activeDropFamilyGroup = familyGroup;
        }
      });
      childrenWrap.addEventListener('dragleave', (e) => {
        if (childrenWrap.contains && e.relatedTarget && childrenWrap.contains(e.relatedTarget)) return;
        if (this._activeDropFamilyGroup === familyGroup) {
          this._clearFamilyDragHighlight();
        } else {
          familyGroup.classList.remove('drag-over-family');
        }
      });
      childrenWrap.addEventListener('drop', (e) => {
        if (!this.draggedProjectId || this.draggedProjectId === p.id) return;
        if (this._draggedForbiddenIds && this._draggedForbiddenIds.has(p.id)) return;
        e.preventDefault();
        e.stopPropagation();
        this._clearFamilyDragHighlight();
        const sourceId = this.draggedProjectId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        this.nestProject(sourceId, p.id);
      });

      node.children.forEach(childNode => {
        this._renderGridNode(childNode, allStats, projects, childrenWrap);
      });
      familyGroup.appendChild(childrenWrap);

      if (node.level === 0) {
        const famStats = this._getFamilyRecursiveStats(node, allStats);
        const overviewEl = document.createElement('div');
        overviewEl.className = 'project-family-overview';
        overviewEl.innerHTML = `
          <div class="project-family-overview-header">
            <span class="project-family-overview-badge" style="color: ${familyColor}; border-color: ${this._colorWithAlpha(familyColor, 0.35, 'var(--border-color)')}; background-color: ${this._colorWithAlpha(familyColor, 0.10, 'var(--accent-light)')};">Dossier</span>
            <span class="project-family-overview-title">Vue d'ensemble · ${this.escapeHtml(p.title)}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ProjectsManager.openProjectModal(null, '${p.id}')">+ Sous-projet</button>
          </div>
          <div class="project-family-overview-metrics">
            <span><strong>${famStats.descendantsCount}</strong> sous-projet${famStats.descendantsCount > 1 ? 's' : ''}</span>
            <span aria-hidden="true">•</span>
            <span><strong>${famStats.completed}/${famStats.total}</strong> tâche(s) au total</span>
            <span aria-hidden="true">•</span>
            <span><strong>${famStats.notesCount}</strong> note(s)</span>
          </div>
          <div class="progress-container">
            <div class="progress-labels">
              <span>Avancement cumulé de la famille</span>
              <span><strong>${famStats.percent}%</strong></span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${famStats.percent}%; background-color: ${familyColor};"></div>
            </div>
          </div>
        `;
        familyGroup.appendChild(overviewEl);
      }
    }

    targetContainer.appendChild(familyGroup);
  },

  _getFamilyRecursiveStats(node, allStats) {
    let total = 0;
    let completed = 0;
    let notesCount = 0;
    let descendantsCount = 0;

    const walk = (n, isRoot) => {
      if (!n || !n.project) return;
      if (!isRoot) descendantsCount++;
      const s = allStats.get(n.project.id);
      if (s) {
        total += s.total || 0;
        completed += s.completed || 0;
        notesCount += s.notesCount || 0;
      }
      if (Array.isArray(n.children)) {
        for (let i = 0; i < n.children.length; i++) {
          walk(n.children[i], false);
        }
      }
    };
    walk(node, true);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent, notesCount, descendantsCount };
  },

  render() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const container = document.getElementById('projects-grid-container');
    if (!container) return;

    // Synchronisation de l'état visuel des boutons de vue Grille / Lignes
    const btnGrid = document.getElementById('btn-project-view-grid');
    const btnList = document.getElementById('btn-project-view-list');
    if (btnGrid && btnList) {
      const isGrid = this.viewMode === 'grid';
      btnGrid.classList.toggle('active', isGrid);
      btnGrid.style.background = isGrid ? 'var(--accent)' : 'transparent';
      btnGrid.style.color = isGrid ? 'white' : 'var(--text-main)';
      btnGrid.style.fontWeight = isGrid ? '600' : 'normal';

      btnList.classList.toggle('active', !isGrid);
      btnList.style.background = !isGrid ? 'var(--accent)' : 'transparent';
      btnList.style.color = !isGrid ? 'white' : 'var(--text-main)';
      btnList.style.fontWeight = !isGrid ? '600' : 'normal';
    }

    container.classList.toggle('view-list', this.viewMode === 'list');

    const projects = this.getAll();
    if (projects.length === 0) {
      container.classList.remove('has-expanded-families');
      container.innerHTML = `
        <div class="antigravite-empty-state projects-empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-illustration">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h3 class="empty-state-title">Nouveaux horizons</h3>
          <p class="empty-state-text">Regroupez vos tâches et notes en grands dossiers personnels pour suivre votre progression.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="ProjectsManager.openProjectModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> <span>Créer un premier projet</span></button>
        </div>
      `;
      return;
    }

    const allStats = this.getAllProjectsStats();
    const fragment = (typeof document.createDocumentFragment === 'function') ? document.createDocumentFragment() : container;

    if (this.viewMode === 'list') {
      container.classList.remove('has-expanded-families');
      const entries = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
        ? StorageManager.getProjectsHierarchy(projects)
        : projects.map(p => ({ project: p, level: 0, parentProject: null, childrenCount: 0, children: [] }));
      entries.forEach(entry => {
        const card = this._createProjectCardElement(entry, allStats, projects, { isList: true });
        fragment.appendChild(card);
      });
    } else {
      const { roots } = this.getProjectTree(projects);
      // Regrouper visuellement les tuiles unitaires puis les familles dépliées pleine largeur pour éviter les trous au milieu de la grille
      const compactRoots = [];
      const expandedRoots = [];
      roots.forEach(rootNode => {
        const hasChildren = rootNode.children && rootNode.children.length > 0;
        if (hasChildren && !this.isFamilyCollapsed(rootNode.project.id)) {
          expandedRoots.push(rootNode);
        } else {
          compactRoots.push(rootNode);
        }
      });

      container.classList.toggle('has-expanded-families', expandedRoots.length > 0);
      compactRoots.forEach(node => this._renderGridNode(node, allStats, projects, fragment));
      expandedRoots.forEach(node => this._renderGridNode(node, allStats, projects, fragment));
    }

    // Carte "+" pour créer un nouveau projet dans la continuité de la vue
    const addCard = document.createElement('div');
    addCard.className = (this.viewMode === 'list')
      ? 'project-card project-card-add project-row'
      : 'project-card project-card-add';
    addCard.id = 'btn-add-project-card';
    addCard.title = 'Créer un nouveau projet';
    addCard.onclick = () => ProjectsManager.openProjectModal();
    addCard.innerHTML = `
      <div class="project-add-content">
        <span class="project-add-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
        <span class="project-add-title">Nouveau projet</span>
        <span class="project-add-hint">Créer un nouveau dossier de travail</span>
      </div>
    `;
    fragment.appendChild(addCard);

    // Zone de dépôt au bas pour sortir un sous-projet vers la racine
    const rootDropZone = document.createElement('div');
    rootDropZone.id = 'projects-root-dropzone';
    rootDropZone.className = 'projects-root-dropzone';
    rootDropZone.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Glisser ici pour placer au niveau principal (racine)</span>`;
    rootDropZone.addEventListener('dragover', (e) => {
      if (!this.draggedProjectId) return;
      e.preventDefault();
      rootDropZone.classList.add('drag-over');
    });
    rootDropZone.addEventListener('dragleave', () => {
      rootDropZone.classList.remove('drag-over');
    });
    rootDropZone.addEventListener('drop', (e) => {
      if (!this.draggedProjectId) return;
      e.preventDefault();
      rootDropZone.classList.remove('drag-over');
      this.unNestProject(this.draggedProjectId, true);
    });
    fragment.appendChild(rootDropZone);

    if (fragment !== container) {
      container.innerHTML = '';
      container.appendChild(fragment);
    }
  },

  openProjectDetailModal(id) {
    const modal = document.getElementById('project-detail-modal');
    if (!modal) return;

    const allProjects = this.getAll();
    const p = allProjects.find(item => item.id === id);
    if (!p) return;

    const dotEl = document.getElementById('project-detail-color-dot');
    const titleEl = document.getElementById('project-detail-title');
    const descEl = document.getElementById('project-detail-desc');
    const parentBannerEl = document.getElementById('project-detail-parent-banner');
    const subprojectsCountEl = document.getElementById('project-detail-subprojects-count');
    const subprojectsListEl = document.getElementById('project-detail-subprojects-list');
    const btnAddSubproject = document.getElementById('btn-project-detail-add-subproject');
    const progressLabel = document.getElementById('project-detail-progress-label');
    const progressPct = document.getElementById('project-detail-progress-pct');
    const progressFill = document.getElementById('project-detail-progress-fill');
    const tasksCountEl = document.getElementById('project-detail-tasks-count');
    const tasksListEl = document.getElementById('project-detail-tasks-list');
    const notesCountEl = document.getElementById('project-detail-notes-count');
    const notesListEl = document.getElementById('project-detail-notes-list');
    const btnAddTask = document.getElementById('btn-project-detail-add-task');
    const btnAddNote = document.getElementById('btn-project-detail-add-note');
    const btnEdit = document.getElementById('btn-project-detail-edit');

    if (dotEl) dotEl.style.backgroundColor = p.color || '#3b82f6';
    if (titleEl) titleEl.textContent = p.title;
    if (descEl) descEl.textContent = p.description || 'Aucune description détaillée.';

    // Fil d'Ariane si c'est un sous-projet
    if (parentBannerEl) {
      const parentProj = p.parentProjectId ? allProjects.find(pr => pr.id === p.parentProjectId) : null;
      if (parentProj) {
        parentBannerEl.style.display = 'flex';
        parentBannerEl.innerHTML = `
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;" onclick="ProjectsManager.openProjectDetailModal('${parentProj.id}')">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${parentProj.color || '#3b82f6'};"></span>
            <span>↳ Sous-projet de <strong>${this.escapeHtml(parentProj.title)}</strong></span>
          </button>
        `;
      } else {
        parentBannerEl.style.display = 'none';
        parentBannerEl.innerHTML = '';
      }
    }

    const stats = this.getProjectStats(p.id);
    if (progressLabel) progressLabel.textContent = `Tâches réalisées : ${stats.completed} / ${stats.total}`;
    if (progressPct) progressPct.textContent = `${stats.percent}%`;
    if (progressFill) {
      progressFill.style.width = `${stats.percent}%`;
      progressFill.style.backgroundColor = p.color || 'var(--primary)';
    }

    // 0. Liste des sous-projets directs
    const childProjects = this.getChildProjects(p.id, allProjects);
    const allStatsMap = this.getAllProjectsStats();
    if (subprojectsCountEl) subprojectsCountEl.textContent = childProjects.length;
    if (subprojectsListEl) {
      if (childProjects.length === 0) {
        subprojectsListEl.innerHTML = `
          <div style="color: var(--text-dim); font-size: 0.82rem; font-style: italic; padding: 6px 0;">
            Aucun sous-projet pour le moment.
          </div>
        `;
      } else {
        let subHtml = '';
        childProjects.forEach(sub => {
          const sStats = allStatsMap.get(sub.id) || { total: 0, completed: 0, percent: 0, notesCount: 0 };
          subHtml += `
            <div class="project-subproject-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 3.5px solid ${sub.color || '#3b82f6'}; border-radius: var(--radius-sm); gap: 10px; cursor: pointer;" onclick="ProjectsManager.openProjectDetailModal('${sub.id}')">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <span style="width: 9px; height: 9px; border-radius: 50%; background-color: ${sub.color || '#3b82f6'}; flex-shrink: 0;"></span>
                <span style="font-size: 0.86rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(sub.title)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">${sStats.completed}/${sStats.total} tâche(s) • <strong>${sStats.percent}%</strong></span>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 1px 6px; height: 22px;" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${sub.id}')">Consulter ↗</button>
              </div>
            </div>
          `;
        });
        subprojectsListEl.innerHTML = subHtml;
      }
    }

    if (btnAddSubproject) {
      btnAddSubproject.onclick = () => {
        this.closeProjectDetailModal();
        this.openProjectModal(null, p.id);
      };
    }

    // 1. Liste des tâches du projet
    const allTasks = StorageManager.getTasks();
    const projectTasks = [];
    const collectTasks = (list) => {
      list.forEach(t => {
        if (t.projectId === p.id) projectTasks.push(t);
        if (t.subtasks && t.subtasks.length > 0) collectTasks(t.subtasks);
      });
    };
    collectTasks(allTasks);

    if (tasksCountEl) tasksCountEl.textContent = projectTasks.length;
    if (tasksListEl) {
      if (projectTasks.length === 0) {
        tasksListEl.innerHTML = `
          <div style="color: var(--text-dim); font-size: 0.82rem; font-style: italic; padding: 8px 0;">
            Aucune tâche associée à ce projet pour le moment.
          </div>
        `;
      } else {
        let tasksHtml = '';
        projectTasks.forEach(t => {
          const isDone = !!t.completed;
          tasksHtml += `
            <div class="project-task-row" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <input type="checkbox" ${isDone ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;" onchange="ProjectsManager.toggleTaskFromDetail('${p.id}', '${t.id}')">
                <span style="font-size: 0.84rem; font-weight: 500; cursor: pointer; text-decoration: ${isDone ? 'line-through' : 'none'}; opacity: ${isDone ? '0.6' : '1'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" onclick="ProjectsManager.openTaskFromDetail('${t.id}')" title="Cliquer pour ouvrir la tâche">
                  ${this.escapeHtml(t.title)}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${t.priority ? `<span class="priority-badge priority-${t.priority}" style="font-size: 0.68rem; padding: 1px 6px;">${t.priority}</span>` : ''}
                ${t.plannedDate ? `<span style="font-size: 0.72rem; color: var(--accent); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${t.plannedDate}${t.plannedTime ? ' ' + t.plannedTime : ''}</span></span>` : ''}
                <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 1px 6px; height: 22px;" onclick="ProjectsManager.openTaskFromDetail('${t.id}')">Voir ↗</button>
              </div>
            </div>
          `;
        });
        tasksListEl.innerHTML = tasksHtml;
      }
    }

    if (btnAddTask) {
      btnAddTask.onclick = () => {
        this.closeProjectDetailModal();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('tasks');
        }
        if (window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
          window.TasksManager.openTaskModal();
          setTimeout(() => {
            const projSelect = document.getElementById('task-input-project');
            if (projSelect) projSelect.value = p.id;
          }, 50);
        }
      };
    }

    // 2. Liste des notes documentaires du projet
    const allNotes = StorageManager.getNotes();
    const projectNotes = allNotes.filter(n => n.projectId === p.id);

    if (notesCountEl) notesCountEl.textContent = projectNotes.length;
    if (notesListEl) {
      if (projectNotes.length === 0) {
        notesListEl.innerHTML = `
          <div style="color: var(--text-dim); font-size: 0.82rem; font-style: italic; padding: 8px 0;">
            Aucune note documentaire associée à ce projet.
          </div>
        `;
      } else {
        let notesHtml = '';
        projectNotes.forEach(n => {
          const excerpt = (n.content || '').replace(/[#*`~>-]/g, '').slice(0, 75).trim();
          notesHtml += `
            <div class="project-note-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); gap: 8px; cursor: pointer;" onclick="ProjectsManager.openNoteFromDetail('${n.id}')">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span style="overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(n.title)}</span>
                </div>
                ${excerpt ? `<div style="font-size: 0.74rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${this.escapeHtml(excerpt)}...</div>` : ''}
              </div>
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 1px 6px; height: 22px; flex-shrink: 0;" onclick="event.stopPropagation(); ProjectsManager.openNoteFromDetail('${n.id}')">Ouvrir ↗</button>
            </div>
          `;
        });
        notesListEl.innerHTML = notesHtml;
      }
    }

    if (btnAddNote) {
      btnAddNote.onclick = () => {
        this.closeProjectDetailModal();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('notes');
        }
        if (window.NotesManager && typeof window.NotesManager.createNote === 'function') {
          const newNote = window.NotesManager.createNote();
          if (newNote && typeof window.NotesManager.linkCurrentNoteToProject === 'function') {
            window.NotesManager.linkCurrentNoteToProject(p.id);
          }
        }
      };
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        this.closeProjectDetailModal();
        this.openProjectModal(p.id);
      };
    }

    modal.classList.add('active');
  },

  closeProjectDetailModal() {
    const modal = document.getElementById('project-detail-modal');
    if (modal) modal.classList.remove('active');
  },

  toggleTaskFromDetail(projectId, taskId) {
    if (typeof TasksManager !== 'undefined') {
      if (typeof TasksManager.toggleCompleted === 'function') {
        TasksManager.toggleCompleted(taskId);
      } else if (typeof TasksManager.toggleTask === 'function') {
        TasksManager.toggleTask(taskId);
      }
      this.openProjectDetailModal(projectId);
      this.render();
    }
  },

  openTaskFromDetail(taskId) {
    this.closeProjectDetailModal();
    if (window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('tasks');
    }
    if (window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
      window.TasksManager.openTaskModal(taskId);
    }
  },

  openNoteFromDetail(noteId) {
    this.closeProjectDetailModal();
    if (window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('notes');
    }
    if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
      window.NotesManager.selectNote(noteId);
    }
  },

  openProjectModal(id = null, defaultParentId = null) {
    const modal = document.getElementById('project-modal');
    if (!modal) return;

    const titleEl = document.getElementById('project-modal-title');
    const inputTitle = document.getElementById('project-input-title');
    const inputDesc = document.getElementById('project-input-desc');
    const inputParent = document.getElementById('project-input-parent');
    const inputColor = document.getElementById('project-input-color');
    const btnSave = document.getElementById('project-modal-save');

    const allProjects = this.getAll();
    const forbidden = id ? new Set([id, ...this.getDescendantIds(id, allProjects)]) : new Set();

    if (inputParent) {
      inputParent.innerHTML = '<option value="">(Aucun — Projet principal)</option>';
      const hier = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
        ? StorageManager.getProjectsHierarchy(allProjects)
        : allProjects.map(p => ({ project: p, displayTitle: p.title }));
      hier.forEach(({ project: projItem, displayTitle }) => {
        if (forbidden.has(projItem.id)) return;
        const opt = document.createElement('option');
        opt.value = projItem.id;
        opt.textContent = displayTitle || projItem.title;
        inputParent.appendChild(opt);
      });
    }

    if (id) {
      const p = allProjects.find(item => item.id === id);
      if (!p) return;
      titleEl.textContent = "Modifier le projet";
      inputTitle.value = p.title;
      inputDesc.value = p.description || '';
      if (inputParent) inputParent.value = p.parentProjectId || '';
      inputColor.value = p.color || '#3b82f6';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le nom du projet est requis.");
        this.updateProject(id, {
          title: inputTitle.value,
          description: inputDesc.value,
          color: inputColor.value,
          parentProjectId: inputParent ? (inputParent.value || null) : p.parentProjectId
        });
        this.closeProjectModal();
      };
    } else {
      const parentProj = defaultParentId ? allProjects.find(item => item.id === defaultParentId) : null;
      titleEl.textContent = parentProj ? `Nouveau sous-projet (${parentProj.title})` : "Nouveau projet";
      inputTitle.value = '';
      inputDesc.value = '';
      if (inputParent) inputParent.value = parentProj ? parentProj.id : '';
      inputColor.value = (parentProj && parentProj.color) ? parentProj.color : '#3b82f6';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le nom du projet est requis.");
        this.addProject({
          title: inputTitle.value,
          description: inputDesc.value,
          color: inputColor.value,
          parentProjectId: inputParent ? (inputParent.value || null) : (defaultParentId || null)
        });
        this.closeProjectModal();
      };
    }

    modal.classList.add('active');
    inputTitle.focus();
  },

  closeProjectModal() {
    const modal = document.getElementById('project-modal');
    if (modal) modal.classList.remove('active');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectsManager;
}
