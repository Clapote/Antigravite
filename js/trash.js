/**
 * Antigravité - Module Corbeille & Restauration (Trash Manager)
 * Gestion locale et sécurisée des éléments supprimés (tâches, notes, projets).
 * Suppression directe sans interruption modale + conservation pendant 30 jours.
 */

const TrashManager = {
  currentFilter: 'all',
  initialized: false,

  init(options = {}) {
    if (this.initialized) {
      if (!options || !options.deferRender) this.render();
      return;
    }
    this.initialized = true;
    this.cleanExpired();
    this.bindEvents();
    if (!options || !options.deferRender) {
      this.render();
    }

    // Nettoyage périodique en exécution continue (tray 24/7)
    if (!this._cleanupInterval && typeof setInterval === 'function') {
      this._cleanupInterval = setInterval(() => {
        this.cleanExpired();
      }, 6 * 60 * 60 * 1000);
      if (this._cleanupInterval && typeof this._cleanupInterval.unref === 'function') {
        this._cleanupInterval.unref();
      }
    }
    if (!this._visibilityCleanupBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      this._visibilityCleanupBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          const now = Date.now();
          if (!this._lastExpiredCheckAt || (now - this._lastExpiredCheckAt >= 6 * 60 * 60 * 1000)) {
            this.cleanExpired();
          }
        }
      });
    }
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

    const candidate = trash[index];
    if (!candidate || !candidate.data || typeof candidate.data !== 'object') {
      return false;
    }

    const [item] = trash.splice(index, 1);

    if (item.type === 'task') {
      const meta = item.data._deletedMeta || null;
      if (item.data._deletedMeta) delete item.data._deletedMeta;

      const tasks = StorageManager.getTasks();
      const projects = typeof StorageManager.getProjects === 'function' ? StorageManager.getProjects() : [];
      const validProjectIds = new Set(projects.map(p => p && p.id).filter(Boolean));
      const notesAll = typeof StorageManager.getNotes === 'function' ? StorageManager.getNotes() : [];
      const validNoteIds = new Set(notesAll.map(n => n && n.id).filter(Boolean));
      const cleanOrphanProjects = (t) => {
        if (!t || typeof t !== 'object') return;
        if (t.projectId && !validProjectIds.has(t.projectId)) {
          t.projectId = null;
        }
        if (t.noteId && !validNoteIds.has(t.noteId)) {
          t.noteId = null;
        }
        if (Array.isArray(t.subtasks)) t.subtasks.forEach(cleanOrphanProjects);
      };
      cleanOrphanProjects(item.data);

      // Rétablir la réciprocité si la note liée existe et n'est pas liée à une autre tâche
      if (item.data.noteId && validNoteIds.has(item.data.noteId) && typeof StorageManager.saveNotes === 'function') {
        const linkedNote = notesAll.find(n => n && n.id === item.data.noteId);
        if (linkedNote && !linkedNote.linkedTaskId) {
          linkedNote.linkedTaskId = item.data.id;
          StorageManager.saveNotes(notesAll);
        }
      }

      // Tenter de ré-imbriquer sous la tâche parente d'origine si elle existe encore
      let nested = false;
      if (meta && meta.previousParentTaskId) {
        const attachToParent = (list) => {
          for (const t of list) {
            if (!t) continue;
            if (t.id === meta.previousParentTaskId) {
              if (!Array.isArray(t.subtasks)) t.subtasks = [];
              t.subtasks.push(item.data);
              return true;
            }
            if (Array.isArray(t.subtasks) && t.subtasks.length > 0 && attachToParent(t.subtasks)) {
              return true;
            }
          }
          return false;
        };
        nested = attachToParent(tasks);
      }
      if (!nested) {
        tasks.push(item.data);
      }
      StorageManager.saveTasks(tasks);

      // Rétablir le lien vers d'éventuels créneaux d'agenda encore existants et libres
      if (meta && Array.isArray(meta.previousEventIds) && meta.previousEventIds.length > 0 && typeof StorageManager.getEvents === 'function') {
        const events = StorageManager.getEvents();
        const prevSet = new Set(meta.previousEventIds);
        let evChanged = false;
        events.forEach(ev => {
          if (ev && prevSet.has(ev.id) && !ev.taskId) {
            ev.taskId = item.data.id;
            ev.updatedAt = new Date().toISOString();
            evChanged = true;
          }
        });
        if (evChanged && typeof StorageManager.saveEvents === 'function') {
          StorageManager.saveEvents(events);
        }
      }

      this.saveAll(trash);
      if (typeof window !== 'undefined') {
        if (window.TasksManager && typeof window.TasksManager.render === 'function') window.TasksManager.render();
        if (window.AgendaManager && typeof window.AgendaManager.render === 'function') window.AgendaManager.render();
      }
    } else if (item.type === 'note') {
      const notes = StorageManager.getNotes();
      const settings = typeof StorageManager.getSettings === 'function' ? StorageManager.getSettings() : {};
      const validFolders = new Set(Array.isArray(settings.notesFolders) ? settings.notesFolders : ['Général']);
      if (item.data.folder && !validFolders.has(item.data.folder)) {
        item.data.folder = 'Général';
      }
      const projects = typeof StorageManager.getProjects === 'function' ? StorageManager.getProjects() : [];
      const validProjectIds = new Set(projects.map(p => p && p.id).filter(Boolean));
      if (item.data.projectId && !validProjectIds.has(item.data.projectId)) {
        item.data.projectId = null;
      }
      if (item.data.linkedProjectId && !validProjectIds.has(item.data.linkedProjectId)) {
        item.data.linkedProjectId = null;
      }

      // Vérifier si l'événement d'agenda lié existe encore et restaurer la réciprocité
      if (item.data.linkedEventId && typeof StorageManager.getEvents === 'function') {
        const events = StorageManager.getEvents();
        const targetEvt = events.find(e => e && e.id === item.data.linkedEventId);
        if (!targetEvt) {
          item.data.linkedEventId = null;
        } else if (!targetEvt.noteId) {
          targetEvt.noteId = item.data.id;
          targetEvt.updatedAt = new Date().toISOString();
          if (typeof StorageManager.saveEvents === 'function') StorageManager.saveEvents(events);
        }
      }

      item.data.updatedAt = new Date().toISOString();
      notes.unshift(item.data);
      StorageManager.saveNotes(notes);
      this.saveAll(trash);
      if (typeof window !== 'undefined') {
        if (window.NotesManager && typeof window.NotesManager.render === 'function') window.NotesManager.render();
        if (window.AgendaManager && typeof window.AgendaManager.render === 'function') window.AgendaManager.render();
      }
    } else if (item.type === 'project') {
      const meta = item.data._deletedMeta || null;
      if (item.data._deletedMeta) delete item.data._deletedMeta;

      const projects = StorageManager.getProjects();
      const validParent = !item.data.parentProjectId || projects.some(p => p && p.id === item.data.parentProjectId);
      if (!validParent) {
        item.data.parentProjectId = null;
      }
      projects.push(item.data);

      // Ré-attacher les anciens sous-projets directs si leur parent est resté null
      if (meta && Array.isArray(meta.childProjectIds) && meta.childProjectIds.length > 0) {
        const childSet = new Set(meta.childProjectIds);
        projects.forEach(p => {
          if (p && p.id !== item.data.id && childSet.has(p.id) && !p.parentProjectId) {
            p.parentProjectId = item.data.id;
          }
        });
      }
      StorageManager.saveProjects(projects);

      // Ré-attacher tâches orphelines, notes orphelines et créneaux orphelins du projet
      if (meta) {
        if (Array.isArray(meta.linkedTaskIds) && meta.linkedTaskIds.length > 0 && typeof StorageManager.getTasks === 'function') {
          const taskIdSet = new Set(meta.linkedTaskIds);
          const tasks = StorageManager.getTasks();
          let tChanged = false;
          const relinkTasks = (list) => {
            for (const t of list) {
              if (!t) continue;
              if (taskIdSet.has(t.id) && !t.projectId) {
                t.projectId = item.data.id;
                tChanged = true;
              }
              if (Array.isArray(t.subtasks)) relinkTasks(t.subtasks);
            }
          };
          relinkTasks(tasks);
          if (tChanged && typeof StorageManager.saveTasks === 'function') StorageManager.saveTasks(tasks);
        }

        if (Array.isArray(meta.linkedNoteIds) && meta.linkedNoteIds.length > 0 && typeof StorageManager.getNotes === 'function') {
          const noteIdSet = new Set(meta.linkedNoteIds);
          const notes = StorageManager.getNotes();
          let nChanged = false;
          notes.forEach(n => {
            if (n && noteIdSet.has(n.id) && !n.projectId) {
              n.projectId = item.data.id;
              nChanged = true;
            }
          });
          if (nChanged && typeof StorageManager.saveNotes === 'function') StorageManager.saveNotes(notes);
        }

        if (Array.isArray(meta.linkedEventIds) && meta.linkedEventIds.length > 0 && typeof StorageManager.getEvents === 'function') {
          const evtIdSet = new Set(meta.linkedEventIds);
          const events = StorageManager.getEvents();
          let eChanged = false;
          events.forEach(ev => {
            if (ev && evtIdSet.has(ev.id) && !ev.projectId) {
              ev.projectId = item.data.id;
              eChanged = true;
            }
          });
          if (eChanged && typeof StorageManager.saveEvents === 'function') StorageManager.saveEvents(events);
        }
      }

      this.saveAll(trash);
      if (typeof window !== 'undefined') {
        if (window.ProjectsManager && typeof window.ProjectsManager.render === 'function') window.ProjectsManager.render();
        if (window.TasksManager && typeof window.TasksManager.render === 'function') window.TasksManager.render();
        if (window.NotesManager && typeof window.NotesManager.render === 'function') window.NotesManager.render();
        if (window.AgendaManager && typeof window.AgendaManager.render === 'function') window.AgendaManager.render();
      }
    } else {
      return false;
    }

    this.render();
    if (typeof window !== 'undefined') {
      if (window.App && typeof window.App.updateDashboard === 'function') {
        window.App.updateDashboard();
      }
      if (window.ConstellationManager && window.App && window.App.currentScreen === 'constellation' && typeof window.ConstellationManager.render === 'function') {
        window.ConstellationManager.render();
      }
    }

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      const label = item.type === 'task' ? 'Tâche' : item.type === 'note' ? 'Note' : 'Projet';
      window.App.showToast(`${label} « ${item.title || '(Sans titre)'} » restauré(e) avec succès`, 'success');
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

  // Vider l'intégralité de la corbeille (avec confirmation utilisateur)
  async emptyTrash() {
    const trash = this.getAll();
    if (trash.length === 0) return false;

    const msg = `Voulez-vous supprimer définitivement les ${trash.length} élément${trash.length > 1 ? 's' : ''} de la corbeille ? Cette action est irréversible.`;
    let confirmed = true;
    if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
      confirmed = await window.App.confirm({
        title: "Vider la corbeille",
        message: msg,
        confirmText: "Vider définitivement",
        cancelText: "Annuler",
        danger: true
      });
    } else if (typeof confirm === 'function') {
      confirmed = confirm(msg);
    }
    if (!confirmed) return false;

    this.saveAll([]);
    this.render();

    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("La corbeille a été entièrement vidée", "info");
    }
    return true;
  },

  // Nettoyage automatique des éléments de plus de 30 jours
  cleanExpired() {
    this._lastExpiredCheckAt = Date.now();
    const trash = this.getAll();
    const now = this._lastExpiredCheckAt;
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
  renderIfNeeded() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('trash-list-container');
    if (!container) return;
    const rev = (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function')
      ? StorageManager.getRevision('trash')
      : -1;
    const sig = `${rev}:${this.currentFilter}`;
    if (rev !== -1 && this._lastRenderedSig === sig) return;
    this.render();
  },

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
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getRevision === 'function') {
      this._lastRenderedSig = `${StorageManager.getRevision('trash')}:${this.currentFilter}`;
    }

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
    const fragment = (typeof document.createDocumentFragment === 'function') ? document.createDocumentFragment() : container;

    const typeIcons = {
      task: '<svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;" aria-hidden="true"><use href="#ico-task"/></svg><span>Tâche</span>',
      note: '<svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;" aria-hidden="true"><use href="#ico-note"/></svg><span>Note</span>',
      project: '<svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;" aria-hidden="true"><use href="#ico-folder"/></svg><span>Projet</span>'
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

      const safeId = this.escapeHtml(item.id);
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
          <button class="btn btn-secondary btn-sm btn-restore-trash" data-trash-action="restore" data-trash-id="${safeId}" title="Restaurer cet élément">
            <svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ico-restore"/></svg>
            <span>Restaurer</span>
          </button>
          <button class="btn-icon btn-action-delete" data-trash-action="delete" data-trash-id="${safeId}" title="Supprimer définitivement">
            <svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ico-trash"/></svg>
          </button>
        </div>
      `;

      fragment.appendChild(card);
    });

    if (fragment !== container) {
      container.appendChild(fragment);
    }

    if (!container._trashDelegated && typeof container.addEventListener === 'function') {
      container._trashDelegated = true;
      container.addEventListener('click', (e) => {
        const btn = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-trash-action]') : null;
        if (!btn) return;
        const action = btn.dataset.trashAction;
        const id = btn.dataset.trashId;
        if (!id) return;
        if (action === 'restore') this.restore(id);
        else if (action === 'delete') this.deletePermanently(id);
      });
    }
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
