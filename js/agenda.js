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
  dayHoursStart: 0, // 00:00 (Minuit)
  dayHoursEnd: 24,  // 24:00 (Minuit - 24 heures complètes)
  slotHeight: 50,   // ~50px par heure pour un focus confortable sur 07:00-23:00
  _lastScrollTop: null,
  _preserveScrollTop: null,

  getSvgIcon(name, size = 14, extraClass = '') {
    if (typeof App !== 'undefined' && typeof App.getSvgIcon === 'function') {
      return App.getSvgIcon(name, size, extraClass);
    }
    const cls = extraClass ? `app-icon ${extraClass}` : 'app-icon';
    switch (name) {
      case 'pin':
      case '📌':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
      case 'note':
      case '📝':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;
      case 'calendar':
      case '📅':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
      case 'sun':
      case '☀️':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
      case 'repeat':
      case '🔁':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
      case 'location':
      case '📍':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
      case 'check':
      case '✓':
      case '✅':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      case 'edit':
      case '✏️':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
      case 'trash':
      case '🗑️':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
      case 'plus':
      case '➕':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      case 'zap':
      case '⚡':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      case 'globe':
      case '🌐':
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
      default:
        return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }
  },

  scrollToNormalHours(smooth = false) {
    const bodyEl = document.getElementById('calendar-body-container') || document.getElementById('calendar-body') || (typeof document !== 'undefined' && document.querySelector ? document.querySelector('.calendar-body') : null);
    if (!bodyEl) return;
    const target = Math.round(7 * (this.slotHeight || 50));
    this._lastScrollTop = target;
    if (smooth && typeof bodyEl.scrollTo === 'function') {
      bodyEl.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      bodyEl.scrollTop = target;
    }
  },

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
    this.initRightClickExtend();
    this.initNowIndicatorTimer();
  },

  getMonday(d) {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Dimanche, 1 = Lundi, ...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 1 = Lundi
    const monday = new Date(date.getFullYear(), date.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  },

  initWeek() {
    this.currentWeekStart = this.getMonday(new Date());
  },

  navigatePrev() {
    if (!this.currentWeekStart) this.initWeek();
    if (this.currentView === 'day') {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 1);
      this.activeDateStr = this.formatDateIso(this.currentWeekStart);
    } else if (this.currentView === 'month') {
      this.currentWeekStart.setMonth(this.currentWeekStart.getMonth() - 1);
    } else {
      this.currentWeekStart = this.getMonday(this.currentWeekStart);
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
    }
    this.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress(this.activeDateStr || null);
    }
  },

  navigateNext() {
    if (!this.currentWeekStart) this.initWeek();
    if (this.currentView === 'day') {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 1);
      this.activeDateStr = this.formatDateIso(this.currentWeekStart);
    } else if (this.currentView === 'month') {
      this.currentWeekStart.setMonth(this.currentWeekStart.getMonth() + 1);
    } else {
      this.currentWeekStart = this.getMonday(this.currentWeekStart);
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
    }
    this.render();
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress(this.activeDateStr || null);
    }
  },

  navigateToday() {
    this.activeDateStr = null;
    const now = new Date();
    if (this.currentView === 'day') {
      now.setHours(0, 0, 0, 0);
      this.currentWeekStart = now;
    } else if (this.currentView === 'month') {
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      this.currentWeekStart = now;
    } else {
      this.currentWeekStart = this.getMonday(now);
    }
    this.render();
    this.scrollToNormalHours(true);
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress();
    }
  },

  resetToCurrentWeek() {
    this.activeDateStr = null;
    const now = new Date();
    this.currentView = 'week';
    this.currentWeekStart = this.getMonday(now);
    if (typeof document !== 'undefined') {
      const viewButtons = document.querySelectorAll('.btn-agenda-view');
      viewButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'week');
      });
    }
    this.render();
    if (typeof this.scrollToNormalHours === 'function') {
      this.scrollToNormalHours(false);
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress();
    }
  },

  setView(view) {
    if (!['day', 'week', 'month'].includes(view)) view = 'week';
    this.currentView = view;
    // Si on bascule sur la vue semaine, la semaine doit TOUJOURS débuter par un lundi
    if (view === 'week' && this.currentWeekStart) {
      this.currentWeekStart = this.getMonday(this.currentWeekStart);
    }
    if (typeof document !== 'undefined') {
      const viewButtons = document.querySelectorAll('.btn-agenda-view');
      viewButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.view === view);
      });
    }
    this.render();
  },

  zoomToDay(dateIso) {
    if (!dateIso) return;
    const parts = dateIso.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const targetDate = new Date(year, month, day);
    targetDate.setHours(0, 0, 0, 0);
    this.currentWeekStart = targetDate;
    this.activeDateStr = dateIso;
    if (typeof window !== 'undefined' && window.App && typeof window.App.triggerHapticFeedback === 'function') {
      window.App.triggerHapticFeedback();
    }
    if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress(dateIso);
    }
    this.setView('day');
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
        // Clic gauche uniquement pour la création standard
        if (e.button !== 0) return;
        // Ignorer si on a cliqué sur un événement, si un drag vient de se terminer ou après une session de clic droit
        if (e.target.closest('.calendar-event')) return;
        if (this._suppressNextClick || this._rightClickSession) {
          this._suppressNextClick = false;
          return;
        }

        const dayCol = e.target.closest('.day-column');
        if (!dayCol) return;

        const dateStr = dayCol.dataset.date;
        if (!dateStr) return;
        this.activeDateStr = dateStr;
        if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
          window.App.updateSidebarDayProgress(dateStr);
        }

        const rect = dayCol.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const hoursOffset = relY / this.slotHeight;
        const clickedHour = Math.floor(this.dayHoursStart + hoursOffset);

        // Arrondir par pas de 15 minutes (00, 15, 30, 45)
        const rawMinutes = Math.floor((hoursOffset % 1) * 60);
        const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15);
        const startHour = Math.min(23, Math.max(0, clickedHour));
        const startHourStr = String(startHour).padStart(2, '0');
        const startMinStr = String(roundedMinutes).padStart(2, '0');
        const startTime = `${startHourStr}:${startMinStr}`;

        let endTime;
        if (startHour >= 23) {
          endTime = '23:59';
        } else {
          const endHour = startHour + 1;
          const endHourStr = String(endHour).padStart(2, '0');
          endTime = `${endHourStr}:${startMinStr}`;
        }

        // Nettoyer l'indicateur visuel de survol lors de l'ouverture
        const activeHover = document.getElementById('agenda-slot-hover-indicator');
        if (activeHover) activeHover.remove();
        const activeLabel = calendarBody.querySelector('.time-slot-label.active-slot');
        if (activeLabel) activeLabel.classList.remove('active-slot');

        this.openEventModal(null, {
          start: `${dateStr}T${startTime}`,
          end: `${dateStr}T${endTime}`
        });
      });
    }

    // Indicateur interactif de survol de créneau heure par heure (Ghost slot)
    if (calendarBody && !this._gridHoverBound) {
      this._gridHoverBound = true;
      let hoverIndicator = null;
      let lastActiveLabel = null;

      const removeHover = () => {
        // Ne JAMAIS supprimer le retour visuel pendant qu'un clic droit est maintenu
        if (this._rightClickSession) return;
        if (hoverIndicator && hoverIndicator.parentElement) {
          hoverIndicator.remove();
        }
        if (lastActiveLabel) {
          lastActiveLabel.classList.remove('active-slot');
          lastActiveLabel = null;
        }
      };

      calendarBody.addEventListener('mousemove', (e) => {
        if (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function' && StorageManager.getSettings().disablePreviews === true) {
          removeHover();
          return;
        }
        // Ignorer complètement si une session de clic droit ou de drag est active, ou si un bouton est enfoncé
        if (this._rightClickSession || this.dragSession || (typeof document !== 'undefined' && document.querySelector('.dragging'))) {
          return;
        }
        if (e.buttons !== 0) {
          return;
        }
        if (e.target.closest('.calendar-event')) {
          removeHover();
          return;
        }

        const dayCol = e.target.closest('.day-column');
        if (!dayCol) {
          removeHover();
          return;
        }

        const dateStr = dayCol.dataset.date;
        if (!dateStr) {
          removeHover();
          return;
        }

        const rect = dayCol.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const hoursOffset = relY / this.slotHeight;
        const clickedHour = Math.floor(this.dayHoursStart + hoursOffset);

        // Même arrondi au quart d'heure que lors du clic (00, 15, 30, 45)
        const rawMinutes = Math.floor((hoursOffset % 1) * 60);
        const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15);

        const startHour = Math.min(23, Math.max(0, clickedHour));
        const startHourStr = String(startHour).padStart(2, '0');
        const startMinStr = String(roundedMinutes).padStart(2, '0');
        const startTime = `${startHourStr}:${startMinStr}`;

        let endTime;
        if (startHour >= 23) {
          endTime = '23:59';
        } else {
          const endHour = startHour + 1;
          const endHourStr = String(endHour).padStart(2, '0');
          endTime = `${endHourStr}:${startMinStr}`;
        }

        const topPx = (startHour - this.dayHoursStart + (roundedMinutes / 60)) * this.slotHeight;
        const totalHours = this.dayHoursEnd - this.dayHoursStart;
        const maxH = totalHours * this.slotHeight;
        const heightPx = Math.min(this.slotHeight, Math.max(20, maxH - topPx));

        if (!hoverIndicator || !hoverIndicator.parentElement) {
          hoverIndicator = document.getElementById('agenda-slot-hover-indicator');
          if (!hoverIndicator) {
            hoverIndicator = document.createElement('div');
            hoverIndicator.className = 'agenda-slot-hover-indicator';
            hoverIndicator.id = 'agenda-slot-hover-indicator';
            hoverIndicator.innerHTML = `
              <div class="agenda-slot-hover-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span class="agenda-slot-hover-time"></span>
              </div>
            `;
          }
        }

        const timeSpan = hoverIndicator.querySelector('.agenda-slot-hover-time');
        if (timeSpan) {
          timeSpan.textContent = `${startTime} – ${endTime}`;
        }

        hoverIndicator.style.top = `${topPx}px`;
        hoverIndicator.style.height = `${heightPx}px`;

        if (hoverIndicator.parentElement !== dayCol) {
          dayCol.appendChild(hoverIndicator);
        }

        // Mettre en évidence l'heure correspondante dans la colonne des heures (time-gutter)
        const hourLabel = calendarBody.querySelector(`.time-slot-label[data-hour="${startHour}"]`);
        if (lastActiveLabel && lastActiveLabel !== hourLabel) {
          lastActiveLabel.classList.remove('active-slot');
        }
        if (hourLabel) {
          hourLabel.classList.add('active-slot');
          lastActiveLabel = hourLabel;
        }
      });

      calendarBody.addEventListener('mouseleave', () => {
        if (!this._rightClickSession) {
          removeHover();
        }
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
    if (window.App) {
      if (typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
      if (typeof window.App.updateSidebarDayProgress === 'function') {
        window.App.updateSidebarDayProgress(this.activeDateStr || null);
      }
    }
    if (typeof window !== 'undefined' && window.ConstellationManager && typeof window.App !== 'undefined' && window.App.currentScreen === 'constellation') {
      window.ConstellationManager.render();
    }
    if (window.AgendaNotificationManager && typeof window.AgendaNotificationManager.checkUpcomingEvents === 'function') {
      window.AgendaNotificationManager.checkUpcomingEvents();
    }
  },

  addEvent(eventData) {
    if (eventData.start) {
      this.activeDateStr = eventData.start.slice(0, 10);
    }
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
      recurrenceEnd: (eventData.recurrence && eventData.recurrence !== 'none') ? (eventData.recurrenceEnd || null) : null,
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
    if (updatedData && updatedData.start) {
      this.activeDateStr = updatedData.start.slice(0, 10);
    }
    const events = this.getAll();
    const evt = events.find(e => e.id === id);
    if (!evt) return false;

    if (updatedData.title !== undefined) evt.title = updatedData.title.trim();
    if (updatedData.description !== undefined) evt.description = updatedData.description ? updatedData.description.trim() : '';
    if (updatedData.location !== undefined) evt.location = updatedData.location.trim();
    if (updatedData.start !== undefined) evt.start = updatedData.start;
    if (updatedData.end !== undefined) evt.end = updatedData.end;
    if (updatedData.isAllDay !== undefined) evt.isAllDay = !!updatedData.isAllDay;
    if (updatedData.color !== undefined) evt.color = updatedData.color || evt.color;
    evt.taskId = updatedData.taskId !== undefined ? updatedData.taskId : evt.taskId;
    if (updatedData.noteId !== undefined) evt.noteId = updatedData.noteId;
    if (updatedData.recurrence !== undefined) evt.recurrence = updatedData.recurrence;
    if (updatedData.recurrenceEnd !== undefined) {
      evt.recurrenceEnd = updatedData.recurrenceEnd || null;
    }
    if (evt.recurrence === 'none') {
      evt.recurrenceEnd = null;
    }
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

    // Détacher la note liée sans la modifier par ailleurs
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function') {
      try {
        const notes = StorageManager.getNotes();
        let notesChanged = false;
        notes.forEach(n => {
          if (n.linkedEventId === id) {
            n.linkedEventId = null;
            n.updatedAt = new Date().toISOString();
            notesChanged = true;
          }
        });
        if (notesChanged) {
          StorageManager.saveNotes(notes);
          if (typeof window !== 'undefined' && window.NotesManager) {
            if (typeof window.NotesManager.renderNotesList === 'function') window.NotesManager.renderNotesList();
            if (typeof window.NotesManager.renderEventSelector === 'function' && window.NotesManager.currentNoteId) {
              const current = notes.find(n => n.id === window.NotesManager.currentNoteId);
              if (current) window.NotesManager.renderEventSelector(current);
            }
          }
        }
      } catch (e) {
        console.warn("[AgendaManager] Erreur lors du nettoyage de la liaison note:", e);
      }
    }

    // Notification claire rassurant l'utilisateur
    if (hadTask) {
      if (window.App) window.App.showToast("Créneau supprimé. La tâche associée reste intacte.", "info");
    } else {
      if (window.App) window.App.showToast("Événement supprimé", "info");
    }
  },

  // Calcul des 7 jours de la semaine courante (commence TOUJOURS par lundi et finit par dimanche)
  getWeekDays() {
    const monday = this.getMonday(this.currentWeekStart || new Date());
    this.currentWeekStart = monday;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      d.setHours(0, 0, 0, 0);
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

  renderMonthView(allEvents, taskMap, noteById, noteByEventId, projectMap = null) {
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
        let eventColor = e.color;
        const linkedTask = e.taskId && taskMap ? taskMap.get(e.taskId) : null;
        const isTaskCompleted = !!(linkedTask && linkedTask.task && linkedTask.task.completed);
        if (linkedTask && linkedTask.task && linkedTask.task.projectId && projectMap) {
          const proj = projectMap.get(linkedTask.task.projectId);
          if (proj && proj.color) {
            eventColor = proj.color;
          }
        }
        if (!eventColor) {
          eventColor = (e.source === 'google' ? '#2563eb' : '#7c3aed');
        }
        const linkedNote = (e.noteId ? noteById.get(e.noteId) : null) || (noteByEventId ? noteByEventId.get(e.id) : null);
        const startTimeStr = e.start && e.start.length >= 16 ? e.start.slice(11, 16) : '';
        const titleSafe = this.escapeHtml(e.title || '(Sans titre)');
        pillsHtml += `
          <div class="month-event-pill ${isTaskCompleted ? 'task-completed-pill' : ''} ${e.isAllDay ? 'allday-month-pill' : ''}" 
               style="background: ${eventColor};" 
               data-event-id="${e.id}"
               onclick="event.stopPropagation(); AgendaManager.openEventModal('${e.id}');"
               title="${titleSafe} (${e.isAllDay ? 'Journée entière' : startTimeStr})${linkedTask ? ' [Lié à tâche: ' + this.escapeHtml(linkedTask.task.title) + (isTaskCompleted ? ' (Terminée ✓)' : '') + ']' : ''}${linkedNote ? ' [Note: ' + this.escapeHtml(linkedNote.title) + ']' : ''}">
            ${isTaskCompleted ? '<span style="color:#4ade80; display:inline-flex; align-items:center; margin-right:3px;" title="Tâche terminée">' + this.getSvgIcon('check', 10) + '</span>' : ''}${e.isAllDay ? '<span style="display:inline-flex; align-items:center; margin-right:2px;" title="Journée entière">' + this.getSvgIcon('sun', 10) + '</span>' : ''}${(e.recurrence && e.recurrence !== 'none') ? '<span style="display:inline-flex; align-items:center; margin-right:2px;" title="Événement récurrent">' + this.getSvgIcon('repeat', 10) + '</span>' : ''}${linkedNote ? '<span title="Note liée : ' + this.escapeHtml(linkedNote.title) + '" style="display:inline-flex; align-items:center; margin-right:2px;">' + this.getSvgIcon('note', 10) + '</span>' : ''}${titleSafe}
          </div>
        `;
      });

      gridHtml += `
        <div class="month-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
             data-date="${dateIso}"
             onclick="AgendaManager.openEventModal(null, { start: '${dateIso}T09:00', end: '${dateIso}T10:00' });">
          <div class="month-day-header clickable-day" 
               onclick="event.stopPropagation(); AgendaManager.zoomToDay('${dateIso}');" 
               title="Zoomer sur cette journée (${dateIso})">
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
    const allProjects = StorageManager.getProjects();
    const projectMap = new Map(allProjects.map(p => [p.id, p]));

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

      this.renderMonthView(allEvents, taskMap, noteById, noteByEventId, projectMap);
      return;
    }

    // Vues Jour et Semaine
    if (weekViewContainer) weekViewContainer.style.display = 'flex';
    if (monthViewContainer) monthViewContainer.style.display = 'none';

    // Conserver la position de scroll actuelle de l'utilisateur s'il scrollait déjà
    if (bodyEl && bodyEl.scrollTop > 0) {
      this._preserveScrollTop = bodyEl.scrollTop;
    }

    // Calcul dynamique de la hauteur des créneaux horaires
    // On calibre la hauteur sur ~15.5 heures (ex: 07h00 à 22h30/23h00) pour afficher
    // immédiatement la journée active tout en permettant de défiler librement de minuit à minuit.
    const availableHeight = bodyEl.clientHeight || (typeof window !== 'undefined' ? (window.innerHeight - 170) : 800);
    this.slotHeight = Math.max(44, Math.floor(availableHeight / 15.5));
    const totalHours = this.dayHoursEnd - this.dayHoursStart; // 24 - 0 = 24
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

      weekdaysEl.style.gridTemplateColumns = '55px repeat(7, minmax(0, 1fr))';
      weekdaysEl.style.minWidth = '680px';
      bodyEl.style.gridTemplateColumns = '55px repeat(7, minmax(0, 1fr))';
      bodyEl.style.minWidth = '680px';
    }

    // 1. En-têtes des jours
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    let weekdaysHtml = `<div class="weekday-header" style="border-right: 1px solid var(--border-color);"></div>`;
    days.forEach((d) => {
      const iso = this.formatDateIso(d);
      const isToday = iso === todayStr;
      const dayIdx = (d.getDay() + 6) % 7;
      const isClickable = this.currentView !== 'day';
      weekdaysHtml += `
        <div class="weekday-header ${isToday ? 'today' : ''} ${isClickable ? 'clickable-day' : ''}"
             ${isClickable ? `onclick="AgendaManager.zoomToDay('${iso}')" title="Zoomer sur cette journée (${iso})"` : ''}>
          <span class="weekday-name">${dayNames[dayIdx]}</span>
          <span class="weekday-num">${d.getDate()}</span>
        </div>
      `;
    });
    weekdaysEl.innerHTML = weekdaysHtml;

    // 2. Colonne des heures (00:00 à 23:00 - 24 créneaux)
    let bodyHtml = `<div class="time-gutter" style="height: ${totalGridHeight}px;">`;
    for (let h = this.dayHoursStart; h < this.dayHoursEnd; h++) {
      const hh = String(h).padStart(2, '0') + ':00';
      bodyHtml += `<div class="time-slot-label" data-hour="${h}" style="height: ${this.slotHeight}px;">${hh}</div>`;
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

    // 4. Bandeau supérieur des événements Journée Entière (All-Day Row au niveau du jour)
    let alldayEl = document.getElementById('calendar-allday-container');
    if (!alldayEl && weekdaysEl && weekdaysEl.parentNode) {
      alldayEl = document.createElement('div');
      alldayEl.id = 'calendar-allday-container';
      alldayEl.className = 'calendar-allday-row';
      alldayEl.style.display = 'none';
      weekdaysEl.parentNode.insertBefore(alldayEl, bodyEl);
    }

    const hasAnyAllDay = days.some(d => {
      const dateStr = this.formatDateIso(d);
      return rangeEvents.some(e => !!e.isAllDay && this.isEventOnDate(e, dateStr));
    });

    if (alldayEl) {
      if (hasAnyAllDay) {
        if (this.currentView === 'day') {
          alldayEl.style.gridTemplateColumns = '55px 1fr';
          alldayEl.style.minWidth = 'auto';
        } else {
          alldayEl.style.gridTemplateColumns = '55px repeat(7, minmax(0, 1fr))';
          alldayEl.style.minWidth = '680px';
        }
        alldayEl.style.display = 'grid';

        let alldayHtml = `
          <div class="calendar-allday-gutter"></div>
        `;

        days.forEach(d => {
          const dateStr = this.formatDateIso(d);
          const dayAllDayEvents = rangeEvents.filter(e => !!e.isAllDay && this.isEventOnDate(e, dateStr));
          const isToday = (dateStr === todayStr);

          alldayHtml += `<div class="calendar-allday-cell ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="AgendaManager.openEventModal(null, { start: '${dateStr}T09:00', end: '${dateStr}T10:00', isAllDay: true })" title="Cliquer pour ajouter un événement journée entière le ${dateStr}">`;

          dayAllDayEvents.forEach(e => {
            const isGoogle = e.source === 'google';
            const startDay = e.start ? e.start.slice(0, 10) : '';
            const endDay = e.end ? e.end.slice(0, 10) : startDay;
            const isMultiDay = startDay && endDay && endDay > startDay;

            const linkedTask = e.taskId ? taskMap.get(e.taskId) : null;
            const linkedNote = (e.noteId ? noteById.get(e.noteId) : null) || noteByEventId.get(e.id);
            const isTaskCompleted = !!(linkedTask && linkedTask.task && linkedTask.task.completed);

            let eventColor = e.color;
            if (linkedTask && linkedTask.task && linkedTask.task.projectId) {
              const proj = projectMap.get(linkedTask.task.projectId);
              if (proj && proj.color) eventColor = proj.color;
            }
            if (!eventColor) {
              eventColor = isGoogle ? '#2563eb' : '#7c3aed';
            }

            alldayHtml += `
              <div class="allday-event-pill ${isGoogle ? 'google' : 'antigravite'} ${isTaskCompleted ? 'task-completed-pill' : ''}"
                   data-event-id="${e.id}"
                   style="background: linear-gradient(135deg, ${eventColor} 0%, ${eventColor}dd 100%) !important; border-left: 4px solid #ffffff !important;"
                   onclick="event.stopPropagation(); AgendaManager.openEventModal('${e.id}');"
                   oncontextmenu="AgendaManager.showEventContextMenu(event.clientX, event.clientY, '${e.id}'); event.preventDefault(); event.stopPropagation();"
                   title="${this.escapeHtml(e.title || '(Sans titre)')} (Journée entière${isMultiDay ? ' • du ' + startDay + ' au ' + endDay : ''})${linkedTask ? ' [Lié à: ' + this.escapeHtml(linkedTask.task.title) + (isTaskCompleted ? ' (Terminée ✓)' : '') + ']' : ''}${linkedNote ? ' [Note: ' + this.escapeHtml(linkedNote.title) + ']' : ''}">
                <span class="allday-pill-tag">${this.getSvgIcon('sun', 11)} 24h</span>
                <span class="allday-pill-title">${(e.recurrence && e.recurrence !== 'none') ? '<span style="display:inline-flex; align-items:center; margin-right:3px;">' + this.getSvgIcon('repeat', 11) + '</span>' : ''}${this.escapeHtml(e.title || '(Sans titre)')}</span>
                <span class="allday-pill-badges">
                  ${isTaskCompleted ? '<span style="color:#4ade80; display:inline-flex; align-items:center;" title="Tâche terminée">' + this.getSvgIcon('check', 11) + '</span>' : (linkedTask ? '<span title="Lié à tâche : ' + this.escapeHtml(linkedTask.task.title) + '" style="display:inline-flex; align-items:center;">' + this.getSvgIcon('pin', 11) + '</span>' : '')}
                  ${linkedNote ? '<span title="Note liée : ' + this.escapeHtml(linkedNote.title) + '" style="display:inline-flex; align-items:center;">' + this.getSvgIcon('note', 11) + '</span>' : ''}
                  ${isGoogle ? '<span class="event-origin-tag google" style="font-size:0.55rem; padding:0 3px;">G</span>' : ''}
                </span>
              </div>
            `;
          });

          alldayHtml += `</div>`;
        });

        alldayEl.innerHTML = alldayHtml;
      } else {
        alldayEl.style.display = 'none';
        alldayEl.innerHTML = '';
      }
    }

    // 5. Colonnes de la grille horaire (événements minutés uniquement)
    days.forEach(d => {
      const dateStr = this.formatDateIso(d);
      const dayEvents = rangeEvents.filter(e => this.isEventOnDate(e, dateStr));
      const timedEvents = dayEvents.filter(e => !e.isAllDay);
      const layoutEvents = this.computeOverlappingLayout(timedEvents, dateStr);

      bodyHtml += `<div class="day-column" data-date="${dateStr}" style="height: ${totalGridHeight}px; background-size: 100% ${this.slotHeight}px;">`;

      layoutEvents.forEach(item => {
        const e = item.event;
        const startH = item.startMin / 60;
        const endH = item.endMin / 60;

        // Position relative à la grille horaire (07h00 - 23h00) avec bornage visuel
        const visStartH = Math.max(this.dayHoursStart, startH);
        const visEndH = Math.min(this.dayHoursEnd, endH);
        const top = Math.max(0, (visStartH - this.dayHoursStart) * this.slotHeight);
        const durationH = Math.max(0.35, visEndH - visStartH);
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
            const isNightEnd = !e.isAllDay && endTimeStr && endTimeStr < '07:00';
            timeDisplay = isNightEnd ? `➔ Fin ${endTimeStr} (Nuit)` : `➔ ${endTimeStr}`;
          } else {
            timeDisplay = 'Journée continue';
          }
        } else {
          timeDisplay = `${startTimeStr} - ${endTimeStr}`;
        }

        const isNightEnd = isMultiDay && dateStr === endDay && !e.isAllDay && endTimeStr && endTimeStr < '07:00';
        const linkedTask = e.taskId ? taskMap.get(e.taskId) : null;
        const linkedNote = (e.noteId ? noteById.get(e.noteId) : null) || noteByEventId.get(e.id);
        const isCompact = height < 44;
        const isOneHour = !isCompact && height <= 58;
        const isTaskCompleted = !!(linkedTask && linkedTask.task && linkedTask.task.completed);

        // Code couleur : hérité de la tâche liée et de son projet si disponible
        let eventColor = e.color;
        if (linkedTask && linkedTask.task && linkedTask.task.projectId) {
          const proj = projectMap.get(linkedTask.task.projectId);
          if (proj && proj.color) {
            eventColor = proj.color;
          }
        }
        if (!eventColor) {
          eventColor = isGoogle ? '#2563eb' : '#7c3aed';
        }

        bodyHtml += `
          <div class="calendar-event ${isGoogle ? 'google-event' : 'antigravite-event'} ${isCompact ? 'compact' : ''} ${isOneHour ? 'slot-1h' : ''} ${isNightEnd ? 'night-spillover-event' : ''} ${isTaskCompleted ? 'task-completed-event' : ''}" 
               data-event-id="${e.id}"
               style="top: ${top}px; height: ${height}px; left: ${leftPct}%; width: ${widthPct}%; background: linear-gradient(135deg, ${eventColor} 0%, ${eventColor}ee 100%) !important; border: 1px solid rgba(255, 255, 255, 0.25) !important; border-left: 4px ${isNightEnd ? 'dashed' : 'solid'} rgba(255, 255, 255, 0.9) !important; color: #ffffff !important; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"
               onmousedown="AgendaManager.onEventMouseDown(event, '${e.id}')"
               onclick="AgendaManager.onEventClick(event, '${e.id}')"
               title="${this.escapeHtml(e.title)} (${isNightEnd ? 'Finie à ' + endTimeStr + ' du matin (nuit)' : timeDisplay}${isMultiDay ? ' • du ' + startDay + ' au ' + endDay : ''})${isGoogle ? ' [Google Agenda]' : ' [Antigravité]'}${linkedTask ? ' [Lié à tâche: ' + this.escapeHtml(linkedTask.task.title) + (isTaskCompleted ? ' (Terminée ✓)' : '') + ']' : ''}${linkedNote ? ' [Note: ' + this.escapeHtml(linkedNote.title) + ']' : ''}">
            
            <div class="event-resize-handle handle-top" data-action="resize-top" title="Ajuster l'heure de début"></div>

            ${isCompact ? `
              <div class="event-compact-row">
                ${isGoogle ? '<span class="event-origin-tag google" style="font-size:0.55rem; padding:0 3px;">G</span>' : ''}
                ${isTaskCompleted ? '<span style="color:#4ade80; display:inline-flex; align-items:center; margin-right:3px;" title="Tâche liée terminée">' + this.getSvgIcon('check', 11) + '</span>' : ''}
                ${linkedNote ? '<span style="display:inline-flex; align-items:center; margin-right:2px;" title="Note liée : ' + this.escapeHtml(linkedNote.title) + '">' + this.getSvgIcon('note', 11) + '</span>' : ''}
                <span class="event-title compact" style="color:#ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85);">${(e.recurrence && e.recurrence !== 'none') ? '<span class="event-recurrence-pill" style="display:inline-flex; align-items:center; margin-right:2px;">' + this.getSvgIcon('repeat', 10) + '</span>' : ''}${this.escapeHtml(e.title || '(Sans titre)')}</span>
                <span class="event-time-compact" style="color: rgba(255,255,255,0.95); margin-left: auto;">${e.isAllDay ? 'Jour' : (isMultiDay && dateStr !== startDay ? (isNightEnd ? '➔ ' + endTimeStr + ' (Nuit)' : '➔ ' + endTimeStr) : startTimeStr)}</span>
              </div>
            ` : isOneHour ? `
              ${(isGoogle || isTaskCompleted || (e.syncStatus && e.syncStatus.startsWith('pending'))) ? `
                <div class="event-header-row slot-1h-header">
                  ${isGoogle ? (e.syncStatus && e.syncStatus.startsWith('pending')
                    ? '<span class="event-origin-tag slot-1h-tag" style="background:rgba(245,158,11,0.35); color:#fbbf24;">⏳ Sync</span>'
                    : '<span class="event-origin-tag google slot-1h-tag">G</span>') : ''}
                  ${isTaskCompleted ? '<span class="event-done-pill slot-1h-done" style="font-size:0.6rem; background:rgba(34,197,94,0.35); border:1px solid rgba(74,222,128,0.6); color:#86efac; border-radius:999px; padding:1px 5px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">' + this.getSvgIcon('check', 9) + ' Fait</span>' : ''}
                </div>
              ` : ''}
              <div class="event-title slot-1h-title" style="color:#ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85);" title="${this.escapeHtml(e.title || '')}">
                ${(e.recurrence && e.recurrence !== 'none') ? '<span title="Créneau récurrent" style="display:inline-flex; align-items:center; margin-right:3px;">' + this.getSvgIcon('repeat', 10) + '</span>' : ''}${this.escapeHtml(e.title || '(Sans titre)')}
              </div>
              ${linkedTask ? `
                <div class="event-linked-info slot-1h-linked" title="Tâche : ${this.escapeHtml(linkedTask.task.title)}${isTaskCompleted ? ' (Terminée)' : ''}">
                  <span style="display:inline-flex; align-items:center; flex-shrink:0;">${this.getSvgIcon(isTaskCompleted ? 'check' : 'pin', 10)}</span>
                  <span class="slot-1h-linked-text" style="${isTaskCompleted ? 'text-decoration: line-through; opacity: 0.85;' : ''}">${this.escapeHtml(linkedTask.task.title)}</span>
                </div>
              ` : (linkedNote ? `
                <div class="event-linked-info slot-1h-linked" title="Note : ${this.escapeHtml(linkedNote.title)}">
                  <span style="display:inline-flex; align-items:center; flex-shrink:0;">${this.getSvgIcon('note', 10)}</span>
                  <span class="slot-1h-linked-text">${this.escapeHtml(linkedNote.title)}</span>
                </div>
              ` : (!isGoogle && !isTaskCompleted ? `<div class="event-time-hint-1h">${timeDisplay}</div>` : ''))}
            ` : `
              <div class="event-header-row">
                ${isGoogle ? (e.syncStatus && e.syncStatus.startsWith('pending')
                  ? '<span class="event-origin-tag" style="background:rgba(245,158,11,0.35); color:#fbbf24; border:1px solid rgba(245,158,11,0.5);">⏳ Sync</span>'
                  : '<span class="event-origin-tag google">Google</span>') 
                  : '<span class="event-time-pill" style="margin-left:0;">' + timeDisplay + '</span>'}
                ${isGoogle ? '<span class="event-time-pill">' + timeDisplay + '</span>' : ''}
                ${isTaskCompleted ? '<span class="event-done-pill" style="margin-left:auto; font-size:0.65rem; background:rgba(34,197,94,0.35); border:1px solid rgba(74,222,128,0.6); color:#86efac; border-radius:999px; padding:1px 5px; font-weight:600; display:inline-flex; align-items:center; gap:3px;">' + this.getSvgIcon('check', 10) + ' Fait</span>' : ''}
              </div>
              <div class="event-title" style="color:#ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85);">${(e.recurrence && e.recurrence !== 'none') ? '<span title="Créneau récurrent" style="display:inline-flex; align-items:center; margin-right:3px;">' + this.getSvgIcon('repeat', 11) + '</span>' : ''}${this.escapeHtml(e.title || '(Sans titre)')}</div>
              ${e.location ? `<div class="event-location" title="${this.escapeHtml(e.location)}"><span style="display:inline-flex; align-items:center; margin-right:3px;">${this.getSvgIcon('location', 11)}</span>${this.escapeHtml(e.location)}</div>` : ''}
              ${linkedTask ? `<div class="event-linked-info" title="Tâche : ${this.escapeHtml(linkedTask.task.title)}${isTaskCompleted ? ' (Terminée)' : ''}"><span style="display:inline-flex; align-items:center; margin-right:3px;">${this.getSvgIcon(isTaskCompleted ? 'check' : 'pin', 11)}</span><span style="${isTaskCompleted ? 'text-decoration: line-through; opacity: 0.85;' : ''}">${this.escapeHtml(linkedTask.task.title)}</span></div>` : ''}
              ${linkedNote ? `<div class="event-linked-info" title="Note : ${this.escapeHtml(linkedNote.title)}"><span style="display:inline-flex; align-items:center; margin-right:3px;">${this.getSvgIcon('note', 11)}</span>${this.escapeHtml(linkedNote.title)}</div>` : ''}
            `}

            <div class="event-resize-handle handle-bottom" data-action="resize-bottom" title="Ajuster l'heure de fin"></div>
          </div>
        `;
      });

      bodyHtml += `</div>`;
    });

    bodyEl.innerHTML = bodyHtml;
    this.updateNowIndicator();

    // Attacher l'écouteur de scroll pour mémoriser le défilement de l'utilisateur
    if (bodyEl && !bodyEl._scrollBound) {
      bodyEl._scrollBound = true;
      bodyEl.addEventListener('scroll', () => {
        this._lastScrollTop = bodyEl.scrollTop;
      }, { passive: true });
    }

    // Positionner le défilement sur les heures normales (07:00) ou restaurer le scroll précédent
    if (bodyEl) {
      const targetScroll = (this._preserveScrollTop !== null && this._preserveScrollTop !== undefined)
        ? this._preserveScrollTop
        : ((this._lastScrollTop !== null && this._lastScrollTop !== undefined)
            ? this._lastScrollTop
            : Math.round(7 * this.slotHeight));

      this._preserveScrollTop = null;
      this._lastScrollTop = targetScroll;

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          bodyEl.scrollTop = targetScroll;
        });
      } else {
        bodyEl.scrollTop = targetScroll;
      }
    }
  },

  _getNowIntervalMs(perfMode) {
    if (perfMode === 'potato') return 120000;
    if (perfMode === 'economy') return 60000;
    return 30000;
  },

  applyPerformanceMode(perfMode) {
    if (typeof window === 'undefined' || !this._nowTimerBound) return;
    const nextMs = this._getNowIntervalMs(perfMode);
    if (this._nowIntervalMs === nextMs && this._nowInterval) return;
    this._nowIntervalMs = nextMs;
    if (this._nowInterval) clearInterval(this._nowInterval);
    this._nowInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden === true) return;
      if (window.App && window.App.currentScreen && window.App.currentScreen !== 'agenda') return;
      if (this.currentView !== 'month') {
        this.updateNowIndicator();
      }
    }, nextMs);
  },

  initNowIndicatorTimer() {
    if (this._nowTimerBound) return;
    this._nowTimerBound = true;
    const perfMode = (typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.getAttribute === 'function')
      ? (document.documentElement.getAttribute('data-perf-mode') || 'normal')
      : 'normal';
    this.applyPerformanceMode(perfMode);
  },

  updateNowIndicator() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

    const safeRemove = (el) => {
      if (!el) return;
      if (typeof el.remove === 'function') {
        el.remove();
      } else if (el.parentElement && typeof el.parentElement.removeChild === 'function') {
        el.parentElement.removeChild(el);
      } else if (el.parentNode && typeof el.parentNode.removeChild === 'function') {
        el.parentNode.removeChild(el);
      }
    };

    if (this.currentView === 'month') {
      const old = typeof document.getElementById === 'function' ? document.getElementById('agenda-now-indicator') : null;
      safeRemove(old);
      return;
    }

    const todayStr = this.formatDateIso(new Date());
    const todayCol = document.querySelector(`.day-column[data-date="${todayStr}"]`);
    const existing = typeof document.getElementById === 'function' ? document.getElementById('agenda-now-indicator') : null;

    if (!todayCol) {
      safeRemove(existing);
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMin = currentHour * 60 + currentMinute;
    const startMin = this.dayHoursStart * 60;
    const endMin = this.dayHoursEnd * 60;

    if (currentTotalMin < startMin || currentTotalMin > endMin) {
      safeRemove(existing);
      return;
    }

    const slotH = this.slotHeight || 50;
    const top = Math.round(((currentTotalMin - startMin) / 60) * slotH);
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    if (existing && existing.parentElement === todayCol) {
      existing.style.top = `${top}px`;
      existing.title = `Heure actuelle : ${timeStr}`;
      const badge = typeof existing.querySelector === 'function' ? existing.querySelector('.agenda-now-badge') : null;
      if (badge) badge.textContent = timeStr;
    } else {
      safeRemove(existing);
      if (typeof document.createElement !== 'function') return;
      const indicator = document.createElement('div');
      indicator.id = 'agenda-now-indicator';
      indicator.className = 'agenda-now-indicator';
      indicator.style.top = `${top}px`;
      indicator.title = `Heure actuelle : ${timeStr}`;
      if (typeof indicator.setAttribute === 'function') {
        indicator.setAttribute('aria-label', `Heure actuelle : ${timeStr}`);
      }
      indicator.innerHTML = `
        <div class="agenda-now-dot"></div>
        <div class="agenda-now-line"></div>
        <span class="agenda-now-badge">${timeStr}</span>
      `;
      if (typeof todayCol.appendChild === 'function') {
        todayCol.appendChild(indicator);
      }
    }
  },

  buildEventTaskGroups(tasks, allProjects) {
    const hierProjects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
      ? StorageManager.getProjectsHierarchy(allProjects)
      : (allProjects || []).map(p => ({ project: p, pathTitle: p.title }));

    const projectObjMap = new Map();
    (allProjects || []).forEach(p => projectObjMap.set(p.id, p));

    const allFlatTasks = [];
    const activePersonal = [];
    const donePersonal = [];
    const activeByProj = new Map();
    const doneByProj = new Map();

    const flattenTasks = (list, prefix = '') => {
      (list || []).forEach(t => {
        const item = { id: t.id, title: prefix + t.title, completed: !!t.completed, projectId: t.projectId };
        allFlatTasks.push(item);
        const isDone = item.completed;
        if (t.projectId && projectObjMap.has(t.projectId)) {
          const targetMap = isDone ? doneByProj : activeByProj;
          if (!targetMap.has(t.projectId)) targetMap.set(t.projectId, []);
          targetMap.get(t.projectId).push(item);
        } else {
          if (isDone) donePersonal.push(item);
          else activePersonal.push(item);
        }
        if (t.subtasks && t.subtasks.length > 0) flattenTasks(t.subtasks, prefix + '— ');
      });
    };
    flattenTasks(tasks);

    const groups = [];
    if (activePersonal.length > 0) {
      groups.push({ label: "👤 Tâches personnelles (à faire)", items: activePersonal, completed: false });
    }
    hierProjects.forEach(({ project, pathTitle }) => {
      const list = activeByProj.get(project.id);
      if (list && list.length > 0) {
        groups.push({ label: "📁 Projet : " + (pathTitle || project.title), items: list, completed: false, projectId: project.id });
      }
    });

    if (donePersonal.length > 0) {
      groups.push({ label: "✓ Terminées — 👤 Sans projet", items: donePersonal, completed: true });
    }
    hierProjects.forEach(({ project, pathTitle }) => {
      const list = doneByProj.get(project.id);
      if (list && list.length > 0) {
        groups.push({ label: "✓ Terminées — 📁 " + (pathTitle || project.title), items: list, completed: true, projectId: project.id });
      }
    });

    return { groups, allFlatTasks, projectObjMap, hierProjects };
  },

  openEventModal(eventId = null, defaultValues = null) {
    if (defaultValues && defaultValues.start) {
      this.activeDateStr = defaultValues.start.slice(0, 10);
      if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
        window.App.updateSidebarDayProgress(this.activeDateStr);
      }
    } else if (eventId) {
      const existingEvt = this.getAll().find(e => e.id === eventId);
      if (existingEvt && existingEvt.start) {
        this.activeDateStr = existingEvt.start.slice(0, 10);
        if (typeof window !== 'undefined' && window.App && typeof window.App.updateSidebarDayProgress === 'function') {
          window.App.updateSidebarDayProgress(this.activeDateStr);
        }
      }
    }

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
    const btnCreateNote = document.getElementById('btn-event-create-note');
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
    const containerRecEnd = document.getElementById('event-recurrence-end-container');
    const btnRecEndForever = document.getElementById('btn-rec-end-forever');
    const btnRecEndDate = document.getElementById('btn-rec-end-date');
    const inputRecurrenceEnd = document.getElementById('event-input-recurrence-end');
    const checkCreateTask = document.getElementById('event-check-create-task');
    const containerCreateTask = document.getElementById('event-create-task-container');
    const detailsNewTask = document.getElementById('event-new-task-details');
    const selectTaskProject = document.getElementById('event-task-project');
    const selectTaskPriority = document.getElementById('event-task-priority');
    const btnOpenTask = document.getElementById('btn-event-open-task');

    let selectedDest = 'local';
    let currentRecurrenceEnd = null;

    const updateRecurrenceEndUI = () => {
      const rec = inputRecurrence ? inputRecurrence.value : 'none';
      if (!containerRecEnd) return;
      if (rec === 'none') {
        containerRecEnd.style.display = 'none';
        if (inputRecurrenceEnd) inputRecurrenceEnd.style.display = 'none';
        return;
      }
      containerRecEnd.style.display = 'block';
      if (currentRecurrenceEnd) {
        if (btnRecEndForever) btnRecEndForever.classList.remove('active');
        if (btnRecEndDate) btnRecEndDate.classList.add('active');
        if (inputRecurrenceEnd) {
          inputRecurrenceEnd.style.display = 'inline-block';
          inputRecurrenceEnd.value = currentRecurrenceEnd;
        }
      } else {
        if (btnRecEndForever) btnRecEndForever.classList.add('active');
        if (btnRecEndDate) btnRecEndDate.classList.remove('active');
        if (inputRecurrenceEnd) {
          inputRecurrenceEnd.style.display = 'none';
          inputRecurrenceEnd.value = '';
        }
      }
    };

    const syncSelectTitles = () => {
      [inputRecurrence, inputTask, inputNote].forEach(sel => {
        if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
          sel.title = sel.options[sel.selectedIndex].textContent || '';
        }
      });
    };

    if (inputRecurrence) {
      inputRecurrence.onchange = () => {
        syncSelectTitles();
        updateRecurrenceEndUI();
      };
    }

    if (btnRecEndForever) {
      btnRecEndForever.onclick = () => {
        currentRecurrenceEnd = null;
        updateRecurrenceEndUI();
      };
    }

    if (btnRecEndDate) {
      btnRecEndDate.onclick = () => {
        if (!currentRecurrenceEnd) {
          const sVal = (inputStart && inputStart.value) ? inputStart.value.slice(0, 10) : new Date().toISOString().slice(0, 10);
          const sDate = new Date(`${sVal}T00:00:00`);
          sDate.setMonth(sDate.getMonth() + 1);
          const y = sDate.getFullYear();
          const m = String(sDate.getMonth() + 1).padStart(2, '0');
          const d = String(sDate.getDate()).padStart(2, '0');
          currentRecurrenceEnd = `${y}-${m}-${d}`;
        }
        updateRecurrenceEndUI();
        if (inputRecurrenceEnd) inputRecurrenceEnd.focus();
      };
    }

    if (inputRecurrenceEnd) {
      inputRecurrenceEnd.onchange = () => {
        currentRecurrenceEnd = inputRecurrenceEnd.value || null;
      };
    }

    // Remplir les projets (y compris sous-projets) pour la création directe de tâche
    if (selectTaskProject) {
      selectTaskProject.innerHTML = '<option value="">(Aucun projet)</option>';
      const allProjects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
      const hier = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjectsHierarchy === 'function')
        ? StorageManager.getProjectsHierarchy(allProjects)
        : allProjects.map(p => ({ project: p, displayTitle: p.title }));
      hier.forEach(({ project: p, displayTitle }) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = displayTitle || p.title;
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

    if (customSwatch) {
      customSwatch.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof App !== 'undefined' && typeof App.openColorPicker === 'function') {
          App.openColorPicker({
            targetElement: customSwatch,
            initialColor: (inputColor && inputColor.value) || '#8b5cf6',
            title: "Couleur de l'événement",
            applyLabel: 'Appliquer',
            showNameInput: false,
            onColorChange: (val) => {
              if (inputColor) inputColor.value = val;
              updateActiveSwatch(val);
            },
            onApply: (val) => {
              if (inputColor) inputColor.value = val;
              updateActiveSwatch(val);
            },
            onCancel: (initialVal) => {
              if (inputColor) inputColor.value = initialVal;
              updateActiveSwatch(initialVal);
            }
          });
        }
      };
    }

    if (inputColor) {
      inputColor.oninput = () => updateActiveSwatch(inputColor.value);
      inputColor.onchange = () => updateActiveSwatch(inputColor.value);
    }

    // Remplir les tâches pour la liaison facultative : tâches à faire par projet en haut, tâches terminées par projet tout en bas
    const tasks = StorageManager.getTasks();
    const allProjects = (typeof StorageManager !== 'undefined') ? StorageManager.getProjects() : [];
    const projectMap = new Map();
    allProjects.forEach(p => projectMap.set(p.id, p.title));

    const { groups: taskGroups, allFlatTasks, projectObjMap, hierProjects } = this.buildEventTaskGroups(tasks, allProjects);

    inputTask.innerHTML = '<option value="">(Aucune tâche associée)</option>';
    taskGroups.forEach(g => {
      const grp = document.createElement('optgroup');
      grp.label = g.label;
      g.items.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.completed ? '✓ ' : '') + t.title;
        grp.appendChild(opt);
      });
      inputTask.appendChild(grp);
    });

    inputTask.onchange = () => {
      syncSelectTitles();
      updateTaskButtonVisibility(inputTask.value);
      if (checkCreateTask && inputTask.value) {
        checkCreateTask.checked = false;
        if (detailsNewTask) detailsNewTask.style.display = 'none';
      }
      if (inputTask.value) {
        const found = allFlatTasks.find(t => t.id === inputTask.value);
        if (found && found.projectId) {
          const proj = projectObjMap.get(found.projectId);
          if (proj && proj.color && inputColor) {
            inputColor.value = proj.color;
            updateActiveSwatch(proj.color);
          }
        }
      }
    };

    // Remplir les notes pour la liaison facultative (regroupées par projet)
    const allNotes = StorageManager.getNotes();
    if (inputNote) {
      inputNote.innerHTML = '<option value="">(Aucune note associée)</option><option value="__new__">➕ Créer une nouvelle note associée...</option>';
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

      hierProjects.forEach(({ project, pathTitle }) => {
        const nList = notesByProj.get(project.id);
        if (!nList || nList.length === 0) return;
        const grp = document.createElement('optgroup');
        grp.label = "📁 Projet : " + (pathTitle || project.title || 'Projet');
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
        btnOpenNote.style.display = (noteId && noteId !== '__new__') ? 'inline-flex' : 'none';
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

    const handleCreateAttachedNote = async () => {
      const currentEvtTitle = (inputTitle && inputTitle.value && inputTitle.value.trim())
        ? inputTitle.value.trim()
        : 'Note de créneau';
      let title = currentEvtTitle;
      if (window.App && typeof window.App.prompt === 'function') {
        const res = await window.App.prompt({
          title: 'Nouvelle note associée',
          message: 'Titre de la note à créer pour ce créneau :',
          defaultValue: currentEvtTitle,
          confirmText: 'Créer la note',
          cancelText: 'Annuler'
        });
        if (!res || !res.trim()) return null;
        title = res.trim();
      }

      const activeProjId = (inputTask && inputTask.value && taskMap.has(inputTask.value))
        ? (taskMap.get(inputTask.value).task.projectId || null)
        : null;

      const newNote = {
        id: 'note-' + Date.now(),
        title: title,
        folder: 'Général',
        tags: [],
        projectId: activeProjId,
        linkedEventId: eventId || null,
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const nList = StorageManager.getNotes();
      nList.unshift(newNote);
      StorageManager.saveNotes(nList);

      if (inputNote) {
        let opt = inputNote.querySelector(`option[value="${newNote.id}"]`);
        if (!opt) {
          opt = document.createElement('option');
          opt.value = newNote.id;
          opt.textContent = `📝 ${newNote.title}`;
          inputNote.appendChild(opt);
        }
        inputNote.value = newNote.id;
        syncSelectTitles();
        updateNoteButtonVisibility(newNote.id);
      }

      if (window.NotesManager && typeof window.NotesManager.renderNotesList === 'function') {
        window.NotesManager.renderNotesList();
      }

      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Note « ${title} » créée et associée`, 'success');
      }

      return newNote;
    };

    if (btnCreateNote) {
      btnCreateNote.onclick = (e) => {
        e.preventDefault();
        handleCreateAttachedNote();
      };
    }

    if (inputNote) {
      inputNote.onchange = async () => {
        if (inputNote.value === '__new__') {
          const created = await handleCreateAttachedNote();
          if (!created) {
            inputNote.value = '';
          }
        }
        syncSelectTitles();
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

        const resolvedNoteGoogle = (evt.noteId ? allNotes.find(n => n.id === evt.noteId) : null) || allNotes.find(n => n.linkedEventId === evt.id);
        const resolvedNoteIdGoogle = resolvedNoteGoogle ? resolvedNoteGoogle.id : (evt.noteId || '');
        if (inputNote) {
          inputNote.value = resolvedNoteIdGoogle;
          updateNoteButtonVisibility(resolvedNoteIdGoogle);
        }
        if (resolvedNoteIdGoogle && !evt.noteId) {
          evt.noteId = resolvedNoteIdGoogle;
        }

        if (inputRecurrence) inputRecurrence.value = evt.recurrence || 'none';
        currentRecurrenceEnd = evt.recurrenceEnd || null;
        updateRecurrenceEndUI();

        btnDelete.style.display = 'inline-flex';
        btnDelete.textContent = "Supprimer de Google Agenda";

        btnDelete.onclick = async () => {
          const hasLinkedTask = !!evt.taskId;
          const confirmMsg = "Voulez-vous vraiment supprimer cet événement de Google Agenda ?\n\n" +
            (hasLinkedTask 
              ? "📌 Note : La tâche Antigravité associée restera intacte dans votre liste." 
              : "Cette action supprimera le créneau de votre agenda Google.");

          let shouldDelete = true;
          if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
            shouldDelete = await window.App.confirm({
              title: "Supprimer de Google Agenda",
              message: confirmMsg,
              confirmText: "Supprimer",
              danger: true,
              icon: "📅"
            });
          } else if (typeof confirm === 'function') {
            shouldDelete = confirm(confirmMsg);
          }

          if (shouldDelete) {
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
              if (window.App && typeof window.App.alert === 'function') {
                await window.App.alert({ title: "Erreur Google Agenda", message: err.message, type: "error" });
              } else {
                alert("Erreur lors de la suppression Google : " + err.message);
              }
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

          const recurrence = inputRecurrence ? inputRecurrence.value : 'none';
          const recurrenceEnd = (recurrence !== 'none') ? (currentRecurrenceEnd || (inputRecurrenceEnd && inputRecurrenceEnd.value) || null) : null;
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
            noteId,
            recurrence,
            recurrenceEnd
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
        currentRecurrenceEnd = evt.recurrenceEnd || null;
        updateRecurrenceEndUI();

        const resolvedNoteLocal = (evt.noteId ? allNotes.find(n => n.id === evt.noteId) : null) || allNotes.find(n => n.linkedEventId === evt.id);
        const resolvedNoteIdLocal = resolvedNoteLocal ? resolvedNoteLocal.id : (evt.noteId || '');
        if (inputNote) {
          inputNote.value = resolvedNoteIdLocal;
          updateNoteButtonVisibility(resolvedNoteIdLocal);
        }
        if (resolvedNoteIdLocal && !evt.noteId) {
          evt.noteId = resolvedNoteIdLocal;
        }

        btnDelete.style.display = 'inline-flex';
        btnSave.textContent = "Enregistrer les modifications";

        btnDelete.onclick = async () => {
          let shouldDelete = true;
          if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
            shouldDelete = await window.App.confirm({
              title: "Supprimer le créneau",
              message: "Supprimer ce créneau d'agenda ?\n(La tâche associée ne sera pas supprimée).",
              confirmText: "Supprimer le créneau",
              danger: true,
              icon: "⏱️"
            });
          } else if (typeof confirm === 'function') {
            shouldDelete = confirm("Supprimer ce créneau d'agenda ? (La tâche associée ne sera pas supprimée)");
          }
          if (shouldDelete) {
            this.deleteEvent(eventId);
            this.closeEventModal();
          }
        };

        btnSave.onclick = () => {
          if (!inputTitle.value.trim()) {
            if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
              window.App.showToast("Le titre du créneau est requis", "error");
            } else if (typeof alert === 'function') {
              alert("Le titre est requis.");
            }
            return;
          }
          if (!inputStart.value || !inputEnd.value) {
            if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
              window.App.showToast("Les heures de début et fin sont requises", "error");
            } else if (typeof alert === 'function') {
              alert("Les heures de début et fin sont requises.");
            }
            return;
          }

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
          const recurrenceEnd = (recurrence !== 'none') ? (currentRecurrenceEnd || (inputRecurrenceEnd && inputRecurrenceEnd.value) || null) : null;

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
            recurrence,
            recurrenceEnd
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
        inputAllDay.checked = !!(defaultValues && defaultValues.isAllDay);
        inputAllDay.disabled = false;
        updateInputTypesForAllDay(inputAllDay.checked);
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
      currentRecurrenceEnd = (defaultValues && defaultValues.recurrenceEnd) || null;
      updateRecurrenceEndUI();

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
        const recurrenceEnd = (recurrence !== 'none') ? (currentRecurrenceEnd || (inputRecurrenceEnd && inputRecurrenceEnd.value) || null) : null;

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
          recurrence,
          recurrenceEnd
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

    syncSelectTitles();
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
      if (typeof window !== 'undefined' && window.NotesManager) {
        if (typeof window.NotesManager.renderNotesList === 'function') {
          window.NotesManager.renderNotesList();
        }
        if (typeof window.NotesManager.renderEventSelector === 'function' && window.NotesManager.currentNoteId) {
          const current = StorageManager.getNotes().find(n => n.id === window.NotesManager.currentNoteId);
          if (current) window.NotesManager.renderEventSelector(current);
        }
      }
    }

    // Synchroniser réciproquement la propriété noteId sur l'événement dans le stockage agenda
    if (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function') {
      const events = StorageManager.getEvents();
      const targetEvt = events.find(e => e.id === eventId);
      if (targetEvt && targetEvt.noteId !== noteId) {
        targetEvt.noteId = noteId || null;
        targetEvt.updatedAt = new Date().toISOString();
        StorageManager.saveEvents(events);
      }
    }
  },

  // Menu contextuel (Clic droit sur événement ou créneau libre)
  initContextMenu() {
    if (this._contextMenuBound || typeof document === 'undefined') return;
    this._contextMenuBound = true;

    document.addEventListener('contextmenu', (e) => {
      const agendaScreen = document.getElementById('screen-agenda');
      if (agendaScreen && agendaScreen.contains(e.target)) {
        // Bloquer systématiquement le menu contextuel natif ou prématuré dans l'agenda
        // La distinction clic-court vs maintien est gérée avec précision par initRightClickExtend
        e.preventDefault();
        e.stopPropagation();
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
      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px; display:flex; align-items:center; gap:4px;">
        ${isGoogle ? '<span style="display:inline-flex; align-items:center;">' + this.getSvgIcon('globe', 12) + '</span> Google Agenda' : '<img src="./assets/icon.png" class="antigravite-symbol-icon" alt=""> Antigravité'}
      </div>
    `;

    let html = `
      <div class="context-menu-item" id="cmenu-edit">
        <span class="item-icon">${this.getSvgIcon('edit', 15)}</span>
        <span>Modifier l'événement</span>
      </div>
      <div class="context-menu-item danger" id="cmenu-delete">
        <span class="item-icon">${this.getSvgIcon('trash', 15)}</span>
        <span>Supprimer l'événement</span>
      </div>
    `;

    if (evt.taskId) {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="cmenu-task">
          <span class="item-icon">${this.getSvgIcon('pin', 15)}</span>
          <span>Voir la tâche associée</span>
        </div>
      `;
    }

    const allNotesList = (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function')
      ? StorageManager.getNotes()
      : [];
    const linkedNoteObj = (evt.noteId ? allNotesList.find(n => n.id === evt.noteId) : null) || allNotesList.find(n => n.linkedEventId === evt.id);

    if (linkedNoteObj) {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="cmenu-note">
          <span class="item-icon">${this.getSvgIcon('note', 15)}</span>
          <span>Voir la note associée (${this.escapeHtml(linkedNoteObj.title)})</span>
        </div>
      `;
    } else {
      html += `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" id="cmenu-create-attached-note">
          <span class="item-icon">${this.getSvgIcon('note', 15)}</span>
          <span>＋ Rédiger une note pour ce créneau</span>
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
      btnDelete.onclick = async () => {
        this.hideContextMenu();
        let shouldDelete = true;
        if (typeof window !== 'undefined' && window.App && typeof window.App.confirm === 'function') {
          shouldDelete = await window.App.confirm({
            title: "Supprimer l'événement",
            message: `Supprimer l'événement « ${evt.title} » ?\n(La tâche associée reste intacte).`,
            confirmText: "Supprimer",
            danger: true,
            icon: "🗑️"
          });
        } else if (typeof confirm === 'function') {
          shouldDelete = confirm(`Supprimer l'événement « ${evt.title} » ? (La tâche associée reste intacte)`);
        }
        if (shouldDelete) {
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
    if (btnNote && linkedNoteObj) {
      btnNote.onclick = () => {
        this.hideContextMenu();
        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('notes');
        }
        if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
          window.NotesManager.selectNote(linkedNoteObj.id);
        }
      };
    }

    const btnCreateAttachedNote = document.getElementById('cmenu-create-attached-note');
    if (btnCreateAttachedNote) {
      btnCreateAttachedNote.onclick = async () => {
        this.hideContextMenu();
        const defTitle = (evt.title && evt.title.trim()) ? evt.title.trim() : 'Note de créneau';
        let title = defTitle;
        if (window.App && typeof window.App.prompt === 'function') {
          const res = await window.App.prompt({
            title: 'Nouvelle note associée',
            message: 'Titre de la note à créer pour ce créneau :',
            defaultValue: defTitle,
            confirmText: 'Créer et rédiger',
            cancelText: 'Annuler'
          });
          if (!res || !res.trim()) return;
          title = res.trim();
        }

        const newNote = {
          id: 'note-' + Date.now(),
          title: title,
          folder: 'Général',
          tags: [],
          projectId: evt.projectId || null,
          linkedEventId: eventId,
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const notes = StorageManager.getNotes();
        notes.unshift(newNote);
        StorageManager.saveNotes(notes);

        this.syncNoteEventLink(eventId, newNote.id);

        if (window.App && typeof window.App.navigate === 'function') {
          window.App.navigate('notes');
        }
        if (window.NotesManager && typeof window.NotesManager.selectNote === 'function') {
          window.NotesManager.selectNote(newNote.id);
        }
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`Note « ${title} » créée et associée`, 'success');
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
      <div style="font-weight:700; color:var(--text-main); font-size:0.82rem; text-transform:capitalize; display:flex; align-items:center; gap:5px;">
        <span style="color:var(--accent); display:inline-flex; align-items:center;">${this.getSvgIcon('calendar', 13)}</span>
        <span>${dateLabel}</span>
      </div>
      <div style="font-size:0.72rem; color:var(--accent); font-weight:600; margin-top:2px;">
        Créneau : ${startTime} - ${endTime}
      </div>
    `;

    itemsEl.innerHTML = `
      <div class="context-menu-item" id="cmenu-add">
        <span class="item-icon">${this.getSvgIcon('plus', 15)}</span>
        <span>Ajouter un événement (${startTime})</span>
      </div>
      <div class="context-menu-item" id="cmenu-quick-add">
        <span class="item-icon">${this.getSvgIcon('zap', 15)}</span>
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
      s.eventEl.classList.add('is-resizing');

      const timePill = s.eventEl.querySelector('.event-time-pill, .event-time-compact');
      if (timePill) {
        timePill.textContent = `${this.formatHourDecimal(s.currentStartH)} - ${this.formatHourDecimal(s.currentEndH)}`;
      }
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
      s.eventEl.classList.add('is-resizing');

      const timePill = s.eventEl.querySelector('.event-time-pill, .event-time-compact');
      if (timePill) {
        timePill.textContent = `${this.formatHourDecimal(s.currentStartH)} - ${this.formatHourDecimal(s.currentEndH)}`;
      }
    }

    // Afficher l'indicateur d'horaire en temps réel
    this.updateDragIndicator(e.clientX, e.clientY, s);
  },

  formatDurationMinutes(totalMin) {
    if (totalMin <= 0) return '0 min';
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
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
      const currentDurationMin = Math.round((s.currentEndH - s.currentStartH) * 60);
      const initialDurationMin = Math.round(s.durationH * 60);
      const diffMin = currentDurationMin - initialDurationMin;
      const durationStr = this.formatDurationMinutes(currentDurationMin);
      const diffStr = diffMin > 0 ? ` (+${diffMin}m)` : diffMin < 0 ? ` (${diffMin}m)` : '';
      label = `⏱️ ${startTimeStr} - ${endTimeStr} • ${durationStr}${diffStr}`;
    }

    indicator.textContent = label;
    indicator.style.display = 'block';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y - 12}px`;
  },

  async updateEventSchedule(eventId, newDateStr, newStartH, newEndH) {
    this.activeDateStr = newDateStr;
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

    if (window.App && typeof window.App.updateSidebarDayProgress === 'function') {
      window.App.updateSidebarDayProgress(newDateStr);
    }

    const d = new Date(`${newDateStr}T00:00:00`);
    const dayLabel = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : newDateStr;
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`« ${evt.title} » : ${dayLabel} • ${startTimeStr} - ${endTimeStr}`, 'info');
    }
    return true;
  },

  // Augmenter la durée d'un événement au maintien du clic droit ou étirement au clic gauche/droit
  initRightClickExtend() {
    if (this._rightClickExtendBound || typeof document === 'undefined') return;
    this._rightClickExtendBound = true;

    // 1. Détection de l'appui (mousedown) : Clic droit (2) ou Clic gauche (0) sur créneau vide
    document.addEventListener('mousedown', (e) => {
      // Ignorer si ce n'est ni un clic gauche (0) ni un clic droit (2)
      if (e.button !== 0 && e.button !== 2) return;

      const agendaScreen = document.getElementById('screen-agenda');
      if (!agendaScreen || !agendaScreen.contains(e.target)) return;

      // Éviter si on clique dans la modale d'événement ou un menu ouvert
      if (e.target.closest('#event-modal') || e.target.closest('#agenda-context-menu')) return;

      const eventEl = e.target.closest('.calendar-event');
      const dayCol = e.target.closest('.day-column');
      if (!eventEl && !dayCol) return;

      // Pour le clic gauche sur un événement existant : laisser le drag and drop natif de l'événement gérer (move / resize-top / resize-bottom)
      if (e.button === 0 && eventEl) return;

      // Intercepter le comportement par défaut pour le clic droit
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
      }

      let isExisting = false;
      let eventId = null;
      let evt = null;
      let startH = 0;
      let endH = 0;
      let dateStr = '';

      if (eventEl && e.button === 2) {
        eventId = eventEl.dataset.eventId || (eventEl.getAttribute('onclick') ? eventEl.getAttribute('onclick').match(/'([^']+)'/)?.[1] : null);
        if (eventId) {
          evt = this.getAll().find(ev => ev.id === eventId);
          if (evt && !evt.isAllDay) {
            isExisting = true;
            startH = this.parseHourDecimal(evt.start);
            endH = this.parseHourDecimal(evt.end);
            if (endH <= startH) endH = startH + 1;
            dateStr = (evt.start && evt.start.length >= 10) ? evt.start.slice(0, 10) : (dayCol ? dayCol.dataset.date : '');
          }
        }
      }

      if (!isExisting && dayCol) {
        dateStr = dayCol.dataset.date;
        if (!dateStr) return;
        const rect = dayCol.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const hoursOffset = relY / this.slotHeight;
        const clickedHour = Math.floor(this.dayHoursStart + hoursOffset);
        const rawMinutes = Math.floor((hoursOffset % 1) * 60);
        const roundedMinutes = Math.min(45, Math.floor(rawMinutes / 15) * 15);
        startH = Math.min(23, Math.max(0, clickedHour)) + (roundedMinutes / 60);
        endH = Math.min(24, startH + 1);
      }

      if (!dateStr) dateStr = this.formatDateIso(new Date());

      const maxEndH = Math.min(this.dayHoursEnd + 1, startH + 12);

      this._rightClickSession = {
        button: e.button,
        type: isExisting ? 'existing' : 'slot',
        eventId,
        eventEl,
        evt,
        dayCol: dayCol || (eventEl ? eventEl.closest('.day-column') : null),
        dateStr,
        startH,
        initialEndH: endH,
        currentEndH: endH,
        maxEndH,
        startX: e.clientX,
        startY: e.clientY,
        hasExtended: false,
        intervalId: null,
        holdTimeoutId: null
      };

      // Rendu visuel immédiat pour figer le début et afficher l'animation dès l'appui
      this._updateRightClickVisuals(this._rightClickSession);

      // Si l'utilisateur maintient le clic pendant le délai imparti -> début de l'extension automatique
      const holdDelay = (e.button === 2) ? 180 : 350;
      this._rightClickSession.holdTimeoutId = setTimeout(() => {
        if (!this._rightClickSession) return;
        this._startRightClickExtension();
      }, holdDelay);
    });

    // 2. Déplacement pendant l'appui (étirement en direct vers le bas avec animation fluide)
    window.addEventListener('mousemove', (e) => {
      const s = this._rightClickSession;
      if (!s) return;

      const deltaY = e.clientY - s.startY;
      // Dès que la souris glisse vers le bas de plus de 5px : déclencher l'étirement immédiatement
      if (!s.hasExtended && deltaY > 5) {
        if (s.holdTimeoutId) clearTimeout(s.holdTimeoutId);
        s.hasExtended = true;
      }

      if (s.hasExtended) {
        const dayCol = s.dayCol || (s.eventEl ? s.eventEl.closest('.day-column') : null);
        if (dayCol) {
          const rect = dayCol.getBoundingClientRect();
          const relY = Math.max(0, e.clientY - rect.top);
          const mouseH = this.dayHoursStart + (relY / this.slotHeight);
          const snappedMinutes = Math.round(((mouseH % 1) * 60) / 15) * 15;
          const rawCandidateEnd = Math.floor(mouseH) + (snappedMinutes / 60);
          // Le créneau s'étire vers le bas en suivant le curseur (minimum 15 min après startH)
          const candidateEndH = Math.min(s.maxEndH, Math.max(s.startH + 0.25, rawCandidateEnd));
          if (candidateEndH !== s.currentEndH && candidateEndH > s.startH) {
            s.currentEndH = candidateEndH;
            this._updateRightClickVisuals(s);
            if (window.App && typeof window.App.triggerHapticFeedback === 'function') {
              window.App.triggerHapticFeedback();
            }
          }
        }
      }
    });

    // 3. Relâchement de la souris (mouseup)
    window.addEventListener('mouseup', async (e) => {
      const s = this._rightClickSession;
      if (!s) return;

      if (s.holdTimeoutId) clearTimeout(s.holdTimeoutId);
      if (s.intervalId) clearInterval(s.intervalId);

      // Neutraliser systématiquement le clic classique subséquent pour empêcher la création parasite à l'arrivée
      this._suppressNextClick = true;
      setTimeout(() => {
        this._suppressNextClick = false;
      }, 300);

      const durationIncreased = s.currentEndH > s.initialEndH || s.hasExtended;

      if (s.button === 0) {
        // --- CLIC GAUCHE ---
        const startTimeStr = this.formatHourDecimal(s.startH);
        const endTimeStr = this.formatHourDecimal(s.currentEndH);
        const totalMin = Math.round((s.currentEndH - s.startH) * 60);
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        const durLabel = hours > 0 ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`) : `${mins}min`;

        // Ouvrir la modale avec les heures calculées depuis l'ancrage de départ
        this.openEventModal(null, {
          start: `${s.dateStr}T${startTimeStr}`,
          end: `${s.dateStr}T${endTimeStr}`
        });
        if (durationIncreased && window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`⏱️ Créneau sélectionné : ${startTimeStr} – ${endTimeStr} (${durLabel})`, 'info');
        }
      } else {
        // --- CLIC DROIT ---
        if (durationIncreased) {
          const startTimeStr = this.formatHourDecimal(s.startH);
          const endTimeStr = this.formatHourDecimal(s.currentEndH);
          const totalMin = Math.round((s.currentEndH - s.startH) * 60);
          const hours = Math.floor(totalMin / 60);
          const mins = totalMin % 60;
          const durLabel = hours > 0 ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`) : `${mins}min`;

          if (s.type === 'existing' && s.eventId) {
            await this.updateEventSchedule(s.eventId, s.dateStr, s.startH, s.currentEndH);
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast(`⏱️ Durée prolongée : ${startTimeStr} – ${endTimeStr} (${durLabel})`, 'success');
            }
          } else if (s.type === 'slot') {
            this.openEventModal(null, {
              start: `${s.dateStr}T${startTimeStr}`,
              end: `${s.dateStr}T${endTimeStr}`
            });
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast(`⏱️ Nouveau créneau : ${startTimeStr} – ${endTimeStr} (${durLabel})`, 'info');
            }
          }
        } else {
          // Clic droit court sans maintien -> afficher le menu contextuel
          if (!s.hasExtended) {
            if (s.type === 'existing' && s.eventId) {
              this.showEventContextMenu(e.clientX, e.clientY, s.eventId);
            } else if (s.type === 'slot') {
              const startTimeStr = this.formatHourDecimal(s.startH);
              const endTimeStr = this.formatHourDecimal(s.initialEndH);
              this.showSlotContextMenu(e.clientX, e.clientY, s.dateStr, startTimeStr, endTimeStr);
            }
          }
        }
      }

      this._cleanupRightClickVisuals(s);
      this._rightClickSession = null;
    });

    // 4. Annulation par Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._rightClickSession) {
        const s = this._rightClickSession;
        if (s.holdTimeoutId) clearTimeout(s.holdTimeoutId);
        if (s.intervalId) clearInterval(s.intervalId);
        this._cleanupRightClickVisuals(s);
        this._rightClickSession = null;
      }
    });
  },

  _startRightClickExtension() {
    const s = this._rightClickSession;
    if (!s) return;

    s.hasExtended = true;

    const stepIncrement = () => {
      if (!this._rightClickSession) return;
      const nextEnd = Math.min(s.maxEndH, s.currentEndH + 0.25);
      if (nextEnd > s.currentEndH) {
        s.currentEndH = nextEnd;
        this._updateRightClickVisuals(s);
        if (window.App && typeof window.App.triggerHapticFeedback === 'function') {
          window.App.triggerHapticFeedback();
        }
      }
    };

    // Premier incrément (+15 min)
    stepIncrement();

    // Répéter tant que le clic droit reste maintenu
    s.intervalId = setInterval(stepIncrement, 240);
  },

  _updateRightClickVisuals(s) {
    const durationH = Math.max(0.25, s.currentEndH - s.startH);
    const heightPx = Math.max(26, durationH * this.slotHeight - 2);
    const startTimeStr = this.formatHourDecimal(s.startH);
    const endTimeStr = this.formatHourDecimal(s.currentEndH);
    const totalMin = Math.round(durationH * 60);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    const durLabel = hours > 0 ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`) : `${mins}min`;

    if (s.type === 'existing' && s.eventEl) {
      s.eventEl.classList.add('event-extending');
      s.eventEl.style.setProperty('height', `${heightPx}px`, 'important');

      // Mettre à jour l'étiquette horaire visible dans la carte
      const timePill = s.eventEl.querySelector('.event-time-pill') || s.eventEl.querySelector('.event-time-compact');
      if (timePill) {
        timePill.textContent = `${startTimeStr} - ${endTimeStr}`;
      }

      let badge = s.eventEl.querySelector('.event-extending-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'event-extending-badge';
        s.eventEl.appendChild(badge);
      }
      badge.textContent = `⏱️ ${startTimeStr} – ${endTimeStr} (${durLabel})`;
    } else if (s.type === 'slot' && s.dayCol) {
      let indicator = document.getElementById('agenda-slot-hover-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'agenda-slot-hover-indicator extending';
        indicator.id = 'agenda-slot-hover-indicator';
        indicator.innerHTML = `
          <div class="agenda-slot-hover-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="agenda-slot-hover-time"></span>
          </div>
        `;
        s.dayCol.appendChild(indicator);
      } else if (indicator.parentElement !== s.dayCol) {
        s.dayCol.appendChild(indicator);
      }
      indicator.classList.add('extending');
      indicator.style.display = 'flex';
      const topPx = (s.startH - this.dayHoursStart) * this.slotHeight;
      indicator.style.setProperty('top', `${topPx}px`, 'important');
      indicator.style.setProperty('height', `${heightPx}px`, 'important');
      const span = indicator.querySelector('.agenda-slot-hover-time');
      if (span) {
        span.textContent = `${startTimeStr} – ${endTimeStr} (${durLabel})`;
      }
    }
  },

  _cleanupRightClickVisuals(s) {
    if (!s) return;
    if (s.eventEl) {
      s.eventEl.classList.remove('event-extending');
      const badge = s.eventEl.querySelector('.event-extending-badge');
      if (badge) badge.remove();
      if (!s.hasExtended) {
        const origDur = Math.max(0.25, s.initialEndH - s.startH);
        s.eventEl.style.setProperty('height', `${Math.max(26, origDur * this.slotHeight - 2)}px`);
      }
    }
    const indicator = document.getElementById('agenda-slot-hover-indicator');
    if (indicator) {
      indicator.classList.remove('extending');
      if (s.type === 'slot') indicator.remove();
    }
  },

  closeEventModal() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.remove('active');
    const inputStart = document.getElementById('event-input-start');
    const inputEnd = document.getElementById('event-input-end');
    if (inputStart) inputStart.type = 'datetime-local';
    if (inputEnd) inputEnd.type = 'datetime-local';
    if (typeof App !== 'undefined' && typeof App.closeColorPicker === 'function') {
      App.closeColorPicker(true);
    }
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
