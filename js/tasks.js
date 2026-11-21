/**
 * Antigravité - Module de Gestion des Tâches
 * 
 * Principes impératifs :
 * - Aucune réorganisation automatique des tâches (ordre manuel respecté).
 * - Sous-tâches et sous-sous-tâches sans limite de profondeur prédéfinie.
 * - Distinction stricte entre :
 *   1. Échéance (deadline)
 *   2. Date prévue (plannedDate)
 *   3. Créneau de travail (géré dans l'agenda)
 */

const TasksManager = {
  currentFilter: 'active',
  currentProjectFilter: 'all',
  currentSortMode: 'manual',
  collapsedTasks: new Set(),
  draggedTaskId: null,

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    this.currentFilter = 'active';
    try {
      if (typeof localStorage !== 'undefined') {
        const savedSort = localStorage.getItem('antigravite_task_sort_mode');
        if (savedSort && ['manual', 'created', 'priority', 'project'].includes(savedSort)) {
          this.currentSortMode = savedSort;
        }
      }
    } catch (_) {}
    this.render();
    this.bindEvents();
  },

  setFilter(filterName) {
    this.currentFilter = filterName || 'active';
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.task-filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === this.currentFilter);
      });
    }
    this.render();
  },

  setSortMode(mode) {
    if (!['manual', 'created', 'priority', 'project'].includes(mode)) mode = 'manual';
    this.currentSortMode = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravite_task_sort_mode', mode);
      }
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.tasks-sort-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.sort === this.currentSortMode);
      });
    }
    this.render();
  },

  getSortModeLabel() {
    switch (this.currentSortMode) {
      case 'created': return '« Date de création »';
      case 'priority': return '« Priorité »';
      case 'project': return '« Par projet »';
      default: return '« Mon ordre »';
    }
  },

  _sortTasksByCreated(list) {
    if (!Array.isArray(list)) return [];
    const clone = list.map(t => ({
      ...t,
      subtasks: t.subtasks && t.subtasks.length > 0 ? this._sortTasksByCreated(t.subtasks) : []
    }));
    clone.sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });
    return clone;
  },

  _sortTasksByPriority(list) {
    if (!Array.isArray(list)) return [];
    const weights = { urgent: 4, high: 3, medium: 2, low: 1 };
    const clone = list.map(t => ({
      ...t,
      subtasks: t.subtasks && t.subtasks.length > 0 ? this._sortTasksByPriority(t.subtasks) : []
    }));
    clone.sort((a, b) => {
      const pA = weights[a.priority] || 2;
      const pB = weights[b.priority] || 2;
      if (pB !== pA) return pB - pA;
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });
    return clone;
  },

  bindEvents() {
    // Onglets de tri / regroupement
    document.querySelectorAll('.tasks-sort-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const sortMode = e.currentTarget.dataset.sort;
        if (sortMode) {
          this.setSortMode(sortMode);
        }
      });
    });

    // Bouton nouvelle tâche principale
    const btnNew = document.getElementById('btn-new-task');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openTaskModal());
    }

    // Bouton unique de bascule Tout replier / Tout déplier
    const btnToggle = document.getElementById('btn-tasks-toggle-collapse') || document.getElementById('btn-tasks-expand-all');
    if (btnToggle && !btnToggle._hasCollapseListener) {
      btnToggle._hasCollapseListener = true;
      btnToggle.addEventListener('click', () => this.toggleAllCollapse());
    }
    const btnCollapse = document.getElementById('btn-tasks-collapse-all');
    if (btnCollapse && !btnCollapse._hasCollapseListener) {
      btnCollapse._hasCollapseListener = true;
      btnCollapse.addEventListener('click', () => this.collapseAll());
    }

    // Filtres
    document.querySelectorAll('.task-filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.task-filter-chip').forEach(c => c.classList.remove('active'));
        const targetChip = e.currentTarget;
        targetChip.classList.add('active');
        this.currentFilter = targetChip.dataset.filter;
        this.render();
      });
    });

    // Filtre projet
    const projSelect = document.getElementById('task-project-filter');
    if (projSelect) {
      projSelect.addEventListener('change', (e) => {
        this.currentProjectFilter = e.target.value;
        this.render();
      });
    }
  },

  // Basculer entre tout déplier et tout replier
  toggleAllCollapse() {
    if (this.collapsedTasks.size > 0) {
      this.expandAll();
    } else {
      this.collapseAll();
    }
  },

  // Synchronise le titre et l'icône du bouton unique de bascule
  updateToggleCollapseButton() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btn-tasks-toggle-collapse') || document.getElementById('btn-tasks-expand-all');
    if (!btn) return;
    const hasCollapsed = this.collapsedTasks.size > 0;
    const label = hasCollapsed ? 'Tout déplier' : 'Tout replier';
    const title = hasCollapsed ? "Tout déplier dans l'arborescence" : "Tout replier au premier niveau";
    const icon = hasCollapsed
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    btn.innerHTML = `${icon} <span>${label}</span>`;
    btn.title = title;
  },

  // Déplier l'ensemble de l'arborescence
  expandAll() {
    this.collapsedTasks.clear();
    this.render();
    this.updateToggleCollapseButton();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Toutes les branches ont été dépliées", 'info');
    }
  },

  // Replier toutes les branches au niveau racine
  collapseAll() {
    const collectParentIds = (list) => {
      for (const t of list) {
        if (t.subtasks && t.subtasks.length > 0) {
          this.collapsedTasks.add(t.id);
          collectParentIds(t.subtasks);
        }
      }
    };
    collectParentIds(this.getAll());
    this.render();
    this.updateToggleCollapseButton();
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Arborescence repliée au niveau racine", 'info');
    }
  },

  // Mise à jour dynamique des compteurs sur les filtres
  updateFilterCounts(tasks) {
    if (typeof document === 'undefined') return;
    let total = 0;
    let active = 0;
    let completed = 0;

    const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
      ? StorageManager.getProjects()
      : [];
    const archivedProjectIds = new Set(projects.filter(p => p.archived).map(p => p.id));

    const countRecursive = (list) => {
      for (const t of list) {
        if (t.projectId && archivedProjectIds.has(t.projectId)) {
          continue; // Masqué car projet archivé
        }
        total++;
        if (t.completed) completed++;
        else active++;
        if (t.subtasks && t.subtasks.length > 0) countRecursive(t.subtasks);
      }
    };
    countRecursive(tasks);

    const chipAll = document.querySelector('.task-filter-chip[data-filter="all"]');
    const chipActive = document.querySelector('.task-filter-chip[data-filter="active"]');
    const chipCompleted = document.querySelector('.task-filter-chip[data-filter="completed"]');

    if (chipAll) chipAll.innerHTML = `Toutes <span class="filter-count-badge">${total}</span>`;
    if (chipActive) chipActive.innerHTML = `À faire <span class="filter-count-badge">${active}</span>`;
    if (chipCompleted) chipCompleted.innerHTML = `Terminées <span class="filter-count-badge">${completed}</span>`;
  },

  // Notification Toast sécurisée (environnement navigateur et tests)
  _showToast(msg, type = 'info') {
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(msg, type);
    }
  },

  // Récupère toutes les tâches
  getAll() {
    return StorageManager.getTasks();
  },

  // Sauvegarde les tâches
  saveAll(tasks) {
    StorageManager.saveTasks(tasks);
    this.render();
    if (typeof window !== 'undefined' && window.ProjectsManager && typeof window.ProjectsManager.render === 'function') {
      window.ProjectsManager.render();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') {
      window.App.updateDashboard();
    }
    if (typeof window !== 'undefined' && window.ConstellationManager && typeof window.App !== 'undefined' && window.App.currentScreen === 'constellation') {
      window.ConstellationManager.render();
    }
  },

  // Recherche récursive d'une tâche par son ID
  findTaskRecursive(list, id) {
    for (const task of list) {
      if (task.id === id) return { task, parentList: list };
      if (task.subtasks && task.subtasks.length > 0) {
        const found = this.findTaskRecursive(task.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  },

  // Recherche récursive détaillée avec référence au parent et à l'index
  findTaskWithParent(list, id, parentTask = null) {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.id === id) {
        return { task: t, parentList: list, parentTask, index: i };
      }
      if (t.subtasks && t.subtasks.length > 0) {
        const found = this.findTaskWithParent(t.subtasks, id, t);
        if (found) return found;
      }
    }
    return null;
  },

  // Vérifier si targetId est le descendant d'une tâche (protection anti-boucle)
  isDescendant(parentTask, targetId) {
    if (!parentTask) return false;
    if (parentTask.id === targetId) return true;
    if (parentTask.subtasks && parentTask.subtasks.length > 0) {
      for (const sub of parentTask.subtasks) {
        if (this.isDescendant(sub, targetId)) return true;
      }
    }
    return false;
  },

  // Déplacement via glisser-déposer : réordonner, imbriquer en sous-tâche ou monter au niveau principal
  moveTask(draggedId, targetId, position) {
    if (!draggedId) return false;
    if (draggedId === targetId) return false;

    const tasks = this.getAll();
    const draggedFound = this.findTaskWithParent(tasks, draggedId);
    if (!draggedFound) return false;

    // Déposer dans la zone racine (monter au niveau principal)
    if (position === 'root-bottom' || position === 'root-top') {
      const fromList = draggedFound.parentList;
      const fromIndex = fromList.findIndex(t => t.id === draggedId);
      if (fromIndex === -1) return false;
      const [removedTask] = fromList.splice(fromIndex, 1);

      if (position === 'root-top') {
        tasks.unshift(removedTask);
      } else {
        tasks.push(removedTask);
      }

      this.saveAll(tasks);
      this._showToast(`« ${removedTask.title} » placée au niveau principal`, 'info');
      return true;
    }

    const targetFound = this.findTaskWithParent(tasks, targetId);
    if (!targetFound) return false;

    // Protection anti-récursivité : impossible d'imbriquer une tâche dans elle-même ou dans l'un de ses descendants
    if (this.isDescendant(draggedFound.task, targetId)) {
      this._showToast("Action impossible : une tâche ne peut pas devenir la sous-tâche d'elle-même ou de ses descendants", "error");
      return false;
    }

    // Retirer la tâche de son emplacement d'origine
    const fromList = draggedFound.parentList;
    const fromIndex = fromList.findIndex(t => t.id === draggedId);
    if (fromIndex === -1) return false;
    const [removedTask] = fromList.splice(fromIndex, 1);

    if (position === 'inside') {
      // Devenir sous-tâche de la tâche cible
      if (!targetFound.task.subtasks) targetFound.task.subtasks = [];
      targetFound.task.subtasks.push(removedTask);
      this.collapsedTasks.delete(targetId); // S'assurer que le parent est déplié
      this.saveAll(tasks);
      this._showToast(`« ${removedTask.title} » placée en sous-tâche de « ${targetFound.task.title} »`, 'info');
      return true;
    }

    if (position === 'before') {
      const toList = targetFound.parentList;
      const toIndex = toList.findIndex(t => t.id === targetId);
      if (toIndex !== -1) {
        toList.splice(toIndex, 0, removedTask);
      } else {
        toList.unshift(removedTask);
      }
      this.saveAll(tasks);
      this._showToast("Ordre des tâches mis à jour", 'info');
      return true;
    }

    if (position === 'after') {
      const toList = targetFound.parentList;
      const toIndex = toList.findIndex(t => t.id === targetId);
      if (toIndex !== -1) {
        toList.splice(toIndex + 1, 0, removedTask);
      } else {
        toList.push(removedTask);
      }
      this.saveAll(tasks);
      this._showToast("Ordre des tâches mis à jour", 'info');
      return true;
    }

    return false;
  },

  // Monter de niveau : sortir du parent pour rejoindre le niveau supérieur
  outdentTask(id) {
    const tasks = this.getAll();
    const found = this.findTaskWithParent(tasks, id);
    if (!found || !found.parentTask) {
      this._showToast("Cette tâche est déjà au niveau principal", 'info');
      return false;
    }

    const parentInfo = this.findTaskWithParent(tasks, found.parentTask.id);
    if (!parentInfo) return false;

    const fromIndex = found.parentList.findIndex(t => t.id === id);
    if (fromIndex === -1) return false;
    const [removedTask] = found.parentList.splice(fromIndex, 1);

    // Insérer juste après le parent dans la liste parente
    parentInfo.parentList.splice(parentInfo.index + 1, 0, removedTask);

    this.saveAll(tasks);
    this._showToast(`« ${removedTask.title} » montée de niveau`, 'info');
    return true;
  },

  // Mettre en sous-tâche de la tâche précédente au même niveau
  indentTask(id) {
    const tasks = this.getAll();
    const found = this.findTaskWithParent(tasks, id);
    if (!found) return false;

    const list = found.parentList;
    const index = list.findIndex(t => t.id === id);
    if (index <= 0) {
      this._showToast("Aucune tâche précédente au même niveau pour l'imbriquer", 'info');
      return false;
    }

    const prevTask = list[index - 1];
    const [removedTask] = list.splice(index, 1);

    if (!prevTask.subtasks) prevTask.subtasks = [];
    prevTask.subtasks.push(removedTask);
    this.collapsedTasks.delete(prevTask.id);

    this.saveAll(tasks);
    this._showToast(`« ${removedTask.title} » placée en sous-tâche de « ${prevTask.title} »`, 'info');
    return true;
  },

  // Ajouter une tâche (racine ou sous-tâche à n'importe quel niveau)
  addTask(taskData, parentId = null) {
    const tasks = this.getAll();
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: taskData.title.trim(),
      description: taskData.description ? taskData.description.trim() : '',
      projectId: taskData.projectId || null,
      priority: taskData.priority || 'medium',
      completed: false,
      deadline: taskData.deadline || null,
      plannedDate: taskData.plannedDate ? taskData.plannedDate.slice(0, 10) : null,
      plannedTime: taskData.plannedTime || (taskData.plannedDate && taskData.plannedDate.length >= 16 ? taskData.plannedDate.slice(11, 16) : '09:00'),
      createdAt: new Date().toISOString(),
      order: 999, // positionné à la suite
      subtasks: []
    };

    if (!parentId) {
      newTask.order = tasks.length + 1;
      tasks.push(newTask);
    } else {
      const parentNode = this.findTaskRecursive(tasks, parentId);
      if (parentNode) {
        if (!parentNode.task.subtasks) parentNode.task.subtasks = [];
        newTask.order = parentNode.task.subtasks.length + 1;
        parentNode.task.subtasks.push(newTask);
        this.collapsedTasks.delete(parentId); // Déplier automatiquement le parent
      } else {
        tasks.push(newTask);
      }
    }

    this.saveAll(tasks);

    // EXIGENCE : Si la tâche est programmée, créer un créneau dans l'agenda sauf si la tâche provient déjà d'un créneau existant
    if (newTask.plannedDate && !taskData.skipEventCreation) {
      this.syncPlannedDateToAgenda(newTask);
    }

    this._showToast("Tâche ajoutée avec succès", "success");
    return newTask;
  },

  // Mettre à jour une tâche
  updateTask(id, updatedData) {
    const tasks = this.getAll();
    const found = this.findTaskRecursive(tasks, id);
    if (!found) return false;

    const oldPlannedDate = found.task.plannedDate;
    const oldPlannedTime = found.task.plannedTime;

    found.task.title = updatedData.title.trim();
    found.task.description = updatedData.description !== undefined ? updatedData.description.trim() : found.task.description;
    found.task.projectId = updatedData.projectId !== undefined ? updatedData.projectId : found.task.projectId;
    found.task.priority = updatedData.priority || found.task.priority;
    found.task.deadline = updatedData.deadline !== undefined ? updatedData.deadline : found.task.deadline;
    found.task.plannedDate = updatedData.plannedDate !== undefined ? (updatedData.plannedDate ? updatedData.plannedDate.slice(0, 10) : null) : found.task.plannedDate;
    if (updatedData.plannedTime !== undefined) found.task.plannedTime = updatedData.plannedTime;
    found.task.updatedAt = new Date().toISOString();

    this.saveAll(tasks);

    // EXIGENCE : Si la tâche est programmée, synchroniser l'agenda en préservant horaires et durées
    if (found.task.plannedDate && !updatedData.skipEventCreation) {
      this.syncPlannedDateToAgenda(found.task, oldPlannedDate, oldPlannedTime);
    } else if (oldPlannedDate && !found.task.plannedDate) {
      // Si la date prévue a été retirée, détacher le créneau sans le supprimer
      this.detachPlannedDateFromAgenda(found.task.id);
    }

    this._showToast("Tâche mise à jour", "info");
    return true;
  },

  // Synchronisation obligatoire : programmer une tâche ajoute un créneau dans l'agenda Antigravité de base
  syncPlannedDateToAgenda(task, oldPlannedDate = null, oldPlannedTime = null) {
    if (!task || !task.plannedDate) return;
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getEvents !== 'function') return;

    const events = StorageManager.getEvents();
    let linkedEvent = events.find(e => e.taskId === task.id);

    const newDateOnly = task.plannedDate.slice(0, 10);
    const hasSpecificTime = task.plannedDate.length >= 16;
    const specifiedStartTime = task.plannedTime || (hasSpecificTime ? task.plannedDate.slice(11, 16) : '09:00');

    if (linkedEvent) {
      // Mettre à jour les informations textuelles
      linkedEvent.title = task.title;
      if (task.description !== undefined) linkedEvent.description = task.description;

      const dateHasChanged = oldPlannedDate !== null && oldPlannedDate.slice(0, 10) !== newDateOnly;
      const timeHasChanged = oldPlannedTime !== null && task.plannedTime && oldPlannedTime !== task.plannedTime;

      if (!dateHasChanged && !timeHasChanged) {
        // La date et l'heure prévues n'ont pas changé : conserver STRICTEMENT les horaires et durées existants
      } else {
        // La date ou l'heure a été modifiée
        let startTime = specifiedStartTime;
        let durationMinutes = 60; // Durée par défaut

        if (!timeHasChanged && linkedEvent.start && linkedEvent.start.length >= 16) {
          startTime = linkedEvent.start.slice(11, 16);
        }
        if (!startTime) {
          startTime = '09:00';
        }

        if (linkedEvent.start && linkedEvent.end) {
          const prevStartMs = new Date(linkedEvent.start).getTime();
          const prevEndMs = new Date(linkedEvent.end).getTime();
          if (!isNaN(prevStartMs) && !isNaN(prevEndMs) && prevEndMs > prevStartMs) {
            durationMinutes = Math.round((prevEndMs - prevStartMs) / (60 * 1000));
          }
        }

        const [sh, sm] = startTime.split(':').map(Number);
        const startTotalMinutes = (sh || 0) * 60 + (sm || 0);
        const endTotalMinutes = Math.min(23 * 60 + 59, startTotalMinutes + durationMinutes);
        const endH = Math.floor(endTotalMinutes / 60);
        const endM = endTotalMinutes % 60;
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        linkedEvent.start = `${newDateOnly}T${startTime}`;
        linkedEvent.end = `${newDateOnly}T${endTime}`;
      }

      linkedEvent.updatedAt = new Date().toISOString();
      StorageManager.saveEvents(events);
    } else {
      // Créer le créneau dans l'agenda Antigravité de base (source: 'local')
      const startTime = specifiedStartTime || '09:00';
      const [h, m] = startTime.split(':').map(Number);
      const endH = Math.min(23, (h || 9) + 1);
      const endTime = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;

      const newEvent = {
        id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: task.title,
        description: task.description || '',
        location: '',
        start: `${newDateOnly}T${startTime}`,
        end: `${newDateOnly}T${endTime}`,
        isAllDay: false,
        color: '#8b5cf6', // Violet signature Antigravité
        taskId: task.id,
        noteId: null,
        externalId: null,
        source: 'local', // Agenda Antigravité de base
        createdAt: new Date().toISOString()
      };
      events.push(newEvent);
      StorageManager.saveEvents(events);
    }

    if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
      window.AgendaManager.render();
    }
  },

  // Détacher une tâche d'un événement d'agenda sans supprimer l'événement
  detachPlannedDateFromAgenda(taskId) {
    if (!taskId) return;
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getEvents !== 'function') return;

    try {
      const events = StorageManager.getEvents();
      let modified = false;
      for (const evt of events) {
        if (evt.taskId === taskId) {
          evt.taskId = null;
          evt.updatedAt = new Date().toISOString();
          modified = true;
        }
      }
      if (modified) {
        StorageManager.saveEvents(events);
        if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
          window.AgendaManager.render();
        }
      }
    } catch (e) {
      console.warn("[TasksManager] Erreur lors du détachement de l'événement :", e);
    }
  },

  // Valider / Invalider une tâche
  toggleCompleted(id) {
    const tasks = this.getAll();
    const found = this.findTaskRecursive(tasks, id);
    if (!found) return;

    found.task.completed = !found.task.completed;
    found.task.completedAt = found.task.completed ? new Date().toISOString() : null;

    this.saveAll(tasks);
    const msg = found.task.completed ? "Tâche terminée !" : "Tâche rouverte";
    this._showToast(msg, "info");
  },

  // Alias pratique pour compatibilité
  toggleTask(id) {
    return this.toggleCompleted(id);
  },

  // Supprimer une tâche (déplacée directement dans la corbeille avec sous-tâches, sans interruption modale)
  async deleteTask(id) {
    const tasks = this.getAll();

    // Collecter récursivement tous les IDs supprimés (tâche parente et sous-tâches)
    const deletedIds = new Set();
    const collectIdsRecursive = (t) => {
      if (!t) return;
      deletedIds.add(t.id);
      if (t.subtasks && Array.isArray(t.subtasks)) {
        t.subtasks.forEach(collectIdsRecursive);
      }
    };

    const targetFound = this.findTaskRecursive(tasks, id);
    if (targetFound && targetFound.task) {
      collectIdsRecursive(targetFound.task);
      // Déplacement automatique dans la corbeille
      if (typeof TrashManager !== 'undefined' && typeof TrashManager.moveToTrash === 'function') {
        TrashManager.moveToTrash('task', targetFound.task);
      }
    } else {
      deletedIds.add(id);
    }

    // Fonction récursive de suppression dans l'arborescence des tâches
    const removeRecursive = (list) => {
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list.splice(idx, 1);
        return true;
      }
      for (const t of list) {
        if (t.subtasks && t.subtasks.length > 0) {
          if (removeRecursive(t.subtasks)) return true;
        }
      }
      return false;
    };

    removeRecursive(tasks);
    this.saveAll(tasks);

    // RÈGLE IMPÉRATIVE N°3 :
    // Nettoyer les références orphelines (taskId = null) sans JAMAIS supprimer les événements de l'agenda
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function') {
      try {
        const events = StorageManager.getEvents();
        let eventsModified = false;
        for (const evt of events) {
          if (evt.taskId && deletedIds.has(evt.taskId)) {
            evt.taskId = null;
            evt.updatedAt = new Date().toISOString();
            eventsModified = true;
          }
        }
        if (eventsModified) {
          StorageManager.saveEvents(events);
          if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.render === 'function') {
            window.AgendaManager.render();
          }
        }
      } catch (err) {
        console.warn("[TasksManager] Erreur lors du nettoyage des liaisons d'agenda :", err);
      }
    }

    this._showToast("Tâche déplacée dans la corbeille", "info");
  },

  // Réorganisation manuelle : Monter
  moveUp(id) {
    const tasks = this.getAll();
    const found = this.findTaskRecursive(tasks, id);
    if (!found) return;
    const list = found.parentList;
    const idx = list.findIndex(t => t.id === id);
    if (idx > 0) {
      const temp = list[idx - 1];
      list[idx - 1] = list[idx];
      list[idx] = temp;
      this.saveAll(tasks);
    }
  },

  // Réorganisation manuelle : Descendre
  moveDown(id) {
    const tasks = this.getAll();
    const found = this.findTaskRecursive(tasks, id);
    if (!found) return;
    const list = found.parentList;
    const idx = list.findIndex(t => t.id === id);
    if (idx < list.length - 1) {
      const temp = list[idx + 1];
      list[idx + 1] = list[idx];
      list[idx] = temp;
      this.saveAll(tasks);
    }
  },

  // Basculer l'état déplié/replié
  toggleCollapse(id) {
    const isNowCollapsed = !this.collapsedTasks.has(id);
    if (isNowCollapsed) {
      this.collapsedTasks.add(id);
    } else {
      this.collapsedTasks.delete(id);
    }
    // Optimisation UX : rotation fluide directe du chevron et masquage sans refonte DOM
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const node = document.querySelector(`.task-tree-node[data-task-id="${id}"]`);
      if (node) {
        const toggleBtn = node.querySelector('.task-toggle');
        const subContainer = node.querySelector('.subtasks-container');
        if (toggleBtn) {
          toggleBtn.classList.toggle('collapsed', isNowCollapsed);
          toggleBtn.title = isNowCollapsed ? 'Déplier les sous-tâches' : 'Réduire les sous-tâches';
        }
        if (subContainer) {
          subContainer.classList.toggle('collapsed', isNowCollapsed);
          subContainer.style.display = isNowCollapsed ? 'none' : 'flex';
        }
        this.updateToggleCollapseButton();
        return;
      }
    }
    this.render();
  },

  // Rendu de l'écran des tâches
  render() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const container = document.getElementById('tasks-tree-container');
    if (!container) return;

    // Synchroniser l'état visuel de l'onglet de tri actif
    document.querySelectorAll('.tasks-sort-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.sort === this.currentSortMode);
    });

    const tasks = this.getAll();
    const projects = StorageManager.getProjects();
    const projectsMap = new Map(projects.map(p => [p.id, p]));
    const archivedProjectIds = new Set(projects.filter(p => p.archived).map(p => p.id));

    // Mettre à jour le sélecteur de projets dans les filtres
    this.updateProjectFilterOptions(projects);

    // Mettre à jour les compteurs dynamiques sur les puces de filtres
    this.updateFilterCounts(tasks);

    // Mettre à jour l'intitulé et l'icône du bouton unique Tout replier / Tout déplier
    this.updateToggleCollapseButton();

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="antigravite-empty-state tasks-empty-state">
          <div class="empty-state-illustration">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h3 class="empty-state-title">Esprit libre</h3>
          <p class="empty-state-text">Toutes vos pensées sont ordonnées. Prenez un instant pour souffler ou définissez votre prochain objectif.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="TasksManager.openTaskModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> <span>Créer une première tâche</span></button>
        </div>
      `;
      return;
    }

    const _frag = typeof document.createDocumentFragment === 'function' ? document.createDocumentFragment() : null;
    const useFrag = !!(_frag && (_frag.nodeType === 11 || typeof DocumentFragment !== 'undefined'));
    const rootTarget = useFrag ? _frag : container;
    if (!useFrag) container.innerHTML = '';
    const nowTime = Date.now();
    const isManualSort = this.currentSortMode === 'manual';
    
    // Rendu récursif sous forme d'arborescence structurée
    const renderTaskList = (list, parentEl, level = 0) => {
      list.forEach((task, index) => {
        // Filtrage de visibilité (sans réorganiser les données)
        const matchesFilter = 
          this.currentFilter === 'all' ? true :
          this.currentFilter === 'active' ? !task.completed :
          this.currentFilter === 'completed' ? task.completed : true;

        const isProjectArchived = task.projectId ? archivedProjectIds.has(task.projectId) : false;
        const matchesProject = 
          this.currentProjectFilter === 'all' ? !isProjectArchived :
          task.projectId === this.currentProjectFilter;

        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const isCollapsed = this.collapsedTasks.has(task.id);

        const node = document.createElement('div');
        node.className = `task-tree-node level-${Math.min(level, 6)} ${level === 0 ? 'is-root' : 'is-child'}`;
        node.dataset.taskId = task.id;
        node.dataset.level = level;

        const project = task.projectId ? projectsMap.get(task.projectId) : null;

        const item = document.createElement('div');
        item.className = `task-item draggable-item ${task.completed ? 'completed' : ''}`;
        item.draggable = isManualSort;
        item.dataset.taskId = task.id;
        item.dataset.level = level;

        // Signifier par la couleur l'appartenance au projet
        if (project && project.color) {
          item.style.borderLeft = `4.5px solid ${project.color}`;
          item.dataset.hasProject = 'true';
          if (item.style && typeof item.style.setProperty === 'function') {
            item.style.setProperty('--task-project-color', project.color);
          }
        }

        // Événements Glisser-Déposer (Drag and Drop - actif uniquement en ordre manuel)
        item.addEventListener('dragstart', (e) => {
          if (!isManualSort) {
            e.preventDefault();
            return;
          }
          if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, .task-toggle, .task-checkbox, .task-actions, input, select')) {
            e.preventDefault();
            return;
          }
          this.draggedTaskId = task.id;
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
          setTimeout(() => item.classList.add('dragging'), 0);
          const rootZone = document.getElementById('tasks-root-dropzone');
          if (rootZone) rootZone.classList.add('drag-active');

          // Pré-calculer l'ensemble des IDs interdits (soi-même et tous ses descendants)
          // pour éviter les lectures localStorage et parcours récursifs à chaque événement dragover
          this._draggedForbiddenIds = new Set([task.id]);
          const collectDescendants = (t) => {
            if (t.subtasks && t.subtasks.length > 0) {
              for (const sub of t.subtasks) {
                this._draggedForbiddenIds.add(sub.id);
                collectDescendants(sub);
              }
            }
          };
          collectDescendants(task);
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          document.querySelectorAll('.task-item').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-nest');
          });
          const rootZone = document.getElementById('tasks-root-dropzone');
          if (rootZone) {
            rootZone.classList.remove('drag-active', 'drag-over');
          }
          this.draggedTaskId = null;
          this._draggedForbiddenIds = null;
        });

        item.addEventListener('dragover', (e) => {
          if (!isManualSort || !this.draggedTaskId || (this._draggedForbiddenIds && this._draggedForbiddenIds.has(task.id))) return;

          e.preventDefault();
          e.stopPropagation();

          const rect = item.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const h = rect.height;

          item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-nest');

          if (relY < h * 0.28) {
            item.classList.add('drag-over-top');
            item.dataset.dropPos = 'before';
          } else if (relY > h * 0.72) {
            item.classList.add('drag-over-bottom');
            item.dataset.dropPos = 'after';
          } else {
            item.classList.add('drag-over-nest');
            item.dataset.dropPos = 'inside';
          }
        });

        item.addEventListener('dragleave', (e) => {
          if (!item.contains(e.relatedTarget)) {
            item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-nest');
          }
        });

        item.addEventListener('drop', (e) => {
          if (!this.draggedTaskId || this.draggedTaskId === task.id) return;
          e.preventDefault();
          e.stopPropagation();

          const pos = item.dataset.dropPos || 'inside';
          item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-nest');

          this.moveTask(this.draggedTaskId, task.id, pos);
        });

        // Masquer si non conforme au filtre (mais laisser visible si une de ses sous-tâches correspond)
        const hasMatchingSubtask = hasSubtasks && this.hasMatchingChild(task.subtasks, matchesFilter, matchesProject, archivedProjectIds);
        if (!matchesFilter || !matchesProject) {
          if (!hasMatchingSubtask) {
            node.style.display = 'none';
          }
        }

        const deadlineDate = task.deadline ? new Date(task.deadline) : null;
        const isOverdue = deadlineDate && deadlineDate.getTime() < nowTime && !task.completed;

        let subtasksBadge = '';
        if (hasSubtasks) {
          const completedCount = task.subtasks.filter(s => s.completed).length;
          const totalCount = task.subtasks.length;
          const allDone = completedCount === totalCount && totalCount > 0;
          subtasksBadge = `<span class="badge ${allDone ? 'badge-subtasks-all' : 'badge-subtasks-progress'}" title="${completedCount}/${totalCount} sous-tâche(s) terminée(s)">${allDone ? '✓ ' : ''}${completedCount}/${totalCount}</span>`;
        }

        item.innerHTML = `
          <div class="task-row">
            <div class="task-drag-handle" ${!isManualSort ? 'style="opacity:0.25; cursor:not-allowed;"' : ''} title="${isManualSort ? 'Glisser pour réorganiser, imbriquer en sous-tâche ou monter de niveau' : 'Le tri actif est ' + this.getSortModeLabel() + '. Activez « Mon ordre » pour réorganiser manuellement.'}">⠿</div>

            ${hasSubtasks ? `
              <button type="button" class="task-toggle ${isCollapsed ? 'collapsed' : ''}" draggable="false" onmousedown="event.stopPropagation();" onclick="event.preventDefault(); event.stopPropagation(); TasksManager.toggleCollapse('${task.id}');" title="${isCollapsed ? 'Déplier les sous-tâches' : 'Réduire les sous-tâches'}" aria-label="Déplier / replier">
                <span class="task-toggle-icon" style="pointer-events: none;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
              </button>
            ` : '<div class="task-toggle-spacer"><span class="tree-bullet">•</span></div>'}
            
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="TasksManager.toggleCompleted('${task.id}')" title="${task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}">
              ${task.completed ? '✓' : ''}
            </div>

            <div class="task-title" onclick="TasksManager.openTaskModal('${task.id}')" title="${this.escapeHtml(task.title)}" style="cursor: pointer;">
              ${this.escapeHtml(task.title)}
            </div>

            <div class="task-badges">
              ${project ? `<span class="badge badge-project badge-clickable" style="border:1px solid ${project.color}70; color:${project.color}; background-color:${project.color}1c; font-weight:600; cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('projects'); if (window.ProjectsManager) ProjectsManager.openProjectDetailModal('${project.id}');" title="Ouvrir le projet : ${this.escapeHtml(project.title)}"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${project.color};"></span><span>${this.escapeHtml(project.title)}</span></span>` : ''}
              ${this.getPriorityBadge(task.priority)}
              ${task.plannedDate ? `<span class="badge badge-planned badge-clickable" style="cursor:pointer;" onclick="event.stopPropagation(); if (window.App) window.App.navigate('agenda'); if (window.AgendaManager) { const d = new Date('${task.plannedDate.slice(0, 10)}'); if (!isNaN(d.getTime())) { AgendaManager.zoomToDay('${task.plannedDate.slice(0, 10)}'); } }" title="Consulter dans l'agenda (${task.plannedDate})"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Prévu : ${task.plannedDate}</span></span>` : ''}
              ${task.deadline ? `<span class="badge badge-deadline ${isOverdue ? 'overdue' : ''}" title="Échéance limite">${isOverdue ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>'}<span>Échéance : ${task.deadline.replace('T', ' ')}</span></span>` : ''}
              ${subtasksBadge}
            </div>

            <div class="task-actions">
              <div class="task-action-group order-group" style="${!isManualSort ? 'display:none;' : ''}" title="Déplacer dans l'arborescence">
                <button class="btn-icon" title="Monter d'un niveau (outdent)" onclick="TasksManager.outdentTask('${task.id}')" ${level === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button class="btn-icon" title="Mettre en sous-tâche de la précédente (indent)" onclick="TasksManager.indentTask('${task.id}')" ${index === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                <button class="btn-icon" title="Monter" onclick="TasksManager.moveUp('${task.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                <button class="btn-icon" title="Descendre" onclick="TasksManager.moveDown('${task.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
              </div>
                <button class="btn-icon" title="Monter d'un niveau (outdent)" onclick="TasksManager.outdentTask('${task.id}')" ${level === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button class="btn-icon" title="Mettre en sous-tâche de la précédente (indent)" onclick="TasksManager.indentTask('${task.id}')" ${index === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                <button class="btn-icon" title="Monter" onclick="TasksManager.moveUp('${task.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                <button class="btn-icon" title="Descendre" onclick="TasksManager.moveDown('${task.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
              </div>
              <div class="task-action-group item-group">
                <button class="btn-icon btn-action-add" title="Ajouter une sous-tâche" onclick="TasksManager.openTaskModal(null, '${task.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button class="btn-icon btn-action-edit" title="Modifier" onclick="TasksManager.openTaskModal('${task.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn-icon btn-action-delete" title="Supprimer" onclick="TasksManager.deleteTask('${task.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
          </div>
        `;

        node.appendChild(item);

        // Sous-tâches
        if (hasSubtasks) {
          const subContainer = document.createElement('div');
          subContainer.className = `subtasks-container ${isCollapsed ? 'collapsed' : ''}`;
          if (isCollapsed) {
            subContainer.style.display = 'none';
          }
          node.appendChild(subContainer);
          renderTaskList(task.subtasks, subContainer, level + 1);
        }

        parentEl.appendChild(node);
      });
    };

    container.innerHTML = '';

    if (this.currentSortMode === 'project') {
      // Regroupement par projet
      const projectsToRender = this.currentProjectFilter === 'all'
        ? projects.filter(p => !p.archived)
        : projects.filter(p => p.id === this.currentProjectFilter);

      let renderedGroupsCount = 0;

      for (const proj of projectsToRender) {
        const projTasks = tasks.filter(t => t.projectId === proj.id);
        if (projTasks.length === 0) continue;

        const hasVisibleTasks = projTasks.some(t => {
          if (this.currentFilter === 'all') return true;
          if (this.currentFilter === 'active') return !t.completed || (t.subtasks && this.hasMatchingChild(t.subtasks, true, true, archivedProjectIds));
          if (this.currentFilter === 'completed') return t.completed || (t.subtasks && this.hasMatchingChild(t.subtasks, true, true, archivedProjectIds));
          return true;
        });

        if (!hasVisibleTasks && this.currentFilter !== 'all') continue;

        renderedGroupsCount++;
        const groupEl = document.createElement('div');
        groupEl.className = 'tasks-project-group';
        groupEl.dataset.projectId = proj.id;

        const headerEl = document.createElement('div');
        headerEl.className = 'tasks-project-group-header';
        headerEl.innerHTML = `
          <span class="tasks-project-group-indicator" style="background-color: ${proj.color || '#6366f1'}; color: ${proj.color || '#6366f1'};"></span>
          <span class="tasks-project-group-title">${this.escapeHtml(proj.title)}</span>
          <span class="tasks-project-group-count">${projTasks.length} tâche${projTasks.length > 1 ? 's' : ''}</span>
        `;
        groupEl.appendChild(headerEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'tasks-project-group-body';
        renderTaskList(projTasks, bodyEl, 0);
        groupEl.appendChild(bodyEl);

        rootTarget.appendChild(groupEl);
      }

      if (this.currentProjectFilter === 'all') {
        const unassignedTasks = tasks.filter(t => !t.projectId || !projectsMap.has(t.projectId));
        if (unassignedTasks.length > 0) {
          const hasVisibleUnassigned = unassignedTasks.some(t => {
            if (this.currentFilter === 'all') return true;
            if (this.currentFilter === 'active') return !t.completed || (t.subtasks && this.hasMatchingChild(t.subtasks, true, true, archivedProjectIds));
            if (this.currentFilter === 'completed') return t.completed || (t.subtasks && this.hasMatchingChild(t.subtasks, true, true, archivedProjectIds));
            return true;
          });

          if (hasVisibleUnassigned || this.currentFilter === 'all') {
            renderedGroupsCount++;
            const unassignedGroupEl = document.createElement('div');
            unassignedGroupEl.className = 'tasks-project-group';
            unassignedGroupEl.dataset.projectId = 'unassigned';

            const unassignedHeader = document.createElement('div');
            unassignedHeader.className = 'tasks-project-group-header';
            unassignedHeader.innerHTML = `
              <span class="tasks-project-group-indicator" style="background-color: var(--text-muted); color: var(--text-muted);"></span>
              <span class="tasks-project-group-title">Sans projet</span>
              <span class="tasks-project-group-count">${unassignedTasks.length} tâche${unassignedTasks.length > 1 ? 's' : ''}</span>
            `;
            unassignedGroupEl.appendChild(unassignedHeader);

            const unassignedBody = document.createElement('div');
            unassignedBody.className = 'tasks-project-group-body';
            renderTaskList(unassignedTasks, unassignedBody, 0);
            unassignedGroupEl.appendChild(unassignedBody);

            rootTarget.appendChild(unassignedGroupEl);
          }
        }
      }

      if (renderedGroupsCount === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.className = 'antigravite-empty-state tasks-empty-state';
        emptyNotice.style.padding = '32px 20px';
        emptyNotice.innerHTML = `
          <p class="empty-state-text">Aucune tâche ne correspond aux critères de filtre sélectionnés.</p>
        `;
        rootTarget.appendChild(emptyNotice);
      }
    } else {
      let tasksToRender = tasks;
      if (this.currentSortMode === 'created') {
        tasksToRender = this._sortTasksByCreated(tasks);
      } else if (this.currentSortMode === 'priority') {
        tasksToRender = this._sortTasksByPriority(tasks);
      }
      renderTaskList(tasksToRender, rootTarget, 0);
    }

    // Bouton "+" d'ajout rapide au pied de l'arborescence
    const bottomAddBtn = document.createElement('div');
    bottomAddBtn.id = 'tasks-bottom-add-btn';
    bottomAddBtn.className = 'tasks-bottom-add-btn';
    bottomAddBtn.title = 'Créer une nouvelle tâche';
    bottomAddBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Ajouter une nouvelle tâche</span>
    `;
    bottomAddBtn.onclick = () => this.openTaskModal();
    rootTarget.appendChild(bottomAddBtn);

    // Zone de dépôt au bas de la liste pour monter une tâche au niveau principal (active uniquement en ordre manuel)
    if (isManualSort) {
      const rootDropZone = document.createElement('div');
      rootDropZone.id = 'tasks-root-dropzone';
      rootDropZone.className = 'tasks-root-dropzone';
      rootDropZone.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Glisser ici pour placer au niveau principal (racine)</span>`;

      rootDropZone.addEventListener('dragover', (e) => {
        if (!this.draggedTaskId) return;
        e.preventDefault();
        rootDropZone.classList.add('drag-over');
      });

      rootDropZone.addEventListener('dragleave', () => {
        rootDropZone.classList.remove('drag-over');
      });

      rootDropZone.addEventListener('drop', (e) => {
        if (!this.draggedTaskId) return;
        e.preventDefault();
        rootDropZone.classList.remove('drag-over');
        this.moveTask(this.draggedTaskId, null, 'root-bottom');
      });

      rootTarget.appendChild(rootDropZone);
    }
    if (useFrag) {
      container.innerHTML = '';
      container.appendChild(rootTarget);
    }
  },

  hasMatchingChild(subtasks, filterMatch, projMatch, archivedProjectIds = null) {
    if (!subtasks || subtasks.length === 0) return false;
    if (!archivedProjectIds) {
      const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
        ? StorageManager.getProjects()
        : [];
      archivedProjectIds = new Set(projects.filter(p => p.archived).map(p => p.id));
    }

    for (const st of subtasks) {
      const isArchived = st.projectId ? archivedProjectIds.has(st.projectId) : false;
      if (this.currentProjectFilter === 'all' && isArchived) continue;

      if (this.currentFilter === 'all' || (this.currentFilter === 'active' && !st.completed) || (this.currentFilter === 'completed' && st.completed)) {
        if (this.currentProjectFilter === 'all' || st.projectId === this.currentProjectFilter) return true;
      }
      if (st.subtasks && this.hasMatchingChild(st.subtasks, filterMatch, projMatch, archivedProjectIds)) return true;
    }
    return false;
  },

  getPriorityBadge(priority) {
    switch (priority) {
      case 'urgent': return '<span class="badge badge-priority-urgent"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg><span>Urgent</span></span>';
      case 'high': return '<span class="badge badge-priority-high"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Élevée</span></span>';
      case 'medium': return '<span class="badge badge-priority-medium">Normale</span>';
      case 'low': return '<span class="badge badge-priority-low">Basse</span>';
      default: return '';
    }
  },

  updateProjectFilterOptions(projects) {
    const select = document.getElementById('task-project-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="all">Tous les projets actifs</option>';

    const activeProjects = (projects || []).filter(p => !p.archived);
    const archivedProjects = (projects || []).filter(p => p.archived);

    const activeHier = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
      ? StorageManager.getProjectsHierarchy(activeProjects)
      : activeProjects.map(p => ({ project: p, displayTitle: p.title }));

    activeHier.forEach(({ project: p, displayTitle }) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = displayTitle;
      select.appendChild(opt);
    });

    if (archivedProjects.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Projets archivés';
      const archHier = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
        ? StorageManager.getProjectsHierarchy(archivedProjects)
        : archivedProjects.map(p => ({ project: p, displayTitle: p.title }));
      archHier.forEach(({ project: p, displayTitle }) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${displayTitle} (Archivé)`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
    select.value = currentVal;
  },

  // Modale de création / édition
  openTaskModal(taskId = null, parentId = null) {
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('task-modal-title');
    const inputTitle = document.getElementById('task-input-title');
    const inputDesc = document.getElementById('task-input-desc');
    const inputProject = document.getElementById('task-input-project');
    const inputPriority = document.getElementById('task-input-priority');
    const inputPlanned = document.getElementById('task-input-planned');
    const inputPlannedTime = document.getElementById('task-input-planned-time');
    const inputDeadline = document.getElementById('task-input-deadline');
    const btnSave = document.getElementById('task-modal-save');

    // Remplir la liste des projets (avec hiérarchie des sous-projets)
    const projects = StorageManager.getProjects();
    const hierProjects = (typeof StorageManager.getProjectsHierarchy === 'function')
      ? StorageManager.getProjectsHierarchy(projects)
      : projects.map(p => ({ project: p, displayTitle: p.title }));
    inputProject.innerHTML = '<option value="">(Aucun projet)</option>';
    hierProjects.forEach(({ project: p, displayTitle }) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = displayTitle + (p.archived ? ' (Archivé)' : '');
      inputProject.appendChild(opt);
    });

    const syncHiddenPlannedTime = () => {
      if (!inputPlannedTime) return;
      const raw = inputPlanned ? (inputPlanned.value || '') : '';
      inputPlannedTime.value = raw.length >= 16 ? raw.slice(11, 16) : '09:00';
    };
    if (inputPlanned) {
      inputPlanned.oninput = syncHiddenPlannedTime;
      inputPlanned.onchange = syncHiddenPlannedTime;
    }

    const extractPlannedFields = () => {
      const raw = inputPlanned ? (inputPlanned.value || '').trim() : '';
      if (!raw) return { plannedDate: null, plannedTime: '09:00' };
      const plannedDate = raw.slice(0, 10);
      const plannedTime = raw.length >= 16
        ? raw.slice(11, 16)
        : (inputPlannedTime && inputPlannedTime.value ? inputPlannedTime.value : '09:00');
      return { plannedDate, plannedTime };
    };

    if (taskId) {
      // Mode modification
      const found = this.findTaskRecursive(this.getAll(), taskId);
      if (!found) return;
      const t = found.task;
      modalTitle.textContent = "Modifier la tâche";
      inputTitle.value = t.title;
      inputDesc.value = t.description || '';
      inputProject.value = t.projectId || '';
      inputPriority.value = t.priority || 'medium';
      const initTime = t.plannedTime || (t.plannedDate && t.plannedDate.length >= 16 ? t.plannedDate.slice(11, 16) : '09:00');
      inputPlanned.value = t.plannedDate ? `${t.plannedDate.slice(0, 10)}T${initTime}` : '';
      if (inputPlannedTime) inputPlannedTime.value = initTime;
      inputDeadline.value = t.deadline || '';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le titre est requis.");
        const { plannedDate, plannedTime } = extractPlannedFields();
        this.updateTask(taskId, {
          title: inputTitle.value,
          description: inputDesc.value,
          projectId: inputProject.value || null,
          priority: inputPriority.value,
          plannedDate,
          plannedTime,
          deadline: inputDeadline.value || null
        });
        this.closeTaskModal();
      };
    } else {
      // Mode création
      modalTitle.textContent = parentId ? "Ajouter une sous-tâche" : "Nouvelle tâche";
      inputTitle.value = '';
      inputDesc.value = '';
      inputProject.value = '';
      inputPriority.value = 'medium';
      inputPlanned.value = '';
      if (inputPlannedTime) inputPlannedTime.value = '09:00';
      inputDeadline.value = '';

      // Si c'est une sous-tâche, hériter facultativement du projet parent
      if (parentId) {
        const parentFound = this.findTaskRecursive(this.getAll(), parentId);
        if (parentFound && parentFound.task.projectId) {
          inputProject.value = parentFound.task.projectId;
        }
      }

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le titre est requis.");
        const { plannedDate, plannedTime } = extractPlannedFields();
        this.addTask({
          title: inputTitle.value,
          description: inputDesc.value,
          projectId: inputProject.value || null,
          priority: inputPriority.value,
          plannedDate,
          plannedTime,
          deadline: inputDeadline.value || null
        }, parentId);
        this.closeTaskModal();
      };
    }

    modal.classList.add('active');
    inputTitle.focus();
  },

  closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.TasksManager = TasksManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TasksManager;
}
