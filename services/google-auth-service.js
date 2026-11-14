/**
 * Antigravité - Service d'Authentification Google OAuth 2.0 (Processus Principal)
 * 
 * Normes respectées :
 * - RFC 8252 (OAuth 2.0 for Native Apps) : serveur local loopback sur 127.0.0.1
 * - Navigateur par défaut du système via shell.openExternal (Google Disallowed User-Agent compliant)
 * - Chiffrement DPAPI des jetons via Electron safeStorage dans userData/google_auth/
 * - Zéro jeton ni secret exposé au Renderer
 */

const { app, shell, safeStorage } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

class GoogleAuthService {
  constructor() {
    const userDataPath = (app && typeof app.getPath === 'function')
      ? app.getPath('userData')
      : path.join(process.env.APPDATA || process.cwd(), 'Antigravite');

    this.authDir = path.join(userDataPath, 'google_auth');
    this.authFile = path.join(this.authDir, 'auth_data.enc');
    this.authCache = null;
    this.activeServer = null;
  }

  // =========================================================================
  // PERSISTANCE ET CHIFFREMENT DES JETONS (DPAPI)
  // =========================================================================

  async init() {
    await fs.mkdir(this.authDir, { recursive: true });
    await this.loadAuthData();
  }

  async loadAuthData() {
    let buffer = null;
    try {
      buffer = await fs.readFile(this.authFile);
    } catch {
      // Tentative de migration transparente depuis l'autre casse du nom d'application (antigravite vs Antigravite)
      try {
        const altDir = this.authDir.includes('Antigravite')
          ? this.authDir.replace('Antigravite', 'antigravite')
          : this.authDir.replace('antigravite', 'Antigravite');
        const altFile = path.join(altDir, 'auth_data.enc');
        buffer = await fs.readFile(altFile);
      } catch {
        buffer = null;
      }
    }

    if (buffer) {
      try {
        let decryptedStr = '';
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          try {
            decryptedStr = safeStorage.decryptString(buffer);
          } catch {
            decryptedStr = buffer.toString('utf8');
          }
        } else {
          decryptedStr = buffer.toString('utf8');
        }

        this.authCache = JSON.parse(decryptedStr);
        // Si chargé avec succès (notamment depuis le chemin alternatif), sauvegarder dans le chemin courant
        await this.saveAuthData().catch(() => {});
        return this.authCache;
      } catch (err) {
        console.warn('[GoogleAuth] Échec de désérialisation du trousseau chiffré:', err.message);
      }
    }

    this.authCache = {
      clientId: null,
      clientSecret: null,
      tokens: null,
      user: null,
      selectedCalendarId: 'primary',
      selectedCalendarSummary: 'Principal',
      lastSyncAt: null,
      syncToken: null
    };
    return this.authCache;
  }

  async saveAuthData() {
    await fs.mkdir(this.authDir, { recursive: true });
    const rawStr = JSON.stringify(this.authCache, null, 2);

    let outputBuffer;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      outputBuffer = safeStorage.encryptString(rawStr);
    } else {
      outputBuffer = Buffer.from(rawStr, 'utf8');
    }

    await fs.writeFile(this.authFile, outputBuffer);
  }

  // =========================================================================
  // STATUT PUBLIC POUR L'INTERFACE (Zéro secret transmis)
  // =========================================================================

  getStatus() {
    const hasCreds = !!(this.authCache?.clientId && this.authCache?.clientSecret);
    const hasTokens = !!(this.authCache?.tokens?.refresh_token || this.authCache?.tokens?.access_token);

    return {
      hasCredentials: hasCreds,
      clientIdMasked: this.authCache?.clientId ? `${this.authCache.clientId.slice(0, 14)}...` : null,
      isConnected: hasTokens,
      userEmail: this.authCache?.user?.email || null,
      userName: this.authCache?.user?.name || null,
      selectedCalendarId: this.authCache?.selectedCalendarId || 'primary',
      selectedCalendarSummary: this.authCache?.selectedCalendarSummary || 'Principal',
      lastSyncAt: this.authCache?.lastSyncAt || null
    };
  }

  async saveCredentials(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error("L'identifiant Client ID et le Client Secret sont requis.");
    }
    this.authCache.clientId = clientId.trim();
    this.authCache.clientSecret = clientSecret.trim();
    await this.saveAuthData();
    return this.getStatus();
  }

  // =========================================================================
  // FLUX D'AUTHENTIFICATION OAUTH 2.0 (Loopback HTTP Server RFC 8252)
  // =========================================================================

  async startLogin() {
    if (!this.authCache?.clientId || !this.authCache?.clientSecret) {
      throw new Error("Veuillez d'abord renseigner vos identifiants Google Cloud (Client ID et Client Secret).");
    }

    // Si un serveur d'authentification était déjà ouvert, le fermer
    if (this.activeServer) {
      try { this.activeServer.close(); } catch {}
      this.activeServer = null;
    }

    return new Promise((resolve, reject) => {
      // 1. Démarrer un serveur HTTP local temporaire sur 127.0.0.1 avec port automatique
      const server = http.createServer();
      this.activeServer = server;

      const state = crypto.randomBytes(16).toString('hex');
      let timeoutHandle = null;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try { server.close(); } catch {}
        this.activeServer = null;
      };

      // Expiration au bout de 5 minutes
      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error("Délai de connexion Google dépassé (5 minutes)."));
      }, 300000);

      server.on('request', async (req, res) => {
        try {
          const reqUrl = new URL(req.url, `http://${req.headers.host}`);
          if (!reqUrl.pathname.startsWith('/oauth2callback')) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          const code = reqUrl.searchParams.get('code');
          const returnedState = reqUrl.searchParams.get('state');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>Antigravité - Annulation</title></head>
              <body style="font-family: system-ui, -apple-system, sans-serif; background: #0b0f17; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 90vh; margin: 0;">
                <div style="background: #131926; border: 1px solid rgba(255,255,255,0.1); padding: 36px 48px; border-radius: 12px; text-align: center; max-width: 480px;">
                  <h2 style="color: #f43f5e; margin-top: 0;">⚠️ Connexion annulée</h2>
                  <p style="color: #94a3b8; line-height: 1.5;">L'autorisation a été interrompue (${error}). Vous pouvez fermer cet onglet et réessayer depuis Antigravité.</p>
                </div>
              </body>
              </html>
            `);
            cleanup();
            reject(new Error(`Autorisation refusée par Google : ${error}`));
            return;
          }

          if (!code || returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('Paramètres de sécurité invalides.');
            cleanup();
            reject(new Error("Vérification d'état (CSRF) échouée lors du retour Google."));
            return;
          }

          // Afficher la page de confirmation au navigateur
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>Antigravité - Connexion réussie</title></head>
            <body style="font-family: system-ui, -apple-system, sans-serif; background: #0b0f17; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 90vh; margin: 0;">
              <div style="background: #131926; border: 1px solid rgba(255,255,255,0.1); padding: 36px 48px; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 12px 30px rgba(0,0,0,0.5);">
                <div style="font-size: 3rem; margin-bottom: 12px;">✅</div>
                <h2 style="color: #38bdf8; margin: 0 0 10px 0;">Connexion réussie !</h2>
                <p style="color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">Antigravité est désormais connecté à votre compte Google Agenda.</p>
                <div style="font-size: 0.85rem; color: #64748b;">Vous pouvez fermer cet onglet et revenir dans votre application.</div>
              </div>
            </body>
            </html>
          `);

          const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;

          // 2. Échanger le code contre les jetons
          const tokenData = await this.exchangeCodeForTokens(code, redirectUri);
          this.authCache.tokens = tokenData;

          // 3. Récupérer l'identité de l'utilisateur connecté
          const userInfo = await this.fetchUserInfo(tokenData.access_token);
          this.authCache.user = userInfo;
          this.authCache.lastSyncAt = null;

          await this.saveAuthData();
          cleanup();

          resolve(this.getStatus());
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      // Écouter sur un port aléatoire libre de 127.0.0.1
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', this.authCache.clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', state);

        // Ouvrir dans le véritable navigateur de l'utilisateur
        shell.openExternal(authUrl.toString());
      });

      server.on('error', (err) => {
        cleanup();
        reject(new Error(`Impossible de démarrer le serveur local d'authentification : ${err.message}`));
      });
    });
  }

  async exchangeCodeForTokens(code, redirectUri) {
    const params = new URLSearchParams({
      code,
      client_id: this.authCache.clientId,
      client_secret: this.authCache.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erreur échange jetons (${res.status}) : ${errText}`);
    }

    const json = await res.json();
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token || this.authCache?.tokens?.refresh_token,
      expiry_date: Date.now() + (json.expires_in * 1000),
      scope: json.scope,
      token_type: json.token_type
    };
  }

  async fetchUserInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return { email: 'compte-connecte@google.com', name: 'Utilisateur Google' };
    const json = await res.json();
    return {
      id: json.id,
      email: json.email,
      name: json.name,
      picture: json.picture
    };
  }

  // =========================================================================
  // GESTION DU JETON ACTIF & RENOUVELLEMENT AUTOMATIQUE
  // =========================================================================

  async getValidAccessToken() {
    if (!this.authCache?.tokens) {
      throw new Error("Aucun compte Google n'est actuellement connecté.");
    }

    const { tokens } = this.authCache;
    // Si le jeton est valide encore au moins 5 minutes, on le réutilise
    if (tokens.access_token && tokens.expiry_date && (Date.now() < tokens.expiry_date - 300000)) {
      return tokens.access_token;
    }

    // Sinon, on renouvelle avec le refresh_token
    if (!tokens.refresh_token) {
      throw new Error("Jeton expiré et aucun jeton de renouvellement disponible. Veuillez vous reconnecter.");
    }

    const params = new URLSearchParams({
      client_id: this.authCache.clientId,
      client_secret: this.authCache.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Échec du renouvellement de session (${res.status}). Veuillez vous reconnecter : ${errText}`);
    }

    const json = await res.json();
    tokens.access_token = json.access_token;
    tokens.expiry_date = Date.now() + (json.expires_in * 1000);
    if (json.refresh_token) tokens.refresh_token = json.refresh_token;

    await this.saveAuthData();
    return tokens.access_token;
  }

  // =========================================================================
  // DÉCONNEXION & RÉVOCATION
  // =========================================================================

  async disconnect() {
    if (this.authCache?.tokens?.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(this.authCache.tokens.access_token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
      } catch (err) {
        console.warn("Révocation distante échouée :", err.message);
      }
    }

    // Conserver clientId et clientSecret pour simplifier une future reconnexion
    this.authCache.tokens = null;
    this.authCache.user = null;
    this.authCache.syncToken = null;
    this.authCache.lastSyncAt = null;

    await this.saveAuthData();
    return this.getStatus();
  }

  // =========================================================================
  // GESTION DES CALENDRIERS
  // =========================================================================

  async listCalendars() {
    const accessToken = await this.getValidAccessToken();

    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Impossible de lister les calendriers (${res.status}) : ${errText}`);
    }

    const json = await res.json();
    return (json.items || []).map(cal => ({
      id: cal.id,
      summary: cal.summary || '(Sans titre)',
      description: cal.description || '',
      primary: !!cal.primary,
      backgroundColor: cal.backgroundColor || '#3b82f6',
      accessRole: cal.accessRole
    }));
  }

  async selectCalendar(calendarId, calendarSummary = '') {
    this.authCache.selectedCalendarId = calendarId;
    this.authCache.selectedCalendarSummary = calendarSummary || calendarId;
    // Réinitialiser le syncToken car le calendrier cible change
    this.authCache.syncToken = null;
    await this.saveAuthData();
    return this.getStatus();
  }
}

module.exports = new GoogleAuthService();
