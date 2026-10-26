/**
 * Antigravité - Module de Gestion des Projets
 * Gestion simple, épurée et visuelle des projets personnels.
 */

const ProjectsManager = {
  init() {
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
    if (!confirm("Voulez-vous vraiment supprimer ce projet ? Les tâches rattachées ne seront pas supprimées mais perdront leur affectation.")) return;
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
    return { total, completed, percent };
  },

  render() {
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
        <div style="margin-top: 6px; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="TasksManager.currentProjectFilter='${p.id}'; App.navigate('tasks');">Voir les tâches</button>
        </div>
      `;
      container.appendChild(card);
    });
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
