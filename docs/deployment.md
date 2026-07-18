# GitHub-Pages-Deployment

Die Veröffentlichung ist für ein GitHub-Projekt unter
`https://<account>.github.io/<repository>/` vorbereitet. Der Workflow ermittelt
den Repositorynamen automatisch und baut Manifest, Icons, JavaScript und
Service Worker für diesen Unterpfad.

## Einmalige Einrichtung

1. Lege das öffentliche GitHub-Repository an und übertrage den bereinigten
   initialen Stand auf den Branch `main`.
2. Wähle in **Settings → Pages → Build and deployment** als Quelle
   **GitHub Actions**.
3. Aktiviere unter **Settings → Code security** nach Möglichkeit private
   Vulnerability Reports.
4. Prüfe den Lauf **Validate and deploy** im Actions-Tab. Die veröffentlichte
   URL erscheint im Deployment-Schritt und auf der Pages-Einstellungsseite.

Jeder Push auf `main` prüft TypeScript, die Unit-Test-Suite und die Chromium-Suite
unter dem späteren Pages-Unterpfad. Nur ein erfolgreicher Lauf wird
veröffentlicht. Pull Requests führen dieselben Prüfungen aus, veröffentlichen
aber nichts.

## Release-Ablauf

1. Version und Datum in `package.json` und `CHANGELOG.md` aktualisieren.
2. Lokal `npm run typecheck`, `npm test` und `npm run test:e2e` ausführen.
3. Änderungen auf `main` integrieren und das erfolgreiche Pages-Deployment
   öffnen.
4. Installation, Offline-Neustart und JSON-Export mit einem Testdokument kurz
   prüfen.
5. Einen Git-Tag wie `v0.1.0-alpha.1` und ein GitHub Release mit den Notizen aus
   dem Changelog anlegen.

## Anderer Unterpfad oder Domain-Root

Lokal baut `npm run build` für den Domain-Root. Ein Unterpfad wird explizit
gesetzt:

```bash
HEARTHHOLDS_BASE_PATH=/hearthholds/ npm run build
```

Für eine eigene Domain am Root muss der Workflow den Wert
`HEARTHHOLDS_BASE_PATH: /` verwenden. Der Service Worker bleibt auf den jeweils
gebauten Pfad begrenzt. Ein Wechsel der öffentlichen URL sollte vor dem
Friends-&-Family-Test erfolgen, weil Browserdaten an die bisherige Herkunft und
den bisherigen Pfad gebunden sind.
