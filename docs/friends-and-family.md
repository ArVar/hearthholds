# Friends & Family: Hearthholds testen

Hearthholds ist eine frühe Desktop-Alpha für Spielleitungen. Deine Daten bleiben
lokal in deinem Browser; es gibt noch keine Konten, Cloud-Synchronisation oder
Zusammenarbeit zwischen mehreren Geräten.

## Öffnen und installieren

1. Öffne die GitHub-Pages-Adresse aus deiner Einladung in einem aktuellen
   Chrome oder Edge. Diese Browser sind derzeit am gründlichsten getestet.
2. Warte beim ersten Start kurz auf den Hinweis, dass Hearthholds offline bereit
   ist.
3. Nutze das Installationsangebot in Hearthholds oder das Installationssymbol in
   der Adressleiste. Danach startet die App wie eine normale Anwendung aus dem
   Startmenü, Dock oder Programme-Ordner.

Auf macOS kann Safari eine Website über **Teilen → Zum Dock hinzufügen** als App
ablegen. Safari ist derzeit jedoch noch nicht Teil der automatisierten
Browserprüfung. Eine npm- oder Node.js-Installation ist für Tester nicht nötig.

## Die ersten Schritte

- Öffne das Herzdorf-Template und wähle **Als Kopie speichern**, bevor du deine
  eigene Siedlung daraus entwickelst.
- Hearthholds speichert Änderungen automatisch im aktuellen Browserprofil.
- Über die Objektpalette und den Inspektor bearbeitest du Gebäude, Gelände,
  Arbeitskräfte und Produktion. Die Ansicht **Ressourcen** verwaltet externe
  Quellen und Lieferungen.
- Exportiere eine wichtige Siedlung regelmäßig über **Siedlung als JSON
  exportieren**. Eine JSON-Datei kannst du später wieder importieren.

## Offline-Nutzung und Updates

Nach dem ersten vollständigen Online-Start ist die gebündelte App offline
nutzbar. Bei einer neuen Version zeigt Hearthholds einen Aktualisierungshinweis
und speichert offene Änderungen, bevor es neu lädt. Ein neues Gerät oder ein
anderes Browserprofil kennt deine bisherigen Siedlungen nicht automatisch.

Das Löschen von Websitedaten, Zurücksetzen des Browserprofils oder Entfernen der
App einschließlich ihrer Daten kann Siedlungen unwiderruflich löschen. Der
JSON-Export ist im Moment die wichtigste Sicherung.

## Feedback und Fehlerberichte

Nutze im GitHub-Repository **Issues → Fehler melden** oder **Feedback oder Idee**.
Hilfreich sind:

- App-Version aus **Einstellungen → Über Hearthholds**;
- Browser und Betriebssystem;
- genaue Schritte bis zum Problem;
- erwartetes und tatsächliches Verhalten.

Issues und Anhänge sind öffentlich. Prüfe Screenshots und exportierte Dateien
auf Namen, Karteninhalte und andere vertrauliche Kampagnendaten. Sicherheitslücken
bitte entsprechend [SECURITY.md](../SECURITY.md) vertraulich melden.

## Bekannte Grenzen der Alpha

- Die Bedienung ist für Desktop, Maus und Tastatur optimiert.
- Chromium ist das primäre automatisierte Browserziel; Firefox und Safari folgen.
- Es gibt keine Cloud-Synchronisation oder Mehrbenutzerfunktion.
- Ein vollständiges Backup aller lokalen Dokumente auf einmal fehlt noch.
