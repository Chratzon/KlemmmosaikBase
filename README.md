# KlemmmosaikBase

PWA, die aus einem Foto eine Mosaik-Vorlage für Klemmbausteine macht: Ausschnitt wählen, Größe und Bauweise festlegen, Teileliste und Bauanleitung bekommen, als PDF oder Bestellliste exportieren. Alles läuft im Browser, das Bild verlässt das Gerät nicht.

## Was die App kann

- **Bild laden und zuschneiden:** Seitenverhältnis 1:1, 4:3, 3:4, 3:2, 2:3 oder frei. Beim Ziehen einer Ecke oder eines Punkts zeigt eine Lupe die Stelle dreifach vergrößert. Helligkeit, Kontrast und Sättigung anpassen.
- **Formen:** Rechteck, Kreis, Sechseck (quer oder hoch), Achteck, Herz, Stern oder eine eigene Form aus beliebig vielen Punkten. Felder außerhalb der Form bleiben leer oder werden mit einer Farbe gefüllt.
- **Zwei Bauweisen:**
  - *Flach:* Noppen zeigen nach vorn, jeder Punkt ist 8 × 8 mm. Teile wahlweise 1×1 rund (Platte oder Fliese), glatte Fliesen oder Platten.
  - *Stehend:* 1×N-Platten liegen gestapelt, das Bild wird von der Seite angesehen. Jeder Punkt ist 8 × 3,2 mm, also 2,5-mal feiner in der Höhe.
- **Größe:** Breite in Noppen, die Höhe ergibt sich aus dem Ausschnitt. Zentimeter werden mit angezeigt (37 Noppen ≈ 30 cm).
- **Nur echte Teile:** Angeboten werden nur Farben, in denen LEGO das gewählte 1×1-Teil hergestellt hat. Größere Teile kommen nur in Farben zum Einsatz, in denen es sie gibt. Seltene Kombinationen sind in der Teileliste markiert.
- **Farben:** bis zu 40 LEGO-Farben, frei auswählbar. Farbanzahl begrenzbar, optionale Farbmischung (Fehlerstreuung).
- **Vorschau immer im Blick:** Die Vorschau bleibt beim Scrollen oben stehen. Zoomen mit zwei Fingern, Mausrad oder Tasten, verschieben durch Ziehen.
- **Von Hand nachbessern:** Einzelne Punkte umfärben oder leeren, Pipette, Rückgängig. Im Bearbeiten-Modus malt ein Finger, zwei Finger zoomen und verschieben.
- **Zusammenhalt prüfen:** Stehend gebaut warnt die App, wenn eine Form in getrennte Teilstücke zerfällt, die eine Rückwand brauchen.
- **Teile-Optimierung:** Gleiche Farben werden zu größeren Teilen zusammengefasst. Flach bis 2×4, ohne über die 16×16-Abschnitte hinauszugehen. Stehend 1×2 bis 1×8, mit versetzten Stoßfugen wie im Mauerverband.
- **Teileliste** mit LEGO- und BrickLink-Farbnummern, Teilenummern und einstellbarer Reserve.
- **Bauanleitung Schritt für Schritt:** flach in 16×16-Abschnitten mit Farbsymbolen, stehend Lage für Lage von unten mit Plattenlängen.
- **Exporte:** PDF-Anleitung, BrickLink-Wunschliste (XML), CSV.
- **Projekte und Versionen:** Jedes Bild ist ein Projekt mit beliebig vielen Versionen (Einstellungen und Handänderungen). Versionen lassen sich aus der aktuellen ableiten, umbenennen, wechseln und löschen. Alles wird automatisch auf dem Gerät gespeichert.
- **Original überblenden:** Das Originalbild lässt sich mit einem Regler halbtransparent über die Vorschau legen. Die Teilefugen können dabei als oberste Ebene sichtbar bleiben.
- **Offline nutzbar.**

## So wird die Farbe eines Steins bestimmt

1. Der Ausschnitt wird in so viele Felder geteilt, wie das Mosaik Punkte hat.
2. Pro Feld wird der Mittelwert aller Bildpunkte gebildet, in linearem Licht (nicht in sRGB), damit feine Muster richtig gemittelt werden.
3. Der Mittelwert wird in den Lab-Farbraum umgerechnet und mit jeder freigegebenen Steinfarbe verglichen (Farbabstand CIEDE2000). Die nächste Farbe gewinnt.
4. Bei begrenzter Farbanzahl fällt nacheinander die Farbe weg, deren Fehlen den kleinsten Gesamtfehler verursacht.
5. Mit Farbmischung wird der Rest-Fehler nach Floyd–Steinberg auf die Nachbarfelder verteilt.

Die hinterlegten Farbwerte sind Näherungen der echten Steinfarben.

## Woher die Verfügbarkeit stammt

`js/availability.js` enthält für jedes verwendete Teil, in welchen Farben LEGO es in offiziellen Sets verbaut hat, mit Stückzahl. Quelle ist die Rebrickable-Datenbank im Auszug vom September 2022 (veröffentlicht im TidyTuesday-Projekt). Ab 10 Stück gilt eine Kombination als erhältlich, unter 100 Stück als selten. Farben, die erst nach 2022 dazugekommen sind, fehlen. Drittanbieter wie GoBricks bieten teils weitere Farben an, dafür gibt es aber keine verlässliche Datenquelle.

## Aufbau

```
index.html            Oberfläche
css/app.css           Gestaltung
js/palette.js         Farben (LEGO/BrickLink) und Teilekatalog
js/availability.js    Welche Farbe es in welchem Teil gibt
js/shapes.js          Formen für den Ausschnitt
js/mosaic.js          Rasterung, Farbabgleich, Farblimit, Teile-Optimierung
js/render.js          Zeichnen auf Canvas
js/export.js          CSV, BrickLink-XML, PDF
js/app.js             Ablauf und Bedienung
js/store.js           Speichern in IndexedDB
js/projects.js        Projekte und Versionen
js/install.js         Installation als App, Service Worker
js/vendor/            jsPDF 2.5.1 (MIT-Lizenz)
sw.js                 Offline-Cache
```

## Veröffentlichen

GitHub Pages: im Repo unter *Settings → Pages* als Quelle den Branch `main` und den Ordner `/ (root)` wählen. Die App liegt dann unter `https://chratzon.github.io/KlemmmosaikBase/`.

Bei Änderungen an Dateien in `sw.js` die `VERSION` hochzählen, damit installierte Geräte die neue Fassung laden.
