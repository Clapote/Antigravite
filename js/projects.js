/**
 * Antigravité - Module de Gestion des Projets
 * Gestion simple, épurée et visuelle des projets personnels.
 */

const ProjectsManager = {
  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    const btnNew = document.getElementById('btn-new-project');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openProjectModal());
    }
  },

  getAll() {
    return StorageManager.getProjects();
  },

  saveAll(projects) {
    StorageManager.saveProjects(projects);
    this.render();
    if (window.TasksManager) TasksManager.render();
    if (window.App) window.App.updateDashboard();
  },

  addProject(projectData) {
    const projects = this.getAll();
    const newProj = {
      id: 'proj-' + Date.now(),
      title: projectData.title.trim(),
      description: projectData.description ? projectData.description.trim() : '',
      color: projectData.color || '#3b82f6',
      status: projectData.status || 'in_progress',
      createdAt: new Date().toISOString()
    };
    projects.push(newProj);
    this.saveAll(projects);
    if (window.App) window.App.showToast("Projet créé avec succès", "success");
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
    p.updatedAt = new Date().toISOString();

    this.saveAll(projects);
    if (window.App) window.App.showToast("Projet mis à jour", "info");
    return true;
  },

  deleteProject(id) {
    const shouldConfirm = typeof confirm === 'function' ? confirm("Voulez-vous vraiment supprimer ce projet ? Les tâches rattachées ne seront pas supprimées mais perdront leur affectation.") : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm("Voulez-vous vraiment supprimer ce projet ? Les tâches rattachées ne seront pas supprimées mais perdront leur affectation.") : true);
    if (!shouldConfirm) return;
    let projects = this.getAll();
    projects = projects.filter(p => p.id !== id);

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
    if (window.App) window.App.showToast("Projet supprimé", "info");
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

  render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('projects-grid-container');
    if (!container) return;

    const projects = this.getAll();
    if (projects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 10px;">📁</div>
          <p>Aucun projet défini.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="ProjectsManager.openProjectModal()">Créer un premier projet</button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    projects.forEach(p => {
      const stats = this.getProjectStats(p.id);
      const card = document.createElement('div');
      card.className = 'project-card';
      card.style.cursor = 'pointer';
      card.onclick = (e) => {
        if (e.target.closest('button')) return;
        ProjectsManager.openProjectDetailModal(p.id);
      };
      card.innerHTML = `
        <div class="project-color-bar" style="background-color: ${p.color};"></div>
        <div class="project-header">
          <div class="project-title">${this.escapeHtml(p.title)}</div>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" title="Modifier" onclick="ProjectsManager.openProjectModal('${p.id}')">✏️</button>
            <button class="btn-icon" title="Supprimer" onclick="ProjectsManager.deleteProject('${p.id}')">🗑️</button>
          </div>
        </div>
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
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">📝 ${stats.notesCount} note(s)</span>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ProjectsManager.openProjectDetailModal('${p.id}');">Consulter le projet ↗</button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  openProjectDetailModal(id) {
    const modal = document.getElementById('project-detail-modal');
    if (!modal) return;

    const p = this.getAll().find(item => item.id === id);
    if (!p) return;

    const dotEl = document.getElementById('project-detail-color-dot');
    const titleEl = document.getElementById('project-detail-title');
    const descEl = document.getElementById('project-detail-desc');
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

    const stats = this.getProjectStats(p.id);
    if (progressLabel) progressLabel.textContent = `Tâches réalisées : ${stats.completed} / ${stats.total}`;
    if (progressPct) progressPct.textContent = `${stats.percent}%`;
    if (progressFill) {
      progressFill.style.width = `${stats.percent}%`;
      progressFill.style.backgroundColor = p.color || 'var(--primary)';
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
                ${t.plannedDate ? `<span style="font-size: 0.72rem; color: var(--accent); white-space: nowrap;">📅 ${t.plannedDate}${t.plannedTime ? ' ' + t.plannedTime : ''}</span>` : ''}
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
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  📝 ${this.escapeHtml(n.title)}
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

  openProjectModal(id = null) {
    const modal = document.getElementById('project-modal');
    if (!modal) return;

    const titleEl = document.getElementById('project-modal-title');
    const inputTitle = document.getElementById('project-input-title');
    const inputDesc = document.getElementById('project-input-desc');
    const inputColor = document.getElementById('project-input-color');
    const btnSave = document.getElementById('project-modal-save');

    if (id) {
      const p = this.getAll().find(item => item.id === id);
      if (!p) return;
      titleEl.textContent = "Modifier le projet";
      inputTitle.value = p.title;
      inputDesc.value = p.description || '';
      inputColor.value = p.color || '#3b82f6';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le nom du projet est requis.");
        this.updateProject(id, {
          title: inputTitle.value,
          description: inputDesc.value,
          color: inputColor.value
        });
        this.closeProjectModal();
      };
    } else {
      titleEl.textContent = "Nouveau projet";
      inputTitle.value = '';
      inputDesc.value = '';
      inputColor.value = '#3b82f6';

      btnSave.onclick = () => {
        if (!inputTitle.value.trim()) return alert("Le nom du projet est requis.");
        this.addProject({
          title: inputTitle.value,
          description: inputDesc.value,
          color: inputColor.value
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
