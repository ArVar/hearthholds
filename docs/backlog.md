# Produkt- und Technikbacklog

- Stand: 18. Juli 2026
- Entscheidungen des aktuellen Stands: [Entscheidungsprotokoll](entscheidungen.md)
- Fachlicher Gesamtrahmen: [Produkt- und Technikkonzept](produktkonzept.md)

Das Backlog enthält ausschließlich noch nicht umgesetzte Arbeit. `Beschlossen`
bedeutet, dass die Richtung feststeht. `Vorschlag` markiert eine sinnvolle
Option, über deren genaue Ausgestaltung später entschieden wird.

## P0 – Voraussetzung für einen öffentlichen Offline-Pilot

### BL-005 – Offline-, Update- und Browser-Matrix (`Beschlossen`)

Playwright prüft Erstinstallation, erneuten Start ohne Netzwerk, Assets im
Offline-Modus, ein App-Update mit vorhandenen Karten sowie die Migration eines
älteren Dokuments. Die bestehende Chromium-Suite wird um Firefox und WebKit
erweitert. Desktop-, iPad- und iPhone-Viewports prüfen Tastatur, Maus,
Touch-Grundbedienung, Vollbild-Fallback und PWA-Anzeigemodi. Vor dem öffentlichen
Pilot ergänzt ein manueller Smoke-Test auf echtem Safari und iPad die
automatisierte WebKit-Abdeckung.

### BL-007 – Versionierte Templates (`Beschlossen`)

Veröffentlichte Templates erhalten eine unveränderliche Revision. Benutzereigene
Template-Varianten werden davon getrennt gespeichert. Karten referenzieren
`sourceTemplateId` und Quellrevision, enthalten aber weiterhin einen
eigenständigen Snapshot. Nach einem App-Update kann der Benutzer die lokale
Version behalten, eine neue Template-Version öffnen oder eine Kopie erzeugen.

### BL-028 – Automatisierter Asset-Lizenzcheck (`Beschlossen`)

Ein automatisierter Release-Check stellt sicher, dass jede gebündelte Bitmap
einer Lizenzklasse in `LICENSING.md` oder einem dokumentierten Dritthinweis
zugeordnet ist. Nicht freigegebene lokale Referenzgrafiken dürfen nicht in den
Produktions-Build gelangen.

## P1 – Datentransport und Dokumentverwaltung

### BL-008 – Gesamtbackup (`Beschlossen`)

Alle lokalen Karten, benutzereigenen Templates, Einstellungen und später eigene
Assets können gemeinsam exportiert und wiederhergestellt werden. Das Format
enthält eine eigene Backup-Version und ein Inhaltsverzeichnis.

### BL-009 – Dokumentverwaltung (`Vorschlag`)

Lokale Karten und benutzereigene Templates können umbenannt, dupliziert,
archiviert und nach Bestätigung gelöscht werden. Gebündelte Templates bleiben
geschützt. Zuletzt geändert, Herkunft und Template-Revision werden sichtbar.
Jedes Dokument erhält eine passende Reset-Basis: eine leere Karte wird wieder
leer, eine Template-Kopie auf ihre Quellrevision und ein frei angelegtes
Dokument auf seinen eigenen Ausgangsstand zurückgesetzt.

### BL-010 – Eigene Hintergründe und Assets (`Beschlossen`)

Ein Kartenbild kann als gesperrter Hintergrund importiert werden. Eigene Bilder
werden nicht nur als temporäre Objekt-URL referenziert, sondern dauerhaft in
IndexedDB beziehungsweise einem späteren Projektpaket gespeichert. Ein
Projekt-ZIP transportiert JSON und nicht gebündelte Assets gemeinsam.

### BL-011 – Persistenzschnittstelle (`Beschlossen`)

Die heutigen lokalen Persistenzfunktionen werden hinter einer expliziten
`DocumentRepository`-Schnittstelle zusammengefasst. IndexedDB bleibt die
Standardimplementierung. PWA, optionale Desktop-Verpackung und spätere
Cloud-Synchronisation verwenden dieselbe fachliche Schnittstelle.

## P1 – Fachlicher nächster Ausbau

### BL-012 – Kampagnenstart, Ausgangsstand und Chronik (`Beschlossen`)

Der GM kann einen Ausgangsstand markieren, eine Kampagne beginnen und spätere
administrative beziehungsweise reguläre Änderungen nachvollziehbar
protokollieren. Der Einrichtungsmodus bleibt für Korrekturen erreichbar.

### BL-013 – Bevölkerung, Haushalte und Arbeitsplätze (`Beschlossen`)

Das hybride Bevölkerungsmodell aus benannten Personen, vereinfachten
Haushaltsmitgliedern und Arbeitsgruppen wird umgesetzt. Wohnort, Beruf,
Arbeitsplatz und Projektzuweisung bleiben getrennte Eigenschaften.

### BL-014 – Ressourcenquellen und Zeitfortschritt (`Beschlossen`)

Zykluswechsel führen inzwischen ein nachvollziehbares Journal für Einnahmen
und Löhne. Später sollen einzelne Lieferungen vor dem Zyklusabschluss bestätigt oder
angepasst werden können, ohne daraus eine Echtzeit- oder Produktionssimulation
zu machen. Die Kapazitätsbelegung durch feste Einwohner und Tagelöhner,
arbeitskraftabhängige Produktion sowie die Lohnabrechnung je Zyklus sind bereits
umgesetzt.

### BL-015 – Weitere Projekttypen (`Beschlossen`)

Das Projektmodell wird auf Reparaturen, Gebäudeausbauten, Mauern, Palisaden,
Straßen, Rodungen, Brunnen und Abriss erweitert. Längen- und flächenabhängige
Kosten werden aus der fachlichen Geometrie abgeleitet.

### BL-016 – Regelwerkprofile und D&D-SRD (`Beschlossen`)

Systemneutrale und D&D-5e-Profile liefern Baupläne, Fähigkeiten, Berufe und den
freigegebenen Itemkatalog aus SRD 5.1 mit korrekter Attribution. WFRP und
benutzerdefinierte Profile folgen später.

### BL-017 – Präsentation auf zweitem Bildschirm (`Beschlossen`)

Ein separates Präsentationsfenster zeigt nur öffentliche Ebenen und reagiert auf
Änderungen der GM-Ansicht. Geheime Notizen und administrative Elemente dürfen
nicht übertragen werden.

## P1 – Aufbau-orientierte Bedienung

### BL-018 – Baumenü mit Kosten- und Verfügbarkeitsvorschau (`Vorschlag`)

Der wachsende Objektkatalog erhält einen kompakten, nach Baukategorien
gegliederten Baubereich. Ein Eintrag zeigt Vorschaubild, Baukosten,
Voraussetzungen und Verfügbarkeit, bevor ein Objekt auf der Karte platziert
wird. Favoriten und zuletzt verwendete Objekte werden erst ergänzt, wenn der
Katalog groß genug ist, dass sie nachweislich Zeit sparen.

### BL-020 – Kontextuelle Projektübersicht (`Vorschlag`)

Aktive, blockierte und abschließbare Projekte werden als kompakte Statusgruppe
erreichbar. Die Detailansicht erscheint ebenfalls rechts und teilt sich den
Platz mit Inspektor, Raster- und Anwendungseinstellungen.

## P2 – Optionale gehostete und native Ausbaustufen

### BL-021 – Betriebsmodell für gehostete Nutzung (`Vorschlag`)

Die erste gehostete Fassung kann eine statische Local-first-PWA ohne Konten
bleiben. Vor einem Backend wird entschieden, ob tatsächlich Gerätewechsel,
Serverbackup, Teilen oder gleichzeitige Zusammenarbeit benötigt werden.

### BL-022 – Konten und serverseitige Backups (`Vorschlag`)

Nur bei entsprechendem Produktbedarf werden Authentifizierung, Mandantentrennung,
serverseitige Dokumentablage, Datenschutzkonzept und Löschprozesse ergänzt.
Offline erstellte Karten bleiben dabei vollständig nutzbar.

### BL-023 – Offline-Synchronisation (`Vorschlag`)

Eine spätere Synchronisation arbeitet revisionsbasiert und erkennt Konflikte,
statt lokale Dokumente still nach dem Prinzip `last write wins` zu ersetzen.
Der genaue Konfliktdialog wird erst mit dem Kollaborationsmodell festgelegt.

### BL-024 – Tauri-Desktop-App (`Vorschlag`)

Nach der PWA kann Tauri 2 native Dateidialoge, Projektdateien und ein separates
Präsentationsfenster bereitstellen. Die Desktop-Verpackung ist keine
Voraussetzung für den ersten Offline-Pilot.

### BL-025 – Dynamisches Licht und Renderer-Meilenstein (`Vorschlag`)

Lichtquellen, Sichtlinien und schattenwerfende Hindernisse werden als fachliche
Kartendaten modelliert. Erst für diesen Meilenstein wird ein Wechsel des
Produktionsrenderers von Konva zu PixiJS/WebGL geprüft; WebGPU bleibt optional.

### BL-026 – Quellenkarten als Anschläge (`Vorschlag`)

Die eigenständige Ansicht für externe Quellen kann später wie ein hölzernes
Anschlagbrett gestaltet werden. Die Quellenkarten wirken dann wie angeheftete
Infotafeln oder Aufträge, behalten aber ihre heutige konfigurierbare Datenstruktur
und gute Lesbarkeit in hellem wie dunklem Farbschema. Diese Darstellung ist eine
bewusst gespeicherte Idee und noch nicht beschlossen.

### BL-027 – Verschachtelte Objektgruppen (`Vorschlag`)

Gruppen bleiben zunächst bewusst flach und leicht verständlich. Verschachtelte
Gruppen werden erst eingeführt, wenn reale Karten dafür einen nachweisbaren
Bedarf zeigen und die zusätzliche Hierarchie den Szenenbrowser nicht unnötig
verkompliziert.

### BL-029 – Brauerei und Bier-Lieferkette (`Beschlossen`)

Eine spätere Brauerei verarbeitet Getreide, Hopfen, Wasser und Brennstoff im
Tageszyklus zu Bier. Sie nutzt das bestehende Mehrfachausgabe- und
Arbeitskräftemodell, erhält eigene Bau- und Ausbaustufen sowie konfigurierbare
Rezept- und Kapazitätswerte. Lagerung, Ausschank, Qualitätsstufen und mögliche
Nebenprodukte werden erst bei der fachlichen Ausarbeitung festgelegt; der
Bauernhof liefert bereits die beiden landwirtschaftlichen Vorprodukte.

## Nicht terminierte Produktdetails

Konkrete Namen, Startbestände, Liefermengen, Baukosten, WFRP-Inhalte und weitere
Szenariodetails bleiben in
[Abschnitt 14 des Produktkonzepts](produktkonzept.md#14-offene-nicht-blockierende-details)
gesammelt. Sie blockieren die technischen P0-Arbeiten nicht.
