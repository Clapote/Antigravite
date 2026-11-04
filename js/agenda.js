/**
 * Antigravité - Module Agenda Hebdomadaire
 * 
 * Principes impératifs :
 * - Les chevauchements d'événements dans le calendrier sont TOUJOURS autorisés.
 * - L'application ne doit JAMAIS supprimer une tâche simplement parce que son événement d'agenda est supprimé.
 * - Phase 3 : Rendu complet des événements Google Agenda synchronisés avec badge visuel distinctif.
 */

const AgendaManager = {
  currentWeekStart: null,
  currentView: 'week', // 'day', 'week', 'month'
  dayHoursStart: 7, // 07:00
  dayHoursEnd: 23,  // 23:00
  slotHeight: 50,   // 50px par heure

  init() {
    if (this.initialized) {
      this.render();
      return;
    }
    this.initialized = true;
    this.initWeek();
    this.render();
    this.bindEvents();
    this.initContextMenu();
    this.initDragAndDrop();
  },

  initWeek() {
    const now = new Date();
    // Trouver le lundi de la semaine courante
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 1 = Lundi
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    this.currentWeekStart = monday;
  },

  navigatePrev() {
    if (!this.currentWeekStart) this.initWeek();
    if (this.currentView === 'day') {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 1);
    } else if (this.currentView === 'month') {
      this.currentWeekStart.setMonth(this.currentWeekStart.getMonth() - 1);
    } else {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
    }
    this.render();
  },

  navigateNext() {
    if (!this.currentWeekStart) this.initWeek();
    if (this.currentView === 'day') {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 1);
    } else if (this.currentView === 'month') {
      this.currentWeekStart.setMonth(this.currentWeekStart.getMonth() + 1);
    } else {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
    }
    this.render();
  },

  navigateToday() {
    const now = new Date();
    if (this.currentView === 'day') {
      now.setHours(0, 0, 0, 0);
      this.currentWeekStart = now;
    } else if (this.currentView === 'month') {
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      this.currentWeekStart = now;
    } else {
      this.initWeek();
    }
    this.render();
  },

  setView(view) {
    if (!['day', 'week', 'month'].includes(view)) view = 'week';
    this.currentView = view;
    if (typeof document !== 'undefined') {
      const viewButtons = document.querySelectorAll('.btn-agenda-view');
      viewButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.view === view);
      });
    }
    this.render();
  },

  bindEvents() {
    const btnPrev = document.getElementById('btn-prev-week');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.navigatePrev());
    }

    const btnNext = document.getElementById('btn-next-week');
    if (btnNext) {
      btnNext.addEventListener('click', () => this.navigateNext());
    }

    const btnToday = document.getElementById('btn-today-week');
    if (btnToday) {
      btnToday.addEventListener('click', () => this.navigateToday());
    }

    // Bascule des vues Jour / Semaine / Mois
    const viewButtons = document.querySelectorAll('.btn-agenda-view');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view) {
          this.setView(btn.dataset.view);
        }
      });
    });

    // Calendrier de saut direct vers une date
    const jumpInput = document.getElementById('agenda-jump-date');
    if (jumpInput) {
      jumpInput.addEventListener('change', (e) => {
        if (!e.target.value) return;
        const picked = new Date(e.target.value + 'T00:00:00');
        if (!isNaN(picked.getTime())) {
          if (this.currentView === 'day') {
            this.currentWeekStart = picked;
          } else if (this.currentView === 'month') {
            picked.setDate(1);
            this.currentWeekStart = picked;
          } else {
            const day = picked.getDay();
            const diff = picked.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(picked.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            this.currentWeekStart = monday;
          }
          this.render();
        }
      });
    }

    const btnNew = document.getElementById('btn-new-event');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        this.openEventModal();
      });
    }

    const btnSync = document.getElementById('btn-sync-calendar');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        if (window.GoogleSyncManager && typeof window.GoogleSyncManager.syncCalendarNow === 'function') {
          window.GoogleSyncManager.syncCalendarNow(false);
        } else {
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast("Service Google non connecté ou indisponible", "info");
          }
        }
      });
    }

    // Clic direct sur un créneau libre de la grille pour créer un événement
    const calendarBody = document.getElementById('calendar-body-container');
    if (calendarBody && !this._gridClickBound) {
      this._gridClickBound = true;
      calendarBody.addEventListener('click', (e) => {
        // Ignorer si on a cliqué sur un événement ou si un drag vient de se terminer
        if (e.target.closest('.calendar-event')) return;
        if (this._suppressNextClick) {
          this._suppressNextClick = false;
          return;
        }

        const dayCol = e.target.closest('.day-column');
        if (!dayCol) return;

        const dateStr = dayCol.dataset.date;
        if (!dateStr) return;

        const rect = dayCol.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const hoursOffset = relY / this.slotHeight;
        const clickedHour = Math.floor(this.dayHoursStart + hoursOffset);

        // Arrondir par pas de 15 minutes (00, 15, 30, 45)
        const rawMinutes = Math.floor((hoursOffset % 1) * 60);
        const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15);
        const startHourStr = String(Math.min(23, Math.max(0, clickedHour))).padStart(2, '0');
        const startMinStr = String(roundedMinutes).padStart(2, '0');
        const startTime = `${startHourStr}:${startMinStr}`;

        const endHour = Math.min(23, clickedHour + 1);
        const endHourStr = String(endHour).padStart(2, '0');
        const endTime = `${endHourStr}:${startMinStr}`;

        this.openEventModal(null, {
          start: `${dateStr}T${startTime}`,
          end: `${dateStr}T${endTime}`
        });
      });
    }

    // Réajustement instantané en plein écran sans barres de défilement au redimensionnement (optimisé via rAF)
    if (!this._resizeBound && typeof window !== 'undefined') {
      this._resizeBound = true;
      let resizeRafId = null;
      window.addEventListener('resize', () => {
        if (resizeRafId) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          if (window.App && window.App.currentScreen === 'agenda') {
            this.render();
          }
        });
      });
    }
  },

  getAll() {
    return StorageManager.getEvents();
  },

  saveAll(events) {
    StorageManager.saveEvents(events);
    this.render();
    if (window.App) window.App.updateDashboard();
    if (window.AgendaNotificationManager && typeof window.AgendaNotificationManager.checkUpcomingEvents === 'function') {
      window.AgendaNotificationManager.checkUpcomingEvents();
    }
  },

  addEvent(eventData) {
    const events = this.getAll();

    let taskId = eventData.taskId || null;
    if (eventData.createTask && !taskId) {
      if (typeof TasksManager !== 'undefined' && typeof TasksManager.addTask === 'function') {
        const startDateStr = (eventData.start || '').slice(0, 10);
        const startTimeStr = eventData.start && eventData.start.length >= 16 ? eventData.start.slice(11, 16) : '09:00';
        const newTask = TasksManager.addTask({
          title: eventData.title.trim(),
          description: eventData.description ? eventData.description.trim() : '',
          projectId: eventData.taskProject || null,
          priority: eventData.taskPriority || 'medium',
          plannedDate: startDateStr || null,
          plannedTime: startTimeStr,
          skipEventCreation: true
        });
        if (newTask && newTask.id) taskId = newTask.id;
      }
    }

    const newEvent = {
      id: 'evt-' + Date.now(),
      title: eventData.title.trim(),
      description: eventData.description ? eventData.description.trim() : '',
      location: eventData.location ? eventData.location.trim() : '',
      start: eventData.start, // Format: YYYY-MM-DDTHH:MM
      end: eventData.end,
      isAllDay: !!eventData.isAllDay,
      color: eventData.color || '#3b82f6',
      taskId: taskId,
      noteId: eventData.noteId || null,
      recurrence: eventData.recurrence || 'none',
      externalId: null,
      source: 'local',
      createdAt: new Date().toISOString()
    };
    events.push(newEvent);
    this.saveAll(events);

    // Si lié à une tâche, synchroniser la date planifiée de la tâche
    if (newEvent.taskId && newEvent.start) {
      this.syncEventDateToTask(newEvent.taskId, newEvent.start.slice(0, 10));
    }

    if (window.App) window.App.showToast("Créneau ajouté dans l'agenda", "success");
    return newEvent;
  },

  // Synchroniser la date d'un événement vers sa tâche liée
  syncEventDateToTask(taskId, newDateStr) {
    if (!taskId || !newDateStr) return;
    if (typeof StorageManager === 'undefined' || typeof StorageManager.getTasks !== 'function') return;

    try {
      const tasks = StorageManager.getTasks();
      let modified = false;

      const updateRecursive = (list) => {
        for (const t of list) {
          if (t.id === taskId) {
            if (t.plannedDate !== newDateStr) {
              t.plannedDate = newDateStr;
              t.updatedAt = new Date().toISOString();
              modified = true;
            }
            return true;
          }
          if (t.subtasks && t.subtasks.length > 0) {
            if (updateRecursive(t.subtasks)) return true;
          }
        }
        return false;
      };

      updateRecursive(tasks);

      if (modified) {
        StorageManager.saveTasks(tasks);
        if (typeof window !== 'undefined' && window.TasksManager && typeof window.TasksManager.render === 'function') {
          window.TasksManager.render();
        }
      }
    } catch (err) {
      console.warn("[AgendaManager] Erreur lors de la synchronisation de l'événement vers la tâche :", err);
    }
  },

  updateEvent(id, updatedData) {
    const events = this.getAll();
    const evt = events.find(e => e.id === id);
    if (!evt) return false;

    evt.title = updatedData.title.trim();
    evt.description = updatedData.description ? updatedData.description.trim() : '';
    if (updatedData.location !== undefined) evt.location = updatedData.location.trim();
    evt.start = updatedData.start;
    evt.end = updatedData.end;
    if (updatedData.isAllDay !== undefined) evt.isAllDay = !!updatedData.isAllDay;
    evt.color = updatedData.color || evt.color;
    evt.taskId = updatedData.taskId !== undefined ? updatedData.taskId : evt.taskId;
    if (updatedData.noteId !== undefined) evt.noteId = updatedData.noteId;
    if (updatedData.recurrence !== undefined) evt.recurrence = updatedData.recurrence;
    evt.updatedAt = new Date().toISOString();

    this.saveAll(events);

    // Synchronisation bidirectionnelle : si l'événement est lié à une tâche,
    // synchroniser la date prévue de la tâche selon le créneau dans l'agenda
    if (evt.taskId && evt.start) {
      this.syncEventDateToTask(evt.taskId, evt.start.slice(0, 10));
    }

    if (window.App) window.App.showToast("Créneau mis à jour", "info");
    return true;
  },

  // RÈGLE IMPÉRATIVE N°6 :
  // "L'application ne doit jamais supprimer une tâche simplement parce que son événement d'agenda a été supprimé."
  deleteEvent(id) {
    const events = this.getAll();
    const target = events.find(e => e.id === id);
    if (!target) return;

    const hadTask = !!target.taskId;
    const filtered = events.filter(e => e.id !== id);
    this.saveAll(filtered);

    // Notification claire rassurant l'utilisateur
    if (hadTask) {
      if (window.App) window.App.showToast("Créneau supprimé. La tâche associée reste intacte.", "info");
    } else {
      if (window.App) window.App.showToast("Événement supprimé", "info");
    }
  },

  // Calcul des 7 jours de la semaine courante
  getWeekDays() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  },

  formatDateIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Détermine si un événement (mono-jour, multi-jours, all-day, minuté ou récurrent) est actif à la date dateStr (YYYY-MM-DD)
  isEventOnDate(evt, dateStr) {
    if (!evt || !evt.start) return false;
    const startDay = evt.start.slice(0, 10);
    const endDay = evt.end ? evt.end.slice(0, 10) : startDay;
    const effectiveEndDay = endDay >= startDay ? endDay : startDay;

    // Prise en charge de la récurrence (daily, weekly, monthly)
    if (evt.recurrence && evt.recurrence !== 'none') {
      if (dateStr < startDay) return false; // Avant la date de création
      if (evt.recurrenceEnd && dateStr > evt.recurrenceEnd) return false;

      if (evt.recurrence === 'daily') {
        return true;
      }
      if (evt.recurrence === 'weekly') {
        const targetD = new Date(`${dateStr}T00:00:00`);
        const startD = new Date(`${startDay}T00:00:00`);
        return targetD.getDay() === startD.getDay();
      }
      if (evt.recurrence === 'monthly') {
        const targetD = new Date(`${dateStr}T00:00:00`);
        const startD = new Date(`${startDay}T00:00:00`);
        return targetD.getDate() === startD.getDate();
      }
    }

    // Si la date est en dehors de la plage d'inclusion [startDay, effectiveEndDay]
    if (dateStr < startDay || dateStr > effectiveEndDay) {
      return false;
    }

    // Cas particulier : événement horodaté se terminant exactement à 00:00 sur effectiveEndDay
    // (Dans ce cas, aucune minute n'est passée sur le jour d'arrivée, il s'est terminé à minuit la veille)
    if (!evt.isAllDay && dateStr === effectiveEndDay && startDay < effectiveEndDay) {
      const endTime = evt.end.length >= 16 ? evt.end.slice(11, 16) : '';
      if (endTime === '00:00') {
        return false;
      }
    }

    return true;
  },

  // Algorithme d'agencement des chevauchements d'événements simultanés (RÈGLE IMPÉRATIVE N°3)
  computeOverlappingLayout(dayEvents, dateStr = null) {
    if (dayEvents.length === 0) return [];

    const defaultDayStartMin = this.dayHoursStart * 60; // 7 * 60 = 420
    const defaultDayEndMin = this.dayHoursEnd * 60;     // 23 * 60 = 1380

    const fastParseMinutes = (isoStr, fallbackMin) => {
      if (typeof isoStr === 'string' && isoStr.length >= 16) {
        const h = (isoStr.charCodeAt(11) - 48) * 10 + (isoStr.charCodeAt(12) - 48);
        const m = (isoStr.charCodeAt(14) - 48) * 10 + (isoStr.charCodeAt(15) - 48);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
      }
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? fallbackMin : (d.getHours() * 60 + d.getMinutes());
    };

    // 1. Convertir les heures de début et fin en minutes relatives depuis 00h00
    const parsed = dayEvents.map(evt => {
      const startDay = evt.start ? evt.start.slice(0, 10) : '';
      const endDay = evt.end ? evt.end.slice(0, 10) : startDay;
      const effectiveEndDay = endDay >= startDay ? endDay : startDay;

      let startMin;
      let endMin;

      if (evt.isAllDay) {
        // Pour les journées entières, créneau standard de 08:00 à 19:00
        startMin = 8 * 60;
        endMin = 19 * 60;
      } else {
        const rawStartMin = fastParseMinutes(evt.start, 8 * 60);
        const rawEndMin = fastParseMinutes(evt.end, rawStartMin + 60);

        if (!dateStr || startDay === effectiveEndDay || (evt.recurrence && evt.recurrence !== 'none')) {
          // Événement mono-jour, récurrent ou pas de dateStr fourni
          startMin = rawStartMin;
          endMin = Math.max(startMin + 20, rawEndMin);
        } else {
          // Événement horodaté multi-jours : borner selon la journée courante
          if (dateStr === startDay) {
            startMin = rawStartMin;
            endMin = Math.max(startMin + 20, defaultDayEndMin);
          } else if (dateStr === effectiveEndDay) {
            startMin = defaultDayStartMin;
            endMin = Math.max(startMin + 20, rawEndMin);
          } else {
            // Jour intermédiaire complet
            startMin = defaultDayStartMin;
            endMin = defaultDayEndMin;
          }
        }
      }

      return {
        event: evt,
        startMin,
        endMin
      };
    });

    // 2. Trier par heure de début, puis durée décroissante
    parsed.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // 3. Regrouper par grappes qui se chevauchent
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    parsed.forEach(item => {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterEnd = item.endMin;
      } else if (item.startMin < clusterEnd) {
        // Chevauchement détecté !
        currentCluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.endMin;
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // 4. Dans chaque grappe, répartir en colonnes virtuelles (sans collision)
    const layout = [];

    clusters.forEach(cluster => {
      const columns = []; // Liste de tableaux d'événements pour chaque sous-colonne
      cluster.forEach(item => {
        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const lastInCol = columns[colIdx][columns[colIdx].length - 1];
          if (item.startMin >= lastInCol.endMin) {
            columns[colIdx].push(item);
            item.col = colIdx;
            placed = true;
            break;
          }
        }
        if (!placed) {
          item.col = columns.length;
          columns.push([item]);
        }
      });

      const totalCols = columns.length;
      cluster.forEach(item => {
        layout.push({
          event: item.event,
          startMin: item.startMin,
          endMin: item.endMin,
          colIndex: item.col,
          totalCols: totalCols
        });
      });
    });

    return layout;
  },

  renderMonthView(allEvents, taskMap, noteById, noteByEventId) {
    if (!this.currentWeekStart) this.initWeek();
    const gridEl = document.getElementById('calendar-month-grid');
    if (!gridEl) return;

    const currentYear = this.currentWeekStart.getFullYear();
    const currentMonth = this.currentWeekStart.getMonth();
    const firstOfMonth = new Date(currentYear, currentMonth, 1);

    const firstDayIndex = firstOfMonth.getDay(); // 0 = Dim, 1 = Lun, ...
    const diffToMonday = firstDayIndex === 0 ? -6 : 1 - firstDayIndex;
    const startCalendarDate = new Date(currentYear, currentMonth, 1 + diffToMonday);
    startCalendarDate.setHours(0, 0, 0, 0);

    const todayStr = this.formatDateIso(new Date());
    const lastOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const cellsToRender = (startCalendarDate.getTime() + 35 * 86400000) <= lastOfMonth.getTime() ? 42 : 35;

    let gridHtml = '';
    const iterDate = new Date(startCalendarDate);

    for (let c = 0; c < cellsToRender; c++) {
      const dateIso = this.formatDateIso(iterDate);
      const isOtherMonth = iterDate.getMonth() !== currentMonth;
      const isToday = dateIso === todayStr;

      const dayEvents = allEvents.filter(e => this.isEventOnDate(e, dateIso));

      let pillsHtml = '';
      dayEvents.forEach(e => {
        const eventColor = e.color || (e.source === 'google' ? '#2563eb' : '#7c3aed');
        const startTimeStr = e.start && e.start.length >= 16 ? e.start.slice(11, 16) : '';
        const titleSafe = this.escapeHtml(e.title || '(Sans titre)');
        pillsHtml += `
          <div class="month-event-pill" 
               style="background: ${eventColor};" 
               data-event-id="${e.id}"
               onclick="event.stopPropagation(); AgendaManager.openEventModal('${e.id}');"
               title="${titleSafe} (${e.isAllDay ? 'Journée' : startTimeStr})">
            ${(e.recurrence && e.recurrence !== 'none') ? '🔁 ' : ''}${titleSafe}
          </div>
        `;
      });

      gridHtml += `
        <div class="month-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
             data-date="${dateIso}"
             onclick="AgendaManager.openEventModal(null, { start: '${dateIso}T09:00', end: '${dateIso}T10:00' });">
          <div class="month-day-header">
            <span class="month-day-number">${iterDate.getDate()}</span>
          </div>
          <div class="month-day-events" style="display:flex; flex-direction:column; gap:2px; overflow-y:auto; max-height:85px;">
            ${pillsHtml}
          </div>
        </div>
      `;

      iterDate.setDate(iterDate.getDate() + 1);
    }

    gridEl.innerHTML = gridHtml;
  },

  render() {
    if (typeof document === 'undefined') return;
    const weekdaysEl = document.getElementById('calendar-weekdays-container');
    const bodyEl = document.getElementById('calendar-body-container');
    const labelEl = document.getElementById('calendar-week-label');
    const weekViewContainer = document.getElementById('calendar-week-view');
    const monthViewContainer = document.getElementById('calendar-month-view');
    if (!weekdaysEl || !bodyEl) return;
    if (!this.currentWeekStart) this.initWeek();

    const allEvents = this.getAll();
    const tasks = StorageManager.getTasks();
    const allNotes = StorageManager.getNotes();

    // Indexation O(1) des tâches
    const taskMap = new Map();
    const indexTasksRecursive = (list) => {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        taskMap.set(t.id, { task: t, parentList: list });
        if (t.subtasks && t.subtasks.length > 0) indexTasksRecursive(t.subtasks);
      }
    };
    indexTasksRecursive(tasks);

    // Indexation O(1) des notes
    const noteById = new Map();
    const noteByEventId = new Map();
    for (let i = 0; i < allNotes.length; i++) {
      const n = allNotes[i];
      noteById.set(n.id, n);
      if (n.linkedEventId) noteByEventId.set(n.linkedEventId, n);
    }

    // Gestion de la vue Mois
    if (this.currentView === 'month') {
      if (weekViewContainer) weekViewContainer.style.display = 'none';
      if (monthViewContainer) monthViewContainer.style.display = 'flex';

      const monthDate = new Date(this.currentWeekStart);
      const monthTitle = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (labelEl) labelEl.textContent = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

      this.renderMonthView(allEvents, taskMap, noteById, noteByEventId);
      return;
    }

    // Vues Jour et Semaine
    if (weekViewContainer) weekViewContainer.style.display = 'flex';
    if (monthViewContainer) monthViewContainer.style.display = 'none';

    // Calcul dynamique de la hauteur des créneaux horaires
    const availableHeight = bodyEl.clientHeight || (typeof window !== 'undefined' ? (window.innerHeight - 170) : 800);
    const totalHours = this.dayHoursEnd - this.dayHoursStart; // 23 - 7 = 16
    this.slotHeight = Math.max(34, Math.floor(availableHeight / totalHours));
    const totalGridHeight = this.slotHeight * totalHours;

    let days = [];
    const todayStr = this.formatDateIso(new Date());

    if (this.currentView === 'day') {
      const singleDay = new Date(this.currentWeekStart);
      days = [singleDay];
      const dayTitle = singleDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (labelEl) labelEl.textContent = dayTitle.charAt(0).toUpperCase() + dayTitle.slice(1);

      weekdaysEl.style.gridTemplateColumns = '55px 1fr';
      weekdaysEl.style.minWidth = 'auto';
      bodyEl.style.gridTemplateColumns = '55px 1fr';
      bodyEl.style.minWidth = 'auto';
    } else {
      days = this.getWeekDays();
      const options = { day: 'numeric', month: 'short' };
      const firstDayStr = days[0].toLocaleDateString('fr-FR', options);
      const lastDayStr = days[6].toLocaleDateString('fr-FR', { ...options, year: 'numeric' });
      if (labelEl) labelEl.textContent = `${firstDayStr} - ${lastDayStr}`;

      weekdaysEl.style.gridTemplateColumns = '55px repeat(7, 1fr)';
      weekdaysEl.style.minWidth = '680px';
      bodyEl.style.gridTemplateColumns = '55px repeat(7, 1fr)';
      bodyEl.style.minWidth = '680px';
    }

    // 1. En-têtes des jours
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    let weekdaysHtml = `<div class="weekday-header" style="border-right: 1px solid var(--border-color);"></div>`;
    days.forEach((d) => {
      const iso = this.formatDateIso(d);
      const isToday = iso === todayStr;
      const dayIdx = (d.getDay() + 6) % 7;
      weekdaysHtml += `
        <div class="weekday-header ${isToday ? 'today' : ''}">
          <span class="weekday-name">${dayNames[dayIdx]}</span>
          <span class="weekday-num">${d.getDate()}</span>
        </div>
      `;
    });
    weekdaysEl.innerHTML = weekdaysHtml;

    // 2. Colonne des heures (07:00 à 22:00)
    let bodyHtml = `<div class="time-gutter" style="height: ${totalGridHeight}px;">`;
    for (let h = this.dayHoursStart; h <= this.dayHoursEnd; h++) {
      const hh = String(h).padStart(2, '0') + ':00';
      bodyHtml += `<div class="time-slot-label" style="height: ${this.slotHeight}px;">${hh}</div>`;
    }
    bodyHtml += `</div>`;

    // 3. Colonnes des jours
    const startRangeIso = this.formatDateIso(days[0]);
    const endRangeIso = this.formatDateIso(days[days.length - 1]);
    const rangeEvents = allEvents.filter(e => {
      if (!e || !e.start) return false;
      if (e.recurrence && e.recurrence !== 'none') return true;
      const sDay = e.start.slice(0, 10);
      const eDay = e.end ? e.end.slice(0, 10) : sDay;
      const effEnd = eDay >= sDay ? eDay : sDay;
      return effEnd >= startRangeIso && sDay <= endRangeIso;
    });

    days.forEach(d => {
      const dateStr = this.formatDateIso(d);
      const dayEvents = rangeEvents.filter(e => this.isEventOnDate(e, dateStr));
      const layoutEvents = this.computeOverlappingLayout(dayEvents, dateStr);

      bodyHtml += `<div class="day-column" data-date="${dateStr}" style="height: ${totalGridHeight}px; background-size: 100% ${this.slotHeight}px;">`;

      layoutEvents.forEach(item => {
        const e = item.event;
        const startH = item.startMin / 60;
        const endH = item.endMin / 60;

        // Position relative à 07h00
        const top = Math.max(0, (startH - this.dayHoursStart) * this.slotHeight);
        const durationH = Math.max(0.35, endH - startH);
        const height = Math.max(26, durationH * this.slotHeight - 2);

        // Position horizontale en colonnes virtuelles pour chevauchements
        const widthPct = item.totalCols > 1 ? (100 / item.totalCols) - 1.5 : 99;
        const leftPct = (item.colIndex * (100 / item.totalCols)) + 0.5;

        const isGoogle = e.source === 'google';
        const startDay = e.start ? e.start.slice(0, 10) : '';
        const endDay = e.end ? e.end.slice(0, 10) : startDay;
        const isMultiDay = startDay && endDay && endDay > startDay;

        const startTimeStr = e.start && e.start.length >= 16 ? e.start.slice(11, 16) : '';
        const endTimeStr = e.end && e.end.length >= 16 ? e.end.slice(11, 16) : '';

        let timeDisplay = '';
        if (e.isAllDay) {
          timeDisplay = isMultiDay ? 'Journée (multi-j)' : 'Journée entière';
        } else if (isMultiDay) {
          if (dateStr === startDay) {
            timeDisplay = `${startTimeStr} ➔`;
          } else if (dateStr === endDay) {
            timeDisplay = `➔ ${endTimeStr}`;
          } else {
            timeDisplay = 'Journée continue';
          }
        } else {
          timeDisplay = `${startTimeStr} - ${endTimeStr}`;
        }

        const linkedTask = e.taskId ? taskMap.get(e.taskId) : null;
        const linkedNote = (e.noteId ? noteById.get(e.noteId) : null) || noteByEventId.get(e.id);
        const isCompact = height < 44;

        // Code couleur validé par l'utilisateur (dynamique inline)
        const eventColor = e.color || (isGoogle ? '#2563eb' : '#7c3aed');

        bodyHtml += `
          <div class="calendar-event ${isGoogle ? 'google-event' : 'antigravite-event'} ${isCompact ? 'compact' : ''}" 
               data-event-id="${e.id}"
               style="top: ${top}px; height: ${height}px; left: ${leftPct}%; width: ${widthPct}%; background: linear-gradient(135deg, ${eventColor} 0%, ${eventColor}ee 100%) !important; border: 1px solid rgba(255, 255, 255, 0.25) !important; border-left: 4px solid rgba(255, 255, 255, 0.8) !important; color: #ffffff !important; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"
               onmousedown="AgendaManager.onEventMouseDown(event, '${e.id}')"
               onclick="AgendaManager.onEventClick(event, '${e.id}')"
               title="${this.escapeHtml(e.title)} (${timeDisplay}${isMultiDay ? ' • du ' + startDay + ' au ' + endDay : ''})${isGoogle ? ' [Google Agenda]' : ' [Antigravité]'}${linkedTask ? ' [Lié à tâche: ' + this.escapeHtml(linkedTask.task.title) + ']' : ''}${linkedNote ? ' [Note: ' + this.escapeHtml(linkedNote.title) + ']' : ''}">
            
            <div class="event-resize-handle handle-top" data-action="resize-top" title="Ajuster l'heure de début"></div>

            ${isCompact ? `
              <div class="event-compact-row">
                ${isGoogle ? '<span class="event-origin-tag google" style="font-size:0.55rem; padding:0 3px;">G</span>' : ''}
                <span class="event-title compact" style="color:#ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85);">${(e.recurrence && e.recurrence !== 'none') ? '🔁 ' : ''}${this.escapeHtml(e.title || '(Sans titre)')}</span>
                <span class="event-time-compact" style="color: rgba(255,255,255,0.95); margin-left: auto;">${e.isAllDay ? 'Jour' : (isMultiDay && dateStr !== startDay ? '➔ ' + endTimeStr : startTimeStr)}</span>
              </div>
            ` : `
              <div class="event-header-row">
                ${isGoogle ? (e.syncStatus && e.syncStatus.startsWith('pending')
                  ? '<span class="event-origin-tag" style="background:rgba(245,158,11,0.35); color:#fbbf24; border:1px solid rgba(245,158,11,0.5);">⏳ Sync</span>'
                  : '<span class="event-origin-tag google">Google</span>') 
                  : '<span class="event-time-pill" style="margin-left:0;">' + timeDisplay + '</span>'}
                ${isGoogle ? '<span class="event-time-pill">' + timeDisplay + '</span>' : ''}
              </div>
              <div class="event-title" style="color:#ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85);">${(e.recurrence && e.recurrence !== 'none') ? '<span title="Créneau récurrent">🔁</span> ' : ''}${this.escapeHtml(e.title || '(Sans titre)')}</div>
              ${e.location ? `<div class="event-location" title="${this.escapeHtml(e.location)}">📍 ${this.escapeHtml(e.location)}</div>` : ''}
              ${linkedTask ? `<div class="event-linked-info" title="Tâche : ${this.escapeHtml(linkedTask.task.title)}">📌 ${this.escapeHtml(linkedTask.task.title)}</div>` : ''}
              ${linkedNote ? `<div class="event-linked-info" title="Note : ${this.escapeHtml(linkedNote.title)}">📝 ${this.escapeHtml(linkedNote.title)}</div>` : ''}
            `}

            <div class="event-resize-handle handle-bottom" data-action="resize-bottom" title="Ajuster l'heure de fin"></div>
          </div>
        `;
      });

      bodyHtml += `</div>`;
    });

    bodyEl.innerHTML = bodyHtml;
  },

  openEventModal(eventId = null, defaultValues = null) {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('event-modal-title');
    const inputTitle = document.getElementById('event-input-title');
    const inputDesc = document.getElementById('event-input-desc');
    const inputStart = document.getElementById('event-input-start');
    const inputEnd = document.getElementById('event-input-end');
    const inputColor = document.getElementById('event-input-color');
    const inputTask = document.getElementById('event-input-task');
    const inputNote = document.getElementById('event-input-note');
    const btnOpenNote = document.getElementById('btn-event-open-note');
    const btnSave = document.getElementById('event-modal-save');
    const btnDelete = document.getElementById('event-modal-delete');

    const googleInfoBanner = document.getElementById('event-modal-google-info');
    const groupLocation = document.getElementById('event-group-location');
    const inputLocation = document.getElementById('event-input-location');
    const btnOpenGoogle = document.getElementById('btn-event-open-google');
    const groupDest = document.getElementById('event-group-destination');
    const btnDestLocal = document.getElementById('event-dest-local');
    const btnDestGoogle = document.getElementById('event-dest-google');
    const inputAllDay = document.getElementById('event-input-allday');
    const inputRecurrence = document.getElementById('event-input-recurrence');
    const checkCreateTask = document.getElementById('event-check-create-task');
    const containerCreateTask = document.getElementById('event-create-task-container');
    const detailsNewTask = document.getElementById('event-new-task-details');
    const selectTaskProject = document.getElementById('event-task-project');
    const selectTaskPriority = document.getElementById('event-task-priority');
    const btnOpenTask = document.getElementById('btn-event-open-task');

    let selectedDest = 'local';

    // Remplir les projets pour la création directe de tâche
    if (selectTaskProject) {
      selectTaskProject.innerHTML = '<option value="">(Aucun projet)</option>';
      const allProjects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
      allProjects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.title;
        selectTaskProject.appendChild(opt);
      });
    }

    const updateTaskButtonVisibility = (taskId) => {
      if (btnOpenTask) {
        btnOpenTask.style.display = taskId ? 'inline-flex' : 'none';
        btnOpenTask.onclick = (e) => {
          e.preventDefault();
          this.closeEventModal();
          if (window.App && typeof window.App.navigate === 'function') {
            window.App.navigate('tasks');
          }
          if (window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
            window.TasksManager.openTaskModal(taskId);
          }
        };
      }
    };

    if (checkCreateTask) {
      checkCreateTask.checked = false;
      if (detailsNewTask) detailsNewTask.style.display = 'none';
      checkCreateTask.onchange = () => {
        if (checkCreateTask.checked) {
          if (detailsNewTask) detailsNewTask.style.display = 'block';
          inputTask.value = '';
          updateTaskButtonVisibility(null);
          inputTask.disabled = true;
        } else {
          if (detailsNewTask) detailsNewTask.style.display = 'none';
          inputTask.disabled = false;
        }
      };
    }

    // Palette de sélection de couleurs pré-définies et nuance sur mesure
    const presetSwatches = modal.querySelectorAll('.color-swatch:not(.color-swatch-custom)');
    const customSwatch = modal.querySelector('.color-swatch-custom');

    const updateActiveSwatch = (chosenColor) => {
      const targetColor = (chosenColor || '').toLowerCase();
      let matchedPreset = false;
      presetSwatches.forEach(sw => {
        const swColor = (sw.dataset.color || '').toLowerCase();
        const isMatch = swColor === targetColor;
        sw.classList.toggle('active', isMatch);
        if (isMatch) matchedPreset = true;
      });

      if (customSwatch) {
        if (!matchedPreset && targetColor) {
          customSwatch.classList.add('active');
          customSwatch.style.background = targetColor;
          customSwatch.title = `Couleur personnalisée (${targetColor})`;
        } else {
          customSwatch.classList.remove('active');
          customSwatch.style.background = '';
          customSwatch.title = 'Nuance sur mesure (palette complète)';
        }
      }
    };

    presetSwatches.forEach(sw => {
      sw.onclick = () => {
        if (inputColor) inputColor.value = sw.dataset.color;
        updateActiveSwatch(sw.dataset.color);
      };
    });

    if (inputColor) {
      inputColor.oninput = () => updateActiveSwatch(inputColor.value);
      inputColor.onchange = () => updateActiveSwatch(inputColor.value);
    }

    // Remplir les tâches pour la liaison facultative (regroupées par projet)
    const tasks = StorageManager.getTasks();
    const allProjects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
    const projectMap = new Map();
    allProjects.forEach(p => projectMap.set(p.id, p.title));

    inputTask.innerHTML = '<option value="">(Aucune tâche associée)</option>';
    const personalTasks = [];
    const tasksByProj = new Map();

    const flattenTasks = (list, prefix = '') => {
      list.forEach(t => {
        const item = { id: t.id, title: prefix + t.title, completed: !!t.completed, projectId: t.projectId };
        if (t.projectId && projectMap.has(t.projectId)) {
          if (!tasksByProj.has(t.projectId)) tasksByProj.set(t.projectId, []);
          tasksByProj.get(t.projectId).push(item);
        } else {
          personalTasks.push(item);
        }
        if (t.subtasks && t.subtasks.length > 0) flattenTasks(t.subtasks, prefix + '— ');
      });
    };
    flattenTasks(tasks);

    if (personalTasks.length > 0) {
      const grp = document.createElement('optgroup');
      grp.label = "👤 Tâches personnelles (sans projet)";
      personalTasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.completed ? '✓ ' : '') + t.title;
        grp.appendChild(opt);
      });
      inputTask.appendChild(grp);
    }

    tasksByProj.forEach((tList, pId) => {
      const grp = document.createElement('optgroup');
      grp.label = "📁 Projet : " + (projectMap.get(pId) || 'Projet');
      tList.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.completed ? '✓ ' : '') + t.title;
        grp.appendChild(opt);
      });
      inputTask.appendChild(grp);
    });

    inputTask.onchange = () => {
      updateTaskButtonVisibility(inputTask.value);
      if (checkCreateTask && inputTask.value) {
        checkCreateTask.checked = false;
        if (detailsNewTask) detailsNewTask.style.display = 'none';
      }
    };

    // Remplir les notes pour la liaison facultative (regroupées par projet)
    const allNotes = StorageManager.getNotes();
    if (inputNote) {
      inputNote.innerHTML = '<option value="">(Aucune note associée)</option>';
      const personalNotes = allNotes.filter(n => !n.projectId || !projectMap.has(n.projectId));
      const notesByProj = new Map();
      allNotes.forEach(n => {
        if (n.projectId && projectMap.has(n.projectId)) {
          if (!notesByProj.has(n.projectId)) notesByProj.set(n.projectId, []);
          notesByProj.get(n.projectId).push(n);
        }
      });

      if (personalNotes.length > 0) {
        const grp = document.createElement('optgroup');
        grp.label = "📝 Notes personnelles (sans projet)";
        personalNotes.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n.id;
          opt.textContent = n.title;
          grp.appendChild(opt);
        });
        inputNote.appendChild(grp);
      }

      notesByProj.forEach((nList, pId) => {
        const grp = document.createElement('optgroup');
        grp.label = "📁 Projet : " + (projectMap.get(pId) || 'Projet');
        nList.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n.id;
          opt.textContent = n.title;
          grp.appendChild(opt);
        });
        inputNote.appendChild(grp);
      });
    }

    const updateNoteButtonVisibility = (noteId) => {
      if (btnOpenNote) {
        btnOpenNote.style.display = noteId ? 'inline-flex' : 'none';
        btnOpenNote.onclick = (e) => {
          e.preventDefault();
          this.closeEventModal();
          if (window.App && typeof window.App.navigate === 'function') {
            window.App.navigate('notes');
          }
          if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
            window.NotesManager.selectNote(noteId);
          }
        };
      }
    };

    if (inputNote) {
      inputNote.onchange = () => {
        updateNoteButtonVisibility(inputNote.value);
      };
    }

    // Fonction d'ajustement dynamique selon le mode Journée entière
    const updateInputTypesForAllDay = (allDay) => {
      if (allDay) {
        const sVal = (inputStart.value || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const eVal = (inputEnd.value || '').slice(0, 10) || sVal;
        inputStart.type = 'date';
        inputEnd.type = 'date';
        inputStart.value = sVal;
        inputEnd.value = eVal;
      } else {
        const sVal = (inputStart.value || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const eVal = (inputEnd.value || '').slice(0, 10) || sVal;
        inputStart.type = 'datetime-local';
        inputEnd.type = 'datetime-local';
        inputStart.value = inputStart.value && inputStart.value.length >= 16 ? inputStart.value : `${sVal}T09:00`;
        inputEnd.value = inputEnd.value && inputEnd.value.length >= 16 ? inputEnd.value : `${eVal}T10:00`;
      }
    };

    if (inputAllDay) {
      inputAllDay.onchange = () => {
        updateInputTypesForAllDay(inputAllDay.checked);
      };
    }

    if (eventId) {
      const evt = this.getAll().find(e => e.id === eventId);
      if (!evt) return;

      const isGoogle = evt.source === 'google';

      if (isGoogle) {
        // Événement Google : modification bidirectionnelle (Phase 4)
        modalTitle.textContent = "Modifier l'événement Google Agenda";
        if (googleInfoBanner) googleInfoBanner.style.display = 'flex';
        if (groupDest) groupDest.style.display = 'none';

        if (groupLocation) {
          groupLocation.style.display = 'block';
          if (inputLocation) {
            inputLocation.value = evt.location || '';
            inputLocation.readOnly = false;
          }
        }

        if (btnOpenGoogle) {
          if (evt.htmlLink) {
            btnOpenGoogle.style.display = 'inline-flex';
            btnOpenGoogle.onclick = (e) => {
              e.preventDefault();
              if (window.AntigraviteAPI && typeof window.AntigraviteAPI.openExternal === 'function') {
                window.AntigraviteAPI.openExternal(evt.htmlLink);
              } else {
                window.open(evt.htmlLink, '_blank');
              }
            };
          } else {
            btnOpenGoogle.style.display = 'none';
          }
        }

        inputTitle.value = evt.title || '';
        inputTitle.readOnly = false;

        inputDesc.value = evt.description || '';
        inputDesc.readOnly = false;

        if (inputAllDay) {
          inputAllDay.checked = !!evt.isAllDay;
          inputAllDay.disabled = false;
          updateInputTypesForAllDay(evt.isAllDay);
        }

        if (evt.isAllDay) {
          inputStart.value = (evt.start || '').slice(0, 10);
          inputEnd.value = (evt.end || '').slice(0, 10);
        } else {
          inputStart.value = evt.start || '';
          inputEnd.value = evt.end || '';
        }
        inputStart.readOnly = false;
        inputEnd.readOnly = false;

        inputColor.value = evt.color || '#3b82f6';
        updateActiveSwatch(inputColor.value);
        inputColor.disabled = false;

        inputTask.value = evt.taskId || '';
        inputTask.disabled = false;

        if (inputNote) {
          inputNote.value = evt.noteId || '';
          updateNoteButtonVisibility(evt.noteId);
        }

        btnDelete.style.display = 'inline-flex';
        btnDelete.textContent = "Supprimer de Google Agenda";

        btnDelete.onclick = async () => {
          const hasLinkedTask = !!evt.taskId;
          const confirmMsg = "Voulez-vous vraiment supprimer cet événement de Google Agenda ?\n\n" +
            (hasLinkedTask 
              ? "📌 Note : La tâche Antigravité associée restera intacte dans votre liste." 
              : "Cette action supprimera le créneau de votre agenda Google.");

          if (confirm(confirmMsg)) {
            btnDelete.disabled = true;
            const originalText = btnDelete.textContent;
            btnDelete.textContent = "Suppression...";
            try {
              if (window.GoogleSyncManager && typeof window.GoogleSyncManager.deleteGoogleEvent === 'function') {
                await window.GoogleSyncManager.deleteGoogleEvent(evt);
              } else {
                this.deleteEvent(eventId);
              }
              this.closeEventModal();
            } catch (err) {
              alert("Erreur lors de la suppression Google : " + err.message);
            } finally {
              btnDelete.disabled = false;
              btnDelete.textContent = originalText;
            }
          }
        };

        btnSave.textContent = "Mettre à jour dans Google Agenda";

        btnSave.onclick = async () => {
          if (!inputTitle.value.trim()) return alert("Le titre est requis.");
          if (!inputStart.value || !inputEnd.value) return alert("Les dates/heures de début et fin sont requises.");

          const isAllDay = inputAllDay ? inputAllDay.checked : false;
          let startVal = inputStart.value;
          let endVal = inputEnd.value;

          if (isAllDay) {
            const startDateStr = (startVal || '').slice(0, 10);
            let endDateStr = (endVal || '').slice(0, 10) || startDateStr;
            if (endDateStr < startDateStr) endDateStr = startDateStr;
            startVal = `${startDateStr}T08:00`;
            endVal = `${endDateStr}T19:00`;
          }

          const noteId = inputNote ? (inputNote.value || null) : null;
          const updatedData = {
            title: inputTitle.value.trim(),
            description: inputDesc.value.trim(),
            location: inputLocation ? inputLocation.value.trim() : '',
            start: startVal,
            end: endVal,
            isAllDay,
            color: inputColor.value || '#3b82f6',
            taskId: inputTask.value || null,
            noteId
          };

          btnSave.disabled = true;
          const originalText = btnSave.textContent;
          btnSave.textContent = "Mise à jour Google...";

          try {
            if (window.GoogleSyncManager && typeof window.GoogleSyncManager.updateGoogleEvent === 'function') {
              await window.GoogleSyncManager.updateGoogleEvent(evt, updatedData);
            } else {
              // Repli local si service Google indisponible
              this.updateEvent(eventId, updatedData);
            }
            this.syncNoteEventLink(eventId, noteId);
            this.closeEventModal();
          } catch (err) {
            alert("Erreur lors de la mise à jour Google : " + err.message);
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = originalText;
          }
        };

      } else {
        // Événement local standard
        modalTitle.textContent = "Modifier le créneau d'agenda";
        if (googleInfoBanner) googleInfoBanner.style.display = 'none';
        if (groupDest) groupDest.style.display = 'none';

        if (groupLocation) {
          groupLocation.style.display = 'block';
          if (inputLocation) {
            inputLocation.value = evt.location || '';
            inputLocation.readOnly = false;
          }
        }

        inputTitle.readOnly = false;
        inputDesc.readOnly = false;
        inputStart.readOnly = false;
        inputEnd.readOnly = false;
        inputColor.disabled = false;
        inputTask.disabled = false;

        inputTitle.value = evt.title;
        inputDesc.value = evt.description || '';

        if (inputAllDay) {
          inputAllDay.checked = !!evt.isAllDay;
          inputAllDay.disabled = false;
          updateInputTypesForAllDay(evt.isAllDay);
        }

        if (evt.isAllDay) {
          inputStart.value = (evt.start || '').slice(0, 10);
          inputEnd.value = (evt.end || '').slice(0, 10);
        } else {
          inputStart.value = evt.start || '';
          inputEnd.value = evt.end || '';
        }

        inputColor.value = evt.color || '#3b82f6';
        updateActiveSwatch(inputColor.value);
        inputTask.value = evt.taskId || '';
        updateTaskButtonVisibility(evt.taskId);
        if (containerCreateTask) containerCreateTask.style.display = evt.taskId ? 'none' : 'block';
        if (inputRecurrence) inputRecurrence.value = evt.recurrence || 'none';

        if (inputNote) {
          inputNote.value = evt.noteId || '';
          updateNoteButtonVisibility(evt.noteId);
        }

        btnDelete.style.display = 'inline-flex';
        btnSave.textContent = "Enregistrer les modifications";

        btnDelete.onclick = () => {
          if (confirm("Supprimer ce créneau d'agenda ? (La tâche associée ne sera pas supprimée)")) {
            this.deleteEvent(eventId);
            this.closeEventModal();
          }
        };

        btnSave.onclick = () => {
          if (!inputTitle.value.trim()) return alert("Le titre est requis.");
          if (!inputStart.value || !inputEnd.value) return alert("Les heures de début et fin sont requises.");

          const isAllDay = inputAllDay ? inputAllDay.checked : false;
          let startVal = inputStart.value;
          let endVal = inputEnd.value;

          if (isAllDay) {
            const startDateStr = (startVal || '').slice(0, 10);
            let endDateStr = (endVal || '').slice(0, 10) || startDateStr;
            if (endDateStr < startDateStr) endDateStr = startDateStr;
            startVal = `${startDateStr}T08:00`;
            endVal = `${endDateStr}T19:00`;
          }

          let taskId = inputTask.value || null;
          if (checkCreateTask && checkCreateTask.checked && !taskId) {
            if (typeof TasksManager !== 'undefined' && typeof TasksManager.addTask === 'function') {
              const startTimeStr = startVal && startVal.length >= 16 ? startVal.slice(11, 16) : '09:00';
              const newTask = TasksManager.addTask({
                title: inputTitle.value.trim(),
                description: inputDesc.value.trim(),
                projectId: selectTaskProject ? (selectTaskProject.value || null) : null,
                priority: selectTaskPriority ? selectTaskPriority.value : 'medium',
                plannedDate: startVal.slice(0, 10),
                plannedTime: startTimeStr,
                skipEventCreation: true
              });
              if (newTask && newTask.id) taskId = newTask.id;
            }
          }
          const recurrence = inputRecurrence ? inputRecurrence.value : 'none';

          const noteId = inputNote ? (inputNote.value || null) : null;
          this.updateEvent(eventId, {
            title: inputTitle.value.trim(),
            description: inputDesc.value.trim(),
            location: inputLocation ? inputLocation.value.trim() : '',
            start: startVal,
            end: endVal,
            isAllDay,
            color: inputColor.value,
            taskId,
            noteId,
            recurrence
          });
          this.syncNoteEventLink(eventId, noteId);
          this.closeEventModal();
        };
      }
    } else {
      // Nouvel événement (choix de destination : Local ou Google)
      modalTitle.textContent = "Nouveau créneau / Événement";
      if (googleInfoBanner) googleInfoBanner.style.display = 'none';

      const isGoogleConnected = window.GoogleSyncManager && 
                                window.GoogleSyncManager.status && 
                                window.GoogleSyncManager.status.isConnected;

      if (groupDest) {
        groupDest.style.display = isGoogleConnected ? 'block' : 'none';
      }

      if (btnDestLocal && btnDestGoogle) {
        btnDestLocal.classList.add('active');
        btnDestGoogle.classList.remove('active');

        btnDestLocal.onclick = () => {
          selectedDest = 'local';
          btnDestLocal.classList.add('active');
          btnDestGoogle.classList.remove('active');
          btnSave.textContent = "Enregistrer le créneau";
        };

        btnDestGoogle.onclick = () => {
          selectedDest = 'google';
          btnDestGoogle.classList.add('active');
          btnDestLocal.classList.remove('active');
          btnSave.textContent = "Enregistrer dans Google Agenda";
        };
      }

      if (groupLocation) {
        groupLocation.style.display = 'block';
        if (inputLocation) {
          inputLocation.value = '';
          inputLocation.readOnly = false;
        }
      }

      inputTitle.readOnly = false;
      inputDesc.readOnly = false;
      inputStart.readOnly = false;
      inputEnd.readOnly = false;
      inputColor.disabled = false;
      inputTask.disabled = false;

      inputTitle.value = '';
      inputDesc.value = '';

      if (inputAllDay) {
        inputAllDay.checked = false;
        inputAllDay.disabled = false;
        updateInputTypesForAllDay(false);
      }
      
      const now = new Date();
      now.setMinutes(0);
      now.setSeconds(0);
      const startStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 3600000 - now.getTimezoneOffset() * 60000);
      const endStr = endDate.toISOString().slice(0, 16);

      inputStart.value = (defaultValues && defaultValues.start) ? defaultValues.start : startStr;
      inputEnd.value = (defaultValues && defaultValues.end) ? defaultValues.end : endStr;
      inputColor.value = (defaultValues && defaultValues.color) ? defaultValues.color : '#8b5cf6';
      updateActiveSwatch(inputColor.value);
      inputTask.value = (defaultValues && defaultValues.taskId) ? defaultValues.taskId : '';
      updateTaskButtonVisibility(inputTask.value);
      if (containerCreateTask) containerCreateTask.style.display = 'block';
      if (inputRecurrence) inputRecurrence.value = (defaultValues && defaultValues.recurrence) || 'none';

      if (inputNote) {
        inputNote.value = (defaultValues && defaultValues.noteId) ? defaultValues.noteId : '';
        updateNoteButtonVisibility(inputNote.value);
      }
      if (defaultValues && defaultValues.title) {
        inputTitle.value = defaultValues.title;
      }

      btnDelete.style.display = 'none';
      btnSave.textContent = "Enregistrer le créneau";

      btnSave.onclick = async () => {
        if (!inputTitle.value.trim()) return alert("Le titre est requis.");
        if (!inputStart.value || !inputEnd.value) return alert("Les dates/heures de début et fin sont requises.");

        const isAllDay = inputAllDay ? inputAllDay.checked : false;
        let startVal = inputStart.value;
        let endVal = inputEnd.value;

        if (isAllDay) {
          const startDateStr = (startVal || '').slice(0, 10);
          let endDateStr = (endVal || '').slice(0, 10) || startDateStr;
          if (endDateStr < startDateStr) endDateStr = startDateStr;
          startVal = `${startDateStr}T08:00`;
          endVal = `${endDateStr}T19:00`;
        }

        let taskId = inputTask.value || null;
        if (checkCreateTask && checkCreateTask.checked && !taskId) {
          if (typeof TasksManager !== 'undefined' && typeof TasksManager.addTask === 'function') {
            const startTimeStr = startVal && startVal.length >= 16 ? startVal.slice(11, 16) : '09:00';
            const newTask = TasksManager.addTask({
              title: inputTitle.value.trim(),
              description: inputDesc.value.trim(),
              projectId: selectTaskProject ? (selectTaskProject.value || null) : null,
              priority: selectTaskPriority ? selectTaskPriority.value : 'medium',
              plannedDate: startVal.slice(0, 10),
              plannedTime: startTimeStr,
              skipEventCreation: true
            });
            if (newTask && newTask.id) taskId = newTask.id;
          }
        }
        const recurrence = inputRecurrence ? inputRecurrence.value : 'none';

        const noteId = inputNote ? (inputNote.value || null) : null;
        const eventData = {
          title: inputTitle.value.trim(),
          description: inputDesc.value.trim(),
          location: inputLocation ? inputLocation.value.trim() : '',
          start: startVal,
          end: endVal,
          isAllDay,
          color: inputColor.value || '#3b82f6',
          taskId,
          noteId,
          recurrence
        };

        if (selectedDest === 'google') {
          btnSave.disabled = true;
          const originalText = btnSave.textContent;
          btnSave.textContent = "Envoi à Google...";

          try {
            if (window.GoogleSyncManager && typeof window.GoogleSyncManager.createGoogleEvent === 'function') {
              const created = await window.GoogleSyncManager.createGoogleEvent(eventData);
              if (created && noteId) {
                this.syncNoteEventLink(created.id, noteId);
              }
            } else {
              throw new Error("Module de synchronisation Google indisponible.");
            }
            this.closeEventModal();
          } catch (err) {
            alert("Erreur lors de la création Google : " + err.message);
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = originalText;
          }
        } else {
          const created = this.addEvent(eventData);
          if (created && noteId) {
            this.syncNoteEventLink(created.id, noteId);
          }
          this.closeEventModal();
        }
      };
    }

    modal.classList.add('active');
    inputTitle.focus();
  },

  syncNoteEventLink(eventId, noteId) {
    if (!eventId) return;
    const notes = StorageManager.getNotes();
    let changed = false;

    // Dissocier les notes précédemment associées à cet événement
    notes.forEach(n => {
      if (n.linkedEventId === eventId && n.id !== noteId) {
        n.linkedEventId = null;
        changed = true;
      }
    });

    // Associer la nouvelle note
    if (noteId) {
      const targetNote = notes.find(n => n.id === noteId);
      if (targetNote && targetNote.linkedEventId !== eventId) {
        targetNote.linkedEventId = eventId;
        changed = true;
      }
    }

    if (changed) {
      StorageManager.saveNotes(notes);
      if (window.NotesManager && typeof window.NotesManager.renderNotesList === 'function') {
        window.NotesManager.renderNotesList();
      }
    }
  },

  // Menu contextuel (Clic droit sur événement ou créneau libre)
  initContextMenu() {
    if (this._contextMenuBound || typeof document === 'undefined') return;
    this._contextMenuBound = true;

    document.addEventListener('contextmenu', (e) => {
      const agendaScreen = document.getElementById('screen-agenda');
      if (!agendaScreen || !agendaScreen.contains(e.target)) return;

      // Cas 1 : Clic droit sur un événement existant
      const eventEl = e.target.closest('.calendar-event');
      if (eventEl) {
        e.preventDefault();
        e.stopPropagation();
        const eventId = eventEl.dataset.eventId || (eventEl.getAttribute('onclick') ? eventEl.getAttribute('onclick').match(/'([^']+)'/)?.[1] : null);
        if (eventId) {
          this.showEventContextMenu(e.clientX, e.clientY, eventId);
          return;
        }
      }

      // Cas 2 : Clic droit sur un emplacement libre dans une colonne jour
      const dayCol = e.target.closest('.day-column');
      if (dayCol) {
        e.preventDefault();
        e.stopPropagation();
        const dateStr = dayCol.dataset.date;
        const rect = dayCol.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const hoursOffset = relY / this.slotHeight;
        const clickedHour = Math.floor(this.dayHoursStart + hoursOffset);
        
        // Arrondir par pas de 15 minutes (00, 15, 30, 45)
        const rawMinutes = Math.floor((hoursOffset % 1) * 60);
        const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15);
        const startHourStr = String(Math.min(23, Math.max(0, clickedHour))).padStart(2, '0');
        const startMinStr = String(roundedMinutes).padStart(2, '0');
        const startTime = `${startHourStr}:${startMinStr}`;

        const endHour = Math.min(23, clickedHour + 1);
        const endHourStr = String(endHour).padStart(2, '0');
        const endTime = `${endHourStr}:${startMinStr}`;

        this.showSlotContextMenu(e.clientX, e.clientY, dateStr, startTime, endTime);
        return;
      }
    });

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('agenda-context-menu');
      if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideContextMenu();
    });
  },

  showEventContextMenu(x, y, eventId) {
    const menu = document.getElementById('agenda-context-menu');
    const headerEl = document.getElementById('context-menu-header');
    const itemsEl = document.getElementById('context-menu-items');
    if (!menu || !headerEl || !itemsEl) return;

    const evt = this.getAll().find(e => e.id === eventId);
    if (!evt) return;

    const isGoogle = evt.source === 'google';
    headerEl.innerHTML = `
      <div style="font-weight:700; color:var(--text-main); font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${this.escapeHtml(evt.title || '(Sans titre)')}
      </div>
      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">
        ${isGoogle ? '🌐 Google Agenda' : '<img src="./assets/icon.png" class="antigravite-symbol-icon" alt=""> Antigravité'}
      </div>
    `;

    let html = `
      <div class="context-menu-item" id="cmenu-edit">
        <span class="item-icon">✏️</span>
        <span>Modifier l'événement</span>
      </div>
      <div class="context-menu-item danger" id="cmenu-delete">
        <span class="item-icon">🗑️</span>
        <span>Supprimer l'événement</span>
      </div>
    `;

    if (evt.taskId) {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="cmenu-task">
          <span class="item-icon">📌</span>
          <span>Voir la tâche associée</span>
        </div>
      `;
    }

    if (evt.noteId) {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="cmenu-note">
          <span class="item-icon">📝</span>
          <span>Voir la note associée</span>
        </div>
      `;
    }

    itemsEl.innerHTML = html;

    // Écouteurs des actions
    const btnEdit = document.getElementById('cmenu-edit');
    if (btnEdit) {
      btnEdit.onclick = () => {
        this.hideContextMenu();
        this.openEventModal(eventId);
      };
    }

    const btnDelete = document.getElementById('cmenu-delete');
    if (btnDelete) {
      btnDelete.onclick = () => {
        this.hideContextMenu();
        if (confirm(`Supprimer l'événement « ${evt.title} » ? (La tâche associée reste intacte)`)) {
          this.deleteEvent(eventId);
        }
      };
    }

    const btnTask = document.getElementById('cmenu-task');
    if (btnTask && evt.taskId) {
      btnTask.onclick = () => {
        this.hideContextMenu();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('tasks');
        }
        if (window.TasksManager && typeof window.TasksManager.openTaskModal === 'function') {
          window.TasksManager.openTaskModal(evt.taskId);
        }
      };
    }

    const btnNote = document.getElementById('cmenu-note');
    if (btnNote && evt.noteId) {
      btnNote.onclick = () => {
        this.hideContextMenu();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('notes');
        }
        if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
          window.NotesManager.selectNote(evt.noteId);
        }
      };
    }

    this.positionAndShowMenu(menu, x, y);
  },

  showSlotContextMenu(x, y, dateStr, startTime, endTime) {
    const menu = document.getElementById('agenda-context-menu');
    const headerEl = document.getElementById('context-menu-header');
    const itemsEl = document.getElementById('context-menu-items');
    if (!menu || !headerEl || !itemsEl) return;

    const d = new Date(`${dateStr}T00:00:00`);
    const dateLabel = isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });

    headerEl.innerHTML = `
      <div style="font-weight:700; color:var(--text-main); font-size:0.82rem; text-transform:capitalize;">
        📅 ${dateLabel}
      </div>
      <div style="font-size:0.72rem; color:var(--accent); font-weight:600; margin-top:2px;">
        Créneau : ${startTime} - ${endTime}
      </div>
    `;

    itemsEl.innerHTML = `
      <div class="context-menu-item" id="cmenu-add">
        <span class="item-icon">➕</span>
        <span>Ajouter un événement (${startTime})</span>
      </div>
      <div class="context-menu-item" id="cmenu-quick-add">
        <span class="item-icon">⚡</span>
        <span>Créneau rapide 1h Antigravité</span>
      </div>
    `;

    const btnAdd = document.getElementById('cmenu-add');
    if (btnAdd) {
      btnAdd.onclick = () => {
        this.hideContextMenu();
        this.openEventModal(null, {
          start: `${dateStr}T${startTime}`,
          end: `${dateStr}T${endTime}`
        });
      };
    }

    const btnQuick = document.getElementById('cmenu-quick-add');
    if (btnQuick) {
      btnQuick.onclick = () => {
        this.hideContextMenu();
        this.addEvent({
          title: "Nouveau créneau",
          start: `${dateStr}T${startTime}`,
          end: `${dateStr}T${endTime}`,
          source: 'local',
          color: '#8b5cf6'
        });
      };
    }

    this.positionAndShowMenu(menu, x, y);
  },

  positionAndShowMenu(menu, x, y) {
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';

    // Ajustement pour éviter de dépasser de l'écran
    const menuWidth = menu.offsetWidth || 230;
    const menuHeight = menu.offsetHeight || 160;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    let posX = x;
    let posY = y;

    if (posX + menuWidth > windowWidth - 10) {
      posX = Math.max(10, windowWidth - menuWidth - 10);
    }
    if (posY + menuHeight > windowHeight - 10) {
      posY = Math.max(10, windowHeight - menuHeight - 10);
    }

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.style.visibility = 'visible';
  },

  hideContextMenu() {
    const menu = document.getElementById('agenda-context-menu');
    if (menu) menu.style.display = 'none';
  },

  // ==========================================================
  // Glisser-déposer & Redimensionnement des Événements
  // ==========================================================

  parseHourDecimal(isoStr) {
    if (!isoStr) return 9;
    const timePart = isoStr.length >= 16 ? isoStr.slice(11, 16) : '09:00';
    const [h, m] = timePart.split(':').map(Number);
    return (h || 0) + ((m || 0) / 60);
  },

  formatHourDecimal(decH) {
    const totalMinutes = Math.round(decH * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const hh = String(Math.min(23, Math.max(0, h))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, m))).padStart(2, '0');
    return `${hh}:${mm}`;
  },

  initDragAndDrop() {
    if (this._dragDropBound || typeof window === 'undefined') return;
    this._dragDropBound = true;

    window.addEventListener('mousemove', (e) => {
      this.handleGlobalMouseMove(e);
    });

    window.addEventListener('mouseup', (e) => {
      this.handleGlobalMouseUp(e);
    });
  },

  onEventMouseDown(e, eventId) {
    if (e.button !== 0) return; // Uniquement le clic gauche

    const eventEl = e.currentTarget || e.target.closest('.calendar-event');
    if (!eventEl) return;

    const action = e.target.dataset.action; // 'resize-top', 'resize-bottom', ou undefined
    const isResize = action === 'resize-top' || action === 'resize-bottom';
    const mode = isResize ? action : 'move';

    const dayCol = eventEl.closest('.day-column');
    if (!dayCol) return;

    const initialDateStr = dayCol.dataset.date;
    const evt = this.getAll().find(ev => ev.id === eventId);
    if (!evt) return;

    const startH = this.parseHourDecimal(evt.start);
    let endH = this.parseHourDecimal(evt.end);
    if (endH <= startH) endH = startH + 1;
    const durationH = Math.max(0.25, endH - startH);

    const eventRect = eventEl.getBoundingClientRect();
    const grabOffsetY = e.clientY - eventRect.top;

    // Précaculer et mettre en cache les rectangles des colonnes pour éviter tout reflow synchrone (forced reflow) pendant le glissement
    const columnsCache = Array.from(document.querySelectorAll('.day-column')).map(col => ({
      el: col,
      rect: col.getBoundingClientRect(),
      date: col.dataset.date || initialDateStr
    }));

    this.dragSession = {
      eventId,
      eventEl,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      initialDateStr,
      currentDateStr: initialDateStr,
      initialStartH: startH,
      initialEndH: endH,
      currentStartH: startH,
      currentEndH: endH,
      durationH,
      grabOffsetY,
      columns: columnsCache
    };
  },

  onEventClick(e, eventId) {
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    this.openEventModal(eventId);
  },

  handleGlobalMouseMove(e) {
    if (!this.dragSession) return;
    const s = this.dragSession;

    const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
    if (!s.hasMoved) {
      if (dist < 4) return;
      s.hasMoved = true;
      this._suppressNextClick = true;
      if (s.mode === 'move') {
        s.eventEl.classList.add('is-dragging');
      } else {
        s.eventEl.classList.add('is-resizing');
      }
    }

    // Trouver la colonne jour sous le curseur depuis le cache de coordonnées (0 reflow DOM)
    const dayCols = s.columns || [];
    if (dayCols.length === 0) return;

    let targetColObj = null;
    for (let i = 0; i < dayCols.length; i++) {
      const c = dayCols[i];
      if (e.clientX >= c.rect.left && e.clientX <= c.rect.right) {
        targetColObj = c;
        break;
      }
    }

    if (!targetColObj) {
      let minDist = Infinity;
      for (let i = 0; i < dayCols.length; i++) {
        const c = dayCols[i];
        const centerX = c.rect.left + c.rect.width / 2;
        const d = Math.abs(e.clientX - centerX);
        if (d < minDist) {
          minDist = d;
          targetColObj = c;
        }
      }
    }

    const targetCol = targetColObj ? targetColObj.el : null;

    if (s.mode === 'move' && targetCol && targetColObj) {
      s.currentDateStr = targetColObj.date;
      
      // Mettre en valeur la colonne cible
      for (let i = 0; i < dayCols.length; i++) {
        dayCols[i].el.classList.toggle('drop-target', dayCols[i].el === targetCol);
      }

      // Calcul de la nouvelle heure de début depuis le rectangle mis en cache (0 reflow DOM)
      const colRect = targetColObj.rect;
      const relY = Math.max(0, e.clientY - colRect.top - s.grabOffsetY);
      const rawHour = this.dayHoursStart + (relY / this.slotHeight);
      const snappedStart = Math.round(rawHour * 4) / 4;
      
      // Clamper entre dayHoursStart (7) et dayHoursEnd - durationH
      s.currentStartH = Math.max(this.dayHoursStart, Math.min(this.dayHoursEnd - s.durationH, snappedStart));
      s.currentEndH = s.currentStartH + s.durationH;

      // Déplacer visuellement l'élément
      const topPx = (s.currentStartH - this.dayHoursStart) * this.slotHeight;
      s.eventEl.style.top = `${topPx}px`;

      // Si la colonne cible a changé, attacher visuellement dans la nouvelle colonne
      if (s.eventEl.parentElement !== targetCol) {
        targetCol.appendChild(s.eventEl);
      }
    } else if (s.mode === 'resize-bottom') {
      const parentCol = s.eventEl.closest('.day-column') || s.eventEl.parentElement;
      const colRect = parentCol.getBoundingClientRect();
      const relY = Math.max(0, e.clientY - colRect.top);
      const rawEnd = this.dayHoursStart + (relY / this.slotHeight);
      const snappedEnd = Math.round(rawEnd * 4) / 4;

      // Minimum 15 min (0.25h) après le début
      s.currentEndH = Math.max(s.initialStartH + 0.25, Math.min(this.dayHoursEnd, snappedEnd));
      s.currentStartH = s.initialStartH;

      const duration = s.currentEndH - s.currentStartH;
      const heightPx = Math.max(26, duration * this.slotHeight - 2);
      s.eventEl.style.height = `${heightPx}px`;
    } else if (s.mode === 'resize-top') {
      const parentCol = s.eventEl.closest('.day-column') || s.eventEl.parentElement;
      const colRect = parentCol.getBoundingClientRect();
      const relY = Math.max(0, e.clientY - colRect.top);
      const rawStart = this.dayHoursStart + (relY / this.slotHeight);
      const snappedStart = Math.round(rawStart * 4) / 4;

      // Minimum 15 min (0.25h) avant la fin
      s.currentStartH = Math.min(s.initialEndH - 0.25, Math.max(this.dayHoursStart, snappedStart));
      s.currentEndH = s.initialEndH;

      const topPx = (s.currentStartH - this.dayHoursStart) * this.slotHeight;
      const duration = s.currentEndH - s.currentStartH;
      const heightPx = Math.max(26, duration * this.slotHeight - 2);

      s.eventEl.style.top = `${topPx}px`;
      s.eventEl.style.height = `${heightPx}px`;
    }

    // Afficher l'indicateur d'horaire en temps réel
    this.updateDragIndicator(e.clientX, e.clientY, s);
  },

  async handleGlobalMouseUp(e) {
    if (!this.dragSession) return;
    const s = this.dragSession;
    this.dragSession = null;

    // Retirer l'indicateur flottant
    const indicator = document.getElementById('agenda-drag-indicator');
    if (indicator) indicator.style.display = 'none';

    // Nettoyer les classes visuelles
    document.querySelectorAll('.day-column').forEach(col => col.classList.remove('drop-target'));
    if (s.eventEl) {
      s.eventEl.classList.remove('is-dragging', 'is-resizing');
    }

    if (s.hasMoved) {
      // Bloquer le clic d'ouverture de modale pendant un court instant
      this._suppressNextClick = true;
      setTimeout(() => {
        this._suppressNextClick = false;
      }, 120);

      // Appliquer la modification
      await this.updateEventSchedule(s.eventId, s.currentDateStr, s.currentStartH, s.currentEndH);
    }
  },

  updateDragIndicator(x, y, s) {
    let indicator = document.getElementById('agenda-drag-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'agenda-drag-indicator';
      indicator.className = 'agenda-drag-indicator';
      document.body.appendChild(indicator);
    }

    const startTimeStr = this.formatHourDecimal(s.currentStartH);
    const endTimeStr = this.formatHourDecimal(s.currentEndH);

    let label = '';
    if (s.mode === 'move') {
      const d = new Date(`${s.currentDateStr}T00:00:00`);
      const dayLabel = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : s.currentDateStr;
      label = `📅 ${dayLabel} • ${startTimeStr} - ${endTimeStr}`;
    } else {
      const durationMin = Math.round((s.currentEndH - s.currentStartH) * 60);
      label = `⏱️ ${startTimeStr} - ${endTimeStr} (${durationMin} min)`;
    }

    indicator.textContent = label;
    indicator.style.display = 'block';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y - 12}px`;
  },

  async updateEventSchedule(eventId, newDateStr, newStartH, newEndH) {
    const events = this.getAll();
    const evt = events.find(e => e.id === eventId);
    if (!evt) return false;

    const startTimeStr = this.formatHourDecimal(newStartH);
    const endTimeStr = this.formatHourDecimal(newEndH);
    const newStart = `${newDateStr}T${startTimeStr}`;
    const newEnd = `${newDateStr}T${endTimeStr}`;

    const isGoogle = evt.source === 'google';
    const updatedData = {
      title: evt.title,
      description: evt.description || '',
      location: evt.location || '',
      start: newStart,
      end: newEnd,
      isAllDay: false,
      color: evt.color,
      taskId: evt.taskId,
      noteId: evt.noteId
    };

    if (isGoogle && window.GoogleSyncManager && typeof window.GoogleSyncManager.updateGoogleEvent === 'function') {
      try {
        await window.GoogleSyncManager.updateGoogleEvent(evt, updatedData);
        if (evt.taskId) {
          this.syncEventDateToTask(evt.taskId, newDateStr);
        }
      } catch (err) {
        console.warn("[Agenda] Erreur synchro Google au déplacement :", err);
        this.updateEvent(eventId, updatedData);
      }
    } else {
      this.updateEvent(eventId, updatedData);
    }

    const d = new Date(`${newDateStr}T00:00:00`);
    const dayLabel = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : newDateStr;
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`« ${evt.title} » : ${dayLabel} • ${startTimeStr} - ${endTimeStr}`, 'info');
    }
    return true;
  },

  closeEventModal() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.remove('active');
    const inputStart = document.getElementById('event-input-start');
    const inputEnd = document.getElementById('event-input-end');
    if (inputStart) inputStart.type = 'datetime-local';
    if (inputEnd) inputEnd.type = 'datetime-local';
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

if (typeof window !== 'undefined') {
  window.AgendaManager = AgendaManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgendaManager;
}
