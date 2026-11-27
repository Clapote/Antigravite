/**
 * Antigravité - Module de Gestion des Projets
 * Gestion simple, épurée et visuelle des projets personnels.
 */

const ProjectsManager = {
  viewMode: (typeof localStorage !== 'undefined' && localStorage.getItem('antigravite_project_view')) || 'grid',
  currentFilter: 'active',
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

  _pruneCollapsedFamilies(projectsList = null) {
    this._ensureCollapsedFamiliesLoaded();
    if (this.collapsedFamilies.size === 0) return;
    const projects = Array.isArray(projectsList) ? projectsList : this.getAll();
    const activeParentIds = new Set();
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p && !p.archived && p.parentProjectId) {
        const parent = projects.find(pr => pr && pr.id === p.parentProjectId && !pr.archived);
        if (parent) activeParentIds.add(String(parent.id));
      }
    }
    let changed = false;
    for (const id of Array.from(this.collapsedFamilies)) {
      if (!activeParentIds.has(id)) {
        this.collapsedFamilies.delete(id);
        changed = true;
      }
    }
    if (changed && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_collapsed_project_families', JSON.stringify(Array.from(this.collapsedFamilies)));
      } catch (e) {}
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

  init(options = {}) {
    if (this.initialized) {
      if (!options || !options.deferRender) this.render();
      return;
    }
    this.initialized = true;
    if (typeof localStorage !== 'undefined') {
      const savedMode = localStorage.getItem('antigravite_project_view');
      if (savedMode === 'grid' || savedMode === 'list') {
        this.viewMode = savedMode;
      }
    }
    if (!options || !options.deferRender) {
      this.render();
    }
    this.bindEvents();
  },

  bindEvents() {
    const btnNew = document.getElementById('btn-new-project');
    if (btnNew && !btnNew._hasProjectsListener) {
      btnNew._hasProjectsListener = true;
      btnNew.addEventListener('click', () => this.openProjectModal());
    }

    const btnGrid = document.getElementById('btn-project-view-grid');
    if (btnGrid && !btnGrid._hasProjectsListener) {
      btnGrid._hasProjectsListener = true;
      btnGrid.addEventListener('click', () => this.setViewMode('grid'));
    }

    const btnList = document.getElementById('btn-project-view-list');
    if (btnList && !btnList._hasProjectsListener) {
      btnList._hasProjectsListener = true;
      btnList.addEventListener('click', () => this.setViewMode('list'));
    }

    const btnToggle = document.getElementById('btn-projects-toggle-collapse') || document.getElementById('btn-projects-expand-all');
    if (btnToggle && !btnToggle._hasProjectsCollapseListener) {
      btnToggle._hasProjectsCollapseListener = true;
      btnToggle.addEventListener('click', () => this.toggleAllCollapse());
    }

    const btnCollapse = document.getElementById('btn-projects-collapse-all');
    if (btnCollapse && !btnCollapse._hasProjectsCollapseListener) {
      btnCollapse._hasProjectsCollapseListener = true;
      btnCollapse.addEventListener('click', () => this.collapseAll());
    }

    const btnFilterActive = document.getElementById('btn-projects-filter-active');
    if (btnFilterActive && !btnFilterActive._hasProjectsListener) {
      btnFilterActive._hasProjectsListener = true;
      btnFilterActive.addEventListener('click', () => this.setFilter('active'));
    }

    const btnFilterArchived = document.getElementById('btn-projects-filter-archived');
    if (btnFilterArchived && !btnFilterArchived._hasProjectsListener) {
      btnFilterArchived._hasProjectsListener = true;
      btnFilterArchived.addEventListener('click', () => this.setFilter('archived'));
    }
  },

  setFilter(filter) {
    this.currentFilter = (filter === 'archived') ? 'archived' : 'active';
    this.render();
  },

  // Basculer entre tout déplier et tout replier
  toggleAllCollapse() {
    this._pruneCollapsedFamilies();
    if (this.collapsedFamilies.size > 0) {
      this.expandAll();
    } else {
      this.collapseAll();
    }
  },

  // Synchronise le titre et l'icône du bouton unique de bascule
  updateToggleCollapseButton() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btn-projects-toggle-collapse') || document.getElementById('btn-projects-expand-all');
    if (!btn) return;
    this._pruneCollapsedFamilies();
    const hasCollapsed = this.collapsedFamilies.size > 0;
    const label = hasCollapsed ? 'Tout déplier' : 'Tout replier';
    const title = hasCollapsed ? "Tout déplier dans l'arborescence" : "Tout replier au premier niveau";
    const icon = hasCollapsed
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    btn.innerHTML = `${icon} <span>${label}</span>`;
    btn.title = title;
  },

  expandAll() {
    this._ensureCollapsedFamiliesLoaded();
    this.collapsedFamilies.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_collapsed_project_families', JSON.stringify([]));
      } catch (e) {}
    }
    this.render();
    this.updateToggleCollapseButton();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Tous les projets ont été dépliés", 'info');
    }
  },

  collapseAll() {
    this._ensureCollapsedFamiliesLoaded();
    const projects = this.getAll();
    projects.forEach(p => {
      if (p.parentProjectId) this.collapsedFamilies.add(String(p.parentProjectId));
    });
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('antigravite_collapsed_project_families', JSON.stringify(Array.from(this.collapsedFamilies)));
      } catch (e) {}
    }
    this.render();
    this.updateToggleCollapseButton();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Tous les sous-projets ont été repliés", 'info');
    }
  },

  async archiveProject(id) {
    const projects = this.getAll();
    const target = projects.find(p => p.id === id);
    if (!target) return;

    const subprojectIds = [];
    const collectChildren = (parentId) => {
      projects.filter(p => p.parentProjectId === parentId).forEach(sub => {
        subprojectIds.push(sub.id);
        collectChildren(sub.id);
      });
    };
    collectChildren(id);

    if (subprojectIds.length > 0) {
      let ok = true;
      if (typeof App !== 'undefined' && typeof App.confirm === 'function') {
        ok = await App.confirm({
          title: "Archiver le projet et ses sous-projets",
          message: `Voulez-vous archiver le projet « ${target.title} » et ses ${subprojectIds.length} sous-projet(s) ?\n\nLeurs tâches actives seront masquées sans être supprimées. Vos notes resteront consultables et les événements d'agenda inchangés.`,
          confirmText: "Archiver la branche",
          danger: false,
          icon: "📦"
        });
      } else if (typeof confirm === 'function') {
        ok = confirm(`Archiver « ${target.title} » et ses ${subprojectIds.length} sous-projets ?`);
      }
      if (!ok) return;
    }

    const now = new Date().toISOString();
    const idsToArchive = new Set([id, ...subprojectIds]);
    projects.forEach(p => {
      if (idsToArchive.has(p.id)) {
        p.archived = true;
        p.archivedAt = now;
      }
    });

    this.saveAll(projects);
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(subprojectIds.length > 0 ? "Projet et sous-projets archivés" : "Projet archivé", "info");
    }
  },

  async unarchiveProject(id) {
    const projects = this.getAll();
    const target = projects.find(p => p.id === id);
    if (!target) return;

    const subprojectIds = [];
    const visitedChildren = new Set([id]);
    const collectChildren = (parentId) => {
      projects.filter(p => p.parentProjectId === parentId).forEach(sub => {
        if (visitedChildren.has(sub.id)) return;
        visitedChildren.add(sub.id);
        subprojectIds.push(sub.id);
        collectChildren(sub.id);
      });
    };
    collectChildren(id);

    // Réactiver aussi les ancêtres archivés pour éviter les sous-projets orphelins invisibles
    const restoredAncestorIds = [];
    const visitedAncestors = new Set([id]);
    let cursorParentId = target.parentProjectId;
    while (cursorParentId && !visitedAncestors.has(cursorParentId)) {
      visitedAncestors.add(cursorParentId);
      const ancestor = projects.find(p => p.id === cursorParentId);
      if (!ancestor) {
        target.parentProjectId = null;
        break;
      }
      if (ancestor.archived) {
        restoredAncestorIds.push(ancestor.id);
      }
      cursorParentId = ancestor.parentProjectId;
    }

    const idsToRestore = new Set([id, ...subprojectIds, ...restoredAncestorIds]);
    projects.forEach(p => {
      if (idsToRestore.has(p.id)) {
        p.archived = false;
        delete p.archivedAt;
      }
    });

    this.saveAll(projects);
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast(
        restoredAncestorIds.length > 0 ? "Projet, branche parente et tâches réactivés" : "Projet et tâches réactivés",
        "success"
      );
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
    this._pruneCollapsedFamilies(projects);
    StorageManager.saveProjects(projects);
    this.render();
    if (typeof TasksManager !== 'undefined' && typeof TasksManager.render === 'function') TasksManager.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
    if (typeof window !== 'undefined' && window.ConstellationManager && typeof window.App !== 'undefined' && window.App.currentScreen === 'constellation') {
      window.ConstellationManager.render();
    }
  },

  addProject(projectData) {
    const safeTitle = (projectData && typeof projectData.title === 'string') ? projectData.title.trim() : '';
    if (!safeTitle) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Le nom du projet est requis.", "warning");
      }
      return null;
    }
    const projects = this.getAll();
    const parentId = projectData.parentProjectId ? String(projectData.parentProjectId) : null;
    const validParent = parentId && projects.some(p => p.id === parentId) ? parentId : null;
    const newProj = {
      id: 'proj-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: safeTitle,
      description: projectData.description ? String(projectData.description).trim() : '',
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

    const nextTitle = updatedData && updatedData.title !== undefined ? String(updatedData.title).trim() : p.title;
    if (!nextTitle) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Le nom du projet est requis.", "warning");
      }
      return false;
    }
    p.title = nextTitle;
    p.description = updatedData.description !== undefined ? String(updatedData.description || '').trim() : p.description;
    p.color = updatedData.color || p.color;
    p.status = updatedData.status || p.status;
    if (updatedData.parentProjectId !== undefined) {
      const nextParent = updatedData.parentProjectId || null;
      const parentExists = !nextParent || projects.some(item => item.id === nextParent);
      if (parentExists && (!nextParent || !this.isDescendant(nextParent, id, projects))) {
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
    const childProjectIds = projects.filter(p => p && p.parentProjectId === id).map(p => p.id);

    // Détacher le projet des tâches tout en enregistrant les liens pour une restauration complète depuis la Corbeille
    const tasks = StorageManager.getTasks();
    const linkedTaskIds = [];
    const detachRecursive = (list) => {
      list.forEach(t => {
        if (t.projectId === id) {
          linkedTaskIds.push(t.id);
          t.projectId = null;
        }
        if (t.subtasks && t.subtasks.length > 0) detachRecursive(t.subtasks);
      });
    };
    detachRecursive(tasks);
    StorageManager.saveTasks(tasks);

    // Détacher le projet des notes associées (projectId ET linkedProjectId)
    const notes = StorageManager.getNotes();
    const linkedNoteIds = [];
    let notesChanged = false;
    notes.forEach(n => {
      if (n.projectId === id || n.linkedProjectId === id) {
        linkedNoteIds.push(n.id);
        n.projectId = null;
        if (n.linkedProjectId === id) n.linkedProjectId = null;
        notesChanged = true;
      }
    });
    if (notesChanged) {
      StorageManager.saveNotes(notes);
      if (window.NotesManager && typeof window.NotesManager.renderNotesList === 'function') {
        window.NotesManager.renderNotesList();
      }
    }

    // Détacher le projet des créneaux d'agenda associés
    const linkedEventIds = [];
    if (typeof StorageManager.getEvents === 'function') {
      const events = StorageManager.getEvents();
      let eventsChanged = false;
      events.forEach(evt => {
        if (evt && evt.projectId === id) {
          linkedEventIds.push(evt.id);
          evt.projectId = null;
          eventsChanged = true;
        }
      });
      if (eventsChanged) {
        StorageManager.saveEvents(events);
        if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
          window.AgendaManager.render();
        }
      }
    }

    if (projectToDelete && typeof TrashManager !== 'undefined' && typeof TrashManager.moveToTrash === 'function') {
      const trashPayload = Object.assign({}, projectToDelete, {
        _deletedMeta: { childProjectIds, linkedTaskIds, linkedNoteIds, linkedEventIds }
      });
      TrashManager.moveToTrash('project', trashPayload);
    }

    const fallbackParentId = projectToDelete ? (projectToDelete.parentProjectId || null) : null;
    projects = projects
      .filter(p => p.id !== id)
      .map(p => (p.parentProjectId === id ? Object.assign({}, p, { parentProjectId: fallbackParentId }) : p));

    this.saveAll(projects);
    if (window.NotesManager && typeof window.NotesManager.populateProjectFilter === 'function') {
      window.NotesManager.populateProjectFilter();
    }
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

  // Calcul groupé ultra-rapide des statistiques de tous les projets en une seule passe (avec mémoïsation par révision)
  getAllProjectsStats() {
    const tasks = StorageManager.getTasks();
    const notes = StorageManager.getNotes();
    const tasksRev = typeof StorageManager.getRevision === 'function' ? StorageManager.getRevision('tasks') : null;
    const notesRev = typeof StorageManager.getRevision === 'function' ? StorageManager.getRevision('notes') : null;

    if (
      this._statsCacheMap &&
      tasksRev !== null &&
      notesRev !== null &&
      this._statsCacheTasksRev === tasksRev &&
      this._statsCacheNotesRev === notesRev &&
      this._statsCacheTasksRef === tasks &&
      this._statsCacheNotesRef === notes &&
      this._statsCacheTasksLen === (tasks ? tasks.length : 0) &&
      this._statsCacheNotesLen === (notes ? notes.length : 0)
    ) {
      return this._statsCacheMap;
    }

    const statsMap = new Map();

    const countTasks = (list) => {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t) continue;
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
    if (Array.isArray(tasks)) countTasks(tasks);

    if (Array.isArray(notes)) {
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (n && n.projectId) {
          let s = statsMap.get(n.projectId);
          if (!s) {
            s = { total: 0, completed: 0, percent: 0, notesCount: 0 };
            statsMap.set(n.projectId, s);
          }
          s.notesCount++;
        }
      }
    }

    statsMap.forEach(s => {
      s.percent = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    });

    this._statsCacheMap = statsMap;
    this._statsCacheTasksRev = tasksRev;
    this._statsCacheNotesRev = notesRev;
    this._statsCacheTasksRef = tasks;
    this._statsCacheNotesRef = notes;
    this._statsCacheTasksLen = tasks ? tasks.length : 0;
    this._statsCacheNotesLen = notes ? notes.length : 0;

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

      const clientX = e.clientX;
      const clientY = e.clientY;
      if (this._dragOverRaf) return;
      this._dragOverRaf = requestAnimationFrame(() => {
        this._dragOverRaf = null;
        if (!this.draggedProjectId || this.draggedProjectId === p.id) return;
        this._clearFamilyDragHighlight();

        const rect = card.getBoundingClientRect();
        const useVerticalAxis = (this.viewMode === 'list') || (card.dataset && card.dataset.dropAxis === 'y');
        const ratio = useVerticalAxis
          ? ((clientY - rect.top) / Math.max(1, rect.height))
          : ((clientX - rect.left) / Math.max(1, rect.width));

        let pos = 'nest';
        if (ratio < 0.25) pos = 'before';
        else if (ratio > 0.75) pos = 'after';

        if (card.dataset.dropPos !== pos) {
          card.classList.toggle('drag-over-before', pos === 'before');
          card.classList.toggle('drag-over-after', pos === 'after');
          card.classList.toggle('drag-over-nest', pos === 'nest');
          card.dataset.dropPos = pos;
          card.dataset.dropAfter = (pos === 'after') ? 'true' : 'false';
        }
      });
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
    const isArchived = Boolean(p.archived);
    const archivedBadgeHtml = isArchived
      ? `<span class="project-archived-pill" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: rgba(148, 163, 184, 0.2); color: var(--text-dim);" title="Ce projet est archivé"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>Archivé</span>`
      : '';
    const subBadgeHtml = parentProject
      ? `<button type="button" class="project-parent-pill" style="border-color: ${this._colorWithAlpha(parentColor, 0.35, 'var(--border-color)')};" title="Sous-projet de ${this.escapeHtml(parentProject.title)} — Cliquer pour ouvrir le parent" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${parentProject.id}')"><span class="project-parent-dot" style="background-color: ${parentColor};"></span><span>${this.escapeHtml(parentProject.title)}</span></button>`
      : '';
    const childrenBadgeHtml = childrenCount > 0
      ? (isList
          ? `<button type="button" class="project-subcount-pill project-family-toggle-pill ${isCollapsedFamily ? 'is-collapsed' : ''}" style="cursor: pointer;" title="${isCollapsedFamily ? 'Afficher les sous-projets' : 'Masquer les sous-projets'}" onclick="event.stopPropagation(); ProjectsManager.toggleFamilyCollapse('${p.id}')"><svg class="project-family-chevron ${isCollapsedFamily ? 'is-collapsed' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; transition: transform var(--transition-fast); transform: ${isCollapsedFamily ? 'rotate(-90deg)' : 'rotate(0deg)'};"><polyline points="6 9 12 15 18 9"/></svg><span>${childrenCount} sous-projet${childrenCount > 1 ? 's' : ''}</span></button>`
          : `<span class="project-subcount-pill" title="${childrenCount} sous-projet(s) imbriqué(s)">↳ ${childrenCount} sous-projet${childrenCount > 1 ? 's' : ''}</span>`
        )
      : '';
    const familyToggleBtnHtml = (isFamilyParent && childrenCount > 0)
      ? `<button type="button" class="project-family-toggle-btn ${isCollapsedFamily ? 'is-collapsed' : ''}" title="${isCollapsedFamily ? 'Afficher' : 'Masquer'} les sous-projets" aria-expanded="${!isCollapsedFamily}" onclick="event.stopPropagation(); ProjectsManager.toggleFamilyCollapse('${p.id}')"><svg class="project-family-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg><span>${childrenCount} sous-projet${childrenCount > 1 ? 's' : ''}</span></button>`
      : '';
    const promoteBtnHtml = (!isArchived && level > 0)
      ? `<button class="btn-icon btn-action-promote" title="Remonter d'un niveau" onclick="event.stopPropagation(); ProjectsManager.unNestProject('${p.id}', false)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>`
      : '';
    const addSubBtnHtml = !isArchived
      ? `<button class="btn-icon btn-action-add" title="Ajouter un sous-projet" onclick="event.stopPropagation(); ProjectsManager.openProjectModal(null, '${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`
      : '';
    const archiveActionBtnHtml = isArchived
      ? `<button class="btn-icon" title="Désarchiver le projet" onclick="event.stopPropagation(); ProjectsManager.unarchiveProject('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>`
      : `<button class="btn-icon" title="Archiver le projet" onclick="event.stopPropagation(); ProjectsManager.archiveProject('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg></button>`;
    const parentRibbonHtml = (level > 0 && parentProject)
      ? `<div class="project-parent-ribbon" style="background-color: ${parentColor};" title="Rattaché à ${this.escapeHtml(parentProject.title)}"></div>`
      : '';

    const notesIconHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const editBtnHtml = `<button class="btn-icon" title="Modifier" onclick="event.stopPropagation(); ProjectsManager.openProjectModal('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`;
    const deleteBtnHtml = `<button class="btn-icon" title="Supprimer" onclick="event.stopPropagation(); ProjectsManager.deleteProject('${p.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;

    if (isList) {
      card.className = `project-card project-row draggable-item ${level > 0 ? 'is-subproject' : ''} ${isArchived ? 'is-archived' : ''}`;
      card.dataset.dropAxis = 'y';
      card.innerHTML = `
        <div class="project-drag-handle" title="Glisser sur le centre d'un projet pour imbriquer, ou sur les bords pour réordonner">⠿</div>
        <div class="project-color-bar" style="background-color: ${p.color};"></div>
        <div class="project-row-main">
          <span class="project-title">${this.escapeHtml(p.title)}</span>
          ${archivedBadgeHtml}
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
          ${archiveActionBtnHtml}
          ${editBtnHtml}
          ${deleteBtnHtml}
        </div>
      `;
    } else {
      const badgesHtml = `${archivedBadgeHtml}${subBadgeHtml}${familyToggleBtnHtml}`;
      card.className = `project-card draggable-item${isFamilyParent ? ' is-family-parent' : ''}${level > 0 ? ' is-subproject' : ''}${isArchived ? ' is-archived' : ''}`;
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
            ${archiveActionBtnHtml}
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

  _getRenderSig() {
    const pRev = typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function' ? StorageManager.getRevision('projects') : -1;
    const tRev = typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function' ? StorageManager.getRevision('tasks') : -1;
    const nRev = typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function' ? StorageManager.getRevision('notes') : -1;
    return `${pRev}:${tRev}:${nRev}:${this.viewMode}:${this.currentFilter}:${this.collapsedFamilies ? this.collapsedFamilies.size : 0}`;
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('projects-grid-container');
    if (!container) return;
    const sig = this._getRenderSig();
    if (this._lastRenderedSig === sig && container.childElementCount > 0) return;
    this.render();
  },

  render() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const container = document.getElementById('projects-grid-container');
    if (!container) return;
    this._lastRenderedSig = this._getRenderSig();

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

    const allProjects = this.getAll();
    const activeProjects = allProjects.filter(p => !p.archived);
    const archivedProjects = allProjects.filter(p => Boolean(p.archived));
    const isArchivedFilter = this.currentFilter === 'archived';

    const btnFilterActive = document.getElementById('btn-projects-filter-active');
    const btnFilterArchived = document.getElementById('btn-projects-filter-archived');
    if (btnFilterActive) {
      btnFilterActive.textContent = `Actifs (${activeProjects.length})`;
      btnFilterActive.classList.toggle('active', !isArchivedFilter);
    }
    if (btnFilterArchived) {
      btnFilterArchived.textContent = `Archivés (${archivedProjects.length})`;
      btnFilterArchived.classList.toggle('active', isArchivedFilter);
    }

    // Synchroniser le bouton unique Tout replier / Tout déplier
    this.updateToggleCollapseButton();

    const projects = isArchivedFilter ? archivedProjects : activeProjects;
    if (projects.length === 0) {
      container.classList.remove('has-expanded-families');
      if (isArchivedFilter) {
        container.innerHTML = `
          <div class="antigravite-empty-state projects-empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-illustration">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </div>
            <h3 class="empty-state-title">Aucun projet archivé</h3>
            <p class="empty-state-text">Vos projets terminés ou mis de côté apparaîtront ici sans encombrer votre vue active.</p>
          </div>
        `;
      } else {
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
      }
      return;
    }

    const allStats = this.getAllProjectsStats();
    const fragment = (typeof document.createDocumentFragment === 'function') ? document.createDocumentFragment() : container;

    if (this.viewMode === 'list') {
      container.classList.remove('has-expanded-families');
      const { roots } = this.getProjectTree(projects);

      const renderListTree = (nodeList, parentEl, level = 0) => {
        nodeList.forEach((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isCollapsed = this.isFamilyCollapsed(node.project.id);
          const isRoot = (level === 0);

          const treeNode = document.createElement('div');
          treeNode.className = `project-tree-node level-${Math.min(level, 6)} ${isRoot ? 'is-root' : 'is-child'}`;
          treeNode.dataset.projectId = node.project.id;
          treeNode.dataset.level = String(level);

          const card = this._createProjectCardElement(node, allStats, projects, {
            isList: true,
            isFamilyParent: hasChildren,
            isCollapsedFamily: isCollapsed
          });
          treeNode.appendChild(card);

          if (hasChildren) {
            const subContainer = document.createElement('div');
            subContainer.className = `subprojects-container ${isCollapsed ? 'collapsed' : ''}`;
            treeNode.appendChild(subContainer);
            if (!isCollapsed) {
              renderListTree(node.children, subContainer, level + 1);
            }
          }

          parentEl.appendChild(treeNode);
        });
      };

      renderListTree(roots, fragment, 0);
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

    // Carte "+" pour créer un nouveau projet dans la continuité de la vue (uniquement en vue active)
    if (!isArchivedFilter) {
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
    }

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
    if (titleEl) {
      titleEl.textContent = p.title;
      if (p.archived) {
        titleEl.innerHTML = `${this.escapeHtml(p.title)} <span class="badge" style="font-size: 0.72rem; vertical-align: middle; background: rgba(148,163,184,0.25); color: var(--text-dim); margin-left: 8px;">Archivé</span>`;
      }
    }
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

    const allStatsMap = this.getAllProjectsStats();
    const stats = allStatsMap.get(p.id) || { total: 0, completed: 0, percent: 0, notesCount: 0 };
    if (progressLabel) progressLabel.textContent = `Tâches réalisées : ${stats.completed} / ${stats.total}`;
    if (progressPct) progressPct.textContent = `${stats.percent}%`;
    if (progressFill) {
      progressFill.style.width = `${stats.percent}%`;
      progressFill.style.backgroundColor = p.color || 'var(--primary)';
    }
    const eventsCountEl = document.getElementById('project-detail-events-count');
    const eventsListEl = document.getElementById('project-detail-events-list');
    const btnAddEvent = document.getElementById('btn-project-detail-add-event');
    const btnFocusProj = document.getElementById('btn-project-detail-focus');

    // 0. Liste des sous-projets directs
    const childProjects = this.getChildProjects(p.id, allProjects);
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

    // 3. Liste des créneaux d'agenda associés (directement via projectId ou indirectement via une tâche du projet)
    const projTaskIdSet = new Set(projectTasks.map(t => t.id));
    const allEvents = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function')
      ? StorageManager.getEvents()
      : [];
    const projectEvents = allEvents
      .filter(ev => ev && (ev.projectId === p.id || (ev.taskId && projTaskIdSet.has(ev.taskId))))
      .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

    if (eventsCountEl) eventsCountEl.textContent = projectEvents.length;
    if (eventsListEl) {
      if (projectEvents.length === 0) {
        eventsListEl.innerHTML = `
          <div style="color: var(--text-dim); font-size: 0.82rem; font-style: italic; padding: 8px 0;">
            Aucun créneau planifié pour ce projet.
          </div>
        `;
      } else {
        let evHtml = '';
        projectEvents.forEach(ev => {
          const rawDate = ev.start ? ev.start.slice(0, 10) : '';
          const timeLabel = ev.isAllDay ? 'Journée entière' : (ev.start && ev.start.length >= 16 ? ev.start.slice(11, 16) : '');
          evHtml += `
            <div class="project-event-row" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 3.5px solid ${p.color || '#8b5cf6'}; border-radius: var(--radius-sm); gap: 8px; cursor: pointer;" onclick="ProjectsManager.openEventFromDetail('${ev.id}')">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <span style="font-size: 0.84rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(ev.title || '(Sans titre)')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <span style="font-size: 0.72rem; color: var(--accent);">${this.escapeHtml(rawDate)}${timeLabel ? ' • ' + this.escapeHtml(timeLabel) : ''}</span>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 1px 6px; height: 22px;" onclick="event.stopPropagation(); ProjectsManager.openEventFromDetail('${ev.id}')">Agenda ↗</button>
              </div>
            </div>
          `;
        });
        eventsListEl.innerHTML = evHtml;
      }
    }

    if (btnAddEvent) {
      btnAddEvent.onclick = () => {
        this.closeProjectDetailModal();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('agenda');
        }
        if (window.AgendaManager && typeof window.AgendaManager.openEventModal === 'function') {
          window.AgendaManager.openEventModal(null, {
            title: p.title,
            projectId: p.id,
            color: p.color || '#8b5cf6'
          });
        }
      };
    }

    if (btnFocusProj) {
      btnFocusProj.onclick = () => {
        this.closeProjectDetailModal();
        if (window.App && typeof window.App.startFocusOn === 'function') {
          window.App.startFocusOn('project', p.id);
        }
      };
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        this.closeProjectDetailModal();
        this.openProjectModal(p.id);
      };
    }

    const btnArchive = document.getElementById('btn-project-detail-archive');
    const btnArchiveText = document.getElementById('btn-project-detail-archive-text');
    if (btnArchive) {
      if (btnArchiveText) {
        btnArchiveText.textContent = p.archived ? "Désarchiver" : "Archiver";
      }
      btnArchive.onclick = () => {
        this.closeProjectDetailModal();
        if (p.archived) {
          this.unarchiveProject(p.id);
        } else {
          this.archiveProject(p.id);
        }
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

  openEventFromDetail(eventId) {
    this.closeProjectDetailModal();
    if (window.App && typeof window.App.openEventFromDashboard === 'function') {
      window.App.openEventFromDashboard(eventId);
    } else if (window.App && typeof window.App.navigate === 'function') {
      window.App.navigate('agenda');
      if (window.AgendaManager && typeof window.AgendaManager.openEventModal === 'function') {
        setTimeout(() => window.AgendaManager.openEventModal(eventId), 80);
      }
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
    const btnColorPicker = document.getElementById('btn-project-color-picker');
    const badgeColor = document.getElementById('project-color-badge');
    const labelColor = document.getElementById('project-color-label');

    const syncColorUI = (hex) => {
      const cleanHex = (hex || '#3b82f6').toUpperCase();
      if (inputColor) inputColor.value = cleanHex;
      if (badgeColor) badgeColor.style.background = cleanHex;
      if (labelColor) labelColor.textContent = cleanHex;
    };

    if (btnColorPicker) {
      btnColorPicker.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof App !== 'undefined' && typeof App.openColorPicker === 'function') {
          App.openColorPicker({
            targetElement: btnColorPicker,
            initialColor: inputColor ? inputColor.value : '#3b82f6',
            title: 'Couleur du projet',
            applyLabel: 'Appliquer',
            showNameInput: false,
            onColorChange: (val) => syncColorUI(val),
            onApply: (val) => syncColorUI(val),
            onCancel: (val) => syncColorUI(val)
          });
        }
      };
    }

    const allProjects = this.getAll();
    const currentEditingProject = id ? allProjects.find(item => item.id === id) : null;
    const forbidden = id ? new Set([id, ...this.getDescendantIds(id, allProjects)]) : new Set();

    if (inputParent) {
      inputParent.innerHTML = '<option value="">(Aucun — Projet principal)</option>';
      const activeProjects = allProjects.filter(pr => !pr.archived || (currentEditingProject && currentEditingProject.parentProjectId === pr.id));
      const hier = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
        ? StorageManager.getProjectsHierarchy(activeProjects)
        : activeProjects.map(p => ({ project: p, displayTitle: p.title }));
      hier.forEach(({ project: projItem, displayTitle }) => {
        if (forbidden.has(projItem.id)) return;
        const opt = document.createElement('option');
        opt.value = projItem.id;
        const baseLabel = displayTitle || projItem.title;
        opt.textContent = projItem.archived ? `${baseLabel} (Archivé)` : baseLabel;
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
      syncColorUI(p.color || '#3b82f6');

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) {
          if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Le nom du projet est requis.", "warning");
          } else if (typeof alert === 'function') {
            alert("Le nom du projet est requis.");
          }
          return;
        }
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
      syncColorUI((parentProj && parentProj.color) ? parentProj.color : '#3b82f6');

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) {
          if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Le nom du projet est requis.", "warning");
          } else if (typeof alert === 'function') {
            alert("Le nom du projet est requis.");
          }
          return;
        }
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
    if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
      App.closeColorPicker(true);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectsManager;
}
