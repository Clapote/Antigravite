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

  // Pools de messages agréables, chaleureux et variés
  MESSAGES: {
    '60m': [
      "⏳ Dans 1 heure : « {title} ». Vous avez encore un bon moment pour vous préparer sereinement.",
      "🌿 Rappel doux : « {title} » commence dans une heure. Pensez à vous étirer ou à boire un verre d'eau !",
      "💡 Votre créneau « {title} » approche dans 60 minutes. Finissez tranquillement ce que vous avez en cours.",
      "☕ Dans 1h : « {title} ». Le moment idéal pour faire une petite pause avant de démarrer.",
      "🎯 Horizon 1 heure : « {title} ». Gardez le cap, tout est sous contrôle !",
      "🌤️ Dans 60 minutes, place à : « {title} ». Respirez, tout va bien se passer.",
      "📖 Plus qu'une heure avant « {title} ». Un petit sas pour rassembler vos idées et vos notes.",
      "! Coup d'œil bienveillant : « {title} » est dans 1h. Prenez votre temps pour boucler vos tâches.",
      "🚀 Dans 1 heure pile : « {title} ». Une belle opportunité pour avancer sur vos priorités !",
      "🧘‍♂️ Anticipation sereine : « {title} » débute dans 60 minutes. Vous êtes fin prêt.",
      "🌱 Dans 1h : « {title} ». Accordez-vous un instant de calme avant cette prochaine étape.",
      "☀️ Rappel amical : « {title} » est prévu dans une heure. Belle suite de journée à vous !"
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
      "! Dans 30 min : « {title} ». Belle énergie pour cette rencontre ou ce temps de travail !",
      "🚀 C'est pour très bientôt : « {title} » dans une demi-heure. Tout se déroulera à merveille.",
      "🌈 Dans 30 minutes : « {title} ». Gardez le sourire, vous êtes prêt !"
    ],
    'now': [
      "🔔 C'est l'heure : « {title} » commence maintenant ! Donnez le meilleur de vous-même.",
      "🚀 Top départ pour « {title} » ! Belle séance et plein de réussite.",
      "! C'est le moment : « {title} » débute à l'instant. Concentration, calme et énergie !",
      "🎯 Place à : « {title} ». Vous avez toutes les clés en main, bonne session !",
      "🌟 L'heure a sonné pour « {title} ». Respirez un grand coup et lancez-vous avec confiance !",
      "☀️ C'est parti pour « {title} » ! Profitez pleinement de ce temps de concentration.",
      "👏 C'est maintenant : « {title} ». Faites de ce créneau un moment utile et agréable !",
      "💼 Votre créneau « {title} » commence à la seconde. Bon travail et belle productivité !",
      "🌿 C'est à vous : « {title} » débute. Restez serein et gardez un esprit clair.",
      "🎉 C'est parti ! « {title} » commence. Donnez le ton et passez un excellent moment.",
      "💫 Rendez-vous ouvert : « {title} ». Tout est en place, en avant !",
      "🍀 C'est le moment d'y être : « {title} ». Une très bonne session à vous !"
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

    // Première vérification immédiate après un court délai d'initialisation
    setTimeout(() => this.checkUpcomingEvents(), 2000);
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

  checkUpcomingEvents() {
    if (!window.StorageManager || typeof window.StorageManager.getEvents !== 'function') return;

    // Récupérer les préférences utilisateur pour les notifications
    const settings = (typeof window.StorageManager.getSettings === 'function')
      ? window.StorageManager.getSettings()
      : {};

    // Si les notifications globales sont désactivées dans les paramètres
    if (settings && settings.notificationsEnabled === false) return;

    // Choix multiples des moments de notification (par défaut : 60m, 30m, now)
    const enabledStages = (settings && Array.isArray(settings.agendaNotificationStages))
      ? settings.agendaNotificationStages
      : ['60m', '30m', 'now'];

    // Si aucun rappel n'est coché, ne rien envoyer
    if (!enabledStages || enabledStages.length === 0) return;

    const events = window.StorageManager.getEvents();
    if (!Array.isArray(events) || events.length === 0) return;

    const now = Date.now();
    let historyModified = false;

    events.forEach(evt => {
      // Ignorer les journées entières sans horaire précis ou événements sans date
      if (evt.isAllDay || !evt.start) return;

      const eventStart = new Date(evt.start).getTime();
      if (isNaN(eventStart)) return;

      const diffMin = (eventStart - now) / 60000;
      const eventId = evt.id || `${evt.title}_${evt.start}`;

      if (!this.sentHistory[eventId]) {
        this.sentHistory[eventId] = [];
      }
      const sent = this.sentHistory[eventId];

      // 1. Notification 1 heure avant (entre 45 et 61 min avant l'événement)
      if (enabledStages.includes('60m') && diffMin <= 61 && diffMin >= 45 && !sent.includes('60m')) {
        sent.push('60m');
        historyModified = true;
        this.notify('60m', evt);
      }

      // 2. Notification 30 minutes avant (entre 15 et 31 min avant l'événement)
      if (enabledStages.includes('30m') && diffMin <= 31 && diffMin >= 15 && !sent.includes('30m')) {
        sent.push('30m');
        historyModified = true;
        this.notify('30m', evt);
      }

      // 3. Notification au moment même (entre -5 min et +2 min)
      if (enabledStages.includes('now') && diffMin <= 2 && diffMin >= -5 && !sent.includes('now')) {
        sent.push('now');
        historyModified = true;
        this.notify('now', evt);
      }

      // Nettoyer l'historique des événements terminés depuis plus de 24h
      if (diffMin < -1440 && this.sentHistory[eventId]) {
        delete this.sentHistory[eventId];
        historyModified = true;
      }
    });

    // Élagage mémoire : nettoyer les clés orphelines des événements supprimés du calendrier
    const activeEventIds = new Set(events.map(e => e.id || `${e.title}_${e.start}`));
    for (const id in this.sentHistory) {
      if (!activeEventIds.has(id)) {
        delete this.sentHistory[id];
        historyModified = true;
      }
    }

    if (historyModified) {
      this.saveHistory();
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

    // 1. Notification native Windows via Electron
    if (window.AntigraviteAPI && typeof window.AntigraviteAPI.showNotification === 'function') {
      window.AntigraviteAPI.showNotification({
        title: notificationTitle,
        body: notificationBody
      }).catch(err => {
        console.warn("[AgendaNotificationManager] Échec notification native :", err);
      });
    }

    // 2. Toast discret en bas de l'application si elle est ouverte
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(notificationBody, 'info');
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
