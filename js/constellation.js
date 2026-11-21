/**
 * Antigravité - Module Constellation & Mind Map Interactive
 * Vue panoramique unifiée reliant Projets, Tâches, Agenda et Notes.
 * Supporte : Arbre décisionnel horizontal, Constellation rayonnante avec orbes compacts,
 * Pan infini, Zoom dynamique, filtrage instantané sans déplacement de tableau,
 * passerelles directes en un clic, menu contextuel complet au clic droit et aperçu au survol.
 */

const ConstellationManager = {
  currentMode: 'tree', // 'tree' (Arbre horizontal) ou 'radial' (Constellation rayonnante)
  zoom: 1.0,
  pan: { x: 120, y: 160 },
  isPanning: false,
  startPan: { x: 0, y: 0 },
  collapsedNodes: new Set(),
  filters: {
    projects: true,
    tasks: true,
    events: true,
    notes: true,
    hideDone: false
  },
  searchQuery: '',
  _initialized: false,
  _hasInitiallyFitted: false,
  _graphData: null,

  init() {
    if (this._initialized || typeof document === 'undefined') return;
    this._initialized = true;

    this.bindToolbarEvents();
    this.bindViewportPanZoom();
    this.bindGlobalEvents();
    this.bindResizeEvents();
  },

  bindToolbarEvents() {
    // 1. Switch de mode (Arbre décisionnel horizontal vs Constellation rayonnante)
    const btnTree = document.getElementById('btn-constellation-mode-tree');
    const btnRadial = document.getElementById('btn-constellation-mode-radial');

    if (btnTree) {
      btnTree.addEventListener('click', (e) => {
        e.preventDefault();
        this.setMode('tree');
      });
    }

    if (btnRadial) {
      btnRadial.addEventListener('click', (e) => {
        e.preventDefault();
        this.setMode('radial');
      });
    }

    // 2. Filtres rapides par type (Filtrage instantané SANS faire bouger le tableau)
    const filterPills = [
      { id: 'filter-constellation-projects', key: 'projects' },
      { id: 'filter-constellation-tasks', key: 'tasks' },
      { id: 'filter-constellation-events', key: 'events' },
      { id: 'filter-constellation-notes', key: 'notes' },
      { id: 'filter-constellation-hide-done', key: 'hideDone' }
    ];

    filterPills.forEach(({ id, key }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.filters[key] = !this.filters[key];
          btn.classList.toggle('active', this.filters[key]);
          this.applyFiltersVisibility();
        });
      }
    });

    // 3. Recherche instantanée
    const searchInput = document.getElementById('constellation-search-input');
    const clearBtn = document.getElementById('btn-clear-constellation-search');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = (searchInput.value || '').trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = this.searchQuery ? 'block' : 'none';
        this.applySearchHighlight();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          this.searchQuery = '';
          if (clearBtn) clearBtn.style.display = 'none';
          this.applySearchHighlight();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        clearBtn.style.display = 'none';
        this.applySearchHighlight();
      });
    }

    // 4. Contrôles de zoom et cadrage
    const btnZoomIn = document.getElementById('btn-constellation-zoom-in');
    const btnZoomOut = document.getElementById('btn-constellation-zoom-out');
    const btnFitAll = document.getElementById('btn-constellation-fit-all');
    const btnResetView = document.getElementById('btn-constellation-reset-view');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.applyZoomDelta(1.15));
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.applyZoomDelta(0.85));
    }
    if (btnFitAll) {
      btnFitAll.addEventListener('click', () => this.fitAll(true));
    }
    if (btnResetView) {
      btnResetView.addEventListener('click', () => this.resetView());
    }
  },

  bindViewportPanZoom() {
    const viewport = document.getElementById('constellation-viewport');
    if (!viewport) return;

    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let initialPanX = 0;
    let initialPanY = 0;
    let hasMoved = false;

    viewport.addEventListener('pointerdown', (e) => {
      // Uniquement clic gauche (bouton 0) pour déplacer le canevas
      if (e.button !== 0) return;

      // Ignorer si on clique sur un bouton de la toolbar, un input ou le menu contextuel
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.segmented-group') || e.target.closest('#constellation-context-menu')) {
        return;
      }

      // Si le clic commence SUR un nœud ou une bulle : c'est une action de sélection/ouverture,
      // on NE DÉMARRE PAS de pan du canevas pour garantir un clic gauche 100% fiable
      if (e.target.closest('.constellation-node')) {
        return;
      }

      this.hideContextMenu();
      pointerDown = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      initialPanX = this.pan.x;
      initialPanY = this.pan.y;

      if (viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!pointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        if (!hasMoved) {
          hasMoved = true;
          viewport.classList.add('is-dragging');
          this.hideHoverCard();
        }
        this.pan.x = initialPanX + dx;
        this.pan.y = initialPanY + dy;
        this.updateCanvasTransform();
      }
    });

    const endDrag = (e) => {
      if (!pointerDown) return;
      pointerDown = false;
      viewport.classList.remove('is-dragging');
      if (viewport.releasePointerCapture) {
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // Zoom fluide à la molette orienté vers le curseur
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.hideContextMenu();
      this.hideHoverCard();

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calcul des coordonnées monde sous la souris
      const worldX = (mouseX - this.pan.x) / this.zoom;
      const worldY = (mouseY - this.pan.y) / this.zoom;

      const factor = (e.deltaY < 0) ? 1.12 : 0.88;
      const newZoom = Math.max(0.25, Math.min(2.5, this.zoom * factor));

      if (newZoom !== this.zoom) {
        this.zoom = newZoom;
        // Ajuster le pan pour que le point sous la souris reste parfaitement fixe
        this.pan.x = mouseX - worldX * this.zoom;
        this.pan.y = mouseY - worldY * this.zoom;
        this.updateCanvasTransform();
        this.updateZoomLabel();
      }
    }, { passive: false });

    // Menu contextuel au clic droit sur l'espace vide du canevas
    viewport.addEventListener('contextmenu', (e) => {
      // Ignorer si on clique sur un nœud (déjà géré par bindNodeInteractions) ou sur la toolbar
      if (e.target.closest('.constellation-node') || e.target.closest('.constellation-toolbar') || e.target.closest('#constellation-context-menu')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.showCanvasContextMenu(e.clientX, e.clientY);
    });
  },

  bindGlobalEvents() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    // Fermeture du menu contextuel au clic extérieur ou sur Échap
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('constellation-context-menu');
      if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
        this.hideHoverCard();
      }

      // Raccourcis exclusifs à l'onglet Constellation (hors champs de saisie)
      if (typeof App !== 'undefined' && App.currentScreen === 'constellation') {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          this.applyZoomDelta(1.15);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          this.applyZoomDelta(0.85);
        } else if (e.key === '0' || e.key.toLowerCase() === 'f') {
          e.preventDefault();
          this.fitAll(true);
        } else if (e.key === '1') {
          e.preventDefault();
          this.setMode('tree');
        } else if (e.key === '2') {
          e.preventDefault();
          this.setMode('radial');
        }
      }
    });
  },

  bindResizeEvents() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => {
        if (typeof App !== 'undefined' && App.currentScreen === 'constellation') {
          this.updateSvgCanvasSize();
        }
      });
    }
  },

  setMode(mode) {
    if (mode !== 'tree' && mode !== 'radial') return;
    this.currentMode = mode;

    const btnTree = document.getElementById('btn-constellation-mode-tree');
    const btnRadial = document.getElementById('btn-constellation-mode-radial');
    const viewport = document.getElementById('constellation-viewport');

    if (btnTree) btnTree.classList.toggle('active', mode === 'tree');
    if (btnRadial) btnRadial.classList.toggle('active', mode === 'radial');
    if (viewport) {
      viewport.classList.toggle('constellation-mode-radial', mode === 'radial');
      viewport.classList.toggle('constellation-mode-tree', mode === 'tree');
    }

    this.render();
    setTimeout(() => this.fitAll(true), 60);
  },

  applyZoomDelta(multiplier) {
    if (typeof document === 'undefined') return;
    const viewport = document.getElementById('constellation-viewport');
    const rect = viewport ? viewport.getBoundingClientRect() : { width: 1000, height: 700 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldX = (centerX - this.pan.x) / this.zoom;
    const worldY = (centerY - this.pan.y) / this.zoom;

    const newZoom = Math.max(0.25, Math.min(2.5, this.zoom * multiplier));
    this.zoom = newZoom;
    this.pan.x = centerX - worldX * this.zoom;
    this.pan.y = centerY - worldY * this.zoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
  },

  updateZoomLabel() {
    if (typeof document === 'undefined') return;
    const label = document.getElementById('constellation-zoom-val');
    if (label) {
      label.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  },

  updateCanvasTransform() {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('constellation-canvas');
    if (canvas) {
      canvas.style.transform = `translate3d(${Math.round(this.pan.x)}px, ${Math.round(this.pan.y)}px, 0) scale(${this.zoom})`;
    }
  },

  resetView() {
    this.zoom = 1.0;
    this.pan = (this.currentMode === 'tree') ? { x: 120, y: 160 } : { x: 300, y: 200 };
    this.updateCanvasTransform();
    this.updateZoomLabel();
  },

  fitAll(smooth = false) {
    if (typeof document === 'undefined') return;
    const viewport = document.getElementById('constellation-viewport');
    if (!viewport || !this._graphData || !this._graphData.nodes || this._graphData.nodes.length === 0) {
      return;
    }

    // Ne cadrer QUE les nœuds actuellement visibles (non repliés et non masqués par les filtres)
    const visibleNodes = this._graphData.nodes.filter(n => !n._hidden && !n._filteredOut);
    if (visibleNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    visibleNodes.forEach(n => {
      const w = n.width || 220;
      const h = n.height || 64;
      if (n.x < minX) minX = n.x;
      if (n.x + w > maxX) maxX = n.x + w;
      if (n.y < minY) minY = n.y;
      if (n.y + h > maxY) maxY = n.y + h;
    });

    const vpRect = viewport.getBoundingClientRect();
    const vpW = Math.max(300, vpRect.width || 1000);
    const vpH = Math.max(300, vpRect.height || 700);

    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(100, maxY - minY);

    const padding = 60;
    const scaleX = (vpW - padding * 2) / contentW;
    const scaleY = (vpH - padding * 2) / contentH;
    let targetZoom = Math.min(scaleX, scaleY);
    targetZoom = Math.max(0.25, Math.min(1.35, targetZoom));

    const contentCenterX = minX + contentW / 2;
    const contentCenterY = minY + contentH / 2;

    this.zoom = targetZoom;
    this.pan.x = vpW / 2 - contentCenterX * targetZoom;
    this.pan.y = vpH / 2 - contentCenterY * targetZoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
  },

  centerOnNode(nodeId) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const viewport = document.getElementById('constellation-viewport');
    const vpRect = viewport ? viewport.getBoundingClientRect() : { width: 1000, height: 700 };

    this.zoom = Math.max(0.9, Math.min(1.2, this.zoom));
    const nodeCenterX = node.x + (node.width || 220) / 2;
    const nodeCenterY = node.y + (node.height || 64) / 2;

    this.pan.x = (vpRect.width / 2) - nodeCenterX * this.zoom;
    this.pan.y = (vpRect.height / 2) - nodeCenterY * this.zoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
  },

  toggleFoldNode(nodeId) {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    this.render();
  },

  /**
   * Construction du modèle de graphe unifié reliant toutes les entités
   */
  extractGraphData() {
    const storage = (typeof StorageManager !== 'undefined') ? StorageManager : null;
    const projects = (storage && typeof storage.getProjects === 'function') ? storage.getProjects() : [];
    const tasks = (storage && typeof storage.getTasks === 'function') ? storage.getTasks() : [];
    const events = (storage && typeof storage.getEvents === 'function') ? storage.getEvents() : [];
    const notes = (storage && typeof storage.getNotes === 'function') ? storage.getNotes() : [];
    const trash = (storage && typeof storage.getTrash === 'function') ? storage.getTrash() : [];

    const trashIds = new Set(trash.map(item => item && (item.originalId || item.id)));

    // Filtre des tâches actives non corbeille
    const filteredTasks = [];
    const walkTasks = (t, parentTaskId = null) => {
      if (!t || trashIds.has(t.id)) return;
      filteredTasks.push({ ...t, _parentTaskId: parentTaskId });
      if (Array.isArray(t.subtasks)) {
        t.subtasks.forEach(sub => walkTasks(sub, t.id));
      }
    };
    tasks.forEach(t => walkTasks(t, null));

    const nodes = [];
    const links = [];

    const isRadial = (this.currentMode === 'radial');
    const defaultNodeW = isRadial ? 44 : 220;
    const defaultNodeH = isRadial ? 44 : 62;
    const rootW = isRadial ? 56 : 220;
    const rootH = isRadial ? 56 : 64;

    // 1. Nœud Hub Central Racine
    const rootNode = {
      id: '__root__',
      type: 'root',
      title: 'Antigravité',
      subtitle: 'Espace unifié & Pôles',
      color: 'var(--accent, #38BDF8)',
      icon: 'orbit',
      width: rootW,
      height: rootH,
      parentId: null
    };
    nodes.push(rootNode);

    const projectById = new Map();
    projects.forEach(p => {
      if (p && p.id && !trashIds.has(p.id)) {
        projectById.set(p.id, p);
      }
    });

    // 2. Nœuds Projets (Toujours extraits pour garantir la stabilité spatiale)
    projectById.forEach(p => {
      const isChildProject = !!(p.parentProjectId && projectById.has(p.parentProjectId));
      const parentNodeId = isChildProject ? `proj_${p.parentProjectId}` : '__root__';

      const projTasks = filteredTasks.filter(t => t.projectId === p.id);
      const doneTasks = projTasks.filter(t => t.completed).length;
      const totalTasks = projTasks.length;
      const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      nodes.push({
        id: `proj_${p.id}`,
        originalId: p.id,
        type: 'project',
        title: p.title || 'Projet sans nom',
        subtitle: `${totalTasks} tâche${totalTasks > 1 ? 's' : ''} (${progressPct}%)`,
        color: p.color || '#6366f1',
        icon: 'folder',
        width: isRadial ? 44 : 230,
        height: isRadial ? 44 : 68,
        progress: progressPct,
        totalTasks,
        parentId: parentNodeId
      });

      links.push({
        source: parentNodeId,
        target: `proj_${p.id}`,
        color: p.color || '#6366f1'
      });
    });

    // 3. Pôle Tâches Personnelles (Libres) si applicable
    const freeTasks = filteredTasks.filter(t => !t.projectId && !t._parentTaskId);
    let hasFreeTasksHub = false;
    if (freeTasks.length > 0) {
      hasFreeTasksHub = true;
      nodes.push({
        id: '__hub_tasks_free__',
        type: 'hub',
        hubCategory: 'tasks',
        title: 'Tâches Libres',
        subtitle: `${freeTasks.length} tâche${freeTasks.length > 1 ? 's' : ''}`,
        color: '#38bdf8',
        icon: 'check-square',
        width: isRadial ? 44 : 200,
        height: isRadial ? 44 : 58,
        parentId: '__root__'
      });
      links.push({
        source: '__root__',
        target: '__hub_tasks_free__',
        color: '#38bdf8'
      });
    }

    // 4. Nœuds Tâches
    filteredTasks.forEach(t => {
      let parentNodeId = null;
      let branchColor = '#38bdf8';

      if (t._parentTaskId) {
        parentNodeId = `task_${t._parentTaskId}`;
      } else if (t.projectId && projectById.has(t.projectId)) {
        parentNodeId = `proj_${t.projectId}`;
        branchColor = projectById.get(t.projectId).color || '#38bdf8';
      } else if (hasFreeTasksHub) {
        parentNodeId = '__hub_tasks_free__';
      } else {
        parentNodeId = '__root__';
      }

      const isUrgent = (t.priority === 'urgent');
      const isCompleted = !!t.completed;

      nodes.push({
        id: `task_${t.id}`,
        originalId: t.id,
        type: 'task',
        title: t.title || 'Tâche sans titre',
        subtitle: t.deadline ? `Échéance : ${t.deadline.slice(0, 10)}` : (t.plannedDate ? `Prévu : ${t.plannedDate.slice(0, 10)}` : (isCompleted ? '✓ Achevée' : 'En cours')),
        color: branchColor,
        completed: isCompleted,
        urgent: isUrgent,
        priority: t.priority || 'normal',
        icon: isCompleted ? 'check-circle' : (isUrgent ? 'flame' : 'circle'),
        width: defaultNodeW,
        height: defaultNodeH,
        parentId: parentNodeId
      });

      links.push({
        source: parentNodeId,
        target: `task_${t.id}`,
        color: branchColor
      });
    });

    // 5. Pôle Agenda Libre si applicable
    const validEvents = events.filter(e => e && e.id && !trashIds.has(e.id));
    const freeEvents = validEvents.filter(e => !e.projectId && !e.taskId);
    let hasFreeEventsHub = false;
    if (freeEvents.length > 0) {
      hasFreeEventsHub = true;
      nodes.push({
        id: '__hub_events_free__',
        type: 'hub',
        hubCategory: 'events',
        title: 'Agenda Libre',
        subtitle: `${freeEvents.length} créneau${freeEvents.length > 1 ? 's' : ''}`,
        color: '#8b5cf6',
        icon: 'calendar',
        width: isRadial ? 44 : 200,
        height: isRadial ? 44 : 58,
        parentId: '__root__'
      });
      links.push({
        source: '__root__',
        target: '__hub_events_free__',
        color: '#8b5cf6'
      });
    }

    // 6. Nœuds Événements d'agenda
    validEvents.forEach(e => {
      let parentNodeId = null;
      let branchColor = e.color || '#8b5cf6';

      if (e.taskId && filteredTasks.some(t => t.id === e.taskId)) {
        parentNodeId = `task_${e.taskId}`;
      } else if (e.projectId && projectById.has(e.projectId)) {
        parentNodeId = `proj_${e.projectId}`;
        branchColor = projectById.get(e.projectId).color || branchColor;
      } else if (hasFreeEventsHub) {
        parentNodeId = '__hub_events_free__';
      } else {
        parentNodeId = '__root__';
      }

      const dateStr = (e.start && e.start.length >= 10) ? e.start.slice(0, 10) : '';
      const timeStr = (!e.isAllDay && e.start && e.start.includes('T')) ? e.start.split('T')[1].slice(0, 5) : (e.isAllDay ? 'Journée' : '');
      const timeBadge = (dateStr || timeStr) ? `${dateStr}${timeStr ? ' ' + timeStr : ''}` : 'Créneau';

      nodes.push({
        id: `event_${e.id}`,
        originalId: e.id,
        type: 'event',
        title: e.title || 'Créneau sans titre',
        subtitle: timeBadge,
        color: branchColor,
        icon: 'calendar',
        width: isRadial ? 44 : 210,
        height: isRadial ? 44 : 58,
        parentId: parentNodeId
      });

      links.push({
        source: parentNodeId,
        target: `event_${e.id}`,
        color: branchColor
      });
    });

    // 7. Pôles de Dossiers de Notes Libres
    const validNotes = notes.filter(n => n && n.id && !trashIds.has(n.id));
    const foldersMap = new Map();
    validNotes.forEach(n => {
      const hasProject = (n.projectId && projectById.has(n.projectId)) || (n.linkedProjectId && projectById.has(n.linkedProjectId));
      const hasEvent = n.linkedEventId && validEvents.some(e => e.id === n.linkedEventId);
      if (!hasProject && !hasEvent) {
        const folder = (n.folder && n.folder.trim()) || 'Général';
        foldersMap.set(folder, (foldersMap.get(folder) || 0) + 1);
      }
    });

    foldersMap.forEach((count, folderName) => {
      const hubId = `__hub_notes_folder_${folderName}__`;
      nodes.push({
        id: hubId,
        type: 'hub',
        hubCategory: 'notes',
        title: `Notes · ${folderName}`,
        subtitle: `${count} note${count > 1 ? 's' : ''}`,
        color: '#10b981',
        icon: 'folder',
        width: isRadial ? 44 : 200,
        height: isRadial ? 44 : 58,
        parentId: '__root__'
      });
      links.push({
        source: '__root__',
        target: hubId,
        color: '#10b981'
      });
    });

    // 8. Nœuds Notes
    validNotes.forEach(n => {
      let parentNodeId = null;
      let branchColor = '#10b981';

      const projId = n.projectId || n.linkedProjectId;
      if (n.linkedEventId && validEvents.some(e => e.id === n.linkedEventId)) {
        parentNodeId = `event_${n.linkedEventId}`;
      } else if (projId && projectById.has(projId)) {
        parentNodeId = `proj_${projId}`;
        branchColor = projectById.get(projId).color || branchColor;
      } else {
        const folder = (n.folder && n.folder.trim()) || 'Général';
        parentNodeId = `__hub_notes_folder_${folder}__`;
      }

      const cleanText = (n.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const snippet = cleanText.length > 40 ? cleanText.slice(0, 40) + '...' : (cleanText || 'Note vide');

      nodes.push({
        id: `note_${n.id}`,
        originalId: n.id,
        type: 'note',
        title: n.title || 'Note sans titre',
        subtitle: snippet,
        color: branchColor,
        folder: n.folder || 'Général',
        icon: 'file-text',
        width: isRadial ? 44 : 210,
        height: isRadial ? 44 : 58,
        parentId: parentNodeId
      });

      links.push({
        source: parentNodeId,
        target: `note_${n.id}`,
        color: branchColor
      });
    });

    // 9. Gestion du pliage / masquage récursif
    const hiddenNodeIds = new Set();
    const hideChildrenOf = (pId) => {
      nodes.forEach(n => {
        if (n.parentId === pId) {
          hiddenNodeIds.add(n.id);
          hideChildrenOf(n.id);
        }
      });
    };

    this.collapsedNodes.forEach(cId => hideChildrenOf(cId));

    // 10. Marquage de l'état filtré
    nodes.forEach(n => {
      n._hidden = hiddenNodeIds.has(n.id);
      n._hasChildren = nodes.some(child => child.parentId === n.id);
      n._childrenCount = nodes.filter(child => child.parentId === n.id).length;
      n._isCollapsed = this.collapsedNodes.has(n.id);
      n._filteredOut = this.isNodeFilteredOut(n);
    });

    const activeNodes = nodes.filter(n => !n._hidden);
    const activeNodeIdSet = new Set(activeNodes.map(n => n.id));
    const activeLinks = links.filter(l => activeNodeIdSet.has(l.source) && activeNodeIdSet.has(l.target));

    return {
      nodes: activeNodes,
      links: activeLinks,
      counts: {
        projects: projects.length,
        tasks: filteredTasks.length,
        events: validEvents.length,
        notes: validNotes.length
      }
    };
  },

  isNodeFilteredOut(node) {
    if (!node || node.id === '__root__') return false;

    if (node.type === 'project' && !this.filters.projects) return true;
    if (node.type === 'task') {
      if (!this.filters.tasks) return true;
      if (this.filters.hideDone && node.completed) return true;
    }
    if (node.type === 'event' && !this.filters.events) return true;
    if (node.type === 'note' && !this.filters.notes) return true;

    if (node.type === 'hub') {
      if (node.hubCategory === 'tasks' && !this.filters.tasks) return true;
      if (node.hubCategory === 'events' && !this.filters.events) return true;
      if (node.hubCategory === 'notes' && !this.filters.notes) return true;
    }

    return false;
  },

  /**
   * Calcul des coordonnées (X, Y) en mode Arbre Décisionnel Horizontal
   */
  computeTreeLayout(nodes, links) {
    if (!nodes || nodes.length === 0) return;

    const childrenByParent = new Map();
    nodes.forEach(n => {
      const p = n.parentId;
      if (!childrenByParent.has(p)) childrenByParent.set(p, []);
      childrenByParent.get(p).push(n);
    });

    const colWidth = 280;
    const rowMargin = 22;

    const computeSubtreeHeight = (node) => {
      const children = childrenByParent.get(node.id) || [];
      if (children.length === 0 || this.collapsedNodes.has(node.id)) {
        node._subtreeHeight = node.height || 64;
        return node._subtreeHeight;
      }
      let totalH = 0;
      children.forEach((c, idx) => {
        totalH += computeSubtreeHeight(c);
        if (idx > 0) totalH += rowMargin;
      });
      node._subtreeHeight = Math.max(node.height || 64, totalH);
      return node._subtreeHeight;
    };

    const root = nodes.find(n => n.id === '__root__');
    if (root) computeSubtreeHeight(root);

    const positionSubtree = (node, startX, startY) => {
      node.x = startX;
      const children = (this.collapsedNodes.has(node.id)) ? [] : (childrenByParent.get(node.id) || []);

      if (children.length === 0) {
        node.y = startY + ((node._subtreeHeight - (node.height || 64)) / 2);
        return;
      }

      let currentChildY = startY;
      children.forEach((c, idx) => {
        if (idx > 0) currentChildY += rowMargin;
        positionSubtree(c, startX + colWidth, currentChildY);
        currentChildY += c._subtreeHeight;
      });

      const firstChildY = children[0].y + (children[0].height || 64) / 2;
      const lastChildY = children[children.length - 1].y + (children[children.length - 1].height || 64) / 2;
      node.y = Math.round((firstChildY + lastChildY) / 2 - (node.height || 64) / 2);
    };

    if (root) {
      positionSubtree(root, 60, 40);
    }
  },

  /**
   * Calcul des coordonnées (X, Y) en mode Constellation Rayonnante
   * Dispose les orbes stellaires compacts en cercles orbitaux équilibrés,
   * avec répartition angulaire proportionnelle et relaxation anti-superposition (disposition aérienne).
   */
  computeRadialLayout(nodes, links) {
    if (!nodes || nodes.length === 0) return;

    const root = nodes.find(n => n.id === '__root__');
    const centerX = 1200;
    const centerY = 900;

    if (root) {
      root.x = centerX - Math.round((root.width || 56) / 2);
      root.y = centerY - Math.round((root.height || 56) / 2);
    }

    const childrenByParent = new Map();
    nodes.forEach(n => {
      const p = n.parentId;
      if (!childrenByParent.has(p)) childrenByParent.set(p, []);
      childrenByParent.get(p).push(n);
    });

    const level1 = (childrenByParent.get('__root__') || []).filter(n => !n._hidden);
    if (level1.length === 0) return;

    // Calcul récursif du poids (nombre de feuilles/descendants) de chaque branche
    const getBranchWeight = (nodeId) => {
      if (this.collapsedNodes.has(nodeId)) return 1;
      const children = (childrenByParent.get(nodeId) || []).filter(c => !c._hidden);
      if (children.length === 0) return 1;
      let count = 0;
      children.forEach(c => { count += getBranchWeight(c.id); });
      return Math.max(1, count);
    };

    let totalWeight = 0;
    level1.forEach(n => {
      n._weight = getBranchWeight(n.id);
      totalWeight += n._weight;
    });

    // Distribution angulaire proportionnelle au poids des branches
    let currentAngle = -Math.PI / 2; // Commencer au sommet (12h)
    const baseRadius1 = Math.max(340, Math.min(520, 260 + (level1.length * 28)));

    level1.forEach((node, i) => {
      const sectorSpan = (node._weight / Math.max(1, totalWeight)) * (2 * Math.PI);
      const nodeAngle = currentAngle + (sectorSpan / 2);
      const r1 = baseRadius1 + ((i % 2) * 45); // Léger décalage orbital pour aérer

      node.x = Math.round(centerX + Math.cos(nodeAngle) * r1 - ((node.width || 44) / 2));
      node.y = Math.round(centerY + Math.sin(nodeAngle) * r1 - ((node.height || 44) / 2));

      const parentCenterX = node.x + ((node.width || 44) / 2);
      const parentCenterY = node.y + ((node.height || 44) / 2);
      const radialHeading = Math.atan2(parentCenterY - centerY, parentCenterX - centerX);

      // Enfants de niveau 2 (Tâches, Notes, Événements gravitant autour de leur projet respectif)
      const level2 = (this.collapsedNodes.has(node.id)) ? [] : (childrenByParent.get(node.id) || []).filter(c => !c._hidden);
      if (level2.length > 0) {
        const countL2 = level2.length;
        // Gravitation planétaire locale autour de chaque projet
        level2.forEach((subNode, j) => {
          let subAngle;
          let r2;

          if (countL2 <= 4) {
            // Éventail tourné vers l'extérieur pour aérer le système
            const arcSpan = Math.PI * 0.9;
            const startArc = radialHeading - (arcSpan / 2);
            const stepArc = countL2 > 1 ? (arcSpan / (countL2 - 1)) : 0;
            subAngle = (countL2 === 1) ? radialHeading : (startArc + j * stepArc);
            r2 = 95 + ((j % 2) * 20);
          } else {
            // Orbite complète autour du projet avec cercles étagés
            const ringIndex = Math.floor(j / 6);
            const inRingIndex = j % 6;
            const ringCap = Math.min(6, countL2 - (ringIndex * 6));
            subAngle = radialHeading + ((inRingIndex / Math.max(1, ringCap)) * (2 * Math.PI));
            r2 = 100 + (ringIndex * 65);
          }

          subNode.x = Math.round(parentCenterX + Math.cos(subAngle) * r2 - ((subNode.width || 44) / 2));
          subNode.y = Math.round(parentCenterY + Math.sin(subAngle) * r2 - ((subNode.height || 44) / 2));

          const subCenterX = subNode.x + ((subNode.width || 44) / 2);
          const subCenterY = subNode.y + ((subNode.height || 44) / 2);
          const subHeading = Math.atan2(subCenterY - parentCenterY, subCenterX - parentCenterX);

          // Enfants de niveau 3 (Sous-tâches, notes attachées gravitant autour de leur tâche parente)
          const level3 = (this.collapsedNodes.has(subNode.id)) ? [] : (childrenByParent.get(subNode.id) || []).filter(c => !c._hidden);
          if (level3.length > 0) {
            const countL3 = level3.length;
            level3.forEach((leafNode, k) => {
              const leafArc = Math.PI * 0.8;
              const leafStart = subHeading - (leafArc / 2);
              const leafStep = countL3 > 1 ? (leafArc / (countL3 - 1)) : 0;
              const leafAngle = (countL3 === 1) ? subHeading : (leafStart + k * leafStep);
              const r3 = 70 + ((k % 2) * 18);

              leafNode.x = Math.round(subCenterX + Math.cos(leafAngle) * r3 - ((leafNode.width || 44) / 2));
              leafNode.y = Math.round(subCenterY + Math.sin(leafAngle) * r3 - ((leafNode.height || 44) / 2));
            });
          }
        });
      }

      currentAngle += sectorSpan;
    });

    // =========================================================================
    // PASSE DE RELAXATION PHYSIQUE ANTI-SUPERPOSITION (S'écarte & aérien)
    // =========================================================================
    // Garantit rigoureusement qu'aucun orbe ne touche ou ne chevauche un autre.
    const activeNodes = nodes.filter(n => !n._hidden);
    const minDistance = 78; // 44px de diamètre + 34px d'espace d'air minimum garanti
    const maxIter = activeNodes.length > 200 ? 15 : (activeNodes.length > 100 ? 25 : 40);

    for (let iter = 0; iter < maxIter; iter++) {
      let hadCollision = false;
      for (let a = 0; a < activeNodes.length; a++) {
        const nA = activeNodes[a];
        for (let b = a + 1; b < activeNodes.length; b++) {
          const nB = activeNodes[b];

          const centerAx = nA.x + ((nA.width || 44) / 2);
          const centerAy = nA.y + ((nA.height || 44) / 2);
          const centerBx = nB.x + ((nB.width || 44) / 2);
          const centerBy = nB.y + ((nB.height || 44) / 2);

          let dx = centerBx - centerAx;
          let dy = centerBy - centerAy;
          let dist = Math.hypot(dx, dy);

          // Si deux nœuds sont trop proches ou superposés
          if (dist < minDistance) {
            hadCollision = true;
            if (dist < 1) {
              // Si exactement au même endroit, générer une répulsion arbitraire
              dx = (Math.random() - 0.5) * 4;
              dy = (Math.random() - 0.5) * 4;
              dist = Math.hypot(dx, dy) || 1;
            }

            const overlap = (minDistance - dist) * 0.52;
            const nx = (dx / dist) * overlap;
            const ny = (dy / dist) * overlap;

            // La racine __root__ reste ancrée au centre céleste
            if (nA.id !== '__root__') {
              nA.x = Math.round(nA.x - nx);
              nA.y = Math.round(nA.y - ny);
            }
            if (nB.id !== '__root__') {
              nB.x = Math.round(nB.x + nx);
              nB.y = Math.round(nB.y + ny);
            }
          }
        }
      }
      if (!hadCollision) break; // Arrêt anticipé optimal dès que l'espacement est parfait
    }
  },

  /**
   * Rendu principal du graphe sur le canevas Whiteboard
   */
  render() {
    this.init();
    const data = this.extractGraphData();
    this._graphData = data;

    if (this.currentMode === 'tree') {
      this.computeTreeLayout(data.nodes, data.links);
    } else {
      this.computeRadialLayout(data.nodes, data.links);
    }

    this.renderSvgConnections(data.nodes, data.links);
    this.renderHtmlNodes(data.nodes);
    this.applyFiltersVisibility();
    this.applySearchHighlight();
    this.updateCanvasTransform();
    this.updateZoomLabel();

    if (!this._hasInitiallyFitted) {
      this._hasInitiallyFitted = true;
      setTimeout(() => this.fitAll(true), 60);
    }
  },

  /**
   * Application instantanée des filtres SANS recalculer les positions (Stabilité spatiale)
   */
  applyFiltersVisibility() {
    if (!this._graphData || !this._graphData.nodes) return;

    const visibleTypesCount = { projects: 0, tasks: 0, events: 0, notes: 0 };

    this._graphData.nodes.forEach(n => {
      n._filteredOut = this.isNodeFilteredOut(n);
      const el = document.getElementById(`cnode-${n.id}`);
      if (el) {
        el.classList.toggle('is-filter-hidden', !!n._filteredOut);
      }
      if (!n._filteredOut && !n._hidden) {
        if (n.type === 'project') visibleTypesCount.projects++;
        else if (n.type === 'task') visibleTypesCount.tasks++;
        else if (n.type === 'event') visibleTypesCount.events++;
        else if (n.type === 'note') visibleTypesCount.notes++;
      }
    });

    const paths = document.querySelectorAll('.constellation-path');
    const nodeMap = new Map();
    this._graphData.nodes.forEach(n => nodeMap.set(n.id, n));

    paths.forEach(p => {
      const src = nodeMap.get(p.dataset.source);
      const tgt = nodeMap.get(p.dataset.target);
      const isHidden = (src && src._filteredOut) || (tgt && tgt._filteredOut);
      p.classList.toggle('is-filter-hidden', !!isHidden);
    });

    this.updateStatsBadge(visibleTypesCount);
  },

  /**
   * Tracé des courbes de connexion de Bézier cubiques dans la couche SVG
   */
  renderSvgConnections(nodes, links) {
    const svg = document.getElementById('constellation-svg');
    if (!svg) return;

    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    let pathsHtml = '';
    const isTree = (this.currentMode === 'tree');

    links.forEach(link => {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (!src || !tgt) return;

      let x1, y1, x2, y2, d;

      if (isTree) {
        // En arbre horizontal : départ à droite du parent, arrivée à gauche de l'enfant
        x1 = src.x + (src.width || 220);
        y1 = src.y + ((src.height || 64) / 2);
        x2 = tgt.x;
        y2 = tgt.y + ((tgt.height || 64) / 2);
        const dx = Math.max(40, (x2 - x1) * 0.5);
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      } else {
        // En constellation rayonnante : départ au centre du parent, arrivée au centre de l'enfant
        x1 = src.x + ((src.width || 44) / 2);
        y1 = src.y + ((src.height || 44) / 2);
        x2 = tgt.x + ((tgt.width || 44) / 2);
        y2 = tgt.y + ((tgt.height || 44) / 2);
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
      }

      const strokeColor = link.color || 'var(--accent, #38BDF8)';
      const isFiltered = (src._filteredOut || tgt._filteredOut);
      pathsHtml += `
        <path class="constellation-path ${isFiltered ? 'is-filter-hidden' : ''}"
              data-source="${src.id}"
              data-target="${tgt.id}"
              d="${d}"
              stroke="${strokeColor}"
              fill="none" />
      `;
    });

    svg.innerHTML = pathsHtml;
    this.updateSvgCanvasSize();
  },

  updateSvgCanvasSize() {
    const svg = document.getElementById('constellation-svg');
    if (!svg || !this._graphData || !this._graphData.nodes) return;

    let maxX = 2600;
    let maxY = 2200;
    this._graphData.nodes.forEach(n => {
      if (n.x + (n.width || 200) + 200 > maxX) maxX = n.x + (n.width || 200) + 200;
      if (n.y + (n.height || 60) + 200 > maxY) maxY = n.y + (n.height || 60) + 200;
    });

    svg.setAttribute('width', maxX);
    svg.setAttribute('height', maxY);
  },

  /**
   * Injection des cartes HTML et orbes de chaque nœud
   */
  renderHtmlNodes(nodes) {
    const container = document.getElementById('constellation-nodes-container');
    if (!container) return;

    const isRadial = (this.currentMode === 'radial');
    let html = '';

    nodes.forEach(n => {
      const color = n.color || '#38bdf8';
      const isRoot = (n.type === 'root');
      const isHub = (n.type === 'hub');
      const isProject = (n.type === 'project');
      const isTask = (n.type === 'task');
      const isEvent = (n.type === 'event');
      const isNote = (n.type === 'note');

      let iconSvg = '';
      if (isRoot) {
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14l5-6 6 3 7-7"/><path d="M8 8l3 11 5 1-2-9"/><circle cx="3" cy="14" r="2" fill="currentColor"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="14" cy="11" r="2" fill="currentColor"/><circle cx="21" cy="4" r="2" fill="currentColor"/><circle cx="11" cy="19" r="2" fill="currentColor"/><circle cx="16" cy="20" r="2" fill="currentColor"/></svg>`;
      } else if (isProject) {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      } else if (isTask) {
        if (n.completed) {
          iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (n.urgent) {
          iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
        } else {
          iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`;
        }
      } else if (isEvent) {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      } else if (isNote) {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
      } else {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>`;
      }

      // Pastille de progression ou badge
      let badgeHtml = '';
      if (isProject && n.totalTasks > 0) {
        badgeHtml = `<span class="constellation-node-pill" style="color: ${color}; background-color: ${color}1c; border-color: ${color}40;">${n.progress}%</span>`;
      } else if (isTask && n.urgent) {
        badgeHtml = `<span class="constellation-node-pill pill-urgent">Urgent</span>`;
      } else if (isTask && n.completed) {
        badgeHtml = `<span class="constellation-node-pill pill-done">Fait</span>`;
      } else if (isNote && n.folder) {
        badgeHtml = `<span class="constellation-node-pill">${this.escapeHtml(n.folder)}</span>`;
      }

      // Bouton de dépliage / repliage (+) / (-)
      let foldBtnHtml = '';
      if (n._hasChildren && !isRoot) {
        const symbol = n._isCollapsed ? `+${n._childrenCount}` : '−';
        const foldTitle = n._isCollapsed ? 'Déplier la branche' : 'Replier la branche';
        foldBtnHtml = `<button type="button" class="constellation-fold-btn ${n._isCollapsed ? 'collapsed' : ''}" data-node-id="${n.id}" title="${foldTitle}">${symbol}</button>`;
      }

      const isFiltered = !!n._filteredOut;

      html += `
        <div class="constellation-node node-type-${n.type} ${n.completed ? 'is-completed' : ''} ${isFiltered ? 'is-filter-hidden' : ''}"
             id="cnode-${n.id}"
             data-id="${n.id}"
             data-type="${n.type}"
             data-original-id="${n.originalId || ''}"
             data-search-target="${this.escapeHtml((n.title + ' ' + (n.subtitle || '')).toLowerCase())}"
             title="${this.escapeHtml(n.title)}"
             style="transform: translate3d(${n.x}px, ${n.y}px, 0); width: ${n.width}px; ${isRadial ? `border-color: ${color};` : `border-left-color: ${color};`}">
          <div class="constellation-node-main">
            <span class="constellation-node-icon" style="color: ${color}; ${isRadial ? '' : `background-color: ${color}18;`}">
              ${iconSvg}
            </span>
            <div class="constellation-node-content">
              <div class="constellation-node-title" title="${this.escapeHtml(n.title)}">${this.escapeHtml(n.title)}</div>
              ${n.subtitle ? `<div class="constellation-node-subtitle">${this.escapeHtml(n.subtitle)}</div>` : ''}
            </div>
            ${badgeHtml}
          </div>
          ${foldBtnHtml}
        </div>
      `;
    });

    container.innerHTML = html;
    this.bindNodeInteractions();
  },

  /**
   * Clics passerelles, clic droit contextuel et survol interactif
   */
  bindNodeInteractions() {
    const container = document.getElementById('constellation-nodes-container');
    if (!container) return;
    if (container._hasBoundInteractions) return;
    container._hasBoundInteractions = true;

    let activeHoveredNodeId = null;
    let lastActionTime = 0;

    const executeNodeAction = (nodeEl, isFoldBtn) => {
      const now = Date.now();
      if (now - lastActionTime < 200) return; // Anti-double déclenchement
      lastActionTime = now;

      if (isFoldBtn) {
        const nodeId = nodeEl.dataset.nodeId || (nodeEl.closest && nodeEl.closest('.constellation-node')?.dataset.id);
        if (nodeId) this.toggleFoldNode(nodeId);
        return;
      }

      const targetEl = (nodeEl.closest) ? nodeEl.closest('.constellation-node') : nodeEl;
      if (!targetEl || !targetEl.dataset || !targetEl.dataset.id) return;
      this.handleNodeClick(targetEl.dataset.id);
    };

    // 1. Clic gauche : ouverture directe de la ressource ou repliage
    container.onclick = (e) => {
      if (e.button !== 0) return;
      const foldBtn = e.target.closest && e.target.closest('.constellation-fold-btn');
      if (foldBtn) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        executeNodeAction(foldBtn, true);
        return;
      }

      const nodeEl = e.target.closest && e.target.closest('.constellation-node');
      if (!nodeEl) return;

      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      executeNodeAction(nodeEl, false);
    };

    // 2. Support pointerup pour sécuriser le clic même sur les petites bulles
    if (typeof container.addEventListener === 'function') {
      container.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        const foldBtn = e.target.closest && e.target.closest('.constellation-fold-btn');
        if (foldBtn) {
          executeNodeAction(foldBtn, true);
          return;
        }

        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (nodeEl) {
          executeNodeAction(nodeEl, false);
        }
      });
    }

    // 3. Clic droit : Menu contextuel riche avec renvoi direct vers l'onglet
    container.oncontextmenu = (e) => {
      const nodeEl = e.target.closest && e.target.closest('.constellation-node');
      if (!nodeEl) return;

      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      this.showContextMenu(nodeEl.dataset.id, e.clientX, e.clientY);
    };

    // 4. Survol : chemin connecté + Carte d'informations au survol SANS clignotement
    if (typeof container.addEventListener === 'function') {
      container.addEventListener('mouseover', (e) => {
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (!nodeEl) return;

        const nodeId = nodeEl.dataset.id;
        // SI ON EST DÉJÀ SUR CE NŒUD : NE RIEN RECALCULER (Anti-clignotement absolu)
        if (nodeId === activeHoveredNodeId) return;

        activeHoveredNodeId = nodeId;
        this.highlightConnectedPath(nodeId);
        this.showHoverCard(nodeId, nodeEl);
      });

      container.addEventListener('mouseout', (e) => {
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (!nodeEl) return;

        // Si le curseur bouge vers un élément enfant interne du même nœud (icône, texte, svg), ignorer
        if (e.relatedTarget && nodeEl.contains && nodeEl.contains(e.relatedTarget)) {
          return;
        }

        activeHoveredNodeId = null;
        this.clearPathHighlight();
        this.hideHoverCard();
      });
    }
  },

  handleNodeClick(nodeId) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.hideHoverCard();
    this.hideContextMenu();

    const type = node.type;
    const originalId = node.originalId;

    if (type === 'project' && originalId) {
      if (typeof ProjectsManager !== 'undefined' && typeof ProjectsManager.openProjectDetailModal === 'function') {
        ProjectsManager.openProjectDetailModal(originalId);
      } else if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('projects');
      }
    } else if (type === 'task' && originalId) {
      if (typeof TasksManager !== 'undefined' && typeof TasksManager.openTaskModal === 'function') {
        TasksManager.openTaskModal(originalId);
      } else if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('tasks');
      }
    } else if (type === 'event' && originalId) {
      if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.openEventModal === 'function') {
        AgendaManager.openEventModal(originalId);
      } else if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('agenda');
      }
    } else if (type === 'note' && originalId) {
      if (typeof NotesManager !== 'undefined' && typeof NotesManager.selectNote === 'function') {
        NotesManager.selectNote(originalId);
      }
      if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('notes');
      }
    } else if (type === 'hub') {
      if (node.hubCategory === 'tasks' && typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('tasks');
      } else if (node.hubCategory === 'events' && typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('agenda');
      } else if (node.hubCategory === 'notes' && typeof App !== 'undefined' && typeof App.navigate === 'function') {
        App.navigate('notes');
      } else if (node._hasChildren) {
        this.toggleFoldNode(node.id);
      }
    } else if (type === 'root') {
      this.fitAll(true);
    } else if (node._hasChildren) {
      this.toggleFoldNode(node.id);
    }
  },

  /**
   * Affichage du menu contextuel (clic droit sur un nœud)
   */
  showContextMenu(nodeId, clientX, clientY) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.hideHoverCard();

    const menu = document.getElementById('constellation-context-menu');
    const headerEl = document.getElementById('constellation-context-header');
    const itemsEl = document.getElementById('constellation-context-items');
    if (!menu || !headerEl || !itemsEl) return;

    const color = node.color || '#38bdf8';
    let typeLabel = 'Élément';
    if (node.type === 'project') typeLabel = 'Projet';
    else if (node.type === 'task') typeLabel = 'Tâche';
    else if (node.type === 'event') typeLabel = 'Créneau Agenda';
    else if (node.type === 'note') typeLabel = 'Note';
    else if (node.type === 'hub') typeLabel = 'Pôle de regroupement';
    else if (node.type === 'root') typeLabel = 'Noyau racine';

    headerEl.innerHTML = `
      <div class="context-menu-header-icon" style="color: ${color}; background-color: ${color}20;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>
      </div>
      <div class="context-menu-header-text">
        <div class="context-menu-header-title">${this.escapeHtml(node.title)}</div>
        <div class="context-menu-header-type">${typeLabel}</div>
      </div>
    `;

    let itemsHtml = '';

    // Actions spécifiques selon le type
    if (node.type === 'task' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof TasksManager !== 'undefined') TasksManager.openTaskModal('${node.originalId}');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>
          <span>Ouvrir la fiche de la tâche</span>
        </div>
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof App !== 'undefined') App.navigate('tasks');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
          <span>Aller à l'onglet Tâches</span>
        </div>
        <div class="context-menu-item" onclick="ConstellationManager.toggleTaskCompleteFromMenu('${node.originalId}');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span>${node.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}</span>
        </div>
      `;
    } else if (node.type === 'project' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof ProjectsManager !== 'undefined') ProjectsManager.openProjectDetailModal('${node.originalId}');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
          <span>Ouvrir les détails du projet</span>
        </div>
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof App !== 'undefined') App.navigate('projects');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg></span>
          <span>Aller à l'onglet Projets</span>
        </div>
      `;
    } else if (node.type === 'event' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof AgendaManager !== 'undefined') AgendaManager.openEventModal('${node.originalId}');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <span>Ouvrir le créneau dans l'agenda</span>
        </div>
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof App !== 'undefined') App.navigate('agenda');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg></span>
          <span>Aller à l'onglet Agenda</span>
        </div>
      `;
    } else if (node.type === 'note' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof NotesManager !== 'undefined') NotesManager.selectNote('${node.originalId}'); if (typeof App !== 'undefined') App.navigate('notes');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
          <span>Ouvrir dans l'éditeur de notes</span>
        </div>
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof App !== 'undefined') App.navigate('notes');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
          <span>Aller à l'onglet Notes</span>
        </div>
      `;
    }

    if (node._hasChildren && node.id !== '__root__') {
      itemsHtml += `
        <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); ConstellationManager.toggleFoldNode('${node.id}');">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg></span>
          <span>${node._isCollapsed ? 'Déplier la branche' : 'Replier la branche'}</span>
        </div>
      `;
    }

    // Action universelle : cadrer sur cet élément
    itemsHtml += `
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); ConstellationManager.centerOnNode('${node.id}');">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></span>
        <span>Cadrer sur cet élément</span>
      </div>
    `;

    itemsEl.innerHTML = itemsHtml;
    menu.style.display = 'block';

    const menuRect = menu.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;

    if (posX + menuRect.width > window.innerWidth - 12) {
      posX = window.innerWidth - menuRect.width - 12;
    }
    if (posY + menuRect.height > window.innerHeight - 12) {
      posY = window.innerHeight - menuRect.height - 12;
    }
    if (posX < 8) posX = 8;
    if (posY < 8) posY = 8;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  },

  /**
   * Menu contextuel sur le canevas vierge (Espace Whiteboard)
   */
  showCanvasContextMenu(clientX, clientY) {
    this.hideHoverCard();
    const menu = document.getElementById('constellation-context-menu');
    const headerEl = document.getElementById('constellation-context-header');
    const itemsEl = document.getElementById('constellation-context-items');
    if (!menu || !headerEl || !itemsEl) return;

    headerEl.innerHTML = `
      <div class="context-menu-header-icon" style="color: var(--accent, #38bdf8); background-color: var(--accent-light, rgba(56,189,248,0.18));">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17L12 5L19 15Z"/><circle cx="12" cy="5" r="2.5" fill="currentColor"/><circle cx="5" cy="17" r="2" fill="currentColor"/><circle cx="19" cy="15" r="2" fill="currentColor"/></svg>
      </div>
      <div class="context-menu-header-text">
        <div class="context-menu-header-title">Espace Constellation</div>
        <div class="context-menu-header-type">Tableau panoramique</div>
      </div>
    `;

    itemsEl.innerHTML = `
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof TasksManager !== 'undefined' && typeof TasksManager.openTaskModal === 'function') TasksManager.openTaskModal();">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
        <span>Nouvelle tâche</span>
      </div>
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof ProjectsManager !== 'undefined' && typeof ProjectsManager.openProjectModal === 'function') ProjectsManager.openProjectModal();">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
        <span>Nouveau projet</span>
      </div>
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.openEventModal === 'function') AgendaManager.openEventModal();">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
        <span>Nouveau créneau agenda</span>
      </div>
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); if (typeof NotesManager !== 'undefined' && typeof NotesManager.createNote === 'function') NotesManager.createNote(); if (typeof App !== 'undefined') App.navigate('notes');">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
        <span>Nouvelle note</span>
      </div>
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); ConstellationManager.fitAll(true);">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></span>
        <span>Cadrer tout</span>
      </div>
      <div class="context-menu-item" onclick="ConstellationManager.hideContextMenu(); ConstellationManager.resetView();">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></span>
        <span>Réinitialiser la vue</span>
      </div>
    `;

    menu.style.display = 'block';

    const menuRect = menu.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;

    if (posX + menuRect.width > window.innerWidth - 12) {
      posX = window.innerWidth - menuRect.width - 12;
    }
    if (posY + menuRect.height > window.innerHeight - 12) {
      posY = window.innerHeight - menuRect.height - 12;
    }
    if (posX < 8) posX = 8;
    if (posY < 8) posY = 8;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  },

  hideContextMenu() {
    if (typeof document === 'undefined') return;
    const menu = document.getElementById('constellation-context-menu');
    if (menu) menu.style.display = 'none';
  },

  toggleTaskCompleteFromMenu(taskId) {
    this.hideContextMenu();
    if (typeof TasksManager !== 'undefined' && typeof TasksManager.toggleTaskComplete === 'function') {
      TasksManager.toggleTaskComplete(taskId);
      this.render();
    } else if (typeof StorageManager !== 'undefined') {
      const tasks = StorageManager.getTasks ? StorageManager.getTasks() : [];
      const updateRecursive = (list) => {
        for (const t of list) {
          if (t.id === taskId) {
            t.completed = !t.completed;
            return true;
          }
          if (Array.isArray(t.subtasks) && updateRecursive(t.subtasks)) return true;
        }
        return false;
      };
      if (updateRecursive(tasks) && StorageManager.saveTasks) {
        StorageManager.saveTasks(tasks);
        this.render();
      }
    }
  },

  /**
   * Affichage de la carte d'aperçu flottante au survol (ancrée de façon stable au-dessus du nœud)
   */
  showHoverCard(nodeId, nodeElOrClientX, clientY) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const card = document.getElementById('constellation-hover-card');
    if (!card) return;

    const color = node.color || '#38bdf8';
    let typeLabel = 'Élément';
    if (node.type === 'project') typeLabel = 'Projet';
    else if (node.type === 'task') typeLabel = 'Tâche';
    else if (node.type === 'event') typeLabel = 'Créneau Agenda';
    else if (node.type === 'note') typeLabel = 'Note';
    else if (node.type === 'hub') typeLabel = 'Pôle';
    else if (node.type === 'root') typeLabel = 'Antigravité';

    let extraBodyHtml = '';
    if (node.type === 'project' && typeof node.progress === 'number') {
      extraBodyHtml = `
        <div class="constellation-hover-progress">
          <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:3px;">
            <span>Progression</span>
            <span style="font-weight:600; color:${color};">${node.progress}%</span>
          </div>
          <div class="constellation-hover-progress-bar">
            <div class="constellation-hover-progress-fill" style="width:${node.progress}%; background-color:${color};"></div>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="constellation-hover-header">
        <span class="constellation-hover-icon" style="color: ${color}; background-color: ${color}20;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>
        </span>
        <div class="constellation-hover-title-group">
          <span class="constellation-hover-type">${typeLabel}</span>
          <div class="constellation-hover-title">${this.escapeHtml(node.title)}</div>
        </div>
      </div>
      <div class="constellation-hover-body">
        ${node.subtitle ? `<div>${this.escapeHtml(node.subtitle)}</div>` : ''}
        ${extraBodyHtml}
      </div>
      <div class="constellation-hover-footer">
        <span>Clic gauche : Ouvrir</span>
        <span>Clic droit : Options</span>
      </div>
    `;

    card.style.display = 'block';

    // Positionnement fixe et stable au-dessus du nœud survolé
    if (nodeElOrClientX && typeof nodeElOrClientX.getBoundingClientRect === 'function') {
      const nodeRect = nodeElOrClientX.getBoundingClientRect();
      const cardW = 270;
      const cardH = 110;

      let posX = nodeRect.left + (nodeRect.width / 2) - (cardW / 2);
      let posY = nodeRect.top - cardH - 10;

      // Si ça dépasse en haut de l'écran, positionner en dessous
      if (posY < 65) {
        posY = nodeRect.bottom + 10;
      }
      // Sécurité bords d'écran
      if (posX < 12) posX = 12;
      if (typeof window !== 'undefined' && posX + cardW > window.innerWidth - 12) {
        posX = window.innerWidth - cardW - 12;
      }

      card.style.left = `${Math.round(posX)}px`;
      card.style.top = `${Math.round(posY)}px`;
    } else if (typeof nodeElOrClientX === 'number' && typeof clientY === 'number') {
      this.updateHoverCardPosition(nodeElOrClientX, clientY);
    }
  },

  updateHoverCardPosition(clientX, clientY) {
    const card = document.getElementById('constellation-hover-card');
    if (!card || card.style.display === 'none') return;

    let posX = clientX + 14;
    let posY = clientY + 14;
    const cardW = 270;
    const cardH = 110;

    if (typeof window !== 'undefined') {
      if (posX + cardW > window.innerWidth - 12) posX = clientX - cardW - 12;
      if (posY + cardH > window.innerHeight - 12) posY = clientY - cardH - 12;
    }
    if (posX < 8) posX = 8;
    if (posY < 8) posY = 8;

    card.style.left = `${Math.round(posX)}px`;
    card.style.top = `${Math.round(posY)}px`;
  },

  hideHoverCard() {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('constellation-hover-card');
    if (card) card.style.display = 'none';
  },

  highlightConnectedPath(hoveredId) {
    if (!hoveredId || !this._graphData) return;
    const paths = document.querySelectorAll('.constellation-path');
    const nodes = document.querySelectorAll('.constellation-node');

    const connectedIds = new Set([hoveredId]);

    // Remonter les ancêtres
    let curr = this._graphData.nodes.find(n => n.id === hoveredId);
    while (curr && curr.parentId) {
      connectedIds.add(curr.parentId);
      curr = this._graphData.nodes.find(n => n.id === curr.parentId);
    }

    // Descendre sur les enfants
    const addDescendants = (pId) => {
      this._graphData.nodes.forEach(n => {
        if (n.parentId === pId && !connectedIds.has(n.id)) {
          connectedIds.add(n.id);
          addDescendants(n.id);
        }
      });
    };
    addDescendants(hoveredId);

    nodes.forEach(n => {
      const isConn = connectedIds.has(n.dataset.id);
      n.classList.toggle('path-active', isConn);
      n.classList.toggle('path-dimmed', !isConn);
    });

    paths.forEach(p => {
      const isConn = connectedIds.has(p.dataset.source) && connectedIds.has(p.dataset.target);
      p.classList.toggle('path-active', isConn);
      p.classList.toggle('path-dimmed', !isConn);
    });
  },

  clearPathHighlight() {
    const paths = document.querySelectorAll('.constellation-path');
    const nodes = document.querySelectorAll('.constellation-node');
    nodes.forEach(n => {
      n.classList.remove('path-active');
      n.classList.remove('path-dimmed');
    });
    paths.forEach(p => {
      p.classList.remove('path-active');
      p.classList.remove('path-dimmed');
    });
  },

  applySearchHighlight() {
    const q = this.searchQuery;
    const nodes = document.querySelectorAll('.constellation-node');
    if (!q) {
      nodes.forEach(n => {
        n.classList.remove('search-match');
        n.classList.remove('search-dimmed');
      });
      return;
    }

    let firstMatch = null;
    nodes.forEach(n => {
      const text = n.dataset.searchTarget || '';
      const isMatch = text.includes(q);
      n.classList.toggle('search-match', isMatch);
      n.classList.toggle('search-dimmed', !isMatch);
      if (isMatch && !firstMatch) firstMatch = n;
    });

    if (firstMatch && this._graphData) {
      const matchNode = this._graphData.nodes.find(n => n.id === firstMatch.dataset.id);
      if (matchNode) {
        this.centerOnNode(matchNode.id);
      }
    }
  },

  updateStatsBadge(counts) {
    const badge = document.getElementById('constellation-stats-badge');
    if (badge && counts) {
      badge.textContent = `${counts.projects} projet${counts.projects > 1 ? 's' : ''} · ${counts.tasks} tâche${counts.tasks > 1 ? 's' : ''} · ${counts.events} créneau${counts.events > 1 ? 's' : ''} · ${counts.notes} note${counts.notes > 1 ? 's' : ''}`;
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

if (typeof window !== 'undefined') {
  window.ConstellationManager = ConstellationManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConstellationManager;
}
