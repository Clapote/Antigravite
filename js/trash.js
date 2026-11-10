/**
 * Antigravité - Module Corbeille & Restauration (Trash Manager)
 * Gestion locale et sécurisée des éléments supprimés (tâches, notes, projets).
 * Suppression directe sans interruption modale + conservation pendant 30 jours.
 */

const TrashManager = {
  currentFilter: 'all',
  initialized: false,

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    this.cleanExpired();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Bouton pour vider intégralement la corbeille
    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
      btnEmpty.addEventListener('click', () => this.emptyTrash());
    }

    // Filtres par type (Tous, Tâches, Notes, Projets)
    const chips = document.querySelectorAll('.trash-filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.currentFilter = target.dataset.filter || 'all';
        this.render();
      });
    });
  },

  getAll() {
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getTrash !== 'function') return [];
    return StorageManager.getTrash();
  },

  saveAll(list) {
    if (typeof StorageManager === 'undefined' || typeof StorageManager.saveTrash !== 'function') return;
    StorageManager.saveTrash(list);
  },

  // Déplacer un élément dans la corbeille (appelé lors de la suppression d'une tâche, note ou projet)
  moveToTrash(type, item) {
    if (!item || !type) return null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000); // Rétention 30 jours

    const trashRecord = {
      id: 'trash-' + now.getTime() + '-' + Math.random().toString(36).slice(2, 7),
      type: type, // 'task' | 'note' | 'project'
      title: item.title || '(Sans titre)',
      deletedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      data: JSON.parse(JSON.stringify(item))
    };

    const trash = this.getAll();
    trash.unshift(trashRecord);
    this.saveAll(trash);

    // Mettre à jour l'écran Corbeille s'il est affiché
    if (typeof window !== 'undefined' && window.App && window.App.currentScreen === 'trash') {
      this.render();
    }

    return trashRecord;
  },

  // Restaurer un élément vers son module d'origine
  restore(trashId) {
    const trash = this.getAll();
    const index = trash.findIndex(t => t.id === trashId);
    if (index === -1) return false;

    const [item] = trash.splice(index, 1);
    this.saveAll(trash);

    if (item.type === 'task') {
      const tasks = StorageManager.getTasks();
      tasks.push(item.data);
      StorageManager.saveTasks(tasks);
      if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.render === 'function') {
        window.TasksManager.render();
      }
    } else if (item.type === 'note') {
      const notes = StorageManager.getNotes();
      item.data.updatedAt = new Date().toISOString();
      notes.unshift(item.data);
      StorageManager.saveNotes(notes);
      if (typeof window !== 'undefined' && window.NotesManager && typeof window.NotesManager.render === 'function') {
        window.NotesManager.render();
      }
    } else if (item.type === 'project') {
      const projects = StorageManager.getProjects();
      projects.push(item.data);
      StorageManager.saveProjects(projects);
      if (typeof window !== 'undefined' && window.ProjectsManager && typeof window.ProjectsManager.render === 'function') {
        window.ProjectsManager.render();
      }
    }

    this.render();

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      const label = item.type === 'task' ? 'Tâche' : item.type === 'note' ? 'Note' : 'Projet';
      window.App.showToast(`${label} « ${this.escapeHtml(item.title)} » restauré(e) avec succès`, 'success');
    }

    return true;
  },

  // Supprimer définitivement un élément unique de la corbeille
  deletePermanently(trashId) {
    const trash = this.getAll();
    const filtered = trash.filter(t => t.id !== trashId);
    this.saveAll(filtered);
    this.render();

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Élément définitivement supprimé", "info");
    }
  },

  // Vider l'intégralité de la corbeille
  emptyTrash() {
    const trash = this.getAll();
    if (trash.length === 0) return;
    this.saveAll([]);
    this.render();

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("La corbeille a été entièrement vidée", "info");
    }
  },

  // Nettoyage automatique des éléments de plus de 30 jours
  cleanExpired() {
    const trash = this.getAll();
    const now = Date.now();
    const alive = trash.filter(item => {
      const expTime = new Date(item.expiresAt).getTime();
      return isNaN(expTime) || expTime > now;
    });

    if (alive.length !== trash.length) {
      this.saveAll(alive);
    }
  },

  // Calcul du nombre de jours restants avant suppression définitive
  getDaysRemaining(expiresAt) {
    if (!expiresAt) return 30;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (24 * 3600 * 1000));
  },

  // Rendu de l'écran Corbeille
  render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('trash-list-container');
    const emptyState = document.getElementById('trash-empty-state');
    const countAllEl = document.getElementById('trash-count-all');
    const countTasksEl = document.getElementById('trash-count-tasks');
    const countNotesEl = document.getElementById('trash-count-notes');
    const countProjectsEl = document.getElementById('trash-count-projects');
    const btnEmpty = document.getElementById('btn-empty-trash');

    if (!container) return;

    this.cleanExpired();
    const allItems = this.getAll();

    // Mettre à jour les compteurs
    const countTasks = allItems.filter(i => i.type === 'task').length;
    const countNotes = allItems.filter(i => i.type === 'note').length;
    const countProjects = allItems.filter(i => i.type === 'project').length;

    if (countAllEl) countAllEl.textContent = allItems.length;
    if (countTasksEl) countTasksEl.textContent = countTasks;
    if (countNotesEl) countNotesEl.textContent = countNotes;
    if (countProjectsEl) countProjectsEl.textContent = countProjects;

    if (btnEmpty) {
      btnEmpty.style.display = allItems.length > 0 ? 'inline-flex' : 'none';
    }

    // Filtrage
    const filtered = allItems.filter(item => {
      if (!this.currentFilter || this.currentFilter === 'all') return true;
      return item.type === this.currentFilter;
    });

    if (filtered.length === 0) {
      container.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        const msg = (allItems.length > 0)
          ? "Aucun élément de ce type dans la corbeille."
          : "La corbeille est vide. Vos suppressions récentes apparaîtront ici.";
        const subtext = (typeof emptyState.querySelector === 'function')
          ? emptyState.querySelector('.trash-empty-subtext')
          : null;
        if (subtext) subtext.textContent = msg;
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = '';

    const typeIcons = {
      task: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>Tâche</span>',
      note: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>Note</span>',
      project: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Projet</span>'
    };

    const typeColors = {
      task: '#38bdf8',
      note: '#a855f7',
      project: '#10b981'
    };

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'trash-item-card';

      const daysLeft = this.getDaysRemaining(item.expiresAt);
      const delDate = new Date(item.deletedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const badgeColor = typeColors[item.type] || '#94a3b8';
      const typeLabel = typeIcons[item.type] || 'Élément';

      // Détails contextuels selon le type
      let extraInfo = '';
      if (item.type === 'task' && item.data && item.data.subtasks && item.data.subtasks.length > 0) {
        extraInfo = ` • ${item.data.subtasks.length} sous-tâche(s)`;
      } else if (item.type === 'note' && item.data && item.data.folder) {
        extraInfo = ` • Dossier : ${this.escapeHtml(item.data.folder)}`;
      }

      card.innerHTML = `
        <div class="trash-item-left">
          <div class="trash-item-badge" style="background: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
            ${typeLabel}
          </div>
          <div class="trash-item-main">
            <div class="trash-item-title">${this.escapeHtml(item.title)}</div>
            <div class="trash-item-meta">
              <span>Supprimé le ${delDate}${extraInfo}</span>
              <span class="trash-item-expiry">• Suppression définitive dans ${daysLeft} jour(s)</span>
            </div>
          </div>
        </div>
        <div class="trash-item-actions">
          <button class="btn btn-secondary btn-sm btn-restore-trash" onclick="TrashManager.restore('${item.id}')" title="Restaurer cet élément">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Restaurer</span>
          </button>
          <button class="btn-icon btn-action-delete" onclick="TrashManager.deletePermanently('${item.id}')" title="Supprimer définitivement">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.TrashManager = TrashManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrashManager;
}
