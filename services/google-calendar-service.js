/**
 * Antigravité - Service Google Calendar API (Processus Principal)
 * 
 * Phase 2 : Lecture seule des événements et des calendriers.
 * Phase 4 : Création et modification bidirectionnelle d'événements.
 */

const googleAuth = require('./google-auth-service');

// Table de correspondance des 11 couleurs officielles de Google Calendar
const GOOGLE_COLORS = {
  '1': '#7986cb',  // Lavande
  '2': '#33b679',  // Sauge
  '3': '#8e24aa',  // Raisin
  '4': '#e67c73',  // Flamant
  '5': '#f6bf26',  // Banane
  '6': '#f4511e',  // Mandarine
  '7': '#039be5',  // Paon
  '8': '#616161',  // Graphite
  '9': '#3f51b5',  // Myrtille
  '10': '#0b8043', // Basilic
  '11': '#d50000'  // Tomate
};

class GoogleCalendarService {
  _timeoutSignal(ms = 15000) {
    return (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.timeout(ms)
      : undefined;
  }

  /**
   * Récupère les événements du calendrier sélectionné (Lecture Seule)
   * Gère la pagination nextPageToken, le conflit orderBy+syncToken (HTTP 400),
   * et un rafraîchissement complet glissant tous les 7 jours sur 180 jours pour conserver les récurrences.
   */
  async fetchEvents(options = {}) {
    const FULL_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
    const accessToken = await googleAuth.getValidAccessToken();
    const status = googleAuth.getStatus();
    const calendarId = options.calendarId || status.selectedCalendarId || 'primary';

    const lastFullAt = googleAuth.authCache && googleAuth.authCache.lastFullRefreshAt
      ? Date.parse(googleAuth.authCache.lastFullRefreshAt)
      : NaN;
    const needsRollingRefresh = !!(options.useSyncToken && (
      !Number.isFinite(lastFullAt) || (Date.now() - lastFullAt >= FULL_REFRESH_INTERVAL_MS)
    ));
    const hasSyncToken = !!(options.useSyncToken && !needsRollingRefresh && googleAuth.authCache && googleAuth.authCache.syncToken);
    const maxPages = Math.max(1, Math.min(25, Number(options.maxPages) || 20));
    const maxResults = String(options.maxResults || 250);
    const horizonDays = Math.max(90, Number(options.horizonDays) || 180);

    const buildRequestUrl = (pageToken = null) => {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('maxResults', maxResults);

      if (hasSyncToken) {
        url.searchParams.set('syncToken', googleAuth.authCache.syncToken);
      } else {
        url.searchParams.set('orderBy', 'startTime');
        const now = new Date();
        const defaultMin = new Date(now.getTime() - (30 * 24 * 3600 * 1000)).toISOString();
        const defaultMax = new Date(now.getTime() + (horizonDays * 24 * 3600 * 1000)).toISOString();
        url.searchParams.set('timeMin', options.timeMin || defaultMin);
        url.searchParams.set('timeMax', options.timeMax || defaultMax);
      }

      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }
      return url.toString();
    };

    const items = [];
    let pageToken = null;
    let nextSyncToken = null;
    let pageCount = 0;

    do {
      const res = await fetch(buildRequestUrl(pageToken), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: this._timeoutSignal()
      });

      // HTTP 410 (Gone) ou HTTP 400 avec syncToken (ex: orderBy incompatible) : reset et synchro complète
      if (hasSyncToken && (res.status === 410 || res.status === 400) && !options._retriedFullSync) {
        console.warn(`SyncToken invalide/expiré côté Google (${res.status}). Relance d'une synchronisation complète...`);
        if (googleAuth.authCache) googleAuth.authCache.syncToken = null;
        return this.fetchEvents({ ...options, useSyncToken: false, _retriedFullSync: true });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erreur récupération événements Google (${res.status}) : ${errText}`);
      }

      const json = await res.json();
      if (Array.isArray(json.items)) {
        items.push(...json.items);
      }
      if (json.nextSyncToken) {
        nextSyncToken = json.nextSyncToken;
      }
      pageToken = json.nextPageToken || null;
      pageCount++;
    } while (pageToken && pageCount < maxPages);

    // Ne persister syncToken / lastSyncAt / lastFullRefreshAt que lors d'une vraie synchronisation
    if (options.persistSyncState !== false && googleAuth.authCache) {
      if (nextSyncToken) {
        googleAuth.authCache.syncToken = nextSyncToken;
      }
      const nowIso = new Date().toISOString();
      googleAuth.authCache.lastSyncAt = nowIso;
      if (!hasSyncToken) {
        googleAuth.authCache.lastFullRefreshAt = nowIso;
      }
      await googleAuth.saveAuthData();
    }

    // Convertir chaque événement Google vers le modèle unifié d'Antigravité
    const events = items.map(item => this.mapGoogleEventToAntigravite(item, calendarId));

    return {
      success: true,
      calendarId,
      totalCount: events.length,
      isIncremental: hasSyncToken,
      isRollingRefresh: needsRollingRefresh,
      nextSyncToken: nextSyncToken || null,
      fetchedAt: googleAuth.authCache ? googleAuth.authCache.lastSyncAt : new Date().toISOString(),
      events
    };
  }

  // =========================================================================
  // CRÉATION D'ÉVÉNEMENT DANS GOOGLE AGENDA (PHASE 4)
  // =========================================================================

  async createEvent(eventData) {
    const accessToken = await googleAuth.getValidAccessToken();
    const status = googleAuth.getStatus();
    const calendarId = eventData.calendarId || status.selectedCalendarId || 'primary';

    const payload = this.buildGooglePayload(eventData);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: this._timeoutSignal()
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Échec création Google Agenda (${res.status}) : ${errText}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const mapped = this.mapGoogleEventToAntigravite(json, calendarId);
    // Conserver la liaison locale avec la tâche, la note et le projet si spécifiés
    mapped.taskId = eventData.taskId || null;
    mapped.noteId = eventData.noteId || null;
    if (eventData.projectId !== undefined) mapped.projectId = eventData.projectId || null;
    return mapped;
  }

  // =========================================================================
  // MODIFICATION D'ÉVÉNEMENT DANS GOOGLE AGENDA (PHASE 4)
  // =========================================================================

  async updateEvent(googleId, updatedData, calendarId = null, expectedEtag = null) {
    if (!googleId) {
      throw new Error("Identifiant Google Calendar (googleId) requis pour la mise à jour.");
    }

    const accessToken = await googleAuth.getValidAccessToken();
    const status = googleAuth.getStatus();
    const targetCalendarId = calendarId || status.selectedCalendarId || 'primary';

    const payload = this.buildGooglePayload(updatedData);

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    if (expectedEtag) {
      headers['If-Match'] = expectedEtag;
    }

    // Utilisation de PATCH pour mettre à jour sans écraser les données distantes non gérées
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(googleId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
      signal: this._timeoutSignal()
    });

    if (res.status === 412) {
      const conflictErr = new Error("[CONFLICT] Conflit de modification : l'événement a été modifié directement sur Google Agenda.");
      conflictErr.code = 'CONFLICT';
      conflictErr.status = 412;
      throw conflictErr;
    }

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Échec mise à jour Google Agenda (${res.status}) : ${errText}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const mapped = this.mapGoogleEventToAntigravite(json, targetCalendarId);
    mapped.taskId = updatedData.taskId !== undefined ? updatedData.taskId : (json.taskId || null);
    mapped.noteId = updatedData.noteId !== undefined ? updatedData.noteId : (json.noteId || null);
    if (updatedData.projectId !== undefined) mapped.projectId = updatedData.projectId || null;
    return mapped;
  }

  // =========================================================================
  // SUPPRESSION D'ÉVÉNEMENT DANS GOOGLE AGENDA (PHASE 5)
  // =========================================================================

  async deleteEvent(googleId, calendarId = null) {
    if (!googleId) {
      throw new Error("Identifiant Google Calendar (googleId) requis pour la suppression.");
    }

    const accessToken = await googleAuth.getValidAccessToken();
    const status = googleAuth.getStatus();
    const targetCalendarId = calendarId || status.selectedCalendarId || 'primary';

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(googleId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: this._timeoutSignal()
    });

    // 204 No Content = suppression confirmée par Google
    // 200 OK = confirmé
    if (res.status === 204 || res.status === 200) {
      return { success: true, googleId };
    }
    // 404 Not Found / 410 Gone = déjà supprimé sur Google, succès local équivalent
    if (res.status === 404 || res.status === 410) {
      return { success: true, googleId, alreadyDeleted: true };
    }

    const errText = await res.text();
    const err = new Error(`Échec suppression Google Agenda (${res.status}) : ${errText}`);
    err.status = res.status;
    throw err;
  }

  /**
   * Ajoute ou soustrait des jours à une date au format YYYY-MM-DD
   * en utilisant l'arithmétique UTC calendaire pour éviter tout décalage horaire ou DST.
   */
  addDaysToIsoDate(dateStr, days) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const parts = dateStr.slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    const pad = n => String(n).padStart(2, '0');
    return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
  }

  /**
   * Construit le corps JSON pour l'API Google Calendar v3
   */
  buildGooglePayload(data) {
    const titleTrimmed = data.title && typeof data.title === 'string' ? data.title.trim() : '';
    const payload = {
      summary: titleTrimmed || '(Sans titre)',
      description: data.description || '',
      location: data.location || ''
    };

    if (data.isAllDay) {
      // Événement en journée entière : start.date et end.date (exclue = +1 jour par rapport au dernier jour inclus)
      const startDateStr = data.start ? data.start.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const rawEndStr = data.end ? data.end.slice(0, 10) : startDateStr;
      const inclusiveEndStr = rawEndStr >= startDateStr ? rawEndStr : startDateStr;
      const exclusiveEndDateStr = this.addDaysToIsoDate(inclusiveEndStr, 1);

      payload.start = { date: startDateStr };
      payload.end = { date: exclusiveEndDateStr };
    } else {
      // Créneau horodaté
      const s = new Date(data.start);
      const e = new Date(data.end);

      payload.start = { dateTime: isNaN(s.getTime()) ? new Date().toISOString() : s.toISOString() };
      payload.end = { dateTime: isNaN(e.getTime()) ? new Date(Date.now() + 3600000).toISOString() : e.toISOString() };
    }

    return payload;
  }

  /**
   * Convertit un événement Google Calendar vers le format Antigravité
   */
  mapGoogleEventToAntigravite(gEvt, calendarId) {
    const isAllDay = !!(gEvt.start && gEvt.start.date);
    let startIso = '';
    let endIso = '';

    const pad = n => String(n).padStart(2, '0');

    if (isAllDay) {
      const startDateStr = gEvt.start.date;
      let inclusiveEndDateStr = startDateStr;

      // Google Calendar utilise une borne de fin exclusive (end.date)
      if (gEvt.end && gEvt.end.date && gEvt.end.date > startDateStr) {
        inclusiveEndDateStr = this.addDaysToIsoDate(gEvt.end.date, -1);
        if (inclusiveEndDateStr < startDateStr) {
          inclusiveEndDateStr = startDateStr;
        }
      }

      startIso = `${startDateStr}T08:00`;
      endIso = `${inclusiveEndDateStr}T19:00`;
    } else if (gEvt.start && gEvt.start.dateTime) {
      const s = new Date(gEvt.start.dateTime);
      const e = gEvt.end && gEvt.end.dateTime ? new Date(gEvt.end.dateTime) : new Date(s.getTime() + 3600000);

      startIso = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(s.getHours())}:${pad(s.getMinutes())}`;
      endIso = `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`;
    }

    const eventColor = gEvt.colorId && GOOGLE_COLORS[gEvt.colorId] 
      ? GOOGLE_COLORS[gEvt.colorId] 
      : '#3b82f6';

    return {
      id: `evt-g-${gEvt.id}`,
      googleId: gEvt.id,
      googleCalendarId: calendarId,
      googleEtag: gEvt.etag || null,
      title: gEvt.summary || '(Sans titre)',
      description: gEvt.description || '',
      location: gEvt.location || '',
      start: startIso,
      end: endIso,
      isAllDay,
      color: eventColor,
      source: 'google',
      status: gEvt.status || 'confirmed', // 'confirmed' | 'tentative' | 'cancelled'
      syncStatus: 'synced',
      htmlLink: gEvt.htmlLink || null,
      taskId: null,
      createdAt: gEvt.created || new Date().toISOString(),
      updatedAt: gEvt.updated || new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    };
  }
}

module.exports = new GoogleCalendarService();
