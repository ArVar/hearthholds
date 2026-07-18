# Entscheidungsprotokoll

- Stand: 17. Juli 2026
- Geltungsbereich: aktueller Produkt- und Implementierungsstand
- Detaillierte fachliche Grundlage: [Produkt- und Technikkonzept](produktkonzept.md)
- Noch nicht umgesetzte Entscheidungen und Vorschläge: [Backlog](backlog.md)

Dieses Dokument hält die gemeinsam getroffenen und bereits im aktuellen Stand
abgebildeten Entscheidungen fest. Es beschreibt bewusst keine Wunschfunktionen.
Wenn sich eine Entscheidung ändert, wird sie hier angepasst und die daraus
entstehende Arbeit im Backlog nachgeführt.

## Produkt und Nutzung

### DEC-001 – GM-geführte Siedlungswerkbank

Hearthholds ist eine Siedlungswerkbank und kein vollständiger Wirtschafts-,
Bevölkerungs- oder Echtzeitsimulator. Die Anwendung wird primär von einer
Spielleitung oder einer anderen verantwortlichen Person bedient. Die Gruppe
trifft Entscheidungen gemeinsam, benötigt im ersten Produktstadium aber keine
eigenen Konten und keine gleichzeitige Bearbeitung.

### DEC-002 – Local-first und Autosave

Karten werden automatisch im Browser über IndexedDB und Dexie gespeichert. Ein
klassischer Speichern-Button ist nicht Teil des Bedienmodells; der sichtbare
Status `Speichert …` beziehungsweise `Lokal gespeichert` vermittelt den Zustand.
Die zuletzt aktive Karte wird wieder geöffnet. Lokale Browserdaten sind ein
Arbeitsstand, aber noch kein geräteübergreifendes oder externes Backup.

### DEC-003 – Dokumente, Templates und leere Karten

- Gebündelte JSON-Karten sind Werkseinstellungen und werden nicht aus dem
  Browser heraus verändert.
- Ein Template kann als lokale Version direkt bearbeitet werden. Ein Hinweis
  erklärt die Wirkung und bietet alternativ eine unabhängige Kopie an.
- Kopien und leere Karten besitzen eigene Dokument-IDs und werden sofort lokal
  gespeichert.
- Die Dokumentauswahl lädt alle lokalen Arbeitsdokumente; ein separater
  Laden-Button für lokale Karten ist deshalb nicht erforderlich.
- Das heutige Zurücksetzen verwendet die gebündelte Ausgangskarte als Referenz
  und behält bei Kopien deren Dokument-ID und Namen. Eine dokumenteigene
  Reset-Basis für leere Karten und spätere Template-Revisionen ist noch offen.

### DEC-004 – JSON als portables Dokumentformat

Siedlungen sind vollständige, versionierte und mit Zod validierbare
JSON-Dokumente. Der aktuelle Stand unterstützt den Export einer Karte. Der
ergänzende Import und umfassendere Backups gehören zum Backlog.

## Karte und Bedienung

### DEC-005 – Metrische Karten und Raster

Das metrische System ist verbindlich. Rasterabstand in internen Karteneinheiten
und reale Distanz pro Feld sind getrennt. Raster, Fangfunktion, Hauptlinien und
Maßstab sind konfigurierbar. Rasterfarbe und -transparenz werden mit der Karte
gespeichert. Das Raster kann in Editor und Präsentation ein- beziehungsweise
ausgeblendet werden.

### DEC-006 – Kartengröße mit festem Anker

Kartenbreite und Kartenhöhe sind editierbar. Beim Ändern legt ein 3×3-Anker nach
dem Vorbild von Grafikprogrammen fest, welcher Punkt unverändert bleibt.
Bestehende Objekte, Pfadpunkte, Béziergriffe und Brush-Striche werden passend
versetzt.

### DEC-007 – Begrenzte Zeichnung, freie Bearbeitungsgriffe

Hintergrund, Gelände, Brushes, Wege, Flüsse und Kartenobjekte werden immer am
Kartenrechteck abgeschnitten. Auswahlrahmen, Knoten, Tangenten und sonstige
Bearbeitungsgriffe dürfen außerhalb liegen und bleiben dort bedienbar. Ein
Brush-Strich kann nur innerhalb der Karte begonnen werden.

### DEC-008 – Navigation und Transformation

- `WASD` und Pfeiltasten bewegen das ausgewählte Objekt, andernfalls die Karte.
- Rechte Maustaste oder Trackpad-Gesten verschieben den Kartenausschnitt.
- Rotation erfolgt in 15-Grad-Schritten.
- Grundflächen von Gebäuden und Markern behalten beim Skalieren ihr
  Seitenverhältnis; frei geformte Zonen können unabhängig skaliert werden.
- Wege, Flüsse, Mauern und Palisaden besitzen editierbare Knoten und
  Béziergriffe.

### DEC-009 – Gelände und Wald

Gelände wird mit metrisch skalierten Brushes gezeichnet. Die Walddichte reicht
von 10 Prozent für einzelne Bäume bis 100 Prozent für einen dichten Wald.
Waldzonen und andere Kartenobjekte bleiben nach dem Platzieren editierbar.

## Gebäude und Assets

### DEC-010 – Einheitliche Bauphasen

Alle Gebäude verwenden drei Bauphasen:

1. `Fundament`
2. `Mauerwerk`
3. `Dach & Fertigstellung`

Der Bau- oder Projektstatus bestimmt automatisch das angezeigte Phasenbild.

### DEC-011 – Separate Betriebsstufen für Funktionsgebäude

Ausbaufähige Handwerks- und Funktionsgebäude können zusätzlich die drei
Betriebsstufen `Grundstufe`, `Erweitert` und `Meisterstufe` besitzen. Bauphase
und Betriebsstufe sind getrennte Konzepte. Wohnhäuser verwenden stattdessen
gleichwertige optische Varianten.

### DEC-012 – Datengetriebene Einzelassets

Gebäudeassets bleiben einzelne Dateien pro Gebäudetyp und werden durch ein
`manifest.json` beschrieben. Manifeste definieren Varianten, Betriebsstufen,
Grundrissskalierung und Katalogdaten. Texture Atlases werden nur für viele kleine,
wiederholte Umgebungselemente wie Bäume bevorzugt. Fehlende Bilder erhalten
eine generische Fallback-Darstellung.

### DEC-013 – Skalierbarer Objektkatalog

Der Objektkatalog ist nach fachlichen Kategorien gegliedert, durchsuchbar und
für deutlich mehr Objekte ausgelegt. Gleichartige Geometrien wie Palisade und
Mauer teilen ein Modell, bleiben aber unterschiedliche Darstellungen.
Thumbnails unterstützen die schnelle visuelle Auswahl.

## Oberfläche und Technik

### DEC-014 – Englischer Code, lokalisierte Oberfläche

Code, Domänenschlüssel und technische Metadaten sind Englisch. Sichtbare Texte
laufen über typisierte Übersetzungsschlüssel. Deutsch und Englisch sind
vorhanden; frei eingegebene Namen und Notizen werden nicht automatisch
übersetzt.

### DEC-015 – Helles und dunkles Farbschema

Es gibt ausschließlich ein helles und ein dunkles Farbschema. Beim ersten Start
wählt der Browser automatisch anhand der Systemeinstellung. Danach kann der
Benutzer explizit zwischen Hell und Dunkel wechseln; die Auswahl wird lokal
gespeichert.

### DEC-016 – Technischer Kern

- React, TypeScript und Vite bilden die Anwendung.
- Konva ist für Canvas-Darstellung und Interaktion zuständig.
- Zustand und Immer verwalten den Editorzustand und Undo/Redo.
- Domänenlogik und Geometrie bleiben unabhängig vom Renderer.
- Zod validiert persistierte und gebündelte Dokumente.
- Vitest und Playwright sichern Domänenlogik und zentrale Browserabläufe.
- Aktuell verwendete Bitmaps werden in den statischen Produktions-Build
  aufgenommen; die Anwendung besitzt keine externen Asset-Abhängigkeiten zur
  Laufzeit.

### DEC-017 – Kompatibilität während der frühen Entwicklung

Rückwärtskompatibilität darf in der frühen Entwicklungsphase zugunsten eines
schlankeren Modells aufgegeben werden. Gespeicherte Karten werden trotzdem nicht
mehr pauschal durch IndexedDB-Upgrades gelöscht. Vor einem öffentlichen Einsatz
sind getestete Dokumentmigrationen verpflichtend. Mit Schema 11 ist dieser
Migrationspfad erstmals umgesetzt; weitere Schemawechsel folgen demselben
Muster.

### DEC-018 – Aufbau-orientierte Informationshierarchie

Die Hauptansicht orientiert sich an der bewährten Informationshierarchie von
Aufbauspielen, ohne deren Wirtschaftssimulation zu übernehmen:

- Einwohner und verfügbare Ressourcen stehen dauerhaft in der oberen Leiste.
- Diese Statusleiste bleibt auch im Präsentationsmodus sichtbar.
- Inspektor, Rasteroptionen und Anwendungseinstellungen verwenden einheitlich
  denselben rechten Seitenbereich.
- Jede Funktion besitzt nur einen eindeutigen Einstieg; insbesondere gibt es im
  Editor keinen zweiten Raster-Schalter auf der Karte.
- Kartenbezogene Darstellungswerte wie Rasterfarbe und -transparenz gehören in
  das Rastermenü, allgemeine Sprache und Darstellung in das Einstellungsmenü.

### DEC-019 – Tore als eigenständige Befestigungsobjekte

Tore sind frei platzierbare Infrastruktur-Objekte in der Katalogkategorie
`Befestigungen`. Sie werden unabhängig von Palisaden und Mauern ausgewählt,
verschoben, gedreht und in ihrer Breite bearbeitet. Holz- und Steintor sowie
Haupt- und Nebentor sind Darstellungsvarianten desselben fachlichen Objekts.
Beim Laden werden ältere, in einer Palisade verschachtelte Tore automatisch in
globale Kartenkoordinaten überführt.

### DEC-020 – Tageszyklus und externe Quellenkarten

Ressourcenerzeugung und Baufortschritt verwenden einen bewusst vom GM
ausgelösten Tageswechsel. Externe Quellen erzeugen pro Tag eine konfigurierbare
Menge, begrenzt durch ihre Transportkapazität. Eine Bauphase benötigt mindestens
einen Tageswechsel; bei Fehlmengen bestimmt die langsamste benötigte Ressource
die Dauer. Quellen ohne mögliche Versorgung blockieren die Phase.

Die obere Ressourcenleiste zeigt Bestand, Reservierung, Erzeugung und geplanten
Verbrauch in einem kompakten Hover-Fenster. Ein Klick öffnet eine eigenständige
Ressourcenansicht. Eine Ressource erscheint dort nur, wenn sie einen Bestand,
eine Reservierung oder eine aktuell vorhandene Produktionsquelle besitzt. So
wird beispielsweise Hopfen erst mit dem erweiterten Bauernhof eingeblendet und
bleibt nach einer Produktion sichtbar, solange noch Bestand vorhanden ist.
Landwirtschaftliche Erzeugnisse werden in der Kopfleiste unter
`Landwirtschaft` mit einem eindeutigen Ernte-Artwork gebündelt. Das
Hover-Fenster nennt die aktuell relevanten Erzeugnisse und schlüsselt ihre
Bestände, Reservierungen und Tagesproduktion getrennt auf. Im Datenmodell und
in der Ressourcenansicht bleiben Getreide, Hopfen und spätere Erzeugnisse
eigenständige Ressourcen.
Bergbauerzeugnisse folgen demselben Prinzip: Die Kopfleiste bündelt aktuell
relevante Erze unter `Bergbau`, das Hover-Fenster führt sie jedoch einzeln auf.
Externe Quellen werden als konfigurierbare Karten mit
Artwork, Status, Arbeitskräften, Reisezeit, Ertrag und Transportkapazität
dargestellt. Sie belegen bewusst nicht den schmalen Objektinspektor.

### DEC-021 – Szenenbrowser, Mehrfachauswahl und Sperren

Der linke Seitenbereich dient ausschließlich dem Erzeugen neuer Karteninhalte.
Vorhandene Objekte, Gruppen und Ebenen werden in einem ausklappbaren
Szenenbrowser rechts verwaltet. Damit bleibt die Werkzeugpalette auch bei großen
Karten übersichtlich und alle kontextbezogenen Ansichten teilen denselben Ort.

Objekte können auf der Karte oder im Szenenbrowser additiv ausgewählt, gemeinsam
verschoben und zu benannten Gruppen zusammengefasst werden. Sichtbarkeit und
Sperrstatus werden für Ebenen, Gruppen und einzelne Objekte im Dokument
gespeichert. Eine Sperre oder Ausblendung auf einer übergeordneten Ebene oder
Gruppe gilt geerbt für deren Objekte.

Eine Aufziehauswahl erfasst alle sichtbaren, ungesperrten Objekte, deren
Grundfläche den Auswahlrahmen berührt. Mehrfachauswahlen und Gruppen besitzen
einen gemeinsamen Rahmen zum Verschieben, proportionalen Skalieren und Drehen.
Die Zeichenreihenfolge wird je Ebene dauerhaft gespeichert und im Szenenbrowser
per Drag-and-drop von vorne nach hinten geordnet.

### DEC-022 – Produktname und Markenführung

Der vollständige Produktname lautet **Hearthholds: Living Places**. In der
laufenden Oberfläche und in kurzen Texten wird **Hearthholds** als Markenname
verwendet; **Living Places** ist der feste Untertitel. Das freigegebene
Tavernenschild mit goldenem Schriftzug und silbernem Untertitel ist das
Master-Logo. App-Icon und Favicon verwenden exakt das erste `H` dieses
Master-Schriftzugs auf dunklem Holz mit Eisenbeschlägen. Die dazugehörige
Holztextur darf als wiederkehrendes, sparsam eingesetztes GUI-Motiv dienen.

Die bestehenden technischen Persistenz-Namensräume `pnp-settlement` für
IndexedDB und lokale Einstellungen bleiben vorerst unverändert. Sie sind keine
sichtbare Produktbezeichnung und bewahren vorhandene Karten, Sprache und
Darstellungseinstellungen. Eine spätere Umstellung erfolgt nur mit einer
getesteten Datenmigration.

### DEC-023 – Branding-basiertes Oberflächenthema

Die Oberfläche verwendet ein gemeinsames Hearthholds-Theme für Light und Dark.
Light kombiniert warme Papier- und Pergamentflächen mit dunklem Holz; Dark
verwendet geölte, tiefbraune Arbeitsflächen. Die freigegebene Holztextur
erscheint gezielt in globalen und lokalen Kopfleisten, während metallische
Rahmen die Werkzeugleisten und schwebenden Kartensteuerelemente tragen.

Gold kennzeichnet Navigation, Markenakzente und primäre Aktionen. Teal bleibt
die funktionale Farbe für Kartenauswahl, Status und datenbezogene Interaktion.
Längere Formulare und die eigentliche Karte bleiben ruhig und kontrastreich,
damit die Materialästhetik die Bedienung unterstützt, aber nicht überlagert.

### DEC-024 – Bevölkerung, Arbeitskräfte und Schatzkammer

Einwohner und Arbeitskräfte werden in einer gemeinsamen Anzeige geführt.
`Einwohner` beschreibt die gesamte feste Bevölkerung, `arbeitsfähige Einwohner`
den vom GM konfigurierbaren zuweisbaren Anteil. Gebäude und externe Quellen
besitzen jeweils ein konfigurierbares Minimum und Maximum an Arbeitskräften.
Unterhalb des Minimums ruht der Betrieb; zwischen Minimum und Maximum skaliert
die Tagesproduktion proportional bis zum konfigurierten Höchstertrag.

Zuweisungen verwenden vorrangig feste Einwohner. Zusätzliche Tagelöhner werden
pro Arbeitsplatz oder Bauprojekt erfasst, zählen nicht zur Bevölkerung und
verursachen täglich Lohnkosten. Der Tageswechsel wird blockiert, wenn die
Schatzkammer die Lohnsumme nicht deckt. Funktionsgebäude tragen zugleich ihre
konfigurierbare Wohnkapazität, da Werkstatt und Betreiberhaushalt im gewählten
mittelalterlichen Modell häufig zusammenfallen. Neue Einwohner können nur bei
freier Wohnkapazität und gegen einen konfigurierbaren Anwerbepreis aufgenommen
werden.

Ressourcen verwenden in der Kopfleiste kleine, selbsterklärende Artworks statt
Textlabels. Bestand und Reservierung bleiben direkt sichtbar; Name, Erzeugung,
Verbrauch und weitere Details stehen im Hover-Fenster. Das Dokumentformat wird
dafür auf Schema 11 angehoben. Schema-10-Karten werden beim Laden getestet in
das neue Modell migriert.

### DEC-025 – Vollbild und Präsentationsfläche

Editor und Präsentation bieten einen echten Browser-Vollbildmodus über die
Fullscreen API. Beim Start der Präsentation wird Vollbild unmittelbar aus der
Benutzeraktion angefordert. Falls ein Browser die Anfrage nicht unterstützt
oder ablehnt, bleibt die Präsentation funktionsfähig und zeigt eine erreichbare
Vollbild-Schaltfläche als Fallback.

Die Präsentation reserviert nur eine kompakte 50-Pixel-Kopfleiste für
Siedlungsname, Ressourcen, Raster und Ausstieg. Der übrige Viewport gehört der
Karte; beim Wechsel in die Präsentation und bei jeder Vollbild-Größenänderung
wird sie automatisch neu eingepasst. Wird Präsentationsvollbild automatisch
geöffnet, beendet ein Ausstieg aus der Präsentation auch diesen Vollbildzustand.
Ein zuvor manuell im Editor aktiviertes Vollbild bleibt dagegen bestehen.

Dies ist zugleich die Darstellungsgrundlage für eine spätere installierte PWA.
Manifest, Service Worker und Offline-Update-Strategie bleiben ein eigener
Ausbauschritt.

### DEC-026 – Browser-Baseline und progressive Vollbildunterstützung

Hearthholds zielt in der ersten veröffentlichten Browserfassung auf die moderne
Produktions-Baseline von Vite 8: Chrome und Edge ab Version 111, Firefox ab
Version 114 sowie Safari und iOS ab Version 16.4. Ältere Browser können
funktionieren, werden ohne eigenes Legacy-Bundle und zusätzliche Polyfills aber
nicht zugesichert. Vor dem öffentlichen Pilot wird diese Baseline explizit in
der Build-Konfiguration festgeschrieben, damit ein späteres Vite-Update sie
nicht unbemerkt verschiebt.

Chrome beziehungsweise Edge auf Desktop bilden derzeit den automatisiert
geprüften Hauptpfad. Firefox und Playwright-WebKit werden als feste Testprojekte
ergänzt. Zusätzlich ist mindestens ein manueller Smoke-Test auf echtem Safari
und iPad vorgesehen, da Playwright-WebKit das ausgelieferte Safari nicht in
allen Plattformdetails ersetzt.

Die Fullscreen API wird als progressive Verbesserung behandelt. Eine abgelehnte
oder fehlende Vollbildanfrage darf die Präsentation niemals blockieren. Auf dem
iPhone ist allgemeines Element-Vollbild weiterhin nicht verlässlich verfügbar;
dort bleibt die reduzierte Präsentationsansicht im Browser funktionsfähig. Die
spätere installierte PWA verwendet unabhängig davon den Manifest-Anzeigemodus
`standalone` als verlässliche Basis und kann `fullscreen` bevorzugt anfragen.

### DEC-027 – Open-Source-Lizenz und geschützte Markenidentität

Der Quellcode, Tests, Konfigurationen, Schemata und datengetriebenen Manifeste
von Hearthholds werden unter `AGPL-3.0-or-later` veröffentlicht. Damit bleiben
verteilte Weiterentwicklungen offen; auch eine veränderte, über ein Netzwerk
zugängliche Fassung muss ihren Benutzern den zugehörigen Quellcode anbieten.
Dies unterstützt sowohl Offline-Nutzung als auch Self-Hosting, ohne geschlossene
gehostete Forks zum Standardpfad zu machen.

Dokumentation und ausdrücklich zugeordnete Projekt-Artworks stehen unter
`CC BY-SA 4.0`. Der Name Hearthholds, die Produktidentität
`Hearthholds: Living Places`, Schriftzüge, App-Icons und Favicon bleiben von
diesen Freigaben ausgenommen. Unveränderte offizielle Veröffentlichungen dürfen
die Markenassets mitführen; veränderte Distributionen verwenden eine eigene
Bezeichnung und visuelle Identität. Dateien mit ungeklärter Herkunft oder
Weiterlizenzierung werden einzeln ausgeschlossen, bis ihre Provenienz
dokumentiert ist. Die verbindliche Dateizuordnung steht in `LICENSING.md`.

### DEC-028 – Stufenabhängige Mehrfachproduktion des Bauernhofs

Gebäudebetriebe besitzen ein generisches Modell für mehrere gleichzeitige
Erträge. Die konfigurierbare Maximalproduktion beschreibt die gemeinsame
Tageskapazität; prozentuale Anteile verteilen sie auf die einzelnen Ressourcen
und ergeben zusammen immer 100 Prozent. Bruchteile werden je Ausgabe im
Dokument weitergeführt und an folgenden Tagen ausgeglichen.

Der Bauernhof erzeugt in der Grundstufe ausschließlich Getreide mit einer
Besetzung von 2 bis 6 Arbeitskräften und höchstens 10 Einheiten pro Tag. Die
erweiterte Stufe besitzt Platz für bis zu 9 Arbeitskräfte, erreicht höchstens 16
Einheiten und schaltet Hopfen frei. Ihre Standardverteilung beträgt 75 Prozent
Getreide und 25 Prozent Hopfen; der GM kann sie im Inspektor ändern. Beim
Stufenwechsel werden die passenden Betriebswerte und das zugehörige
Gebäude-Artwork gemeinsam angewendet.

Das Dokumentformat wird dafür auf Schema 12 angehoben. Schema-11-Betriebe mit
einer einzelnen `resourceId` werden in eine Ausgabe mit 100 Prozent Anteil
migriert; die bisherige Nahrungsproduktion des Bauernhofs wird dabei zu
Getreide. Getreide und Hopfen werden als eigene Ressourcen angelegt.

### DEC-029 – Keine abstrakten Sammelressourcen für Erzeugnisse

`Nahrung` und `Handwerkswaren` werden nicht als eigene Ressourcen geführt. Sie
sind für die geplanten Lieferketten zu unspezifisch und würden unterschiedliche
Erzeugnisse mit abweichender Verwendung und Herkunft vermischen. Der Bauernhof
arbeitet mit den konkreten Ressourcen Getreide und Hopfen. Schmiede,
Schreinerei und Jagdhütte behalten ihre konfigurierbaren Arbeitsplätze und den
Betriebsstatus, erzeugen aber keinen pauschalen Sammelbestand. Konkrete
Erzeugnisse werden erst zusammen mit den jeweiligen Rezepten oder
Lieferketten eingeführt.

Schema 13 entfernt vorhandene Bestände der IDs `food` und `goods`, ihre
Gebäudeausgaben und etwaige Bauplanbedarfe. Betriebe ohne verbleibende Ausgabe
erhalten eine Produktionskapazität von null. Andere Ressourcen und
Arbeitskräftezuweisungen bleiben erhalten.

### DEC-030 – Validierter JSON-Import mit expliziter Konfliktbehandlung

Versionierte Hearthholds-JSON-Dateien können über die Topbar importiert werden.
Gebündelte Karten, lokale IndexedDB-Dokumente und Uploads verwenden denselben
fachlichen Pfad aus schrittweiser Migration, Zod-Validierung, Tor-Normalisierung
und Ergänzung verpflichtender Standarddaten. Ungültiges JSON, unvollständige
Dokumente und neuere, noch nicht unterstützte Schemaversionen erhalten jeweils
eine verständliche Fehlermeldung und verändern den aktiven Arbeitsstand nicht.

Ist die importierte Dokument-ID noch nicht lokal vorhanden, wird das Dokument
als Siedlung gespeichert und geöffnet. Bei einer belegten ID entscheidet der
Benutzer ausdrücklich zwischen `Als Kopie importieren`, `Lokale Version
ersetzen` und `Abbrechen`. Die Kopie erhält eine neue ID und einen eindeutigen
Namen. Das Ersetzen erhält die lokale Dokumentart und eine bestehende
Template-Herkunft. Bei Templates warnt der Dialog zusätzlich; ihr lokaler
Arbeitsstand kann daher niemals unbemerkt überschrieben werden.

### DEC-031 – Konkrete Bergbauerzeugnisse und spezialisierte Minenkarten

Minen erzeugen konkrete Erze statt der bisherigen generischen Ressource
`Metall`. Die bestehende Erzmine wird als Eisenerzmine weitergeführt;
Kupfermine und Goldmine ergänzen den Quellenkatalog. Jede Minenart besitzt
eigene konfigurierbare Werte für Besetzung, Tageskapazität, Reisezeit und
Transport sowie ein eigenes Karten-Artwork. Eine spätere Verhüttung kann diese
Erze in Metalle überführen, ohne die Herkunftsressourcen umzudeuten.

Schema 14 migriert `oreMine` zu `ironMine` und `metal` zu `ironOre`. Dabei
werden Quellen, Bestände, Gebäudeausgaben und Bauplanbedarfe gemeinsam
umgestellt. Eisenerz, Kupfererz und Golderz bleiben im Datenmodell getrennt,
werden im HUD jedoch unter `Bergbau` gebündelt.

### DEC-032 – Wiederherstellbare Dokumente und fehlertolerantes Autosave

Alle veröffentlichten Dokumentschemata ab Version 10 besitzen eine getestete,
schrittweise Migration bis zum aktuellen Schema. Ein lokales Dokument, das
trotz Migration nicht validiert werden kann, bleibt in der Dokumentauswahl
sichtbar und kann als unveränderte JSON-Rohdatei exportiert werden. Es wird
weder still ausgeblendet noch automatisch überschrieben.

Die Anwendung fragt nach dauerhaftem Browser-Speicher und speichert ausstehende
Änderungen zusätzlich bei `visibilitychange` und `pagehide`. Vor jedem Schreiben
wird das Dokument gegen das aktuelle Schema validiert. Quota-, Validierungs-
und sonstige Schreibfehler lassen den Zustand ausdrücklich ungespeichert,
zeigen eine verständliche Meldung und bieten Wiederholen sowie einen
Notfall-Export an. Ein erfolgreicher späterer Versuch räumt den Fehlerzustand
erst nach dem bestätigten IndexedDB-Schreibvorgang auf.

### DEC-033 – Arbeitskräftepool getrennt von bestehenden Zuweisungen

Der zuweisbare Anteil der festen Einwohner ist eine Kapazität und nicht bloß
die Summe bereits belegter Arbeitsplätze. Bei der Migration des früheren
Arbeitskräfte-Bestands werden deshalb die Beschäftigten externer Quellen zur
alten, für Bauprojekte und freie Zuweisungen verfügbaren Kapazität addiert.
Projektzuweisungen sind bereits in diesem alten Pool enthalten und dürfen nicht
noch einmal gegengerechnet werden.

Schema 15 korrigiert Dokumente, bei denen Schema 14 die Arbeitsfähigen exakt
auf die bestehenden Zuweisungen begrenzt hatte. Ist dadurch keine freie Kraft
mehr vorhanden, wird der Pool höchstens um die fehlende Mindestbesetzung
aktiver, produzierender Dorfgebäude erweitert. Für ältere Herzdorf-Stände werden
so die zwei freien Arbeitskräfte wiederhergestellt, mit denen der Bauernhof
seine Mindestbesetzung erreichen kann. Die Gesamtzahl bleibt stets durch die
festen Einwohner begrenzt. Die aktuelle Schema-16-Referenzkarte speichert diese
beiden Bauernhofzuweisungen bereits ausdrücklich.

### DEC-034 – Flexible Zyklen, regelwerkabhängige Währung und Gebäudeeinkommen

Die gemeinsame Simulationsfortschreibung heißt in Oberfläche und Datenmodell
`Zyklus`. Die Spielleitung entscheidet selbst, ob ein Zyklus in ihrer Kampagne
einem Tag, einer Woche, einem Monat oder einer anderen Einheit entspricht.
Ressourcenerzeugung, Löhne, Einkommen und Bauphasen bleiben an denselben
expliziten Zykluswechsel gekoppelt.

Geldbeträge werden als ganze Basiseinheiten der kleinsten Münze gespeichert.
Ein Regelwerkprofil definiert Stückelung und Umrechnung; D&D 5e verwendet
Platin, Gold, Elektrum, Silber und Kupfer. Konfigurierbare Werte behalten die
gewählte Münzart, während die Schatzkammer eine exakte Gesamtbilanz und ein
Buchungsjournal führt. Betriebsbereite, ausreichend besetzte Gebäude buchen
Einkommen pro Zyklus; der Bauernhof beginnt mit 2 Gold. Einnahmen desselben
Zyklus dürfen die fällige Lohnsumme decken.

Die Zahlen der HUD-Gruppen Landwirtschaft und Bergbau sind keine Anzahl
verschiedener Erzeugnisse mehr, sondern die Summe ihrer verfügbaren Bestände.
Ressourcen-, Bevölkerungs- und Schatzkammersymbole verwenden dieselbe Größe und
tragen ihren gut lesbaren Hauptwert direkt unter dem Artwork. Schema 16 migriert Tageszähler, Löhne und die
bisherige Schatzkammer verlustfrei in dieses Modell.

### DEC-035 – Vollständig vorgecachete Offline-PWA mit kontrollierten Updates

Der Produktions-Build erzeugt ein Web-App-Manifest mit den vorhandenen
Hearthholds-Icons sowie einen versionsabhängigen Service Worker. Dessen
Precache-Liste wird direkt aus allen tatsächlich ausgegebenen Build-Dateien
gebildet und umfasst damit Anwendungscode, Styles, Karten und gebündelte
Artworks. Nach dem ersten erfolgreichen Laden startet die App einschließlich
eines zuvor in IndexedDB gespeicherten Dokuments vollständig ohne Netzwerk.

Ein neu installierter Worker ruft nicht selbstständig `skipWaiting` auf. Er
bleibt wartend, bis die Oberfläche ein Update anbietet. Vor der Aktivierung
wird ein veränderter Arbeitsstand über denselben validierten Speicherpfad wie
das Autosave geschrieben. Nur nach bestätigtem Erfolg erhält der Worker die
Aktivierungsnachricht; ein Speicherfehler verhindert den Reload. Der aktive
Worker entfernt alte Hearthholds-Caches erst bei seiner Aktivierung und
übernimmt anschließend die bestehenden Clients.
