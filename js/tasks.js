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
  currentFilter: 'all',
  currentProjectFilter: 'all',
  collapsedTasks: new Set(),
  draggedTaskId: null,

  init() {
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    // Bouton nouvelle tâche principale
    const btnNew = document.getElementById('btn-new-task');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openTaskModal());
    }

    // Boutons de dépliage / repliage complet de l'arborescence
    const btnExpand = document.getElementById('btn-tasks-expand-all');
    if (btnExpand) {
      btnExpand.addEventListener('click', () => this.expandAll());
    }
    const btnCollapse = document.getElementById('btn-tasks-collapse-all');
    if (btnCollapse) {
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

  // Déplier l'ensemble de l'arborescence
  expandAll() {
    this.collapsedTasks.clear();
    this.render();
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

    const countRecursive = (list) => {
      for (const t of list) {
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
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateDashboard === 'function') {
      window.App.updateDashboard();
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
      plannedDate: taskData.plannedDate || null,
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

    // EXIGENCE : Si la tâche est programmée, créer obligatoirement un créneau dans l'agenda Antigravité
    if (newTask.plannedDate) {
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

    found.task.title = updatedData.title.trim();
    found.task.description = updatedData.description !== undefined ? updatedData.description.trim() : found.task.description;
    found.task.projectId = updatedData.projectId !== undefined ? updatedData.projectId : found.task.projectId;
    found.task.priority = updatedData.priority || found.task.priority;
    found.task.deadline = updatedData.deadline !== undefined ? updatedData.deadline : found.task.deadline;
    found.task.plannedDate = updatedData.plannedDate !== undefined ? updatedData.plannedDate : found.task.plannedDate;
    found.task.updatedAt = new Date().toISOString();

    this.saveAll(tasks);

    // EXIGENCE : Si la tâche est programmée, créer ou actualiser obligatoirement le créneau dans l'agenda
    if (found.task.plannedDate) {
      this.syncPlannedDateToAgenda(found.task);
    }

    this._showToast("Tâche mise à jour", "info");
    return true;
  },

  // Synchronisation obligatoire : programmer une tâche ajoute un créneau dans l'agenda Antigravité de base
  syncPlannedDateToAgenda(task) {
    if (!task || !task.plannedDate) return;
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getEvents !== 'function') return;

    const events = StorageManager.getEvents();
    let linkedEvent = events.find(e => e.taskId === task.id);

    const dateOnly = task.plannedDate.slice(0, 10);
    const hasSpecificTime = task.plannedDate.length >= 16;
    const startTime = hasSpecificTime ? task.plannedDate.slice(11, 16) : '09:00';
    
    // Calculer heure de fin (+1 heure par défaut)
    const [h, m] = startTime.split(':').map(Number);
    const endH = Math.min(23, (h || 9) + 1);
    const endTime = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;

    if (linkedEvent) {
      // Mettre à jour l'événement existant dans l'agenda
      linkedEvent.title = task.title;
      if (task.description) linkedEvent.description = task.description;
      linkedEvent.start = `${dateOnly}T${startTime}`;
      linkedEvent.end = `${dateOnly}T${endTime}`;
      linkedEvent.updatedAt = new Date().toISOString();
      StorageManager.saveEvents(events);
    } else {
      // Créer obligatoirement le créneau dans l'agenda Antigravité de base (source: 'local')
      const newEvent = {
        id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: task.title,
        description: task.description || '',
        location: '',
        start: `${dateOnly}T${startTime}`,
        end: `${dateOnly}T${endTime}`,
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

  // Supprimer une tâche (et toutes ses sous-tâches récursivement)
  deleteTask(id) {
    if (typeof confirm === 'function' && !confirm("Voulez-vous vraiment supprimer cette tâche et ses éventuelles sous-tâches ?")) return;
    const tasks = this.getAll();
    
    // Fonction récursive de suppression
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
    this._showToast("Tâche supprimée", "info");
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
    if (this.collapsedTasks.has(id)) {
      this.collapsedTasks.delete(id);
    } else {
      this.collapsedTasks.add(id);
    }
    this.render();
  },

  // Rendu de l'écran des tâches
  render() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const container = document.getElementById('tasks-tree-container');
    if (!container) return;

    const tasks = this.getAll();
    const projects = StorageManager.getProjects();
    const projectsMap = new Map(projects.map(p => [p.id, p]));

    // Mettre à jour le sélecteur de projets dans les filtres
    this.updateProjectFilterOptions(projects);

    // Mettre à jour les compteurs dynamiques sur les puces de filtres
    this.updateFilterCounts(tasks);

    if (tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 10px;">📋</div>
          <p>Aucune tâche pour le moment.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="TasksManager.openTaskModal()">Créer une première tâche</button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    // Rendu récursif sous forme d'arborescence structurée
    const renderTaskList = (list, parentEl, level = 0) => {
      list.forEach((task, index) => {
        // Filtrage de visibilité (sans réorganiser les données)
        const matchesFilter = 
          this.currentFilter === 'all' ? true :
          this.currentFilter === 'active' ? !task.completed :
          this.currentFilter === 'completed' ? task.completed : true;

        const matchesProject = 
          this.currentProjectFilter === 'all' ? true :
          task.projectId === this.currentProjectFilter;

        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const isCollapsed = this.collapsedTasks.has(task.id);

        const node = document.createElement('div');
        node.className = `task-tree-node level-${Math.min(level, 6)} ${level === 0 ? 'is-root' : 'is-child'}`;
        node.dataset.taskId = task.id;
        node.dataset.level = level;

        const item = document.createElement('div');
        item.className = `task-item draggable-item ${task.completed ? 'completed' : ''}`;
        item.draggable = true;
        item.dataset.taskId = task.id;
        item.dataset.level = level;

        // Événements Glisser-Déposer (Drag and Drop)
        item.addEventListener('dragstart', (e) => {
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
          if (!this.draggedTaskId || (this._draggedForbiddenIds && this._draggedForbiddenIds.has(task.id))) return;

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
        const hasMatchingSubtask = hasSubtasks && this.hasMatchingChild(task.subtasks, matchesFilter, matchesProject);
        if (!matchesFilter || !matchesProject) {
          if (!hasMatchingSubtask) {
            node.style.display = 'none';
          }
        }

        const project = task.projectId ? projectsMap.get(task.projectId) : null;
        const now = new Date();
        const deadlineDate = task.deadline ? new Date(task.deadline) : null;
        const isOverdue = deadlineDate && deadlineDate < now && !task.completed;

        let subtasksBadge = '';
        if (hasSubtasks) {
          const completedCount = task.subtasks.filter(s => s.completed).length;
          const totalCount = task.subtasks.length;
          const allDone = completedCount === totalCount && totalCount > 0;
          subtasksBadge = `<span class="badge ${allDone ? 'badge-subtasks-all' : 'badge-subtasks-progress'}" title="${completedCount}/${totalCount} sous-tâche(s) terminée(s)">${allDone ? '✓ ' : ''}${completedCount}/${totalCount}</span>`;
        }

        item.innerHTML = `
          <div class="task-row">
            <div class="task-drag-handle" title="Glisser pour réorganiser, imbriquer en sous-tâche ou monter de niveau">⠿</div>

            ${hasSubtasks ? `
              <button class="task-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="TasksManager.toggleCollapse('${task.id}')" title="${isCollapsed ? 'Déplier la branche' : 'Replier la branche'}" aria-label="Déplier / replier">
                <span class="task-toggle-icon">${isCollapsed ? '▶' : '▼'}</span>
              </button>
            ` : '<div class="task-toggle-spacer"><span class="tree-bullet">•</span></div>'}
            
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="TasksManager.toggleCompleted('${task.id}')" title="${task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}">
              ${task.completed ? '✓' : ''}
            </div>

            <div class="task-title" onclick="TasksManager.openTaskModal('${task.id}')" title="Cliquer pour modifier" style="cursor: pointer;">
              ${this.escapeHtml(task.title)}
            </div>

            <div class="task-badges">
              ${project ? `<span class="badge badge-project" style="border-color:${project.color}; color:${project.color};">${this.escapeHtml(project.title)}</span>` : ''}
              ${this.getPriorityBadge(task.priority)}
              ${task.plannedDate ? `<span class="badge badge-planned" title="Date prévue de réalisation">📅 Prévu : ${task.plannedDate}</span>` : ''}
              ${task.deadline ? `<span class="badge badge-deadline ${isOverdue ? 'overdue' : ''}" title="Échéance limite">${isOverdue ? '⚠️ ' : '⏳ '}Échéance : ${task.deadline.replace('T', ' ')}</span>` : ''}
              ${subtasksBadge}
            </div>

            <div class="task-actions">
              <div class="task-action-group order-group" title="Déplacer dans l'arborescence">
                <button class="btn-icon" title="Monter d'un niveau (outdent)" onclick="TasksManager.outdentTask('${task.id}')" ${level === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}>◀</button>
                <button class="btn-icon" title="Mettre en sous-tâche de la précédente (indent)" onclick="TasksManager.indentTask('${task.id}')" ${index === 0 ? 'disabled style="opacity:0.25; cursor:default;"' : ''}>▶</button>
                <button class="btn-icon" title="Monter" onclick="TasksManager.moveUp('${task.id}')">▲</button>
                <button class="btn-icon" title="Descendre" onclick="TasksManager.moveDown('${task.id}')">▼</button>
              </div>
              <div class="task-action-group item-group">
                <button class="btn-icon btn-action-add" title="Ajouter une sous-tâche" onclick="TasksManager.openTaskModal(null, '${task.id}')">➕</button>
                <button class="btn-icon btn-action-edit" title="Modifier" onclick="TasksManager.openTaskModal('${task.id}')">✏️</button>
                <button class="btn-icon btn-action-delete" title="Supprimer" onclick="TasksManager.deleteTask('${task.id}')">🗑️</button>
              </div>
            </div>
          </div>
        `;

        node.appendChild(item);

        // Sous-tâches
        if (hasSubtasks) {
          const subContainer = document.createElement('div');
          // Déplier automatiquement si une sous-tâche correspond au filtre actuel
          const forceExpand = isCollapsed && hasMatchingSubtask && (this.currentFilter !== 'all' || this.currentProjectFilter !== 'all');
          subContainer.className = `subtasks-container ${isCollapsed && !forceExpand ? 'collapsed' : ''}`;
          node.appendChild(subContainer);
          renderTaskList(task.subtasks, subContainer, level + 1);
        }

        parentEl.appendChild(node);
      });
    };

    renderTaskList(tasks, container, 0);

    // Zone de dépôt au bas de la liste pour monter une tâche au niveau principal (racine)
    const rootDropZone = document.createElement('div');
    rootDropZone.id = 'tasks-root-dropzone';
    rootDropZone.className = 'tasks-root-dropzone';
    rootDropZone.innerHTML = `<span>📥 Glisser ici pour placer au niveau principal (racine)</span>`;

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

    container.appendChild(rootDropZone);
  },

  hasMatchingChild(subtasks, filterMatch, projMatch) {
    for (const st of subtasks) {
      if (this.currentFilter === 'all' || (this.currentFilter === 'active' && !st.completed) || (this.currentFilter === 'completed' && st.completed)) {
        if (this.currentProjectFilter === 'all' || st.projectId === this.currentProjectFilter) return true;
      }
      if (st.subtasks && this.hasMatchingChild(st.subtasks, filterMatch, projMatch)) return true;
    }
    return false;
  },

  getPriorityBadge(priority) {
    switch (priority) {
      case 'urgent': return '<span class="badge badge-priority-urgent">🔥 Urgent</span>';
      case 'high': return '<span class="badge badge-priority-high">⚡ Élevée</span>';
      case 'medium': return '<span class="badge badge-priority-medium">Normale</span>';
      case 'low': return '<span class="badge badge-priority-low">Basse</span>';
      default: return '';
    }
  },

  updateProjectFilterOptions(projects) {
    const select = document.getElementById('task-project-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="all">Tous les projets</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title;
      select.appendChild(opt);
    });
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
    const inputDeadline = document.getElementById('task-input-deadline');
    const btnSave = document.getElementById('task-modal-save');

    // Remplir la liste des projets
    const projects = StorageManager.getProjects();
    inputProject.innerHTML = '<option value="">(Aucun projet)</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title;
      inputProject.appendChild(opt);
    });

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
      inputPlanned.value = t.plannedDate || '';
      inputDeadline.value = t.deadline || '';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le titre est requis.");
        this.updateTask(taskId, {
          title: inputTitle.value,
          description: inputDesc.value,
          projectId: inputProject.value || null,
          priority: inputPriority.value,
          plannedDate: inputPlanned.value || null,
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
        this.addTask({
          title: inputTitle.value,
          description: inputDesc.value,
          projectId: inputProject.value || null,
          priority: inputPriority.value,
          plannedDate: inputPlanned.value || null,
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
