/**
 * Antigravité - Module de Débriefing Positif & Bilan Bienveillant
 * Philosophie fondamentale : Mettre en valeur ce qui a avancé, zéro culpabilité, zéro score, zéro faux progrès.
 */

const DebriefManager = {
  // Liste nouvelle et personnalisée de phrases dédiées pour le débriefing
  DAILY_PHRASES: [
    "Chaque petit pas compte. Bravo pour le chemin parcouru aujourd’hui !",
    "La journée s’achève. Prenez le temps de savourer ce que vous avez accompli.",
    "Une belle étape de franchie. Il est temps de déconnecter et de vous détendre.",
    "Peu importe le nombre de cases cochées, vous avez avancé. Belle soirée !",
    "Le travail du jour est fait, l’esprit peut se poser. Passez une agréable soirée.",
    "Vos projets prennent forme, pas à pas. Accordez-vous un moment de répit bien mérité.",
    "La clarté vient aussi avec le repos. Fermez vos dossiers l’esprit tranquille.",
    "Félicitations pour vos efforts du jour. Demain est une autre belle opportunité.",
    "La sérénité, c’est aussi savoir s’arrêter à temps. Belle et douce fin de journée !",
    "Une pensée chaleureuse pour clore cette journée en toute légèreté.",
    "Mission accomplie ! Le monde peut attendre demain, votre canapé vous réclame d'urgence.",
    "Vous avez fait bouger des montagnes (ou au moins quelques dossiers, ce qui est déjà grandiose).",
    "Officiellement déclaré apte à vous affaler sans remords. Beau travail aujourd’hui !",
    "Vos neurones ont mérité leur médaille d'or du jour. Déconnexion autorisée et encouragée !",
    "Si votre ordinateur pouvait applaudir, il ferait une standing ovation. Fermez tout l’esprit léger !",
    "Vous avez coché des cases, vaincu la gravité et gagné le droit d'ignorer tout ce qui ressemble à du travail.",
    "Votre journée mérite amplement une double portion de dessert. Belle fin de journée !",
    "Même les super-héros rangent leur cape le soir. Bravo pour vos avancées !",
    "Bilan certifié conforme : vous avez été formidable, vos tâches n'ont rien vu venir.",
    "C'est l'heure où les écrans s'éteignent et où les tisanes (ou les apéros) prennent le pouvoir !",
    "Vous avez dominé cette journée comme un chef. Il ne vous reste plus qu'à maîtriser l'art de la détente ce soir.",
    "Mission du jour accomplie avec les honneurs. Le comité de la flemme vous accorde un repos immédiat !",
    "Vos dossiers s'endorment paisiblement. Inutile de les réveiller avant le lever du soleil !",
    "Vous avez déjoué tous les pièges de la journée. Une récompense virtuelle vous attend sous votre oreiller.",
    "Fermeture officielle du bureau mental : les réclamations seront traitées... jamais. Belle soirée !",
    "Les héros du quotidien méritent aussi de s'affaler devant leur écran préféré. Bravo pour aujourd'hui !",
    "Statut du soir : énergie à plat, fierté au sommet, mission brillamment remplie !",
    "Votre journée a été une véritable œuvre d'art moderne : imprévisible, intense et réussie !",
    "Avis de grand vent de détente : éteignez le moteur, larguez les amarres et savourez votre soirée.",
    "Bravo ! Vous avez survécu à une journée entière de décisions sans perdre votre humour.",
    "Le travail s'arrête là où commence le plaisir du dîner. À vous la liberté !"
  ],

  WEEKLY_PHRASES: [
    "Une semaine de plus au compteur ! Prenez le temps de mesurer tout ce que vous avez construit.",
    "Le week-end est là : laissez vos projets se reposer, ils seront ravis de vous retrouver lundi.",
    "Semaine achevée. Place à la détente, aux loisirs et au temps pour vous !",
    "Félicitations pour votre constance tout au long de la semaine. Très beau week-end !",
    "Regardez en arrière avec bienveillance : chaque jour a apporté sa pierre à l’édifice.",
    "Un repos bien mérité pour recharger vos batteries. Profitez pleinement de votre fin de semaine !",
    "Les grands accomplissements sont une suite de petites victoires. Bravo pour cette semaine !",
    "Semaine pliée, rangée, emballée ! Les dossiers restent au placard jusqu’à lundi, c'est un ordre.",
    "Votre cerveau a activé le répondeur du week-end : 'Ne pas déranger sauf pour une sieste ou un bon repas'.",
    "Vous avez bravé toute la semaine avec panache. Laissez vos projets respirer, ils ne vont pas s'enfuir.",
    "Cinq jours d'efforts héroïques validés. Votre canapé vous attend avec impatience pour le week-end !",
    "Week-end en approche rapide ! Laissez les listes refroidir, elles ont assez chauffé.",
    "Félicitations : vous avez survécu à la semaine avec brio et élégance. Que la détente commence !",
    "Vos projets ont pris de l'avance, vos neurones ont mérité deux jours de vacances express !",
    "Avis météo du week-end : tempête de couette, averses de détente et zéro risque d'urgence professionnelle !",
    "Cinq jours d'exploits au compteur. Les clés du royaume du repos vous sont remises avec mention d'excellence.",
    "Semaine pliée en quatre ! Tout est rangé, le cerveau est en mode veilleuse festive jusqu'à lundi.",
    "Votre semaine a été un triomphe de diplomatie entre vos envies de sieste et vos devoirs d'adulte.",
    "Offrez un repos bien mérité à vos yeux et à vos doigts : ils ont bravé des kilomètres de défis !",
    "Régime officiel du week-end : zéro courriel, un maximum de plaisir et des grasses matinées homologuées !",
    "Week-end validé par la patrouille du bien-être : vous avez quartier libre absolu !",
    "Le rideau tombe sur cette belle semaine. Profitez de chaque minute de liberté !"
  ],

  CALM_PHRASES: [
    "Une journée de respiration et de calme. Les pauses sont indispensables pour aller loin.",
    "Rien de coché aujourd’hui, et c’est parfaitement sain. Prendre du recul fait aussi partie du chemin.",
    "Le calme d’aujourd’hui prépare l’élan de demain. Prenez soin de vous ce soir.",
    "Pas de précipitation : chaque journée a sa propre couleur. Savourez votre soirée.",
    "Une semaine douce et calme. Les temps de repos sont les fondations des futures réussites.",
    "Journée zen absolue : les plus grands esprits passaient des heures à regarder le plafond pour trouver l'inspiration.",
    "Aucune case cochée ? C'est ce qu'on appelle une manœuvre stratégique de conservation d'énergie. Bravo !",
    "Le chat passe 16 heures par jour à dormir et tout le monde le respecte. Prenez exemple sur lui ce soir.",
    "Une journée calme, c'est juste un élan pris pour sauter encore plus haut demain. Profitez de votre soirée !",
    "Parfois, la meilleure action consiste à laisser passer la tempête en dégustant un bon chocolat chaud.",
    "Pas de cases cochées, mais un esprit reposé : l'investissement le plus rentable de la journée.",
    "Journée zen suprême : même les arbres ne font que regarder pousser leurs feuilles et tout le monde les adore.",
    "La sérénité absolue : ne rien précipiter, respirer et laisser le monde tourner sans forcer.",
    "Une journée sans remue-ménage, c'est le luxe ultime pour recharger vos super-pouvoirs.",
    "Recharge des batteries en cours : aucun voyant d'alerte, juste un grand calme olympien mérité !",
    "Saviez-vous que la créativité adore le silence ? Belle et douce soirée de ressourcement !",
    "Mode hibernation stratégique activé : demain n'en sera que plus lumineux et énergique.",
    "Prendre du temps pour soi n'est pas du temps perdu, c'est du carburant pour la suite !"
  ],

  STORAGE_KEY_SEEN: 'antigravite_debrief_seen',

  init() {
    this.bindEvents();
    this.updateTabVisibility();
  },

  bindEvents() {
    if (typeof document === 'undefined') return;
    const btnDismiss = document.getElementById('btn-debrief-dismiss-today');
    if (btnDismiss && typeof btnDismiss.addEventListener === 'function' && !btnDismiss._hasDebriefListener) {
      btnDismiss._hasDebriefListener = true;
      btnDismiss.addEventListener('click', (e) => {
        e.preventDefault();
        this.completeForToday();
      });
    }

    const btnSnooze = document.getElementById('btn-debrief-snooze');
    if (btnSnooze && typeof btnSnooze.addEventListener === 'function' && !btnSnooze._hasDebriefListener) {
      btnSnooze._hasDebriefListener = true;
      btnSnooze.addEventListener('click', (e) => {
        e.preventDefault();
        this.snooze();
      });
    }
  },

  /**
   * Vérifie si le débriefing est disponible pour consultation selon la date et l'heure courante.
   * - En semaine : disponible à partir de l'heure paramétrée (17:00 par défaut).
   * - Le week-end (samedi et dimanche) : disponible en mode hebdomadaire.
   */
  isDebriefAvailable(settings = null) {
    if (!settings && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      settings = StorageManager.getSettings();
    }
    if (!settings || settings.debriefEnabled === false) {
      return { available: false, mode: 'none' };
    }

    const now = new Date();
    const day = now.getDay(); // 0 = Dimanche, 6 = Samedi
    const isWeekend = (day === 0 || day === 6);

    if (isWeekend) {
      return { available: true, mode: 'weekly' };
    }

    // En semaine (Lundi à Vendredi) : comparer à l'heure configurée
    const targetHourStr = (settings && typeof settings.debriefHour === 'string' && settings.debriefHour.trim())
      ? settings.debriefHour.trim()
      : '17:00';
    const [tH, tM] = targetHourStr.split(':').map(n => parseInt(n, 10) || 0);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const triggerMins = tH * 60 + (tM || 0);

    const isTime = (currentMins >= triggerMins);
    return { available: isTime, mode: isTime ? 'daily' : 'none' };
  },

  /**
   * Détermine si l'onglet doit apparaître dans le volet latéral.
   */
  shouldShowTab(settings = null) {
    if (!settings && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      settings = StorageManager.getSettings();
    }
    if (!settings || settings.debriefEnabled === false) return false;
    if (settings.debriefAlwaysShowTab === true) return true;

    const status = this.isDebriefAvailable(settings);
    return status.available;
  },

  /**
   * Met à jour l'affichage de l'onglet Bilan dans le volet latéral.
   */
  updateTabVisibility() {
    if (typeof document === 'undefined') return;
    const navItem = document.getElementById('nav-item-debrief') || document.querySelector('.nav-item[data-screen="debrief"]');
    if (!navItem) return;

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    const shouldShow = this.shouldShowTab(settings);
    navItem.style.display = shouldShow ? '' : 'none';

    const dot = document.getElementById('nav-debrief-dot');
    if (dot) {
      const hasSeen = this.hasSeenToday();
      dot.style.display = (shouldShow && !hasSeen) ? 'inline-block' : 'none';
    }
  },

  /**
   * Marque le bilan comme terminé pour aujourd'hui.
   */
  markAsSeenToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY_SEEN, JSON.stringify({
          date: today,
          at: new Date().toISOString()
        }));
      }
    } catch (_) {}
    this.updateTabVisibility();
  },

  /**
   * Vérifie si le bilan a été validé pour aujourd'hui.
   */
  hasSeenToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.STORAGE_KEY_SEEN);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.date === today;
        }
      }
    } catch (_) {}
    return false;
  },

  /**
   * Action : Terminer ma journée.
   */
  completeForToday() {
    this.markAsSeenToday();
    if (typeof App !== 'undefined') {
      if (typeof App.showToast === 'function') {
        App.showToast("Excellente soirée ! Votre journée est bien clôturée. À demain !", "success", 4500);
      }
      if (typeof App.navigate === 'function') {
        App.navigate('home');
      }
    }
  },

  /**
   * Action : Reporter à plus tard.
   */
  snooze() {
    if (typeof App !== 'undefined') {
      if (typeof App.showToast === 'function') {
        App.showToast("Bilan mis de côté pour ce soir. Bonne soirée !", "info", 3500);
      }
      if (typeof App.navigate === 'function') {
        App.navigate('home');
      }
    }
  },

  /**
   * Collecte les accomplissements réels du jour.
   */
  getDailyAccomplishments(dateStr = null) {
    const now = new Date();
    const todayStr = dateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const tasks = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function')
      ? StorageManager.getTasks()
      : [];

    // Récupérer les IDs mis en corbeille pour ne pas afficher une tâche supprimée
    const trashItems = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTrash === 'function')
      ? StorageManager.getTrash()
      : [];
    const trashTaskIds = new Set(trashItems.filter(item => item && item.type === 'task').map(item => item.originalId || item.id));

    const completedTasks = [];
    const walk = (t) => {
      if (!t) return;
      if (t.completed && !trashTaskIds.has(t.id)) {
        const compDate = t.completedAt ? t.completedAt.slice(0, 10) : (t.plannedDate || null);
        if (compDate === todayStr) {
          completedTasks.push(t);
        }
      }
      if (Array.isArray(t.subtasks)) {
        t.subtasks.forEach(walk);
      }
    };
    tasks.forEach(walk);

    // Regrouper par projet
    const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
      ? StorageManager.getProjects()
      : [];
    const projectMap = new Map();
    projects.forEach(p => { if (p && p.id) projectMap.set(p.id, p); });

    const byProject = new Map();
    completedTasks.forEach(t => {
      const pId = t.projectId || 'personal';
      if (!byProject.has(pId)) {
        const proj = projectMap.get(pId) || { id: 'personal', title: 'Tâches personnelles', color: '#8b5cf6' };
        byProject.set(pId, { project: proj, tasks: [] });
      }
      byProject.get(pId).tasks.push(t);
    });

    // Créneaux d'agenda
    const events = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function')
      ? StorageManager.getEvents()
      : [];
    const dayEvents = events.filter(e => {
      if (typeof AgendaManager !== 'undefined' && typeof AgendaManager.isEventOnDate === 'function') {
        return AgendaManager.isEventOnDate(e, todayStr);
      }
      return (e.start && e.start.startsWith(todayStr));
    });

    // Trier les créneaux d'agenda (journée entière puis ordre chronologique)
    dayEvents.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.start || '').localeCompare(b.start || '');
    });

    const formattedEvents = dayEvents.map(e => {
      const p = e.projectId ? projectMap.get(e.projectId) : null;
      let timeLabel = 'Journée entière';
      let durationStr = '24h';
      if (!e.isAllDay && e.start) {
        const sTime = e.start.includes('T') ? e.start.split('T')[1].slice(0, 5) : '00:00';
        const eTime = e.end && e.end.includes('T') ? e.end.split('T')[1].slice(0, 5) : '';
        timeLabel = eTime ? `${sTime} - ${eTime}` : `Dès ${sTime}`;
        if (e.end) {
          const sDate = new Date(e.start);
          const eDate = new Date(e.end);
          const diffMs = eDate - sDate;
          if (!isNaN(diffMs) && diffMs > 0) {
            const mins = Math.round(diffMs / 60000);
            if (mins >= 60) {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              durationStr = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
            } else {
              durationStr = `${mins} min`;
            }
          } else {
            durationStr = '';
          }
        } else {
          durationStr = '';
        }
      }
      return {
        id: e.id,
        title: e.title || 'Créneau sans titre',
        isAllDay: !!e.isAllDay,
        timeLabel,
        durationStr,
        project: p || null,
        color: (p && p.color) || e.color || '#38bdf8'
      };
    });

    // Sessions Focus
    let focusCount = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        const rawFocus = localStorage.getItem('antigravite_focus_daily');
        if (rawFocus) {
          const parsed = JSON.parse(rawFocus);
          if (parsed.date === todayStr) {
            focusCount = parsed.count || 0;
          }
        }
      }
    } catch (_) {}

    // Notes créées ou mises à jour
    const notes = (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function')
      ? StorageManager.getNotes()
      : [];
    const dayNotes = notes.filter(n => {
      const c = (n.createdAt && n.createdAt.slice(0, 10) === todayStr);
      const u = (n.updatedAt && n.updatedAt.slice(0, 10) === todayStr);
      return c || u;
    });

    // Trier les notes de la plus récente à la plus ancienne
    dayNotes.sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt || '';
      const dateB = b.updatedAt || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const formattedNotes = dayNotes.map(n => {
      const p = n.projectId ? projectMap.get(n.projectId) : null;
      const cleanText = (n.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const snippet = cleanText.length > 95 ? cleanText.slice(0, 95) + '...' : (cleanText || 'Note sans texte');
      const wasCreatedToday = (n.createdAt && n.createdAt.slice(0, 10) === todayStr);
      const timeStr = n.updatedAt ? n.updatedAt.slice(11, 16) : (n.createdAt ? n.createdAt.slice(11, 16) : '');
      return {
        id: n.id,
        title: n.title || 'Note sans titre',
        folder: n.folder || 'Général',
        snippet,
        wasCreatedToday,
        timeStr,
        project: p || null
      };
    });

    return {
      date: todayStr,
      mode: 'daily',
      completedTasks,
      byProject: Array.from(byProject.values()),
      events: formattedEvents,
      eventsCount: dayEvents.length,
      focusCount,
      notes: formattedNotes,
      notesCount: dayNotes.length
    };
  },

  /**
   * Collecte les accomplissements de la semaine selon la plage configurée.
   */
  getWeeklyAccomplishments(settings = null) {
    if (!settings && typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function') {
      settings = StorageManager.getSettings();
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Dim, 1 = Lun ... 6 = Sam
    const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const rangeSetting = (settings && settings.debriefWeekendRange) || 'mon-fri';
    let daysToAdd = 4; // Lundi + 4 = Vendredi
    if (rangeSetting === 'mon-sat') daysToAdd = 5;
    if (rangeSetting === 'mon-sun') daysToAdd = 6;

    const endDate = new Date(monday);
    endDate.setDate(monday.getDate() + daysToAdd);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = monday.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const tasks = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTasks === 'function')
      ? StorageManager.getTasks()
      : [];

    const trashItems = (typeof StorageManager !== 'undefined' && typeof StorageManager.getTrash === 'function')
      ? StorageManager.getTrash()
      : [];
    const trashTaskIds = new Set(trashItems.filter(item => item && item.type === 'task').map(item => item.originalId || item.id));

    const completedTasks = [];
    const walk = (t) => {
      if (!t) return;
      if (t.completed && !trashTaskIds.has(t.id)) {
        const compDate = t.completedAt ? t.completedAt.slice(0, 10) : (t.plannedDate || null);
        if (compDate && compDate >= startDateStr && compDate <= endDateStr) {
          completedTasks.push(t);
        }
      }
      if (Array.isArray(t.subtasks)) {
        t.subtasks.forEach(walk);
      }
    };
    tasks.forEach(walk);

    // Regrouper par projet
    const projects = (typeof StorageManager !== 'undefined' && typeof StorageManager.getProjects === 'function')
      ? StorageManager.getProjects()
      : [];
    const projectMap = new Map();
    projects.forEach(p => { if (p && p.id) projectMap.set(p.id, p); });

    const byProject = new Map();
    completedTasks.forEach(t => {
      const pId = t.projectId || 'personal';
      if (!byProject.has(pId)) {
        const proj = projectMap.get(pId) || { id: 'personal', title: 'Tâches personnelles', color: '#8b5cf6' };
        byProject.set(pId, { project: proj, tasks: [] });
      }
      byProject.get(pId).tasks.push(t);
    });

    // Créneaux de la semaine
    const allEvents = (typeof StorageManager !== 'undefined' && typeof StorageManager.getEvents === 'function')
      ? StorageManager.getEvents()
      : [];
    const weekEvents = allEvents.filter(e => {
      const startD = e.start ? e.start.slice(0, 10) : '';
      return (startD && startD >= startDateStr && startD <= endDateStr);
    });

    const formattedWeekEvents = weekEvents.map(e => {
      const p = e.projectId ? projectMap.get(e.projectId) : null;
      let timeLabel = e.isAllDay ? 'Journée entière' : (e.start && e.start.includes('T') ? e.start.split('T')[1].slice(0, 5) : 'Créneau');
      return {
        id: e.id,
        title: e.title || 'Créneau sans titre',
        isAllDay: !!e.isAllDay,
        timeLabel,
        durationStr: '',
        project: p || null,
        color: (p && p.color) || e.color || '#38bdf8'
      };
    });

    // Notes créées ou mises à jour
    const notes = (typeof StorageManager !== 'undefined' && typeof StorageManager.getNotes === 'function')
      ? StorageManager.getNotes()
      : [];
    const weekNotes = notes.filter(n => {
      const c = n.createdAt && n.createdAt.slice(0, 10);
      const u = n.updatedAt && n.updatedAt.slice(0, 10);
      return (c && c >= startDateStr && c <= endDateStr) || (u && u >= startDateStr && u <= endDateStr);
    });

    const formattedWeekNotes = weekNotes.map(n => {
      const p = n.projectId ? projectMap.get(n.projectId) : null;
      const cleanText = (n.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const snippet = cleanText.length > 95 ? cleanText.slice(0, 95) + '...' : (cleanText || 'Note sans texte');
      return {
        id: n.id,
        title: n.title || 'Note sans titre',
        folder: n.folder || 'Général',
        snippet,
        wasCreatedToday: false,
        timeStr: '',
        project: p || null
      };
    });

    // Consolidation des statistiques hebdomadaires
    const distinctActiveProjectIds = new Set();
    completedTasks.forEach(t => { if (t.projectId) distinctActiveProjectIds.add(t.projectId); });
    weekEvents.forEach(e => { if (e.projectId) distinctActiveProjectIds.add(e.projectId); });
    weekNotes.forEach(n => { if (n.projectId) distinctActiveProjectIds.add(n.projectId); });

    const effortByProject = Array.from(byProject.values()).map(group => {
      const p = group.project;
      const count = group.tasks.length;
      const percent = completedTasks.length > 0 ? Math.round((count / completedTasks.length) * 100) : 0;
      return {
        id: p.id,
        title: p.title,
        color: p.color || '#3b82f6',
        count,
        percent
      };
    }).sort((a, b) => b.count - a.count);

    const weeklyStats = {
      completedTasksCount: completedTasks.length,
      eventsHonoredCount: weekEvents.length,
      activeProjectsCount: distinctActiveProjectIds.size,
      effortDistribution: effortByProject
    };

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      rangeSetting,
      mode: 'weekly',
      stats: weeklyStats,
      completedTasks,
      byProject: Array.from(byProject.values()),
      events: formattedWeekEvents,
      eventsCount: weekEvents.length,
      focusCount: 0,
      notes: formattedWeekNotes,
      notesCount: weekNotes.length
    };
  },

  /**
   * Sélectionne une phrase bienveillante selon le contexte.
   */
  getRandomDebriefPhrase(mode, hasAccomplishments) {
    if (!hasAccomplishments) {
      const idx = Math.floor(Math.random() * this.CALM_PHRASES.length);
      return this.CALM_PHRASES[idx];
    }
    const list = (mode === 'weekly') ? this.WEEKLY_PHRASES : this.DAILY_PHRASES;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  },

  /**
   * Échappement HTML sécurisé.
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Rendu visuel principal de l'écran #screen-debrief.
   */
  render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('debrief-content-area');
    if (!container) return;

    // S'assurer que les boutons sont attachés
    this.bindEvents();

    const settings = (typeof StorageManager !== 'undefined' && typeof StorageManager.getSettings === 'function')
      ? StorageManager.getSettings()
      : {};

    const status = this.isDebriefAvailable(settings);
    const mode = (status.mode === 'weekly') ? 'weekly' : 'daily';

    const data = (mode === 'weekly')
      ? this.getWeeklyAccomplishments(settings)
      : this.getDailyAccomplishments();

    const userName = (typeof App !== 'undefined' && typeof App.getUserName === 'function')
      ? App.getUserName()
      : (settings.userName || '');
    const namePart = userName ? ` ${this.escapeHtml(userName)}` : '';

    const heroTitle = document.getElementById('debrief-hero-title');
    const heroPhrase = document.getElementById('debrief-hero-phrase');
    const periodLabel = document.getElementById('debrief-period-label');
    const completeBtnText = document.getElementById('btn-debrief-complete-text');

    const hasAccomplishments = (data.completedTasks.length > 0 || (data.eventsCount && data.eventsCount > 0) || (data.focusCount && data.focusCount > 0) || (data.notesCount && data.notesCount > 0));
    const phrase = this.getRandomDebriefPhrase(mode, hasAccomplishments);

    if (heroTitle) {
      heroTitle.textContent = (mode === 'weekly')
        ? `Beau week-end${namePart} ! Voici le bilan de votre semaine.`
        : `Bonsoir${namePart} ! Voici ce qui a avancé aujourd'hui.`;
    }

    if (heroPhrase) {
      heroPhrase.textContent = phrase;
    }

    if (periodLabel) {
      periodLabel.textContent = (mode === 'weekly')
        ? `Bilan de la semaine (${data.startDate} au ${data.endDate})`
        : `Bilan de fin de journée`;
    }

    if (completeBtnText) {
      completeBtnText.textContent = (mode === 'weekly') ? "Savourer mon week-end" : "Terminer ma journée";
    }

    // Construction du contenu ordonné, élégant et approfondi
    let html = '';

    // Bannière récapitulative consolidée pour le bilan hebdomadaire du week-end
    if (mode === 'weekly' && data.stats) {
      let effortHtml = '';
      if (data.stats.effortDistribution && data.stats.effortDistribution.length > 0) {
        effortHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
            ${data.stats.effortDistribution.slice(0, 3).map(item => `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.73rem;">
                <span style="display: inline-flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${item.color}; flex-shrink: 0;"></span>
                  <span style="color: var(--text-main); font-weight: 500;">${this.escapeHtml(item.title)}</span>
                </span>
                <span style="color: var(--text-muted); font-weight: 600;">${item.percent}%</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        effortHtml = `<div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">Rythme équilibré</div>`;
      }

      html += `
        <div class="debrief-weekly-stats-banner" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 22px;">
          <div class="debrief-stat-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Tâches accomplies</span>
            </div>
            <div style="font-size: 1.55rem; font-weight: 700; color: var(--text-main); margin-top: 4px;">
              ${data.stats.completedTasksCount}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
              ${data.stats.completedTasksCount > 0 ? 'Objectifs franchis avec succès' : 'Semaine de repos et réflexion'}
            </div>
          </div>

          <div class="debrief-stat-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Temps & créneaux</span>
            </div>
            <div style="font-size: 1.55rem; font-weight: 700; color: var(--text-main); margin-top: 4px;">
              ${data.stats.eventsHonoredCount}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
              ${data.stats.eventsHonoredCount > 0 ? 'Moments clés honorés' : 'Emploi du temps aéré'}
            </div>
          </div>

          <div class="debrief-stat-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Projets en mouvement</span>
            </div>
            <div style="font-size: 1.55rem; font-weight: 700; color: var(--text-main); margin-top: 4px;">
              ${data.stats.activeProjectsCount}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
              ${data.stats.activeProjectsCount > 0 ? 'Dossiers ayant progressé' : 'Focus sur l’essentiel'}
            </div>
          </div>

          <div class="debrief-stat-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10h-10z"/></svg>
              <span>Répartition de l’effort</span>
            </div>
            ${effortHtml}
          </div>
        </div>
      `;
    }

    const hasTasks = data.completedTasks.length > 0;
    const hasEvents = (data.events && data.events.length > 0) || (data.eventsCount > 0);
    const hasNotes = (data.notes && data.notes.length > 0) || (data.notesCount > 0);
    const hasFocus = (data.focusCount > 0);

    // 1. SECTION ACCOMPLISSEMENTS & TÂCHES MENÉES À BIEN
    if (hasTasks) {
      html += `
        <div class="debrief-section-header">
          <h3 class="debrief-section-title">
            <svg class="app-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#10b981;"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Ce qui a avancé avec succès</span>
          </h3>
          <span class="badge badge-accent" style="font-weight:600;">${data.completedTasks.length} accomplissement${data.completedTasks.length > 1 ? 's' : ''}</span>
        </div>
        <div class="debrief-projects-grid">
      `;

      data.byProject.forEach(group => {
        const p = group.project;
        const color = p.color || '#3b82f6';
        html += `
          <div class="debrief-project-card" style="border-left: 4px solid ${color};">
            <div class="debrief-project-header">
              <span class="debrief-project-dot" style="background-color: ${color};"></span>
              <strong class="debrief-project-title">${this.escapeHtml(p.title)}</strong>
              <span class="debrief-count-pill">${group.tasks.length} tâche${group.tasks.length > 1 ? 's' : ''}</span>
            </div>
            <div class="debrief-tasks-list">
        `;

        group.tasks.forEach(t => {
          html += `
            <div class="debrief-task-row">
              <span class="debrief-task-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span class="debrief-task-label">${this.escapeHtml(t.title)}</span>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // 2. SECTION TEMPS DÉDIÉ À LA CRÉATIVITÉ (Créneaux d'agenda & Sessions Focus)
    if (hasEvents || hasFocus) {
      const evtsList = data.events || [];
      const evtsCount = evtsList.length || data.eventsCount || 0;
      html += `
        <div class="debrief-section-header" style="margin-top: ${hasTasks ? '14px' : '4px'};">
          <h3 class="debrief-section-title">
            <svg class="app-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Temps dédié à la créativité</span>
          </h3>
          <span class="badge badge-accent" style="font-weight:600;">${evtsCount} créneau${evtsCount > 1 ? 's' : ''} honoré${evtsCount > 1 ? 's' : ''}</span>
        </div>
        <div class="debrief-agenda-card">
      `;

      if (evtsList.length > 0) {
        html += `<div class="debrief-agenda-list">`;
        evtsList.forEach(evt => {
          const projBadge = evt.project
            ? `<span class="badge" style="font-size:0.7rem; padding:1px 7px; border-radius:var(--radius-pill); border:1px solid ${evt.color}50; color:${evt.color}; background-color:${evt.color}15; font-weight:600;"><span style="display:inline-block; width:5px; height:5px; border-radius:50%; background-color:${evt.color}; margin-right:4px;"></span>${this.escapeHtml(evt.project.title)}</span>`
            : '';
          const durBadge = evt.durationStr
            ? `<span style="font-size:0.75rem; color:var(--text-dim); font-weight:500;">(${evt.durationStr})</span>`
            : '';

          html += `
            <div class="debrief-agenda-row">
              <div class="debrief-agenda-row-left">
                <span class="debrief-agenda-time">
                  ${evt.isAllDay ? '<svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>' : '<svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
                  ${this.escapeHtml(evt.timeLabel)}
                </span>
                <span class="debrief-agenda-title">${this.escapeHtml(evt.title)}</span>
              </div>
              <div class="debrief-agenda-row-right">
                ${projBadge}
                ${durBadge}
                <span class="debrief-agenda-honored-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Honoré</span>
                </span>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      } else if (evtsCount > 0) {
        html += `
          <div style="font-size:0.86rem; color:var(--text-dim); padding:6px 0;">
            ${evtsCount} créneau${evtsCount > 1 ? 's' : ''} de votre agenda ont rythmé cette période.
          </div>
        `;
      }

      if (hasFocus) {
        html += `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: space-between; font-size: 0.84rem; color: var(--text-dim); flex-wrap: wrap; gap: 8px;">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <svg class="app-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <span>Sessions de travail profond Focus menées :</span>
            </div>
            <strong style="color:var(--text-main);">${data.focusCount} session${data.focusCount > 1 ? 's' : ''} validée${data.focusCount > 1 ? 's' : ''}</strong>
          </div>
        `;
      }

      html += `</div>`;
    }

    // 3. SECTION PENSÉES, ÉCRITS & NOTES DU JOUR
    if (hasNotes) {
      const notesList = data.notes || [];
      const notesCount = notesList.length || data.notesCount || 0;
      html += `
        <div class="debrief-section-header" style="margin-top: ${(hasTasks || hasEvents || hasFocus) ? '14px' : '4px'};">
          <h3 class="debrief-section-title">
            <svg class="app-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#a855f7;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Pensées, Écrits &amp; Notes</span>
          </h3>
          <span class="badge" style="background: rgba(168, 85, 247, 0.12); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); font-weight:600;">${notesCount} note${notesCount > 1 ? 's' : ''}</span>
        </div>
        <div class="debrief-notes-grid">
      `;

      if (notesList.length > 0) {
        notesList.forEach(note => {
          html += `
            <div class="debrief-note-card" onclick="if(window.App &amp;&amp; window.NotesManager){ window.App.navigate('notes'); window.NotesManager.selectNote('${note.id}'); }" title="Cliquer pour ouvrir cette note dans l'éditeur">
              <div class="debrief-note-header">
                <span class="debrief-note-folder-badge">
                  <svg class="app-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>${this.escapeHtml(note.folder)}</span>
                </span>
                <span style="font-size:0.72rem; color:var(--text-muted);">${note.timeStr || ''}</span>
              </div>
              <h4 class="debrief-note-title">${this.escapeHtml(note.title)}</h4>
              <p class="debrief-note-snippet">${this.escapeHtml(note.snippet)}</p>
              <div class="debrief-note-footer">
                <span>${note.wasCreatedToday ? '✨ Rédigée aujourd\'hui' : '✏️ Enrichie aujourd\'hui'}</span>
                <span style="color:var(--accent); font-weight:500;">Consulter ➔</span>
              </div>
            </div>
          `;
        });
      } else {
        html += `
          <div class="debrief-note-card" style="grid-column: 1 / -1;">
            <p style="margin:0; font-size:0.86rem; color:var(--text-dim);">
              <strong>${notesCount}</strong> note${notesCount > 1 ? 's' : ''} ont été rédigées ou enrichies durant cette période.
            </p>
          </div>
        `;
      }

      html += `</div>`;
    }

    // 4. SI AUCUNE ACTIVITÉ DU TOUT : CARTE ZEN
    if (!hasTasks && !hasEvents && !hasNotes && !hasFocus) {
      html = `
        <div class="debrief-zen-card">
          <div class="debrief-zen-icon">
            <svg class="app-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: #10b981;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
          </div>
          <h4 class="debrief-zen-title">Une respiration bienfaisante</h4>
          <p class="debrief-zen-text">Aucun créneau ni tâche programmée n'ont exigé votre énergie aujourd'hui. Ces temps de pause sont essentiels pour préserver votre clarté et préparer vos prochains élans en toute sérénité.</p>
        </div>
      `;
    }

    container.innerHTML = html;
  }
};

// Exposition globale pour l'application navigateur (inline onclick et appels globaux)
if (typeof window !== 'undefined') {
  window.DebriefManager = DebriefManager;
}

// Export pour l'environnement de test Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DebriefManager;
}
