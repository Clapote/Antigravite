/**
 * Antigravité - Module de Notifications Windows pour l'Agenda
 * Notifications bienveillantes et variées :
 * - 1 heure avant chaque événement
 * - 30 minutes avant chaque événement
 * - Au moment même où commence l'événement
 */

const AgendaNotificationManager = {
  // Historique des notifications déjà envoyées par événement : { [eventId]: ['60m', '30m', 'now'] }
  sentHistory: {},
  checkIntervalId: null,

  // Pools de messages agréables, chaleureux et variés, avec une forte dose d'humour bienveillant
  MESSAGES: {
    '60m': [
      "⏳ Dans 1 heure : « {title} ». Vous avez encore un bon moment pour vous préparer sereinement.",
      "🌿 Rappel doux : « {title} » commence dans une heure. Pensez à vous étirer ou à boire un verre d'eau !",
      "💡 Votre créneau « {title} » approche dans 60 minutes. Finissez tranquillement ce que vous avez en cours.",
      "☕ Dans 1h : « {title} ». Le moment idéal pour faire une petite pause avant de démarrer.",
      "🎯 Horizon 1 heure : « {title} ». Gardez le cap, tout est sous contrôle !",
      "🌤️ Dans 60 minutes, place à : « {title} ». Respirez, tout va bien se passer.",
      "📖 Plus qu'une heure avant « {title} ». Un petit sas pour rassembler vos idées et vos notes.",
      "👀 Coup d'œil bienveillant : « {title} » est dans 1h. Prenez votre temps pour boucler vos tâches.",
      "🚀 Dans 1 heure pile : « {title} ». Une belle opportunité pour avancer sur vos priorités !",
      "🧘‍♂️ Anticipation sereine : « {title} » débute dans 60 minutes. Vous êtes fin prêt.",
      "🌱 Dans 1h : « {title} ». Accordez-vous un instant de calme avant cette prochaine étape.",
      "☀️ Rappel amical : « {title} » est prévu dans une heure. Belle suite de journée à vous !",
      "🕵️‍♂️ Alerte discrète : « {title} » commence dans 60 minutes. Vous avez le temps de ranger les 47 onglets ouverts sur votre navigateur.",
      "☕ Dans 1 heure : « {title} ». C'est le moment officiel pour répéter votre discours sous la douche ou faire couler un café.",
      "🥐 Dans 60 minutes : « {title} ». Selon la science, un croissant dégusté maintenant augmente l'efficacité de 200 %.",
      "🛋️ H-1 avant « {title} » : commencez la négociation diplomatique pour vous extraire délicatement de votre fauteuil.",
      "🎩 Dans 1 heure : « {title} ». Entraînez votre regard le plus professionnel devant le miroir.",
      "⚡ Dans 60 minutes : « {title} ». Les experts recommandent 5 minutes de préparation et 55 minutes de contemplation zen.",
      "🎪 Dans 1 heure : « {title} ». C'est l'heure de passer du mode pyjama mental au mode conquête du monde.",
      "🧭 Dans 60 minutes : « {title} ». Vous avez encore 59 minutes de déni avant d'être formidablement productif.",
      "🧠 Alerte neurones : « {title} » dans 1 heure. Vos idées ont 60 minutes pour se mettre en rang par deux.",
      "🔋 Jauge d'énergie : « {title} » arrive dans une heure. Remplissez la tasse, affûtez le sourire et en avant !",
      "🦄 Dans 60 minutes : « {title} ». Même les créatures magiques n'ont jamais eu un timing aussi impeccable que le vôtre.",
      "🛡️ Bouclier anti-imprévu activé : « {title} » dans 1h. Tout se déroulera comme sur des roulettes !"
    ],
    '30m': [
      "⏰ Dans 30 minutes : « {title} ». Le moment parfait pour rassembler vos documents ou vérifier vos liens.",
      "🍵 C'est bientôt l'heure : « {title} » débute dans une demi-heure. Préparez-vous en douceur !",
      "🌟 Plus que 30 minutes avant « {title} ». Prenez une grande inspiration, vous allez assurer !",
      "💼 Dans une demi-heure : « {title} ». Une gorgée d'eau, un coup d'œil sur vos objectifs et c'est parti.",
      "📌 Rendez-vous dans 30 min pour « {title} ». Installez-vous confortablement pour cette session.",
      "🌤️ Tic-tac bienveillant : « {title} » arrive dans une demi-heure. Vous avez tout ce qu'il faut en main.",
      "🎯 Plus que 30 minutes : « {title} ». Faites le vide pour aborder ce créneau dans les meilleures conditions.",
      "💪 Dans une demi-heure : « {title} ». Une belle séance productive s'annonce !",
      "🛋️ Dernière ligne droite : « {title} » commence dans 30 minutes. Prenez deux minutes pour vous recentrer.",
      "✨ Dans 30 min : « {title} ». Belle énergie pour cette rencontre ou ce temps de travail !",
      "🚀 C'est pour très bientôt : « {title} » dans une demi-heure. Tout se déroulera à merveille.",
      "🌈 Dans 30 minutes : « {title} ». Gardez le sourire, vous êtes prêt !",
      "📱 Dans 30 minutes : « {title} ». C'est l'heure officielle d'arrêter de scroller sur votre téléphone. Oui, maintenant !",
      "🍵 Plus que 30 minutes avant « {title} ». Finissez votre boisson avant qu'elle ne prenne la température de la pièce.",
      "🕶️ Dans une demi-heure : « {title} ». Mettez vos lunettes de pro et affichez l'air de quelqu'un qui maîtrise la situation.",
      "🌪️ Tic-tac : « {title} » dans 30 minutes. C'est le moment de feindre la surprise et de lancer les préparatifs !",
      "🤹‍♂️ H-30 minutes avant « {title} ». Fermez discrètement les vidéos de petits chats et rassemblez vos dossiers.",
      "🎭 Dans 30 min : « {title} ». Répétez avec moi : 'Excellente remarque, je vérifie immédiatement'.",
      "🚀 Plus que 30 minutes avant « {title} ». Même Thomas Pesquet était moins préparé avant un décollage.",
      "🔋 Dans une demi-heure : « {title} ». Branchez votre motivation sur le secteur, ça va swinguer !",
      "🏃‍♂️ Dans 30 minutes : « {title} ». Pas de panique : une demi-heure, c'est largement assez pour sauver l'univers.",
      "☕ Compte à rebours : « {title} » dans 30 min. Dernière chance pour une gorgée de café chaude !",
      "✨ H-30 min pour « {title} ». Affichez votre plus beau sourire de stratège émérite."
    ],
    'now': [
      "🔔 C'est l'heure : « {title} » commence maintenant ! Donnez le meilleur de vous-même.",
      "🚀 Top départ pour « {title} » ! Belle séance et plein de réussite.",
      "⚡ C'est le moment : « {title} » débute à l'instant. Concentration, calme et énergie !",
      "🎯 Place à : « {title} ». Vous avez toutes les clés en main, bonne session !",
      "🌟 L'heure a sonné pour « {title} ». Respirez un grand coup et lancez-vous avec confiance !",
      "☀️ C'est parti pour « {title} » ! Profitez pleinement de ce temps de concentration.",
      "👏 C'est maintenant : « {title} ». Faites de ce créneau un moment utile et agréable !",
      "💼 Votre créneau « {title} » commence à la seconde. Bon travail et belle productivité !",
      "🌿 C'est à vous : « {title} » débute. Restez serein et gardez un esprit clair.",
      "🎉 C'est parti ! « {title} » commence. Donnez le ton et passez un excellent moment.",
      "💫 Rendez-vous ouvert : « {title} ». Tout est en place, en avant !",
      "🍀 C'est le moment d'y être : « {title} ». Une très bonne session à vous !",
      "🔔 C'est l'heure : « {title} » commence pile maintenant ! Souriez, respirez et faites semblant de tout maîtriser.",
      "☕ Alerte immédiate : « {title} » démarre à la seconde ! La sieste est officiellement reportée à plus tard.",
      "⚡ C'est parti pour « {title} » ! Montrez-leur qui est le patron (même si le patron, c'est juste vous et votre écran).",
      "🎩 C'est le moment magique : « {title} » débute ! Place à l'action, l'improvisation géniale et le panache.",
      "🎉 Rideau levé pour « {title} » ! Entrez sur scène avec la démarche assurée d'un héros de film d'action.",
      "🎯 C'est maintenant : « {title} ». Même James Bond n'a jamais été aussi ponctuel que vous.",
      "💥 C'est l'instant T : « {title} » ! Enfilez votre armure de concentration suprême.",
      "🌟 C'est parti pour « {title} » ! C'est le moment de briller avec une modestie tout à fait exemplaire.",
      "🦾 « {title} » démarre à l'instant. Adieu les excuses, bonjour les victoires éclatantes !",
      "🍿 Lumière tamisée, projecteurs allumés : place à « {title} ». Bon spectacle et belle session !",
      "🏆 C'est maintenant : « {title} ». Si la productivité était une discipline olympique, vous auriez déjà l'or !"
    ]
  },

  // Dernier index utilisé par étape pour éviter qu'un même message se répète deux fois de suite
  lastMessageIndex: {
    '60m': -1,
    '30m': -1,
    'now': -1
  },

  init() {
    this.loadHistory();
    // Vérification toutes les 30 secondes
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    this.checkIntervalId = setInterval(() => this.checkUpcomingEvents(), 30000);
    if (this.checkIntervalId && typeof this.checkIntervalId.unref === 'function') {
      this.checkIntervalId.unref();
    }

    // Première vérification immédiate après un court délai d'initialisation
    const initialTimer = setTimeout(() => this.checkUpcomingEvents(), 2000);
    if (initialTimer && typeof initialTimer.unref === 'function') {
      initialTimer.unref();
    }
  },

  loadHistory() {
    try {
      const saved = localStorage.getItem('antigravite_notified_events');
      if (saved) {
        this.sentHistory = JSON.parse(saved);
      }
    } catch (_e) {
      this.sentHistory = {};
    }
  },

  saveHistory() {
    try {
      localStorage.setItem('antigravite_notified_events', JSON.stringify(this.sentHistory));
    } catch (_e) {}
  },

  getRandomMessage(stage, title) {
    const list = this.MESSAGES[stage] || this.MESSAGES['now'];
    let idx = Math.floor(Math.random() * list.length);
    if (idx === this.lastMessageIndex[stage] && list.length > 1) {
      idx = (idx + 1) % list.length;
    }
    this.lastMessageIndex[stage] = idx;
    const cleanTitle = (title || 'Votre créneau').trim();
    return list[idx].replace('{title}', cleanTitle);
  },

  _formatLocalYMD(dateObj) {
    const pad = n => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  },

  _doesRecurringEventOccurOn(evt, dateStr) {
    if (!evt || !evt.start || !evt.recurrence || evt.recurrence === 'none') return false;
    if (typeof window !== 'undefined' && window.AgendaManager && typeof window.AgendaManager.isEventOnDate === 'function') {
      return window.AgendaManager.isEventOnDate(evt, dateStr);
    }
    const startDay = evt.start.slice(0, 10);
    if (dateStr < startDay) return false;
    if (evt.recurrenceEnd && dateStr > evt.recurrenceEnd.slice(0, 10)) return false;
    const sDate = new Date(`${startDay}T00:00:00`);
    const tDate = new Date(`${dateStr}T00:00:00`);
    if (isNaN(sDate.getTime()) || isNaN(tDate.getTime())) return false;
    const diffDays = Math.round((tDate - sDate) / 86400000);
    switch (evt.recurrence) {
      case 'daily': return true;
      case 'weekdays': {
        const wd = tDate.getDay();
        return wd >= 1 && wd <= 5;
      }
      case 'weekly': return diffDays % 7 === 0;
      case 'biweekly': return diffDays % 14 === 0;
      case 'monthly': return tDate.getDate() === sDate.getDate();
      case 'yearly': return tDate.getDate() === sDate.getDate() && tDate.getMonth() === sDate.getMonth();
      default: return false;
    }
  },

  _resolveEventOccurrencesNearNow(evt, nowMs) {
    if (!evt || evt.isAllDay || !evt.start) return [];
    const baseId = evt.id || `${evt.title}_${evt.start}`;
    if (!evt.recurrence || evt.recurrence === 'none') {
      const ts = new Date(evt.start).getTime();
      return isNaN(ts) ? [] : [{ key: baseId, startMs: ts, startSig: evt.start }];
    }

    const timePart = evt.start.length >= 16 ? evt.start.slice(11, 16) : '09:00';
    const todayDate = new Date(nowMs);
    const tomorrowDate = new Date(nowMs);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const candidates = [this._formatLocalYMD(todayDate), this._formatLocalYMD(tomorrowDate)];
    const occurrences = [];

    for (let i = 0; i < candidates.length; i++) {
      const dStr = candidates[i];
      if (!this._doesRecurringEventOccurOn(evt, dStr)) continue;
      const startIso = `${dStr}T${timePart}`;
      const ts = new Date(startIso).getTime();
      if (!isNaN(ts)) {
        occurrences.push({
          key: `${baseId}::${dStr}`,
          startMs: ts,
          startSig: startIso
        });
      }
    }
    return occurrences;
  },

  resetEventNotifications(eventId) {
    if (!eventId) return;
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(this.sentHistory, eventId)) {
      delete this.sentHistory[eventId];
      changed = true;
    }
    const prefix = `${eventId}::`;
    for (const k of Object.keys(this.sentHistory)) {
      if (k.startsWith(prefix)) {
        delete this.sentHistory[k];
        changed = true;
      }
    }
    if (changed) {
      this.saveHistory();
    }
  },

  checkUpcomingEvents() {
    if (!window.StorageManager || typeof window.StorageManager.getEvents !== 'function') return;

    // Récupérer les préférences utilisateur pour les notifications
    const settings = (typeof window.StorageManager.getSettings === 'function')
      ? window.StorageManager.getSettings()
      : {};

    // Si les notifications globales sont désactivées dans les paramètres
    if (settings && settings.notificationsEnabled === false) return;

    this.checkDueTaskDeadlines(settings);
    this.checkDebriefAvailabilityToast(settings);

    // Choix multiples des moments de notification (par défaut : 60m, 30m, now)
    const enabledStages = (settings && Array.isArray(settings.agendaNotificationStages))
      ? settings.agendaNotificationStages
      : ['60m', '30m', 'now'];

    // Si aucun rappel d'agenda n'est coché, ne rien envoyer pour l'agenda
    if (!enabledStages || enabledStages.length === 0) return;

    const events = window.StorageManager.getEvents();
    if (!Array.isArray(events) || events.length === 0) return;

    const now = Date.now();
    let historyModified = false;
    const check60 = enabledStages.includes('60m');
    const check30 = enabledStages.includes('30m');
    const checkNow = enabledStages.includes('now');
    const hasExistingHistory = Object.keys(this.sentHistory).length > 0;
    const activeEventIds = hasExistingHistory ? new Set() : null;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      if (!evt || evt.isAllDay || !evt.start) continue;

      const occurrences = this._resolveEventOccurrencesNearNow(evt, now);
      for (let j = 0; j < occurrences.length; j++) {
        const occ = occurrences[j];
        const diffMin = (occ.startMs - now) / 60000;
        if (activeEventIds) activeEventIds.add(occ.key);

        // Nettoyer l'historique uniquement si l'occurrence était déjà tracée et terminée > 24h
        if (diffMin < -1440) {
          if (Object.prototype.hasOwnProperty.call(this.sentHistory, occ.key)) {
            delete this.sentHistory[occ.key];
            historyModified = true;
          }
          continue;
        }

        // Pré-filtrage O(1) : ignorer tout événement hors de la fenêtre active [-10 min .. +70 min]
        if (diffMin > 70 || diffMin < -10) continue;

        let entry = this.sentHistory[occ.key];
        // Normalisation + réinitialisation automatique si l'horaire d'un événement replanifié a changé
        if (Array.isArray(entry)) {
          entry = { stages: entry, startSig: occ.startSig };
          this.sentHistory[occ.key] = entry;
        } else if (entry && entry.startSig && entry.startSig !== occ.startSig) {
          delete this.sentHistory[occ.key];
          entry = null;
          historyModified = true;
        }

        const sent = entry ? entry.stages : null;
        const ensureSentArray = () => {
          if (!this.sentHistory[occ.key] || Array.isArray(this.sentHistory[occ.key])) {
            this.sentHistory[occ.key] = { stages: [], startSig: occ.startSig };
          }
          return this.sentHistory[occ.key].stages;
        };

        // 1. Notification 1 heure avant (entre 45 et 61 min avant l'événement)
        if (check60 && diffMin <= 61 && diffMin >= 45 && (!sent || !sent.includes('60m'))) {
          ensureSentArray().push('60m');
          historyModified = true;
          this.notify('60m', evt);
        }

        // 2. Notification 30 minutes avant (entre 15 et 31 min avant l'événement)
        if (check30 && diffMin <= 31 && diffMin >= 15 && (!sent || !sent.includes('30m'))) {
          ensureSentArray().push('30m');
          historyModified = true;
          this.notify('30m', evt);
        }

        // 3. Notification au moment même (entre -5 min et +2 min)
        if (checkNow && diffMin <= 2 && diffMin >= -5 && (!sent || !sent.includes('now'))) {
          ensureSentArray().push('now');
          historyModified = true;
          this.notify('now', evt);
        }
      }
    }

    // Élagage mémoire : nettoyer uniquement si l'historique n'est pas vide
    if (activeEventIds) {
      for (const id in this.sentHistory) {
        if (!activeEventIds.has(id)) {
          delete this.sentHistory[id];
          historyModified = true;
        }
      }
    }

    if (historyModified) {
      this.saveHistory();
    }
  },

  checkDueTaskDeadlines(settings = {}) {
    if (!window.StorageManager || typeof window.StorageManager.getTasks !== 'function') return;
    if (settings && (settings.notificationsEnabled === false || settings.taskDeadlineNotificationsEnabled === false)) return;

    const todayStr = this._formatLocalYMD(new Date());
    const tRev = typeof window.StorageManager.getRevision === 'function' ? window.StorageManager.getRevision('tasks') : '0';
    const pRev = typeof window.StorageManager.getRevision === 'function' ? window.StorageManager.getRevision('projects') : '0';
    const sig = `${todayStr}:${tRev}:${pRev}`;
    if (this._lastDeadlineCheckSig === sig) return;
    this._lastDeadlineCheckSig = sig;

    const storageKey = 'antigravite_notified_deadlines_v1';
    let notifiedIds = new Set();
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayStr && Array.isArray(parsed.ids)) {
            notifiedIds = new Set(parsed.ids);
          }
        }
      }
    } catch (_) {}

    const projects = typeof window.StorageManager.getProjects === 'function' ? window.StorageManager.getProjects() : [];
    const archivedProjectIds = new Set(projects.filter(p => p && p.archived).map(p => p.id));
    const trashItems = typeof window.StorageManager.getTrash === 'function' ? window.StorageManager.getTrash() : [];
    const trashTaskIds = new Set(trashItems.filter(i => i && i.type === 'task').map(i => (i.data && i.data.id) || i.originalId || i.id));

    const dueTasks = [];
    const walk = (list, inheritedProjId = null) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t || !t.id) continue;
        const projId = t.projectId || inheritedProjId;
        if (!t.completed && !trashTaskIds.has(t.id) && !(projId && archivedProjectIds.has(projId))) {
          if (t.deadline && typeof t.deadline === 'string' && t.deadline.slice(0, 10) <= todayStr) {
            if (!notifiedIds.has(t.id)) {
              dueTasks.push(t);
            }
          }
        }
        if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          walk(t.subtasks, projId);
        }
      }
    };
    walk(window.StorageManager.getTasks());

    if (dueTasks.length === 0) return;

    dueTasks.forEach(t => notifiedIds.add(t.id));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify({
          date: todayStr,
          ids: Array.from(notifiedIds)
        }));
      }
    } catch (_) {}

    const title = 'Antigravité • Échéance';
    const body = dueTasks.length === 1
      ? `📌 Échéance du jour : « ${(dueTasks[0].title || 'Tâche').trim()} »`
      : `📌 ${dueTasks.length} tâches arrivent à échéance aujourd'hui (dont « ${(dueTasks[0].title || 'Tâche').trim()} »).`;
    const action = dueTasks.length === 1
      ? { type: 'open-task', taskId: dueTasks[0].id }
      : { type: 'navigate', screen: 'tasks', statAction: 'deadlines-near' };

    if (window.AntigraviteAPI && typeof window.AntigraviteAPI.showNotification === 'function') {
      window.AntigraviteAPI.showNotification({ title, body, action }).catch(() => {});
    }
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(body, 'info', {
        duration: 6000,
        actionLabel: 'Voir',
        onAction: () => {
          if (typeof window.App.handleNotificationAction === 'function') {
            window.App.handleNotificationAction(action);
          }
        }
      });
    }
  },

  checkDebriefAvailabilityToast(settings = {}) {
    if (typeof DebriefManager === 'undefined' || typeof DebriefManager.isDebriefAvailable !== 'function') return;
    if (settings && settings.debriefEnabled === false) return;
    const todayStr = this._formatLocalYMD(new Date());
    const promptKey = 'antigravite_debrief_prompted_v1';
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(promptKey) === todayStr) return;
    } catch (_) {}

    const avail = DebriefManager.isDebriefAvailable(settings);
    if (!avail || !avail.available) return;
    if (typeof DebriefManager.hasSeenToday === 'function' && DebriefManager.hasSeenToday()) return;
    if (typeof DebriefManager.isSnoozedNow === 'function' && DebriefManager.isSnoozedNow()) return;
    if (window.App && window.App.currentScreen === 'debrief') return;

    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(promptKey, todayStr);
    } catch (_) {}

    const msg = avail.mode === 'weekly'
      ? '🌤️ Votre bilan de semaine est disponible quand vous souhaitez faire le point.'
      : '🌤️ Votre bilan de fin de journée est prêt quand vous le souhaiterez.';
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(msg, 'info', {
        duration: 6500,
        actionLabel: 'Ouvrir',
        onAction: () => window.App.navigate('debrief')
      });
    }
  },

  testNotification(stage = '30m') {
    const fakeEvent = {
      id: 'demo-sample-event',
      title: 'Point d\'étape Antigravité'
    };
    this.notify(stage, fakeEvent);
  },

  notify(stage, event) {
    const titles = {
      '60m': 'Antigravité • Dans 1 heure',
      '30m': 'Antigravité • Dans 30 minutes',
      'now': 'Antigravité • C\'est l\'heure !'
    };

    const notificationTitle = titles[stage] || 'Antigravité - Agenda';
    const notificationBody = this.getRandomMessage(stage, event.title);
    const hasValidEvent = !!(event && event.id && event.id !== 'demo-sample-event');
    const action = hasValidEvent ? { type: 'open-event', eventId: event.id } : null;

    // 1. Notification native Windows via Electron
    if (window.AntigraviteAPI && typeof window.AntigraviteAPI.showNotification === 'function') {
      window.AntigraviteAPI.showNotification({
        title: notificationTitle,
        body: notificationBody,
        action
      }).catch(err => {
        console.warn("[AgendaNotificationManager] Échec notification native :", err);
      });
    }

    // 2. Toast discret en bas de l'application si elle est ouverte
    if (window.App && typeof window.App.showToast === 'function') {
      if (action) {
        window.App.showToast(notificationBody, 'info', {
          duration: 6000,
          actionLabel: 'Voir',
          onAction: () => {
            if (typeof window.App.handleNotificationAction === 'function') {
              window.App.handleNotificationAction(action);
            }
          }
        });
      } else {
        window.App.showToast(notificationBody, 'info');
      }
    }

    // 3. Carillon sonore discret si activé dans les paramètres
    try {
      const settings = (window.StorageManager && typeof window.StorageManager.getSettings === 'function')
        ? window.StorageManager.getSettings()
        : {};

      const soundType = settings.notificationSound || 'zen';
      const soundVol = (settings.notificationVolume !== undefined ? settings.notificationVolume : 60) / 100;

      if (soundType !== 'none' && soundVol > 0) {
        const soundMgr = (typeof window.SoundManager !== 'undefined')
          ? window.SoundManager
          : (typeof SoundManager !== 'undefined' ? SoundManager : null);
        if (soundMgr && typeof soundMgr.playSound === 'function') {
          soundMgr.playSound(soundType, soundVol);
        }
      }
    } catch (_soundErr) {}
  }
};

// Exposer globalement
if (typeof window !== 'undefined') {
  window.AgendaNotificationManager = AgendaNotificationManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgendaNotificationManager;
}
