# Lernbegleiter

Eine kleine Lern-App für Klasse 7 als Web-App (PWA). Sie läuft im Safari des iPads und lässt sich auf den Homescreen legen. Ein Mac oder App Store ist nicht nötig.

Alle Daten bleiben lokal auf dem Gerät. Die **Schulanbindung** holt Stundenplan, Ausfälle und Hausaufgaben aus WebUntis sowie Aufgaben aus itslearning. Einrichtung: [worker/README.md](worker/README.md). Einen von Hand eingetragenen Stundenplan gibt es nicht mehr.

- **Heute:** Spruch des Tages, Briefing zum Vorlesen, „Als Nächstes“ mit genau einer Aufgabe und Fokus-Timer (20 Minuten), Tagesziel-Leiste, Stundenplan, Ranzen-Check, Hausaufgaben, Termine
- **Aufgaben:** Hausaufgaben eintragen und abhaken
- **Termine:** eigener Schulkalender für Klassenarbeiten, Tests und Abgaben mit Countdown
- **Plan:** Wochen-Stundenplan aus WebUntis, Fächer mit Farben und den Sachen für den Ranzen
- **Ich → Profil:** Level, Serie mit Joker, Bestwert, Abzeichen
- **Ich → Werkstatt:** 56 freischaltbare Teile in acht Gruppen, darunter Begleiter, Hintergrund-Räume, Titel und die Akzentfarbe der ganzen App
- **Ich → Rätsel:** Tagesrätsel (öffnet sich mit dem Tagesziel, gibt einen Sticker fürs Monatsalbum) und Spielecke mit Sudoku 4×4/6×6/9×9, Kopfrechnen, Vokabel-Memory, Zahlenfolgen und Schalter-Rätsel. Rätsel geben keine XP.
- **Ich → Einstellungen:** Name, Ferien, Schulanbindung, Datensicherung

Die Sprüche stehen in `quotes.js` (rund 300, je Schuljahr neu gemischt; vor eingetragenen Tests, nach Ferien und bei Serien-Meilensteinen kommen passende Sprüche). Die Rätsel stehen in `games.js`.

## XP-Regeln

| Aktion | XP |
| --- | --- |
| Ranzen-Check erledigt | +5 |
| Briefing gelesen oder gehört | +5 |
| Hausaufgabe erledigt | +10 |
| … pünktlich | +5 |
| … selbst eingetragen | +5 |
| Tagesziel (Ranzen gepackt und alles bis zum nächsten Schultag erledigt) | +20 |
| Wochenziel (Tagesziel an 4 Tagen einer Woche) | +50 |

Die Serie zählt Schultage mit Aktivität. Wochenenden und eingetragene Ferien unterbrechen sie nicht, ein verpasster Tag pro Woche wird vom Joker gerettet. Ab 5 Tagen gibt es ×1,2 auf alle XP. Es gibt keine Abzüge.

## Installation auf dem iPad

1. Die Seite in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Ab jetzt die App über das Symbol starten. Nur so bleiben die Daten dauerhaft gespeichert.

## Technik

Reines HTML, CSS und JavaScript ohne Build-Schritt mit relativen Pfaden, veröffentlicht über GitHub Pages. Der Abrufdienst in `worker/` läuft bei Cloudflare oder auf einem eigenen Node.js-Server; ein späterer Umzug ist in [worker/README.md](worker/README.md#später-auf-einen-eigenen-server-umziehen) beschrieben. `sw.js` macht die App offline nutzbar; nach Änderungen dort `VERSION` erhöhen.

Das Konzept steht im Projekt-Dokument „Lernbegleiter – Konzept“.
