# Code Signing Policy — Antigravité

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Overview

Antigravité is an open-source, local-first personal productivity desktop application for Windows (tasks, projects, calendar, notes, focus sessions, and daily debriefing), licensed under the [MIT License](LICENSE).

To protect Windows users from tampering and Windows Defender SmartScreen warnings, official Windows releases of Antigravité are digitally signed using the **SignPath Foundation** open-source code signing infrastructure.

## Signed Artifacts

Only official release artifacts built transparently from the public GitHub repository (`Clapote/Antigravite`) via GitHub-hosted runners (`.github/workflows/release.yml`) are submitted for signing:

- `Antigravite.exe` — Main Electron application binary
- `Antigravite.Setup.<version>.exe` — NSIS Windows installer package

No local developer builds or third-party binaries are submitted for signing.

## Build Provenance & Security Controls

- **Public CI/CD only:** All signed binaries are compiled directly on GitHub-hosted Windows runners (`windows-latest`) from tagged commits (`v*`) on the `master` branch.
- **Automated Verification:** Every release build runs the complete automated test suite (`npm test` — 37 test suites) before packaging and signing.
- **Zero-Trust Artifact Handoff:** Unsigned binaries are uploaded as GitHub Actions artifacts and retrieved directly by SignPath via the official `signpath/github-action-submit-signing-request` action.
- **Integrity Metadata:** After signing, SHA-512 checksums (`latest.yml`) and `.blockmap` files are regenerated strictly from the signed installer for `electron-updater` verification.

## Team Roles

| Role | GitHub Account | Responsibility |
| :--- | :--- | :--- |
| **Author / Maintainer / Approver** | `@Clapote` (Lucas Peutot) | Code development, release tagging, and signing request approval (protected by 2FA). |

## Privacy Policy

Antigravité is designed around a **100% local-first** architecture:

- **No telemetry, analytics, or tracking:** Antigravité does not collect, log, or transmit usage analytics, crash telemetry, or personal user data to any developer server.
- **Local storage:** All user tasks, projects, calendar events, notes, preferences, and backups are stored locally on the user's Windows device (`%APPDATA%\Antigravite`).
- **Optional Google Calendar integration:** If the user explicitly chooses to connect Google Calendar, authentication is performed using the user's own OAuth client credentials and tokens are stored encrypted locally via Windows DPAPI (`safeStorage`). No third-party relay server is used.
- **Automatic updates:** Antigravité checks public GitHub Releases (`Clapote/Antigravite-releases`) over anonymous HTTPS to verify whether a newer version is available. No personal identifiers or tokens are sent.
- **Build & Signing Infrastructure:** Release builds and code signing are processed via GitHub Actions and SignPath.io in accordance with their respective privacy policies.

---

*Politique de signature (FR) : La signature de code gratuite est fournie par [SignPath.io](https://signpath.io), avec un certificat délivré par la [SignPath Foundation](https://signpath.org). Seuls les binaires officiels compilés automatiquement par GitHub Actions depuis le dépôt public `Clapote/Antigravite` sont signés. Antigravité fonctionne 100 % en local et ne collecte aucune donnée personnelle ni télémétrie.*
