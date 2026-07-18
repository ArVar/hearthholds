# Hearthholds: Living Places – Produkt- und Technikkonzept

- Status: Implementierung des ersten Karteneditor-Meilensteins
- Referenzszenario: Herzdorf
- Primäres Regelwerk: Dungeons & Dragons 5e (SRD 5.1)
- Weitere geplante Regelwerke: WFRP und benutzerdefinierte Profile

Der verbindliche aktuelle Stand ist im [Entscheidungsprotokoll](entscheidungen.md)
zusammengefasst. Noch nicht umgesetzte Entscheidungen und Vorschläge stehen im
[Produkt- und Technikbacklog](backlog.md). Dieses Dokument beschreibt den
fachlichen Gesamtrahmen und kann deshalb auch spätere Ausbaustufen enthalten.

## 1. Vision

**Hearthholds: Living Places**, kurz **Hearthholds**, ist eine lokale
Siedlungswerkbank für Pen-and-Paper-Rollenspiele. Das Tool unterstützt eine
Spielgruppe dabei, eine bestehende Siedlung räumlich zu erfassen und sie im
Verlauf einer Kampagne gemeinsam weiterzuentwickeln.

Die Spieler treffen am Spieltisch Entscheidungen über Bauvorhaben, Investitionen, Personal und Ressourceneinsatz. Bedient wird das Tool ausschließlich vom Spielleiter oder einer anderen verantwortlichen Person, die diese Entscheidungen aufnimmt und die aktuelle Karte präsentiert.

Der Kern ist ein grafischer 2D-Karteneditor mit zusätzlichen, regelbasierten
Funktionen. Hearthholds ist kein vollständiger Wirtschafts- oder
Bevölkerungssimulator.

## 2. Einsatzmodell

### 2.1 Lokale Einzelbenutzung

- Das Zielprodukt funktioniert vollständig offline. Der aktuelle Browserstand
  speichert zwar lokal, besitzt aber noch keinen garantierten PWA-Offline-Start.
- Es gibt zunächst keine Benutzerkonten, Cloud-Synchronisierung oder gleichzeitige Bearbeitung.
- Ein Spielleiter oder Verantwortlicher bedient die Anwendung.
- Die Gruppe sieht die Karte und trifft ihre Entscheidungen gemeinsam.
- Ein externer Server oder ein Backend sind für den MVP nicht erforderlich.

### 2.2 Arbeitsmodi

Die Anwendung besitzt drei fachliche Modi:

1. **Einrichtungsmodus**
   - Ausgangslage einer bestehenden Siedlung frei erstellen.
   - Gelände, Wege, Gebäude, Bewohner, Ressourcen und laufende Baustellen erfassen.
   - Bestehende Objekte verursachen keine nachträglichen Baukosten.
   - Regeln geben Hinweise, blockieren die Einrichtung aber nicht.

2. **Entwicklungsmodus**
   - Änderungen nach Kampagnenbeginn werden als Projekte behandelt.
   - Ressourcen, Personal, Voraussetzungen und Bauphasen werden geprüft.
   - Der GM kann administrative Korrekturen jederzeit erzwingen.
   - Reguläre Änderungen werden in einer Chronik protokolliert.

3. **Präsentationsmodus**
   - Aufgeräumte Karte für den Spieltisch.
   - Zeigt Einwohner und verfügbare Ressourcen in einer dauerhaften Kopfleiste.
   - Zeigt nur öffentliche Informationen.
   - Verbirgt GM-Notizen, geheime Orte und administrative Bedienelemente.
   - Ein separates Präsentationsfenster für einen zweiten Bildschirm oder Beamer ist für die Desktop-Fassung vorgesehen.

Beim Kampagnenstart wird ein Ausgangsstand gespeichert. Der Einrichtungsmodus wird nicht endgültig gesperrt, damit Fehler weiterhin korrigiert werden können.

## 3. Bewusste MVP-Abgrenzung

Der MVP enthält keine:

- tiefe Wirtschaftssimulation;
- automatische Lieferketten oder detaillierte Produktionsplanung;
- detaillierte Simulation von Arbeitszeiten, individuellen Löhnen oder Bedürfnissen;
- Simulation von Futterverbrauch, Tierzucht oder landwirtschaftlichen Erträgen;
- Echtzeitsimulation;
- Mehrbenutzer- oder Online-Funktionen;
- vollständige Questverwaltung;
- automatisch generierten Gebäude-Bitmaps;
- Übernahme nicht freigegebener D&D-Regelbuchinhalte außerhalb des SRD.

Nicht weiter erfasste Bewohner und Tätigkeiten werden als abstrakte Grundversorgung behandelt. Sie sichern Nahrung, Wasser, Brennstoff und alltägliche Arbeiten. Der GM legt separat fest, wie viele feste Einwohner als Arbeitskräfte zuweisbar sind.

Der Versorgungszustand kann durch den GM manuell als `stabil`, `angespannt` oder `kritisch` markiert werden.

## 4. Zentrale Bedienabläufe

### 4.1 Bestehende Siedlung einrichten

```text
Siedlung anlegen
-> Karte und Gelände gestalten
-> bestehende Gebäude und Infrastruktur platzieren
-> Haushalte und Bewohner erfassen
-> Wohnorte und Arbeitsplätze zuweisen
-> Ressourcen und externe Quellen festlegen
-> laufende Projekte mit ihrem aktuellen Stand erfassen
-> Ausgangsstand speichern
-> Kampagne beginnen
```

### 4.2 Neues Bauvorhaben

```text
Bauplan auswählen
-> Standort auf der Karte festlegen
-> Voraussetzungen prüfen
-> Ressourcen bereitstellen
-> Arbeiter zuweisen
-> Projekt bestätigen
-> Bauphasen bei vergehender Spielzeit fortschreiben
-> Gebäude in Betrieb nehmen
```

Vor einer Bestätigung zeigt das Tool Kosten, verfügbare und fehlende Ressourcen, Personalbedarf sowie räumliche Konflikte.

### 4.3 Zeit fortschreiben

Zeit läuft nicht kontinuierlich. Der GM stößt bewusst einen Zykluswechsel an.
Was ein Zyklus in der Spielwelt bedeutet – etwa Tag, Woche oder Monat – legt
die Spielleitung für die jeweilige Kampagne fest.

Dabei kann das Tool:

- aktive Bauphasen fortschreiben;
- blockierte Projekte melden;
- Ressourcenzugänge und Personalzuweisungen prüfen;
- Erträge aktiver externer Quellen in den gemeinsamen Bestand buchen;
- abschließbare Bauphasen beenden und die nächste Phase beginnen.

Der Zykluswechsel ist eine explizite GM-Aktion und ein gemeinsamer Undo-Schritt.
Eine spätere Vorschau mit anpassbaren Einzelbuchungen bleibt vorgesehen.

## 5. Domänenmodell

### 5.1 Siedlung

Eine Siedlung enthält mindestens:

- Name, Typ und Beschreibung;
- aktives Regelwerkprofil;
- Karte und Kartenobjekte;
- Einwohnerzahl und Versorgungszustand;
- Haushalte, Personen und Arbeitsgruppen;
- Gebäude und Arbeitsplätze;
- Ressourcenbestände und externe Ressourcenzugänge;
- Projekte und Chronik;
- optionales Startdatum.

### 5.2 Hybrides Bevölkerungsmodell

Die Bevölkerung wird hybrid modelliert:

- Wichtige Bewohner werden als benannte Personen geführt.
- Weniger wichtige Bewohner können als vereinfachte Mitglieder eines Haushalts verbleiben.
- Arbeitsgruppen können als zählbare Gruppen geführt und Projekten zugewiesen werden.
- Ein vereinfachtes Mitglied kann später zu einem vollständigen NPC ausgebaut werden, ohne die Einwohnerzahl zu verändern.
- Temporäre Arbeiter zählen nicht zur festen Einwohnerzahl.

Eine Person besitzt zunächst:

- Name;
- Beruf oder Funktion;
- Wohnort;
- Arbeitsplatz;
- aktuelle Projektzuweisung;
- Haushalt oder Familie;
- öffentliche Beschreibung;
- verdeckte GM-Notizen;
- optionale Fähigkeiten oder Tags.

Beruf, Wohnort und Arbeitsplatz sind getrennte Eigenschaften. Ein Schmied kann beispielsweise ohne Arbeitsplatz sein oder vorübergehend an einem Bauprojekt arbeiten.

Ein Haushalt enthält:

- benannte Personen;
- vereinfachte Mitgliedergruppen;
- einen gemeinsamen Wohnort;
- optional Eigentum und Notizen.

Dieselbe Person oder Arbeitskraft darf nicht gleichzeitig mehreren aktiven Aufgaben zugewiesen werden.

### 5.3 Gebäude und Arbeitsplätze

Ein Gebäude enthält:

- Name und Gebäudetyp;
- Position, Grundriss und Ausrichtung;
- Status wie `bestehend`, `geplant`, `im Bau`, `fertig` oder `beschädigt`;
- Zustand;
- Wohnplätze;
- definierte Arbeitsplätze;
- Bewohner und Beschäftigte;
- Eigentümer oder verantwortliche Person;
- installierte Ausbauten;
- öffentliche und geheime Notizen.

Gebäude enthalten Personen nicht direkt als unstrukturierte Liste. Sie stellen Wohnplätze und benannte Arbeitsplätze bereit, denen Personen oder Gruppen zugewiesen werden.

### 5.4 Baupläne, Fähigkeiten und Ausbauten

Bauplan und konkretes Gebäude bleiben getrennt:

- Der Bauplan definiert Grundriss, Kosten, Voraussetzungen, Bauphasen, Arbeitsplätze und mögliche Ausbauten.
- Das Gebäude speichert Position, Zustand, Ausbau und aktuelle Zuweisungen.
- Ein Bauprojekt verbindet einen Bauplan mit einem Standort und dem aktuellen Fortschritt.

Gebäudeeffekte werden über Fähigkeiten beschrieben. Eine Schmiede beantwortet damit, welche Gegenstände oder Leistungen dort grundsätzlich verfügbar sind, ohne die laufende Produktion einzelner Gegenstände zu simulieren.

Voraussetzungen werden in drei Kategorien getrennt:

1. **Baukosten** werden einmalig für Bau oder Ausbau verbraucht.
2. **Betriebsvoraussetzungen** müssen dauerhaft erfüllt sein, etwa ein zugewiesener Schmied.
3. **Ressourcenzugänge** schalten Möglichkeiten frei, etwa Zugang zu reinem Metall.

Ausbaufähige Handwerksgebäude folgen drei linearen Betriebsstufen: `Grundstufe`, `Erweitert` und `Meisterstufe`. Gebäudespezifische Fähigkeiten unterscheiden weiterhin etwa Schmiede, Schreinerei und Jägerhof, ohne für jeden Typ ein eigenes Fortschrittsmodell einzuführen.

Fehlt eine Betriebsvoraussetzung später, bleibt der Ausbau bestehen. Die betroffene Fähigkeit wird als blockiert angezeigt.

### 5.5 Projekte und Bauphasen

Das zentrale Veränderungsmodell ist das Projekt. Dazu gehören:

- Gebäude errichten;
- Gebäude reparieren, erweitern oder umnutzen;
- Straßen, Mauern oder Palisaden bauen;
- Gelände roden;
- Brunnen graben;
- Gebäude abreißen;
- Personal umverteilen;
- in bestehende Gebäude investieren.

Ein Projekt besitzt:

- Typ und Bezeichnung;
- Bezug zu Karte, Gebäude oder externer Quelle;
- Status;
- geordnete Phasen;
- Ressourcenbedarf je Phase;
- Personalbedarf je Phase;
- weitere Voraussetzungen;
- aktuellen Fortschritt;
- Notizen und Chronikeinträge.

Ressourcen werden pro Phase reserviert. Beim Abschluss werden sie endgültig verbraucht. Beim Abbruch entscheidet der GM, welcher Anteil zurückgewonnen wird.

Eine bereits laufende Baustelle kann im Einrichtungsmodus direkt auf eine Phase und einen manuellen Zwischenstand gesetzt werden. Bereits verbaute Ressourcen werden nicht nachträglich vom Startbestand abgezogen.

Alle Gebäude verwenden drei einheitliche Bauphasen: `Fundament`, `Mauerwerk` und `Dach & Fertigstellung`. Davon getrennt besitzen ausbaufähige Betriebsgebäude bis zu drei Betriebsstufen: `Grundstufe`, `Erweitert` und `Meisterstufe`. Ein Ausbau ist ein eigenes Projekt und wiederholt nicht die Bauphasen des Neubaus.

Im aktuellen Prototyp ist der Bauablauf erstmals für die einfache Dorfschmiede umgesetzt:

- Der Bauplan besitzt die drei einheitlichen Phasen von Fundament bis Fertigstellung.
- Der Bedarf wird datengetrieben aus dem Bauplan ermittelt, nicht aus der gezeichneten Gebäudegröße abgeleitet.
- Holz und Stein sind Verbrauchsgüter. Sie werden reserviert und beim Phasenabschluss vom Bestand abgezogen.
- Arbeitskräfte sind eine Kapazität. Sie werden reserviert und beim Phasenabschluss wieder freigegeben.
- Die vorhandene Baustelle beginnt in Phase 2 `Mauerwerk` bei 36 Prozent. Ihre Mittel sind bereits reserviert.
- Das Fundament gilt als abgeschlossen; dessen verbaute Mittel werden nicht rückwirkend abgezogen.
- Der GM schließt Phasen manuell ab und reserviert anschließend den Bedarf der nächsten Phase.
- `Dach & Fertigstellung` bleibt blockiert, bis der GM die Voraussetzung `Schmied verfügbar` bestätigt.
- Reservierung und Phasenabschluss sind Teil der Undo-/Redo-Historie und werden lokal gespeichert.
- Der aktuelle Siedlungsstand kann als eingerückte JSON-Definitionsdatei
  exportiert und wieder importiert werden. Sie enthält Karte, Gebäude,
  Ressourcen, Baupläne und Projekte sowie eine Schemaversion. Importierte
  Dateien werden validiert und bei Bedarf schrittweise migriert.

### 5.6 Aufgaben als Voraussetzungen

Eine fehlende Voraussetzung kann als offene Aufgabe dokumentiert und mit einem Projekt verknüpft werden. Dies ist kein vollständiges Quest-System.

Beispiel:

```text
Aufgabe: Schmied für Herzdorf finden
Bezug: Bauprojekt Dorfschmiede
Erfüllt, wenn: Eine geeignete Person angelegt und der Schmiede zugewiesen ist
```

## 6. Ressourcenmodell

### 6.1 Gemeinsamer Siedlungsbestand

Der MVP verwendet einen gemeinsamen Siedlungsbestand. Eigentum einzelner Haushalte oder Gebäude ist zunächst beschreibende Information.

Ressourcentypen sind konfigurierbar. Eine neutrale Grundauswahl ist:

- Holz;
- Stein;
- Eisenerz;
- Kupfererz;
- Golderz;
- Werkzeug;
- Vorräte;
- Geld.

Jede Ressource zeigt:

- Gesamtbestand;
- reservierte Menge;
- verfügbare Menge.

Jede Änderung wird mit Menge, Grund, Zeitpunkt und optionalem Projektbezug protokolliert.

### 6.2 Bestand und Zugang

Bestand und Ressourcenzugang sind unterschiedliche Konzepte:

- Ein Bestand wird durch Bau oder Investitionen verbraucht.
- Ein Zugang beschreibt eine verfügbare Quelle oder Handelsbeziehung.
- Ein Zugang kann eine Gebäudefähigkeit oder Beschaffungsmöglichkeit freischalten.
- Tatsächliche Lieferungen werden als Buchung in den Bestand übernommen.

Externe Quellen besitzen mindestens:

- Name und Typ;
- gelieferte Ressourcenart;
- Entfernung oder Reisezeit;
- Status und Kontrolle;
- zugewiesene Arbeiter;
- Transportkapazität;
- Notizen.

Jede Quelle besitzt außerdem einen Zyklusertrag. Effektiv gebucht wird höchstens
die Transportkapazität; inaktive Quellen erzeugen nichts. In der Oberfläche
erscheinen externe Quellen in einer eigenständigen, filterbaren Kartenansicht
mit passendem Artwork. Die Eigenschaften bleiben direkt auf der jeweiligen
Quellenkarte konfigurierbar.

### 6.3 Zyklusertrag und Baufortschritt

Eine Bauphase entspricht zugleich einem Ressourcenbedarf. Beim Zykluswechsel
werden zunächst die Erträge der aktiven Quellen gebucht. Ist danach der gesamte
Phasenbedarf gedeckt, werden verbrauchbare Ressourcen abgezogen und das Projekt
wechselt in die nächste Phase. Selbst bei vollständig vorhandenem Bedarf dauert
eine Phase mindestens einen Zykluswechsel.

Bei Fehlmengen ergibt sich die Vorschau aus der langsamsten benötigten
Ressource: `max(1, ceil((Bedarf − verfügbarer Bestand) / Zyklusertrag))`.
Besitzt eine fehlende Ressource weder Bestand noch Zyklusertrag, bleibt das
Projekt blockiert.

### 6.4 Einkommen und Schatzkammer

Aktive, ausreichend besetzte Gebäude können ein frei konfigurierbares Einkommen
je Zyklus erwirtschaften. Der Bauernhof startet mit 2 Gold je Zyklus. Einnahmen,
Löhne und Anwerbekosten werden in der kleinsten Einheit des gewählten Regelwerks
gespeichert und über dessen Stückelung angezeigt. Für D&D 5e sind dies Platin,
Gold, Elektrum, Silber und Kupfer. Die Zyklusbilanz und ein Buchungsjournal
machen Einnahmen, Ausgaben und Nettoveränderung nachvollziehbar.

## 7. Karteneditor

### 7.1 Kartenebenen

Die Karte besitzt getrennte, sperr- und ausblendbare Ebenen:

1. Hintergrund oder importiertes Kartenbild;
2. Gelände;
3. Infrastruktur wie Wege, Straßen, Mauern und Zäune;
4. Gebäude;
5. Marker und frei platzierbare Dorf-Ausstattung;
6. Zonen wie Grundstücke, Felder und Dorfgrenzen;
7. Beschriftungen;
8. geheime GM-Ebene.

### 7.2 Platzierung und Transformation

- Gebäude werden frei platziert.
- Ein optionales Fangraster stabilisiert Abstände und Größen.
- Das Raster muss im Präsentationsmodus nicht sichtbar sein.
- Einzelne Gebäude und drehbare Kartenobjekte sind in 15-Grad-Schritten drehbar.
- Mehrere Objekte können additiv ausgewählt, gemeinsam verschoben und zu
  benannten Gruppen zusammengefasst werden.
- Ein auf der Kartenfläche aufgezogener Auswahlrahmen erfasst mehrere sichtbare,
  ungesperrte Objekte. Der gemeinsame Transformationsrahmen verschiebt, skaliert
  proportional und dreht die Auswahl.
- Der Editor bietet Drehgriff, Tastaturaktionen und direkte Winkeleingabe.
- Der logische Grundriss rotiert mit der Darstellung.
- Kollisionen und Flächenbedarf werden anhand des logischen Grundrisses geprüft.

Kartenmaße werden metrisch angegeben. Rasterabstand und Spielmaßstab sind getrennte Werte: Der Rasterabstand bestimmt Darstellung und Fangpunkte in internen Karteneinheiten, während der Maßstab die reale Distanz eines quadratischen Feldes in Metern festlegt. Herzdorf verwendet standardmäßig 20 Karteneinheiten pro Feld und 1,5 Meter pro Feld; die Kartenfläche entspricht damit 120 × 80 Metern. Der Editor bietet metrische Maßstabsvorgaben von 1 bis 25 Metern pro Feld, konfigurierbare Hauptlinien sowie eine je Karte gespeicherte Rasterfarbe und -transparenz.

Logische Grundflächen von Gebäuden, Zonen, Markern und Dekorationen sind im Inspektor als Breite und Tiefe in Metern editierbar. Die gespeicherten internen Maße werden anhand des aktuellen Maßstabs umgerechnet. Gebäude und Dekorationen können zusätzlich direkt über die Skalierungsgriffe des Auswahlrahmens vergrößert oder verkleinert werden; Mehrfachauswahlen verwenden einen gemeinsamen proportionalen Rahmen.

Wege und Flüsse werden als kubische Bézierpfade mit verschiebbaren Ankerpunkten bearbeitet. Quadratische Eckanker besitzen unabhängige Tangenten, runde Glattanker halten Ein- und Ausgangstangente kollinear. Tangentenlinien und Anfasser erscheinen für den aktiven Knoten nach dem Vorbild klassischer Vektorgrafikprogramme. Neue Zwischenpunkte teilen eine Kurve ohne Formänderung; überzählige Punkte können entfernt und der vollständige Verlauf gemeinsam verschoben werden. Ein Rechtsklick auf Pfad oder Anker öffnet die passenden Befehle direkt am Mauszeiger. Brücken bleiben standardmäßig gerade, nutzen aber dasselbe Ankerformat. Breite, Darstellungsart und Farbe bleiben im Inspektor editierbar.

Jedes Gebäude besitzt zwei Repräsentationen:

- eine grafische Draufsicht;
- einen logischen Grundriss für Geometrie und Regeln.

### 7.3 Mauern, Palisaden und runde Strukturen

Mauern und Palisaden sind Pfadstrukturen und keine langgestreckten Gebäude.

Der Pfad unterstützt:

- gerade Segmente;
- echte Kreisbögen;
- kubische Béziersegmente;
- vollständige Kreise;
- geschlossene Umfriedungen aus mehreren Segmenten;
- verschiebbare Stützpunkte;
- Richtungsraster in 15-Grad-Schritten;
- Verbindungspunkte;
- Tore und Durchgänge;
- optionale Türme oder Verstärkungen entlang des Pfads.

Geraden, Kreisbögen und kubische Béziersegmente lassen sich über ihre Knoten und Anfasser bearbeiten. Das Kontextmenü eines Segments fügt an der angeklickten Stelle formtreu einen Knoten ein. Endknoten und Verbindungsknoten zwischen genau zwei Segmenten können als Eckknoten oder glatte Knoten definiert werden. Betroffene Kreisbögen werden dabei automatisch in formnahe kubische Bézierabschnitte von höchstens 90 Grad zerlegt. Eckknoten erlauben einen Richtungswechsel; bei glatten Knoten liegen beide Tangenten auf einer gemeinsamen Achse und bewegen sich gekoppelt. Der aktive Knoten zeigt seine Tangenten und Anfasser direkt auf der Karte. Gerade und Bézierknoten können wieder entfernt werden; nur mehrdeutige Verbindungen bleiben geschützt.

Die Kartenbearbeitung zeigt für ausgewählte Umfriedungen gemeinsame Verbindungspunkte, Bogenmittelpunkte und Radiusgriffe. Das Verschieben eines Anschlusses zwischen Gerade und Kreisbogen hält beide Segmente verbunden. Holzpalisade und Steinmauer verwenden dasselbe Geometriemodell, aber getrennte Darstellungen.

Tore sind eigenständige, frei platzierbare Befestigungsobjekte. Sie können als
Holz- oder Steintor sowie als Haupt- oder Nebentor dargestellt, direkt
ausgewählt, verschoben, gedreht und in ihrer Breite verändert werden. Auf einer
Mauer oder Palisade überdecken sie den betreffenden Abschnitt visuell, ohne die
Geometrie der Umfriedung in unverbundene Pfade zu zerlegen.

Kosten für Mauern und Palisaden werden aus der tatsächlichen Segment- oder Bogenlänge sowie festen Kosten für Tore und Zusätze berechnet. Große Umfriedungen können abschnittsweise gebaut werden.

Runde Gebäude wie Türme besitzen kreisförmige oder polygonale Gebäudegrundrisse und bleiben normale Gebäudeobjekte.

### 7.4 Bauzustände auf der Karte

Geplante und laufende Projekte werden sichtbar unterschieden:

- geplant: transparenter Grundriss;
- vorbereitet: abgesteckte Fläche;
- Fundament;
- Rohbau;
- fertig;
- blockiert: Statusindikator;
- beschädigt: Zustandsindikator.

Die äußeren Abmessungen bleiben während der Bauphasen stabil, damit die Karte nicht springt.

### 7.5 Visuelle Assets

Der MVP verwendet klar beschriftete, schematische Draufsichten. Ein Gebäude kann später optionale Bitmaps enthalten für:

- fertigen Zustand;
- Bauphasen;
- beschädigten Zustand;
- Stilvarianten.

Fehlt ein Bild, erzeugt der Editor eine Darstellung aus Grundriss, Farbe und Beschriftung. Bitmaps werden als Ganzes gedreht; separate Grafiken für jeden 15-Grad-Winkel sind nicht erforderlich.

Geplante Asset-Pakete können beispielsweise systemneutral, klassische Fantasy oder düsteres WFRP abbilden.

Für den ersten Bitmap-Pilot gilt folgender Asset-Standard:

- orthografische Draufsicht im semi-realistischen Stil moderner VTTs;
- klare Silhouette und bei kleinem Maßstab erkennbare Materialien;
- transparente WebP-Dateien mit einheitlichem Grundriss und Drehpunkt;
- stabile, derzeit unversionierte Gebäudetypen und Varianten, aus denen der Asset-Katalog die Dateipfade ableitet;
- getrennte Asset-Kanäle für Albedo sowie später optionale Normal- und Emissivkarten;
- neutrale Umgebungsbeleuchtung und nur dezente Kontaktschattierung;
- keine fest eingebrannten Lichtkegel, Feuer- oder Fensterglühen;
- Rotation erfolgt weiterhin im Editor, nicht durch separate Winkeldateien;
- fehlt ein Bitmap oder lädt es noch, bleibt eine generische Grundrissdarstellung als Fallback sichtbar.

Gebäudebitmaps liegen als einzelne Dateien unter `assets/buildings/<typ>/`. Jedes Typverzeichnis besitzt ein `manifest.json` mit Bezeichnung, Grundrissskalierung, Varianten, verfügbaren Ausbaustufen und optionalen Palettenangaben. Der Editor entdeckt Manifeste und Bilder automatisch; ein neuer Gebäudetyp benötigt keine zusätzlichen Imports im Quellcode. Bauphasen liegen unter `construction/`, fertige Betriebsstufen unter `tiers/`. Fehlt eine typspezifische Bauphase, verwendet der Editor die gemeinsamen Bitmaps unter `assets/environment/construction/`. Beschädigte Gebäude erhalten ein wiederverwendbares transparentes Overlay. Atlanten bleiben kleinen, häufig wiederholten Umgebungselementen wie Bäumen vorbehalten.

Die einfache Dorfschmiede besitzt eigene Bitmaps für `Fundament`, `Mauerwerk` und die fertige `Grundstufe`. Das angezeigte Asset folgt automatisch der aktuellen Projektphase. Schreinerei, Schmiede und Jägerhof besitzen jeweils eigenständige Bitmaps für `Grundstufe`, `Erweitert` und `Meisterstufe`. Der Asset-Katalog prüft beim Start, dass jede in einem Manifest deklarierte Kombination aus Variante und Ausbaustufe tatsächlich vorhanden ist.

Das erste Herzdorf-Paket ergänzt eigenständige Bitmaps für Anwesen, Bauernhof, Schreinerei, Jägerhof mit Gerberstation, Wachturm, Wohnhaus, Gemeinschaftshaus und Lagerhaus. Normale Wohnhäuser besitzen zunächst drei gleichwertige optische Varianten bei identischer Auflösung und Grundrissausrichtung. Ein deterministisch gesetzter Baum-Atlas gestaltet die Waldzonen; Dorfbrunnen, Feuerstelle, Weizenfeld und Weidebedarf besitzen eigenständige transparente Bitmaps. Frei platzierbare Requisitengruppen werden als `decorations` mit Asset-ID, Position, Größe und Rotation in der Karte gespeichert. Eine Brückenbitmap sowie geschichtete Wege, Grundstückszäune und Palisaden bilden die weitere Infrastruktur. Kachelbare, malerische Texturen geben Boden, Wegen und Fluss Materialtiefe. Flussufer erhalten organische Moos- und Erdübergänge; Baumkronen werden dicht gestaffelt und mit weichen Kontaktschatten geerdet. Der Stil orientiert sich an modernen, semi-realistischen VTT-Karten mit gedecktem Grün, warmen Erdwegen und klar lesbaren Draufsichten. Die JSON-Definition speichert Gebäudetyp, Variante und Ausbaustufe statt Dateipfaden; Bilddateien und ihre Skalierung bleiben im Asset-Katalog gekapselt.

Spätere dynamische Lichtquellen werden als eigene Kartendaten mit Position, Farbe, Radius, Intensität und optionalem Flackern modelliert. Dadurch können Esse, Feuerstelle, Fenster und Laternen unabhängig vom Bitmap geschaltet werden. Sichtlinien und schattenwerfende Hindernisse bilden darauf eine weitere Ausbaustufe.

Für diesen Licht-Meilenstein ist PixiJS 8 mit WebGL/WebGL2 als Produktionsrenderer vorgesehen. WebGPU wird über Feature-Erkennung optional aktiviert, sobald der PixiJS-Renderer und die Zielbrowser dafür stabil genug sind. PixiJS bezeichnet WebGPU derzeit als funktionsfähig, aber experimentell, und empfiehlt WebGL für Produktionsanwendungen. Der bestehende Konva-Renderer bleibt bis zu diesem gezielten Renderer-Meilenstein für die bewährten Editorinteraktionen zuständig.

Technische Referenzen:

- PixiJS-Renderer: <https://pixijs.com/8.x/guides/components/renderers>
- WebGPU API und Verfügbarkeit: <https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API>

### 7.6 Bestehende Karten importieren

Ein vorhandenes Kartenbild kann später als gesperrter Hintergrund importiert werden. Interaktive Gebäude, Zonen und Infrastruktur liegen darüber. Der Import ist wichtig für vorhandene Kampagnen, aber nicht Teil des ersten technischen Karteneditor-Meilensteins.

## 8. Benutzeroberfläche

Die Hauptansicht ist ein arbeitsorientiertes Editorlayout mit der
Informationshierarchie eines Aufbauspiels:

```text
+ Siedlung | Einwohner | Holz | Stein | Arbeit | Aktionen -----+
+---------------+--------------------------+------------------+
| Katalog       |                          | Kontextbereich   |
|               |          Karte           | Eigenschaften    |
| Bauoptionen   |                          | Raster           |
| Infrastruktur |                          | Bauphasen        |
| Gelände       |                          | Personal         |
+---------------+--------------------------+------------------+
```

Einwohner und unmittelbar verfügbare Ressourcen sind dauerhaft oben sichtbar,
auch im Präsentationsmodus. Ein Hover-Fenster schlüsselt Bestand, Reservierung,
Erzeugung und Verbrauch auf. Leere Ressourcen ohne vorhandene Produktionsquelle
bleiben aus Platzgründen ausgeblendet; sie erscheinen automatisch mit einer
passenden Quelle oder einem Bestand. Landwirtschaftliche Einzelressourcen wie
Getreide und Hopfen teilen sich in der Kopfleiste den Eintrag `Landwirtschaft`
mit einem Ernte-Artwork. Dessen Hover-Fenster nennt nur relevante Erzeugnisse
und zeigt deren Bestand, Reservierung und Tagesproduktion getrennt. Ein Klick
öffnet die eigenständige Ressourcen- und Quellenansicht. Inspektor,
Szenenbrowser, Rastereinstellungen und allgemeine Anwendungseinstellungen
belegen einheitlich denselben rechten Kontextbereich.
Das Raster besitzt im Editor genau einen Einstieg; Sichtbarkeit, Fangfunktion,
Maßstab, Hauptlinien, Farbe, Transparenz und Kartengröße werden dort gemeinsam
verwaltet.

Der ausklappbare Szenenbrowser folgt dem Ebenenprinzip von Grafikprogrammen. Er
zeigt Ebenen, flache Objektgruppen und einzelne Kartenobjekte, bietet Suche sowie
Mehrfachauswahl und verwaltet Sichtbarkeit und Sperren. Gruppen- und
Ebeneneigenschaften werden an enthaltene Objekte vererbt. Innerhalb einer Ebene
wird die persistente Zeichenreihenfolge per Drag-and-drop geändert. Die linke
Palette bleibt dadurch auf Katalog und Geländewerkzeuge konzentriert.

Zentrale Bereiche sind:

- Karte;
- Objekt- und Werkzeugpalette;
- Objekt-, Gruppen- und Ebenenbrowser;
- Inspektor für das ausgewählte Objekt;
- Siedlungsverzeichnis für Bewohner, Haushalte und Arbeitsplätze;
- Ressourcenübersicht;
- Projektübersicht mit `geplant`, `blockiert`, `im Bau` und `fertig`;
- Chronik;
- Präsentationsmodus.

Undo und Redo gehören zum MVP.

## 9. Regelwerkprofile und D&D 5e

### 9.1 Profilarchitektur

Der Karteneditor enthält keine fest verdrahtete WFRP- oder D&D-Logik. Eine Siedlung aktiviert ein Regelwerkprofil, beispielsweise:

- systemneutral;
- D&D 5e;
- später WFRP;
- benutzerdefiniert.

Ein Profil definiert:

- Gebäudetypen und Baupläne;
- Berufe und Fähigkeiten;
- Gegenstands- und Leistungskategorien;
- Ressourcenarten;
- Voraussetzungen und Ausbauten;
- regelbezogene Begriffe und Effekte.

### 9.2 D&D-Itemkatalog

Für D&D 5e wird die deutsche Item-Tabelle aus dem **System Reference Document 5.1** verwendet. SRD 5.1 ist unter Creative Commons Attribution 4.0 International (`CC-BY-4.0`) veröffentlicht.

Offizielle Quelle: <https://www.dndbeyond.com/srd/>

Übernommen werden ausschließlich Inhalte, die im SRD 5.1 freigegeben sind, darunter je nach Gegenstand:

- Name und Kategorie;
- Preis und Gewicht;
- Waffenklassifikation;
- Schaden und Eigenschaften;
- Rüstungskategorie und Rüstungsklasse;
- Werkzeuge und allgemeine Ausrüstung.

Jeder übernommene Datensatz erhält einen Herkunftsverweis auf `SRD 5.1 / CC-BY-4.0`. Die erforderliche Attribution wird im Repository und in der Anwendung dokumentiert.

Die Zuordnung von Gegenständen zu Siedlungsgebäuden ist eine eigene Regel von
Hearthholds und nicht Teil der offiziellen Item-Tabelle. Beispiel:

```text
Einfache Schmiede
-> einfache Nahkampfwaffen
-> Metallwerkzeuge
-> einfache Rüstungen
-> Reparaturen

Verbesserte Schmiede
-> Kriegswaffen
-> mittlere und schwere Rüstungen
-> hochwertige Werkzeuge
-> benötigt Zugang zu reinem Metall
```

SRD 5.2.1 wird zunächst nicht verwendet, da es den aktualisierten 5.5e-Regelstand beschreibt.

## 10. Referenzszenario Herzdorf

Herzdorf ist das verbindliche Referenz- und Akzeptanzszenario für den MVP.

### 10.1 Allgemeines

```text
Name: Herzdorf
Regelwerkprofil: D&D 5e
Typ: kleines Dorf
Feste Einwohner: 30
Temporäre Bevölkerung: auswärtige Arbeiter und Tagelöhner
Entwicklungsziel: Wachstum an Größe und Bedeutung unter Einfluss der Spieler
```

Nicht ausdrücklich erfasste Einwohner und Kapazitäten werden für die Grundversorgung des Dorfs verwendet.

### 10.2 Karte und Palisade

- Das Dorf ist herzförmig angelegt.
- Eine herzförmige Palisade umschließt das Dorf.
- Das Haupttor liegt im Südosten.
- Ein kleines Versorgungstor liegt im Norden.
- Das Nordtor dient insbesondere Holzfällern und Steinlieferungen.
- Das Umland und ein kleines Feld außerhalb der Palisade müssen auf der Karte Platz finden.
- Die Palisade wird als bestehender, geschlossener Pfad aus sechs editierbaren Béziersegmenten angelegt.
- Haupt- und Versorgungstor sind eigenständig auswählbare Kartenobjekte.
- Palisadenabschnitte müssen separat auswählbar und später reparier- oder ausbaubar sein.

### 10.3 Bestehende Gebäude und Anlagen

- Anwesen;
- Bauernhaus mit Hof;
- Schreinerei;
- Jagdhütte mit Gerberstation;
- Wachturm;
- Schmiede im Bau;
- kleines Weizenfeld außerhalb der Palisade.

Die Jagdhütte mit Gerberstation zeigt, dass ein Gebäude mehrere Funktionen oder installierte Module besitzen kann.

### 10.4 Bekannte Personen

| Name | Funktion | Wohnort | Arbeitsplatz |
| --- | --- | --- | --- |
| Detlev | Ehemaliger Ritter und Dorfchef | Anwesen | Anwesen / Dorfleitung |
| Gundula | Ehefrau von Detlev, weitere Funktion offen | Anwesen | offen |
| Kurt | Koch | Anwesen | Anwesen |
| Olaf | Jäger | Jägerhaus | Jagdhütte / Gerberstation |
| Bernd | Bauer | Bauernhaus | Bauernhof |

Olaf lebt allein im Jägerhaus. Bernd betreibt den Bauernhof mit seiner Familie. Die Größe und Namen seiner Familie sind noch offen.

Die verbleibenden festen Einwohner werden zunächst als Haushalte oder vereinfachte Bewohnergruppen erfasst.

### 10.5 Arbeitskräfte

Von 20 arbeitsfähigen festen Einwohnern sind im Ausgangsstand 18 zugewiesen:

- 5 Arbeiter in bestehenden Dorfgebäuden, davon 2 auf Bernds Bauernhof;
- 2 Arbeiter für den Holzabbau;
- 3 Arbeiter für den Steinbruch;
- 4 Arbeiter für die Eisenerzmine;
- 4 Arbeiter für das Schmiedenprojekt.

Zusätzliche Tagelöhner aus Nachbarorten können Förderung, Transport oder Bauprojekte verstärken. Sie werden je Arbeitsplatz als variable temporäre Gruppe geführt, zählen nicht zu den 30 festen Einwohnern und werden beim Zykluswechsel aus der Schatzkammer bezahlt.

Neben den bereits gebundenen Kräften verbleiben zu Kampagnenbeginn zwei frei
zuweisbare arbeitsfähige Einwohner. Bernds Bauernhof ist bereits mit zwei
Einheimischen auf seiner Mindestbesetzung und kann mit den freien Kräften
weiter verstärkt werden. Beschäftigte externer Quellen und der für
Bauprojekte verfügbare Dorfpool werden bei der Kapazitätsberechnung getrennt,
damit vorhandene Zuweisungen die freien Kräfte nicht versehentlich auf null
reduzieren.

Funktionsbauten, externe Quellen und Bauprojekte reservieren ihre zugewiesenen
festen Arbeiter. Ein konfigurierbares Minimum entscheidet, ob der Betrieb läuft;
bis zum Maximum steigt die Produktion proportional. Das Tool berechnet keine
detaillierten Arbeitsstunden.

### 10.6 Bauernhof

Bernds Bauernhof enthält:

- 15 Hühner;
- 5 Schweine;
- 2 Kühe;
- ein kleines Weizenfeld außerhalb der Palisade.

Tiere werden als sichtbare Bestände mit Anzahl und Notizen geführt. Das
Weizenfeld ist eine mit dem Bauernhof verknüpfte Kartenzone.

Der Bauernhof erzeugt im Zyklus Getreide. Die erweiterte Ausbaustufe
besitzt eine höhere Arbeitskräfte- und Gesamtkapazität und schaltet Hopfen als
zweiten Ertrag frei. Der GM verteilt die arbeitskraftabhängige Zykluskapazität
prozentual auf Getreide und Hopfen. Bruchteile werden über Zykluswechsel hinweg
weitergeführt, damit frei gewählte Verteilungen keinen systematischen Verlust
durch Rundung verursachen. Tierentwicklung und Futter bleiben außerhalb der
automatischen Simulation.

### 10.7 Ressourcen und externe Quellen

Holz und Stein stehen in realistischen, zur Dorfgröße passenden Mengen zur Verfügung. Die exakten Zahlen werden später anhand der zugewiesenen Arbeiter, Werkzeuge und Transportmöglichkeiten festgelegt.

Holzversorgung:

```text
Quelle: umliegender Wald
Zugang: Nordtor
Arbeiter: 2 Holzarbeiter
Transport: gemeinsame Transportgruppe
Status: aktiv
```

Steinversorgung:

```text
Quelle: zuvor von den Spielern befreiter Steinbruch
Entfernung: 30 Minuten Fußmarsch
Arbeiter: 3 Steinbrucharbeiter
Transport: gemeinsame Transportgruppe
Status: aktiv und gesichert
```

Der Steinbruch ist ein verknüpfter externer Ort. Eine eigene Regionskarte ist für den MVP nicht erforderlich.

Bergbauquellen werden als spezialisierte Karten für Eisenerz, Kupfererz und
Golderz angelegt. Besetzung, Zykluskapazität, Reisezeit und Transport sind je
Quelle konfigurierbar. In der Kopfleiste erscheinen aktuell relevante Erze
gebündelt unter `Bergbau`; Karten, Bestände und Produktionsflüsse bleiben
getrennt. Eine spätere Verhüttung verarbeitet Erz zu Metall.

### 10.8 Schmiedenprojekt

In Herzdorf gibt es noch keinen Schmied. Einen geeigneten Schmied zu finden ist eine Mission für die Spieler.

Der aktuelle Bauzustand:

```text
Dorfschmiede

Bauplatz: abgeschlossen
Fundament: abgeschlossen
Mauerwerk: begonnen
Sichtbarer Fortschritt: erste zwei Steinreihen liegen
```

Allgemeine Arbeiter können Fundament, Mauerwerk und Dach errichten. Für die Fertigstellung und Inbetriebnahme eines Betriebsgebäudes kann zusätzlich eine passende Person wie ein `Schmied` erforderlich sein.

```text
Offene Aufgabe: Schmied für Herzdorf finden
Bezug: Bauprojekt Dorfschmiede
Erfolg: geeignete Person anlegen und der Schmiede zuweisen
```

## 11. MVP-Akzeptanzablauf

Der erste vollständige Produktablauf ist:

```text
Herzdorf anlegen
-> herzförmige Palisade mit zwei Toren zeichnen
-> bestehende Gebäude und das äußere Feld platzieren
-> Gebäude in 15-Grad-Schritten drehen
-> 30 Einwohner hybrid erfassen
-> feste und temporäre Arbeitsgruppen zuweisen
-> Steinbruch als externe Ressource verknüpfen
-> Schmiede mit bestehendem Baufortschritt eintragen
-> fehlenden Schmied als blockierende Voraussetzung anzeigen
-> Ausgangsstand speichern
-> Kampagnenmodus beginnen
-> Karte im Präsentationsmodus zeigen
-> Zeit fortschreiben und Projekt- sowie Ressourcenänderungen bestätigen
```

Herzdorf gilt als fachlicher Test dafür, ob Karteneditor, Bevölkerung, Ressourcen und Projekte sinnvoll zusammenspielen.

## 12. Technischer Stack

### 12.1 Festgelegte Technologien

| Bereich | Technologie |
| --- | --- |
| Sprache | TypeScript im Strict Mode |
| Oberfläche | React |
| Buildsystem | Vite |
| Karteneditor | Konva und `react-konva` |
| Fachgeometrie | `@flatten-js/core` |
| Anwendungszustand | Zustand und Immer |
| Mehrsprachigkeit | typisierte React-Sprachschicht mit lokalen Katalogen |
| Datenprüfung | Zod |
| Lokale Browser-Speicherung | IndexedDB über Dexie |
| Desktop-Verpackung | später Tauri 2 |
| UI-Grundbausteine | Radix Primitives, Lucide Icons, eigenes CSS |
| Unit- und Integrationstests | Vitest und Testing Library |
| Ende-zu-Ende- und Canvas-Tests | Playwright |

### 12.2 Architekturgrundsätze

- Konva ist ausschließlich für Darstellung und Interaktion zuständig.
- Geometrie, Regeln und Datenmodelle bleiben unabhängig von Konva.
- Gebäude, Mauern und Pfade werden als fachliche Daten gespeichert, nicht als serialisierte Canvas-Knoten.
- Domänenlogik wird in reinen TypeScript-Funktionen implementiert und unabhängig von React getestet.
- Hochfrequente Vorschauzustände beim Ziehen bleiben lokal im Editor; fachliche Änderungen werden als abgeschlossene Aktionen übernommen.
- Undo und Redo arbeiten auf fachlichen Editoraktionen.
- Regelwerkprofile und Baupläne sind datengetrieben.
- Siedlungen und Karten sind vollständige JSON-Dokumente; TypeScript enthält keine fest codierte Referenzkartengeometrie.
- Auch die gebündelte Referenzkarte wird beim Laden mit dem öffentlichen Zod-Dokumentschema validiert.
- Speicherung ist in eigenen Persistenzmodulen gekapselt. Vor PWA-, Cloud- oder
  Tauri-Ausbau wird daraus eine explizite Repository-Schnittstelle, damit die
  Speicherimplementierungen austauschbar bleiben.
- Code, Domänenschlüssel und technische Metadaten verwenden Englisch. Sichtbare Anwendungstexte werden über typisierte Übersetzungsschlüssel bereitgestellt.
- Deutsch und Englisch sind vollständig für die Anwendungsoberfläche hinterlegt. Die Auswahl folgt beim ersten Start der Browsersprache und wird anschließend lokal gespeichert.
- Frei bearbeitbare Siedlungsinhalte wie Namen, Notizen und Beschreibungen bleiben in der vom Benutzer eingegebenen Sprache und werden nicht automatisch übersetzt.
- Die Oberfläche unterstützt ein helles und ein dunkles Farbschema. Ohne Benutzerauswahl folgt sie der laufenden Systemeinstellung; eine explizite Auswahl wird lokal gespeichert.

Geplante Modulstruktur:

```text
src/
  data/maps/       gebündelte, schemafähige Siedlungen als JSON
  data/             Kartenkatalog und datengetriebene Editorvorlagen
  domain/          Gebäude, Bewohner, Projekte, Ressourcen
  geometry/        Grundrisse, Bögen, Palisaden, Kollisionen
  rulesets/dnd5e/  D&D-Baupläne, Gegenstände und Voraussetzungen
  editor/          Werkzeuge, Auswahl, Undo und Redo
  i18n/            Sprachkontext und typisierte Übersetzungskataloge
  persistence/     lokale Dokumentablage und Schemawechsel
  theme/           Systemdarstellung und persistierte Farbschemawahl
  ui/              Seitenleisten, Dialoge und Verzeichnisse
  presentation/    reduzierte Spieltischansicht
```

### 12.3 Speicherung

Für den MVP wird noch kein SQLite verwendet.

- Der Browser-Prototyp speichert Arbeitsstände in IndexedDB.
- Die Ausgangsversion von Herzdorf liegt als `src/data/maps/herzdorf.json` im selben Format wie ein Benutzerexport vor; `src/data/map-catalog.json` wählt nur die Standarddatei aus.
- Gebündelte Siedlungen werden beim ersten Start als bearbeitbare Template-Dokumente in IndexedDB angelegt. Änderungen am Template sind normale persistierte Arbeitsstände und überleben einen Neustart.
- Der Benutzer kann wahlweise das Template direkt bearbeiten oder eine unabhängige Kopie mit eigener Dokument-ID anlegen. Die Topbar erlaubt den Wechsel zwischen allen lokalen Dokumenten und die zuletzt geöffnete Auswahl wird gespeichert.
- Das Zurücksetzen einer Kopie behält deren Dokument-ID und Namen bei, damit sie niemals versehentlich den Template-Arbeitsstand überschreibt.
- Projekte können als versionierte JSON-Dateien exportiert und validiert wieder
  importiert werden. Bei einer bereits vorhandenen Dokument-ID entscheidet der
  Benutzer ausdrücklich zwischen Kopie, Ersetzen und Abbrechen.
- Zod validiert Dateien beim Laden. IndexedDB-Upgrades löschen lokale Karten
  nicht mehr pauschal. Die getesteten Migrationen von Schema 10 über Schema 11
  bis Schema 16 bilden den Ausgangspunkt für schrittweise Migrationen
  weiterer Versionen.
- Nicht migrierbare lokale Dokumente bleiben als Wiederherstellungseinträge in
  der Dokumentauswahl sichtbar und können unverändert als JSON-Rohdaten
  exportiert werden.
- Die App fragt `navigator.storage.persist()` an, stößt ausstehende
  Speichervorgänge bei `visibilitychange` und `pagehide` an und zeigt Quota-,
  Validierungs- sowie Schreibfehler an. Ein fehlgeschlagener Stand bleibt als
  ungespeichert markiert und kann erneut gespeichert oder per Notfall-Export
  gesichert werden.
- Gebündelte Bitmaps bleiben separate Build-Assets. Spätere benutzereigene
  Bilder werden gemeinsam mit dem Dokument in einem Projekt-ZIP transportiert.
- Eine mögliche Tauri-Fassung kann native Datei-Dialoge und Dateisystemzugriff
  ergänzen.

### 12.4 Desktop-Strategie

Die Vite-SPA wird als installierbare Offline-PWA ausgeliefert. Das
Web-App-Manifest verwendet die Hearthholds-Identität und Standalone-Darstellung.
Der Produktions-Build erzeugt aus seinen tatsächlichen gehashten Dateien eine
vollständige Precache-Liste für Anwendung, Karten und gebündelte Artworks. Nach
dem ersten Online-Start kann die Siedlung daher ohne Netzwerk neu geöffnet
werden; IndexedDB bleibt die lokale Dokumentablage.

Ein neuer Service Worker aktiviert sich nicht ungefragt. Die App zeigt das
Update an, speichert einen offenen Arbeitsstand und sendet erst danach die
Aktivierungsnachricht. Scheitert das Speichern, bleibt die laufende Fassung
aktiv. Eine Verpackung mit Tauri 2 bleibt eine optionale Desktop-Ausbaustufe.

Zum Zeitpunkt dieser Festlegung ist im lokalen Workspace Node.js `v26.3.0` vorhanden; Rust und Cargo sind nicht installiert. Das blockiert den Browser-Prototyp nicht.

Technische Referenzen:

- Vite: <https://vite.dev/guide/>
- React: <https://react.dev/>
- Konva: <https://konvajs.org/docs/overview.html>
- Konva Transformer: <https://konvajs.org/api/Konva.Transformer.html>
- FlattenJS: <https://alexbol99.github.io/flatten-js/>
- Dexie: <https://dexie.org/docs/Typescript>
- Zod: <https://zod.dev/>
- Tauri: <https://v2.tauri.app/start/>
- Vitest: <https://vitest.dev/guide/>
- Playwright: <https://playwright.dev/>

## 13. Implementierungsreihenfolge

### Meilenstein 1: Technisches Karteneditor-Risiko

1. Vite-, React- und TypeScript-Grundprojekt.
2. Anwendungsrahmen mit Karte, Palette, Inspektor und Statusleiste.
3. Kartenfläche mit Zoom, Verschieben und Ebenen.
4. Gebäude platzieren, auswählen, verschieben und drehen.
5. Rotation in 15-Grad-Schritten.
6. Palisaden aus Geraden und Kreisbögen.
7. Herzförmige Herzdorf-Palisade mit zwei Toren.
8. Schematische Bestandsgebäude von Herzdorf.
9. Undo, Redo und lokale Speicherung.
10. Geometrie-, Canvas- und Editor-Tests.

### Meilenstein 2: Ausgangssiedlung

1. Siedlungsverzeichnis.
2. Haushalte, benannte Personen und vereinfachte Gruppen.
3. Wohnorte und Arbeitsplätze.
4. Tiere, Felder und weitere verknüpfte Bestände.
5. Gemeinsame Ressourcen und externe Quellen.
6. Ausgangsstand und Kampagnenstart.

### Meilenstein 3: Regelbasierter Ausbau

1. Baupläne und lineare Ausbaustufen.
2. Projekte und Bauphasen.
3. Ressourcenreservierung und Buchungsprotokoll.
4. Personalzuweisung und Konfliktprüfung.
5. Laufende Schmiede mit vorhandenem Fortschritt.
6. Fehlender Schmied als blockierende Voraussetzung.
7. Manuelles Fortschreiben der Zeit und Buchungsvorschläge.

### Meilenstein 4: Spieltisch und Desktop

1. Präsentationsmodus mit automatischem Browser-Vollbild und eingepasster Karte.
2. D&D-5e-Itemkatalog aus SRD 5.1.
3. Gebäudeportfolios und D&D-Regelprofil.
4. JSON-Import und -Export.
5. Tauri-Verpackung und native Projektdateien.
6. Separates Präsentationsfenster.

## 14. Offene, nicht blockierende Details

Folgende Punkte sind noch nicht festgelegt und blockieren den Implementierungsstart nicht:

- endgültiger Standard-Zoom;
- Größe und Namen von Bernds Familie;
- konkrete Besetzung von Schreinerei und Wachturm;
- typische Anzahl verfügbarer Tagelöhner;
- konkrete Startbestände und wöchentliche Lieferungsvorschläge für Holz und Stein;
- Transportmittel und genaue Transportkapazität;
- vollständige D&D-5e-Zuordnung der Items zu Gebäudefähigkeiten;
- endgültige Kosten, Dauer und Phasen aller Baupläne;
- visuelle Asset-Stile und spätere Bitmap-Pakete;
- genauer Umfang des Kartenbildimports;
- spätere Ausgestaltung des WFRP-Regelwerkprofils.

Für diese Punkte werden während der Implementierung klar gekennzeichnete Standard- oder Beispieldaten verwendet.
