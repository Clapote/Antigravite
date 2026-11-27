/**
 * Antigravité - Module Constellation & Mind Map Interactive
 * Vue panoramique unifiée haute performance (Architecture virtualisée + Canvas 2D + Hash Spatial O(N)).
 * Supporte des milliers d'éléments sur plusieurs années à 60 FPS constants :
 * - Arbre décisionnel horizontal & Constellation rayonnante avec gravitation orbitale
 * - Exclusion par défaut des créneaux d'agenda et des projets archivés (opt-in instantané)
 * - Liens tracés sur couche Canvas 2D HD avec frustum culling
 * - Virtualisation DOM incrémentale des nœuds visibles & LOD Canvas au dézoom
 * - Relaxation anti-superposition par grille spatiale O(N)
 */

const CONSTELLATION_MAX_HTML_NODES = 160;
const CONSTELLATION_LOD_ZOOM_THRESHOLD = 0.45;
const CONSTELLATION_VIEWPORT_BUFFER = 200;
const CONSTELLATION_CELL_SIZE = 78;

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
    events: false, // Désactivé par défaut pour fluidifier et désencombrer la Constellation
    notes: true,
    hideDone: false,
    crossLinks: false
  },
  searchQuery: '',
  _initialized: false,
  _hasInitiallyFitted: false,
  _graphData: null,

  // Caches & état de rendu haute performance
  _nodeById: new Map(),
  _childrenByParent: new Map(),
  _edges: [],
  _mountedNodes: new Map(),
  _canvasLodNodes: [],
  _highlightedIds: null,
  _searchMatchIds: null,
  _hoveredCanvasNodeId: null,
  _rafId: null,
  _vpMetrics: { left: 0, top: 0, width: 1000, height: 700, dpr: 1 },
  _vpMetricsDirty: true,
  _cachedAccentColor: '#38BDF8',

  init() {
    if (this._initialized || typeof document === 'undefined') return;
    this._initialized = true;

    this.bindToolbarEvents();
    this.bindViewportPanZoom();
    this.bindGlobalEvents();
    this.bindResizeEvents();
    this.updateViewportMetrics(true);
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

    // 2. Filtres rapides par type
    const filterPills = [
      { id: 'filter-constellation-projects', key: 'projects' },
      { id: 'filter-constellation-tasks', key: 'tasks' },
      { id: 'filter-constellation-events', key: 'events' },
      { id: 'filter-constellation-notes', key: 'notes' },
      { id: 'filter-constellation-hide-done', key: 'hideDone' },
      { id: 'filter-constellation-crosslinks', key: 'crossLinks' }
    ];

    filterPills.forEach(({ id, key }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', !!this.filters[key]);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.filters[key] = !this.filters[key];
          btn.classList.toggle('active', this.filters[key]);
          if (key === 'events' || key === 'hideDone' || key === 'crossLinks') {
            // Reconstruire le graphe pour ne jamais allouer/calculer les éléments masqués inutilement
            this.render();
          } else {
            this.applyFiltersVisibility();
          }
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

    // 4. Contrôles de zoom, repliage global et cadrage
    const btnZoomIn = document.getElementById('btn-constellation-zoom-in');
    const btnZoomOut = document.getElementById('btn-constellation-zoom-out');
    const btnFitAll = document.getElementById('btn-constellation-fit-all');
    const btnResetView = document.getElementById('btn-constellation-reset-view');
    const btnToggleCollapse = document.getElementById('btn-constellation-toggle-collapse');

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
    if (btnToggleCollapse) {
      btnToggleCollapse.addEventListener('click', () => this.toggleCollapseAll());
    }
  },

  bindViewportPanZoom() {
    const viewport = document.getElementById('constellation-viewport');
    if (!viewport || typeof viewport.addEventListener !== 'function') return;

    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let initialPanX = 0;
    let initialPanY = 0;
    let hasMoved = false;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.segmented-group') || e.target.closest('#constellation-context-menu')) {
        return;
      }

      if (e.target.closest('.constellation-node')) {
        return;
      }

      this.hideContextMenu();
      this.updateViewportMetrics();
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
      if (pointerDown) {
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
          this.scheduleViewportDraw();
        }
        return;
      }

      // Survol des orbes rendus en Canvas LOD (hors DOM HTML)
      if (!e.target.closest('.constellation-node') && this._canvasLodNodes.length > 0) {
        const hitNode = this.pickLodNodeAtPoint(e.clientX, e.clientY);
        if (hitNode) {
          viewport.style.cursor = 'pointer';
          if (this._hoveredCanvasNodeId !== hitNode.id) {
            this._hoveredCanvasNodeId = hitNode.id;
            this.highlightConnectedPath(hitNode.id);
            this.showHoverCard(hitNode.id, e.clientX, e.clientY);
          } else {
            this.updateHoverCardPosition(e.clientX, e.clientY);
          }
          return;
        }
      }

      if (this._hoveredCanvasNodeId) {
        this._hoveredCanvasNodeId = null;
        viewport.style.cursor = '';
        this.clearPathHighlight();
        this.hideHoverCard();
      }
    });

    const endDrag = (e) => {
      if (!pointerDown) return;
      pointerDown = false;
      viewport.classList.remove('is-dragging');
      if (viewport.releasePointerCapture) {
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      // Si clic gauche sans déplacement sur un orbe Canvas LOD, ouvrir la fiche correspondante
      if (!hasMoved && this._canvasLodNodes.length > 0 && !e.target.closest('.constellation-node')) {
        const hitNode = this.pickLodNodeAtPoint(e.clientX, e.clientY);
        if (hitNode) {
          this.handleNodeClick(hitNode.id);
        }
      }
    };

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // Zoom fluide à la molette orienté vers le curseur
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.hideContextMenu();
      this.hideHoverCard();

      const m = this.updateViewportMetrics();
      const mouseX = e.clientX - m.left;
      const mouseY = e.clientY - m.top;

      const worldX = (mouseX - this.pan.x) / this.zoom;
      const worldY = (mouseY - this.pan.y) / this.zoom;

      const factor = (e.deltaY < 0) ? 1.12 : 0.88;
      const newZoom = Math.max(0.05, Math.min(2.5, this.zoom * factor));

      if (newZoom !== this.zoom) {
        this.zoom = newZoom;
        this.pan.x = mouseX - worldX * this.zoom;
        this.pan.y = mouseY - worldY * this.zoom;
        this.updateCanvasTransform();
        this.updateZoomLabel();
        this.scheduleViewportDraw();
      }
    }, { passive: false });

    // Menu contextuel au clic droit sur un orbe LOD ou l'espace vide du canevas
    viewport.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.constellation-node') || e.target.closest('.constellation-toolbar') || e.target.closest('#constellation-context-menu')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      if (this._canvasLodNodes.length > 0) {
        const hitNode = this.pickLodNodeAtPoint(e.clientX, e.clientY);
        if (hitNode) {
          this.showContextMenu(hitNode.id, e.clientX, e.clientY);
          return;
        }
      }
      this.showCanvasContextMenu(e.clientX, e.clientY);
    });
  },

  bindGlobalEvents() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

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

      if (typeof App !== 'undefined' && App.currentScreen === 'constellation') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
        if (typeof document.querySelector === 'function' && document.querySelector('.modal-overlay.active')) return;

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
    if (typeof ResizeObserver !== 'undefined' && typeof document !== 'undefined') {
      const viewport = document.getElementById('constellation-viewport');
      if (viewport && !this._resizeObserver) {
        this._resizeObserver = new ResizeObserver(() => {
          this._vpMetricsDirty = true;
          if (typeof App !== 'undefined' && App.currentScreen === 'constellation') {
            this.updateViewportMetrics(true);
            this.updateSvgCanvasSize();
            this.scheduleViewportDraw();
          }
        });
        this._resizeObserver.observe(viewport);
      }
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => {
        this._vpMetricsDirty = true;
        if (typeof App !== 'undefined' && App.currentScreen === 'constellation') {
          this.updateViewportMetrics(true);
          this.updateSvgCanvasSize();
          this.scheduleViewportDraw();
        }
      });
    }
  },

  updateViewportMetrics(force = false) {
    if (typeof document === 'undefined') return this._vpMetrics;
    if (!force && !this._vpMetricsDirty && this._vpMetrics) {
      return this._vpMetrics;
    }
    const viewport = document.getElementById('constellation-viewport');
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1;
    if (viewport && typeof viewport.getBoundingClientRect === 'function') {
      const rect = viewport.getBoundingClientRect();
      this._vpMetrics = {
        left: rect.left || 0,
        top: rect.top || 0,
        width: Math.max(300, rect.width || 1000),
        height: Math.max(300, rect.height || 700),
        dpr
      };
      this._vpMetricsDirty = !(rect.width > 0 && rect.height > 0);
    } else {
      this._vpMetrics = { left: 0, top: 0, width: 1000, height: 700, dpr };
    }
    return this._vpMetrics;
  },

  resolveCanvasColor(rawColor) {
    if (!rawColor || rawColor.startsWith('var(')) {
      return this._cachedAccentColor || '#38BDF8';
    }
    return rawColor;
  },

  refreshAccentColorCache() {
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && typeof document !== 'undefined' && document.documentElement) {
      try {
        const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        if (val) {
          this._cachedAccentColor = val;
          return;
        }
      } catch (_) {}
    }
    this._cachedAccentColor = '#38BDF8';
  },

  setMode(mode) {
    if (mode !== 'tree' && mode !== 'radial') return;
    this.currentMode = mode;

    const btnTree = document.getElementById('btn-constellation-mode-tree');
    const btnRadial = document.getElementById('btn-constellation-mode-radial');
    const viewport = document.getElementById('constellation-viewport');

    if (btnTree) btnTree.classList.toggle('active', mode === 'tree');
    if (btnRadial) btnRadial.classList.toggle('active', mode === 'radial');
    if (viewport && viewport.classList) {
      viewport.classList.toggle('constellation-mode-radial', mode === 'radial');
      viewport.classList.toggle('constellation-mode-tree', mode === 'tree');
    }

    this.render();
    setTimeout(() => this.fitAll(true), 60);
  },

  applyZoomDelta(multiplier) {
    if (typeof document === 'undefined') return;
    const m = this.updateViewportMetrics();
    const centerX = m.width / 2;
    const centerY = m.height / 2;

    const worldX = (centerX - this.pan.x) / this.zoom;
    const worldY = (centerY - this.pan.y) / this.zoom;

    const newZoom = Math.max(0.05, Math.min(2.5, this.zoom * multiplier));
    this.zoom = newZoom;
    this.pan.x = centerX - worldX * this.zoom;
    this.pan.y = centerY - worldY * this.zoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
    this.scheduleViewportDraw();
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
    if (canvas && canvas.style) {
      canvas.style.transform = `translate3d(${Math.round(this.pan.x)}px, ${Math.round(this.pan.y)}px, 0) scale(${this.zoom})`;
    }
  },

  resetView() {
    this.zoom = 1.0;
    this.pan = (this.currentMode === 'tree') ? { x: 120, y: 160 } : { x: 300, y: 200 };
    this.updateCanvasTransform();
    this.updateZoomLabel();
    this.scheduleViewportDraw();
  },

  fitAll(smooth = false) {
    if (typeof document === 'undefined') return;
    const viewport = document.getElementById('constellation-viewport');
    if (!viewport || !this._graphData || !this._graphData.nodes || this._graphData.nodes.length === 0) {
      return;
    }

    const visibleNodes = this._graphData.nodes.filter(n => !n._hidden && !n._filteredOut);
    if (visibleNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < visibleNodes.length; i++) {
      const n = visibleNodes[i];
      const w = n.width || 220;
      const h = n.height || 64;
      if (n.x < minX) minX = n.x;
      if (n.x + w > maxX) maxX = n.x + w;
      if (n.y < minY) minY = n.y;
      if (n.y + h > maxY) maxY = n.y + h;
    }

    const m = this.updateViewportMetrics();
    const vpW = m.width;
    const vpH = m.height;

    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(100, maxY - minY);

    const padding = 60;
    const scaleX = (vpW - padding * 2) / contentW;
    const scaleY = (vpH - padding * 2) / contentH;
    let targetZoom = Math.min(scaleX, scaleY);
    targetZoom = Math.max(0.05, Math.min(1.35, targetZoom));

    const contentCenterX = minX + contentW / 2;
    const contentCenterY = minY + contentH / 2;

    this.zoom = targetZoom;
    this.pan.x = vpW / 2 - contentCenterX * targetZoom;
    this.pan.y = vpH / 2 - contentCenterY * targetZoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
    this.scheduleViewportDraw();
  },

  centerOnNode(nodeId) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._nodeById.get(nodeId) || this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const m = this.updateViewportMetrics();

    this.zoom = Math.max(0.9, Math.min(1.2, this.zoom));
    const nodeCenterX = node.x + (node.width || 220) / 2;
    const nodeCenterY = node.y + (node.height || 64) / 2;

    this.pan.x = (m.width / 2) - nodeCenterX * this.zoom;
    this.pan.y = (m.height / 2) - nodeCenterY * this.zoom;

    this.updateCanvasTransform();
    this.updateZoomLabel();
    this.scheduleViewportDraw();
  },

  toggleFoldNode(nodeId) {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    this.render();
  },

  toggleCollapseAll() {
    if (!this._graphData || !this._graphData.allNodes) return;
    if (this.collapsedNodes.size > 0) {
      this.collapsedNodes.clear();
    } else {
      const topExpandable = this._graphData.allNodes.filter(n => n.parentId === '__root__' && n._hasChildren);
      topExpandable.forEach(n => this.collapsedNodes.add(n.id));
    }
    this.render();
    this.fitAll(true);
  },

  updateCollapseAllButton() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btn-constellation-toggle-collapse');
    if (!btn) return;
    const span = btn.querySelector('span');
    if (span) {
      span.textContent = this.collapsedNodes.size > 0 ? 'Déplier tout' : 'Replier tout';
    }
  },

  /**
   * Construction optimisée O(N) du modèle de graphe unifié
   * - Exclut les projets archivés et leurs contenus
   * - Exclut les événements d'agenda par défaut (sauf si le filtre Agenda est activé)
   */
  extractGraphData() {
    const storage = (typeof StorageManager !== 'undefined') ? StorageManager : null;
    const projects = (storage && typeof storage.getProjects === 'function') ? storage.getProjects() : [];
    const tasks = (storage && typeof storage.getTasks === 'function') ? storage.getTasks() : [];
    const includeEvents = !!this.filters.events;
    const events = (includeEvents && storage && typeof storage.getEvents === 'function') ? storage.getEvents() : [];
    const notes = (storage && typeof storage.getNotes === 'function') ? storage.getNotes() : [];
    const trash = (storage && typeof storage.getTrash === 'function') ? storage.getTrash() : [];

    const trashIds = new Set();
    for (let i = 0; i < trash.length; i++) {
      const item = trash[i];
      if (!item) continue;
      if (item.data && item.data.id) trashIds.add(item.data.id);
      if (item.originalId || item.id) trashIds.add(item.originalId || item.id);
    }

    // 1. Indexation O(P) des projets actifs (exclusion des projets archivés + cascade sous-projets)
    const rawProjectMap = new Map();
    const archivedProjectIds = new Set();
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (!p || !p.id || trashIds.has(p.id)) continue;
      if (p.archived) {
        archivedProjectIds.add(p.id);
      } else {
        rawProjectMap.set(p.id, p);
      }
    }

    // Cascade sur les sous-projets dont un ancêtre est archivé
    const isAncestorArchived = (proj) => {
      let cur = proj;
      const seen = new Set();
      while (cur && cur.parentProjectId && !seen.has(cur.id)) {
        seen.add(cur.id);
        if (archivedProjectIds.has(cur.parentProjectId)) return true;
        cur = rawProjectMap.get(cur.parentProjectId);
      }
      return false;
    };

    const projectById = new Map();
    rawProjectMap.forEach((p, id) => {
      if (isAncestorArchived(p)) {
        archivedProjectIds.add(id);
      } else {
        projectById.set(id, p);
      }
    });

    // 2. Marche linéaire sur les tâches actives (calcul simultané des stats projets sans .filter O(P*T))
    const hideDone = !!this.filters.hideDone;
    const taskEntries = []; // { task, parentTaskId }
    const taskById = new Map();
    const projectTaskStats = new Map(); // projectId -> { total, done }
    const freeRootTasksCount = { count: 0 };

    const visitedActiveSubtasks = new WeakSet();
    const hasActiveSubtask = (task) => {
      if (!task || visitedActiveSubtasks.has(task)) return false;
      visitedActiveSubtasks.add(task);
      if (!Array.isArray(task.subtasks) || task.subtasks.length === 0) return false;
      for (let i = 0; i < task.subtasks.length; i++) {
        const sub = task.subtasks[i];
        if (!sub || trashIds.has(sub.id)) continue;
        if (!sub.completed || hasActiveSubtask(sub)) return true;
      }
      return false;
    };

    const visitedTaskIds = new Set();
    const walkTasks = (t, parentTaskId, inheritedProjectId) => {
      if (!t || !t.id || trashIds.has(t.id) || visitedTaskIds.has(t.id)) return;
      visitedTaskIds.add(t.id);
      const effProjectId = t.projectId || inheritedProjectId || null;
      if (effProjectId && archivedProjectIds.has(effProjectId)) return;

      // Compter les stats complètes sur le projet
      if (t.projectId && projectById.has(t.projectId)) {
        let st = projectTaskStats.get(t.projectId);
        if (!st) {
          st = { total: 0, done: 0 };
          projectTaskStats.set(t.projectId, st);
        }
        st.total++;
        if (t.completed) st.done++;
      }

      if (hideDone && t.completed && !hasActiveSubtask(t)) {
        return;
      }

      taskById.set(t.id, t);
      taskEntries.push({ task: t, parentTaskId });
      if ((!t.projectId || !projectById.has(t.projectId)) && !parentTaskId) {
        freeRootTasksCount.count++;
      }

      if (Array.isArray(t.subtasks)) {
        for (let i = 0; i < t.subtasks.length; i++) {
          walkTasks(t.subtasks[i], t.id, effProjectId);
        }
      }
    };

    for (let i = 0; i < tasks.length; i++) {
      walkTasks(tasks[i], null, null);
    }

    const nodes = [];
    const links = [];

    const isRadial = (this.currentMode === 'radial');
    const defaultNodeW = isRadial ? 44 : 220;
    const defaultNodeH = isRadial ? 44 : 62;
    const rootW = isRadial ? 56 : 220;
    const rootH = isRadial ? 56 : 64;

    // 3. Nœud Hub Central Racine
    nodes.push({
      id: '__root__',
      type: 'root',
      title: 'Antigravité',
      subtitle: 'Espace unifié & Pôles',
      color: 'var(--accent, #38BDF8)',
      icon: 'orbit',
      width: rootW,
      height: rootH,
      parentId: null
    });

    // 4. Nœuds Projets actifs
    projectById.forEach(p => {
      const isChildProject = !!(p.parentProjectId && projectById.has(p.parentProjectId));
      const parentNodeId = isChildProject ? `proj_${p.parentProjectId}` : '__root__';

      const st = projectTaskStats.get(p.id) || { total: 0, done: 0 };
      const progressPct = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;

      nodes.push({
        id: `proj_${p.id}`,
        originalId: p.id,
        type: 'project',
        title: p.title || 'Projet sans nom',
        subtitle: `${st.total} tâche${st.total > 1 ? 's' : ''} (${progressPct}%)`,
        color: p.color || '#6366f1',
        icon: 'folder',
        width: isRadial ? 44 : 230,
        height: isRadial ? 44 : 68,
        progress: progressPct,
        totalTasks: st.total,
        parentId: parentNodeId
      });

      links.push({
        source: parentNodeId,
        target: `proj_${p.id}`,
        color: p.color || '#6366f1'
      });
    });

    // 5. Pôle Tâches Libres & Nœuds Tâches
    let hasFreeTasksHub = false;
    if (freeRootTasksCount.count > 0) {
      hasFreeTasksHub = true;
      nodes.push({
        id: '__hub_tasks_free__',
        type: 'hub',
        hubCategory: 'tasks',
        title: 'Tâches Libres',
        subtitle: `${freeRootTasksCount.count} tâche${freeRootTasksCount.count > 1 ? 's' : ''}`,
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

    for (let i = 0; i < taskEntries.length; i++) {
      const entry = taskEntries[i];
      const t = entry.task;
      let parentNodeId = null;
      let branchColor = '#38bdf8';

      if (entry.parentTaskId && taskById.has(entry.parentTaskId)) {
        parentNodeId = `task_${entry.parentTaskId}`;
        if (t.projectId && projectById.has(t.projectId)) {
          branchColor = projectById.get(t.projectId).color || '#38bdf8';
        }
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
    }

    // 6. Événements d'agenda (uniquement extraits si le filtre Agenda est activé)
    const eventById = new Map();
    let validEventsCount = 0;
    if (includeEvents && events.length > 0) {
      const validEvents = [];
      const freeEvents = [];
      // En cas d'historique massif (> 250 événements), fenêtre temporelle de sécurité sur les créneaux non liés
      const useWindowCap = events.length > 250;
      const nowMs = useWindowCap ? Date.now() : 0;
      const minDateMs = useWindowCap ? nowMs - 14 * 86400000 : 0;
      const maxDateMs = useWindowCap ? nowMs + 90 * 86400000 : 0;

      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (!e || !e.id || trashIds.has(e.id)) continue;
        if (e.projectId && archivedProjectIds.has(e.projectId)) continue;

        if (useWindowCap && !e.taskId && !(e.projectId && projectById.has(e.projectId))) {
          const ts = e.start ? Date.parse(e.start) : NaN;
          if (!isNaN(ts) && (ts < minDateMs || ts > maxDateMs)) continue;
        }

        validEvents.push(e);
        eventById.set(e.id, e);
        if ((!e.projectId || !projectById.has(e.projectId)) && (!e.taskId || !taskById.has(e.taskId))) {
          freeEvents.push(e);
        }
      }
      validEventsCount = validEvents.length;

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

      for (let i = 0; i < validEvents.length; i++) {
        const e = validEvents[i];
        let parentNodeId = null;
        let branchColor = e.color || '#8b5cf6';

        if (e.taskId && taskById.has(e.taskId)) {
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
      }
    }

    // 7. Notes et Pôles de Dossiers de Notes Libres
    const validNotes = [];
    const foldersMap = new Map();
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n || !n.id || trashIds.has(n.id)) continue;
      const projId = n.projectId || n.linkedProjectId;
      if (projId && archivedProjectIds.has(projId)) continue;

      validNotes.push(n);
      const hasProject = !!(projId && projectById.has(projId));
      const hasEvent = !!(n.linkedEventId && eventById.has(n.linkedEventId));
      if (!hasProject && !hasEvent) {
        const folder = (n.folder && n.folder.trim()) || 'Général';
        foldersMap.set(folder, (foldersMap.get(folder) || 0) + 1);
      }
    }

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

    for (let i = 0; i < validNotes.length; i++) {
      const n = validNotes[i];
      let parentNodeId = null;
      let branchColor = '#10b981';

      const projId = n.projectId || n.linkedProjectId;
      if (n.linkedEventId && eventById.has(n.linkedEventId)) {
        parentNodeId = `event_${n.linkedEventId}`;
      } else if (projId && projectById.has(projId)) {
        parentNodeId = `proj_${projId}`;
        branchColor = projectById.get(projId).color || branchColor;
      } else {
        const folder = (n.folder && n.folder.trim()) || 'Général';
        parentNodeId = `__hub_notes_folder_${folder}__`;
      }

      // Tronquer avant le regex HTML pour éviter tout coût O(taille_note) sur de longues notes
      const rawHead = (n.content || '').slice(0, 350);
      const cleanText = rawHead.replace(/<[^>]*>?/g, ' ').replace(/\s+/g, ' ').trim();
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
    }

    // 7b. Liens transverses optionnels (activables via le filtre 🔗 Liens transverses)
    if (this.filters.crossLinks) {
      const noteByIdMap = new Map();
      const noteByTitleMap = new Map();
      for (let i = 0; i < validNotes.length; i++) {
        const vn = validNotes[i];
        noteByIdMap.set(vn.id, vn);
        const normTitle = (vn.title || '').trim().toLowerCase();
        if (normTitle && !noteByTitleMap.has(normTitle)) {
          noteByTitleMap.set(normTitle, vn);
        }
      }

      const existingPairKeys = new Set();
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        existingPairKeys.add(`${l.source}->${l.target}`);
        existingPairKeys.add(`${l.target}->${l.source}`);
      }

      const addCrossEdge = (srcId, tgtId, color) => {
        if (!srcId || !tgtId || srcId === tgtId) return;
        const k = `${srcId}->${tgtId}`;
        if (existingPairKeys.has(k)) return;
        existingPairKeys.add(k);
        existingPairKeys.add(`${tgtId}->${srcId}`);
        links.push({
          source: srcId,
          target: tgtId,
          color: color || '#a855f7',
          dashed: true
        });
      };

      const wikiRe = /\[\[([^\[\]\n<>]{1,100})\]\]/g;
      for (let i = 0; i < validNotes.length; i++) {
        const n = validNotes[i];
        const noteNodeId = `note_${n.id}`;
        const nProjId = n.projectId || n.linkedProjectId || null;

        // Liens Note <-> Note via [[wikilinks]]
        if (n.content && n.content.indexOf('[[') !== -1) {
          const cleanContent = n.content.slice(0, 8000).replace(/<[^>]*>?/g, ' ');
          wikiRe.lastIndex = 0;
          let m;
          while ((m = wikiRe.exec(cleanContent)) !== null) {
            const targetTitle = m[1].split('|')[0].trim().toLowerCase();
            const targetNote = noteByTitleMap.get(targetTitle);
            if (targetNote && targetNote.id !== n.id) {
              addCrossEdge(noteNodeId, `note_${targetNote.id}`, '#a855f7');
            }
          }
        }

        // Lien direct Note <-> Tâche
        if (n.linkedTaskId && taskById.has(n.linkedTaskId)) {
          addCrossEdge(`task_${n.linkedTaskId}`, noteNodeId, '#f59e0b');
        }

        // Rappel visuel Note <-> Projet lorsque la note est rattachée en arborescence sous un créneau d'agenda
        if (n.linkedEventId && eventById.has(n.linkedEventId) && nProjId && projectById.has(nProjId)) {
          addCrossEdge(`proj_${nProjId}`, noteNodeId, projectById.get(nProjId).color || '#10b981');
        }
      }

      // Lien direct Tâche <-> Note (côté tâche.noteId)
      for (let i = 0; i < taskEntries.length; i++) {
        const t = taskEntries[i].task;
        if (t && t.noteId && noteByIdMap.has(t.noteId)) {
          addCrossEdge(`task_${t.id}`, `note_${t.noteId}`, '#f59e0b');
        }
      }
    }

    // 8. Indexation O(N) de l'arbre complet & masquage itératif des branches repliées
    const childrenMap = new Map();
    const nodeMap = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n._searchText = ((n.title || '') + ' ' + (n.subtitle || '')).toLowerCase();
      nodeMap.set(n.id, n);
      const p = n.parentId;
      let list = childrenMap.get(p);
      if (!list) {
        list = [];
        childrenMap.set(p, list);
      }
      list.push(n);
    }

    const hiddenNodeIds = new Set();
    const stack = [];
    this.collapsedNodes.forEach(cId => {
      if (nodeMap.has(cId)) stack.push(cId);
    });
    while (stack.length > 0) {
      const pId = stack.pop();
      const ch = childrenMap.get(pId);
      if (!ch) continue;
      for (let i = 0; i < ch.length; i++) {
        const child = ch[i];
        if (!hiddenNodeIds.has(child.id)) {
          hiddenNodeIds.add(child.id);
          stack.push(child.id);
        }
      }
    }

    const activeNodes = [];
    const activeNodeIdSet = new Set();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const ch = childrenMap.get(n.id);
      const childCount = ch ? ch.length : 0;
      n._hidden = hiddenNodeIds.has(n.id);
      n._hasChildren = childCount > 0;
      n._childrenCount = childCount;
      n._isCollapsed = this.collapsedNodes.has(n.id);
      n._filteredOut = this.isNodeFilteredOut(n);

      if (!n._hidden) {
        activeNodes.push(n);
        activeNodeIdSet.add(n.id);
      }
    }

    const activeLinks = [];
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      if (activeNodeIdSet.has(l.source) && activeNodeIdSet.has(l.target)) {
        activeLinks.push(l);
      }
    }

    return {
      nodes: activeNodes,
      allNodes: nodes,
      links: activeLinks,
      counts: {
        projects: projectById.size,
        tasks: taskEntries.length,
        events: validEventsCount,
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
   * Calcul des coordonnées (X, Y) en mode Arbre Décisionnel Horizontal O(N)
   */
  computeTreeLayout(nodes, links) {
    if (!nodes || nodes.length === 0) return;

    const childrenByParent = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const p = n.parentId;
      let list = childrenByParent.get(p);
      if (!list) {
        list = [];
        childrenByParent.set(p, list);
      }
      list.push(n);
    }

    const colWidth = 280;
    const rowMargin = 22;

    const visitedHeight = new Set();
    const computeSubtreeHeight = (node) => {
      if (!node || visitedHeight.has(node.id)) return node ? (node._subtreeHeight || node.height || 64) : 64;
      visitedHeight.add(node.id);
      const children = childrenByParent.get(node.id) || [];
      if (children.length === 0 || this.collapsedNodes.has(node.id)) {
        node._subtreeHeight = node.height || 64;
        return node._subtreeHeight;
      }
      let totalH = 0;
      for (let idx = 0; idx < children.length; idx++) {
        totalH += computeSubtreeHeight(children[idx]);
        if (idx > 0) totalH += rowMargin;
      }
      node._subtreeHeight = Math.max(node.height || 64, totalH);
      return node._subtreeHeight;
    };

    const root = nodes.find(n => n.id === '__root__');
    if (root) computeSubtreeHeight(root);

    const visitedPos = new Set();
    const positionSubtree = (node, startX, startY) => {
      if (!node || visitedPos.has(node.id)) return;
      visitedPos.add(node.id);
      node.x = startX;
      const children = (this.collapsedNodes.has(node.id)) ? [] : (childrenByParent.get(node.id) || []);

      if (children.length === 0) {
        node.y = startY + ((node._subtreeHeight - (node.height || 64)) / 2);
        return;
      }

      let currentChildY = startY;
      for (let idx = 0; idx < children.length; idx++) {
        if (idx > 0) currentChildY += rowMargin;
        const c = children[idx];
        positionSubtree(c, startX + colWidth, currentChildY);
        currentChildY += c._subtreeHeight;
      }

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
   * Disposition orbitale planétaire + relaxation anti-superposition par hachage spatial O(N)
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
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const p = n.parentId;
      let list = childrenByParent.get(p);
      if (!list) {
        list = [];
        childrenByParent.set(p, list);
      }
      list.push(n);
    }

    const level1 = (childrenByParent.get('__root__') || []).filter(n => !n._hidden);
    if (level1.length === 0) return;

    const weightMemo = new Map();
    const getBranchWeight = (nodeId) => {
      if (weightMemo.has(nodeId)) return weightMemo.get(nodeId);
      if (this.collapsedNodes.has(nodeId)) return 1;
      const children = (childrenByParent.get(nodeId) || []).filter(c => !c._hidden);
      if (children.length === 0) {
        weightMemo.set(nodeId, 1);
        return 1;
      }
      let count = 0;
      for (let i = 0; i < children.length; i++) {
        count += getBranchWeight(children[i].id);
      }
      const w = Math.max(1, count);
      weightMemo.set(nodeId, w);
      return w;
    };

    let totalWeight = 0;
    for (let i = 0; i < level1.length; i++) {
      level1[i]._weight = getBranchWeight(level1[i].id);
      totalWeight += level1[i]._weight;
    }

    let currentAngle = -Math.PI / 2;
    const baseRadius1 = Math.max(340, Math.min(2200, 260 + (level1.length * 32)));

    const layoutDeepDescendants = (parentNode, originX, originY, heading, depth, visited) => {
      if (depth > 12 || this.collapsedNodes.has(parentNode.id)) return;
      const children = (childrenByParent.get(parentNode.id) || []).filter(c => !c._hidden && !visited.has(c.id));
      if (children.length === 0) return;

      const count = children.length;
      const arcSpan = Math.PI * 0.72;
      const arcStart = heading - (arcSpan / 2);
      const stepArc = count > 1 ? (arcSpan / (count - 1)) : 0;

      children.forEach((child, idx) => {
        visited.add(child.id);
        const cAngle = (count === 1) ? heading : (arcStart + idx * stepArc);
        const radius = Math.max(58, 72 - depth * 3) + ((idx % 2) * 16);
        child.x = Math.round(originX + Math.cos(cAngle) * radius - ((child.width || 44) / 2));
        child.y = Math.round(originY + Math.sin(cAngle) * radius - ((child.height || 44) / 2));

        const childCenterX = child.x + ((child.width || 44) / 2);
        const childCenterY = child.y + ((child.height || 44) / 2);
        const childHeading = Math.atan2(childCenterY - originY, childCenterX - originX);
        layoutDeepDescendants(child, childCenterX, childCenterY, childHeading, depth + 1, visited);
      });
    };

    level1.forEach((node, i) => {
      const sectorSpan = (node._weight / Math.max(1, totalWeight)) * (2 * Math.PI);
      const nodeAngle = currentAngle + (sectorSpan / 2);
      const r1 = baseRadius1 + ((i % 2) * 45);

      node.x = Math.round(centerX + Math.cos(nodeAngle) * r1 - ((node.width || 44) / 2));
      node.y = Math.round(centerY + Math.sin(nodeAngle) * r1 - ((node.height || 44) / 2));

      const parentCenterX = node.x + ((node.width || 44) / 2);
      const parentCenterY = node.y + ((node.height || 44) / 2);
      const radialHeading = Math.atan2(parentCenterY - centerY, parentCenterX - centerX);

      const level2 = (this.collapsedNodes.has(node.id)) ? [] : (childrenByParent.get(node.id) || []).filter(c => !c._hidden);
      if (level2.length > 0) {
        const countL2 = level2.length;
        level2.forEach((subNode, j) => {
          let subAngle;
          let r2;

          if (countL2 <= 4) {
            const arcSpan = Math.PI * 0.9;
            const startArc = radialHeading - (arcSpan / 2);
            const stepArc = countL2 > 1 ? (arcSpan / (countL2 - 1)) : 0;
            subAngle = (countL2 === 1) ? radialHeading : (startArc + j * stepArc);
            r2 = 95 + ((j % 2) * 20);
          } else {
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

              const leafCenterX = leafNode.x + ((leafNode.width || 44) / 2);
              const leafCenterY = leafNode.y + ((leafNode.height || 44) / 2);
              const leafHeading = Math.atan2(leafCenterY - subCenterY, leafCenterX - subCenterX);
              const visitedDeep = new Set(['__root__', node.id, subNode.id, leafNode.id]);
              layoutDeepDescendants(leafNode, leafCenterX, leafCenterY, leafHeading, 4, visitedDeep);
            });
          }
        });
      }

      currentAngle += sectorSpan;
    });

    // =========================================================================
    // PASSE DE RELAXATION PAR GRILLE SPATIALE O(N) ANTI-SUPERPOSITION
    // =========================================================================
    const activeNodes = nodes.filter(n => !n._hidden);
    const minDistance = CONSTELLATION_CELL_SIZE;
    const minDistSq = minDistance * minDistance;
    const invCell = 1 / minDistance;
    const maxIter = activeNodes.length > 1000 ? 6 : (activeNodes.length > 500 ? 10 : (activeNodes.length > 200 ? 16 : (activeNodes.length > 100 ? 24 : 40)));

    const grid = new Map();
    const nextIdx = new Int32Array(activeNodes.length);

    for (let iter = 0; iter < maxIter; iter++) {
      grid.clear();
      for (let i = 0; i < activeNodes.length; i++) {
        const n = activeNodes[i];
        if (n.x === undefined) n.x = centerX;
        if (n.y === undefined) n.y = centerY;
        const cx = n.x + ((n.width || 44) * 0.5);
        const cy = n.y + ((n.height || 44) * 0.5);
        const gx = Math.floor(cx * invCell);
        const gy = Math.floor(cy * invCell);
        const bucketKey = (gx + 32768) * 65536 + (gy + 32768);
        const prevHead = grid.get(bucketKey);
        nextIdx[i] = prevHead !== undefined ? prevHead : -1;
        grid.set(bucketKey, i);
      }

      let hadCollision = false;

      for (let a = 0; a < activeNodes.length; a++) {
        const nA = activeNodes[a];
        const halfWa = (nA.width || 44) * 0.5;
        const halfHa = (nA.height || 44) * 0.5;
        const cxA = nA.x + halfWa;
        const cyA = nA.y + halfHa;
        const gx = Math.floor(cxA * invCell);
        const gy = Math.floor(cyA * invCell);

        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const key = (gx + ox + 32768) * 65536 + (gy + oy + 32768);
            let b = grid.get(key);
            if (b === undefined) continue;

            while (b !== -1) {
              if (b > a) {
                const nB = activeNodes[b];

                const cxB = nB.x + ((nB.width || 44) * 0.5);
                const cyB = nB.y + ((nB.height || 44) * 0.5);

                let dx = cxB - cxA;
                let dy = cyB - cyA;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq) {
                  hadCollision = true;
                  let dist;
                  if (distSq < 1) {
                    const angle = ((a * 1.61803398875 + b * 0.75487766) % 1) * (Math.PI * 2);
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    dist = 1;
                  } else {
                    dist = Math.sqrt(distSq);
                  }

                  const overlap = (minDistance - dist) * 0.52;
                  const nx = (dx / dist) * overlap;
                  const ny = (dy / dist) * overlap;

                  if (nA.id !== '__root__') {
                    nA.x -= nx;
                    nA.y -= ny;
                  }
                  if (nB.id !== '__root__') {
                    nB.x += nx;
                    nB.y += ny;
                  }
                }
              }
              b = nextIdx[b];
            }
          }
        }
      }

      if (!hadCollision) break;
    }

    for (let i = 0; i < activeNodes.length; i++) {
      const n = activeNodes[i];
      n.x = Math.round(n.x);
      n.y = Math.round(n.y);
    }
  },

  /**
   * Prépare l'index mémoire O(1) et pré-calcule les courbes de liaison pour rendu Canvas
   */
  prepareGraphCaches(nodes, links) {
    this.refreshAccentColorCache();
    this._nodeById.clear();
    this._childrenByParent.clear();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n._resolvedColor = this.resolveCanvasColor(n.color);
      this._nodeById.set(n.id, n);
      let list = this._childrenByParent.get(n.parentId);
      if (!list) {
        list = [];
        this._childrenByParent.set(n.parentId, list);
      }
      list.push(n);
    }

    const isTree = (this.currentMode === 'tree');
    const preparedEdges = [];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const src = this._nodeById.get(link.source);
      const tgt = this._nodeById.get(link.target);
      if (!src || !tgt) continue;

      let x1, y1, x2, y2, cx1, cx2;
      const isDashed = !!link.dashed;
      if (isTree && !isDashed) {
        x1 = src.x + (src.width || 220);
        y1 = src.y + ((src.height || 64) * 0.5);
        x2 = tgt.x;
        y2 = tgt.y + ((tgt.height || 64) * 0.5);
        const dx = Math.max(40, (x2 - x1) * 0.5);
        cx1 = x1 + dx;
        cx2 = x2 - dx;
      } else {
        x1 = src.x + ((src.width || (isTree ? 220 : 44)) * 0.5);
        y1 = src.y + ((src.height || (isTree ? 64 : 44)) * 0.5);
        x2 = tgt.x + ((tgt.width || (isTree ? 220 : 44)) * 0.5);
        y2 = tgt.y + ((tgt.height || (isTree ? 64 : 44)) * 0.5);
        cx1 = x1;
        cx2 = x2;
      }

      preparedEdges.push({
        source: src.id,
        target: tgt.id,
        src,
        tgt,
        x1,
        y1,
        x2,
        y2,
        cx1,
        cx2,
        minX: Math.min(x1, x2, cx1, cx2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2, cx1, cx2),
        maxY: Math.max(y1, y2),
        isTree: isTree && !isDashed,
        dashed: isDashed,
        color: this.resolveCanvasColor(link.color)
      });
    }
    this._edges = preparedEdges;
  },

  _getTopologySig() {
    const s = (typeof StorageManager !== 'undefined') ? StorageManager : null;
    if (!s || typeof s.getRevision !== 'function') return null;
    const pRev = s.getRevision('projects');
    const tRev = s.getRevision('tasks');
    const nRev = s.getRevision('notes');
    const trRev = s.getRevision('trash');
    const eRev = this.filters.events ? s.getRevision('events') : 0;
    return `${pRev}:${tRev}:${nRev}:${trRev}:${eRev}:${this.currentMode}:${!!this.filters.events}:${!!this.filters.hideDone}:${!!this.filters.crossLinks}:${this.collapsedNodes ? this.collapsedNodes.size : 0}`;
  },

  warmUpTopology() {
    const sig = this._getTopologySig();
    if (sig !== null && this._warmTopologySig === sig && this._graphData) {
      return this._graphData;
    }
    const data = this.extractGraphData();
    this._graphData = data;
    if (this.currentMode === 'tree') {
      this.computeTreeLayout(data.nodes, data.links);
    } else {
      this.computeRadialLayout(data.nodes, data.links);
    }
    this.prepareGraphCaches(data.nodes, data.links);
    this._warmTopologySig = sig;
    return data;
  },

  setDormant(isDormant) {
    if (isDormant) {
      if (this._rafId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      return;
    }
    if (typeof window !== 'undefined' && window.App && window.App.currentScreen === 'constellation') {
      this.updateViewportMetrics(true);
      this.scheduleViewportDraw();
    }
  },

  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const sig = this._getTopologySig();
    if (sig !== null && this._renderedTopologySig === sig && this._graphData && this._warmTopologySig === sig) {
      this.updateViewportMetrics(true);
      this.applyFiltersVisibility(false);
      this.scheduleViewportDraw();
      return;
    }
    this.render();
  },

  /**
   * Rendu principal du graphe sur le canevas Whiteboard
   */
  render() {
    this.init();
    this.updateViewportMetrics(true);

    const sig = this._getTopologySig();
    const usePrewarmed = (sig !== null && this._warmTopologySig === sig && this._graphData && (!this._renderedTopologySig || this._renderedTopologySig !== sig));
    if (!usePrewarmed) {
      const data = this.extractGraphData();
      this._graphData = data;
      if (this.currentMode === 'tree') {
        this.computeTreeLayout(data.nodes, data.links);
      } else {
        this.computeRadialLayout(data.nodes, data.links);
      }
      this.prepareGraphCaches(data.nodes, data.links);
      this._warmTopologySig = sig;
    }
    this._renderedTopologySig = sig;
    this._highlightedIds = null;
    this._hoveredCanvasNodeId = null;

    // Vider la couche SVG héritée (les liaisons sont désormais dessinées sur Canvas 2D haute vitesse)
    const svg = document.getElementById('constellation-svg');
    if (svg) svg.innerHTML = '';
    this.updateSvgCanvasSize();

    // Réinitialiser le pool DOM lors d'un re-rendu structurel complet
    const container = document.getElementById('constellation-nodes-container');
    if (container) container.innerHTML = '';
    this._mountedNodes.clear();

    this.updateCollapseAllButton();
    this.applyFiltersVisibility(false);
    this.applySearchHighlight(false);
    this.updateCanvasTransform();
    this.updateZoomLabel();
    this.drawViewportFrame();

    if (!this._hasInitiallyFitted) {
      this._hasInitiallyFitted = true;
      setTimeout(() => this.fitAll(true), 60);
    }
  },

  /**
   * Planifie le rendu synchronisé au rafraîchissement écran (60/120 FPS sans à-coups)
   */
  scheduleViewportDraw() {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      if (this._rafId !== null) return;
      this._rafId = window.requestAnimationFrame(() => {
        this._rafId = null;
        this.drawViewportFrame();
      });
    } else {
      this.drawViewportFrame();
    }
  },

  /**
   * Dessine en temps réel les arêtes sur Canvas 2D + virtualise les nœuds HTML visibles dans la fenêtre
   */
  drawViewportFrame() {
    if (typeof document === 'undefined' || !this._graphData || !this._graphData.nodes) return;

    const m = this.updateViewportMetrics();
    const vpW = m.width;
    const vpH = m.height;
    const dpr = m.dpr || 1;
    const panX = Math.round(this.pan.x);
    const panY = Math.round(this.pan.y);
    const zoom = this.zoom || 1;
    const buffer = CONSTELLATION_VIEWPORT_BUFFER / zoom;

    const vLeft = -panX / zoom - buffer;
    const vTop = -panY / zoom - buffer;
    const vRight = (vpW - panX) / zoom + buffer;
    const vBottom = (vpH - panY) / zoom + buffer;

    // 1. Collecter les nœuds visibles dans la zone écran (+ marge) et appliquer la sélection LOD
    const nodes = this._graphData.nodes;
    const priorityNodes = [];
    const leafNodes = [];
    const lowZoomLod = zoom < CONSTELLATION_LOD_ZOOM_THRESHOLD;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n._hidden || n._filteredOut) continue;
      const w = n.width || 220;
      const h = n.height || 64;
      if (n.x + w < vLeft || n.x > vRight || n.y + h < vTop || n.y > vBottom) continue;

      const isPriority = (n.type === 'root' || n.type === 'hub' || n.type === 'project') ||
        (this._searchMatchIds && this._searchMatchIds.has(n.id));

      if (isPriority) {
        priorityNodes.push(n);
      } else {
        leafNodes.push(n);
      }
    }

    const desiredHtmlNodes = [];
    const desiredHtmlIds = new Set();
    const canvasLodNodes = [];

    for (let i = 0; i < priorityNodes.length; i++) {
      const n = priorityNodes[i];
      if (desiredHtmlNodes.length < CONSTELLATION_MAX_HTML_NODES) {
        desiredHtmlNodes.push(n);
        desiredHtmlIds.add(n.id);
      } else {
        canvasLodNodes.push(n);
      }
    }

    for (let i = 0; i < leafNodes.length; i++) {
      const n = leafNodes[i];
      if (!lowZoomLod && desiredHtmlNodes.length < CONSTELLATION_MAX_HTML_NODES) {
        desiredHtmlNodes.push(n);
        desiredHtmlIds.add(n.id);
      } else {
        canvasLodNodes.push(n);
      }
    }

    this._canvasLodNodes = canvasLodNodes;

    // 2. Rendre les liaisons et les orbes Canvas LOD sur #constellation-edges-canvas
    this.renderEdgesAndLodCanvas(vpW, vpH, dpr, panX, panY, zoom, vLeft, vTop, vRight, vBottom, canvasLodNodes);

    // 3. Synchroniser de façon incrémentale les éléments DOM HTML visibles
    this.syncVisibleDomNodes(desiredHtmlNodes, desiredHtmlIds);
  },

  renderEdgesAndLodCanvas(vpW, vpH, dpr, panX, panY, zoom, vLeft, vTop, vRight, vBottom, canvasLodNodes) {
    const canvas = document.getElementById('constellation-edges-canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return;

    const targetW = Math.round(vpW * dpr);
    const targetH = Math.round(vpH * dpr);
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, targetW, targetH);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    ctx.lineCap = 'round';

    const highlighted = this._highlightedIds;
    const edges = this._edges;
    const activeLineW = 3.2;
    const normalLineW = 2.0;

    // Dessiner les arêtes avec frustum culling strict
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (e.src._filteredOut || e.tgt._filteredOut) continue;
      if (e.maxX < vLeft || e.minX > vRight || e.maxY < vTop || e.minY > vBottom) continue;

      let alpha = 0.42;
      let width = normalLineW;
      if (highlighted) {
        if (highlighted.has(e.source) && highlighted.has(e.target)) {
          alpha = 0.95;
          width = activeLineW;
        } else {
          alpha = 0.12;
        }
      }

      ctx.globalAlpha = e.dashed ? Math.min(alpha, 0.48) : alpha;
      ctx.lineWidth = e.dashed ? Math.max(1.3, width - 0.5) : width;
      ctx.strokeStyle = e.color;
      if (e.dashed && typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([6, 5]);
      }
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      if (e.isTree) {
        ctx.bezierCurveTo(e.cx1, e.y1, e.cx2, e.y2, e.x2, e.y2);
      } else {
        ctx.lineTo(e.x2, e.y2);
      }
      ctx.stroke();
      if (e.dashed && typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([]);
      }
    }

    // Dessiner les nœuds en mode LOD Canvas (au dézoom ou au-delà du budget DOM)
    if (canvasLodNodes && canvasLodNodes.length > 0) {
      const isRadial = (this.currentMode === 'radial');
      const isLight = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'light');

      for (let i = 0; i < canvasLodNodes.length; i++) {
        const n = canvasLodNodes[i];
        const w = n.width || (isRadial ? 44 : 220);
        const h = n.height || (isRadial ? 44 : 62);
        const color = n._resolvedColor || '#38BDF8';

        let alpha = n.completed ? 0.55 : 0.95;
        if (highlighted && !highlighted.has(n.id)) alpha *= 0.25;
        if (this._searchMatchIds && !this._searchMatchIds.has(n.id)) alpha *= 0.25;

        ctx.globalAlpha = alpha;

        if (isRadial || zoom < 0.38) {
          const cx = n.x + w * 0.5;
          const cy = n.y + h * 0.5;
          const radius = isRadial ? w * 0.46 : 16;

          ctx.fillStyle = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(20, 28, 44, 0.96)';
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = n.urgent ? 3 : 2.2;
          ctx.strokeStyle = n.urgent ? '#ef4444' : color;
          ctx.stroke();

          ctx.fillStyle = n.completed ? '#10b981' : color;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = isLight ? 'rgba(255,255,255,0.94)' : 'rgba(20, 28, 44, 0.94)';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(n.x, n.y, w, h, 8);
          } else {
            ctx.rect(n.x, n.y, w, h);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.fillRect(n.x, n.y + 4, 4, h - 8);
        }
      }
    }

    ctx.globalAlpha = 1;
  },

  syncVisibleDomNodes(desiredHtmlNodes, desiredHtmlIds) {
    const container = document.getElementById('constellation-nodes-container');
    if (!container) return;

    // Filet de sécurité pour les mocks minimaux de tests unitaires
    if (typeof document.createElement !== 'function' || typeof container.appendChild !== 'function') {
      return;
    }

    // 1. Retirer les nœuds sortis du viewport étendu ou devenus LOD Canvas
    this._mountedNodes.forEach((el, id) => {
      if (!desiredHtmlIds.has(id)) {
        if (typeof el.remove === 'function') el.remove();
        this._mountedNodes.delete(id);
      }
    });

    // 2. Mettre à jour les classes visuelles des nœuds déjà montés & créer uniquement les nouveaux entrants
    const fragment = (typeof document.createDocumentFragment === 'function') ? document.createDocumentFragment() : null;
    const isRadial = (this.currentMode === 'radial');
    const highlighted = this._highlightedIds;
    const searchMatches = this._searchMatchIds;

    for (let i = 0; i < desiredHtmlNodes.length; i++) {
      const n = desiredHtmlNodes[i];
      let el = this._mountedNodes.get(n.id);
      const isPathConn = highlighted ? highlighted.has(n.id) : false;
      const isPathDimmed = highlighted ? !isPathConn : false;
      const isSearchMatch = searchMatches ? searchMatches.has(n.id) : false;
      const isSearchDimmed = searchMatches ? !isSearchMatch : false;

      if (el) {
        if (el.classList) {
          el.classList.toggle('is-filter-hidden', !!n._filteredOut);
          el.classList.toggle('path-active', isPathConn);
          el.classList.toggle('path-dimmed', isPathDimmed);
          el.classList.toggle('search-match', isSearchMatch);
          el.classList.toggle('search-dimmed', isSearchDimmed);
        }
      } else {
        el = this.createNodeElement(n, isRadial, isPathConn, isPathDimmed, isSearchMatch, isSearchDimmed);
        this._mountedNodes.set(n.id, el);
        if (fragment) {
          fragment.appendChild(el);
        } else {
          container.appendChild(el);
        }
      }
    }

    if (fragment && fragment.childNodes && fragment.childNodes.length > 0) {
      container.appendChild(fragment);
    }

    this.bindNodeInteractions();
  },

  createNodeElement(n, isRadial, isPathConn, isPathDimmed, isSearchMatch, isSearchDimmed) {
    const color = this._safeColor(n.color, '#38bdf8');
    const isRoot = (n.type === 'root');
    const isProject = (n.type === 'project');
    const isTask = (n.type === 'task');
    const isEvent = (n.type === 'event');
    const isNote = (n.type === 'note');

    let iconSvg = '';
    if (isRoot) {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14l5-6 6 3 7-7"/><path d="M8 8l3 11 5 1-2-9"/><circle cx="3" cy="14" r="2" fill="currentColor"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="14" cy="11" r="2" fill="currentColor"/><circle cx="21" cy="4" r="2" fill="currentColor"/><circle cx="11" cy="19" r="2" fill="currentColor"/><circle cx="16" cy="20" r="2" fill="currentColor"/></svg>';
    } else if (isProject) {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    } else if (isTask) {
      if (n.completed) {
        iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else if (n.urgent) {
        iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
      } else {
        iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
      }
    } else if (isEvent) {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    } else if (isNote) {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    } else {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>';
    }

    let badgeHtml = '';
    if (isProject && n.totalTasks > 0) {
      badgeHtml = `<span class="constellation-node-pill" style="color: ${color}; background-color: ${color}1c; border-color: ${color}40;">${n.progress}%</span>`;
    } else if (isTask && n.urgent) {
      badgeHtml = '<span class="constellation-node-pill pill-urgent">Urgent</span>';
    } else if (isTask && n.completed) {
      badgeHtml = '<span class="constellation-node-pill pill-done">Fait</span>';
    } else if (isNote && n.folder) {
      badgeHtml = `<span class="constellation-node-pill">${this.escapeHtml(n.folder)}</span>`;
    }

    let foldBtnHtml = '';
    if (n._hasChildren && !isRoot) {
      const symbol = n._isCollapsed ? `+${n._childrenCount}` : '−';
      const foldTitle = n._isCollapsed ? 'Déplier la branche' : 'Replier la branche';
      foldBtnHtml = `<button type="button" class="constellation-fold-btn ${n._isCollapsed ? 'collapsed' : ''}" data-node-id="${this.escapeHtml(n.id)}" title="${foldTitle}">${symbol}</button>`;
    }

    const el = document.createElement('div');
    el.className = `constellation-node node-type-${n.type}${n.completed ? ' is-completed' : ''}${n._filteredOut ? ' is-filter-hidden' : ''}${isPathConn ? ' path-active' : ''}${isPathDimmed ? ' path-dimmed' : ''}${isSearchMatch ? ' search-match' : ''}${isSearchDimmed ? ' search-dimmed' : ''}`;
    el.id = `cnode-${n.id}`;
    el.dataset.id = n.id;
    el.dataset.type = n.type;
    el.dataset.originalId = n.originalId || '';
    el.dataset.searchTarget = n._searchText || '';
    el.title = n.title || '';
    el.style.transform = `translate3d(${n.x}px, ${n.y}px, 0)`;
    el.style.width = `${n.width}px`;
    if (isRadial) {
      el.style.borderColor = color;
    } else {
      el.style.borderLeftColor = color;
    }

    el.innerHTML = `
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
    `;

    return el;
  },

  /**
   * Détection rapide de clic/survol sur les nœuds rendus via Canvas LOD
   */
  pickLodNodeAtPoint(clientX, clientY) {
    if (!this._canvasLodNodes || this._canvasLodNodes.length === 0) return null;
    const m = this._vpMetrics;
    const zoom = this.zoom || 1;
    const worldX = (clientX - m.left - Math.round(this.pan.x)) / zoom;
    const worldY = (clientY - m.top - Math.round(this.pan.y)) / zoom;
    const isRadial = (this.currentMode === 'radial');
    const pad = Math.max(4, 6 / zoom);

    for (let i = this._canvasLodNodes.length - 1; i >= 0; i--) {
      const n = this._canvasLodNodes[i];
      const w = n.width || (isRadial ? 44 : 220);
      const h = n.height || (isRadial ? 44 : 62);
      if (isRadial || zoom < 0.38) {
        const cx = n.x + w * 0.5;
        const cy = n.y + h * 0.5;
        const r = (isRadial ? w * 0.46 : 16) + pad;
        const dx = worldX - cx;
        const dy = worldY - cy;
        if (dx * dx + dy * dy <= r * r) return n;
      } else {
        if (worldX >= n.x - pad && worldX <= n.x + w + pad && worldY >= n.y - pad && worldY <= n.y + h + pad) {
          return n;
        }
      }
    }
    return null;
  },

  /**
   * Application instantanée des filtres SANS recalculer les positions (Stabilité spatiale)
   */
  applyFiltersVisibility(redraw = true) {
    if (!this._graphData || !this._graphData.nodes) return;

    const nodes = this._graphData.nodes;
    const byId = this._nodeById || new Map(nodes.map(n => [n.id, n]));

    for (let i = 0; i < nodes.length; i++) {
      nodes[i]._filteredOut = this.isNodeFilteredOut(nodes[i]);
    }

    // Conserver visibles les ancêtres de tout nœud descendant encore affiché (zéro arête coupée / nœud orphelin)
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n._filteredOut || n._hidden || !n.parentId) continue;
      let currParentId = n.parentId;
      const visited = new Set([n.id]);
      while (currParentId && !visited.has(currParentId)) {
        visited.add(currParentId);
        const parentNode = byId.get(currParentId);
        if (!parentNode) break;
        parentNode._filteredOut = false;
        currParentId = parentNode.parentId;
      }
    }

    const visibleTypesCount = { projects: 0, tasks: 0, events: 0, notes: 0 };

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const mountedEl = this._mountedNodes.get(n.id);
      if (mountedEl && mountedEl.classList) {
        mountedEl.classList.toggle('is-filter-hidden', !!n._filteredOut);
      }
      if (!n._filteredOut && !n._hidden) {
        if (n.type === 'project') visibleTypesCount.projects++;
        else if (n.type === 'task') visibleTypesCount.tasks++;
        else if (n.type === 'event') visibleTypesCount.events++;
        else if (n.type === 'note') visibleTypesCount.notes++;
      }
    }

    this.updateStatsBadge(visibleTypesCount);
    if (redraw) {
      this.scheduleViewportDraw();
    }
  },

  /**
   * Compatibilité ascendante avec les appels éventuels directs
   */
  renderSvgConnections(nodes, links) {
    this.prepareGraphCaches(nodes || [], links || []);
    const svg = document.getElementById('constellation-svg');
    if (svg) svg.innerHTML = '';
    this.updateSvgCanvasSize();
    this.scheduleViewportDraw();
  },

  updateSvgCanvasSize() {
    const svg = document.getElementById('constellation-svg');
    if (!svg || !this._graphData || !this._graphData.nodes) return;

    let maxX = 2600;
    let maxY = 2200;
    const nodes = this._graphData.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x + (n.width || 200) + 200 > maxX) maxX = n.x + (n.width || 200) + 200;
      if (n.y + (n.height || 60) + 200 > maxY) maxY = n.y + (n.height || 60) + 200;
    }

    svg.setAttribute('width', maxX);
    svg.setAttribute('height', maxY);
  },

  renderHtmlNodes(nodes) {
    this.scheduleViewportDraw();
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
    let pointerDownInfo = null;
    let suppressNextClick = false;

    const executeNodeAction = (nodeEl, isFoldBtn) => {
      const now = Date.now();
      if (now - lastActionTime < 200) return;
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

    container.onclick = (e) => {
      if (e.button !== 0) return;
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
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

    if (typeof container.addEventListener === 'function') {
      container.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) {
          pointerDownInfo = null;
          return;
        }
        const foldBtn = e.target.closest && e.target.closest('.constellation-fold-btn');
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (!foldBtn && !nodeEl) {
          pointerDownInfo = null;
          return;
        }
        pointerDownInfo = {
          isFold: !!foldBtn,
          nodeId: foldBtn
            ? (foldBtn.dataset.nodeId || (nodeEl && nodeEl.dataset ? nodeEl.dataset.id : null))
            : (nodeEl && nodeEl.dataset ? nodeEl.dataset.id : null),
          x: e.clientX,
          y: e.clientY
        };
      });

      container.addEventListener('pointercancel', () => {
        pointerDownInfo = null;
      });

      container.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        const down = pointerDownInfo;
        pointerDownInfo = null;
        if (!down) {
          suppressNextClick = true;
          setTimeout(() => { suppressNextClick = false; }, 60);
          return;
        }

        const movedDist = Math.hypot((e.clientX || 0) - down.x, (e.clientY || 0) - down.y);
        if (movedDist > 6) {
          suppressNextClick = true;
          setTimeout(() => { suppressNextClick = false; }, 60);
          return;
        }

        const foldBtn = e.target.closest && e.target.closest('.constellation-fold-btn');
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (down.isFold && foldBtn) {
          const upFoldId = foldBtn.dataset.nodeId || (nodeEl && nodeEl.dataset ? nodeEl.dataset.id : null);
          if (upFoldId && upFoldId === down.nodeId) {
            executeNodeAction(foldBtn, true);
            return;
          }
        } else if (!down.isFold && !foldBtn && nodeEl && nodeEl.dataset && nodeEl.dataset.id === down.nodeId) {
          executeNodeAction(nodeEl, false);
          return;
        }

        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 60);
      });
    }

    container.oncontextmenu = (e) => {
      const nodeEl = e.target.closest && e.target.closest('.constellation-node');
      if (!nodeEl) return;

      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      this.showContextMenu(nodeEl.dataset.id, e.clientX, e.clientY);
    };

    if (typeof container.addEventListener === 'function') {
      container.addEventListener('mouseover', (e) => {
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (!nodeEl) return;

        const nodeId = nodeEl.dataset.id;
        if (nodeId === activeHoveredNodeId) return;

        activeHoveredNodeId = nodeId;
        this._hoveredCanvasNodeId = null;
        this.highlightConnectedPath(nodeId);
        this.showHoverCard(nodeId, nodeEl);
      });

      container.addEventListener('mouseout', (e) => {
        const nodeEl = e.target.closest && e.target.closest('.constellation-node');
        if (!nodeEl) return;

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
    const node = this._nodeById.get(nodeId) || this._graphData.nodes.find(n => n.id === nodeId);
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
    const node = this._nodeById.get(nodeId) || this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.hideHoverCard();

    const menu = document.getElementById('constellation-context-menu');
    const headerEl = document.getElementById('constellation-context-header');
    const itemsEl = document.getElementById('constellation-context-items');
    if (!menu || !headerEl || !itemsEl) return;

    const color = this._safeColor(node.color, '#38bdf8');
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
    const safeOrigId = this.escapeHtml(node.originalId || '');
    const safeNodeId = this.escapeHtml(node.id || '');

    if (node.type === 'task' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" data-cm-action="open-task" data-target-id="${safeOrigId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>
          <span>Ouvrir la fiche de la tâche</span>
        </div>
        <div class="context-menu-item" data-cm-action="toggle-task" data-target-id="${safeOrigId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span>${node.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}</span>
        </div>
        <div class="context-menu-item" data-cm-action="start-focus-task" data-target-id="${safeOrigId}">
          <span class="item-icon">🎯</span>
          <span>Lancer une session Focus</span>
        </div>
        <div class="context-menu-item" data-cm-action="nav-tasks">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
          <span>Aller à l'onglet Tâches</span>
        </div>
      `;
    } else if (node.type === 'project' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" data-cm-action="open-project" data-target-id="${safeOrigId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
          <span>Ouvrir les détails du projet</span>
        </div>
        <div class="context-menu-item" data-cm-action="create-task-for-project" data-target-id="${safeOrigId}">
          <span class="item-icon">+</span>
          <span>Ajouter une tâche au projet</span>
        </div>
        <div class="context-menu-item" data-cm-action="create-note-for-project" data-target-id="${safeOrigId}">
          <span class="item-icon">📝</span>
          <span>Ajouter une note au projet</span>
        </div>
        <div class="context-menu-item" data-cm-action="create-event-for-project" data-target-id="${safeOrigId}">
          <span class="item-icon">📅</span>
          <span>Planifier un créneau agenda</span>
        </div>
        <div class="context-menu-item" data-cm-action="start-focus-project" data-target-id="${safeOrigId}">
          <span class="item-icon">🎯</span>
          <span>Lancer une session Focus</span>
        </div>
        <div class="context-menu-item" data-cm-action="nav-projects">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg></span>
          <span>Aller à l'onglet Projets</span>
        </div>
      `;
    } else if (node.type === 'event' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" data-cm-action="open-event" data-target-id="${safeOrigId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <span>Ouvrir le créneau dans l'agenda</span>
        </div>
        <div class="context-menu-item" data-cm-action="start-focus-event" data-target-id="${safeOrigId}">
          <span class="item-icon">🎯</span>
          <span>Lancer une session Focus</span>
        </div>
        <div class="context-menu-item" data-cm-action="nav-agenda">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg></span>
          <span>Aller à l'onglet Agenda</span>
        </div>
      `;
    } else if (node.type === 'note' && node.originalId) {
      itemsHtml += `
        <div class="context-menu-item" data-cm-action="open-note" data-target-id="${safeOrigId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
          <span>Ouvrir dans l'éditeur de notes</span>
        </div>
        <div class="context-menu-item" data-cm-action="create-task-from-note" data-target-id="${safeOrigId}">
          <span class="item-icon">✅</span>
          <span>Créer une tâche depuis cette note</span>
        </div>
        <div class="context-menu-item" data-cm-action="start-focus-note" data-target-id="${safeOrigId}">
          <span class="item-icon">🎯</span>
          <span>Lancer une session Focus</span>
        </div>
        <div class="context-menu-item" data-cm-action="nav-notes">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
          <span>Aller à l'onglet Notes</span>
        </div>
      `;
    }

    if (node._hasChildren && node.id !== '__root__') {
      itemsHtml += `
        <div class="context-menu-item" data-cm-action="toggle-fold" data-target-id="${safeNodeId}">
          <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg></span>
          <span>${node._isCollapsed ? 'Déplier la branche' : 'Replier la branche'}</span>
        </div>
      `;
    }

    itemsHtml += `
      <div class="context-menu-item" data-cm-action="center-node" data-target-id="${safeNodeId}">
        <span class="item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></span>
        <span>Cadrer sur cet élément</span>
      </div>
    `;

    itemsEl.innerHTML = itemsHtml;
    if (!itemsEl._hasContextActionHandler) {
      itemsEl._hasContextActionHandler = true;
      itemsEl.onclick = (e) => {
        const item = e.target && e.target.closest ? e.target.closest('.context-menu-item') : null;
        if (!item || !item.dataset) return;
        const action = item.dataset.cmAction;
        const targetId = item.dataset.targetId || '';
        this.hideContextMenu();
        switch (action) {
          case 'open-task':
            if (typeof TasksManager !== 'undefined' && targetId) TasksManager.openTaskModal(targetId);
            break;
          case 'nav-tasks':
            if (typeof App !== 'undefined') App.navigate('tasks');
            break;
          case 'toggle-task':
            if (targetId) this.toggleTaskCompleteFromMenu(targetId);
            break;
          case 'start-focus-task':
            if (typeof App !== 'undefined' && typeof App.startFocusOn === 'function' && targetId) {
              App.startFocusOn('task', targetId);
            }
            break;
          case 'open-project':
            if (typeof ProjectsManager !== 'undefined' && targetId) ProjectsManager.openProjectDetailModal(targetId);
            break;
          case 'create-task-for-project':
            if (typeof TasksManager !== 'undefined' && typeof TasksManager.openTaskModal === 'function' && targetId) {
              TasksManager.openTaskModal();
              setTimeout(() => {
                const projSel = document.getElementById('task-input-project');
                if (projSel) projSel.value = targetId;
              }, 50);
            }
            break;
          case 'create-note-for-project':
            if (typeof App !== 'undefined') App.navigate('notes');
            if (typeof NotesManager !== 'undefined' && typeof NotesManager.createNote === 'function' && targetId) {
              const newNote = NotesManager.createNote();
              if (newNote && typeof NotesManager.linkCurrentNoteToProject === 'function') {
                NotesManager.linkCurrentNoteToProject(targetId);
              }
            }
            break;
          case 'create-event-for-project':
            if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.openEventModal === 'function' && targetId) {
              const projectsList = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function') ? StorageManager.getProjects() : [];
              const targetProj = projectsList.find(pr => pr && pr.id === targetId);
              AgendaManager.openEventModal(null, {
                title: targetProj ? targetProj.title : 'Créneau projet',
                projectId: targetId,
                color: (targetProj && targetProj.color) || '#8b5cf6'
              });
            }
            break;
          case 'start-focus-project':
            if (typeof App !== 'undefined' && typeof App.startFocusOn === 'function' && targetId) {
              App.startFocusOn('project', targetId);
            }
            break;
          case 'nav-projects':
            if (typeof App !== 'undefined') App.navigate('projects');
            break;
          case 'open-event':
            if (typeof AgendaManager !== 'undefined' && targetId) AgendaManager.openEventModal(targetId);
            break;
          case 'start-focus-event':
            if (typeof App !== 'undefined' && typeof App.startFocusOn === 'function' && targetId) {
              App.startFocusOn('event', targetId);
            }
            break;
          case 'nav-agenda':
            if (typeof App !== 'undefined') App.navigate('agenda');
            break;
          case 'open-note':
            if (typeof NotesManager !== 'undefined' && targetId) NotesManager.selectNote(targetId);
            if (typeof App !== 'undefined') App.navigate('notes');
            break;
          case 'create-task-from-note':
            if (typeof NotesManager !== 'undefined' && targetId && typeof NotesManager.selectNote === 'function' && typeof NotesManager.createTaskFromCurrentNote === 'function') {
              NotesManager.selectNote(targetId, false);
              NotesManager.createTaskFromCurrentNote();
              setTimeout(() => this.render(), 60);
            }
            break;
          case 'start-focus-note':
            if (typeof App !== 'undefined' && typeof App.startFocusOn === 'function' && targetId) {
              App.startFocusOn('note', targetId);
            }
            break;
          case 'nav-notes':
            if (typeof App !== 'undefined') App.navigate('notes');
            break;
          case 'toggle-fold':
            if (targetId) this.toggleFoldNode(targetId);
            break;
          case 'center-node':
            if (targetId) this.centerOnNode(targetId);
            break;
        }
      };
    }
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
    if (typeof TasksManager !== 'undefined' && typeof TasksManager.toggleCompleted === 'function') {
      TasksManager.toggleCompleted(taskId);
      this.render();
    } else if (typeof TasksManager !== 'undefined' && typeof TasksManager.toggleTaskComplete === 'function') {
      TasksManager.toggleTaskComplete(taskId);
      this.render();
    } else if (typeof StorageManager !== 'undefined') {
      const tasks = StorageManager.getTasks ? StorageManager.getTasks() : [];
      const visited = new Set();
      const updateRecursive = (list) => {
        for (const t of list) {
          if (!t || visited.has(t.id)) continue;
          visited.add(t.id);
          if (t.id === taskId) {
            t.completed = !t.completed;
            t.completedAt = t.completed ? new Date().toISOString() : null;
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
   * Affichage de la carte d'aperçu flottante au survol
   */
  showHoverCard(nodeId, nodeElOrClientX, clientY) {
    if (!this._graphData || !this._graphData.nodes) return;
    const node = this._nodeById.get(nodeId) || this._graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const card = document.getElementById('constellation-hover-card');
    if (!card) return;

    const color = this._safeColor(node.color, '#38bdf8');
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

    const nodeRect = (nodeElOrClientX && typeof nodeElOrClientX.getBoundingClientRect === 'function')
      ? nodeElOrClientX.getBoundingClientRect()
      : null;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;

    card.style.display = 'block';

    if (nodeRect) {
      const cardW = 270;
      const cardH = 110;

      let posX = nodeRect.left + (nodeRect.width / 2) - (cardW / 2);
      let posY = nodeRect.top - cardH - 10;

      if (posY < 65) {
        posY = nodeRect.bottom + 10;
      }
      if (posX < 12) posX = 12;
      if (posX + cardW > winW - 12) {
        posX = winW - cardW - 12;
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

  /**
   * Mise en surbrillance O(taille_branche) via Map en mémoire (zéro querySelectorAll)
   */
  highlightConnectedPath(hoveredId) {
    if (!hoveredId || !this._graphData) return;

    const connectedIds = new Set([hoveredId]);

    // Ancêtres O(profondeur) avec garde anti-cycle
    const visitedAncestors = new Set([hoveredId]);
    let curr = this._nodeById.get(hoveredId) || this._graphData.nodes.find(n => n.id === hoveredId);
    while (curr && curr.parentId && !visitedAncestors.has(curr.parentId)) {
      visitedAncestors.add(curr.parentId);
      connectedIds.add(curr.parentId);
      curr = this._nodeById.get(curr.parentId) || this._graphData.nodes.find(n => n.id === curr.parentId);
    }

    // Descendants O(taille_sous_arbre) via _childrenByParent
    const queue = [hoveredId];
    while (queue.length > 0) {
      const pId = queue.pop();
      const ch = this._childrenByParent.get(pId);
      if (!ch) continue;
      for (let i = 0; i < ch.length; i++) {
        const c = ch[i];
        if (!connectedIds.has(c.id)) {
          connectedIds.add(c.id);
          queue.push(c.id);
        }
      }
    }

    this._highlightedIds = connectedIds;

    this._mountedNodes.forEach((el, id) => {
      if (!el.classList) return;
      const isConn = connectedIds.has(id);
      el.classList.toggle('path-active', isConn);
      el.classList.toggle('path-dimmed', !isConn);
    });

    this.scheduleViewportDraw();
  },

  clearPathHighlight() {
    this._highlightedIds = null;
    this._mountedNodes.forEach((el) => {
      if (!el.classList) return;
      el.classList.remove('path-active');
      el.classList.remove('path-dimmed');
    });
    this.scheduleViewportDraw();
  },

  applySearchHighlight(redraw = true) {
    const q = this.searchQuery;
    if (!q || !this._graphData || !this._graphData.nodes) {
      this._searchMatchIds = null;
      this._mountedNodes.forEach((el) => {
        if (!el.classList) return;
        el.classList.remove('search-match');
        el.classList.remove('search-dimmed');
      });
      if (redraw) this.scheduleViewportDraw();
      return;
    }

    const matches = new Set();
    let firstMatchNode = null;
    const nodes = this._graphData.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n._hidden || n._filteredOut) continue;
      if (n._searchText && n._searchText.includes(q)) {
        matches.add(n.id);
        if (!firstMatchNode) firstMatchNode = n;
      }
    }

    this._searchMatchIds = matches;

    this._mountedNodes.forEach((el, id) => {
      if (!el.classList) return;
      const isMatch = matches.has(id);
      el.classList.toggle('search-match', isMatch);
      el.classList.toggle('search-dimmed', !isMatch);
    });

    if (firstMatchNode) {
      this.centerOnNode(firstMatchNode.id);
    } else if (redraw) {
      this.scheduleViewportDraw();
    }
  },

  updateStatsBadge(counts) {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('constellation-stats-badge');
    if (badge && counts) {
      const parts = [
        `${counts.projects} projet${counts.projects > 1 ? 's' : ''}`,
        `${counts.tasks} tâche${counts.tasks > 1 ? 's' : ''}`
      ];
      if (this.filters.events || counts.events > 0) {
        parts.push(`${counts.events} créneau${counts.events > 1 ? 'x' : ''}`);
      }
      parts.push(`${counts.notes} note${counts.notes > 1 ? 's' : ''}`);
      badge.textContent = parts.join(' · ');
    }
  },

  _safeColor(val, fallback = '#38bdf8') {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim();
    if (/^#([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(trimmed)) return trimmed;
    if (/^(?:rgb|hsl)a?\(\s*[0-9.%,\s/-]+\)$/i.test(trimmed)) return trimmed;
    return fallback;
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
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
