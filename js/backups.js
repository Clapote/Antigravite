/**
 * Antigravité - Module de Sauvegardes Locales
 * 
 * Principes impératifs :
 * - Les données personnelles doivent être conservées localement sur le PC.
 * - Système de sauvegarde locale dès la première phase.
 * - Sauvegardes physiques complètes sur le disque (%APPDATA%/Antigravite/backups/).
 * - Allègement du localStorage (seules les métadonnées sont conservées par défaut pour éviter QuotaExceededError).
 * - Rétrocompatibilité totale avec les sauvegardes existantes et le mode hors-ligne.
 */

const BackupManager = {
  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    this.render();
    this.bindEvents();
    this.migrateLegacyBackups();
    this.checkAutoBackup();
    this.setupAutoBackupScheduler();
  },

  getStorage() {
    if (typeof StorageManager !== 'undefined') return StorageManager;
    if (typeof window !== 'undefined' && window.StorageManager) return window.StorageManager;
    return null;
  },

  bindEvents() {
    if (typeof document === 'undefined') return;

    // Bouton de sauvegarde manuelle immédiate
    const btnCreate = document.getElementById('btn-create-backup');
    if (btnCreate) {
      btnCreate.addEventListener('click', () => this.createManualBackup());
    }

    // Bouton dans la barre latérale
    const btnQuick = document.getElementById('sidebar-quick-backup');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => this.createManualBackup());
    }

    // Bouton exporter JSON complet
    const btnExport = document.getElementById('btn-export-backup-file');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCurrentDataAsFile());
    }

    // Input fichier import
    const inputImport = document.getElementById('backup-file-input');
    if (inputImport) {
      inputImport.addEventListener('change', (e) => this.handleFileImport(e));
    }
  },

  getAll() {
    const storage = this.getStorage();
    return storage ? storage.getBackups() : [];
  },

  saveAll(backups) {
    const storage = this.getStorage();
    if (storage) storage.saveBackups(backups);
    this.render();
  },

  // Récupération sécurisée et rétrocompatible du contenu d'une sauvegarde
  async getBackupPayload(backup) {
    if (!backup) throw new Error("Sauvegarde non spécifiée ou introuvable.");

    // 1. Si le payload est présent en mémoire locale (anciennes sauvegardes ou mode secours navigateur)
    if (backup.payload && typeof backup.payload === 'object') {
      return backup.payload;
    }

    // 2. Si une sauvegarde physique existe sur le disque et qu'Electron est disponible
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (api && typeof api.readBackup === 'function') {
      const target = backup.diskPath || backup.filename;
      if (target) {
        try {
          const diskData = await api.readBackup(target);
          if (diskData && typeof diskData === 'object') {
            return diskData;
          }
        } catch (err) {
          console.warn("[BackupManager] Impossible de lire la sauvegarde sur disque via", target, err);
        }
      }
    }

    throw new Error("Le contenu complet de cette sauvegarde est indisponible (fichier physique introuvable et payload absent).");
  },

  // Création d'une sauvegarde
  async createManualBackup(label = "Sauvegarde manuelle") {
    const btnQuick = (typeof document !== 'undefined') ? document.getElementById('sidebar-quick-backup') : null;
    if (btnQuick) {
      btnQuick.classList.add('backup-saving');
    }

    const storage = this.getStorage();
    const fullData = storage ? storage.getFullExport() : { tasks: [], projects: [], events: [], notes: [], settings: {} };
    const now = new Date();
    const id = 'backup-' + now.getTime();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `antigravite_backup_${timestampStr}.json`;
    const dataString = JSON.stringify(fullData);
    const sizeKb = (typeof Blob !== 'undefined') ? (new Blob([dataString]).size / 1024).toFixed(1) : (Buffer.byteLength(dataString, 'utf8') / 1024).toFixed(1);

    const backupRecord = {
      id: id,
      filename: filename,
      label: label,
      createdAt: now.toISOString(),
      size: `${sizeKb} Ko`,
      counts: {
        tasks: (fullData.tasks || []).length,
        projects: (fullData.projects || []).length,
        events: (fullData.events || []).length,
        notes: (fullData.notes || []).length
      },
      diskPath: null,
      hasPhysicalBackup: false,
      payload: null // Allégé dès lors que le fichier physique prend le relais
    };

    let physicalSaved = false;
    let diskErrorMsg = null;
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    try {
      if (api && typeof api.saveBackup === 'function') {
        const result = await api.saveBackup(fullData);
        if (result && result.path) {
          backupRecord.diskPath = result.path;
          backupRecord.hasPhysicalBackup = true;
          physicalSaved = true;
        } else {
          throw new Error((result && result.error) || "Chemin de sauvegarde manquant dans la réponse.");
        }
      }
    } catch (diskErr) {
      console.warn("[BackupManager] Échec de sauvegarde physique sur le disque :", diskErr);
      diskErrorMsg = diskErr && diskErr.message ? diskErr.message : String(diskErr);
      // Fallback : si l'écriture disque échoue, conserver le payload dans localStorage pour éviter toute perte
      backupRecord.payload = fullData;
      backupRecord.hasPhysicalBackup = false;
    }

    // Si nous ne sommes pas dans Electron ou si la sauvegarde physique a échoué, conserver le payload en secours
    if (!physicalSaved) {
      backupRecord.payload = fullData;
      backupRecord.hasPhysicalBackup = false;
    }

    try {
      const storage = this.getStorage();
      const settings = storage && typeof storage.getSettings === 'function' ? storage.getSettings() : {};
      const maxRetention = Math.max(1, Number(settings.backupRetentionCount) || 20);

      const backups = this.getAll();
      backups.unshift(backupRecord);

      // Appliquer la rétention configurée (localStorage + disque)
      while (backups.length > maxRetention) {
        backups.pop();
      }

      this.saveAll(backups);

      if (api && typeof api.pruneBackups === 'function') {
        try {
          await api.pruneBackups(maxRetention);
        } catch (pruneErr) {
          console.warn("[BackupManager] Purge physique des anciens instantanés :", pruneErr);
        }
      }

      if (btnQuick) {
        btnQuick.classList.remove('backup-saving');
        btnQuick.classList.add('backup-success');
        setTimeout(() => {
          btnQuick.classList.remove('backup-success');
        }, 1200);
      }

      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        if (physicalSaved) {
          window.App.showToast(
            `Sauvegarde "${filename}" créée avec succès (${sizeKb} Ko)`,
            "success"
          );
        } else {
          window.App.showToast(
            `Avertissement : la sauvegarde physique sur le disque a échoué${diskErrorMsg ? ` (${diskErrorMsg})` : ''}. Les données restent préservées en mémoire locale.`,
            "warning"
          );
        }
      }

      return backupRecord;
    } catch (err) {
      if (btnQuick) {
        btnQuick.classList.remove('backup-saving');
      }
      console.error("Erreur lors de l'enregistrement de l'instantané :", err);

      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(
          "Échec de l'enregistrement de la sauvegarde : " + err.message,
          "error"
        );
      }

      throw err;
    }
  },

  // Restauration d'une sauvegarde
  async restoreBackup(id) {
    const backup = this.getAll().find(b => b.id === id);
    if (!backup) {
      if (typeof alert === 'function') alert("Sauvegarde introuvable.");
      return;
    }

    const confirmMsg = `Êtes-vous certain de vouloir restaurer la sauvegarde du ${new Date(backup.createdAt).toLocaleString('fr-FR')} ?\n\nAttention : les données actuelles seront remplacées par celles de la sauvegarde.`;
    let canConfirm = true;
    if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
      canConfirm = await window.App.confirm({
        title: "Restauration de sauvegarde",
        message: confirmMsg,
        confirmText: "Restaurer les données",
        danger: true,
        icon: "⏪"
      });
    } else if (typeof confirm === 'function') {
      canConfirm = confirm(confirmMsg);
    }
    if (!canConfirm) return;

    try {
      const payload = await this.getBackupPayload(backup);
      const storage = this.getStorage();
      if (storage) storage.restoreFullExport(payload);

      if (typeof window !== 'undefined') {
        if (window.TasksManager) TasksManager.render();
        if (window.ProjectsManager) ProjectsManager.render();
        if (window.AgendaManager) AgendaManager.render();
        if (window.NotesManager) NotesManager.render();
        if (window.App) {
          window.App.updateDashboard();
          window.App.showToast("Restauration réussie !", "success");
        }
      }
    } catch (err) {
      if (typeof alert === 'function') alert("Erreur lors de la restauration : " + err.message);
      else console.error("Erreur lors de la restauration :", err.message);
    }
  },

  // Télécharger le fichier JSON de la sauvegarde sur le PC
  async downloadBackupFile(id) {
    const backup = this.getAll().find(b => b.id === id);
    if (!backup) return;

    try {
      const payload = await this.getBackupPayload(backup);
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Fichier de sauvegarde téléchargé", "info");
      }
    } catch (err) {
      if (typeof alert === 'function') alert("Impossible de télécharger le fichier de sauvegarde : " + err.message);
      else console.error("Impossible de télécharger :", err.message);
    }
  },

  // Exporter directement les données actuelles
  exportCurrentDataAsFile() {
    const storage = this.getStorage();
    const fullData = storage ? storage.getFullExport() : {};
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `antigravite_donnees_${timestampStr}.json`;
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Export complet terminé", "success");
    }
  },

  // Importer un fichier JSON de sauvegarde externe
  async handleFileImport(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.tasks) ||
        !Array.isArray(parsed.projects) ||
        !Array.isArray(parsed.events) ||
        !Array.isArray(parsed.notes)
      ) {
        throw new Error("La structure du fichier de sauvegarde est invalide.");
      }

      const confirmMsg = `Confirmez-vous l'import du fichier "${file.name}" ?\n\nAttention : les données actuelles seront remplacées.`;
      let canConfirm = true;
      if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
        canConfirm = await window.App.confirm({
          title: "Import de sauvegarde",
          message: confirmMsg,
          confirmText: "Importer les données",
          danger: true,
          icon: "📥"
        });
      } else if (typeof confirm === 'function') {
        canConfirm = confirm(confirmMsg);
      }
      if (!canConfirm) return;

      // Étape 1 : sauvegarder l'état actuel AVANT de le remplacer.
      // Si cette sauvegarde échoue, l'import est interrompu.
      await this.createManualBackup(`Avant import de ${file.name}`);

      // Étape 2 : importer les données seulement après la sauvegarde.
      const storage = this.getStorage();
      if (storage) storage.restoreFullExport(parsed);

      // Étape 3 : actualiser l'interface.
      if (typeof window !== 'undefined') {
        if (window.TasksManager) TasksManager.render();
        if (window.ProjectsManager) ProjectsManager.render();
        if (window.AgendaManager) AgendaManager.render();
        if (window.NotesManager) NotesManager.render();

        if (window.App) {
          window.App.updateDashboard();
          window.App.showToast(
            "Import réussi ! L'état précédent a été sauvegardé sur le disque.",
            "success"
          );
        }
      }
    } catch (err) {
      console.error("Erreur lors de l'import ou de la sauvegarde :", err);
      if (typeof alert === 'function') alert("L'import ou la sauvegarde a échoué : " + err.message);
    } finally {
      if (event.target) event.target.value = '';
    }
  },

  async deleteBackup(id) {
    const confirmMsg = "Voulez-vous supprimer cet instantané de sauvegarde ?";
    let canConfirm = true;
    if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
      canConfirm = await window.App.confirm({
        title: "Supprimer l'instantané",
        message: confirmMsg,
        confirmText: "Supprimer",
        danger: true,
        icon: "🗑️"
      });
    } else if (typeof confirm === 'function') {
      canConfirm = confirm(confirmMsg);
    }
    if (!canConfirm) return;

    const existingBackups = this.getAll();
    const targetBackup = existingBackups.find(b => b.id === id);
    const backups = existingBackups.filter(b => b.id !== id);
    this.saveAll(backups);

    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (targetBackup && api && typeof api.deleteBackupFile === 'function') {
      const target = targetBackup.diskPath || targetBackup.filename;
      if (target) {
        api.deleteBackupFile(target).catch(() => {});
      }
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Instantané supprimé", "info");
    }
  },

  getConfiguredFrequencyHours(settingsObj = null) {
    const storage = this.getStorage();
    const settings = settingsObj || (storage && typeof storage.getSettings === 'function' ? storage.getSettings() : {});
    if (settings.autoBackupFrequencyHours !== undefined && settings.autoBackupFrequencyHours !== null) {
      const n = Number(settings.autoBackupFrequencyHours);
      if (!isNaN(n) && n >= 0) return n;
    }
    return settings.autoBackupOnLaunch === false ? 0 : 24;
  },

  getConfiguredRetentionCount(settingsObj = null) {
    const storage = this.getStorage();
    const settings = settingsObj || (storage && typeof storage.getSettings === 'function' ? storage.getSettings() : {});
    return Math.max(1, parseInt(settings.backupRetentionCount, 10) || 20);
  },

  async applyRetentionCount(maxCount, shouldPruneDisk = true) {
    const limit = Math.max(1, parseInt(maxCount, 10) || 20);
    const backups = this.getAll();
    let trimmed = false;
    if (backups.length > limit) {
      this.saveAll(backups.slice(0, limit));
      trimmed = true;
    }
    const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
    if (shouldPruneDisk && api && typeof api.pruneBackups === 'function') {
      try {
        const res = await api.pruneBackups(limit);
        return { trimmed, removedCount: (res && res.removedCount) || 0 };
      } catch (err) {
        console.warn("[BackupManager] Erreur purge rétention disque :", err);
      }
    }
    return { trimmed, removedCount: 0 };
  },

  setupAutoBackupScheduler() {
    if (this._autoBackupTimer) {
      clearInterval(this._autoBackupTimer);
      this._autoBackupTimer = null;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const freqHours = this.getConfiguredFrequencyHours();
    if (freqHours <= 0) return;

    // Vérification périodique légère (toutes les 15 min minimum, ou moitié de l'intervalle configuré)
    const checkEveryMs = Math.max(15 * 60 * 1000, Math.min(60 * 60 * 1000, (freqHours * 3600 * 1000) / 2));
    this._autoBackupTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden === true) {
        // En arrière-plan, on vérifie quand même si l'échéance de sauvegarde est dépassée
        this.checkAutoBackup();
      } else {
        this.checkAutoBackup();
      }
    }, checkEveryMs);
  },

  // Migration douce et prudente des anciennes sauvegardes pour alléger localStorage
  async migrateLegacyBackups() {
    try {
      const backups = this.getAll();
      if (!Array.isArray(backups) || backups.length === 0) return;

      let diskFilenames = new Set();
      const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;
      if (api && typeof api.listBackups === 'function') {
        try {
          const diskList = await api.listBackups();
          if (Array.isArray(diskList)) {
            diskList.forEach(f => diskFilenames.add(f.filename));
          }
        } catch (_e) {}
      }

      let modified = false;
      const updated = backups.map(b => {
        if (!b) return b;
        const hasDiskConfirmation = b.hasPhysicalBackup || 
          (diskFilenames.size > 0 && (
            (b.filename && diskFilenames.has(b.filename)) ||
            (b.diskPath && Array.from(diskFilenames).some(fn => b.diskPath.endsWith(fn)))
          ));
        if (b.payload && hasDiskConfirmation) {
          const copy = Object.assign({}, b);
          copy.hasPhysicalBackup = true;
          delete copy.payload;
          modified = true;
          return copy;
        }
        return b;
      });

      if (modified) {
        console.log("[BackupManager] Allègement réussi des anciennes sauvegardes du localStorage.");
        this.saveAll(updated);
      }
    } catch (e) {
      console.warn("[BackupManager] Erreur lors de la vérification de migration des sauvegardes :", e);
    }
  },

  async checkAutoBackup() {
    try {
      const storage = this.getStorage();
      const settings = storage && typeof storage.getSettings === 'function' ? storage.getSettings() : {};
      const freqHours = this.getConfiguredFrequencyHours(settings);

      // Si fréquence à 0 : aucune sauvegarde automatique (y compris initiale) ; manuel uniquement
      if (freqHours <= 0) {
        return;
      }

      const intervalMs = freqHours * 3600 * 1000;
      const nowMs = Date.now();
      const label = freqHours === 24 ? "Sauvegarde quotidienne automatique" : "Sauvegarde planifiée automatique";

      // Vérifier les sauvegardes réellement présentes sur le disque.
      let diskBackups = [];
      const api = (typeof window !== 'undefined' && window.AntigraviteAPI) ? window.AntigraviteAPI : null;

      if (api && typeof api.listBackups === 'function') {
        try {
          diskBackups = await api.listBackups();
        } catch (e) {
          console.warn("[BackupManager] Erreur lors de la vérification des sauvegardes sur disque :", e);
        }

        if (!Array.isArray(diskBackups) || diskBackups.length === 0) {
          await this.createManualBackup("Sauvegarde initiale automatique");
          return;
        }

        const latestBackup = diskBackups[0];
        const latestMs = new Date(latestBackup.createdAt).getTime();
        if (isNaN(latestMs) || (nowMs - latestMs) >= intervalMs) {
          await this.createManualBackup(label);
        }
      } else {
        // Hors environnement Electron / IPC disque (ex: mode web direct)
        const localBackups = this.getAll();
        if (localBackups.length === 0) {
          await this.createManualBackup("Sauvegarde initiale automatique");
          return;
        }
        const latestLocalMs = new Date(localBackups[0].createdAt).getTime();
        if (isNaN(latestLocalMs) || (nowMs - latestLocalMs) >= intervalMs) {
          await this.createManualBackup(label);
        }
      }
    } catch (err) {
      console.error("Erreur lors de la vérification des sauvegardes :", err);
    }
  },

  render() {
    if (typeof document === 'undefined') return;
    const tbody = document.getElementById('backups-table-body');
    const lastBackupEl = document.getElementById('last-backup-info');
    if (!tbody) return;

    const backups = this.getAll();
    if (lastBackupEl) {
      if (backups.length > 0) {
        const last = backups[0];
        lastBackupEl.textContent = `Dernière sauvegarde : ${new Date(last.createdAt).toLocaleString('fr-FR')} (${last.filename})`;
      } else {
        lastBackupEl.textContent = "Aucune sauvegarde effectuée pour le moment.";
      }
    }

    if (backups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-dim);">Aucun instantané disponible.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    backups.forEach(b => {
      const tr = document.createElement('tr');
      const dateStr = new Date(b.createdAt).toLocaleString('fr-FR');
      tr.innerHTML = `
        <td><strong>${this.escapeHtml(b.label)}</strong><br><span style="font-size:0.75rem; color:var(--text-dim);">${b.filename}</span></td>
        <td>${dateStr}</td>
        <td><span class="badge badge-priority-low">${b.counts ? `${b.counts.tasks} tâches, ${b.counts.events} créneaux` : 'Complet'}</span></td>
        <td>${b.size}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="BackupManager.restoreBackup('${b.id}')" title="Restaurer cette version"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span>Restaurer</span></button>
            <button class="btn btn-secondary btn-sm" onclick="BackupManager.downloadBackupFile('${b.id}')" title="Télécharger le fichier"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Télécharger</span></button>
            <button class="btn-icon" onclick="BackupManager.deleteBackup('${b.id}')" title="Supprimer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.BackupManager = BackupManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackupManager;
}
